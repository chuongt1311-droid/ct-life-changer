import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { buildMentorTools } from './tools';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

function blockRow(overrides: Partial<Record<string, unknown>> & { id: string; start: number; end: number; date: string }) {
  return {
    owner_id: 'ct', title: overrides.id, kind: 'task', anchor: false, priority: 3,
    min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null,
    status: 'planned', source: 'template',
    ...overrides,
  };
}

describe('buildMentorTools', () => {
  it('read_schedule reports what is actually planned for today', async () => {
    // Today always has a real `plans` row by the time the mentor can be
    // reached (Today's own page load guarantees it via ensureTodayPlan) —
    // seeded here so previewFuturePlan takes its 'existing' branch rather
    // than trying to generate one from a template this test doesn't seed.
    const client = fakeClient({
      settings: [settingsRow],
      plans: [{ date: '2026-09-15', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false }],
      blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })],
    });
    const { tools } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const readSchedule = tools.find((t) => t.name === 'read_schedule')!;
    const result = await readSchedule.run(readSchedule.parse({ date: '2026-09-15' }));
    expect(JSON.parse(result as string).blocks[0].title).toBe('deep');
  });

  it('propose_schedule_edit on today writes a pending proposal and returns its diff, without persisting the edit', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeScheduleEdit = tools.find((t) => t.name === 'propose_schedule_edit')!;
    await proposeScheduleEdit.run(proposeScheduleEdit.parse({ date: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: 90 }] }));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.kind).toBe('schedule');
    expect(client.tables.mentor_proposals).toHaveLength(1);
    expect(client.tables.mentor_proposals![0]!.status).toBe('pending');
    // Nothing actually applied to the real block:
    expect(client.tables.blocks!.find((b) => b.id === 'deep')!.end).toBe(600);
  });

  it('propose_schedule_edit returns validation errors instead of a proposal when the edit is impossible', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeScheduleEdit = tools.find((t) => t.name === 'propose_schedule_edit')!;
    const result = await proposeScheduleEdit.run(proposeScheduleEdit.parse({ date: '2026-09-15', edits: [{ type: 'resize', blockId: 'deep', durationMin: -5 }] }));
    expect(JSON.parse(result as string).errors).toHaveLength(1);
    expect(proposals).toHaveLength(0);
  });

  it('propose_schedule_edit rejects a malformed edit (e.g. a clock string for start) before it ever becomes a proposal', async () => {
    const client = fakeClient({ settings: [settingsRow], blocks: [blockRow({ id: 'deep', date: '2026-09-15', start: 540, end: 600 })] });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeScheduleEdit = tools.find((t) => t.name === 'propose_schedule_edit')!;
    expect(() => proposeScheduleEdit.parse({ date: '2026-09-15', edits: [{ type: 'add', id: 'x', title: 'Reading', kind: 'task', start: '18:00', durationMin: 30, priority: 3 }] })).toThrow(/Invalid edits/);
    expect(proposals).toHaveLength(0);
    expect(client.tables.mentor_proposals ?? []).toHaveLength(0);
  });

  it('propose_template_edit rejects a block with an invalid kind before it ever becomes a proposal', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [{ key: 'gym', title: 'Gym', kind: 'training', anchor: false, priority: 3, start: '18:00', durationMin: 60 }] }],
    });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeTemplateEdit = tools.find((t) => t.name === 'propose_template_edit')!;
    expect(() => proposeTemplateEdit.parse({
      weekday: 1, restDay: false,
      blocks: [{ key: 'gym', title: 'Gym', kind: 'workout', anchor: false, priority: 3, start: '18:00', durationMin: 90 }],
    })).toThrow(/Invalid template edit/);
    expect(proposals).toHaveLength(0);
    expect(client.tables.mentor_proposals ?? []).toHaveLength(0);
  });

  it('propose_template_edit writes a pending template proposal with a real diff', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [{ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [{ key: 'gym', title: 'Gym', kind: 'training', anchor: false, priority: 3, start: '18:00', durationMin: 60 }] }],
    });
    const { tools, proposals } = buildMentorTools({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const proposeTemplateEdit = tools.find((t) => t.name === 'propose_template_edit')!;
    await proposeTemplateEdit.run(proposeTemplateEdit.parse({
      weekday: 1, restDay: false,
      blocks: [{ key: 'gym', title: 'Gym', kind: 'training', anchor: false, priority: 3, start: '18:00', durationMin: 90 }],
    }));
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.kind).toBe('template');
    expect((proposals[0]!.diff as { reason: string }[])[0]!.reason).toMatch(/60 to 90/);
  });

  it('search_memory returns the retrieved text', async () => {
    vi.doMock('@/lib/memory/client', () => ({ queryMemory: vi.fn().mockResolvedValue('past pattern found'), writeMemory: vi.fn() }));
    // vi.doMock only affects imports that happen after this call, and only
    // for modules not already in the registry — the file-top
    // `import { buildMentorTools } from './tools'` was already resolved
    // (and cached, along with its import of '@/lib/memory/client') before
    // this test ran. vi.resetModules() clears that cache so the dynamic
    // re-import below re-evaluates './tools' against the mocked client.
    vi.resetModules();
    const { buildMentorTools: buildMentorToolsMocked } = await import('./tools');
    const client = fakeClient({ settings: [settingsRow] });
    const { tools } = buildMentorToolsMocked({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const searchMemory = tools.find((t) => t.name === 'search_memory')!;
    const result = await searchMemory.run(searchMemory.parse({ query: 'deep work' }));
    expect(result).toContain('past pattern found');
  });

  it('remember writes a MentorMemory with the given confidence', async () => {
    const writeMemoryMock = vi.fn().mockResolvedValue(true);
    vi.doMock('@/lib/memory/client', () => ({ queryMemory: vi.fn(), writeMemory: writeMemoryMock }));
    vi.resetModules();
    const { buildMentorTools: buildMentorToolsMocked } = await import('./tools');
    const client = fakeClient({ settings: [settingsRow] });
    const { tools } = buildMentorToolsMocked({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const remember = tools.find((t) => t.name === 'remember')!;
    const result = await remember.run(remember.parse({ text: 'CT prefers mornings for deep work', confidence: 'medium' }));
    expect(writeMemoryMock).toHaveBeenCalledWith('MentorMemory', expect.objectContaining({ text: 'CT prefers mornings for deep work', confidence: 'medium' }));
    expect(result).toBe('Saved.');
  });

  it("remember tells the mentor it couldn't save when memory-api is unreachable", async () => {
    vi.doMock('@/lib/memory/client', () => ({ queryMemory: vi.fn(), writeMemory: vi.fn().mockResolvedValue(false) }));
    vi.resetModules();
    const { buildMentorTools: buildMentorToolsMocked } = await import('./tools');
    const client = fakeClient({ settings: [settingsRow] });
    const { tools } = buildMentorToolsMocked({ client, ownerId: 'ct', messageId: 'm1', todayDate: '2026-09-15', now: new Date('2026-09-15T12:00:00Z') });
    const remember = tools.find((t) => t.name === 'remember')!;
    const result = await remember.run(remember.parse({ text: 'something', confidence: 'low' }));
    expect(result).toMatch(/couldn't save/i);
  });
});
