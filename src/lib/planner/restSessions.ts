import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { RestSessionRow } from '@/lib/db/schemas';

export interface StartRestParams {
  ownerId: string;
  date: string;
  activity: string;
  planned: boolean;
  blockId: string | null;
}

/** Spec §5.6: "Start rest (or a planned rest block beginning) creates a
 * rest_session with activity chip." */
export async function startRest(client: RepositoryClient, params: StartRestParams, now: Date): Promise<RestSessionRow> {
  return repositories(client).restSessions.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    date: params.date,
    block_id: params.blockId,
    activity: params.activity,
    planned: params.planned,
    started_at: now.toISOString(),
    ended_at: null,
    reentry_ack_at: null,
  });
}

/** "I'm back": ends the session (if not already ended) and acknowledges
 * re-entry in the same tap — spec §5.6's `reentryAckAt`. */
export async function acknowledgeReentry(client: RepositoryClient, session: RestSessionRow, now: Date): Promise<RestSessionRow> {
  const repos = repositories(client);
  const nowIso = now.toISOString();
  return repos.restSessions.upsert({ ...session, ended_at: session.ended_at ?? nowIso, reentry_ack_at: nowIso });
}
