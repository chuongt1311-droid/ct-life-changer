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
