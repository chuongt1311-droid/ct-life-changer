import { seedSettingsRow, seedTemplateRows } from '@/lib/onboarding/seedData';
import type { Profile } from '@/core/mentor/profile';
import type { CrisisContact } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface OnboardingInput {
  profile: Profile;
  crisisContacts: CrisisContact[];
  timezone: string;
  wakeTime: string;
  bedtime: string;
}

/** First-run setup: settings + 7 weekday templates (both editable afterward
 * in Templates/Settings, Tasks 19–20) plus the first `profile_versions` row
 * (spec §8.6, author "user"). Idempotent on the settings/templates half —
 * re-running onboarding after it already ran just overwrites with the same
 * seed defaults CT hasn't customized away from yet. */
export async function completeOnboarding(client: RepositoryClient, ownerId: string, input: OnboardingInput): Promise<void> {
  const repos = repositories(client);
  await repos.settings.upsert({
    ...seedSettingsRow(),
    owner_id: ownerId,
    timezone: input.timezone,
    wake_time: input.wakeTime,
    bedtime: input.bedtime,
    crisis_contacts: input.crisisContacts,
  });
  await Promise.all(seedTemplateRows().map((t) => repos.templates.upsert({ ...t, owner_id: ownerId })));
  await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    created_at: new Date().toISOString(),
    sections: input.profile,
    author: 'user',
    changes: [],
  });
}
