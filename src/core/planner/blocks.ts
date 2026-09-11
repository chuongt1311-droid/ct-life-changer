import { toPlanMinute } from '../time';
import type { Block, BlockKind, TemplateBlock } from '../types';

/** Spec §5.2: anchors can't shrink, rest shrinks to 15 min, everything else to half. */
export function defaultMinMinutes(kind: BlockKind, anchor: boolean, durationMin: number): number {
  if (anchor) return durationMin;
  if (kind === 'rest') return Math.min(15, durationMin);
  return Math.ceil(durationMin / 2);
}

export function blockFromTemplate(tb: TemplateBlock, date: string): Block {
  const start = toPlanMinute(tb.start);
  return {
    id: `${date}:${tb.key}`,
    title: tb.title,
    kind: tb.kind,
    anchor: tb.anchor,
    priority: tb.priority,
    start,
    end: start + tb.durationMin,
    minMinutes: tb.minMinutes ?? defaultMinMinutes(tb.kind, tb.anchor, tb.durationMin),
    window: tb.window
      ? { earliestStart: toPlanMinute(tb.window.earliestStart), latestEnd: toPlanMinute(tb.window.latestEnd) }
      : null,
    tags: tb.tags ?? [],
    checklist: (tb.checklist ?? []).map((label) => ({ label, done: false })),
    recoveryVariant: tb.recoveryVariant ?? null,
    status: 'planned',
    source: 'template',
  };
}

/** Swap a hard training block for its recovery variant (no-op for anything else). */
export function toRecovery(b: Block): Block {
  if (b.kind !== 'training' || !b.recoveryVariant || !b.tags.includes('hardTraining')) return b;
  return {
    ...b,
    title: b.recoveryVariant.title,
    checklist: b.recoveryVariant.checklist.map((label) => ({ label, done: false })),
    tags: [...b.tags.filter((t) => t !== 'hardTraining'), 'recovery'],
  };
}
