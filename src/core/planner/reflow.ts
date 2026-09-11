import type { Block, DayPlan, Priority } from '../types';
import { toRecovery } from './blocks';
import { type DiffEntry, diffBlocks } from './diff';
import { layout, type LayoutInput } from './layout';

/** Spec §5.4. Ids for new blocks come from the caller so reflow stays pure. */
export type ReflowEvent =
  | { type: 'late'; minutes: number }
  | { type: 'lostTime'; start: number; end: number }
  | { type: 'urgent'; id: string; title: string; durationMin: number; priority: Priority }
  | { type: 'lowEnergy'; restId: string };

export interface ReflowResult {
  plan: DayPlan;
  diff: DiffEntry[];
  conflicts: [string, string][];
}

const isOpenAt = (b: Block, now: number) => (b.status === 'planned' || b.status === 'active') && b.end > now;

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

/** Rebuild the rest of the day after a disruption. Wind-down starts 60 min before bedtime. */
export function reflow(plan: DayPlan, now: number, event: ReflowEvent): ReflowResult {
  const base = { now, wake: plan.wake, until: plan.bedtime - 60 };
  let input: LayoutInput;
  let addedIds: string[] = [];
  let shrinkReason: string | undefined;

  switch (event.type) {
    case 'late':
      // CT hasn't really started the current block: re-place it too.
      input = { ...base, blocks: plan.blocks, earliest: now + event.minutes, keepRunning: false };
      break;
    case 'lostTime':
      input = { ...base, blocks: plan.blocks, unavailable: [{ start: event.start, end: event.end }] };
      break;
    case 'urgent': {
      const urgent = newBlock({
        id: event.id,
        title: event.title,
        kind: 'task',
        priority: event.priority,
        start: now,
        end: now + event.durationMin,
        tags: ['urgent'],
        source: 'urgent',
      });
      addedIds = [urgent.id];
      input = { ...base, blocks: [...plan.blocks, urgent], keepRunning: false, placeFirst: [urgent.id] };
      break;
    }
    case 'lowEnergy': {
      const recharge = newBlock({
        id: event.restId,
        title: 'Recharge',
        kind: 'rest',
        priority: 4,
        start: now,
        end: now + 15,
        tags: ['recharge'],
        source: 'guard',
      });
      addedIds = [recharge.id];
      shrinkReason = 'Shortened — energy is low';
      const blocks = plan.blocks.map((b) => (isOpenAt(b, now) ? lowEnergyVersion(b) : b));
      input = { ...base, blocks: [...blocks, recharge], keepRunning: false, placeFirst: [recharge.id] };
      break;
    }
  }

  const result = layout(input);
  const diff = diffBlocks(plan.blocks, result.blocks, {
    addedIds,
    missedReasons: result.missedReasons,
    ...(shrinkReason ? { shrinkReason } : {}),
  });
  return { plan: { ...plan, blocks: result.blocks }, diff, conflicts: result.conflicts };
}
