import { expect, test } from '@playwright/test';

test('Day changed shows a diff and confirms', async ({ page }) => {
  await page.goto('/day-changed');
  // The page renders both an <h1> ("The day moved") and an <h2> section
  // heading ("What changed?") — a bare getByRole('heading') matches both
  // and Playwright's strict mode refuses to pick one implicitly.
  await expect(page.getByRole('heading', { name: 'The day moved' })).toBeVisible();

  // ReflowFlow.tsx is a two-step picker → diff sheet: picking an event first
  // calls previewReflowAction (a server round trip), then the diff sheet
  // (with its actual "Take the new day" confirm button) renders.
  await page.getByRole('button', { name: 'Running late (30 min)' }).click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Take the new day' }).click();
  await page.waitForURL('/', { timeout: 15_000 });
});
