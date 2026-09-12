import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTableRepository } from './repository';

const rowSchema = z.object({ id: z.string(), name: z.string(), owner_id: z.string() });
type Row = z.infer<typeof rowSchema>;

/** A minimal fake standing in for the slice of the Supabase query builder the
 * repository actually calls, so this test needs no network and no project. */
function fakeClient(initial: Row[]) {
  const rows = [...initial];
  return {
    rows,
    from(table: string) {
      expect(table).toBe('widgets');
      return {
        select: () => ({
          match: async (filter: Partial<Row>) => ({
            data: rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v)),
            error: null,
          }),
          eq: (col: string, value: unknown) => ({
            maybeSingle: async () => ({ data: rows.find((r) => (r as never)[col] === value) ?? null, error: null }),
          }),
        }),
        upsert: (row: Row) => ({
          select: () => ({
            single: async () => {
              const i = rows.findIndex((r) => r.id === row.id);
              if (i >= 0) rows[i] = row;
              else rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (col: string, value: unknown) => {
            const i = rows.findIndex((r) => (r as never)[col] === value);
            if (i >= 0) rows.splice(i, 1);
            return { error: null };
          },
        }),
      };
    },
  };
}

describe('createTableRepository', () => {
  it('lists rows matching a filter, validated by the schema', async () => {
    const client = fakeClient([
      { id: 'a', name: 'Alpha', owner_id: 'ct' },
      { id: 'b', name: 'Beta', owner_id: 'ct' },
    ]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    const rows = await repo.list({ owner_id: 'ct' });
    expect(rows).toHaveLength(2);
  });

  it('rejects a row that fails schema validation', async () => {
    const client = fakeClient([{ id: 'a', name: 'Alpha', owner_id: 'ct' } as Row]);
    // Sneak in a malformed row the schema should reject.
    client.rows.push({ id: 'bad' } as unknown as Row);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    await expect(repo.list()).rejects.toThrow();
  });

  it('upserts and round-trips a row through get()', async () => {
    const client = fakeClient([]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    const written = await repo.upsert({ id: 'a', name: 'Alpha', owner_id: 'ct' });
    expect(written.name).toBe('Alpha');
    const fetched = await repo.get('a');
    expect(fetched).toEqual(written);
  });

  it('get() returns null for a missing id', async () => {
    const client = fakeClient([]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    expect(await repo.get('missing')).toBeNull();
  });

  it('remove() deletes by id', async () => {
    const client = fakeClient([{ id: 'a', name: 'Alpha', owner_id: 'ct' }]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    await repo.remove('a');
    expect(await repo.get('a')).toBeNull();
  });
});
