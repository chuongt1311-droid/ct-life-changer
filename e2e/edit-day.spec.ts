import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

/** The sticky bottom bar can legitimately sit over a row at a given scroll
 * position — the same way any sticky-footer list works, and correct: a real
 * thumb scrolls a little further to clear it before tapping (confirmed with
 * a throwaway inspection script, not assumed). `force: true` does not fix
 * this: it skips Playwright's actionability check but the click event still
 * physically lands on whatever is topmost at that pixel — the overlay, not
 * the row underneath. Scrolling the whole page to its true maximum reliably
 * clears any sticky-footer occlusion, since a stuck element doesn't consume
 * document space once actually stuck. */
async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
}

async function tapRow(page: Page, row: Locator) {
  await scrollToBottom(page);
  await row.click();
}

test('edit a session, stack a skip, review both and take the new day', async ({ page }) => {
  await page.goto('/');

  // Open the first changeable session.
  const firstEditable = page.locator('.sessions button.row-edit').first();
  const editedTitle = (await firstEditable.locator('.what').first().innerText()).split('\n')[0]!;
  await tapRow(page, firstEditable);

  // Change its length and apply.
  await expect(page.getByLabel('Minutes')).toBeVisible();
  const current = await page.getByLabel('Minutes').inputValue();
  await page.getByLabel('Minutes').fill(String(Number(current) + 5));
  await page.getByRole('button', { name: 'Apply' }).click();

  // Stack a second edit: skip another session.
  await tapRow(page, page.locator('.sessions button.row-edit').nth(1));
  await page.getByRole('button', { name: 'Skip it today' }).click();

  // Both are pending.
  await expect(page.getByText('2 changes pending')).toBeVisible();

  // Review shows one diff for both.
  await page.getByRole('button', { name: 'Review changes' }).click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible({ timeout: 15_000 });

  // EditableDay's review state is client-only — confirming stays on '/' and
  // the server action's redirect('/') triggers a fresh RSC render rather than
  // a URL change, so waiting on the URL (which never changes) is a false
  // victory. Wait for the confirm button itself to detach instead: it only
  // exists inside the review view that this navigation replaces.
  await page.getByRole('button', { name: 'Take the new day' }).click();
  // "Take the new day" relabels to "Saving…" synchronously, before the async
  // confirmReflowAction call even starts — waiting for THAT button to detach
  // resolves instantly and proves nothing. Wait for "Saving…" to detach
  // instead: it only goes away once the fresh RSC render actually lands.
  await page.getByRole('button', { name: 'Saving…' }).waitFor({ state: 'detached', timeout: 30_000 });
  await expect(page.locator('.sessions').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.sessions').first()).toContainText(editedTitle);
});
