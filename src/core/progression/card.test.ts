import { describe, expect, it } from 'vitest';
import { makeGoodDay, makeProgressDay } from '../testing/progressFixtures';
import { addDays } from '../time';
import { careerChanges, playerCard } from './card';
import { ATTRS } from './xp';

const START = '2026-09-01';
const run = (n: number) => Array.from({ length: n }, (_, i) => makeGoodDay(addDays(START, i)));

describe('playerCard', () => {
  it('is a rookie card before anything is logged', () => {
    const card = playerCard([], START);
    expect(card.ovr).toBe(40);
    for (const a of ATTRS) expect(card.attributes[a]).toMatchObject({ rating: 40, xp: 0 });
    expect(card.form.band).toBe('settling');
    expect(card.tag).toBeNull();
  });

  it('grows attributes from logged days and averages them into OVR', () => {
    const card = playerCard(run(30), addDays(START, 29));
    // 30 good days: ANL earns 105/day = 3150 XP, the most of any attribute
    expect(card.attributes.ANL.xp).toBe(3150);
    expect(card.attributes.ANL.rating).toBeGreaterThan(card.attributes.CHR.rating);
    const mean = ATTRS.reduce((t, a) => t + card.attributes[a].rating, 0) / ATTRS.length;
    expect(card.ovr).toBe(Math.round(mean));
  });

  it("shows today's guard state as a card tag", () => {
    const tagFor = (state: 'ready' | 'drifting' | 'depleted' | 'grinding') =>
      playerCard([makeProgressDay({ date: START, state })], START).tag;
    expect(tagFor('ready')).toBeNull();
    expect(tagFor('drifting')).toBe('Out of form');
    expect(tagFor('depleted')).toBe('Fatigued');
    expect(tagFor('grinding')).toBe('Injury risk');
  });

  it('ignores days after `today`', () => {
    const days = run(10);
    expect(playerCard(days, addDays(START, 4))).toEqual(playerCard(days.slice(0, 5), addDays(START, 4)));
  });

  it('never lowers an attribute when more days are logged, even empty or depleted ones', () => {
    const base = run(20);
    const before = playerCard(base, addDays(START, 19));
    const more = [
      ...base,
      makeProgressDay({ date: addDays(START, 20) }),
      makeGoodDay(addDays(START, 21), { state: 'depleted' }),
      makeGoodDay(addDays(START, 22), { state: 'grinding' }),
    ];
    const after = playerCard(more, addDays(START, 22));
    for (const a of ATTRS) expect(after.attributes[a].rating).toBeGreaterThanOrEqual(before.attributes[a].rating);
  });
});

describe('careerChanges', () => {
  it('lists attribute level-ups, the OVR change and new badge tiers', () => {
    const before = playerCard(run(9), addDays(START, 8));
    const after = playerCard(run(10), addDays(START, 9));
    const changes = careerChanges(before, after);
    // the 10th training session unlocks Workhorse bronze
    expect(changes.newTiers).toContainEqual({ id: 'workhorse', name: 'Workhorse', tier: 'bronze' });
    for (const up of changes.attributeUps) expect(up.to).toBeGreaterThan(up.from);
  });

  it('reports nothing when nothing changed', () => {
    const card = playerCard(run(5), addDays(START, 4));
    expect(careerChanges(card, card)).toEqual({ attributeUps: [], ovr: null, newTiers: [] });
  });
});
