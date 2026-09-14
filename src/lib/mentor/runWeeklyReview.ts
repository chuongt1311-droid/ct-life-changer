import type Anthropic from '@anthropic-ai/sdk';
import { applyProfileChanges, emptyProfile, revertSection, type Profile, type ProfileSection } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getWeeklyMetrics } from '@/lib/db/weeklyMetrics';
import { weeklyReview } from '@/lib/mentor/routes/weeklyReview';
import type { MentorRouteParams } from '@/lib/mentor/routes/briefing';

export interface WeeklyReviewResult {
  letter: string;
  changes: { section: string; newText: string; reason: string }[];
  crisis: boolean;
  fallback: boolean;
}

/** Wraps the Plan 4 service with the persistence spec §5.8 describes: a
 * `weekly_letters` row, S1-S4 metrics, and a new `profile_versions` row
 * (author "claude") applying the proposed changes. */
export async function runWeeklyReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  weekStart: string,
): Promise<WeeklyReviewResult> {
  const result = await weeklyReview(client, anthropic, params, weekStart);
  if (result.fallback) return result;

  const repos = repositories(client);
  const versions = await repos.profileVersions.list();
  const latest = [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const current: Profile = latest ? (latest.sections as Profile) : emptyProfile();
  const next = applyProfileChanges(
    current,
    result.changes.map((c) => ({ section: c.section as ProfileSection, newText: c.newText, reason: c.reason })),
  );

  const newVersion = await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    created_at: new Date().toISOString(),
    sections: next,
    author: 'claude',
    changes: result.changes,
  });

  const metrics = await getWeeklyMetrics(client, weekStart);
  await repos.weeklyLetters.upsert({
    week_start: weekStart,
    owner_id: params.ownerId,
    letter: result.letter,
    metrics: metrics as unknown as Record<string, unknown>,
    changes: result.changes as unknown as Record<string, unknown>,
    profile_version_id: newVersion.id,
  });

  return result;
}

/** Spec §8.6: "restores that section's text from the previous version
 * (creating another new version, author user)." */
export async function revertProfileSection(client: RepositoryClient, ownerId: string, section: ProfileSection): Promise<void> {
  const repos = repositories(client);
  const versions = [...(await repos.profileVersions.list())].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (versions.length < 2) return;
  const current = versions[0]!.sections as Profile;
  const previous = versions[1]!.sections as Profile;
  const next = revertSection(current, previous, section);

  await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    created_at: new Date().toISOString(),
    sections: next,
    author: 'user',
    changes: [{ section, newText: previous[section], reason: 'Reverted by CT' }],
  });
}
