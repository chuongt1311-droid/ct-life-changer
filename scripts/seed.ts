import 'dotenv/config';
import { createAdminSupabase } from '../src/lib/supabase/admin';
import type { RepositoryClient } from '../src/lib/db/repository';
import { upsertSettings, upsertTemplate } from '../src/lib/db/repositories';
import { seedSettingsRow, seedTemplateRows } from '../src/lib/onboarding/seedData';

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) throw new Error('OWNER_EMAIL is not set in .env.local');

  const supabaseAdmin = createAdminSupabase();
  // Cast rather than let TS infer structural assignability here: unifying the
  // real (deeply generic) PostgrestFilterBuilder types against our narrow
  // RepositoryClient interface at the call site hits TS2589 ("Type
  // instantiation is excessively deep"). The runtime shape is correct — this
  // is the same interface satisfied by every repository test's fake client.
  const admin = supabaseAdmin as unknown as RepositoryClient;

  // The owner's auth.users row is created by the first magic-link sign-in
  // (Task 7), which may not have happened yet. Look it up if it exists so
  // seed rows carry the real owner_id; otherwise leave it blank — RLS still
  // protects the table, and Task 7's first sign-in doesn't depend on seeding
  // having run first.
  const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers();
  const owner = usersPage?.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  const ownerId = owner?.id ?? '';

  const settings = { ...seedSettingsRow(), owner_id: ownerId };
  await upsertSettings(admin, settings);
  console.log('Seeded settings');

  for (const template of seedTemplateRows()) {
    await upsertTemplate(admin, { ...template, owner_id: ownerId });
  }
  console.log('Seeded 7 weekday templates');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
