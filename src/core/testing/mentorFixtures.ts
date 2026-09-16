import type { MentorContextInput } from '../mentor/context';
import { emptyProfile } from '../mentor/profile';
import type { GuardState } from '../types';

function fixtureFor(state: GuardState, request: string): MentorContextInput {
  const base: MentorContextInput = {
    systemPrompt: '', // filled in by the caller with loadSystemPrompt()
    profile: { ...emptyProfile(), goalsPhysical: 'Get stronger without wrecking sleep.', values: 'Consistency over intensity.' },
    retrievedMemory: '',
    today: {
      date: '2026-09-14',
      state,
      flags: [],
      adjustments: [],
      overridden: false,
      blocks: [],
      checkins: [],
    },
    request,
    chatHistory: undefined,
  };
  return base;
}

/** Spec §13: "a small fixture set (one sample day per state) is run
 * manually against the real API to sanity-check tone." One MentorContextInput
 * per GuardState, distinct enough in their `request` to actually exercise
 * the voice-by-state rules in prompts/mentor.md. `systemPrompt` is left
 * blank here — callers fill it via loadSystemPrompt() so this file has zero
 * I/O, matching every other file under src/core/testing. */
export const MENTOR_FIXTURE_DAYS: Record<GuardState, MentorContextInput> = {
  ready: fixtureFor('ready', "Give CT their morning briefing: today's top 3 priorities."),
  drifting: {
    ...fixtureFor('drifting', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('drifting', '').today,
      flags: [{ code: 'INDULGE_HIGH', state: 'drifting', reason: 'More than 2h of unplanned screen time 2 days running' }],
      adjustments: [{ type: 'addEasyWin', reason: 'Start with a 15-minute win to get moving' }],
    },
  },
  depleted: {
    ...fixtureFor('depleted', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('depleted', '').today,
      flags: [{ code: 'SLEEP_LOW', state: 'depleted', reason: 'Under 6h sleep on 3 of your last 4 nights' }],
      adjustments: [{ type: 'trainingToRecovery', reason: "You're running low — recovery session instead of hard training" }],
    },
  },
  grinding: {
    ...fixtureFor('grinding', "Give CT their morning briefing: today's top 3 priorities."),
    today: {
      ...fixtureFor('grinding', '').today,
      flags: [{ code: 'GRIND_HOURS', state: 'grinding', reason: 'Over 6h of deep work with no rest on 5 of the last 7 days' }],
      adjustments: [{ type: 'addMandatoryRest', at: '15:00', reason: "You've been grinding — a real break mid-afternoon" }],
    },
  },
};
