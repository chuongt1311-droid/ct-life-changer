import { describe, expect, it } from 'vitest';
import { diffVisual } from './diffVisual';

describe('diffVisual', () => {
  it('kept → kept / ok', () => {
    expect(diffVisual('kept')).toEqual({ mark: 'kept', tone: 'ok' });
  });

  it('added → kept / ok (a new block is a gain, reads like kept)', () => {
    expect(diffVisual('added')).toEqual({ mark: 'kept', tone: 'ok' });
  });

  it('moved → moved / warn', () => {
    expect(diffVisual('moved')).toEqual({ mark: 'moved', tone: 'warn' });
  });

  it('swapped → moved / warn (a recovery swap is a change, not a loss)', () => {
    expect(diffVisual('swapped')).toEqual({ mark: 'moved', tone: 'warn' });
  });

  it('shrunk → shorter / warn', () => {
    expect(diffVisual('shrunk')).toEqual({ mark: 'shorter', tone: 'warn' });
  });

  it('dropped → dropped / stop', () => {
    expect(diffVisual('dropped')).toEqual({ mark: 'dropped', tone: 'stop' });
  });

  it('missed → dropped / stop (same severity as dropped)', () => {
    expect(diffVisual('missed')).toEqual({ mark: 'dropped', tone: 'stop' });
  });

  it('skipped → dropped / warn (CT chose this — it leaves the day like a drop but is not an alarm)', () => {
    expect(diffVisual('skipped')).toEqual({ mark: 'dropped', tone: 'warn' });
  });
});
