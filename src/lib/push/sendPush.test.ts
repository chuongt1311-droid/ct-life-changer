import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSubscriptionRow } from '@/lib/db/schemas';

vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub');
vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
vi.stubEnv('VAPID_SUBJECT', 'mailto:ct@example.com');

// A plain (non-vi.fn) indirection — vi.fn()'s internal call-tracking on an
// async-throwing implementation creates an orphaned rejected promise that
// trips Node's unhandledRejection detector even though sendPush's own
// try/catch handles it correctly. A plain reassignable function sidesteps
// that entirely; these tests don't need call-argument assertions anyway.
let sendNotificationImpl: (...args: unknown[]) => Promise<unknown> = async () => undefined;
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: () => {},
    sendNotification: (...args: unknown[]) => sendNotificationImpl(...args),
  },
}));

const subscription: PushSubscriptionRow = {
  id: 's1',
  owner_id: 'ct',
  endpoint: 'https://push.example.com/abc',
  keys: { p256dh: 'p', auth: 'a' },
  device_label: 'iPhone',
  created_at: '2026-09-14T00:00:00Z',
};

describe('sendPush', () => {
  beforeEach(() => {
    sendNotificationImpl = async () => undefined;
  });

  it('returns ok on a successful send', async () => {
    const { sendPush } = await import('./sendPush');
    const result = await sendPush(subscription, { title: 'Hi', body: 'There' });
    expect(result).toEqual({ ok: true, expired: false });
  });

  it('flags the subscription as expired on a 410', async () => {
    sendNotificationImpl = async () => {
      throw { statusCode: 410 };
    };
    const { sendPush } = await import('./sendPush');
    const result = await sendPush(subscription, { title: 'Hi', body: 'There' });
    expect(result).toEqual({ ok: false, expired: true });
  });

  it('does not flag expired for other errors', async () => {
    sendNotificationImpl = async () => {
      throw { statusCode: 500 };
    };
    const { sendPush } = await import('./sendPush');
    const result = await sendPush(subscription, { title: 'Hi', body: 'There' });
    expect(result).toEqual({ ok: false, expired: false });
  });
});
