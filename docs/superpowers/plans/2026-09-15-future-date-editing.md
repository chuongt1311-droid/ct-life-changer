# Future-Date Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CT open any of the next 14 days, see a real or generated-preview plan for it, edit it with the same move/resize/drop/add vocabulary Today already has, and save it as a sticking override.

**Architecture:** A new `src/lib/planner/planAhead.ts` composes the existing `buildDay`/`assess` generation pipeline (already used by `ensureTodayPlan`) with the existing `applyEdits`/`validateEdits` edit pipeline (already used by `reflowDay.ts`, sub-project A) over an arbitrary date instead of always today. `EditableDay` — the UI sub-project A already built — gains a `date` prop and two injectable preview/confirm callables (defaulting to Today's own actions, so Today's page needs no behavior change beyond passing its date). A new `/plan-ahead` route (list + detail, following the existing `/templates` route's shape) wires the new lib functions to that same component.

**Tech Stack:** Next.js Server Actions, TypeScript, Vitest, Playwright — same stack as sub-project A, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-15-future-date-editing-design.md`

## Global Constraints

- `pinned` via `LayoutInput.pinned`, never `anchor: true` — unchanged from sub-project A, `applyEdits` already enforces this.
- A hand-drop is `status: 'skipped'`, never `'dropped'` — unchanged, `applyEdits` already enforces this.
- Core functions (`src/core/**`) return values for user-input errors, never throw; I/O layers (`src/lib/**`) may throw on auth/missing-row per existing house style.
- No shame language, no streaks, write "CT"/"they" in any user-facing copy this plan adds.
- "Next 14 days" means calendar days 2–15 after today's `planDate` inclusive (today = day 0, tomorrow = day 1, both excluded — those are Today's and Day-changed's screens).
- Once a future date's plan is saved via this feature it sticks as-is; nothing in this plan re-checks it against the guard's state as that date arrives.
- Run `npm test` and `npm run typecheck` before any task is considered done.

---

### Task 1: `previewFuturePlan` — load or generate a preview

**Files:**
- Create: `src/lib/planner/planAhead.ts`
- Modify: `src/lib/planner/reflowDay.ts:11` and `:20` — add `export` to `rowToBlock` and `blockToRow` (no behavior change; `planAhead.ts` needs `rowToBlock`, and duplicating it would violate DRY)
- Test: `src/lib/planner/planAhead.test.ts`

**Interfaces:**
- Consumes: `buildDay(template, date, settings, adjustments)` from `@/core/planner/buildDay` (returns `{ plan, conflicts }`); `assess(days, settings)` from `@/core/guard/assess` (returns `{ state, flags, adjustments }`); `getDaySummaries(client, fromDate, toDate)` from `@/lib/db/daySummary`; `addDays`, `weekdayOf`, `planClock`, `toPlanMinute` from `@/core/time`; `settingsToDomain` from `@/lib/db/settingsMapping`; `repositories` from `@/lib/db/repositories`; `rowToBlock` (now exported) from `./reflowDay`.
- Produces: `previewFuturePlan(client: RepositoryClient, date: string, now: Date): Promise<FuturePlanPreview>` where
  ```ts
  export interface FuturePlanPreview {
    plan: DayPlan;
    source: 'existing' | 'generated';
    state: GuardState;
    flags: Flag[];
    adjustments: Adjustment[];
  }
  ```
  Task 2 and the server actions in Task 4 consume this exact shape.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/planner/planAhead.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { previewFuturePlan } from './planAhead';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

describe('previewFuturePlan', () => {
  it('loads the real plan when one already exists for that date', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      plans: [{ date: '2026-09-22', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false }],
      blocks: [
        { id: 'gym', owner_id: 'ct', date: '2026-09-22', title: 'Gym', kind: 'training', anchor: false, priority: 3,
          start: 600, end: 660, min_minutes: 60, window_start: null, window_end: null, tags: [], checklist: [],
          recovery_variant: null, status: 'planned', source: 'template' },
      ],
    });
    const result = await previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'));
    expect(result.source).toBe('existing');
    expect(result.plan.blocks).toHaveLength(1);
    expect(result.plan.blocks[0]!.title).toBe('Gym');
  });

  it('generates a preview from the weekday template when no plan exists yet', async () => {
    // 2026-09-22 is a Tuesday (weekday 2).
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{
        weekday: 2, owner_id: 'ct', rest_day: false,
        blocks: [{ key: 'deep', title: 'Deep work', kind: 'task', anchor: true, priority: 5, start: '09:00', durationMin: 120 }],
      }],
    });
    const result = await previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'));
    expect(result.source).toBe('generated');
    expect(result.plan.blocks).toHaveLength(1);
    expect(result.plan.blocks[0]!.title).toBe('Deep work');
    expect(result.state).toBe('ready');
  });

  it('throws when the weekday has no template and no plan exists', async () => {
    const client = fakeClient({ settings: [settingsRow] });
    await expect(previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'))).rejects.toThrow(/no template/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/planner/planAhead.test.ts`
Expected: FAIL — `Cannot find module './planAhead'`

- [ ] **Step 3: Write the implementation**

First, in `src/lib/planner/reflowDay.ts`, change:
```ts
function rowToBlock(row: BlockRow): Block {
```
to:
```ts
export function rowToBlock(row: BlockRow): Block {
```
and:
```ts
function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
```
to:
```ts
export function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
```

Then create `src/lib/planner/planAhead.ts`:

```ts
import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays, planClock, toPlanMinute, weekdayOf } from '@/core/time';
import type { Adjustment, DayPlan, DayTemplate, Flag, GuardState } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { rowToBlock } from './reflowDay';

export interface FuturePlanPreview {
  plan: DayPlan;
  /** 'existing' when a real plans row is already there (e.g. tomorrow,
   *  generated by tonight's evening check-in, or an earlier Plan-ahead
   *  save); 'generated' when this call built it on the spot from the
   *  weekday template — the one honest difference the UI must show CT
   *  before they edit it. */
  source: 'existing' | 'generated';
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
}

/** Spec B: a future date has no plan row until either the real overnight
 * generation reaches it or CT saves one through this page first. Loads the
 * real plan when one exists; otherwise builds an on-the-spot preview from
 * the weekday template using the same guard/adjustment pipeline
 * `ensureTodayPlan` uses for real generation. Writes nothing either way —
 * same contract as `previewEdits` in reflowDay.ts.
 *
 * The guard assessment always runs against CT's most recent real history
 * (`now`, i.e. today) rather than history "as of" the future `date` — a
 * date more than a few days out mostly or entirely has no history of its
 * own yet. This is a best-effort preview, not a prophecy: the same
 * approximation `ensureTodayPlan` and `generateTomorrowPlan` already make
 * one day at a time, just extended a few days further out. */
export async function previewFuturePlan(client: RepositoryClient, date: string, now: Date): Promise<FuturePlanPreview> {
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  if (!settingsRow) throw new Error('No settings row yet — onboarding must run first.');
  const settings = settingsToDomain(settingsRow);

  const existingPlan = await repos.plans.get(date, 'date');
  if (existingPlan) {
    const blockRows = await repos.blocks.list({ date } as never);
    const plan: DayPlan = {
      date,
      wake: toPlanMinute(settings.wakeTime),
      bedtime: toPlanMinute(settings.bedtime),
      blocks: blockRows.map(rowToBlock),
    };
    return {
      plan,
      source: 'existing',
      state: existingPlan.state,
      flags: existingPlan.flags as Flag[],
      adjustments: existingPlan.adjustments as Adjustment[],
    };
  }

  const templateRow = await repos.templates.get(weekdayOf(date));
  if (!templateRow) throw new Error(`No template for weekday ${weekdayOf(date)} — nothing to preview yet.`);
  const template: DayTemplate = { weekday: templateRow.weekday, restDay: templateRow.rest_day, blocks: templateRow.blocks };

  const { planDate: todayDate } = planClock(now, settings.timezone);
  const history = await getDaySummaries(client, addDays(todayDate, -7), addDays(todayDate, -1));
  const assessment = assess(history, settings);
  const { plan } = buildDay(template, date, settings, assessment.adjustments);

  return { plan, source: 'generated', state: assessment.state, flags: assessment.flags, adjustments: assessment.adjustments };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/planner/planAhead.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full unit suite to check for regressions**

Run: `npm test`
Expected: all suites pass, including `src/lib/planner/reflowDay.test.ts` (unaffected by the `export` additions)

- [ ] **Step 6: Commit**

```bash
git add src/lib/planner/planAhead.ts src/lib/planner/planAhead.test.ts src/lib/planner/reflowDay.ts
git commit -m "feat(planner): preview a future date, real or generated"
```

---

### Task 2: `previewFutureEdits` and `confirmFuturePlan`

**Files:**
- Modify: `src/lib/planner/planAhead.ts` (append)
- Test: `src/lib/planner/planAhead.test.ts` (append)

**Interfaces:**
- Consumes: `previewFuturePlan` (Task 1); `validateEdits`, `applyEdits`, `PlanEdit` from `@/core/planner/edits`; `DiffEntry` from `@/core/planner/diff`; `blockToRow` (now exported) from `./reflowDay`.
- Produces:
  ```ts
  export interface FutureEditsResult {
    plan: DayPlan;
    diff: DiffEntry[];
    conflicts: [string, string][];
    errors: string[];
    state: GuardState;
    flags: Flag[];
    adjustments: Adjustment[];
  }
  export async function previewFutureEdits(client: RepositoryClient, date: string, edits: PlanEdit[], now: Date): Promise<FutureEditsResult>;
  export async function confirmFuturePlan(
    client: RepositoryClient,
    ownerId: string,
    date: string,
    plan: DayPlan,
    meta: { state: GuardState; flags: Flag[]; adjustments: Adjustment[] },
  ): Promise<void>;
  ```
  Task 4's server actions call both directly.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/lib/planner/planAhead.test.ts
import { previewFutureEdits, confirmFuturePlan } from './planAhead';

describe('previewFutureEdits', () => {
  it('edits a generated preview and reports the diff, writing nothing', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{
        weekday: 2, owner_id: 'ct', rest_day: false,
        blocks: [{ key: 'deep', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: '09:00', durationMin: 60 }],
      }],
    });
    const result = await previewFutureEdits(client, '2026-09-22', [{ type: 'resize', blockId: '2026-09-22:deep', durationMin: 90 }], new Date('2026-09-15T12:00:00Z'));
    expect(result.errors).toEqual([]);
    expect(result.plan.blocks[0]!.end - result.plan.blocks[0]!.start).toBe(90);
    expect(client.tables.plans ?? []).toHaveLength(0); // nothing persisted
  });

  it('does not reject an edit for being "in the past" — the whole date is in the future', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{
        weekday: 2, owner_id: 'ct', rest_day: false,
        blocks: [{ key: 'deep', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: '09:00', durationMin: 60 }],
      }],
    });
    // toStart: 60 (1am) would fail Today's "can't move into the past" check
    // if `now` (a real minute-of-day, e.g. noon) were used here.
    const result = await previewFutureEdits(client, '2026-09-22', [{ type: 'move', blockId: '2026-09-22:deep', toStart: 60 }], new Date('2026-09-15T12:00:00Z'));
    expect(result.errors).toEqual([]);
  });
});

describe('confirmFuturePlan', () => {
  it('persists blocks and marks the plan overridden', async () => {
    const client = fakeClient({ settings: [settingsRow] });
    const plan = { date: '2026-09-22', wake: 420, bedtime: 1380, blocks: [
      { id: 'deep', title: 'Deep work', kind: 'task' as const, anchor: false, priority: 3 as const, start: 540, end: 630,
        minMinutes: 60, window: null, tags: [], checklist: [], recoveryVariant: null, status: 'planned' as const, source: 'template' as const },
    ] };
    await confirmFuturePlan(client, 'ct', '2026-09-22', plan, { state: 'ready', flags: [], adjustments: [] });
    const savedPlan = client.tables.plans!.find((p) => p.date === '2026-09-22')!;
    expect(savedPlan.overridden).toBe(true);
    expect(client.tables.blocks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/planner/planAhead.test.ts`
Expected: FAIL — `previewFutureEdits`/`confirmFuturePlan` not exported

- [ ] **Step 3: Write the implementation**

Append to `src/lib/planner/planAhead.ts`:

```ts
import { applyEdits, validateEdits, type PlanEdit } from '@/core/planner/edits';
import type { DiffEntry } from '@/core/planner/diff';
import { blockToRow } from './reflowDay';

export interface FutureEditsResult {
  plan: DayPlan;
  diff: DiffEntry[];
  conflicts: [string, string][];
  errors: string[];
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
}

/** Composes `previewFuturePlan` with the same validate → applyEdits
 * sequence `previewEdits` (reflowDay.ts) already runs for today — just over
 * a base plan that might not be persisted yet.
 *
 * `now` is passed to `validateEdits`/`applyEdits` as `0`, not a real
 * minute-of-day: every minute on a date that hasn't happened yet is still
 * ahead of it, so the "can't move into the past" checks (which compare an
 * edit's target minute against `now`) must never reject anything here.
 * Only Today's own edits (sub-project A) have a real past to guard
 * against — `now: Date` here is only used to find CT's most recent history
 * for the guard assessment, exactly as in `previewFuturePlan`. */
export async function previewFutureEdits(client: RepositoryClient, date: string, edits: PlanEdit[], now: Date): Promise<FutureEditsResult> {
  const preview = await previewFuturePlan(client, date, now);
  const errors = validateEdits(preview.plan, 0, edits);
  if (errors.length > 0) return { plan: preview.plan, diff: [], conflicts: [], errors, state: preview.state, flags: preview.flags, adjustments: preview.adjustments };
  const result = applyEdits(preview.plan, 0, edits);
  return { plan: result.plan, diff: result.diff, conflicts: result.conflicts, errors: [], state: preview.state, flags: preview.flags, adjustments: preview.adjustments };
}

/** Persists `plan.blocks` and, unlike `confirmReflow` (which only ever
 * touches an already-existing day's blocks), also upserts the `plans` row
 * itself — a future date reached through this path may have no plan row
 * yet. `overridden: true` gives this row the same meaning
 * `reassembleContext.ts` already reads elsewhere ("CT overrode them"), and
 * because `ensureTodayPlan`/`generateTomorrowPlan` both skip generation
 * once a plan row exists for a date, this row alone is what keeps the
 * saved override from being silently regenerated away later.
 *
 * `meta` is threaded through from whatever `previewFuturePlan`/
 * `previewFutureEdits` already computed rather than recomputed here — a
 * fresh guard assessment right at confirm time could, in principle,
 * disagree with the one CT actually reviewed a moment earlier. */
export async function confirmFuturePlan(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  plan: DayPlan,
  meta: { state: GuardState; flags: Flag[]; adjustments: Adjustment[] },
): Promise<void> {
  const repos = repositories(client);
  await repos.plans.upsert({ date, owner_id: ownerId, state: meta.state, flags: meta.flags, adjustments: meta.adjustments, overridden: true });
  await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, date, ownerId))));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/planner/planAhead.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/planner/planAhead.ts src/lib/planner/planAhead.test.ts
git commit -m "feat(planner): edit and confirm a future date's plan"
```

---

### Task 3: Generalize `EditableDay` by date, keep Today unchanged

**Files:**
- Modify: `src/components/today/EditableDay.tsx` (full rewrite — the change touches the type signature, `Review` state, and both `openReview`/`take`)
- Modify: `src/app/page.tsx:100-115` (pass the new `date` prop)

**Interfaces:**
- Consumes: `previewEditsAction`, `confirmEditsAction` from `@/app/day-changed/actions` (unchanged signatures); `GuardState`, `Flag`, `Adjustment`, `Block` from `@/core/types`.
- Produces: `EditableDay({ date, blocks, nowMinute, actions, previewAction?, confirmAction? })` — Task 5 passes `previewAction`/`confirmAction` bound to the new plan-ahead actions; Today (`page.tsx`) passes neither and gets the exact same behavior as before, just with an explicit `date`.

- [ ] **Step 1: Write the failing check**

This is a UI component with no colocated unit test in this codebase (sub-project A's original `EditableDay` had none either — it's verified through the app's e2e suite and a manual gold-button/visual check). The "failing test" here is the typecheck itself: add the `date` prop to `page.tsx` first, which will fail to compile against the *old* `EditableDay` signature (no `date` prop declared), proving the change is necessary before it exists.

In `src/app/page.tsx`, change:
```tsx
          <EditableDay
            blocks={sorted.map(blockRowToCore)}
            nowMinute={minute}
```
to:
```tsx
          <EditableDay
            date={planDate}
            blocks={sorted.map(blockRowToCore)}
            nowMinute={minute}
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — `Property 'date' does not exist on type '{ blocks: Block[]; nowMinute: number; actions: ReactNode; }'`

- [ ] **Step 3: Rewrite `EditableDay.tsx`**

```tsx
'use client';

import { type ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Adjustment, Block, Flag, GuardState } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import type { DiffEntry } from '@/core/planner/diff';
import { formatPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { Tag } from '@/components/ui/Tag';
import { DiffList } from '@/components/planner/DiffList';
import { EditBlockSheet } from './EditBlockSheet';
import { confirmEditsAction, previewEditsAction } from '@/app/day-changed/actions';

const RANK: Record<string, 'done' | 'now' | 'next'> = {
  done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done',
  active: 'now', planned: 'next',
};
const TAG_LABEL: Record<string, string> = {
  done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed',
  dropped: 'Dropped', active: 'Now', planned: 'Next',
};

/** What confirming needs beyond the edited blocks — only ever populated when
 * `previewAction` is the future-date one (Task 4/5); Today's own
 * `previewEditsAction` never returns it, so `take()` passes `undefined`
 * straight through to `confirmEditsAction`, which ignores a 3rd argument it
 * never declared. */
type ConfirmMeta = { state: GuardState; flags: Flag[]; adjustments: Adjustment[] };
type Review = { date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; meta?: ConfirmMeta };

type PreviewFn = (date: string, edits: PlanEdit[]) => Promise<{
  date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[];
  state?: GuardState; flags?: Flag[]; adjustments?: Adjustment[];
}>;
type ConfirmFn = (date: string, blocks: Block[], meta?: ConfirmMeta) => Promise<void>;

const editTarget = (e: PlanEdit): string | null =>
  e.type === 'move' || e.type === 'resize' || e.type === 'drop' ? e.blockId : null;

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** A day's session list, made editable — Today's own day (sub-project A) by
 * default, or any date Task 5's Plan-ahead detail page passes in via
 * `previewAction`/`confirmAction`. Tapping an open row opens
 * `EditBlockSheet`; edits stack as client-only state until "Review changes"
 * turns them into one diff, and the confirm button persists. Nothing is
 * written until that last step.
 *
 * `actions` is the page's own thumb-bar content (Start rest / Day changed
 * on Today; a plain Save button on Plan-ahead): while edits are pending
 * this component's own "Review changes" takes the screen's one gold action
 * instead, and the passed-in bar is shown otherwise. */
export function EditableDay({
  date,
  blocks,
  nowMinute,
  actions,
  previewAction,
  confirmAction,
}: {
  date: string;
  blocks: Block[];
  nowMinute: number;
  actions: ReactNode;
  previewAction?: PreviewFn;
  confirmAction?: ConfirmFn;
}) {
  const router = useRouter();
  const preview = previewAction ?? ((_date: string, edits: PlanEdit[]) => previewEditsAction(edits));
  const confirm = confirmAction ?? confirmEditsAction;
  const [edits, setEdits] = useState<PlanEdit[]>([]);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined); // undefined = closed, null = adding
  const [review, setReview] = useState<Review | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pendingIds = new Set(edits.map(editTarget).filter((id): id is string => id !== null));

  async function openReview() {
    setBusy(true);
    const result = await preview(date, edits);
    setBusy(false);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const meta = result.state !== undefined && result.flags !== undefined && result.adjustments !== undefined
      ? { state: result.state, flags: result.flags, adjustments: result.adjustments }
      : undefined;
    setReview({ date: result.date, blocks: result.blocks, diff: result.diff, conflicts: result.conflicts, meta });
  }

  async function take() {
    if (!review) return;
    setBusy(true);
    // confirmEditsAction (Today's default) persists without redirecting —
    // Today is already at '/', and confirmReflowAction's redirect('/')
    // (fine for Day-changed, a real cross-route confirm) throws Next's
    // NEXT_REDIRECT sentinel as a terminal operation: any code after it in
    // the same call never runs, by design. router.refresh() plus resetting
    // this component's own local state is what gets the screen back to the
    // fresh list — Plan-ahead's confirm action follows the same pattern.
    await confirm(review.date, review.blocks, review.meta);
    router.refresh();
    setReview(null);
    setEdits([]);
  }

  if (editing !== undefined) {
    return (
      <EditBlockSheet
        block={editing}
        nowMinute={nowMinute}
        onApply={(edit) => setEdits((list) => [...list, edit])}
        onClose={() => setEditing(undefined)}
      />
    );
  }

  if (review) {
    return (
      <div className="stepback">
        <Placard>What changed</Placard>
        {review.conflicts.length > 0 && (
          <p className="note" role="alert">
            {review.conflicts.map(([a, b]) => `"${a}" and "${b}" overlap.`).join(' ')} You can still take the day.
          </p>
        )}
        <DiffList entries={review.diff} />
        <div className="thumb">
          <button className="btn btn-main" onClick={take} disabled={busy}>
            {busy ? 'Saving…' : 'Take the new day'}
          </button>
          <button className="btn btn-quiet" onClick={() => setReview(null)} disabled={busy}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Placard>The rest of today</Placard>
      <ul className="sessions">
        {blocks.map((b) => (
          <li key={b.id} data-rank={RANK[b.status] ?? 'next'} data-pending={pendingIds.has(b.id) ? 'true' : undefined}>
            {isOpen(b) ? (
              <button className="row-edit" onClick={() => setEditing(b)} aria-label={`Change ${b.title}`}>
                <span className="at">{formatPlanMinute(b.start)}</span>
                <span className="what">
                  {b.title}
                  <small>{b.anchor ? 'Anchor' : b.kind}</small>
                </span>
                <Tag state="neutral">{TAG_LABEL[b.status] ?? b.status}</Tag>
              </button>
            ) : (
              <>
                <span className="at">{formatPlanMinute(b.start)}</span>
                <span className="what">
                  {b.title}
                  <small>{b.anchor ? 'Anchor' : b.kind}</small>
                </span>
                <Tag state="neutral">{TAG_LABEL[b.status] ?? b.status}</Tag>
              </>
            )}
          </li>
        ))}
      </ul>

      <button className="btn btn-quiet" onClick={() => setEditing(null)}>
        Add something
      </button>

      {errors.length > 0 && (
        <ul className="empty" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {edits.length > 0 && (
        <p className="pending-strip">
          <span>
            {edits.length} {edits.length === 1 ? 'change' : 'changes'} pending
          </span>
          <button className="btn btn-quiet" onClick={() => setEdits([])}>
            Discard
          </button>
        </p>
      )}

      {edits.length > 0 ? (
        <div className="thumb stacked">
          <button className="btn btn-main btn-wide" onClick={openReview} disabled={busy}>
            {busy ? 'Working…' : 'Review changes'}
          </button>
        </div>
      ) : (
        actions
      )}
    </>
  );
}
```

Note the "The rest of today" placard text is unchanged here — Task 5 wires a different placard for Plan-ahead's own use by passing a distinct wrapper, not by parameterizing this string (see Task 5).

- [ ] **Step 4: Run typecheck and the full unit suite**

Run: `npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 5: Run the existing e2e regression for Today's own editing**

Run: `npx playwright test e2e/edit-day.spec.ts`
Expected: PASS — proves the default-args path (Today, unchanged behavior) still works end to end

- [ ] **Step 6: Commit**

```bash
git add src/components/today/EditableDay.tsx src/app/page.tsx
git commit -m "refactor(today): let EditableDay's date and actions be overridden"
```

---

### Task 4: `/plan-ahead` list page and its server actions

**Files:**
- Create: `src/app/plan-ahead/actions.ts`
- Create: `src/app/plan-ahead/page.tsx`

**Interfaces:**
- Consumes: `previewFuturePlan` (Task 1); `isOwner` from `@/lib/auth/isOwner`; `createServerSupabase` from `@/lib/supabase/server`; `repositories` from `@/lib/db/repositories`; `settingsToDomain` from `@/lib/db/settingsMapping`; `addDays`, `planClock` from `@/core/time`; `Placard` from `@/components/ui/Placard`.
- Produces: the route `/plan-ahead`, and `dateHasPlan(client, date): Promise<boolean>` (a thin re-export of "does `repos.plans.get(date, 'date')` return non-null", used by the list page to label each row) — no new server action needed beyond what Task 5 adds, since the list page itself only reads.

- [ ] **Step 1: Write the page** (no unit test — a server component reading two repositories and rendering a list; verified by the e2e in Task 6, matching how `/templates/page.tsx` itself has no unit test)

`src/app/plan-ahead/page.tsx`:

```tsx
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { Placard } from '@/components/ui/Placard';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function PlanAheadPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  // Days 2–15 out — today and tomorrow are Today's and Day-changed's screens.
  const dates = Array.from({ length: 14 }, (_, i) => addDays(planDate, i + 2));
  const plans = await repos.plans.list();
  const plannedDates = new Set(plans.map((p) => p.date));

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Plan ahead
        </p>
      </header>
      <Placard>The next 14 days</Placard>
      <ul className="sessions plain">
        {dates.map((date) => {
          const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
          return (
            <li key={date} data-rank="next">
              <span className="what">
                {WEEKDAY_NAMES[weekday]}
                <small>{plannedDates.has(date) ? 'Planned' : 'From template'}</small>
              </span>
              <Link className="btn btn-quiet" href={`/plan-ahead/${date}`}>
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the `[date]` route it links to doesn't exist yet — Task 5 — but `Link` doesn't require the target route to exist at compile time in this project's setup, matching how `/templates` links work today)

- [ ] **Step 3: Commit**

```bash
git add src/app/plan-ahead/page.tsx
git commit -m "feat(plan-ahead): list the next 14 days"
```

---

### Task 5: `/plan-ahead/[date]` detail page

**Files:**
- Create: `src/app/plan-ahead/[date]/actions.ts`
- Create: `src/app/plan-ahead/[date]/page.tsx`
- Create: `src/app/plan-ahead/[date]/PlanAheadDay.tsx`

**Interfaces:**
- Consumes: `previewFuturePlan`, `previewFutureEdits`, `confirmFuturePlan` (Tasks 1–2); `EditableDay` (Task 3, with `previewAction`/`confirmAction` supplied); `addDays`, `planClock` from `@/core/time`.
- Produces: the route `/plan-ahead/[date]`.

- [ ] **Step 1: Write the server actions**

`src/app/plan-ahead/[date]/actions.ts`:

```ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { previewFutureEdits, confirmFuturePlan } from '@/lib/planner/planAhead';
import type { PlanEdit } from '@/core/planner/edits';
import type { Adjustment, Block, Flag, GuardState } from '@/core/types';
import type { DiffEntry } from '@/core/planner/diff';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

/** Matches `EditableDay`'s `PreviewFn` shape exactly (`(date, edits) => ...`)
 * so it can be passed straight through as its `previewAction` prop. */
export async function previewPlanAheadAction(
  date: string,
  edits: PlanEdit[],
): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[]; state: GuardState; flags: Flag[]; adjustments: Adjustment[] }> {
  const { client } = await authedClient();
  const result = await previewFutureEdits(client, date, edits, new Date());
  return { date, blocks: result.plan.blocks, diff: result.diff, conflicts: result.conflicts, errors: result.errors, state: result.state, flags: result.flags, adjustments: result.adjustments };
}

/** Matches `EditableDay`'s `ConfirmFn` shape exactly
 * (`(date, blocks, meta?) => Promise<void>`). `meta` is required in
 * practice — `previewPlanAheadAction` above always returns it, and
 * `EditableDay` always threads it straight through — the optional `?`
 * exists only so this function's type is assignable to `EditableDay`'s
 * shared prop type, which Today's simpler default must also satisfy. */
export async function confirmPlanAheadAction(
  date: string,
  blocks: Block[],
  meta?: { state: GuardState; flags: Flag[]; adjustments: Adjustment[] },
): Promise<void> {
  if (!meta) throw new Error('confirmPlanAheadAction requires guard-state metadata from previewPlanAheadAction');
  const { client, ownerId } = await authedClient();
  await confirmFuturePlan(client, ownerId, date, { date, wake: 0, bedtime: 0, blocks }, meta);
}
```

- [ ] **Step 2: Write the detail page**

`src/app/plan-ahead/[date]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { previewFuturePlan } from '@/lib/planner/planAhead';
import { PlanAheadDay } from './PlanAheadDay';

export default async function PlanAheadDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  // Only the next 14 days (2–15 out) are ever linked to — a direct URL
  // outside that range gets a 404 rather than silently previewing an
  // arbitrary date this page was never designed to show.
  const earliest = addDays(planDate, 2);
  const latest = addDays(planDate, 15);
  if (date < earliest || date > latest) notFound();

  const preview = await previewFuturePlan(client, date, new Date());

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Plan ahead
        </p>
      </header>
      <PlanAheadDay date={date} blocks={preview.plan.blocks} source={preview.source} />
    </main>
  );
}
```

- [ ] **Step 3: Write `PlanAheadDay`, the thin wrapper around `EditableDay`**

`src/app/plan-ahead/[date]/PlanAheadDay.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { Block } from '@/core/types';
import { EditableDay } from '@/components/today/EditableDay';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { previewPlanAheadAction, confirmPlanAheadAction } from './actions';

/** Plan-ahead's own thumb bar: unlike Today, there's no "Start rest" or
 * "Day changed" here — the only action a date that hasn't happened yet
 * needs is going back to the list. `EditableDay` swaps this out for its own
 * "Review changes" button the moment CT stacks an edit, same as Today. */
function BackBar() {
  return (
    <ThumbBar>
      <Link className="btn btn-quiet" href="/plan-ahead">
        Back to the list
      </Link>
    </ThumbBar>
  );
}

export function PlanAheadDay({ date, blocks, source }: { date: string; blocks: Block[]; source: 'existing' | 'generated' }) {
  return (
    <>
      {source === 'generated' && (
        <p className="note">This is a preview built from the template — nothing is saved until you edit and confirm it.</p>
      )}
      <EditableDay
        date={date}
        blocks={blocks}
        nowMinute={0}
        actions={<BackBar />}
        previewAction={previewPlanAheadAction}
        confirmAction={confirmPlanAheadAction}
      />
    </>
  );
}
```

`nowMinute={0}` is passed to `EditableDay` because it only forwards that value to `EditBlockSheet` for its own UI clamping (e.g. "can't start before now" affordances) — irrelevant here since the whole date is in the future; `0` is the same value `previewFutureEdits` already uses as its `now` for `validateEdits`/`applyEdits`, kept consistent rather than inventing a second convention.

- [ ] **Step 4: Typecheck and run the full unit suite**

Run: `npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 5: Commit**

```bash
git add src/app/plan-ahead/[date]/
git commit -m "feat(plan-ahead): edit and save a future date's plan"
```

---

### Task 6: End-to-end proof

**Files:**
- Create: `e2e/plan-ahead.spec.ts`

**Interfaces:**
- Consumes: the full route (Tasks 4–5); the project's existing Playwright fixtures (global setup, storage state — same pattern `edit-day.spec.ts` from sub-project A already uses).

- [ ] **Step 1: Write the test**

```ts
// e2e/plan-ahead.spec.ts
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('planning a future date generates a preview, edits it, and the edit sticks on reload', async ({ page }) => {
  await page.goto('/plan-ahead');
  await expect(page.getByText('The next 14 days')).toBeVisible();

  // Open the first listed date — a date this far out has no plan row yet,
  // so this exercises the "generated" preview path.
  const firstOpen = page.locator('.sessions a', { hasText: 'Open' }).first();
  const href = await firstOpen.getAttribute('href');
  await firstOpen.click();
  await expect(page.getByText(/preview built from the template/i)).toBeVisible();

  const row = page.locator('.sessions button.row-edit').first();
  await row.waitFor({ state: 'visible' });
  const originalTitle = (await row.locator('.what').innerText()).split('\n')[0];
  await row.click();

  const durationInput = page.getByLabel('Minutes');
  await durationInput.waitFor({ state: 'visible' });
  const current = await durationInput.inputValue();
  await durationInput.fill(String(Number(current) + 15));
  await page.getByRole('button', { name: 'Apply' }).click();

  await page.getByRole('button', { name: /review changes/i }).click();
  await expect(page.getByText('What changed')).toBeVisible();
  await page.getByRole('button', { name: /take the new day/i }).click();
  await expect(page.getByText('What changed')).not.toBeVisible({ timeout: 10_000 });

  // Reload the same date: the edit must have persisted as a real plan, not
  // been regenerated back to the untouched template.
  await page.goto(href!);
  await expect(page.getByText(/preview built from the template/i)).not.toBeVisible();
  const reloadedRow = page.locator('.sessions button.row-edit', { hasText: originalTitle }).first();
  await expect(reloadedRow).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/plan-ahead.spec.ts`
Expected: PASS

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all specs pass, including `e2e/edit-day.spec.ts` (Today's own editing, untouched by this plan)

- [ ] **Step 4: Commit**

```bash
git add e2e/plan-ahead.spec.ts
git commit -m "test(e2e): prove a future date can be planned, edited, and kept"
```
