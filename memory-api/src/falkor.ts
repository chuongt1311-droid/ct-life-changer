import { FalkorDB } from 'falkordb';

export interface GraphClient {
  query(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
  roQuery(cypher: string, params?: Record<string, unknown>): Promise<{ data: unknown[][] }>;
}

/** Real FalkorDB connection, one graph named 'mentor_memory'. Every route
 * handler receives a `GraphClient` — tests inject a fake instead of this. */
export async function connectGraph(): Promise<GraphClient> {
  const db = await FalkorDB.connect({
    username: 'default',
    password: process.env.FALKORDB_PASSWORD,
    socket: { host: process.env.FALKORDB_HOST ?? 'localhost', port: Number(process.env.FALKORDB_PORT ?? 6379) },
  });
  return db.selectGraph('mentor_memory') as unknown as GraphClient;
}
