import { describe, expect, it } from 'vitest';
import { dayPhase } from './phase';

describe('dayPhase', () => {
  it('04:00–07:00 is first-light', () => expect(dayPhase(300)).toBe('first-light')); // 05:00
  it('07:00–17:00 is day', () => expect(dayPhase(720)).toBe('day')); // 12:00
  it('17:00–21:00 is dusk', () => expect(dayPhase(1100)).toBe('dusk')); // 18:20
  it('21:00–04:00(+1440) is night', () => expect(dayPhase(1300)).toBe('night')); // 21:40
  it('just after midnight (plan minutes ≥1440) is still night', () => expect(dayPhase(1500)).toBe('night')); // 01:00
});
