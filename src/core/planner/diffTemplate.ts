export type TemplateChangeKind = 'added' | 'removed' | 'changed' | 'restDayChanged';

export interface TemplateDiffEntry {
  key: string;
  title: string;
  change: TemplateChangeKind;
  reason: string;
}

/** Deliberately not imported from `@/lib/db/schemas`'s `TemplateRow` —
 * `src/core/**` stays independent of the I/O layer, even for a type-only
 * import. This mirrors the fields `TemplateRow['blocks'][number]` actually
 * has; a caller passing real template rows satisfies it structurally. */
export interface TemplateBlockLike {
  key: string;
  title: string;
  start: string;
  durationMin: number;
  anchor: boolean;
}

function blockChanges(a: TemplateBlockLike, b: TemplateBlockLike): string[] {
  const changes: string[] = [];
  if (a.title !== b.title) changes.push(`Renamed from "${a.title}" to "${b.title}"`);
  if (a.start !== b.start) changes.push(`Time changed from ${a.start} to ${b.start}`);
  if (a.durationMin !== b.durationMin) changes.push(`Length changed from ${a.durationMin} to ${b.durationMin} minutes`);
  if (a.anchor !== b.anchor) changes.push(b.anchor ? 'Now an anchor' : 'No longer an anchor');
  return changes;
}

/** Pure diff between a template's current shape and a proposed one — the
 * template equivalent of `diffBlocks` (diff.ts), which diffs a DayPlan's
 * blocks instead. Used by the `propose_template_edit` mentor tool and its
 * review card; never writes anything itself. */
export function diffTemplate(
  current: { restDay: boolean; blocks: TemplateBlockLike[] },
  proposed: { restDay: boolean; blocks: TemplateBlockLike[] },
): TemplateDiffEntry[] {
  const entries: TemplateDiffEntry[] = [];
  const currentByKey = new Map(current.blocks.map((b) => [b.key, b]));
  const proposedByKey = new Map(proposed.blocks.map((b) => [b.key, b]));

  for (const b of proposed.blocks) {
    if (!currentByKey.has(b.key)) entries.push({ key: b.key, title: b.title, change: 'added', reason: 'Added' });
  }
  for (const b of current.blocks) {
    if (!proposedByKey.has(b.key)) entries.push({ key: b.key, title: b.title, change: 'removed', reason: 'Removed' });
  }
  for (const b of proposed.blocks) {
    const prior = currentByKey.get(b.key);
    if (!prior) continue;
    const changes = blockChanges(prior, b);
    for (const reason of changes) entries.push({ key: b.key, title: b.title, change: 'changed', reason });
  }

  if (current.restDay !== proposed.restDay) {
    entries.push({ key: 'restDay', title: 'Rest day', change: 'restDayChanged', reason: proposed.restDay ? 'Turned on' : 'Turned off' });
  }

  return entries;
}
