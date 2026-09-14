import type { CheckinRecord, MentorContextInput } from '@/core/mentor/context';
import { emptyProfile, type Profile } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface AssembleContextParams {
  systemPrompt: string;
  date: string;
  request: string;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

/** Spec §8.3: builds the full MentorContextInput from the DB for one
 * date/request. Every field here feeds straight into buildMentorContext
 * (@/core/mentor/context, unmodified) — this module only fetches and shapes,
 * it never decides what the model sees or in what order. */
export async function assembleMentorContext(client: RepositoryClient, params: AssembleContextParams): Promise<MentorContextInput> {
  const repos = repositories(client);

  const [profileVersions, weeklyLetterRows, digestRows, planRows, blockRows, checkinRows] = await Promise.all([
    repos.profileVersions.list(),
    repos.weeklyLetters.list(),
    repos.digests.list(),
    repos.plans.list({ date: params.date } as never),
    repos.blocks.list({ date: params.date } as never),
    repos.checkins.list({ date: params.date } as never),
  ]);

  const latestProfileVersion = [...profileVersions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const profile: Profile = latestProfileVersion ? (latestProfileVersion.sections as Profile) : emptyProfile();

  const plan = planRows[0];

  const checkins: CheckinRecord[] = checkinRows.map((c) => ({
    type: c.type,
    sections: c.sections,
    privateKeys: c.private_keys,
  }));

  return {
    systemPrompt: params.systemPrompt,
    profile,
    weeklyLetters: weeklyLetterRows.map((w) => ({ weekStart: w.week_start, letter: w.letter })),
    // A digest row can now have a null text (a failed generation attempt
    // awaiting the cron tick's retry, Plan 6) — nothing worth sending Claude.
    digests: digestRows.filter((d) => d.text !== null).map((d) => ({ date: d.date, text: d.text as string })),
    today: {
      date: params.date,
      state: plan?.state ?? 'ready',
      flags: (plan?.flags ?? []) as MentorContextInput['today']['flags'],
      adjustments: (plan?.adjustments ?? []) as MentorContextInput['today']['adjustments'],
      overridden: plan?.overridden ?? false,
      blocks: blockRows.map((b) => ({
        id: b.id,
        title: b.title,
        kind: b.kind,
        anchor: b.anchor,
        priority: b.priority,
        start: b.start,
        end: b.end,
        minMinutes: b.min_minutes,
        window: b.window_start !== null && b.window_end !== null ? { earliestStart: b.window_start, latestEnd: b.window_end } : null,
        tags: b.tags,
        checklist: b.checklist,
        recoveryVariant: b.recovery_variant,
        status: b.status,
        source: b.source,
      })),
      checkins,
    },
    request: params.request,
    chatHistory: params.chatHistory,
  };
}
