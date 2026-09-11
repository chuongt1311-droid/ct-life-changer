# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js + TypeScript, installed on iPhone as a home-screen web app (PWA) and used in the laptop browser; hosted on Vercel, data in Supabase. Approved as "Approach A" in `docs/superpowers/specs/2026-09-11-daily-loop-design.md`. The pure domain core (`src/core/`) is built; the Next.js app arrives in Plan 3.

## Users

One user: CT, the owner. Heavy ADHD. Wants military-style structure but has a schedule that constantly has to change because of outside factors. Swings between two failure modes: grinding into burnout, and rotting in pleasure (gaming, social media) and not coming back to work after a rest. Aiming for a career in top-tier football analytics; follows a recovery-focused calisthenics program.

## Product Purpose

**Life Changer** is a companion and mentor that keeps CT structured, remembers CT's real life, and protects the balance between ambition and happiness. Sub-project 1, the Daily Loop: morning check-in → a day plan built around anchors that rebuilds itself when the day changes → planned rest with a re-entry ramp → evening check-in → an adaptive Claude mentor that reads the history and remembers.

Success after 4 weeks (spec §2): used on ≥5 of 7 days; ≥5 nights of 7h+ sleep and fewer Depleted/Drifting days; ≥70% of rest blocks followed by a return within 10 minutes; visible weekly progress in training and football analytics.

## Positioning

Not a tracker: a mentor that changes the plan, and CT's life played as a **career mode** (spec §8b). Real logged work grows a player card: an OVR and six 0–99 attributes (Physical, Recovery, Analytics, Discipline, Mentality, Character), with tiered badges and a weekly development report. Deterministic planning and a rule-based burnout guard (Ready / Drifting / Depleted / Grinding) do the reliable work, and the guard is written into the game: recovery earns XP, and grinding while depleted shows "Fatigued" or "Injury risk" instead of rewards. Claude supplies judgment and memory.

## Operating Context

- **Morning:** a nudge at wake time, a check-in under 60 s (sleep, energy, mood, stress), then a mentor briefing.
- **During the day:** the Today screen is opened in passing, often one-handed. Transition nudges fire at block ends. "Day changed" rebuilds the plan after a disruption. "Start rest" begins a planned pleasure block.
- **Rest end:** a re-entry ramp (stand up, water, first 2 minutes of the next block).
- **Evening, near bedtime:** a check-in of about 3 minutes in six skippable sections, often **in a dark room** (confirmed), then the mentor's evening review and a wind-down reminder.
- **Sunday:** a weekly letter from the mentor.
- Push notifications are the main way the app reaches CT; everything else is opened on demand.

## Capabilities and Constraints

- The spec is authoritative: `docs/superpowers/specs/2026-09-11-daily-loop-design.md`.
- Terms: **anchor** (a block the planner never drops), **block**, **reflow / Day changed**, **rest block**, **re-entry ramp**, **guard state** (Ready, Drifting, Depleted, Grinding), **check-in**, **digest**, **weekly letter**, **"just for me"** (private, never sent to Claude).
- Form sections: Body, Mind, Work & growth, Pleasure, People & connections, Reflection.
- Plans and guard adjustments can always be overridden with one tap.
- Nudges: at most 8 a day, none during sleep, paused after a welcome-back until CT returns.
- The mentor is a coach, not a therapist or doctor; crisis contacts are shown when needed.
- **Language (inferred, not confirmed):** English interface. Whether the mentor should also answer in other languages is **undecided**.

## Brand Commitments

- Name: **Life Changer**, both on the home screen and inside the app (confirmed).
- Voice: short; one clear next action; progress made visible; **no shame language, no streaks, no guilt**. The mentor's tone follows the guard state: firm coach (Ready), drill sergeant (Drifting), protective (Depleted), blunt about burnout (Grinding).
- **Career-mode gamification is CT's explicit choice** (2026-09-11, reversing an earlier "gamified feels wrong" answer). References to mix: EA FC Player Career (player card, OVR, attributes), NBA 2K MyCareer (Bronze → Hall of Fame badges), Football Manager (development reports). Binding guardrails: attributes and badges never decrease; badges count totals, never streaks; no login rewards, random loot, leaderboards, or XP in notifications; one short celebration per new badge tier.

## Evidence on Hand

- `C:\Users\admin\Downloads\4-Week-Program-REVISED.md`: the calisthenics program (Mon push + neck, Tue handstand/recovery, Wed legs + core + neck, Thu pull, Fri–Sun rest; sleep and stress protocols). It supplies training-block content.
- CT's football analytics portfolio in `D:\CT's Portfolio` (FPL Pipeline, xT and VAEP work, football-capture, Scouting App, Penalty research), referenced in the evening form.
- No logo, brand assets, or visual references exist yet. None may be invented as if they were existing brand.

## Product Principles

1. **Structure that bends, never breaks.** When the day changes, the plan changes with it, and CT sees exactly what moved and why.
2. **Protect both edges.** Guard against burnout and against rotting with equal weight.
3. **Zero shame.** Missed days are unknown, not failures; progress only accumulates, and the app welcomes CT back rather than punishing absence.
4. **Earned, not farmed.** Every point of progression comes from real logged life, and resting when depleted is worth more than grinding.
5. **Reliable first, clever second.** Schedules, nudges and the guard work without AI; the mentor adds judgment on top.
6. **Seconds, not minutes.** Every daily interaction is built for one thumb and the lowest possible effort.

## Accessibility & Inclusion

- ADHD-first: minimal cognitive load per screen, one obvious next action, working memory kept on screen, progress visible.
- **Late-night use in a dark room** (confirmed): evening screens must be comfortable in the dark and must not work against winding down for sleep.
- Low stimulation overall; nothing should reward compulsive checking.
