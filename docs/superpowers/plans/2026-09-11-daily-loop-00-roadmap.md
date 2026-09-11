# Daily Loop — Build Roadmap

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md)

The Daily Loop is built as **six plans**. Each one ends with working, tested software, and each later plan is written only when the one before it is finished. Later plans depend on things earlier plans produce: the design pass's comps, the Supabase and Vercel facts verified in Plan 3 (spec §15), and the real mentor output from Plan 4. Writing them now would mean guessing.

| # | Plan | Delivers | Depends on | Needs from CT |
|---|---|---|---|---|
| 1 | **Core logic** ([plan](2026-09-11-daily-loop-01-core-logic.md)) | Pure TypeScript domain library: plan-day clock, planner (build day, Day-changed reflow, change diff), burnout guard, nudge scheduler, mentor profile/context/cost, weekly S1–S4 metrics. 82 tests. | — | Nothing |
| 1b | **Progression core (MyCareer)** ([plan](2026-09-11-daily-loop-01b-progression.md)) | XP rules with guard-state multipliers, the 40–99 growth curve, OVR, Form, tiered badges, player card, level-up and new-tier detection (spec §8b). 114 tests total. | 1 | Nothing |
| 2 | **Visual design** | `impeccable` design pass in a **career-mode** world (CT's pinned choice, 2026-09-11): direction, design tokens, comps for Today (with the player card), Check-in, Day changed, Re-entry ramp, Mentor. Recorded in `DESIGN.md`. An earlier "day as a musical score" prototype in `design/prototype/` was superseded. | 1b | ~30 min of taste decisions |
| 3 | **Data, login & deploy skeleton** | Next.js app added to the repo. Supabase schema + row-level security, zod schemas for form sections, repositories (incl. building `DaySummary` from logs), magic-link login locked to `OWNER_EMAIL`, onboarding data (settings, profile, crisis contacts, weekday templates seeded from the 4-week program), deployed to Vercel. Verifies spec §15. | 1 | Create free **Supabase**, **Vercel** and **GitHub** accounts yourself (Claude can't create accounts or handle passwords) |
| 4 | **Mentor** | `prompts/mentor.md`, Anthropic SDK routes (briefing, evening review, weekly review, chat, reflow comment), structured outputs, usage recording + monthly cap, prompt-cache check, crisis flag, tone check on sample days. | 1, 3 | Anthropic Console account with billing; paste the API key into Vercel env vars yourself |
| 5 | **Screens & PWA** | Today, Day changed, rest + re-entry ramp, check-in forms, mentor, history, templates editor, settings, export, onboarding UI. Installable PWA, offline outbox, local crisis keyword check. | 2, 3, 4 | Install to your iPhone home screen |
| 6 | **Nudges & go-live** | VAPID Web Push, subscriptions, `/api/cron/tick`, pg_cron + pg_net, 04:00 plan generation, Monday weekly-review fallback, digest retries, "Nudges are off" banner, Playwright E2E, iPhone test checklist. | 3, 4, 5 | Allow notifications on the iPhone |

**Milestone:** when Plan 6 is done, week 1 of the 4-week success trial starts (spec §2).

After every plan: `npm test` and `npm run typecheck` pass, the work is committed, and `graphify update .` is run from `D:\CT's Portfolio` (project CLAUDE.md).
