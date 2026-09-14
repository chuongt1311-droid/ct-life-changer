import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { createAdminSupabase } from '../src/lib/supabase/admin';
import type { RepositoryClient } from '../src/lib/db/repository';
import { upsertSettings, upsertTemplate } from '../src/lib/db/repositories';
import { seedSettingsRow, seedTemplateRows } from '../src/lib/onboarding/seedData';

/** A fresh test Supabase project has no settings/template rows yet, so
 * signing in redirects straight to /onboarding (src/app/page.tsx's own
 * gate) — none of the four spec §13 flows have anything to work with until
 * that's seeded. Mirrors scripts/seed.ts's logic directly (not shelled out
 * to, since that script hardcodes .env.local) against whichever project
 * .env.test.local points at. */
async function seedOnboardingData(ownerEmail: string) {
  const admin = createAdminSupabase();
  const client = admin as unknown as RepositoryClient;
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const owner = usersPage?.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  if (!owner) throw new Error(`No auth user found for OWNER_EMAIL ${ownerEmail} — the test login step should have created one.`);

  await upsertSettings(client, { ...seedSettingsRow(), owner_id: owner.id });
  for (const template of seedTemplateRows()) {
    await upsertTemplate(client, { ...template, owner_id: owner.id });
  }
}

/** Authenticates once via the secret-gated test login route (Task 13),
 * seeds onboarding data if this is a fresh test project, and saves the
 * resulting session cookies for every spec to reuse. */
export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) throw new Error('E2E_AUTH_SECRET must be set (see .env.test.local.example) to run E2E tests.');
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) throw new Error('OWNER_EMAIL must be set (see .env.test.local.example) to run E2E tests.');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/api/test/login?secret=${secret}`);
  await page.waitForURL(/\/(onboarding)?$/, { timeout: 30_000 });

  if (page.url() === `${baseURL}/onboarding`) {
    await seedOnboardingData(ownerEmail);
    await page.goto(baseURL);
    await page.waitForURL(`${baseURL}/`);
  }

  fs.mkdirSync('./e2e/.auth', { recursive: true });
  await page.context().storageState({ path: './e2e/.auth/state.json' });
  await browser.close();
}
