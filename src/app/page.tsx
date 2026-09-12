import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { HealthCheck } from './HealthCheck';

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return <main>Not signed in.</main>;
  }

  return (
    <main>
      <h1>Daily Loop — data layer</h1>
      <p>Signed in as {user.email}.</p>
      <HealthCheck />
    </main>
  );
}
