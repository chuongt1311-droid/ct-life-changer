import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface LogMentorMessageParams {
  ownerId: string;
  date: string;
  route: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  stateAtTime: string | null;
  usageId: string | null;
}

export async function logMentorMessage(client: RepositoryClient, params: LogMentorMessageParams): Promise<void> {
  await repositories(client).mentorMessages.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    date: params.date,
    route: params.route,
    role: params.role,
    content: params.content,
    state_at_time: params.stateAtTime,
    usage_id: params.usageId,
    created_at: new Date().toISOString(),
  });
}
