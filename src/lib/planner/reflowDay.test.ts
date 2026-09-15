import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { previewEdits } from './reflowDay';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};

function blockRow(overrides: Partial<Record<string, unknown>> & { id: string; start: number; end: number }) {
  return {
    owner_id: 'ct', date: '2026-09-15', title: overrides.id, kind: 'task', anchor: false, priority: 3,
    min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [], recovery_variant: null,
    status: 'planned', source: 'template',
    ...overrides,
  };
}

describe('previewEdits', () => {
  it('returns the edited day and writes nothing', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      blocks: [blockRow({ id: 'deep', start: 540, end: 660 })],
    });
    const { plan, diff, errors } = await previewEdits(client, '2026-09-15', [{ type: 'drop', blockId: 'deep' }], 480);
    expect(errors).toEqual([]);
    expect(plan.blocks.find((b) => b.id === 'deep')!.status).toBe('skipped');
    expect(diff.some((d) => d.blockId === 'deep' && d.change === 'skipped')).toBe(true);
    // Nothing persisted: the stored row is still planned.
    const stored = client.tables.blocks!.find((b) => b.id === 'deep')!;
    expect(stored.status).toBe('planned');
  });

  it('reports validation errors instead of laying out an impossible day', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      blocks: [blockRow({ id: 'deep', start: 540, end: 660 })],
    });
    const { errors } = await previewEdits(client, '2026-09-15', [{ type: 'move', blockId: 'deep', toStart: 60 }], 480);
    expect(errors).toHaveLength(1);
  });

  it('surfaces conflicts from two overlapping pinned edits instead of dropping them', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      blocks: [
        blockRow({ id: 'a', start: 540, end: 640 }),
        blockRow({ id: 'b', start: 900, end: 960 }),
      ],
    });
    const { conflicts, errors } = await previewEdits(
      client,
      '2026-09-15',
      [
        { type: 'move', blockId: 'a', toStart: 700 },
        { type: 'move', blockId: 'b', toStart: 720 }, // overlaps a's new 700-800 slot
      ],
      480,
    );
    expect(errors).toEqual([]);
    expect(conflicts).toContainEqual(['a', 'b']);
  });
});
