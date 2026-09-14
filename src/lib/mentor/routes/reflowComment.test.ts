import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { reflowComment } from './reflowComment';

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
