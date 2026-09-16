import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import type { RepositoryClient } from '@/lib/db/repository';
import { chat } from './chat';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

const baseParams = { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 };

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
  return { beta: { messages: { toolRunner: vi.fn(() => ({ [Symbol.asyncIterator]: runner })) } } };
}

/** A fake client whose runner throws as soon as it's iterated — simulates a
 * mid-stream API failure. */
function fakeAnthropicError() {
  const toolRunner = vi.fn(() => ({
    [Symbol.asyncIterator]: () => ({
      next: async () => {
        throw new Error('stream error');
      },
    }),
  }));
  return { beta: { messages: { toolRunner } } };
}

/** `fakeClient` (unlike real Postgres) doesn't enforce foreign keys, so it
 * couldn't have caught the real bug this guards against: a tool's proposal
 * row references this turn's not-yet-logged assistant message, and real
 * Postgres rejects that with error 23503 (confirmed by direct reproduction
 * against the test project). This wraps `fakeClient` to enforce that one
 * relationship the same way, so a regression here fails fast in a unit
 * test instead of only being discoverable by clicking through in prod. */
function withMentorProposalsForeignKey(client: ReturnType<typeof fakeClient>): RepositoryClient {
  const originalFrom = client.from.bind(client);
  return {
    ...client,
    from: (table: string) => {
      const base = originalFrom(table);
      if (table !== 'mentor_proposals') return base;
      return {
        ...base,
        upsert: (row: Record<string, unknown>) => {
          const exists = (client.tables.mentor_messages ?? []).some((m) => m.id === row.message_id);
          if (!exists) {
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: `insert or update on table "mentor_proposals" violates foreign key constraint "mentor_proposals_message_id_fkey"` },
                }),
              }),
            };
          }
          return base.upsert(row);
        },
      };
    },
  };
}

/** A fake Anthropic client that actually runs the tool the model "calls" —
 * mirroring the real SDK's `generateToolResponse` (BetaToolRunner.js):
 * parse the input, await `tool.run(...)`, turn a thrown error into an
 * `is_error` tool_result instead of letting it escape. First iteration
 * emits the tool_use and no text; second iteration is the model's
 * follow-up text after seeing the tool result. */
function fakeAnthropicWithToolCall(toolName: string, toolInput: unknown) {
  const toolRunner = vi.fn((callArgs: { tools: { name: string; parse?: (i: unknown) => unknown; run: (i: unknown, ctx: unknown) => Promise<unknown> }[] }) => {
    async function* runner() {
      const tool = callArgs.tools.find((t) => t.name === toolName)!;
      yield {
        [Symbol.asyncIterator]: async function* () {
          /* no text this iteration */
        },
        finalMessage: async () => ({
          content: [{ type: 'tool_use', id: 'tu1', name: toolName, input: toolInput }],
          usage: { input_tokens: 5, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null },
        }),
      };

      let replyText = 'Done.';
      try {
        const parsed = tool.parse ? tool.parse(toolInput) : toolInput;
        await tool.run(parsed, { toolUse: { type: 'tool_use', id: 'tu1', name: toolName, input: toolInput } });
      } catch (e) {
        replyText = `Ran into: ${e instanceof Error ? e.message : String(e)}`;
      }

      async function* fakeEvents() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: replyText } };
      }
      yield {
        [Symbol.asyncIterator]: fakeEvents,
        finalMessage: async () => ({ usage: { input_tokens: 5, output_tokens: 5, cache_read_input_tokens: null, cache_creation_input_tokens: null } }),
      };
    }
    return { [Symbol.asyncIterator]: runner };
  });
  return { beta: { messages: { toolRunner } } };
}

async function collect(gen: AsyncGenerator<{ type: string; text?: string }, { fallback: boolean }, void>) {
  const events: { type: string; text?: string }[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, result: next.value };
}

describe('chat with tools', () => {
  it('streams text events and logs one assistant message for the turn', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      plans: [{ date: '2026-09-15', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false }],
    });
    const anthropic = fakeAnthropic('Sounds good.');
    const events: unknown[] = [];
    const gen = chat(client, anthropic as never, { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 }, '2026-09-15', 'How am I doing?');
    for await (const event of gen) events.push(event);

    expect(events).toContainEqual({ type: 'text', text: 'Sounds good.' });
    const assistantRows = client.tables.mentor_messages!.filter((m) => m.role === 'assistant');
    expect(assistantRows).toHaveLength(1);
    expect(assistantRows[0]!.content).toBe('Sounds good.');
    expect(client.tables.usage).toHaveLength(1);
  });

  it('logs the assistant message before running tools, so a successful proposal can reference it', async () => {
    const client = withMentorProposalsForeignKey(
      fakeClient({
        settings: [settingsRow],
        plans: [{ date: '2026-09-15', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false }],
        blocks: [{ id: 'deep', owner_id: 'ct', date: '2026-09-15', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: 540, end: 600, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null, status: 'planned', source: 'template' }],
      }),
    );
    const anthropic = fakeAnthropicWithToolCall('propose_schedule_edit', { date: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }] });
    const gen = chat(client, anthropic as never, { ownerId: 'ct', model: 'claude-sonnet-5', monthlyCapUsd: 12 }, '2026-09-15', 'Can you make deep work longer?');
    const events: unknown[] = [];
    for await (const event of gen) events.push(event);

    // Before the fix: mentor_proposals.upsert failed with the simulated FK
    // error, the tool caught it and told the model "Ran into: ...", and no
    // proposal event or row was ever produced.
    expect(events).toContainEqual({ type: 'text', text: 'Done.' });
    expect((client as unknown as ReturnType<typeof fakeClient>).tables.mentor_proposals).toHaveLength(1);
  });

  it('yields the canned fallback and reports fallback:true when the tool runner errors', async () => {
    const client = fakeClient({ settings: [settingsRow] });
    const gen = chat(client, fakeAnthropicError() as never, baseParams, '2026-09-14', 'hi');
    const { events, result } = await collect(gen);
    expect(events.some((e) => e.type === 'text' && e.text?.includes("Mentor's unavailable right now"))).toBe(true);
    expect(result.fallback).toBe(true);
  });

  it('yields the cap message without touching the tool runner when over cap', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      usage: [{ id: 'a', owner_id: 'ct', created_at: new Date().toISOString(), route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 }],
    });
    const anthropic = fakeAnthropic('should not run');
    const gen = chat(client, anthropic as never, baseParams, '2026-09-14', 'hi');
    const { events, result } = await collect(gen);
    expect(events.some((e) => e.type === 'text' && e.text?.includes("Mentor's resting until"))).toBe(true);
    expect(result.fallback).toBe(true);
    expect(anthropic.beta.messages.toolRunner).not.toHaveBeenCalled();
  });
});
