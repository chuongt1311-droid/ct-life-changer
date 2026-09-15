// These actions call `createServerSupabase()` internally, which needs a
// real request context — exercised end-to-end in the e2e spec instead.
// This file tests the pure decision logic each action delegates to, kept
// as a small internal helper so it's testable without the auth boundary:
// `resolveProposalConfirmation`, extracted below.
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { resolveProposalConfirmation } from './actions';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

describe('resolveProposalConfirmation', () => {
  it('refuses a proposal that is not pending', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      mentor_proposals: [{ id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'schedule', target: '2026-09-15', edits: [], diff: [], conflicts: [], status: 'confirmed', created_at: '2026-09-15T12:00:00.000Z' }],
    });
    const result = await resolveProposalConfirmation(client, 'ct', 'p1');
    expect(result).toEqual({ ok: false, errors: ['This proposal was already acted on.'] });
  });

  it('persists a pending schedule proposal and marks it confirmed', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      blocks: [{ id: 'deep', owner_id: 'ct', date: '2026-09-15', title: 'Deep work', kind: 'task', anchor: false, priority: 3, start: 540, end: 600, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null, status: 'planned', source: 'template' }],
      mentor_proposals: [{ id: 'p1', owner_id: 'ct', message_id: 'm1', kind: 'schedule', target: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }], diff: [], conflicts: [], status: 'pending', created_at: '2026-09-15T12:00:00.000Z' }],
    });
    const result = await resolveProposalConfirmation(client, 'ct', 'p1');
    expect(result).toEqual({ ok: true });
    expect(client.tables.blocks!.find((b) => b.id === 'deep')!.end).toBe(630);
    expect(client.tables.mentor_proposals!.find((p) => p.id === 'p1')!.status).toBe('confirmed');
  });
});
