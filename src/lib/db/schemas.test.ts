import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import { blockRowSchema, settingsRowSchema, templateRowSchema } from './schemas';

describe('settingsRowSchema', () => {
  it('accepts a row shaped like DEFAULT_SETTINGS', () => {
    const row = {
      id: 'singleton',
      owner_id: '00000000-0000-0000-0000-000000000000',
      timezone: DEFAULT_SETTINGS.timezone,
      wake_time: DEFAULT_SETTINGS.wakeTime,
      bedtime: DEFAULT_SETTINGS.bedtime,
      model: DEFAULT_SETTINGS.model,
      monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
      nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
      deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
      thresholds: DEFAULT_THRESHOLDS,
      crisis_contacts: [],
    };
    expect(settingsRowSchema.parse(row)).toEqual(row);
  });

  it('rejects a row missing thresholds', () => {
    const row = { id: 'singleton', owner_id: 'x', timezone: 'UTC' };
    expect(() => settingsRowSchema.parse(row)).toThrow();
  });
});

describe('templateRowSchema', () => {
  it('accepts a rest-day template with no blocks', () => {
    const row = { weekday: 5, owner_id: 'x', rest_day: true, blocks: [] };
    expect(templateRowSchema.parse(row)).toEqual(row);
  });

  it('rejects weekday out of range', () => {
    const row = { weekday: 7, owner_id: 'x', rest_day: true, blocks: [] };
    expect(() => templateRowSchema.parse(row)).toThrow();
  });
});

describe('blockRowSchema', () => {
  it('accepts a fixed anchor block', () => {
    const row = {
      id: '2026-09-15:wake',
      owner_id: 'x',
      date: '2026-09-15',
      title: 'Wake',
      kind: 'routine',
      anchor: true,
      priority: 5,
      start: 420,
      end: 450,
      min_minutes: 30,
      window_start: null,
      window_end: null,
      tags: ['morningRoutine'],
      checklist: [],
      recovery_variant: null,
      status: 'planned',
      source: 'template',
    };
    expect(blockRowSchema.parse(row)).toEqual(row);
  });

  it('rejects an unknown status', () => {
    const row = {
      id: 'x',
      owner_id: 'x',
      date: '2026-09-15',
      title: 'x',
      kind: 'task',
      anchor: false,
      priority: 3,
      start: 0,
      end: 1,
      min_minutes: 1,
      window_start: null,
      window_end: null,
      tags: [],
      checklist: [],
      recovery_variant: null,
      status: 'not-a-real-status',
      source: 'template',
    };
    expect(() => blockRowSchema.parse(row)).toThrow();
  });
});
