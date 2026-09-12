'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';

export interface PingResult {
  ok: boolean;
  timezone?: string;
  error?: string;
}

/** Reads settings, then writes it back unchanged. Proves the deployed app can
 * both read and write Supabase under RLS as the signed-in owner — not just
 * that the page rendered. */
export async function pingSupabase(): Promise<PingResult> {
  try {
    const supabase = await createServerSupabase();
    // See scripts/seed.ts for why this cast is needed: unifying the real,
    // deeply generic Supabase query-builder types against RepositoryClient's
    // structural shape at the call site hits TS2589 ("Type instantiation is
    // excessively deep"). The runtime shape is the same one every repository
    // test's fake client satisfies.
    const repos = repositories(supabase as unknown as RepositoryClient);
    const settings = await repos.settings.get();
    if (!settings) return { ok: false, error: 'No settings row yet — run `npm run seed`.' };
    await repos.settings.upsert(settings);
    return { ok: true, timezone: settings.timezone };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
