-- Email opt-ins from the Follow Us page ("Get shop tips & new feature drops"). Written only
-- by the subscribe-newsletter Edge Function via the service-role key -- same "no public RLS
-- insert policy, go through a function instead" pattern as waitlist_signups -- so the list
-- can't be read or scraped by anyone but an admin, and can't be spammed with junk rows
-- directly against PostgREST either. The unique constraint on email is the dedup mechanism:
-- a repeat signup hits a 23505 conflict that the function treats as a success, not an error.
--
-- Safe to re-run.

create table if not exists public.newsletter_subscribers (
    id             uuid primary key default gen_random_uuid(),
    email          text not null unique,
    source         text not null default 'follow_page',
    subscribed_at  timestamptz not null default now()
);
create index if not exists newsletter_subscribers_subscribed_at_idx on public.newsletter_subscribers(subscribed_at desc);

alter table public.newsletter_subscribers enable row level security;

-- Admin-only read, same kerph_is_admin() pattern as every other internal-log table. No insert
-- policy at all -- the Edge Function's service-role key bypasses RLS entirely, so anon/
-- authenticated callers get zero direct access in either direction.
drop policy if exists "newsletter subscribers admin select" on public.newsletter_subscribers;
create policy "newsletter subscribers admin select" on public.newsletter_subscribers
    for select using (public.kerph_is_admin());
