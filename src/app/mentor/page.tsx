import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { checkCap } from '@/lib/mentor/usage';
import { DEFAULT_SETTINGS } from '@/core/types';
import { Placard } from '@/components/ui/Placard';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { ChatThread, type ChatMessage } from '@/components/mentor/ChatThread';

export default async function MentorPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  const [history, cap] = await Promise.all([
    repos.mentorMessages.list({ date: planDate, route: 'chat' } as never),
    checkCap(client, user.id, settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd, new Date()),
  ]);
  const initialMessages: ChatMessage[] = history
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Mentor
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Mentor</h1>
        <p className="sheet-sub">Reads today&apos;s plan, recent history, and your check-ins. Nothing marked &quot;just for me&quot; is ever sent.</p>
      </div>
      {/* Usage first, conversation last: the composer is sticky, so anything
          rendered after it pushes it up out of the thumb zone — which is why
          the ask box used to sit halfway up an empty screen. */}
      <div className="stepback">
        <Placard>This month&apos;s usage</Placard>
        <ul className="load">
          <LoadBarRow
            name="Spend vs cap"
            valueText={`$${cap.spentUsd.toFixed(2)} of $${cap.capUsd.toFixed(2)}`}
            percent={Math.min(100, Math.round((cap.spentUsd / cap.capUsd) * 100))}
            read={cap.over ? 'over' : cap.spentUsd >= cap.capUsd * 0.8 ? 'warn' : 'ok'}
          />
        </ul>
        <Placard>Conversation</Placard>
        <ChatThread date={planDate} initialMessages={initialMessages} crisisContacts={settingsRow?.crisis_contacts ?? []} />
      </div>
    </main>
  );
}
