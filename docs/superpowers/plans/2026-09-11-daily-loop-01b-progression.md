# Daily Loop — Plan 1b: Progression Core (MyCareer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the career-mode progression engine to the pure core: XP rules per attribute with guard-state multipliers, the 40–99 growth curve, OVR, Form, tiered badges, the player card, and level-up/new-tier detection.

**Architecture:** A new `src/core/progression/` folder of pure functions over `ProgressDay[]` (one record per logged day). Everything is recomputed from history, so there's no stored XP to drift. It builds on Plan 1 (`time.ts`, `types.ts`) and changes nothing that already exists.

**Tech Stack:** unchanged from Plan 1 (TypeScript 6.0.3, Vitest 5.0.0).

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md) §8b. Roadmap: [`2026-09-11-daily-loop-00-roadmap.md`](2026-09-11-daily-loop-00-roadmap.md).

## Global Constraints

- All of Plan 1's global constraints apply (repo path with an apostrophe, pure `src/core/**`, colocated tests, commit per task).
- Plan 1 is merged on `main`: `npm test` shows 82 passing tests before this plan starts.
- Numbers come verbatim from spec §8b: XP table, multipliers, curve `round(20 × 1.06^(r − 40))`, ratings 40–99, form bands 1.30 / 1.05 / 0.85 / 0.60, badge thresholds.
- **Never-decrease guarantee:** attributes and badges only go up with more logged days, including empty, depleted or grinding days. Form is the only value that can fall.
- Badges count totals, never consecutive days (spec §5.9 no streaks).
- User-facing strings ("Settling in", "Rebuilding", "Injury risk", …) must stay non-shaming.

## File Structure

```
src/core/progression/
  xp.ts        ATTRS, ProgressDay, dayXp (table + multipliers), totalXp
  curve.ts     costToNext, levelFromXp, xpToMax
  form.ts      formOn (last 7 days vs the 21 before)
  badges.ts    BADGES, badgeProgress (tiers from totals)
  card.ts      playerCard, careerChanges (level-ups + new tiers)
src/core/testing/progressFixtures.ts   makeProgressDay, makeGoodDay
```

---

### Task 1: XP rules

**Files:**
- Create: `src/core/progression/xp.ts`, `src/core/testing/progressFixtures.ts`
- Test: `src/core/progression/xp.test.ts`

**Interfaces:**
- Consumes: `GuardState` (Plan 1 `types.ts`)
- Produces: `ATTRS = ['PHY','REC','ANL','DIS','MEN','CHR']`, `Attr`, `ATTR_NAMES`, `ProgressDay` (fields in the code), `XpByAttr`, `zeroXp()`, `dayXp(d: ProgressDay): XpByAttr`, `totalXp(days: ProgressDay[]): XpByAttr`; fixtures `makeProgressDay(overrides & {date})`, `makeGoodDay(date, overrides?)`. A good day is worth PHY 55, REC 40, ANL 105, DIS 45, MEN 30, CHR 10.

- [ ] **Step 1: Create the fixtures `src/core/testing/progressFixtures.ts`**

```ts
import type { ProgressDay } from '../progression/xp';

/** A ProgressDay where nothing was logged; override what the test needs. */
export function makeProgressDay(overrides: Partial<ProgressDay> & Pick<ProgressDay, 'date'>): ProgressDay {
  return {
    state: 'ready',
    trainingDone: 0,
    trainingPartial: 0,
    proteinHit: false,
    waterL: null,
    sleepHours: null,
    restDayNoTraining: false,
    restSessionsTaken: 0,
    restReturnsOnTime: 0,
    footballMinutes: 0,
    learnedEntry: false,
    anchorsKept: 0,
    easyWinDone: false,
    morningCheckin: false,
    eveningCheckin: false,
    regulations: 0,
    gratitudeLines: 0,
    winOrLesson: false,
    reachedOut: false,
    ...overrides,
  };
}

/** A solid, fully logged day (used to build long histories). */
export function makeGoodDay(date: string, overrides: Partial<ProgressDay> = {}): ProgressDay {
  return makeProgressDay({
    date,
    trainingDone: 1,
    proteinHit: true,
    waterL: 3,
    sleepHours: 7.5,
    restSessionsTaken: 1,
    restReturnsOnTime: 1,
    footballMinutes: 90,
    learnedEntry: true,
    anchorsKept: 3,
    morningCheckin: true,
    eveningCheckin: true,
    regulations: 1,
    gratitudeLines: 1,
    winOrLesson: true,
    ...overrides,
  });
}
```

- [ ] **Step 2: Write the failing test `src/core/progression/xp.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { ATTRS, dayXp, totalXp } from './xp';

const D = '2026-09-14';

describe('dayXp', () => {
  it('earns nothing on an empty day', () => {
    expect(dayXp(makeProgressDay({ date: D }))).toEqual({ PHY: 0, REC: 0, ANL: 0, DIS: 0, MEN: 0, CHR: 0 });
  });

  it('applies the spec §8b.1 table on a ready day', () => {
    // PHY 40 + 10 + 5 = 55 · REC 30 + 10 = 40 · ANL 90 + 15 = 105
    // DIS 30 + 15 = 45 · MEN 10 + 15 + 5 = 30 · CHR 5 + 5 = 10
    expect(dayXp(makeGoodDay(D))).toEqual({ PHY: 55, REC: 40, ANL: 105, DIS: 45, MEN: 30, CHR: 10 });
  });

  it('caps analytics minutes, regulations and gratitude lines', () => {
    const xp = dayXp(makeProgressDay({ date: D, footballMinutes: 500, regulations: 9, gratitudeLines: 7 }));
    expect(xp.ANL).toBe(240);
    expect(xp.MEN).toBe(15);
    expect(xp.CHR).toBe(15);
  });

  it('gives partial sleep credit between 6 and 7 hours', () => {
    expect(dayXp(makeProgressDay({ date: D, sleepHours: 6.5 })).REC).toBe(10);
    expect(dayXp(makeProgressDay({ date: D, sleepHours: 5.9 })).REC).toBe(0);
  });

  it('depleted: work XP halved, recovery doubled', () => {
    expect(dayXp(makeGoodDay(D, { state: 'depleted' }))).toEqual({ PHY: 27, REC: 80, ANL: 52, DIS: 22, MEN: 30, CHR: 10 });
  });

  it('grinding: training earns nothing (injury risk), analytics halved, recovery doubled', () => {
    expect(dayXp(makeGoodDay(D, { state: 'grinding' }))).toEqual({ PHY: 15, REC: 80, ANL: 52, DIS: 45, MEN: 30, CHR: 10 });
  });

  it('drifting: the easy win is the biggest single discipline reward', () => {
    expect(dayXp(makeProgressDay({ date: D, state: 'drifting', easyWinDone: true })).DIS).toBe(30);
  });

  it('never returns negative XP', () => {
    for (const state of ['ready', 'drifting', 'depleted', 'grinding'] as const) {
      const xp = dayXp(makeGoodDay(D, { state }));
      for (const a of ATTRS) expect(xp[a]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('totalXp', () => {
  it('sums days per attribute', () => {
    const total = totalXp([makeGoodDay('2026-09-14'), makeGoodDay('2026-09-15')]);
    expect(total).toEqual({ PHY: 110, REC: 80, ANL: 210, DIS: 90, MEN: 60, CHR: 20 });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/core/progression/xp.test.ts`
Expected: FAIL with `Error: Cannot find module './xp'` (the fixtures file also imports `../progression/xp`)

- [ ] **Step 4: Implement `src/core/progression/xp.ts`**

```ts
import type { GuardState } from '../types';

/** Spec §8b.1: the six attributes of CT's player card. */
export const ATTRS = ['PHY', 'REC', 'ANL', 'DIS', 'MEN', 'CHR'] as const;
export type Attr = (typeof ATTRS)[number];

export const ATTR_NAMES: Record<Attr, string> = {
  PHY: 'Physical',
  REC: 'Recovery',
  ANL: 'Analytics',
  DIS: 'Discipline',
  MEN: 'Mentality',
  CHR: 'Character',
};

/** One logged day, as progression sees it. Built from check-ins, blocks and rest sessions. */
export interface ProgressDay {
  date: string; // YYYY-MM-DD
  state: GuardState;
  trainingDone: number;
  trainingPartial: number;
  proteinHit: boolean;
  waterL: number | null;
  sleepHours: number | null;
  restDayNoTraining: boolean;
  restSessionsTaken: number;
  /** Rest sessions whose "I'm back" came within 10 minutes of the planned end. */
  restReturnsOnTime: number;
  footballMinutes: number;
  learnedEntry: boolean;
  anchorsKept: number;
  easyWinDone: boolean;
  morningCheckin: boolean;
  eveningCheckin: boolean;
  /** Regulation tools used (guitar, walk, stretching, breathing, talked to someone). */
  regulations: number;
  gratitudeLines: number;
  winOrLesson: boolean;
  reachedOut: boolean;
}

export type XpByAttr = Record<Attr, number>;

export function zeroXp(): XpByAttr {
  return { PHY: 0, REC: 0, ANL: 0, DIS: 0, MEN: 0, CHR: 0 };
}

/** Spec §8b.1: XP earned by one day, after the guard-state multipliers, floored. Never negative. */
export function dayXp(d: ProgressDay): XpByAttr {
  const training = 40 * d.trainingDone + 20 * d.trainingPartial;
  const nutrition = (d.proteinHit ? 10 : 0) + (d.waterL !== null && d.waterL >= 3 ? 5 : 0);
  const sleep = d.sleepHours === null ? 0 : d.sleepHours >= 7 ? 30 : d.sleepHours >= 6 ? 10 : 0;
  const rec = sleep + 10 * d.restSessionsTaken + (d.restDayNoTraining ? 20 : 0);
  const anl = Math.min(d.footballMinutes, 240) + (d.learnedEntry ? 15 : 0);
  const dis = 10 * d.anchorsKept + 15 * d.restReturnsOnTime + (d.easyWinDone ? 30 : 0);
  const men = (d.morningCheckin ? 10 : 0) + (d.eveningCheckin ? 15 : 0) + 5 * Math.min(d.regulations, 3);
  const chr = 5 * Math.min(d.gratitudeLines, 3) + (d.winOrLesson ? 5 : 0) + (d.reachedOut ? 15 : 0);

  let phy = training + nutrition;
  let recM = 1;
  let anlM = 1;
  let disM = 1;
  if (d.state === 'depleted') {
    phy = (training + nutrition) * 0.5;
    anlM = 0.5;
    disM = 0.5;
    recM = 2;
  } else if (d.state === 'grinding') {
    phy = nutrition; // injury risk: training earns nothing
    anlM = 0.5;
    recM = 2;
  }

  return {
    PHY: Math.floor(phy),
    REC: Math.floor(rec * recM),
    ANL: Math.floor(anl * anlM),
    DIS: Math.floor(dis * disM),
    MEN: men,
    CHR: chr,
  };
}

/** Total XP per attribute over any set of days. */
export function totalXp(days: ProgressDay[]): XpByAttr {
  const total = zeroXp();
  for (const d of days) {
    const xp = dayXp(d);
    for (const a of ATTRS) total[a] += xp[a];
  }
  return total;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  91 passed (91)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 6: Commit**

```bash
git add src/core/progression/xp.ts src/core/progression/xp.test.ts src/core/testing/progressFixtures.ts
git commit -m "feat(progression): XP rules with guard-state multipliers"
```

---

### Task 2: Growth curve

**Files:**
- Create: `src/core/progression/curve.ts`
- Test: `src/core/progression/curve.test.ts`

**Interfaces:**
- Produces: `START_RATING = 40`, `MAX_RATING = 99`, `costToNext(rating): number`, `Level = { rating; intoLevel; toNext }`, `levelFromXp(totalXp): Level`, `xpToMax(): number` (about 10,000)

- [ ] **Step 1: Write the failing test `src/core/progression/curve.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { costToNext, levelFromXp, MAX_RATING, START_RATING, xpToMax } from './curve';

describe('costToNext', () => {
  it('matches the spec §8b.1 anchor points', () => {
    expect(costToNext(40)).toBe(20);
    expect(costToNext(60)).toBe(64);
    expect(costToNext(80)).toBe(206);
    expect(costToNext(98)).toBe(587);
  });
});

describe('levelFromXp', () => {
  it('starts every attribute at 40', () => {
    expect(levelFromXp(0)).toEqual({ rating: START_RATING, intoLevel: 0, toNext: 20 });
  });

  it('carries leftover XP into the next point', () => {
    // 40→41 costs 20, 41→42 costs 21
    expect(levelFromXp(30)).toEqual({ rating: 41, intoLevel: 10, toNext: 11 });
  });

  it('caps at 99 and reports nothing left to earn', () => {
    expect(levelFromXp(xpToMax())).toEqual({ rating: MAX_RATING, intoLevel: 0, toNext: 0 });
    expect(levelFromXp(1_000_000).rating).toBe(MAX_RATING);
  });

  it('reaching 99 takes roughly 10,000 XP', () => {
    expect(xpToMax()).toBeGreaterThan(9_500);
    expect(xpToMax()).toBeLessThan(10_500);
  });

  it('never gives a lower rating for more XP', () => {
    let previous = START_RATING;
    for (let xp = 0; xp <= 12_000; xp += 37) {
      const { rating } = levelFromXp(xp);
      expect(rating).toBeGreaterThanOrEqual(previous);
      previous = rating;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/progression/curve.test.ts`
Expected: FAIL with `Error: Cannot find module './curve'`

- [ ] **Step 3: Implement `src/core/progression/curve.ts`**

```ts
/** Spec §8b.1: every attribute starts at 40 and caps at 99. */
export const START_RATING = 40;
export const MAX_RATING = 99;

/** XP needed to go from rating r to r + 1. Each point costs 6% more than the last. */
export function costToNext(rating: number): number {
  return Math.round(20 * 1.06 ** (rating - START_RATING));
}

export interface Level {
  rating: number;
  /** XP already earned towards the next point (0 at the cap). */
  intoLevel: number;
  /** XP still needed for the next point (0 at the cap). */
  toNext: number;
}

/** Turn an attribute's lifetime XP into its rating. More XP never gives a lower rating. */
export function levelFromXp(totalXp: number): Level {
  let rating = START_RATING;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (rating < MAX_RATING && remaining >= costToNext(rating)) {
    remaining -= costToNext(rating);
    rating++;
  }
  if (rating === MAX_RATING) return { rating, intoLevel: 0, toNext: 0 };
  return { rating, intoLevel: remaining, toNext: costToNext(rating) - remaining };
}

/** Lifetime XP needed to reach the cap from the start (about 10,000). */
export function xpToMax(): number {
  let total = 0;
  for (let r = START_RATING; r < MAX_RATING; r++) total += costToNext(r);
  return total;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  97 passed (97)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/progression/curve.ts src/core/progression/curve.test.ts
git commit -m "feat(progression): 40-99 growth curve"
```

---

### Task 3: Form

**Files:**
- Create: `src/core/progression/form.ts`
- Test: `src/core/progression/form.test.ts`

**Interfaces:**
- Consumes: `addDays` (Plan 1 `time.ts`); `ATTRS`, `dayXp`, `ProgressDay` (Task 1); `makeGoodDay`, `makeProgressDay` (Task 1)
- Produces: `FormBand = 'settling'|'excellent'|'good'|'steady'|'dipping'|'rebuilding'`, `FORM_LABELS`, `Form = { band; label; ratio: number | null }`, `formOn(days, today): Form`

- [ ] **Step 1: Write the failing test `src/core/progression/form.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { formOn } from './form';
import type { ProgressDay } from './xp';

const TODAY = '2026-10-10';

/** 28 days ending today: the first 21 are "good days", the last 7 come from `recent`. */
function history(recent: (date: string) => ProgressDay): ProgressDay[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(TODAY, i - 27);
    return i < 21 ? makeGoodDay(date) : recent(date);
  });
}

describe('formOn', () => {
  it('is "Settling in" with under 14 days of history', () => {
    const days = Array.from({ length: 13 }, (_, i) => makeGoodDay(addDays(TODAY, -i)));
    expect(formOn(days, TODAY)).toEqual({ band: 'settling', label: 'Settling in', ratio: null });
  });

  it('is Steady when the last week matches the three before', () => {
    expect(formOn(history((d) => makeGoodDay(d)), TODAY)).toMatchObject({ band: 'steady', label: 'Steady', ratio: 1 });
  });

  it('rises to Excellent on a much bigger week', () => {
    const big = (d: string) => makeGoodDay(d, { footballMinutes: 240, trainingDone: 2 });
    expect(formOn(history(big), TODAY).band).toBe('excellent');
  });

  it('drops to Dipping, then Rebuilding, as the week thins out', () => {
    const lighter = (d: string) => makeGoodDay(d, { footballMinutes: 0, learnedEntry: false });
    expect(formOn(history(lighter), TODAY).band).toBe('dipping');
    const empty = (d: string) => makeProgressDay({ date: d });
    expect(formOn(history(empty), TODAY)).toMatchObject({ band: 'rebuilding', label: 'Rebuilding', ratio: 0 });
  });

  it('treats a comeback after a blank stretch as Excellent', () => {
    const days = [makeGoodDay(addDays(TODAY, -40)), makeGoodDay(TODAY)];
    expect(formOn(days, TODAY).band).toBe('excellent');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/progression/form.test.ts`
Expected: FAIL with `Error: Cannot find module './form'`

- [ ] **Step 3: Implement `src/core/progression/form.ts`**

```ts
import { addDays } from '../time';
import { ATTRS, dayXp, type ProgressDay } from './xp';

export type FormBand = 'settling' | 'excellent' | 'good' | 'steady' | 'dipping' | 'rebuilding';

export const FORM_LABELS: Record<FormBand, string> = {
  settling: 'Settling in',
  excellent: 'Excellent',
  good: 'Good',
  steady: 'Steady',
  dipping: 'Dipping',
  rebuilding: 'Rebuilding',
};

export interface Form {
  band: FormBand;
  label: string;
  /** Last 7 days' XP ÷ average 7-day XP of the 21 days before; null while settling. */
  ratio: number | null;
}

const sumXp = (day: ProgressDay) => {
  const xp = dayXp(day);
  return ATTRS.reduce((total, a) => total + xp[a], 0);
};

/** Spec §8b.2. `today` is the last day of the 7-day window. Unlogged days count as 0 XP. */
export function formOn(days: ProgressDay[], today: string): Form {
  const logged = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const first = logged[0];
  if (!first || first.date > addDays(today, -13)) return { band: 'settling', label: FORM_LABELS.settling, ratio: null };

  const recentStart = addDays(today, -6);
  const previousStart = addDays(today, -27);
  let recent = 0;
  let previous = 0;
  for (const d of logged) {
    if (d.date >= recentStart) recent += sumXp(d);
    else if (d.date >= previousStart) previous += sumXp(d);
  }

  const baseline = previous / 3;
  if (baseline === 0) {
    const band: FormBand = recent > 0 ? 'excellent' : 'rebuilding';
    return { band, label: FORM_LABELS[band], ratio: null };
  }
  const ratio = recent / baseline;
  const band: FormBand =
    ratio >= 1.3 ? 'excellent' : ratio >= 1.05 ? 'good' : ratio >= 0.85 ? 'steady' : ratio >= 0.6 ? 'dipping' : 'rebuilding';
  return { band, label: FORM_LABELS[band], ratio: Math.round(ratio * 100) / 100 };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  102 passed (102)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/progression/form.ts src/core/progression/form.test.ts
git commit -m "feat(progression): form rating over the last week"
```

---

### Task 4: Badges

**Files:**
- Create: `src/core/progression/badges.ts`
- Test: `src/core/progression/badges.test.ts`

**Interfaces:**
- Consumes: `ProgressDay` (Task 1); fixtures (Task 1); `addDays` (Plan 1)
- Produces: `Tier = 'bronze'|'silver'|'gold'|'hof'`, `TIERS`, `TIER_NAMES`, `BadgeDef`, `BADGES` (six, spec §8b.3), `BadgeProgress = { id; name; counts; count; tier: Tier | null; nextAt: number | null }`, `badgeProgress(days): BadgeProgress[]`

- [ ] **Step 1: Write the failing test `src/core/progression/badges.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { badgeProgress } from './badges';

const days = (n: number, overrides = {}) => Array.from({ length: n }, (_, i) => makeGoodDay(addDays('2026-09-01', i), overrides));
const find = (id: string, list: ReturnType<typeof badgeProgress>) => list.find((b) => b.id === id)!;

describe('badgeProgress', () => {
  it('starts with no tiers and shows the first target', () => {
    expect(find('workhorse', badgeProgress([]))).toMatchObject({ count: 0, tier: null, nextAt: 10 });
  });

  it('earns tiers from cumulative totals', () => {
    const list = badgeProgress(days(40));
    expect(find('workhorse', list)).toMatchObject({ count: 40, tier: 'silver', nextAt: 120 });
    expect(find('iron-sleeper', list)).toMatchObject({ tier: 'silver' });
    expect(find('anchor', list)).toMatchObject({ count: 120, tier: 'silver', nextAt: 300 });
    // 40 days × 90 min = 60 h
    expect(find('film-room', list)).toMatchObject({ count: 60, tier: 'silver', nextAt: 150 });
  });

  it('counts totals, not streaks: gaps between days change nothing', () => {
    const spaced = Array.from({ length: 10 }, (_, i) => makeGoodDay(addDays('2026-09-01', i * 3)));
    expect(find('clutch-returner', badgeProgress(spaced))).toMatchObject({ count: 10, tier: 'bronze' });
  });

  it('only counts evenings that include a reflection for Open Book', () => {
    const list = badgeProgress([
      makeProgressDay({ date: '2026-09-01', eveningCheckin: true, winOrLesson: true }),
      makeProgressDay({ date: '2026-09-02', eveningCheckin: true }),
      makeProgressDay({ date: '2026-09-03', gratitudeLines: 2 }),
    ]);
    expect(find('open-book', list).count).toBe(1);
  });

  it('stops at Hall of Fame', () => {
    expect(find('workhorse', badgeProgress(days(300)))).toMatchObject({ tier: 'hof', nextAt: null });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/progression/badges.test.ts`
Expected: FAIL with `Error: Cannot find module './badges'`

- [ ] **Step 3: Implement `src/core/progression/badges.ts`**

```ts
import type { ProgressDay } from './xp';

export type Tier = 'bronze' | 'silver' | 'gold' | 'hof';
export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'hof'];
export const TIER_NAMES: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', hof: 'Hall of Fame' };

export interface BadgeDef {
  id: string;
  name: string;
  /** What the badge counts, in plain words. */
  counts: string;
  /** Thresholds for bronze, silver, gold, Hall of Fame. */
  thresholds: [number, number, number, number];
  /** Cumulative count over all days. Totals only — never consecutive days. */
  count: (days: ProgressDay[]) => number;
}

const sum = (days: ProgressDay[], pick: (d: ProgressDay) => number) => days.reduce((t, d) => t + pick(d), 0);

/** Spec §8b.3. */
export const BADGES: BadgeDef[] = [
  { id: 'clutch-returner', name: 'Clutch Returner', counts: 'rests you came back from on time', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => d.restReturnsOnTime) },
  { id: 'iron-sleeper', name: 'Iron Sleeper', counts: 'nights of 7 hours or more', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => (d.sleepHours !== null && d.sleepHours >= 7 ? 1 : 0)) },
  { id: 'film-room', name: 'Film Room', counts: 'hours of football analytics', thresholds: [10, 50, 150, 400], count: (ds) => Math.floor(sum(ds, (d) => d.footballMinutes) / 60) },
  { id: 'anchor', name: 'Anchor', counts: 'anchors kept', thresholds: [25, 100, 300, 800], count: (ds) => sum(ds, (d) => d.anchorsKept) },
  { id: 'workhorse', name: 'Workhorse', counts: 'training sessions done', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => d.trainingDone) },
  { id: 'open-book', name: 'Open Book', counts: 'evenings with a reflection', thresholds: [10, 40, 120, 300], count: (ds) => sum(ds, (d) => (d.eveningCheckin && (d.winOrLesson || d.gratitudeLines > 0) ? 1 : 0)) },
];

export interface BadgeProgress {
  id: string;
  name: string;
  counts: string;
  count: number;
  /** Highest tier earned, or null. */
  tier: Tier | null;
  /** Count needed for the next tier, or null once Hall of Fame is earned. */
  nextAt: number | null;
}

export function badgeProgress(days: ProgressDay[]): BadgeProgress[] {
  return BADGES.map((b) => {
    const count = b.count(days);
    const earned = b.thresholds.filter((t) => count >= t).length;
    return {
      id: b.id,
      name: b.name,
      counts: b.counts,
      count,
      tier: earned === 0 ? null : TIERS[earned - 1]!,
      nextAt: earned === TIERS.length ? null : b.thresholds[earned]!,
    };
  });
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test` → Expected: PASS, `Tests  107 passed (107)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/progression/badges.ts src/core/progression/badges.test.ts
git commit -m "feat(progression): tiered badges from cumulative totals"
```

---

### Task 5: Player card, career changes, final verification

**Files:**
- Create: `src/core/progression/card.ts`
- Test: `src/core/progression/card.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4; `GuardState` (Plan 1)
- Produces: `CardTag = 'Out of form'|'Fatigued'|'Injury risk'`, `PlayerCard = { attributes: Record<Attr, Level & {xp}>; ovr; form; tag; badges }`, `playerCard(days, today): PlayerCard`, `CareerChanges = { attributeUps; ovr; newTiers }`, `careerChanges(before, after): CareerChanges`

- [ ] **Step 1: Write the failing test `src/core/progression/card.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { careerChanges, playerCard } from './card';
import { ATTRS } from './xp';

const START = '2026-09-01';
const run = (n: number) => Array.from({ length: n }, (_, i) => makeGoodDay(addDays(START, i)));

describe('playerCard', () => {
  it('is a rookie card before anything is logged', () => {
    const card = playerCard([], START);
    expect(card.ovr).toBe(40);
    for (const a of ATTRS) expect(card.attributes[a]).toMatchObject({ rating: 40, xp: 0 });
    expect(card.form.band).toBe('settling');
    expect(card.tag).toBeNull();
  });

  it('grows attributes from logged days and averages them into OVR', () => {
    const card = playerCard(run(30), addDays(START, 29));
    // 30 good days: ANL earns 105/day = 3150 XP, the most of any attribute
    expect(card.attributes.ANL.xp).toBe(3150);
    expect(card.attributes.ANL.rating).toBeGreaterThan(card.attributes.CHR.rating);
    const mean = ATTRS.reduce((t, a) => t + card.attributes[a].rating, 0) / ATTRS.length;
    expect(card.ovr).toBe(Math.round(mean));
  });

  it("shows today's guard state as a card tag", () => {
    const tagFor = (state: 'ready' | 'drifting' | 'depleted' | 'grinding') =>
      playerCard([makeProgressDay({ date: START, state })], START).tag;
    expect(tagFor('ready')).toBeNull();
    expect(tagFor('drifting')).toBe('Out of form');
    expect(tagFor('depleted')).toBe('Fatigued');
    expect(tagFor('grinding')).toBe('Injury risk');
  });

  it('ignores days after `today`', () => {
    const days = run(10);
    expect(playerCard(days, addDays(START, 4))).toEqual(playerCard(days.slice(0, 5), addDays(START, 4)));
  });

  it('never lowers an attribute when more days are logged, even empty or depleted ones', () => {
    const base = run(20);
    const before = playerCard(base, addDays(START, 19));
    const more = [
      ...base,
      makeProgressDay({ date: addDays(START, 20) }),
      makeGoodDay(addDays(START, 21), { state: 'depleted' }),
      makeGoodDay(addDays(START, 22), { state: 'grinding' }),
    ];
    const after = playerCard(more, addDays(START, 22));
    for (const a of ATTRS) expect(after.attributes[a].rating).toBeGreaterThanOrEqual(before.attributes[a].rating);
  });
});

describe('careerChanges', () => {
  it('lists attribute level-ups, the OVR change and new badge tiers', () => {
    const before = playerCard(run(9), addDays(START, 8));
    const after = playerCard(run(10), addDays(START, 9));
    const changes = careerChanges(before, after);
    // the 10th training session unlocks Workhorse bronze
    expect(changes.newTiers).toContainEqual({ id: 'workhorse', name: 'Workhorse', tier: 'bronze' });
    for (const up of changes.attributeUps) expect(up.to).toBeGreaterThan(up.from);
  });

  it('reports nothing when nothing changed', () => {
    const card = playerCard(run(5), addDays(START, 4));
    expect(careerChanges(card, card)).toEqual({ attributeUps: [], ovr: null, newTiers: [] });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/core/progression/card.test.ts`
Expected: FAIL with `Error: Cannot find module './card'`

- [ ] **Step 3: Implement `src/core/progression/card.ts`**

```ts
import type { GuardState } from '../types';
import { type BadgeProgress, badgeProgress, TIERS, type Tier } from './badges';
import { type Level, levelFromXp } from './curve';
import { type Form, formOn } from './form';
import { type Attr, ATTRS, type ProgressDay, totalXp } from './xp';

export type CardTag = 'Out of form' | 'Fatigued' | 'Injury risk';

const TAGS: Record<GuardState, CardTag | null> = {
  ready: null,
  drifting: 'Out of form',
  depleted: 'Fatigued',
  grinding: 'Injury risk',
};

export interface PlayerCard {
  attributes: Record<Attr, Level & { xp: number }>;
  ovr: number;
  form: Form;
  /** From today's guard state; null when ready or when today isn't logged. */
  tag: CardTag | null;
  badges: BadgeProgress[];
}

/** Spec §8b: the whole player card, recomputed from history. */
export function playerCard(days: ProgressDay[], today: string): PlayerCard {
  const upToToday = days.filter((d) => d.date <= today);
  const xp = totalXp(upToToday);
  const attributes = Object.fromEntries(ATTRS.map((a) => [a, { ...levelFromXp(xp[a]), xp: xp[a] }])) as PlayerCard['attributes'];
  const ovr = Math.round(ATTRS.reduce((t, a) => t + attributes[a].rating, 0) / ATTRS.length);
  const todayDay = upToToday.find((d) => d.date === today);
  return {
    attributes,
    ovr,
    form: formOn(upToToday, today),
    tag: todayDay ? TAGS[todayDay.state] : null,
    badges: badgeProgress(upToToday),
  };
}

export interface CareerChanges {
  attributeUps: { attr: Attr; from: number; to: number }[];
  ovr: { from: number; to: number } | null;
  /** New badge tiers: each one gets one short celebration (spec §8b.4). */
  newTiers: { id: string; name: string; tier: Tier }[];
}

/** What changed between two cards: for level-up moments and the weekly development report. */
export function careerChanges(before: PlayerCard, after: PlayerCard): CareerChanges {
  const attributeUps = ATTRS.filter((a) => after.attributes[a].rating > before.attributes[a].rating).map((a) => ({
    attr: a,
    from: before.attributes[a].rating,
    to: after.attributes[a].rating,
  }));
  const rank = (t: Tier | null) => (t === null ? -1 : TIERS.indexOf(t));
  const newTiers = after.badges
    .filter((b) => rank(b.tier) > rank(before.badges.find((x) => x.id === b.id)?.tier ?? null))
    .map((b) => ({ id: b.id, name: b.name, tier: b.tier! }));
  return {
    attributeUps,
    ovr: after.ovr > before.ovr ? { from: before.ovr, to: after.ovr } : null,
    newTiers,
  };
}
```

- [ ] **Step 4: Full verification**

Run: `npm test` → Expected: PASS, `Test Files  19 passed (19)` and `Tests  114 passed (114)`
Run: `npm run typecheck` → Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add src/core/progression/card.ts src/core/progression/card.test.ts
git commit -m "feat(progression): player card and career changes"
```

- [ ] **Step 6: Update the portfolio knowledge graph**

From `D:\CT's Portfolio`, run `graphify update .` (project CLAUDE.md rule).

---

## Done when

- All 5 tasks are committed; `npm test` shows 114 passing tests across 19 files; typecheck is clean.
- Next: Plan 2 (visual design) is redone in the career-mode direction, and the player card joins the Today and History screens.
