import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, weeklyReviewFallback } from '@/core/mentor/fallback';
import { PROFILE_SECTIONS } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { logMentorMessage } from '@/lib/mentor/logMessage';
import type { MentorRouteParams } from './briefing';

const WeeklyReviewSchema = z.object({
  letter: z.string(),
  changes: z.array(z.object({ section: z.string(), newText: z.string(), reason: z.string() })),
  crisis: z.boolean(),
});

const WEEKLY_REVIEW_INSTRUCTION =
  'Write the weekly letter: S1-S4 metrics, training sessions done vs planned, indulgence trend, one pattern, one focus for next week. Then propose profile changes as {section, newText, reason} — one change per section you touch.';

const VALID_SECTIONS = new Set(PROFILE_SECTIONS.map((s) => s.key));

export async function weeklyReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  weekStart: string,
): Promise<{ letter: string; changes: { section: string; newText: string; reason: string }[]; crisis: boolean; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { ...weeklyReviewFallback(), letter: capReachedMessage(new Date()), fallback: true };

  const input = await assembleMentorContext(client, {
    systemPrompt: loadSystemPrompt(),
    date: weekStart,
    request: WEEKLY_REVIEW_INSTRUCTION,
    memoryQuery: `weekly review for the week of ${weekStart}`,
  });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.parse({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(WeeklyReviewSchema) },
      system: ctx.system,
      messages: ctx.messages,
    });
    if (!response.parsed_output) return { ...weeklyReviewFallback(), fallback: true };
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'weeklyReview', model: params.model, usage: extractUsage(response) });
    // Unknown sections are dropped, never trusted blindly — a bad model
    // output must not corrupt the profile (mirrors applyProfileChanges'
    // own guard in @/core/mentor/profile, applied here before persistence).
    const changes = response.parsed_output.changes.filter((c) => VALID_SECTIONS.has(c.section as never));
    await logMentorMessage(client, { ownerId: params.ownerId, date: weekStart, route: 'weeklyReview', role: 'assistant', content: response.parsed_output.letter, stateAtTime: null, usageId: usageRow.id });
    return { letter: response.parsed_output.letter, changes, crisis: response.parsed_output.crisis, fallback: false };
  } catch {
    return { ...weeklyReviewFallback(), fallback: true };
  }
}
