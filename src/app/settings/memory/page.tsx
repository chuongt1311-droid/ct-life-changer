import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { listMentorMemories } from '@/lib/memory/client';
import { Placard } from '@/components/ui/Placard';
import { MemoryList } from './MemoryList';

export default async function MentorMemoryPage() {
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

  const result = await listMentorMemories();

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Mentor memory
        </p>
      </header>
      <Placard>What the mentor has saved about you</Placard>
      <MemoryList initial={result.ok ? result.memories : []} unreachable={!result.ok} />
    </main>
  );
}
