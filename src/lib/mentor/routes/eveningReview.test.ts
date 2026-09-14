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
    mentor_messages: [],
  };
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

  it('falls back with the cap message when month-to-date spend is at the cap', async () => {
    const client = fakeClient();
    await client
      .from('usage')
      .upsert({ id: 'a', owner_id: 'ct', created_at: new Date().toISOString(), route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 })
      .select('*')
      .single();
    const anthropic = fakeAnthropicParse({ message: 'should not be called', digest: 'x', tomorrowNote: '', crisis: false });
    const result = await eveningReview(client, anthropic, baseParams, '2026-09-14');
    expect(result.fallback).toBe(true);
    expect(result.message).toContain("Mentor's resting until");
    expect(anthropic.messages.parse).not.toHaveBeenCalled();
  });
});
