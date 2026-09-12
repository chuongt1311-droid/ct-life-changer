import { describe, expect, it } from 'vitest';
import { seedSettingsRow, seedTemplateRows } from './seedData';

describe('seedSettingsRow', () => {
  it('produces the singleton settings row with an empty crisis contacts list', () => {
    const row = seedSettingsRow();
    expect(row.id).toBe('singleton');
    expect(row.timezone).toBeTypeOf('string');
    expect(row.crisis_contacts).toEqual([]);
    expect(row.thresholds.sleepLowHours).toBeGreaterThan(0);
  });
});

describe('seedTemplateRows', () => {
  const rows = seedTemplateRows();

  it('produces exactly one row per weekday (0–6)', () => {
    expect(rows.map((r) => r.weekday).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('marks Friday, Saturday and Sunday as rest days with no training block', () => {
    for (const weekday of [0, 5, 6]) {
      const row = rows.find((r) => r.weekday === weekday)!;
      expect(row.rest_day).toBe(true);
      expect(row.blocks.some((b) => b.kind === 'training')).toBe(false);
    }
  });

  it('gives Monday a push+neck training block as an anchor', () => {
    const monday = rows.find((r) => r.weekday === 1)!;
    expect(monday.rest_day).toBe(false);
    const training = monday.blocks.find((b) => b.kind === 'training')!;
    expect(training.anchor).toBe(true);
    expect(training.title.toLowerCase()).toContain('push');
  });

  it('gives every weekday a wake, sleep and meal skeleton alongside training', () => {
    for (const row of rows) {
      const kinds = row.blocks.map((b) => b.kind);
      expect(kinds).toContain('routine'); // wake / wind-down
      expect(row.blocks.some((b) => b.title.toLowerCase().includes('meal') || b.title.toLowerCase().includes('lunch'))).toBe(
        true,
      );
    }
  });
});
