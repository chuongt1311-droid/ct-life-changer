import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { buildMentorContext } from '@/core/mentor/context';
import { checkCrisisKeywords } from '@/core/mentor/crisis';
import { capReachedMessage, eveningReviewFallback } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { repositories } from '@/lib/db/repositories';
import { logMentorMessage } from '@/lib/mentor/logMessage';
import type { MentorRouteParams } from './briefing';

const EveningReviewSchema = z.object({
  message: z.string(),
  digest: z.string(),
  tomorrowNote: z.string(),
  crisis: z.boolean(),
});

const EVENING_REVIEW_INSTRUCTION =
  "Write the evening review: a short message to CT, a ~100-word daily digest, and a preview of tomorrow. Set crisis true only if something in today's check-ins suggests crisis or self-harm.";

/** Every free-text value nested anywhere in a checkin's sections, for the
 * local crisis-keyword backup check. */
function freeTextValues(sections: Record<string, Record<string, unknown>>): string[] {
  return Object.values(sections).flatMap((fields) =>
    Object.values(fields).filter((v): v is string => typeof v === 'string'),
  );
}

export async function eveningReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
): Promise<{ message: string; digest: string; tomorrowNote: string; crisis: boolean; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { ...eveningReviewFallback(), message: capReachedMessage(new Date()), fallback: true };

  const eveningCheckins = await repositories(client).checkins.list({ date, type: 'evening' } as never);
  const localCrisis = eveningCheckins.some((c) => checkCrisisKeywords(freeTextValues(c.sections)));

  const input = await assembleMentorContext(client, {
    systemPrompt: loadSystemPrompt(),
    date,
    request: EVENING_REVIEW_INSTRUCTION,
    memoryQuery: `evening review for ${date}`,
  });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.parse({
      model: params.model,
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: zodOutputFormat(EveningReviewSchema) },
      system: ctx.system,
      messages: ctx.messages,
    });
    if (!response.parsed_output) return { ...eveningReviewFallback(), crisis: localCrisis, fallback: true };
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'eveningReview', model: params.model, usage: extractUsage(response) });
    const crisis = response.parsed_output.crisis || localCrisis;
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'eveningReview', role: 'assistant', content: response.parsed_output.message, stateAtTime: input.today.state, usageId: usageRow.id });
    return { ...response.parsed_output, crisis, fallback: false };
  } catch {
    return { ...eveningReviewFallback(), crisis: localCrisis, fallback: true };
  }
}
