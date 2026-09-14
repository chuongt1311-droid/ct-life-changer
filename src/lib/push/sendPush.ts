import webpush from 'web-push';
import type { PushSubscriptionRow } from '@/lib/db/schemas';
import { getVapidConfig } from './config';

export interface PushPayload {
  title: string;
  body: string;
}

export interface SendPushResult {
  ok: boolean;
  /** True on a 404/410 — spec §12: delete the subscription, don't retry it. */
  expired: boolean;
}

/** Sends one Web Push message to one subscription. Never throws — callers
 * loop over many subscriptions and one dead one must not stop the rest. */
export async function sendPush(subscription: PushSubscriptionRow, payload: PushPayload): Promise<SendPushResult> {
  const vapid = getVapidConfig();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh ?? '', auth: subscription.keys.auth ?? '' } },
      JSON.stringify(payload),
    );
    return { ok: true, expired: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return { ok: false, expired: statusCode === 404 || statusCode === 410 };
  }
}
