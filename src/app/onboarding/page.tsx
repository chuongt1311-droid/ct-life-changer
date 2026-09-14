import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
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

  return (
    <main className="shell" data-phase="first-light">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Welcome
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">Set up Life Changer</h1>
        <p className="next-note">A few minutes, once. Everything here can be changed later in Settings or Templates.</p>
      </section>
      <OnboardingForm />
    </main>
  );
}
