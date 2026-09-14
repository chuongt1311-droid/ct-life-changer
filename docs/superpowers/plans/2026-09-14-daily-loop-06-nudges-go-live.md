# Nudges & Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Web Push nudges driven by a Supabase `pg_cron` + `pg_net` minute tick against a new `/api/cron/tick` route, close the two spec §12 retry gaps (Monday weekly-review fallback, evening-digest retry), add the "Nudges are off" banner, stand up a minimal Playwright E2E suite, and hand CT the final go-live checklist — the last plan of the Daily Loop roadmap.

**Architecture:** The pure nudge scheduler (`dueNudges`, Plan 1) is unchanged. Plan 6 adds the I/O shell around it: a data-assembly layer that turns DB rows into `NudgeInput`, a `web-push`-based sender, and a single `runCronTick` orchestrator that the new `/api/cron/tick` route calls once a minute (driven by Supabase's own `pg_cron`/`pg_net`, not Vercel's cron feature — see the Vercel Hobby finding below). Client-side, a small hook wraps the browser's `PushManager` and a banner on Today surfaces it. A minimal Playwright suite authenticates via a secret-gated test-login route (never active without an env var CT never sets in production) instead of touching the real magic-link flow.

**Tech Stack:** Next.js Route Handlers, `web-push` (new dependency), Supabase `pg_cron` + `pg_net` (SQL, run by CT), Playwright (new dependency, E2E only).

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md) — §9 Nudges, §10 Data model, §11 Privacy/safety, §12 Error handling, §13 Testing, §15 To verify.

## Facts verified during planning (spec §15)

- **`pg_cron` + `pg_net` on Supabase's free tier:** both extensions ship enabled on every Supabase project, free tier included ([supabase.com/modules/cron](https://supabase.com/modules/cron), [GitHub discussion #37405](https://github.com/orgs/supabase/discussions/37405)). No paid add-on needed. A free-tier project auto-pauses after a week with zero API activity; a once-a-minute `pg_net` call from inside the database counts as activity, so the schedule itself should keep the project awake — CT should still watch for a pause notice the first week.
- **Vercel Hobby cron limits — and why they don't apply here:** Hobby accounts cap *Vercel's own* Cron Jobs feature at once a day ([Vercel docs](https://vercel.com/docs/cron-jobs/usage-and-pricing), [runhooks.app](https://runhooks.app/blog/vercel-hobby-cron-job-limits-explained/)). This plan never uses that feature — the spec's design has Supabase's `pg_cron` (running inside Postgres) call out via `pg_net` to `/api/cron/tick` as a plain HTTPS request, exactly like any other API call the app receives. Vercel has no per-minute restriction on ordinary function invocations, only on its own scheduler UI. No Vercel plan change is needed.
- **iOS Web Push:** works on iOS/iPadOS 16.4+ for a PWA installed to the Home Screen, HTTPS required, and the permission prompt must fire from a user gesture (tap) — confirmed current as of 2026 ([pushpad.xyz](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [magicbell.com](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)). One EU-specific caveat: since iOS 17.4, Apple's DMA compliance change means PWAs installed in EU countries open inside Safari tabs with no push support at all. If CT is in the EU this whole feature is inert on iPhone regardless of code — worth a one-time check before relying on it (the go-live checklist below covers this).
- **Anthropic pricing:** already verified in Plan 4 (`src/core/mentor/cost.ts`). Not re-checked here.

## Global Constraints

- `src/core/**` stays pure: no I/O, no clock, no randomness. Tests are colocated.
- `npm test` and `npm run typecheck` must pass before every commit.
- Write "CT" or "they" — pronouns are unstated.
- No shame language, no streaks, anywhere — nudge copy and the "Nudges are off" banner included.
- Attributes/badges never fall; rest earns, grinding while depleted earns nothing — no nudge copy may contradict this.
- Claude never sees or types secrets: VAPID keys, `CRON_SECRET`, `E2E_AUTH_SECRET`, `ANTHROPIC_API_KEY`. CT pastes these into `.env.local` and Vercel themselves.
- Claude never runs SQL against CT's live Supabase project. Migrations are written to `supabase/migrations/`; CT applies them (matching Plan 3's existing convention).
- After this plan: `graphify update .` runs, and per the roadmap's closing line, week 1 of the 4-week success trial starts (spec §2). This is the last plan of the Daily Loop roadmap.

---

### Task 1: VAPID and cron config

**Files:**
- Modify: `package.json` (add `web-push` dependency, `@types/web-push` devDependency)
- Modify: `.env.example`
- Create: `src/lib/push/config.ts`
- Test: `src/lib/push/config.test.ts`

**Interfaces:**
- Produces: `getVapidConfig(): { publicKey: string; privateKey: string; subject: string }`, throwing when any of `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` is missing.

- [ ] **Step 1: Install dependencies**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 2: Add the new env vars to `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=
```

CT generates the VAPID key pair themselves — Claude never runs this or sees the output:

```bash
npx web-push generate-vapid-keys
```

The public key goes in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (it's meant to be public, and the `NEXT_PUBLIC_` prefix is what lets the browser read it for `PushManager.subscribe`). The private key and `CRON_SECRET` (any long random string CT picks) stay server-only. All four go into `.env.local` locally and into Vercel's env var settings for production.

- [ ] **Step 3: Write the failing test**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVapidConfig } from './config';

describe('getVapidConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('throws a helpful error when a var is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '');
    vi.stubEnv('VAPID_PRIVATE_KEY', '');
    vi.stubEnv('VAPID_SUBJECT', '');
    expect(() => getVapidConfig()).toThrow(/VAPID_PUBLIC_KEY/);
  });

  it('returns the three values when all are set', () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub');
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
    vi.stubEnv('VAPID_SUBJECT', 'mailto:ct@example.com');
    expect(getVapidConfig()).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ct@example.com' });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- config.test.ts`
Expected: FAIL — `getVapidConfig` is not defined.

- [ ] **Step 5: Write the implementation**

```typescript
export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Reads the VAPID key pair CT generated with `npx web-push generate-vapid-keys`
 * and pasted into .env.local/Vercel — Claude never sees the real values. */
export function getVapidConfig(): VapidConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error('Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT — set them in .env.local.');
  }
  return { publicKey, privateKey, subject };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- config.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/push/config.ts src/lib/push/config.test.ts
git commit -m "feat(push): add web-push dependency and VAPID/cron env config"
```

---

### Task 2: Pure missed-days-in-a-row math

**Files:**
- Create: `src/core/nudges/missedDays.ts`
- Test: `src/core/nudges/missedDays.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DayCheckinStatus { date: string; hadCheckin: boolean }`, `countTrailingMisses(days: DayCheckinStatus[]): number`, `welcomeBackAlreadySent(sentWelcomeBackDates: string[], droughtStartDate: string): boolean`. Both pure, used by Task 9's lib assembly to fill `NudgeInput.missedDaysInARow` / `.welcomeBackSent`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { countTrailingMisses, welcomeBackAlreadySent, type DayCheckinStatus } from './missedDays';

describe('countTrailingMisses', () => {
  it('is 0 for an empty history', () => {
    expect(countTrailingMisses([])).toBe(0);
  });

  it('is 0 when the most recent day had a check-in', () => {
    const days: DayCheckinStatus[] = [
      { date: '2026-09-10', hadCheckin: false },
      { date: '2026-09-11', hadCheckin: true },
    ];
    expect(countTrailingMisses(days)).toBe(0);
  });

  it('counts only the trailing run of missed days', () => {
    const days: DayCheckinStatus[] = [
      { date: '2026-09-09', hadCheckin: false },
      { date: '2026-09-10', hadCheckin: true },
      { date: '2026-09-11', hadCheckin: false },
      { date: '2026-09-12', hadCheckin: false },
      { date: '2026-09-13', hadCheckin: false },
    ];
    expect(countTrailingMisses(days)).toBe(3);
  });
});

describe('welcomeBackAlreadySent', () => {
  it('is false when no welcome-back nudge has gone out since the drought began', () => {
    expect(welcomeBackAlreadySent(['2026-09-01'], '2026-09-10')).toBe(false);
  });

  it('is true once a welcome-back nudge was sent on or after the drought start', () => {
    expect(welcomeBackAlreadySent(['2026-09-01', '2026-09-11'], '2026-09-10')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- missedDays.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
export interface DayCheckinStatus {
  date: string;
  /** True if a morning or evening checkin row exists for this date. */
  hadCheckin: boolean;
}

/** Spec §5.9: "after 2 consecutive days with no check-in". `days` must be
 * sorted ascending by date, ending the day before "today". Counts only the
 * trailing run of misses — a check-in anywhere breaks the streak. */
export function countTrailingMisses(days: DayCheckinStatus[]): number {
  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.hadCheckin) break;
    count++;
  }
  return count;
}

/** Spec §9: welcome-back fires "once", then nothing more until CT returns.
 * True once a welcome-back nudge has already gone out on or after the day
 * the current drought began (the day after CT's last check-in). */
export function welcomeBackAlreadySent(sentWelcomeBackDates: string[], droughtStartDate: string): boolean {
  return sentWelcomeBackDates.some((d) => d >= droughtStartDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- missedDays.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/nudges/missedDays.ts src/core/nudges/missedDays.test.ts
git commit -m "feat(nudges): pure missed-days-in-a-row and welcome-back-sent helpers"
```

---

### Task 3: Server-side push sender

**Files:**
- Create: `src/lib/push/sendPush.ts`
- Test: `src/lib/push/sendPush.test.ts`

**Interfaces:**
- Consumes: `getVapidConfig` (Task 1), `PushSubscriptionRow` (existing, `src/lib/db/schemas.ts`).
- Produces: `PushPayload { title: string; body: string }`, `SendPushResult { ok: boolean; expired: boolean }`, `sendPush(subscription: PushSubscriptionRow, payload: PushPayload): Promise<SendPushResult>`. Used by Task 10's cron orchestrator (injected as a parameter, not imported directly, so tests can fake it).

- [ ] **Step 1: Write the failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- sendPush.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- sendPush.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/sendPush.ts src/lib/push/sendPush.test.ts
git commit -m "feat(push): web-push sender with 410/404 expiry detection"
```

---

### Task 4: Push subscription persistence

**Files:**
- Create: `src/app/push/actions.ts`

**Interfaces:**
- Consumes: `repositories(client).pushSubscriptions` (existing).
- Produces: `SubscribePushInput { endpoint: string; keys: Record<string, string>; deviceLabel: string }`, `subscribePushAction(input: SubscribePushInput): Promise<void>`, `unsubscribePushAction(endpoint: string): Promise<void>`, `hasPushSubscriptionAction(): Promise<boolean>`. Consumed by Task 5's client hook.

No new pure logic here (auth + a DB read/write), so no colocated unit test — this follows the same pattern as Plan 5's other `'use server'` action files (e.g. `src/app/reentry/actions.ts`), which aren't unit tested either; they're exercised through `npm run build` and manual verification.

- [ ] **Step 1: Write the actions**

```typescript
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface SubscribePushInput {
  endpoint: string;
  keys: Record<string, string>;
  deviceLabel: string;
}

/** Upserts by endpoint (not by a fresh id) so re-subscribing the same device
 * — the browser calling PushManager.subscribe() again — updates the existing
 * row instead of colliding with the table's unique constraint on endpoint. */
export async function subscribePushAction(input: SubscribePushInput): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const existing = (await repos.pushSubscriptions.list({ owner_id: user.id } as never)).find((s) => s.endpoint === input.endpoint);

  await repos.pushSubscriptions.upsert({
    id: existing?.id ?? crypto.randomUUID(),
    owner_id: user.id,
    endpoint: input.endpoint,
    keys: input.keys,
    device_label: input.deviceLabel,
    created_at: existing?.created_at ?? new Date().toISOString(),
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const existing = (await repos.pushSubscriptions.list({ owner_id: user.id } as never)).find((s) => s.endpoint === endpoint);
  if (existing) await repos.pushSubscriptions.remove(existing.id);
}

export async function hasPushSubscriptionAction(): Promise<boolean> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const client = supabase as unknown as RepositoryClient;
  const subs = await repositories(client).pushSubscriptions.list({ owner_id: user.id } as never);
  return subs.length > 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/push/actions.ts
git commit -m "feat(push): server actions to subscribe/unsubscribe/check push"
```

---

### Task 5: Client subscribe flow + service worker push handling

**Files:**
- Create: `src/lib/push/base64.ts`
- Test: `src/lib/push/base64.test.ts`
- Create: `src/lib/push/usePushSubscription.ts`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `subscribePushAction` (Task 4), `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (Task 1).
- Produces: `urlBase64ToUint8Array(base64: string): Uint8Array` (pure), `usePushSubscription(): { status: PushStatus; subscribe: () => Promise<void> }` where `PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'not-subscribed'`. Consumed by Task 6's banner and Settings addition.

`urlBase64ToUint8Array` is pure but lives here (not `src/core/`) — it's a browser Push API encoding detail, not Daily Loop domain logic like the planner/guard/progression modules `src/core/` is reserved for. It still gets a real test since it's pure and trivial to test.

The hook itself is a `'use client'` React hook wrapping `Notification`/`navigator.serviceWorker`/`PushManager` — none of Plan 5's client hooks (`useOutbox`, `useCrisisCheck`) have unit tests either (`vitest.config.ts` runs `environment: 'node'` with no jsdom, and includes only `*.test.ts`, not `.tsx`), so this follows the same established precedent: verified by typecheck, build, and manual testing on CT's iPhone (go-live checklist, Task 15).

- [ ] **Step 1: Write the failing test for the pure helper**

```typescript
import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './base64';

describe('urlBase64ToUint8Array', () => {
  it('decodes a URL-safe base64 VAPID key into bytes', () => {
    // "AAECAw" (URL-safe base64) decodes to bytes [0, 1, 2, 3]
    expect(Array.from(urlBase64ToUint8Array('AAECAw'))).toEqual([0, 1, 2, 3]);
  });

  it('pads correctly when the input length is not a multiple of 4', () => {
    // "AA" (2 chars) needs 2 padding chars to decode to a single zero byte
    expect(Array.from(urlBase64ToUint8Array('AA'))).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- base64.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
/** Converts a URL-safe base64 VAPID public key (as `web-push generate-vapid-keys`
 * prints it) into the Uint8Array PushManager.subscribe's applicationServerKey wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- base64.test.ts`
Expected: PASS

- [ ] **Step 5: Write the client hook**

```typescript
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
```

- [ ] **Step 6: Add push handling to the service worker**

Modify `public/sw.js` — add these two listeners after the existing `fetch` listener:

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icon', badge: '/icon' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      const existing = clientList.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    }),
  );
});
```

- [ ] **Step 7: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/push/base64.ts src/lib/push/base64.test.ts src/lib/push/usePushSubscription.ts public/sw.js
git commit -m "feat(push): client subscribe flow and service worker push handling"
```

---

### Task 6: "Nudges are off" banner and Settings control

**Files:**
- Create: `src/components/today/NudgesBanner.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/settings/SettingsForm.tsx`

**Interfaces:**
- Consumes: `usePushSubscription` (Task 5).
- Produces: `<NudgesBanner />`, rendered on Today; a "Push notifications" section in Settings.

No unit test — a presentational client component, same precedent as Task 5.

- [ ] **Step 1: Write the banner**

```tsx
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
```

- [ ] **Step 2: Render it on Today**

In `src/app/page.tsx`, add the import alongside the other component imports:

```typescript
import { NudgesBanner } from '@/components/today/NudgesBanner';
```

Add `<NudgesBanner />` immediately after the `<PlayerCardStrip card={card} />` line (before the `<div className="stepback desk">` block).

- [ ] **Step 3: Add a push control to Settings**

In `src/app/settings/SettingsForm.tsx`, add the import:

```typescript
import { usePushSubscription } from '@/lib/push/usePushSubscription';
```

Inside the component, after the existing `useState` calls, add:

```typescript
const push = usePushSubscription();
```

Add a new section right after the `<Placard>Account</Placard>` block:

```tsx
<Placard>Nudges</Placard>
<p className="note">
  {push.status === 'subscribed' && 'Push notifications are on for this device.'}
  {push.status === 'not-subscribed' && 'Push notifications are off for this device.'}
  {push.status === 'denied' && 'Notifications were declined in your browser settings.'}
  {push.status === 'unsupported' && "This browser doesn't support push notifications."}
</p>
{push.status === 'not-subscribed' && (
  <button className="btn btn-quiet" onClick={() => push.subscribe()}>
    Enable push notifications
  </button>
)}
```

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: no errors; `/` and `/settings` still build.

- [ ] **Step 5: Commit**

```bash
git add src/components/today/NudgesBanner.tsx src/app/page.tsx src/app/settings/SettingsForm.tsx
git commit -m "feat(push): 'Nudges are off' banner on Today and a Settings control"
```

---

### Task 7: Nudge dedup key and digest retry columns

**Files:**
- Modify: `src/lib/db/schemas.ts`
- Modify: `src/app/checkin/evening/actions.ts`
- Create: `supabase/migrations/0002_nudges_and_digest_retry.sql`

**Interfaces:**
- Produces: `NudgeSentRow` gains `key: string` (the exact `Nudge.key` from `dueNudges`, e.g. `"2026-09-14:transition:deep"` — used verbatim as the dedup token instead of reconstructing it from `type`/`block_id`, since rest nudges key off the rest-session id, not the block id). `DigestRow.text` becomes `string | null`; gains `attempts: number`. Consumed by Task 9 (`assembleNudgeInput` reads `key`) and Task 10 (`runCronTick` reads/writes `text`/`attempts`).

This is a schema + migration change with one existing call site to update, not new business logic — no colocated unit test for the migration itself, but the existing evening-checkin test suite (run in Step 4) must still pass with the new shape.

- [ ] **Step 1: Update the row schemas**

In `src/lib/db/schemas.ts`, change `nudgeSentRowSchema` (currently at line 185):

```typescript
export const nudgeSentRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  type: z.string(),
  block_id: z.string().nullable(),
  key: z.string(),
  sent_at: z.string(),
  acked_at: z.string().nullable(),
});
export type NudgeSentRow = z.infer<typeof nudgeSentRowSchema>;
```

And `digestRowSchema` (currently at line 148):

```typescript
export const digestRowSchema = z.object({
  date: z.string(),
  owner_id: z.string(),
  text: z.string().nullable(),
  attempts: z.number(),
});
export type DigestRow = z.infer<typeof digestRowSchema>;
```

- [ ] **Step 2: Update the one existing digest write site**

In `src/app/checkin/evening/actions.ts`, replace:

```typescript
  if (!review.fallback) {
    await repos.digests.upsert({ date: planDate, owner_id: user.id, text: review.digest });
  }
```

with (always record the attempt, so the cron tick can find and retry a failed one):

```typescript
  await repos.digests.upsert({
    date: planDate,
    owner_id: user.id,
    text: review.fallback ? null : review.digest,
    attempts: 1,
  });
```

- [ ] **Step 3: Write the migration**

```sql
-- Plan 6: nudge dedup key and digest retry tracking, plus the pg_cron
-- schedule that drives /api/cron/tick every minute.
--
-- Run this file against your Supabase project's SQL editor yourself —
-- Claude never runs SQL against a live Supabase project.

alter table nudges_sent add column if not exists key text;
update nudges_sent set key = date || ':' || type || ':' || coalesce(block_id, '-') where key is null;
alter table nudges_sent alter column key set not null;
create unique index if not exists nudges_sent_key_idx on nudges_sent (key);

alter table digests alter column text drop not null;
alter table digests add column if not exists attempts integer not null default 0;
```

- [ ] **Step 4: Run typecheck and fix the one call site it surfaces**

Run: `npm run typecheck`

`digestRowSchema.text` becoming `string | null` breaks one existing caller: `src/lib/mentor/assembleContext.ts` maps `digestRows` straight into `MentorContextInput['digests']`, which expects `text: string`. A digest row with a null text is a failed generation attempt awaiting the cron tick's retry (Task 10) — nothing worth sending Claude, so filter it out rather than loosen the core type:

```typescript
    // A digest row can now have a null text (a failed generation attempt
    // awaiting the cron tick's retry, Plan 6) — nothing worth sending Claude.
    digests: digestRows.filter((d) => d.text !== null).map((d) => ({ date: d.date, text: d.text as string })),
```

This replaces the previous `digests: digestRows.map((d) => ({ date: d.date, text: d.text })),` line.

- [ ] **Step 5: Run the full test suite and typecheck again**

Run: `npm test && npm run typecheck`
Expected: all existing tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schemas.ts src/app/checkin/evening/actions.ts src/lib/mentor/assembleContext.ts supabase/migrations/0002_nudges_and_digest_retry.sql
git commit -m "feat(db): nudges_sent dedup key and digests retry tracking"
```

---

### Task 8: Shared block-row mapping helper

**Files:**
- Create: `src/lib/db/blockMapping.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `blockRowToCore(row: BlockRow): Block` — the exact mapping already inlined in `src/app/page.tsx`'s `computeLoadBars` call, extracted so Task 9's nudge assembly can reuse it instead of re-deriving it.

- [ ] **Step 1: Extract the helper**

```typescript
import type { Block } from '@/core/types';
import type { BlockRow } from './schemas';

/** DB row → core `Block`. Extracted from the Today page (Plan 5) so the
 * nudge-assembly layer (Plan 6) can reuse the exact same mapping. */
export function blockRowToCore(row: BlockRow): Block {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    anchor: row.anchor,
    priority: row.priority,
    start: row.start,
    end: row.end,
    minMinutes: row.min_minutes,
    window: row.window_start !== null && row.window_end !== null ? { earliestStart: row.window_start, latestEnd: row.window_end } : null,
    tags: row.tags,
    checklist: row.checklist,
    recoveryVariant: row.recovery_variant,
    status: row.status,
    source: row.source,
  };
}
```

- [ ] **Step 2: Use it in `src/app/page.tsx`**

Add the import:

```typescript
import { blockRowToCore } from '@/lib/db/blockMapping';
```

Replace the inline mapping inside the `computeLoadBars` call:

```typescript
    blocks: blocks.map((b) => ({
      id: b.id, title: b.title, kind: b.kind, anchor: b.anchor, priority: b.priority, start: b.start, end: b.end,
      minMinutes: b.min_minutes, window: b.window_start !== null && b.window_end !== null ? { earliestStart: b.window_start, latestEnd: b.window_end } : null,
      tags: b.tags, checklist: b.checklist, recoveryVariant: b.recovery_variant, status: b.status, source: b.source,
    })),
```

with:

```typescript
    blocks: blocks.map(blockRowToCore),
```

- [ ] **Step 3: Run tests, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; the Today page renders identically (pure refactor, same field mapping).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/blockMapping.ts src/app/page.tsx
git commit -m "refactor(db): extract blockRowToCore, reuse on Today and in nudge assembly"
```

---

### Task 9: Nudge input assembly

**Files:**
- Create: `src/lib/testing/fakeClient.ts`
- Create: `src/lib/nudges/missedDaysStatus.ts`
- Create: `src/lib/nudges/assembleNudgeInput.ts`
- Test: `src/lib/nudges/assembleNudgeInput.test.ts`

**Interfaces:**
- Consumes: `countTrailingMisses`, `welcomeBackAlreadySent` (Task 2), `blockRowToCore` (Task 8), `repositories` (existing), `NudgeInput`/`RestSessionInfo` (existing, `src/core/nudges/dueNudges.ts`), `addDays`/`toPlanMinute` (existing, `src/core/time.ts`).
- Produces: `fakeClient(seed): RepositoryClient & { tables: Record<string, Record<string, unknown>[]> }` (shared test double, reused by Task 10's cron-tick test), `missedDaysStatus(client, ownerId, planDate): Promise<{ missedDaysInARow: number; welcomeBackSent: boolean }>`, `assembleNudgeInput(client, ownerId, planDate, minute, settings, plan, blockRows): Promise<NudgeInput>`. Consumed by Task 10's `runCronTick`.

- [ ] **Step 1: Write the shared fake client**

This is test infrastructure (no behavior of its own to assert on directly), matching the multi-table fake pattern already used ad hoc in `src/lib/mentor/assembleContext.test.ts` and `src/lib/db/repository.test.ts`, generalized here so later tests don't re-write it:

```typescript
import type { RepositoryClient } from '@/lib/db/repository';

/** Primary key per table — mirrors supabase/migrations/0001_init.sql and
 * 0002_nudges_and_digest_retry.sql. Used only to make upsert() replace an
 * existing row instead of appending a duplicate, the way a real Postgres
 * upsert-by-primary-key would. */
const PRIMARY_KEY: Record<string, string> = {
  settings: 'id',
  templates: 'weekday',
  plans: 'date',
  blocks: 'id',
  checkins: 'id',
  rest_sessions: 'id',
  unplanned_indulgence: 'id',
  mentor_messages: 'id',
  digests: 'date',
  weekly_letters: 'week_start',
  profile_versions: 'id',
  push_subscriptions: 'id',
  nudges_sent: 'id',
  usage: 'id',
};

/** A minimal in-memory stand-in for the Supabase query builder slice
 * `RepositoryClient` needs, seeded per table. Exposes `tables` so a test can
 * assert on what got written. */
export function fakeClient(seed: Partial<Record<string, Record<string, unknown>[]>> = {}): RepositoryClient & { tables: Record<string, Record<string, unknown>[]> } {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const [table, rows] of Object.entries(seed)) tables[table] = [...(rows ?? [])];

  return {
    tables,
    from: (table: string) => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: (tables[table] ?? []).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v)),
          error: null,
        }),
        eq: (col: string, value: unknown) => ({
          maybeSingle: async () => ({ data: (tables[table] ?? []).find((r) => r[col] === value) ?? null, error: null }),
        }),
      }),
      upsert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const key = PRIMARY_KEY[table] ?? 'id';
            const rows = (tables[table] ??= []);
            const i = rows.findIndex((r) => r[key] === row[key]);
            if (i >= 0) rows[i] = row;
            else rows.push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async (col: string, value: unknown) => {
          const rows = (tables[table] ??= []);
          const i = rows.findIndex((r) => r[col] === value);
          if (i >= 0) rows.splice(i, 1);
          return { error: null };
        },
      }),
    }),
  };
}
```

- [ ] **Step 2: Write `missedDaysStatus`**

```typescript
import { addDays } from '@/core/time';
import { countTrailingMisses, welcomeBackAlreadySent, type DayCheckinStatus } from '@/core/nudges/missedDays';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

const LOOKBACK_DAYS = 30;

/** Derives spec §9's missedDaysInARow/welcomeBackSent from existing
 * checkins/nudges_sent rows — no new mutable counter table. */
export async function missedDaysStatus(
  client: RepositoryClient,
  ownerId: string,
  planDate: string,
): Promise<{ missedDaysInARow: number; welcomeBackSent: boolean }> {
  const repos = repositories(client);
  const checkins = await repos.checkins.list({ owner_id: ownerId } as never);
  const checkinDates = new Set(checkins.map((c) => c.date));

  const fromDate = addDays(planDate, -LOOKBACK_DAYS);
  const toDate = addDays(planDate, -1);
  const days: DayCheckinStatus[] = [];
  for (let d = fromDate; d <= toDate; d = addDays(d, 1)) {
    days.push({ date: d, hadCheckin: checkinDates.has(d) });
  }
  const missedDaysInARow = countTrailingMisses(days);

  const lastCheckinDate = [...checkinDates].sort().at(-1) ?? null;
  const droughtStart = lastCheckinDate ? addDays(lastCheckinDate, 1) : fromDate;
  const welcomeBackRows = await repos.nudgesSent.list({ owner_id: ownerId, type: 'welcomeBack' } as never);
  const welcomeBackSent = welcomeBackAlreadySent(
    welcomeBackRows.map((r) => r.date),
    droughtStart,
  );

  return { missedDaysInARow, welcomeBackSent };
}
```

- [ ] **Step 3: Write the failing test for `assembleNudgeInput`**

```typescript
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { assembleNudgeInput } from './assembleNudgeInput';
import type { PlanRow, BlockRow } from '@/lib/db/schemas';

const plan: PlanRow = { date: '2026-09-14', owner_id: 'ct', state: 'ready', flags: [], adjustments: [], overridden: false };
const block: BlockRow = {
  id: 'deep', owner_id: 'ct', date: '2026-09-14', title: 'Deep work', kind: 'task', anchor: false, priority: 3,
  start: 540, end: 660, min_minutes: 30, window_start: null, window_end: null, tags: [], checklist: [],
  recovery_variant: null, status: 'planned', source: 'template',
};

describe('assembleNudgeInput', () => {
  it('builds a NudgeInput from DB rows, mapping rest sessions to their block end', async () => {
    const client = fakeClient({
      // A check-in the day before planDate keeps missedDaysInARow at 0 —
      // otherwise every lookback day defaults to "missed" and the trailing
      // count would be the full 30-day window, not 0.
      checkins: [{ id: 'c0', owner_id: 'ct', date: '2026-09-13', type: 'evening', sections: {}, private_keys: [], created_at: '2026-09-13T21:00:00Z' }],
      nudges_sent: [{ id: 'n1', owner_id: 'ct', date: '2026-09-14', type: 'morning', block_id: null, key: '2026-09-14:morning:-', sent_at: '2026-09-14T07:00:00Z', acked_at: null }],
      rest_sessions: [{ id: 'r1', owner_id: 'ct', date: '2026-09-14', block_id: 'deep', activity: 'walk', planned: true, started_at: '2026-09-14T09:00:00Z', ended_at: null, reentry_ack_at: null }],
    });

    const input = await assembleNudgeInput(client, 'ct', '2026-09-14', 665, DEFAULT_SETTINGS, plan, [block]);

    expect(input.plan.date).toBe('2026-09-14');
    expect(input.plan.blocks).toHaveLength(1);
    expect(input.now).toBe(665);
    expect(input.sentKeys).toEqual(['2026-09-14:morning:-']);
    expect(input.restSessions).toEqual([{ id: 'r1', blockId: 'deep', plannedEnd: 660, closed: false }]);
    expect(input.missedDaysInARow).toBe(0);
    expect(input.welcomeBackSent).toBe(false);
  });

  it('drops rest sessions with no matching block', async () => {
    const client = fakeClient({
      rest_sessions: [{ id: 'r2', owner_id: 'ct', date: '2026-09-14', block_id: 'missing', activity: 'walk', planned: false, started_at: '2026-09-14T09:00:00Z', ended_at: null, reentry_ack_at: null }],
    });
    const input = await assembleNudgeInput(client, 'ct', '2026-09-14', 665, DEFAULT_SETTINGS, plan, [block]);
    expect(input.restSessions).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- assembleNudgeInput.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5: Write the implementation**

```typescript
import { toPlanMinute } from '@/core/time';
import type { DayPlan, Settings } from '@/core/types';
import type { NudgeInput, RestSessionInfo } from '@/core/nudges/dueNudges';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { BlockRow, PlanRow } from '@/lib/db/schemas';
import { blockRowToCore } from '@/lib/db/blockMapping';
import { missedDaysStatus } from './missedDaysStatus';

/** Turns today's DB rows into the pure `dueNudges`' input shape. */
export async function assembleNudgeInput(
  client: RepositoryClient,
  ownerId: string,
  planDate: string,
  minute: number,
  settings: Settings,
  plan: PlanRow,
  blockRows: BlockRow[],
): Promise<NudgeInput> {
  const repos = repositories(client);
  const blocks = blockRows.map(blockRowToCore);
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  const restSessionRows = await repos.restSessions.list({ owner_id: ownerId, date: planDate } as never);
  const restSessions: RestSessionInfo[] = restSessionRows
    .filter((r) => r.block_id !== null && blockById.has(r.block_id))
    .map((r) => ({
      id: r.id,
      blockId: r.block_id,
      plannedEnd: blockById.get(r.block_id!)!.end,
      closed: r.reentry_ack_at !== null,
    }));

  const sentRows = await repos.nudgesSent.list({ owner_id: ownerId, date: planDate } as never);
  const sentKeys = sentRows.map((r) => r.key);

  const { missedDaysInARow, welcomeBackSent } = await missedDaysStatus(client, ownerId, planDate);

  const dayPlan: DayPlan = {
    date: plan.date,
    wake: toPlanMinute(settings.wakeTime),
    bedtime: toPlanMinute(settings.bedtime),
    blocks,
  };

  return { plan: dayPlan, now: minute, restSessions, sentKeys, settings, missedDaysInARow, welcomeBackSent };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- assembleNudgeInput.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/testing/fakeClient.ts src/lib/nudges/missedDaysStatus.ts src/lib/nudges/assembleNudgeInput.ts src/lib/nudges/assembleNudgeInput.test.ts
git commit -m "feat(nudges): assemble dueNudges' NudgeInput from DB rows"
```

---

### Task 10: Cron tick orchestrator

**Files:**
- Create: `src/lib/cron/tick.ts`
- Test: `src/lib/cron/tick.test.ts`

**Interfaces:**
- Consumes: `assembleNudgeInput` (Task 9), `dueNudges` (existing), `sendPush`'s type shape (Task 3, injected as a parameter — not imported directly, so the test supplies a fake), `ensureTodayPlan`, `generateTomorrowPlan`... — actually not tomorrow-plan (that's evening-checkin's job); `runWeeklyReview`, `eveningReview` (existing, Plan 5/4), `settingsToDomain` (existing), `fakeClient` (Task 9, reused for this test).
- Produces: `CronTickDeps { client: RepositoryClient; anthropic: Anthropic; sendPush: (sub: PushSubscriptionRow, payload: { title: string; body: string }) => Promise<{ ok: boolean; expired: boolean }>; now: Date }`, `CronTickResult { ran: boolean; reason: string | null; nudgesSent: number; weeklyReviewRan: boolean; digestRetried: boolean }`, `runCronTick(deps: CronTickDeps): Promise<CronTickResult>`. Consumed by Task 11's route handler.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_SETTINGS } from '@/core/types';
import { fakeClient } from '@/lib/testing/fakeClient';
import { runCronTick } from './tick';

const settingsRow = {
  id: 'singleton' as const, owner_id: 'ct', timezone: 'UTC', wake_time: '07:00', bedtime: '23:00',
  model: 'claude-sonnet-5', monthly_cap_usd: 12, nudge_daily_cap: 8, deep_work_daily_cap_min: 360,
  // Reuse the real DEFAULT_SETTINGS shape rather than hand-typing thresholds
  // — thresholdsSchema has grown fields (anchorSkipDays, anchorSkipMinEnergy)
  // since this plan's earlier drafts, and a hand-typed fixture drifts silently.
  thresholds: DEFAULT_SETTINGS.thresholds,
  crisis_contacts: [],
};
const templateRow = { weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] };

function noopAnthropic() {
  return {} as Anthropic;
}
function noopSendPush() {
  return vi.fn().mockResolvedValue({ ok: true, expired: false });
}

describe('runCronTick', () => {
  it('no-ops with a reason when no settings row exists yet (onboarding not done)', async () => {
    const client = fakeClient({});
    const result = await runCronTick({ client, anthropic: noopAnthropic(), sendPush: noopSendPush(), now: new Date('2026-09-14T12:00:00Z') });
    expect(result).toEqual({ ran: false, reason: 'no-settings', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false });
  });

  it('sends due nudges and records them so the next tick does not resend', async () => {
    // wake_time is 07:00 → plan minute 420. 07:02 UTC = minute 422, inside
    // dueNudges' 5-minute look-back window for the wake-time nudge (morning,
    // or welcomeBack — this fake seeds no checkins at all, so missedDaysInARow
    // is high and dueNudges sends welcomeBack instead; either way, exactly one).
    const client = fakeClient({ settings: [settingsRow], templates: [templateRow] });
    const sendPush = noopSendPush();
    const now = new Date('2026-09-14T07:02:00Z');

    const first = await runCronTick({ client, anthropic: noopAnthropic(), sendPush, now });
    expect(first.ran).toBe(true);
    expect(first.nudgesSent).toBe(1);

    const nudgesSentRows = client.tables.nudges_sent ?? [];
    expect(nudgesSentRows.length).toBe(1);

    // A second tick one minute later must not resend the same nudge
    const second = await runCronTick({ client, anthropic: noopAnthropic(), sendPush, now: new Date('2026-09-14T07:03:00Z') });
    expect(second.nudgesSent).toBe(0);
  });

  it('does not retry a digest that has already used all 3 attempts', async () => {
    const client = fakeClient({
      settings: [settingsRow],
      templates: [templateRow],
      digests: [{ date: '2026-09-16', owner_id: 'ct', text: null, attempts: 3 }],
    });
    // Wednesday — keeps this test isolated from the Monday weekly-review branch.
    const result = await runCronTick({ client, anthropic: noopAnthropic(), sendPush: noopSendPush(), now: new Date('2026-09-16T12:00:00Z') });
    expect(result.digestRetried).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tick.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
import type Anthropic from '@anthropic-ai/sdk';
import { addDays, planClock, weekdayOf } from '@/core/time';
import { dueNudges } from '@/core/nudges/dueNudges';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { PushSubscriptionRow } from '@/lib/db/schemas';
import { ensureTodayPlan } from '@/lib/planner/ensureTodayPlan';
import { assembleNudgeInput } from '@/lib/nudges/assembleNudgeInput';
import { eveningReview } from '@/lib/mentor/routes/eveningReview';
import { runWeeklyReview } from '@/lib/mentor/runWeeklyReview';

export interface CronTickDeps {
  client: RepositoryClient;
  anthropic: Anthropic;
  sendPush: (sub: PushSubscriptionRow, payload: { title: string; body: string }) => Promise<{ ok: boolean; expired: boolean }>;
  now: Date;
}

export interface CronTickResult {
  ran: boolean;
  reason: string | null;
  nudgesSent: number;
  weeklyReviewRan: boolean;
  digestRetried: boolean;
}

const DIGEST_MAX_ATTEMPTS = 3;

/** The one thing /api/cron/tick calls, once a minute. Never throws for an
 * expected "nothing to do yet" state (no settings, no template) — those come
 * back as `{ ran: false, reason }` so the route can still answer 200. */
export async function runCronTick(deps: CronTickDeps): Promise<CronTickResult> {
  const { client, anthropic, sendPush, now } = deps;
  const repos = repositories(client);

  const settingsRow = await repos.settings.get();
  if (!settingsRow) return { ran: false, reason: 'no-settings', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false };

  const ownerId = settingsRow.owner_id;
  const settings = settingsToDomain(settingsRow);
  const { planDate, minute } = planClock(now, settings.timezone);

  let plan;
  let blocks;
  try {
    ({ plan, blocks } = await ensureTodayPlan(client, ownerId, now));
  } catch {
    return { ran: false, reason: 'no-template', nudgesSent: 0, weeklyReviewRan: false, digestRetried: false };
  }

  const input = await assembleNudgeInput(client, ownerId, planDate, minute, settings, plan, blocks);
  const nudges = dueNudges(input);
  const subscriptions = await repos.pushSubscriptions.list({ owner_id: ownerId } as never);

  for (const nudge of nudges) {
    for (const sub of subscriptions) {
      const result = await sendPush(sub, { title: nudge.title, body: nudge.body });
      if (result.expired) await repos.pushSubscriptions.remove(sub.id);
    }
    await repos.nudgesSent.upsert({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      date: planDate,
      type: nudge.type,
      block_id: nudge.blockId,
      key: nudge.key,
      sent_at: now.toISOString(),
      acked_at: null,
    });
  }

  // Spec §5.8: "If no weekly review exists for the week by Monday 04:00, the
  // cron tick generates it." weekStart is always the Sunday just finished.
  let weeklyReviewRan = false;
  if (weekdayOf(planDate) === 1) {
    const lastSunday = addDays(planDate, -1);
    const existingLetter = await repos.weeklyLetters.get(lastSunday, 'week_start');
    if (!existingLetter) {
      const result = await runWeeklyReview(client, anthropic, { ownerId, model: settings.model, monthlyCapUsd: settings.monthlyCapUsd }, lastSunday);
      weeklyReviewRan = !result.fallback;
    }
  }

  // Spec §12: "Evening digest is retried at the next cron tick up to 3 times."
  let digestRetried = false;
  const digestRow = await repos.digests.get(planDate, 'date');
  if (digestRow && digestRow.text === null && digestRow.attempts < DIGEST_MAX_ATTEMPTS) {
    const review = await eveningReview(client, anthropic, { ownerId, model: settings.model, monthlyCapUsd: settings.monthlyCapUsd }, planDate);
    await repos.digests.upsert({ date: planDate, owner_id: ownerId, text: review.fallback ? null : review.digest, attempts: digestRow.attempts + 1 });
    digestRetried = true;
  }

  return { ran: true, reason: null, nudgesSent: nudges.length, weeklyReviewRan, digestRetried };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tick.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cron/tick.ts src/lib/cron/tick.test.ts
git commit -m "feat(cron): runCronTick orchestrates nudges, weekly-review fallback, digest retry"
```

---

### Task 11: Cron route handler and the proxy exemption it needs

**Files:**
- Modify: `src/proxy.ts`
- Create: `src/app/api/cron/tick/route.ts`
- Modify: `src/lib/supabase/admin.ts` (comment only)

**Interfaces:**
- Consumes: `runCronTick` (Task 10), `sendPush` (Task 3), `createAdminSupabase` (existing), `createAnthropicClient` (existing).
- Produces: `POST /api/cron/tick` — 401 without a matching `x-cron-secret` header, otherwise runs one tick and returns its `CronTickResult` as JSON.

No unit test for the route handler itself (Next.js Route Handlers aren't unit tested anywhere in this codebase — every other route under `src/app/api/mentor/*` is exercised via its underlying service function's tests plus `npm run build`); `runCronTick` already has full coverage from Task 10.

- [ ] **Step 1: Add the proxy exemption**

In `src/proxy.ts`, the middleware currently requires a signed-in user for every `/api/*` route. `pg_net` calls `/api/cron/tick` with no Supabase session at all — it authenticates with `CRON_SECRET` instead, checked inside the route itself. Add the exemption:

Replace:

```typescript
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');
```

with:

```typescript
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');
  const isLoginRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');
  // pg_net calls this with no Supabase session — it authenticates with
  // CRON_SECRET inside the route itself, same reasoning as isLoginRoute.
  const isCronRoute = request.nextUrl.pathname.startsWith('/api/cron/');
```

Replace:

```typescript
  if (!user && !isLoginRoute) {
```

with:

```typescript
  if (!user && !isLoginRoute && !isCronRoute) {
```

- [ ] **Step 2: Update the admin client's comment**

In `src/lib/supabase/admin.ts`, this client now has a second legitimate caller. Replace the comment:

```typescript
/** Service-role client. Bypasses RLS entirely — used server-side for the
 * onboarding seed script and the cron tick route, both of which act
 * autonomously with no signed-in user session to bind to. Never used for a
 * request made narrowly on CT's behalf while they're signed in — those use
 * createServerSupabase() instead. */
```

- [ ] **Step 3: Write the route handler**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { sendPush } from '@/lib/push/sendPush';
import { runCronTick } from '@/lib/cron/tick';

/** Called by Supabase's pg_cron + pg_net once a minute (see
 * supabase/migrations/0002_nudges_and_digest_retry.sql). Authenticates with
 * CRON_SECRET, not a Supabase session — see src/proxy.ts's isCronRoute. */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const client = createAdminSupabase() as unknown as RepositoryClient;
  const result = await runCronTick({
    client,
    anthropic: createAnthropicClient(),
    sendPush,
    now: new Date(),
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run the full test suite, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; `/api/cron/tick` appears in the build's route list.

- [ ] **Step 5: Commit**

```bash
git add src/proxy.ts src/lib/supabase/admin.ts src/app/api/cron/tick/route.ts
git commit -m "feat(cron): /api/cron/tick route, CRON_SECRET auth, proxy exemption"
```

---

### Task 12: pg_cron schedule — CT's manual step

**Files:**
- Modify: `supabase/migrations/0002_nudges_and_digest_retry.sql`

This is documentation appended to the migration written in Task 7, not something Claude executes — Claude never runs SQL against CT's live Supabase project, and the domain name and `CRON_SECRET` value it needs aren't things Claude has.

- [ ] **Step 1: Append the scheduling snippet as a comment**

Append to the end of `supabase/migrations/0002_nudges_and_digest_retry.sql`:

```sql

-- Enable the extensions this schedule needs (idempotent — safe to re-run).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- CT: after deploying /api/cron/tick and setting CRON_SECRET in Vercel, run
-- this yourself in the Supabase SQL editor (substitute your real domain and
-- the same CRON_SECRET value you put in Vercel):
--
--   select cron.schedule('life-changer-tick', '* * * * *', $$
--     select net.http_post(
--       url := 'https://<your-vercel-domain>/api/cron/tick',
--       headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<your CRON_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $$);
--
-- To check it's running: select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it: select cron.unschedule('life-changer-tick');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0002_nudges_and_digest_retry.sql
git commit -m "docs(cron): document the pg_cron schedule CT runs against their own project"
```

---

### Task 13: Test-only login route for E2E

**Files:**
- Modify: `src/proxy.ts`
- Create: `src/app/api/test/login/route.ts`

**Interfaces:**
- Produces: `GET /api/test/login?secret=...` — 404 unless `E2E_AUTH_SECRET` is set and matches, otherwise signs in as `OWNER_EMAIL` via Supabase's real session-cookie mechanism and redirects to `/`.

Real single-user magic-link auth (PKCE `exchangeCodeForSession`, spec §4.2) can't be driven headlessly without an inbox to read a link from. Rather than hand-roll session cookies (fragile — `@supabase/ssr`'s cookie encoding is a library implementation detail), this route uses Supabase's own admin API to generate a valid one-time token and its own `@supabase/ssr` server client to redeem it — the exact same code path `/auth/callback` uses, just reached with a server-generated token instead of an emailed one. It is a 404 whenever `E2E_AUTH_SECRET` is unset, which CT must never set in the production Vercel project — it is only for `.env.test.local`, pointed at a separate test Supabase project (Task 14 explains why).

No unit test — a thin, secret-gated wrapper around two Supabase SDK calls, exercised end-to-end by Task 14's Playwright suite actually using it.

- [ ] **Step 1: Add the proxy exemption**

In `src/proxy.ts`, add alongside the `isCronRoute` line from Task 11:

```typescript
  const isTestLoginRoute = request.nextUrl.pathname === '/api/test/login';
```

And extend the same condition from Task 11:

```typescript
  if (!user && !isLoginRoute && !isCronRoute && !isTestLoginRoute) {
```

- [ ] **Step 2: Write the route**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/admin';

/** E2E-only. 404s unless E2E_AUTH_SECRET is set — CT sets it only in
 * .env.test.local against a throwaway test Supabase project, never in the
 * production Vercel env. Redeems a server-generated one-time token through
 * the same @supabase/ssr code path /auth/callback uses for a real magic
 * link, so the resulting session cookies are exactly what production sets. */
export async function GET(request: NextRequest) {
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret || request.nextUrl.searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const email = process.env.OWNER_EMAIL;
  if (!email) return NextResponse.json({ error: 'OWNER_EMAIL not set' }, { status: 500 });

  const admin = createAdminSupabase();
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'no token generated' }, { status: 500 });
  }

  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = '/';
  homeUrl.search = '';
  const response = NextResponse.redirect(homeUrl);

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: data.properties.hashed_token });
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 500 });

  return response;
}
```

- [ ] **Step 3: Run the full test suite, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; `/api/test/login` appears in the build's route list.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/app/api/test/login/route.ts
git commit -m "feat(e2e): secret-gated test login route for Playwright, never active in production"
```

---

### Task 14: Playwright setup and the four spec §13 flows

**Files:**
- Modify: `package.json` (add `@playwright/test` devDependency, `test:e2e` script)
- Create: `playwright.config.ts`
- Create: `e2e/global-setup.ts`
- Create: `.env.test.local.example`
- Create: `e2e/morning-checkin.spec.ts`
- Create: `e2e/day-changed.spec.ts`
- Create: `e2e/rest-reentry.spec.ts`
- Create: `e2e/evening-checkin.spec.ts`

**Important — real cost, CT's call:** two of these four flows (morning check-in and evening check-in) call the real Anthropic API through `/api/mentor/*` — a few cents per run, same as the mentor-tone-check script (Plan 4). This suite must run only against a **separate test Supabase project** CT sets up themselves (never production — these tests submit check-ins and create plans that would pollute CT's real data), and only when CT chooses to run it (`npm run test:e2e`), never wired into any pre-commit hook or CI trigger in this plan.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Add the npm script**

In `package.json`'s `"scripts"`, add:

```json
    "test:e2e": "playwright test"
```

- [ ] **Step 3: Document the test env file**

```
# Copy to .env.test.local and fill in a SEPARATE test Supabase project —
# never your production one. These tests submit real check-ins and generate
# real plans; running them against production would pollute your real data.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ANTHROPIC_API_KEY=
E2E_AUTH_SECRET=
E2E_BASE_URL=http://localhost:3000
```

Save this as `.env.test.local.example`.

The repo's `.gitignore` has a blanket `.env*` rule with a single `!.env.example` exception — it would silently ignore this new example file too. Add exceptions for it and for Playwright's own output directories:

```
.env*
!.env.example
!.env.test.local.example
e2e/.auth/
playwright-report/
test-results/
```

(The `e2e/.auth/`, `playwright-report/`, and `test-results/` lines are new additions to the existing `.gitignore`; the first two lines already exist.)

- [ ] **Step 4: Write the Playwright config**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    storageState: './e2e/.auth/state.json',
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  globalSetup: './e2e/global-setup.ts',
});
```

- [ ] **Step 5: Write global setup**

```typescript
import { chromium } from '@playwright/test';
import fs from 'node:fs';

/** Authenticates once via the secret-gated test login route (Task 13) and
 * saves the resulting session cookies for every spec to reuse. */
export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const secret = process.env.E2E_AUTH_SECRET;
  if (!secret) throw new Error('E2E_AUTH_SECRET must be set (see .env.test.local.example) to run E2E tests.');

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/api/test/login?secret=${secret}`);
  await page.waitForURL(`${baseURL}/`);
  fs.mkdirSync('./e2e/.auth', { recursive: true });
  await page.context().storageState({ path: './e2e/.auth/state.json' });
  await browser.close();
}
```

- [ ] **Step 6: Write the morning check-in flow**

```typescript
import { expect, test } from '@playwright/test';

test('morning check-in shows a briefing or returns to Today', async ({ page }) => {
  await page.goto('/checkin/morning');
  await expect(page.getByRole('heading', { name: 'Body' })).toBeVisible();

  await page.getByRole('button', { name: /Log the morning/ }).click();

  // Either the reassessment banner shows (state changed) or it redirects
  // straight back to Today (no change) — both are valid successful outcomes.
  await Promise.race([
    page.getByText('Today changed').waitFor({ state: 'visible', timeout: 15_000 }),
    page.waitForURL('/', { timeout: 15_000 }),
  ]);
});
```

- [ ] **Step 7: Write the Day-changed flow**

```typescript
import { expect, test } from '@playwright/test';

test('Day changed shows a diff and confirms', async ({ page }) => {
  await page.goto('/day-changed');
  await expect(page.getByRole('heading')).toBeVisible();

  const confirmButton = page.getByRole('button', { name: /Confirm|Apply/i }).first();
  await confirmButton.click();
  await page.waitForURL('/', { timeout: 15_000 });
});
```

- [ ] **Step 8: Write the rest re-entry flow**

```typescript
import { expect, test } from '@playwright/test';

test('Start rest leads to the re-entry ramp and "I\'m back" returns to Today', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Start rest/ }).click();
  await page.waitForURL('/reentry');
  await expect(page.getByRole('button', { name: /I'm back/i })).toBeVisible();

  await page.getByRole('button', { name: /I'm back/i }).click();
  await page.waitForURL('/', { timeout: 15_000 });
});
```

- [ ] **Step 9: Write the evening check-in flow**

```typescript
import { expect, test } from '@playwright/test';

test('evening form submission shows the review', async ({ page }) => {
  await page.goto('/checkin/evening');
  await expect(page.getByRole('heading', { name: 'Body' })).toBeVisible();

  await page.getByRole('button', { name: /Log the day/ }).click();
  await expect(page.getByText('From the department')).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 10: Run the suite once against a test Supabase project**

This step is CT's to run, not Claude's — it calls the real Anthropic API twice (morning + evening) and needs `.env.test.local` filled in against a real (test) Supabase project:

```bash
npm run test:e2e
```

- [ ] **Step 11: Typecheck**

Run: `npm run typecheck`
Expected: no errors (Playwright specs are excluded from `npm test`'s Vitest run via the `e2e/` directory not matching `src/**/*.test.ts`, but must still typecheck cleanly).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json playwright.config.ts e2e/ .env.test.local.example .gitignore
git commit -m "test(e2e): Playwright suite for the four spec §13 E2E flows"
```

---

### Task 15: CT's go-live checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md`

This is CT's own manual verification — like Plan 5's iPhone install checklist — not something Claude executes.

- [ ] **Step 1: Update the roadmap's Plan 6 row and add the checklist**

Change the Plan 6 row's "Needs from CT" cell from `Allow notifications on the iPhone` to `See the go-live checklist below`, and append this section after the roadmap table:

```markdown
## Go-live checklist (CT)

Before week 1 of the 4-week trial starts:

1. **Generate VAPID keys:** `npx web-push generate-vapid-keys`, paste the public/private keys and a `VAPID_SUBJECT` (`mailto:you@...`) into `.env.local` and Vercel's env vars.
2. **Pick a `CRON_SECRET`:** any long random string, into `.env.local` and Vercel.
3. **Deploy** with the new env vars set.
4. **Run the migration** (`supabase/migrations/0002_nudges_and_digest_retry.sql`) against your Supabase project's SQL editor, then run the `cron.schedule(...)` statement documented at the bottom of that file with your real domain and `CRON_SECRET`.
5. **Confirm the tick is firing:** `select * from cron.job_run_details order by start_time desc limit 5;` in the Supabase SQL editor — you should see rows appearing about once a minute.
6. **EU check:** if you're in the EU, Apple's DMA rules mean installed PWAs open in Safari tabs with no push support at all (since iOS 17.4) — nudges via push won't work on iPhone regardless of the code above. Everything else in the app is unaffected.
7. **Install to Home Screen** on your iPhone (Safari → Share → Add to Home Screen).
8. **Enable push:** open the installed app, tap "Enable nudges" on Today (or in Settings), and grant the permission prompt.
9. **Receive a transition nudge:** wait for one of today's blocks to end — you should get a push notification within a minute.
10. **Offline save → sync:** turn on Airplane Mode, fill out a check-in form and submit it (it should show the "queued" message), turn Airplane Mode back off, and confirm the entry appears (reload Today or check History).
11. *(Optional)* **Run the E2E suite** against a separate test Supabase project per `.env.test.local.example` — not required for go-live, but a good one-time sanity check: `npm run test:e2e`.
```

- [ ] **Step 2: Mark Plan 6 done in the roadmap table**

Once Tasks 1–14 are merged and this checklist is handed to CT, update the Plan 6 row's "Delivers" cell to prefix it with `✅ Code complete <date>` — following the same convention Plans 3/4/5 used — leaving the checklist itself as CT's pending action.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md
git commit -m "docs(roadmap): Plan 6 code complete; add CT's go-live checklist"
```

---

## After this plan

Run `npm test && npm run typecheck && npm run build` one final time, then `graphify update .` from this directory (per this project's `CLAUDE.md`) to bring the knowledge graph current with Plan 6's new modules.

This is the last plan of the Daily Loop roadmap. Once CT completes the go-live checklist (Task 15), week 1 of the 4-week success trial starts (spec §2).
