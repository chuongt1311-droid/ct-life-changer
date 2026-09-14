import type { RepositoryClient } from '@/lib/db/repository';

/** Primary key per table — mirrors supabase/migrations/0001_init.sql and
 * 0002_nudges_and_digest_retry.sql. Used only to make upsert() replace an
 * existing row instead of appending a duplicate, the way a real Postgres
 * upsert-by-primary-key would. */
const PRIMARY_KEY: Record<string, string> = {
  settings: 'id',
  templates: 'weekday',
  plans: 'date',
  blocks: 'id',
  checkins: 'id',
  rest_sessions: 'id',
  unplanned_indulgence: 'id',
  mentor_messages: 'id',
  digests: 'date',
  weekly_letters: 'week_start',
  profile_versions: 'id',
  push_subscriptions: 'id',
  nudges_sent: 'id',
  usage: 'id',
};

/** A minimal in-memory stand-in for the Supabase query builder slice
 * `RepositoryClient` needs, seeded per table. Exposes `tables` so a test can
 * assert on what got written. */
export function fakeClient(seed: Partial<Record<string, Record<string, unknown>[]>> = {}): RepositoryClient & { tables: Record<string, Record<string, unknown>[]> } {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const [table, rows] of Object.entries(seed)) tables[table] = [...(rows ?? [])];

  return {
    tables,
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: (col: string, value: unknown) => ({
          maybeSingle: async () => ({ data: (tables[table] ?? []).find((r) => r[col] === value) ?? null, error: null }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const key = PRIMARY_KEY[table] ?? 'id';
            const rows = (tables[table] ??= []);
            const i = rows.findIndex((r) => r[key] === row[key]);
            if (i >= 0) rows[i] = row;
            else rows.push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async (col: string, value: unknown) => {
          const rows = (tables[table] ??= []);
          const i = rows.findIndex((r) => r[col] === value);
          if (i >= 0) rows.splice(i, 1);
          return { error: null };
        },
      }),
    }),
  };
}
