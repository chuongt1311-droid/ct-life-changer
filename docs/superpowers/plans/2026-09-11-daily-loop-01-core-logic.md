# Daily Loop — Plan 1: Core Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure TypeScript domain core of the Daily Loop: plan-day clock, planner (build day, Day-changed reflow, change diff), burnout guard, nudge scheduler, mentor profile/context/cost, and weekly success metrics. Every part fully unit-tested.

**Architecture:** Everything lives in `src/core/` as pure functions with no I/O, no clock reads, no randomness and no network. Later plans (data, mentor, screens, nudges) call into it. Times are "plan minutes" on a 04:00→04:00 day. The layout engine is the heart: anchors first, then flexible blocks via a backward pass (latest feasible starts) and a forward pass (keep original start, move earlier only when needed), then shrink/drop by priority.

**Tech Stack:** Node 24, TypeScript 6.0.3 (strict, ESM), Vitest 5.0.0, `@anthropic-ai/sdk` 0.125.0 (types only in this plan).

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md). Roadmap: [`2026-09-11-daily-loop-00-roadmap.md`](2026-09-11-daily-loop-00-roadmap.md).

## Global Constraints

- Repo root: `D:\CT's Portfolio\CT's Life Changer` (already a git repo on `main`). **The path contains an apostrophe: always quote paths in shell commands.** Vitest and tsc have been verified to work under such a path.
- Node ≥ 24 (verified on 24.19.0), npm 11.
- Exact dependency versions: `vitest@5.0.0`, `typescript@6.0.3` (**not** 7.x, the native compiler; stay on 6 for ecosystem compatibility with Next.js later), `@types/node@24`, `@anthropic-ai/sdk@0.125.0`.
- `"type": "module"`, TypeScript `strict`, path alias `@/*` → `src/*`.
- `src/core/**` stays pure: no I/O, no `Date.now()` / `new Date()` without an argument, no `Math.random()`, no network. The current time comes in as a plan minute. Ids for new blocks come from the caller. `planClock(instant, tz)` is the only function that touches a `Date`, and it takes it as an argument.
- Time unit: plan minutes = minutes since local midnight of the plan date; a plan day runs 04:00 → 04:00, so values lie in [240, 1680) (spec §5.1).
- User-facing copy (nudges, reasons): short, no shame language, no streaks (spec §5.9, §8.1).
- Tests are colocated as `*.test.ts` next to the module they test.
- Commit after every task with a conventional message (`feat(core): …`). Agentic executors append their harness's attribution trailer.
- Run commands from the repo root. `npm test -- <file>` runs one test file; `npm test` runs everything; `npm run typecheck` runs `tsc --noEmit`.

## Spec refinements made during planning

The code below was built and run once (82/82 tests passing) before this plan was written. That surfaced six refinements, which are now also written into the spec:

1. A block has `kind` ∈ `task | training | rest | buffer | routine` **plus** a separate `anchor: boolean`, so a training block or a deep-work block can be an anchor.
2. Flexible blocks keep their original start (or later, if pushed) and move earlier **only as far as needed** for the rest of the day to fit. Without this, a Depleted day with an earlier bedtime would drop evening blocks instead of moving them up.
3. A block with `start ≤ now < end` is "running". It stays in place, except for the `late`, `urgent` and `lowEnergy` events, which re-place it.
4. Each shrink step takes one block straight to `minMinutes`, lowest priority first. Shrunk blocks are not re-grown after a later drop (v1 simplicity).
5. After the welcome-back nudge, all nudges pause until the next check-in.
6. The nudge cap keeps one slot in reserve for the evening nudge.

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, .gitignore
src/core/
  time.ts                 plan-day clock: HH:MM ↔ plan minutes, planClock(instant, tz), date helpers
  types.ts                shared domain types + DEFAULT_SETTINGS / DEFAULT_THRESHOLDS
  testing/fixtures.ts     makeBlock / makeDay test builders
  planner/
    intervals.ts          interval math (subtract, earliestFit, latestFit…)
    blocks.ts             template → block, default min durations, recovery swap
    layout.ts             placement engine (anchors, flexible blocks, shrink/drop, conflicts)
    diff.ts               what changed for each block (for the Day-changed screen)
    reflow.ts             Day-changed events: late / lostTime / urgent / lowEnergy
    buildDay.ts           a day's plan from its weekday template + guard adjustments
  guard/
    rules.ts              the seven flag rules (spec §7)
    assess.ts             state precedence + adjustments per state
  nudges/
    dueNudges.ts          which nudges are due now (cap, quiet hours, dedup, look-back)
  mentor/
    profile.ts            profile sections, render, apply changes, revert
    context.ts            privacy stripping + cache-ordered Claude context
    cost.ts               token cost + monthly cap status
  metrics/
    weekly.ts             success criteria S1–S4
```

---

### Task 1: Project scaffold + plan-day clock

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/core/time.ts`
- Test: `src/core/time.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `DAY_START_MIN = 240`, `DAY_END_MIN = 1680`, `toPlanMinute(hhmm: string): number`, `formatPlanMinute(minute: number): string`, `planClock(instant: Date, timeZone: string): PlanClock` where `PlanClock = { planDate: string; minute: number }`, `addDays(date: string, days: number): string`, `weekdayOf(date: string): number` (0 = Sunday)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ct-life-changer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `npm install --save-dev vitest@5.0.0 typescript@6.0.3 @types/node@24`
Expected: `added … packages` and `found 0 vulnerabilities`. `package.json` gains a `devDependencies` block.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```gitignore
node_modules/
coverage/
.env*
!.env.example
*.log
```

- [ ] **Step 6: Write the failing test `src/core/time.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { addDays, formatPlanMinute, planClock, toPlanMinute, weekdayOf } from './time';

describe('toPlanMinute', () => {
  it('converts daytime HH:MM to minutes since midnight', () => {
    expect(toPlanMinute('07:00')).toBe(420);
    expect(toPlanMinute('23:30')).toBe(1410);
  });

  it('puts times before 04:00 on the next calendar day', () => {
    expect(toPlanMinute('00:30')).toBe(1470);
    expect(toPlanMinute('03:59')).toBe(1679);
    expect(toPlanMinute('04:00')).toBe(240);
  });

  it('rejects malformed input', () => {
    expect(() => toPlanMinute('7:00')).toThrow('Invalid time');
    expect(() => toPlanMinute('24:00')).toThrow('Invalid time');
  });
});

describe('formatPlanMinute', () => {
  it('round-trips with toPlanMinute', () => {
    for (const t of ['04:00', '07:05', '13:45', '23:59', '00:00', '03:30']) {
      expect(formatPlanMinute(toPlanMinute(t))).toBe(t);
    }
  });
});

describe('planClock', () => {
  it('keeps daytime on the same date', () => {
    expect(planClock(new Date('2026-09-11T14:20:00Z'), 'UTC')).toEqual({
      planDate: '2026-09-11',
      minute: 860,
    });
  });

  it('assigns 00:00–03:59 to the previous plan day', () => {
    expect(planClock(new Date('2026-09-11T02:30:00Z'), 'UTC')).toEqual({
      planDate: '2026-09-10',
      minute: 1590,
    });
  });

  it('respects the time zone', () => {
    // 01:30 UTC = 21:30 the previous evening in New York (UTC-4 in September)
    expect(planClock(new Date('2026-09-11T01:30:00Z'), 'America/New_York')).toEqual({
      planDate: '2026-09-10',
      minute: 1290,
    });
  });
});

describe('date helpers', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('returns weekday with Sunday = 0', () => {
    expect(weekdayOf('2026-09-13')).toBe(0); // Sunday
    expect(weekdayOf('2026-09-14')).toBe(1); // Monday
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- src/core/time.test.ts`
Expected: FAIL with `Error: Cannot find module './time' imported from …/src/core/time.test.ts`

- [ ] **Step 8: Implement `src/core/time.ts`**

```ts
/**
 * Plan-day clock. A plan day runs 04:00 → 04:00 local time, so a late night
 * belongs to the day it started. Times inside a plan day are "plan minutes":
 * minutes since local midnight of the plan date, in [240, 1680).
 * 01:30 after midnight is therefore 1530, not 90.
 */
export const DAY_START_MIN = 240;
export const DAY_END_MIN = 1680;

/** "HH:MM" → plan minute. Times before 04:00 belong to the next calendar day. */
export function toPlanMinute(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) throw new Error(`Invalid time "${hhmm}", expected HH:MM`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < DAY_START_MIN ? minutes + 1440 : minutes;
}

/** Plan minute → "HH:MM" wall-clock time. */
export function formatPlanMinute(minute: number): string {
  const wall = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(wall / 60);
  const m = wall % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface PlanClock {
  planDate: string; // YYYY-MM-DD
  minute: number; // plan minute
}

/** Where an instant falls on CT's plan-day clock in an IANA time zone. */
export function planClock(instant: Date, timeZone: string): PlanClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing ${type} in formatted date`);
    return part.value;
  };
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (minutes >= DAY_START_MIN) return { planDate: date, minute: minutes };
  return { planDate: addDays(date, -1), minute: minutes + 1440 };
}

/** Add days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weekday of a YYYY-MM-DD date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
```

- [ ] **Step 9: Run tests and typecheck**

Run: `npm test -- src/core/time.test.ts` → Expected: PASS, `Tests  9 passed (9)`
Run: `npm run typecheck` → Expected: exits 0 with no output

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/core/time.ts src/core/time.test.ts
git commit -m "feat(core): project scaffold and plan-day clock"
```

---

### Task 2: Domain types, interval math, test fixtures

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/testing/fixtures.ts`
- Create: `src/core/planner/intervals.ts`
- Test: `src/core/planner/intervals.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces (types.ts): `Priority`, `BlockKind`, `BlockStatus`, `BlockSource`, `ChecklistItem`, `TimeWindow`, `Block`, `TemplateBlock`, `DayTemplate`, `DayPlan`, `Thresholds`, `DEFAULT_THRESHOLDS`, `CrisisContact`, `Settings`, `DEFAULT_SETTINGS`, `GuardState`, `FlagCode`, `Flag`, `Adjustment` (discriminated union on `type`), `DaySummary`, `Assessment`. Exact shapes are in the code below; every later task uses these names.
- Produces (intervals.ts): `Interval = { start; end }` (half-open), `overlaps(a, b): boolean`, `normalize(intervals): Interval[]`, `subtract(base, remove): Interval[]`, `contains(free, target): boolean`, `earliestFit(free, earliest, duration): number | null`, `latestFit(free, deadline, duration): number | null`
- Produces (fixtures.ts): `makeBlock(overrides & {id, start, end}): Block` (defaults: flexible task, priority 3, planned, minMinutes = half the duration or the full duration for anchors), `makeDay(overrides & {date}): DaySummary` (everything "not logged")

- [ ] **Step 1: Create `src/core/types.ts`** (types only, no behavior to test)

```ts
/** Shared domain types for the Daily Loop core. All times are plan minutes (see time.ts). */

export type Priority = 1 | 2 | 3 | 4 | 5;
export type BlockKind = 'task' | 'training' | 'rest' | 'buffer' | 'routine';
export type BlockStatus = 'planned' | 'active' | 'done' | 'partial' | 'skipped' | 'missed' | 'dropped';
export type BlockSource = 'template' | 'manual' | 'urgent' | 'guard';

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface TimeWindow {
  earliestStart: number;
  latestEnd: number;
}

export interface Block {
  id: string;
  title: string;
  kind: BlockKind;
  /** Anchors are never dropped by the planner. */
  anchor: boolean;
  priority: Priority;
  start: number;
  end: number;
  /** How far the planner may shrink this block. */
  minMinutes: number;
  /** Movable anchors may move inside this window; null = fixed time. */
  window: TimeWindow | null;
  /** e.g. 'deepWork', 'hardTraining', 'recovery', 'windDown', 'morningRoutine', 'easyWin', 'mandatoryRest', 'urgent', 'recharge' */
  tags: string[];
  checklist: ChecklistItem[];
  recoveryVariant: { title: string; checklist: string[] } | null;
  status: BlockStatus;
  source: BlockSource;
}

export interface TemplateBlock {
  key: string;
  title: string;
  kind: BlockKind;
  anchor: boolean;
  priority: Priority;
  start: string; // HH:MM
  durationMin: number;
  minMinutes?: number;
  window?: { earliestStart: string; latestEnd: string };
  tags?: string[];
  checklist?: string[];
  recoveryVariant?: { title: string; checklist: string[] };
}

export interface DayTemplate {
  weekday: number; // 0 = Sunday … 6 = Saturday
  restDay: boolean;
  blocks: TemplateBlock[];
}

export interface DayPlan {
  date: string;
  wake: number;
  bedtime: number;
  blocks: Block[];
}

export interface Thresholds {
  sleepLowHours: number;
  sleepLowNights: number;
  sleepLowWindow: number;
  energyLowMax: number;
  energyLowDays: number;
  stressHighMin: number;
  stressHighDays: number;
  grindDays: number;
  grindWindow: number;
  grindRestDayTrainings: number;
  indulgeHighMin: number;
  indulgeHighDays: number;
  anchorSkipRatio: number;
  anchorSkipDays: number;
  anchorSkipMinEnergy: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  sleepLowHours: 6,
  sleepLowNights: 3,
  sleepLowWindow: 4,
  energyLowMax: 4,
  energyLowDays: 3,
  stressHighMin: 8,
  stressHighDays: 2,
  grindDays: 5,
  grindWindow: 7,
  grindRestDayTrainings: 2,
  indulgeHighMin: 120,
  indulgeHighDays: 2,
  anchorSkipRatio: 0.5,
  anchorSkipDays: 2,
  anchorSkipMinEnergy: 6,
};

export interface CrisisContact {
  label: string;
  phone?: string;
  url?: string;
}

export interface Settings {
  timezone: string;
  wakeTime: string; // HH:MM
  bedtime: string; // HH:MM
  model: string;
  monthlyCapUsd: number;
  nudgeDailyCap: number;
  deepWorkDailyCapMin: number;
  thresholds: Thresholds;
  crisisContacts: CrisisContact[];
}

export const DEFAULT_SETTINGS: Settings = {
  timezone: 'UTC',
  wakeTime: '07:00',
  bedtime: '23:00',
  model: 'claude-sonnet-5',
  monthlyCapUsd: 12,
  nudgeDailyCap: 8,
  deepWorkDailyCapMin: 360,
  thresholds: DEFAULT_THRESHOLDS,
  crisisContacts: [],
};

export type GuardState = 'ready' | 'drifting' | 'depleted' | 'grinding';
export type FlagCode =
  | 'SLEEP_LOW'
  | 'ENERGY_LOW'
  | 'STRESS_HIGH'
  | 'GRIND_HOURS'
  | 'GRIND_REST_DAYS'
  | 'INDULGE_HIGH'
  | 'ANCHOR_SKIP';

export interface Flag {
  code: FlagCode;
  state: Exclude<GuardState, 'ready'>;
  reason: string;
}

export type Adjustment =
  | { type: 'bedtimeEarlier'; minutes: number; reason: string }
  | { type: 'trainingToRecovery'; reason: string }
  | { type: 'removeRestDayTraining'; reason: string }
  | { type: 'dropLowPriority'; maxPriority: Priority; reason: string }
  | { type: 'capDeepWork'; minutes: number; reason: string }
  | { type: 'capRest'; minutes: number; reason: string }
  | { type: 'addMorningAnchor'; reason: string }
  | { type: 'addEasyWin'; reason: string }
  | { type: 'addMandatoryRest'; at: string; reason: string };

/** One day of data as the guard sees it. null = not logged (unknown, never "bad"). */
export interface DaySummary {
  date: string;
  sleepHours: number | null;
  morningEnergy: number | null;
  /** Highest stress logged that day (morning or evening peak). */
  stress: number | null;
  deepWorkMin: number | null;
  restSessionsTaken: number;
  trainedOnRestDay: boolean;
  unplannedIndulgenceMin: number | null;
  anchorsTotal: number;
  /** Anchors whose status ended as skipped or missed. */
  anchorsSkipped: number;
}

export interface Assessment {
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
}
```

- [ ] **Step 2: Create `src/core/testing/fixtures.ts`**

```ts
import type { Block, DaySummary } from '../types';

/** Build a Block for tests. Defaults: flexible task, priority 3, planned, 60-min minimum-shrink 30. */
export function makeBlock(overrides: Partial<Block> & Pick<Block, 'id' | 'start' | 'end'>): Block {
  const duration = overrides.end - overrides.start;
  return {
    title: overrides.id,
    kind: 'task',
    anchor: false,
    priority: 3,
    minMinutes: overrides.anchor ? duration : Math.ceil(duration / 2),
    window: null,
    tags: [],
    checklist: [],
    recoveryVariant: null,
    status: 'planned',
    source: 'template',
    ...overrides,
  };
}

/** Build a DaySummary for tests with everything "not logged" by default. */
export function makeDay(overrides: Partial<DaySummary> & Pick<DaySummary, 'date'>): DaySummary {
  return {
    sleepHours: null,
    morningEnergy: null,
    stress: null,
    deepWorkMin: null,
    restSessionsTaken: 0,
    trainedOnRestDay: false,
    unplannedIndulgenceMin: null,
    anchorsTotal: 0,
    anchorsSkipped: 0,
    ...overrides,
  };
}
```

- [ ] **Step 3: Write the failing test `src/core/planner/intervals.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { contains, earliestFit, latestFit, normalize, overlaps, subtract } from './intervals';

describe('overlaps', () => {
  it('treats intervals as half-open', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
  });
});

describe('normalize', () => {
  it('sorts, merges touching and overlapping, drops empty', () => {
    expect(
      normalize([
        { start: 30, end: 40 },
        { start: 0, end: 10 },
        { start: 10, end: 15 },
        { start: 35, end: 50 },
        { start: 60, end: 60 },
      ]),
    ).toEqual([
      { start: 0, end: 15 },
      { start: 30, end: 50 },
    ]);
  });
});

describe('subtract', () => {
  it('cuts holes out of the base', () => {
    expect(subtract([{ start: 0, end: 100 }], [{ start: 20, end: 30 }, { start: 50, end: 60 }])).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 50 },
      { start: 60, end: 100 },
    ]);
  });

  it('removes base intervals that are fully covered', () => {
    expect(subtract([{ start: 10, end: 20 }], [{ start: 0, end: 30 }])).toEqual([]);
  });
});

describe('contains / earliestFit', () => {
  const free = [
    { start: 0, end: 20 },
    { start: 30, end: 100 },
  ];

  it('contains checks a single interval holds the target', () => {
    expect(contains(free, { start: 5, end: 20 })).toBe(true);
    expect(contains(free, { start: 15, end: 35 })).toBe(false);
  });

  it('earliestFit skips intervals that are too small', () => {
    expect(earliestFit(free, 0, 25)).toBe(30);
    expect(earliestFit(free, 10, 5)).toBe(10);
    expect(earliestFit(free, 0, 80)).toBeNull();
  });

  it('latestFit finds the latest start that ends by the deadline', () => {
    expect(latestFit(free, 100, 10)).toBe(90);
    expect(latestFit(free, 40, 10)).toBe(30);
    expect(latestFit(free, 35, 10)).toBe(10); // 30–35 too small, falls back to 0–20
    expect(latestFit(free, 100, 90)).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test -- src/core/planner/intervals.test.ts`
Expected: FAIL with `Error: Cannot find module './intervals'`

- [ ] **Step 5: Implement `src/core/planner/intervals.ts`**

```ts
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
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  16 passed (16)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/testing/fixtures.ts src/core/planner/intervals.ts src/core/planner/intervals.test.ts
git commit -m "feat(core): domain types, interval math, test fixtures"
```

---

### Task 3: Template blocks and recovery swap

**Files:**
- Create: `src/core/planner/blocks.ts`
- Test: `src/core/planner/blocks.test.ts`

**Interfaces:**
- Consumes: `toPlanMinute` (Task 1); `Block`, `BlockKind`, `TemplateBlock` (Task 2); `makeBlock` (Task 2)
- Produces: `defaultMinMinutes(kind: BlockKind, anchor: boolean, durationMin: number): number`, `blockFromTemplate(tb: TemplateBlock, date: string): Block` (id = `${date}:${tb.key}`), `toRecovery(b: Block): Block` (swaps a `hardTraining` training block for its `recoveryVariant`; returns the same object otherwise)

- [ ] **Step 1: Write the failing test `src/core/planner/blocks.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { blockFromTemplate, defaultMinMinutes, toRecovery } from './blocks';

describe('defaultMinMinutes', () => {
  it('follows spec §5.2', () => {
    expect(defaultMinMinutes('training', true, 55)).toBe(55);
    expect(defaultMinMinutes('rest', false, 60)).toBe(15);
    expect(defaultMinMinutes('rest', false, 10)).toBe(10);
    expect(defaultMinMinutes('task', false, 45)).toBe(23);
  });
});

describe('blockFromTemplate', () => {
  it('converts times, ids, checklist and defaults', () => {
    const b = blockFromTemplate(
      {
        key: 'push',
        title: 'Push + neck',
        kind: 'training',
        anchor: true,
        priority: 5,
        start: '17:00',
        durationMin: 55,
        tags: ['hardTraining'],
        checklist: ['Clap push-ups 3x5'],
        window: { earliestStart: '16:00', latestEnd: '20:00' },
      },
      '2026-09-14',
    );
    expect(b).toMatchObject({
      id: '2026-09-14:push',
      start: 1020,
      end: 1075,
      minMinutes: 55,
      window: { earliestStart: 960, latestEnd: 1200 },
      checklist: [{ label: 'Clap push-ups 3x5', done: false }],
      status: 'planned',
      source: 'template',
    });
  });
});

describe('toRecovery', () => {
  const hard = makeBlock({
    id: 'push',
    start: 1020,
    end: 1075,
    kind: 'training',
    tags: ['hardTraining'],
    recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold 2x60s'] },
  });

  it('swaps title, checklist and tags', () => {
    expect(toRecovery(hard)).toMatchObject({
      title: 'Mobility + handstand practice',
      checklist: [{ label: 'Deep squat hold 2x60s', done: false }],
      tags: ['recovery'],
    });
  });

  it('leaves non-hard-training blocks alone', () => {
    const task = makeBlock({ id: 't', start: 600, end: 660 });
    expect(toRecovery(task)).toBe(task);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/planner/blocks.test.ts`
Expected: FAIL with `Error: Cannot find module './blocks'`

- [ ] **Step 3: Implement `src/core/planner/blocks.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  20 passed (20)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/blocks.ts src/core/planner/blocks.test.ts
git commit -m "feat(core): template blocks and recovery swap"
```

---

### Task 4: Layout engine

The placement engine behind both "build tomorrow" and "Day changed" (spec §5.5 + refinements 2–4). Read the test file first: each test names one rule.

**Files:**
- Create: `src/core/planner/layout.ts`
- Test: `src/core/planner/layout.test.ts`

**Interfaces:**
- Consumes: `Block` (Task 2); `contains`, `earliestFit`, `latestFit`, `normalize`, `overlaps`, `subtract`, `Interval` (Task 2); `makeBlock` (Task 2)
- Produces:
  - `interface LayoutInput { blocks: Block[]; now: number; wake: number; until: number; earliest?: number; unavailable?: Interval[]; keepRunning?: boolean; placeFirst?: string[] }`
  - `interface LayoutResult { blocks: Block[]; conflicts: [string, string][]; missedReasons: Record<string, string> }`
  - `layout(input: LayoutInput): LayoutResult`. Output blocks are sorted by start; dropped blocks keep their original times with `status: 'dropped'`; missed anchors get `status: 'missed'`.

- [ ] **Step 1: Write the failing test `src/core/planner/layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { Block } from '../types';
import { layout } from './layout';

// Day: wake 07:00 (420), wind-down starts 22:00 (1320)
const WAKE = 420;
const UNTIL = 1320;

const times = (blocks: Block[]) =>
  Object.fromEntries(blocks.map((b) => [b.id, [b.start, b.end, b.status] as const]));

describe('layout', () => {
  it('leaves a plan that already fits untouched', () => {
    const blocks = [
      makeBlock({ id: 'a', start: 540, end: 600 }),
      makeBlock({ id: 'b', start: 900, end: 960 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(times(result.blocks)).toEqual({ a: [540, 600, 'planned'], b: [900, 960, 'planned'] });
    expect(result.conflicts).toEqual([]);
  });

  it('never pulls flexible blocks earlier than their original start', () => {
    const blocks = [makeBlock({ id: 'rest', kind: 'rest', start: 900, end: 960 })];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(times(result.blocks)).toEqual({ rest: [900, 960, 'planned'] });
  });

  it('pulls a block earlier only when the day would not fit otherwise', () => {
    // wind-down moved to 21:00 (1260); b was planned at 21:00 and must move up to 20:30
    const blocks = [
      makeBlock({ id: 'a', start: 1200, end: 1230, minMinutes: 30 }),
      makeBlock({ id: 'b', start: 1260, end: 1290, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 1100, wake: WAKE, until: 1260 });
    expect(times(result.blocks)).toEqual({ a: [1200, 1230, 'planned'], b: [1230, 1260, 'planned'] });
  });

  it('running late pushes flexible blocks back and keeps their order', () => {
    const blocks = [
      makeBlock({ id: 'a', start: 540, end: 600 }),
      makeBlock({ id: 'b', start: 600, end: 660 }),
    ];
    const result = layout({ blocks, now: 540, earliest: 570, wake: WAKE, until: UNTIL, keepRunning: false });
    expect(times(result.blocks)).toEqual({ a: [570, 630, 'planned'], b: [630, 690, 'planned'] });
  });

  it('keeps fixed anchors in place and flows flexible blocks around them', () => {
    const blocks = [
      makeBlock({ id: 'task', start: 540, end: 660 }),
      makeBlock({ id: 'gym', anchor: true, kind: 'training', start: 600, end: 660 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    // task can't fit 540–600 (60 min free) at 120 min, so it moves after the anchor
    expect(times(result.blocks)).toEqual({ task: [660, 780, 'planned'], gym: [600, 660, 'planned'] });
  });

  it('marks a fixed anchor inside lost time as missed', () => {
    const blocks = [makeBlock({ id: 'gym', anchor: true, start: 900, end: 960 })];
    const result = layout({
      blocks,
      now: 600,
      wake: WAKE,
      until: UNTIL,
      unavailable: [{ start: 840, end: 1020 }],
    });
    expect(result.blocks[0]!.status).toBe('missed');
    expect(result.missedReasons).toEqual({ gym: 'Clashes with the time you lost' });
  });

  it('moves a windowed anchor inside its window, or marks it missed when there is no room', () => {
    const windowed = makeBlock({
      id: 'deep',
      anchor: true,
      start: 540,
      end: 660,
      window: { earliestStart: 480, latestEnd: 780 },
    });
    const moved = layout({ blocks: [windowed], now: 480, wake: WAKE, until: UNTIL, unavailable: [{ start: 500, end: 600 }] });
    expect(times(moved.blocks)).toEqual({ deep: [600, 720, 'planned'] });

    const noRoom = layout({ blocks: [windowed], now: 480, wake: WAKE, until: UNTIL, unavailable: [{ start: 480, end: 700 }] });
    expect(noRoom.blocks[0]!.status).toBe('missed');
    expect(noRoom.missedReasons.deep).toBe('No free time left inside its window');
  });

  it('shrinks lowest priority first, then drops lowest priority first', () => {
    // 60 free minutes (1200–1260) for three blocks
    const blocks = [
      makeBlock({ id: 'high', priority: 5, start: 1200, end: 1240, minMinutes: 20 }),
      makeBlock({ id: 'mid', priority: 3, start: 1240, end: 1280, minMinutes: 20 }),
      makeBlock({ id: 'low', priority: 1, start: 1280, end: 1320, minMinutes: 20 }),
    ];
    // now = 1199 so nothing is "running" yet (a block starting exactly at now counts as running)
    const result = layout({ blocks, now: 1199, wake: WAKE, until: 1260 });
    // shrink low→20, mid→20, high→20 = 60 → fits
    expect(times(result.blocks)).toEqual({
      high: [1200, 1220, 'planned'],
      mid: [1220, 1240, 'planned'],
      low: [1240, 1260, 'planned'],
    });

    const tighter = layout({ blocks, now: 1199, wake: WAKE, until: 1240 });
    expect(times(tighter.blocks)).toEqual({
      high: [1200, 1220, 'planned'],
      mid: [1220, 1240, 'planned'],
      low: [1280, 1320, 'dropped'],
    });
  });

  it('breaks priority ties by dropping the later block first', () => {
    const blocks = [
      makeBlock({ id: 'early', start: 1200, end: 1230, minMinutes: 30 }),
      makeBlock({ id: 'late', start: 1230, end: 1260, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 1199, wake: WAKE, until: 1230 });
    expect(result.blocks.find((b) => b.id === 'late')!.status).toBe('dropped');
    expect(result.blocks.find((b) => b.id === 'early')!.status).toBe('planned');
  });

  it('keeps running blocks in place by default and moves them when keepRunning is false', () => {
    const running = makeBlock({ id: 'run', start: 600, end: 720 });
    const kept = layout({ blocks: [running], now: 630, wake: WAKE, until: UNTIL, unavailable: [{ start: 900, end: 960 }] });
    expect(times(kept.blocks)).toEqual({ run: [600, 720, 'planned'] });

    const moved = layout({ blocks: [running], now: 630, earliest: 650, wake: WAKE, until: UNTIL, keepRunning: false });
    expect(times(moved.blocks)).toEqual({ run: [650, 770, 'planned'] });
  });

  it('places placeFirst blocks at the earliest free minute, before everything else', () => {
    const blocks = [
      makeBlock({ id: 'task', start: 600, end: 660 }),
      makeBlock({ id: 'urgent', start: 600, end: 630, minMinutes: 30 }),
    ];
    const result = layout({ blocks, now: 600, wake: WAKE, until: UNTIL, keepRunning: false, placeFirst: ['urgent'] });
    expect(times(result.blocks)).toEqual({ urgent: [600, 630, 'planned'], task: [630, 690, 'planned'] });
  });

  it('never touches finished, skipped or past blocks', () => {
    const blocks = [
      makeBlock({ id: 'done', start: 600, end: 660, status: 'done' }),
      makeBlock({ id: 'skipped', start: 900, end: 960, status: 'skipped' }),
      makeBlock({ id: 'past', start: 480, end: 540 }),
    ];
    const result = layout({ blocks, now: 700, wake: WAKE, until: UNTIL, unavailable: [{ start: 880, end: 1000 }] });
    expect(times(result.blocks)).toEqual({
      past: [480, 540, 'planned'],
      done: [600, 660, 'done'],
      skipped: [900, 960, 'skipped'],
    });
  });

  it('reports overlapping fixed anchors as conflicts instead of dropping one', () => {
    const blocks = [
      makeBlock({ id: 'gym', anchor: true, start: 1020, end: 1080 }),
      makeBlock({ id: 'dinner', anchor: true, kind: 'routine', start: 1050, end: 1110 }),
    ];
    const result = layout({ blocks, now: 480, wake: WAKE, until: UNTIL });
    expect(result.conflicts).toEqual([['gym', 'dinner']]);
    expect(result.blocks.every((b) => b.status === 'planned')).toBe(true);
  });

  it('is deterministic', () => {
    const blocks = [
      makeBlock({ id: 'a', priority: 2, start: 600, end: 700 }),
      makeBlock({ id: 'b', priority: 2, start: 650, end: 800 }),
      makeBlock({ id: 'c', anchor: true, start: 720, end: 780 }),
    ];
    const input = { blocks, now: 600, wake: WAKE, until: 800, unavailable: [{ start: 610, end: 640 }] };
    expect(layout(input)).toEqual(layout(input));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/planner/layout.test.ts`
Expected: FAIL with `Error: Cannot find module './layout'`

- [ ] **Step 3: Implement `src/core/planner/layout.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  34 passed (34)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/layout.ts src/core/planner/layout.test.ts
git commit -m "feat(core): layout engine with anchors, two-pass placement, shrink/drop"
```

---

### Task 5: Change diff and Day-changed reflow

**Files:**
- Create: `src/core/planner/diff.ts`, `src/core/planner/reflow.ts`
- Test: `src/core/planner/diff.test.ts`, `src/core/planner/reflow.test.ts`

**Interfaces:**
- Consumes: `layout`, `LayoutInput` (Task 4); `toRecovery` (Task 3); `Block`, `DayPlan`, `Priority` (Task 2)
- Produces:
  - `type ChangeKind = 'added' | 'missed' | 'dropped' | 'swapped' | 'shrunk' | 'moved' | 'kept'`
  - `interface DiffEntry { blockId; title; change: ChangeKind; from: {start,end} | null; to: {start,end} | null; reason: string }`
  - `interface DiffContext { addedIds?: string[]; missedReasons?: Record<string,string>; shrinkReason?: string }`
  - `diffBlocks(before: Block[], after: Block[], ctx?: DiffContext): DiffEntry[]` (covers only blocks that were open before, plus added ones)
  - `type ReflowEvent = { type: 'late'; minutes } | { type: 'lostTime'; start; end } | { type: 'urgent'; id; title; durationMin; priority } | { type: 'lowEnergy'; restId }`
  - `interface ReflowResult { plan: DayPlan; diff: DiffEntry[]; conflicts: [string, string][] }`
  - `reflow(plan: DayPlan, now: number, event: ReflowEvent): ReflowResult` (wind-down = `plan.bedtime - 60`)

- [ ] **Step 1: Write the failing test `src/core/planner/diff.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { diffBlocks } from './diff';

describe('diffBlocks', () => {
  const before = [
    makeBlock({ id: 'kept', start: 600, end: 660 }),
    makeBlock({ id: 'moved', start: 700, end: 760 }),
    makeBlock({ id: 'shrunk', start: 800, end: 860 }),
    makeBlock({ id: 'dropped', start: 900, end: 960 }),
    makeBlock({ id: 'missed', anchor: true, start: 1000, end: 1060 }),
    makeBlock({ id: 'done', start: 500, end: 560, status: 'done' }),
  ];
  const after = [
    before[0]!,
    { ...before[1]!, start: 720, end: 780 },
    { ...before[2]!, end: 830 },
    { ...before[3]!, status: 'dropped' as const },
    { ...before[4]!, status: 'missed' as const },
    before[5]!,
    makeBlock({ id: 'new', start: 1100, end: 1130 }),
  ];

  it('classifies each open block and skips finished ones', () => {
    const diff = diffBlocks(before, after, {
      addedIds: ['new'],
      missedReasons: { missed: 'Clashes with the time you lost' },
    });
    expect(diff.map((d) => [d.blockId, d.change, d.reason])).toEqual([
      ['kept', 'kept', ''],
      ['moved', 'moved', 'Moved to make room'],
      ['shrunk', 'shrunk', 'Shortened to fit the day'],
      ['dropped', 'dropped', "Lowest priority — it didn't fit"],
      ['missed', 'missed', 'Clashes with the time you lost'],
      ['new', 'added', 'New block'],
    ]);
    expect(diff.find((d) => d.blockId === 'moved')).toMatchObject({
      from: { start: 700, end: 760 },
      to: { start: 720, end: 780 },
    });
  });

  it('uses the custom shrink reason and detects recovery swaps', () => {
    const training = makeBlock({ id: 'push', kind: 'training', start: 1000, end: 1055, title: 'Push' });
    const diff = diffBlocks([training], [{ ...training, title: 'Mobility' }], { shrinkReason: 'Energy is low' });
    expect(diff[0]).toMatchObject({ change: 'swapped', reason: 'Swapped from "Push" for the recovery version' });

    const task = makeBlock({ id: 't', start: 600, end: 660 });
    const shrunk = diffBlocks([task], [{ ...task, end: 630 }], { shrinkReason: 'Shortened — energy is low' });
    expect(shrunk[0]!.reason).toBe('Shortened — energy is low');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/planner/diff.test.ts`
Expected: FAIL with `Error: Cannot find module './diff'`

- [ ] **Step 3: Implement `src/core/planner/diff.ts`**

```ts
import type { Block } from '../types';

export type ChangeKind = 'added' | 'missed' | 'dropped' | 'swapped' | 'shrunk' | 'moved' | 'kept';

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
      entries.push({ blockId: b.id, title: b.title, change: 'added', from: null, to, reason: 'New block' });
      continue;
    }
    if (!isOpen(old)) continue;

    const from = { start: old.start, end: old.end };
    const base = { blockId: b.id, title: b.title, from };
    if (b.status === 'missed') {
      entries.push({ ...base, change: 'missed', to: null, reason: ctx.missedReasons?.[b.id] ?? 'Its time has passed' });
    } else if (b.status === 'dropped') {
      entries.push({ ...base, change: 'dropped', to: null, reason: "Lowest priority — it didn't fit" });
    } else if (b.title !== old.title) {
      entries.push({ ...base, change: 'swapped', to, reason: `Swapped from "${old.title}" for the recovery version` });
    } else if (b.end - b.start < old.end - old.start) {
      entries.push({ ...base, change: 'shrunk', to, reason: ctx.shrinkReason ?? 'Shortened to fit the day' });
    } else if (b.start !== old.start) {
      entries.push({ ...base, change: 'moved', to, reason: 'Moved to make room' });
    } else {
      entries.push({ ...base, change: 'kept', to, reason: '' });
    }
  }
  return entries;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- src/core/planner/diff.test.ts` → Expected: PASS, `Tests  2 passed (2)`

- [ ] **Step 5: Write the failing test `src/core/planner/reflow.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { DayPlan } from '../types';
import { reflow } from './reflow';

// wake 07:00 (420), bedtime 23:00 (1380) → wind-down 22:00 (1320)
function plan(): DayPlan {
  return {
    date: '2026-09-14',
    wake: 420,
    bedtime: 1380,
    blocks: [
      makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660, tags: ['deepWork'] }),
      makeBlock({ id: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, start: 720, end: 765 }),
      makeBlock({ id: 'study', title: 'xT study', start: 780, end: 870, priority: 2 }),
      makeBlock({
        id: 'push',
        title: 'Push + neck',
        kind: 'training',
        anchor: true,
        priority: 5,
        start: 1020,
        end: 1075,
        tags: ['hardTraining'],
        recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold'] },
      }),
      makeBlock({ id: 'game', title: 'Gaming', kind: 'rest', start: 1200, end: 1260, minMinutes: 15 }),
      makeBlock({ id: 'wind', title: 'Wind down', kind: 'routine', anchor: true, start: 1320, end: 1380, tags: ['windDown'] }),
    ],
  };
}

const find = (p: DayPlan, id: string) => p.blocks.find((b) => b.id === id)!;

describe('reflow', () => {
  it('late: re-places the current block after the delay and pushes what follows', () => {
    const { plan: next, diff } = reflow(plan(), 540, { type: 'late', minutes: 30 });
    expect([find(next, 'deep').start, find(next, 'deep').end]).toEqual([570, 690]);
    expect(find(next, 'lunch').start).toBe(720); // fixed anchor unaffected
    expect(diff.find((d) => d.blockId === 'deep')!.change).toBe('moved');
  });

  it('lostTime: moves flexible blocks past the gap and misses a fixed anchor inside it', () => {
    const { plan: next, diff } = reflow(plan(), 700, { type: 'lostTime', start: 960, end: 1140 });
    expect(find(next, 'push').status).toBe('missed');
    expect(diff.find((d) => d.blockId === 'push')).toMatchObject({
      change: 'missed',
      reason: 'Clashes with the time you lost',
    });
    expect(find(next, 'game').start).toBe(1200); // after the gap, untouched
  });

  it('urgent: inserts the new block now and pushes the current one after it', () => {
    const { plan: next, diff } = reflow(plan(), 780, {
      type: 'urgent',
      id: 'u1',
      title: 'Fix form for school',
      durationMin: 30,
      priority: 4,
    });
    expect([find(next, 'u1').start, find(next, 'u1').end]).toEqual([780, 810]);
    expect(find(next, 'study').start).toBe(810);
    expect(diff.find((d) => d.blockId === 'u1')!.change).toBe('added');
  });

  it('lowEnergy: adds a recharge block, shrinks tasks, swaps hard training for recovery', () => {
    const { plan: next, diff } = reflow(plan(), 530, { type: 'lowEnergy', restId: 'r1' });
    expect([find(next, 'r1').start, find(next, 'r1').end]).toEqual([530, 545]);
    expect(find(next, 'deep').end - find(next, 'deep').start).toBe(60);
    expect(find(next, 'push').title).toBe('Mobility + handstand practice');
    expect(diff.find((d) => d.blockId === 'deep')).toMatchObject({ change: 'shrunk', reason: 'Shortened — energy is low' });
    expect(diff.find((d) => d.blockId === 'push')!.change).toBe('swapped');
  });

  it('drops the lowest-priority block when a big loss leaves no room', () => {
    // lose 12:50–21:00: study (priority 2) and gaming can't fit before wind-down
    const { plan: next } = reflow(plan(), 700, { type: 'lostTime', start: 770, end: 1290 });
    expect(find(next, 'study').status).toBe('dropped');
    expect(find(next, 'game').status).toBe('planned');
    expect(find(next, 'game').end).toBeLessThanOrEqual(1320);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- src/core/planner/reflow.test.ts`
Expected: FAIL with `Error: Cannot find module './reflow'`

- [ ] **Step 7: Implement `src/core/planner/reflow.ts`**

```ts
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
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  41 passed (41)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 9: Commit**

```bash
git add src/core/planner/diff.ts src/core/planner/diff.test.ts src/core/planner/reflow.ts src/core/planner/reflow.test.ts
git commit -m "feat(core): Day-changed reflow events and change diff"
```

---

### Task 6: Build a day from its template

**Files:**
- Create: `src/core/planner/buildDay.ts`
- Test: `src/core/planner/buildDay.test.ts`

**Interfaces:**
- Consumes: `toPlanMinute` (Task 1); `Adjustment`, `Block`, `DayPlan`, `DayTemplate`, `Settings`, `DEFAULT_SETTINGS` (Task 2); `blockFromTemplate`, `toRecovery` (Task 3); `layout` (Task 4)
- Produces: `interface BuildResult { plan: DayPlan; conflicts: [string, string][] }`, `buildDay(template: DayTemplate, date: string, settings: Settings, adjustments?: Adjustment[]): BuildResult`. Guard-created block ids: `${date}:morning-routine`, `${date}:easy-win`, `${date}:mandatory-rest`; every plan gets `${date}:wind-down` (fixed anchor, bedtime − 60 → bedtime). Throws `Error('Bedtime must be more than 60 minutes after wake time')` on impossible settings.

- [ ] **Step 1: Write the failing test `src/core/planner/buildDay.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { type Block, DEFAULT_SETTINGS, type DayTemplate } from '../types';
import { buildDay } from './buildDay';

const monday: DayTemplate = {
  weekday: 1,
  restDay: false,
  blocks: [
    { key: 'deep', title: 'Deep work', kind: 'task', anchor: false, priority: 4, start: '09:00', durationMin: 240, tags: ['deepWork'] },
    { key: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, priority: 3, start: '13:00', durationMin: 45 },
    { key: 'chores', title: 'Chores', kind: 'task', anchor: false, priority: 2, start: '14:00', durationMin: 60 },
    { key: 'study', title: 'xT study', kind: 'task', anchor: false, priority: 3, start: '15:00', durationMin: 180, tags: ['deepWork'] },
    {
      key: 'push',
      title: 'Push + neck',
      kind: 'training',
      anchor: true,
      priority: 5,
      start: '18:00',
      durationMin: 55,
      tags: ['hardTraining'],
      recoveryVariant: { title: 'Mobility + handstand practice', checklist: ['Deep squat hold 2x60s'] },
    },
    { key: 'game', title: 'Gaming', kind: 'rest', anchor: false, priority: 3, start: '20:00', durationMin: 90 },
    { key: 'late', title: 'Reading', kind: 'task', anchor: false, priority: 3, start: '21:30', durationMin: 30 },
  ],
};

const DATE = '2026-09-14';
const find = (blocks: Block[], key: string) => blocks.find((b) => b.id === `${DATE}:${key}`)!;

describe('buildDay', () => {
  it('builds the template as-is and adds wind-down 60 min before bedtime', () => {
    const { plan, conflicts } = buildDay(monday, DATE, DEFAULT_SETTINGS);
    expect(plan).toMatchObject({ date: DATE, wake: 420, bedtime: 1380 });
    expect(find(plan.blocks, 'deep')).toMatchObject({ start: 540, end: 780, status: 'planned' });
    expect(find(plan.blocks, 'wind-down')).toMatchObject({ start: 1320, end: 1380, anchor: true });
    expect(conflicts).toEqual([]);
  });

  it('depleted: recovery training, earlier bedtime, low priority dropped, deep work capped', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'trainingToRecovery', reason: '' },
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
      { type: 'dropLowPriority', maxPriority: 2, reason: '' },
      { type: 'capDeepWork', minutes: 180, reason: '' },
    ]);
    expect(plan.bedtime).toBe(1350);
    expect(find(plan.blocks, 'wind-down')).toMatchObject({ start: 1290, end: 1350 });
    expect(find(plan.blocks, 'push').title).toBe('Mobility + handstand practice');
    expect(find(plan.blocks, 'chores').status).toBe('dropped');
    // 180 min cap: deep (240) is cut to 180, study (180) no longer fits in the cap → dropped
    expect(find(plan.blocks, 'deep')).toMatchObject({ start: 540, end: 720 });
    expect(find(plan.blocks, 'study').status).toBe('dropped');
    // reading was at 21:30, wind-down now starts 21:30 → it moves up to fit
    expect(find(plan.blocks, 'late')).toMatchObject({ start: 1260, end: 1290, status: 'planned' });
  });

  it('drifting: easy win first thing, morning anchor, rest capped at 45', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'capRest', minutes: 45, reason: '' },
      { type: 'addEasyWin', reason: '' },
      { type: 'addMorningAnchor', reason: '' },
    ]);
    expect(find(plan.blocks, 'morning-routine')).toMatchObject({ start: 420, end: 450, anchor: true, source: 'guard' });
    expect(find(plan.blocks, 'easy-win')).toMatchObject({ start: 450, end: 465 });
    expect(find(plan.blocks, 'game')).toMatchObject({ start: 1200, end: 1245 });
  });

  it('grinding: mandatory rest lands in its afternoon window', () => {
    const { plan } = buildDay(monday, DATE, DEFAULT_SETTINGS, [{ type: 'addMandatoryRest', at: '15:00', reason: '' }]);
    const rest = find(plan.blocks, 'mandatory-rest');
    expect(rest).toMatchObject({ start: 900, end: 930, anchor: true });
    // study was 15:00–18:00; it now starts after the rest
    expect(find(plan.blocks, 'study').start).toBeGreaterThanOrEqual(930);
  });

  it('applies adjustments in a fixed order no matter how they arrive', () => {
    const a = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'addEasyWin', reason: '' },
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
    ]);
    const b = buildDay(monday, DATE, DEFAULT_SETTINGS, [
      { type: 'bedtimeEarlier', minutes: 30, reason: '' },
      { type: 'addEasyWin', reason: '' },
    ]);
    expect(a).toEqual(b);
  });

  it('rejects settings where bedtime is not after wake + 60', () => {
    expect(() => buildDay(monday, DATE, { ...DEFAULT_SETTINGS, wakeTime: '22:30', bedtime: '23:00' })).toThrow('Bedtime');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/planner/buildDay.test.ts`
Expected: FAIL with `Error: Cannot find module './buildDay'`

- [ ] **Step 3: Implement `src/core/planner/buildDay.ts`**

```ts
import { toPlanMinute } from '../time';
import type { Adjustment, Block, DayPlan, DayTemplate, Settings } from '../types';
import { blockFromTemplate, toRecovery } from './blocks';
import { layout } from './layout';

export interface BuildResult {
  plan: DayPlan;
  conflicts: [string, string][];
}

/** Adjustments are applied in this order regardless of the order they arrive in. */
const ORDER: Adjustment['type'][] = [
  'bedtimeEarlier',
  'trainingToRecovery',
  'removeRestDayTraining',
  'dropLowPriority',
  'capDeepWork',
  'capRest',
  'addMorningAnchor',
  'addEasyWin',
  'addMandatoryRest',
];

function guardBlock(date: string, key: string, fields: Partial<Block> & Pick<Block, 'title' | 'kind' | 'start' | 'end'>): Block {
  return {
    id: `${date}:${key}`,
    anchor: false,
    priority: 4,
    minMinutes: fields.end - fields.start,
    window: null,
    tags: [],
    checklist: [],
    recoveryVariant: null,
    status: 'planned',
    source: 'guard',
    ...fields,
  };
}

/** Keep total deep work within `cap` minutes: earlier blocks first; anchors shrink only to minMinutes. */
function capDeepWork(blocks: Block[], cap: number): Block[] {
  let remaining = cap;
  const updates = new Map<string, Block>();
  const deep = blocks.filter((b) => b.tags.includes('deepWork') && b.status === 'planned').sort((a, b) => a.start - b.start);
  for (const b of deep) {
    const duration = b.end - b.start;
    if (duration <= remaining) {
      remaining -= duration;
    } else if (b.anchor) {
      const kept = Math.max(b.minMinutes, remaining);
      updates.set(b.id, { ...b, end: b.start + kept });
      remaining = Math.max(0, remaining - kept);
    } else if (remaining >= b.minMinutes) {
      updates.set(b.id, { ...b, end: b.start + remaining, minMinutes: Math.min(b.minMinutes, remaining) });
      remaining = 0;
    } else {
      updates.set(b.id, { ...b, status: 'dropped' });
    }
  }
  return blocks.map((b) => updates.get(b.id) ?? b);
}

/** Spec §5.2: a plan for `date` from its weekday template, with the guard's adjustments applied. */
export function buildDay(template: DayTemplate, date: string, settings: Settings, adjustments: Adjustment[] = []): BuildResult {
  const wake = toPlanMinute(settings.wakeTime);
  let bedtime = toPlanMinute(settings.bedtime);
  let blocks = template.blocks.map((tb) => blockFromTemplate(tb, date));
  const placeFirst: string[] = [];

  const sorted = [...adjustments].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  for (const adj of sorted) {
    switch (adj.type) {
      case 'bedtimeEarlier':
        bedtime -= adj.minutes;
        break;
      case 'trainingToRecovery':
        blocks = blocks.map(toRecovery);
        break;
      case 'removeRestDayTraining':
        if (template.restDay) blocks = blocks.map((b) => (b.kind === 'training' ? { ...b, status: 'dropped' } : b));
        break;
      case 'dropLowPriority':
        blocks = blocks.map((b) => (!b.anchor && b.priority <= adj.maxPriority ? { ...b, status: 'dropped' } : b));
        break;
      case 'capDeepWork':
        blocks = capDeepWork(blocks, adj.minutes);
        break;
      case 'capRest':
        blocks = blocks.map((b) =>
          b.kind === 'rest' && b.end - b.start > adj.minutes
            ? { ...b, end: b.start + adj.minutes, minMinutes: Math.min(b.minMinutes, adj.minutes) }
            : b,
        );
        break;
      case 'addMorningAnchor': {
        const hasMorningAnchor = blocks.some((b) => b.anchor && b.status !== 'dropped' && b.start >= wake && b.start < wake + 120);
        if (!hasMorningAnchor) {
          blocks.push(
            guardBlock(date, 'morning-routine', {
              title: 'Morning routine',
              kind: 'routine',
              anchor: true,
              start: wake,
              end: wake + 30,
              tags: ['morningRoutine'],
            }),
          );
        }
        break;
      }
      case 'addEasyWin': {
        const easyWin = guardBlock(date, 'easy-win', {
          title: 'Easy win (15 min)',
          kind: 'task',
          start: wake,
          end: wake + 15,
          tags: ['easyWin'],
        });
        blocks.push(easyWin);
        placeFirst.push(easyWin.id);
        break;
      }
      case 'addMandatoryRest': {
        const at = toPlanMinute(adj.at);
        blocks.push(
          guardBlock(date, 'mandatory-rest', {
            title: 'Mandatory rest',
            kind: 'rest',
            anchor: true,
            start: at,
            end: at + 30,
            window: { earliestStart: at - 60, latestEnd: at + 120 },
            tags: ['mandatoryRest'],
          }),
        );
        break;
      }
    }
  }

  if (bedtime - 60 <= wake) throw new Error('Bedtime must be more than 60 minutes after wake time');
  blocks.push(
    guardBlock(date, 'wind-down', {
      title: 'Wind down',
      kind: 'routine',
      anchor: true,
      priority: 5,
      start: bedtime - 60,
      end: bedtime,
      tags: ['windDown'],
      source: 'template',
    }),
  );

  const result = layout({ blocks, now: wake, wake, until: bedtime - 60, keepRunning: false, placeFirst });
  return { plan: { date, wake, bedtime, blocks: result.blocks }, conflicts: result.conflicts };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  47 passed (47)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/buildDay.ts src/core/planner/buildDay.test.ts
git commit -m "feat(core): build a day's plan from template and guard adjustments"
```

---

### Task 7: Burnout guard

**Files:**
- Create: `src/core/guard/rules.ts`, `src/core/guard/assess.ts`
- Test: `src/core/guard/rules.test.ts`, `src/core/guard/assess.test.ts`

**Interfaces:**
- Consumes: `DaySummary`, `Flag`, `Settings`, `Adjustment`, `Assessment`, `GuardState`, `DEFAULT_SETTINGS` (Task 2); `makeDay` (Task 2)
- Produces:
  - `type Rule = (days: DaySummary[], settings: Settings) => Flag | null`
  - `recent(days): DaySummary[]` (newest first, max 7)
  - rules `sleepLow`, `energyLow`, `stressHigh`, `grindHours`, `grindRestDays`, `indulgeHigh`, `anchorSkip`, and `RULES: Rule[]` in that order
  - `adjustmentsFor(state: GuardState, settings: Settings): Adjustment[]`
  - `assess(days: DaySummary[], settings: Settings): Assessment` (precedence depleted > grinding > drifting > ready; keeps every flag)

- [ ] **Step 1: Write the failing test `src/core/guard/rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeDay } from '../testing/fixtures';
import { DEFAULT_SETTINGS } from '../types';
import { anchorSkip, energyLow, grindHours, grindRestDays, indulgeHigh, sleepLow, stressHigh } from './rules';

const S = DEFAULT_SETTINGS;
const d = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

describe('sleepLow', () => {
  it('fires on 3 short nights out of the last 4 logged', () => {
    const days = [5.5, 7.5, 5, 5.8].map((h, i) => makeDay({ date: d(10 - i), sleepHours: h }));
    expect(sleepLow(days, S)).toMatchObject({ code: 'SLEEP_LOW', state: 'depleted' });
  });

  it('does not fire on 2 short nights', () => {
    const days = [5.5, 7.5, 8, 5.8].map((h, i) => makeDay({ date: d(10 - i), sleepHours: h }));
    expect(sleepLow(days, S)).toBeNull();
  });

  it('skips unlogged nights instead of counting them', () => {
    const days = [
      makeDay({ date: d(10), sleepHours: 5 }),
      makeDay({ date: d(9) }),
      makeDay({ date: d(8), sleepHours: 5 }),
      makeDay({ date: d(7) }),
      makeDay({ date: d(6), sleepHours: 5 }),
    ];
    expect(sleepLow(days, S)).not.toBeNull();
    expect(sleepLow(days.slice(0, 4), S)).toBeNull(); // only 2 logged nights
  });
});

describe('energyLow / stressHigh', () => {
  it('energy ≤ 4 on the last 3 logged days', () => {
    const low = [4, 3, 2].map((e, i) => makeDay({ date: d(10 - i), morningEnergy: e }));
    expect(energyLow(low, S)).toMatchObject({ code: 'ENERGY_LOW' });
    const mixed = [4, 6, 2].map((e, i) => makeDay({ date: d(10 - i), morningEnergy: e }));
    expect(energyLow(mixed, S)).toBeNull();
  });

  it('stress ≥ 8 on the last 2 logged days', () => {
    const high = [9, 8].map((s, i) => makeDay({ date: d(10 - i), stress: s }));
    expect(stressHigh(high, S)).toMatchObject({ code: 'STRESS_HIGH' });
    expect(stressHigh(high.slice(0, 1), S)).toBeNull();
  });
});

describe('grinding rules', () => {
  it('grindHours: 5 of 7 days over the cap with no rest taken', () => {
    const days = Array.from({ length: 7 }, (_, i) =>
      makeDay({ date: d(10 - i), deepWorkMin: i < 5 ? 400 : 100, restSessionsTaken: 0 }),
    );
    expect(grindHours(days, S)).toMatchObject({ code: 'GRIND_HOURS', state: 'grinding' });
    const rested = days.map((day) => ({ ...day, restSessionsTaken: 1 }));
    expect(grindHours(rested, S)).toBeNull();
  });

  it('grindRestDays: trained on 2 rest days', () => {
    const days = [true, false, true].map((t, i) => makeDay({ date: d(10 - i), trainedOnRestDay: t }));
    expect(grindRestDays(days, S)).toMatchObject({ code: 'GRIND_REST_DAYS' });
  });
});

describe('drifting rules', () => {
  it('indulgeHigh: over 120 unplanned minutes on the last 2 logged days', () => {
    const days = [150, 130].map((m, i) => makeDay({ date: d(10 - i), unplannedIndulgenceMin: m }));
    expect(indulgeHigh(days, S)).toMatchObject({ code: 'INDULGE_HIGH', state: 'drifting' });
    expect(indulgeHigh([makeDay({ date: d(10), unplannedIndulgenceMin: 120 }), days[1]!], S)).toBeNull();
  });

  it('anchorSkip: half the anchors skipped on 2 days while average energy ≥ 6', () => {
    const days = [
      makeDay({ date: d(10), anchorsTotal: 4, anchorsSkipped: 2, morningEnergy: 7 }),
      makeDay({ date: d(9), anchorsTotal: 4, anchorsSkipped: 3, morningEnergy: 6 }),
    ];
    expect(anchorSkip(days, S)).toMatchObject({ code: 'ANCHOR_SKIP' });
    const tired = days.map((day) => ({ ...day, morningEnergy: 3 }));
    expect(anchorSkip(tired, S)).toBeNull(); // low energy → that's depletion, not drifting
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/guard/rules.test.ts`
Expected: FAIL with `Error: Cannot find module './rules'`

- [ ] **Step 3: Implement `src/core/guard/rules.ts`**

```ts
import type { DaySummary, Flag, Settings } from '../types';

/** Spec §7. Every rule ignores days where its data wasn't logged. */
export type Rule = (days: DaySummary[], settings: Settings) => Flag | null;

/** Newest first, at most 7 days. */
export function recent(days: DaySummary[]): DaySummary[] {
  return [...days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
}

/** The newest `n` logged values of a field, or null if fewer than `n` were logged. */
function lastLogged(days: DaySummary[], pick: (d: DaySummary) => number | null, n: number): number[] | null {
  const values = recent(days)
    .map(pick)
    .filter((v): v is number => v !== null)
    .slice(0, n);
  return values.length === n ? values : null;
}

export const sleepLow: Rule = (days, { thresholds: t }) => {
  const nights = recent(days)
    .map((d) => d.sleepHours)
    .filter((v): v is number => v !== null)
    .slice(0, t.sleepLowWindow);
  const short = nights.filter((h) => h < t.sleepLowHours).length;
  if (short < t.sleepLowNights) return null;
  return {
    code: 'SLEEP_LOW',
    state: 'depleted',
    reason: `Under ${t.sleepLowHours}h sleep on ${short} of your last ${nights.length} nights`,
  };
};

export const energyLow: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.morningEnergy, t.energyLowDays);
  if (!values || !values.every((v) => v <= t.energyLowMax)) return null;
  return {
    code: 'ENERGY_LOW',
    state: 'depleted',
    reason: `Morning energy ${t.energyLowMax} or lower for ${t.energyLowDays} logged days in a row`,
  };
};

export const stressHigh: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.stress, t.stressHighDays);
  if (!values || !values.every((v) => v >= t.stressHighMin)) return null;
  return {
    code: 'STRESS_HIGH',
    state: 'depleted',
    reason: `Stress ${t.stressHighMin}+ for ${t.stressHighDays} logged days in a row`,
  };
};

export const grindHours: Rule = (days, { thresholds: t, deepWorkDailyCapMin }) => {
  const heavy = recent(days)
    .slice(0, t.grindWindow)
    .filter((d) => d.deepWorkMin !== null && d.deepWorkMin > deepWorkDailyCapMin && d.restSessionsTaken === 0);
  if (heavy.length < t.grindDays) return null;
  return {
    code: 'GRIND_HOURS',
    state: 'grinding',
    reason: `Over ${Math.round(deepWorkDailyCapMin / 60)}h of deep work with no rest on ${heavy.length} of the last ${t.grindWindow} days`,
  };
};

export const grindRestDays: Rule = (days, { thresholds: t }) => {
  const count = recent(days).filter((d) => d.trainedOnRestDay).length;
  if (count < t.grindRestDayTrainings) return null;
  return {
    code: 'GRIND_REST_DAYS',
    state: 'grinding',
    reason: `Trained on ${count} rest days this week`,
  };
};

export const indulgeHigh: Rule = (days, { thresholds: t }) => {
  const values = lastLogged(days, (d) => d.unplannedIndulgenceMin, t.indulgeHighDays);
  if (!values || !values.every((v) => v > t.indulgeHighMin)) return null;
  return {
    code: 'INDULGE_HIGH',
    state: 'drifting',
    reason: `More than ${t.indulgeHighMin / 60}h of unplanned screen time ${t.indulgeHighDays} days running`,
  };
};

export const anchorSkip: Rule = (days, { thresholds: t }) => {
  const withAnchors = recent(days)
    .filter((d) => d.anchorsTotal > 0)
    .slice(0, t.anchorSkipDays);
  if (withAnchors.length < t.anchorSkipDays) return null;
  if (!withAnchors.every((d) => d.anchorsSkipped / d.anchorsTotal >= t.anchorSkipRatio)) return null;
  const energies = withAnchors.map((d) => d.morningEnergy).filter((v): v is number => v !== null);
  if (energies.length === 0) return null;
  const avg = energies.reduce((sum, v) => sum + v, 0) / energies.length;
  if (avg < t.anchorSkipMinEnergy) return null;
  return {
    code: 'ANCHOR_SKIP',
    state: 'drifting',
    reason: `Skipped half your anchors ${t.anchorSkipDays} days running while energy was fine`,
  };
};

export const RULES: Rule[] = [sleepLow, energyLow, stressHigh, grindHours, grindRestDays, indulgeHigh, anchorSkip];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- src/core/guard/rules.test.ts` → Expected: PASS, `Tests  9 passed (9)`

- [ ] **Step 5: Write the failing test `src/core/guard/assess.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeDay } from '../testing/fixtures';
import { DEFAULT_SETTINGS } from '../types';
import { adjustmentsFor, assess } from './assess';

const d = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;

describe('assess', () => {
  it('is ready with no flags when nothing fires, including no data at all', () => {
    expect(assess([], DEFAULT_SETTINGS)).toEqual({ state: 'ready', flags: [], adjustments: [] });
  });

  it('depleted beats drifting and keeps every flag for the mentor', () => {
    const days = [0, 1, 2].map((i) =>
      makeDay({ date: d(10 - i), sleepHours: 5, unplannedIndulgenceMin: 180 }),
    );
    const result = assess(days, DEFAULT_SETTINGS);
    expect(result.state).toBe('depleted');
    expect(result.flags.map((f) => f.code)).toEqual(['SLEEP_LOW', 'INDULGE_HIGH']);
    expect(result.adjustments.map((a) => a.type)).toEqual([
      'trainingToRecovery',
      'bedtimeEarlier',
      'dropLowPriority',
      'capDeepWork',
    ]);
  });

  it('grinding beats drifting', () => {
    const days = [0, 1].map((i) =>
      makeDay({ date: d(10 - i), trainedOnRestDay: true, unplannedIndulgenceMin: 180 }),
    );
    expect(assess(days, DEFAULT_SETTINGS).state).toBe('grinding');
  });
});

describe('adjustmentsFor', () => {
  it('scales deep-work caps from settings', () => {
    const settings = { ...DEFAULT_SETTINGS, deepWorkDailyCapMin: 300 };
    expect(adjustmentsFor('depleted', settings)).toContainEqual(expect.objectContaining({ type: 'capDeepWork', minutes: 150 }));
    expect(adjustmentsFor('grinding', settings)).toContainEqual(expect.objectContaining({ type: 'capDeepWork', minutes: 300 }));
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- src/core/guard/assess.test.ts`
Expected: FAIL with `Error: Cannot find module './assess'`

- [ ] **Step 7: Implement `src/core/guard/assess.ts`**

```ts
import type { Adjustment, Assessment, DaySummary, GuardState, Settings } from '../types';
import { RULES } from './rules';

/** When several states fire, the more protective one wins. */
const PRECEDENCE: GuardState[] = ['depleted', 'grinding', 'drifting'];

/** Spec §7 adjustments table. */
export function adjustmentsFor(state: GuardState, settings: Settings): Adjustment[] {
  const cap = settings.deepWorkDailyCapMin;
  switch (state) {
    case 'ready':
      return [];
    case 'drifting':
      return [
        { type: 'addEasyWin', reason: 'Start with a 15-minute win to get moving' },
        { type: 'addMorningAnchor', reason: 'A fixed start to the day gives it a spine' },
        { type: 'capRest', minutes: 45, reason: 'Shorter rest blocks make coming back easier' },
      ];
    case 'depleted':
      return [
        { type: 'trainingToRecovery', reason: "You're running low — recovery session instead of hard training" },
        { type: 'bedtimeEarlier', minutes: 30, reason: 'Sleep is the fix — bedtime 30 minutes earlier' },
        { type: 'dropLowPriority', maxPriority: 2, reason: 'Low-priority tasks can wait a day' },
        { type: 'capDeepWork', minutes: Math.floor(cap * 0.5), reason: 'Half your usual deep work, done well' },
      ];
    case 'grinding':
      return [
        { type: 'addMandatoryRest', at: '15:00', reason: "You've been grinding — a real break mid-afternoon" },
        { type: 'capDeepWork', minutes: cap, reason: 'Deep work capped at your daily limit' },
        { type: 'removeRestDayTraining', reason: 'Rest days are for resting' },
      ];
  }
}

/** Classify the last 7 days and propose adjustments for the next plan. */
export function assess(days: DaySummary[], settings: Settings): Assessment {
  const flags = RULES.map((rule) => rule(days, settings)).filter((f) => f !== null);
  const state = PRECEDENCE.find((s) => flags.some((f) => f.state === s)) ?? 'ready';
  return { state, flags, adjustments: adjustmentsFor(state, settings) };
}
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  60 passed (60)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 9: Commit**

```bash
git add src/core/guard
git commit -m "feat(core): burnout guard rules, state precedence, adjustments"
```

---

### Task 8: Nudge scheduler

**Files:**
- Create: `src/core/nudges/dueNudges.ts`
- Test: `src/core/nudges/dueNudges.test.ts`

**Interfaces:**
- Consumes: `Block`, `DayPlan`, `Settings`, `DEFAULT_SETTINGS` (Task 2); `makeBlock` (Task 2)
- Produces:
  - `type NudgeType = 'morning' | 'welcomeBack' | 'transition' | 'restWarning' | 'reentry' | 'reentryFollowUp' | 'evening'`
  - `interface Nudge { key; type; blockId: string | null; title; body }` with `key = ${date}:${type}:${ref}` (ref `-`, a block id, or `rest-${sessionId}`)
  - `interface RestSessionInfo { id; blockId: string | null; plannedEnd: number; closed: boolean }`
  - `interface NudgeInput { plan; now; restSessions; sentKeys: string[]; settings; missedDaysInARow: number; welcomeBackSent: boolean }`
  - `LOOKBACK_MIN = 5`, `dueNudges(input: NudgeInput): Nudge[]`

- [ ] **Step 1: Write the failing test `src/core/nudges/dueNudges.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { type DayPlan, DEFAULT_SETTINGS } from '../types';
import { dueNudges, type NudgeInput } from './dueNudges';

// wake 07:00 (420), bedtime 23:00 (1380), wind-down 22:00 (1320)
const plan: DayPlan = {
  date: '2026-09-14',
  wake: 420,
  bedtime: 1380,
  blocks: [
    makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660 }),
    makeBlock({ id: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, start: 720, end: 765 }),
    makeBlock({ id: 'game', title: 'Gaming', kind: 'rest', start: 1200, end: 1260 }),
    makeBlock({ id: 'wind', title: 'Wind down', kind: 'routine', anchor: true, start: 1320, end: 1380, tags: ['windDown'] }),
  ],
};

function input(overrides: Partial<NudgeInput>): NudgeInput {
  return {
    plan,
    now: 420,
    restSessions: [],
    sentKeys: [],
    settings: DEFAULT_SETTINGS,
    missedDaysInARow: 0,
    welcomeBackSent: false,
    ...overrides,
  };
}

const types = (n: { type: string }[]) => n.map((x) => x.type);

describe('dueNudges', () => {
  it('sends the morning check-in at wake', () => {
    const out = dueNudges(input({ now: 420 }));
    expect(out).toEqual([
      { key: '2026-09-14:morning:-', type: 'morning', blockId: null, title: 'Morning check-in', body: 'How did you sleep? 60 seconds.' },
    ]);
  });

  it('still sends within the 5-minute look-back, but not after it', () => {
    expect(types(dueNudges(input({ now: 424 })))).toEqual(['morning']);
    expect(dueNudges(input({ now: 425 }))).toEqual([]);
  });

  it('never sends the same nudge twice', () => {
    expect(dueNudges(input({ now: 421, sentKeys: ['2026-09-14:morning:-'] }))).toEqual([]);
  });

  it('sends a transition when a block ends, naming what is next', () => {
    const [nudge] = dueNudges(input({ now: 660 }));
    expect(nudge).toMatchObject({ type: 'transition', blockId: 'deep', title: 'Deep work: done?', body: 'Next: Lunch in 60 min.' });
  });

  it('skips transitions for blocks already marked done', () => {
    const done = { ...plan, blocks: plan.blocks.map((b) => (b.id === 'deep' ? { ...b, status: 'done' as const } : b)) };
    expect(dueNudges(input({ plan: done, now: 660 }))).toEqual([]);
  });

  it('runs the rest re-entry sequence: warning, re-entry, one follow-up', () => {
    const rest = { id: 'r1', blockId: 'game', plannedEnd: 1260, closed: false };
    expect(types(dueNudges(input({ now: 1255, restSessions: [rest] })))).toEqual(['restWarning']);
    expect(types(dueNudges(input({ now: 1260, restSessions: [rest] })))).toEqual(['reentry']);
    expect(types(dueNudges(input({ now: 1270, restSessions: [rest] })))).toEqual(['reentryFollowUp']);
    expect(dueNudges(input({ now: 1270, restSessions: [{ ...rest, closed: true }] }))).toEqual([]);
  });

  it('sends the evening nudge at wind-down and nothing during quiet hours', () => {
    expect(types(dueNudges(input({ now: 1320 })))).toEqual(['evening']);
    expect(dueNudges(input({ now: 1400 }))).toEqual([]);
    expect(dueNudges(input({ now: 300 }))).toEqual([]);
  });

  it('respects the daily cap and keeps a slot for the evening nudge', () => {
    const settings = { ...DEFAULT_SETTINGS, nudgeDailyCap: 3 };
    const sent = ['a', 'b'];
    // one slot left, reserved for evening → the transition is skipped
    expect(dueNudges(input({ now: 660, settings, sentKeys: sent }))).toEqual([]);
    // at wind-down the reserved slot is used
    expect(types(dueNudges(input({ now: 1320, settings, sentKeys: sent })))).toEqual(['evening']);
  });

  it('sends welcome-back after 2 missed days, then pauses until CT returns', () => {
    expect(types(dueNudges(input({ now: 420, missedDaysInARow: 2 })))).toEqual(['welcomeBack']);
    expect(dueNudges(input({ now: 660, missedDaysInARow: 2, welcomeBackSent: true }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/nudges/dueNudges.test.ts`
Expected: FAIL with `Error: Cannot find module './dueNudges'`

- [ ] **Step 3: Implement `src/core/nudges/dueNudges.ts`**

```ts
import type { Block, DayPlan, Settings } from '../types';

export type NudgeType =
  | 'morning'
  | 'welcomeBack'
  | 'transition'
  | 'restWarning'
  | 'reentry'
  | 'reentryFollowUp'
  | 'evening';

export interface Nudge {
  /** Unique per (date, type, ref): used to never send the same nudge twice. */
  key: string;
  type: NudgeType;
  blockId: string | null;
  title: string;
  body: string;
}

export interface RestSessionInfo {
  id: string;
  blockId: string | null;
  /** Plan minute when the rest is scheduled to end. */
  plannedEnd: number;
  /** True once CT tapped "I'm back" or ended the rest. */
  closed: boolean;
}

export interface NudgeInput {
  plan: DayPlan;
  now: number;
  restSessions: RestSessionInfo[];
  /** Keys of nudges already sent today. */
  sentKeys: string[];
  settings: Settings;
  /** Consecutive days before today with no check-in at all. */
  missedDaysInARow: number;
  /** Whether the welcome-back nudge has already gone out since the last check-in. */
  welcomeBackSent: boolean;
}

/** A delayed cron tick still sends anything that fell due in the last few minutes. */
export const LOOKBACK_MIN = 5;

const RANK: Record<NudgeType, number> = {
  morning: 0,
  welcomeBack: 0,
  evening: 0,
  reentry: 0,
  reentryFollowUp: 1,
  transition: 2,
  restWarning: 3,
};

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** Spec §9: which nudges should go out at `now`. Pure — sending and recording happen elsewhere. */
export function dueNudges(input: NudgeInput): Nudge[] {
  const { plan, now, settings } = input;
  if (now < plan.wake || now >= plan.bedtime) return []; // quiet hours
  if (input.missedDaysInARow >= 2 && input.welcomeBackSent) return []; // paused until CT returns

  const isDue = (t: number) => t <= now && t > now - LOOKBACK_MIN;
  const key = (type: NudgeType, ref: string) => `${plan.date}:${type}:${ref}`;
  const windDownStart = plan.bedtime - 60;
  const due: (Nudge & { at: number })[] = [];

  if (isDue(plan.wake)) {
    if (input.missedDaysInARow >= 2) {
      due.push({
        key: key('welcomeBack', '-'),
        type: 'welcomeBack',
        blockId: null,
        title: 'Welcome back',
        body: 'No catching up needed. One check-in, 60 seconds.',
        at: plan.wake,
      });
    } else {
      due.push({
        key: key('morning', '-'),
        type: 'morning',
        blockId: null,
        title: 'Morning check-in',
        body: 'How did you sleep? 60 seconds.',
        at: plan.wake,
      });
    }
  }

  const open = plan.blocks.filter(isOpen).sort((a, b) => a.start - b.start);
  for (const b of open) {
    if (b.kind === 'rest' || b.tags.includes('windDown') || b.end === windDownStart || !isDue(b.end)) continue;
    const next = open.find((n) => n.id !== b.id && n.start >= b.end);
    const gap = next ? next.start - b.end : 0;
    const body = !next
      ? 'That was the last block before wind-down.'
      : gap <= 0
        ? `Next: ${next.title}, now.`
        : `Next: ${next.title} in ${gap} min.`;
    due.push({ key: key('transition', b.id), type: 'transition', blockId: b.id, title: `${b.title}: done?`, body, at: b.end });
  }

  for (const r of input.restSessions) {
    if (r.closed) continue;
    const ref = `rest-${r.id}`;
    if (isDue(r.plannedEnd - 5)) {
      due.push({ key: key('restWarning', ref), type: 'restWarning', blockId: r.blockId, title: 'Re-entry in 5', body: 'Finish what you are on.', at: r.plannedEnd - 5 });
    }
    if (isDue(r.plannedEnd)) {
      due.push({ key: key('reentry', ref), type: 'reentry', blockId: r.blockId, title: 'Time to come back', body: 'Stand up. Water. Then the first 2 minutes of your next block.', at: r.plannedEnd });
    }
    if (isDue(r.plannedEnd + 10)) {
      due.push({ key: key('reentryFollowUp', ref), type: 'reentryFollowUp', blockId: r.blockId, title: 'Still there?', body: 'Just stand up. That is the whole first step.', at: r.plannedEnd + 10 });
    }
  }

  if (isDue(windDownStart)) {
    due.push({ key: key('evening', '-'), type: 'evening', blockId: null, title: 'Wind-down', body: 'Evening check-in, then phone away.', at: windDownStart });
  }

  const sent = new Set(input.sentKeys);
  const fresh = due.filter((n) => !sent.has(n.key)).sort((a, b) => RANK[a.type] - RANK[b.type] || a.at - b.at);

  // Keep one slot for the evening nudge so low-priority nudges can't use up the whole day's cap.
  let budget = settings.nudgeDailyCap - input.sentKeys.length;
  const reserve = windDownStart > now && !sent.has(key('evening', '-')) ? 1 : 0;
  const out: Nudge[] = [];
  for (const { at: _at, ...nudge } of fresh) {
    const available = RANK[nudge.type] === 0 ? budget : budget - reserve;
    if (available <= 0) continue;
    out.push(nudge);
    budget--;
  }
  return out;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  69 passed (69)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/nudges
git commit -m "feat(core): nudge scheduler with cap, quiet hours, dedup, re-entry sequence"
```

---

### Task 9: Mentor profile, context and cost

**Files:**
- Modify: `package.json` (adds `@anthropic-ai/sdk` dependency)
- Create: `src/core/mentor/profile.ts`, `src/core/mentor/context.ts`, `src/core/mentor/cost.ts`
- Test: `src/core/mentor/profile.test.ts`, `src/core/mentor/context.test.ts`, `src/core/mentor/cost.test.ts`

**Interfaces:**
- Consumes: `formatPlanMinute` (Task 1); `Adjustment`, `Block`, `Flag`, `GuardState` (Task 2); `makeBlock` (Task 2); SDK types `Anthropic.TextBlockParam`, `Anthropic.MessageParam`
- Produces:
  - profile.ts: `PROFILE_SECTIONS` (11 `{key, heading}` in fixed order), `ProfileSection`, `Profile = Record<ProfileSection, string>`, `emptyProfile()`, `renderProfile(p): string`, `ProfileChange = { section; newText; reason }`, `applyProfileChanges(p, changes): Profile` (throws on unknown section), `revertSection(current, previous, section): Profile`
  - context.ts: `CheckinRecord = { type: 'morning'|'evening'; sections; privateKeys: string[] }` (`"section"` or `"section.field"`), `stripPrivate(c)`, `MentorContextInput`, `MentorContext = { system: TextBlockParam[]; messages: MessageParam[] }`, `buildMentorContext(input): MentorContext`
  - cost.ts: `UsageTokens`, `ModelPrice`, `MODEL_PRICES`, `computeCostUsd(model, usage): number` (throws on unknown model), `CapStatus`, `capStatus(spentUsd, capUsd): CapStatus`

- [ ] **Step 1: Install the Anthropic SDK (used for types here, for calls in Plan 4)**

Run: `npm install @anthropic-ai/sdk@0.125.0`
Expected: `added … packages`, `package.json` gains `"dependencies": { "@anthropic-ai/sdk": "^0.125.0" }`

- [ ] **Step 2: Write the failing test `src/core/mentor/profile.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { applyProfileChanges, emptyProfile, PROFILE_SECTIONS, renderProfile, revertSection } from './profile';

describe('profile', () => {
  it('renders every section in a fixed order, marking empty ones', () => {
    const profile = { ...emptyProfile(), values: 'Honesty. Discipline.' };
    const md = renderProfile(profile);
    expect(md.startsWith('## Physical goals\n\n(not written yet)')).toBe(true);
    expect(md).toContain('## Values\n\nHonesty. Discipline.');
    expect(md.match(/^## /gm)).toHaveLength(PROFILE_SECTIONS.length);
  });

  it('applies changes and rejects unknown sections', () => {
    const next = applyProfileChanges(emptyProfile(), [
      { section: 'observedPatterns', newText: 'Late gaming → short sleep', reason: 'Seen 3 times' },
    ]);
    expect(next.observedPatterns).toBe('Late gaming → short sleep');
    expect(() =>
      applyProfileChanges(emptyProfile(), [{ section: 'nope' as never, newText: 'x', reason: '' }]),
    ).toThrow('Unknown profile section');
  });

  it('reverts a single section from the previous version', () => {
    const previous = { ...emptyProfile(), values: 'old', goalsMind: 'keep' };
    const current = { ...previous, values: 'new', goalsMind: 'changed too' };
    expect(revertSection(current, previous, 'values')).toMatchObject({ values: 'old', goalsMind: 'changed too' });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/core/mentor/profile.test.ts`
Expected: FAIL with `Error: Cannot find module './profile'`

- [ ] **Step 4: Implement `src/core/mentor/profile.ts`**

```ts
/** Spec §8.6: the profile is a fixed set of named free-text sections. */
export const PROFILE_SECTIONS = [
  { key: 'goalsPhysical', heading: 'Physical goals' },
  { key: 'goalsFootballAnalytics', heading: 'Football analytics goals' },
  { key: 'goalsMind', heading: 'Mind goals' },
  { key: 'goalsCharacter', heading: 'Character goals' },
  { key: 'values', heading: 'Values' },
  { key: 'stressTriggers', heading: 'Stress triggers' },
  { key: 'whatWorks', heading: 'What works' },
  { key: 'whatDoesntWork', heading: "What doesn't work" },
  { key: 'commitments', heading: 'Current commitments' },
  { key: 'mentorStyle', heading: 'How the mentor should talk' },
  { key: 'observedPatterns', heading: 'Observed patterns' },
] as const;

export type ProfileSection = (typeof PROFILE_SECTIONS)[number]['key'];
export type Profile = Record<ProfileSection, string>;

export function emptyProfile(): Profile {
  return Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, ''])) as Profile;
}

/** Markdown with one heading per section, always in the same order (keeps the prompt cache stable). */
export function renderProfile(profile: Profile): string {
  return PROFILE_SECTIONS.map(({ key, heading }) => `## ${heading}\n\n${profile[key].trim() || '(not written yet)'}`).join('\n\n');
}

export interface ProfileChange {
  section: ProfileSection;
  newText: string;
  reason: string;
}

/** Apply the weekly review's changes. Unknown sections are rejected so a bad model output can't corrupt the profile. */
export function applyProfileChanges(profile: Profile, changes: ProfileChange[]): Profile {
  const next = { ...profile };
  for (const change of changes) {
    if (!PROFILE_SECTIONS.some((s) => s.key === change.section)) {
      throw new Error(`Unknown profile section "${change.section}"`);
    }
    next[change.section] = change.newText;
  }
  return next;
}

/** One-tap revert: restore a section's text from the previous version. */
export function revertSection(current: Profile, previous: Profile, section: ProfileSection): Profile {
  return { ...current, [section]: previous[section] };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- src/core/mentor/profile.test.ts` → Expected: PASS, `Tests  3 passed (3)`

- [ ] **Step 6: Write the failing test `src/core/mentor/context.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { buildMentorContext, type CheckinRecord, type MentorContextInput, stripPrivate } from './context';
import { emptyProfile } from './profile';

const evening: CheckinRecord = {
  type: 'evening',
  sections: {
    mind: { stressPeak: 8, stressCause: ['family'], note: 'SECRET-NOTE' },
    people: { who: ['SECRET-PERSON'], felt: 'draining' },
    reflection: { win: 'Finished xT notebook' },
  },
  privateKeys: ['mind.note', 'people'],
};

function input(overrides: Partial<MentorContextInput> = {}): MentorContextInput {
  return {
    systemPrompt: 'You are CT’s mentor.',
    profile: { ...emptyProfile(), values: 'Discipline' },
    weeklyLetters: [
      { weekStart: '2026-08-31', letter: 'Letter A' },
      { weekStart: '2026-08-24', letter: 'Letter B' },
    ],
    digests: [{ date: '2026-09-13', text: 'Solid day.' }],
    today: {
      date: '2026-09-14',
      state: 'depleted',
      flags: [{ code: 'SLEEP_LOW', state: 'depleted', reason: 'Under 6h sleep on 3 of your last 4 nights' }],
      adjustments: [{ type: 'bedtimeEarlier', minutes: 30, reason: 'Sleep is the fix' }],
      overridden: false,
      blocks: [makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660, status: 'done' })],
      checkins: [evening],
    },
    request: 'Write the evening review.',
    ...overrides,
  };
}

describe('stripPrivate', () => {
  it('removes private sections and fields, keeps the rest', () => {
    expect(stripPrivate(evening)).toEqual({
      mind: { stressPeak: 8, stressCause: ['family'] },
      reflection: { win: 'Finished xT notebook' },
    });
  });
});

describe('buildMentorContext', () => {
  it('never contains private content anywhere', () => {
    const json = JSON.stringify(buildMentorContext(input()));
    expect(json).not.toContain('SECRET-NOTE');
    expect(json).not.toContain('SECRET-PERSON');
    expect(json).toContain('Finished xT notebook');
  });

  it('puts stable content first with cache breakpoints, volatile content after', () => {
    const ctx = buildMentorContext(input());
    expect(ctx.system).toHaveLength(2);
    expect(ctx.system[0]).toMatchObject({ text: 'You are CT’s mentor.', cache_control: { type: 'ephemeral' } });
    expect(ctx.system[1]!.text).toContain('## Values\n\nDiscipline');
    const first = ctx.messages[0]!;
    expect(first.role).toBe('user');
    const blocks = first.content as { text: string; cache_control?: unknown }[];
    expect(blocks[0]!.text).toMatch(/^<history>/);
    expect(blocks[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1]!.text).toMatch(/^<today date="2026-09-14">/);
    expect(blocks[1]!.cache_control).toBeUndefined();
    expect(blocks[2]!.text).toBe('Write the evening review.');
  });

  it('orders history oldest first and renders today readably', () => {
    const ctx = buildMentorContext(input());
    const [history, today] = (ctx.messages[0]!.content as { text: string }[]).map((b) => b.text);
    expect(history!.indexOf('Letter B')).toBeLessThan(history!.indexOf('Letter A'));
    expect(today).toContain('State: depleted');
    expect(today).toContain('- SLEEP_LOW: Under 6h sleep on 3 of your last 4 nights');
    expect(today).toContain('- 09:00–11:00 Deep work — done');
  });

  it('appends chat history after the context turn and ends with the new message', () => {
    const ctx = buildMentorContext(
      input({
        chatHistory: [
          { role: 'assistant', content: 'dangling assistant turn is dropped' },
          { role: 'user', content: 'Should I train today?' },
          { role: 'assistant', content: 'Recovery session.' },
        ],
        request: 'Why?',
      }),
    );
    expect(ctx.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect((ctx.messages[0]!.content as { text: string }[])[2]!.text).toBe('Should I train today?');
    expect(ctx.messages[2]!.content).toBe('Why?');
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npm test -- src/core/mentor/context.test.ts`
Expected: FAIL with `Error: Cannot find module './context'`

- [ ] **Step 8: Implement `src/core/mentor/context.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { formatPlanMinute } from '../time';
import type { Adjustment, Block, Flag, GuardState } from '../types';
import { type Profile, renderProfile } from './profile';

export interface CheckinRecord {
  type: 'morning' | 'evening';
  /** section → field → value, e.g. { mind: { mood: 6, stressCause: ['school'] } } */
  sections: Record<string, Record<string, unknown>>;
  /** "section" hides a whole section, "section.field" hides one field. */
  privateKeys: string[];
}

export interface MentorContextInput {
  systemPrompt: string;
  profile: Profile;
  weeklyLetters: { weekStart: string; letter: string }[];
  digests: { date: string; text: string }[];
  today: {
    date: string;
    state: GuardState;
    flags: Flag[];
    adjustments: Adjustment[];
    overridden: boolean;
    blocks: Block[];
    checkins: CheckinRecord[];
  };
  /** Route instruction (briefing, evening review, …) or, for chat, CT's new message. */
  request: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface MentorContext {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}

/** Remove everything CT marked "just for me". Nothing private may ever reach Claude. */
export function stripPrivate(checkin: CheckinRecord): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [section, fields] of Object.entries(checkin.sections)) {
    if (checkin.privateKeys.includes(section)) continue;
    const kept = Object.fromEntries(
      Object.entries(fields).filter(([field]) => !checkin.privateKeys.includes(`${section}.${field}`)),
    );
    if (Object.keys(kept).length > 0) out[section] = kept;
  }
  return out;
}

function renderHistory(input: MentorContextInput): string {
  const letters = [...input.weeklyLetters].sort((a, b) => a.weekStart.localeCompare(b.weekStart)).slice(-4);
  const digests = [...input.digests].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const parts = ['<history>', '## Weekly letters (oldest first)'];
  parts.push(...(letters.length ? letters.map((l) => `### Week of ${l.weekStart}\n${l.letter}`) : ['(none yet)']));
  parts.push('## Daily digests (oldest first)');
  parts.push(...(digests.length ? digests.map((d) => `### ${d.date}\n${d.text}`) : ['(none yet)']));
  parts.push('</history>');
  return parts.join('\n');
}

function renderBlock(b: Block): string {
  const anchor = b.anchor ? ' [anchor]' : '';
  return `- ${formatPlanMinute(b.start)}–${formatPlanMinute(b.end)} ${b.title}${anchor} — ${b.status}`;
}

function renderToday(today: MentorContextInput['today']): string {
  const lines = [`<today date="${today.date}">`, `State: ${today.state}`];
  lines.push('Flags:', ...(today.flags.length ? today.flags.map((f) => `- ${f.code}: ${f.reason}`) : ['- none']));
  lines.push(
    `Plan adjustments (CT overrode them: ${today.overridden ? 'yes' : 'no'}):`,
    ...(today.adjustments.length ? today.adjustments.map((a) => `- ${a.type}: ${a.reason}`) : ['- none']),
  );
  lines.push('Plan:', ...[...today.blocks].sort((a, b) => a.start - b.start).map(renderBlock));
  lines.push('Check-ins:');
  for (const c of today.checkins) lines.push(`${c.type}: ${JSON.stringify(stripPrivate(c))}`);
  if (today.checkins.length === 0) lines.push('(none yet)');
  lines.push('</today>');
  return lines.join('\n');
}

/**
 * Spec §8.3. Stable content first so the prompt cache can reuse it:
 * system = [persona ✱, profile ✱]; first user turn = [history ✱, today, request]. ✱ = cache breakpoint.
 */
export function buildMentorContext(input: MentorContextInput): MentorContext {
  const cache = { type: 'ephemeral' as const };
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: input.systemPrompt, cache_control: cache },
    { type: 'text', text: `# About CT\n\n${renderProfile(input.profile)}`, cache_control: cache },
  ];

  const turns = [...(input.chatHistory ?? []), { role: 'user' as const, content: input.request }];
  while (turns.length > 0 && turns[0]!.role !== 'user') turns.shift();
  const [first, ...rest] = turns;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: renderHistory(input), cache_control: cache },
        { type: 'text', text: renderToday(input.today) },
        { type: 'text', text: first!.content },
      ],
    },
    ...rest.map((t): Anthropic.MessageParam => ({ role: t.role, content: t.content })),
  ];
  return { system, messages };
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npm test -- src/core/mentor/context.test.ts` → Expected: PASS, `Tests  5 passed (5)`

- [ ] **Step 10: Write the failing test `src/core/mentor/cost.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { capStatus, computeCostUsd } from './cost';

describe('computeCostUsd', () => {
  it('prices each token type separately', () => {
    // Sonnet 5: 10k input ($0.02) + 1k output ($0.01) + 20k cache read ($0.004) + 5k cache write ($0.0125)
    expect(
      computeCostUsd('claude-sonnet-5', { inputTokens: 10_000, outputTokens: 1_000, cacheReadTokens: 20_000, cacheWriteTokens: 5_000 }),
    ).toBeCloseTo(0.0465, 6);
  });

  it('refuses unknown models so a typo in settings is noticed', () => {
    expect(() => computeCostUsd('claude-typo', { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 })).toThrow(
      'No price configured',
    );
  });
});

describe('capStatus', () => {
  it('reports remaining budget and pauses at the cap', () => {
    expect(capStatus(4.5, 12)).toEqual({ spentUsd: 4.5, capUsd: 12, remainingUsd: 7.5, over: false });
    expect(capStatus(12, 12).over).toBe(true);
    expect(capStatus(13, 12).remainingUsd).toBe(0);
  });
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `npm test -- src/core/mentor/cost.test.ts`
Expected: FAIL with `Error: Cannot find module './cost'`

- [ ] **Step 12: Implement `src/core/mentor/cost.ts`**

```ts
export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** USD per million tokens. Verify against current Anthropic pricing in Plan 4 (spec §15). */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export function computeCostUsd(model: string, usage: UsageTokens): number {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`No price configured for model "${model}"`);
  const cost =
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheReadTokens * price.cacheRead +
      usage.cacheWriteTokens * price.cacheWrite) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export interface CapStatus {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  over: boolean;
}

/** Spec §8.5: at or past the cap, the mentor pauses. */
export function capStatus(spentUsd: number, capUsd: number): CapStatus {
  return {
    spentUsd,
    capUsd,
    remainingUsd: Math.max(0, capUsd - spentUsd),
    over: spentUsd >= capUsd,
  };
}
```

- [ ] **Step 13: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  80 passed (80)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json src/core/mentor
git commit -m "feat(core): mentor profile, private-safe cached context, cost and cap"
```

---

### Task 10: Weekly success metrics + final verification

**Files:**
- Create: `src/core/metrics/weekly.ts`
- Test: `src/core/metrics/weekly.test.ts`

**Interfaces:**
- Consumes: `GuardState` (Task 2)
- Produces: `WeekDay`, `RestOutcome = { ackDelayMin: number | null }`, `WeeklyMetrics` (`s1`–`s4`, see code), `weeklyMetrics(week: WeekDay[], restOutcomes: RestOutcome[], previousWeek: WeekDay[] | null): WeeklyMetrics`. "Unknown" is `null`, never a failure.

- [ ] **Step 1: Write the failing test `src/core/metrics/weekly.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import type { GuardState } from '../types';
import { type WeekDay, weeklyMetrics } from './weekly';

function week(states: (GuardState | null)[], sleep: (number | null)[], checkins: boolean[]): WeekDay[] {
  return states.map((state, i) => ({
    date: `2026-09-${String(7 + i).padStart(2, '0')}`,
    hasCheckin: checkins[i]!,
    sleepHours: sleep[i]!,
    state,
    trainingPlanned: i < 4 ? 1 : 0,
    trainingDone: i < 3 ? 1 : 0,
    footballMinutes: 45,
    learnedNotes: 1,
  }));
}

describe('weeklyMetrics', () => {
  const good = week(
    ['ready', 'ready', 'drifting', 'ready', 'ready', 'ready', 'ready'],
    [7.5, 7, 6, 8, 7.2, null, 7],
    [true, true, true, true, false, true, false],
  );
  const bad = week(
    ['depleted', 'depleted', 'drifting', 'ready', 'ready', 'ready', 'ready'],
    [5, 5, 6, 7, 7, 7, 6],
    [true, false, false, false, true, false, false],
  );

  it('computes S1–S4 for a good week that improved on the last one', () => {
    const m = weeklyMetrics(good, [{ ackDelayMin: 3 }, { ackDelayMin: 12 }, { ackDelayMin: 0 }, { ackDelayMin: null }], bad);
    expect(m.s1).toEqual({ checkinDays: 5, target: 5, met: true });
    expect(m.s2).toMatchObject({ nightsSleep7: 5, depletedOrDriftingDays: 1, previousDepletedOrDriftingDays: 3, improving: true, met: true });
    expect(m.s3).toEqual({ returned: 2, ended: 4, rate: 0.5, target: 0.7, met: false });
    expect(m.s4).toEqual({ trainingDone: 3, trainingPlanned: 4, footballMinutes: 315, learnedNotes: 7 });
  });

  it('reports "unknown" instead of failing when there is nothing to measure', () => {
    const m = weeklyMetrics(bad, [], null);
    expect(m.s1.met).toBe(false);
    expect(m.s2.improving).toBeNull();
    expect(m.s2.met).toBe(false); // only 3 nights of 7h+
    expect(m.s3).toMatchObject({ rate: null, met: null });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/metrics/weekly.test.ts`
Expected: FAIL with `Error: Cannot find module './weekly'`

- [ ] **Step 3: Implement `src/core/metrics/weekly.ts`**

```ts
import type { GuardState } from '../types';

export interface WeekDay {
  date: string;
  hasCheckin: boolean;
  sleepHours: number | null;
  state: GuardState | null;
  trainingPlanned: number;
  trainingDone: number;
  footballMinutes: number;
  learnedNotes: number;
}

export interface RestOutcome {
  /** Minutes between the rest block's end and "I'm back"; null if CT never acknowledged. */
  ackDelayMin: number | null;
}

export interface WeeklyMetrics {
  s1: { checkinDays: number; target: number; met: boolean };
  s2: {
    nightsSleep7: number;
    target: number;
    depletedOrDriftingDays: number;
    previousDepletedOrDriftingDays: number | null;
    improving: boolean | null;
    met: boolean;
  };
  s3: { returned: number; ended: number; rate: number | null; target: number; met: boolean | null };
  s4: { trainingDone: number; trainingPlanned: number; footballMinutes: number; learnedNotes: number };
}

const badDays = (week: WeekDay[]) => week.filter((d) => d.state === 'depleted' || d.state === 'drifting').length;
const sum = (week: WeekDay[], pick: (d: WeekDay) => number) => week.reduce((total, d) => total + pick(d), 0);

/** Spec §2 success criteria S1–S4 for one week. `restOutcomes` holds only rest sessions that have ended. */
export function weeklyMetrics(week: WeekDay[], restOutcomes: RestOutcome[], previousWeek: WeekDay[] | null): WeeklyMetrics {
  const checkinDays = week.filter((d) => d.hasCheckin).length;

  const nightsSleep7 = week.filter((d) => d.sleepHours !== null && d.sleepHours >= 7).length;
  const current = badDays(week);
  const previous = previousWeek ? badDays(previousWeek) : null;
  const improving = previous === null ? null : current < previous || current === 0;

  const returned = restOutcomes.filter((r) => r.ackDelayMin !== null && r.ackDelayMin <= 10).length;
  const ended = restOutcomes.length;
  const rate = ended === 0 ? null : returned / ended;

  return {
    s1: { checkinDays, target: 5, met: checkinDays >= 5 },
    s2: {
      nightsSleep7,
      target: 5,
      depletedOrDriftingDays: current,
      previousDepletedOrDriftingDays: previous,
      improving,
      met: nightsSleep7 >= 5 && improving !== false,
    },
    s3: { returned, ended, rate, target: 0.7, met: rate === null ? null : rate >= 0.7 },
    s4: {
      trainingDone: sum(week, (d) => d.trainingDone),
      trainingPlanned: sum(week, (d) => d.trainingPlanned),
      footballMinutes: sum(week, (d) => d.footballMinutes),
      learnedNotes: sum(week, (d) => d.learnedNotes),
    },
  };
}
```

- [ ] **Step 4: Full verification**

Run: `npm test` → Expected: PASS, `Test Files  14 passed (14)` and `Tests  82 passed (82)`
Run: `npm run typecheck` → Expected: exits 0
Run: `git status --short` → Expected: only the two new metrics files are untracked

- [ ] **Step 5: Commit**

```bash
git add src/core/metrics
git commit -m "feat(core): weekly success metrics S1-S4"
```

- [ ] **Step 6: Update the portfolio knowledge graph (project CLAUDE.md rule)**

Run from the portfolio root: `graphify update .` in `D:\CT's Portfolio` (e.g. `cd "D:\CT's Portfolio"` then `graphify update .`)
Expected: the graph update completes; no files in this repo change.

---

## Done when

- All 10 tasks are committed on `main`.
- `npm test` shows 82 passing tests across 14 files; `npm run typecheck` is clean.
- Next: Plan 2 (visual design) and Plan 3 (data, login and deploy skeleton) get written; see the roadmap.
