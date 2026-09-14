import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { weeklyReview } from './weeklyReview';

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
