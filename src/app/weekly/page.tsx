import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { WeeklyReviewView } from './WeeklyReviewView';

export default async function WeeklyPage() {
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
  // The most recent Sunday on or before today (spec §5.8: weeks start Sunday).
  const weekday = new Date(`${planDate}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(planDate, -weekday);
  // The letter for this week may already have been written — by the Sunday cron
  // or by CT. Without this the screen only ever showed the letter it wrote in
  // the current session, so returning the next day offered to run it again.
  const saved = await repos.weeklyLetters.get(weekStart, 'week_start');

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Weekly review
        </p>
      </header>
      <WeeklyReviewView weekStart={weekStart} savedLetter={saved?.letter ?? null} />
    </main>
  );
}
