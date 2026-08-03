-- "Notify me at launch" capture on coming-soon.html. Writes go through the join-waitlist
-- Edge Function (service-role insert) rather than a direct client insert policy, matching
-- the same "browser can't self-grant" pattern as client_errors/analytics_events/support_tickets
-- in telemetry.sql. Admins can read the list for triage/export; no one else can.
--
-- Safe to re-run — every statement is guarded.

create table if not exists public.waitlist_signups (
    id         uuid primary key default gen_random_uuid(),
    email      text not null check (char_length(email) < 320),
    created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness so "Foo@bar.com" and "foo@bar.com" don't both get in — the
-- Edge Function checks this and returns a friendly "already on the list" response instead of
-- surfacing the raw constraint violation.
create unique index if not exists waitlist_signups_email_lower_idx on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

drop policy if exists "waitlist signups admin select" on public.waitlist_signups;
create policy "waitlist signups admin select" on public.waitlist_signups
    for select using (auth.uid() in (select id from public.profiles where is_admin));
