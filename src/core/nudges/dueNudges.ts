import type { Block, DayPlan, Settings } from '../types';

export type NudgeType =
  | 'morning'
  | 'welcomeBack'
  | 'transition'
  | 'restWarning'
  | 'reentry'
  | 'reentryFollowUp'
  | 'evening';

export interface Nudge {
  /** Unique per (date, type, ref): used to never send the same nudge twice. */
  key: string;
  type: NudgeType;
  blockId: string | null;
  title: string;
  body: string;
}

export interface RestSessionInfo {
  id: string;
  blockId: string | null;
  /** Plan minute when the rest is scheduled to end. */
  plannedEnd: number;
  /** True once CT tapped "I'm back" or ended the rest. */
  closed: boolean;
}

export interface NudgeInput {
  plan: DayPlan;
  now: number;
  restSessions: RestSessionInfo[];
  /** Keys of nudges already sent today. */
  sentKeys: string[];
  settings: Settings;
  /** Consecutive days before today with no check-in at all. */
  missedDaysInARow: number;
  /** Whether the welcome-back nudge has already gone out since the last check-in. */
  welcomeBackSent: boolean;
}

/** A delayed cron tick still sends anything that fell due in the last few minutes. */
export const LOOKBACK_MIN = 5;

const RANK: Record<NudgeType, number> = {
  morning: 0,
  welcomeBack: 0,
  evening: 0,
  reentry: 0,
  reentryFollowUp: 1,
  transition: 2,
  restWarning: 3,
};

const isOpen = (b: Block) => b.status === 'planned' || b.status === 'active';

/** Spec §9: which nudges should go out at `now`. Pure — sending and recording happen elsewhere. */
export function dueNudges(input: NudgeInput): Nudge[] {
  const { plan, now, settings } = input;
  if (now < plan.wake || now >= plan.bedtime) return []; // quiet hours
  if (input.missedDaysInARow >= 2 && input.welcomeBackSent) return []; // paused until CT returns

  const isDue = (t: number) => t <= now && t > now - LOOKBACK_MIN;
  const key = (type: NudgeType, ref: string) => `${plan.date}:${type}:${ref}`;
  const windDownStart = plan.bedtime - 60;
  const due: (Nudge & { at: number })[] = [];

  if (isDue(plan.wake)) {
    if (input.missedDaysInARow >= 2) {
      due.push({
        key: key('welcomeBack', '-'),
        type: 'welcomeBack',
        blockId: null,
        title: 'Welcome back',
        body: 'No catching up needed. One check-in, 60 seconds.',
        at: plan.wake,
      });
    } else {
      due.push({
        key: key('morning', '-'),
        type: 'morning',
        blockId: null,
        title: 'Morning check-in',
        body: 'How did you sleep? 60 seconds.',
        at: plan.wake,
      });
    }
  }

  const open = plan.blocks.filter(isOpen).sort((a, b) => a.start - b.start);
  for (const b of open) {
    if (b.kind === 'rest' || b.tags.includes('windDown') || b.end === windDownStart || !isDue(b.end)) continue;
    const next = open.find((n) => n.id !== b.id && n.start >= b.end);
    const gap = next ? next.start - b.end : 0;
    const body = !next
      ? 'That was the last block before wind-down.'
      : gap <= 0
        ? `Next: ${next.title}, now.`
        : `Next: ${next.title} in ${gap} min.`;
    due.push({ key: key('transition', b.id), type: 'transition', blockId: b.id, title: `${b.title}: done?`, body, at: b.end });
  }

  for (const r of input.restSessions) {
    if (r.closed) continue;
    const ref = `rest-${r.id}`;
    if (isDue(r.plannedEnd - 5)) {
      due.push({ key: key('restWarning', ref), type: 'restWarning', blockId: r.blockId, title: 'Re-entry in 5', body: 'Finish what you are on.', at: r.plannedEnd - 5 });
    }
    if (isDue(r.plannedEnd)) {
      due.push({ key: key('reentry', ref), type: 'reentry', blockId: r.blockId, title: 'Time to come back', body: 'Stand up. Water. Then the first 2 minutes of your next block.', at: r.plannedEnd });
    }
    if (isDue(r.plannedEnd + 10)) {
      due.push({ key: key('reentryFollowUp', ref), type: 'reentryFollowUp', blockId: r.blockId, title: 'Still there?', body: 'Just stand up. That is the whole first step.', at: r.plannedEnd + 10 });
    }
  }

  if (isDue(windDownStart)) {
    due.push({ key: key('evening', '-'), type: 'evening', blockId: null, title: 'Wind-down', body: 'Evening check-in, then phone away.', at: windDownStart });
  }

  const sent = new Set(input.sentKeys);
  const fresh = due.filter((n) => !sent.has(n.key)).sort((a, b) => RANK[a.type] - RANK[b.type] || a.at - b.at);

  // Keep one slot for the evening nudge so low-priority nudges can't use up the whole day's cap.
  let budget = settings.nudgeDailyCap - input.sentKeys.length;
  const reserve = windDownStart > now && !sent.has(key('evening', '-')) ? 1 : 0;
  const out: Nudge[] = [];
  for (const { at: _at, ...nudge } of fresh) {
    const available = RANK[nudge.type] === 0 ? budget : budget - reserve;
    if (available <= 0) continue;
    out.push(nudge);
    budget--;
  }
  return out;
}
