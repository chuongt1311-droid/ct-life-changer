import { expect, test } from '@playwright/test';

test('morning check-in shows a briefing or returns to Today', async ({ page }) => {
  await page.goto('/checkin/morning');
  await expect(page.getByRole('heading', { name: 'Body' })).toBeVisible();

  await page.getByRole('button', { name: /Log the morning/ }).click();

  // Either the reassessment banner shows (state changed) or it redirects
  // straight back to Today (no change) — both are valid successful outcomes.
  await Promise.race([
    page.getByText('Today changed').waitFor({ state: 'visible', timeout: 15_000 }),
    page.waitForURL('/', { timeout: 15_000 }),
  ]);
});
