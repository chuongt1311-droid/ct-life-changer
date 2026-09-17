/** Every function here degrades to a safe no-op/empty-result when
 * MEMORY_API_URL isn't configured or the service is unreachable — this
 * feature must never be a hard dependency for anything else in the app.
 * `writeMemory` and `queryMemory` in particular are meant to be called
 * fire-and-forget from existing digest/letter/check-in flows that have
 * nothing to do with this feature and must keep working if it's down. */

function configured(): { url: string; token: string } | null {
  const url = process.env.MEMORY_API_URL;
  const token = process.env.MEMORY_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function withTimeout(): { controller: AbortController; signal: AbortSignal } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  // Clean up timeout on abort to prevent leaks
  controller.signal.addEventListener('abort', () => clearTimeout(timeout));
  return { controller, signal: controller.signal };
}

/** Returns true only when the write actually reached memory-api. Still
 * never throws — fire-and-forget callers can keep ignoring the result,
 * while callers that report back to CT (the `remember` tool, the backfill
 * script) can tell a real save from a silent no-op. */
export async function writeMemory(label: 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory', properties: Record<string, unknown>): Promise<boolean> {
  const cfg = configured();
  if (!cfg) return false;
  try {
    const { signal } = withTimeout();
    const res = await fetch(`${cfg.url}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ label, properties }),
      signal,
    });
    if (!res.ok) console.error(`writeMemory: memory-api responded ${res.status}`, await res.text().catch(() => ''));
    return res.ok;
  } catch (err) {
    // Fire-and-forget: a memory-api outage must never break the caller.
    console.error('writeMemory: request failed', err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function queryMemory(question: string): Promise<string> {
  const cfg = configured();
  if (!cfg) return '';
  try {
    const { signal } = withTimeout();
    const res = await fetch(`${cfg.url}/memory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ question }),
      signal,
    });
    if (!res.ok) {
      console.error(`queryMemory: memory-api responded ${res.status}`);
      return '';
    }
    const data = (await res.json()) as { text: string };
    return data.text;
  } catch (err) {
    console.error('queryMemory: request failed', err instanceof Error ? err.message : String(err));
    return '';
  }
}

export interface MentorMemoryRow {
  id: string;
  text: string;
  confidence: string;
  createdAt: string;
}

export type ListMentorMemoriesResult = { ok: true; memories: MentorMemoryRow[] } | { ok: false };

/** `{ ok: false }` means we couldn't reach memory-api (or it isn't
 * configured); `{ ok: true, memories: [] }` means it answered and CT
 * genuinely has nothing saved. The settings page's whole purpose is
 * transparency, so it must be able to tell those two apart. */
export async function listMentorMemories(): Promise<ListMentorMemoriesResult> {
  const cfg = configured();
  if (!cfg) return { ok: false };
  try {
    const { signal } = withTimeout();
    const res = await fetch(`${cfg.url}/memory/mentor`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { memories: MentorMemoryRow[] };
    return { ok: true, memories: data.memories };
  } catch {
    return { ok: false };
  }
}

/** Returns true only when memory-api confirmed the delete. Still never
 * throws, but a failed delete now says so, so the settings page can keep
 * the row visible for CT to try again instead of pretending it's gone. */
export async function deleteMemory(id: string): Promise<boolean> {
  const cfg = configured();
  if (!cfg) return false;
  try {
    const { signal } = withTimeout();
    const res = await fetch(`${cfg.url}/memory/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` }, signal });
    return res.ok;
  } catch {
    return false;
  }
}
