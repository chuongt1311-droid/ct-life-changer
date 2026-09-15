import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { previewFuturePlan } from './planAhead';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

describe('previewFuturePlan', () => {
  it('loads the real plan when one already exists for that date', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      plans: [{ date: '2026-09-22', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false }],
      blocks: [
        { id: 'gym', owner_id: 'ct', date: '2026-09-22', title: 'Gym', kind: 'training', anchor: false, priority: 3,
          start: 600, end: 660, min_minutes: 60, window_start: null, window_end: null, tags: [], checklist: [],
          recovery_variant: null, status: 'planned', source: 'template' },
      ],
    });
    const result = await previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'));
    expect(result.source).toBe('existing');
    expect(result.plan.blocks).toHaveLength(1);
    expect(result.plan.blocks[0]!.title).toBe('Gym');
  });

  it('generates a preview from the weekday template when no plan exists yet', async () => {
    // 2026-09-22 is a Tuesday (weekday 2).
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{
        weekday: 2, owner_id: 'ct', rest_day: false,
        blocks: [{ key: 'deep', title: 'Deep work', kind: 'task', anchor: true, priority: 5, start: '09:00', durationMin: 120 }],
      }],
    });
    const result = await previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'));
    expect(result.source).toBe('generated');
    // buildDay always appends its own "Wind down" guard block regardless of
    // adjustments — this is real, existing buildDay behavior (see the tail
    // of buildDay.ts), not something previewFuturePlan adds itself.
    expect(result.plan.blocks.map((b) => b.title)).toEqual(expect.arrayContaining(['Deep work', 'Wind down']));
    expect(result.state).toBe('ready');
  });

  it('throws when the weekday has no template and no plan exists', async () => {
    const client = fakeClient({ settings: [settingsRow] });
    await expect(previewFuturePlan(client, '2026-09-22', new Date('2026-09-15T12:00:00Z'))).rejects.toThrow(/no template/i);
  });
});
