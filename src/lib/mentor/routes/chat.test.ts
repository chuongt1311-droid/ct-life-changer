import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { chat } from './chat';

function fakeClient() {
  const tables: Record<string, Record<string, unknown>[]> = { usage: [], mentor_messages: [] };
  return {
    from: (table: string) => ({
      select: (_columns: string) => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: (_columns: string) => ({ single: async () => { (tables[table] ??= []).push(row); return { data: row, error: null }; } }),
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
