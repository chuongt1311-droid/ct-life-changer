import { expect, test } from '@playwright/test';

test('evening form submission shows the review', async ({ page }) => {
  await page.goto('/checkin/evening');
  await expect(page.getByRole('heading', { name: 'Body' })).toBeVisible();

  await page.getByRole('button', { name: /Log the day/ }).click();
  await expect(page.getByText('From the department')).toBeVisible({ timeout: 15_000 });
});
