import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '../repository';
import { getTemplate, listTemplates, upsertTemplate } from './templates';

function fakeClient(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v)),
          error: null,
        }),
        eq: (col: string, value: unknown) => ({
          maybeSingle: async () => ({ data: rows.find((r) => (r as never)[col] === value) ?? null, error: null }),
        }),
      }),
      upsert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            const i = rows.findIndex((r) => (r as { weekday: number }).weekday === (row as { weekday: number }).weekday);
            if (i >= 0) rows[i] = row;
            else rows.push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('templates repository', () => {
  it('gets a single weekday template by weekday, not by id', async () => {
    const client = fakeClient([{ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] }]);
    expect(await getTemplate(client, 1)).toEqual({ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] });
    expect(await getTemplate(client, 2)).toBeNull();
  });

  it('lists all seven weekday templates', async () => {
    const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, owner_id: 'ct', rest_day: false, blocks: [] }));
    const client = fakeClient(rows);
    expect(await listTemplates(client)).toHaveLength(7);
  });

  it('upserts by weekday', async () => {
    const client = fakeClient([]);
    await upsertTemplate(client, { weekday: 0, owner_id: 'ct', rest_day: true, blocks: [] });
    expect(await getTemplate(client, 0)).toMatchObject({ rest_day: true });
  });
});
