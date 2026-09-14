'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { completeOnboarding, type OnboardingInput } from '@/lib/onboarding/completeOnboarding';

export async function completeOnboardingAction(input: OnboardingInput): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await completeOnboarding(supabase as unknown as RepositoryClient, user.id, input);
  redirect('/');
}
