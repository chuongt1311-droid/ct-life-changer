import { expect, test, type Locator, type Page } from '@playwright/test';
import { createAdminSupabase } from '../src/lib/supabase/admin';
import type { RepositoryClient } from '../src/lib/db/repository';

test.use({ viewport: { width: 390, height: 844 } });

/** A prior run of this same spec, on the same real calendar day, already
 * saved an override for whichever date the list's first row pointed at —
 * `confirmFuturePlan` deliberately makes that stick (spec B). Delete any
 * plan/blocks rows for the target date first so this test always starts
 * from the same "nothing saved yet" condition its assertions assume,
 * regardless of run history — the same discipline sub-project A's own
 * verification scripts used against the test project directly. */
async function resetFutureDate(date: string) {
  const admin = createAdminSupabase();
  const client = admin as unknown as RepositoryClient;
  await client.from('blocks').delete().eq('date', date);
  await client.from('plans').delete().eq('date', date);
}

/** Same sticky-footer occlusion sub-project A's edit-day.spec.ts already
 * documented and worked around — scrolling to the true bottom reliably
 * clears it before a row tap. */
async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

async function tapRow(page: Page, row: Locator) {
  await scrollToBottom(page);
  await row.click();
}

test('planning a future date generates a preview, edits it, and the edit sticks on reload', async ({ page }) => {
  await page.goto('/plan-ahead');
  await expect(page.getByText('The next 14 days')).toBeVisible();

  // Open the first listed date — a date this far out has no plan row yet,
  // so this exercises the "generated" preview path.
  const firstOpen = page.locator('.sessions a', { hasText: 'Open' }).first();
  const href = await firstOpen.getAttribute('href');
  const targetDate = href!.split('/').pop()!;
  await resetFutureDate(targetDate);
  await firstOpen.click();
  await expect(page.getByText(/preview built from the template/i)).toBeVisible();

  const row = page.locator('.sessions button.row-edit').first();
  await row.waitFor({ state: 'visible' });
  const originalTitle = (await row.locator('.what').first().innerText()).split('\n')[0]!;
  await tapRow(page, row);

  await expect(page.getByLabel('Minutes')).toBeVisible();
  const current = await page.getByLabel('Minutes').inputValue();
  await page.getByLabel('Minutes').fill(String(Number(current) + 15));
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('1 change pending')).toBeVisible();
  await scrollToBottom(page);
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible({ timeout: 15_000 });

  await scrollToBottom(page);
  await page.getByRole('button', { name: 'Take the new day' }).click();
  await page.getByRole('button', { name: 'Saving…' }).waitFor({ state: 'detached', timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'What changed' })).not.toBeVisible();

  // Reload the same date: the edit must have persisted as a real plan, not
  // been regenerated back to the untouched template.
  await page.goto(href!);
  await expect(page.getByText(/preview built from the template/i)).not.toBeVisible();
  const reloadedRow = page.locator('.sessions button.row-edit', { hasText: originalTitle }).first();
  await expect(reloadedRow).toBeVisible();
});
