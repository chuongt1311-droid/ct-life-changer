# Mentor Tool Use (Sub-project C) — Design

**Status:** approved (brainstormed 2026-09-15, following sub-project A
— shipped — and sub-project B —
`docs/superpowers/specs/2026-09-15-future-date-editing-design.md`, C depends
on B's `previewFutureEdits`/`confirmFuturePlan` for anything beyond today).

## Problem

The mentor (`/mentor`, `POST /api/mentor/chat`) only streams text. If CT
tells it "move my gym session to 6pm" or "stop putting deep work on
Fridays," it can only describe what CT should go do by hand. The whole
point of this conversation's original ask — "when I use the AI in the app,
it should have the power to change stuffs too" — is still unmet until the
mentor can actually reach the schedule.

## Scope

**In scope:**
- Three tools on the **chat** route only (`POST /api/mentor/chat`):
  `read_schedule`, `propose_schedule_edit`, `propose_template_edit`.
- A proposal the mentor makes is never applied by the tool call itself —
  the tool's job is strictly *preview*: validate, run `applyEdits` or the
  template diff, and hand back a diff. Persisting only ever happens from a
  CT tap on a **Confirm** button rendered next to the mentor's own
  explanation, mirroring exactly how Today's hand-editing already works
  (spec A, `EditableDay`) — CT approved this review model back when A was
  first brainstormed ("Propose a diff, you tap to accept").
- Chat's streaming protocol changes from plain text chunks to a small
  structured stream so a proposal can ride alongside the mentor's words in
  the same turn. `ChatThread.tsx` updates to match.
- A new `mentor_proposals` table so a proposal outlives the request that
  created it — CT can read the mentor's explanation, think about it, and
  tap Confirm or Discard later without losing the diff.

**Out of scope:**
- Tools on `briefing`, `evening-review`, `weekly-review`, or
  `reflow-comment` — those routes stay exactly as they are; nothing about
  their one-shot, no-back-and-forth shape calls for tool use.
- The mentor confirming its own proposal, or any "auto-apply" mode. Every
  proposal is inert until CT taps Confirm — no exceptions, no threshold of
  confidence that skips the tap.
- New kinds of edits beyond move/resize/drop/add and the template shape
  `TemplateEditor.tsx` already edits (block list, rest-day flag). The
  mentor gets the same vocabulary CT already has by hand, not a bigger one.
- Multi-day batch proposals ("replan my whole week"). One proposal is one
  date (schedule) or one weekday (template); the mentor can call the tool
  more than once in a turn for a bigger request, producing several
  proposal cards, but each stays independently reviewable.

## Design

### Tools

Three `BetaRunnableTool` definitions (the installed
`@anthropic-ai/sdk@0.125.0`'s `client.beta.messages.toolRunner` — the
official Tool Runner beta, not a hand-rolled loop; see
`node_modules/@anthropic-ai/sdk/lib/tools/BetaToolRunner.d.ts`), new file
`src/lib/mentor/tools.ts`:

```ts
interface ToolRunParams {
  client: RepositoryClient;
  ownerId: string;
  chatMessageId: string; // the mentor_messages row this turn will log as
  now: number;
}

// read_schedule: { date: string } -> the plan for that date, same shape
// buildMentorContext already sends the model for "today" (state, flags,
// blocks) — this just lets the mentor ask for a date other than today's,
// including one that doesn't have a plan row yet (delegates to
// previewFuturePlan so "generated preview" and "real plan" both answer).

// propose_schedule_edit: { date: string, edits: PlanEdit[] } -> validates
// and previews via applyEdits (today) or previewFutureEdits (any other
// date, sub-project B) — never writes. On success, inserts a
// mentor_proposals row (kind: 'schedule') and returns its id plus a
// compact text rendering of the diff for the model to reference in its
// reply. On validation errors, returns those errors as the tool result
// (no proposal row) so the model can ask a clarifying question instead of
// presenting something impossible.

// propose_template_edit: { weekday: number, restDay?: boolean, blocks?:
// TemplateRow['blocks'] } -> loads the current template, computes a diff
// (added/removed/changed blocks, rest-day flag flip) against the proposed
// one — a new, small `diffTemplate(current, proposed): TemplateDiffEntry[]`
// pure function in `src/core/planner/diffTemplate.ts`, since diffBlocks
// diffs a DayPlan's blocks, not a template's — inserts a mentor_proposals
// row (kind: 'template'), returns the diff.
```

`propose_schedule_edit`'s `edits` argument is exactly `PlanEdit[]` from
`src/core/planner/edits.ts` — the mentor learns the same vocabulary CT's
hand-editing UI already speaks, described in the tool's JSON schema
(`move`/`resize`/`drop`/`add`, matching the union's fields) rather than
inventing a parallel one.

### `mentor_proposals` table

New migration `supabase/migrations/0003_mentor_proposals.sql`, following
`0001_init.sql`'s existing convention (`owner_id uuid not null default
auth.uid()`, added to the same RLS-enabling loop):

```sql
create table if not exists mentor_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  message_id uuid not null references mentor_messages(id),
  kind text not null check (kind in ('schedule', 'template')),
  target text not null,          -- date (schedule) or weekday number as text (template)
  edits jsonb not null,          -- PlanEdit[] (schedule) or the proposed TemplateRow shape (template)
  diff jsonb not null,           -- DiffEntry[] (schedule) or TemplateDiffEntry[] (template)
  conflicts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);
create index if not exists mentor_proposals_message_idx on mentor_proposals (message_id);
```

`target` is a plain string rather than a second nullable date/weekday
column — one proposal is always exactly one kind, so a single column keyed
by `kind` avoids a row where the "wrong" column is meaninglessly null.

### Confirming or discarding

Two new server actions, `src/app/mentor/actions.ts`:

- `confirmProposalAction(proposalId)`: loads the `mentor_proposals` row,
  refuses (returns an error, doesn't throw — matches A's "core returns
  values" convention for anything user-triggered) if `status !== 'pending'`
  — a proposal already acted on can't be re-confirmed, guarding against a
  double-tap or a stale page. For `kind: 'schedule'`, re-runs
  `applyEdits`/`previewFutureEdits` against the **current** state of that
  date (not the stored diff — the day may have moved since the mentor
  proposed this) and persists via `confirmReflow`-style write (today) or
  `confirmFuturePlan` (sub-project B, any other date); if the re-run
  produces new conflicts that weren't there when proposed, surface them
  instead of silently applying something CT never actually saw. For
  `kind: 'template'`, calls the same `saveTemplateAction` path
  `TemplateEditor.tsx` already uses. Sets `status: 'confirmed'`.
- `discardProposalAction(proposalId)`: sets `status: 'discarded'`. No
  other side effect.

### Chat route and streaming protocol

`chat()` in `src/lib/mentor/routes/chat.ts` gains a `tools` param
(`buildMentorTools(ctx)` from the new `tools.ts`) passed to
`anthropic.beta.messages.toolRunner({ ...ctx, tools })` in place of the
plain `anthropic.messages.stream(...)` call. The generator's yield type
changes from `string` to a small discriminated union:

```ts
type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'proposal'; proposal: { id: string; kind: 'schedule' | 'template'; target: string; diff: unknown; conflicts: [string, string][] } };
```

The Route Handler (`src/app/api/mentor/chat/route.ts`) serializes each
event as one NDJSON line (`JSON.stringify(event) + '\n'`) instead of
writing raw text — the only protocol change on the wire, and only for this
one route; `briefing`/`evening-review`/`weekly-review`/`reflow-comment`
keep streaming plain text exactly as they do today, since they gain no
tools.

`ChatThread.tsx`'s `send()` reads NDJSON lines instead of appending raw
decoded text: split on `\n`, `JSON.parse` each complete line, append `text`
events to the trailing assistant message same as before, and push
`proposal` events into a new `pendingProposals` list keyed by id. A new
`ProposalCard` component (`src/components/mentor/ProposalCard.tsx`) renders
each pending proposal inline after the message that produced it — same
`DiffList` component sub-project A already built for schedule diffs, a new
small `TemplateDiffList` for template diffs — with Confirm/Discard buttons
calling the two actions above and removing the card from
`pendingProposals` on either outcome.

### Logging

`propose_schedule_edit`/`propose_template_edit` tool calls and their
results are not separately logged to `mentor_messages` — the assistant's
own text response (already logged, unchanged) is the human-readable record
of what happened in the turn; the `mentor_proposals` row is the durable
record of the proposal itself and its eventual disposition, addressable
without re-parsing chat history.

### Testing

- `tools.test.ts`: each tool's `run` against a `fakeClient` — validation
  failure returns errors without writing a proposal row; success writes
  exactly one `mentor_proposals` row with the right `kind`/`target`/`diff`.
- `diffTemplate.test.ts`: pure function, add/remove/reorder/rest-day-flip
  cases — same TDD rigor as `diff.test.ts` from sub-project A.
- `confirmProposalAction`/`discardProposalAction`: status transitions,
  double-confirm rejection, and the "conflicts changed since proposed"
  re-surfacing path.
- E2E: send a chat message that triggers `propose_schedule_edit`, see the
  card render with a real diff, confirm it, reload Today, and see the
  edited block actually applied — proving the whole tool → proposal → DB
  round-trip, not just each piece in isolation.

## Self-review

1. **Spec coverage:** all three tools, the review-before-write model, the
   streaming protocol change, and the confirm/discard actions are covered.
2. **Placeholder scan:** none.
3. **Consistency:** `PlanEdit` in the tool schema, `DiffEntry`/`diff.ts`'s
   diff shape in `mentor_proposals.diff`, and `TemplateRow` in
   `propose_template_edit`'s input all name the exact existing types rather
   than inventing new ones — checked against `src/core/planner/edits.ts`,
   `src/core/planner/diff.ts`, and `src/lib/db/schemas.ts` while writing
   this spec.
4. **Ambiguity check:** "re-run against current state at confirm time"
   (rather than blindly persisting the stored diff) was made explicit
   because the alternative — trusting a diff computed possibly minutes or
   hours earlier — silently reintroduces the same staleness problem sub-
   project B's spec deliberately chose to accept for saved overrides, but
   here CT never explicitly reviewed the *current* state, only the
   state at proposal time. Re-validating at confirm keeps "nothing is
   applied that CT didn't actually see" true even across a delay.
