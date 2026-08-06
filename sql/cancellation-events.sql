-- Logs every real subscription cancellation (fired by the lemon-squeezy-webhook Edge
-- Function on the `subscription_cancelled` event) and tracks whether a win-back email was
-- sent for it. Doubles as both the admin dashboard's "Cancellations" list and the email
-- send log -- one row per cancellation event, not one row per user, so a user who cancels,
-- resubscribes, and cancels again shows up twice (each is a genuine new win-back
-- opportunity). Never written to from the browser -- only the webhook Edge Function,
-- using the service-role key, inserts/updates these rows.
--
-- Safe to re-run.

create table if not exists public.cancellation_events (
    id                     uuid primary key default gen_random_uuid(),
    user_id                uuid not null references auth.users(id) on delete cascade,
    ls_subscription_id     text not null,
    plan                   text not null,             -- 'pro' | 'premier' -- the plan they cancelled out of
    cancelled_at           timestamptz not null default now(),
    ends_at                timestamptz,                -- when access actually ends (Lemon Squeezy's ends_at)
    email                  text,                       -- snapshot at cancellation time, for display without a service-role lookup
    winback_email_sent_at  timestamptz,                -- null until the email actually sends
    winback_discount_code  text,
    winback_email_error    text                        -- set instead of winback_email_sent_at if Resend rejected the send
);
create index if not exists cancellation_events_user_id_idx on public.cancellation_events(user_id);
create index if not exists cancellation_events_ls_subscription_id_idx on public.cancellation_events(ls_subscription_id);
create index if not exists cancellation_events_cancelled_at_idx on public.cancellation_events(cancelled_at desc);

alter table public.cancellation_events enable row level security;

-- Admin-only, same kerph_is_admin() pattern as every other internal-log table
-- (contact_messages, social_posts) -- this is never shown to the user it's about.
drop policy if exists "cancellation events admin select" on public.cancellation_events;
create policy "cancellation events admin select" on public.cancellation_events
    for select using (public.kerph_is_admin());
