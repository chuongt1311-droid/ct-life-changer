import { expect, test } from '@playwright/test';

test('Day changed shows a diff and confirms', async ({ page }) => {
  await page.goto('/day-changed');
  await expect(page.getByRole('heading')).toBeVisible();

  const confirmButton = page.getByRole('button', { name: /Confirm|Apply/i }).first();
  await confirmButton.click();
  await page.waitForURL('/', { timeout: 15_000 });
});
