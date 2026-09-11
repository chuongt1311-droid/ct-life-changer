import { describe, expect, it } from 'vitest';
import { makeBlock } from '../testing/fixtures';
import { buildMentorContext, type CheckinRecord, type MentorContextInput, stripPrivate } from './context';
import { emptyProfile } from './profile';

const evening: CheckinRecord = {
  type: 'evening',
  sections: {
    mind: { stressPeak: 8, stressCause: ['family'], note: 'SECRET-NOTE' },
    people: { who: ['SECRET-PERSON'], felt: 'draining' },
    reflection: { win: 'Finished xT notebook' },
  },
  privateKeys: ['mind.note', 'people'],
};

function input(overrides: Partial<MentorContextInput> = {}): MentorContextInput {
  return {
    systemPrompt: 'You are CT’s mentor.',
    profile: { ...emptyProfile(), values: 'Discipline' },
    weeklyLetters: [
      { weekStart: '2026-08-31', letter: 'Letter A' },
      { weekStart: '2026-08-24', letter: 'Letter B' },
    ],
    digests: [{ date: '2026-09-13', text: 'Solid day.' }],
    today: {
      date: '2026-09-14',
      state: 'depleted',
      flags: [{ code: 'SLEEP_LOW', state: 'depleted', reason: 'Under 6h sleep on 3 of your last 4 nights' }],
      adjustments: [{ type: 'bedtimeEarlier', minutes: 30, reason: 'Sleep is the fix' }],
      overridden: false,
      blocks: [makeBlock({ id: 'deep', title: 'Deep work', start: 540, end: 660, status: 'done' })],
      checkins: [evening],
    },
    request: 'Write the evening review.',
    ...overrides,
  };
}

describe('stripPrivate', () => {
  it('removes private sections and fields, keeps the rest', () => {
    expect(stripPrivate(evening)).toEqual({
      mind: { stressPeak: 8, stressCause: ['family'] },
      reflection: { win: 'Finished xT notebook' },
    });
  });
});

describe('buildMentorContext', () => {
  it('never contains private content anywhere', () => {
    const json = JSON.stringify(buildMentorContext(input()));
    expect(json).not.toContain('SECRET-NOTE');
    expect(json).not.toContain('SECRET-PERSON');
    expect(json).toContain('Finished xT notebook');
  });

  it('puts stable content first with cache breakpoints, volatile content after', () => {
    const ctx = buildMentorContext(input());
    expect(ctx.system).toHaveLength(2);
    expect(ctx.system[0]).toMatchObject({ text: 'You are CT’s mentor.', cache_control: { type: 'ephemeral' } });
    expect(ctx.system[1]!.text).toContain('## Values\n\nDiscipline');
    const first = ctx.messages[0]!;
    expect(first.role).toBe('user');
    const blocks = first.content as { text: string; cache_control?: unknown }[];
    expect(blocks[0]!.text).toMatch(/^<history>/);
    expect(blocks[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(blocks[1]!.text).toMatch(/^<today date="2026-09-14">/);
    expect(blocks[1]!.cache_control).toBeUndefined();
    expect(blocks[2]!.text).toBe('Write the evening review.');
  });

  it('orders history oldest first and renders today readably', () => {
    const ctx = buildMentorContext(input());
    const [history, today] = (ctx.messages[0]!.content as { text: string }[]).map((b) => b.text);
    expect(history!.indexOf('Letter B')).toBeLessThan(history!.indexOf('Letter A'));
    expect(today).toContain('State: depleted');
    expect(today).toContain('- SLEEP_LOW: Under 6h sleep on 3 of your last 4 nights');
    expect(today).toContain('- 09:00–11:00 Deep work — done');
  });

  it('appends chat history after the context turn and ends with the new message', () => {
    const ctx = buildMentorContext(
      input({
        chatHistory: [
          { role: 'assistant', content: 'dangling assistant turn is dropped' },
          { role: 'user', content: 'Should I train today?' },
          { role: 'assistant', content: 'Recovery session.' },
        ],
        request: 'Why?',
      }),
    );
    expect(ctx.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect((ctx.messages[0]!.content as { text: string }[])[2]!.text).toBe('Should I train today?');
    expect(ctx.messages[2]!.content).toBe('Why?');
  });
});
