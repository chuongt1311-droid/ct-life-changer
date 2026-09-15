import { test, expect } from '@playwright/test';
import { createAdminSupabase } from '../src/lib/supabase/admin';

test('confirming a mentor proposal actually changes the schedule', async ({ page }) => {
  const admin = createAdminSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const ownerEmail = process.env.OWNER_EMAIL!;
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const ownerId = usersPage!.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase())!.id;

  const messageId = crypto.randomUUID();
  await admin.from('mentor_messages').insert({
    id: messageId, owner_id: ownerId, date: today, route: 'chat', role: 'assistant',
    content: 'Test proposal', state_at_time: null, usage_id: null,
  });

  const { data: block } = await admin.from('blocks').select('id,start,end').eq('date', today).limit(1).single();
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
  await card.getByRole('button', { name: 'Confirm' }).click();
  await expect(card).not.toBeVisible({ timeout: 10_000 });

  const { data: updated } = await admin.from('blocks').select('end').eq('id', block!.id).single();
  expect(updated!.end).toBe(block!.start + newDurationMin);
});
