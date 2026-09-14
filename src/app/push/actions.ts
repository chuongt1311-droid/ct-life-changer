'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface SubscribePushInput {
  endpoint: string;
  keys: Record<string, string>;
  deviceLabel: string;
}

/** Upserts by endpoint (not by a fresh id) so re-subscribing the same device
 * — the browser calling PushManager.subscribe() again — updates the existing
 * row instead of colliding with the table's unique constraint on endpoint. */
export async function subscribePushAction(input: SubscribePushInput): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const existing = (await repos.pushSubscriptions.list({ owner_id: user.id } as never)).find((s) => s.endpoint === input.endpoint);

  await repos.pushSubscriptions.upsert({
    id: existing?.id ?? crypto.randomUUID(),
    owner_id: user.id,
    endpoint: input.endpoint,
    keys: input.keys,
    device_label: input.deviceLabel,
    created_at: existing?.created_at ?? new Date().toISOString(),
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const existing = (await repos.pushSubscriptions.list({ owner_id: user.id } as never)).find((s) => s.endpoint === endpoint);
  if (existing) await repos.pushSubscriptions.remove(existing.id);
}

export async function hasPushSubscriptionAction(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const client = supabase as unknown as RepositoryClient;
  const subs = await repositories(client).pushSubscriptions.list({ owner_id: user.id } as never);
  return subs.length > 0;
}
