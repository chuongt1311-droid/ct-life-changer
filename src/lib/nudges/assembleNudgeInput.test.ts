import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { assembleNudgeInput } from './assembleNudgeInput';
import type { PlanRow, BlockRow } from '@/lib/db/schemas';

const plan: PlanRow = { date: '2026-09-14', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false };
const block: BlockRow = {
  id: 'deep', owner_id: 'ct', date: '2026-09-14', title: 'Deep work', kind: 'task', anchor: false, priority: 3,
  start: 540, end: 660, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [],
  recovery_variant: null, status: 'planned', source: 'template',
};

describe('assembleNudgeInput', () => {
  it('builds a NudgeInput from DB rows, mapping rest sessions to their block end', async () => {
    const client = fakeClient({
      // A check-in the day before planDate keeps missedDaysInARow at 0 —
      // otherwise every lookback day defaults to "missed" and the trailing
      // count would be the full 30-day window, not 0.
      checkins: [{ id: 'c0', owner_id: 'ct', date: '2026-09-13', type: 'evening', sections: {}, private_keys: [], created_at: '2026-09-13T21:00:00Z' }],
      nudges_sent: [{ id: 'n1', owner_id: 'ct', date: '2026-09-14', type: 'morning', block_id: null, key: '2026-09-14:morning:-', sent_at: '2026-09-14T07:00:00Z', acked_at: null }],
      rest_sessions: [{ id: 'r1', owner_id: 'ct', date: '2026-09-14', block_id: 'deep', activity: 'walk', planned: true, started_at: '2026-09-14T09:00:00Z', ended_at: null, reentry_ack_at: null }],
    });

    const input = await assembleNudgeInput(client, 'ct', '2026-09-14', 665, DEFAULT_SETTINGS, plan, [block]);

    expect(input.plan.date).toBe('2026-09-14');
    expect(input.plan.blocks).toHaveLength(1);
    expect(input.now).toBe(665);
    expect(input.sentKeys).toEqual(['2026-09-14:morning:-']);
    expect(input.restSessions).toEqual([{ id: 'r1', blockId: 'deep', plannedEnd: 660, closed: false }]);
    expect(input.missedDaysInARow).toBe(0);
    expect(input.welcomeBackSent).toBe(false);
  });

  it('drops rest sessions with no matching block', async () => {
    const client = fakeClient({
      rest_sessions: [{ id: 'r2', owner_id: 'ct', date: '2026-09-14', block_id: 'missing', activity: 'walk', planned: false, started_at: '2026-09-14T09:00:00Z', ended_at: null, reentry_ack_at: null }],
    });
    const input = await assembleNudgeInput(client, 'ct', '2026-09-14', 665, DEFAULT_SETTINGS, plan, [block]);
    expect(input.restSessions).toEqual([]);
  });
});
