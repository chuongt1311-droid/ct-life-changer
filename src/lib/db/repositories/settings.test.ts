import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import type { RepositoryClient } from '../repository';
import { getSettings, upsertSettings } from './settings';

function fakeClient(row: unknown | null) {
  let stored = row;
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }),
        match: async () => ({ data: stored ? [stored] : [], error: null }),
      }),
      upsert: (r: unknown) => ({
        select: () => ({ single: async () => ({ data: (stored = r), error: null }) }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('settings repository', () => {
  it('returns null when settings has not been seeded yet', async () => {
    expect(await getSettings(fakeClient(null))).toBeNull();
  });

  it('round-trips DEFAULT_SETTINGS shaped as a row', async () => {
    const client = fakeClient(null);
    const written = await upsertSettings(client, {
      id: 'singleton',
      owner_id: 'ct',
      timezone: DEFAULT_SETTINGS.timezone,
      wake_time: DEFAULT_SETTINGS.wakeTime,
      bedtime: DEFAULT_SETTINGS.bedtime,
      model: DEFAULT_SETTINGS.model,
      monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
      nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
      deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
      thresholds: DEFAULT_THRESHOLDS,
      crisis_contacts: [],
    });
    expect(written.timezone).toBe('UTC');
    expect(await getSettings(client)).toEqual(written);
  });
});
