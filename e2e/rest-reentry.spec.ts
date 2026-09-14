import { expect, test } from '@playwright/test';

test('Start rest leads to the re-entry ramp and "I\'m back" returns to Today', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Start rest/ }).click();
  await page.waitForURL('/reentry');
  await expect(page.getByRole('button', { name: /I'm back/i })).toBeVisible();

  await page.getByRole('button', { name: /I'm back/i }).click();
  await page.waitForURL('/', { timeout: 15_000 });
});
