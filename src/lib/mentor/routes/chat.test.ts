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
