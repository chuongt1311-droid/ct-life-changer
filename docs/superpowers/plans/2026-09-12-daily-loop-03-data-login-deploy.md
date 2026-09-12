# Plan 3 — Data, Login & Deploy Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Next.js app to the existing repo with a Supabase-backed data layer (schema, RLS, zod-validated repositories), owner-only magic-link auth, onboarding seed data, and a Vercel deployment — so the pure `src/core` logic built in Plans 1/1b has somewhere real to read and write, with no screens and no Anthropic calls yet.

**Architecture:** Next.js App Router lives at `src/app` (the repo already roots everything under `src/`). All Supabase access goes through a small generic repository factory in `src/lib/db` that validates every row with zod before it reaches application code; two tables (`settings`, `templates`) get bespoke wrappers because they aren't simple id-keyed collections. `src/core` gains one new pure module, `daySummary`, which turns raw rows into the `DaySummary[]` the already-built `guard` consumes — it has no I/O, so it stays inside the pure core and is tested the same way as everything else there. Auth is Supabase magic-link, gated server-side (middleware) to a single `OWNER_EMAIL`.

**Tech Stack:** Next.js (App Router) + TypeScript, `@supabase/supabase-js` + `@supabase/ssr`, `zod`, Vitest 5.0.0, Node 24. Existing: `@anthropic-ai/sdk` (unused until Plan 4).

**Spec:** [`docs/superpowers/specs/2026-09-11-daily-loop-design.md`](../specs/2026-09-11-daily-loop-design.md) — §4.2 (Auth), §5.2 (Templates/blocks), §6 (Forms — exact field names), §10 (Data model), §11 (Privacy), §14 (Scope), §15 (To verify).

**Roadmap:** [`docs/superpowers/plans/2026-09-11-daily-loop-00-roadmap.md`](2026-09-11-daily-loop-00-roadmap.md) — Plan 3 row.

## Global Constraints

- `src/core/**` stays pure: no I/O, no clock reads, no randomness. New pure modules may be added there; existing modules are not touched.
- `npm test` and `npm run typecheck` must both pass before every commit.
- Write "CT" or "they" in any prose/comments/copy — CT's pronouns are unstated.
- No shame language and no streaks in any user-facing copy, seed data, or column naming (none is expected in this plan, but seed data and repository code must not introduce any).
- Claude never creates accounts, never runs an OAuth login flow, and never sees or types a real Supabase/Vercel/GitHub credential. Every step that needs one is marked **CT does this** and says exactly what to paste where. Claude only writes files, runs local `npm`/`git`/`tsc`/`vitest` commands, and (once CT has authenticated the CLIs on their own machine) build/verification commands that use that already-authenticated session — the same way `git commit` already works in this repo without Claude touching CT's credentials.
- Single user, single environment. No test/staging Supabase project — the one CT creates is used directly; RLS is what keeps it safe, not a second project.

---

### Task 1: Next.js app shell, no Supabase yet

**Files:**
- Modify: `package.json` (add `next`, `react`, `react-dom`, `tsx`, `dotenv`; add `dev`/`build`/`start` scripts)
- Modify: `tsconfig.json` (Next-compatible compiler options)
- Create: `next.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx` (placeholder — replaced with the real health-check page in Task 9)
- Create: `.gitignore` additions (`.next/`, `next-env.d.ts`)

**Interfaces:**
- Produces: a working `npm run dev` / `npm run build` for every later task to build on. No exported functions.

- [ ] **Step 1: Install Next.js and React**

```bash
npm install next@latest react@latest react-dom@latest
npm install --save-dev tsx dotenv
```

- [ ] **Step 2: Update `package.json` scripts**

Add these three scripts alongside the existing `test`, `test:watch`, `typecheck`:

```json
"dev": "next dev",
"build": "next build",
"start": "next start"
```

- [ ] **Step 3: Update `tsconfig.json` for Next's App Router**

Replace the file with:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "incremental": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "types": ["node"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "vitest.config.ts", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Add `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Add the App Router shell**

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

export const metadata = {
  title: "CT's Life Changer",
  description: 'Daily Loop — single-user companion app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (placeholder; Task 9 replaces the body):

```tsx
export default function HomePage() {
  return <main>Daily Loop — data layer under construction.</main>;
}
```

- [ ] **Step 6: Update `.gitignore`**

Add two lines:

```
.next/
next-env.d.ts
```

- [ ] **Step 7: Verify the build**

```bash
npm run build
```

Expected: build succeeds (it also generates `next-env.d.ts`). Then:

```bash
npm run typecheck
npm test
```

Expected: both still pass — the existing `src/core` suite is untouched by this task.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs .gitignore src/app
git commit -m "feat(app): add Next.js App Router shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: CT does this — GitHub remote and push**

The repo has no remote yet. In this project's terminal:

```bash
gh repo create ct-life-changer --private --source=. --remote=origin
git push -u origin main
```

(Or, without `gh`: create an empty private repo at github.com yourself, then `git remote add origin <url>` and `git push -u origin main`.) Either way this step is CT's own GitHub session — Claude does not create the repo or touch GitHub credentials.

---

### Task 2: Supabase schema, RLS, and project keys

**Files:**
- Create: `supabase/migrations/0001_init.sql`
- Create: `.env.example`
- Modify: `.gitignore` (confirm `.env*` / `!.env.example` already present — it is)

**Interfaces:**
- Produces: 14 tables matching spec §10, every one with `owner_id uuid not null default auth.uid()` and row-level security restricted to `owner_id = auth.uid()`. Later tasks' repositories assume exactly this schema (table names, column names, and types below are load-bearing for Task 5).

- [ ] **Step 1: Write the migration SQL**

`supabase/migrations/0001_init.sql`:

```sql
-- Daily Loop — Plan 3 schema. Single owner (CT); every table is owner_id-scoped
-- and RLS-restricted to auth.uid(). No other Supabase auth user should ever exist,
-- but RLS makes the app correct even if one did.

create table if not exists settings (
  id text primary key default 'singleton' check (id = 'singleton'),
  owner_id uuid not null default auth.uid(),
  timezone text not null,
  wake_time text not null,
  bedtime text not null,
  model text not null,
  monthly_cap_usd numeric not null,
  nudge_daily_cap integer not null,
  deep_work_daily_cap_min integer not null,
  thresholds jsonb not null,
  crisis_contacts jsonb not null default '[]'::jsonb
);

create table if not exists templates (
  weekday integer primary key check (weekday between 0 and 6),
  owner_id uuid not null default auth.uid(),
  rest_day boolean not null default false,
  blocks jsonb not null default '[]'::jsonb
);

create table if not exists plans (
  date date primary key,
  owner_id uuid not null default auth.uid(),
  state text not null default 'ready',
  flags jsonb not null default '[]'::jsonb,
  adjustments jsonb not null default '[]'::jsonb,
  overridden boolean not null default false
);

create table if not exists blocks (
  id text primary key,
  owner_id uuid not null default auth.uid(),
  date date not null,
  title text not null,
  kind text not null,
  anchor boolean not null default false,
  priority integer not null,
  start integer not null,
  "end" integer not null,
  min_minutes integer not null,
  window_start integer,
  window_end integer,
  tags text[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb,
  recovery_variant jsonb,
  status text not null default 'planned',
  source text not null default 'template'
);
create index if not exists blocks_date_idx on blocks (date);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  date date not null,
  type text not null check (type in ('morning', 'evening')),
  sections jsonb not null default '{}'::jsonb,
  private_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists checkins_date_idx on checkins (date);

create table if not exists rest_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  date date not null,
  block_id text,
  activity text not null,
  planned boolean not null default true,
  started_at timestamptz,
  ended_at timestamptz,
  reentry_ack_at timestamptz
);
create index if not exists rest_sessions_date_idx on rest_sessions (date);

create table if not exists unplanned_indulgence (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  date date not null,
  activity text not null,
  minutes integer not null
);
create index if not exists unplanned_indulgence_date_idx on unplanned_indulgence (date);

create table if not exists mentor_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  date date not null,
  route text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  state_at_time text,
  usage_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists mentor_messages_date_idx on mentor_messages (date);

create table if not exists digests (
  date date primary key,
  owner_id uuid not null default auth.uid(),
  text text not null
);

create table if not exists weekly_letters (
  week_start date primary key,
  owner_id uuid not null default auth.uid(),
  letter text not null,
  metrics jsonb not null default '{}'::jsonb,
  changes jsonb not null default '{}'::jsonb,
  profile_version_id uuid
);

create table if not exists profile_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  sections jsonb not null default '{}'::jsonb,
  author text not null check (author in ('claude', 'user')),
  changes jsonb not null default '[]'::jsonb
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  endpoint text not null unique,
  keys jsonb not null,
  device_label text,
  created_at timestamptz not null default now()
);

create table if not exists nudges_sent (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  date date not null,
  type text not null,
  block_id text,
  sent_at timestamptz not null default now(),
  acked_at timestamptz
);
create index if not exists nudges_sent_date_idx on nudges_sent (date);

create table if not exists usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  route text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric not null default 0
);

-- Row-level security: every table, same rule. Single owner, so this is
-- deliberately simple rather than parameterized per-role.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'settings', 'templates', 'plans', 'blocks', 'checkins', 'rest_sessions',
    'unplanned_indulgence', 'mentor_messages', 'digests', 'weekly_letters',
    'profile_versions', 'push_subscriptions', 'nudges_sent', 'usage'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t || '_owner_only', t
    );
  end loop;
end $$;
```

- [ ] **Step 2: CT does this — create the Supabase project and apply the migration**

1. At supabase.com, create a new project (CT's own account, already created).
2. Open **SQL Editor** in the Supabase dashboard, paste the full contents of `supabase/migrations/0001_init.sql`, and run it. Confirm all 14 tables appear under **Table Editor** with RLS shown as enabled.
3. From **Project Settings → API**, copy: the Project URL, the `anon` public key, and the `service_role` key (service role bypasses RLS — it is only ever used server-side, never in the browser).
4. From **Authentication → Providers**, confirm Email (magic link) is enabled (it is by default). Under **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` as a redirect URL for now (the production URL is added in Task 9 once the Vercel domain exists).

- [ ] **Step 3: Add `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 4: CT does this — fill in `.env.local`**

```bash
cp .env.example .env.local
```

Then CT pastes the four values from Step 2 into `.env.local` themselves (the Project URL, anon key, service role key, and CT's own email as `OWNER_EMAIL`). `.env.local` is already covered by the repo's `.env*` gitignore rule — it must never be committed, and Claude never opens or reads this file.

- [ ] **Step 5: Commit the migration and example env file**

```bash
git add supabase/migrations/0001_init.sql .env.example
git commit -m "feat(db): Supabase schema and RLS for all 14 tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: zod schemas and row types

**Files:**
- Create: `src/lib/db/schemas.ts`
- Create: `src/lib/db/schemas.test.ts`

**Interfaces:**
- Consumes: `Block`, `BlockKind`, `BlockStatus`, `BlockSource`, `Priority`, `Settings`, `DEFAULT_SETTINGS`, `Thresholds`, `CrisisContact`, `DayTemplate`, `TemplateBlock` from `@/core/types`.
- Produces: one zod schema per table, named `<table>RowSchema`, each inferring a `<Table>Row` type. These are the only types later tasks (4, 5, 6, 8) use for repository rows — do not redefine row shapes elsewhere.

- [ ] **Step 1: Write the failing test**

`src/lib/db/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import { blockRowSchema, settingsRowSchema, templateRowSchema } from './schemas';

describe('settingsRowSchema', () => {
  it('accepts a row shaped like DEFAULT_SETTINGS', () => {
    const row = {
      id: 'singleton',
      owner_id: '00000000-0000-0000-0000-000000000000',
      timezone: DEFAULT_SETTINGS.timezone,
      wake_time: DEFAULT_SETTINGS.wakeTime,
      bedtime: DEFAULT_SETTINGS.bedtime,
      model: DEFAULT_SETTINGS.model,
      monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
      nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
      deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
      thresholds: DEFAULT_THRESHOLDS,
      crisis_contacts: [],
    };
    expect(settingsRowSchema.parse(row)).toEqual(row);
  });

  it('rejects a row missing thresholds', () => {
    const row = { id: 'singleton', owner_id: 'x', timezone: 'UTC' };
    expect(() => settingsRowSchema.parse(row)).toThrow();
  });
});

describe('templateRowSchema', () => {
  it('accepts a rest-day template with no blocks', () => {
    const row = { weekday: 5, owner_id: 'x', rest_day: true, blocks: [] };
    expect(templateRowSchema.parse(row)).toEqual(row);
  });

  it('rejects weekday out of range', () => {
    const row = { weekday: 7, owner_id: 'x', rest_day: true, blocks: [] };
    expect(() => templateRowSchema.parse(row)).toThrow();
  });
});

describe('blockRowSchema', () => {
  it('accepts a fixed anchor block', () => {
    const row = {
      id: '2026-09-15:wake',
      owner_id: 'x',
      date: '2026-09-15',
      title: 'Wake',
      kind: 'routine',
      anchor: true,
      priority: 5,
      start: 420,
      end: 450,
      min_minutes: 30,
      window_start: null,
      window_end: null,
      tags: ['morningRoutine'],
      checklist: [],
      recovery_variant: null,
      status: 'planned',
      source: 'template',
    };
    expect(blockRowSchema.parse(row)).toEqual(row);
  });

  it('rejects an unknown status', () => {
    const row = {
      id: 'x',
      owner_id: 'x',
      date: '2026-09-15',
      title: 'x',
      kind: 'task',
      anchor: false,
      priority: 3,
      start: 0,
      end: 1,
      min_minutes: 1,
      window_start: null,
      window_end: null,
      tags: [],
      checklist: [],
      recovery_variant: null,
      status: 'not-a-real-status',
      source: 'template',
    };
    expect(() => blockRowSchema.parse(row)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test src/lib/db/schemas.test.ts
```

Expected: FAIL — `Cannot find module './schemas'` (or similar), since the file doesn't exist yet.

- [ ] **Step 3: Install zod**

```bash
npm install zod
```

- [ ] **Step 4: Write `src/lib/db/schemas.ts`**

```ts
import { z } from 'zod';

const priority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const blockKind = z.enum(['task', 'training', 'rest', 'buffer', 'routine']);
const blockStatus = z.enum(['planned', 'active', 'done', 'partial', 'skipped', 'missed', 'dropped']);
const blockSource = z.enum(['template', 'manual', 'urgent', 'guard']);

const checklistItemSchema = z.object({ label: z.string(), done: z.boolean() });
const templateBlockSchema = z.object({
  key: z.string(),
  title: z.string(),
  kind: blockKind,
  anchor: z.boolean(),
  priority,
  start: z.string(),
  durationMin: z.number(),
  minMinutes: z.number().optional(),
  window: z.object({ earliestStart: z.string(), latestEnd: z.string() }).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.string()).optional(),
  recoveryVariant: z.object({ title: z.string(), checklist: z.array(z.string()) }).optional(),
});

const thresholdsSchema = z.object({
  sleepLowHours: z.number(),
  sleepLowNights: z.number(),
  sleepLowWindow: z.number(),
  energyLowMax: z.number(),
  energyLowDays: z.number(),
  stressHighMin: z.number(),
  stressHighDays: z.number(),
  grindDays: z.number(),
  grindWindow: z.number(),
  grindRestDayTrainings: z.number(),
  indulgeHighMin: z.number(),
  indulgeHighDays: z.number(),
  anchorSkipRatio: z.number(),
  anchorSkipDays: z.number(),
  anchorSkipMinEnergy: z.number(),
});

const crisisContactSchema = z.object({
  label: z.string(),
  phone: z.string().optional(),
  url: z.string().optional(),
});

export const settingsRowSchema = z.object({
  id: z.literal('singleton'),
  owner_id: z.string(),
  timezone: z.string(),
  wake_time: z.string(),
  bedtime: z.string(),
  model: z.string(),
  monthly_cap_usd: z.number(),
  nudge_daily_cap: z.number(),
  deep_work_daily_cap_min: z.number(),
  thresholds: thresholdsSchema,
  crisis_contacts: z.array(crisisContactSchema),
});
export type SettingsRow = z.infer<typeof settingsRowSchema>;

export const templateRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  owner_id: z.string(),
  rest_day: z.boolean(),
  blocks: z.array(templateBlockSchema),
});
export type TemplateRow = z.infer<typeof templateRowSchema>;

export const planRowSchema = z.object({
  date: z.string(),
  owner_id: z.string(),
  state: z.enum(['ready', 'drifting', 'depleted', 'grinding']),
  flags: z.array(z.object({ code: z.string(), state: z.string(), reason: z.string() })),
  adjustments: z.array(z.record(z.string(), z.unknown())),
  overridden: z.boolean(),
});
export type PlanRow = z.infer<typeof planRowSchema>;

export const blockRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  title: z.string(),
  kind: blockKind,
  anchor: z.boolean(),
  priority,
  start: z.number(),
  end: z.number(),
  min_minutes: z.number(),
  window_start: z.number().nullable(),
  window_end: z.number().nullable(),
  tags: z.array(z.string()),
  checklist: z.array(checklistItemSchema),
  recovery_variant: z.object({ title: z.string(), checklist: z.array(z.string()) }).nullable(),
  status: blockStatus,
  source: blockSource,
});
export type BlockRow = z.infer<typeof blockRowSchema>;

export const checkinRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  type: z.enum(['morning', 'evening']),
  sections: z.record(z.string(), z.record(z.string(), z.unknown())),
  private_keys: z.array(z.string()),
  created_at: z.string(),
});
export type CheckinRow = z.infer<typeof checkinRowSchema>;

export const restSessionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  block_id: z.string().nullable(),
  activity: z.string(),
  planned: z.boolean(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  reentry_ack_at: z.string().nullable(),
});
export type RestSessionRow = z.infer<typeof restSessionRowSchema>;

export const unplannedIndulgenceRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  activity: z.string(),
  minutes: z.number(),
});
export type UnplannedIndulgenceRow = z.infer<typeof unplannedIndulgenceRowSchema>;

export const mentorMessageRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  route: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  state_at_time: z.string().nullable(),
  usage_id: z.string().nullable(),
  created_at: z.string(),
});
export type MentorMessageRow = z.infer<typeof mentorMessageRowSchema>;

export const digestRowSchema = z.object({
  date: z.string(),
  owner_id: z.string(),
  text: z.string(),
});
export type DigestRow = z.infer<typeof digestRowSchema>;

export const weeklyLetterRowSchema = z.object({
  week_start: z.string(),
  owner_id: z.string(),
  letter: z.string(),
  metrics: z.record(z.string(), z.unknown()),
  changes: z.record(z.string(), z.unknown()),
  profile_version_id: z.string().nullable(),
});
export type WeeklyLetterRow = z.infer<typeof weeklyLetterRowSchema>;

export const profileVersionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  created_at: z.string(),
  sections: z.record(z.string(), z.string()),
  author: z.enum(['claude', 'user']),
  changes: z.array(z.object({ section: z.string(), newText: z.string(), reason: z.string() })),
});
export type ProfileVersionRow = z.infer<typeof profileVersionRowSchema>;

export const pushSubscriptionRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  endpoint: z.string(),
  keys: z.record(z.string(), z.string()),
  device_label: z.string().nullable(),
  created_at: z.string(),
});
export type PushSubscriptionRow = z.infer<typeof pushSubscriptionRowSchema>;

export const nudgeSentRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  date: z.string(),
  type: z.string(),
  block_id: z.string().nullable(),
  sent_at: z.string(),
  acked_at: z.string().nullable(),
});
export type NudgeSentRow = z.infer<typeof nudgeSentRowSchema>;

export const usageRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  created_at: z.string(),
  route: z.string(),
  model: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_tokens: z.number(),
  cache_write_tokens: z.number(),
  cost_usd: z.number(),
});
export type UsageRow = z.infer<typeof usageRowSchema>;

// Form sections (spec §6). Stored inside checkins.sections as JSON, one schema
// per section so sections can evolve without a migration.
export const morningBodySchema = z.object({
  bedtime: z.string(),
  wakeTime: z.string(),
  sleepQuality: z.number().min(1).max(5),
  energy: z.number().min(1).max(10),
});
export const morningMindSchema = z.object({
  mood: z.number().min(1).max(10),
  stress: z.number().min(1).max(10),
  stressCause: z.array(z.string()),
});
export const eveningBodySchema = z.object({
  training: z.enum(['done', 'partial', 'skipped', 'rest']),
  protein: z.enum(['low', 'ok', 'hit']),
  waterL: z.number(),
  energyNow: z.number().min(1).max(10),
});
export const eveningMindSchema = z.object({
  peakStress: z.number().min(1).max(10),
  stressCause: z.array(z.string()),
  focusQuality: z.number().min(1).max(5),
  regulated: z.array(z.string()),
});
export const eveningWorkSchema = z.object({
  tasksDone: z.array(z.string()),
  deepWorkMinutes: z.number(),
  footballAnalytics: z.object({
    projects: z.array(z.string()),
    minutes: z.number(),
    learned: z.string(),
  }),
});
export const eveningPleasureSchema = z.object({
  plannedRestSessions: z.number(),
  unplannedEntries: z.array(z.object({ activity: z.string(), minutes: z.number() })),
  cameBackAfterRest: z.enum(['yes', 'partly', 'no']),
});
export const eveningPeopleSchema = z.object({
  who: z.array(z.string()),
  interactionType: z.enum(['in person', 'call', 'text', 'online']).nullable(),
  felt: z.enum(['draining', 'neutral', 'energizing']).nullable(),
  reachedOut: z.boolean(),
  frictionNote: z.string(),
});
export const eveningReflectionSchema = z.object({
  gratitudeLines: z.array(z.string()),
  lessonOfDay: z.string(),
  winOfDay: z.string(),
});
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test src/lib/db/schemas.test.ts
```

Expected: PASS, all 6 assertions.

- [ ] **Step 6: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/db/schemas.ts src/lib/db/schemas.test.ts
git commit -m "feat(db): zod schemas for every table and form section

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Supabase client factories and the generic repository

**Files:**
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/db/repository.ts`
- Create: `src/lib/db/repository.test.ts`

**Interfaces:**
- Consumes: `settingsRowSchema` etc. from Task 3 (as an example schema in the test only).
- Produces: `createServerSupabase(): Promise<SupabaseClient>` (reads/writes the user's session cookie — for use in Server Components, Route Handlers, Server Actions), `createBrowserSupabase(): SupabaseClient` (for any future client component), `createAdminSupabase(): SupabaseClient` (service-role, bypasses RLS — server-only, used by the seed script and nowhere else), and `createTableRepository<Row>(client, table, schema)` returning `{ list(match?: Partial<Row>): Promise<Row[]>, get(id): Promise<Row | null>, upsert(row: Row): Promise<Row>, remove(id): Promise<void> }` — the shape every table repository in Task 5 is built from.

- [ ] **Step 1: Install the Supabase client libraries**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the failing test for the generic repository**

`src/lib/db/repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTableRepository } from './repository';

const rowSchema = z.object({ id: z.string(), name: z.string(), owner_id: z.string() });
type Row = z.infer<typeof rowSchema>;

/** A minimal fake standing in for the slice of the Supabase query builder the
 * repository actually calls, so this test needs no network and no project. */
function fakeClient(initial: Row[]) {
  const rows = [...initial];
  return {
    rows,
    from(table: string) {
      expect(table).toBe('widgets');
      return {
        select: () => ({
          match: async (filter: Partial<Row>) => ({
            data: rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v)),
            error: null,
          }),
          eq: (col: string, value: unknown) => ({
            maybeSingle: async () => ({ data: rows.find((r) => (r as never)[col] === value) ?? null, error: null }),
          }),
        }),
        upsert: (row: Row) => ({
          select: () => ({
            single: async () => {
              const i = rows.findIndex((r) => r.id === row.id);
              if (i >= 0) rows[i] = row;
              else rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: async (col: string, value: unknown) => {
            const i = rows.findIndex((r) => (r as never)[col] === value);
            if (i >= 0) rows.splice(i, 1);
            return { error: null };
          },
        }),
      };
    },
  };
}

describe('createTableRepository', () => {
  it('lists rows matching a filter, validated by the schema', async () => {
    const client = fakeClient([
      { id: 'a', name: 'Alpha', owner_id: 'ct' },
      { id: 'b', name: 'Beta', owner_id: 'ct' },
    ]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    const rows = await repo.list({ owner_id: 'ct' });
    expect(rows).toHaveLength(2);
  });

  it('rejects a row that fails schema validation', async () => {
    const client = fakeClient([{ id: 'a', name: 'Alpha', owner_id: 'ct' } as Row]);
    // Sneak in a malformed row the schema should reject.
    client.rows.push({ id: 'bad' } as unknown as Row);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    await expect(repo.list()).rejects.toThrow();
  });

  it('upserts and round-trips a row through get()', async () => {
    const client = fakeClient([]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    const written = await repo.upsert({ id: 'a', name: 'Alpha', owner_id: 'ct' });
    expect(written.name).toBe('Alpha');
    const fetched = await repo.get('a');
    expect(fetched).toEqual(written);
  });

  it('get() returns null for a missing id', async () => {
    const client = fakeClient([]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    expect(await repo.get('missing')).toBeNull();
  });

  it('remove() deletes by id', async () => {
    const client = fakeClient([{ id: 'a', name: 'Alpha', owner_id: 'ct' }]);
    const repo = createTableRepository<Row>(client as never, 'widgets', rowSchema);
    await repo.remove('a');
    expect(await repo.get('a')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test src/lib/db/repository.test.ts
```

Expected: FAIL — `./repository` does not exist.

- [ ] **Step 3: Write `src/lib/db/repository.ts`**

```ts
import type { z } from 'zod';

/** The slice of the Supabase JS client's query builder this repository needs.
 * Kept narrow and structural (not `SupabaseClient` itself) so it is easy to
 * fake in tests and easy to satisfy with the real client in production. */
export interface RepositoryClient {
  from(table: string): {
    select(columns: string): {
      match(filter: Record<string, unknown>): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      eq(column: string, value: unknown): {
        maybeSingle(): Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    upsert(row: unknown): {
      select(columns: string): {
        single(): Promise<{ data: unknown | null; error: { message: string } | null }>;
      };
    };
    delete(): {
      eq(column: string, value: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
}

export interface TableRepository<Row> {
  list(match?: Partial<Row>): Promise<Row[]>;
  get(id: string, idColumn?: string): Promise<Row | null>;
  upsert(row: Row): Promise<Row>;
  remove(id: string, idColumn?: string): Promise<void>;
}

/** A CRUD repository over one Supabase table, validating every row in and out
 * with `schema` so a corrupt row (bad migration, manual SQL edit, model
 * hallucination) fails loudly instead of silently reaching the app. */
export function createTableRepository<Row>(
  client: RepositoryClient,
  table: string,
  schema: z.ZodType<Row>,
): TableRepository<Row> {
  return {
    async list(match = {}) {
      const { data, error } = await client.from(table).select('*').match(match as Record<string, unknown>);
      if (error) throw new Error(`${table}.list failed: ${error.message}`);
      return (data ?? []).map((row) => schema.parse(row));
    },
    async get(id, idColumn = 'id') {
      const { data, error } = await client.from(table).select('*').eq(idColumn, id).maybeSingle();
      if (error) throw new Error(`${table}.get failed: ${error.message}`);
      return data ? schema.parse(data) : null;
    },
    async upsert(row) {
      const validated = schema.parse(row);
      const { data, error } = await client.from(table).upsert(validated).select('*').single();
      if (error) throw new Error(`${table}.upsert failed: ${error.message}`);
      return schema.parse(data);
    },
    async remove(id, idColumn = 'id') {
      const { error } = await client.from(table).delete().eq(idColumn, id);
      if (error) throw new Error(`${table}.remove failed: ${error.message}`);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test src/lib/db/repository.test.ts
```

Expected: PASS, all 5 assertions.

- [ ] **Step 5: Write the three Supabase client factories**

`src/lib/supabase/server.ts` (Server Components, Route Handlers, Server Actions — reads/writes the session cookie):

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** One client per request, bound to that request's session cookie. Call this
 * fresh in every Server Component / Route Handler / Server Action — never
 * cache the instance across requests. */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component that can't set cookies; middleware
          // refreshes the session on the next request instead.
        }
      },
    },
  });
}
```

`src/lib/supabase/browser.ts` (unused until Plan 5's screens, added now so the pattern is in place):

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
```

`src/lib/supabase/admin.ts` (service role — bypasses RLS; server-only, used by the seed script; never imported from anything that runs in the browser):

```ts
import { createClient } from '@supabase/supabase-js';

/** Service-role client. Bypasses RLS entirely — only ever used server-side for
 * the onboarding seed script (Task 8), never for a request made on CT's behalf. */
export function createAdminSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 6: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/supabase src/lib/db/repository.ts src/lib/db/repository.test.ts
git commit -m "feat(db): generic zod-validated table repository and Supabase client factories

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Repositories for all 14 tables

**Files:**
- Create: `src/lib/db/repositories/settings.ts` (bespoke — single row)
- Create: `src/lib/db/repositories/settings.test.ts`
- Create: `src/lib/db/repositories/templates.ts` (bespoke — keyed by weekday, not `id`)
- Create: `src/lib/db/repositories/templates.test.ts`
- Create: `src/lib/db/repositories/tables.ts` (the 12 remaining tables, generic)
- Create: `src/lib/db/repositories/index.ts` (barrel export)

**Interfaces:**
- Consumes: `createTableRepository`, `RepositoryClient` (Task 4); every `*RowSchema` (Task 3).
- Produces: `getSettings(client)`, `upsertSettings(client, row)`, `getTemplate(client, weekday)`, `listTemplates(client)`, `upsertTemplate(client, row)`, and `repositories(client)` — one object exposing a `TableRepository<Row>` for `plans`, `blocks`, `checkins`, `restSessions`, `unplannedIndulgence`, `mentorMessages`, `digests`, `weeklyLetters`, `profileVersions`, `pushSubscriptions`, `nudgesSent`, `usage`. Task 6 and Task 8 both import from `src/lib/db/repositories/index.ts`.

- [ ] **Step 1: Write the failing tests for the two bespoke repositories**

`src/lib/db/repositories/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import type { RepositoryClient } from '../repository';
import { getSettings, upsertSettings } from './settings';

function fakeClient(row: unknown | null) {
  let stored = row;
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }),
        match: async () => ({ data: stored ? [stored] : [], error: null }),
      }),
      upsert: (r: unknown) => ({
        select: () => ({ single: async () => ({ data: (stored = r), error: null }) }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('settings repository', () => {
  it('returns null when settings has not been seeded yet', async () => {
    expect(await getSettings(fakeClient(null))).toBeNull();
  });

  it('round-trips DEFAULT_SETTINGS shaped as a row', async () => {
    const client = fakeClient(null);
    const written = await upsertSettings(client, {
      id: 'singleton',
      owner_id: 'ct',
      timezone: DEFAULT_SETTINGS.timezone,
      wake_time: DEFAULT_SETTINGS.wakeTime,
      bedtime: DEFAULT_SETTINGS.bedtime,
      model: DEFAULT_SETTINGS.model,
      monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
      nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
      deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
      thresholds: DEFAULT_THRESHOLDS,
      crisis_contacts: [],
    });
    expect(written.timezone).toBe('UTC');
    expect(await getSettings(client)).toEqual(written);
  });
});
```

`src/lib/db/repositories/templates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { RepositoryClient } from '../repository';
import { getTemplate, listTemplates, upsertTemplate } from './templates';

function fakeClient(rows: unknown[]) {
  return {
    from: () => ({
      select: () => ({
        match: async (filter: Record<string, unknown>) => ({
          data: rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as never)[k] === v)),
          error: null,
        }),
        eq: (col: string, value: unknown) => ({
          maybeSingle: async () => ({ data: rows.find((r) => (r as never)[col] === value) ?? null, error: null }),
        }),
      }),
      upsert: (row: unknown) => ({
        select: () => ({
          single: async () => {
            const i = rows.findIndex((r) => (r as { weekday: number }).weekday === (row as { weekday: number }).weekday);
            if (i >= 0) rows[i] = row;
            else rows.push(row);
            return { data: row, error: null };
          },
        }),
      }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  } satisfies RepositoryClient;
}

describe('templates repository', () => {
  it('gets a single weekday template by weekday, not by id', async () => {
    const client = fakeClient([{ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] }]);
    expect(await getTemplate(client, 1)).toEqual({ weekday: 1, owner_id: 'ct', rest_day: false, blocks: [] });
    expect(await getTemplate(client, 2)).toBeNull();
  });

  it('lists all seven weekday templates', async () => {
    const rows = Array.from({ length: 7 }, (_, weekday) => ({ weekday, owner_id: 'ct', rest_day: false, blocks: [] }));
    const client = fakeClient(rows);
    expect(await listTemplates(client)).toHaveLength(7);
  });

  it('upserts by weekday', async () => {
    const client = fakeClient([]);
    await upsertTemplate(client, { weekday: 0, owner_id: 'ct', rest_day: true, blocks: [] });
    expect(await getTemplate(client, 0)).toMatchObject({ rest_day: true });
  });
});
```

- [ ] **Step 2: Run both to see them fail**

```bash
npm test src/lib/db/repositories
```

Expected: FAIL — neither `./settings` nor `./templates` exists yet.

- [ ] **Step 3: Write `src/lib/db/repositories/settings.ts`**

```ts
import { settingsRowSchema, type SettingsRow } from '../schemas';
import type { RepositoryClient } from '../repository';

/** `settings` is always exactly one row, keyed by the fixed id 'singleton'. */
export async function getSettings(client: RepositoryClient): Promise<SettingsRow | null> {
  const { data, error } = await client.from('settings').select('*').eq('id', 'singleton').maybeSingle();
  if (error) throw new Error(`settings.get failed: ${error.message}`);
  return data ? settingsRowSchema.parse(data) : null;
}

export async function upsertSettings(client: RepositoryClient, row: SettingsRow): Promise<SettingsRow> {
  const validated = settingsRowSchema.parse(row);
  const { data, error } = await client.from('settings').upsert(validated).select('*').single();
  if (error) throw new Error(`settings.upsert failed: ${error.message}`);
  return settingsRowSchema.parse(data);
}
```

- [ ] **Step 4: Write `src/lib/db/repositories/templates.ts`**

```ts
import { templateRowSchema, type TemplateRow } from '../schemas';
import type { RepositoryClient } from '../repository';

export async function getTemplate(client: RepositoryClient, weekday: number): Promise<TemplateRow | null> {
  const { data, error } = await client.from('templates').select('*').eq('weekday', weekday).maybeSingle();
  if (error) throw new Error(`templates.get failed: ${error.message}`);
  return data ? templateRowSchema.parse(data) : null;
}

export async function listTemplates(client: RepositoryClient): Promise<TemplateRow[]> {
  const { data, error } = await client.from('templates').select('*').match({});
  if (error) throw new Error(`templates.list failed: ${error.message}`);
  return (data ?? []).map((row) => templateRowSchema.parse(row));
}

export async function upsertTemplate(client: RepositoryClient, row: TemplateRow): Promise<TemplateRow> {
  const validated = templateRowSchema.parse(row);
  const { data, error } = await client.from('templates').upsert(validated).select('*').single();
  if (error) throw new Error(`templates.upsert failed: ${error.message}`);
  return templateRowSchema.parse(data);
}
```

- [ ] **Step 5: Run both tests to verify they pass**

```bash
npm test src/lib/db/repositories
```

Expected: PASS, all 5 assertions.

- [ ] **Step 6: Write the 12 generic table repositories**

`src/lib/db/repositories/tables.ts` — no new tests needed here: each entry is one call into `createTableRepository`, already fully covered by Task 4's test.

```ts
import {
  blockRowSchema,
  checkinRowSchema,
  digestRowSchema,
  mentorMessageRowSchema,
  nudgeSentRowSchema,
  planRowSchema,
  profileVersionRowSchema,
  pushSubscriptionRowSchema,
  restSessionRowSchema,
  unplannedIndulgenceRowSchema,
  usageRowSchema,
  weeklyLetterRowSchema,
} from '../schemas';
import { createTableRepository, type RepositoryClient } from '../repository';

export function tableRepositories(client: RepositoryClient) {
  return {
    plans: createTableRepository(client, 'plans', planRowSchema),
    blocks: createTableRepository(client, 'blocks', blockRowSchema),
    checkins: createTableRepository(client, 'checkins', checkinRowSchema),
    restSessions: createTableRepository(client, 'rest_sessions', restSessionRowSchema),
    unplannedIndulgence: createTableRepository(client, 'unplanned_indulgence', unplannedIndulgenceRowSchema),
    mentorMessages: createTableRepository(client, 'mentor_messages', mentorMessageRowSchema),
    digests: createTableRepository(client, 'digests', digestRowSchema),
    weeklyLetters: createTableRepository(client, 'weekly_letters', weeklyLetterRowSchema),
    profileVersions: createTableRepository(client, 'profile_versions', profileVersionRowSchema),
    pushSubscriptions: createTableRepository(client, 'push_subscriptions', pushSubscriptionRowSchema),
    nudgesSent: createTableRepository(client, 'nudges_sent', nudgeSentRowSchema),
    usage: createTableRepository(client, 'usage', usageRowSchema),
  };
}
```

`src/lib/db/repositories/index.ts`:

```ts
import type { RepositoryClient } from '../repository';
import { getSettings, upsertSettings } from './settings';
import { getTemplate, listTemplates, upsertTemplate } from './templates';
import { tableRepositories } from './tables';

/** One entry point for every repository in the data layer. Route handlers and
 * server actions call `repositories(await createServerSupabase())` and get
 * back everything spec §10 defines. */
export function repositories(client: RepositoryClient) {
  return {
    settings: { get: () => getSettings(client), upsert: (row: Parameters<typeof upsertSettings>[1]) => upsertSettings(client, row) },
    templates: {
      get: (weekday: number) => getTemplate(client, weekday),
      list: () => listTemplates(client),
      upsert: (row: Parameters<typeof upsertTemplate>[1]) => upsertTemplate(client, row),
    },
    ...tableRepositories(client),
  };
}

export * from './settings';
export * from './templates';
export * from './tables';
```

- [ ] **Step 7: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/repositories
git commit -m "feat(db): repositories for all 14 tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `DaySummary` builder (pure, in `src/core`) and its data-layer wrapper

**Files:**
- Create: `src/core/daySummary/build.ts`
- Create: `src/core/daySummary/build.test.ts`
- Create: `src/lib/db/daySummary.ts`

**Interfaces:**
- Consumes: `DaySummary`, `BlockKind`, `BlockStatus` from `@/core/types`; `morningBodySchema`/`morningMindSchema`/`eveningBodySchema`/`eveningMindSchema`/`eveningWorkSchema`/`eveningPleasureSchema` shapes (Task 3, read informally — the builder reads plain `sections` objects, not the zod types themselves, since a checkin row's `sections` is `Record<string, Record<string, unknown>>`); `CheckinRow`, `BlockRow`, `RestSessionRow`, `UnplannedIndulgenceRow` (Task 3); `repositories()` (Task 5).
- Produces: `buildDaySummary(input: DaySummaryInput): DaySummary` — pure, consumed directly by `src/core/guard/assess.ts`'s `assess()` (already built in Plan 1b, unchanged here). `getDaySummaries(client, fromDate, toDate): Promise<DaySummary[]>` — the only I/O-touching piece, a thin fetch-then-map wrapper.

- [ ] **Step 1: Write the failing tests for the pure builder**

`src/core/daySummary/build.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDaySummary, sleepHoursBetween } from './build';

describe('sleepHoursBetween', () => {
  it('computes hours across midnight', () => {
    expect(sleepHoursBetween('23:00', '07:00')).toBe(8);
  });

  it('computes hours within the same evening (no crossing needed)', () => {
    expect(sleepHoursBetween('22:00', '23:30')).toBe(1.5);
  });
});

describe('buildDaySummary', () => {
  const base = {
    date: '2026-09-15',
    isRestDay: false,
    checkins: [],
    blocks: [],
    restSessionsCount: 0,
    unplannedIndulgenceMinutes: [],
  };

  it('reports null for every field when nothing was logged', () => {
    const summary = buildDaySummary(base);
    expect(summary).toEqual({
      date: '2026-09-15',
      sleepHours: null,
      morningEnergy: null,
      stress: null,
      deepWorkMin: null,
      restSessionsTaken: 0,
      trainedOnRestDay: false,
      unplannedIndulgenceMin: null,
      anchorsTotal: 0,
      anchorsSkipped: 0,
    });
  });

  it('reads sleepHours and morningEnergy from the morning checkin', () => {
    const summary = buildDaySummary({
      ...base,
      checkins: [
        {
          type: 'morning',
          sections: { body: { bedtime: '23:00', wakeTime: '07:00', sleepQuality: 4, energy: 7 }, mind: { mood: 6, stress: 3, stressCause: [] } },
        },
      ],
    });
    expect(summary.sleepHours).toBe(8);
    expect(summary.morningEnergy).toBe(7);
  });

  it('takes the higher of morning and evening stress', () => {
    const summary = buildDaySummary({
      ...base,
      checkins: [
        { type: 'morning', sections: { mind: { mood: 6, stress: 3, stressCause: [] } } },
        { type: 'evening', sections: { mind: { peakStress: 8, stressCause: [], focusQuality: 3, regulated: [] } } },
      ],
    });
    expect(summary.stress).toBe(8);
  });

  it('sums minutes of done or partial deep-work blocks', () => {
    const summary = buildDaySummary({
      ...base,
      blocks: [
        { anchor: true, kind: 'task', status: 'done', start: 540, end: 660, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'partial', start: 660, end: 690, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'skipped', start: 690, end: 720, tags: ['deepWork'] },
        { anchor: false, kind: 'task', status: 'done', start: 720, end: 780, tags: [] },
      ],
    });
    expect(summary.deepWorkMin).toBe(120 + 30);
  });

  it('counts anchors total and skipped (skipped or missed)', () => {
    const summary = buildDaySummary({
      ...base,
      blocks: [
        { anchor: true, kind: 'training', status: 'done', start: 0, end: 60, tags: [] },
        { anchor: true, kind: 'routine', status: 'missed', start: 60, end: 90, tags: [] },
        { anchor: true, kind: 'routine', status: 'skipped', start: 90, end: 120, tags: [] },
        { anchor: false, kind: 'task', status: 'skipped', start: 120, end: 150, tags: [] },
      ],
    });
    expect(summary.anchorsTotal).toBe(3);
    expect(summary.anchorsSkipped).toBe(2);
  });

  it('flags trainedOnRestDay only when the day is a rest day and training happened', () => {
    const trained = buildDaySummary({
      ...base,
      isRestDay: true,
      blocks: [{ anchor: false, kind: 'training', status: 'done', start: 0, end: 60, tags: [] }],
    });
    expect(trained.trainedOnRestDay).toBe(true);

    const sameBlocksNotRestDay = buildDaySummary({
      ...base,
      isRestDay: false,
      blocks: [{ anchor: false, kind: 'training', status: 'done', start: 0, end: 60, tags: [] }],
    });
    expect(sameBlocksNotRestDay.trainedOnRestDay).toBe(false);
  });

  it('passes restSessionsCount through and sums unplannedIndulgenceMinutes', () => {
    const summary = buildDaySummary({ ...base, restSessionsCount: 2, unplannedIndulgenceMinutes: [30, 45] });
    expect(summary.restSessionsTaken).toBe(2);
    expect(summary.unplannedIndulgenceMin).toBe(75);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test src/core/daySummary/build.test.ts
```

Expected: FAIL — `./build` does not exist.

- [ ] **Step 3: Write `src/core/daySummary/build.ts`**

```ts
import type { BlockKind, BlockStatus, DaySummary } from '../types';

/** Hours of sleep between an evening bedtime and the next morning's wake time.
 * Assumes bedtime is in the evening (matches the default 23:00 and every
 * template CT has defined) — a bedtime after midnight is out of scope for v1. */
export function sleepHoursBetween(bedtime: string, wakeTime: string): number {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const bed = toMinutes(bedtime);
  const wake = toMinutes(wakeTime);
  const diff = wake <= bed ? wake + 1440 - bed : wake - bed;
  return Math.round((diff / 60) * 100) / 100;
}

export interface DaySummaryCheckin {
  type: 'morning' | 'evening';
  sections: Record<string, Record<string, unknown>>;
}

export interface DaySummaryBlock {
  anchor: boolean;
  kind: BlockKind;
  status: BlockStatus;
  start: number;
  end: number;
  tags: string[];
}

export interface DaySummaryInput {
  date: string;
  /** Whether this date's weekday template is a rest day. */
  isRestDay: boolean;
  checkins: DaySummaryCheckin[];
  blocks: DaySummaryBlock[];
  restSessionsCount: number;
  unplannedIndulgenceMinutes: number[];
}

const DONE_STATUSES: BlockStatus[] = ['done', 'partial'];
const SKIPPED_STATUSES: BlockStatus[] = ['skipped', 'missed'];

/** Turn one day's raw logged rows into the `DaySummary` the (already-built,
 * unmodified) burnout guard consumes. Pure — no I/O, no clock. */
export function buildDaySummary(input: DaySummaryInput): DaySummary {
  const morning = input.checkins.find((c) => c.type === 'morning');
  const evening = input.checkins.find((c) => c.type === 'evening');

  const morningBody = morning?.sections.body as { bedtime?: string; wakeTime?: string; energy?: number } | undefined;
  const morningMind = morning?.sections.mind as { stress?: number } | undefined;
  const eveningMind = evening?.sections.mind as { peakStress?: number } | undefined;

  const sleepHours =
    morningBody?.bedtime && morningBody?.wakeTime ? sleepHoursBetween(morningBody.bedtime, morningBody.wakeTime) : null;
  const morningEnergy = typeof morningBody?.energy === 'number' ? morningBody.energy : null;

  const stressValues = [morningMind?.stress, eveningMind?.peakStress].filter((v): v is number => typeof v === 'number');
  const stress = stressValues.length > 0 ? Math.max(...stressValues) : null;

  const deepWorkBlocks = input.blocks.filter((b) => b.tags.includes('deepWork') && DONE_STATUSES.includes(b.status));
  const deepWorkMin = deepWorkBlocks.length > 0 ? deepWorkBlocks.reduce((sum, b) => sum + (b.end - b.start), 0) : null;

  const anchorBlocks = input.blocks.filter((b) => b.anchor);
  const anchorsTotal = anchorBlocks.length;
  const anchorsSkipped = anchorBlocks.filter((b) => SKIPPED_STATUSES.includes(b.status)).length;

  const trainedOnRestDay =
    input.isRestDay && input.blocks.some((b) => b.kind === 'training' && DONE_STATUSES.includes(b.status));

  const unplannedIndulgenceMin =
    input.unplannedIndulgenceMinutes.length > 0 ? input.unplannedIndulgenceMinutes.reduce((sum, m) => sum + m, 0) : null;

  return {
    date: input.date,
    sleepHours,
    morningEnergy,
    stress,
    deepWorkMin,
    restSessionsTaken: input.restSessionsCount,
    trainedOnRestDay,
    unplannedIndulgenceMin,
    anchorsTotal,
    anchorsSkipped,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test src/core/daySummary/build.test.ts
```

Expected: PASS, all 8 assertions.

- [ ] **Step 5: Write the thin data-layer wrapper**

`src/lib/db/daySummary.ts` — no new test: it is a fetch-then-map over already-tested pieces (`repositories()` from Task 5, `buildDaySummary` from Step 3 above), so an integration test against a real Supabase project is left to Task 9's manual verification rather than mocked here.

```ts
import { weekdayOf } from '@/core/time';
import type { DaySummary } from '@/core/types';
import { buildDaySummary } from '@/core/daySummary/build';
import type { RepositoryClient } from './repository';
import { repositories } from './repositories';

/** Fetch every table `buildDaySummary` needs for the dates in
 * [`fromDate`, `toDate`] (inclusive, `YYYY-MM-DD`) and map each date to a
 * `DaySummary`. Dates with no rows at all still produce a summary — every
 * field lands on `buildDaySummary`'s all-null-for-that-day default. */
export async function getDaySummaries(client: RepositoryClient, fromDate: string, toDate: string): Promise<DaySummary[]> {
  const repos = repositories(client);
  const [templates, checkins, blocks, restSessions, indulgence] = await Promise.all([
    repos.templates.list(),
    repos.checkins.list(),
    repos.blocks.list(),
    repos.restSessions.list(),
    repos.unplannedIndulgence.list(),
  ]);
  const templateByWeekday = new Map(templates.map((t) => [t.weekday, t]));

  const dates: string[] = [];
  for (let d = new Date(`${fromDate}T00:00:00Z`); d <= new Date(`${toDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates.map((date) =>
    buildDaySummary({
      date,
      isRestDay: templateByWeekday.get(weekdayOf(date))?.rest_day ?? false,
      checkins: checkins.filter((c) => c.date === date).map((c) => ({ type: c.type, sections: c.sections })),
      blocks: blocks
        .filter((b) => b.date === date)
        .map((b) => ({ anchor: b.anchor, kind: b.kind, status: b.status, start: b.start, end: b.end, tags: b.tags })),
      restSessionsCount: restSessions.filter((r) => r.date === date).length,
      unplannedIndulgenceMinutes: indulgence.filter((i) => i.date === date).map((i) => i.minutes),
    }),
  );
}
```

- [ ] **Step 6: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/core/daySummary src/lib/db/daySummary.ts
git commit -m "feat(core): pure DaySummary builder plus its data-layer wrapper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Magic-link auth, owner gate, middleware

**Files:**
- Create: `src/lib/auth/isOwner.ts`
- Create: `src/lib/auth/isOwner.test.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`
- Create: `src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 4).
- Produces: `isOwner(email: string | null | undefined): boolean` — the one pure rule every gate (middleware, callback, page) calls, so "owner" is defined in exactly one place. Later screens (Plan 5) reuse `isOwner` the same way.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/isOwner.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOwner } from './isOwner';

describe('isOwner', () => {
  beforeEach(() => {
    vi.stubEnv('OWNER_EMAIL', 'ct@example.com');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the exact OWNER_EMAIL', () => {
    expect(isOwner('ct@example.com')).toBe(true);
  });

  it('is case-insensitive (email providers normalize case)', () => {
    expect(isOwner('CT@Example.com')).toBe(true);
  });

  it('rejects any other email', () => {
    expect(isOwner('someone-else@example.com')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test src/lib/auth/isOwner.test.ts
```

Expected: FAIL — `./isOwner` does not exist.

- [ ] **Step 3: Write `src/lib/auth/isOwner.ts`**

```ts
/** Spec §4.2: the server rejects any signed-in user whose email isn't the
 * single configured owner. This is the one place that rule lives. */
export function isOwner(email: string | null | undefined): boolean {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail || !email) return false;
  return email.toLowerCase() === ownerEmail.toLowerCase();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test src/lib/auth/isOwner.test.ts
```

Expected: PASS, all 4 assertions.

- [ ] **Step 5: Write the middleware**

`src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isOwner } from '@/lib/auth/isOwner';

/** Refreshes the Supabase session on every request and signs out (redirecting
 * to /login) anyone who isn't OWNER_EMAIL — spec §4.2's server-side gate. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback');

  if (user && !isOwner(user.email)) {
    await supabase.auth.signOut();
    if (!isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Write the login page and its server action**

`src/app/login/actions.ts`:

```ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';

export interface SendMagicLinkResult {
  ok: boolean;
  error?: string;
}

/** Sends the magic link to OWNER_EMAIL — there is only ever one account, so
 * there is nothing for CT to type. */
export async function sendMagicLink(): Promise<SendMagicLinkResult> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) return { ok: false, error: 'OWNER_EMAIL is not configured' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: ownerEmail,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
```

`src/app/login/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { sendMagicLink } from './actions';

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
    <main>
      <h1>Sign in</h1>
      <p>Sends a one-time sign-in link to your email.</p>
      <button onClick={handleClick} disabled={status === 'sending' || status === 'sent'}>
        {status === 'sent' ? 'Link sent — check your email' : 'Send me a sign-in link'}
      </button>
      {status === 'error' && <p role="alert">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 7: Write the auth callback route**

`src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete('code');

  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }

  redirectTo.pathname = '/';
  return NextResponse.redirect(redirectTo);
}
```

- [ ] **Step 8: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth src/middleware.ts src/app/login src/app/auth
git commit -m "feat(auth): magic-link sign-in gated to OWNER_EMAIL

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Onboarding seed data (settings + weekday templates from the 4-week program)

**Files:**
- Create: `src/lib/onboarding/seedData.ts`
- Create: `src/lib/onboarding/seedData.test.ts`
- Create: `scripts/seed.ts`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, `DEFAULT_THRESHOLDS` (`@/core/types`); `SettingsRow`, `TemplateRow` (Task 3); `createAdminSupabase` (Task 4); `upsertSettings`, `upsertTemplate` (Task 5).
- Produces: `seedSettingsRow(): SettingsRow`, `seedTemplateRows(): TemplateRow[]` — pure, so they're unit-tested without touching Supabase. `scripts/seed.ts` is the only thing that calls them against a real project, run once by CT.

- [ ] **Step 1: Write the failing tests**

`src/lib/onboarding/seedData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { seedSettingsRow, seedTemplateRows } from './seedData';

describe('seedSettingsRow', () => {
  it('produces the singleton settings row with an empty crisis contacts list', () => {
    const row = seedSettingsRow();
    expect(row.id).toBe('singleton');
    expect(row.timezone).toBeTypeOf('string');
    expect(row.crisis_contacts).toEqual([]);
    expect(row.thresholds.sleepLowHours).toBeGreaterThan(0);
  });
});

describe('seedTemplateRows', () => {
  const rows = seedTemplateRows();

  it('produces exactly one row per weekday (0–6)', () => {
    expect(rows.map((r) => r.weekday).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('marks Friday, Saturday and Sunday as rest days with no training block', () => {
    for (const weekday of [0, 5, 6]) {
      const row = rows.find((r) => r.weekday === weekday)!;
      expect(row.rest_day).toBe(true);
      expect(row.blocks.some((b) => b.kind === 'training')).toBe(false);
    }
  });

  it('gives Monday a push+neck training block as an anchor', () => {
    const monday = rows.find((r) => r.weekday === 1)!;
    expect(monday.rest_day).toBe(false);
    const training = monday.blocks.find((b) => b.kind === 'training')!;
    expect(training.anchor).toBe(true);
    expect(training.title.toLowerCase()).toContain('push');
  });

  it('gives every weekday a wake, sleep and meal skeleton alongside training', () => {
    for (const row of rows) {
      const kinds = row.blocks.map((b) => b.kind);
      expect(kinds).toContain('routine'); // wake / wind-down
      expect(row.blocks.some((b) => b.title.toLowerCase().includes('meal') || b.title.toLowerCase().includes('lunch'))).toBe(
        true,
      );
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
npm test src/lib/onboarding/seedData.test.ts
```

Expected: FAIL — `./seedData` does not exist.

- [ ] **Step 3: Write `src/lib/onboarding/seedData.ts`**

```ts
import { DEFAULT_SETTINGS, DEFAULT_THRESHOLDS } from '@/core/types';
import type { SettingsRow, TemplateRow } from '@/lib/db/schemas';
import type { TemplateBlock } from '@/core/types';

/** Spec §5.2 + the 4-week program: one seed template per weekday. CT edits
 * these later in the Templates screen (Plan 5) — this only has to be a
 * sane, safe starting point, not the final word. */
export function seedSettingsRow(): SettingsRow {
  return {
    id: 'singleton',
    owner_id: '',
    timezone: DEFAULT_SETTINGS.timezone,
    wake_time: DEFAULT_SETTINGS.wakeTime,
    bedtime: DEFAULT_SETTINGS.bedtime,
    model: DEFAULT_SETTINGS.model,
    monthly_cap_usd: DEFAULT_SETTINGS.monthlyCapUsd,
    nudge_daily_cap: DEFAULT_SETTINGS.nudgeDailyCap,
    deep_work_daily_cap_min: DEFAULT_SETTINGS.deepWorkDailyCapMin,
    thresholds: DEFAULT_THRESHOLDS,
    crisis_contacts: [],
  };
}

function routineBlocks(): TemplateBlock[] {
  return [
    { key: 'wake', title: 'Morning routine', kind: 'routine', anchor: true, priority: 5, start: '07:00', durationMin: 30, tags: ['morningRoutine'] },
    { key: 'breakfast', title: 'Breakfast', kind: 'buffer', anchor: false, priority: 2, start: '07:30', durationMin: 30 },
    { key: 'lunch', title: 'Lunch', kind: 'buffer', anchor: false, priority: 2, start: '12:30', durationMin: 45 },
    { key: 'dinner', title: 'Dinner', kind: 'buffer', anchor: false, priority: 2, start: '19:00', durationMin: 45 },
    { key: 'deep-work', title: 'Deep work', kind: 'task', anchor: false, priority: 4, start: '09:00', durationMin: 180, tags: ['deepWork'] },
  ];
}

function trainingDay(key: string, title: string, start: string, durationMin: number, checklist: string[]): TemplateBlock {
  return {
    key,
    title,
    kind: 'training',
    anchor: true,
    priority: 5,
    start,
    durationMin,
    tags: key === 'training-tue' ? ['recovery'] : ['hardTraining'],
    checklist,
  };
}

const WEEKDAY_TRAINING: Record<number, TemplateBlock | null> = {
  0: null, // Sunday — rest
  1: trainingDay('training-mon', 'Push strength + neck work', '17:00', 55, [
    'Clap push-ups', 'Push-ups (heavy reps)', 'Dips', 'Pseudo planche push-ups', 'Isometric neck work',
  ]),
  2: trainingDay('training-tue', 'Handstand skill + active recovery', '17:00', 40, [
    'Wall handstand hold', 'Wrist prep', 'Bridge hold', 'Deep squat hold', 'Shoulder dislocates',
  ]),
  3: trainingDay('training-wed', 'Legs + core + neck work', '17:00', 55, [
    'Pistol squat progression', 'Broad jumps', 'L-sit progression', 'Nordic curls', 'Isometric neck work',
  ]),
  4: trainingDay('training-thu', 'Pull strength', '17:00', 40, ['Front lever progression', 'Pull-ups']),
  5: null, // Friday — rest
  6: null, // Saturday — rest
};

export function seedTemplateRows(): TemplateRow[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const training = WEEKDAY_TRAINING[weekday];
    return {
      weekday,
      owner_id: '',
      rest_day: training === null,
      blocks: training ? [...routineBlocks(), training] : routineBlocks(),
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test src/lib/onboarding/seedData.test.ts
```

Expected: PASS, all 5 assertions.

- [ ] **Step 5: Write `scripts/seed.ts`**

This is the one script that writes to the real Supabase project, using the service-role key from `.env.local` to bypass RLS for the initial write (there is no signed-in owner yet the first time this runs).

```ts
import 'dotenv/config';
import { createAdminSupabase } from '../src/lib/supabase/admin';
import { upsertSettings, upsertTemplate } from '../src/lib/db/repositories';
import { seedSettingsRow, seedTemplateRows } from '../src/lib/onboarding/seedData';

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) throw new Error('OWNER_EMAIL is not set in .env.local');

  const admin = createAdminSupabase();

  // The owner's auth.users row is created by the first magic-link sign-in
  // (Task 7), which may not have happened yet. Look it up if it exists so
  // seed rows carry the real owner_id; otherwise leave it blank — RLS still
  // protects the table, and Task 7's first sign-in doesn't depend on seeding
  // having run first.
  const { data: usersPage } = await admin.auth.admin.listUsers();
  const owner = usersPage?.users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase());
  const ownerId = owner?.id ?? '';

  const settings = { ...seedSettingsRow(), owner_id: ownerId };
  await upsertSettings(admin, settings);
  console.log('Seeded settings');

  for (const template of seedTemplateRows()) {
    await upsertTemplate(admin, { ...template, owner_id: ownerId });
  }
  console.log('Seeded 7 weekday templates');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add the script entry to `package.json`:

```json
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 6: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 7: Commit**

```bash
git add package.json src/lib/onboarding scripts/seed.ts
git commit -m "feat(onboarding): seed settings and weekday templates from the 4-week program

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: CT does this — sign in once, then run the seed**

1. `npm run dev`, open `http://localhost:3000`, follow the redirect to `/login`, click **Send me a sign-in link**, open the email, click the link (this creates CT's one `auth.users` row via the callback route from Task 7).
2. Then: `npm run seed` — this writes the `settings` row and the 7 `templates` rows, now attributed to CT's real `owner_id`.

---

### Task 9: Health-check page and Vercel deployment

**Files:**
- Modify: `src/app/page.tsx` (replace the placeholder from Task 1)
- Create: `src/app/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 4), `repositories` (Task 5), `isOwner` (Task 7).
- Produces: nothing new for later plans to consume — this is the last task in Plan 3. Plan 4 adds mentor routes; Plan 5 replaces this page with the real Today screen.

- [ ] **Step 1: Write the server action that proves a read/write round trip**

`src/app/actions.ts`:

```ts
'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { repositories } from '@/lib/db/repositories';

export interface PingResult {
  ok: boolean;
  timezone?: string;
  error?: string;
}

/** Reads settings, then writes it back unchanged. Proves the deployed app can
 * both read and write Supabase under RLS as the signed-in owner — not just
 * that the page rendered. */
export async function pingSupabase(): Promise<PingResult> {
  try {
    const supabase = await createServerSupabase();
    const repos = repositories(supabase);
    const settings = await repos.settings.get();
    if (!settings) return { ok: false, error: 'No settings row yet — run `npm run seed`.' };
    await repos.settings.upsert(settings);
    return { ok: true, timezone: settings.timezone };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

- [ ] **Step 2: Write the health-check page**

`src/app/page.tsx`:

```tsx
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwner } from '@/lib/auth/isOwner';
import { HealthCheck } from './HealthCheck';

export default async function HomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isOwner(user.email)) {
    return <main>Not signed in.</main>;
  }

  return (
    <main>
      <h1>Daily Loop — data layer</h1>
      <p>Signed in as {user.email}.</p>
      <HealthCheck />
    </main>
  );
}
```

`src/app/HealthCheck.tsx` (client component so the button can show a live result):

```tsx
'use client';

import { useState } from 'react';
import { pingSupabase, type PingResult } from './actions';

export function HealthCheck() {
  const [result, setResult] = useState<PingResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setResult(await pingSupabase());
    setLoading(false);
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Checking…' : 'Read + write settings'}
      </button>
      {result?.ok && <p>OK — timezone is {result.timezone}.</p>}
      {result && !result.ok && <p role="alert">{result.error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and full suite**

```bash
npm run typecheck
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/HealthCheck.tsx src/app/actions.ts
git commit -m "feat(app): health-check page proving a read/write round trip under RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: CT does this — connect Vercel and deploy**

1. `npm install -g vercel` (once), then `vercel login` — CT's own browser OAuth, on CT's own machine.
2. From the project directory: `vercel link` — choose **Create a new project**, accept the detected Next.js framework preset.
3. Add the five environment variables (Production **and** Preview): in the Vercel dashboard under **Settings → Environment Variables**, or via CLI —

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OWNER_EMAIL
vercel env add NEXT_PUBLIC_SITE_URL
```

(`vercel env add` prompts CT to paste each value themselves — Claude never sees them.) For `NEXT_PUBLIC_SITE_URL`, use the `https://<project>.vercel.app` domain Vercel assigns after the first deploy (redeploy once it's known, or set it ahead of time if the project name is already fixed).

4. `vercel --prod` to deploy.
5. Back in the Supabase dashboard (**Authentication → URL Configuration**), add `https://<project>.vercel.app/auth/callback` as a second allowed redirect URL, alongside the localhost one from Task 2.
6. Open the deployed URL, sign in, click **Read + write settings**, confirm it reports the seeded timezone.

---

## Self-Review

**Spec coverage:**
- §4.2 Auth (magic link, RLS, owner-only) → Tasks 2, 7.
- §5.2 Templates/blocks (seed data) → Task 8.
- §6 Forms (exact section field names) → Task 3's zod schemas, consumed by Task 6's `buildDaySummary`.
- §10 Data model (all 14 tables) → Task 2 (schema), Task 3 (zod), Task 5 (repositories).
- §11 Privacy ("just for me" stripping) → already implemented and tested in `src/core/mentor/context.ts` (Plan 1); Plan 3 only stores `sections`/`privateKeys` faithfully, doesn't reimplement stripping.
- §14 Scope (onboarding: settings, templates seeded) → Task 8. Crisis contacts and Templates *editor* UI are Plan 5 (screens); Task 8 seeds an empty `crisisContacts` array so the column isn't null.
- §15 To verify — Supabase/Vercel facts relevant to Plan 3 (schema + RLS + auth on the free tier; a Next.js app deploys to Vercel Hobby) are verified by Task 2 Step 2 and Task 9 Step 5 actually succeeding, not by consulting docs in the abstract. `pg_cron`/`pg_net`/iOS-push remain out of scope for Plan 3 (Plan 6).

**Placeholder scan:** no TBD/TODO; every code block is complete, runnable code; every step names its exact file and command.

**Type consistency:** `RepositoryClient` (Task 4) is the one interface every repository function takes; `TableRepository<Row>` (Task 4) is what `tableRepositories()` (Task 5) returns for all 12 generic tables; `DaySummaryInput`/`DaySummaryBlock`/`DaySummaryCheckin` (Task 6) are used consistently between `buildDaySummary` and `getDaySummaries`; `SettingsRow`/`TemplateRow` (Task 3) are the exact types `seedSettingsRow`/`seedTemplateRows` (Task 8) and `getSettings`/`upsertSettings`/`getTemplate`/`upsertTemplate` (Task 5) share.
