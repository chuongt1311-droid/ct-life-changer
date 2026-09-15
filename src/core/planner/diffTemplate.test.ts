import { describe, expect, it } from 'vitest';
import { diffTemplate } from './diffTemplate';

const block = (over: Partial<{ key: string; title: string; kind: string; anchor: boolean; priority: number; start: string; durationMin: number }> = {}) => ({
  key: 'gym', title: 'Gym', kind: 'training' as const, anchor: false, priority: 3 as const, start: '18:00', durationMin: 60,
  ...over,
});

describe('diffTemplate', () => {
  it('reports an added block', () => {
    const diff = diffTemplate({ restDay: false, blocks: [] }, { restDay: false, blocks: [block()] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'added', reason: 'Added' });
  });

  it('reports a removed block', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block()] }, { restDay: false, blocks: [] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'removed', reason: 'Removed' });
  });

  it('reports a changed block with what changed named in the reason', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block({ durationMin: 60 })] }, { restDay: false, blocks: [block({ durationMin: 90 })] });
    expect(diff).toContainEqual({ key: 'gym', title: 'Gym', change: 'changed', reason: 'Length changed from 60 to 90 minutes' });
  });

  it('reports a rest-day flip', () => {
    const diff = diffTemplate({ restDay: false, blocks: [] }, { restDay: true, blocks: [] });
    expect(diff).toContainEqual({ key: 'restDay', title: 'Rest day', change: 'restDayChanged', reason: 'Turned on' });
  });

  it('reports nothing for an unchanged template', () => {
    const diff = diffTemplate({ restDay: false, blocks: [block()] }, { restDay: false, blocks: [block()] });
    expect(diff).toEqual([]);
  });
});
