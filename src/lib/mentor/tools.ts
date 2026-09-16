import { z } from 'zod';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { previewEdits } from '@/lib/planner/reflowDay';
import { previewFuturePlan, previewFutureEdits } from '@/lib/planner/planAhead';
import { diffTemplate } from '@/core/planner/diffTemplate';
import { planClock } from '@/core/time';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { PlanEdit } from '@/core/planner/edits';
import { blockKind, priority, templateBlockSchema, type TemplateRow } from '@/lib/db/schemas';

/** The tools' `input_schema` only tells the model the outer shape (an array
 * of objects) — Anthropic's tool use doesn't enforce per-field types the way
 * this JSON Schema subset can't express (discriminated unions, numeric vs
 * string). Without this, a malformed edit (e.g. `start` sent as a clock
 * string like the template block shape uses, instead of a plan-minute
 * number) sails through `applyEdits` untyped, gets diffed and stored as a
 * 'pending' proposal, and only blows up — uncaught — when CT taps Confirm.
 * Validating in `parse` means BetaToolRunner's own try/catch turns a bad
 * call into an `is_error` tool_result the model can see and retry from,
 * instead of a landmine proposal CT discovers later. */
const planEditSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), blockId: z.string(), toStart: z.number() }),
  z.object({ type: z.literal('resize'), blockId: z.string(), durationMin: z.number() }),
  z.object({ type: z.literal('drop'), blockId: z.string() }),
  z.object({ type: z.literal('add'), id: z.string(), title: z.string(), kind: blockKind, start: z.number(), durationMin: z.number(), priority }),
]);
const planEditsSchema = z.array(planEditSchema);
const templateEditSchema = z.object({ weekday: z.number().int().min(0).max(6), restDay: z.boolean(), blocks: z.array(templateBlockSchema) });

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
  /** The assistant `mentor_messages` row this turn will log as (a
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
 * `confirmProposalAction`, triggered by CT's own tap, does that. */
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
    parse: (input) => {
      const { date, edits } = input as { date: string; edits: unknown };
      const parsed = planEditsSchema.safeParse(edits);
      if (!parsed.success) throw new Error(`Invalid edits: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      return { date, edits: parsed.data as PlanEdit[] };
    },
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
    parse: (input) => {
      const parsed = templateEditSchema.safeParse(input);
      if (!parsed.success) throw new Error(`Invalid template edit: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      return parsed.data as { weekday: number; restDay: boolean; blocks: TemplateRow['blocks'] };
    },
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
