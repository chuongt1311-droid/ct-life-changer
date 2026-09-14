import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '@/lib/db/repository';
import { assembleMentorContext } from './assembleContext';

function fakeClient(seed: {
  profileVersions?: Record<string, unknown>[];
  weeklyLetters?: Record<string, unknown>[];
  digests?: Record<string, unknown>[];
  plans?: Record<string, unknown>[];
  blocks?: Record<string, unknown>[];
  checkins?: Record<string, unknown>[];
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    profile_versions: seed.profileVersions ?? [],
    weekly_letters: seed.weeklyLetters ?? [],
    digests: seed.digests ?? [],
    plans: seed.plans ?? [],
    blocks: seed.blocks ?? [],
    checkins: seed.checkins ?? [],
  };
  return {
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
      upsert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('assembleMentorContext', () => {
  it('falls back to an empty profile when no profile_versions row exists', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.profile.goalsPhysical).toBe('');
  });

  it('uses the most recently created profile version', async () => {
    const client = fakeClient({
      profileVersions: [
        { id: 'v1', owner_id: 'x', created_at: '2026-09-01T00:00:00Z', sections: { goalsPhysical: 'old' }, author: 'user', changes: [] },
        { id: 'v2', owner_id: 'x', created_at: '2026-09-10T00:00:00Z', sections: { goalsPhysical: 'new' }, author: 'user', changes: [] },
      ],
    });
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.profile.goalsPhysical).toBe('new');
  });

  it('falls back to state ready with no flags/adjustments when no plan row exists for the date', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.today.state).toBe('ready');
    expect(input.today.flags).toEqual([]);
    expect(input.today.adjustments).toEqual([]);
    expect(input.today.overridden).toBe(false);
  });

  it('reads the real plan row, blocks, and checkins for the date', async () => {
    const client = fakeClient({
      plans: [{ date: '2026-09-14', owner_id: 'x', state: 'drifting', flags: [{ code: 'INDULGE_HIGH', state: 'drifting', reason: 'x' }], adjustments: [], overridden: true }],
      blocks: [{ id: 'b1', owner_id: 'x', date: '2026-09-14', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: 540, end: 600, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null, status: 'planned', source: 'template' }],
      checkins: [{ id: 'c1', owner_id: 'x', date: '2026-09-14', type: 'morning', sections: { mind: { mood: 6, stress: 3, stressCause: [] } }, private_keys: [], created_at: '2026-09-14T07:00:00Z' }],
    });
    const input = await assembleMentorContext(client, { systemPrompt: 'sys', date: '2026-09-14', request: 'briefing' });
    expect(input.today.state).toBe('drifting');
    expect(input.today.overridden).toBe(true);
    expect(input.today.blocks).toHaveLength(1);
    expect(input.today.checkins).toHaveLength(1);
    expect(input.today.checkins[0]!.privateKeys).toEqual([]);
  });

  it('passes the system prompt, request, and chat history straight through', async () => {
    const client = fakeClient({});
    const input = await assembleMentorContext(client, {
      systemPrompt: 'the persona',
      date: '2026-09-14',
      request: 'What should I do today?',
      chatHistory: [{ role: 'user', content: 'hi' }],
    });
    expect(input.systemPrompt).toBe('the persona');
    expect(input.request).toBe('What should I do today?');
    expect(input.chatHistory).toEqual([{ role: 'user', content: 'hi' }]);
  });
});
