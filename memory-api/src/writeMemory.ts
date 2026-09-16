import { randomUUID } from 'node:crypto';
import type { GraphClient } from './falkor';

export type MemoryLabel = 'DailyDigest' | 'WeeklyLetter' | 'MentorMemory';
const LABELS: readonly MemoryLabel[] = ['DailyDigest', 'WeeklyLetter', 'MentorMemory'];

export interface WriteMemoryInput {
  label: MemoryLabel;
  properties: Record<string, unknown>;
}

/** Cypher can't parameterize a label — it's baked into the query string —
 * so every label is checked against a fixed allowlist before it ever
 * reaches a query, closing off Cypher injection through this field. */
function assertKnownLabel(label: string): asserts label is MemoryLabel {
  if (!LABELS.includes(label as MemoryLabel)) throw new Error(`unknown label: ${label}`);
}

/** Chains DailyDigest → DailyDigest and WeeklyLetter → WeeklyLetter nodes
 * by date/weekStart order, for cheap "what happened around then"
 * traversal at query time. MentorMemory nodes aren't chained in v1 — see
 * the spec's scope note on cross-source linking. */
async function linkToPrevious(graph: GraphClient, label: MemoryLabel, id: string, properties: Record<string, unknown>): Promise<void> {
  if (label === 'DailyDigest') {
    const result = await graph.roQuery(
      'MATCH (n:DailyDigest) WHERE n.date < $date RETURN n.id ORDER BY n.date DESC LIMIT 1',
      { date: properties.date },
    );
    const prevId = result.data[0]?.[0];
    if (prevId) await graph.query('MATCH (a:DailyDigest {id: $prevId}), (b:DailyDigest {id: $id}) CREATE (a)-[:NEXT_DAY]->(b)', { prevId, id });
  } else if (label === 'WeeklyLetter') {
    const result = await graph.roQuery(
      'MATCH (n:WeeklyLetter) WHERE n.weekStart < $weekStart RETURN n.id ORDER BY n.weekStart DESC LIMIT 1',
      { weekStart: properties.weekStart },
    );
    const prevId = result.data[0]?.[0];
    if (prevId) await graph.query('MATCH (a:WeeklyLetter {id: $prevId}), (b:WeeklyLetter {id: $id}) CREATE (a)-[:NEXT_WEEK]->(b)', { prevId, id });
  }
}

export async function writeMemory(graph: GraphClient, input: WriteMemoryInput): Promise<{ id: string }> {
  assertKnownLabel(input.label);
  const id = randomUUID();
  const source = input.label === 'MentorMemory' ? 'mentor-inferred' : 'app';
  const params = { id, source, createdAt: new Date().toISOString(), ...input.properties };
  // The label is interpolated (validated above), everything else is a
  // parameter — this is the one place a label is ever baked into a
  // query string in this service.
  await graph.query(`CREATE (n:${input.label} $props)`, { props: params });
  // linkToPrevious called separately to maintain test compatibility
  await linkToPrevious(graph, input.label, id, input.properties);
  return { id };
}
