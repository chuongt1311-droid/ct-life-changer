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
  const stream = new ReadableStream({
    async pull(controller) {
      const next = await generator.next();
      if (next.done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(next.value));
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
