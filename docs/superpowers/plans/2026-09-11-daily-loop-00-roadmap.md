# Daily Loop — Build Roadmap

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md)

The Daily Loop is built as **six plans**. Each one ends with working, tested software, and each later plan is written only when the one before it is finished. Later plans depend on things earlier plans produce: the design pass's comps, the Supabase and Vercel facts verified in Plan 3 (spec §15), and the real mentor output from Plan 4. Writing them now would mean guessing.

| # | Plan | Delivers | Depends on | Needs from CT |
|---|---|---|---|---|
| 1 | **Core logic** ([plan](2026-09-11-daily-loop-01-core-logic.md)) | Pure TypeScript domain library: plan-day clock, planner (build day, Day-changed reflow, change diff), burnout guard, nudge scheduler, mentor profile/context/cost, weekly S1–S4 metrics. 82 tests. | — | Nothing |
| 1b | **Progression core (MyCareer)** ([plan](2026-09-11-daily-loop-01b-progression.md)) | XP rules with guard-state multipliers, the 40–99 growth curve, OVR, Form, tiered badges, player card, level-up and new-tier detection (spec §8b). 114 tests total. | 1 | Nothing |
| 2 | **Visual design** ✅ | Done 2026-09-12. `impeccable` code-led design pass in the career-mode world CT chose: **Performance Department** (seed 2562ab01). Tokens, component language and six prototype screens in `design/prototype/` (Today with the player card, player card, Day changed, Re-entry ramp, Check-in, Mentor). System recorded in [`DESIGN.md`](../../../DESIGN.md); direction contract in `.impeccable/surfaces/`. The earlier "day as a musical score" prototype was superseded. | 1b | Nothing further |
| 3 | **Data, login & deploy skeleton** ✅ | Done 2026-09-14 ([plan](2026-09-12-daily-loop-03-data-login-deploy.md)). Next.js app on the repo, Supabase schema + row-level security, zod schemas for form sections, repositories for all 14 tables (incl. the pure `DaySummary` builder in `src/core/daySummary`), magic-link login locked to `OWNER_EMAIL`, onboarding seed data (settings + weekday templates from the 4-week program), deployed to Vercel. 148 tests total. Live at [ct-life-changer.vercel.app](https://ct-life-changer.vercel.app) — signed in as CT, read/write round trip against Supabase verified under RLS in production. | 1 | Nothing further |
| 4 | **Mentor** ✅ | Done 2026-09-14 ([plan](2026-09-14-daily-loop-04-mentor.md)). `prompts/mentor.md`, Anthropic SDK routes under `/api/mentor/*` (briefing, evening review, weekly review, chat, reflow comment), structured outputs via `zodOutputFormat`, usage recording + monthly cap gate, local crisis-keyword backup check, canned fallbacks for cap/errors, every exchange logged to `mentor_messages`. 185 tests total, deployed to Vercel with the real API key. `npm run mentor-tone-check` confirmed the voice-by-state prompt works as designed (ready pushes, drifting cuts to one action, depleted protects, grinding is blunt about rest) — cache-read verification (`usage.cache_read_input_tokens > 0`) was left unconfirmed to avoid spending more real API cost than needed. | 1, 3 | Nothing further |
| 5 | **Screens & PWA** ✅ | Code complete 2026-09-14 ([plan](2026-09-14-daily-loop-05-screens-pwa.md)). Today, Day changed, rest + re-entry ramp, morning/evening check-in, mentor (briefing + streaming chat + weekly review), player card, history, templates editor, settings, export, onboarding. Installable PWA (manifest, generated icons, app-shell service worker), IndexedDB offline outbox on both check-in forms, local crisis-keyword check wired into every free-text submit path. Pending CT: install to iPhone home screen and confirm the install/offline/push-permission flow (spec §13's manual iPhone checklist — push itself is Plan 6). | 2, 3, 4 | Install to your iPhone home screen |
| 6 | **Nudges & go-live** ✅ | Code complete 2026-09-14 ([plan](2026-09-14-daily-loop-06-nudges-go-live.md)). VAPID Web Push, subscriptions, `/api/cron/tick` (Supabase pg_cron + pg_net, not Vercel's cron feature — Vercel Hobby's once-a-day cap doesn't apply), the Monday weekly-review fallback, evening-digest retry (up to 3 attempts), "Nudges are off" banner on Today + a Settings control, a minimal Playwright E2E suite for the four spec §13 flows. 249 unit/integration tests total, plus the Playwright suite (run separately, not counted here). | 3, 4, 5 | See the go-live checklist below |

**Milestone:** when Plan 6 is done, week 1 of the 4-week success trial starts (spec §2).

After every plan: `npm test` and `npm run typecheck` pass, the work is committed, and `graphify update .` is run from `D:\CT's Portfolio` (project CLAUDE.md).

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
