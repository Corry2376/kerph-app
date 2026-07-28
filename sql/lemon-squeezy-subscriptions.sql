-- Lemon Squeezy subscriptions: maps a Kerph user to their real, paid-for plan status,
-- kept in sync by the lemon-squeezy-webhook Edge Function (never written to directly
-- from the browser). Run this whole script in the Supabase SQL Editor
-- (Project > SQL Editor > New query).

create table public.subscriptions (
    id                 uuid primary key default gen_random_uuid(),
    user_id            uuid not null references auth.users(id) on delete cascade,
    ls_customer_id     text,
    ls_subscription_id text unique,
    ls_variant_id      text,
    plan               text not null default 'free',    -- 'pro' | 'premier'
    status             text not null default 'active',  -- Lemon Squeezy's own status strings: on_trial, active, paused, past_due, unpaid, cancelled, expired
    renews_at          timestamptz,
    ends_at            timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

-- A user can read their own subscription (so the Account panel can show real plan/
-- renewal info), but never write to it — only the webhook Edge Function, using the
-- service-role key which bypasses RLS, is allowed to write. This is the whole point
-- of the table: a browser can't just grant itself Pro/Premier by editing localStorage
-- the way the old preview-only gating worked.
create policy "subscriptions own select" on public.subscriptions
    for select using (auth.uid() = user_id);

-- One convenience view: the single most-recently-updated row per user, which is what
-- the client actually wants ("what's my current plan") without writing that join by
-- hand every time. RLS on the underlying table still applies through the view.
create or replace view public.my_current_subscription as
select distinct on (user_id) *
from public.subscriptions
order by user_id, updated_at desc;
