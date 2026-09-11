# CT's Life Changer — Sub-project 1: The Daily Loop

**Date:** 2026-09-11
**Status:** Approved in brainstorming, awaiting spec review
**Owner / only user:** CT

---

## 1. Context

CT has heavy ADHD and wants a companion app that acts as a mentor / alter-ego: it keeps CT structured ("military-style") while tolerating a schedule that constantly has to shapeshift, remembers CT's real life, advises, manages pleasure over-indulgence, and — above all — prevents both burnout (grinding) and rotting (over-indulging), the two extremes CT oscillates between.

The full vision spans many modules (daily log + memory, schedule, mentor, trainer, pleasure management, daily knowledge, burnout guard, reflection, football-analytics career path). Building all at once is the classic ADHD-project failure mode, so the vision is decomposed. **This spec covers only Sub-project 1, the Daily Loop** — the spine every later module plugs into.

Existing inputs:
- `4-Week-Program-REVISED.md` (calisthenics program, recovery-focused, Mon/Tue/Wed/Thu training, Fri–Sun rest, sleep + stress protocols, Sunday tracking). v1 uses it as training-block content; the full trainer is a later module.
- CT's football analytics portfolio in `D:\CT's Portfolio` (FPL Pipeline, xT and VAEP work, football-capture / bzzoiro pipeline, Scouting App, Penalty research). v1 references these as chips in the evening form.

## 2. Goals and success criteria

After 4 weeks of use, the Daily Loop is working if **all four** hold:

| # | Criterion | Measured as (computed weekly) | Target |
|---|---|---|---|
| S1 | CT actually uses it daily | Days with ≥1 check-in ÷ 7 | ≥ 5/7 |
| S2 | Fewer crashes | Nights with ≥7h sleep; days in Depleted or Drifting state | ≥ 5/7 nights ≥7h; Depleted+Drifting days trending down week over week |
| S3 | CT comes back after rest | Rest sessions whose re-entry was acknowledged ≤10 min after the block ended ÷ all ended rest sessions | ≥ 70% |
| S4 | Visible progress | Training sessions done ÷ planned; football-analytics minutes + "what I learned" entries | Shown every week; trend visible |

The Sunday weekly review reports all four.

## 3. Decisions log (from brainstorming)

| Topic | Decision |
|---|---|
| First sub-project | Daily Loop |
| Platforms | iPhone (home-screen web app / PWA) + laptop browser. No native iOS app (no Mac available). |
| Away-from-home use | Must work anywhere, laptop off → cloud-synced |
| Stack | **Approach A:** Next.js + TypeScript PWA on Vercel, Supabase (Postgres + Auth + pg_cron), Web Push |
| Mentor voice | Adaptive — driven by the guard's daily state |
| Nudges | Checkpoints + block transitions, hard daily cap |
| Schedule model | Timetable with anchors + one-button reflow |
| Logging style | Structured forms (fast: prefilled, chips, every section skippable) |
| Form sections | Body, Mind, Work & growth, Pleasure, People & connections, Reflection |
| Pleasure | Planned rest blocks + re-entry ramp; weekly trend |
| Burnout guard | Auto-adjusts tomorrow's plan, one-tap override |
| Model | `claude-sonnet-5`, configurable in settings; hard monthly $ cap |
| AI boundary | Deterministic code for planner, guard, nudges. Claude only for mentoring judgment. |
| Profile memory | Claude auto-updates weekly; versioned, visible change list, one-tap revert |
| Progression (added 2026-09-11) | **MyCareer**: real mechanics. EA FC-style player card (OVR + six 0–99 attributes), NBA 2K-style tiered badges, Football Manager-style weekly development report. Attributes and badges never decrease; a separate Form rating moves. Recovery earns XP; the burnout guard shows as Fatigued / Injury risk. Anti-compulsion rules in §8b. |

## 4. Architecture

```
iPhone (PWA)  ─┐
               ├─►  Next.js app on Vercel  ──►  Supabase Postgres (+ Auth)
Laptop browser ┘        │   │                        ▲
                        │   └──► Anthropic API       │ pg_cron (every minute)
                        │        (claude-sonnet-5)   │  → pg_net HTTP call
                        └──► Web Push ◄── /api/cron/tick ◄─┘
```

One TypeScript codebase. All Claude calls and all secrets are server-side (Next.js route handlers). The phone never holds the Anthropic key.

### 4.1 Units

Each unit has one job and a narrow interface. The planner, guard, and nudge scheduler are **pure functions** (no I/O) so they are trivially testable.

| Unit | Responsibility | Interface (sketch) | Depends on |
|---|---|---|---|
| `planner` | Build a day from a template; reflow the rest of a day after a disruption | `buildDay(template, date, adjustments) → Block[]`; `reflow(blocks, now, event, settings) → { blocks, diff }` | nothing (pure) |
| `guard` | Classify state from recent logs; propose adjustments for tomorrow | `assess(days: DaySummary[], settings) → { state, reasons[], adjustments[] }` | nothing (pure) |
| `nudges` | Decide which nudges are due right now | `dueNudges(now, blocks, restSessions, sentLog, settings) → Nudge[]` | nothing (pure) |
| `mentor` | Build context, call Claude, parse output, record usage, enforce cap | `briefing(date)`, `eveningReview(date)`, `weeklyReview(weekStart)`, `chat(message)` | db, Anthropic SDK, `context` |
| `context` | Assemble what Claude sees; strip "just for me" content | `buildContext(route, date) → { system, messages }` | db |
| `db` | Typed data access (Supabase client + zod schemas) | repository functions per table | Supabase |
| `push` | Store subscriptions, send Web Push | `send(nudge)`, `subscribe(sub)` | `web-push`, db |
| `web` | Screens: Today, Check-in, Mentor, History, Settings, Templates | React / Next.js pages | all of the above via route handlers |

### 4.2 Auth

Single user, but the app is on a public URL, holds private life data, and can spend Claude money. Therefore:
- Supabase Auth with email magic link; sign in once per device (long-lived session).
- Server rejects any user whose email ≠ `OWNER_EMAIL` env var.
- Row-level security on every table restricted to the owner's `auth.uid()`.
- Cron endpoint protected by a shared secret header (`CRON_SECRET`).

## 5. The day

### 5.1 Day boundary

A "day" is keyed by local date and runs **04:00 → 04:00** in the settings timezone, so a late night belongs to the day it started.

### 5.2 Templates and blocks

- One **template per weekday** (Mon–Sun), editable. Seeded from the 4-week program: Mon push+neck, Tue handstand/recovery, Wed legs+core+neck, Thu pull, Fri–Sun rest; plus sleep window, meals, deep-work blocks, and rest blocks CT defines.
- **Block** fields: `title`, `kind` (`task | training | rest | buffer | routine`), `anchor` (boolean — any kind can be an anchor, e.g. a training or deep-work block), `priority` (1 = lowest … 5 = highest), `start`, `end`, `minMinutes` (how far it can shrink; default = full duration for anchors, 50% for tasks, 15 min for rest), optional `window` (`earliestStart`, `latestEnd`) for movable anchors, `checklist` (e.g. the day's exercises), `status` (`planned | active | done | partial | skipped | missed | dropped`), `source` (`template | manual | urgent | guard`).
- **Anchors** are never dropped by the planner. A fixed anchor keeps its time; a windowed anchor may move within its window. If a window has fully passed, the anchor is marked `missed` and surfaced to CT rather than silently dropped.
- Every evening (at evening-review time), tomorrow's plan is generated: `buildDay(template, tomorrow, guard.adjustments)`. If no plan exists for a date when its 04:00 day boundary arrives (e.g. the evening form was skipped), the cron tick generates it.

### 5.3 Morning

1. Morning nudge at wake time.
2. **Morning check-in** (target ≤ 60 s): see §6.
3. `guard.assess` re-runs on the last 7 days, now including last night's sleep. If the resulting state differs from the state the plan was built with the evening before, the guard adjustments on today's remaining blocks are recomputed. A banner shows each adjustment + reason, with **Keep original** (one tap reverts all guard adjustments for the day and records `overridden = true`).
4. **Mentor briefing** (one Claude call): today's top 3 priorities, tone per state.

### 5.4 During the day — Today screen

- Current block large with countdown; next block below; buttons **Day changed** and **Start rest**.
- **Transition nudge** at each block end: "‹block› done? Next: ‹next› in N min." Notification actions: done / partial / skipped (where iOS supports actions; otherwise tap opens the Today screen with those buttons).
- **Day changed** flow: pick an event → planner reflows → show diff (kept / moved / shrunk / dropped, each with a reason) → Confirm. Optional "Ask mentor" button for a comment (one Claude call).

Reflow events:
| Event | Input | Behavior |
|---|---|---|
| `late` | minutes | Shift current/next flexible blocks by N min, then fit |
| `lostTime` | start, end | Mark that interval unavailable, then fit |
| `urgent` | title, duration, priority | Insert new block at the earliest free slot, then fit |
| `lowEnergy` | — | Deep-work/task blocks shrink toward `minMinutes`, insert one 15-min rest, training block switches to its recovery variant (Tue-style), then fit |

### 5.5 Reflow algorithm (planner)

Deterministic; same input → same output.

1. Take all blocks with `status ∈ {planned, active}` ending after `now`. Blocks already done/partial/skipped are untouched. A block running at `now` (start ≤ now < end) stays in place, except for the `late`, `urgent` and `lowEnergy` events, which re-place it.
2. Apply the event (table above).
3. Place anchors: fixed anchors at their times; windowed anchors at their original time if free, else the earliest free time inside their window, else mark `missed`.
4. Compute free intervals from `max(now, wake)` to the start of the wind-down anchor (bedtime − 60 min).
5. Place flexible (non-anchor) blocks **in their original order** into free intervals. Each block stays at its original start (or later, if pushed) and moves earlier only as far as needed for the rest of the day to fit (backward pass computes latest feasible starts, forward pass places).
6. If they don't fit: shrink blocks to `minMinutes`, one block per step, lowest priority first (ties: later-in-day first), until they fit or all are at minimum. (v1: shrunk blocks are not re-grown after a later drop.)
7. Still don't fit: drop blocks, lowest priority first (ties: later-in-day first), until they fit.
8. Return new blocks + `diff[]` entries `{blockId, change: kept|moved|shrunk|dropped|missed, from, to, reason}`.

The planner never moves the sleep anchor and never schedules anything inside the sleep window.

### 5.6 Rest blocks and re-entry

- **Start rest** (or a planned rest block beginning) creates a `rest_session` with activity chip (gaming, social media, YouTube/streaming, other).
- At `end − 5 min`: "Re-entry in 5" nudge.
- At `end`: **re-entry ramp** screen — (1) stand up, (2) water, (3) one starter task = "first 2 minutes of ‹next block›". Tapping "I'm back" sets `reentryAckAt`.
- If not acknowledged 10 min after `end`: one follow-up nudge (counts toward cap). No further escalation.
- Unplanned indulgence is logged in the evening form (§6), without judgment language; it feeds the weekly trend and the guard.

### 5.7 Evening

1. Evening nudge at bedtime − 60 min.
2. **Evening form** (target ≤ 3 min; much pre-filled): see §6.
3. **Mentor evening review** (one Claude call, structured output): message to CT, ~100-word daily digest, preview of tomorrow incl. any guard adjustments.
4. Wind-down reminder: phone away, low-stim routine (from the program's sleep protocol).
5. Tomorrow's plan is generated.

### 5.8 Sunday weekly review

One Claude call (structured output) producing:
- Weekly letter: S1–S4 metrics, training sessions done vs planned, indulgence trend, one pattern, one focus for next week.
- Profile changes: a list of `{ section, newText, reason }` (see §8.6 for sections). Applied automatically as a new profile version. Each change is shown in the letter ("what I changed about you") with one-tap **Revert**, which restores that section's text from the previous version (creating another new version, author `user`).
- If no weekly review exists for the week by Monday 04:00, the cron tick generates it (the review does not depend on the Sunday form being filled).

### 5.9 Missed days

- No streaks, no shame language anywhere.
- Days without data are `unknown`, never counted as bad by the guard.
- The evening form can backfill the morning check-in.
- After 2 consecutive days with no check-in: one "welcome back" nudge, then nothing more until CT returns.

## 6. Forms

All sections skippable. Values prefilled from yesterday where sensible. Chips over typing. Any free-text field or whole section can be flagged **"just for me"** (saved, never sent to Claude).

**Morning**
- Body: bedtime, wake time (prefilled from plan), sleep quality 1–5, energy 1–10.
- Mind: mood 1–10, stress 1–10, stress cause chips (family, school/work, money, social, health, none, other + text).

**Evening**
- Body: training (done / partial / skipped / rest day) + checklist from the training block; protein (low / ok / hit ~150 g); water (L); energy now 1–10.
- Mind: peak stress 1–10 + cause chips; focus quality 1–5; what regulated me (guitar, walk, stretching, breathing, talked to someone, other).
- Work & growth: tasks done (from blocks + free text); deep-work minutes (auto-summed from done/partial deep-work blocks, editable); football analytics: project chips (FPL Pipeline, xT/VAEP, football-capture, Scouting App, Penalty research, other) + minutes + "what I learned" text.
- Pleasure: planned rest sessions (auto) + unplanned entries (activity chip + minutes); "did I come back after rest?" (yes / partly / no).
- People & connections: who (remembered name chips), interaction type (in person / call / text / online), felt (draining / neutral / energizing), reached out to someone (y/n), friction note.
- Reflection: 1–3 gratitude lines, lesson of the day, win of the day.

Form data is stored as JSON validated by zod schemas (one schema per section), so sections can evolve without migrations.

## 7. Burnout guard

Pure rules over `DaySummary[]` (last 7 days). Each rule requires the stated data to be present; missing days don't count toward or against. All thresholds live in `settings.thresholds` and are editable.

| Flag | Rule (default thresholds) | State |
|---|---|---|
| `SLEEP_LOW` | sleep < 6 h on ≥ 3 of the last 4 nights with data | Depleted |
| `ENERGY_LOW` | morning energy ≤ 4 on 3 consecutive logged days | Depleted |
| `STRESS_HIGH` | stress ≥ 8 on 2 consecutive logged days | Depleted |
| `GRIND_HOURS` | deep-work minutes > `deepWorkDailyCapMin` (default 360) on ≥ 5 of last 7 days **and** no rest session taken on those days | Grinding |
| `GRIND_REST_DAYS` | training logged on a template rest day ≥ 2 times in last 7 days | Grinding |
| `INDULGE_HIGH` | unplanned indulgence > 120 min on 2 consecutive days | Drifting |
| `ANCHOR_SKIP` | ≥ 50% of anchors skipped/missed on 2 consecutive days **and** average energy ≥ 6 over those days | Drifting |

**State precedence** when several flags fire: Depleted > Grinding > Drifting > Ready. The mentor still gets every flag (e.g. Depleted + INDULGE_HIGH lets it connect late gaming to bad sleep).

**Adjustments** (applied to tomorrow's plan, overridable):
| State | Adjustments |
|---|---|
| Ready | none |
| Drifting | add a 15-min "easy win" task as the first block after wake; add a morning anchor if none; cap each rest block at 45 min |
| Depleted | hard training → recovery variant; sleep anchor starts 30 min earlier; drop non-anchor blocks with priority ≤ 2; cap deep work at 50% of `deepWorkDailyCapMin` |
| Grinding | insert a mandatory 30-min rest block mid-afternoon; cap deep work at `deepWorkDailyCapMin`; rest-day training blocks removed |

## 8. Mentor

### 8.1 Voice by state

| State | Voice |
|---|---|
| Ready | Firm coach — raises the bar, holds CT to their word, names excuses |
| Drifting | Drill sergeant — direct, structured, no lectures, one immediate action |
| Depleted | Protective — gentle, no guilt, basics first (sleep, food, water, one small thing) |
| Grinding | Blunt about burnout risk even if CT feels fine; insists on rest |

**Writing rules (all states):** short; one clear next action; make progress visible; no walls of text; no shame. (Informed by the `i-have-adhd` skill principles.)

### 8.2 Routes

| Route | Trigger | Output |
|---|---|---|
| `briefing` | after morning check-in | text (≤ ~120 words) |
| `eveningReview` | after evening form | structured: `{ message, digest, tomorrowNote, crisis: boolean }` |
| `weeklyReview` | Sunday evening form, manual, or Monday 04:00 fallback | structured: `{ letter, changes: { section, newText, reason }[], crisis: boolean }` |
| `chat` | any time | streamed text |
| `reflowComment` | "Ask mentor" in Day changed | text (≤ ~60 words) |

### 8.3 Context (what Claude sees)

In this order, stable content first for prompt caching:
1. **System:** persona + voice rules + writing rules + safety rules (versioned file `prompts/mentor.md` in the repo).
2. **Profile:** current profile version (markdown).
3. **Recent history:** last 4 weekly letters, last 7 daily digests.
4. **Today:** state + flags + adjustments, today's plan with statuses, today's check-in data (minus "just for me" fields).
5. **Route request** (and, for chat, the last 20 chat messages).

Items 1–2 are marked with `cache_control`. Verify `usage.cache_read_input_tokens > 0` on repeated calls; if the prefix is under the model's minimum cacheable length, accept no caching.

### 8.4 Model and API

- Model from `settings.model`, default `claude-sonnet-5`. Official `@anthropic-ai/sdk`.
- Adaptive thinking (Sonnet 5 default). Effort starts at `medium` for briefing/review/chat and `high` for weekly review; tune after real use.
- Structured outputs via `output_config.format` for evening and weekly routes.
- Streaming for chat.

### 8.5 Cost cap

- Every call writes a `usage` row: route, model, input / output / cache-read / cache-write tokens, computed `costUsd` (prices in a config map).
- Settings shows month-to-date spend vs `monthlyCapUsd` (default $12).
- Before each call: if month-to-date ≥ cap, skip the call and show the fallback message ("Mentor's resting until ‹1st of next month› — your plan, nudges and guard are all still running.").

### 8.6 Profile

The profile is a fixed set of named sections, each free text:
`goalsPhysical`, `goalsFootballAnalytics`, `goalsMind`, `goalsCharacter`, `values`, `stressTriggers`, `whatWorks`, `whatDoesntWork`, `commitments`, `mentorStyle`, `observedPatterns`.

Seeded at first run from an onboarding form (one field per section; `observedPatterns` starts empty). Updated automatically by the weekly review, one change = one section replaced. Every update creates a new `profile_versions` row (full history kept). The mentor receives the profile rendered as markdown with section headings. CT can edit any section at any time (new version, author `user`).

## 8b. Progression (MyCareer)

CT's life as a player career. All progression is a **pure function of logged history** (recomputable from the database at any time; nothing is stored that can't be rebuilt).

### 8b.1 Attributes and OVR

Six attributes, each 40–99 (everyone starts at 40, "rookie"). **OVR** = rounded mean of the six.

| Code | Attribute | XP sources (per day) |
|---|---|---|
| PHY | Physical | training done +40, partial +20; protein "hit" +10; water ≥ 3 L +5 |
| REC | Recovery | sleep ≥ 7 h +30 (6–7 h +10); each planned rest session taken +10; rest day with no training +20 |
| ANL | Analytics | +1 per football-analytics minute (max 240/day); "what I learned" entry +15 |
| DIS | Discipline | +10 per anchor kept (done or partial); +15 per rest session returned from within 10 min; easy-win block done +30 |
| MEN | Mentality | morning check-in +10; evening check-in +15; +5 per regulation used (max 15) |
| CHR | Character | +5 per gratitude line (max 15); win or lesson written +5; reached out to someone +15 |

**State multipliers** (the day's guard state):
| State | Card tag | Effect |
|---|---|---|
| Ready | — | ×1 everything |
| Drifting | Out of form | ×1; the easy-win bonus (+30 DIS) is the fastest XP of the day |
| Depleted | Fatigued | PHY, ANL, DIS ×0.5; REC ×2 |
| Grinding | Injury risk | PHY training XP ×0 (sit out); ANL ×0.5; REC ×2 |

XP amounts are floored after multipliers.

**Growth curve:** going from rating *r* to *r + 1* costs `round(20 × 1.06^(r − 40))` XP (40→41 costs 20, 60→61 ≈ 64, 80→81 ≈ 206, 98→99 ≈ 588). Capped at 99. Reaching 99 in an attribute takes roughly 10,000 XP, which is months of consistent days, never a weekend. **Attributes never decrease.**

### 8b.2 Form

Form compares the last 7 days' total XP with the average 7-day total of the 21 days before them.
| Ratio | Form |
|---|---|
| ≥ 1.30 | Excellent ↑↑ |
| ≥ 1.05 | Good ↑ |
| ≥ 0.85 | Steady → |
| ≥ 0.60 | Dipping ↓ |
| < 0.60 | Rebuilding ↓↓ |

With fewer than 14 days of history, Form is "Settling in". Form is the only number that goes down, and its wording is plain, never shaming.

### 8b.3 Badges

Tiered on **cumulative counts, never consecutive days**, so §5.9's no-streaks rule holds. Earned tiers are never lost.
| Badge | Counts | Bronze / Silver / Gold / Hall of Fame |
|---|---|---|
| Clutch Returner | rest sessions returned from within 10 min | 10 / 40 / 120 / 300 |
| Iron Sleeper | nights with ≥ 7 h sleep | 10 / 40 / 120 / 300 |
| Film Room | football-analytics hours | 10 / 50 / 150 / 400 |
| Anchor | anchors kept | 25 / 100 / 300 / 800 |
| Workhorse | training sessions done | 10 / 40 / 120 / 300 |
| Open Book | evening check-ins with a reflection | 10 / 40 / 120 / 300 |

### 8b.4 Surfaces and anti-compulsion rules

- The player card (OVR, six attributes, Form, today's card tag) and badges appear in the app; the weekly letter becomes a **development report** (attribute changes, badge progress, one focus).
- **No** login rewards, random rewards, loot, leaderboards, or streak counters. XP never appears in a push notification.
- Level-ups are shown quietly where they happen and summarised weekly. A new badge **tier** gets one short celebration moment.
- The mentor never uses ratings to shame ("your DIS is low"); it may use them to point at the next win.

## 9. Nudges

- **Scheduler:** Supabase `pg_cron` every minute → `pg_net` POST to `/api/cron/tick` (with `CRON_SECRET`) → server loads today's blocks, rest sessions, sent log → `dueNudges(...)` → Web Push → record in `nudges_sent`.
- **Types:** `morning` (wake time), `transition` (block end), `restWarning` (rest end − 5), `reentry` (rest end), `reentryFollowUp` (rest end + 10 if not acked, once), `evening` (bedtime − 60), `welcomeBack` (after 2 silent days, once).
- **Cap:** `nudgeDailyCap` (default 8). When the cap would be exceeded, priority is morning = evening = re-entry > reentryFollowUp > transition > restWarning; lower-priority nudges are skipped. One slot is always kept in reserve for the evening nudge until it has been sent.
- **Pause:** after the welcome-back nudge (§5.9), all nudges pause until CT's next check-in.
- **Quiet hours:** no nudges inside the sleep window.
- **Dedup:** a nudge is uniquely keyed by (date, type, blockId); never sent twice.
- **iOS specifics:** push works only when the PWA is installed to the Home Screen and permission is granted from a user gesture. If no valid subscription exists, the Today screen shows a persistent "Nudges are off — tap to enable" banner.

## 10. Data model (Supabase / Postgres)

| Table | Key columns |
|---|---|
| `settings` (1 row) | timezone, wakeTime, bedtime, model, monthlyCapUsd, nudgeDailyCap, deepWorkDailyCapMin, thresholds jsonb, crisisContacts jsonb |
| `templates` | weekday (0–6), blocks jsonb |
| `plans` | date PK, state, flags jsonb, adjustments jsonb, overridden bool |
| `blocks` | id, date, title, kind, anchor, priority, start, end, minMinutes, windowStart, windowEnd, tags text[], checklist jsonb, recoveryVariant jsonb, status, source |
| `checkins` | id, date, type (morning / evening), sections jsonb, privateKeys text[], createdAt |
| `rest_sessions` | id, date, blockId?, activity, planned bool, startedAt, endedAt, reentryAckAt |
| `unplanned_indulgence` | id, date, activity, minutes |
| `mentor_messages` | id, date, route, role, content, stateAtTime, usageId |
| `digests` | date PK, text |
| `weekly_letters` | weekStart PK, letter, metrics jsonb, changes jsonb, profileVersionId |
| `profile_versions` | id, createdAt, sections jsonb (section → text), author (claude / user), changes jsonb |
| `push_subscriptions` | id, endpoint, keys jsonb, deviceLabel, createdAt |
| `nudges_sent` | id, date, type, blockId?, sentAt, ackedAt |
| `usage` | id, createdAt, route, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, costUsd |

People entries live inside `checkins.sections.people` (zod-typed); promoted to a table only if a later module needs it.

**Export:** Settings → Export downloads all tables as JSON, and CSV per table.

## 11. Privacy and safety

- "Just for me" content is stripped by `context` before any Claude call (unit-tested).
- Data lives in CT's Supabase project behind auth + RLS. Mentor calls send only the slices in §8.3 to the Anthropic API (API data is not used for model training by default).
- **Crisis:** the system prompt instructs the mentor to leave coaching mode if CT's content suggests crisis or self-harm, respond with care, and point to CT's crisis contacts. Structured routes return `crisis: true`, which makes the UI show crisis contacts prominently. As a backup that works even when Claude is unavailable or capped, a small local keyword check on free-text fields shows the contacts card. Crisis contacts (including local hotlines) are configured in Settings during onboarding.
- **Heavy topics** (e.g. family stress): mentor supports and also encourages real human connection (People section helps it know who).
- **Health:** no medical or medication advice; for sharp pain or injury the mentor says stop and see a professional (consistent with the program's safety rules).

## 12. Error handling

| Situation | Behavior |
|---|---|
| Offline / bad signal | App shell cached by service worker; form submissions and block status changes go into an IndexedDB outbox and sync on reconnect (last-write-wins per record; single user makes conflicts rare). |
| Claude error / timeout | Retry once (SDK default retries); then show a canned fallback for that route; nothing else is blocked. Evening digest is retried at the next cron tick up to 3 times. |
| Cap reached | Skip call, show fallback (§8.5). |
| Push subscription invalid (410) | Delete subscription; show "Nudges are off" banner. |
| Cron missed ticks | `dueNudges` looks back 5 minutes, so a delayed tick still sends (dedup prevents doubles). |
| Reflow impossible (anchors alone overfill the day) | Show the conflict and let CT choose which anchor to mark missed; planner never silently drops anchors. |

## 13. Testing

- **Unit (Vitest, TDD):** `planner` (reflow per event type, midnight crossing, overlapping anchors, windowed anchors, empty day, shrink-then-drop order, determinism), `guard` (every rule, missing-data handling, precedence), `nudges` (each type, cap priority, quiet hours, dedup, 5-min look-back), `context` (privacy stripping, ordering for caching), cost computation, `progression` (XP rules per attribute and state multiplier, growth curve and cap, OVR, form bands and "Settling in", badge tiers from cumulative counts, never-decreasing guarantees).
- **Mentor:** context builder tested with fixture days; Anthropic client mocked in tests. A small fixture set (one sample day per state) is run manually against the real API to sanity-check tone.
- **E2E (Playwright):** morning check-in → briefing shown; Day changed → diff → confirm; Start rest → re-entry ramp → "I'm back"; evening form → review shown.
- **Manual on iPhone:** install to Home Screen, enable push, receive a transition nudge, offline form save → sync.

## 14. Scope

**In v1:** everything in §§4–13 (including §8b progression), plus onboarding (profile seed, settings, crisis contacts, templates seeded from the 4-week program), Templates editor, History screen (past days: plan, check-ins, digests, letters), Settings, Export. Minimal training: training blocks carry the day's session as a checklist.

**Visual design:** a dedicated design pass with the `impeccable` skill happens early in the build plan, before screens are implemented. Calm, focused, low-stimulation, fast one-thumb use on iPhone.

**Not in v1 (later sub-projects, each with its own spec):**
1. Full trainer — set/rep logging, progression, PRs, the program's Sunday tracking.
2. Daily knowledge — one lesson a day (psychology, ethics, how the world works), offered inside rest blocks as an alternative to scrolling.
3. Football analytics path — skill tree toward top-tier analytics roles, linked to portfolio projects.
4. Mentor "search my past", charts and trend dashboards.

## 15. To verify during planning

These are facts to confirm, not open design questions:
- `pg_cron` + `pg_net` availability and limits on the Supabase free tier; free-project pause policy.
- Vercel Hobby limits for a once-per-minute route invocation.
- iOS Web Push behavior for Home Screen web apps (notification actions support, permission flow).
- Current Anthropic pricing for the configured model (for `costUsd`).
