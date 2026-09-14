import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { getDaySummaries } from '@/lib/db/daySummary';
import { getPlayerCard } from '@/lib/db/progressDays';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { ensureTodayPlan } from '@/lib/planner/ensureTodayPlan';
import { computeLoadBars } from '@/core/today/loadBars';
import { dayPhase } from '@/core/today/phase';
import { planClock, formatPlanMinute } from '@/core/time';
import { PlayerCardStrip } from '@/components/ui/PlayerCardStrip';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { SessionRow, type SessionRank } from '@/components/ui/SessionRow';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { DeptNav } from '@/components/ui/DeptNav';
import { Icon } from '@/components/icons/Icon';
import { Countdown } from '@/components/today/Countdown';
import { NudgesBanner } from '@/components/today/NudgesBanner';

const RANK: Record<string, SessionRank> = { done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done', active: 'now', planned: 'next' };
const TAG_LABEL: Record<string, string> = { done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed', dropped: 'Dropped', active: 'Now', planned: 'Next' };

export default async function TodayPage() {
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
  const settingsCheck = await repositories(client).settings.get();
  if (!settingsCheck) redirect('/onboarding');

  const now = new Date();
  const { blocks } = await ensureTodayPlan(client, user.id, now);
  const settings = settingsToDomain(settingsCheck);
  const { planDate, minute } = planClock(now, settings.timezone);
  const [today] = await getDaySummaries(client, planDate, planDate);
  const card = await getPlayerCard(client, planDate);

  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const current = sorted.find((b) => b.status === 'active') ?? sorted.find((b) => b.start <= minute && b.end > minute && b.status === 'planned');
  const next = sorted.find((b) => b.start > minute && (b.status === 'planned' || b.status === 'active'));
  const headline = current ?? next ?? sorted[sorted.length - 1];
  const minutesToNext = next ? Math.max(0, next.start - minute) : 0;
  const phase = dayPhase(minute);
  const weekday = new Date(`${planDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  const bars = computeLoadBars({
    blocks: blocks.map((b) => ({
      id: b.id, title: b.title, kind: b.kind, anchor: b.anchor, priority: b.priority, start: b.start, end: b.end,
      minMinutes: b.min_minutes, window: b.window_start !== null && b.window_end !== null ? { earliestStart: b.window_start, latestEnd: b.window_end } : null,
      tags: b.tags, checklist: b.checklist, recoveryVariant: b.recovery_variant, status: b.status, source: b.source,
    })),
    today: today!,
    settings,
  });

  return (
    <main className="shell" data-phase={phase}>
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> {phase[0]!.toUpperCase() + phase.slice(1).replace('-', ' ')} · {weekday}
        </p>
        <time>{formatPlanMinute(minute)}</time>
      </header>

      <section className="next" aria-labelledby="next-name">
        <h1 className="next-name" id="next-name">
          {headline?.title ?? 'Nothing planned'}
        </h1>
        {next && (
          <p className="next-when">
            <span className="lead">Next session in</span>
            <Countdown initialMinutes={minutesToNext} />
            <span className="lead">
              · {formatPlanMinute(next.start)}–{formatPlanMinute(next.end)}
            </span>
          </p>
        )}
      </section>

      <PlayerCardStrip card={card} />

      <NudgesBanner />

      <div className="stepback desk">
        <Placard>Today&apos;s load</Placard>
        <ul className="load">
          {bars.map((bar) => (
            <LoadBarRow key={bar.name} {...bar} />
          ))}
        </ul>

        <div className="col-b">
          <Placard>The rest of today</Placard>
          <ul className="sessions">
            {sorted.map((b) => (
              <SessionRow
                key={b.id}
                at={formatPlanMinute(b.start)}
                title={b.title}
                note={b.anchor ? 'Anchor' : b.kind}
                rank={RANK[b.status] ?? 'next'}
                tagState="neutral"
                tagLabel={TAG_LABEL[b.status] ?? b.status}
              />
            ))}
          </ul>
        </div>

        <DeptNav />
      </div>

      <ThumbBar>
        <Link className="btn btn-main" href="/reentry">
          <Icon name="rest" />
          Start rest
        </Link>
        <Link className="btn" href="/day-changed">
          <Icon name="shift" />
          Day changed
        </Link>
      </ThumbBar>
    </main>
  );
}
