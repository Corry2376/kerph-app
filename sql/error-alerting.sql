-- Schedules the error-alert Edge Function to run hourly.
--
-- Same mechanism as sql/free-tier-nurture.sql: pg_cron fires on a schedule, pg_net makes the
-- HTTP call to the function. Both extensions ship with every Supabase project.
--
-- Safe to re-run. The unschedule guard means running this twice does not create a duplicate
-- job, and re-running is how you change the schedule.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('kerph-error-alert-hourly')
where exists (select 1 from cron.job where jobname = 'kerph-error-alert-hourly');

select cron.schedule(
    'kerph-error-alert-hourly',
    '7 * * * *',  -- 7 minutes past every hour. Off the hour on purpose: everything else in
                  -- the world runs at :00, and a busy minute is a slow minute.
    $$
    select net.http_post(
        url := 'https://qawfiktqeoarnvsarejo.supabase.co/functions/v1/error-alert',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- Confirm it registered. Should return one row named kerph-error-alert-hourly.
select jobname, schedule, active from cron.job where jobname = 'kerph-error-alert-hourly';
