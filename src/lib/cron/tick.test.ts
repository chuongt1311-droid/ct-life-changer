import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { runCronTick } from './tick';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};
const templateRow = { weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] };

function noopAnthropic() {
  return {} as Anthropic;
}
function noopSendPush() {
  return vi.fn().mockResolvedValue({ ok: true, expired: false });
}

describe('runCronTick', () => {
  it('no-ops with a reason when no settings row exists yet (onboarding not done)', async () => {
    const client = fakeClient({});
    const result = await runCronTick({ client, anthropic: noopAnthropic(), sendPush: noopSendPush(), now: new Date('2026-09-14T12:00:00Z') });
    expect(result).toEqual({ ran: false, reason: 'no-settings', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false });
  });

  it('sends due nudges and records them so the next tick does not resend', async () => {
    // wake_time is 07:00 → plan minute 420. 07:02 UTC = minute 422, inside
    // dueNudges' 5-minute look-back window for the wake-time nudge (morning,
    // or welcomeBack — this fake seeds no checkins at all, so missedDaysInARow
    // is high and dueNudges sends welcomeBack instead; either way, exactly one).
    const client = fakeClient({ settings: [settingsRow], templates: [templateRow] });
    const sendPush = noopSendPush();
    const now = new Date('2026-09-14T07:02:00Z');

    const first = await runCronTick({ client, anthropic: noopAnthropic(), sendPush, now });
    expect(first.ran).toBe(true);
    expect(first.nudgesSent).toBe(1);

    const nudgesSentRows = client.tables.nudges_sent ?? [];
    expect(nudgesSentRows.length).toBe(1);

    // A second tick one minute later must not resend the same nudge
    const second = await runCronTick({ client, anthropic: noopAnthropic(), sendPush, now: new Date('2026-09-14T07:03:00Z') });
    expect(second.nudgesSent).toBe(0);
  });

  it('does not retry a digest that has already used all 3 attempts', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [templateRow],
      digests: [{ date: '2026-09-16', owner_id: 'ct', text: null, attempts: 3 }],
    });
    // Wednesday — keeps this test isolated from the Monday weekly-review branch.
    const result = await runCronTick({ client, anthropic: noopAnthropic(), sendPush: noopSendPush(), now: new Date('2026-09-16T12:00:00Z') });
    expect(result.digestRetried).toBe(false);
  });
});
