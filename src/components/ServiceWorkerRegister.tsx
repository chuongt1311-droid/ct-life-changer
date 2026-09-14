'use client';

import { useEffect } from 'react';

/** Registers public/sw.js once, client-side only — registration itself must
 * never block or fail server rendering. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Best-effort: an unregistered service worker just means no offline
        // shell cache, not a broken app.
      });
    }
  }, []);
  return null;
}
