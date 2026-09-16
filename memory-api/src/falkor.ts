import { FalkorDB } from 'falkordb';

export interface GraphClient {
  query(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
  roQuery(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
}

/** Wraps a real FalkorDB Graph client to adapt its signature (QueryOptions with nested
 * params) to our GraphClient interface (direct params). Also normalizes the optional
 * data field to always return an array. */
export function adaptGraphClient(graph: ReturnType<typeof FalkorDB.prototype.selectGraph>): GraphClient {
  return {
    async query(cypher, params) {
      const result = await graph.query<unknown[]>(cypher, { params: params as never });
      return { data: result.data ?? ([] as unknown[][]) };
    },
    async roQuery(cypher, params) {
      const result = await graph.roQuery<unknown[]>(cypher, { params: params as never });
      return { data: result.data ?? ([] as unknown[][]) };
    },
  };
}

/** Real FalkorDB connection, one graph named 'mentor_memory'. Every route
 * handler receives a `GraphClient` — tests inject a fake instead of this. */
export async function connectGraph(): Promise<GraphClient> {
  const db = await FalkorDB.connect({
    username: 'default',
    password: process.env.FALKORDB_PASSWORD,
    socket: { host: process.env.FALKORDB_HOST ?? 'localhost', port: Number(process.env.FALKORDB_PORT ?? 6379) },
  });
  const graph = db.selectGraph('mentor_memory');
  return adaptGraphClient(graph);
}
