# Flexible Schedule Editing — Design

**Status:** approved 2026-09-15
**Scope:** sub-project A of three. B (beyond today) and C (mentor tool use) are
deliberately out; see "What this is not" below.

## The problem

Today the only way to change the day is `/day-changed`, which offers four fixed
chips: running late 30 min, lost an hour, something urgent (45 min, fixed
title), low energy. Every magnitude is hardcoded. There is no way to say "push
gym to 18:00", "only 40 minutes of deep work", "skip film room today", or "call
with coach at 15:00 for 45 minutes".

CT's day changes constantly. The planner is good at rebuilding a day; CT cannot
tell it what actually happened.

## Goals

- Move, resize, drop and add individual blocks on today's plan.
- Several changes reviewed and committed as **one** diff, not one per edit.
- Hand-editing is instant, free and works offline — no Claude call.
- The edit vocabulary is a real domain type, so C can later expose it as mentor
  tools without redesigning anything.

## Non-goals

- No AI. The mentor is untouched by this sub-project.
- No editing of any date but today.
- No template editing (Settings → Templates already covers the recurring week).
- No drag-and-drop. One-thumb use favours a tap target and a field over a drag.

## The shape

One pure function is the single entrance to every plan change. Hand-edits today,
mentor proposals later, and the existing disruption presets are all the same
thing: a list of edits applied to a plan, laid out once, returned with a diff.

```
PlanEdit[]  ──►  applyEdits(plan, now, edits)  ──►  { plan, diff, conflicts }
                          │
                          └─► layout()  (unchanged engine, one new input)
```

Because the output is the `DiffEntry[]` the Day-changed sheet already renders and
`confirmReflow` already persists, the review-then-commit path is largely built.

### The vocabulary

`src/core/planner/edits.ts`, pure:

```ts
export type PlanEdit =
  | { type: 'move';   blockId: string; toStart: number }
  | { type: 'resize'; blockId: string; durationMin: number }
  | { type: 'drop';   blockId: string }
  | { type: 'add'; id: string; title: string; kind: BlockKind;
      start: number; durationMin: number; priority: Priority }
  | ReflowEvent;
```

`ReflowEvent` is included so a messy fix is still one proposal: "I'm 30 minutes
late, and drop film room" is one list, one layout pass, one diff, one tap. Ids
for added blocks come from the caller, matching the existing `urgent` convention
that keeps the core free of randomness.

```ts
export function applyEdits(plan: DayPlan, now: number, edits: PlanEdit[]): ReflowResult;
```

Edits accumulate in order into a single `LayoutInput` plus metadata, then
`layout()` runs **once**:

| Edit | Effect |
|---|---|
| `move` | Sets `start`/`end`, adds the id to `pinned` |
| `resize` | Sets `end = start + durationMin`; lowers `minMinutes` to fit if it now exceeds the duration |
| `drop` | Sets `status: 'skipped'` and removes it from layout |
| `add` | Appends a new block, pinned at its start |
| `ReflowEvent` | Contributes `earliest` / `unavailable` / `placeFirst` / `keepRunning` exactly as today |

`reflow(plan, now, event)` becomes `applyEdits(plan, now, [event])` and keeps its
signature, so nothing calling it changes.

### The one engine change: pinning

A moved block must **land** where CT put it rather than be re-optimised.
`layout()` already has this concept — the `kept` list holds blocks that stay
exactly where they are and act as fixed obstacles everything else lays out
around. It is currently only reachable via `keepRunning`.

Add `pinned?: string[]` to `LayoutInput` and one branch to the partition:

```ts
else if (pinned.includes(b.id)) kept.push(b);
```

Pinned blocks are then immovable, and two pinned blocks that overlap are already
reported through the existing `conflicts` output. No new placement logic.

Deliberately **not** done by setting `anchor: true`: that field means "the
planner never drops this", is persisted, and feeds the guard's `anchorsSkipped`
count. Borrowing it for pinning would corrupt readiness state.

### Skipped is not dropped

`BlockStatus` already distinguishes `skipped` (CT chose to) from `dropped` (the
planner could not fit it). A hand-drop is **`skipped`**. This matters beyond
wording: `buildDaySummary` counts `anchorsSkipped`, which feeds the burnout
guard, so mislabelling a deliberate skip as a planner drop would quietly distort
readiness.

CT may drop an anchor. Product principle: plans and guard adjustments can always
be overridden with one tap. The override is allowed and its consequence is
honest — it counts as a skipped anchor.

### Honest diff reasons

`diffBlocks` hardcodes reflow-shaped reasons: a moved block reads "Moved to make
room", a dropped one "Lowest priority — it didn't fit". Both are wrong for an
edit CT made on purpose.

Extend `DiffContext` with `reasons?: Record<string, string>`, preferred over the
generic text when present. `applyEdits` supplies per-block reasons: "You moved
it", "You shortened it", "You skipped it", "You added it". Blocks the planner
moved as a *consequence* keep the existing "Moved to make room", which is the
useful distinction on the review sheet — what CT asked for versus what it cost.

### Validation

Pure, returning errors rather than throwing, so the UI can show them inline and
C can later hand an invalid proposal back to the mentor:

```ts
export function validateEdits(plan: DayPlan, now: number, edits: PlanEdit[]): string[];
```

- `move` / `add`: start no earlier than `now`, and the block must end by
  `bedtime - 60` (the wind-down boundary `layout` already enforces).
- `resize` / `add`: `durationMin > 0`.
- `add`: non-empty title.
- `move` / `resize` / `drop`: the block must exist and still be open
  (`planned` or `active`). A finished block is history, not schedule.
- At most one `ReflowEvent` per list. Two of them would mean merging two sets of
  layout overrides with no defined precedence; the UI never produces two, and a
  later mentor proposal that does is rejected rather than guessed at.

A non-empty result blocks the preview and is shown against the offending edit.

## The screen

Today's session rows become tappable. Everything else about Today is unchanged.

1. **Tap a row** → an edit sheet: start time, duration, and a Skip action.
2. **Stack edits.** Each confirmed edit is held in client state as a pending
   `PlanEdit`, and the row shows its pending state. Nothing is saved yet.
3. **A pending strip** appears above the thumb bar: "2 changes pending —
   review". While edits are pending, *Review* takes the screen's single gold and
   *Start rest* steps down to a normal button — the day cannot be both "start
   resting" and "you have unreviewed changes" as the one most important action.
   Gold returns to *Start rest* once the strip is empty.
4. **Review** → the diff sheet, showing what CT asked for and what it cost.
5. **Take the new day** → `confirmReflow`, already built.

Adding is a quiet "Add something" action beneath the session list, opening the
same sheet with an empty block.

Discarding a pending edit is a tap on the row; discarding all of them is
leaving the screen, because nothing is persisted until step 5.

The diff list rendering currently lives inside `ReflowFlow`. Extract it to a
shared `DiffList` component used by both `/day-changed` and Today, so the two
review surfaces cannot drift.

### Files

| File | Responsibility |
|---|---|
| `src/core/planner/edits.ts` *(new)* | `PlanEdit`, `applyEdits`, `validateEdits`. Pure. |
| `src/core/planner/layout.ts` | Add `pinned` to `LayoutInput` and the partition branch. |
| `src/core/planner/diff.ts` | Add `reasons` to `DiffContext`. |
| `src/core/planner/reflow.ts` | Re-express over `applyEdits`; signature unchanged. |
| `src/lib/planner/reflowDay.ts` | Add `previewEdits`, sibling to `previewReflow`. |
| `src/app/page.tsx` | Pending-edit state, pending strip, review entry. |
| `src/components/today/EditBlockSheet.tsx` *(new)* | The edit sheet. |
| `src/components/planner/DiffList.tsx` *(new)* | Extracted from `ReflowFlow`. |
| `src/app/day-changed/ReflowFlow.tsx` | Use the extracted `DiffList`. |

## Error handling

- Invalid edits never reach the planner; `validateEdits` runs first and the
  message is shown against the edit that caused it.
- `layout()` conflicts (two pinned blocks overlapping) surface on the review
  sheet as a warning naming both blocks. CT may still accept; the planner does
  not silently discard one.
- A failed save leaves the pending edits intact so the review can be retried.
  Nothing is written until "Take the new day", so a failure loses nothing.

## Testing

Core (`vitest`, colocated, pure):

- Each edit type in isolation: move pins, resize respects `minMinutes`, drop
  marks `skipped`, add appends and pins.
- Combinations: two moves; a move plus a drop; a `ReflowEvent` plus a block edit
  in one list.
- Pinning: a pinned block keeps its exact time while neighbours lay out around
  it; two overlapping pinned blocks report a conflict.
- Validation: each rule, and that a valid list returns no errors.
- Reasons: a CT-moved block reads "You moved it" while a block displaced as a
  consequence reads "Moved to make room".
- `reflow()` keeps its existing behaviour — the current reflow tests must pass
  unchanged, which is the regression gate on re-expressing it.

E2E (`playwright`): tap a session, change its time, stack a skip, review the
diff, take the new day, confirm Today reflects both changes.

## What this is not

- **B — beyond today.** Materialising and editing a plan for a future date.
- **C — mentor tool use.** Exposing `PlanEdit` as tools so the mentor can
  propose a diff CT confirms. C is mostly wiring once this exists, which is the
  main reason the vocabulary is a domain type rather than UI state.

Neither is blocked by anything here, and both were explicitly deferred to ship
this first.
