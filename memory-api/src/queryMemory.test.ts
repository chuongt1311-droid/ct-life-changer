import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { queryMemory } from './queryMemory';

function fakeGraph(matchRows: unknown[][], neighborRows: unknown[][] = []): GraphClient {
  return {
    query: vi.fn(async () => ({ data: [] })),
    roQuery: vi.fn(async (cypher: string) => {
      if (cypher.includes('CONTAINS')) return { data: matchRows };
      return { data: neighborRows };
    }),
  };
}

describe('queryMemory', () => {
  it('returns an empty string when nothing matches', async () => {
    const graph = fakeGraph([]);
    const text = await queryMemory(graph, 'anything at all');
    expect(text).toBe('');
  });

  it('returns matched node text', async () => {
    const graph = fakeGraph([['DailyDigest', 'id1', 'You skipped deep work again on Tuesday.']]);
    const text = await queryMemory(graph, 'deep work');
    expect(text).toContain('You skipped deep work again on Tuesday.');
  });

  it('caps total output at maxChars', async () => {
    const longText = 'x'.repeat(5000);
    const graph = fakeGraph([['DailyDigest', 'id1', longText], ['DailyDigest', 'id2', longText]]);
    const text = await queryMemory(graph, 'x', 100);
    expect(text.length).toBeLessThanOrEqual(120); // small allowance for formatting
  });

  it('ignores stopwords and very short terms when building the keyword list', async () => {
    const graph = fakeGraph([]);
    await queryMemory(graph, 'the a of it');
    // No real keywords survive filtering, so no CONTAINS query should even run.
    expect((graph.roQuery as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
