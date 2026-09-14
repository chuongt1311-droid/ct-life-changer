import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { EveningForm } from './EveningForm';

export default async function EveningCheckinPage() {
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
  const settingsRow = await repositories(client).settings.get();

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Evening
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Debrief</h1>
        <p className="sheet-sub">Six sections. Any of them can be skipped and the day still counts.</p>
      </div>
      <EveningForm crisisContacts={settingsRow?.crisis_contacts ?? []} />
    </main>
  );
}
