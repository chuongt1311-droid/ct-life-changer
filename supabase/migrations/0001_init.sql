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
