'use client';

import { usePushSubscription } from '@/lib/push/usePushSubscription';

/** Spec §9: "If no valid subscription exists, the Today screen shows a
 * persistent 'Nudges are off — tap to enable' banner." Renders nothing once
 * subscribed, or on a browser that can't do Web Push at all. */
export function NudgesBanner() {
  const { status, subscribe } = usePushSubscription();
  if (status === 'subscribed' || status === 'unsupported') return null;

  return (
    <div className="stepback" role="status">
      <p className="note">
        {status === 'denied' ? 'Nudges are off — notifications were declined in your browser settings.' : 'Nudges are off — tap to enable.'}
      </p>
      {status !== 'denied' && (
        <button className="btn btn-quiet" onClick={() => subscribe()}>
          Enable nudges
        </button>
      )}
    </div>
  );
}
