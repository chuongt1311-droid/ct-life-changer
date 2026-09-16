'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { deleteMemory } from '@/lib/memory/client';

export async function deleteMentorMemoryAction(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await deleteMemory(id);
}
