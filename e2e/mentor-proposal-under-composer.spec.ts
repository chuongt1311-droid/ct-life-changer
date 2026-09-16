import { test, expect } from '@playwright/test';
import { createAdminSupabase } from '../src/lib/supabase/admin';
import { repositories } from '../src/lib/db/repositories';
import type { RepositoryClient } from '../src/lib/db/repository';
import { settingsToDomain } from '../src/lib/db/settingsMapping';
import { planClock } from '../src/core/time';

test('a proposal on a long thread is reachable without manual scrolling', async ({ page }) => {
  const admin = createAdminSupabase();
  const settingsRow = await repositories(admin as unknown as RepositoryClient).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate: today } = planClock(new Date(), settings.timezone);
  const ownerEmail = process.env.OWNER_EMAIL!;
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const ownerId = usersPage!.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase())!.id;

  // mentor_proposals FK-references mentor_messages, so proposals (ALL of
  // them, not just pending ones — a confirmed/discarded proposal still
  // blocks deleting its message) must go first or the message delete
  // silently no-ops, leaving stale rows to accumulate across runs.
  await admin.from('mentor_proposals').delete().eq('owner_id', ownerId);
  await admin.from('mentor_messages').delete().eq('owner_id', ownerId).eq('date', today).eq('route', 'chat');

  // A long-enough thread that the composer is actively "stuck" (sticky)
  // over the last message when the proposal card renders, not just sitting
  // in normal flow below a short page.
  for (let i = 0; i < 6; i++) {
    await admin.from('mentor_messages').insert([
      { id: crypto.randomUUID(), owner_id: ownerId, date: today, route: 'chat', role: 'user', content: `Padding question ${i}`, state_at_time: null, usage_id: null },
      { id: crypto.randomUUID(), owner_id: ownerId, date: today, route: 'chat', role: 'assistant', content: `Padding reply ${i} with enough text to take up a full line or two of the thread so the page actually scrolls.`, state_at_time: null, usage_id: null },
    ]);
  }

  const messageId = crypto.randomUUID();
  await admin.from('mentor_messages').insert({
    id: messageId, owner_id: ownerId, date: today, route: 'chat', role: 'assistant',
    content: 'Test proposal', state_at_time: null, usage_id: null,
  });

  const { data: block } = await admin.from('blocks').select('id,start,end,title').eq('date', today).neq('title', 'Wind down').order('start', { ascending: true }).limit(1).single();
  const growBy = 30;
  const newDurationMin = block!.end - block!.start + growBy;
  await admin.from('mentor_proposals').insert({
    id: crypto.randomUUID(), owner_id: ownerId, message_id: messageId, kind: 'schedule', target: today,
    edits: [{ type: 'resize', blockId: block!.id, durationMin: newDurationMin }],
    diff: [{ blockId: block!.id, title: 'Test', change: 'shrunk', from: null, to: null, reason: 'You changed its length' }],
    conflicts: [], status: 'pending',
  });

  await page.goto('/mentor');
  const card = page.locator('.proposal-card').first();
  await expect(card).toBeVisible();

  // The real invariant: a user who just loaded the page (ChatThread's
  // mount-time auto-scroll already ran) should be able to tap Confirm right
  // where it visually sits — no manual scrolling, no guessing that more
  // content is hidden behind the sticky composer. Check the raw DOM hit
  // test at the button's own on-screen center, exactly as a real tap would.
  const confirmButton = card.getByRole('button', { name: 'Confirm' });
  const isReachable = await confirmButton.evaluate((btn) => {
    const rect = btn.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top === btn;
  });
  expect(isReachable, 'Confirm should be hit-testable at its own on-screen position without any manual scrolling').toBe(true);

  await confirmButton.click();
  await expect(card).not.toBeVisible({ timeout: 5_000 });

  const { data: updated } = await admin.from('blocks').select('end').eq('id', block!.id).single();
  expect(updated!.end).toBe(block!.start + newDurationMin);
});
