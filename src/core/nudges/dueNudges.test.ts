import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { type DayPlan, DEFAULT_SETTINGS } from '../types';
import { dueNudges, type NudgeInput } from './dueNudges';

// wake 07:00 (420), bedtime 23:00 (1380), wind-down 22:00 (1320)
const plan: DayPlan = {
  date: '2026-09-14',
  wake: 420,
  bedtime: 1380,
  blocks: [
    makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660 }),
    makeBlock({ id: 'lunch', title: 'Lunch', kind: 'routine', anchor: true, start: 720, end: 765 }),
    makeBlock({ id: 'game', title: 'Gaming', kind: 'rest', start: 1200, end: 1260 }),
    makeBlock({ id: 'wind', title: 'Wind down', kind: 'routine', anchor: true, start: 1320, end: 1380, tags: ['windDown'] }),
  ],
};

function input(overrides: Partial<NudgeInput>): NudgeInput {
  return {
    plan,
    now: 420,
    restSessions: [],
    sentKeys: [],
    settings: DEFAULT_SETTINGS,
    missedDaysInARow: 0,
    welcomeBackSent: false,
    ...overrides,
  };
}

const types = (n: { type: string }[]) => n.map((x) => x.type);

describe('dueNudges', () => {
  it('sends the morning check-in at wake', () => {
    const out = dueNudges(input({ now: 420 }));
    expect(out).toEqual([
      { key: '2026-09-14:morning:-', type: 'morning', blockId: null, title: 'Morning check-in', body: 'How did you sleep? 60 seconds.' },
    ]);
  });

  it('still sends within the 5-minute look-back, but not after it', () => {
    expect(types(dueNudges(input({ now: 424 })))).toEqual(['morning']);
    expect(dueNudges(input({ now: 425 }))).toEqual([]);
  });

  it('never sends the same nudge twice', () => {
    expect(dueNudges(input({ now: 421, sentKeys: ['2026-09-14:morning:-'] }))).toEqual([]);
  });

  it('sends a transition when a block ends, naming what is next', () => {
    const [nudge] = dueNudges(input({ now: 660 }));
    expect(nudge).toMatchObject({ type: 'transition', blockId: 'deep', title: 'Deep work: done?', body: 'Next: Lunch in 60 min.' });
  });

  it('skips transitions for blocks already marked done', () => {
    const done = { ...plan, blocks: plan.blocks.map((b) => (b.id === 'deep' ? { ...b, status: 'done' as const } : b)) };
    expect(dueNudges(input({ plan: done, now: 660 }))).toEqual([]);
  });

  it('runs the rest re-entry sequence: warning, re-entry, one follow-up', () => {
    const rest = { id: 'r1', blockId: 'game', plannedEnd: 1260, closed: false };
    expect(types(dueNudges(input({ now: 1255, restSessions: [rest] })))).toEqual(['restWarning']);
    expect(types(dueNudges(input({ now: 1260, restSessions: [rest] })))).toEqual(['reentry']);
    expect(types(dueNudges(input({ now: 1270, restSessions: [rest] })))).toEqual(['reentryFollowUp']);
    expect(dueNudges(input({ now: 1270, restSessions: [{ ...rest, closed: true }] }))).toEqual([]);
  });

  it('sends the evening nudge at wind-down and nothing during quiet hours', () => {
    expect(types(dueNudges(input({ now: 1320 })))).toEqual(['evening']);
    expect(dueNudges(input({ now: 1400 }))).toEqual([]);
    expect(dueNudges(input({ now: 300 }))).toEqual([]);
  });

  it('respects the daily cap and keeps a slot for the evening nudge', () => {
    const settings = { ...DEFAULT_SETTINGS, nudgeDailyCap: 3 };
    const sent = ['a', 'b'];
    // one slot left, reserved for evening → the transition is skipped
    expect(dueNudges(input({ now: 660, settings, sentKeys: sent }))).toEqual([]);
    // at wind-down the reserved slot is used
    expect(types(dueNudges(input({ now: 1320, settings, sentKeys: sent })))).toEqual(['evening']);
  });

  it('sends welcome-back after 2 missed days, then pauses until CT returns', () => {
    expect(types(dueNudges(input({ now: 420, missedDaysInARow: 2 })))).toEqual(['welcomeBack']);
    expect(dueNudges(input({ now: 660, missedDaysInARow: 2, welcomeBackSent: true }))).toEqual([]);
  });
});
