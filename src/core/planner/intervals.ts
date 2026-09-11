/** Half-open time interval [start, end) in plan minutes. */
export interface Interval {
  start: number;
  end: number;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Sort, drop empty intervals, merge overlapping/touching ones. */
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push(i);
  }
  return out;
}

/** base minus remove, as sorted disjoint intervals. */
export function subtract(base: Interval[], remove: Interval[]): Interval[] {
  let result = normalize(base);
  for (const r of normalize(remove)) {
    const next: Interval[] = [];
    for (const b of result) {
      if (!overlaps(b, r)) {
        next.push(b);
        continue;
      }
      if (b.start < r.start) next.push({ start: b.start, end: r.start });
      if (r.end < b.end) next.push({ start: r.end, end: b.end });
    }
    result = next;
  }
  return result;
}

/** True if `target` lies entirely inside one of the (normalized) free intervals. */
export function contains(free: Interval[], target: Interval): boolean {
  return free.some((f) => f.start <= target.start && target.end <= f.end);
}

/** Earliest start ≥ `earliest` where `duration` fits inside a single free interval. */
export function earliestFit(free: Interval[], earliest: number, duration: number): number | null {
  for (const f of free) {
    const start = Math.max(f.start, earliest);
    if (start + duration <= f.end) return start;
  }
  return null;
}

/** Latest start such that `duration` fits inside a single free interval and ends by `deadline`. */
export function latestFit(free: Interval[], deadline: number, duration: number): number | null {
  for (let i = free.length - 1; i >= 0; i--) {
    const f = free[i]!;
    const end = Math.min(f.end, deadline);
    if (end - duration >= f.start) return end - duration;
  }
  return null;
}
