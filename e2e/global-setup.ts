import { chromium } from '@playwright/test';
import fs from 'node:fs';

/** Authenticates once via the secret-gated test login route (Task 13) and
 * saves the resulting session cookies for every spec to reuse. */
export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) throw new Error('E2E_AUTH_SECRET must be set (see .env.test.local.example) to run E2E tests.');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/api/test/login?secret=${secret}`);
  await page.waitForURL(`${baseURL}/`);
  fs.mkdirSync('./e2e/.auth', { recursive: true });
  await page.context().storageState({ path: './e2e/.auth/state.json' });
  await browser.close();
}
