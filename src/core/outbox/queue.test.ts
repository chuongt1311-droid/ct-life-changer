import { describe, expect, it } from 'vitest';
import { enqueue, markFailed, markSynced, markSyncing, nextPending, type OutboxEntry } from './queue';

const FIXED_NOW = '2026-09-14T10:00:00.000Z';

describe('enqueue', () => {
  it('appends a new pending entry with attempts 0', () => {
    const queue = enqueue([], { id: '1', kind: 'eveningCheckin', payload: { a: 1 } }, FIXED_NOW);
    expect(queue).toEqual([{ id: '1', kind: 'eveningCheckin', payload: { a: 1 }, createdAt: FIXED_NOW, status: 'pending', attempts: 0 }]);
  });
});

describe('nextPending', () => {
  it('returns the oldest pending entry', () => {
    const queue: OutboxEntry[] = [
      { id: '1', kind: 'a', payload: null, createdAt: '2026-09-14T09:00:00.000Z', status: 'pending', attempts: 0 },
      { id: '2', kind: 'b', payload: null, createdAt: '2026-09-14T08:00:00.000Z', status: 'pending', attempts: 0 },
    ];
    expect(nextPending(queue)?.id).toBe('2');
  });

  it('skips syncing and failed entries', () => {
    const queue: OutboxEntry[] = [
      { id: '1', kind: 'a', payload: null, createdAt: FIXED_NOW, status: 'syncing', attempts: 0 },
      { id: '2', kind: 'b', payload: null, createdAt: FIXED_NOW, status: 'failed', attempts: 5 },
    ];
    expect(nextPending(queue)).toBeNull();
  });
});

describe('markSyncing / markSynced / markFailed', () => {
  const base: OutboxEntry = { id: '1', kind: 'a', payload: null, createdAt: FIXED_NOW, status: 'pending', attempts: 0 };

  it('markSyncing flips status to syncing', () => {
    expect(markSyncing([base], '1')[0]!.status).toBe('syncing');
  });

  it('markSynced removes the entry', () => {
    expect(markSynced([base], '1')).toEqual([]);
  });

  it('markFailed under the retry cap reverts to pending and increments attempts', () => {
    const syncing: OutboxEntry = { ...base, status: 'syncing', attempts: 1 };
    const result = markFailed([syncing], '1');
    expect(result[0]).toMatchObject({ status: 'pending', attempts: 2 });
  });

  it('markFailed at the retry cap (5 attempts) becomes terminally failed', () => {
    const syncing: OutboxEntry = { ...base, status: 'syncing', attempts: 5 };
    const result = markFailed([syncing], '1');
    expect(result[0]).toMatchObject({ status: 'failed', attempts: 6 });
  });
});
