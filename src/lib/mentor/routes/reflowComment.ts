import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import type { MentorRouteParams } from './briefing';

export async function reflowComment(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  diffSummary: string,
): Promise<{ text: string; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { text: capReachedMessage(new Date()), fallback: true };

  const instruction = `CT just reflowed today's plan. Here's what changed: ${diffSummary}\nOne short comment, under ~60 words.`;
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: instruction });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    await recordUsage(client, { ownerId: params.ownerId, route: 'reflowComment', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return { text: textBlock?.text ?? routeFallbackText('reflowComment'), fallback: false };
  } catch {
    return { text: routeFallbackText('reflowComment'), fallback: true };
  }
}
