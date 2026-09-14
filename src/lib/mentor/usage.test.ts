import { describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import type { RepositoryClient } from '@/lib/db/repository';
import { checkCap, extractUsage, recordUsage } from './usage';

function fakeClient(existingUsageRows: Record<string, unknown>[]) {
  const rows = [...existingUsageRows];
  return {
    from: (table: string) => {
      if (table !== 'usage') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          match: async () => ({ data: rows, error: null }),
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } satisfies RepositoryClient;
}

describe('extractUsage', () => {
  it('maps the SDK message usage fields to UsageTokens', () => {
    const message = {
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 10 },
    } as Anthropic.Message;
    expect(extractUsage(message)).toEqual({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 20, cacheWriteTokens: 10 });
  });

  it('defaults missing cache fields to zero', () => {
    const message = { usage: { input_tokens: 5, output_tokens: 3 } } as Anthropic.Message;
    expect(extractUsage(message)).toEqual({ inputTokens: 5, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });
});

describe('recordUsage', () => {
  it('computes cost from the model price table and writes a usage row', async () => {
    const client = fakeClient([]);
    const row = await recordUsage(client, {
      ownerId: 'ct',
      route: 'briefing',
      model: 'claude-sonnet-5',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    });
    expect(row.cost_usd).toBe(2); // $2 / 1M input tokens for claude-sonnet-5
    expect(row.route).toBe('briefing');
  });
});

describe('checkCap', () => {
  it('sums only this calendar month\'s cost and reports over when spend >= cap', async () => {
    const client = fakeClient([
      { id: 'a', owner_id: 'ct', created_at: '2026-09-01T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 6 },
      { id: 'b', owner_id: 'ct', created_at: '2026-08-15T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 100 },
    ]);
    const status = await checkCap(client, 'ct', 12, new Date('2026-09-20T00:00:00Z'));
    expect(status.spentUsd).toBe(6); // August's row is excluded
    expect(status.over).toBe(false);
  });

  it('reports over once this month\'s spend reaches the cap', async () => {
    const client = fakeClient([
      { id: 'a', owner_id: 'ct', created_at: '2026-09-05T00:00:00Z', route: 'chat', model: 'claude-sonnet-5', input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, cost_usd: 12 },
    ]);
    const status = await checkCap(client, 'ct', 12, new Date('2026-09-20T00:00:00Z'));
    expect(status.over).toBe(true);
  });
});
