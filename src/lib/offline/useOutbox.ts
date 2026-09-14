'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueue, markFailed, markSynced, markSyncing, nextPending, type OutboxEntry } from '@/core/outbox/queue';
import { loadOutbox, saveOutbox } from './db';

/** Wires the pure queue (Task 4, Step 3) to IndexedDB and the browser's
 * online/offline events. `handlers` maps an entry's `kind` to the server
 * action that replays it — each screen registers only the kinds it can
 * produce (e.g. the evening check-in screen registers "eveningCheckin"). */
export function useOutbox(handlers: Record<string, (payload: unknown) => Promise<void>>) {
  const [queue, setQueue] = useState<OutboxEntry[]>([]);
  const syncingRef = useRef(false);

  useEffect(() => {
    loadOutbox().then(setQueue);
  }, []);

  const drain = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    let current = await loadOutbox();
    let entry = nextPending(current);
    while (entry) {
      const handler = handlers[entry.kind];
      current = markSyncing(current, entry.id);
      setQueue(current);
      try {
        if (!handler) throw new Error(`No offline handler registered for "${entry.kind}"`);
        await handler(entry.payload);
        current = markSynced(current, entry.id);
      } catch {
        current = markFailed(current, entry.id);
      }
      await saveOutbox(current);
      setQueue(current);
      entry = nextPending(current);
    }
    syncingRef.current = false;
  }, [handlers]);

  useEffect(() => {
    drain();
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, [drain]);

  const enqueueAction = useCallback(
    async (kind: string, payload: unknown) => {
      const current = await loadOutbox();
      const id = crypto.randomUUID();
      const next = enqueue(current, { id, kind, payload }, new Date().toISOString());
      await saveOutbox(next);
      setQueue(next);
      drain();
    },
    [drain],
  );

  return { pendingCount: queue.filter((e) => e.status !== 'failed').length, enqueue: enqueueAction };
}
