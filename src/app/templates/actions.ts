'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { TemplateRow } from '@/lib/db/schemas';

export async function saveTemplateAction(row: TemplateRow): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  await repositories(client).templates.upsert({ ...row, owner_id: user.id });
}
