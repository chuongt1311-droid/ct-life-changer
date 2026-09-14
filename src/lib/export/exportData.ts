import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

/** Every table spec §10 defines, for "Export: downloads all tables". */
export async function buildExportData(client: RepositoryClient): Promise<Record<string, unknown[]>> {
  const repos = repositories(client);
  const [
    settings, templates, plans, blocks, checkins, restSessions, unplannedIndulgence,
    mentorMessages, digests, weeklyLetters, profileVersions, pushSubscriptions, nudgesSent, usage,
  ] = await Promise.all([
    repos.settings.get(),
    repos.templates.list(),
    repos.plans.list(),
    repos.blocks.list(),
    repos.checkins.list(),
    repos.restSessions.list(),
    repos.unplannedIndulgence.list(),
    repos.mentorMessages.list(),
    repos.digests.list(),
    repos.weeklyLetters.list(),
    repos.profileVersions.list(),
    repos.pushSubscriptions.list(),
    repos.nudgesSent.list(),
    repos.usage.list(),
  ]);
  return {
    settings: settings ? [settings] : [],
    templates, plans, blocks, checkins, rest_sessions: restSessions, unplanned_indulgence: unplannedIndulgence,
    mentor_messages: mentorMessages, digests, weekly_letters: weeklyLetters, profile_versions: profileVersions,
    push_subscriptions: pushSubscriptions, nudges_sent: nudgesSent, usage,
  };
}
