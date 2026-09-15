import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { getDaySummaries } from '@/lib/db/daySummary';
import { getWeeklyMetrics } from '@/lib/db/weeklyMetrics';
import { addDays, planClock } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { Tag } from '@/components/ui/Tag';

export default async function HistoryPage() {
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
  const weekday = new Date(`${planDate}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(planDate, -weekday);

  const [days, metrics, plans, letters] = await Promise.all([
    getDaySummaries(client, addDays(planDate, -29), planDate),
    getWeeklyMetrics(client, weekStart),
    repos.plans.list(),
    repos.weeklyLetters.list(),
  ]);
  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const recentLetters = [...letters].sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 4);

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> History
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">History</h1>
        <p className="sheet-sub">The last 30 days, this week&apos;s numbers, and recent letters.</p>
      </div>
      <div className="stepback">
        <Placard>This week (spec §2 S1–S4)</Placard>
        <ul className="load">
          <LoadBarRow name="Check-in days" valueText={`${metrics.s1.checkinDays} of 7`} percent={(metrics.s1.checkinDays / 7) * 100} read={metrics.s1.met ? 'ok' : 'warn'} />
          <LoadBarRow name="Nights ≥7h sleep" valueText={`${metrics.s2.nightsSleep7} of 7`} percent={(metrics.s2.nightsSleep7 / 7) * 100} read={metrics.s2.met ? 'ok' : 'warn'} />
          <LoadBarRow
            name="Returned from rest on time"
            valueText={metrics.s3.rate === null ? 'No rest sessions yet' : `${Math.round(metrics.s3.rate * 100)}%`}
            percent={metrics.s3.rate === null ? 0 : metrics.s3.rate * 100}
            read={metrics.s3.met === false ? 'warn' : 'ok'}
          />
          <LoadBarRow
            name="Training done vs planned"
            valueText={`${metrics.s4.trainingDone} of ${metrics.s4.trainingPlanned}`}
            percent={metrics.s4.trainingPlanned === 0 ? 100 : (metrics.s4.trainingDone / metrics.s4.trainingPlanned) * 100}
            read="ok"
          />
        </ul>

        <Placard>Last 30 days</Placard>
        <ul className="sessions">
          {[...days].reverse().map((d) => {
            const plan = planByDate.get(d.date);
            return (
              <li key={d.date} data-rank="done">
                <span className="at">{d.date.slice(5)}</span>
                <span className="what">
                  {plan ? plan.state[0]!.toUpperCase() + plan.state.slice(1) : 'No plan'}
                  <small>{d.sleepHours !== null ? `${d.sleepHours}h sleep` : 'No sleep logged'}</small>
                </span>
                <Tag state={plan ? (plan.state as 'ready' | 'drifting' | 'depleted' | 'grinding') : 'neutral'} />
              </li>
            );
          })}
        </ul>

        <Placard>Recent letters</Placard>
        {recentLetters.length === 0 ? (
          <p className="hint">No weekly letters yet — run one from the Mentor screen&apos;s weekly review.</p>
        ) : (
          <ul className="sessions">
            {recentLetters.map((l) => (
              <li key={l.week_start} data-rank="done">
                <span className="what">
                  Week of {l.week_start}
                  <small>{l.letter.slice(0, 80)}…</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
