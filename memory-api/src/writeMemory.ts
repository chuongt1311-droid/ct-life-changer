import { randomUUID } from 'node:crypto';
import type { GraphClient } from './falkor.js';

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

/** The property that already uniquely identifies a node of this label, for
 * nodes that have a natural date-based identity. MentorMemory has none —
 * the `remember` tool's writes are always genuinely new — so it stays on
 * the unconditional CREATE path. */
const NATURAL_KEY: Partial<Record<MemoryLabel, string>> = {
  DailyDigest: 'date',
  WeeklyLetter: 'weekStart',
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** FalkorDB's inline-parameter mechanism can bind a parameter to a flat
 * scalar or array value, but its parser rejects a parameter whose VALUE is
 * itself a map/object — "Encountered unhandled type in inlined
 * properties." — confirmed directly against a live FalkorDB instance, not
 * assumed from docs. So instead of sending a whole properties object as
 * one `$props` parameter, every property becomes its own top-level scalar
 * parameter, referenced by name in a map literal built into the query
 * text itself. Cypher map keys are identifiers, not values — they can
 * never be bound as parameters — so they're validated against a strict
 * identifier pattern before being interpolated, the same way
 * `assertKnownLabel` already guards the label. */
function assertValidKeys(props: Record<string, unknown>): void {
  for (const key of Object.keys(props)) {
    if (!IDENTIFIER.test(key)) throw new Error(`invalid property key: ${key}`);
  }
}

function mapLiteral(keys: string[]): string {
  return `{${keys.map((k) => `${k}: $${k}`).join(', ')}}`;
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
    // MERGE, not CREATE: a re-run over the same date must not stack up a
    // second NEXT_DAY edge between the same two nodes.
    if (prevId) await graph.query('MATCH (a:DailyDigest {id: $prevId}), (b:DailyDigest {id: $id}) MERGE (a)-[:NEXT_DAY]->(b)', { prevId, id });
  } else if (label === 'WeeklyLetter') {
    const result = await graph.roQuery(
      'MATCH (n:WeeklyLetter) WHERE n.weekStart < $weekStart RETURN n.id ORDER BY n.weekStart DESC LIMIT 1',
      { weekStart: properties.weekStart },
    );
    const prevId = result.data[0]?.[0];
    if (prevId) await graph.query('MATCH (a:WeeklyLetter {id: $prevId}), (b:WeeklyLetter {id: $id}) MERGE (a)-[:NEXT_WEEK]->(b)', { prevId, id });
  }
}

export async function writeMemory(graph: GraphClient, input: WriteMemoryInput): Promise<{ id: string }> {
  assertKnownLabel(input.label);
  assertValidKeys(input.properties);
  const id = randomUUID();
  const source = input.label === 'MentorMemory' ? 'mentor-inferred' : 'app';
  const params: Record<string, unknown> = { id, source, createdAt: new Date().toISOString(), ...input.properties };

  const keyProp = NATURAL_KEY[input.label];
  const keyValue = keyProp ? input.properties[keyProp] : undefined;
  const hasNaturalKey = keyProp !== undefined && (typeof keyValue === 'string' || typeof keyValue === 'number');

  // The label is interpolated (validated above), everything else is a
  // parameter — this is the one place a label is ever baked into a
  // query string in this service. The key property name comes from the
  // fixed NATURAL_KEY table, never from the request.
  let effectiveId: string = id;
  if (hasNaturalKey) {
    // A DailyDigest for a date, or a WeeklyLetter for a weekStart, is the
    // same node however many times it's written. Without this, re-running
    // the backfill duplicates every node, and a real check-in between
    // deploy and backfill gets a second node for the same date.
    // ON MATCH deliberately leaves `id`/`createdAt` out of its SET clause
    // so existing edges and anything already holding the id stay valid.
    const { id: _newId, createdAt: _newCreatedAt, ...updateFields } = params;
    const updateKeys = Object.keys(updateFields);
    const setClause = updateKeys.map((k) => `n.${k} = $${k}`).join(', ');
    const result = await graph.query(
      `MERGE (n:${input.label} {${keyProp}: $key}) ON CREATE SET n = ${mapLiteral(Object.keys(params))} ON MATCH SET ${setClause} RETURN n.id`,
      { key: keyValue, ...params },
    );
    const existingId = result.data[0]?.[0];
    if (typeof existingId === 'string') effectiveId = existingId;
  } else {
    await graph.query(`CREATE (n:${input.label} ${mapLiteral(Object.keys(params))})`, params);
  }
  // linkToPrevious called separately to maintain test compatibility
  await linkToPrevious(graph, input.label, effectiveId, input.properties);
  return { id: effectiveId };
}
