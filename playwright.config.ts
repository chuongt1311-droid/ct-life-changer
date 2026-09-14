import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@playwright/test';

// The Playwright runner process itself (globalSetup, this config) needs
// E2E_AUTH_SECRET/E2E_BASE_URL too — nothing else loads .env.test.local into
// it. dotenv never overwrites a var already set in the real environment.
loadEnv({ path: '.env.test.local' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    storageState: './e2e/.auth/state.json',
  },
  webServer: {
    command: 'npm run dev',
    // NODE_ENV=test makes Next.js load .env.test.local (and skip .env.local
    // entirely — see @next/env's loadEnvConfig) so this can never run
    // against production credentials, even by accident.
    env: { NODE_ENV: 'test' },
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Always spawn a fresh server bound to the test env rather than
    // reusing whatever else might already be listening on this port.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  globalSetup: './e2e/global-setup.ts',
});
