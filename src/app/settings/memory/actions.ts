'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { deleteMemory } from '@/lib/memory/client';

export async function deleteMentorMemoryAction(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  // A direct user action, not a fire-and-forget hook: if the delete didn't
  // actually happen, throw so MemoryList's catch keeps the row and shows
  // the error, rather than filtering away a memory that's still there.
  const deleted = await deleteMemory(id);
  if (!deleted) throw new Error('Could not delete that memory.');
}
