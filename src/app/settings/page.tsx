import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { seedSettingsRow } from '@/lib/onboarding/seedData';
import { Placard } from '@/components/ui/Placard';
import { SettingsForm } from './SettingsForm';
import { ExportLinks } from './ExportLinks';

export default async function SettingsPage() {
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
  const settingsRow = (await repositories(client).settings.get()) ?? { ...seedSettingsRow(), owner_id: user.id };

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Settings
        </p>
      </header>
      <SettingsForm initial={settingsRow} ownerEmail={user.email ?? ''} />
      <div className="stepback">
        <Placard>Export</Placard>
        <ExportLinks />
        <Placard>Mentor memory</Placard>
        <Link className="btn btn-quiet" href="/settings/memory">
          View what the mentor has saved about you
        </Link>
      </div>
    </main>
  );
}
