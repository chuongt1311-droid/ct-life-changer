import type { z } from 'zod';

/** The slice of the Supabase JS client's query builder this repository needs.
 * Kept narrow and structural (not `SupabaseClient` itself) so it is easy to
 * fake in tests and easy to satisfy with the real client in production. */
export interface RepositoryClient {
  from(table: string): {
    select(columns: string): {
      // PromiseLike, not Promise: the real Supabase client returns a
      // thenable query builder here, not a Promise instance.
      match(filter: Record<string, unknown>): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
      eq(column: string, value: unknown): {
        maybeSingle(): PromiseLike<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    upsert(row: unknown): {
      select(columns: string): {
        single(): PromiseLike<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    delete(): {
      eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface TableRepository<Row> {
  list(match?: Partial<Row>): Promise<Row[]>;
  get(id: string, idColumn?: string): Promise<Row | null>;
  upsert(row: Row): Promise<Row>;
  remove(id: string, idColumn?: string): Promise<void>;
}

/** A CRUD repository over one Supabase table, validating every row in and out
 * with `schema` so a corrupt row (bad migration, manual SQL edit, model
 * hallucination) fails loudly instead of silently reaching the app. */
export function createTableRepository<Row>(
  client: RepositoryClient,
  table: string,
  schema: z.ZodType<Row>,
): TableRepository<Row> {
  return {
    async list(match = {}) {
      const { data, error } = await client.from(table).select('*').match(match as Record<string, unknown>);
      if (error) throw new Error(`${table}.list failed: ${error.message}`);
      return (data ?? []).map((row) => schema.parse(row));
    },
    async get(id, idColumn = 'id') {
      const { data, error } = await client.from(table).select('*').eq(idColumn, id).maybeSingle();
      if (error) throw new Error(`${table}.get failed: ${error.message}`);
      return data ? schema.parse(data) : null;
    },
    async upsert(row) {
      const validated = schema.parse(row);
      const { data, error } = await client.from(table).upsert(validated).select('*').single();
      if (error) throw new Error(`${table}.upsert failed: ${error.message}`);
      return schema.parse(data);
    },
    async remove(id, idColumn = 'id') {
      const { error } = await client.from(table).delete().eq(idColumn, id);
      if (error) throw new Error(`${table}.remove failed: ${error.message}`);
    },
  };
}
