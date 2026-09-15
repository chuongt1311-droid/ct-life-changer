import { describe, expect, it } from 'vitest';
import { checkinKindFor } from './checkinKind';

describe('checkinKindFor', () => {
  it('the early hours and the working day belong to the morning check-in', () => {
    expect(checkinKindFor(300)).toBe('morning'); // 05:00
    expect(checkinKindFor(540)).toBe('morning'); // 09:00
    expect(checkinKindFor(1019)).toBe('morning'); // 16:59
  });

  it('dusk onward belongs to the evening check-in', () => {
    expect(checkinKindFor(1020)).toBe('evening'); // 17:00
    expect(checkinKindFor(1320)).toBe('evening'); // 22:00
  });

  it('after midnight is still the evening check-in of the same plan day', () => {
    expect(checkinKindFor(1500)).toBe('evening'); // 01:00, plan minute > 1440
  });
});
