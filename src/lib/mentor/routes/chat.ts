import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import type { MentorRouteParams } from './briefing';

/** Last 20 chat messages for `date`, oldest first, mapped to the
 * {role, content} shape buildMentorContext's chatHistory expects. */
async function loadChatHistory(client: RepositoryClient, date: string): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await repositories(client).mentorMessages.list({ date, route: 'chat' } as never);
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(-20)
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

/** Spec §8.2: chat is streamed text. Yields text chunks as they arrive;
 * the generator's return value reports whether it ended in fallback, so
 * a Route Handler can decide the HTTP status after the stream finishes. */
export async function* chat(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  message: string,
): AsyncGenerator<string, { fallback: boolean }, void> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) {
    yield capReachedMessage(new Date());
    return { fallback: true };
  }

  const chatHistory = await loadChatHistory(client, date);
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: message, chatHistory });
  const ctx = buildMentorContext(input);

  try {
    const stream = anthropic.messages.stream({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text;
    }
    const final = await stream.finalMessage();
    await recordUsage(client, { ownerId: params.ownerId, route: 'chat', model: params.model, usage: extractUsage(final) });
    return { fallback: false };
  } catch {
    yield routeFallbackText('chat');
    return { fallback: true };
  }
}
