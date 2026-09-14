import { morningBodySchema, morningMindSchema } from '@/lib/db/schemas';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { CheckinRow } from '@/lib/db/schemas';

export interface MorningCheckinInput {
  body: { bedtime: string; wakeTime: string; sleepQuality: number; energy: number };
  mind: { mood: number; stress: number; stressCause: string[] };
  privateKeys: string[];
}

/** Spec §6: validated with the same zod schemas the repository layer already
 * uses (Plan 3) — a bad value is rejected before it ever reaches storage. */
export async function submitMorningCheckin(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  input: MorningCheckinInput,
): Promise<CheckinRow> {
  const body = morningBodySchema.parse(input.body);
  const mind = morningMindSchema.parse(input.mind);
  return repositories(client).checkins.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    date,
    type: 'morning',
    sections: { body, mind },
    private_keys: input.privateKeys,
    created_at: new Date().toISOString(),
  });
}
