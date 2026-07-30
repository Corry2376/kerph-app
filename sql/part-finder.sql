-- Part Finder: logs each "identify this screw/bracket/part from a photo" lookup made
-- through the identify-part Edge Function. The photo itself is never stored — only the
-- vision model's identification result — since there's no real need to retain user photos
-- and it keeps storage/privacy exposure to a minimum. This table doubles as the lookup
-- history shown in the Part Finder page and as the source of truth for the daily-use cap
-- the Edge Function enforces (Part Finder is a Premier-only feature with real per-use API
-- cost, unlike every other free, unlimited Shop Jig).
--
-- Safe to re-run — every statement is guarded. Run this whole script in the Supabase SQL
-- Editor after sql/lemon-squeezy-subscriptions.sql (RLS below doesn't depend on it, but
-- this feature is Premier-gated in practice via the Edge Function checking that table).

create table if not exists public.part_lookups (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users(id) on delete cascade,
    identified_name text,
    description    text,
    specs          text,
    confidence     text,        -- 'high' | 'medium' | 'low'
    search_terms   text,
    created_at     timestamptz not null default now()
);
create index if not exists part_lookups_user_id_created_at_idx on public.part_lookups(user_id, created_at desc);

alter table public.part_lookups enable row level security;

-- A user can see their own lookup history. All writes go through the identify-part Edge
-- Function using the service-role key (same "browser can't self-grant" principle as every
-- other real table in this app) — there is deliberately no client-side insert policy, since
-- letting the browser insert its own "identification" rows would defeat the point of the
-- daily-use cap the Edge Function enforces by counting these rows.
drop policy if exists "part lookups own select" on public.part_lookups;
create policy "part lookups own select" on public.part_lookups
    for select using (auth.uid() = user_id);
