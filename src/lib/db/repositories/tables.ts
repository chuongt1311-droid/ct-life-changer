import {
  blockRowSchema,
  checkinRowSchema,
  digestRowSchema,
  mentorMessageRowSchema,
  mentorProposalRowSchema,
  nudgeSentRowSchema,
  planRowSchema,
  profileVersionRowSchema,
  pushSubscriptionRowSchema,
  restSessionRowSchema,
  unplannedIndulgenceRowSchema,
  usageRowSchema,
  weeklyLetterRowSchema,
  weeklyReviewAttemptRowSchema,
} from '../schemas';
import { createTableRepository, type RepositoryClient } from '../repository';

export function tableRepositories(client: RepositoryClient) {
  return {
    plans: createTableRepository(client, 'plans', planRowSchema),
    blocks: createTableRepository(client, 'blocks', blockRowSchema),
    checkins: createTableRepository(client, 'checkins', checkinRowSchema),
    restSessions: createTableRepository(client, 'rest_sessions', restSessionRowSchema),
    unplannedIndulgence: createTableRepository(client, 'unplanned_indulgence', unplannedIndulgenceRowSchema),
    mentorMessages: createTableRepository(client, 'mentor_messages', mentorMessageRowSchema),
    mentorProposals: createTableRepository(client, 'mentor_proposals', mentorProposalRowSchema),
    digests: createTableRepository(client, 'digests', digestRowSchema),
    weeklyLetters: createTableRepository(client, 'weekly_letters', weeklyLetterRowSchema),
    weeklyReviewAttempts: createTableRepository(client, 'weekly_review_attempts', weeklyReviewAttemptRowSchema),
    profileVersions: createTableRepository(client, 'profile_versions', profileVersionRowSchema),
    pushSubscriptions: createTableRepository(client, 'push_subscriptions', pushSubscriptionRowSchema),
    nudgesSent: createTableRepository(client, 'nudges_sent', nudgeSentRowSchema),
    usage: createTableRepository(client, 'usage', usageRowSchema),
  };
}
