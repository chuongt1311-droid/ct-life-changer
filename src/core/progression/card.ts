import type { GuardState } from '../types';
import { type BadgeProgress, badgeProgress, TIERS, type Tier } from './badges';
import { type Level, levelFromXp } from './curve';
import { type Form, formOn } from './form';
import { type Attr, ATTRS, type ProgressDay, totalXp } from './xp';

export type CardTag = 'Out of form' | 'Fatigued' | 'Injury risk';

const TAGS: Record<GuardState, CardTag | null> = {
  ready: null,
  drifting: 'Out of form',
  depleted: 'Fatigued',
  grinding: 'Injury risk',
};

export interface PlayerCard {
  attributes: Record<Attr, Level & { xp: number }>;
  ovr: number;
  form: Form;
  /** From today's guard state; null when ready or when today isn't logged. */
  tag: CardTag | null;
  badges: BadgeProgress[];
}

/** Spec §8b: the whole player card, recomputed from history. */
export function playerCard(days: ProgressDay[], today: string): PlayerCard {
  const upToToday = days.filter((d) => d.date <= today);
  const xp = totalXp(upToToday);
  const attributes = Object.fromEntries(ATTRS.map((a) => [a, { ...levelFromXp(xp[a]), xp: xp[a] }])) as PlayerCard['attributes'];
  const ovr = Math.round(ATTRS.reduce((t, a) => t + attributes[a].rating, 0) / ATTRS.length);
  const todayDay = upToToday.find((d) => d.date === today);
  return {
    attributes,
    ovr,
    form: formOn(upToToday, today),
    tag: todayDay ? TAGS[todayDay.state] : null,
    badges: badgeProgress(upToToday),
  };
}

export interface CareerChanges {
  attributeUps: { attr: Attr; from: number; to: number }[];
  ovr: { from: number; to: number } | null;
  /** New badge tiers: each one gets one short celebration (spec §8b.4). */
  newTiers: { id: string; name: string; tier: Tier }[];
}

/** What changed between two cards: for level-up moments and the weekly development report. */
export function careerChanges(before: PlayerCard, after: PlayerCard): CareerChanges {
  const attributeUps = ATTRS.filter((a) => after.attributes[a].rating > before.attributes[a].rating).map((a) => ({
    attr: a,
    from: before.attributes[a].rating,
    to: after.attributes[a].rating,
  }));
  const rank = (t: Tier | null) => (t === null ? -1 : TIERS.indexOf(t));
  const newTiers = after.badges
    .filter((b) => rank(b.tier) > rank(before.badges.find((x) => x.id === b.id)?.tier ?? null))
    .map((b) => ({ id: b.id, name: b.name, tier: b.tier! }));
  return {
    attributeUps,
    ovr: after.ovr > before.ovr ? { from: before.ovr, to: after.ovr } : null,
    newTiers,
  };
}
