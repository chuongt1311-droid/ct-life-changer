import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { Placard } from '@/components/ui/Placard';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function PlanAheadPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  // Days 2–15 out — today and tomorrow are Today's and Day-changed's screens.
  const dates = Array.from({ length: 14 }, (_, i) => addDays(planDate, i + 2));
  const plans = await repos.plans.list();
  const plannedDates = new Set(plans.map((p) => p.date));

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Plan ahead
        </p>
      </header>
      <Placard>The next 14 days</Placard>
      <ul className="sessions plain">
        {dates.map((date) => {
          const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
          return (
            <li key={date} data-rank="next">
              <span className="what">
                {WEEKDAY_NAMES[weekday]}
                <small>{plannedDates.has(date) ? 'Planned' : 'From template'}</small>
              </span>
              <Link className="btn btn-quiet" href={`/plan-ahead/${date}`}>
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
