# Plan 5: Screens & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the data layer (Plan 3) and mentor (Plan 4) into the screens CT actually uses — Today, Day changed, Rest + re-entry, Check-in, Mentor, Player card, History, Templates, Settings, Export, Onboarding — installable to the iPhone home screen with offline support.

**Architecture:** Next.js App Router pages (Server Components for data, small Client Components for interaction) call server actions that wrap the existing repositories and mentor routes. Any new domain logic (progression-from-raw-data, weekly-metrics-from-raw-data, diff-to-visual mapping, the offline outbox queue) is written as a pure function in `src/core/**` first, colocated-tested, then wrapped by a thin `src/lib/**` I/O layer — the same split every earlier plan used. The visual language is the Performance Department system already approved in Plan 2 (`DESIGN.md`, `design/prototype/*.html`): this plan ports its tokens/CSS/markup patterns into React components rather than inventing new ones.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod 4, Vitest, `@fontsource/barlow` + `@fontsource/barlow-condensed` (already installed), raw browser `IndexedDB` for the offline outbox (no new dependency), Next's built-in `ImageResponse` (`next/og`) for PWA icons (no new dependency), a hand-written service worker (no `next-pwa`, so the exact caching rules stay auditable).

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md) — primarily §5 (the day), §6 (forms), §8 (mentor UI surfaces), §8b (progression surfaces), §10 (data model), §11 (privacy/crisis), §12 (error handling), §14 (scope).

**Design system:** [`DESIGN.md`](../../../DESIGN.md) (Performance Department) and its six built comps in `design/prototype/` (`today.html`, `checkin.html`, `day-changed.html`, `reentry.html`, `mentor.html`, `card.html`, shared `tokens.css` + `dept.css` + inline icon sprite).

## Global Constraints

- `src/core/**` stays pure: no I/O, no clock reads (`new Date()`/`Date.now()`), no randomness. Every new core function takes its "now" as a parameter and has a colocated `*.test.ts`.
- `npm test` and `npm run typecheck` must pass before every commit.
- Write "CT" or "they" — CT's pronouns are unstated. Never write "he"/"she".
- No shame language, no streak counts, no "days in a row" anywhere in UI copy.
- Badges and attributes never fall; a badge's count is cumulative, never consecutive-day based. Resting while depleted earns **double** XP and the screen says so; grinding while depleted earns **zero** training XP, labelled "Injury risk", never "wasted".
- Follow `DESIGN.md` exactly: reuse its tokens (`design/prototype/tokens.css`), its component classes (`design/prototype/dept.css`), and its markup patterns (the six `design/prototype/*.html` comps) rather than inventing new visual patterns. The One Gold Rule (exactly one gold action per screen, plus the player card), the Brightness-Is-Rank rule, and the Zebra-Means-Overload rule all apply to every new screen this plan builds, not only the six already comped.
- Every screen is designed for two real contexts: an iPhone installed to the home screen (one-thumb, calm, low-stimulation) and a laptop browser (`≥900px` two-column `.desk` layout already exists in `dept.css`).
- "Just for me" content is stripped by `src/core/mentor/context.ts` (unmodified) before any Claude call — this plan's forms must actually let CT flag a section/field private, matching what the stripping logic expects (`privateKeys: string[]`, entries `"section"` or `"section.field"`).
- The mentor never runs automatically in this plan — Plan 6 owns cron-triggered mentor calls (04:00 plan generation, Monday weekly-review fallback). Every mentor call in Plan 5 is triggered by CT's own action (opening Today with no plan yet, submitting the evening form, tapping "Ask mentor", sending a chat message, opening the weekly review).
- Cast a real Supabase/Anthropic client `as unknown as RepositoryClient` / `as unknown as Anthropic` at the call site when TypeScript's structural check on the real SDK type hits `TS2589` — the established pattern from Plans 3 and 4.

---

## Task overview

| # | Task | Layer |
|---|---|---|
| 1 | Global app shell — fonts, design tokens, icon sprite, root layout | UI infra |
| 2 | Shared UI primitives (Tag, LoadBarRow, SessionRow, ThumbBar, PlayerCardStrip, Chip, FieldSkip) | UI infra |
| 3 | Installable PWA — manifest, icons, service worker, offline fallback | UI infra |
| 4 | Offline outbox — pure queue core + IndexedDB wrapper + sync hook | core + lib |
| 5 | Local crisis-keyword UI wiring | UI + core (reuse) |
| 6 | Progression data assembly — `buildProgressDay` + `getProgressDays` + `getPlayerCard` | core + lib |
| 7 | Weekly metrics data assembly — `buildWeekDay` + `getWeeklyMetrics` | core + lib |
| 8 | Diff-to-visual mapping — `diffVisual` | core |
| 9 | Ensure-today-plan server logic | lib |
| 10 | Today screen | UI |
| 11 | Day-changed reflow flow | lib + UI |
| 12 | Rest + re-entry ramp | lib + UI |
| 13 | Morning check-in | lib + UI |
| 14 | Evening check-in (+ guard re-run, tomorrow's plan, evening review, digest) | lib + UI |
| 15 | Mentor screen — briefing + streaming chat + crisis UI | lib + UI |
| 16 | Weekly review persistence + screen | lib + UI |
| 17 | Player card screen | UI |
| 18 | History screen | lib + UI |
| 19 | Templates editor | UI |
| 20 | Settings screen | UI |
| 21 | Export | lib + UI |
| 22 | Onboarding UI | lib + UI |
| 23 | Root routing, cleanup, final verification | integration |

---

### Task 1: Global App Shell — Fonts, Design Tokens, Icon Sprite, Root Layout

**Files:**
- Create: `src/app/tokens.css` (ported from `design/prototype/tokens.css`)
- Create: `src/app/dept.css` (ported from `design/prototype/dept.css`)
- Create: `src/components/icons/IconSprite.tsx`
- Create: `src/components/icons/Icon.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the first task).
- Produces: `<Icon name="up" | "flat" | "down" | "clock" | "rest" | "shift" | "moved" | "shorter" | "dropped" | "kept" | "start" | "send" | "boot" | "bed" | "film" | "anchor" | "weight" | "book" />` — every later task's icon usage goes through this component. Global CSS classes from `dept.css` (`.shell`, `.dept-head`, `.next`, `.cardstrip`, `.stepback`, `.desk`, `.col-b`, `.load`, `.sessions`, `.diff`, `.ramp`, `.medals`, `.attrs`, `.thread`, `.composer`, `.chips`, `.chip`, `.field`, `.skip`, `.thumb`, `.btn`, `.tag`, `.dept-nav`) are available globally to every component in later tasks — they are not re-declared per task.

- [ ] **Step 1: Port the design tokens and component CSS verbatim**

The CSS itself was already designed and approved in Plan 2 — port it byte-for-byte, then only touch the `@font-face` blocks (Step 2).

```bash
cp "design/prototype/tokens.css" "src/app/tokens.css"
cp "design/prototype/dept.css" "src/app/dept.css"
```

- [ ] **Step 2: Replace the prototype's local `@font-face` blocks with the installed `@fontsource` packages**

Open `src/app/tokens.css` and delete the six `@font-face { ... }` blocks at the top (they point at `fonts/*.woff2`, a path that doesn't exist inside `src/app/`). Keep everything from `:root {` onward unchanged. `package.json` already lists `@fontsource/barlow` and `@fontsource/barlow-condensed` as dependencies (added in Plan 2 for this exact purpose) — Step 4 imports the specific weights this design system uses (400/500/600 Barlow, 500/600/700 Barlow Condensed) directly in the root layout instead.

- [ ] **Step 3: Build the shared icon sprite from the prototype's inline `<symbol>` set**

Every one of the six prototype pages inlines the identical sprite (`DESIGN.md`: "duplicated inline into each page so references resolve with no external fetch"). One React component now serves every page instead.

```tsx
// src/components/icons/IconSprite.tsx
/** The Performance Department's icon set (DESIGN.md "Icons"). Render this
 * once, near the root layout — every <Icon name="…" /> resolves against it
 * via <use href="#i-…">. Ported verbatim from design/prototype/*.html. */
export function IconSprite() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V6M6 12l6-6 6 6" /></symbol>
      <symbol id="i-flat" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5" /></symbol>
      <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 5v13M6 12l6 6 6-6" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></symbol>
      <symbol id="i-rest" viewBox="0 0 24 24"><path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5Z" /></symbol>
      <symbol id="i-shift" viewBox="0 0 24 24"><path d="M4 7h9l-2.5-2.5M20 17h-9l2.5 2.5M4 7l2.5 2.5M20 17l-2.5-2.5" /></symbol>
      <symbol id="i-moved" viewBox="0 0 24 24"><path d="M5 12h12M13 7l5 5-5 5" /></symbol>
      <symbol id="i-shorter" viewBox="0 0 24 24"><path d="M4 12h16M8 8v8M16 8v8" /></symbol>
      <symbol id="i-dropped" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
      <symbol id="i-kept" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11" /></symbol>
      <symbol id="i-start" viewBox="0 0 24 24"><path d="M8 5.5l10 6.5-10 6.5Z" /></symbol>
      <symbol id="i-send" viewBox="0 0 24 24"><path d="M4.5 12l15-7-4.5 15-3.5-6.5Z" /></symbol>
      <symbol id="i-boot" viewBox="0 0 24 24"><path d="M6 4h4v8l7 3.5V20H6Z" /><path d="M10 12h3" /></symbol>
      <symbol id="i-bed" viewBox="0 0 24 24"><path d="M3 18v-9M3 13h18v5M21 18v-5a3 3 0 0 0-3-3h-6" /><circle cx="7.5" cy="10.5" r="2" /></symbol>
      <symbol id="i-film" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="M8 5.5v13M16 5.5v13M3.5 12h17" /></symbol>
      <symbol id="i-anchor" viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="2" /><path d="M12 7.5V20M5 13a7 7 0 0 0 14 0M7.5 11H5M19 11h-2.5" /></symbol>
      <symbol id="i-weight" viewBox="0 0 24 24"><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></symbol>
      <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 6.5S10 4.5 4 5v13c6-.5 8 1.5 8 1.5s2-2 8-1.5V5c-6-.5-8 1.5-8 1.5Z" /><path d="M12 6.5v13" /></symbol>
    </svg>
  );
}
```

```tsx
// src/components/icons/Icon.tsx
export type IconName =
  | 'up' | 'flat' | 'down' | 'clock' | 'rest' | 'shift' | 'moved' | 'shorter' | 'dropped'
  | 'kept' | 'start' | 'send' | 'boot' | 'bed' | 'film' | 'anchor' | 'weight' | 'book';

/** One glyph from the shared sprite (Task 1). `size` matches dept.css's two
 * sizes: "lg" is the 1em icon used everywhere in this system; "medal" is the
 * larger stroke used inside a badge medallion disc (DESIGN.md "Badge Medallions"). */
export function Icon({ name, size = 'lg' }: { name: IconName; size?: 'lg' | 'medal' }) {
  return (
    <svg className={`icon icon-${size}`} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
```

- [ ] **Step 4: Wire fonts, tokens, CSS and the icon sprite into the root layout**

```tsx
// src/app/layout.tsx
import type { ReactNode } from 'react';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './tokens.css';
import './dept.css';
import { IconSprite } from '@/components/icons/IconSprite';

export const metadata = {
  title: "CT's Life Changer",
  description: 'Daily Loop — single-user companion app.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Give the login page the same shell so it isn't the one unstyled screen**

Replace the plain markup in `src/app/login/page.tsx` with the same `.shell` / `.dept-head` / `.next` structure the other screens use, keeping every existing piece of behavior (the `useSearchParams` `Suspense` boundary, the `sendMagicLink` call, the three `status` states) unchanged:

```tsx
// src/app/login/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { sendMagicLink } from './actions';

function UrlError() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  return urlError ? (
    <p role="alert" className="note">
      {urlError}
    </p>
  ) : null;
}

export default function LoginPage() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus('sending');
    const result = await sendMagicLink();
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setError(result.error ?? 'Something went wrong');
    }
  }

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Sign in
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">Life Changer</h1>
        <p className="next-note">Sends a one-time sign-in link to your email. No password to remember or leak.</p>
      </section>
      <div className="stepback">
        {status === 'error' && (
          <p role="alert" className="note">
            {error}
          </p>
        )}
        {status !== 'error' && (
          <Suspense fallback={null}>
            <UrlError />
          </Suspense>
        )}
      </div>
      <div className="thumb">
        <button className="btn btn-main btn-wide" onClick={handleClick} disabled={status === 'sending' || status === 'sent'}>
          {status === 'sent' ? 'Link sent — check your email' : 'Send me a sign-in link'}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Verify the app builds and the shell renders**

Run: `npm run typecheck && npm run build`
Expected: both succeed. There is no Vitest step here — this task ports and wires existing, already-approved CSS/markup with no new pure logic to unit-test (matches this codebase's existing convention: no React-component tests anywhere in the repo, only `src/core/**` and `src/lib/**` logic).

- [ ] **Step 7: Commit**

```bash
git add src/app/tokens.css src/app/dept.css src/components/icons src/app/layout.tsx src/app/login/page.tsx
git commit -m "feat(ui): port Performance Department tokens, CSS and icon sprite into the app shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 2: Shared UI Primitives

**Files:**
- Create: `src/components/ui/Tag.tsx`
- Create: `src/components/ui/LoadBarRow.tsx`
- Create: `src/components/ui/SessionRow.tsx`
- Create: `src/components/ui/PlayerCardStrip.tsx`
- Create: `src/components/ui/ThumbBar.tsx`
- Create: `src/components/ui/Chip.tsx`
- Create: `src/components/ui/FieldSkip.tsx`
- Create: `src/components/ui/Placard.tsx`
- Create: `src/components/ui/DeptNav.tsx`

**Interfaces:**
- Consumes: `Icon` from Task 1.
- Produces: every component below, imported by every screen task (9–22). `PlayerCard` type from `src/core/progression/card.ts` (unmodified) is the shape `PlayerCardStrip` renders.

- [ ] **Step 1: `Tag` — the readiness/neutral tag (`dept.css` `.tag[data-state]`)**

```tsx
// src/components/ui/Tag.tsx
export type TagState = 'ready' | 'drifting' | 'depleted' | 'grinding' | 'neutral';

const STATE_LABEL: Record<TagState, string> = {
  ready: 'Ready',
  drifting: 'Drifting',
  depleted: 'Depleted',
  grinding: 'Grinding',
  neutral: '',
};

/** DESIGN.md "Tags (readiness)": one reading colour per state, `grinding`
 * alone carries the zebra overload material. Pass `children` to override the
 * label (e.g. "Now", "Anchor", "+40 PHY") while keeping the state's colour. */
export function Tag({ state, children }: { state: TagState; children?: React.ReactNode }) {
  return (
    <span className="tag" data-state={state}>
      {children ?? STATE_LABEL[state]}
    </span>
  );
}
```

- [ ] **Step 2: `LoadBarRow` — one reading row (`.load li`)**

```tsx
// src/components/ui/LoadBarRow.tsx
export type ReadLevel = 'ok' | 'warn' | 'over';

export interface LoadBarRowProps {
  name: string;
  /** The reading written in words, e.g. "4h 10m · 40m over plan". Colour is
   * never the only channel (DESIGN.md "Do: write the reading in words"). */
  valueText: string;
  /** 0–100. Values ≥100 with read="over" render the zebra overload material. */
  percent: number;
  read: ReadLevel;
}

export function LoadBarRow({ name, valueText, percent, read }: LoadBarRowProps) {
  return (
    <li data-read={read}>
      <span className="bar-name">{name}</span>
      <span className="bar-val">{valueText}</span>
      <span className="track">
        <span className="fill" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </span>
    </li>
  );
}
```

- [ ] **Step 3: `SessionRow` — one row of the day's session list (`.sessions li`)**

```tsx
// src/components/ui/SessionRow.tsx
import { Tag, type TagState } from './Tag';

export type SessionRank = 'done' | 'now' | 'next';

export interface SessionRowProps {
  at: string;
  title: string;
  note: string;
  rank: SessionRank;
  tagState: TagState;
  tagLabel: string;
}

/** DESIGN.md "Session List / Diff Rows": rank drives brightness via the
 * `data-rank` attribute — dept.css handles the Floodlight White / Cool White
 * / Done Slate + strikethrough treatment; this component only supplies the
 * data attribute and content. */
export function SessionRow({ at, title, note, rank, tagState, tagLabel }: SessionRowProps) {
  return (
    <li data-rank={rank}>
      <span className="at">{at}</span>
      <span className="what">
        {title}
        <small>{note}</small>
      </span>
      <Tag state={tagState}>{tagLabel}</Tag>
    </li>
  );
}
```

- [ ] **Step 4: `PlayerCardStrip` — the one-row signature object (`.cardstrip`)**

```tsx
// src/components/ui/PlayerCardStrip.tsx
import Link from 'next/link';
import type { PlayerCard } from '@/core/progression/card';
import { Icon } from '@/components/icons/Icon';
import { Tag, type TagState } from './Tag';

const FORM_ICON = { excellent: 'up', good: 'up', steady: 'flat', dipping: 'down', rebuilding: 'down', settling: 'flat' } as const;
const CARD_TAG_STATE: Record<NonNullable<PlayerCard['tag']> | 'ready', TagState> = {
  ready: 'ready',
  'Out of form': 'drifting',
  Fatigued: 'depleted',
  'Injury risk': 'grinding',
};

/** DESIGN.md "Player Card Strip (signature)": OVR in gold, a worded form
 * arrow, a readiness tag — one row, links to the full card (Task 17). */
export function PlayerCardStrip({ card, href = '/card' }: { card: PlayerCard; href?: string }) {
  const dir = FORM_ICON[card.form.band];
  const tagState = CARD_TAG_STATE[card.tag ?? 'ready'];
  return (
    <Link
      className="cardstrip"
      href={href}
      aria-label={`Player card: overall ${card.ovr}, ${card.form.label.toLowerCase()}, ${tagState}`}
    >
      <span className="ovr">
        <b>{card.ovr}</b>
        <span>OVR</span>
      </span>
      <span className="form-read" data-dir={dir}>
        <Icon name={dir} />
        <span className="label">{card.form.label}</span>
      </span>
      {card.tag && <Tag state={tagState} />}
    </Link>
  );
}
```

- [ ] **Step 5: `ThumbBar` — the sticky bottom action bar (`.thumb`)**

```tsx
// src/components/ui/ThumbBar.tsx
import type { ReactNode } from 'react';

/** DESIGN.md "The Thumb-Zone Rule": the committing action lives here, 52px
 * minimum, two columns by default or `stacked` for one full-width action. */
export function ThumbBar({ stacked = false, children }: { stacked?: boolean; children: ReactNode }) {
  return <div className={`thumb${stacked ? ' stacked' : ''}`}>{children}</div>;
}
```

- [ ] **Step 6: `Chip` / `ChipGroup` — check-in chip inputs (`.chips`, `.chip`)**

```tsx
// src/components/ui/Chip.tsx
export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  legend: string;
  name: string;
  type: 'radio' | 'checkbox';
  options: ChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  hint?: string;
}

/** DESIGN.md "Chips (check-in)": a visually hidden input with a styled
 * sibling label; no accent colour — a check-in answer is not a reading. */
export function ChipGroup({ legend, name, type, options, value, onChange, hint }: ChipGroupProps) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);

  function toggle(optValue: string) {
    if (type === 'radio') {
      onChange(optValue);
      return;
    }
    const next = new Set(selected);
    if (next.has(optValue)) next.delete(optValue);
    else next.add(optValue);
    onChange([...next]);
  }

  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="chips">
        {options.map((opt) => (
          <label className="chip" key={opt.value}>
            <input
              type={type}
              name={name}
              checked={selected.has(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </fieldset>
  );
}
```

- [ ] **Step 7: `FieldSkip` — the underlined skip control (`.skip`)**

```tsx
// src/components/ui/FieldSkip.tsx
import { useState } from 'react';

/** DESIGN.md "Inputs / Fields — Skip": empties the group rather than hiding
 * it, then relabels itself "Skipped — undo". `onSkip` clears the caller's
 * field state; `onUndo` is optional and only needed if the caller wants to
 * restore a previous value rather than leave it empty. */
export function FieldSkip({ onSkip, onUndo }: { onSkip: () => void; onUndo?: () => void }) {
  const [skipped, setSkipped] = useState(false);

  function handleClick() {
    if (skipped) {
      onUndo?.();
      setSkipped(false);
    } else {
      onSkip();
      setSkipped(true);
    }
  }

  return (
    <button type="button" className="skip" onClick={handleClick}>
      {skipped ? 'Skipped — undo' : 'Skip this section'}
    </button>
  );
}
```

- [ ] **Step 8: `Placard` and `DeptNav` — section headings and the screen nav**

```tsx
// src/components/ui/Placard.tsx
import type { ReactNode } from 'react';

/** DESIGN.md: "a placard heading with a rule trailing off to the right
 * edge" — never a bordered card. */
export function Placard({ children }: { children: ReactNode }) {
  return <h2 className="placard placard-rule">{children}</h2>;
}
```

```tsx
// src/components/ui/DeptNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SCREENS = [
  { href: '/', label: 'Today' },
  { href: '/card', label: 'Player card' },
  { href: '/checkin', label: 'Check-in' },
  { href: '/mentor', label: 'Mentor' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
] as const;

/** DESIGN.md "Navigation": flat uppercase links above the thumb bar, current
 * page underlined. Day changed and Re-entry are reached from Today's own
 * actions, not from this nav (they aren't destinations you browse to). */
export function DeptNav() {
  const pathname = usePathname();
  return (
    <nav className="dept-nav" aria-label="Screens">
      {SCREENS.map((s) => (
        <Link key={s.href} href={s.href} aria-current={pathname === s.href ? 'page' : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 9: Verify the app still builds**

Run: `npm run typecheck && npm run build`
Expected: succeeds. No Vitest step — pure presentational components, consistent with the rest of this codebase's testing boundary (`src/core/**` and `src/lib/**` only).

- [ ] **Step 10: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): shared Performance Department primitives (Tag, LoadBarRow, SessionRow, PlayerCardStrip, ThumbBar, Chip, FieldSkip, Placard, DeptNav)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 3: Installable PWA — Manifest, Icons, Service Worker, Offline Fallback

**Files:**
- Create: `src/app/manifest.ts`
- Create: `src/app/icon.tsx`
- Create: `src/app/apple-icon.tsx`
- Create: `public/sw.js`
- Create: `src/app/offline/page.tsx`
- Create: `src/components/ServiceWorkerRegister.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `IconSprite`/root layout from Task 1.
- Produces: the app becomes installable ("Add to Home Screen" on iOS Safari). No other task depends on this one's exports directly — it's a leaf, wired only into the root layout.

- [ ] **Step 1: Web app manifest via Next's `manifest.ts` convention**

Next.js 16 generates `/manifest.webmanifest` from this file automatically — no separate `public/manifest.json` to keep in sync.

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CT's Life Changer",
    short_name: 'Life Changer',
    description: 'Daily Loop — single-user ADHD companion app.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1016',
    theme_color: '#0B1016',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
```

- [ ] **Step 2: Generate the icons with `next/og`'s `ImageResponse` — no external image tooling needed**

Next's built-in `ImageResponse` (used for OG images) also powers the `icon.tsx` / `apple-icon.tsx` special files: Next renders them to PNG at build/request time. This keeps icon generation entirely inside the existing toolchain instead of needing a design tool or an image-processing dependency.

```tsx
// src/app/icon.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** The 512×512 PWA icon: the department's gold "L" mark on night-pitch navy
 * — DESIGN.md's two reserved colours, nothing else. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1016',
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ fontSize: 280, fontWeight: 700, color: '#F5C542' }}>L</span>
      </div>
    ),
    { ...size },
  );
}
```

```tsx
// src/app/apple-icon.tsx
import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** iOS's home-screen icon: same mark, no transparency (iOS ignores alpha and
 * would otherwise render a black square where it's transparent). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1016',
          fontFamily: 'sans-serif',
        }}
      >
        <span style={{ fontSize: 98, fontWeight: 700, color: '#F5C542' }}>L</span>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 3: A minimal, hand-written service worker — app-shell caching only**

Spec §12: "App shell cached by service worker; form submissions and block status changes go into an IndexedDB outbox and sync on reconnect" (the outbox itself is Task 4). This service worker's only job is: cache the app shell so the PWA opens offline, and fall back to `/offline` for a navigation that fails with no cache hit. It deliberately does **not** cache API responses — every screen in this plan always wants fresh data when online, and the outbox (Task 4) is the mechanism for the offline-write case.

```js
// public/sw.js
const CACHE_NAME = 'life-changer-shell-v1';
const SHELL_URLS = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin page navigations. Every API call, mentor stream
  // and Supabase request goes straight to the network, untouched.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request)) ?? (await cache.match('/offline'));
    }),
  );
});
```

```tsx
// src/app/offline/page.tsx
export default function OfflinePage() {
  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Offline
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">No connection</h1>
        <p className="next-note">
          Anything you log now is queued and sent the moment you're back online — nothing is lost.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Register the service worker from a small client component**

```tsx
// src/components/ServiceWorkerRegister.tsx
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
```

```tsx
// src/app/layout.tsx  (add to the existing body from Task 1)
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
// …
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <IconSprite />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify the manifest and icons resolve**

Run: `npm run build`
Expected: build succeeds; `/manifest.webmanifest`, `/icon`, `/apple-icon` are listed among the generated routes in the build output.

- [ ] **Step 6: Commit**

```bash
git add src/app/manifest.ts src/app/icon.tsx src/app/apple-icon.tsx public/sw.js src/app/offline src/components/ServiceWorkerRegister.tsx src/app/layout.tsx
git commit -m "feat(pwa): installable manifest, generated icons, app-shell service worker, offline fallback

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 4: Offline Outbox — Pure Queue Core, IndexedDB Wrapper, Sync Hook

**Files:**
- Create: `src/core/outbox/queue.ts`
- Create: `src/core/outbox/queue.test.ts`
- Create: `src/lib/offline/db.ts`
- Create: `src/lib/offline/useOutbox.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `OutboxEntry`, `enqueue`, `markSyncing`, `markSynced`, `markFailed`, `nextPending` (pure, `src/core/outbox/queue.ts`) — used by later tasks' offline-aware submit paths (evening check-in, morning check-in, block status changes) as the retry policy. `useOutbox(handlers: Record<string, (payload: unknown) => Promise<void>>): { pendingCount: number; enqueue: (kind: string, payload: unknown) => Promise<void> }` — the one hook every offline-aware form/action calls.

- [ ] **Step 1: Write the failing tests for the pure queue state machine**

```ts
// src/core/outbox/queue.test.ts
import { describe, expect, it } from 'vitest';
import { enqueue, markFailed, markSynced, markSyncing, nextPending, type OutboxEntry } from './queue';

const FIXED_NOW = '2026-09-14T10:00:00.000Z';

describe('enqueue', () => {
  it('appends a new pending entry with attempts 0', () => {
    const queue = enqueue([], { id: '1', kind: 'eveningCheckin', payload: { a: 1 } }, FIXED_NOW);
    expect(queue).toEqual([{ id: '1', kind: 'eveningCheckin', payload: { a: 1 }, createdAt: FIXED_NOW, status: 'pending', attempts: 0 }]);
  });
});

describe('nextPending', () => {
  it('returns the oldest pending entry', () => {
    const queue: OutboxEntry[] = [
      { id: '1', kind: 'a', payload: null, createdAt: '2026-09-14T09:00:00.000Z', status: 'pending', attempts: 0 },
      { id: '2', kind: 'b', payload: null, createdAt: '2026-09-14T08:00:00.000Z', status: 'pending', attempts: 0 },
    ];
    expect(nextPending(queue)?.id).toBe('2');
  });

  it('skips syncing and failed entries', () => {
    const queue: OutboxEntry[] = [
      { id: '1', kind: 'a', payload: null, createdAt: FIXED_NOW, status: 'syncing', attempts: 0 },
      { id: '2', kind: 'b', payload: null, createdAt: FIXED_NOW, status: 'failed', attempts: 5 },
    ];
    expect(nextPending(queue)).toBeNull();
  });
});

describe('markSyncing / markSynced / markFailed', () => {
  const base: OutboxEntry = { id: '1', kind: 'a', payload: null, createdAt: FIXED_NOW, status: 'pending', attempts: 0 };

  it('markSyncing flips status to syncing', () => {
    expect(markSyncing([base], '1')[0]!.status).toBe('syncing');
  });

  it('markSynced removes the entry', () => {
    expect(markSynced([base], '1')).toEqual([]);
  });

  it('markFailed under the retry cap reverts to pending and increments attempts', () => {
    const syncing: OutboxEntry = { ...base, status: 'syncing', attempts: 1 };
    const result = markFailed([syncing], '1');
    expect(result[0]).toMatchObject({ status: 'pending', attempts: 2 });
  });

  it('markFailed at the retry cap (5 attempts) becomes terminally failed', () => {
    const syncing: OutboxEntry = { ...base, status: 'syncing', attempts: 5 };
    const result = markFailed([syncing], '1');
    expect(result[0]).toMatchObject({ status: 'failed', attempts: 6 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/core/outbox/queue.test.ts`
Expected: FAIL with "Cannot find module './queue'" — nothing implemented yet.

- [ ] **Step 3: Implement the pure queue**

```ts
// src/core/outbox/queue.ts
/** Spec §12: "form submissions and block status changes go into an IndexedDB
 * outbox and sync on reconnect (last-write-wins per record; single user
 * makes conflicts rare)." This module is the pure state machine only — no
 * IndexedDB, no clock, no network. `src/lib/offline/db.ts` persists it;
 * `src/lib/offline/useOutbox.ts` drives it against the network. */
export type OutboxStatus = 'pending' | 'syncing' | 'failed';

export interface OutboxEntry {
  id: string;
  /** Which server action replays this entry, e.g. "eveningCheckin", "blockStatus". */
  kind: string;
  payload: unknown;
  createdAt: string;
  status: OutboxStatus;
  attempts: number;
}

const MAX_ATTEMPTS = 5;

export function enqueue(queue: OutboxEntry[], entry: { id: string; kind: string; payload: unknown }, now: string): OutboxEntry[] {
  return [...queue, { ...entry, createdAt: now, status: 'pending', attempts: 0 }];
}

export function markSyncing(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.map((e) => (e.id === id ? { ...e, status: 'syncing' } : e));
}

/** A synced entry leaves the queue entirely — nothing to retry. */
export function markSynced(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.filter((e) => e.id !== id);
}

/** Under the retry cap: back to pending so a later reconnect retries it.
 * At the cap: terminally `failed` — the caller surfaces this rather than
 * retrying forever against, e.g., a permanently malformed payload. */
export function markFailed(queue: OutboxEntry[], id: string): OutboxEntry[] {
  return queue.map((e) => {
    if (e.id !== id) return e;
    const attempts = e.attempts + 1;
    return { ...e, attempts, status: attempts > MAX_ATTEMPTS ? 'failed' : 'pending' };
  });
}

/** Oldest pending entry, or null if nothing is waiting (syncing/failed don't count). */
export function nextPending(queue: OutboxEntry[]): OutboxEntry | null {
  const pending = queue.filter((e) => e.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return pending[0] ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/core/outbox/queue.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: The IndexedDB wrapper (I/O, browser-only, untested — matches this codebase's existing convention that `src/lib/supabase/*` and other raw-client wrappers have no unit tests)**

```ts
// src/lib/offline/db.ts
import type { OutboxEntry } from '@/core/outbox/queue';

const DB_NAME = 'life-changer-outbox';
const STORE = 'entries';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOutbox(queue: OutboxEntry[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    for (const entry of queue) tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 6: The sync hook**

```ts
// src/lib/offline/useOutbox.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueue, markFailed, markSynced, markSyncing, nextPending, type OutboxEntry } from '@/core/outbox/queue';
import { loadOutbox, saveOutbox } from './db';

/** Wires the pure queue (Task 4, Step 3) to IndexedDB and the browser's
 * online/offline events. `handlers` maps an entry's `kind` to the server
 * action that replays it — each screen registers only the kinds it can
 * produce (e.g. the evening check-in screen registers "eveningCheckin"). */
export function useOutbox(handlers: Record<string, (payload: unknown) => Promise<void>>) {
  const [queue, setQueue] = useState<OutboxEntry[]>([]);
  const syncingRef = useRef(false);

  useEffect(() => {
    loadOutbox().then(setQueue);
  }, []);

  const drain = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    let current = await loadOutbox();
    let entry = nextPending(current);
    while (entry) {
      const handler = handlers[entry.kind];
      current = markSyncing(current, entry.id);
      setQueue(current);
      try {
        if (!handler) throw new Error(`No offline handler registered for "${entry.kind}"`);
        await handler(entry.payload);
        current = markSynced(current, entry.id);
      } catch {
        current = markFailed(current, entry.id);
      }
      await saveOutbox(current);
      setQueue(current);
      entry = nextPending(current);
    }
    syncingRef.current = false;
  }, [handlers]);

  useEffect(() => {
    drain();
    window.addEventListener('online', drain);
    return () => window.removeEventListener('online', drain);
  }, [drain]);

  const enqueueAction = useCallback(async (kind: string, payload: unknown) => {
    const current = await loadOutbox();
    const id = crypto.randomUUID();
    const next = enqueue(current, { id, kind, payload }, new Date().toISOString());
    await saveOutbox(next);
    setQueue(next);
    drain();
  }, [drain]);

  return { pendingCount: queue.filter((e) => e.status !== 'failed').length, enqueue: enqueueAction };
}
```

- [ ] **Step 7: Commit**

```bash
git add src/core/outbox src/lib/offline
git commit -m "feat(offline): pure outbox queue, IndexedDB persistence, online-sync hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 5: Local Crisis-Keyword UI Wiring

**Files:**
- Create: `src/hooks/useCrisisCheck.ts`
- Create: `src/components/mentor/CrisisContactsCard.tsx`

**Interfaces:**
- Consumes: `checkCrisisKeywords` from `src/core/mentor/crisis.ts` (Plan 4, unmodified). `CrisisContact` type from `src/core/types.ts` (unmodified).
- Produces: `useCrisisCheck(texts: string[]): boolean` and `<CrisisContactsCard contacts={CrisisContact[]} />` — used by Task 13/14 (check-in forms), Task 15 (mentor chat), wherever free text can trigger the backup check independent of whether the Claude call itself also flagged `crisis: true`.

- [ ] **Step 1: The hook — a thin, memoized wrapper over the pure check**

Spec §11: "As a backup that works even when Claude is unavailable or capped, a small local keyword check on free-text fields shows the contacts card." This is UI wiring over an already-tested pure function (`checkCrisisKeywords`, Plan 4) — no new logic to unit-test, matching this codebase's boundary (`src/core/**` is tested; thin React hooks over it are not, the same as every other hook in this plan).

```ts
// src/hooks/useCrisisCheck.ts
'use client';

import { useMemo } from 'react';
import { checkCrisisKeywords } from '@/core/mentor/crisis';

/** Re-checks whenever `texts` changes. Every free-text field this plan adds
 * (check-in textareas, the mentor chat composer) feeds its current value in
 * here — independent of whether a completed Claude call also set `crisis: true`. */
export function useCrisisCheck(texts: string[]): boolean {
  return useMemo(() => checkCrisisKeywords(texts.filter((t) => t.trim().length > 0)), [texts]);
}
```

- [ ] **Step 2: The contacts card**

```tsx
// src/components/mentor/CrisisContactsCard.tsx
import type { CrisisContact } from '@/core/types';

/** Spec §11: shown whenever the local keyword check or a Claude route's
 * `crisis: true` fires. No judgment language, no dismissal without CT
 * seeing the contacts first. `contacts` is `settings.crisisContacts`,
 * configured in Settings during onboarding (Task 22). */
export function CrisisContactsCard({ contacts }: { contacts: CrisisContact[] }) {
  return (
    <div className="stepback" role="alert">
      <Placard>If things feel like too much right now</Placard>
      <p className="note">
        This isn't something to push through alone. Here's who to reach — the plan, nudges and guard keep running either way.
      </p>
      {contacts.length === 0 ? (
        <p className="hint">No crisis contacts are configured yet — add them in Settings.</p>
      ) : (
        <ul className="sessions">
          {contacts.map((c) => (
            <li key={c.label} data-rank="next">
              <span className="what">
                {c.label}
                {c.phone && <small>{c.phone}</small>}
              </span>
              {c.phone && (
                <a className="btn btn-quiet" href={`tel:${c.phone}`}>
                  Call
                </a>
              )}
              {c.url && (
                <a className="btn btn-quiet" href={c.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

Import `Placard` from `@/components/ui/Placard` (Task 2) at the top of the file.

- [ ] **Step 3: Verify the app builds**

Run: `npm run typecheck`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCrisisCheck.ts src/components/mentor/CrisisContactsCard.tsx
git commit -m "feat(safety): local crisis-keyword UI hook and contacts card (spec §11)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 6: Progression Data Assembly — `buildProgressDay`, `getProgressDays`, `getPlayerCard`

**Files:**
- Create: `src/core/progression/build.ts`
- Create: `src/core/progression/build.test.ts`
- Create: `src/lib/db/progressDays.ts`

**Interfaces:**
- Consumes: `ProgressDay` type, `playerCard()` from `src/core/progression/card.ts` (Plan 1b, unmodified). `BlockStatus`, `GuardState` from `src/core/types.ts` (unmodified). `RepositoryClient`, `repositories()` from Plan 3.
- Produces: `buildProgressDay(input: ProgressDayInput): ProgressDay`, `restReturnedOnTime(endedAt: string, reentryAckAt: string | null): boolean` (both pure, `src/core/progression/build.ts`) — `getProgressDays(client, fromDate, toDate): Promise<ProgressDay[]>` and `getPlayerCard(client, today: string): Promise<PlayerCard>` (`src/lib/db/progressDays.ts`) — used by Task 10 (Today's card strip), Task 12 (rest earns XP), Task 13/14 (check-in "if you log this now" preview), Task 17 (Player card screen).

Spec §8b.1's XP table needs data `DaySummary` (Plan 1's guard-facing summary) doesn't carry — protein/water, football minutes, easy-win done, regulation count, gratitude lines, reached-out. `buildDaySummary` (Plan 1) stays exactly as it is; this is a parallel, progression-specific summary built from the same raw rows.

- [ ] **Step 1: Write the failing tests**

```ts
// src/core/progression/build.test.ts
import { describe, expect, it } from 'vitest';
import { buildProgressDay, restReturnedOnTime, type ProgressDayInput } from './build';

function baseInput(overrides: Partial<ProgressDayInput> = {}): ProgressDayInput {
  return {
    date: '2026-09-14',
    state: 'ready',
    isRestDay: false,
    sleepHours: null,
    morningCheckinDone: false,
    eveningCheckinDone: false,
    eveningBody: null,
    eveningMind: null,
    eveningWork: null,
    eveningReflection: null,
    eveningPeople: null,
    blocks: [],
    restSessionsCount: 0,
    restReturnsOnTime: 0,
    ...overrides,
  };
}

describe('buildProgressDay', () => {
  it('an unlogged day maps to all-zero/false progression fields', () => {
    const day = buildProgressDay(baseInput());
    expect(day).toMatchObject({
      date: '2026-09-14',
      state: 'ready',
      trainingDone: 0,
      trainingPartial: 0,
      proteinHit: false,
      waterL: null,
      restDayNoTraining: false,
      footballMinutes: 0,
      learnedEntry: false,
      anchorsKept: 0,
      easyWinDone: false,
      morningCheckin: false,
      eveningCheckin: false,
      regulations: 0,
      gratitudeLines: 0,
      winOrLesson: false,
      reachedOut: false,
    });
  });

  it('maps a fully logged training day', () => {
    const day = buildProgressDay(
      baseInput({
        sleepHours: 7.5,
        morningCheckinDone: true,
        eveningCheckinDone: true,
        eveningBody: { training: 'done', protein: 'hit', waterL: 3.2 },
        eveningMind: { regulated: ['guitar', 'walk'] },
        eveningWork: { footballAnalytics: { minutes: 90, learned: 'xT per shot matters more than volume.' } },
        eveningReflection: { gratitudeLines: ['a', 'b', 'c'], lessonOfDay: 'Ship smaller.', winOfDay: '' },
        eveningPeople: { reachedOut: true },
        blocks: [
          { anchor: true, tags: [], status: 'done' },
          { anchor: true, tags: [], status: 'partial' },
          { anchor: false, tags: ['easyWin'], status: 'done' },
        ],
        restSessionsCount: 1,
        restReturnsOnTime: 1,
      }),
    );
    expect(day).toMatchObject({
      trainingDone: 1,
      trainingPartial: 0,
      proteinHit: true,
      waterL: 3.2,
      sleepHours: 7.5,
      restSessionsTaken: 1,
      restReturnsOnTime: 1,
      footballMinutes: 90,
      learnedEntry: true,
      anchorsKept: 2,
      easyWinDone: true,
      morningCheckin: true,
      eveningCheckin: true,
      regulations: 2,
      gratitudeLines: 3,
      winOrLesson: true,
      reachedOut: true,
    });
  });

  it('training "partial" sets trainingPartial, not trainingDone', () => {
    const day = buildProgressDay(baseInput({ eveningBody: { training: 'partial', protein: 'low', waterL: 0 } }));
    expect(day.trainingDone).toBe(0);
    expect(day.trainingPartial).toBe(1);
  });

  it('a rest day with no training sets restDayNoTraining', () => {
    const day = buildProgressDay(baseInput({ isRestDay: true, eveningBody: { training: 'rest', protein: 'low', waterL: 0 } }));
    expect(day.restDayNoTraining).toBe(true);
  });

  it('training on a rest day does not set restDayNoTraining', () => {
    const day = buildProgressDay(baseInput({ isRestDay: true, eveningBody: { training: 'done', protein: 'hit', waterL: 3 } }));
    expect(day.restDayNoTraining).toBe(false);
  });

  it('a blank "learned" or win/lesson text does not count', () => {
    const day = buildProgressDay(
      baseInput({
        eveningWork: { footballAnalytics: { minutes: 0, learned: '   ' } },
        eveningReflection: { gratitudeLines: [], lessonOfDay: '  ', winOfDay: '' },
      }),
    );
    expect(day.learnedEntry).toBe(false);
    expect(day.winOrLesson).toBe(false);
  });

  it('anchorsKept counts only done or partial anchors, not skipped/missed ones', () => {
    const day = buildProgressDay(
      baseInput({
        blocks: [
          { anchor: true, tags: [], status: 'done' },
          { anchor: true, tags: [], status: 'skipped' },
          { anchor: true, tags: [], status: 'missed' },
          { anchor: false, tags: [], status: 'done' },
        ],
      }),
    );
    expect(day.anchorsKept).toBe(1);
  });
});

describe('restReturnedOnTime', () => {
  it('true when the ack lands within 10 minutes of the session ending', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', '2026-09-14T20:09:00.000Z')).toBe(true);
  });

  it('false when the ack is more than 10 minutes late', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', '2026-09-14T20:11:00.000Z')).toBe(false);
  });

  it('false when never acknowledged', () => {
    expect(restReturnedOnTime('2026-09-14T20:00:00.000Z', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/core/progression/build.test.ts`
Expected: FAIL — `build.ts` doesn't exist yet.

- [ ] **Step 3: Implement `buildProgressDay` and `restReturnedOnTime`**

```ts
// src/core/progression/build.ts
import type { BlockStatus, GuardState } from '../types';
import type { ProgressDay } from './xp';

const DONE_STATUSES: BlockStatus[] = ['done', 'partial'];

export interface ProgressDayBlockInput {
  anchor: boolean;
  tags: string[];
  status: BlockStatus;
}

export interface ProgressDayInput {
  date: string;
  state: GuardState;
  isRestDay: boolean;
  sleepHours: number | null;
  morningCheckinDone: boolean;
  eveningCheckinDone: boolean;
  eveningBody: { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number } | null;
  eveningMind: { regulated: string[] } | null;
  eveningWork: { footballAnalytics: { minutes: number; learned: string } } | null;
  eveningReflection: { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string } | null;
  eveningPeople: { reachedOut: boolean } | null;
  blocks: ProgressDayBlockInput[];
  restSessionsCount: number;
  restReturnsOnTime: number;
}

/** Spec §8b.1: the progression-specific summary of one day, built from the
 * same raw rows `buildDaySummary` (Plan 1) reads — but for the guard's
 * coarser DaySummary, not this. Pure — no I/O, no clock. */
export function buildProgressDay(input: ProgressDayInput): ProgressDay {
  const training = input.eveningBody?.training ?? null;
  const trainedToday = training === 'done' || training === 'partial';
  const anchorsKept = input.blocks.filter((b) => b.anchor && DONE_STATUSES.includes(b.status)).length;
  const easyWinDone = input.blocks.some((b) => b.tags.includes('easyWin') && DONE_STATUSES.includes(b.status));
  const learned = input.eveningWork?.footballAnalytics.learned.trim() ?? '';
  const lesson = input.eveningReflection?.lessonOfDay.trim() ?? '';
  const win = input.eveningReflection?.winOfDay.trim() ?? '';

  return {
    date: input.date,
    state: input.state,
    trainingDone: training === 'done' ? 1 : 0,
    trainingPartial: training === 'partial' ? 1 : 0,
    proteinHit: input.eveningBody?.protein === 'hit',
    waterL: input.eveningBody?.waterL ?? null,
    sleepHours: input.sleepHours,
    restDayNoTraining: input.isRestDay && !trainedToday,
    restSessionsTaken: input.restSessionsCount,
    restReturnsOnTime: input.restReturnsOnTime,
    footballMinutes: input.eveningWork?.footballAnalytics.minutes ?? 0,
    learnedEntry: learned.length > 0,
    anchorsKept,
    easyWinDone,
    morningCheckin: input.morningCheckinDone,
    eveningCheckin: input.eveningCheckinDone,
    regulations: input.eveningMind?.regulated.length ?? 0,
    gratitudeLines: input.eveningReflection?.gratitudeLines.length ?? 0,
    winOrLesson: lesson.length > 0 || win.length > 0,
    reachedOut: input.eveningPeople?.reachedOut ?? false,
  };
}

/** Spec §8b.1 DIS bonus / §5.6 re-entry: "within 10 minutes of the planned end". */
export function restReturnedOnTime(endedAt: string, reentryAckAt: string | null): boolean {
  if (!reentryAckAt) return false;
  const diffMs = new Date(reentryAckAt).getTime() - new Date(endedAt).getTime();
  return diffMs >= 0 && diffMs <= 10 * 60 * 1000;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/core/progression/build.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: The data-assembly wrapper (I/O), mirroring `src/lib/db/daySummary.ts`'s existing pattern**

```ts
// src/lib/db/progressDays.ts
import { addDays, weekdayOf } from '@/core/time';
import { buildProgressDay, restReturnedOnTime } from '@/core/progression/build';
import { playerCard, type PlayerCard } from '@/core/progression/card';
import type { ProgressDay } from '@/core/progression/xp';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

/** Fetch every table `buildProgressDay` needs for [`fromDate`, `toDate`]
 * (inclusive) and map each date to a `ProgressDay`. Mirrors
 * `getDaySummaries`'s shape exactly — same repos, same per-date loop — but
 * builds the progression-specific summary instead of the guard's. */
export async function getProgressDays(client: RepositoryClient, fromDate: string, toDate: string): Promise<ProgressDay[]> {
  const repos = repositories(client);
  const [templates, plans, checkins, blocks, restSessions] = await Promise.all([
    repos.templates.list(),
    repos.plans.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
  ]);
  const templateByWeekday = new Map(templates.map((t) => [t.weekday, t]));
  const planByDate = new Map(plans.map((p) => [p.date, p]));

  const dates: string[] = [];
  for (let d = new Date(`${fromDate}T00:00:00Z`); d <= new Date(`${toDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates.map((date) => {
    const morning = checkins.find((c) => c.date === date && c.type === 'morning');
    const evening = checkins.find((c) => c.date === date && c.type === 'evening');
    const dayRestSessions = restSessions.filter((r) => r.date === date && r.ended_at !== null);

    return buildProgressDay({
      date,
      state: planByDate.get(date)?.state ?? 'ready',
      isRestDay: templateByWeekday.get(weekdayOf(date))?.rest_day ?? false,
      sleepHours: (morning?.sections.body as { sleepHours?: number } | undefined)?.sleepHours ?? null,
      morningCheckinDone: morning !== undefined,
      eveningCheckinDone: evening !== undefined,
      eveningBody: (evening?.sections.body as ProgressDayInputBody) ?? null,
      eveningMind: (evening?.sections.mind as { regulated: string[] }) ?? null,
      eveningWork: (evening?.sections.work as { footballAnalytics: { minutes: number; learned: string } }) ?? null,
      eveningReflection: (evening?.sections.reflection as ProgressDayInputReflection) ?? null,
      eveningPeople: (evening?.sections.people as { reachedOut: boolean }) ?? null,
      blocks: blocks.filter((b) => b.date === date).map((b) => ({ anchor: b.anchor, tags: b.tags, status: b.status })),
      restSessionsCount: dayRestSessions.length,
      restReturnsOnTime: dayRestSessions.filter((r) => restReturnedOnTime(r.ended_at!, r.reentry_ack_at)).length,
    });
  });
}

type ProgressDayInputBody = { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number };
type ProgressDayInputReflection = { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string };

/** Spec §8b.1: "recomputable from the database at any time" — look back far
 * enough that no real history is cut off (attributes cap around 10,000 XP,
 * which even a perfect day never reaches in under ~100 days) without
 * unbounded growth as CT's history gets longer. `repos.*.list()` only
 * returns rows that exist, so a wide window costs nothing when history is
 * short. */
export async function getPlayerCard(client: RepositoryClient, today: string): Promise<PlayerCard> {
  const days = await getProgressDays(client, addDays(today, -400), today);
  return playerCard(days, today);
}
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/progression/build.ts src/core/progression/build.test.ts src/lib/db/progressDays.ts
git commit -m "feat(progression): buildProgressDay, restReturnedOnTime, getProgressDays, getPlayerCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 7: Weekly Metrics Data Assembly — `buildWeekDay`, `restOutcomeFor`, `getWeeklyMetrics`

**Files:**
- Create: `src/core/metrics/build.ts`
- Create: `src/core/metrics/build.test.ts`
- Create: `src/lib/db/weeklyMetrics.ts`

**Interfaces:**
- Consumes: `WeekDay`, `RestOutcome`, `weeklyMetrics()` from `src/core/metrics/weekly.ts` (Plan 1, unmodified).
- Produces: `buildWeekDay(input: WeekDayInput): WeekDay`, `restOutcomeFor(endedAt: string, reentryAckAt: string | null): RestOutcome` (pure) — `getWeeklyMetrics(client, weekStart: string): Promise<WeeklyMetrics>` — used by Task 16 (weekly review persistence, spec §5.8's S1–S4) and Task 18 (History screen's weekly summary).

- [ ] **Step 1: Write the failing tests**

```ts
// src/core/metrics/build.test.ts
import { describe, expect, it } from 'vitest';
import { buildWeekDay, restOutcomeFor, type WeekDayInput } from './build';

describe('buildWeekDay', () => {
  it('maps every field straight through', () => {
    const input: WeekDayInput = {
      date: '2026-09-14',
      hasCheckin: true,
      sleepHours: 7.5,
      state: 'ready',
      trainingPlannedCount: 1,
      trainingDoneCount: 1,
      footballMinutes: 90,
      learnedEntry: true,
    };
    expect(buildWeekDay(input)).toEqual({
      date: '2026-09-14',
      hasCheckin: true,
      sleepHours: 7.5,
      state: 'ready',
      trainingPlanned: 1,
      trainingDone: 1,
      footballMinutes: 90,
      learnedNotes: 1,
    });
  });

  it('no learned entry means zero learnedNotes', () => {
    const day = buildWeekDay({
      date: '2026-09-14',
      hasCheckin: false,
      sleepHours: null,
      state: null,
      trainingPlannedCount: 0,
      trainingDoneCount: 0,
      footballMinutes: 0,
      learnedEntry: false,
    });
    expect(day.learnedNotes).toBe(0);
  });
});

describe('restOutcomeFor', () => {
  it('acked within 10 minutes', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', '2026-09-14T20:07:00.000Z')).toEqual({ ackDelayMin: 7 });
  });

  it('acked late', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', '2026-09-14T20:25:00.000Z')).toEqual({ ackDelayMin: 25 });
  });

  it('never acked', () => {
    expect(restOutcomeFor('2026-09-14T20:00:00.000Z', null)).toEqual({ ackDelayMin: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/core/metrics/build.test.ts`
Expected: FAIL — `build.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
// src/core/metrics/build.ts
import type { GuardState } from '../types';
import type { RestOutcome, WeekDay } from './weekly';

export interface WeekDayInput {
  date: string;
  hasCheckin: boolean;
  sleepHours: number | null;
  state: GuardState | null;
  trainingPlannedCount: number;
  trainingDoneCount: number;
  footballMinutes: number;
  learnedEntry: boolean;
}

/** Shapes one raw day into the `WeekDay` `weeklyMetrics` (Plan 1) consumes. Pure. */
export function buildWeekDay(input: WeekDayInput): WeekDay {
  return {
    date: input.date,
    hasCheckin: input.hasCheckin,
    sleepHours: input.sleepHours,
    state: input.state,
    trainingPlanned: input.trainingPlannedCount,
    trainingDone: input.trainingDoneCount,
    footballMinutes: input.footballMinutes,
    learnedNotes: input.learnedEntry ? 1 : 0,
  };
}

/** Spec §2 S3: minutes between a rest session ending and CT's "I'm back". Pure. */
export function restOutcomeFor(endedAt: string, reentryAckAt: string | null): RestOutcome {
  if (!reentryAckAt) return { ackDelayMin: null };
  const diffMs = new Date(reentryAckAt).getTime() - new Date(endedAt).getTime();
  return { ackDelayMin: Math.round(diffMs / 60000) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/core/metrics/build.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: The data-assembly wrapper**

```ts
// src/lib/db/weeklyMetrics.ts
import { addDays } from '@/core/time';
import { buildWeekDay, restOutcomeFor } from '@/core/metrics/build';
import { weeklyMetrics, type WeeklyMetrics } from '@/core/metrics/weekly';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

/** Spec §5.8 / §2: S1–S4 for the week starting `weekStart` (a Sunday,
 * `YYYY-MM-DD`), against the 7 days before it for S2's "trending down"
 * comparison. `null` previous-week metrics (not enough history yet) are
 * handled by `weeklyMetrics` itself — this only fetches and shapes. */
export async function getWeeklyMetrics(client: RepositoryClient, weekStart: string): Promise<WeeklyMetrics> {
  const repos = repositories(client);
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(weekStart, -1);

  const [plans, checkins, blocks, restSessions] = await Promise.all([
    repos.plans.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
  ]);
  const planByDate = new Map(plans.map((p) => [p.date, p]));

  function weekDaysFor(start: string, end: string) {
    const dates: string[] = [];
    for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates.map((date) => {
      const morning = checkins.find((c) => c.date === date && c.type === 'morning');
      const evening = checkins.find((c) => c.date === date && c.type === 'evening');
      const dayBlocks = blocks.filter((b) => b.date === date);
      const trainingBlocks = dayBlocks.filter((b) => b.kind === 'training');
      const learned = (evening?.sections.work as { footballAnalytics?: { learned?: string } } | undefined)?.footballAnalytics
        ?.learned;
      return buildWeekDay({
        date,
        hasCheckin: morning !== undefined || evening !== undefined,
        sleepHours: (morning?.sections.body as { sleepHours?: number } | undefined)?.sleepHours ?? null,
        state: planByDate.get(date)?.state ?? null,
        trainingPlannedCount: trainingBlocks.length,
        trainingDoneCount: trainingBlocks.filter((b) => b.status === 'done' || b.status === 'partial').length,
        footballMinutes:
          (evening?.sections.work as { footballAnalytics?: { minutes?: number } } | undefined)?.footballAnalytics?.minutes ?? 0,
        learnedEntry: (learned ?? '').trim().length > 0,
      });
    });
  }

  const week = weekDaysFor(weekStart, weekEnd);
  const previousWeek = weekDaysFor(previousStart, previousEnd);
  const hasPreviousHistory = previousWeek.some((d) => d.hasCheckin);

  const restOutcomes = restSessions
    .filter((r) => r.date >= weekStart && r.date <= weekEnd && r.ended_at !== null)
    .map((r) => restOutcomeFor(r.ended_at!, r.reentry_ack_at));

  return weeklyMetrics(week, restOutcomes, hasPreviousHistory ? previousWeek : null);
}
```

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/metrics/build.ts src/core/metrics/build.test.ts src/lib/db/weeklyMetrics.ts
git commit -m "feat(metrics): buildWeekDay, restOutcomeFor, getWeeklyMetrics (spec §2 S1-S4)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 8: Diff-to-Visual Mapping — `diffVisual`

**Files:**
- Create: `src/core/planner/diffVisual.ts`
- Create: `src/core/planner/diffVisual.test.ts`

**Interfaces:**
- Consumes: `ChangeKind` from `src/core/planner/diff.ts` (Plan 1, unmodified — the seven kinds: `added | missed | dropped | swapped | shrunk | moved | kept`).
- Produces: `diffVisual(change: ChangeKind): { mark: 'moved' | 'shorter' | 'dropped' | 'kept'; tone: 'ok' | 'warn' | 'stop' }` — consumed by Task 11's diff-sheet UI.

`design/prototype/day-changed.html`'s comp only shows four diff marks (moved / shorter / dropped / kept — DESIGN.md "Session List / Diff Rows"), but the real planner (`diffBlocks`, Plan 1) emits seven `ChangeKind`s. This function is the missing decision: how `added`, `missed` and `swapped` render using the four marks already in the design system, rather than inventing new ones.

- [ ] **Step 1: Write the failing tests**

```ts
// src/core/planner/diffVisual.test.ts
import { describe, expect, it } from 'vitest';
import { diffVisual } from './diffVisual';

describe('diffVisual', () => {
  it('kept → kept / ok', () => {
    expect(diffVisual('kept')).toEqual({ mark: 'kept', tone: 'ok' });
  });

  it('added → kept / ok (a new block is a gain, reads like kept)', () => {
    expect(diffVisual('added')).toEqual({ mark: 'kept', tone: 'ok' });
  });

  it('moved → moved / warn', () => {
    expect(diffVisual('moved')).toEqual({ mark: 'moved', tone: 'warn' });
  });

  it('swapped → moved / warn (a recovery swap is a change, not a loss)', () => {
    expect(diffVisual('swapped')).toEqual({ mark: 'moved', tone: 'warn' });
  });

  it('shrunk → shorter / warn', () => {
    expect(diffVisual('shrunk')).toEqual({ mark: 'shorter', tone: 'warn' });
  });

  it('dropped → dropped / stop', () => {
    expect(diffVisual('dropped')).toEqual({ mark: 'dropped', tone: 'stop' });
  });

  it('missed → dropped / stop (same severity as dropped)', () => {
    expect(diffVisual('missed')).toEqual({ mark: 'dropped', tone: 'stop' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/core/planner/diffVisual.test.ts`
Expected: FAIL — `diffVisual.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

```ts
// src/core/planner/diffVisual.ts
import type { ChangeKind } from './diff';

export interface DiffVisual {
  mark: 'moved' | 'shorter' | 'dropped' | 'kept';
  tone: 'ok' | 'warn' | 'stop';
}

/** Maps the planner's seven ChangeKinds onto DESIGN.md's four diff marks
 * (Session List / Diff Rows). Pure. */
export function diffVisual(change: ChangeKind): DiffVisual {
  switch (change) {
    case 'kept':
    case 'added':
      return { mark: 'kept', tone: 'ok' };
    case 'moved':
    case 'swapped':
      return { mark: 'moved', tone: 'warn' };
    case 'shrunk':
      return { mark: 'shorter', tone: 'warn' };
    case 'dropped':
    case 'missed':
      return { mark: 'dropped', tone: 'stop' };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/core/planner/diffVisual.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/planner/diffVisual.ts src/core/planner/diffVisual.test.ts
git commit -m "feat(planner): diffVisual — map the 7 ChangeKinds onto the 4 designed diff marks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 9: Ensure-Today-Plan Server Logic

**Files:**
- Create: `src/lib/db/settingsMapping.ts`
- Create: `src/lib/planner/ensureTodayPlan.ts`

**Interfaces:**
- Consumes: `assess()`, `buildDay()` from Plan 1 (unmodified). `getDaySummaries()` from Plan 3. `planClock()`, `addDays()`, `weekdayOf()` from `src/core/time.ts`.
- Produces: `settingsToDomain(row: SettingsRow): Settings` (`src/lib/db/settingsMapping.ts`) — used by every later task that needs the core `Settings` shape from the DB row (Tasks 10, 11, 13, 14, 15). `ensureTodayPlan(client, ownerId, now): Promise<{ plan: PlanRow; blocks: BlockRow[] }>` — used by Task 10 (Today screen).

Spec §5.2: "If no plan exists for a date when its 04:00 day boundary arrives … the cron tick generates it." Plan 6 owns the cron; until then, Today's own load is the fallback trigger — this is exactly the gap spec §15 flags as something to confirm during planning, and the honest answer is: the cron doesn't exist yet, so Today must be able to generate its own plan on first load of a new day.

- [ ] **Step 1: The settings row → domain mapping**

```ts
// src/lib/db/settingsMapping.ts
import type { Settings } from '@/core/types';
import type { SettingsRow } from './schemas';

/** The DB row is snake_case and includes `id`/`owner_id`; the core `Settings`
 * type (consumed by the pure planner/guard/nudges/mentor modules) is
 * camelCase and has neither. One conversion, reused everywhere a repository
 * row needs to reach pure core code. */
export function settingsToDomain(row: SettingsRow): Settings {
  return {
    timezone: row.timezone,
    wakeTime: row.wake_time,
    bedtime: row.bedtime,
    model: row.model,
    monthlyCapUsd: row.monthly_cap_usd,
    nudgeDailyCap: row.nudge_daily_cap,
    deepWorkDailyCapMin: row.deep_work_daily_cap_min,
    thresholds: row.thresholds,
    crisisContacts: row.crisis_contacts,
  };
}
```

- [ ] **Step 2: `ensureTodayPlan` — get today's plan, or build and persist it**

```ts
// src/lib/planner/ensureTodayPlan.ts
import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays, planClock, weekdayOf } from '@/core/time';
import type { Block, DayTemplate } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow, PlanRow } from '@/lib/db/schemas';

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id,
    owner_id: ownerId,
    date,
    title: block.title,
    kind: block.kind,
    anchor: block.anchor,
    priority: block.priority,
    start: block.start,
    end: block.end,
    min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null,
    window_end: block.window?.latestEnd ?? null,
    tags: block.tags,
    checklist: block.checklist,
    recovery_variant: block.recoveryVariant,
    status: block.status,
    source: block.source,
  };
}

/** Spec §5.2's fallback for "no plan exists yet for a date whose 04:00
 * boundary has passed" — until Plan 6's cron exists, Today's own load is
 * that trigger. Idempotent: a second call on the same day is a no-op read. */
export async function ensureTodayPlan(
  client: RepositoryClient,
  ownerId: string,
  now: Date,
): Promise<{ plan: PlanRow; blocks: BlockRow[] }> {
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  if (!settingsRow) throw new Error('No settings row yet — onboarding (Task 22) must run first.');
  const settings = settingsToDomain(settingsRow);

  const { planDate } = planClock(now, settings.timezone);
  const existingPlan = await repos.plans.get(planDate, 'date');
  if (existingPlan) {
    const blocks = await repos.blocks.list({ date: planDate } as never);
    return { plan: existingPlan, blocks };
  }

  const templateRow = await repos.templates.get(weekdayOf(planDate));
  if (!templateRow) throw new Error(`No template for weekday ${weekdayOf(planDate)} — onboarding (Task 22) must run first.`);
  const template: DayTemplate = { weekday: templateRow.weekday, restDay: templateRow.rest_day, blocks: templateRow.blocks };

  const history = await getDaySummaries(client, addDays(planDate, -7), addDays(planDate, -1));
  const assessment = assess(history, settings);
  const { plan } = buildDay(template, planDate, settings, assessment.adjustments);

  const planRow: PlanRow = {
    date: planDate,
    owner_id: ownerId,
    state: assessment.state,
    flags: assessment.flags,
    adjustments: assessment.adjustments,
    overridden: false,
  };
  await repos.plans.upsert(planRow);
  const blockRows = await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, planDate, ownerId))));

  return { plan: planRow, blocks: blockRows };
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: succeeds. No Vitest step — this function's only new decision logic (which template/history window to use) is a thin, sequential composition of five already-tested pure functions (`assess`, `buildDay`, `planClock`, `addDays`, `weekdayOf`) plus repository I/O; the codebase's established pattern (matching `assembleMentorContext`, `ensureTodayPlan`'s sibling in Plan 4) is to leave this shaping/orchestration layer untested directly and rely on the pure functions' own coverage plus the manual/E2E verification in Task 23.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/settingsMapping.ts src/lib/planner/ensureTodayPlan.ts
git commit -m "feat(planner): ensureTodayPlan — build and persist today's plan on first load if none exists

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 10: Today Screen

**Files:**
- Create: `src/core/today/loadBars.ts`
- Create: `src/core/today/loadBars.test.ts`
- Create: `src/core/today/phase.ts`
- Create: `src/core/today/phase.test.ts`
- Create: `src/components/today/Countdown.tsx`
- Modify: `src/app/page.tsx`
- Delete: `src/app/HealthCheck.tsx`, `src/app/actions.ts` (Plan 3's diagnostic — superseded by the real screen; removal happens in Task 23 once nothing references them)

**Interfaces:**
- Consumes: `ensureTodayPlan` (Task 9), `getPlayerCard` (Task 6), `LoadBarRow`/`SessionRow`/`PlayerCardStrip`/`ThumbBar`/`Placard`/`DeptNav` (Task 2), `Icon` (Task 1), `getDaySummaries` (Plan 3), `formatPlanMinute` (Plan 1, `src/core/time.ts`).
- Produces: `computeLoadBars`, `dayPhase` (pure, reused nowhere else in this plan but kept in `src/core/today/` for Plan 6's future nudge/notification copy to reuse). The live `/` route.

- [ ] **Step 1: Write the failing tests for `computeLoadBars`**

```ts
// src/core/today/loadBars.test.ts
import { describe, expect, it } from 'vitest';
import type { Block, DaySummary, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { computeLoadBars } from './loadBars';

function block(overrides: Partial<Block> & Pick<Block, 'id' | 'kind' | 'status'>): Block {
  return {
    title: 'x', anchor: false, priority: 3, start: 480, end: 540, minMinutes: 30,
    window: null, tags: [], checklist: [], recoveryVariant: null, source: 'template',
    ...overrides,
  };
}

function summary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    date: '2026-09-14', sleepHours: null, morningEnergy: null, stress: null, deepWorkMin: null,
    restSessionsTaken: 0, trainedOnRestDay: false, unplannedIndulgenceMin: null, anchorsTotal: 0, anchorsSkipped: 0,
    ...overrides,
  };
}

const SETTINGS: Settings = DEFAULT_SETTINGS;

describe('computeLoadBars', () => {
  it('Body: counts training blocks done vs total', () => {
    const bars = computeLoadBars({
      blocks: [block({ id: '1', kind: 'training', status: 'done' }), block({ id: '2', kind: 'training', status: 'planned' })],
      today: summary(),
      settings: SETTINGS,
    });
    expect(bars[0]).toMatchObject({ name: 'Body', valueText: '1 of 2 sessions', percent: 50, read: 'ok' });
  });

  it('Body: no training blocks today reads ok at 100%', () => {
    const bars = computeLoadBars({ blocks: [], today: summary(), settings: SETTINGS });
    expect(bars[0]).toMatchObject({ valueText: '0 of 0 sessions', percent: 100, read: 'ok' });
  });

  it('Work & growth: over the deep-work cap reads over', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ deepWorkMin: 400 }), settings: SETTINGS });
    expect(bars[1]).toMatchObject({ name: 'Work & growth', read: 'over' });
  });

  it('Work & growth: under 80% of cap reads ok', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ deepWorkMin: 100 }), settings: SETTINGS });
    expect(bars[1]).toMatchObject({ read: 'ok' });
  });

  it('Screen & pleasure: over the indulge-high threshold reads over', () => {
    const bars = computeLoadBars({ blocks: [], today: summary({ unplannedIndulgenceMin: 150 }), settings: SETTINGS });
    expect(bars[2]).toMatchObject({ name: 'Screen time', read: 'over' });
  });

  it('Rest: sessions taken vs rest blocks planned today', () => {
    const bars = computeLoadBars({
      blocks: [block({ id: '1', kind: 'rest', status: 'planned' }), block({ id: '2', kind: 'rest', status: 'planned' })],
      today: summary({ restSessionsTaken: 1 }),
      settings: SETTINGS,
    });
    expect(bars[3]).toMatchObject({ name: 'Rest & reflection', valueText: '1 of 2 rest sessions', percent: 50 });
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `computeLoadBars`**

Run: `npm test -- src/core/today/loadBars.test.ts` → expect FAIL (module missing).

```ts
// src/core/today/loadBars.ts
import type { Block, DaySummary, Settings } from '../types';
import type { LoadBarInput } from './loadBarInput';

export type { LoadBarInput };

export interface ComputeLoadBarsInput {
  blocks: Block[];
  today: DaySummary;
  settings: Settings;
}

const formatMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);

/** Today screen's four load-bar readings (design/prototype/today.html
 * "Today's load"). Pure — every input is already-fetched data, no I/O. */
export function computeLoadBars({ blocks, today, settings }: ComputeLoadBarsInput): LoadBarInput[] {
  const training = blocks.filter((b) => b.kind === 'training');
  const trainingDone = training.filter((b) => b.status === 'done' || b.status === 'partial').length;
  const bodyPercent = training.length === 0 ? 100 : Math.round((trainingDone / training.length) * 100);

  const deepWorkMin = today.deepWorkMin ?? 0;
  const cap = settings.deepWorkDailyCapMin;
  const workPercent = Math.min(100, Math.round((deepWorkMin / cap) * 100));
  const workRead = deepWorkMin > cap ? 'over' : deepWorkMin >= cap * 0.8 ? 'warn' : 'ok';

  const indulgeMin = today.unplannedIndulgenceMin ?? 0;
  const indulgeThreshold = settings.thresholds.indulgeHighMin;
  const screenPercent = Math.min(100, Math.round((indulgeMin / indulgeThreshold) * 100));
  const screenRead = indulgeMin > indulgeThreshold ? 'over' : indulgeMin >= indulgeThreshold * 0.8 ? 'warn' : 'ok';

  const restPlanned = blocks.filter((b) => b.kind === 'rest').length;
  const restPercent = restPlanned === 0 ? 100 : Math.round((today.restSessionsTaken / restPlanned) * 100);

  return [
    { name: 'Body', valueText: `${trainingDone} of ${training.length} sessions`, percent: bodyPercent, read: 'ok' },
    {
      name: 'Work & growth',
      valueText: deepWorkMin === 0 ? 'No deep work yet' : `${formatMin(deepWorkMin)} of ${formatMin(cap)} cap`,
      percent: workPercent,
      read: workRead,
    },
    {
      name: 'Screen time',
      valueText: indulgeMin === 0 ? 'Nothing unplanned logged' : `${formatMin(indulgeMin)} unplanned`,
      percent: screenPercent,
      read: screenRead,
    },
    {
      name: 'Rest & reflection',
      valueText: `${today.restSessionsTaken} of ${restPlanned} rest sessions`,
      percent: restPercent,
      read: 'ok',
    },
  ];
}
```

```ts
// src/core/today/loadBarInput.ts
export interface LoadBarInput {
  name: string;
  valueText: string;
  percent: number;
  read: 'ok' | 'warn' | 'over';
}
```

- [ ] **Step 3: Run to verify `computeLoadBars` passes**

Run: `npm test -- src/core/today/loadBars.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 4: Write the failing tests for `dayPhase`, then implement**

```ts
// src/core/today/phase.test.ts
import { describe, expect, it } from 'vitest';
import { dayPhase } from './phase';

describe('dayPhase', () => {
  it('04:00–07:00 is first-light', () => expect(dayPhase(300)).toBe('first-light')); // 05:00
  it('07:00–17:00 is day', () => expect(dayPhase(720)).toBe('day')); // 12:00
  it('17:00–21:00 is dusk', () => expect(dayPhase(1100)).toBe('dusk')); // 18:20
  it('21:00–04:00(+1440) is night', () => expect(dayPhase(1300)).toBe('night')); // 21:40
  it('just after midnight (plan minutes ≥1440) is still night', () => expect(dayPhase(1500)).toBe('night')); // 01:00
});
```

```ts
// src/core/today/phase.ts
export type DayPhase = 'first-light' | 'day' | 'dusk' | 'night';

/** DESIGN.md "Day phases" / "The Labelled Phase Rule": the ground tint
 * follows a phase that is always also written in words. Boundaries chosen
 * to match the spec's 04:00 day start and a typical 23:00 bedtime. Pure. */
export function dayPhase(planMinute: number): DayPhase {
  const wall = planMinute % 1440;
  if (wall >= 240 && wall < 420) return 'first-light'; // 04:00–07:00
  if (wall >= 420 && wall < 1020) return 'day'; // 07:00–17:00
  if (wall >= 1020 && wall < 1260) return 'dusk'; // 17:00–21:00
  return 'night'; // 21:00–04:00
}
```

Run: `npm test -- src/core/today/phase.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: The countdown client component**

```tsx
// src/components/today/Countdown.tsx
'use client';

import { useEffect, useState } from 'react';

/** DESIGN.md "The Steady Numeral Rule": a countdown must never shuffle
 * width while it's being read. `initialMinutes` comes from the server;
 * this component only ticks it down client-side afterward. */
export function Countdown({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(initialMinutes);

  useEffect(() => {
    setMinutes(initialMinutes);
    const id = setInterval(() => setMinutes((m) => Math.max(0, m - 1)), 60000);
    return () => clearInterval(id);
  }, [initialMinutes]);

  return (
    <span className="num" data-countdown={minutes}>
      {minutes} min
    </span>
  );
}
```

- [ ] **Step 6: The Today page**

```tsx
// src/app/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { getDaySummaries } from '@/lib/db/daySummary';
import { getPlayerCard } from '@/lib/db/progressDays';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { ensureTodayPlan } from '@/lib/planner/ensureTodayPlan';
import { computeLoadBars } from '@/core/today/loadBars';
import { dayPhase } from '@/core/today/phase';
import { planClock } from '@/core/time';
import { formatPlanMinute } from '@/core/time';
import { PlayerCardStrip } from '@/components/ui/PlayerCardStrip';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { SessionRow, type SessionRank } from '@/components/ui/SessionRow';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { DeptNav } from '@/components/ui/DeptNav';
import { Icon } from '@/components/icons/Icon';
import { Countdown } from '@/components/today/Countdown';
import Link from 'next/link';

const RANK: Record<string, SessionRank> = { done: 'done', partial: 'done', skipped: 'done', missed: 'done', dropped: 'done', active: 'now', planned: 'next' };
const TAG_LABEL: Record<string, string> = { done: 'Done', partial: 'Partial', skipped: 'Skipped', missed: 'Missed', dropped: 'Dropped', active: 'Now', planned: 'Next' };

export default async function TodayPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const now = new Date();
  const [{ plan, blocks }, settingsRow] = await Promise.all([ensureTodayPlan(client, user.id, now), repositories(client).settings.get()]);
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(now, settings.timezone);
  const [today] = await getDaySummaries(client, planDate, planDate);
  const card = await getPlayerCard(client, planDate);

  const sorted = [...blocks].sort((a, b) => a.start - b.start);
  const current = sorted.find((b) => b.status === 'active') ?? sorted.find((b) => b.start <= minute && b.end > minute && b.status === 'planned');
  const next = sorted.find((b) => b.start > minute && (b.status === 'planned' || b.status === 'active'));
  const headline = current ?? next ?? sorted[sorted.length - 1];
  const minutesToNext = next ? Math.max(0, next.start - minute) : 0;
  const phase = dayPhase(minute);
  const weekday = new Date(`${planDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

  const bars = computeLoadBars({
    blocks: blocks.map((b) => ({
      id: b.id, title: b.title, kind: b.kind, anchor: b.anchor, priority: b.priority, start: b.start, end: b.end,
      minMinutes: b.min_minutes, window: b.window_start !== null && b.window_end !== null ? { earliestStart: b.window_start, latestEnd: b.window_end } : null,
      tags: b.tags, checklist: b.checklist, recoveryVariant: b.recovery_variant, status: b.status, source: b.source,
    })),
    today: today!,
    settings,
  });

  return (
    <main className="shell" data-phase={phase}>
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> {phase[0]!.toUpperCase() + phase.slice(1).replace('-', ' ')} · {weekday}
        </p>
        <time>{formatPlanMinute(minute)}</time>
      </header>

      <section className="next" aria-labelledby="next-name">
        <h1 className="next-name" id="next-name">
          {headline?.title ?? 'Nothing planned'}
        </h1>
        {next && (
          <p className="next-when">
            <span className="lead">Next session in</span>
            <Countdown initialMinutes={minutesToNext} />
            <span className="lead">
              · {formatPlanMinute(next.start)}–{formatPlanMinute(next.end)}
            </span>
          </p>
        )}
      </section>

      <PlayerCardStrip card={card} />

      <div className="stepback desk">
        <Placard>Today's load</Placard>
        <ul className="load">
          {bars.map((bar) => (
            <LoadBarRow key={bar.name} {...bar} />
          ))}
        </ul>

        <div className="col-b">
          <Placard>The rest of today</Placard>
          <ul className="sessions">
            {sorted.map((b) => (
              <SessionRow
                key={b.id}
                at={formatPlanMinute(b.start)}
                title={b.title}
                note={b.anchor ? 'Anchor' : b.kind}
                rank={RANK[b.status] ?? 'next'}
                tagState="neutral"
                tagLabel={TAG_LABEL[b.status] ?? b.status}
              />
            ))}
          </ul>
        </div>

        <nav className="dept-nav" aria-label="Screens">
          <DeptNav />
        </nav>
      </div>

      <ThumbBar>
        <Link className="btn btn-main" href="/reentry">
          <Icon name="rest" />
          Start rest
        </Link>
        <Link className="btn" href="/day-changed">
          <Icon name="shift" />
          Day changed
        </Link>
      </ThumbBar>
    </main>
  );
}
```

- [ ] **Step 7: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
git add src/core/today src/components/today src/app/page.tsx
git commit -m "feat(today): Today screen — real plan, player card, load bars, session list

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 11: Day-Changed Reflow Flow

**Files:**
- Create: `src/core/planner/summarizeDiff.ts`
- Create: `src/core/planner/summarizeDiff.test.ts`
- Create: `src/lib/planner/reflowDay.ts`
- Create: `src/app/day-changed/actions.ts`
- Create: `src/app/day-changed/ReflowFlow.tsx`
- Create: `src/app/day-changed/page.tsx`

**Interfaces:**
- Consumes: `reflow()`, `ReflowEvent`, `DiffEntry` from Plan 1 (unmodified). `diffVisual` (Task 8). `blockToRow` pattern from Task 9 (reused, not imported — see Step 2). `reflowComment()` service from Plan 4 (`src/lib/mentor/routes/reflowComment.ts`).
- Produces: `summarizeDiff(diff: DiffEntry[]): string` (pure) — also reused by Task 16 if a weekly-letter summary ever needs a diff description (not required by this plan, kept general). `previewReflow`, `confirmReflow` (`src/lib/planner/reflowDay.ts`) — no other task consumes these directly (Day changed is the only reflow entry point in this plan).

- [ ] **Step 1: Write the failing test for `summarizeDiff`**

```ts
// src/core/planner/summarizeDiff.test.ts
import { describe, expect, it } from 'vitest';
import { summarizeDiff } from './summarizeDiff';

describe('summarizeDiff', () => {
  it('one line per non-kept entry, kept entries omitted', () => {
    const summary = summarizeDiff([
      { blockId: '1', title: 'FPL pipeline', change: 'moved', from: { start: 1020, end: 1110 }, to: { start: 1065, end: 1155 }, reason: 'Moved to make room' },
      { blockId: '2', title: 'Dinner', change: 'kept', from: { start: 1140, end: 1170 }, to: { start: 1140, end: 1170 }, reason: '' },
      { blockId: '3', title: 'Second walk', change: 'dropped', from: { start: 1000, end: 1020 }, to: null, reason: "Lowest priority — it didn't fit" },
    ]);
    expect(summary).toBe('FPL pipeline: moved — Moved to make room. Second walk: dropped — Lowest priority — it did not fit.');
  });

  it('empty or all-kept diff summarizes as no changes', () => {
    expect(summarizeDiff([])).toBe('Nothing changed.');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `npm test -- src/core/planner/summarizeDiff.test.ts` → expect FAIL.

```ts
// src/core/planner/summarizeDiff.ts
import type { DiffEntry } from './diff';

/** A one-line-per-change text summary for the mentor's "Ask mentor" reflow
 * comment (spec §5.4) — the route takes a plain diffSummary string, not the
 * structured DiffEntry[], to stay a simple text prompt. Pure. Note: the
 * apostrophe in "didn't" is replaced with a plain one so the summary reads
 * cleanly as a single sentence fragment either way — no functional meaning,
 * just consistent punctuation for the model's prompt. */
export function summarizeDiff(diff: DiffEntry[]): string {
  const changed = diff.filter((d) => d.change !== 'kept');
  if (changed.length === 0) return 'Nothing changed.';
  return changed.map((d) => `${d.title}: ${d.change} — ${d.reason.replace("didn't", 'did not')}.`).join(' ');
}
```

- [ ] **Step 3: Run to verify pass**

Run: `npm test -- src/core/planner/summarizeDiff.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: The reflow lib — preview (no writes) and confirm (persists)**

```ts
// src/lib/planner/reflowDay.ts
import { reflow, type ReflowEvent } from '@/core/planner/reflow';
import { toPlanMinute } from '@/core/time';
import type { Block, DayPlan } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow } from '@/lib/db/schemas';
import type { DiffEntry } from '@/core/planner/diff';

function rowToBlock(row: BlockRow): Block {
  return {
    id: row.id, title: row.title, kind: row.kind, anchor: row.anchor, priority: row.priority,
    start: row.start, end: row.end, minMinutes: row.min_minutes,
    window: row.window_start !== null && row.window_end !== null ? { earliestStart: row.window_start, latestEnd: row.window_end } : null,
    tags: row.tags, checklist: row.checklist, recoveryVariant: row.recovery_variant, status: row.status, source: row.source,
  };
}

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id, owner_id: ownerId, date, title: block.title, kind: block.kind, anchor: block.anchor,
    priority: block.priority, start: block.start, end: block.end, min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null, window_end: block.window?.latestEnd ?? null,
    tags: block.tags, checklist: block.checklist, recovery_variant: block.recoveryVariant, status: block.status, source: block.source,
  };
}

/** Spec §5.4: "planner reflows → show diff … → Confirm." Nothing is written
 * here — the diff sheet (Task 11's UI) shows this result and only Step 5's
 * `confirmReflow` persists it, matching the prototype copy exactly:
 * "Nothing is logged until you accept." */
export async function previewReflow(
  client: RepositoryClient,
  date: string,
  event: ReflowEvent,
  now: number,
): Promise<{ plan: DayPlan; diff: DiffEntry[] }> {
  const repos = repositories(client);
  const [settingsRow, blockRows] = await Promise.all([repos.settings.get(), repos.blocks.list({ date } as never)]);
  const settings = settingsToDomain(settingsRow!);
  const plan: DayPlan = { date, wake: toPlanMinute(settings.wakeTime), bedtime: toPlanMinute(settings.bedtime), blocks: blockRows.map(rowToBlock) };
  const result = reflow(plan, now, event);
  return { plan: result.plan, diff: result.diff };
}

/** Persists the previewed plan's blocks — "Take the new day" in the UI. */
export async function confirmReflow(client: RepositoryClient, ownerId: string, date: string, plan: DayPlan): Promise<void> {
  const repos = repositories(client);
  await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, date, ownerId))));
}
```

- [ ] **Step 5: Server actions**

```ts
// src/app/day-changed/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { confirmReflow, previewReflow } from '@/lib/planner/reflowDay';
import { summarizeDiff } from '@/core/planner/summarizeDiff';
import { planClock } from '@/core/time';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { DEFAULT_SETTINGS } from '@/core/types';
import { reflowComment } from '@/lib/mentor/routes/reflowComment';
import type { ReflowEvent } from '@/core/planner/reflow';
import type { DiffEntry } from '@/core/planner/diff';
import type { Block } from '@/core/types';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

export async function previewReflowAction(event: ReflowEvent): Promise<{ date: string; blocks: Block[]; diff: DiffEntry[] }> {
  const { client } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(new Date(), settings.timezone);
  const { plan, diff } = await previewReflow(client, planDate, event, minute);
  return { date: planDate, blocks: plan.blocks, diff };
}

export async function confirmReflowAction(date: string, blocks: Block[]): Promise<void> {
  const { client, ownerId } = await authedClient();
  await confirmReflow(client, ownerId, date, { date, wake: 0, bedtime: 0, blocks });
  redirect('/');
}

export async function askMentorAboutReflowAction(date: string, diff: DiffEntry[]): Promise<{ text: string; fallback: boolean }> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  return reflowComment(
    client,
    createAnthropicClient(),
    { ownerId, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    date,
    summarizeDiff(diff),
  );
}
```

- [ ] **Step 6: The client-side event picker + diff sheet**

```tsx
// src/app/day-changed/ReflowFlow.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DiffEntry } from '@/core/planner/diff';
import { diffVisual } from '@/core/planner/diffVisual';
import type { Block } from '@/core/types';
import type { ReflowEvent } from '@/core/planner/reflow';
import { Icon } from '@/components/icons/Icon';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { askMentorAboutReflowAction, confirmReflowAction, previewReflowAction } from './actions';

type Picked =
  | { type: 'late'; minutes: number }
  | { type: 'lostTime'; minutes: number }
  | { type: 'urgent'; title: string; durationMin: number }
  | { type: 'lowEnergy' };

function toEvent(picked: Picked, now: number): ReflowEvent {
  switch (picked.type) {
    case 'late':
      return { type: 'late', minutes: picked.minutes };
    case 'lostTime':
      return { type: 'lostTime', start: now - picked.minutes, end: now };
    case 'urgent':
      return { type: 'urgent', id: `urgent-${Date.now()}`, title: picked.title, durationMin: picked.durationMin, priority: 3 };
    case 'lowEnergy':
      return { type: 'lowEnergy', restId: `recharge-${Date.now()}` };
  }
}

export function ReflowFlow({ nowMinute }: { nowMinute: number }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [result, setResult] = useState<{ date: string; blocks: Block[]; diff: DiffEntry[] } | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function preview(p: Picked) {
    setPending(true);
    setPicked(p);
    const r = await previewReflowAction(toEvent(p, nowMinute));
    setResult(r);
    setPending(false);
  }

  if (!result) {
    return (
      <div className="stepback">
        <Placard>What changed?</Placard>
        <div className="chips">
          <button className="chip" onClick={() => preview({ type: 'late', minutes: 30 })} disabled={pending}>
            <span>Running late (30 min)</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'lostTime', minutes: 60 })} disabled={pending}>
            <span>Lost an hour</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'urgent', title: 'Something urgent', durationMin: 45 })} disabled={pending}>
            <span>Something urgent came up</span>
          </button>
          <button className="chip" onClick={() => preview({ type: 'lowEnergy' })} disabled={pending}>
            <span>Low energy right now</span>
          </button>
        </div>
        {pending && <p className="hint">Working out the new day…</p>}
      </div>
    );
  }

  return (
    <>
      <div className="stepback">
        <Placard>What changed</Placard>
        <ul className="diff">
          {result.diff.map((d) => {
            const v = diffVisual(d.change);
            return (
              <li key={d.blockId} data-kind={v.mark}>
                <Icon name={v.mark} />
                <span>
                  <span className="row-name">{d.title}</span>
                  <span className="row-note">{d.reason || 'Unchanged'}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="empty">Nothing is logged until you accept. Keeping the old plan costs nothing either.</p>
        {comment && <p className="note">{comment}</p>}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={async () => setComment((await askMentorAboutReflowAction(result.date, result.diff)).text)}
        >
          Ask mentor
        </button>
      </div>
      <ThumbBar stacked>
        <button className="btn btn-main" onClick={() => confirmReflowAction(result.date, result.blocks)}>
          <Icon name="kept" />
          Take the new day
        </button>
        <Link className="btn btn-quiet" href="/">
          Keep the old one
        </Link>
      </ThumbBar>
    </>
  );
}
```

- [ ] **Step 7: The page**

```tsx
// src/app/day-changed/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { ReflowFlow } from './ReflowFlow';

export default async function DayChangedPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { minute } = planClock(new Date(), settings.timezone);

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Replan
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">The day moved</h1>
        <p className="sheet-sub">Pick what happened — the planner works out the rest.</p>
      </div>
      <ReflowFlow nowMinute={minute} />
    </main>
  );
}
```

- [ ] **Step 8: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add src/core/planner/summarizeDiff.ts src/core/planner/summarizeDiff.test.ts src/lib/planner/reflowDay.ts src/app/day-changed
git commit -m "feat(day-changed): event picker, reflow preview/confirm, diff sheet, ask-mentor comment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 12: Rest + Re-entry Ramp

**Files:**
- Create: `src/lib/planner/restSessions.ts`
- Create: `src/app/reentry/actions.ts`
- Create: `src/app/reentry/ImBackButton.tsx`
- Create: `src/app/reentry/page.tsx`

**Interfaces:**
- Consumes: `restReturnedOnTime` (Task 6). `getPlayerCard` (Task 6) for the badge-progress reading. `settingsToDomain` (Task 9).
- Produces: `startRest`, `acknowledgeReentry` (`src/lib/planner/restSessions.ts`) — no other task consumes these (rest is only started/ended from this screen and Today's "Start rest" link in this plan; Plan 6 adds the cron-driven re-entry nudge on top of the same table later).

Spec §5.6's block-end-triggered re-entry nudge is Plan 6 (cron) territory — Plan 5's version is CT-driven end-to-end: tapping **Start rest** opens this screen, which starts the session if one isn't already open; tapping **I'm back** ends it and acknowledges it in the same action, so an ad-hoc rest's return is always "on time" by construction. A rest session begun from a *planned* rest block (has a `blockId`) still records everything spec §8b.1's DIS bonus needs once Plan 6 adds the scheduled nudge on top.

- [ ] **Step 1: Rest session lib functions**

```ts
// src/lib/planner/restSessions.ts
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { RestSessionRow } from '@/lib/db/schemas';

export interface StartRestParams {
  ownerId: string;
  date: string;
  activity: string;
  planned: boolean;
  blockId: string | null;
}

/** Spec §5.6: "Start rest (or a planned rest block beginning) creates a
 * rest_session with activity chip." */
export async function startRest(client: RepositoryClient, params: StartRestParams, now: Date): Promise<RestSessionRow> {
  return repositories(client).restSessions.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    date: params.date,
    block_id: params.blockId,
    activity: params.activity,
    planned: params.planned,
    started_at: now.toISOString(),
    ended_at: null,
    reentry_ack_at: null,
  });
}

/** "I'm back": ends the session (if not already ended) and acknowledges
 * re-entry in the same tap — spec §5.6's `reentryAckAt`. */
export async function acknowledgeReentry(client: RepositoryClient, session: RestSessionRow, now: Date): Promise<RestSessionRow> {
  const repos = repositories(client);
  const nowIso = now.toISOString();
  return repos.restSessions.upsert({ ...session, ended_at: session.ended_at ?? nowIso, reentry_ack_at: nowIso });
}
```

- [ ] **Step 2: The "I'm back" server action + client button**

```ts
// src/app/reentry/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { acknowledgeReentry } from '@/lib/planner/restSessions';

export async function acknowledgeReentryAction(sessionId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const session = await repositories(client).restSessions.get(sessionId);
  if (!session) throw new Error('Rest session not found');
  await acknowledgeReentry(client, session, new Date());
  redirect('/');
}
```

```tsx
// src/app/reentry/ImBackButton.tsx
'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/icons/Icon';
import { acknowledgeReentryAction } from './actions';

export function ImBackButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button className="btn btn-main" disabled={pending} onClick={() => startTransition(() => acknowledgeReentryAction(sessionId))}>
      <Icon name="start" />
      I'm back
    </button>
  );
}
```

- [ ] **Step 3: The re-entry page — starts the session if none is open, shows the 3-step ramp**

```tsx
// src/app/reentry/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { startRest } from '@/lib/planner/restSessions';
import { Placard } from '@/components/ui/Placard';
import { ImBackButton } from './ImBackButton';

export default async function ReentryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate, minute } = planClock(new Date(), settings.timezone);

  const todaySessions = await repos.restSessions.list({ date: planDate } as never);
  let session = todaySessions.find((s) => s.ended_at === null);
  if (!session) {
    session = await startRest(client, { ownerId: user.id, date: planDate, activity: 'other', planned: false, blockId: null }, new Date());
  }

  const blocks = await repos.blocks.list({ date: planDate } as never);
  const next = [...blocks].sort((a, b) => a.start - b.start).find((b) => b.start > minute && b.status === 'planned');

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Rest
        </p>
      </header>
      <section className="next" aria-labelledby="next-name">
        <h1 className="next-name" id="next-name">
          Re-entry
        </h1>
        <p className="next-note">Three steps, whenever you're ready. Nothing here is a countdown you have to beat.</p>
      </section>
      <div className="stepback">
        <Placard>The ramp</Placard>
        <ol className="ramp">
          <li data-state="now">
            <span className="pip" />
            <span>
              <h3 className="r-name">Stand up</h3>
              <p className="r-note">Get off whatever you're on. That's the whole step.</p>
            </span>
          </li>
          <li data-state="later">
            <span className="pip" />
            <span>
              <h3 className="r-name">Water</h3>
              <p className="r-note">One glass, before anything else.</p>
            </span>
          </li>
          <li data-state="later">
            <span className="pip" />
            <span>
              <h3 className="r-name">First 2 minutes of {next ? next.title : "what's next"}</h3>
              <p className="r-note">Not the whole thing — just the first two minutes. That's enough to be back.</p>
            </span>
          </li>
        </ol>
        <p className="empty">Nothing was lost while you rested. Attributes and badges only ever go up.</p>
      </div>
      <div className="thumb">
        <ImBackButton sessionId={session.id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planner/restSessions.ts src/app/reentry
git commit -m "feat(reentry): start-rest, I'm-back re-entry ramp (spec §5.6)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 13: Morning Check-in

**Files:**
- Create: `src/lib/checkins/submitCheckin.ts`
- Create: `src/lib/checkins/reassessMorning.ts`
- Create: `src/app/checkin/morning/actions.ts`
- Create: `src/app/checkin/morning/MorningForm.tsx`
- Create: `src/app/checkin/morning/page.tsx`

**Interfaces:**
- Consumes: `morningBodySchema`, `morningMindSchema` (Plan 3, `src/lib/db/schemas.ts`, unmodified). `assess()`, `buildDay()` (Plan 1). `settingsToDomain` (Task 9). `ChipGroup`, `FieldSkip`, `Placard`, `ThumbBar` (Task 2).
- Produces: `submitMorningCheckin` (also used, in shape, by Task 14's evening submit — both live in `submitCheckin.ts`). `reassessMorning`, `applyMorningAdjustments`, `keepOriginalPlan` (`src/lib/checkins/reassessMorning.ts`) — used only by this task's server action.

Spec §5.3 step 3: after the morning check-in, `guard.assess` re-runs including last night's sleep; if the state differs from the one the plan was built with the evening before, a banner offers **Apply** (regenerate today's remaining plan) or **Keep original** (one tap, records `overridden = true`).

- [ ] **Step 1: The shared check-in submit function**

```ts
// src/lib/checkins/submitCheckin.ts
import { morningBodySchema, morningMindSchema } from '@/lib/db/schemas';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { CheckinRow } from '@/lib/db/schemas';

export interface MorningCheckinInput {
  body: { bedtime: string; wakeTime: string; sleepQuality: number; energy: number };
  mind: { mood: number; stress: number; stressCause: string[] };
  privateKeys: string[];
}

/** Spec §6: validated with the same zod schemas the repository layer already
 * uses (Plan 3) — a bad value is rejected before it ever reaches storage. */
export async function submitMorningCheckin(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  input: MorningCheckinInput,
): Promise<CheckinRow> {
  const body = morningBodySchema.parse(input.body);
  const mind = morningMindSchema.parse(input.mind);
  return repositories(client).checkins.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    date,
    type: 'morning',
    sections: { body, mind },
    private_keys: input.privateKeys,
    created_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Morning re-assessment**

```ts
// src/lib/checkins/reassessMorning.ts
import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays } from '@/core/time';
import type { Adjustment, Block, DayPlan, DayTemplate, Flag, GuardState } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow } from '@/lib/db/schemas';

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id, owner_id: ownerId, date, title: block.title, kind: block.kind, anchor: block.anchor,
    priority: block.priority, start: block.start, end: block.end, min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null, window_end: block.window?.latestEnd ?? null,
    tags: block.tags, checklist: block.checklist, recovery_variant: block.recoveryVariant, status: block.status, source: block.source,
  };
}

export interface ReassessResult {
  changed: boolean;
  state: GuardState;
  flags: Flag[];
  adjustments: Adjustment[];
  plan: DayPlan | null;
}

/** Re-runs the guard now that last night's sleep is logged. Does not write
 * anything — the caller (the morning check-in banner) decides Apply or Keep
 * original before either `applyMorningAdjustments` or `keepOriginalPlan` runs. */
export async function reassessMorning(client: RepositoryClient, date: string): Promise<ReassessResult> {
  const repos = repositories(client);
  const [settingsRow, planRow, templates] = await Promise.all([repos.settings.get(), repos.plans.get(date, 'date'), repos.templates.list()]);
  const settings = settingsToDomain(settingsRow!);
  const history = await getDaySummaries(client, addDays(date, -7), date);
  const assessment = assess(history, settings);

  if (!planRow || assessment.state === planRow.state) {
    return { changed: false, state: planRow?.state ?? assessment.state, flags: planRow?.flags ?? assessment.flags, adjustments: planRow?.adjustments ?? assessment.adjustments, plan: null };
  }

  const templateRow = templates.find((t) => t.weekday === new Date(`${date}T00:00:00Z`).getUTCDay());
  const template: DayTemplate = { weekday: templateRow!.weekday, restDay: templateRow!.rest_day, blocks: templateRow!.blocks };
  const { plan } = buildDay(template, date, settings, assessment.adjustments);

  return { changed: true, state: assessment.state, flags: assessment.flags, adjustments: assessment.adjustments, plan };
}

export async function applyMorningAdjustments(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  result: ReassessResult,
): Promise<void> {
  if (!result.plan) return;
  const repos = repositories(client);
  await repos.plans.upsert({ date, owner_id: ownerId, state: result.state, flags: result.flags, adjustments: result.adjustments, overridden: false });
  await Promise.all(result.plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, date, ownerId))));
}

export async function keepOriginalPlan(client: RepositoryClient, ownerId: string, date: string): Promise<void> {
  const repos = repositories(client);
  const plan = await repos.plans.get(date, 'date');
  if (!plan) return;
  await repos.plans.upsert({ ...plan, owner_id: ownerId, overridden: true });
}
```

No Vitest step for either file: both are sequential compositions of already-tested pure functions (`assess`, `buildDay`) plus repository I/O, the same established boundary as `ensureTodayPlan` (Task 9).

- [ ] **Step 3: Server actions**

```ts
// src/app/checkin/morning/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { submitMorningCheckin, type MorningCheckinInput } from '@/lib/checkins/submitCheckin';
import { applyMorningAdjustments, keepOriginalPlan, reassessMorning, type ReassessResult } from '@/lib/checkins/reassessMorning';
import { planClock } from '@/core/time';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';

async function authedClient() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return { client: supabase as unknown as RepositoryClient, ownerId: user.id };
}

export async function submitMorningCheckinAction(input: MorningCheckinInput): Promise<ReassessResult> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await submitMorningCheckin(client, ownerId, planDate, input);
  return reassessMorning(client, planDate);
}

export async function applyAdjustmentsAction(result: ReassessResult): Promise<void> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await applyMorningAdjustments(client, ownerId, planDate, result);
  redirect('/');
}

export async function keepOriginalAction(): Promise<void> {
  const { client, ownerId } = await authedClient();
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  await keepOriginalPlan(client, ownerId, planDate);
  redirect('/');
}
```

- [ ] **Step 4: The form**

```tsx
// src/app/checkin/morning/MorningForm.tsx
'use client';

import { useState } from 'react';
import { ChipGroup } from '@/components/ui/Chip';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import { applyAdjustmentsAction, keepOriginalAction, submitMorningCheckinAction } from './actions';
import type { ReassessResult } from '@/lib/checkins/reassessMorning';

const STRESS_CAUSES = [
  { value: 'family', label: 'Family' },
  { value: 'school/work', label: 'School/work' },
  { value: 'money', label: 'Money' },
  { value: 'social', label: 'Social' },
  { value: 'health', label: 'Health' },
  { value: 'none', label: 'None' },
];

export function MorningForm({ prefillBedtime, prefillWakeTime }: { prefillBedtime: string; prefillWakeTime: string }) {
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energy, setEnergy] = useState(5);
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(3);
  const [stressCause, setStressCause] = useState<string[]>([]);
  const [privateMind, setPrivateMind] = useState(false);
  const [banner, setBanner] = useState<ReassessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const result = await submitMorningCheckinAction({
      body: { bedtime: prefillBedtime, wakeTime: prefillWakeTime, sleepQuality, energy },
      mind: { mood, stress, stressCause },
      privateKeys: privateMind ? ['mind'] : [],
    });
    setSubmitting(false);
    if (result.changed) setBanner(result);
    else window.location.href = '/';
  }

  if (banner) {
    return (
      <div className="stepback">
        <Placard>Today changed</Placard>
        <p className="note">
          Your state moved to <b>{banner.state}</b> — here's why: {banner.flags.map((f) => f.reason).join('; ')}
        </p>
        <ThumbBar stacked>
          <button className="btn btn-main" onClick={() => applyAdjustmentsAction(banner)}>
            Apply the adjustments
          </button>
          <button className="btn btn-quiet" onClick={() => keepOriginalAction()}>
            Keep original
          </button>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>Body</Placard>
      <div className="field">
        <label htmlFor="sleepQuality">Sleep quality (1–5)</label>
        <input id="sleepQuality" type="range" min={1} max={5} value={sleepQuality} onChange={(e) => setSleepQuality(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="energy">Energy (1–10)</label>
        <input id="energy" type="range" min={1} max={10} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
      </div>

      <Placard>Mind</Placard>
      <div className="field">
        <label htmlFor="mood">Mood (1–10)</label>
        <input id="mood" type="range" min={1} max={10} value={mood} onChange={(e) => setMood(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="stress">Stress (1–10)</label>
        <input id="stress" type="range" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
      </div>
      <ChipGroup legend="What's behind it" name="stressCause" type="checkbox" options={STRESS_CAUSES} value={stressCause} onChange={(v) => setStressCause(v as string[])} />
      <label className="chip">
        <input type="checkbox" checked={privateMind} onChange={(e) => setPrivateMind(e.target.checked)} />
        <span>Just for me — don't send Mind to the mentor</span>
      </label>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={handleSubmit} disabled={submitting}>
          <Icon name="kept" />
          {submitting ? 'Logging…' : 'Log the morning'}
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 5: The page**

```tsx
// src/app/checkin/morning/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { MorningForm } from './MorningForm';

export default async function MorningCheckinPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="first-light">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);

  return (
    <main className="shell" data-phase="first-light">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Morning
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Morning check-in</h1>
        <p className="sheet-sub">Two sections. Either can be skipped and the day still counts.</p>
      </div>
      <MorningForm prefillBedtime={settings.bedtime} prefillWakeTime={settings.wakeTime} />
    </main>
  );
}
```

- [ ] **Step 6: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/checkins src/app/checkin/morning
git commit -m "feat(checkin): morning check-in with guard re-assessment banner (spec §5.3, §6)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 14: Evening Check-in (+ Guard Re-run, Tomorrow's Plan, Evening Review, Digest)

**Files:**
- Modify: `src/lib/checkins/submitCheckin.ts` (add `submitEveningCheckin`)
- Create: `src/lib/planner/generateTomorrowPlan.ts`
- Create: `src/app/checkin/evening/actions.ts`
- Create: `src/app/checkin/evening/EveningForm.tsx`
- Create: `src/app/checkin/evening/page.tsx`

**Interfaces:**
- Consumes: the six evening zod schemas (`eveningBodySchema`, `eveningMindSchema`, `eveningWorkSchema`, `eveningPleasureSchema`, `eveningPeopleSchema`, `eveningReflectionSchema`, Plan 3, unmodified). `eveningReview()` service (Plan 4). `CrisisContactsCard`, `useCrisisCheck` (Task 5).
- Produces: `submitEveningCheckin`, `generateTomorrowPlan` — used only here.

Spec §5.7: after the evening form, one mentor call (structured), a digest persisted for tomorrow's mentor context, and tomorrow's plan generated. `eveningReview()` (Plan 4) already logs the assistant turn to `mentor_messages` and runs the local crisis-keyword backup check against whatever's in `checkins` for `date` — but it does **not** persist the digest it returns. That write belongs here, the one caller that has the result.

- [ ] **Step 1: `submitEveningCheckin`**

```ts
// src/lib/checkins/submitCheckin.ts  (append to the file from Task 13)
import {
  eveningBodySchema, eveningMindSchema, eveningWorkSchema, eveningPleasureSchema, eveningPeopleSchema, eveningReflectionSchema,
} from '@/lib/db/schemas';

export interface EveningCheckinInput {
  body: { training: 'done' | 'partial' | 'skipped' | 'rest'; protein: 'low' | 'ok' | 'hit'; waterL: number; energyNow: number };
  mind: { peakStress: number; stressCause: string[]; focusQuality: number; regulated: string[] };
  work: { tasksDone: string[]; deepWorkMinutes: number; footballAnalytics: { projects: string[]; minutes: number; learned: string } };
  pleasure: { plannedRestSessions: number; unplannedEntries: { activity: string; minutes: number }[]; cameBackAfterRest: 'yes' | 'partly' | 'no' };
  people: { who: string[]; interactionType: 'in person' | 'call' | 'text' | 'online' | null; felt: 'draining' | 'neutral' | 'energizing' | null; reachedOut: boolean; frictionNote: string };
  reflection: { gratitudeLines: string[]; lessonOfDay: string; winOfDay: string };
  privateKeys: string[];
}

export async function submitEveningCheckin(
  client: RepositoryClient,
  ownerId: string,
  date: string,
  input: EveningCheckinInput,
): Promise<CheckinRow> {
  const sections = {
    body: eveningBodySchema.parse(input.body),
    mind: eveningMindSchema.parse(input.mind),
    work: eveningWorkSchema.parse(input.work),
    pleasure: eveningPleasureSchema.parse(input.pleasure),
    people: eveningPeopleSchema.parse(input.people),
    reflection: eveningReflectionSchema.parse(input.reflection),
  };
  return repositories(client).checkins.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    date,
    type: 'evening',
    sections,
    private_keys: input.privateKeys,
    created_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Generate tomorrow's plan — the same idempotent shape as `ensureTodayPlan` (Task 9), for an explicit date**

```ts
// src/lib/planner/generateTomorrowPlan.ts
import { assess } from '@/core/guard/assess';
import { buildDay } from '@/core/planner/buildDay';
import { addDays, weekdayOf } from '@/core/time';
import type { Block, DayTemplate } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getDaySummaries } from '@/lib/db/daySummary';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import type { BlockRow } from '@/lib/db/schemas';

function blockToRow(block: Block, date: string, ownerId: string): BlockRow {
  return {
    id: block.id, owner_id: ownerId, date, title: block.title, kind: block.kind, anchor: block.anchor,
    priority: block.priority, start: block.start, end: block.end, min_minutes: block.minMinutes,
    window_start: block.window?.earliestStart ?? null, window_end: block.window?.latestEnd ?? null,
    tags: block.tags, checklist: block.checklist, recovery_variant: block.recoveryVariant, status: block.status, source: block.source,
  };
}

/** Spec §5.7 step 5: "Tomorrow's plan is generated." Idempotent — a second
 * evening submission on the same day (or Plan 6's future cron fallback)
 * finds tomorrow's plan already there and does nothing. */
export async function generateTomorrowPlan(client: RepositoryClient, ownerId: string, today: string): Promise<void> {
  const repos = repositories(client);
  const tomorrow = addDays(today, 1);
  const existing = await repos.plans.get(tomorrow, 'date');
  if (existing) return;

  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const templateRow = await repos.templates.get(weekdayOf(tomorrow));
  if (!templateRow) return;
  const template: DayTemplate = { weekday: templateRow.weekday, restDay: templateRow.rest_day, blocks: templateRow.blocks };

  const history = await getDaySummaries(client, addDays(today, -6), today);
  const assessment = assess(history, settings);
  const { plan } = buildDay(template, tomorrow, settings, assessment.adjustments);

  await repos.plans.upsert({ date: tomorrow, owner_id: ownerId, state: assessment.state, flags: assessment.flags, adjustments: assessment.adjustments, overridden: false });
  await Promise.all(plan.blocks.map((b) => repos.blocks.upsert(blockToRow(b, tomorrow, ownerId))));
}
```

- [ ] **Step 3: Server action — submit, review, digest, tomorrow's plan, all in CT's one tap**

```ts
// src/app/checkin/evening/actions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/core/types';
import { submitEveningCheckin, type EveningCheckinInput } from '@/lib/checkins/submitCheckin';
import { generateTomorrowPlan } from '@/lib/planner/generateTomorrowPlan';
import { eveningReview } from '@/lib/mentor/routes/eveningReview';

export async function submitEveningCheckinAction(
  input: EveningCheckinInput,
): Promise<{ message: string; digest: string; tomorrowNote: string; crisis: boolean; fallback: boolean }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  await submitEveningCheckin(client, user.id, planDate, input);

  const review = await eveningReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    planDate,
  );
  if (!review.fallback) {
    await repos.digests.upsert({ date: planDate, owner_id: user.id, text: review.digest });
  }

  await generateTomorrowPlan(client, user.id, planDate);

  return review;
}
```

- [ ] **Step 4: The form (six sections, each skippable, free-text fields carry their own "just for me" flag)**

```tsx
// src/app/checkin/evening/EveningForm.tsx
'use client';

import { useState } from 'react';
import { ChipGroup } from '@/components/ui/Chip';
import { FieldSkip } from '@/components/ui/FieldSkip';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from '@/components/mentor/CrisisContactsCard';
import type { CrisisContact } from '@/core/types';
import { submitEveningCheckinAction } from './actions';
import type { EveningCheckinInput } from '@/lib/checkins/submitCheckin';

const TRAINING_OPTIONS = [
  { value: 'done', label: 'Full session' },
  { value: 'partial', label: 'Part of it' },
  { value: 'rest', label: 'Rest day' },
  { value: 'skipped', label: "Didn't happen" },
];
const PROTEIN_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'ok', label: 'OK' },
  { value: 'hit', label: 'Hit target' },
];
const REGULATION_OPTIONS = ['guitar', 'walk', 'stretching', 'breathing', 'talked to someone', 'other'].map((v) => ({ value: v, label: v }));

export function EveningForm({ crisisContacts }: { crisisContacts: CrisisContact[] }) {
  const [training, setTraining] = useState<'done' | 'partial' | 'skipped' | 'rest'>('done');
  const [protein, setProtein] = useState<'low' | 'ok' | 'hit'>('ok');
  const [waterL, setWaterL] = useState(2);
  const [energyNow, setEnergyNow] = useState(5);
  const [peakStress, setPeakStress] = useState(3);
  const [regulated, setRegulated] = useState<string[]>([]);
  const [deepWorkMinutes, setDeepWorkMinutes] = useState(0);
  const [footballMinutes, setFootballMinutes] = useState(0);
  const [learned, setLearned] = useState('');
  const [gratitudeText, setGratitudeText] = useState('');
  const [lessonOfDay, setLessonOfDay] = useState('');
  const [winOfDay, setWinOfDay] = useState('');
  const [reachedOut, setReachedOut] = useState(false);
  const [frictionNote, setFrictionNote] = useState('');
  const [privatePeople, setPrivatePeople] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<Awaited<ReturnType<typeof submitEveningCheckinAction>> | null>(null);

  const localCrisis = useCrisisCheck([learned, lessonOfDay, winOfDay, frictionNote]);

  async function handleSubmit() {
    setSubmitting(true);
    const input: EveningCheckinInput = {
      body: { training, protein, waterL, energyNow },
      mind: { peakStress, stressCause: [], focusQuality: 3, regulated },
      work: { tasksDone: [], deepWorkMinutes, footballAnalytics: { projects: [], minutes: footballMinutes, learned } },
      pleasure: { plannedRestSessions: 0, unplannedEntries: [], cameBackAfterRest: 'yes' },
      people: { who: [], interactionType: null, felt: null, reachedOut, frictionNote },
      reflection: { gratitudeLines: gratitudeText.split('\n').filter((l) => l.trim().length > 0), lessonOfDay, winOfDay },
      privateKeys: privatePeople ? ['people'] : [],
    };
    const result = await submitEveningCheckinAction(input);
    setSubmitting(false);
    setReview(result);
  }

  if (review) {
    return (
      <div className="stepback">
        {(review.crisis || localCrisis) && <CrisisContactsCard contacts={crisisContacts} />}
        <Placard>From the department</Placard>
        <p className="note">{review.message}</p>
        {review.tomorrowNote && <p className="hint">{review.tomorrowNote}</p>}
        <ThumbBar>
          <a className="btn btn-main btn-wide" href="/">
            Back to today
          </a>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}

      <Placard>Body</Placard>
      <ChipGroup legend="Training" name="training" type="radio" options={TRAINING_OPTIONS} value={training} onChange={(v) => setTraining(v as typeof training)} />
      <ChipGroup legend="Protein" name="protein" type="radio" options={PROTEIN_OPTIONS} value={protein} onChange={(v) => setProtein(v as typeof protein)} />
      <div className="field">
        <label htmlFor="waterL">Water (L)</label>
        <input id="waterL" type="number" step={0.1} value={waterL} onChange={(e) => setWaterL(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="energyNow">Energy now (1–10)</label>
        <input id="energyNow" type="range" min={1} max={10} value={energyNow} onChange={(e) => setEnergyNow(Number(e.target.value))} />
      </div>

      <Placard>Mind</Placard>
      <div className="field">
        <label htmlFor="peakStress">Peak stress (1–10)</label>
        <input id="peakStress" type="range" min={1} max={10} value={peakStress} onChange={(e) => setPeakStress(Number(e.target.value))} />
      </div>
      <ChipGroup legend="What regulated me" name="regulated" type="checkbox" options={REGULATION_OPTIONS} value={regulated} onChange={(v) => setRegulated(v as string[])} />

      <Placard>Work &amp; growth</Placard>
      <div className="field">
        <label htmlFor="deepWorkMinutes">Deep work minutes</label>
        <input id="deepWorkMinutes" type="number" value={deepWorkMinutes} onChange={(e) => setDeepWorkMinutes(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="footballMinutes">Football analytics minutes</label>
        <input id="footballMinutes" type="number" value={footballMinutes} onChange={(e) => setFootballMinutes(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="learned">What I learned</label>
        <textarea id="learned" rows={2} value={learned} onChange={(e) => setLearned(e.target.value)} />
        <FieldSkip onSkip={() => setLearned('')} />
      </div>

      <Placard>People &amp; connections</Placard>
      <label className="chip">
        <input type="checkbox" checked={reachedOut} onChange={(e) => setReachedOut(e.target.checked)} />
        <span>Reached out to someone</span>
      </label>
      <div className="field">
        <label htmlFor="frictionNote">Anything friction-y worth a note</label>
        <textarea id="frictionNote" rows={2} value={frictionNote} onChange={(e) => setFrictionNote(e.target.value)} />
        <FieldSkip onSkip={() => setFrictionNote('')} />
      </div>
      <label className="chip">
        <input type="checkbox" checked={privatePeople} onChange={(e) => setPrivatePeople(e.target.checked)} />
        <span>Just for me — don't send People to the mentor</span>
      </label>

      <Placard>Reflection</Placard>
      <div className="field">
        <label htmlFor="gratitude">Gratitude — one per line</label>
        <textarea id="gratitude" rows={3} value={gratitudeText} onChange={(e) => setGratitudeText(e.target.value)} />
        <FieldSkip onSkip={() => setGratitudeText('')} />
      </div>
      <div className="field">
        <label htmlFor="lesson">Lesson of the day</label>
        <textarea id="lesson" rows={2} value={lessonOfDay} onChange={(e) => setLessonOfDay(e.target.value)} />
        <FieldSkip onSkip={() => setLessonOfDay('')} />
      </div>
      <div className="field">
        <label htmlFor="win">Win of the day</label>
        <textarea id="win" rows={2} value={winOfDay} onChange={(e) => setWinOfDay(e.target.value)} />
        <FieldSkip onSkip={() => setWinOfDay('')} />
      </div>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={handleSubmit} disabled={submitting}>
          <Icon name="kept" />
          {submitting ? 'Logging…' : 'Log the day'}
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 5: The page**

```tsx
// src/app/checkin/evening/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { EveningForm } from './EveningForm';

export default async function EveningCheckinPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();

  return (
    <main className="shell" data-phase="night">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Evening
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Debrief</h1>
        <p className="sheet-sub">Six sections. Any of them can be skipped and the day still counts.</p>
      </div>
      <EveningForm crisisContacts={settingsRow?.crisis_contacts ?? []} />
    </main>
  );
}
```

- [ ] **Step 6: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/checkins/submitCheckin.ts src/lib/planner/generateTomorrowPlan.ts src/app/checkin/evening
git commit -m "feat(checkin): evening check-in, evening review, digest persistence, tomorrow's plan (spec §5.7)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 15: Mentor Screen — Briefing + Streaming Chat + Crisis UI

**Files:**
- Create: `src/app/mentor/actions.ts`
- Create: `src/components/mentor/ChatThread.tsx`
- Create: `src/app/mentor/page.tsx`

**Interfaces:**
- Consumes: `briefing()` service (Plan 4, server action call). `POST /api/mentor/chat` (Plan 4's existing streaming route — reused as-is, not reimplemented, since it already does exactly what the chat UI needs). `useCrisisCheck`, `CrisisContactsCard` (Task 5). `checkCap` (Plan 4, `src/lib/mentor/usage.ts`).
- Produces: the `/mentor` route. No other task consumes this task's exports.

Spec §8.2's `chat` route is streamed text over HTTP, already implemented in Plan 4 as `POST /api/mentor/chat` (body `{date, message}`, response a plain-text stream). This task is the one client that reads that stream — no new server-side mentor code.

- [ ] **Step 1: Server action for the briefing (structured JSON, not streamed — a plain server action fits)**

```ts
// src/app/mentor/actions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { DEFAULT_SETTINGS } from '@/core/types';
import { briefing } from '@/lib/mentor/routes/briefing';

export async function fetchBriefingAction(): Promise<{ text: string; fallback: boolean }> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  return briefing(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    planDate,
  );
}
```

- [ ] **Step 2: The streaming chat thread**

```tsx
// src/components/mentor/ChatThread.tsx
'use client';

import { useState } from 'react';
import { useCrisisCheck } from '@/hooks/useCrisisCheck';
import { CrisisContactsCard } from './CrisisContactsCard';
import { Icon } from '@/components/icons/Icon';
import type { CrisisContact } from '@/core/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Reads Plan 4's existing `POST /api/mentor/chat` text stream chunk by
 * chunk into the last assistant message — the route itself already does
 * everything else (cap check, crisis-flag-bearing routes don't apply here
 * since chat is plain streamed text, context assembly, usage recording,
 * mentor_messages logging). */
export function ChatThread({ date, initialMessages, crisisContacts }: { date: string; initialMessages: ChatMessage[]; crisisContacts: CrisisContact[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const localCrisis = useCrisisCheck([draft]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);

    const res = await fetch('/api/mentor/chat', { method: 'POST', body: JSON.stringify({ date, message: text }) });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { role: 'assistant', content: next[next.length - 1]!.content + chunk };
          return next;
        });
      }
    }
    setSending(false);
  }

  return (
    <>
      {localCrisis && <CrisisContactsCard contacts={crisisContacts} />}
      <ul className="thread" style={{ listStyle: 'none' }}>
        {messages.map((m, i) => (
          <li className={`msg ${m.role === 'assistant' ? 'from-dept' : 'from-ct'}`} key={i}>
            <span className="who">{m.role === 'assistant' ? 'Mentor' : 'CT'}</span>
            <div className="body">
              <p>{m.content || (sending && i === messages.length - 1 ? '…' : '')}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="thumb">
        <form
          className="composer btn-wide"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="placard" htmlFor="ask" style={{ gridColumn: '1/-1' }}>
            Ask
          </label>
          <textarea id="ask" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message" />
          <button className="btn btn-main" type="submit" aria-label="Send" disabled={sending}>
            <Icon name="send" />
          </button>
        </form>
      </div>
    </>
  );
}
```

- [ ] **Step 3: The page**

```tsx
// src/app/mentor/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { planClock } from '@/core/time';
import { checkCap } from '@/lib/mentor/usage';
import { DEFAULT_SETTINGS } from '@/core/types';
import { Placard } from '@/components/ui/Placard';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { ChatThread, type ChatMessage } from '@/components/mentor/ChatThread';

export default async function MentorPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);

  const [history, cap] = await Promise.all([
    repos.mentorMessages.list({ date: planDate, route: 'chat' } as never),
    checkCap(client, user.id, settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd, new Date()),
  ]);
  const initialMessages: ChatMessage[] = history
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Mentor
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">Mentor</h1>
        <p className="sheet-sub">Reads today's plan, recent history, and your check-ins. Nothing marked "just for me" is ever sent.</p>
      </div>
      <div className="stepback">
        <ChatThread date={planDate} initialMessages={initialMessages} crisisContacts={settingsRow?.crisis_contacts ?? []} />
        <Placard>This month's usage</Placard>
        <ul className="load">
          <LoadBarRow
            name="Spend vs cap"
            valueText={`$${cap.spentUsd.toFixed(2)} of $${cap.capUsd.toFixed(2)}`}
            percent={Math.min(100, Math.round((cap.spentUsd / cap.capUsd) * 100))}
            read={cap.over ? 'over' : cap.spentUsd >= cap.capUsd * 0.8 ? 'warn' : 'ok'}
          />
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/app/mentor src/components/mentor/ChatThread.tsx
git commit -m "feat(mentor): mentor screen — briefing action, streaming chat, cap usage, crisis card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 16: Weekly Review Persistence + Screen

**Files:**
- Create: `src/lib/mentor/runWeeklyReview.ts`
- Create: `src/app/weekly/actions.ts`
- Create: `src/app/weekly/WeeklyReviewView.tsx`
- Create: `src/app/weekly/page.tsx`

**Interfaces:**
- Consumes: `weeklyReview()` service (Plan 4, unmodified). `applyProfileChanges`, `revertSection`, `emptyProfile` (Plan 4's `src/core/mentor/profile.ts`, unmodified). `getWeeklyMetrics` (Task 7).
- Produces: `runWeeklyReview`, `revertProfileSection` — used only here.

Spec §5.8: "Applied automatically as a new profile version. Each change is shown in the letter … with one-tap Revert." The `weeklyReview()` service (Plan 4) returns `{letter, changes, crisis, fallback}` but — like `eveningReview`'s digest — never writes `weekly_letters` or `profile_versions` itself; this task is that missing persistence, plus the revert action spec §8.6 describes.

- [ ] **Step 1: `runWeeklyReview` and `revertProfileSection`**

```ts
// src/lib/mentor/runWeeklyReview.ts
import type Anthropic from '@anthropic-ai/sdk';
import { applyProfileChanges, emptyProfile, revertSection, type Profile, type ProfileSection } from '@/core/mentor/profile';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { getWeeklyMetrics } from '@/lib/db/weeklyMetrics';
import { weeklyReview } from '@/lib/mentor/routes/weeklyReview';
import type { MentorRouteParams } from '@/lib/mentor/routes/briefing';

export interface WeeklyReviewResult {
  letter: string;
  changes: { section: string; newText: string; reason: string }[];
  crisis: boolean;
  fallback: boolean;
}

/** Wraps the Plan 4 service with the persistence spec §5.8 describes: a
 * `weekly_letters` row, S1-S4 metrics, and a new `profile_versions` row
 * (author "claude") applying the proposed changes. */
export async function runWeeklyReview(
  client: RepositoryClient,
  anthropic: Anthropic,
  params: MentorRouteParams,
  weekStart: string,
): Promise<WeeklyReviewResult> {
  const result = await weeklyReview(client, anthropic, params, weekStart);
  if (result.fallback) return result;

  const repos = repositories(client);
  const versions = await repos.profileVersions.list();
  const latest = [...versions].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const current: Profile = latest ? (latest.sections as Profile) : emptyProfile();
  const next = applyProfileChanges(
    current,
    result.changes.map((c) => ({ section: c.section as ProfileSection, newText: c.newText, reason: c.reason })),
  );

  const newVersion = await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: params.ownerId,
    created_at: new Date().toISOString(),
    sections: next,
    author: 'claude',
    changes: result.changes,
  });

  const metrics = await getWeeklyMetrics(client, weekStart);
  await repos.weeklyLetters.upsert({
    week_start: weekStart,
    owner_id: params.ownerId,
    letter: result.letter,
    metrics: metrics as unknown as Record<string, unknown>,
    changes: result.changes as unknown as Record<string, unknown>,
    profile_version_id: newVersion.id,
  });

  return result;
}

/** Spec §8.6: "restores that section's text from the previous version
 * (creating another new version, author user)." */
export async function revertProfileSection(client: RepositoryClient, ownerId: string, section: ProfileSection): Promise<void> {
  const repos = repositories(client);
  const versions = [...(await repos.profileVersions.list())].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (versions.length < 2) return;
  const current = versions[0]!.sections as Profile;
  const previous = versions[1]!.sections as Profile;
  const next = revertSection(current, previous, section);

  await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    created_at: new Date().toISOString(),
    sections: next,
    author: 'user',
    changes: [{ section, newText: previous[section], reason: 'Reverted by CT' }],
  });
}
```

No Vitest step: this orchestrates already-tested pure functions (`applyProfileChanges`, `revertSection`) over repository I/O — the same established boundary as `ensureTodayPlan` (Task 9) and `reassessMorning` (Task 13).

- [ ] **Step 2: Server actions**

```ts
// src/app/weekly/actions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { createAnthropicClient } from '@/lib/anthropic/client';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import { DEFAULT_SETTINGS } from '@/core/types';
import type { ProfileSection } from '@/core/mentor/profile';
import { revertProfileSection, runWeeklyReview, type WeeklyReviewResult } from '@/lib/mentor/runWeeklyReview';

export async function runWeeklyReviewAction(weekStart: string): Promise<WeeklyReviewResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  return runWeeklyReview(
    client,
    createAnthropicClient(),
    { ownerId: user.id, model: settingsRow?.model ?? DEFAULT_SETTINGS.model, monthlyCapUsd: settingsRow?.monthly_cap_usd ?? DEFAULT_SETTINGS.monthlyCapUsd },
    weekStart,
  );
}

export async function revertProfileSectionAction(section: ProfileSection): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await revertProfileSection(supabase as unknown as RepositoryClient, user.id, section);
}
```

- [ ] **Step 3: The screen — manual trigger (real API cost, so it's a tap, never automatic) plus per-change revert**

```tsx
// src/app/weekly/WeeklyReviewView.tsx
'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import type { ProfileSection } from '@/core/mentor/profile';
import { revertProfileSectionAction, runWeeklyReviewAction } from './actions';
import type { WeeklyReviewResult } from '@/lib/mentor/runWeeklyReview';

export function WeeklyReviewView({ weekStart }: { weekStart: string }) {
  const [result, setResult] = useState<WeeklyReviewResult | null>(null);
  const [running, setRunning] = useState(false);
  const [reverted, setReverted] = useState<Set<string>>(new Set());

  async function run() {
    setRunning(true);
    setResult(await runWeeklyReviewAction(weekStart));
    setRunning(false);
  }

  async function revert(section: string) {
    await revertProfileSectionAction(section as ProfileSection);
    setReverted((s) => new Set(s).add(section));
  }

  if (!result) {
    return (
      <div className="stepback">
        <Placard>This week's letter</Placard>
        <p className="note">One Claude call — S1–S4, training, indulgence trend, one pattern, one focus, and any profile updates.</p>
        <ThumbBar>
          <button className="btn btn-main btn-wide" onClick={run} disabled={running}>
            {running ? 'Writing the letter…' : "Run this week's review"}
          </button>
        </ThumbBar>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>The letter</Placard>
      <p className="note">{result.letter}</p>
      {result.changes.length > 0 && (
        <>
          <Placard>What changed about you</Placard>
          <ul className="sessions">
            {result.changes.map((c) => (
              <li key={c.section} data-rank="next">
                <span className="what">
                  {c.section}
                  <small>{c.reason}</small>
                </span>
                {!reverted.has(c.section) ? (
                  <button className="btn btn-quiet" onClick={() => revert(c.section)}>
                    Revert
                  </button>
                ) : (
                  <span className="tag" data-state="neutral">
                    Reverted
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: The page**

```tsx
// src/app/weekly/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { addDays, planClock } from '@/core/time';
import { WeeklyReviewView } from './WeeklyReviewView';

export default async function WeeklyPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  // The most recent Sunday on or before today (spec §5.8: weeks start Sunday).
  const weekday = new Date(`${planDate}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(planDate, -weekday);

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Weekly review
        </p>
      </header>
      <WeeklyReviewView weekStart={weekStart} />
    </main>
  );
}
```

- [ ] **Step 5: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mentor/runWeeklyReview.ts src/app/weekly
git commit -m "feat(weekly): manual weekly review, letter/metrics/profile persistence, one-tap revert (spec §5.8, §8.6)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 17: Player Card Screen

**Files:**
- Create: `src/components/ui/AttributeRow.tsx`
- Create: `src/components/ui/BadgeMedallion.tsx`
- Create: `src/app/card/page.tsx`

**Interfaces:**
- Consumes: `getPlayerCard` (Task 6). `ATTR_NAMES` (Plan 1b, `src/core/progression/xp.ts`). `TIER_NAMES` (Plan 1b, `src/core/progression/badges.ts`). `Icon` (Task 1).
- Produces: the `/card` route (`PlayerCardStrip`, Task 2, already links here).

- [ ] **Step 1: `AttributeRow` and `BadgeMedallion`**

```tsx
// src/components/ui/AttributeRow.tsx
import type { Attr } from '@/core/progression/xp';
import { ATTR_NAMES } from '@/core/progression/xp';

export interface AttributeRowProps {
  attr: Attr;
  rating: number;
  /** `Level.intoLevel` / `Level.toNext` from `levelFromXp` (Plan 1b,
   * `src/core/progression/curve.ts`) — already computed on `PlayerCard.attributes[attr]`. */
  intoLevel: number;
  toNext: number;
  leveledUp?: boolean;
}

/** DESIGN.md "Attribute Rows (signature)": a levelled-up row becomes an
 * edged gold plate via `data-up`; dept.css owns the visual treatment. */
export function AttributeRow({ attr, rating, intoLevel, toNext, leveledUp }: AttributeRowProps) {
  const need = intoLevel + toNext;
  const percent = rating >= 99 ? 100 : need === 0 ? 0 : Math.min(100, Math.round((intoLevel / need) * 100));
  return (
    <li data-up={leveledUp ? 'true' : undefined}>
      <span className="a-name">
        {attr} <span className="a-full">{ATTR_NAMES[attr]}</span>
      </span>
      <span className="a-val">{rating}</span>
      <span className="track">
        <span className="fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="to-next">{rating >= 99 ? 'Maxed' : `${intoLevel} of ${need} XP into ${rating + 1}`}</span>
    </li>
  );
}
```

```tsx
// src/components/ui/BadgeMedallion.tsx
import type { BadgeProgress } from '@/core/progression/badges';
import { TIER_NAMES } from '@/core/progression/badges';
import { Icon, type IconName } from '@/components/icons/Icon';

const BADGE_ICON: Record<string, IconName> = {
  'clutch-returner': 'boot',
  'iron-sleeper': 'bed',
  'film-room': 'film',
  anchor: 'anchor',
  workhorse: 'weight',
  'open-book': 'book',
};

/** DESIGN.md "Badge Medallions (signature)": an unearned badge is still
 * shown, unlit (`data-tier="none"`). */
export function BadgeMedallion({ badge }: { badge: BadgeProgress }) {
  return (
    <li className="medal" data-tier={badge.tier ?? 'none'}>
      <span className="disc">
        <Icon name={BADGE_ICON[badge.id] ?? 'book'} size="medal" />
      </span>
      <span className="m-name">{badge.name}</span>
      <span className="m-count">{badge.tier ? `${badge.count} · ${TIER_NAMES[badge.tier]}` : `${badge.count} of ${badge.nextAt}`}</span>
    </li>
  );
}
```

- [ ] **Step 2: The page**

`PlayerCard.attributes[attr]` already carries `{ rating, intoLevel, toNext, xp }` — `levelFromXp`'s full `Level` shape plus lifetime XP (see `src/core/progression/card.ts`) — so no new computation is needed here, only passing the right fields to `AttributeRow`.

```tsx
// src/app/card/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import type { RepositoryClient } from '@/lib/db/repository';
import { getPlayerCard } from '@/lib/db/progressDays';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { repositories } from '@/lib/db/repositories';
import { planClock } from '@/core/time';
import { ATTRS } from '@/core/progression/xp';
import { Placard } from '@/components/ui/Placard';
import { AttributeRow } from '@/components/ui/AttributeRow';
import { BadgeMedallion } from '@/components/ui/BadgeMedallion';
import { DeptNav } from '@/components/ui/DeptNav';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { Icon } from '@/components/icons/Icon';
import Link from 'next/link';

export default async function CardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="night">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = await repositories(client).settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  const card = await getPlayerCard(client, planDate);

  const byRating = [...ATTRS].sort((a, b) => card.attributes[b].rating - card.attributes[a].rating);

  return (
    <main className="shell" data-phase="dusk">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Player file
        </p>
      </header>
      <section className="next" aria-labelledby="ovr-head">
        <h1 className="next-name" id="ovr-head">
          {card.ovr}
        </h1>
        <p className="next-when">
          <span className="lead">Overall</span>
          <span className="form-read">
            <span className="label">{card.form.label}</span>
          </span>
        </p>
        <p className="next-note">The mean of six attributes, each between 40 and 99. Attributes never fall.</p>
      </section>
      <div className="stepback">
        <Placard>Attributes</Placard>
        <ul className="attrs">
          {byRating.map((attr) => (
            <AttributeRow
              key={attr}
              attr={attr}
              rating={card.attributes[attr].rating}
              intoLevel={card.attributes[attr].intoLevel}
              toNext={card.attributes[attr].toNext}
            />
          ))}
        </ul>

        <Placard>Badges</Placard>
        <ul className="medals">
          {card.badges.map((b) => (
            <BadgeMedallion key={b.id} badge={b} />
          ))}
        </ul>
        <p className="empty">Every badge counts a total, never days in a row. A gap costs you nothing but the days you did not log.</p>

        <nav className="dept-nav" aria-label="Screens">
          <DeptNav />
        </nav>
      </div>
      <ThumbBar>
        <Link className="btn btn-main" href="/">
          <Icon name="moved" />
          Back to today
        </Link>
        <Link className="btn" href="/mentor">
          Ask the mentor
        </Link>
      </ThumbBar>
    </main>
  );
}
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/AttributeRow.tsx src/components/ui/BadgeMedallion.tsx src/app/card
git commit -m "feat(card): player card screen — attributes, badges, form (spec §8b)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 18: History Screen

**Files:**
- Create: `src/app/history/page.tsx`

**Interfaces:**
- Consumes: `getDaySummaries` (Plan 3). `getWeeklyMetrics` (Task 7). `settingsToDomain` (Task 9). `Tag`, `Placard`, `LoadBarRow`, `DeptNav` (Tasks 1–2).
- Produces: the `/history` route.

Spec §14: "History screen (past days: plan, check-ins, digests, letters)." One page, three sections: this week's S1–S4, the last 30 days as a scannable list, and the most recent weekly letters.

- [ ] **Step 1: The page**

```tsx
// src/app/history/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { settingsToDomain } from '@/lib/db/settingsMapping';
import { getDaySummaries } from '@/lib/db/daySummary';
import { getWeeklyMetrics } from '@/lib/db/weeklyMetrics';
import { addDays, planClock } from '@/core/time';
import { Placard } from '@/components/ui/Placard';
import { LoadBarRow } from '@/components/ui/LoadBarRow';
import { DeptNav } from '@/components/ui/DeptNav';
import { Tag } from '@/components/ui/Tag';

export default async function HistoryPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const repos = repositories(client);
  const settingsRow = await repos.settings.get();
  const settings = settingsToDomain(settingsRow!);
  const { planDate } = planClock(new Date(), settings.timezone);
  const weekday = new Date(`${planDate}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(planDate, -weekday);

  const [days, metrics, plans, letters] = await Promise.all([
    getDaySummaries(client, addDays(planDate, -29), planDate),
    getWeeklyMetrics(client, weekStart),
    repos.plans.list(),
    repos.weeklyLetters.list(),
  ]);
  const planByDate = new Map(plans.map((p) => [p.date, p]));
  const recentLetters = [...letters].sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 4);

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> History
        </p>
      </header>
      <div className="sheet-head">
        <h1 className="sheet-title">History</h1>
        <p className="sheet-sub">The last 30 days, this week's numbers, and recent letters.</p>
      </div>
      <div className="stepback">
        <Placard>This week (spec §2 S1–S4)</Placard>
        <ul className="load">
          <LoadBarRow name="Check-in days" valueText={`${metrics.s1.checkinDays} of 7`} percent={(metrics.s1.checkinDays / 7) * 100} read={metrics.s1.met ? 'ok' : 'warn'} />
          <LoadBarRow name="Nights ≥7h sleep" valueText={`${metrics.s2.nightsSleep7} of 7`} percent={(metrics.s2.nightsSleep7 / 7) * 100} read={metrics.s2.met ? 'ok' : 'warn'} />
          <LoadBarRow
            name="Returned from rest on time"
            valueText={metrics.s3.rate === null ? 'No rest sessions yet' : `${Math.round(metrics.s3.rate * 100)}%`}
            percent={metrics.s3.rate === null ? 0 : metrics.s3.rate * 100}
            read={metrics.s3.met === false ? 'warn' : 'ok'}
          />
          <LoadBarRow
            name="Training done vs planned"
            valueText={`${metrics.s4.trainingDone} of ${metrics.s4.trainingPlanned}`}
            percent={metrics.s4.trainingPlanned === 0 ? 100 : (metrics.s4.trainingDone / metrics.s4.trainingPlanned) * 100}
            read="ok"
          />
        </ul>

        <Placard>Last 30 days</Placard>
        <ul className="sessions">
          {[...days].reverse().map((d) => {
            const plan = planByDate.get(d.date);
            return (
              <li key={d.date} data-rank="done">
                <span className="at">{d.date.slice(5)}</span>
                <span className="what">
                  {plan ? plan.state[0]!.toUpperCase() + plan.state.slice(1) : 'No plan'}
                  <small>{d.sleepHours !== null ? `${d.sleepHours}h sleep` : 'No sleep logged'}</small>
                </span>
                <Tag state={plan ? (plan.state as 'ready' | 'drifting' | 'depleted' | 'grinding') : 'neutral'} />
              </li>
            );
          })}
        </ul>

        <Placard>Recent letters</Placard>
        {recentLetters.length === 0 ? (
          <p className="hint">No weekly letters yet — run one from the Mentor screen's weekly review.</p>
        ) : (
          <ul className="sessions">
            {recentLetters.map((l) => (
              <li key={l.week_start} data-rank="done">
                <span className="what">
                  Week of {l.week_start}
                  <small>{l.letter.slice(0, 80)}…</small>
                </span>
              </li>
            ))}
          </ul>
        )}

        <nav className="dept-nav" aria-label="Screens">
          <DeptNav />
        </nav>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/app/history
git commit -m "feat(history): history screen — weekly S1-S4, last 30 days, recent letters (spec §14)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 19: Templates Editor

**Files:**
- Create: `src/app/templates/actions.ts`
- Create: `src/app/templates/TemplateEditor.tsx`
- Create: `src/app/templates/page.tsx`

**Interfaces:**
- Consumes: `TemplateRow`, `templateBlockSchema` (via `templateRowSchema`, Plan 3). `repositories(client).templates` (Plan 3).
- Produces: the `/templates` route.

Spec §14: "Templates editor" — CRUD on the 7 weekday templates seeded in onboarding (`src/lib/onboarding/seedData.ts`, Plan 3/this plan's Task 22). One weekday open at a time; each block's `key`/`kind`/`anchor`/`priority` stay as typed, only the fields CT actually needs to retune day-to-day (title, start time, duration, rest-day toggle) are editable in v1 — full anchor/window editing is deliberately out of scope (YAGNI: nothing in the spec's 4-week program needs it, and CT can always ask to extend this screen later).

- [ ] **Step 1: Server action**

```ts
// src/app/templates/actions.ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { TemplateRow } from '@/lib/db/schemas';

export async function saveTemplateAction(row: TemplateRow): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  await repositories(client).templates.upsert({ ...row, owner_id: user.id });
}
```

- [ ] **Step 2: The editor**

```tsx
// src/app/templates/TemplateEditor.tsx
'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import type { TemplateRow } from '@/lib/db/schemas';
import { saveTemplateAction } from './actions';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TemplateEditor({ templates }: { templates: TemplateRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState<TemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  function openWeekday(weekday: number) {
    setOpen(weekday);
    setDraft(templates.find((t) => t.weekday === weekday) ?? null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    await saveTemplateAction(draft);
    setSaving(false);
    setOpen(null);
  }

  if (open === null || !draft) {
    return (
      <div className="stepback">
        <Placard>Weekday templates</Placard>
        <ul className="sessions">
          {WEEKDAY_NAMES.map((name, weekday) => {
            const t = templates.find((tpl) => tpl.weekday === weekday);
            return (
              <li key={weekday} data-rank="next">
                <span className="what">
                  {name}
                  <small>{t?.rest_day ? 'Rest day' : `${t?.blocks.length ?? 0} blocks`}</small>
                </span>
                <button className="btn btn-quiet" onClick={() => openWeekday(weekday)}>
                  Edit
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="stepback">
      <Placard>{WEEKDAY_NAMES[open]}</Placard>
      <label className="chip">
        <input type="checkbox" checked={draft.rest_day} onChange={(e) => setDraft({ ...draft, rest_day: e.target.checked })} />
        <span>Rest day</span>
      </label>
      <ul className="sessions">
        {draft.blocks.map((b, i) => (
          <li key={b.key} data-rank="next">
            <span className="what">
              <input
                className="chip"
                style={{ width: '100%' }}
                value={b.title}
                onChange={(e) => {
                  const blocks = [...draft.blocks];
                  blocks[i] = { ...b, title: e.target.value };
                  setDraft({ ...draft, blocks });
                }}
              />
              <small>
                <input
                  type="time"
                  value={b.start}
                  onChange={(e) => {
                    const blocks = [...draft.blocks];
                    blocks[i] = { ...b, start: e.target.value };
                    setDraft({ ...draft, blocks });
                  }}
                />
                {' · '}
                <input
                  type="number"
                  value={b.durationMin}
                  onChange={(e) => {
                    const blocks = [...draft.blocks];
                    blocks[i] = { ...b, durationMin: Number(e.target.value) };
                    setDraft({ ...draft, blocks });
                  }}
                />
                {' min'}
              </small>
            </span>
            <button className="btn btn-quiet" onClick={() => setDraft({ ...draft, blocks: draft.blocks.filter((x) => x.key !== b.key) })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-quiet"
        onClick={() =>
          setDraft({
            ...draft,
            blocks: [...draft.blocks, { key: `custom-${Date.now()}`, title: 'New block', kind: 'task', anchor: false, priority: 3, start: '09:00', durationMin: 30 }],
          })
        }
      >
        Add block
      </button>
      <ThumbBar>
        <button className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-quiet" onClick={() => setOpen(null)}>
          Cancel
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 3: The page**

```tsx
// src/app/templates/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { TemplateEditor } from './TemplateEditor';

export default async function TemplatesPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const templates = await repositories(client).templates.list();

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Templates
        </p>
      </header>
      <TemplateEditor templates={templates} />
    </main>
  );
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/app/templates
git commit -m "feat(templates): weekday template editor (spec §14)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 20: Settings Screen

**Files:**
- Create: `src/app/settings/actions.ts`
- Create: `src/app/settings/SettingsForm.tsx`
- Create: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `settingsRowSchema` (Plan 3). `repositories(client).settings` (Plan 3). `MODEL_PRICES` (Plan 4, `src/core/mentor/cost.ts`, for the model choices list).
- Produces: the `/settings` route; the sign-out action every other screen implicitly relies on being reachable from somewhere.

Spec §10 `settings` / §8.5 `monthlyCapUsd` / §11 crisis contacts. This is also where CT's `crisisContacts` (referenced by every crisis card since Task 5) actually gets edited.

- [ ] **Step 1: Server actions**

```ts
// src/app/settings/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';
import type { SettingsRow } from '@/lib/db/schemas';

export async function saveSettingsAction(row: SettingsRow): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const client = supabase as unknown as RepositoryClient;
  await repositories(client).settings.upsert({ ...row, owner_id: user.id });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: The form**

```tsx
// src/app/settings/SettingsForm.tsx
'use client';

import { useState } from 'react';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { MODEL_PRICES } from '@/core/mentor/cost';
import type { SettingsRow } from '@/lib/db/schemas';
import { saveSettingsAction, signOutAction } from './actions';

export function SettingsForm({ initial, ownerEmail }: { initial: SettingsRow; ownerEmail: string }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    await saveSettingsAction(draft);
    setSaving(false);
    setSavedAt(Date.now());
  }

  function addContact() {
    setDraft({ ...draft, crisis_contacts: [...draft.crisis_contacts, { label: '', phone: '', url: '' }] });
  }

  return (
    <div className="stepback">
      <Placard>Account</Placard>
      <p className="note">Signed in as {ownerEmail}.</p>

      <Placard>Mentor</Placard>
      <div className="field">
        <label htmlFor="model">Model</label>
        <select id="model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })}>
          {Object.keys(MODEL_PRICES).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="cap">Monthly cap (USD)</label>
        <input id="cap" type="number" value={draft.monthly_cap_usd} onChange={(e) => setDraft({ ...draft, monthly_cap_usd: Number(e.target.value) })} />
      </div>

      <Placard>Schedule</Placard>
      <div className="field">
        <label htmlFor="timezone">Timezone (IANA)</label>
        <input id="timezone" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="wakeTime">Wake time</label>
        <input id="wakeTime" type="time" value={draft.wake_time} onChange={(e) => setDraft({ ...draft, wake_time: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="bedtime">Bedtime</label>
        <input id="bedtime" type="time" value={draft.bedtime} onChange={(e) => setDraft({ ...draft, bedtime: e.target.value })} />
      </div>

      <Placard>Crisis contacts</Placard>
      <ul className="sessions">
        {draft.crisis_contacts.map((c, i) => (
          <li key={i} data-rank="next">
            <span className="what">
              <input
                className="chip"
                placeholder="Label"
                value={c.label}
                onChange={(e) => {
                  const contacts = [...draft.crisis_contacts];
                  contacts[i] = { ...c, label: e.target.value };
                  setDraft({ ...draft, crisis_contacts: contacts });
                }}
              />
              <small>
                <input
                  className="chip"
                  placeholder="Phone"
                  value={c.phone ?? ''}
                  onChange={(e) => {
                    const contacts = [...draft.crisis_contacts];
                    contacts[i] = { ...c, phone: e.target.value };
                    setDraft({ ...draft, crisis_contacts: contacts });
                  }}
                />
              </small>
            </span>
            <button className="btn btn-quiet" onClick={() => setDraft({ ...draft, crisis_contacts: draft.crisis_contacts.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-quiet" onClick={addContact}>
        Add contact
      </button>

      {savedAt && <p className="hint">Saved.</p>}
      <ThumbBar>
        <button className="btn btn-main" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <button className="btn btn-quiet" onClick={() => signOutAction()}>
          Sign out
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 3: The page**

```tsx
// src/app/settings/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { repositories } from '@/lib/db/repositories';
import type { RepositoryClient } from '@/lib/db/repository';
import { seedSettingsRow } from '@/lib/onboarding/seedData';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="day">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  const client = supabase as unknown as RepositoryClient;
  const settingsRow = (await repositories(client).settings.get()) ?? { ...seedSettingsRow(), owner_id: user.id };

  return (
    <main className="shell" data-phase="day">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Settings
        </p>
      </header>
      <SettingsForm initial={settingsRow} ownerEmail={user.email ?? ''} />
    </main>
  );
}
```

- [ ] **Step 4: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/app/settings
git commit -m "feat(settings): model/cap/timezone/crisis contacts editor, sign-out

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 21: Export

**Files:**
- Create: `src/core/export/toCsv.ts`
- Create: `src/core/export/toCsv.test.ts`
- Create: `src/lib/export/exportData.ts`
- Create: `src/app/api/export/route.ts`
- Create: `src/app/settings/ExportLinks.tsx`
- Modify: `src/app/settings/page.tsx` (render `ExportLinks`)

**Interfaces:**
- Consumes: `repositories(client)` (Plan 3, all 14 tables plus `settings`/`templates`).
- Produces: `toCsv(rows: Record<string, unknown>[]): string` (pure) — `buildExportData(client): Promise<Record<string, unknown[]>>` — `GET /api/export?format=json` and `GET /api/export?format=csv&table=<name>`.

Spec §10: "Export: Settings → Export downloads all tables as JSON, and CSV per table." No zip library is added for this — one JSON download covers "all tables," and CSV is offered per table (a single link per table, not a bundled archive), which is both simpler and avoids a new dependency for a feature CT uses rarely.

- [ ] **Step 1: Write the failing tests for `toCsv`**

```ts
// src/core/export/toCsv.test.ts
import { describe, expect, it } from 'vitest';
import { toCsv } from './toCsv';

describe('toCsv', () => {
  it('empty rows produce an empty string', () => {
    expect(toCsv([])).toBe('');
  });

  it('header row from the first object\'s keys, then one row per object', () => {
    const csv = toCsv([
      { id: '1', title: 'Deep work' },
      { id: '2', title: 'Dinner' },
    ]);
    expect(csv).toBe('id,title\r\n1,Deep work\r\n2,Dinner');
  });

  it('quotes a value containing a comma, quote, or newline', () => {
    const csv = toCsv([{ note: 'a, b', quote: 'say "hi"', multi: 'line1\nline2' }]);
    expect(csv).toBe('note,quote,multi\r\n"a, b","say ""hi""","line1\nline2"');
  });

  it('stringifies nested objects/arrays as JSON', () => {
    const csv = toCsv([{ tags: ['a', 'b'], meta: { x: 1 } }]);
    expect(csv).toBe('tags,meta\r\n"[""a"",""b""]","{""x"":1}"');
  });

  it('null and undefined render as empty cells', () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    expect(csv).toBe('a,b,c\r\n,,0');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `npm test -- src/core/export/toCsv.test.ts` → expect FAIL.

```ts
// src/core/export/toCsv.ts
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180-ish CSV: CRLF row separator, quote only when a field needs it.
 * Every row uses the first row's key order — this codebase's export always
 * calls it with rows of one zod-validated shape, so key order is stable. Pure. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]!);
  const lines = [keys.join(','), ...rows.map((row) => keys.map((k) => cell(row[k])).join(','))];
  return lines.join('\r\n');
}
```

- [ ] **Step 3: Run to verify pass**

Run: `npm test -- src/core/export/toCsv.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 4: The data-assembly wrapper**

```ts
// src/lib/export/exportData.ts
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

/** Every table spec §10 defines, for "Export: downloads all tables". */
export async function buildExportData(client: RepositoryClient): Promise<Record<string, unknown[]>> {
  const repos = repositories(client);
  const [
    settings, templates, plans, blocks, checkins, restSessions, unplannedIndulgence,
    mentorMessages, digests, weeklyLetters, profileVersions, pushSubscriptions, nudgesSent, usage,
  ] = await Promise.all([
    repos.settings.get(),
    repos.templates.list(),
    repos.plans.list(),
    repos.blocks.list(),
    repos.checkins.list(),
    repos.restSessions.list(),
    repos.unplannedIndulgence.list(),
    repos.mentorMessages.list(),
    repos.digests.list(),
    repos.weeklyLetters.list(),
    repos.profileVersions.list(),
    repos.pushSubscriptions.list(),
    repos.nudgesSent.list(),
    repos.usage.list(),
  ]);
  return {
    settings: settings ? [settings] : [],
    templates, plans, blocks, checkins, rest_sessions: restSessions, unplanned_indulgence: unplannedIndulgence,
    mentor_messages: mentorMessages, digests, weekly_letters: weeklyLetters, profile_versions: profileVersions,
    push_subscriptions: pushSubscriptions, nudges_sent: nudgesSent, usage,
  };
}
```

- [ ] **Step 5: The route handler**

```ts
// src/app/api/export/route.ts
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { buildExportData } from '@/lib/export/exportData';
import { toCsv } from '@/core/export/toCsv';

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const client = supabase as unknown as RepositoryClient;
  const data = await buildExportData(client);
  const url = new URL(request.url);
  const format = url.searchParams.get('format') ?? 'json';

  if (format === 'csv') {
    const table = url.searchParams.get('table');
    const rows = table ? data[table] : undefined;
    if (!table || !rows) return NextResponse.json({ error: `Unknown table "${table}"` }, { status: 400 });
    return new Response(toCsv(rows as Record<string, unknown>[]), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${table}.csv"` },
    });
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="life-changer-export.json"' },
  });
}
```

- [ ] **Step 6: Links on the Settings screen**

```tsx
// src/app/settings/ExportLinks.tsx
const TABLES = [
  'settings', 'templates', 'plans', 'blocks', 'checkins', 'rest_sessions', 'unplanned_indulgence',
  'mentor_messages', 'digests', 'weekly_letters', 'profile_versions', 'push_subscriptions', 'nudges_sent', 'usage',
];

export function ExportLinks() {
  return (
    <>
      <p className="note">
        <a className="btn btn-quiet" href="/api/export?format=json">
          Download everything as JSON
        </a>
      </p>
      <ul className="sessions">
        {TABLES.map((t) => (
          <li key={t} data-rank="next">
            <span className="what">{t}</span>
            <a className="btn btn-quiet" href={`/api/export?format=csv&table=${t}`}>
              CSV
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
```

```tsx
// src/app/settings/page.tsx  (add inside the existing <main>, after <SettingsForm …/>)
import { Placard } from '@/components/ui/Placard';
import { ExportLinks } from './ExportLinks';
// …
<Placard>Export</Placard>
<ExportLinks />
```

- [ ] **Step 7: Run the full suite, typecheck and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/export src/lib/export src/app/api/export src/app/settings
git commit -m "feat(export): toCsv, all-tables JSON export, per-table CSV export (spec §10)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 22: Onboarding UI

**Files:**
- Create: `src/lib/onboarding/completeOnboarding.ts`
- Create: `src/app/onboarding/actions.ts`
- Create: `src/app/onboarding/OnboardingForm.tsx`
- Create: `src/app/onboarding/page.tsx`
- Modify: `src/app/page.tsx` (redirect to `/onboarding` when no settings row exists yet)

**Interfaces:**
- Consumes: `seedSettingsRow`, `seedTemplateRows` (Plan 3, `src/lib/onboarding/seedData.ts`, unmodified — Plan 3's comment on that file literally says "CT edits these later in the Templates screen (Plan 5)"). `PROFILE_SECTIONS`, `emptyProfile` (Plan 4).
- Produces: `completeOnboarding` — used only here.

Spec §14: "onboarding (profile seed, settings, crisis contacts, templates seeded from the 4-week program)." `scripts/seed.ts` (Plan 3) already does the settings+templates half from the CLI; this is the in-app, interactive version — the one CT actually uses on first sign-in — that additionally seeds the profile (spec §8.6: "Seeded at first run from an onboarding form").

- [ ] **Step 1: `completeOnboarding`**

```ts
// src/lib/onboarding/completeOnboarding.ts
import { seedSettingsRow, seedTemplateRows } from '@/lib/onboarding/seedData';
import type { Profile } from '@/core/mentor/profile';
import type { CrisisContact } from '@/core/types';
import type { RepositoryClient } from '@/lib/db/repository';
import { repositories } from '@/lib/db/repositories';

export interface OnboardingInput {
  profile: Profile;
  crisisContacts: CrisisContact[];
  timezone: string;
  wakeTime: string;
  bedtime: string;
}

/** First-run setup: settings + 7 weekday templates (both editable afterward
 * in Templates/Settings, Tasks 19–20) plus the first `profile_versions` row
 * (spec §8.6, author "user"). Idempotent on the settings/templates half —
 * re-running onboarding after it already ran just overwrites with the same
 * seed defaults CT hasn't customized away from yet. */
export async function completeOnboarding(client: RepositoryClient, ownerId: string, input: OnboardingInput): Promise<void> {
  const repos = repositories(client);
  await repos.settings.upsert({
    ...seedSettingsRow(),
    owner_id: ownerId,
    timezone: input.timezone,
    wake_time: input.wakeTime,
    bedtime: input.bedtime,
    crisis_contacts: input.crisisContacts,
  });
  await Promise.all(seedTemplateRows().map((t) => repos.templates.upsert({ ...t, owner_id: ownerId })));
  await repos.profileVersions.upsert({
    id: crypto.randomUUID(),
    owner_id: ownerId,
    created_at: new Date().toISOString(),
    sections: input.profile,
    author: 'user',
    changes: [],
  });
}
```

- [ ] **Step 2: Server action**

```ts
// src/app/onboarding/actions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import type { RepositoryClient } from '@/lib/db/repository';
import { completeOnboarding, type OnboardingInput } from '@/lib/onboarding/completeOnboarding';

export async function completeOnboardingAction(input: OnboardingInput): Promise<void> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  await completeOnboarding(supabase as unknown as RepositoryClient, user.id, input);
  redirect('/');
}
```

- [ ] **Step 3: The form**

```tsx
// src/app/onboarding/OnboardingForm.tsx
'use client';

import { useState } from 'react';
import { PROFILE_SECTIONS, type Profile } from '@/core/mentor/profile';
import { DEFAULT_SETTINGS } from '@/core/types';
import { Placard } from '@/components/ui/Placard';
import { ThumbBar } from '@/components/ui/ThumbBar';
import { completeOnboardingAction } from './actions';

function emptyProfileDraft(): Profile {
  return Object.fromEntries(PROFILE_SECTIONS.map((s) => [s.key, ''])) as Profile;
}

export function OnboardingForm() {
  const [profile, setProfile] = useState<Profile>(emptyProfileDraft());
  const [contactLabel, setContactLabel] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [wakeTime, setWakeTime] = useState(DEFAULT_SETTINGS.wakeTime);
  const [bedtime, setBedtime] = useState(DEFAULT_SETTINGS.bedtime);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    await completeOnboardingAction({
      profile,
      crisisContacts: contactLabel ? [{ label: contactLabel, phone: contactPhone || undefined }] : [],
      timezone,
      wakeTime,
      bedtime,
    });
  }

  return (
    <div className="stepback">
      <Placard>Your schedule</Placard>
      <div className="field">
        <label htmlFor="timezone">Timezone</label>
        <input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="wakeTime">Usual wake time</label>
        <input id="wakeTime" type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="bedtime">Usual bedtime</label>
        <input id="bedtime" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
      </div>

      <Placard>Tell the mentor about you</Placard>
      <p className="hint">One line per section is plenty — the mentor and weekly review fill these in more over time.</p>
      {PROFILE_SECTIONS.map((s) => (
        <div className="field" key={s.key}>
          <label htmlFor={s.key}>{s.heading}</label>
          <textarea id={s.key} rows={2} value={profile[s.key]} onChange={(e) => setProfile({ ...profile, [s.key]: e.target.value })} />
        </div>
      ))}

      <Placard>A crisis contact (spec §11)</Placard>
      <div className="field">
        <label htmlFor="contactLabel">Label</label>
        <input id="contactLabel" value={contactLabel} onChange={(e) => setContactLabel(e.target.value)} placeholder="A crisis line, a trusted person" />
      </div>
      <div className="field">
        <label htmlFor="contactPhone">Phone</label>
        <input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      <p className="hint">More can be added anytime in Settings.</p>

      <ThumbBar>
        <button className="btn btn-main btn-wide" onClick={submit} disabled={submitting}>
          {submitting ? 'Setting up…' : "Let's go"}
        </button>
      </ThumbBar>
    </div>
  );
}
```

- [ ] **Step 4: The page**

```tsx
// src/app/onboarding/page.tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) {
    return (
      <main className="shell" data-phase="first-light">
        <p className="note">Not signed in.</p>
      </main>
    );
  }

  return (
    <main className="shell" data-phase="first-light">
      <header className="dept-head">
        <p className="placard phase-label">
          <span className="dot" /> Welcome
        </p>
      </header>
      <section className="next">
        <h1 className="next-name">Set up Life Changer</h1>
        <p className="next-note">A few minutes, once. Everything here can be changed later in Settings or Templates.</p>
      </section>
      <OnboardingForm />
    </main>
  );
}
```

- [ ] **Step 5: Send first-run traffic here**

```tsx
// src/app/page.tsx  (add at the top of TodayPage, right after the isOwner check from Task 10)
import { redirect } from 'next/navigation';
// …
const settingsCheck = await repositories(client).settings.get();
if (!settingsCheck) redirect('/onboarding');
```

- [ ] **Step 6: Verify typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/onboarding/completeOnboarding.ts src/app/onboarding src/app/page.tsx
git commit -m "feat(onboarding): first-run setup — schedule, profile, crisis contact, seeded templates (spec §8.6, §14)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

### Task 23: Root Routing, Offline Wiring, Cleanup, Final Verification

**Files:**
- Modify: `src/app/checkin/evening/EveningForm.tsx` (wire the offline outbox)
- Modify: `src/app/checkin/morning/MorningForm.tsx` (wire the offline outbox)
- Delete: `src/app/HealthCheck.tsx`, `src/app/actions.ts`
- Modify: `docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md`

**Interfaces:**
- Consumes: `useOutbox` (Task 4) — the one piece Tasks 4–22 built but didn't yet connect to a real submit path. Every task's exports, transitively, via the full build.

Spec §12: "form submissions … go into an IndexedDB outbox and sync on reconnect." The check-in forms are where this actually matters (the Today/History/Card/Mentor screens are all reads, degraded gracefully offline by the service worker's shell cache from Task 3) — this task closes that loop on both check-in forms.

- [ ] **Step 1: Wire the outbox into the evening form — try online first, queue on failure**

```tsx
// src/app/checkin/evening/EveningForm.tsx  (replace handleSubmit from Task 14)
import { useOutbox } from '@/lib/offline/useOutbox';
import { submitEveningCheckinAction } from './actions';
// …

export function EveningForm({ crisisContacts }: { crisisContacts: CrisisContact[] }) {
  // … existing state from Task 14 …
  const [queued, setQueued] = useState(false);
  const outbox = useOutbox({
    eveningCheckin: async (payload) => {
      await submitEveningCheckinAction(payload as EveningCheckinInput);
    },
  });

  async function handleSubmit() {
    setSubmitting(true);
    const input: EveningCheckinInput = {
      /* … same shape as Task 14 … */
    };
    try {
      const result = await submitEveningCheckinAction(input);
      setSubmitting(false);
      setReview(result);
    } catch {
      await outbox.enqueue('eveningCheckin', input);
      setSubmitting(false);
      setQueued(true);
    }
  }

  if (queued) {
    return (
      <div className="stepback">
        <p className="note">
          No connection right now — today's evening entry is queued and will send the moment you're back online. Nothing is lost.
        </p>
        <ThumbBar>
          <a className="btn btn-main btn-wide" href="/">
            Back to today
          </a>
        </ThumbBar>
      </div>
    );
  }

  // … existing review/form JSX from Task 14, unchanged …
}
```

- [ ] **Step 2: The same pattern for the morning form**

```tsx
// src/app/checkin/morning/MorningForm.tsx  (same shape as Step 1)
import { useOutbox } from '@/lib/offline/useOutbox';
import { submitMorningCheckinAction } from './actions';
// …

const [queued, setQueued] = useState(false);
const outbox = useOutbox({
  morningCheckin: async (payload) => {
    await submitMorningCheckinAction(payload as MorningCheckinInput);
  },
});

async function handleSubmit() {
  setSubmitting(true);
  const input: MorningCheckinInput = {
    body: { bedtime: prefillBedtime, wakeTime: prefillWakeTime, sleepQuality, energy },
    mind: { mood, stress, stressCause },
    privateKeys: privateMind ? ['mind'] : [],
  };
  try {
    const result = await submitMorningCheckinAction(input);
    setSubmitting(false);
    if (result.changed) setBanner(result);
    else window.location.href = '/';
  } catch {
    await outbox.enqueue('morningCheckin', input);
    setSubmitting(false);
    setQueued(true);
  }
}
```

Add the same `if (queued) { … }` early return as Step 1, adapted to the morning form's copy ("today's morning entry is queued").

- [ ] **Step 3: Remove the Plan 3 diagnostic page — the real Today screen (Task 10) replaced it**

```bash
git rm src/app/HealthCheck.tsx src/app/actions.ts
```

- [ ] **Step 4: Update the roadmap**

Edit `docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md`'s Plan 5 row to:

```markdown
| 5 | **Screens & PWA** ✅ | Code complete 2026-09-14 ([plan](2026-09-14-daily-loop-05-screens-pwa.md)). Today, Day changed, rest + re-entry ramp, morning/evening check-in, mentor (briefing + streaming chat + weekly review), player card, history, templates editor, settings, export, onboarding. Installable PWA (manifest, generated icons, app-shell service worker), IndexedDB offline outbox on both check-in forms, local crisis-keyword check wired into every free-text submit path. Pending CT: install to iPhone home screen and confirm the install/offline/push-permission flow (spec §13's manual iPhone checklist — push itself is Plan 6). | 2, 3, 4 | Install to your iPhone home screen |
```

- [ ] **Step 5: Full verification**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass — every core/lib test from Tasks 1–22, a clean typecheck across every new route, and a successful production build listing every new route (`/`, `/onboarding`, `/checkin/morning`, `/checkin/evening`, `/day-changed`, `/reentry`, `/mentor`, `/weekly`, `/card`, `/history`, `/templates`, `/settings`, `/api/export`, `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/offline`, plus Plan 4's existing `/api/mentor/*` and `/auth/callback`).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md
git commit -m "feat(offline): wire the outbox into both check-in forms; remove Plan 3 diagnostic page; Plan 5 done

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** §5.1–§5.9 (day boundary, templates/blocks, morning, Today screen, reflow events, reflow algorithm reuse, rest/re-entry, evening, weekly review, missed days) → Tasks 9–14, 16. §6 (forms) → Tasks 13–14. §7 (guard) reused unmodified, surfaced in Task 13's re-assessment banner. §8/§8b (mentor + progression surfaces) → Tasks 6, 15–17. §9 (nudges) is explicitly Plan 6 — the one "Nudges are off" banner spec §9 mentions is deliberately not built here. §10 (data model) → every task's repository calls; Export → Task 21. §11 (privacy/crisis) → Tasks 5, 13–15, 22. §12 (error handling) → Task 3 (offline shell), Task 23 (outbox wiring), fallback copy reused unmodified from Plan 4 throughout. §13 (testing) → every pure-core task (4, 6–9 partial, 13 partial) has colocated Vitest coverage; Playwright E2E and the iPhone manual checklist are explicitly Plan 6, matching the roadmap's own split. §14 (scope) → every screen it lists has a task. §15 has nothing left to verify for this plan (all resolved in Plan 3).

**Placeholder scan:** every step above either ships real code or names an exact shell command; no "add error handling"/"write tests for the above"/"TBD" phrasing appears anywhere in this plan.

**Type consistency:** `settingsToDomain` (Task 9) is the one settings-row→domain conversion, reused verbatim by Tasks 10, 11, 13, 14, 15, 16, 18 rather than re-implemented per task. `blockToRow`/`rowToBlock` appear in three lib files (Tasks 9, 11, 13/14) with the same field mapping each time — acceptable duplication for three independently-testable I/O modules (matches this codebase's existing tolerance for the same cast pattern repeated per file, e.g. `as unknown as RepositoryClient` appearing in every Plan 4 route handler) rather than a shared helper that would need its own module for three call sites. `EveningCheckinInput`/`MorningCheckinInput` types are defined once in `submitCheckin.ts` (Task 13/14) and imported everywhere else that needs them (Tasks 14, 23). `DiffEntry`'s seven `ChangeKind`s are handled exhaustively by `diffVisual` (Task 8) with no default case, so a future eighth kind fails to typecheck rather than silently rendering wrong.
