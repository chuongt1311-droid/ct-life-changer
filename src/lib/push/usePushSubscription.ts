'use client';

import { useCallback, useEffect, useState } from 'react';
import { subscribePushAction } from '@/app/push/actions';
import { urlBase64ToUint8Array } from './base64';

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'not-subscribed';

/** Wraps the browser's PushManager. Spec §9: permission must be requested
 * from a user gesture, so `subscribe()` is only ever called from a click. */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('not-subscribed');

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setStatus(sub ? 'subscribed' : 'not-subscribed');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('denied');
      return;
    }
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.');

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // TS's lib.dom types applicationServerKey as BufferSource<ArrayBuffer>;
      // Uint8Array's buffer is typed ArrayBufferLike (may be a
      // SharedArrayBuffer), so an explicit cast is needed here even though
      // this Uint8Array is always backed by a plain ArrayBuffer at runtime.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
    const json = sub.toJSON();
    await subscribePushAction({
      endpoint: json.endpoint!,
      keys: (json.keys ?? {}) as Record<string, string>,
      deviceLabel: navigator.userAgent,
    });
    setStatus('subscribed');
  }, []);

  return { status, subscribe };
}
