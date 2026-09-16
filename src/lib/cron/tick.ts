import type Anthropic from '@anthropic-ai/sdk';
import { addDays, planClock, weekdayOf } from '@/core/time';
import { dueNudges } from '@/core/nudges/dueNudges';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { PushSubscriptionRow } from '@/lib/db/schemas';
import { ensureTodayPlan } from '@/lib/planner/ensureTodayPlan';
import { assembleNudgeInput } from '@/lib/nudges/assembleNudgeInput';
import { eveningReview } from '@/lib/mentor/routes/eveningReview';
import { runWeeklyReview } from '@/lib/mentor/runWeeklyReview';
import { writeMemory } from '@/lib/memory/client';

export interface CronTickDeps {
  client: RepositoryClient;
  anthropic: Anthropic;
  sendPush: (sub: PushSubscriptionRow, payload: { title: string; body: string }) => Promise<{ ok: boolean; expired: boolean }>;
  now: Date;
}

export interface CronTickResult {
  ran: boolean;
  reason: string | null;
  nudgesSent: number;
  weeklyReviewRan: boolean;
  digestRetried: boolean;
}

const DIGEST_MAX_ATTEMPTS = 3;

/** The one thing /api/cron/tick calls, once a minute. Never throws for an
 * expected "nothing to do yet" state (no settings, no template) — those come
 * back as `{ ran: false, reason }` so the route can still answer 200. */
export async function runCronTick(deps: CronTickDeps): Promise<CronTickResult> {
  const { client, anthropic, sendPush, now } = deps;
  const repos = repositories(client);

  const settingsRow = await repos.settings.get();
  if (!settingsRow) return { ran: false, reason: 'no-settings', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false };

  const ownerId = settingsRow.owner_id;
  const settings = settingsToDomain(settingsRow);
  const { planDate, minute } = planClock(now, settings.timezone);

  let plan;
  let blocks;
  try {
    ({ plan, blocks } = await ensureTodayPlan(client, ownerId, now));
  } catch {
    return { ran: false, reason: 'no-template', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false };
  }

  const input = await assembleNudgeInput(client, ownerId, planDate, minute, settings, plan, blocks);
  const nudges = dueNudges(input);
  const subscriptions = await repos.pushSubscriptions.list({ owner_id: ownerId } as never);

  for (const nudge of nudges) {
    for (const sub of subscriptions) {
      const result = await sendPush(sub, { title: nudge.title, body: nudge.body });
      if (result.expired) await repos.pushSubscriptions.remove(sub.id);
    }
    await repos.nudgesSent.upsert({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      date: planDate,
      type: nudge.type,
      block_id: nudge.blockId,
      key: nudge.key,
      sent_at: now.toISOString(),
      acked_at: null,
    });
  }

  // Spec §5.8: "If no weekly review exists for the week by Monday 04:00, the
  // cron tick generates it." weekStart is always the Sunday just finished.
  let weeklyReviewRan = false;
  if (weekdayOf(planDate) === 1) {
    const lastSunday = addDays(planDate, -1);
    const existingLetter = await repos.weeklyLetters.get(lastSunday, 'week_start');
    if (!existingLetter) {
      const result = await runWeeklyReview(client, anthropic, { ownerId, model: settings.model, monthlyCapUsd: settings.monthlyCapUsd }, lastSunday);
      weeklyReviewRan = !result.fallback;
    }
  }

  // Spec §12: "Evening digest is retried at the next cron tick up to 3 times."
  let digestRetried = false;
  const digestRow = await repos.digests.get(planDate, 'date');
  if (digestRow && digestRow.text === null && digestRow.attempts < DIGEST_MAX_ATTEMPTS) {
    const review = await eveningReview(client, anthropic, { ownerId, model: settings.model, monthlyCapUsd: settings.monthlyCapUsd }, planDate);
    await repos.digests.upsert({ date: planDate, owner_id: ownerId, text: review.fallback ? null : review.digest, attempts: digestRow.attempts + 1 });
    if (!review.fallback) void writeMemory('DailyDigest', { date: planDate, text: review.digest });
    digestRetried = true;
  }

  return { ran: true, reason: null, nudgesSent: nudges.length, weeklyReviewRan, digestRetried };
}
