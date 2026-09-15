create table if not exists mentor_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  message_id uuid not null references mentor_messages(id),
  kind text not null check (kind in ('schedule', 'template')),
  target text not null,
  edits jsonb not null,
  diff jsonb not null,
  conflicts jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);
create index if not exists mentor_proposals_message_idx on mentor_proposals (message_id);

alter table mentor_proposals enable row level security;
create policy mentor_proposals_owner on mentor_proposals for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
