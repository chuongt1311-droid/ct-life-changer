import { DEFAULT_SETTINGS } from '@/core/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { chat } from '@/lib/mentor/routes/chat';

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { date, message } = (await request.json()) as { date: string; message: string };
  const client = supabase as unknown as RepositoryClient;
  const settings = await repositories(client).settings.get();
  const params = { ownerId: user.id, model: settings?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settings?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd };

  const generator = chat(client, createAnthropicClient(), params, date, message);
  const encoder = new TextEncoder();
  // Driven from `start`, not `pull`: a client that disconnects mid-turn
  // (navigates away before the reply finishes) stops the stream from being
  // read, which stops `pull` from ever firing again — abandoning `chat()`
  // before its final `logMentorMessage` write and leaving that turn's
  // assistant message stuck as the empty placeholder written before
  // streaming started, permanently. Draining the generator here instead
  // keeps every turn's DB writes running to completion regardless of
  // whether anyone is still listening; a failed `enqueue` after the client
  // is gone just stops forwarding output; it doesn't stop the turn.
  const stream = new ReadableStream({
    start(controller) {
      void (async () => {
        try {
          for await (const event of generator) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
            } catch {
              // Client disconnected — keep draining the generator so its
              // side effects (the DB write) still complete.
            }
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed/errored (e.g. the client disconnected).
          }
        }
      })();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
}
