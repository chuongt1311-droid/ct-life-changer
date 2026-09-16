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

export async function writeMemory(label: 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory', properties: Record<string, unknown>): Promise<void> {
  const cfg = configured();
  if (!cfg) return;
  try {
    const { signal } = withTimeout();
    await fetch(`${cfg.url}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ label, properties }),
      signal,
    });
  } catch {
    // Fire-and-forget: a memory-api outage must never break the caller.
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
    if (!res.ok) return '';
    const data = (await res.json()) as { text: string };
    return data.text;
  } catch {
    return '';
  }
}

export interface MentorMemoryRow {
  id: string;
  text: string;
  confidence: string;
  createdAt: string;
}

export async function listMentorMemories(): Promise<MentorMemoryRow[]> {
  const cfg = configured();
  if (!cfg) return [];
  try {
    const { signal } = withTimeout();
    const res = await fetch(`${cfg.url}/memory/mentor`, { headers: { Authorization: `Bearer ${cfg.token}` }, signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { memories: MentorMemoryRow[] };
    return data.memories;
  } catch {
    return [];
  }
}

export async function deleteMemory(id: string): Promise<void> {
  const cfg = configured();
  if (!cfg) return;
  try {
    const { signal } = withTimeout();
    await fetch(`${cfg.url}/memory/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${cfg.token}` }, signal });
  } catch {
    // A failed delete leaves the memory visible for CT to try again — no
    // silent data loss either way, and the settings page re-fetches after.
  }
}
