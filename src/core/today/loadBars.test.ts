import { describe, expect, it } from 'vitest';
import type { Block, DaySummary, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { computeLoadBars } from './loadBars';

function block(overrides: Partial<Block> & Pick<Block, 'id' | 'kind' | 'status'>): Block {
  return {
    title: 'x', anchor: false, priority: 3, start: 480, end: 540, minMinutes: 30,
    window: null, tags: [], checklist: [], recoveryVariant: null, source: 'template',
    ...overrides,
  };
}

function summary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    date: '2026-09-14', sleepHours: null, morningEnergy: null, stress: null, deepWorkMin: null,
    restSessionsTaken: 0, trainedOnRestDay: false, unplannedIndulgenceMin: null, anchorsTotal: 0, anchorsSkipped: 0,
    ...overrides,
  };
}

const SETTINGS: Settings = DEFAULT_SETTINGS;

describe('computeLoadBars', () => {
  it('Body: counts training blocks done vs total', () => {
    const bars = computeLoadBars({
      blocks: [block({ id: '1', kind: 'training', status: 'done' }), block({ id: '2', kind: 'training', status: 'planned' })],
      today: summary(),
      settings: SETTINGS,
    });
    expect(bars[0]).toMatchObject({ name: 'Body', valueText: '1 of 2 sessions', percent: 50, read: 'ok' });
  });

  it('Body: no training blocks today reads ok at 100%', () => {
    const bars = computeLoadBars({ blocks: [], today: summary(), settings: SETTINGS });
    expect(bars[0]).toMatchObject({ valueText: '0 of 0 sessions', percent: 100, read: 'ok' });
  });

  it('Work & growth: over the deep-work cap reads over', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ deepWorkMin: 400 }), settings: SETTINGS });
    expect(bars[1]).toMatchObject({ name: 'Work & growth', read: 'over' });
  });

  it('Work & growth: under 80% of cap reads ok', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ deepWorkMin: 100 }), settings: SETTINGS });
    expect(bars[1]).toMatchObject({ read: 'ok' });
  });

  it('Screen & pleasure: over the indulge-high threshold reads over', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ unplannedIndulgenceMin: 150 }), settings: SETTINGS });
    expect(bars[2]).toMatchObject({ name: 'Screen time', read: 'over' });
  });

  it('Rest: sessions taken vs rest blocks planned today', () => {
    const bars = computeLoadBars({
      blocks: [block({ id: '1', kind: 'rest', status: 'planned' }), block({ id: '2', kind: 'rest', status: 'planned' })],
      today: summary({ restSessionsTaken: 1 }),
      settings: SETTINGS,
    });
    expect(bars[3]).toMatchObject({ name: 'Rest & reflection', valueText: '1 of 2 rest sessions', percent: 50 });
  });
});
