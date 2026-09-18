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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return { ok: false, error: 'NEXT_PUBLIC_SITE_URL is not configured' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: ownerEmail,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface VerifyOtpResult {
  ok: boolean;
  error?: string;
}

/** Exchanges the 6-digit code from the sign-in email for a session —
 * verified by Supabase matching token+email server-side, with no
 * dependency on a code_verifier cookie from whatever browser context
 * requested the email. That dependency is exactly what breaks the
 * clickable-link flow (`/auth/callback`) when the link is opened in a
 * different browser or profile than the one that requested it — most
 * often Gmail's own in-app browser. Typing the code back into the same
 * tab that requested it sidesteps that failure mode entirely. */
export async function verifyOtpCode(code: string): Promise<VerifyOtpResult> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return { ok: false, error: 'OWNER_EMAIL is not configured' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email: ownerEmail, token: code, type: 'email' });
  return error ? { ok: false, error: error.message } : { ok: true };
}
