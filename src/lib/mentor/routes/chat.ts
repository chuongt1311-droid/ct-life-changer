import type Anthropic from '@anthropic-ai/sdk';
import { buildMentorContext } from '@/core/mentor/context';
import { capReachedMessage, routeFallbackText } from '@/core/mentor/fallback';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { loadSystemPrompt } from '@/lib/mentor/systemPrompt';
import { assembleMentorContext } from '@/lib/mentor/assembleContext';
import { checkCap, extractUsage, recordUsage } from '@/lib/mentor/usage';
import { logMentorMessage } from '@/lib/mentor/logMessage';
import { buildMentorTools, type ProposalEvent } from '@/lib/mentor/tools';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import type { MentorRouteParams } from './briefing';

export type ChatStreamEvent = { type: 'text'; text: string } | { type: 'proposal'; proposal: ProposalEvent };

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

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** Chat can now change CT's schedule and templates, not just describe them
 * — the model gets three tools via the official Beta Tool Runner, which
 * loops assistant → tool → tool-result on its own. Every tool only
 * previews (writes a `mentor_proposals` row); the model's own text is still
 * streamed live, and a proposal a tool made rides alongside it as its own
 * event so `ChatThread.tsx` can render a Confirm/Discard card the moment
 * it's ready, in whichever iteration of the (possibly multi-turn) tool loop
 * it happened. */
export async function* chat(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  date: string,
  message: string,
): AsyncGenerator<ChatStreamEvent, { fallback: boolean }, void> {
  const cap = await checkCap(client, params.ownerId, params.monthlyCapUsd, new Date());
  if (cap.over) {
    yield { type: 'text', text: capReachedMessage(new Date()) };
    return { fallback: true };
  }

  const chatHistory = await loadChatHistory(client, date);
  await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'user', content: message, stateAtTime: null, usageId: null });
  const input = await assembleMentorContext(client, { systemPrompt: loadSystemPrompt(), date, request: message, chatHistory });
  const ctx = buildMentorContext(input);

  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate: todayDate } = planClock(new Date(), settings.timezone);

  // A tool's proposal row references this turn's assistant message id via
  // `mentor_proposals.message_id`, a real foreign key — that row must
  // already exist by the time a tool call succeeds, not just by the time
  // the whole turn finishes. Log a placeholder now (empty content) so any
  // tool call mid-turn always has something to point to; the final
  // `logMentorMessage` below overwrites this same id with the real content
  // once the turn actually completes (upsert-by-id, not a second row).
  // Confirmed as a real bug, not a hypothetical one: propose_schedule_edit
  // and propose_template_edit both failed with Postgres error 23503
  // ("violates foreign key constraint") every time they reached a genuinely
  // valid edit, before this fix existed.
  const assistantMessageId = crypto.randomUUID();
  await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'assistant', content: '', stateAtTime: null, usageId: null, id: assistantMessageId });
  const { tools, proposals } = buildMentorTools({ client, ownerId: params.ownerId, messageId: assistantMessageId, todayDate, now: new Date() });

  try {
    const runner = anthropic.beta.messages.toolRunner({
      model: params.model,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system: ctx.system,
      messages: ctx.messages,
      tools,
      stream: true,
    });

    let fullText = '';
    let usage = ZERO_USAGE;
    for await (const iterationStream of runner) {
      for await (const event of iterationStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text;
          yield { type: 'text', text: event.delta.text };
        }
      }
      const final = await iterationStream.finalMessage();
      const iterationUsage = extractUsage(final as unknown as Anthropic.Message);
      usage = {
        inputTokens: usage.inputTokens + iterationUsage.inputTokens,
        outputTokens: usage.outputTokens + iterationUsage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens + iterationUsage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens + iterationUsage.cacheWriteTokens,
      };
      // Any tool `run()` calls that executed while this iteration's stream
      // was draining have already pushed onto `proposals` by now.
      while (proposals.length > 0) yield { type: 'proposal', proposal: proposals.shift()! };
    }

    const usageRow = await recordUsage(client, { ownerId: params.ownerId, route: 'chat', model: params.model, usage });
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'assistant', content: fullText, stateAtTime: input.today.state, usageId: usageRow.id, id: assistantMessageId });
    return { fallback: false };
  } catch {
    const fallbackText = routeFallbackText('chat');
    yield { type: 'text', text: fallbackText };
    // Overwrite the placeholder with the real fallback text — otherwise it
    // sits in mentor_messages as a permanently blank assistant turn and
    // leaks into every future call's loadChatHistory.
    await logMentorMessage(client, { ownerId: params.ownerId, date, route: 'chat', role: 'assistant', content: fallbackText, stateAtTime: null, usageId: null, id: assistantMessageId });
    return { fallback: true };
  }
}
