/** Spec §8b.1: every attribute starts at 40 and caps at 99. */
export const START_RATING = 40;
export const MAX_RATING = 99;

/** XP needed to go from rating r to r + 1. Each point costs 6% more than the last. */
export function costToNext(rating: number): number {
  return Math.round(20 * 1.06 ** (rating - START_RATING));
}

export interface Level {
  rating: number;
  /** XP already earned towards the next point (0 at the cap). */
  intoLevel: number;
  /** XP still needed for the next point (0 at the cap). */
  toNext: number;
}

/** Turn an attribute's lifetime XP into its rating. More XP never gives a lower rating. */
export function levelFromXp(totalXp: number): Level {
  let rating = START_RATING;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (rating < MAX_RATING && remaining >= costToNext(rating)) {
    remaining -= costToNext(rating);
    rating++;
  }
  if (rating === MAX_RATING) return { rating, intoLevel: 0, toNext: 0 };
  return { rating, intoLevel: remaining, toNext: costToNext(rating) - remaining };
}

/** Lifetime XP needed to reach the cap from the start (about 10,000). */
export function xpToMax(): number {
  let total = 0;
  for (let r = START_RATING; r < MAX_RATING; r++) total += costToNext(r);
  return total;
}
