export type Route = 'briefing' | 'eveningReview' | 'weeklyReview' | 'chat' | 'reflowComment';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Spec §8.5, exact copy. Interpolates the real 1st-of-next-month date. */
export function capReachedMessage(now: Date): string {
  const nextMonth = (now.getUTCMonth() + 1) % 12;
  const label = `${MONTH_NAMES[nextMonth]} 1`;
  return `Mentor's resting until ${label} — your plan, nudges and guard are all still running.`;
}

const TEXT_FALLBACKS: Record<'briefing' | 'chat' | 'reflowComment', string> = {
  briefing: "Mentor's unavailable right now. Today's plan is below — check in with yourself before you start.",
  chat: "Mentor's unavailable right now. Try again in a bit — your plan, nudges and guard are all still running.",
  reflowComment: "Mentor's unavailable right now.",
};

/** Spec §12: one retry happens inside the SDK before a caller ever sees this. */
export function routeFallbackText(route: 'briefing' | 'chat' | 'reflowComment'): string {
  return TEXT_FALLBACKS[route];
}

export function eveningReviewFallback(): { message: string; digest: string; tomorrowNote: string; crisis: false } {
  return {
    message: "Mentor's unavailable right now, but the day is logged.",
    digest: 'Day logged — mentor summary unavailable tonight.',
    tomorrowNote: '',
    crisis: false,
  };
}

export function weeklyReviewFallback(): { letter: string; changes: []; crisis: false } {
  return {
    letter: "Mentor's unavailable right now — this week's letter will catch up next time. Your profile is unchanged.",
    changes: [],
    crisis: false,
  };
}
