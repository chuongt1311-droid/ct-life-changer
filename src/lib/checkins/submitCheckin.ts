import {
  morningBodySchema,
  morningMindSchema,
  eveningBodySchema,
  eveningMindSchema,
  eveningWorkSchema,
  eveningPleasureSchema,
  eveningPeopleSchema,
  eveningReflectionSchema,
} from '@/lib/db/schemas';
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

export interface EveningCheckinInput {
  body: { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number; energyNow: number };
  mind: { peakStress: number; stressCause: string[]; focusQuality: number; regulated: string[] };
  work: { tasksDone: string[]; deepWorkMinutes: number; footballAnalytics: { projects: string[]; minutes: number; learned: string } };
  pleasure: { plannedRestSessions: number; unplannedEntries: { activity: string; minutes: number }[]; cameBackAfterRest: 'yes' | 'partly' | 'no' };
  people: { who: string[]; interactionType: 'in person' | 'call' | 'text' | 'online' | null; felt: 'draining' | 'neutral' | 'energizing' | null; reachedOut: boolean; frictionNote: string };
  reflection: { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string };
  privateKeys: string[];
}

export async function submitEveningCheckin(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  input: EveningCheckinInput,
): Promise<CheckinRow> {
  const sections = {
    body: eveningBodySchema.parse(input.body),
    mind: eveningMindSchema.parse(input.mind),
    work: eveningWorkSchema.parse(input.work),
    pleasure: eveningPleasureSchema.parse(input.pleasure),
    people: eveningPeopleSchema.parse(input.people),
    reflection: eveningReflectionSchema.parse(input.reflection),
  };
  return repositories(client).checkins.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    date,
    type: 'evening',
    sections,
    private_keys: input.privateKeys,
    created_at: new Date().toISOString(),
  });
}
