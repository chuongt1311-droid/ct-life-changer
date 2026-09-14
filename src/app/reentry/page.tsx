import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { startRest } from '@/lib/planner/restSessions';
import { Placard } from '@/components/ui/Placard';
import { ImBackButton } from './ImBackButton';

export default async function ReentryPage() {
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
  const { planDate, minute } = planClock(new Date(), settings.timezone);

  const todaySessions = await repos.restSessions.list({ date: planDate } as never);
  let session = todaySessions.find((s) => s.ended_at === null);
  if (!session) {
    session = await startRest(client, { ownerId: user.id, date: planDate, activity: 'other', planned: false, blockId: null }, new Date());
  }

  const blocks = await repos.blocks.list({ date: planDate } as never);
  const next = [...blocks].sort((a, b) => a.start - b.start).find((b) => b.start > minute && b.status === 'planned');

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Rest
        </p>
      </header>
      <section className="next" aria-labelledby="next-name">
        <h1 className="next-name" id="next-name">
          Re-entry
        </h1>
        <p className="next-note">Three steps, whenever you&apos;re ready. Nothing here is a countdown you have to beat.</p>
      </section>
      <div className="stepback">
        <Placard>The ramp</Placard>
        <ol className="ramp">
          <li data-state="now">
            <span className="pip" />
            <span>
              <h3 className="r-name">Stand up</h3>
              <p className="r-note">Get off whatever you&apos;re on. That&apos;s the whole step.</p>
            </span>
          </li>
          <li data-state="later">
            <span className="pip" />
            <span>
              <h3 className="r-name">Water</h3>
              <p className="r-note">One glass, before anything else.</p>
            </span>
          </li>
          <li data-state="later">
            <span className="pip" />
            <span>
              <h3 className="r-name">First 2 minutes of {next ? next.title : "what's next"}</h3>
              <p className="r-note">Not the whole thing — just the first two minutes. That&apos;s enough to be back.</p>
            </span>
          </li>
        </ol>
        <p className="empty">Nothing was lost while you rested. Attributes and badges only ever go up.</p>
      </div>
      <div className="thumb">
        <ImBackButton sessionId={session.id} />
      </div>
    </main>
  );
}
