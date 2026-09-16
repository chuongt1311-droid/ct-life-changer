import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor.js';
import { writeMemory } from './writeMemory.js';

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

  it('writes a DailyDigest node with a generated id and source', async () => {
    const graph = fakeGraph();
    const result = await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'A quiet day.' } });
    expect(result.id).toEqual(expect.any(String));
    const writeCall = graph.calls.find((c) => c.cypher.includes('MERGE (n:DailyDigest'));
    expect(writeCall).toBeDefined();
    expect(writeCall!.params).toMatchObject({ key: '2026-09-15', props: { id: result.id, source: 'app', date: '2026-09-15', text: 'A quiet day.' } });
  });

  it('merges a DailyDigest on its date rather than creating a duplicate', async () => {
    const graph = fakeGraph();
    await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'A quiet day.' } });
    const writeCall = graph.calls.find((c) => c.cypher.includes('MERGE (n:DailyDigest'))!;
    expect(writeCall.cypher).toContain('MERGE (n:DailyDigest {date: $key})');
    expect(writeCall.cypher).toContain('ON CREATE SET n = $props');
    expect(writeCall.cypher).toContain('ON MATCH SET n += $updates');
    // A re-write must not renumber an existing node — that would orphan
    // every edge and reference already pointing at it.
    expect(writeCall.params!.updates).not.toHaveProperty('id');
    expect(writeCall.params!.updates).not.toHaveProperty('createdAt');
    expect(graph.calls.some((c) => c.cypher.includes('CREATE (n:DailyDigest'))).toBe(false);
  });

  it('merges a WeeklyLetter on its weekStart', async () => {
    const graph = fakeGraph();
    await writeMemory(graph, { label: 'WeeklyLetter', properties: { weekStart: '2026-09-14', text: 'Letter.' } });
    const writeCall = graph.calls.find((c) => c.cypher.includes('MERGE (n:WeeklyLetter'))!;
    expect(writeCall.cypher).toContain('MERGE (n:WeeklyLetter {weekStart: $key})');
    expect(writeCall.params).toMatchObject({ key: '2026-09-14' });
  });

  it('returns the existing node id when the merge matched an earlier write', async () => {
    const graph = fakeGraph();
    graph.query = vi.fn(async (cypher: string) => ({ data: cypher.includes('MERGE (n:DailyDigest') ? [['already-there']] : [] }));
    const result = await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'Rewritten.' } });
    expect(result.id).toBe('already-there');
  });

  it('still creates MentorMemory unconditionally — it has no natural key', async () => {
    const graph = fakeGraph();
    await writeMemory(graph, { label: 'MentorMemory', properties: { text: 'CT prefers mornings', confidence: 'medium' } });
    expect(graph.calls.some((c) => c.cypher.includes('CREATE (n:MentorMemory'))).toBe(true);
    expect(graph.calls.some((c) => c.cypher.includes('MERGE (n:MentorMemory'))).toBe(false);
  });

  it('chains a DailyDigest to the previous day if one exists', async () => {
    const graph = fakeGraph();
    graph.roQuery = vi.fn(async () => ({ data: [['prev-id']] })); // simulates finding yesterday's node id
    await writeMemory(graph, { label: 'DailyDigest', properties: { date: '2026-09-15', text: 'Text.' } });
    const linkCall = graph.calls.find((c) => c.cypher.includes('NEXT_DAY'));
    expect(linkCall).toBeDefined();
    // MERGE, so re-running the backfill can't stack duplicate edges.
    expect(linkCall!.cypher).toContain('MERGE (a)-[:NEXT_DAY]->(b)');
  });
});
