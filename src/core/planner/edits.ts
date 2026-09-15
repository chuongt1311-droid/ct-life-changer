import type { Block, BlockKind, DayPlan, Priority } from '../types';
import { type DiffEntry, diffBlocks } from './diff';
import { layout, type LayoutInput } from './layout';
import { toRecovery } from './blocks';

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

export interface ReflowResult {
  plan: DayPlan;
  diff: DiffEntry[];
  conflicts: [string, string][];
}

const isOpenAt = (b: Block, now: number) => isOpen(b) && b.end > now;

function lowEnergyVersion(b: Block): Block {
  if (b.kind === 'training') return toRecovery(b);
  if (!b.anchor && (b.kind === 'task' || b.tags.includes('deepWork'))) return { ...b, end: b.start + b.minMinutes };
  return b;
}

function newBlock(fields: Pick<Block, 'id' | 'title' | 'kind' | 'priority' | 'start' | 'end' | 'tags' | 'source'>): Block {
  return {
    ...fields,
    anchor: false,
    minMinutes: fields.end - fields.start,
    window: null,
    checklist: [],
    recoveryVariant: null,
    status: 'planned',
  };
}

/** Apply a list of edits to a plan and lay the day out once.
 *
 *  Every plan change in the app goes through here: CT's hand-edits, the
 *  disruption presets, and (later) the mentor's proposals. Edits accumulate
 *  into a single LayoutInput plus per-block reasons, so several changes produce
 *  one diff and one confirmation rather than one each. Pure. */
export function applyEdits(plan: DayPlan, now: number, edits: PlanEdit[]): ReflowResult {
  let blocks = plan.blocks;
  const pinned: string[] = [];
  const addedIds: string[] = [];
  const reasons: Record<string, string> = {};
  let overrides: Partial<LayoutInput> = {};
  let shrinkReason: string | undefined;

  const patch = (id: string, fn: (b: Block) => Block) => {
    blocks = blocks.map((b) => (b.id === id ? fn(b) : b));
  };

  for (const edit of edits) {
    switch (edit.type) {
      case 'move': {
        patch(edit.blockId, (b) => ({ ...b, start: edit.toStart, end: edit.toStart + (b.end - b.start) }));
        pinned.push(edit.blockId);
        reasons[edit.blockId] = 'You moved it';
        break;
      }
      case 'resize': {
        patch(edit.blockId, (b) => ({
          ...b,
          end: b.start + edit.durationMin,
          minMinutes: Math.min(b.minMinutes, edit.durationMin),
        }));
        pinned.push(edit.blockId);
        reasons[edit.blockId] = 'You changed its length';
        break;
      }
      case 'drop': {
        // 'skipped', never 'dropped': CT chose this, and buildDaySummary counts
        // anchorsSkipped into the guard.
        patch(edit.blockId, (b) => ({ ...b, status: 'skipped' }));
        reasons[edit.blockId] = 'You skipped it';
        break;
      }
      case 'add': {
        const block = newBlock({
          id: edit.id,
          title: edit.title.trim(),
          kind: edit.kind,
          priority: edit.priority,
          start: edit.start,
          end: edit.start + edit.durationMin,
          tags: [],
          source: 'manual',
        });
        blocks = [...blocks, block];
        pinned.push(edit.id);
        addedIds.push(edit.id);
        reasons[edit.id] = 'You added it';
        break;
      }
      case 'late':
        // CT hasn't really started the current block: re-place it too.
        overrides = { ...overrides, earliest: now + edit.minutes, keepRunning: false };
        break;
      case 'lostTime':
        overrides = { ...overrides, unavailable: [{ start: edit.start, end: edit.end }] };
        break;
      case 'urgent': {
        const urgent = newBlock({
          id: edit.id,
          title: edit.title,
          kind: 'task',
          priority: edit.priority,
          start: now,
          end: now + edit.durationMin,
          tags: ['urgent'],
          source: 'urgent',
        });
        blocks = [...blocks, urgent];
        addedIds.push(urgent.id);
        overrides = { ...overrides, keepRunning: false, placeFirst: [...(overrides.placeFirst ?? []), urgent.id] };
        break;
      }
      case 'lowEnergy': {
        const recharge = newBlock({
          id: edit.restId,
          title: 'Recharge',
          kind: 'rest',
          priority: 4,
          start: now,
          end: now + 15,
          tags: ['recharge'],
          source: 'guard',
        });
        shrinkReason = 'Shortened — energy is low';
        blocks = [...blocks.map((b) => (isOpenAt(b, now) ? lowEnergyVersion(b) : b)), recharge];
        addedIds.push(recharge.id);
        overrides = { ...overrides, keepRunning: false, placeFirst: [...(overrides.placeFirst ?? []), recharge.id] };
        break;
      }
    }
  }

  const result = layout({
    blocks,
    now,
    wake: plan.wake,
    until: plan.bedtime - 60,
    pinned,
    ...overrides,
  });

  const diff = diffBlocks(plan.blocks, result.blocks, {
    addedIds,
    missedReasons: result.missedReasons,
    reasons,
    ...(shrinkReason ? { shrinkReason } : {}),
  });

  return { plan: { ...plan, blocks: result.blocks }, diff, conflicts: result.conflicts };
}
