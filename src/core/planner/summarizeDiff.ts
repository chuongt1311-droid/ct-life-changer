import type { DiffEntry } from './diff';

/** A one-line-per-change text summary for the mentor's "Ask mentor" reflow
 * comment (spec §5.4) — the route takes a plain diffSummary string, not the
 * structured DiffEntry[], to stay a simple text prompt. Pure. Note: the
 * apostrophe in "didn't" is replaced with a plain one so the summary reads
 * cleanly as a single sentence fragment either way — no functional meaning,
 * just consistent punctuation for the model's prompt. */
export function summarizeDiff(diff: DiffEntry[]): string {
  const changed = diff.filter((d) => d.change !== 'kept');
  if (changed.length === 0) return 'Nothing changed.';
  return changed.map((d) => `${d.title}: ${d.change} — ${d.reason.replace("didn't", 'did not')}.`).join(' ');
}
