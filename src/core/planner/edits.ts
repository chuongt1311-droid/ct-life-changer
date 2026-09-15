import type { Block, BlockKind, DayPlan, Priority } from '../types';

/** Spec §5.4. Ids for new blocks come from the caller so this stays pure. */
export type ReflowEvent =
  | { type: 'late'; minutes: number }
  | { type: 'lostTime'; start: number; end: number }
  | { type: 'urgent'; id: string; title: string; durationMin: number; priority: Priority }
  | { type: 'lowEnergy'; restId: string };

/** One change to today's plan. Block-level edits are what CT does by hand; the
 *  ReflowEvent variants are the disruption presets, included in the same union
 *  so a messy fix ("30 minutes late, and drop film room") is one list, one
 *  layout pass, one diff, one confirmation. */
export type PlanEdit =
  | { type: 'move'; blockId: string; toStart: number }
  | { type: 'resize'; blockId: string; durationMin: number }
  | { type: 'drop'; blockId: string }
  | {
      type: 'add';
      id: string;
      title: string;
      kind: BlockKind;
      start: number;
      durationMin: number;
      priority: Priority;
    }
  | ReflowEvent;

const REFLOW_TYPES = ['late', 'lostTime', 'urgent', 'lowEnergy'] as const;

export const isOpen = (b: Block): boolean => b.status === 'planned' || b.status === 'active';

export const isReflowEvent = (edit: PlanEdit): edit is ReflowEvent =>
  (REFLOW_TYPES as readonly string[]).includes(edit.type);

/** Human-readable problems with a set of edits, empty when they are fine.
 *  Returns messages rather than throwing so the UI can show them against the
 *  offending edit, and so a later mentor proposal can be handed its own errors. */
export function validateEdits(plan: DayPlan, now: number, edits: PlanEdit[]): string[] {
  const errors: string[] = [];
  const byId = new Map(plan.blocks.map((b) => [b.id, b]));
  const windDown = plan.bedtime - 60;
  let disruptions = 0;

  const openBlock = (id: string): Block | null => {
    const b = byId.get(id);
    if (!b || !isOpen(b)) {
      errors.push(`"${b?.title ?? id}" isn't a block you can still change today.`);
      return null;
    }
    return b;
  };

  for (const edit of edits) {
    switch (edit.type) {
      case 'move': {
        const b = openBlock(edit.blockId);
        if (!b) break;
        if (edit.toStart < now) errors.push(`"${b.title}" can't move into the past.`);
        else if (edit.toStart + (b.end - b.start) > windDown) {
          errors.push(`"${b.title}" wouldn't finish before wind-down.`);
        }
        break;
      }
      case 'resize': {
        const b = openBlock(edit.blockId);
        if (!b) break;
        if (edit.durationMin <= 0) errors.push(`"${b.title}" needs a length longer than zero.`);
        else if (b.start + edit.durationMin > windDown) {
          errors.push(`"${b.title}" wouldn't finish before wind-down.`);
        }
        break;
      }
      case 'drop': {
        openBlock(edit.blockId);
        break;
      }
      case 'add': {
        const title = edit.title.trim();
        if (!title) errors.push('A new block needs a title.');
        if (edit.durationMin <= 0) errors.push(`"${title || 'The new block'}" needs a length longer than zero.`);
        else if (edit.start < now) errors.push(`"${title || 'The new block'}" can't start in the past.`);
        else if (edit.start + edit.durationMin > windDown) {
          errors.push(`"${title || 'The new block'}" wouldn't finish before wind-down.`);
        }
        break;
      }
      default:
        disruptions++;
    }
  }

  if (disruptions > 1) errors.push('Only one disruption can be applied at a time.');
  return errors;
}
