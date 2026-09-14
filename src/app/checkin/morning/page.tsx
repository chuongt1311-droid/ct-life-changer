import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { MorningForm } from './MorningForm';

export default async function MorningCheckinPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="first-light">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);

  return (
    <main className="shell" data-phase="first-light">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Morning
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Morning check-in</h1>
        <p className="sheet-sub">Two sections. Either can be skipped and the day still counts.</p>
      </div>
      <MorningForm prefillBedtime={settings.bedtime} prefillWakeTime={settings.wakeTime} />
    </main>
  );
}
