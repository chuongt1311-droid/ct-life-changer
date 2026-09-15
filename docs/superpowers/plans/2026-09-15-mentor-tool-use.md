# Mentor Tool Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the mentor chat three tools — `read_schedule`, `propose_schedule_edit`, `propose_template_edit` — that preview real changes via the existing `applyEdits`/`planAhead`/template pipelines and require CT's explicit tap to persist anything.

**Architecture:** The chat route (`src/lib/mentor/routes/chat.ts`) switches from `anthropic.messages.stream` to the official `@anthropic-ai/sdk` Beta Tool Runner (`client.beta.messages.toolRunner`), passing three `BetaRunnableTool` objects whose `run()` bodies call straight into sub-project A's `applyEdits`/`previewEdits` and sub-project B's `previewFutureEdits`, writing nothing themselves — only inserting an inert `mentor_proposals` row. The chat route's streaming protocol changes from plain text chunks to NDJSON lines carrying either a text delta or a proposal; `ChatThread.tsx` renders proposals as inline cards with Confirm/Discard, which call new server actions that persist through the exact same functions hand-editing already uses.

**Tech Stack:** `@anthropic-ai/sdk@^0.125.0`'s Beta Tool Runner (`@anthropic-ai/sdk/lib/tools/BetaRunnableTool`), Next.js Server Actions, Supabase/Postgres migration, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-mentor-tool-use-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-15-future-date-editing.md` (sub-project B) — `propose_schedule_edit` calls B's `previewFutureEdits` for any date other than today. B must be implemented and merged before Task 5 of this plan.

## Global Constraints

- Every proposal is inert until CT taps Confirm — no auto-apply, no exception, no confidence threshold.
- Tools exist only on the `chat` route. `briefing`, `evening-review`, `weekly-review`, `reflow-comment` are untouched.
- `PlanEdit` (from `src/core/planner/edits.ts`) is the only edit vocabulary the mentor gets — the same one CT's own hand-editing uses, never a parallel one.
- Core functions (`src/core/**`) return values for user-input errors, never throw.
- No shame language, no streaks, write "CT"/"they" in any new user-facing copy.
- Run `npm test` and `npm run typecheck` before any task is considered done.

---

### Task 1: `mentor_proposals` table

**Files:**
- Create: `supabase/migrations/0003_mentor_proposals.sql`
- Modify: `src/lib/db/schemas.ts` (append `mentorProposalRowSchema`)
- Modify: `src/lib/db/repositories/tables.ts` (register it)

**Interfaces:**
- Produces: `repos.mentorProposals: TableRepository<MentorProposalRow>` (the generic `get`/`list`/`upsert`/`remove` from `createTableRepository`) — every later task in this plan persists and reads proposals through this.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0003_mentor_proposals.sql
create table if not exists mentor_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  message_id uuid not null references mentor_messages(id),
  kind text not null check (kind in ('schedule', 'template')),
  target text not null,
  edits jsonb not null,
  diff jsonb not null,
  conflicts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);
create index if not exists mentor_proposals_message_idx on mentor_proposals (message_id);

alter table mentor_proposals enable row level security;
create policy mentor_proposals_owner on mentor_proposals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

- [ ] **Step 2: Add the Zod schema**

Append to `src/lib/db/schemas.ts`, right after `mentorMessageRowSchema`:

```ts
export const mentorProposalRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  message_id: z.string(),
  kind: z.enum(['schedule', 'template']),
  target: z.string(),
  edits: z.array(z.record(z.string(), z.unknown())),
  diff: z.array(z.record(z.string(), z.unknown())),
  conflicts: z.array(z.tuple([z.string(), z.string()])),
  status: z.enum(['pending', 'confirmed', 'discarded']),
  created_at: z.string(),
});
export type MentorProposalRow = z.infer<typeof mentorProposalRowSchema>;
```

- [ ] **Step 3: Register the repository**

In `src/lib/db/repositories/tables.ts`, add the import and the entry:

```ts
import {
  blockRowSchema,
  checkinRowSchema,
  digestRowSchema,
  mentorMessageRowSchema,
  mentorProposalRowSchema,
  nudgeSentRowSchema,
  planRowSchema,
  profileVersionRowSchema,
  pushSubscriptionRowSchema,
  restSessionRowSchema,
  unplannedIndulgenceRowSchema,
  usageRowSchema,
  weeklyLetterRowSchema,
} from '../schemas';
import { createTableRepository, type RepositoryClient } from '../repository';

export function tableRepositories(client: RepositoryClient) {
  return {
    plans: createTableRepository(client, 'plans', planRowSchema),
    blocks: createTableRepository(client, 'blocks', blockRowSchema),
    checkins: createTableRepository(client, 'checkins', checkinRowSchema),
    restSessions: createTableRepository(client, 'rest_sessions', restSessionRowSchema),
    unplannedIndulgence: createTableRepository(client, 'unplanned_indulgence', unplannedIndulgenceRowSchema),
    mentorMessages: createTableRepository(client, 'mentor_messages', mentorMessageRowSchema),
    mentorProposals: createTableRepository(client, 'mentor_proposals', mentorProposalRowSchema),
    digests: createTableRepository(client, 'digests', digestRowSchema),
    weeklyLetters: createTableRepository(client, 'weekly_letters', weeklyLetterRowSchema),
    profileVersions: createTableRepository(client, 'profile_versions', profileVersionRowSchema),
    pushSubscriptions: createTableRepository(client, 'push_subscriptions', pushSubscriptionRowSchema),
    nudgesSent: createTableRepository(client, 'nudges_sent', nudgeSentRowSchema),
    usage: createTableRepository(client, 'usage', usageRowSchema),
  };
}
```

- [ ] **Step 4: Write and run the failing/passing test for the schema**

```ts
// append to a new file: src/lib/db/schemas.test.ts (create if it doesn't exist)
import { describe, expect, it } from 'vitest';
import { mentorProposalRowSchema } from './schemas';

describe('mentorProposalRowSchema', () => {
  it('accepts a pending schedule proposal row', () => {
    const row = {
      id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'schedule', target: '2026-09-22',
      edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }],
      diff: [{ blockId: 'deep', title: 'Deep work', change: 'shrunk', from: null, to: null, reason: 'You changed its length' }],
      conflicts: [], status: 'pending', created_at: '2026-09-15T12:00:00.000Z',
    };
    expect(() => mentorProposalRowSchema.parse(row)).not.toThrow();
  });

  it('rejects an unknown kind', () => {
    const row = { id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'nonsense', target: 'x', edits: [], diff: [], conflicts: [], status: 'pending', created_at: '2026-09-15T12:00:00.000Z' };
    expect(() => mentorProposalRowSchema.parse(row)).toThrow();
  });
});
```

Run: `npx vitest run src/lib/db/schemas.test.ts`
Expected: PASS (2 tests) — if the file already exists with other schema tests, add these two `describe` blocks to it instead of creating a duplicate file.

- [ ] **Step 5: Typecheck and full unit suite**

Run: `npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_mentor_proposals.sql src/lib/db/schemas.ts src/lib/db/repositories/tables.ts src/lib/db/schemas.test.ts
git commit -m "feat(db): mentor_proposals table"
```

---

### Task 2: `diffTemplate` — a pure diff for template edits

**Files:**
- Create: `src/core/planner/diffTemplate.ts`
- Test: `src/core/planner/diffTemplate.test.ts`

**Interfaces:**
- Consumes: `TemplateRow` (specifically its `rest_day: boolean` and `blocks: TemplateBlock[]` fields) from `@/lib/db/schemas`.
- Produces:
  ```ts
  export type TemplateChangeKind = 'added' | 'removed' | 'changed' | 'restDayChanged';
  export interface TemplateDiffEntry {
    key: string;   // a block's `key`, or the literal 'restDay' for the flag
    title: string; // a block's `title`, or 'Rest day' for the flag
    change: TemplateChangeKind;
    reason: string;
  }
  export function diffTemplate(
    current: { restDay: boolean; blocks: TemplateRow['blocks'] },
    proposed: { restDay: boolean; blocks: TemplateRow['blocks'] },
  ): TemplateDiffEntry[];
  ```
  Task 4's `propose_template_edit` tool and Task 7's `TemplateDiffList` both consume this exact shape.

- [ ] **Step 1: Write the failing tests**

```ts
// src/core/planner/diffTemplate.test.ts
import { describe, expect, it } from 'vitest';
import { diffTemplate } from './diffTemplate';

const block = (over: Partial<{ key: string; title: string; kind: string; anchor: boolean; priority: number; start: string; durationMin: number }> = {}) => ({
  key: 'gym', title: 'Gym', kind: 'training' as const, anchor: false, priority: 3 as const, start: '18:00', durationMin: 60,
  ...over,
});

describe('diffTemplate', () => {
  it('reports an added block', () => {
    const diff = diffTemplate({ restDay: false, blocks: [] }, { restDay: false, blocks: [block()] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'added', reason: 'Added' });
  });

  it('reports a removed block', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block()] }, { restDay: false, blocks: [] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'removed', reason: 'Removed' });
  });

  it('reports a changed block with what changed named in the reason', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block({ durationMin: 60 })] }, { restDay: false, blocks: [block({ durationMin: 90 })] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'changed', reason: 'Length changed from 60 to 90 minutes' });
  });

  it('reports a rest-day flip', () => {
    const diff = diffTemplate({ restDay: false, blocks: [] }, { restDay: true, blocks: [] });
    expect(diff).toContainEqual({ key: 'restDay', title: 'Rest day', change: 'restDayChanged', reason: 'Turned on' });
  });

  it('reports nothing for an unchanged template', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block()] }, { restDay: false, blocks: [block()] });
    expect(diff).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/planner/diffTemplate.test.ts`
Expected: FAIL — `Cannot find module './diffTemplate'`

- [ ] **Step 3: Write the implementation**

```ts
// src/core/planner/diffTemplate.ts
import type { TemplateRow } from '@/lib/db/schemas';

export type TemplateChangeKind = 'added' | 'removed' | 'changed' | 'restDayChanged';

export interface TemplateDiffEntry {
  key: string;
  title: string;
  change: TemplateChangeKind;
  reason: string;
}

type TemplateBlock = TemplateRow['blocks'][number];

function blockChanges(a: TemplateBlock, b: TemplateBlock): string[] {
  const changes: string[] = [];
  if (a.title !== b.title) changes.push(`Renamed from "${a.title}" to "${b.title}"`);
  if (a.start !== b.start) changes.push(`Time changed from ${a.start} to ${b.start}`);
  if (a.durationMin !== b.durationMin) changes.push(`Length changed from ${a.durationMin} to ${b.durationMin} minutes`);
  if (a.anchor !== b.anchor) changes.push(b.anchor ? 'Now an anchor' : 'No longer an anchor');
  return changes;
}

/** Pure diff between a template's current shape and a proposed one — the
 * template equivalent of `diffBlocks` (diff.ts), which diffs a DayPlan's
 * blocks instead. Used by the `propose_template_edit` mentor tool and its
 * review card; never writes anything itself. */
export function diffTemplate(
  current: { restDay: boolean; blocks: TemplateRow['blocks'] },
  proposed: { restDay: boolean; blocks: TemplateRow['blocks'] },
): TemplateDiffEntry[] {
  const entries: TemplateDiffEntry[] = [];
  const currentByKey = new Map(current.blocks.map((b) => [b.key, b]));
  const proposedByKey = new Map(proposed.blocks.map((b) => [b.key, b]));

  for (const b of proposed.blocks) {
    if (!currentByKey.has(b.key)) entries.push({ key: b.key, title: b.title, change: 'added', reason: 'Added' });
  }
  for (const b of current.blocks) {
    if (!proposedByKey.has(b.key)) entries.push({ key: b.key, title: b.title, change: 'removed', reason: 'Removed' });
  }
  for (const b of proposed.blocks) {
    const prior = currentByKey.get(b.key);
    if (!prior) continue;
    const changes = blockChanges(prior, b);
    for (const reason of changes) entries.push({ key: b.key, title: b.title, change: 'changed', reason });
  }

  if (current.restDay !== proposed.restDay) {
    entries.push({ key: 'restDay', title: 'Rest day', change: 'restDayChanged', reason: proposed.restDay ? 'Turned on' : 'Turned off' });
  }

  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/planner/diffTemplate.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add src/core/planner/diffTemplate.ts src/core/planner/diffTemplate.test.ts
git commit -m "feat(planner): diffTemplate, the template-edit equivalent of diffBlocks"
```

---

### Task 3: `logMentorMessage` accepts a caller-supplied id

**Files:**
- Modify: `src/lib/mentor/logMessage.ts`
- Test: `src/lib/mentor/logMessage.test.ts` (create — this module has no existing test file)

**Interfaces:**
- Produces: `logMentorMessage(client, { ...existing fields, id?: string })` — when `id` is omitted, behavior is byte-for-byte unchanged (a fresh `crypto.randomUUID()`). Task 5 needs to know the assistant message's id *before* logging it, because tool calls that run during that same turn must reference it as `mentor_proposals.message_id`, and `mentor_proposals` are inserted before the turn finishes and the message is logged.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mentor/logMessage.test.ts
import { describe, expect, it } from 'vitest';
import { fakeClient } from '@/lib/testing/fakeClient';
import { logMentorMessage } from './logMessage';

describe('logMentorMessage', () => {
  it('generates an id when none is given', async () => {
    const client = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-15', route: 'chat', role: 'user', content: 'hi', stateAtTime: null, usageId: null });
    expect(client.tables.mentor_messages).toHaveLength(1);
    expect(client.tables.mentor_messages![0]!.id).toEqual(expect.any(String));
  });

  it('uses a caller-supplied id when given', async () => {
    const client = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-15', route: 'chat', role: 'assistant', content: 'hi back', stateAtTime: null, usageId: null, id: 'fixed-id' });
    expect(client.tables.mentor_messages![0]!.id).toBe('fixed-id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mentor/logMessage.test.ts`
Expected: FAIL — the second test, since `id` isn't accepted yet (a plain object literal excess-property TS error, or the id is silently ignored and a random one is used instead)

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/mentor/logMessage.ts
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
  /** Pre-generated id — needed when something else (a mentor tool's
   * proposal row) must reference this message's id before it's logged.
   * Omit for the normal case; a fresh id is generated. */
  id?: string;
}

export async function logMentorMessage(client: RepositoryClient, params: LogMentorMessageParams): Promise<void> {
  await repositories(client).mentorMessages.upsert({
    id: params.id ?? crypto.randomUUID(),
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mentor/logMessage.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/logMessage.ts src/lib/mentor/logMessage.test.ts
git commit -m "feat(mentor): let logMentorMessage take a pre-generated id"
```

---

### Task 4: The three mentor tools

**Files:**
- Create: `src/lib/mentor/tools.ts`
- Test: `src/lib/mentor/tools.test.ts`

**Interfaces:**
- Consumes: `previewEdits` from `@/lib/planner/reflowDay`; `previewFuturePlan`, `previewFutureEdits` from `@/lib/planner/planAhead` (sub-project B); `diffTemplate` (Task 2); `PlanEdit` from `@/core/planner/edits`; `TemplateRow` from `@/lib/db/schemas`; `planClock`, `toPlanMinute` from `@/core/time`; `settingsToDomain` from `@/lib/db/settingsMapping`; `repositories` from `@/lib/db/repositories`; `BetaRunnableTool` from `@anthropic-ai/sdk/lib/tools/BetaRunnableTool`.
- Produces:
  ```ts
  export interface ProposalEvent {
    id: string;
    kind: 'schedule' | 'template';
    target: string;
    diff: unknown[]; // DiffEntry[] for 'schedule', TemplateDiffEntry[] for 'template'
    conflicts: [string, string][];
  }
  export interface BuildMentorToolsParams {
    client: RepositoryClient;
    ownerId: string;
    messageId: string; // the assistant mentor_messages row this turn will log as (Task 3)
    todayDate: string; // CT's actual today, so tools know when "today" applies
    now: Date;
  }
  export function buildMentorTools(params: BuildMentorToolsParams): { tools: BetaRunnableTool[]; proposals: ProposalEvent[] };
  ```
  Task 5's `chat()` consumes this directly; `proposals` is mutated (pushed to) by each tool's `run()` as a side effect, and drained by `chat()` after each turn.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/mentor/tools.test.ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { buildMentorTools } from './tools';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

function blockRow(overrides: Partial<Record<string, unknown>> & { id: string; start: number; end: number; date: string }) {
  return {
    owner_id: 'ct', title: overrides.id, kind: 'task', anchor: false, priority: 3,
    min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null,
    status: 'planned', source: 'template',
    ...overrides,
  };
}

describe('buildMentorTools', () => {
  it('read_schedule reports what is actually planned for today', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const readSchedule = tools.find((t) => t.name === 'read_schedule')!;
    const result = await readSchedule.run(readSchedule.parse({ date: '2026-09-15' }));
    expect(JSON.parse(result as string).blocks[0].title).toBe('deep');
  });

  it('propose_schedule_edit on today writes a pending proposal and returns its diff, without persisting the edit', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeScheduleEdit = tools.find((t) => t.name === 'propose_schedule_edit')!;
    await proposeScheduleEdit.run(proposeScheduleEdit.parse({ date: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }] }));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.kind).toBe('schedule');
    expect(client.tables.mentor_proposals).toHaveLength(1);
    expect(client.tables.mentor_proposals![0]!.status).toBe('pending');
    // Nothing actually applied to the real block:
    expect(client.tables.blocks!.find((b) => b.id === 'deep')!.end).toBe(600);
  });

  it('propose_schedule_edit returns validation errors instead of a proposal when the edit is impossible', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeScheduleEdit = tools.find((t) => t.name === 'propose_schedule_edit')!;
    const result = await proposeScheduleEdit.run(proposeScheduleEdit.parse({ date: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: -5 }] }));
    expect(JSON.parse(result as string).errors).toHaveLength(1);
    expect(proposals).toHaveLength(0);
  });

  it('propose_template_edit writes a pending template proposal with a real diff', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [{ key: 'gym', title: 'Gym', kind: 'training', anchor: false, priority: 3, start: '18:00', durationMin: 60 }] }],
    });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeTemplateEdit = tools.find((t) => t.name === 'propose_template_edit')!;
    await proposeTemplateEdit.run(proposeTemplateEdit.parse({
      weekday: 1, restDay: false,
      blocks: [{ key: 'gym', title: 'Gym', kind: 'training', anchor: false, priority: 3, start: '18:00', durationMin: 90 }],
    }));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.kind).toBe('template');
    expect((proposals[0]!.diff as { reason: string }[])[0]!.reason).toMatch(/60 to 90/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/mentor/tools.test.ts`
Expected: FAIL — `Cannot find module './tools'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/mentor/tools.ts
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { previewEdits } from '@/lib/planner/reflowDay';
import { previewFuturePlan, previewFutureEdits } from '@/lib/planner/planAhead';
import { diffTemplate } from '@/core/planner/diffTemplate';
import { planClock, toPlanMinute } from '@/core/time';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { PlanEdit } from '@/core/planner/edits';
import type { TemplateRow } from '@/lib/db/schemas';

export interface ProposalEvent {
  id: string;
  kind: 'schedule' | 'template';
  target: string;
  diff: unknown[];
  conflicts: [string, string][];
}

export interface BuildMentorToolsParams {
  client: RepositoryClient;
  ownerId: string;
  /** The assistant `mentor_messages` row this turn will log as (Task 3's
   * pre-generated id) — every proposal made during this turn references it,
   * even though the message itself isn't logged until the turn ends. */
  messageId: string;
  todayDate: string;
  now: Date;
}

/** Every tool here only ever previews — validates and computes a diff via
 * the exact same functions CT's own hand-editing already uses — and writes
 * a `mentor_proposals` row `status: 'pending'`. Nothing about a tool call
 * itself ever changes CT's actual schedule or templates; only
 * `confirmProposalAction` (Task 6), triggered by CT's own tap, does that. */
export function buildMentorTools(params: BuildMentorToolsParams): { tools: BetaRunnableTool[]; proposals: ProposalEvent[] } {
  const proposals: ProposalEvent[] = [];
  const repos = repositories(params.client);

  const readSchedule: BetaRunnableTool<{ date: string }> = {
    name: 'read_schedule',
    description: "Read CT's plan for a date: today, or any of the next 14 days. A future date with nothing saved yet returns a preview generated from that weekday's template, clearly marked as such.",
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'YYYY-MM-DD' } },
      required: ['date'],
    },
    parse: (input) => input as { date: string },
    run: async ({ date }) => {
      const preview = await previewFuturePlan(params.client, date, params.now);
      return JSON.stringify({
        source: preview.source,
        blocks: preview.plan.blocks.map((b) => ({ id: b.id, title: b.title, start: b.start, end: b.end, status: b.status, anchor: b.anchor })),
      });
    },
  };

  const proposeScheduleEdit: BetaRunnableTool<{ date: string; edits: PlanEdit[] }> = {
    name: 'propose_schedule_edit',
    description: 'Propose moving, resizing, dropping, or adding a block on a schedule (today or any of the next 14 days). Never applied automatically — CT reviews the diff and taps Confirm. `edits` is an array of {type:"move",blockId,toStart} | {type:"resize",blockId,durationMin} | {type:"drop",blockId} | {type:"add",id,title,kind,priority,start,durationMin}.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        edits: { type: 'array', items: { type: 'object' } },
      },
      required: ['date', 'edits'],
    },
    parse: (input) => input as { date: string; edits: PlanEdit[] },
    run: async ({ date, edits }) => {
      const isToday = date === params.todayDate;
      const result = isToday
        ? await (async () => {
            const settingsRow = await repos.settings.get();
            const settings = settingsToDomain(settingsRow!);
            const { minute } = planClock(params.now, settings.timezone);
            return previewEdits(params.client, date, edits, minute);
          })()
        : await (async () => {
            const r = await previewFutureEdits(params.client, date, edits, params.now);
            return { plan: r.plan, diff: r.diff, conflicts: r.conflicts, errors: r.errors };
          })();
      if (result.errors.length > 0) return JSON.stringify({ errors: result.errors });

      const id = crypto.randomUUID();
      await repos.mentorProposals.upsert({
        id, owner_id: params.ownerId, message_id: params.messageId, kind: 'schedule', target: date,
        edits: edits as unknown as Record<string, unknown>[],
        diff: result.diff as unknown as Record<string, unknown>[],
        conflicts: result.conflicts, status: 'pending', created_at: new Date().toISOString(),
      });
      proposals.push({ id, kind: 'schedule', target: date, diff: result.diff, conflicts: result.conflicts });
      return JSON.stringify({ proposalId: id, diff: result.diff, conflicts: result.conflicts });
    },
  };

  const proposeTemplateEdit: BetaRunnableTool<{ weekday: number; restDay: boolean; blocks: TemplateRow['blocks'] }> = {
    name: 'propose_template_edit',
    description: "Propose changing a weekday's recurring template — its block list or its rest-day flag. Never applied automatically — CT reviews the diff and taps Confirm. Always send the FULL proposed block list, not just the changed blocks.",
    input_schema: {
      type: 'object',
      properties: {
        weekday: { type: 'integer', description: '0 = Sunday … 6 = Saturday' },
        restDay: { type: 'boolean' },
        blocks: { type: 'array', items: { type: 'object' } },
      },
      required: ['weekday', 'restDay', 'blocks'],
    },
    parse: (input) => input as { weekday: number; restDay: boolean; blocks: TemplateRow['blocks'] },
    run: async ({ weekday, restDay, blocks }) => {
      const current = await repos.templates.get(weekday);
      const diff = diffTemplate(
        { restDay: current?.rest_day ?? false, blocks: current?.blocks ?? [] },
        { restDay, blocks },
      );
      if (diff.length === 0) return JSON.stringify({ errors: ['Nothing would change.'] });

      const id = crypto.randomUUID();
      await repos.mentorProposals.upsert({
        id, owner_id: params.ownerId, message_id: params.messageId, kind: 'template', target: String(weekday),
        edits: [{ weekday, restDay, blocks }] as unknown as Record<string, unknown>[],
        diff: diff as unknown as Record<string, unknown>[],
        conflicts: [], status: 'pending', created_at: new Date().toISOString(),
      });
      proposals.push({ id, kind: 'template', target: String(weekday), diff, conflicts: [] });
      return JSON.stringify({ proposalId: id, diff });
    },
  };

  return { tools: [readSchedule, proposeScheduleEdit, proposeTemplateEdit], proposals };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mentor/tools.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass — this step is the real check on the `BetaRunnableTool` import and shape; fix any SDK type mismatch it surfaces (e.g. `input_schema`'s literal `type: 'object'` needing an explicit `as const`) before moving on.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/tools.ts src/lib/mentor/tools.test.ts
git commit -m "feat(mentor): three tools that preview schedule and template edits"
```

---

### Task 5: Wire tools into the chat route and change the streaming protocol

**Files:**
- Modify: `src/lib/mentor/routes/chat.ts`
- Modify: `src/app/api/mentor/chat/route.ts`
- Test: `src/lib/mentor/routes/chat.test.ts` (create — this route has no existing test file; the other mentor routes are integration-tested only through their server actions, but this change is significant enough to earn a direct one)

**Interfaces:**
- Consumes: `buildMentorTools` (Task 4); `logMentorMessage` with `id` (Task 3); `extractUsage`, `checkCap`, `recordUsage` from `@/lib/mentor/usage`; `anthropic.beta.messages.toolRunner`.
- Produces:
  ```ts
  export type ChatStreamEvent = { type: 'text'; text: string } | { type: 'proposal'; proposal: ProposalEvent };
  export function chat(...): AsyncGenerator<ChatStreamEvent, { fallback: boolean }, void>;
  ```
  Task 7's `ChatThread.tsx` consumes the route's NDJSON-serialized form of this exact union.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mentor/routes/chat.test.ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { chat } from './chat';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

/** A fake Anthropic client whose `beta.messages.toolRunner` yields one
 * iteration: a plain text reply, no tool call. Verifies the plumbing
 * (event shape, usage recording, message logging) without depending on a
 * real model response. */
function fakeAnthropic(text: string) {
  async function* fakeEvents() {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
  }
  const iterationStream = {
    [Symbol.asyncIterator]: fakeEvents,
    finalMessage: async () => ({ usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null } }),
  };
  async function* runner() {
    yield iterationStream;
  }
  return { beta: { messages: { toolRunner: vi.fn(() => ({ [Symbol.asyncIterator]: runner })) } } } as never;
}

describe('chat with tools', () => {
  it('streams text events and logs one assistant message for the turn', async () => {
    const client = fakeClient({ settings: [settingsRow] });
    const anthropic = fakeAnthropic('Sounds good.');
    const events: unknown[] = [];
    const gen = chat(client, anthropic, { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 }, '2026-09-15', 'How am I doing?');
    for await (const event of gen) events.push(event);

    expect(events).toContainEqual({ type: 'text', text: 'Sounds good.' });
    const assistantRows = client.tables.mentor_messages!.filter((m) => m.role === 'assistant');
    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0]!.content).toBe('Sounds good.');
    expect(client.tables.usage).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mentor/routes/chat.test.ts`
Expected: FAIL — `chat()` still yields plain strings, not `{type,...}` objects; the fake's `beta.messages.toolRunner` isn't called yet

- [ ] **Step 3: Rewrite `chat.ts`**

```ts
// src/lib/mentor/routes/chat.ts
import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { logMentorMessage } from '@/lib/mentor/logMessage';
import { buildMentorTools, type ProposalEvent } from '@/lib/mentor/tools';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import type { MentorRouteParams } from './briefing';

export type ChatStreamEvent = { type: 'text'; text: string } | { type: 'proposal'; proposal: ProposalEvent };

async function loadChatHistory(client: RepositoryClient, date: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await repositories(client).mentorMessages.list({ date, route: 'chat' } as never);
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-20)
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** Chat can now change CT's schedule and templates, not just describe them
 * — the model gets three tools (Task 4) via the official Beta Tool Runner,
 * which loops assistant → tool → tool-result on its own. Every tool only
 * previews (writes a `mentor_proposals` row); the model's own text is
 * still streamed live, and a proposal a tool made rides alongside it as its
 * own event so `ChatThread.tsx` can render a Confirm/Discard card the
 * moment it's ready, in whichever iteration of the (possibly multi-turn)
 * tool loop it happened. */
export async function* chat(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  message: string,
): AsyncGenerator<ChatStreamEvent, { fallback: boolean }, void> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) {
    yield { type: 'text', text: capReachedMessage(new Date()) };
    return { fallback: true };
  }

  const chatHistory = await loadChatHistory(client, date);
  await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'user', content: message, stateAtTime: null, usageId: null });
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: message, chatHistory });
  const ctx = buildMentorContext(input);

  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate: todayDate } = planClock(new Date(), settings.timezone);

  // Pre-generated: a tool's proposal row must reference this turn's
  // assistant message id before that message is logged (logging only
  // happens once the whole turn — including every tool call — is done).
  const assistantMessageId = crypto.randomUUID();
  const { tools, proposals } = buildMentorTools({ client, ownerId: params.ownerId, messageId: assistantMessageId, todayDate, now: new Date() });

  try {
    const runner = anthropic.beta.messages.toolRunner({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
      tools,
      stream: true,
    });

    let fullText = '';
    let usage = ZERO_USAGE;
    for await (const iterationStream of runner) {
      for await (const event of iterationStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          yield { type: 'text', text: event.delta.text };
        }
      }
      const final = await iterationStream.finalMessage();
      const iterationUsage = extractUsage(final);
      usage = {
        inputTokens: usage.inputTokens + iterationUsage.inputTokens,
        outputTokens: usage.outputTokens + iterationUsage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens + iterationUsage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens + iterationUsage.cacheWriteTokens,
      };
      // Any tool `run()` calls that executed while this iteration's stream
      // was draining have already pushed onto `proposals` by now.
      while (proposals.length > 0) yield { type: 'proposal', proposal: proposals.shift()! };
    }

    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'chat', model: params.model, usage });
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'assistant', content: fullText, stateAtTime: input.today.state, usageId: usageRow.id, id: assistantMessageId });
    return { fallback: false };
  } catch {
    yield { type: 'text', text: routeFallbackText('chat') };
    return { fallback: true };
  }
}
```

- [ ] **Step 4: Update the route handler to serialize NDJSON**

```ts
// src/app/api/mentor/chat/route.ts
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
      controller.enqueue(encoder.encode(JSON.stringify(next.value) + '\n'));
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/mentor/routes/chat.test.ts`
Expected: PASS

- [ ] **Step 6: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass — this is the real check on the Tool Runner's exact param/return shapes (e.g. whether `iterationStream.finalMessage()`'s type needs a cast for `extractUsage`, which is typed for `Anthropic.Message` rather than `Anthropic.Beta.Messages.BetaMessage`). If typecheck flags this, the fix is a narrow, documented cast at the one call site — `extractUsage(final as unknown as Anthropic.Message)` — not a change to `extractUsage` itself, which every other route still calls with a real non-beta `Message`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mentor/routes/chat.ts src/app/api/mentor/chat/route.ts src/lib/mentor/routes/chat.test.ts
git commit -m "feat(mentor): give chat tools and switch its stream to NDJSON"
```

---

### Task 6: Confirm and discard actions

**Files:**
- Modify: `src/app/mentor/actions.ts` (append)
- Test: `src/app/mentor/actions.test.ts` (create)

**Interfaces:**
- Consumes: `repos.mentorProposals` (Task 1); `confirmReflow`, `previewEdits` from `@/lib/planner/reflowDay`; `confirmFuturePlan`, `previewFutureEdits` from `@/lib/planner/planAhead`; `saveTemplateAction`'s underlying `repos.templates.upsert`; `applyEdits` from `@/core/planner/edits`.
- Produces:
  ```ts
  export async function confirmProposalAction(proposalId: string): Promise<{ ok: true } | { ok: false; errors: string[] }>;
  export async function discardProposalAction(proposalId: string): Promise<void>;
  ```
  Task 7's `ProposalCard` calls both.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/mentor/actions.test.ts
//
// These actions call `createServerSupabase()` internally, which needs a
// real request context — exercised end-to-end in Task 8's e2e spec instead.
// This file tests the pure decision logic each action delegates to, kept
// as small internal helpers so it's testable without the auth boundary:
// `resolveProposalOutcome`, extracted below.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { resolveProposalConfirmation } from './actions';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

describe('resolveProposalConfirmation', () => {
  it('refuses a proposal that is not pending', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      mentor_proposals: [{ id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'schedule', target: '2026-09-15', edits: [], diff: [], conflicts: [], status: 'confirmed', created_at: '2026-09-15T12:00:00.000Z' }],
    });
    const result = await resolveProposalConfirmation(client, 'ct', 'p1');
    expect(result).toEqual({ ok: false, errors: ['This proposal was already acted on.'] });
  });

  it('persists a pending schedule proposal and marks it confirmed', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      blocks: [{ id: 'deep', owner_id: 'ct', date: '2026-09-15', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: 540, end: 600, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null, status: 'planned', source: 'template' }],
      mentor_proposals: [{ id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'schedule', target: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }], diff: [], conflicts: [], status: 'pending', created_at: '2026-09-15T12:00:00.000Z' }],
    });
    const result = await resolveProposalConfirmation(client, 'ct', 'p1');
    expect(result).toEqual({ ok: true });
    expect(client.tables.blocks!.find((b) => b.id === 'deep')!.end).toBe(630);
    expect(client.tables.mentor_proposals!.find((p) => p.id === 'p1')!.status).toBe('confirmed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/mentor/actions.test.ts`
Expected: FAIL — `resolveProposalConfirmation` not exported

- [ ] **Step 3: Write the implementation**

Append to `src/app/mentor/actions.ts`:

```ts
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { confirmReflow, previewEdits } from '@/lib/planner/reflowDay';
import { confirmFuturePlan, previewFutureEdits } from '@/lib/planner/planAhead';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import type { PlanEdit } from '@/core/planner/edits';

/** The decision logic behind `confirmProposalAction`, split out so it's
 * testable without the request-bound auth boundary `createServerSupabase()`
 * needs. Re-runs the proposal's edits against the CURRENT state of that
 * date/template — not the diff stored at proposal time — so a schedule that
 * moved on since the mentor proposed this doesn't get an edit applied
 * against a base CT never actually saw; a fresh conflict here is reported
 * instead of silently persisted. */
export async function resolveProposalConfirmation(client: RepositoryClient, ownerId: string, proposalId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const repos = repositories(client);
  const proposal = await repos.mentorProposals.get(proposalId);
  if (!proposal || proposal.status !== 'pending') return { ok: false, errors: ['This proposal was already acted on.'] };

  if (proposal.kind === 'schedule') {
    const edits = proposal.edits as unknown as PlanEdit[];
    const settingsRow = await repos.settings.get();
    const settings = settingsToDomain(settingsRow!);
    const { planDate, minute } = planClock(new Date(), settings.timezone);

    if (proposal.target === planDate) {
      const result = await previewEdits(client, proposal.target, edits, minute);
      if (result.errors.length > 0) return { ok: false, errors: result.errors };
      await confirmReflow(client, ownerId, proposal.target, { date: proposal.target, wake: 0, bedtime: 0, blocks: result.plan.blocks });
    } else {
      const result = await previewFutureEdits(client, proposal.target, edits, new Date());
      if (result.errors.length > 0) return { ok: false, errors: result.errors };
      await confirmFuturePlan(client, ownerId, proposal.target, result.plan, { state: result.state, flags: result.flags, adjustments: result.adjustments });
    }
  } else {
    const { weekday, restDay, blocks } = (proposal.edits as unknown as [{ weekday: number; restDay: boolean; blocks: unknown }])[0]!;
    await repos.templates.upsert({ weekday, owner_id: ownerId, rest_day: restDay, blocks: blocks as never });
  }

  await repos.mentorProposals.upsert({ ...proposal, status: 'confirmed' });
  return { ok: true };
}

export async function confirmProposalAction(proposalId: string): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return resolveProposalConfirmation(supabase as unknown as RepositoryClient, user.id, proposalId);
}

export async function discardProposalAction(proposalId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  const proposal = await repositories(client).mentorProposals.get(proposalId);
  if (!proposal || proposal.status !== 'pending') return;
  await repositories(client).mentorProposals.upsert({ ...proposal, status: 'discarded' });
}
```

Note: for a **today** schedule proposal, `previewEdits`'s branch of the `isToday ? ... : ...` union means `result` doesn't carry `state`/`flags`/`adjustments` — only the future-date branch does, and only that branch's `confirmFuturePlan` call reads them (guarded by the same `isToday` check, so the `future` cast is only ever exercised on the branch where those fields really exist).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/mentor/actions.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Full unit suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass

- [ ] **Step 6: Commit**

```bash
git add src/app/mentor/actions.ts src/app/mentor/actions.test.ts
git commit -m "feat(mentor): confirm or discard a proposal"
```

---

### Task 7: Proposal cards in the chat UI

**Files:**
- Modify: `src/components/mentor/ChatThread.tsx`
- Create: `src/components/mentor/ProposalCard.tsx`
- Create: `src/components/mentor/TemplateDiffList.tsx`
- Modify: `src/app/mentor/page.tsx` (load pending proposals for today's messages)
- Modify: `src/app/dept.css` (append one small rule)

**Interfaces:**
- Consumes: `DiffList` from `@/components/planner/DiffList` (schedule diffs); `TemplateDiffEntry` from `@/core/planner/diffTemplate`; `confirmProposalAction`, `discardProposalAction` (Task 6); `ChatStreamEvent`/`ProposalEvent` shapes (Task 5).

- [ ] **Step 1: Write `TemplateDiffList`** (no unit test — a thin presentational list, same convention as `DiffList` itself has none; verified visually through Task 8's e2e)

```tsx
// src/components/mentor/TemplateDiffList.tsx
import type { TemplateDiffEntry } from '@/core/planner/diffTemplate';

export function TemplateDiffList({ entries }: { entries: TemplateDiffEntry[] }) {
  return (
    <ul className="diff">
      {entries.map((d, i) => (
        <li key={`${d.key}-${i}`} data-kind={d.change === 'removed' ? 'dropped' : d.change === 'added' ? 'kept' : 'moved'}>
          <span>
            <span className="row-name">{d.title}</span>
            <span className="row-note">{d.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write `ProposalCard`**

```tsx
// src/components/mentor/ProposalCard.tsx
'use client';

import { useState } from 'react';
import type { DiffEntry } from '@/core/planner/diff';
import type { TemplateDiffEntry } from '@/core/planner/diffTemplate';
import { DiffList } from '@/components/planner/DiffList';
import { TemplateDiffList } from './TemplateDiffList';
import { confirmProposalAction, discardProposalAction } from '@/app/mentor/actions';

export interface Proposal {
  id: string;
  kind: 'schedule' | 'template';
  target: string;
  diff: DiffEntry[] | TemplateDiffEntry[];
  conflicts: [string, string][];
}

/** The mentor's own diff card — inert until CT taps one of these two
 * buttons. Confirm re-validates against the schedule/template's CURRENT
 * state (Task 6), so an error here means something changed since the
 * mentor proposed this, not that the tap failed. */
export function ProposalCard({ proposal, onResolved }: { proposal: Proposal; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function confirm() {
    setBusy(true);
    const result = await confirmProposalAction(proposal.id);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onResolved();
  }

  async function discard() {
    setBusy(true);
    await discardProposalAction(proposal.id);
    setBusy(false);
    onResolved();
  }

  return (
    <div className="proposal-card">
      {proposal.kind === 'schedule' ? <DiffList entries={proposal.diff as DiffEntry[]} /> : <TemplateDiffList entries={proposal.diff as TemplateDiffEntry[]} />}
      {proposal.conflicts.length > 0 && (
        <p className="note" role="alert">
          {proposal.conflicts.map(([a, b]) => `"${a}" and "${b}" overlap.`).join(' ')}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="empty" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="proposal-actions">
        <button className="btn btn-main" onClick={confirm} disabled={busy}>
          {busy ? 'Working…' : 'Confirm'}
        </button>
        <button className="btn btn-quiet" onClick={discard} disabled={busy}>
          Discard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the one new CSS rule**

Append to `src/app/dept.css`:

```css
.proposal-card { margin-top: var(--s3); padding: var(--s3); border: 1px solid var(--line); border-radius: var(--radius); }
.proposal-actions { display: flex; gap: var(--s2); margin-top: var(--s3); }
```

(`--line` and `--radius` are the same tokens `.tag[data-state="neutral"]` and the pending-strip card already use elsewhere in this file — this reuses the app's existing surface treatment rather than inventing a new one.)

- [ ] **Step 4: Rewrite `ChatThread.tsx` to speak NDJSON and render proposals**

```tsx
'use client';

import { useState } from 'react';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from './CrisisContactsCard';
import { Icon } from '@/components/icons/Icon';
import { ProposalCard, type Proposal } from './ProposalCard';
import type { CrisisContact } from '@/core/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Only assistant messages carry one — needed to attach a proposal loaded
   * on initial page load (Task's mentor/page.tsx) to the message that
   * produced it. A message sent this session already gets its proposals
   * live, keyed by array index instead (see `liveProposalsByIndex` below). */
  id?: string;
}

type StreamEvent = { type: 'text'; text: string } | { type: 'proposal'; proposal: Proposal };

export function ChatThread({
  date,
  initialMessages,
  initialProposalsByMessageId,
  crisisContacts,
}: {
  date: string;
  initialMessages: ChatMessage[];
  initialProposalsByMessageId: Record<string, Proposal[]>;
  crisisContacts: CrisisContact[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [proposalsByMessageId, setProposalsByMessageId] = useState(initialProposalsByMessageId);
  const [liveProposalsByIndex, setLiveProposalsByIndex] = useState<Record<number, Proposal[]>>({});
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const localCrisis = useCrisisCheck([draft]);

  function resolveProposal(id: string) {
    setProposalsByMessageId((byId) => {
      const next = { ...byId };
      for (const key of Object.keys(next)) next[key] = next[key]!.filter((p) => p.id !== id);
      return next;
    });
    setLiveProposalsByIndex((byIndex) => {
      const next: Record<number, Proposal[]> = {};
      for (const [index, list] of Object.entries(byIndex)) next[Number(index)] = list.filter((p) => p.id !== id);
      return next;
    });
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    const assistantIndex = messages.length + 1;
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const res = await fetch('/api/mentor/chat', { method: 'POST', body: JSON.stringify({ date, message: text }) });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === 'text') {
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: 'assistant', content: next[next.length - 1]!.content + event.text };
              return next;
            });
          } else {
            setLiveProposalsByIndex((byIndex) => ({ ...byIndex, [assistantIndex]: [...(byIndex[assistantIndex] ?? []), event.proposal] }));
          }
        }
      }
    }
    setSending(false);
  }

  return (
    <>
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}
      {messages.length === 0 && (
        <p className="empty">Nothing asked today. The mentor already has today&apos;s plan, your recent history and your check-ins — just start.</p>
      )}
      <ul className="thread" style={{ listStyle: 'none' }}>
        {messages.map((m, i) => {
          const proposals = (m.id ? proposalsByMessageId[m.id] : undefined) ?? liveProposalsByIndex[i] ?? [];
          return (
            <li className={`msg ${m.role === 'assistant' ? 'from-dept' : 'from-ct'}`} key={i}>
              <span className="who">{m.role === 'assistant' ? 'Mentor' : 'CT'}</span>
              <div className="body">
                <p>{m.content || (sending && i === messages.length - 1 ? '…' : '')}</p>
                {proposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} onResolved={() => resolveProposal(p.id)} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="thumb">
        <form
          className="composer btn-wide"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="placard" htmlFor="ask" style={{ gridColumn: '1/-1' }}>
            Ask
          </label>
          <textarea id="ask" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message" />
          <button className="btn btn-main" type="submit" aria-label="Send" disabled={sending}>
            <Icon name="send" />
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Load pending proposals in `mentor/page.tsx`**

In `src/app/mentor/page.tsx`, change the `initialMessages` construction to also carry each row's `id`, and add a query for pending proposals grouped by `message_id`:

```tsx
  const initialMessages: ChatMessage[] = history
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content, id: r.id }));

  const assistantMessageIds = initialMessages.filter((m) => m.role === 'assistant').map((m) => m.id!);
  const pendingProposals = assistantMessageIds.length > 0
    ? (await repos.mentorProposals.list()).filter((p) => p.status === 'pending' && assistantMessageIds.includes(p.message_id))
    : [];
  const initialProposalsByMessageId: Record<string, Proposal[]> = {};
  for (const p of pendingProposals) {
    (initialProposalsByMessageId[p.message_id] ??= []).push({ id: p.id, kind: p.kind, target: p.target, diff: p.diff as never, conflicts: p.conflicts });
  }
```

and pass it through:

```tsx
        <ChatThread date={planDate} initialMessages={initialMessages} initialProposalsByMessageId={initialProposalsByMessageId} crisisContacts={settingsRow?.crisis_contacts ?? []} />
```

adding the import `import type { Proposal } from '@/components/mentor/ProposalCard';` alongside the existing `ChatThread` import.

- [ ] **Step 6: Typecheck and full unit suite**

Run: `npm run typecheck && npm test`
Expected: both pass

- [ ] **Step 7: Commit**

```bash
git add src/components/mentor/ src/app/mentor/page.tsx src/app/dept.css
git commit -m "feat(mentor): render tool proposals as confirm/discard cards"
```

---

### Task 8: End-to-end proof

**Files:**
- Create: `e2e/mentor-tool-use.spec.ts`

**Interfaces:**
- Consumes: the full route (Tasks 5–7). Since a real mentor turn calls the actual Claude API, this spec drives the flow up to and through a proposal deterministically by seeding a `mentor_proposals` row directly (via the test project's admin client, the same pattern `.unlazy/flexible-schedule-editing/scripts/reset-today-blocks.mjs` already established for sub-project A's verification) rather than depending on a live model call choosing to invoke a tool — the tool-calling plumbing itself (Tasks 4–5) is already unit-tested against a fake Anthropic client; this spec instead proves the confirm/discard UI round-trip against the real app and real database.

- [ ] **Step 1: Write the test**

```ts
// e2e/mentor-tool-use.spec.ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test.local' });

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

test('confirming a mentor proposal actually changes the schedule', async ({ page }) => {
  const admin = adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const ownerId = (await admin.auth.admin.listUsers()).data.users[0]!.id;

  const messageId = crypto.randomUUID();
  await admin.from('mentor_messages').insert({
    id: messageId, owner_id: ownerId, date: today, route: 'chat', role: 'assistant',
    content: 'Test proposal', state_at_time: null, usage_id: null,
  });

  const { data: block } = await admin.from('blocks').select('id,start,end').eq('date', today).limit(1).single();
  const growBy = 30;
  const newDurationMin = block!.end - block!.start + growBy;
  await admin.from('mentor_proposals').insert({
    id: crypto.randomUUID(), owner_id: ownerId, message_id: messageId, kind: 'schedule', target: today,
    edits: [{ type: 'resize', blockId: block!.id, durationMin: newDurationMin }],
    diff: [{ blockId: block!.id, title: 'Test', change: 'shrunk', from: null, to: null, reason: 'You changed its length' }],
    conflicts: [], status: 'pending',
  });

  await page.goto('/mentor');
  const card = page.locator('.proposal-card').first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Confirm' }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });

  const { data: updated } = await admin.from('blocks').select('end').eq('id', block!.id).single();
  expect(updated!.end).toBe(block!.start + newDurationMin);
});
```

This mirrors exactly how sub-project A's own verification scripts seeded and cleaned up rows directly in the test Supabase project — see `.unlazy/flexible-schedule-editing/scripts/reset-today-blocks.mjs` for the established pattern of reading `.env.test.local` and using the service-role client.

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/mentor-tool-use.spec.ts`
Expected: PASS

- [ ] **Step 3: Run the full e2e suite to confirm no regressions**

Run: `npx playwright test`
Expected: all specs pass, including the pre-existing mentor-adjacent flows

- [ ] **Step 4: Commit**

```bash
git add e2e/mentor-tool-use.spec.ts
git commit -m "test(e2e): prove confirming a mentor proposal changes the real schedule"
```
