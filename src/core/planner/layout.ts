import type { Block } from '../types';
import { contains, earliestFit, type Interval, latestFit, normalize, overlaps, subtract } from './intervals';

export interface LayoutInput {
  blocks: Block[];
  /** Current plan minute. Blocks that ended before now, or aren't planned/active, are left untouched. */
  now: number;
  wake: number;
  /** Flexible blocks must end by this minute (start of wind-down). */
  until: number;
  /** Flexible blocks can't start before this (default: now). Used for "running late". */
  earliest?: number;
  /** Time CT has lost. Fixed anchors inside it become missed; nothing else is placed there. */
  unavailable?: Interval[];
  /** Keep blocks that are running at `now` exactly where they are (default true). */
  keepRunning?: boolean;
  /** Flexible block ids placed first, starting at the earliest free minute. */
  placeFirst?: string[];
}

export interface LayoutResult {
  blocks: Block[];
  /** Pairs of block ids that overlap and that the planner may not move (fixed anchors / running blocks). */
  conflicts: [string, string][];
  missedReasons: Record<string, string>;
}

const byStart = (a: Block, b: Block) => a.start - b.start;
/** Lowest priority first; ties: the later block first. */
const lowestFirst = (a: Block, b: Block) => a.priority - b.priority || b.start - a.start;

/**
 * Spec §5.5. Deterministic: the same input always gives the same output.
 * 1. anchors: fixed keep their time; windowed stay put if free, else move to the earliest free
 *    slot in their window, else become missed
 * 2. flexible blocks fill the remaining free time in their original order. A block stays at its
 *    original start (or later, if pushed) and only moves earlier when the rest of the day
 *    wouldn't fit otherwise
 * 3. overflow: shrink (lowest priority first) to minMinutes, then drop (lowest priority first)
 */
export function layout(input: LayoutInput): LayoutResult {
  const { blocks, now, wake, until } = input;
  const keepRunning = input.keepRunning ?? true;
  const from = Math.max(input.earliest ?? now, wake);
  const lost = normalize(input.unavailable ?? []);
  const placeFirst = input.placeFirst ?? [];

  const untouched: Block[] = [];
  const kept: Block[] = [];
  const movable: Block[] = [];
  for (const b of blocks) {
    const open = b.status === 'planned' || b.status === 'active';
    if (!open || b.end <= now) untouched.push(b);
    else if (keepRunning && b.start <= now) kept.push(b);
    else movable.push(b);
  }

  // 1. Anchors
  const missedReasons: Record<string, string> = {};
  const anchors: Block[] = [];
  const missed: Block[] = [];
  const movableAnchors = movable.filter((b) => b.anchor).sort(byStart);

  for (const a of movableAnchors.filter((b) => b.window === null)) {
    if (lost.some((l) => overlaps(l, a))) {
      missed.push({ ...a, status: 'missed' });
      missedReasons[a.id] = 'Clashes with the time you lost';
    } else {
      anchors.push(a);
    }
  }
  for (const a of movableAnchors.filter((b) => b.window !== null)) {
    const window = a.window!;
    const duration = a.end - a.start;
    const free = subtract(
      [{ start: Math.max(from, window.earliestStart), end: window.latestEnd }],
      [...lost, ...anchors, ...kept],
    );
    const start = contains(free, a) ? a.start : earliestFit(free, 0, duration);
    if (start === null) {
      missed.push({ ...a, status: 'missed' });
      missedReasons[a.id] = 'No free time left inside its window';
    } else {
      anchors.push({ ...a, start, end: start + duration });
    }
  }

  // 2 + 3. Flexible blocks
  const rank = (b: Block) => {
    const i = placeFirst.indexOf(b.id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const flexible = movable.filter((b) => !b.anchor).sort((a, b) => rank(a) - rank(b) || a.start - b.start);
  const baseFree = subtract([{ start: from, end: until }], [...lost, ...anchors, ...kept]);
  const durations = new Map(flexible.map((b) => [b.id, b.end - b.start]));
  const dropped = new Set<string>();

  const tryPlace = (): Block[] | null => {
    const order = flexible.filter((b) => !dropped.has(b.id));
    // Backward pass: the latest each block may start so that everything after it still fits.
    const latest = new Map<string, number>();
    let deadline = until;
    for (let i = order.length - 1; i >= 0; i--) {
      const b = order[i]!;
      const start = latestFit(baseFree, deadline, durations.get(b.id)!);
      if (start === null) return null;
      latest.set(b.id, start);
      deadline = start;
    }
    // Forward pass: stay at the original start, pulled earlier only as far as the tail needs.
    let free = baseFree;
    let prevEnd = from;
    const out: Block[] = [];
    for (const b of order) {
      const duration = durations.get(b.id)!;
      const preferred = placeFirst.includes(b.id) ? from : b.start;
      const earliest = Math.max(prevEnd, Math.min(preferred, latest.get(b.id)!));
      const start = earliestFit(free, earliest, duration);
      if (start === null) return null; // unreachable when the backward pass succeeded
      out.push({ ...b, start, end: start + duration });
      free = subtract(free, [{ start, end: start + duration }]);
      prevEnd = start + duration;
    }
    return out;
  };

  let placed = tryPlace();
  while (placed === null) {
    const active = flexible.filter((b) => !dropped.has(b.id));
    const shrinkable = active.filter((b) => durations.get(b.id)! > b.minMinutes).sort(lowestFirst);
    if (shrinkable.length > 0) {
      const b = shrinkable[0]!;
      durations.set(b.id, b.minMinutes);
    } else {
      const victim = [...active].sort(lowestFirst)[0]!;
      dropped.add(victim.id);
    }
    placed = tryPlace();
  }

  const droppedBlocks = flexible
    .filter((b) => dropped.has(b.id))
    .map((b): Block => ({ ...b, status: 'dropped' }));

  const fixed = [...kept, ...anchors].sort(byStart);
  const conflicts: [string, string][] = [];
  for (let i = 0; i < fixed.length; i++) {
    for (let j = i + 1; j < fixed.length; j++) {
      if (overlaps(fixed[i]!, fixed[j]!)) conflicts.push([fixed[i]!.id, fixed[j]!.id]);
    }
  }

  return {
    blocks: [...untouched, ...kept, ...anchors, ...missed, ...placed, ...droppedBlocks].sort(byStart),
    conflicts,
    missedReasons,
  };
}
