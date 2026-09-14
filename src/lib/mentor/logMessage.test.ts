import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '@/lib/db/repository';
import { logMentorMessage } from './logMessage';

function fakeClient() {
  const rows: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({ match: async () => ({ data: rows, error: null }), eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: (row: Record<string, unknown>) => ({ select: () => ({ single: async () => { rows.push(row); return { data: row, error: null }; } }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
  return { client, rows };
}

describe('logMentorMessage', () => {
  it('writes a mentor_messages row with the given fields', async () => {
    const { client, rows } = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-14', route: 'briefing', role: 'assistant', content: 'Hello', stateAtTime: 'ready', usageId: null });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ owner_id: 'ct', date: '2026-09-14', route: 'briefing', role: 'assistant', content: 'Hello', state_at_time: 'ready' });
  });
});
