import type { Block } from '../types';

export type ChangeKind = 'added' | 'missed' | 'dropped' | 'skipped' | 'swapped' | 'shrunk' | 'moved' | 'kept';

export interface DiffEntry {
  blockId: string;
  title: string;
  change: ChangeKind;
  from: { start: number; end: number } | null;
  to: { start: number; end: number } | null;
  reason: string;
}

export interface DiffContext {
  addedIds?: string[];
  missedReasons?: Record<string, string>;
  shrinkReason?: string;
  /** Per-block reason that wins over the generic text — how CT described the
   *  change they asked for, as opposed to what the planner did in response. */
  reasons?: Record<string, string>;
}

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** What happened to every block that was still open (or newly added), for the "Day changed" screen. */
export function diffBlocks(before: Block[], after: Block[], ctx: DiffContext = {}): DiffEntry[] {
  const beforeById = new Map(before.map((b) => [b.id, b]));
  const added = new Set(ctx.addedIds ?? []);
  const entries: DiffEntry[] = [];

  for (const b of after) {
    const old = beforeById.get(b.id);
    const to = { start: b.start, end: b.end };

    if (added.has(b.id) || !old) {
      entries.push({ blockId: b.id, title: b.title, change: 'added', from: null, to, reason: ctx.reasons?.[b.id] ?? 'New block' });
      continue;
    }
    if (!isOpen(old)) continue;

    const from = { start: old.start, end: old.end };
    const base = { blockId: b.id, title: b.title, from };
    const authored = ctx.reasons?.[b.id];
    if (b.status === 'missed') {
      entries.push({ ...base, change: 'missed', to: null, reason: authored ?? ctx.missedReasons?.[b.id] ?? 'Its time has passed' });
    } else if (b.status === 'skipped') {
      entries.push({ ...base, change: 'skipped', to: null, reason: authored ?? 'You skipped it' });
    } else if (b.status === 'dropped') {
      entries.push({ ...base, change: 'dropped', to: null, reason: authored ?? "Lowest priority — it didn't fit" });
    } else if (b.title !== old.title) {
      entries.push({ ...base, change: 'swapped', to, reason: authored ?? `Swapped from "${old.title}" for the recovery version` });
    } else if (b.end - b.start < old.end - old.start) {
      entries.push({ ...base, change: 'shrunk', to, reason: authored ?? ctx.shrinkReason ?? 'Shortened to fit the day' });
    } else if (b.start !== old.start) {
      entries.push({ ...base, change: 'moved', to, reason: authored ?? 'Moved to make room' });
    } else {
      entries.push({ ...base, change: 'kept', to, reason: authored ?? '' });
    }
  }
  return entries;
}
