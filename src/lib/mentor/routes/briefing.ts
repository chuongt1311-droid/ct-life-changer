import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { logMentorMessage } from '@/lib/mentor/logMessage';

export interface MentorRouteParams {
  ownerId: string;
  model: string;
  monthlyCapUsd: number;
}

const BRIEFING_INSTRUCTION =
  "Give CT their morning briefing: today's top 3 priorities, in your voice for their current state. Plain text, no headings, under ~120 words.";

export async function briefing(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
): Promise<{ text: string; fallback: boolean }> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) return { text: capReachedMessage(new Date()), fallback: true };

  const input = await assembleMentorContext(client, {
    systemPrompt: loadSystemPrompt(),
    date,
    request: BRIEFING_INSTRUCTION,
    memoryQuery: `today's briefing ${date}`,
  });
  const ctx = buildMentorContext(input);

  try {
    const response = await anthropic.messages.create({
      model: params.model,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'briefing', model: params.model, usage: extractUsage(response) });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? routeFallbackText('briefing');
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'briefing', role: 'assistant', content: text, stateAtTime: input.today.state, usageId: usageRow.id });
    return { text, fallback: false };
  } catch {
    return { text: routeFallbackText('briefing'), fallback: true };
  }
}
