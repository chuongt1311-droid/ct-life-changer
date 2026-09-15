import { describe, expect, it } from 'vitest';
import { fakeClient } from '@/lib/testing/fakeClient';
import { logMentorMessage } from './logMessage';

describe('logMentorMessage', () => {
  it('generates an id when none is given', async () => {
    const client = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-15', route: 'chat', role: 'user', content: 'hi', stateAtTime: null, usageId: null });
    expect(client.tables.mentor_messages).toHaveLength(1);
    expect(client.tables.mentor_messages![0]!.id).toEqual(expect.any(String));
  });

  it('uses a caller-supplied id when given', async () => {
    const client = fakeClient();
    await logMentorMessage(client, { ownerId: 'ct', date: '2026-09-15', route: 'chat', role: 'assistant', content: 'hi back', stateAtTime: null, usageId: null, id: 'fixed-id' });
    expect(client.tables.mentor_messages![0]!.id).toBe('fixed-id');
  });
});
