import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { sendPush } from '@/lib/push/sendPush';
import { runCronTick } from '@/lib/cron/tick';

/** Called by Supabase's pg_cron + pg_net once a minute (see
 * supabase/migrations/0002_nudges_and_digest_retry.sql). Authenticates with
 * CRON_SECRET, not a Supabase session — see src/proxy.ts's isCronRoute. */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const client = createAdminSupabase() as unknown as RepositoryClient;
  const result = await runCronTick({
    client,
    anthropic: createAnthropicClient(),
    sendPush,
    now: new Date(),
  });
  return NextResponse.json(result);
}
