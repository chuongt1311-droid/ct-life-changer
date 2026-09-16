import type { GraphClient } from './falkor';

export interface MentorMemoryRow {
  id: string;
  text: string;
  confidence: string;
  createdAt: string;
}

export async function listMentorMemories(graph: GraphClient): Promise<MentorMemoryRow[]> {
  const result = await graph.roQuery('MATCH (n:MentorMemory) RETURN n.id, n.text, n.confidence, n.createdAt ORDER BY n.createdAt DESC');
  return result.data.map((row) => ({ id: row[0] as string, text: row[1] as string, confidence: row[2] as string, createdAt: row[3] as string }));
}

export async function deleteMemory(graph: GraphClient, id: string): Promise<void> {
  await graph.query('MATCH (n {id: $id}) DETACH DELETE n', { id });
}
