-- Sends a one-time "come try Pro/Premier" offer email to accounts that have been on the
-- Free plan for 30 days. A daily pg_cron job hits the free-tier-nurture Edge Function
-- (no JWT needed -- it's deployed --no-verify-jwt, same as lemon-squeezy-webhook/contact-us,
-- since it takes no request input and is idempotent per user via the unique index below),
-- which finds anyone who crossed the 30-day mark in the last 24 hours, is still not on a
-- paid plan, and has not already gotten this email, then emails them once.
--
-- Safe to re-run.

create table if not exists public.nurture_emails (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    email_type text not null,   -- 'free_30_day' today; room for future lifecycle emails
    email      text,
    sent_at    timestamptz not null default now()
);
-- The real dedup mechanism: a second insert attempt for the same (user, email_type) fails
-- at the database level, so the Edge Function never has to worry about a race or a re-run
-- double-sending -- it just tries the insert and treats a unique-violation as "already sent".
create unique index if not exists nurture_emails_user_type_idx on public.nurture_emails(user_id, email_type);

alter table public.nurture_emails enable row level security;
drop policy if exists "nurture emails admin select" on public.nurture_emails;
create policy "nurture emails admin select" on public.nurture_emails
    for select using (public.kerph_is_admin());

-- Scheduling. Requires the pg_cron and pg_net extensions -- both ship with every Supabase
-- project, just need enabling once.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('kerph-free-tier-nurture-daily')
where exists (select 1 from cron.job where jobname = 'kerph-free-tier-nurture-daily');

select cron.schedule(
    'kerph-free-tier-nurture-daily',
    '0 15 * * *',  -- 15:00 UTC daily -- adjust the two leading fields to change the time
    $$
    select net.http_post(
        url := 'https://qawfiktqeoarnvsarejo.supabase.co/functions/v1/free-tier-nurture',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
