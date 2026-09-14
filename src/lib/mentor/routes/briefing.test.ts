import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { briefing } from './briefing';

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
        select: (_columns: string) => ({
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
    const result = await briefing(client, fakeAnthropicSuccess('Today: one deep-work block, then rest.'), baseParams, '2026-09-14');
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
