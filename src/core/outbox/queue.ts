/** Spec §12: "form submissions and block status changes go into an IndexedDB
 * outbox and sync on reconnect (last-write-wins per record; single user
 * makes conflicts rare)." This module is the pure state machine only — no
 * IndexedDB, no clock, no network. `src/lib/offline/db.ts` persists it;
 * `src/lib/offline/useOutbox.ts` drives it against the network. */
export type OutboxStatus = 'pending' | 'syncing' | 'failed';

export interface OutboxEntry {
  id: string;
  /** Which server action replays this entry, e.g. "eveningCheckin", "blockStatus". */
  kind: string;
  payload: unknown;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export function enqueue(queue: OutboxEntry[], entry: { id: string; kind: string; payload: unknown }, now: string): OutboxEntry[] {
  return [...queue, { ...entry, createdAt: now, status: 'pending', attempts: 0 }];
}

export function markSyncing(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.map((e) => (e.id === id ? { ...e, status: 'syncing' } : e));
}

/** A synced entry leaves the queue entirely — nothing to retry. */
export function markSynced(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.filter((e) => e.id !== id);
}

/** Under the retry cap: back to pending so a later reconnect retries it.
 * At the cap: terminally `failed` — the caller surfaces this rather than
 * retrying forever against, e.g., a permanently malformed payload. */
export function markFailed(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.map((e) => {
    if (e.id !== id) return e;
    const attempts = e.attempts + 1;
    return { ...e, attempts, status: attempts > MAX_ATTEMPTS ? 'failed' : 'pending' };
  });
}

/** Oldest pending entry, or null if nothing is waiting (syncing/failed don't count). */
export function nextPending(queue: OutboxEntry[]): OutboxEntry | null {
  const pending = queue.filter((e) => e.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return pending[0] ?? null;
}
