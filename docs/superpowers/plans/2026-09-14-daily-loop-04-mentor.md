# Plan 4 — Mentor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Daily Loop a working mentor: a versioned system prompt, an Anthropic SDK integration wired to the data layer Plan 3 built, and the five routes from spec §8.2 (briefing, eveningReview, weeklyReview, chat, reflowComment) — each cost-tracked, cap-gated, and crisis-aware.

**Architecture:** Everything that decides *what the mentor is allowed to say* (crisis backup check, fallback copy, the cap-reached message) is a new pure module in `src/core/mentor`, alongside the context builder and cost math Plan 1 already built there — untouched by this plan. Everything that *talks to Supabase or Anthropic* is a new I/O layer in `src/lib/mentor` and `src/lib/anthropic`, built on Plan 3's repositories. Next.js Route Handlers under `src/app/api/mentor/*` are thin wiring: check auth, call one route-service function, return its result.

**Tech Stack:** `@anthropic-ai/sdk` (already a dependency, `^0.125.0`) via `client.messages.create` / `.parse` / `.stream`, `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` for structured outputs, Vitest 5.0.0, existing zod schemas from Plan 3.

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md) — §8 (Mentor), §11 (Privacy/crisis), §12 (Error handling), §13 (Testing).

**Roadmap:** [`docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md`](2026-09-11-daily-loop-00-roadmap.md) — Plan 4 row.

## Global Constraints

- `src/core/**` stays pure: no I/O, no clock reads, no randomness. `src/core/mentor/context.ts`, `cost.ts`, and `profile.ts` are already built and correct — this plan adds new files beside them, never edits them.
- `npm test` and `npm run typecheck` must both pass before every commit.
- Write "CT" or "they" in any prose/comments/copy.
- No shame language, no streaks, anywhere in prompt text or fallback copy. Badges and attributes never fall; rest while depleted earns double XP; grinding while depleted earns zero training XP and is labelled "Injury risk", never "wasted" (spec §8b) — mentor copy must not contradict this framing.
- Claude never sees or types `ANTHROPIC_API_KEY`. CT pastes it into `.env.local` and Vercel themselves, same as every other secret in Plan 3.
- Adaptive thinking (`thinking: { type: "adaptive" }`) on every route — never `budget_tokens` (removed on Sonnet 5, returns a 400).

---

### Task 1: The versioned system prompt

**Files:**
- Create: `prompts/mentor.md`
- Create: `src/lib/mentor/systemPrompt.ts`
- Create: `src/lib/mentor/systemPrompt.test.ts`

**Interfaces:**
- Produces: `loadSystemPrompt(): string` — reads and returns the full contents of `prompts/mentor.md`. Every route (Task 7) calls this once per request.

- [ ] **Step 1: Write `prompts/mentor.md`**

```markdown
# Mentor persona

You are CT's mentor inside the Daily Loop — part coach, part trainer, part
the person who actually reads CT's data before saying anything. CT is
single-user; you have no other users and no reason to hedge with
generic advice. Speak directly to CT as "you".

## Voice by state

CT's current state is given to you in `<today>`. Match the voice to it —
this is the single most important rule in this file.

- **ready** — Firm coach. Raise the bar. Hold CT to their own word. Name
  excuses when you see them, without cruelty.
- **drifting** — Drill sergeant. Direct, structured, no lectures. Give one
  immediate action, not a plan.
- **depleted** — Protective. Gentle, no guilt. Basics first: sleep, food,
  water, one small thing. Do not push training or deep work.
- **grinding** — Blunt about burnout risk even if CT says they feel fine.
  Insist on rest. This is the one state where you overrule CT's stated
  preference.

## Writing rules (every state, every route)

- Short. If you can cut a sentence, cut it.
- One clear next action, not a menu of options.
- No walls of text — CT has ADHD; length itself is a cost.
- Make progress visible: name what changed, what's holding, what's next.
- No shame language, ever. Never mention streaks or "days in a row".
  Attributes and badges never fall. Resting while depleted earns double
  XP and you should say so like it's a win, not a consolation. Grinding
  while depleted earns zero training XP — call it "Injury risk", never
  "wasted" or "a failure".
- Never frame a missed day, a skipped session, or a dropped block as a
  moral failure. Data that wasn't logged is unknown, not bad.

## Safety and crisis handling

If anything CT writes suggests crisis, self-harm, or that they are in
danger, leave coaching mode immediately. Respond with care, not analysis.
Point to the crisis contacts in CT's profile/settings. Set the route's
`crisis` field to `true` when your output format has one. This overrides
every other instruction in this file, including brevity — take the space
you need to respond with care.

For physical pain or possible injury: never give medical or medication
advice. Say stop, and say see a professional. Do not diagnose.

Heavy topics like family or relationship stress: support CT, and also
point them toward real human connection where it fits — you are not a
replacement for the people in CT's life.

## What you're given

Your context always includes: this persona, CT's profile (goals, values,
what works, what doesn't), recent weekly letters and daily digests, and
today's plan, state, and check-ins. Anything CT marked "just for me" has
already been stripped before it reached you — you will never see it, and
you should never imply that something is being withheld from you.
```

- [ ] **Step 2: Write the failing test**

`src/lib/mentor/systemPrompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadSystemPrompt } from './systemPrompt';

describe('loadSystemPrompt', () => {
  it('returns the full mentor persona, including the crisis instructions', () => {
    const prompt = loadSystemPrompt();
    expect(prompt).toContain('Voice by state');
    expect(prompt).toContain('leave coaching mode immediately');
    expect(prompt).toContain('No shame language');
  });
});
```

- [ ] **Step 3: Run it to see it fail**

```bash
npm test -- src/lib/mentor/systemPrompt.test.ts
```

Expected: FAIL — `./systemPrompt` does not exist.

- [ ] **Step 4: Write `src/lib/mentor/systemPrompt.ts`**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads the versioned mentor persona fresh on every call — cheap (one small
 * file) and means an edit to prompts/mentor.md takes effect without a
 * redeploy in dev, and is trivially correct after one in production. */
export function loadSystemPrompt(): string {
  return readFileSync(join(process.cwd(), 'prompts', 'mentor.md'), 'utf-8');
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/systemPrompt.test.ts
```

Expected: PASS.

- [ ] **Step 6: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 7: Commit**

```bash
git add prompts/mentor.md src/lib/mentor/systemPrompt.ts src/lib/mentor/systemPrompt.test.ts
git commit -m "feat(mentor): versioned system prompt and its loader

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Local crisis-keyword backup check (pure)

**Files:**
- Create: `src/core/mentor/crisis.ts`
- Create: `src/core/mentor/crisis.test.ts`

**Interfaces:**
- Produces: `checkCrisisKeywords(texts: string[]): boolean` — pure, case-insensitive. Task 7's routes call this on every free-text field of that day's/week's check-ins as a backup to the model's own `crisis` flag, so the contacts card can show even when Claude is capped or unavailable (spec §11).

- [ ] **Step 1: Write the failing test**

`src/core/mentor/crisis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkCrisisKeywords } from './crisis';

describe('checkCrisisKeywords', () => {
  it('flags a direct mention of suicide', () => {
    expect(checkCrisisKeywords(['I keep thinking about suicide'])).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(checkCrisisKeywords(['SELF HARM again tonight'])).toBe(true);
  });

  it('checks every string in the array, not just the first', () => {
    expect(checkCrisisKeywords(['fine', 'training went ok', 'want to end it all'])).toBe(true);
  });

  it('returns false for ordinary hard-day text', () => {
    expect(checkCrisisKeywords(['rough day, stressed about school', 'tired'])).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(checkCrisisKeywords([])).toBe(false);
  });

  it('does not false-positive on an unrelated substring', () => {
    // "kill" appears in "overkill" — must not trigger on substrings inside
    // an unrelated word.
    expect(checkCrisisKeywords(['that training was overkill honestly'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/core/mentor/crisis.test.ts
```

Expected: FAIL — `./crisis` does not exist.

- [ ] **Step 3: Write `src/core/mentor/crisis.ts`**

```ts
/** Spec §11: a backup that works even when Claude is capped or unavailable.
 * Deliberately narrow — false negatives (missing a real crisis mention) are
 * far better tolerated here than false positives (the model's own judgment
 * in the system prompt is the primary signal; this is the net underneath). */
const CRISIS_PATTERNS = [
  /\bsuicid\w*/i,
  /\bself[\s-]?harm\w*/i,
  /\bkill(ing)?\s+myself\b/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bhurt(ing)?\s+myself\b/i,
];

/** Pure. Checks every string in `texts` against a fixed keyword/phrase list. */
export function checkCrisisKeywords(texts: string[]): boolean {
  return texts.some((text) => CRISIS_PATTERNS.some((pattern) => pattern.test(text)));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/core/mentor/crisis.test.ts
```

Expected: PASS, all 6 assertions.

- [ ] **Step 5: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/core/mentor/crisis.ts src/core/mentor/crisis.test.ts
git commit -m "feat(core): local crisis-keyword backup check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Fallback copy (pure) — cap-reached message and per-route canned fallbacks

**Files:**
- Create: `src/core/mentor/fallback.ts`
- Create: `src/core/mentor/fallback.test.ts`

**Interfaces:**
- Consumes: `Route` type this task defines: `'briefing' | 'eveningReview' | 'weeklyReview' | 'chat' | 'reflowComment'` — the same five names Task 7's route files use, and the same names written to `usage.route` / `mentor_messages.route`.
- Produces: `capReachedMessage(now: Date): string`, `routeFallbackText(route: 'briefing' | 'chat' | 'reflowComment'): string`, `eveningReviewFallback(): { message: string; digest: string; tomorrowNote: string; crisis: false }`, `weeklyReviewFallback(): { letter: string; changes: []; crisis: false }`.

- [ ] **Step 1: Write the failing test**

`src/core/mentor/fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { capReachedMessage, eveningReviewFallback, routeFallbackText, weeklyReviewFallback } from './fallback';

describe('capReachedMessage', () => {
  it('names the first of the following month when today is mid-month', () => {
    const msg = capReachedMessage(new Date('2026-09-14T12:00:00Z'));
    expect(msg).toBe("Mentor's resting until October 1 — your plan, nudges and guard are all still running.");
  });

  it('rolls over the year when today is in December', () => {
    const msg = capReachedMessage(new Date('2026-12-20T12:00:00Z'));
    expect(msg).toBe("Mentor's resting until January 1 — your plan, nudges and guard are all still running.");
  });
});

describe('routeFallbackText', () => {
  it('gives each text route its own fallback, none of them shame-worded', () => {
    for (const route of ['briefing', 'chat', 'reflowComment'] as const) {
      const text = routeFallbackText(route);
      expect(text.length).toBeGreaterThan(0);
      expect(text.toLowerCase()).not.toContain('fail');
      expect(text.toLowerCase()).not.toContain('streak');
    }
  });
});

describe('eveningReviewFallback', () => {
  it('is a well-formed non-crisis structured fallback', () => {
    const fallback = eveningReviewFallback();
    expect(fallback.crisis).toBe(false);
    expect(fallback.message.length).toBeGreaterThan(0);
    expect(fallback.digest.length).toBeGreaterThan(0);
  });
});

describe('weeklyReviewFallback', () => {
  it('is a well-formed non-crisis structured fallback with no profile changes', () => {
    const fallback = weeklyReviewFallback();
    expect(fallback.crisis).toBe(false);
    expect(fallback.changes).toEqual([]);
    expect(fallback.letter.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/core/mentor/fallback.test.ts
```

Expected: FAIL — `./fallback` does not exist.

- [ ] **Step 3: Write `src/core/mentor/fallback.ts`**

```ts
export type Route = 'briefing' | 'eveningReview' | 'weeklyReview' | 'chat' | 'reflowComment';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Spec §8.5, exact copy. Interpolates the real 1st-of-next-month date. */
export function capReachedMessage(now: Date): string {
  const nextMonth = (now.getUTCMonth() + 1) % 12;
  const label = `${MONTH_NAMES[nextMonth]} 1`;
  return `Mentor's resting until ${label} — your plan, nudges and guard are all still running.`;
}

const TEXT_FALLBACKS: Record<'briefing' | 'chat' | 'reflowComment', string> = {
  briefing: "Mentor's unavailable right now. Today's plan is below — check in with yourself before you start.",
  chat: "Mentor's unavailable right now. Try again in a bit — your plan, nudges and guard are all still running.",
  reflowComment: "Mentor's unavailable right now.",
};

/** Spec §12: one retry happens inside the SDK before a caller ever sees this. */
export function routeFallbackText(route: 'briefing' | 'chat' | 'reflowComment'): string {
  return TEXT_FALLBACKS[route];
}

export function eveningReviewFallback(): { message: string; digest: string; tomorrowNote: string; crisis: false } {
  return {
    message: "Mentor's unavailable right now, but the day is logged.",
    digest: 'Day logged — mentor summary unavailable tonight.',
    tomorrowNote: '',
    crisis: false,
  };
}

export function weeklyReviewFallback(): { letter: string; changes: []; crisis: false } {
  return {
    letter: "Mentor's unavailable right now — this week's letter will catch up next time. Your profile is unchanged.",
    changes: [],
    crisis: false,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/core/mentor/fallback.test.ts
```

Expected: PASS, all 6 assertions.

- [ ] **Step 5: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/core/mentor/fallback.ts src/core/mentor/fallback.test.ts
git commit -m "feat(core): mentor fallback copy — cap-reached message and per-route canned text

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Anthropic client factory

**Files:**
- Create: `src/lib/anthropic/client.ts`

**Interfaces:**
- Produces: `createAnthropicClient(): Anthropic` — zero-arg; the SDK resolves `ANTHROPIC_API_KEY` from the environment itself. Task 7's route services and Task 10's tone-check script both call this.

No test for this task — it is a one-line factory with nothing to unit-test beyond "constructs an `Anthropic` instance", which is the SDK's own responsibility, not ours. Verified by Task 7's route-service tests (which construct their own fake and never call this factory) and by Task 10's manual run against the real API.

- [ ] **Step 1: Write `src/lib/anthropic/client.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';

/** Reads ANTHROPIC_API_KEY from the environment — Claude never sees this
 * value; CT pastes it into .env.local and Vercel themselves. */
export function createAnthropicClient(): Anthropic {
  return new Anthropic();
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/anthropic/client.ts
git commit -m "feat(mentor): Anthropic client factory

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Usage recording and the month-to-date cap gate

**Files:**
- Create: `src/lib/mentor/usage.ts`
- Create: `src/lib/mentor/usage.test.ts`

**Interfaces:**
- Consumes: `computeCostUsd`, `capStatus`, `UsageTokens`, `CapStatus` (all from `@/core/mentor/cost`, unmodified); `repositories`, `RepositoryClient` (`@/lib/db/repositories`, `@/lib/db/repository`); `UsageRow` (`@/lib/db/schemas`).
- Produces: `extractUsage(message: Anthropic.Message): UsageTokens` — maps the SDK's snake_case usage fields to our camelCase `UsageTokens`. `recordUsage(client, params: { ownerId: string; route: Route; model: string; usage: UsageTokens }): Promise<UsageRow>` — computes cost and writes the row. `checkCap(client, ownerId: string, monthlyCapUsd: number, now: Date): Promise<CapStatus>` — sums this calendar month's `cost_usd` and calls `capStatus`. Task 7's every route calls `checkCap` before calling Anthropic, and `recordUsage` after.

- [ ] **Step 1: Write the failing test**

`src/lib/mentor/usage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { checkCap, extractUsage, recordUsage } from './usage';

function fakeClient(existingUsageRows: Record<string, unknown>[]) {
  const rows = [...existingUsageRows];
  return {
    from: (table: string) => {
      if (table !== 'usage') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          match: async () => ({ data: rows, error: null }),
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } satisfies RepositoryClient;
}

describe('extractUsage', () => {
  it('maps the SDK message usage fields to UsageTokens', () => {
    const message = {
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 10 },
    } as Anthropic.Message;
    expect(extractUsage(message)).toEqual({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 20, cacheWriteTokens: 10 });
  });

  it('defaults missing cache fields to zero', () => {
    const message = { usage: { input_tokens: 5, output_tokens: 3 } } as Anthropic.Message;
    expect(extractUsage(message)).toEqual({ inputTokens: 5, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });
});

describe('recordUsage', () => {
  it('computes cost from the model price table and writes a usage row', async () => {
    const client = fakeClient([]);
    const row = await recordUsage(client, {
      ownerId: 'ct',
      route: 'briefing',
      model: 'claude-sonnet-5',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    expect(row.cost_usd).toBe(2); // $2 / 1M input tokens for claude-sonnet-5
    expect(row.route).toBe('briefing');
  });
});

describe('checkCap', () => {
  it('sums only this calendar month\'s cost and reports over when spend >= cap', async () => {
    const client = fakeClient([
      { id: 'a', owner_id: 'ct', created_at: '2026-09-01T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 6 },
      { id: 'b', owner_id: 'ct', created_at: '2026-08-15T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 100 },
    ]);
    const status = await checkCap(client, 'ct', 12, new Date('2026-09-20T00:00:00Z'));
    expect(status.spentUsd).toBe(6); // August's row is excluded
    expect(status.over).toBe(false);
  });

  it('reports over once this month\'s spend reaches the cap', async () => {
    const client = fakeClient([
      { id: 'a', owner_id: 'ct', created_at: '2026-09-05T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 },
    ]);
    const status = await checkCap(client, 'ct', 12, new Date('2026-09-20T00:00:00Z'));
    expect(status.over).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/lib/mentor/usage.test.ts
```

Expected: FAIL — `./usage` does not exist.

- [ ] **Step 3: Write `src/lib/mentor/usage.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { capStatus, type CapStatus, computeCostUsd, type UsageTokens } from '@/core/mentor/cost';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { UsageRow } from '@/lib/db/schemas';
import type { Route } from '@/core/mentor/fallback';

/** Maps the Anthropic SDK's snake_case usage fields to our UsageTokens. */
export function extractUsage(message: Anthropic.Message): UsageTokens {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export interface RecordUsageParams {
  ownerId: string;
  route: Route;
  model: string;
  usage: UsageTokens;
}

/** Spec §8.5: every call writes a usage row with the computed cost. */
export async function recordUsage(client: RepositoryClient, params: RecordUsageParams): Promise<UsageRow> {
  const costUsd = computeCostUsd(params.model, params.usage);
  return repositories(client).usage.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    created_at: new Date().toISOString(),
    route: params.route,
    model: params.model,
    input_tokens: params.usage.inputTokens,
    output_tokens: params.usage.outputTokens,
    cache_read_tokens: params.usage.cacheReadTokens,
    cache_write_tokens: params.usage.cacheWriteTokens,
    cost_usd: costUsd,
  });
}

/** Spec §8.5: before each call, check month-to-date spend against the cap.
 * "Month" is the calendar month of `now` in UTC — good enough for a single
 * user's own cap check; the exact timezone boundary doesn't matter here the
 * way it does for the plan-day clock. */
export async function checkCap(client: RepositoryClient, ownerId: string, monthlyCapUsd: number, now: Date): Promise<CapStatus> {
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const rows = await repositories(client).usage.list({ owner_id: ownerId });
  const spentUsd = rows.filter((r) => r.created_at.startsWith(monthStart)).reduce((sum, r) => sum + r.cost_usd, 0);
  return capStatus(spentUsd, monthlyCapUsd);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/mentor/usage.test.ts
```

Expected: PASS, all 6 assertions.

- [ ] **Step 5: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/usage.ts src/lib/mentor/usage.test.ts
git commit -m "feat(mentor): usage recording and month-to-date cap gate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Data-assembly layer — build a full `MentorContextInput` from the DB

**Files:**
- Create: `src/lib/mentor/assembleContext.ts`
- Create: `src/lib/mentor/assembleContext.test.ts`

**Interfaces:**
- Consumes: `MentorContextInput`, `CheckinRecord` (`@/core/mentor/context`, unmodified); `Profile`, `emptyProfile` (`@/core/mentor/profile`, unmodified); `repositories` (`@/lib/db/repositories`).
- Produces: `assembleMentorContext(client, params: { systemPrompt: string; date: string; request: string; chatHistory?: { role: 'user' | 'assistant'; content: string }[] }): Promise<MentorContextInput>`. Every route in Task 7 calls this, then passes the result straight into `buildMentorContext` from `@/core/mentor/context`.

- [ ] **Step 1: Write the failing test**

`src/lib/mentor/assembleContext.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '@/lib/db/repository';
import { assembleMentorContext } from './assembleContext';

function fakeClient(seed: {
  profileVersions?: Record<string, unknown>[];
  weeklyLetters?: Record<string, unknown>[];
  digests?: Record<string, unknown>[];
  plans?: Record<string, unknown>[];
  blocks?: Record<string, unknown>[];
  checkins?: Record<string, unknown>[];
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    profile_versions: seed.profileVersions ?? [],
    weekly_letters: seed.weeklyLetters ?? [],
    digests: seed.digests ?? [],
    plans: seed.plans ?? [],
    blocks: seed.blocks ?? [],
    checkins: seed.checkins ?? [],
  };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: (col: string, value: unknown) => ({
          maybeSingle: async () => ({ data: (tables[table] ?? []).find((r) => r[col] === value) ?? null, error: null }),
        }),
      }),
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('assembleMentorContext', () => {
  it('falls back to an empty profile when no profile_versions row exists', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.profile.goalsPhysical).toBe('');
  });

  it('uses the most recently created profile version', async () => {
    const client = fakeClient({
      profileVersions: [
        { id: 'v1', owner_id: 'x', created_at: '2026-09-01T00:00:00Z', sections: { goalsPhysical: 'old' }, author: 'user', changes: [] },
        { id: 'v2', owner_id: 'x', created_at: '2026-09-10T00:00:00Z', sections: { goalsPhysical: 'new' }, author: 'user', changes: [] },
      ],
    });
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.profile.goalsPhysical).toBe('new');
  });

  it('falls back to state ready with no flags/adjustments when no plan row exists for the date', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.today.state).toBe('ready');
    expect(input.today.flags).toEqual([]);
    expect(input.today.adjustments).toEqual([]);
    expect(input.today.overridden).toBe(false);
  });

  it('reads the real plan row, blocks, and checkins for the date', async () => {
    const client = fakeClient({
      plans: [{ date: '2026-09-14', owner_id: 'x', state: 'drifting', flags: [{ code: 'INDULGE_HIGH', state: 'drifting', reason: 'x' }], adjustments: [], overridden: true }],
      blocks: [{ id: 'b1', owner_id: 'x', date: '2026-09-14', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: 540, end: 600, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null, status: 'planned', source: 'template' }],
      checkins: [{ id: 'c1', owner_id: 'x', date: '2026-09-14', type: 'morning', sections: { mind: { mood: 6, stress: 3, stressCause: [] } }, private_keys: [], created_at: '2026-09-14T07:00:00Z' }],
    });
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.today.state).toBe('drifting');
    expect(input.today.overridden).toBe(true);
    expect(input.today.blocks).toHaveLength(1);
    expect(input.today.checkins).toHaveLength(1);
    expect(input.today.checkins[0]!.privateKeys).toEqual([]);
  });

  it('passes the system prompt, request, and chat history straight through', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, {
      systemPrompt: 'the persona',
      date: '2026-09-14',
      request: 'What should I do today?',
      chatHistory: [{ role: 'user', content: 'hi' }],
    });
    expect(input.systemPrompt).toBe('the persona');
    expect(input.request).toBe('What should I do today?');
    expect(input.chatHistory).toEqual([{ role: 'user', content: 'hi' }]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/lib/mentor/assembleContext.test.ts
```

Expected: FAIL — `./assembleContext` does not exist.

- [ ] **Step 3: Write `src/lib/mentor/assembleContext.ts`**

```ts
import type { CheckinRecord, MentorContextInput } from '@/core/mentor/context';
import { emptyProfile, type Profile } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface AssembleContextParams {
  systemPrompt: string;
  date: string;
  request: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

/** Spec §8.3: builds the full MentorContextInput from the DB for one
 * date/request. Every field here feeds straight into buildMentorContext
 * (@/core/mentor/context, unmodified) — this module only fetches and shapes,
 * it never decides what the model sees or in what order. */
export async function assembleMentorContext(client: RepositoryClient, params: AssembleContextParams): Promise<MentorContextInput> {
  const repos = repositories(client);

  const [profileVersions, weeklyLetterRows, digestRows, planRows, blockRows, checkinRows] = await Promise.all([
    repos.profileVersions.list(),
    repos.weeklyLetters.list(),
    repos.digests.list(),
    repos.plans.list({ date: params.date } as never),
    repos.blocks.list({ date: params.date } as never),
    repos.checkins.list({ date: params.date } as never),
  ]);

  const latestProfileVersion = [...profileVersions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const profile: Profile = latestProfileVersion ? (latestProfileVersion.sections as Profile) : emptyProfile();

  const plan = planRows[0];

  const checkins: CheckinRecord[] = checkinRows.map((c) => ({
    type: c.type,
    sections: c.sections,
    privateKeys: c.private_keys,
  }));

  return {
    systemPrompt: params.systemPrompt,
    profile,
    weeklyLetters: weeklyLetterRows.map((w) => ({ weekStart: w.week_start, letter: w.letter })),
    digests: digestRows.map((d) => ({ date: d.date, text: d.text })),
    today: {
      date: params.date,
      state: plan?.state ?? 'ready',
      flags: (plan?.flags ?? []) as MentorContextInput['today']['flags'],
      adjustments: (plan?.adjustments ?? []) as MentorContextInput['today']['adjustments'],
      overridden: plan?.overridden ?? false,
      blocks: blockRows.map((b) => ({
        id: b.id,
        title: b.title,
        kind: b.kind,
        anchor: b.anchor,
        priority: b.priority,
        start: b.start,
        end: b.end,
        minMinutes: b.min_minutes,
        window: b.window_start !== null && b.window_end !== null ? { earliestStart: b.window_start, latestEnd: b.window_end } : null,
        tags: b.tags,
        checklist: b.checklist,
        recoveryVariant: b.recovery_variant,
        status: b.status,
        source: b.source,
      })),
      checkins,
    },
    request: params.request,
    chatHistory: params.chatHistory,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/mentor/assembleContext.test.ts
```

Expected: PASS, all 7 assertions.

- [ ] **Step 5: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/assembleContext.ts src/lib/mentor/assembleContext.test.ts
git commit -m "feat(mentor): assemble a full MentorContextInput from the DB

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: The five mentor routes

**Files:**
- Create: `src/lib/mentor/routes/briefing.ts`
- Create: `src/lib/mentor/routes/briefing.test.ts`
- Create: `src/lib/mentor/routes/eveningReview.ts`
- Create: `src/lib/mentor/routes/eveningReview.test.ts`
- Create: `src/lib/mentor/routes/weeklyReview.ts`
- Create: `src/lib/mentor/routes/weeklyReview.test.ts`
- Create: `src/lib/mentor/routes/chat.ts`
- Create: `src/lib/mentor/routes/chat.test.ts`
- Create: `src/lib/mentor/routes/reflowComment.ts`
- Create: `src/lib/mentor/routes/reflowComment.test.ts`

**Interfaces:**
- Consumes: `buildMentorContext` (`@/core/mentor/context`, unmodified), `checkCap`/`recordUsage`/`extractUsage` (Task 5), `assembleMentorContext` (Task 6), `checkCrisisKeywords` (Task 2), `routeFallbackText`/`eveningReviewFallback`/`weeklyReviewFallback`/`capReachedMessage` (Task 3), `applyProfileChanges`/`PROFILE_SECTIONS` (`@/core/mentor/profile`, unmodified), `repositories` (`@/lib/db/repositories`).
- Produces (all take `client: RepositoryClient, anthropic: Anthropic, params: { ownerId: string; model: string; monthlyCapUsd: number }` plus their own route-specific params):
  - `briefing(client, anthropic, params, date: string): Promise<{ text: string; fallback: boolean }>`
  - `eveningReview(client, anthropic, params, date: string): Promise<{ message: string; digest: string; tomorrowNote: string; crisis: boolean; fallback: boolean }>`
  - `weeklyReview(client, anthropic, params, weekStart: string): Promise<{ letter: string; changes: { section: string; newText: string; reason: string }[]; crisis: boolean; fallback: boolean }>`
  - `reflowComment(client, anthropic, params, date: string, diffSummary: string): Promise<{ text: string; fallback: boolean }>`
  - `chat(client, anthropic, params, date: string, message: string): AsyncGenerator<string, { fallback: boolean }, void>` — yields text chunks as they stream; the generator's return value carries whether the run ended in fallback.

All five log every non-fallback exchange to `mentor_messages` (Task 9 wires this in — see that task's note on why it's split out).

- [ ] **Step 1: Write the failing test for `briefing`**

`src/lib/mentor/routes/briefing.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { briefing } from './briefing';

function fakeClient() {
  const usageRows: Record<string, unknown>[] = [];
  const tables: Record<string, Record<string, unknown>[]> = { usage: usageRows };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            (tables[table] ??= []).push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

function fakeAnthropicSuccess(text: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    },
  } as unknown as Anthropic;
}

function fakeAnthropicError() {
  return { messages: { create: vi.fn().mockRejectedValue(new Error('network error')) } } as unknown as Anthropic;
}

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

describe('briefing', () => {
  it('returns the model text and records usage on success', async () => {
    const client = fakeClient();
    const result = await briefing(client, fakeAnthropicSuccess("Today: one deep-work block, then rest."), baseParams, '2026-09-14');
    expect(result.fallback).toBe(false);
    expect(result.text).toBe('Today: one deep-work block, then rest.');
  });

  it('falls back without calling the model when month-to-date spend is at the cap', async () => {
    const client = fakeClient();
    await client
      .from('usage')
      .upsert({ id: 'a', owner_id: 'ct', created_at: new Date().toISOString(), route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 })
      .select('*')
      .single();
    const anthropic = fakeAnthropicSuccess('should not be called');
    const result = await briefing(client, anthropic, baseParams, '2026-09-14');
    expect(result.fallback).toBe(true);
    expect(result.text).toContain("Mentor's resting until");
    expect(anthropic.messages.create).not.toHaveBeenCalled();
  });

  it('falls back to the canned briefing message when the Anthropic call throws', async () => {
    const client = fakeClient();
    const result = await briefing(client, fakeAnthropicError(), baseParams, '2026-09-14');
    expect(result.fallback).toBe(true);
    expect(result.text).toContain("Mentor's unavailable right now");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/lib/mentor/routes/briefing.test.ts
```

Expected: FAIL — `./briefing` does not exist.

- [ ] **Step 3: Write `src/lib/mentor/routes/briefing.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';

export interface MentorRouteParams {
  ownerId: string;
  model: string;
  monthlyCapUsd: number;
}

const BRIEFING_INSTRUCTION =
  "Give CT their morning briefing: today's top 3 priorities, in your voice for their current state. Plain text, no headings, under ~120 words.";

export async function briefing(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
): Promise<{ text: string; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { text: capReachedMessage(new Date()), fallback: true };

  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: BRIEFING_INSTRUCTION });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    await recordUsage(client, { ownerId: params.ownerId, route: 'briefing', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return { text: textBlock?.text ?? routeFallbackText('briefing'), fallback: false };
  } catch {
    return { text: routeFallbackText('briefing'), fallback: true };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/routes/briefing.test.ts
```

Expected: PASS, all 3 assertions.

- [ ] **Step 5: Write the failing test for `eveningReview`**

`src/lib/mentor/routes/eveningReview.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { eveningReview } from './eveningReview';

function fakeClient(checkinSections: Record<string, Record<string, unknown>> = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    checkins: [
      {
        id: 'c1', owner_id: 'ct', date: '2026-09-14', type: 'evening',
        sections: checkinSections, private_keys: [], created_at: '2026-09-14T21:00:00Z',
      },
    ],
    usage: [],
  };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { (tables[table] ??= []).push(row); return { data: row, error: null }; } }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

function fakeAnthropicParse(parsed: unknown) {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({
        parsed_output: parsed,
        usage: { input_tokens: 800, output_tokens: 150, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    },
  } as unknown as Anthropic;
}

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

describe('eveningReview', () => {
  it('returns the parsed structured output on success', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicParse({ message: 'Solid day.', digest: 'Trained, slept ok.', tomorrowNote: 'Deep work first.', crisis: false });
    const result = await eveningReview(client, anthropic, baseParams, '2026-09-14');
    expect(result).toEqual({ message: 'Solid day.', digest: 'Trained, slept ok.', tomorrowNote: 'Deep work first.', crisis: false, fallback: false });
  });

  it('forces crisis true when the local keyword check fires, even if the model said false', async () => {
    const client = fakeClient({ reflection: { lessonOfDay: 'want to end it all today' } });
    const anthropic = fakeAnthropicParse({ message: 'x', digest: 'x', tomorrowNote: '', crisis: false });
    const result = await eveningReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.crisis).toBe(true);
  });

  it('falls back when parsed_output is null (structured parse failed)', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicParse(null);
    const result = await eveningReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.fallback).toBe(true);
    expect(result.crisis).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to see it fail**

```bash
npm test -- src/lib/mentor/routes/eveningReview.test.ts
```

Expected: FAIL — `./eveningReview` does not exist.

- [ ] **Step 7: Write `src/lib/mentor/routes/eveningReview.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { buildMentorContext } from '@/core/mentor/context';
import { checkCrisisKeywords } from '@/core/mentor/crisis';
import { capReachedMessage, eveningReviewFallback } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { repositories } from '@/lib/db/repositories';
import type { MentorRouteParams } from './briefing';

const EveningReviewSchema = z.object({
  message: z.string(),
  digest: z.string(),
  tomorrowNote: z.string(),
  crisis: z.boolean(),
});

const EVENING_REVIEW_INSTRUCTION =
  "Write the evening review: a short message to CT, a ~100-word daily digest, and a preview of tomorrow. Set crisis true only if something in today's check-ins suggests crisis or self-harm.";

/** Every free-text value nested anywhere in a checkin's sections, for the
 * local crisis-keyword backup check. */
function freeTextValues(sections: Record<string, Record<string, unknown>>): string[] {
  return Object.values(sections).flatMap((fields) =>
    Object.values(fields).filter((v): v is string => typeof v === 'string'),
  );
}

export async function eveningReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
): Promise<{ message: string; digest: string; tomorrowNote: string; crisis: boolean; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { ...eveningReviewFallback(), message: capReachedMessage(new Date()) };

  const eveningCheckins = await repositories(client).checkins.list({ date, type: 'evening' } as never);
  const localCrisis = eveningCheckins.some((c) => checkCrisisKeywords(freeTextValues(c.sections)));

  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: EVENING_REVIEW_INSTRUCTION });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.parse({
      model: params.model,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: zodOutputFormat(EveningReviewSchema) },
      system: ctx.system,
      messages: ctx.messages,
    });
    if (!response.parsed_output) return { ...eveningReviewFallback(), crisis: localCrisis, fallback: true };
    await recordUsage(client, { ownerId: params.ownerId, route: 'eveningReview', model: params.model, usage: extractUsage(response) });
    return { ...response.parsed_output, crisis: response.parsed_output.crisis || localCrisis, fallback: false };
  } catch {
    return { ...eveningReviewFallback(), crisis: localCrisis, fallback: true };
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/routes/eveningReview.test.ts
```

Expected: PASS, all 3 assertions.

- [ ] **Step 9: Write the failing test for `weeklyReview`**

`src/lib/mentor/routes/weeklyReview.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { weeklyReview } from './weeklyReview';

function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = { usage: [] };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { (tables[table] ??= []).push(row); return { data: row, error: null }; } }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

function fakeAnthropicParse(parsed: unknown) {
  return {
    messages: {
      parse: vi.fn().mockResolvedValue({
        parsed_output: parsed,
        usage: { input_tokens: 2000, output_tokens: 400, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    },
  } as unknown as Anthropic;
}

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

describe('weeklyReview', () => {
  it('returns the letter and changes on success', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicParse({
      letter: 'Good week.',
      changes: [{ section: 'whatWorks', newText: 'Morning training', reason: 'Consistent this week' }],
      crisis: false,
    });
    const result = await weeklyReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.fallback).toBe(false);
    expect(result.changes).toHaveLength(1);
  });

  it('drops a change naming an unknown profile section rather than trusting the model blindly', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicParse({
      letter: 'Good week.',
      changes: [
        { section: 'whatWorks', newText: 'Morning training', reason: 'x' },
        { section: 'notARealSection', newText: 'x', reason: 'x' },
      ],
      crisis: false,
    });
    const result = await weeklyReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.changes).toEqual([{ section: 'whatWorks', newText: 'Morning training', reason: 'x' }]);
  });

  it('falls back when parsed_output is null', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicParse(null);
    const result = await weeklyReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.fallback).toBe(true);
    expect(result.changes).toEqual([]);
  });
});
```

- [ ] **Step 10: Run it to see it fail**

```bash
npm test -- src/lib/mentor/routes/weeklyReview.test.ts
```

Expected: FAIL — `./weeklyReview` does not exist.

- [ ] **Step 11: Write `src/lib/mentor/routes/weeklyReview.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, weeklyReviewFallback } from '@/core/mentor/fallback';
import { PROFILE_SECTIONS } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import type { MentorRouteParams } from './briefing';

const WeeklyReviewSchema = z.object({
  letter: z.string(),
  changes: z.array(z.object({ section: z.string(), newText: z.string(), reason: z.string() })),
  crisis: z.boolean(),
});

const WEEKLY_REVIEW_INSTRUCTION =
  'Write the weekly letter: S1-S4 metrics, training sessions done vs planned, indulgence trend, one pattern, one focus for next week. Then propose profile changes as {section, newText, reason} — one change per section you touch.';

const VALID_SECTIONS = new Set(PROFILE_SECTIONS.map((s) => s.key));

export async function weeklyReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  weekStart: string,
): Promise<{ letter: string; changes: { section: string; newText: string; reason: string }[]; crisis: boolean; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { ...weeklyReviewFallback(), letter: capReachedMessage(new Date()) };

  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date: weekStart, request: WEEKLY_REVIEW_INSTRUCTION });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.parse({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(WeeklyReviewSchema) },
      system: ctx.system,
      messages: ctx.messages,
    });
    if (!response.parsed_output) return { ...weeklyReviewFallback(), fallback: true };
    await recordUsage(client, { ownerId: params.ownerId, route: 'weeklyReview', model: params.model, usage: extractUsage(response) });
    // Unknown sections are dropped, never trusted blindly — a bad model
    // output must not corrupt the profile (mirrors applyProfileChanges'
    // own guard in @/core/mentor/profile, applied here before persistence).
    const changes = response.parsed_output.changes.filter((c) => VALID_SECTIONS.has(c.section as never));
    return { letter: response.parsed_output.letter, changes, crisis: response.parsed_output.crisis, fallback: false };
  } catch {
    return { ...weeklyReviewFallback(), fallback: true };
  }
}
```

- [ ] **Step 12: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/routes/weeklyReview.test.ts
```

Expected: PASS, all 3 assertions.

- [ ] **Step 13: Write the failing test for `reflowComment`**

`src/lib/mentor/routes/reflowComment.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { reflowComment } from './reflowComment';

function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = { usage: [] };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { (tables[table] ??= []).push(row); return { data: row, error: null }; } }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

function fakeAnthropicSuccess(text: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 400, output_tokens: 40, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    },
  } as unknown as Anthropic;
}

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

describe('reflowComment', () => {
  it('returns a short comment on the diff', async () => {
    const client = fakeClient();
    const anthropic = fakeAnthropicSuccess('Deep work moved to 3pm — still fits before wind-down.');
    const result = await reflowComment(client, anthropic, baseParams, '2026-09-14', 'Deep work moved from 9am to 3pm (late event).');
    expect(result.fallback).toBe(false);
    expect(result.text).toContain('Deep work moved');
  });
});
```

- [ ] **Step 14: Run it to see it fail**

```bash
npm test -- src/lib/mentor/routes/reflowComment.test.ts
```

Expected: FAIL — `./reflowComment` does not exist.

- [ ] **Step 15: Write `src/lib/mentor/routes/reflowComment.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import type { MentorRouteParams } from './briefing';

export async function reflowComment(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  diffSummary: string,
): Promise<{ text: string; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { text: capReachedMessage(new Date()), fallback: true };

  const instruction = `CT just reflowed today's plan. Here's what changed: ${diffSummary}\nOne short comment, under ~60 words.`;
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: instruction });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    await recordUsage(client, { ownerId: params.ownerId, route: 'reflowComment', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return { text: textBlock?.text ?? routeFallbackText('reflowComment'), fallback: false };
  } catch {
    return { text: routeFallbackText('reflowComment'), fallback: true };
  }
}
```

- [ ] **Step 16: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/routes/reflowComment.test.ts
```

Expected: PASS, 2 assertions.

- [ ] **Step 17: Write the failing test for `chat`**

`src/lib/mentor/routes/chat.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { chat } from './chat';

function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = { usage: [], mentor_messages: [] };
  return {
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => { (tables[table] ??= []).push(row); return { data: row, error: null }; } }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

/** A fake MessageStream: async-iterable over text-delta events, plus finalMessage(). */
function fakeAnthropicStream(chunks: string[]) {
  const events = chunks.map((text) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } }));
  const stream = {
    [Symbol.asyncIterator]: () => {
      let i = 0;
      return { next: async () => (i < events.length ? { value: events[i++], done: false } : { value: undefined, done: true }) };
    },
    finalMessage: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: chunks.join('') }],
      usage: { input_tokens: 600, output_tokens: 90, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }),
  };
  return { messages: { stream: vi.fn().mockReturnValue(stream) } } as unknown as Anthropic;
}

function fakeAnthropicStreamError() {
  return {
    messages: {
      stream: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({ next: async () => { throw new Error('stream error'); } }),
      }),
    },
  } as unknown as Anthropic;
}

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

async function collect(gen: AsyncGenerator<string, { fallback: boolean }, void>) {
  const chunks: string[] = [];
  let next = await gen.next();
  while (!next.done) {
    chunks.push(next.value);
    next = await gen.next();
  }
  return { chunks, result: next.value };
}

describe('chat', () => {
  it('yields streamed chunks and reports fallback:false on success', async () => {
    const client = fakeClient();
    const gen = chat(client, fakeAnthropicStream(['Deep breath. ', 'Start with the 15-minute win.']), baseParams, '2026-09-14', 'What should I do right now?');
    const { chunks, result } = await collect(gen);
    expect(chunks.join('')).toBe('Deep breath. Start with the 15-minute win.');
    expect(result.fallback).toBe(false);
  });

  it('yields the canned fallback and reports fallback:true when the stream errors', async () => {
    const client = fakeClient();
    const gen = chat(client, fakeAnthropicStreamError(), baseParams, '2026-09-14', 'hi');
    const { chunks, result } = await collect(gen);
    expect(chunks.join('')).toContain("Mentor's unavailable right now");
    expect(result.fallback).toBe(true);
  });

  it('yields the cap message without touching the stream when over cap', async () => {
    const client = fakeClient();
    await client.from('usage').upsert({ id: 'a', owner_id: 'ct', created_at: new Date().toISOString(), route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 }).select('*').single();
    const anthropic = fakeAnthropicStream(['should not run']);
    const gen = chat(client, anthropic, baseParams, '2026-09-14', 'hi');
    const { chunks, result } = await collect(gen);
    expect(chunks.join('')).toContain("Mentor's resting until");
    expect(result.fallback).toBe(true);
    expect(anthropic.messages.stream).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 18: Run it to see it fail**

```bash
npm test -- src/lib/mentor/routes/chat.test.ts
```

Expected: FAIL — `./chat` does not exist.

- [ ] **Step 19: Write `src/lib/mentor/routes/chat.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import type { MentorRouteParams } from './briefing';

/** Last 20 chat messages for `date`, oldest first, mapped to the
 * {role, content} shape buildMentorContext's chatHistory expects. */
async function loadChatHistory(client: RepositoryClient, date: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await repositories(client).mentorMessages.list({ date, route: 'chat' } as never);
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-20)
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/** Spec §8.2: chat is streamed text. Yields text chunks as they arrive;
 * the generator's return value reports whether it ended in fallback, so
 * a Route Handler can decide the HTTP status after the stream finishes. */
export async function* chat(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  message: string,
): AsyncGenerator<string, { fallback: boolean }, void> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) {
    yield capReachedMessage(new Date());
    return { fallback: true };
  }

  const chatHistory = await loadChatHistory(client, date);
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: message, chatHistory });
  const ctx = buildMentorContext(input);

  try {
    const stream = anthropic.messages.stream({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text;
    }
    const final = await stream.finalMessage();
    await recordUsage(client, { ownerId: params.ownerId, route: 'chat', model: params.model, usage: extractUsage(final) });
    return { fallback: false };
  } catch {
    yield routeFallbackText('chat');
    return { fallback: true };
  }
}
```

- [ ] **Step 20: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/routes/chat.test.ts
```

Expected: PASS, all 3 assertions.

- [ ] **Step 21: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 22: Commit**

```bash
git add src/lib/mentor/routes
git commit -m "feat(mentor): the five mentor routes — briefing, eveningReview, weeklyReview, reflowComment, chat

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Route Handlers, and the `/api/*` 401-JSON fix in `proxy.ts`

**Files:**
- Modify: `src/proxy.ts`
- Create: `src/app/api/mentor/briefing/route.ts`
- Create: `src/app/api/mentor/evening-review/route.ts`
- Create: `src/app/api/mentor/weekly-review/route.ts`
- Create: `src/app/api/mentor/reflow-comment/route.ts`
- Create: `src/app/api/mentor/chat/route.ts`

**Interfaces:**
- Consumes: `briefing`, `eveningReview`, `weeklyReview`, `reflowComment`, `chat` (Task 7); `createServerSupabase` (`@/lib/supabase/server`); `createAnthropicClient` (Task 4); `isOwner` (`@/lib/auth/isOwner`); `repositories` (`@/lib/db/repositories`); `DEFAULT_SETTINGS` (`@/core/types`).
- Produces: five POST routes under `/api/mentor/*`, each returning JSON except `chat`, which streams `text/plain` chunks.

- [ ] **Step 1: Fix `src/proxy.ts` — 401 JSON for `/api/*` instead of a redirect**

Read the current file first (it's short), then replace both redirect branches so an API route gets a JSON 401 instead of a 307 to `/login`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isOwner } from '@/lib/auth/isOwner';

/** Refreshes the Supabase session on every request and signs out (redirecting
 * to /login) anyone who isn't OWNER_EMAIL — spec §4.2's server-side gate.
 * API routes (/api/*) get a 401 JSON body instead of a redirect — a fetch
 * client following a 307 to an HTML login page is not a usable error. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');

  if (user && !isOwner(user.email)) {
    await supabase.auth.signOut();
    if (isApiRoute) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isLoginRoute) {
    if (isApiRoute) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Verify the build still compiles**

```bash
npm run typecheck
npm run build
```

Expected: both pass — no test file covers `proxy.ts` (it was already untested; this plan doesn't add middleware tests since the route handlers below independently re-check auth, covered by their own manual verification in Step 8).

- [ ] **Step 3: Write the non-streaming route handlers**

`src/app/api/mentor/briefing/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { briefing } from '@/lib/mentor/routes/briefing';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { date } = (await request.json()) as { date: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();

  const result = await briefing(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
  );
  return NextResponse.json(result);
}
```

`src/app/api/mentor/evening-review/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { eveningReview } from '@/lib/mentor/routes/eveningReview';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { date } = (await request.json()) as { date: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();

  const result = await eveningReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
  );
  return NextResponse.json(result);
}
```

`src/app/api/mentor/weekly-review/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { weeklyReview } from '@/lib/mentor/routes/weeklyReview';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { weekStart } = (await request.json()) as { weekStart: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();

  const result = await weeklyReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    weekStart,
  );
  return NextResponse.json(result);
}
```

`src/app/api/mentor/reflow-comment/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { reflowComment } from '@/lib/mentor/routes/reflowComment';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { date, diffSummary } = (await request.json()) as { date: string; diffSummary: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();

  const result = await reflowComment(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
    diffSummary,
  );
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Write the streaming chat route handler**

`src/app/api/mentor/chat/route.ts`:

```ts
import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { chat } from '@/lib/mentor/routes/chat';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { date, message } = (await request.json()) as { date: string; message: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();
  const params = { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd };

  const generator = chat(client, createAnthropicClient(), params, date, message);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      const next = await generator.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(next.value));
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

- [ ] **Step 5: Typecheck, full suite, and build**

```bash
npm run typecheck
npm test
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/proxy.ts src/app/api/mentor
git commit -m "feat(mentor): route handlers under /api/mentor/*, 401 JSON for API routes in proxy.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Log every exchange to `mentor_messages`

**Files:**
- Create: `src/lib/mentor/logMessage.ts`
- Create: `src/lib/mentor/logMessage.test.ts`
- Modify: `src/lib/mentor/routes/briefing.ts`
- Modify: `src/lib/mentor/routes/eveningReview.ts`
- Modify: `src/lib/mentor/routes/weeklyReview.ts`
- Modify: `src/lib/mentor/routes/reflowComment.ts`
- Modify: `src/lib/mentor/routes/chat.ts`

This is split from Task 7 rather than folded in, because it's the one piece every route shares identically (a `mentor_messages` insert), and doing it as its own task means the logging call is exactly one line per route, added after each was already green — easy to review as a single, obviously-correct diff instead of tangled into five separate feature commits.

**Interfaces:**
- Consumes: `repositories` (`@/lib/db/repositories`); `GuardState` (`@/core/types`).
- Produces: `logMentorMessage(client, params: { ownerId: string; date: string; route: string; role: 'user' | 'assistant'; content: string; stateAtTime: string | null; usageId: string | null }): Promise<void>`.

- [ ] **Step 1: Write the failing test**

`src/lib/mentor/logMessage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '@/lib/db/repository';
import { logMentorMessage } from './logMessage';

function fakeClient() {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from: () => ({
      select: () => ({ match: async () => ({ data: rows, error: null }), eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => { rows.push(row); return { data: row, error: null }; } }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('logMentorMessage', () => {
  it('writes a mentor_messages row with the given fields', async () => {
    const client = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-14', route: 'briefing', role: 'assistant', content: 'Hello', stateAtTime: 'ready', usageId: null });
    expect(client.rows).toHaveLength(1);
    expect(client.rows[0]).toMatchObject({ owner_id: 'ct', date: '2026-09-14', route: 'briefing', role: 'assistant', content: 'Hello', state_at_time: 'ready' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test -- src/lib/mentor/logMessage.test.ts
```

Expected: FAIL — `./logMessage` does not exist.

- [ ] **Step 3: Write `src/lib/mentor/logMessage.ts`**

```ts
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface LogMentorMessageParams {
  ownerId: string;
  date: string;
  route: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  stateAtTime: string | null;
  usageId: string | null;
}

export async function logMentorMessage(client: RepositoryClient, params: LogMentorMessageParams): Promise<void> {
  await repositories(client).mentorMessages.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    date: params.date,
    route: params.route,
    role: params.role,
    content: params.content,
    state_at_time: params.stateAtTime,
    usage_id: params.usageId,
    created_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/lib/mentor/logMessage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire logging into each route**

In `briefing.ts`, after the successful `recordUsage` call, log the assistant turn:

```ts
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'briefing', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? routeFallbackText('briefing');
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'briefing', role: 'assistant', content: text, stateAtTime: input.today.state, usageId: usageRow.id });
    return { text, fallback: false };
```

(this replaces the `recordUsage(...)` call and the two lines after it; add `import { logMentorMessage } from '@/lib/mentor/logMessage';`)

In `eveningReview.ts`, after `recordUsage`:

```ts
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'eveningReview', model: params.model, usage: extractUsage(response) });
    const crisis = response.parsed_output.crisis || localCrisis;
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'eveningReview', role: 'assistant', content: response.parsed_output.message, stateAtTime: input.today.state, usageId: usageRow.id });
    return { ...response.parsed_output, crisis, fallback: false };
```

In `weeklyReview.ts`, after `recordUsage`:

```ts
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'weeklyReview', model: params.model, usage: extractUsage(response) });
    const changes = response.parsed_output.changes.filter((c) => VALID_SECTIONS.has(c.section as never));
    await logMentorMessage(client, { ownerId: params.ownerId, date: weekStart, route: 'weeklyReview', role: 'assistant', content: response.parsed_output.letter, stateAtTime: null, usageId: usageRow.id });
    return { letter: response.parsed_output.letter, changes, crisis: response.parsed_output.crisis, fallback: false };
```

In `reflowComment.ts`, after `recordUsage`:

```ts
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'reflowComment', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? routeFallbackText('reflowComment');
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'reflowComment', role: 'assistant', content: text, stateAtTime: input.today.state, usageId: usageRow.id });
    return { text, fallback: false };
```

In `chat.ts`, log both the user's turn (before the call) and the assistant's turn (after `recordUsage`):

```ts
  const chatHistory = await loadChatHistory(client, date);
  await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'user', content: message, stateAtTime: null, usageId: null });
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: message, chatHistory });
  const ctx = buildMentorContext(input);

  try {
    const stream = anthropic.messages.stream({ /* unchanged */ });
    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'chat', model: params.model, usage: extractUsage(final) });
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'assistant', content: fullText, stateAtTime: input.today.state, usageId: usageRow.id });
    return { fallback: false };
```

- [ ] **Step 6: Update each route's test to expect the log**

Each of the five route test files gets `mentor_messages: []` added to its `fakeClient()`'s `tables` map (already the shape those fakes use — `usage` is already a key; add `mentor_messages` alongside it) so the new `upsert('mentor_messages', ...)` call in the success path has somewhere to write. No assertions need to change — the existing assertions on `result.text` / `result.fallback` etc. still hold; this step only prevents a "table not found" surprise if a fake didn't already default missing tables to `[]`. Check each fake's `tables` object already defaults via `(tables[table] ??= [])` in `upsert` (all except `assembleContext.test.ts`'s fake, which isn't touched by this task) — for `chat.test.ts`, `mentor_messages` was already listed in Step 17's fake; for `briefing.test.ts`, `eveningReview.test.ts`, `weeklyReview.test.ts`, and `reflowComment.test.ts`, confirm their `upsert` handlers use `(tables[table] ??= []).push(row)` (they do, from Task 7) — no edit needed.

- [ ] **Step 7: Run the full mentor test suite**

```bash
npm test -- src/lib/mentor
```

Expected: PASS, every test from Tasks 5-9.

- [ ] **Step 8: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/mentor
git commit -m "feat(mentor): log every exchange to mentor_messages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Fixture days and the manual tone-check script (CT-approved, real API cost)

**Files:**
- Create: `src/core/testing/mentorFixtures.ts`
- Create: `scripts/mentor-tone-check.ts`

**Interfaces:**
- Consumes: `MentorContextInput` (`@/core/mentor/context`); `DEFAULT_THRESHOLDS`, `GuardState` (`@/core/types`); `loadSystemPrompt` (Task 1); `emptyProfile` (`@/core/mentor/profile`); `createAnthropicClient` (Task 4).
- Produces: `MENTOR_FIXTURE_DAYS: Record<GuardState, MentorContextInput>` — one fixture per state, reusable by any future test that needs a realistic sample day (Plan 5's screen tests, for instance) without duplicating the shape.

- [ ] **Step 1: Write `src/core/testing/mentorFixtures.ts`**

```ts
import type { MentorContextInput } from '../mentor/context';
import { emptyProfile } from '../mentor/profile';
import type { GuardState } from '../types';

function fixtureFor(state: GuardState, request: string): MentorContextInput {
  const base: MentorContextInput = {
    systemPrompt: '', // filled in by the caller with loadSystemPrompt()
    profile: { ...emptyProfile(), goalsPhysical: 'Get stronger without wrecking sleep.', values: 'Consistency over intensity.' },
    weeklyLetters: [],
    digests: [],
    today: {
      date: '2026-09-14',
      state,
      flags: [],
      adjustments: [],
      overridden: false,
      blocks: [],
      checkins: [],
    },
    request,
    chatHistory: undefined,
  };
  return base;
}

/** Spec §13: "a small fixture set (one sample day per state) is run
 * manually against the real API to sanity-check tone." One MentorContextInput
 * per GuardState, distinct enough in their `request` to actually exercise
 * the voice-by-state rules in prompts/mentor.md. `systemPrompt` is left
 * blank here — callers fill it via loadSystemPrompt() so this file has zero
 * I/O, matching every other file under src/core/testing. */
export const MENTOR_FIXTURE_DAYS: Record<GuardState, MentorContextInput> = {
  ready: fixtureFor('ready', "Give CT their morning briefing: today's top 3 priorities."),
  drifting: {
    ...fixtureFor('drifting', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('drifting', '').today,
      flags: [{ code: 'INDULGE_HIGH', state: 'drifting', reason: 'More than 2h of unplanned screen time 2 days running' }],
      adjustments: [{ type: 'addEasyWin', reason: 'Start with a 15-minute win to get moving' }],
    },
  },
  depleted: {
    ...fixtureFor('depleted', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('depleted', '').today,
      flags: [{ code: 'SLEEP_LOW', state: 'depleted', reason: 'Under 6h sleep on 3 of your last 4 nights' }],
      adjustments: [{ type: 'trainingToRecovery', reason: "You're running low — recovery session instead of hard training" }],
    },
  },
  grinding: {
    ...fixtureFor('grinding', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('grinding', '').today,
      flags: [{ code: 'GRIND_HOURS', state: 'grinding', reason: 'Over 6h of deep work with no rest on 5 of the last 7 days' }],
      adjustments: [{ type: 'addMandatoryRest', at: '15:00', reason: "You've been grinding — a real break mid-afternoon" }],
    },
  },
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Write `scripts/mentor-tone-check.ts`**

```ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { buildMentorContext } from '../src/core/mentor/context';
import { MENTOR_FIXTURE_DAYS } from '../src/core/testing/mentorFixtures';
import { loadSystemPrompt } from '../src/lib/mentor/systemPrompt';
import { createAnthropicClient } from '../src/lib/anthropic/client';

/** Spec §13's manual tone check. Run this yourself once ANTHROPIC_API_KEY is
 * in .env.local — it makes one real, billed API call per GuardState (4
 * calls total, ~$0.01-0.05 depending on the model). Reads each response and
 * confirms the voice actually shifts: ready should push, depleted should
 * protect, grinding should insist on rest. */
async function main() {
  const anthropic = createAnthropicClient();
  const systemPrompt = loadSystemPrompt();

  for (const [state, fixture] of Object.entries(MENTOR_FIXTURE_DAYS)) {
    const ctx = buildMentorContext({ ...fixture, systemPrompt });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    console.log(`\n=== ${state} ===`);
    console.log(textBlock && 'text' in textBlock ? textBlock.text : '(no text block returned)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add the script entry to `package.json`:

```json
"mentor-tone-check": "tsx scripts/mentor-tone-check.ts"
```

- [ ] **Step 4: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/core/testing/mentorFixtures.ts scripts/mentor-tone-check.ts package.json
git commit -m "feat(mentor): fixture days and the manual tone-check script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: CT does this — run the tone check (real API cost)**

Once `ANTHROPIC_API_KEY` is in `.env.local` (Console → API Keys → create one → paste it in):

```bash
npm run mentor-tone-check
```

This makes 4 real, billed calls (one per state) and prints each response. Read them and confirm: `ready` pushes you, `drifting` gives one direct action, `depleted` is gentle and basics-first, `grinding` is blunt about rest. If any voice feels off, the fix is in `prompts/mentor.md` — edit the relevant row under "Voice by state" and re-run.

---

## Self-Review

**Spec coverage:**
- §8.1 Voice by state → Task 1 (`prompts/mentor.md`), verified in Task 10's manual check.
- §8.2 Routes → Task 7 (all five), Task 8 (HTTP surface).
- §8.3 Context ordering → unchanged, already correct in `@/core/mentor/context` (Plan 1); Task 6 only assembles the *data* in that order, never reorders it itself.
- §8.4 Model and API → Task 7 (adaptive thinking, effort per route, `settings.model` with `DEFAULT_SETTINGS.model` fallback, `@anthropic-ai/sdk`, structured outputs via `output_config.format` + `zodOutputFormat`, streaming for chat).
- §8.5 Cost cap → Task 5 (`recordUsage`, `checkCap`) + Task 3 (exact cap-reached copy) + every route in Task 7 checking the cap before calling Anthropic.
- §8.6 Profile → Task 6 reads the latest `profile_versions` row; Task 7's `weeklyReview` proposes changes validated against `PROFILE_SECTIONS` before they're ever returned to a caller (Plan 5 applies them via the already-built `applyProfileChanges`).
- §11 Privacy/crisis → `stripPrivate` already runs inside `buildMentorContext` (Plan 1, untouched); Task 2 (local keyword backup) + Task 7 (`crisis` field from both the model and the local check, OR'd together) + Task 1 (crisis instructions in the prompt itself, including the no-medical-advice rule).
- §12 Error handling → Task 3 (canned fallbacks) + Task 7 (every route catches and falls back; SDK's own default `max_retries: 2` satisfies "retry once" before a caller ever sees a thrown error).
- §13 Testing → every route's Anthropic client is mocked in its own test (never a real network call in `npm test`); Task 10's fixture days + script are the one place a real API call happens, and only when CT runs it themselves.

**Placeholder scan:** no TBD/TODO; every step has complete code; every fallback string is real copy, not a stand-in.

**Type consistency:** `MentorRouteParams` (Task 7, defined once in `briefing.ts`, imported by the other four route files) is the one params shape every route takes; `Route` (Task 3) is the exact set of five route-name strings used in `usage.route`, `mentor_messages.route`, and every route file's `recordUsage`/`logMentorMessage` call; `RepositoryClient` (Plan 3, unmodified) is the one client type every new function in this plan takes, consistent with Plan 3's own convention.
