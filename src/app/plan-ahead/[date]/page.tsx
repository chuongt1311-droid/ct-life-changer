import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { previewFuturePlan } from '@/lib/planner/planAhead';
import { PlanAheadDay } from './PlanAheadDay';

export default async function PlanAheadDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;

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

  // Only the next 14 days (2–15 out) are ever linked to — a direct URL
  // outside that range gets a 404 rather than silently previewing an
  // arbitrary date this page was never designed to show.
  const earliest = addDays(planDate, 2);
  const latest = addDays(planDate, 15);
  if (date < earliest || date > latest) notFound();

  const preview = await previewFuturePlan(client, date, new Date());

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Plan ahead
        </p>
      </header>
      <PlanAheadDay date={date} blocks={preview.plan.blocks} source={preview.source} />
    </main>
  );
}
