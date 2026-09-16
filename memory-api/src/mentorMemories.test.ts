import { describe, expect, it, vi } from 'vitest';
import type { GraphClient } from './falkor';
import { listMentorMemories, deleteMemory } from './mentorMemories';

describe('listMentorMemories', () => {
  it('maps rows into MentorMemoryRow objects, newest first', async () => {
    const graph: GraphClient = {
      query: vi.fn(),
      roQuery: vi.fn(async () => ({ data: [['id1', 'CT prefers mornings', 'high', '2026-09-16T00:00:00.000Z']] })),
    };
    const rows = await listMentorMemories(graph);
    expect(rows).toEqual([{ id: 'id1', text: 'CT prefers mornings', confidence: 'high', createdAt: '2026-09-16T00:00:00.000Z' }]);
  });
});

describe('deleteMemory', () => {
  it('detaches and deletes the node by id', async () => {
    const calls: { cypher: string; params?: Record<string, unknown> }[] = [];
    const graph: GraphClient = {
      query: vi.fn(async (cypher, params) => {
        calls.push({ cypher, params });
        return { data: [] };
      }),
      roQuery: vi.fn(),
    };
    await deleteMemory(graph, 'id1');
    expect(calls[0]!.cypher).toContain('DETACH DELETE');
    expect(calls[0]!.params).toEqual({ id: 'id1' });
  });
});
