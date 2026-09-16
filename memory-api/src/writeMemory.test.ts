import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { writeMemory } from './writeMemory';

function fakeGraph(): GraphClient & { calls: { cypher: string; params?: Record<string, unknown> }[] } {
  const calls: { cypher: string; params?: Record<string, unknown> }[] = [];
  return {
    calls,
    query: vi.fn(async (cypher, params) => {
      calls.push({ cypher, params });
      return { data: [] };
    }),
    roQuery: vi.fn(async (cypher, params) => {
      calls.push({ cypher, params });
      return { data: [] };
    }),
  };
}

describe('writeMemory', () => {
  it('rejects a label outside the allowlist (Cypher labels cannot be parameterized)', async () => {
    const graph = fakeGraph();
    await expect(writeMemory(graph, { label: 'Robbery; DROP GRAPH' as never, properties: {} })).rejects.toThrow(/unknown label/i);
  });

  it('creates a DailyDigest node with a generated id and source', async () => {
    const graph = fakeGraph();
    const result = await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'A quiet day.' } });
    expect(result.id).toEqual(expect.any(String));
    const createCall = graph.calls.find((c) => c.cypher.includes('CREATE (n:DailyDigest'));
    expect(createCall).toBeDefined();
    expect(createCall!.params).toMatchObject({ props: { id: result.id, source: 'app', date: '2026-09-15', text: 'A quiet day.' } });
  });

  it('chains a DailyDigest to the previous day if one exists', async () => {
    const graph = fakeGraph();
    graph.roQuery = vi.fn(async () => ({ data: [['prev-id']] })); // simulates finding yesterday's node id
    await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'Text.' } });
    const linkCall = graph.calls.find((c) => c.cypher.includes('NEXT_DAY'));
    expect(linkCall).toBeDefined();
  });
});
