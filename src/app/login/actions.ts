'use server';

import { createServerSupabase } from '@/lib/supabase/server';

export interface SendMagicLinkResult {
  ok: boolean;
  error?: string;
}

/** Sends the magic link to OWNER_EMAIL — there is only ever one account, so
 * there is nothing for CT to type. */
export async function sendMagicLink(): Promise<SendMagicLinkResult> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return { ok: false, error: 'OWNER_EMAIL is not configured' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: ownerEmail,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
