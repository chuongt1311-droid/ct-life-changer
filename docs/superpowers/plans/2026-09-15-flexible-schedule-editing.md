# Flexible Schedule Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let CT move, resize, drop and add blocks on today's plan, stacking several changes and committing them as one reviewed diff.

**Architecture:** One pure function, `applyEdits(plan, now, edits)`, is the single entrance to every plan change. Each edit mutates blocks and/or contributes `LayoutInput` overrides; `layout()` then runs **once** and `diffBlocks` describes the result. The existing `reflow()` is re-expressed over it and keeps its signature, so its current tests are the regression gate.

**Tech Stack:** TypeScript, Next.js 16 App Router (server components + server actions), Vitest (colocated `*.test.ts`), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-flexible-schedule-editing-design.md`

## Global Constraints

- `src/core/**` is pure: no I/O, no clock, no randomness. Ids for new blocks come from the caller.
- Tests are colocated next to the module they test.
- `npm test` and `npm run typecheck` must pass before every commit.
- Write "CT" or "they" — CT's pronouns are unstated.
- No shame language and no streaks in any user-facing copy.
- One gold action per screen (`.btn-main`). Today's gold is "Start rest" unless edits are pending, when it moves to "Review".
- A hand-drop sets `status: 'skipped'`, never `'dropped'`. `'dropped'` means the planner could not fit it; `buildDaySummary` counts `anchorsSkipped` into the guard.
- Pinning is done with the new `LayoutInput.pinned`, never by setting `anchor: true` (persisted, feeds the guard).
- All times are plan minutes (see `src/core/time.ts`). Wind-down starts at `bedtime - 60`.

## File Structure

| File | Responsibility |
|---|---|
| `src/core/planner/edits.ts` *(new)* | `PlanEdit`, `ReflowEvent`, `validateEdits`, `applyEdits`. Pure. |
| `src/core/planner/edits.test.ts` *(new)* | Tests for the above. |
| `src/core/planner/layout.ts` | Add `pinned` to `LayoutInput` + one partition branch. |
| `src/core/planner/diff.ts` | Add `'skipped'` ChangeKind and `DiffContext.reasons`. |
| `src/core/planner/diffVisual.ts` | Handle the new `'skipped'` kind. |
| `src/core/planner/reflow.ts` | Re-express over `applyEdits`; re-export `ReflowEvent`. |
| `src/lib/planner/reflowDay.ts` | Add `previewEdits`, sibling of `previewReflow`. |
| `src/app/day-changed/actions.ts` | Add `previewEditsAction`. |
| `src/components/planner/DiffList.tsx` *(new)* | Diff rows, extracted from `ReflowFlow`. |
| `src/app/day-changed/ReflowFlow.tsx` | Use the extracted `DiffList`. |
| `src/components/today/EditBlockSheet.tsx` *(new)* | The edit sheet for one block. |
| `src/components/today/EditableDay.tsx` *(new)* | Client: session list, pending edits, review, confirm. |
| `src/app/page.tsx` | Render `EditableDay` instead of the inline session list. |
| `src/app/dept.css` | Styles for the pending strip and the tappable row. |
| `e2e/edit-day.spec.ts` *(new)* | Tap → edit → stack → review → confirm. |

---

### Task 1: Pin blocks in the layout engine

**Files:**
- Modify: `src/core/planner/layout.ts`
- Test: `src/core/planner/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LayoutInput.pinned?: string[]` — ids of blocks that keep their exact `start`/`end` and act as fixed obstacles.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/planner/layout.test.ts`:

```ts
describe('pinned blocks', () => {
  it('keeps a pinned block at its exact time and lays the rest around it', () => {
    const result = layout({
      now: 480,
      wake: 420,
      until: 1320,
      pinned: ['gym'],
      blocks: [
        makeBlock({ id: 'deep', start: 540, end: 660 }),
        makeBlock({ id: 'gym', start: 1080, end: 1140 }),
      ],
    });
    const gym = result.blocks.find((b) => b.id === 'gym')!;
    expect(gym.start).toBe(1080);
    expect(gym.end).toBe(1140);
  });

  it('a pinned block is an obstacle the planner will not overlap', () => {
    const result = layout({
      now: 480,
      wake: 420,
      until: 1320,
      pinned: ['pinnedTask'],
      blocks: [
        makeBlock({ id: 'pinnedTask', start: 540, end: 600 }),
        makeBlock({ id: 'other', start: 540, end: 600 }),
      ],
    });
    const other = result.blocks.find((b) => b.id === 'other')!;
    expect(other.start).toBeGreaterThanOrEqual(600);
  });

  it('reports two overlapping pinned blocks as a conflict', () => {
    const result = layout({
      now: 480,
      wake: 420,
      until: 1320,
      pinned: ['a', 'b'],
      blocks: [
        makeBlock({ id: 'a', start: 540, end: 640 }),
        makeBlock({ id: 'b', start: 600, end: 700 }),
      ],
    });
    expect(result.conflicts).toContainEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/planner/layout.test.ts`
Expected: FAIL — `pinned` is not a valid `LayoutInput` property (typecheck error), and the pinned block gets re-placed.

- [ ] **Step 3: Add `pinned` to the input type**

In `src/core/planner/layout.ts`, inside `LayoutInput`, after the `keepRunning` field:

```ts
  /** Block ids that keep their exact start/end. They become fixed obstacles the
   *  rest of the day lays out around — used when CT moves or adds a block and it
   *  must land where they put it rather than be re-optimised. Never done with
   *  `anchor: true`, which is persisted and feeds the guard. */
  pinned?: string[];
```

- [ ] **Step 4: Route pinned blocks into `kept`**

In `layout()`, after `const placeFirst = input.placeFirst ?? [];` add:

```ts
  const pinned = input.pinned ?? [];
```

Then change the partition loop so pinned blocks join `kept`:

```ts
  for (const b of blocks) {
    const open = b.status === 'planned' || b.status === 'active';
    if (!open || b.end <= now) untouched.push(b);
    else if (pinned.includes(b.id)) kept.push(b);
    else if (keepRunning && b.start <= now) kept.push(b);
    else movable.push(b);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/planner/layout.test.ts`
Expected: PASS, including every pre-existing layout test.

- [ ] **Step 6: Commit**

```bash
git add src/core/planner/layout.ts src/core/planner/layout.test.ts
git commit -m "feat(planner): let layout pin a block to an exact time"
```

---

### Task 2: Let the diff describe edits CT made

**Files:**
- Modify: `src/core/planner/diff.ts`, `src/core/planner/diffVisual.ts`
- Test: `src/core/planner/diff.test.ts`, `src/core/planner/diffVisual.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ChangeKind` gains `'skipped'`; `DiffContext` gains `reasons?: Record<string, string>`, preferred over the generic reason when present.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/planner/diff.test.ts`:

```ts
describe('CT-authored edits', () => {
  it('reports a block CT skipped as skipped, not kept', () => {
    const before = [makeBlock({ id: 'film', title: 'Film room', start: 540, end: 600 })];
    const after = [makeBlock({ id: 'film', title: 'Film room', start: 540, end: 600, status: 'skipped' })];
    const [entry] = diffBlocks(before, after);
    expect(entry).toMatchObject({ blockId: 'film', change: 'skipped', to: null });
  });

  it('prefers a supplied reason over the generic one', () => {
    const before = [makeBlock({ id: 'gym', title: 'Gym', start: 1020, end: 1080 })];
    const after = [makeBlock({ id: 'gym', title: 'Gym', start: 1080, end: 1140 })];
    const [entry] = diffBlocks(before, after, { reasons: { gym: 'You moved it' } });
    expect(entry).toMatchObject({ change: 'moved', reason: 'You moved it' });
  });

  it('still explains a block the planner displaced as a consequence', () => {
    const before = [makeBlock({ id: 'study', title: 'Study', start: 780, end: 840 })];
    const after = [makeBlock({ id: 'study', title: 'Study', start: 840, end: 900 })];
    const [entry] = diffBlocks(before, after, { reasons: { gym: 'You moved it' } });
    expect(entry.reason).toBe('Moved to make room');
  });
});
```

Append to `src/core/planner/diffVisual.test.ts`:

```ts
it('marks a skipped block as dropped, but as a choice rather than an alarm', () => {
  expect(diffVisual('skipped')).toEqual({ mark: 'dropped', tone: 'warn' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/planner/diff.test.ts src/core/planner/diffVisual.test.ts`
Expected: FAIL — `'skipped'` is not assignable to `ChangeKind`, and the supplied reason is ignored.

- [ ] **Step 3: Extend the diff types and logic**

In `src/core/planner/diff.ts`, add `'skipped'` to `ChangeKind`:

```ts
export type ChangeKind = 'added' | 'missed' | 'dropped' | 'skipped' | 'swapped' | 'shrunk' | 'moved' | 'kept';
```

Add the `reasons` field to `DiffContext`:

```ts
export interface DiffContext {
  addedIds?: string[];
  missedReasons?: Record<string, string>;
  shrinkReason?: string;
  /** Per-block reason that wins over the generic text — how CT described the
   *  change they asked for, as opposed to what the planner did in response. */
  reasons?: Record<string, string>;
}
```

Inside `diffBlocks`, immediately after `const base = { blockId: b.id, title: b.title, from };` add:

```ts
    const authored = ctx.reasons?.[b.id];
```

Add a `skipped` branch directly above the `dropped` branch:

```ts
    } else if (b.status === 'skipped') {
      entries.push({ ...base, change: 'skipped', to: null, reason: authored ?? 'You skipped it' });
```

Then make every remaining branch prefer `authored`. Replace the existing reason expressions:

```ts
    } else if (b.status === 'dropped') {
      entries.push({ ...base, change: 'dropped', to: null, reason: authored ?? "Lowest priority — it didn't fit" });
    } else if (b.title !== old.title) {
      entries.push({ ...base, change: 'swapped', to, reason: authored ?? `Swapped from "${old.title}" for the recovery version` });
    } else if (b.end - b.start < old.end - old.start) {
      entries.push({ ...base, change: 'shrunk', to, reason: authored ?? ctx.shrinkReason ?? 'Shortened to fit the day' });
    } else if (b.start !== old.start) {
      entries.push({ ...base, change: 'moved', to, reason: authored ?? 'Moved to make room' });
    } else {
      entries.push({ ...base, change: 'kept', to, reason: authored ?? '' });
    }
```

Also prefer it for added blocks — replace the `added` push near the top of the loop:

```ts
    if (added.has(b.id) || !old) {
      entries.push({ blockId: b.id, title: b.title, change: 'added', from: null, to, reason: ctx.reasons?.[b.id] ?? 'New block' });
      continue;
    }
```

- [ ] **Step 4: Handle the new kind in `diffVisual`**

`diffVisual` is an exhaustive switch with no `default`, so it will not compile until `'skipped'` is handled. In `src/core/planner/diffVisual.ts`, add a case above `dropped`:

```ts
    case 'skipped':
      // CT chose this. It leaves the day like a drop, but it is not an alarm.
      return { mark: 'dropped', tone: 'warn' };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/planner/ && npm run typecheck`
Expected: PASS, and typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/planner/diff.ts src/core/planner/diff.test.ts src/core/planner/diffVisual.ts src/core/planner/diffVisual.test.ts
git commit -m "feat(planner): let the diff tell CT's edits from their consequences"
```

---

### Task 3: The edit vocabulary and its validation

**Files:**
- Create: `src/core/planner/edits.ts`, `src/core/planner/edits.test.ts`

**Interfaces:**
- Consumes: `DayPlan`, `Block`, `BlockKind`, `Priority` from `src/core/types.ts`.
- Produces:
  - `type ReflowEvent` (moved here from `reflow.ts`, same four variants).
  - `type PlanEdit = MoveEdit | ResizeEdit | DropEdit | AddEdit | ReflowEvent`.
  - `validateEdits(plan: DayPlan, now: number, edits: PlanEdit[]): string[]` — human-readable messages, empty when valid.

- [ ] **Step 1: Write the failing tests**

Create `src/core/planner/edits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import type { DayPlan } from '../types';
import { validateEdits } from './edits';

// wake 07:00 (420), bedtime 23:00 (1380) → wind-down starts 22:00 (1320)
function plan(): DayPlan {
  return {
    date: '2026-09-15',
    wake: 420,
    bedtime: 1380,
    blocks: [
      makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660 }),
      makeBlock({ id: 'gym', title: 'Gym', start: 1020, end: 1080 }),
      makeBlock({ id: 'past', title: 'Breakfast', start: 450, end: 480, status: 'done' }),
    ],
  };
}

describe('validateEdits', () => {
  it('accepts a valid set of edits', () => {
    expect(validateEdits(plan(), 480, [
      { type: 'move', blockId: 'gym', toStart: 1080 },
      { type: 'drop', blockId: 'deep' },
    ])).toEqual([]);
  });

  it('refuses to move a block into the past', () => {
    const errors = validateEdits(plan(), 600, [{ type: 'move', blockId: 'gym', toStart: 540 }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('past');
  });

  it('refuses a block that would run past wind-down', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'move', blockId: 'gym', toStart: 1290 }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('wind-down');
  });

  it('refuses to change a block that is already finished', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'drop', blockId: 'past' }]);
    expect(errors).toHaveLength(1);
  });

  it('refuses a zero-length block', () => {
    const errors = validateEdits(plan(), 480, [{ type: 'resize', blockId: 'deep', durationMin: 0 }]);
    expect(errors).toHaveLength(1);
  });

  it('refuses a new block with no title', () => {
    const errors = validateEdits(plan(), 480, [
      { type: 'add', id: 'x', title: '   ', kind: 'task', start: 600, durationMin: 30, priority: 3 },
    ]);
    expect(errors).toHaveLength(1);
  });

  it('refuses two disruptions in one list', () => {
    const errors = validateEdits(plan(), 480, [
      { type: 'late', minutes: 30 },
      { type: 'lowEnergy', restId: 'r1' },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('one disruption');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/planner/edits.test.ts`
Expected: FAIL — `Failed to resolve import "./edits"`.

- [ ] **Step 3: Write the types and validation**

Create `src/core/planner/edits.ts`:

```ts
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

export const isReflowEvent = (edit: PlanEdit): edit is ReflowEvent =>
  (REFLOW_TYPES as readonly string[]).includes(edit.type);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/planner/edits.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/edits.ts src/core/planner/edits.test.ts
git commit -m "feat(planner): add the PlanEdit vocabulary and its validation"
```

---

### Task 4: `applyEdits` — the single entrance

**Files:**
- Modify: `src/core/planner/edits.ts`
- Test: `src/core/planner/edits.test.ts`

**Interfaces:**
- Consumes: `LayoutInput.pinned` (Task 1), `DiffContext.reasons` and `ChangeKind 'skipped'` (Task 2), `PlanEdit` / `isReflowEvent` (Task 3).
- Produces: `applyEdits(plan: DayPlan, now: number, edits: PlanEdit[]): ReflowResult` where `ReflowResult` is `{ plan: DayPlan; diff: DiffEntry[]; conflicts: [string, string][] }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/planner/edits.test.ts` (and extend the import to `import { applyEdits, validateEdits } from './edits';`):

```ts
describe('applyEdits', () => {
  it('moves a block to exactly where CT put it', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [{ type: 'move', blockId: 'gym', toStart: 1140 }]);
    const gym = next.blocks.find((b) => b.id === 'gym')!;
    expect(gym.start).toBe(1140);
    expect(gym.end).toBe(1200);
    expect(diff.find((d) => d.blockId === 'gym')).toMatchObject({ change: 'moved', reason: 'You moved it' });
  });

  it('resizes a block and lowers minMinutes so the new length stays valid', () => {
    const { plan: next } = applyEdits(plan(), 480, [{ type: 'resize', blockId: 'deep', durationMin: 40 }]);
    const deep = next.blocks.find((b) => b.id === 'deep')!;
    expect(deep.end - deep.start).toBe(40);
    expect(deep.minMinutes).toBeLessThanOrEqual(40);
  });

  it('marks a dropped block skipped, never dropped', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [{ type: 'drop', blockId: 'deep' }]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(diff.find((d) => d.blockId === 'deep')).toMatchObject({ change: 'skipped', reason: 'You skipped it' });
  });

  it('adds a block at the time CT chose and reports it as added', () => {
    const { plan: next, diff } = applyEdits(plan(), 480, [
      { type: 'add', id: 'coach', title: 'Call with coach', kind: 'task', start: 900, durationMin: 45, priority: 3 },
    ]);
    const coach = next.blocks.find((b) => b.id === 'coach')!;
    expect(coach.start).toBe(900);
    expect(coach.end).toBe(945);
    expect(coach.source).toBe('manual');
    expect(diff.find((d) => d.blockId === 'coach')).toMatchObject({ change: 'added', reason: 'You added it' });
  });

  it('applies several edits as one pass', () => {
    const { plan: next } = applyEdits(plan(), 480, [
      { type: 'drop', blockId: 'deep' },
      { type: 'move', blockId: 'gym', toStart: 1140 },
    ]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(next.blocks.find((b) => b.id === 'gym')!.start).toBe(1140);
  });

  it('accepts a disruption and a block edit in the same list', () => {
    const { plan: next } = applyEdits(plan(), 480, [
      { type: 'late', minutes: 30 },
      { type: 'drop', blockId: 'deep' },
    ]);
    expect(next.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(next.blocks.find((b) => b.id === 'gym')!.start).toBeGreaterThanOrEqual(510);
  });

  it('leaves a block CT did not touch describable as a consequence', () => {
    // Pinning gym over study's slot forces the planner to move study itself.
    const base = plan();
    base.blocks.push(makeBlock({ id: 'study', title: 'Study', start: 1080, end: 1140 }));
    const { diff } = applyEdits(base, 480, [{ type: 'move', blockId: 'gym', toStart: 1080 }]);
    const study = diff.find((d) => d.blockId === 'study')!;
    expect(study.reason).toBe('Moved to make room');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/planner/edits.test.ts`
Expected: FAIL — `applyEdits` is not exported from `./edits`.

- [ ] **Step 3: Implement `applyEdits`**

Add to the top of `src/core/planner/edits.ts`:

```ts
import { type DiffEntry, diffBlocks } from './diff';
import { layout, type LayoutInput } from './layout';
import { toRecovery } from './blocks';
```

Add to the bottom of `src/core/planner/edits.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/planner/edits.test.ts && npm run typecheck`
Expected: PASS (14 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/edits.ts src/core/planner/edits.test.ts
git commit -m "feat(planner): applyEdits, the single entrance to every plan change"
```

---

### Task 5: Re-express `reflow()` over `applyEdits`

The regression gate: `src/core/planner/reflow.test.ts` must pass **unchanged**.

**Files:**
- Modify: `src/core/planner/reflow.ts`
- Test: `src/core/planner/reflow.test.ts` (unchanged — do not edit it)

**Interfaces:**
- Consumes: `applyEdits`, `ReflowEvent`, `ReflowResult` from `./edits`.
- Produces: `reflow(plan: DayPlan, now: number, event: ReflowEvent): ReflowResult`, unchanged signature. `ReflowEvent` and `ReflowResult` continue to be importable from `./reflow`.

- [ ] **Step 1: Run the existing tests to record the baseline**

Run: `npx vitest run src/core/planner/reflow.test.ts`
Expected: PASS. Note the count — it must be identical at Step 4.

- [ ] **Step 2: Replace the body of `reflow.ts`**

Replace the entire contents of `src/core/planner/reflow.ts` with:

```ts
import type { DayPlan } from '../types';
import { applyEdits, type ReflowEvent, type ReflowResult } from './edits';

// Re-exported so the many existing importers of these types keep working.
export type { ReflowEvent, ReflowResult };

/** Rebuild the rest of the day after a disruption. Wind-down starts 60 min
 *  before bedtime. A disruption is one PlanEdit, so this is a thin alias over
 *  applyEdits — kept because it names the spec §5.4 concept its callers use. */
export function reflow(plan: DayPlan, now: number, event: ReflowEvent): ReflowResult {
  return applyEdits(plan, now, [event]);
}
```

- [ ] **Step 3: Verify no importer broke**

Run: `npm run typecheck`
Expected: clean. `src/lib/planner/reflowDay.ts` and `src/app/day-changed/actions.ts` both import `ReflowEvent` from `@/core/planner/reflow` and must still resolve.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS with the same reflow test count as Step 1, and every other suite green. If a reflow test now fails, `applyEdits` differs from the old behaviour — fix `applyEdits`, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/reflow.ts
git commit -m "refactor(planner): express reflow over applyEdits"
```

---

### Task 6: Preview edits against the stored day

**Files:**
- Modify: `src/lib/planner/reflowDay.ts`, `src/app/day-changed/actions.ts`
- Test: `src/lib/planner/reflowDay.test.ts`

**Interfaces:**
- Consumes: `applyEdits`, `validateEdits`, `PlanEdit` from `@/core/planner/edits`.
- Produces:
  - `previewEdits(client, date, edits, now): Promise<{ plan: DayPlan; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }>`
  - `previewEditsAction(edits: PlanEdit[]): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/planner/reflowDay.test.ts`, following the fake-client pattern already used in that file:

```ts
describe('previewEdits', () => {
  it('returns the edited day and writes nothing', async () => {
    const client = fakeClient();
    const { plan, diff, errors } = await previewEdits(client, '2026-09-15', [{ type: 'drop', blockId: 'deep' }], 480);
    expect(errors).toEqual([]);
    expect(plan.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(diff.some((d) => d.blockId === 'deep' && d.change === 'skipped')).toBe(true);
    // Nothing persisted: the stored row is still planned.
    const stored = await client.from('blocks').select();
    expect(stored.data!.find((b: { id: string }) => b.id === 'deep')!.status).toBe('planned');
  });

  it('reports validation errors instead of laying out an impossible day', async () => {
    const client = fakeClient();
    const { errors } = await previewEdits(client, '2026-09-15', [{ type: 'move', blockId: 'deep', toStart: 60 }], 480);
    expect(errors).toHaveLength(1);
  });
});
```

If `reflowDay.test.ts` has no `fakeClient` helper, use the shared one: `import { fakeClient } from '@/lib/testing/fakeClient';` and seed it with a `settings` row and `blocks` rows for `2026-09-15`, mirroring how `previewReflow`'s existing test seeds its data.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/planner/reflowDay.test.ts`
Expected: FAIL — `previewEdits` is not exported.

- [ ] **Step 3: Add `previewEdits`**

In `src/lib/planner/reflowDay.ts`, add the import:

```ts
import { applyEdits, validateEdits, type PlanEdit } from '@/core/planner/edits';
```

Add below `previewReflow`:

```ts
/** Lay out today with CT's edits applied, without writing anything. Validation
 *  runs first so an impossible edit is reported rather than silently reshaping
 *  the day; only `confirmReflow` persists. */
export async function previewEdits(
  client: RepositoryClient,
  date: string,
  edits: PlanEdit[],
  now: number,
): Promise<{ plan: DayPlan; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }> {
  const repos = repositories(client);
  const [settingsRow, blockRows] = await Promise.all([repos.settings.get(), repos.blocks.list({ date } as never)]);
  const settings = settingsToDomain(settingsRow!);
  const plan: DayPlan = {
    date,
    wake: toPlanMinute(settings.wakeTime),
    bedtime: toPlanMinute(settings.bedtime),
    blocks: blockRows.map(rowToBlock),
  };

  const errors = validateEdits(plan, now, edits);
  if (errors.length > 0) return { plan, diff: [], conflicts: [], errors };

  const result = applyEdits(plan, now, edits);
  return { plan: result.plan, diff: result.diff, conflicts: result.conflicts, errors: [] };
}
```

- [ ] **Step 4: Add the server action**

In `src/app/day-changed/actions.ts`, add the import:

```ts
import { previewEdits } from '@/lib/planner/reflowDay';
import type { PlanEdit } from '@/core/planner/edits';
```

and the action, below `previewReflowAction`:

```ts
export async function previewEditsAction(
  edits: PlanEdit[],
): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][]; errors: string[] }> {
  const { client } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(new Date(), settings.timezone);
  const { plan, diff, conflicts, errors } = await previewEdits(client, planDate, edits, minute);
  return { date: planDate, blocks: plan.blocks, diff, conflicts, errors };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/planner/ && npm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/planner/reflowDay.ts src/lib/planner/reflowDay.test.ts src/app/day-changed/actions.ts
git commit -m "feat(planner): preview a set of edits without writing them"
```

---

### Task 7: Extract the diff list into a shared component

Pure refactor — no behaviour change. `e2e/day-changed.spec.ts` is the gate.

**Files:**
- Create: `src/components/planner/DiffList.tsx`
- Modify: `src/app/day-changed/ReflowFlow.tsx`

**Interfaces:**
- Consumes: `DiffEntry` from `@/core/planner/diff`, `diffVisual` from `@/core/planner/diffVisual`.
- Produces: `<DiffList entries={DiffEntry[]} />`.

- [ ] **Step 1: Read the current markup**

Open `src/app/day-changed/ReflowFlow.tsx` and find the `<ul className="diff">` block rendered after a preview returns. Copy its exact JSX — the extraction must be byte-identical in output so the existing E2E keeps passing.

- [ ] **Step 2: Create the component**

Create `src/components/planner/DiffList.tsx` with the JSX copied in Step 1:

```tsx
import type { DiffEntry } from '@/core/planner/diff';
import { diffVisual } from '@/core/planner/diffVisual';
import { Icon } from '@/components/icons/Icon';
import { formatPlanMinute } from '@/core/time';

/** The "What changed" rows. Shared by Day changed and Today's review sheet so
 *  the two review surfaces cannot drift apart. */
export function DiffList({ entries }: { entries: DiffEntry[] }) {
  return (
    <ul className="diff">
      {entries.map((d) => {
        const visual = diffVisual(d.change);
        return (
          <li key={d.blockId} data-kind={visual.mark}>
            <span className="mark">
              <Icon name={visual.mark} />
            </span>
            <span>
              <span className="row-name">{d.title}</span>
              {d.to && (
                <span className="row-note">
                  {formatPlanMinute(d.to.start)}–{formatPlanMinute(d.to.end)}
                  {d.from && d.from.start !== d.to.start && (
                    <span className="was"> {formatPlanMinute(d.from.start)}</span>
                  )}
                </span>
              )}
              {d.reason && <span className="row-note">{d.reason}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

If the markup copied in Step 1 differs from the above, **use the copied markup** — matching the shipped rendering matters more than matching this plan.

- [ ] **Step 3: Use it in `ReflowFlow`**

In `src/app/day-changed/ReflowFlow.tsx`, replace the `<ul className="diff">…</ul>` block with `<DiffList entries={result.diff} />` and add `import { DiffList } from '@/components/planner/DiffList';`. Remove any imports that are now unused (`diffVisual`, and `Icon`/`formatPlanMinute` if nothing else uses them) — there is no lint script, so unused imports will not be caught automatically.

- [ ] **Step 4: Verify nothing changed**

Run: `npm run typecheck && npx playwright test e2e/day-changed.spec.ts`
Expected: typecheck clean, E2E passes — the Day-changed flow is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/components/planner/DiffList.tsx src/app/day-changed/ReflowFlow.tsx
git commit -m "refactor(ui): extract DiffList so both review surfaces share it"
```

---

### Task 8: The edit sheet

**Files:**
- Create: `src/components/today/EditBlockSheet.tsx`
- Modify: `src/app/dept.css`

**Interfaces:**
- Consumes: `Block` from `@/core/types`, `PlanEdit` from `@/core/planner/edits`, `formatPlanMinute` / `toPlanMinute` from `@/core/time`.
- Produces: `<EditBlockSheet block={Block | null} onClose={() => void} onApply={(edit: PlanEdit) => void} />`. A `null` block means "adding", and `onApply` then emits an `add` edit.

- [ ] **Step 1: Create the component**

Create `src/components/today/EditBlockSheet.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Block } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import { formatPlanMinute, toPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';

/** Edit one block, or add a new one when `block` is null. Emits a single
 *  PlanEdit; nothing is saved here — EditableDay collects edits and one review
 *  commits them all. */
export function EditBlockSheet({
  block,
  nowMinute,
  onApply,
  onClose,
}: {
  block: Block | null;
  nowMinute: number;
  onApply: (edit: PlanEdit) => void;
  onClose: () => void;
}) {
  const adding = block === null;
  const [title, setTitle] = useState(block?.title ?? '');
  const [startText, setStartText] = useState(formatPlanMinute(block?.start ?? nowMinute));
  const [duration, setDuration] = useState(block ? block.end - block.start : 30);

  function apply() {
    const toStart = toPlanMinute(startText);
    if (adding) {
      onApply({
        type: 'add',
        id: `manual-${Date.now()}`,
        title,
        kind: 'task',
        start: toStart,
        durationMin: duration,
        priority: 3,
      });
      return;
    }
    if (toStart !== block.start) onApply({ type: 'move', blockId: block.id, toStart });
    if (duration !== block.end - block.start) onApply({ type: 'resize', blockId: block.id, durationMin: duration });
    onClose();
  }

  return (
    <div className="stepback">
      <Placard>{adding ? 'Add something' : block.title}</Placard>

      {adding && (
        <div className="field">
          <label htmlFor="edit-title">What is it</label>
          <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call with coach" />
        </div>
      )}

      <div className="field">
        <label htmlFor="edit-start">Starts at</label>
        <input id="edit-start" type="time" value={startText} onChange={(e) => setStartText(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="edit-duration">Minutes</label>
        <input
          id="edit-duration"
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      {!adding && (
        <button
          className="btn btn-quiet btn-wide"
          onClick={() => {
            onApply({ type: 'drop', blockId: block.id });
            onClose();
          }}
        >
          Skip it today
        </button>
      )}

      <ThumbBar>
        <button className="btn btn-main" onClick={apply}>
          {adding ? 'Add it' : 'Apply'}
        </button>
        <button className="btn btn-quiet" onClick={onClose}>
          Cancel
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 2: Add the tappable-row and pending-strip styles**

Append to `src/app/dept.css`:

```css
/* ---------- Editing today ---------- */

/* A session row is a button when the day can still be changed. It must not look
   like one: the row treatment is the design, the tap target is the affordance. */
.sessions li > button.row-edit {
  appearance: none;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: contents;
}
.sessions li:has(> button.row-edit:hover) .what { color: var(--ink); }
.sessions li:has(> button.row-edit:focus-visible) {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: 2px;
}

/* A row with an unreviewed edit against it. */
.sessions li[data-pending="true"] .what::after {
  content: " · edited";
  color: var(--read-warn);
  font-size: var(--t-cap);
  letter-spacing: var(--track-cap);
  text-transform: uppercase;
}

.pending-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin-top: var(--s5);
  padding-top: var(--s3);
  border-top: 1px solid var(--line-soft);
  color: var(--read-warn);
  font-family: var(--display);
  font-size: var(--t-cap);
  letter-spacing: var(--track-cap);
  text-transform: uppercase;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: clean. (The component is not rendered yet; Task 9 wires it in.)

- [ ] **Step 4: Commit**

```bash
git add src/components/today/EditBlockSheet.tsx src/app/dept.css
git commit -m "feat(today): add the block edit sheet"
```

---

### Task 9: Wire editing into Today

**Files:**
- Create: `src/components/today/EditableDay.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `EditBlockSheet` (Task 8), `DiffList` (Task 7), `previewEditsAction` (Task 6), `confirmReflowAction` from `@/app/day-changed/actions`, `SessionRow` props from `@/components/ui/SessionRow`.
- Produces: `<EditableDay blocks={Block[]} nowMinute={number} />` — owns pending edits, the sheet, the review and the commit.

- [ ] **Step 1: Create `EditableDay`**

Create `src/components/today/EditableDay.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Block } from '@/core/types';
import type { PlanEdit } from '@/core/planner/edits';
import type { DiffEntry } from '@/core/planner/diff';
import { formatPlanMinute } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { Tag } from '@/components/ui/Tag';
import { DiffList } from '@/components/planner/DiffList';
import { EditBlockSheet } from './EditBlockSheet';
import { confirmReflowAction, previewEditsAction } from '@/app/day-changed/actions';

const RANK: Record<string, 'done' | 'now' | 'next'> = {
  done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done',
  active: 'now', planned: 'next',
};
const TAG_LABEL: Record<string, string> = {
  done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed',
  dropped: 'Dropped', active: 'Now', planned: 'Next',
};

type Review = { date: string; blocks: Block[]; diff: DiffEntry[]; conflicts: [string, string][] };

const editTarget = (e: PlanEdit): string | null =>
  e.type === 'move' || e.type === 'resize' || e.type === 'drop' ? e.blockId : null;

export function EditableDay({ blocks, nowMinute }: { blocks: Block[]; nowMinute: number }) {
  const [edits, setEdits] = useState<PlanEdit[]>([]);
  const [editing, setEditing] = useState<Block | null | undefined>(undefined); // undefined = closed, null = adding
  const [review, setReview] = useState<Review | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pendingIds = new Set(edits.map(editTarget).filter((id): id is string => id !== null));
  const open = (b: Block) => b.status === 'planned' || b.status === 'active';

  async function openReview() {
    setBusy(true);
    const result = await previewEditsAction(edits);
    setBusy(false);
    if (result.errors.length > 0) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setReview({ date: result.date, blocks: result.blocks, diff: result.diff, conflicts: result.conflicts });
  }

  async function take() {
    if (!review) return;
    setBusy(true);
    await confirmReflowAction(review.date, review.blocks);
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
        {/* Two pinned blocks can only overlap because CT moved one onto the
            other. Say so and let them decide — the planner must not silently
            discard one of them. */}
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
            {open(b) ? (
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

      {edits.length > 0 && (
        <div className="thumb stacked">
          <button className="btn btn-main btn-wide" onClick={openReview} disabled={busy}>
            {busy ? 'Working…' : 'Review changes'}
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Render it from Today**

In `src/app/page.tsx`:

1. Add `import { EditableDay } from '@/components/today/EditableDay';`
2. Replace the whole `<div className="col-b">…</div>` block (the `Placard` plus the `<ul className="sessions">` and its `SessionRow` map) with:

```tsx
        <div className="col-b">
          <EditableDay blocks={sorted.map(blockRowToCore)} nowMinute={minute} />
        </div>
```

3. Remove the now-unused `SessionRow`, `RANK` and `TAG_LABEL` declarations and the `SessionRow` import. Keep the `Placard` import if it is still used elsewhere on the page (it is — "Today's load").

- [ ] **Step 3: Move Today's gold while edits are pending**

`EditableDay` renders its own gold "Review changes" button when edits exist. Today's own `ThumbBar` also renders a gold "Start rest", which would put two golds on screen.

In `src/app/page.tsx`, the page is a server component and cannot see the pending count, so move the decision into the client: pass the existing thumb actions into `EditableDay` as children, and let it render either its review bar or the page's own bar.

Change the `EditableDay` signature in `src/components/today/EditableDay.tsx`:

```tsx
export function EditableDay({
  blocks,
  nowMinute,
  actions,
}: {
  blocks: Block[];
  nowMinute: number;
  actions: React.ReactNode;
}) {
```

and replace the final `{edits.length > 0 && (<div className="thumb stacked">…</div>)}` with:

```tsx
      {edits.length > 0 ? (
        <div className="thumb stacked">
          <button className="btn btn-main btn-wide" onClick={openReview} disabled={busy}>
            {busy ? 'Working…' : 'Review changes'}
          </button>
        </div>
      ) : (
        actions
      )}
```

Then in `src/app/page.tsx`, delete the page-level `<ThumbBar>…</ThumbBar>` and pass it in instead:

```tsx
        <div className="col-b">
          <EditableDay
            blocks={sorted.map(blockRowToCore)}
            nowMinute={minute}
            actions={
              <ThumbBar>
                <Link className="btn btn-main" href="/reentry">
                  <Icon name="rest" />
                  Start rest
                </Link>
                <Link className="btn" href="/day-changed">
                  <Icon name="shift" />
                  Day changed
                </Link>
              </ThumbBar>
            }
          />
        </div>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean, 257+ tests pass.

- [ ] **Step 5: Look at it**

Run: `SHOTS=1 npx playwright test e2e/screens.spec.ts -g "01-today"`
Open `screenshots/viewport/01-today.png`. Confirm the session rows render exactly as before (the row treatment must be unchanged — only the tap target is new) and exactly one gold button is on screen.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/EditableDay.tsx src/app/page.tsx
git commit -m "feat(today): tap a session to change it, review all edits at once"
```

---

### Task 10: End-to-end proof

**Files:**
- Create: `e2e/edit-day.spec.ts`

**Interfaces:**
- Consumes: the whole feature.
- Produces: nothing.

- [ ] **Step 1: Write the test**

Create `e2e/edit-day.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('edit a session, stack a skip, review both and take the new day', async ({ page }) => {
  await page.goto('/');

  // Open the first changeable session.
  const firstEditable = page.locator('.sessions button.row-edit').first();
  const editedTitle = await firstEditable.locator('.what').first().innerText();
  await firstEditable.click();

  // Change its length and apply.
  await expect(page.getByLabel('Minutes')).toBeVisible();
  await page.getByLabel('Minutes').fill('45');
  await page.getByRole('button', { name: 'Apply' }).click();

  // Stack a second edit: skip another session.
  await page.locator('.sessions button.row-edit').nth(1).click();
  await page.getByRole('button', { name: 'Skip it today' }).click();

  // Both are pending.
  await expect(page.getByText('2 changes pending')).toBeVisible();

  // Review shows one diff for both.
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();

  await page.getByRole('button', { name: 'Take the new day' }).click();
  await page.waitForURL('**/');
  await expect(page.locator('.sessions')).toContainText(editedTitle.split('\n')[0]!);
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/edit-day.spec.ts`
Expected: PASS. If the "What changed" heading is not found, check that `Placard` renders a heading role — if it renders a `<p>`, assert on `page.getByText('What changed')` instead, matching however `ReflowFlow` is asserted in `e2e/day-changed.spec.ts`.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npm run typecheck && npx playwright test`
Expected: all unit tests pass, typecheck clean, 5 E2E specs pass and the 11 screenshot tests skip.

- [ ] **Step 4: Commit**

```bash
git add e2e/edit-day.spec.ts
git commit -m "test(e2e): prove stacked edits commit as one reviewed change"
```

---

## Self-Review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| `PlanEdit` vocabulary (move/resize/drop/add + ReflowEvent) | 3 |
| `applyEdits` single entrance, one layout pass | 4 |
| `pinned` in `LayoutInput`, not `anchor: true` | 1 |
| Hand-drop is `skipped`, feeds `anchorsSkipped` | 2, 4 |
| Honest diff reasons; consequence keeps "Moved to make room" | 2, 4 |
| `validateEdits` returns messages, never throws | 3 |
| At most one `ReflowEvent` per list | 3 |
| `reflow()` re-expressed, signature unchanged | 5 |
| Tap row → sheet → stack → one diff → confirm | 8, 9 |
| Pending strip; gold moves to Review and back | 8, 9 |
| Add via a quiet action below the list | 8, 9 |
| Discard pending edits | 9 |
| Extract `DiffList`, shared with Day changed | 7 |
| Conflicts surfaced on review | 4 produces, 6 threads, 9 renders |
| Failed save leaves pending edits intact | 9 (`take()` does not clear state) |

**Gap found during review and fixed inline:** `applyEdits` returned `conflicts`, but the first draft dropped them at the action boundary, so two blocks CT moved onto each other would have overlapped silently. `conflicts` is now threaded through `previewEdits` → `previewEditsAction` → the `Review` type → a `role="alert"` on the review sheet (Tasks 6 and 9).

**Placeholder scan:** no TBD/TODO. Every code step carries real code. Task 7 Step 1 deliberately instructs copying the shipped markup rather than trusting the plan's reproduction of it, which is a fidelity instruction, not a placeholder.

**Type consistency:** `applyEdits` / `validateEdits` / `PlanEdit` / `ReflowEvent` / `ReflowResult` are spelled identically in Tasks 3–6 and 9. `previewEdits` (lib) and `previewEditsAction` (action) are consistently distinguished. `LayoutInput.pinned` is `string[]` in Tasks 1 and 4. `DiffContext.reasons` is `Record<string, string>` in Tasks 2 and 4. `EditableDay` gains the `actions` prop within Task 9 (Steps 1 and 3) — implementers must apply Step 3's signature change, which supersedes Step 1's.
