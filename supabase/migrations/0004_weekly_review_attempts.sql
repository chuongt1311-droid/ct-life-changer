-- Weekly review retry cap. 0003's mentor_proposals aside, this fixes a
-- separate real incident: a schema bug made every weekly_letters write
-- fail validation, and because nothing capped retries, /api/cron/tick
-- (runs every minute) re-ran the billed Anthropic call from scratch
-- forever. The schema bug is fixed in code, but nothing stopped a
-- *different* future failure from doing the same thing — this table
-- closes that gap generally, not just for the one bug that already hit it.
--
-- Run this file against your Supabase project's SQL editor yourself —
-- Claude never runs SQL against a live Supabase project.

create table if not exists weekly_review_attempts (
  week_start date primary key,
  owner_id uuid not null default auth.uid(),
  attempts integer not null default 0
);

alter table weekly_review_attempts enable row level security;
create policy weekly_review_attempts_owner on weekly_review_attempts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
