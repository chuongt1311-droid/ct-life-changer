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

-- Enable the extensions this schedule needs (idempotent — safe to re-run).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- CT: after deploying /api/cron/tick and setting CRON_SECRET in Vercel, run
-- this yourself in the Supabase SQL editor (substitute your real domain and
-- the same CRON_SECRET value you put in Vercel):
--
--   select cron.schedule('life-changer-tick', '* * * * *', $$
--     select net.http_post(
--       url := 'https://<your-vercel-domain>/api/cron/tick',
--       headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', '<your CRON_SECRET>'),
--       body := '{}'::jsonb
--     );
--   $$);
--
-- To check it's running: select * from cron.job_run_details order by start_time desc limit 5;
-- To stop it: select cron.unschedule('life-changer-tick');
