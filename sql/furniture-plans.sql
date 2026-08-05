-- "Import from Photo" for Project Designer: logs each "draft a rough build spec from a photo
-- of a cabinet/bookcase/furniture piece" lookup made through the identify-furniture Edge
-- Function. The photo itself is never stored — only the vision model's structured read of it
-- (estimated dimensions, shelf/door/drawer counts, construction style, confidence, caveats) —
-- since there's no real need to retain user photos and it keeps storage/privacy exposure to a
-- minimum. This table doubles as lookup history and as the source of truth for the daily-use
-- cap the Edge Function enforces (Premier-only, real per-use API cost, same principle as
-- sql/part-finder.sql).
--
-- Deliberately does NOT extract exact joinery or millimeter-accurate dimensions — a single 2D
-- photo has no real-world scale reference without one, and hidden joints can't be seen from
-- outside an assembled piece. This is a rough starting draft the user reviews and adjusts in
-- Project Designer, not a claimed exact reconstruction.
--
-- Safe to re-run — every statement is guarded. Run this whole script in the Supabase SQL
-- Editor after sql/lemon-squeezy-subscriptions.sql (this feature is Premier-gated in practice
-- via the Edge Function checking that table).

create table if not exists public.furniture_lookups (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references auth.users(id) on delete cascade,
    item_type            text,        -- e.g. 'bookcase', 'base cabinet', 'dresser'
    estimated_width_in   numeric,
    estimated_height_in  numeric,
    estimated_depth_in   numeric,
    shelf_count          integer,
    door_count           integer,
    drawer_count         integer,
    construction_style   text,        -- e.g. 'face-frame cabinet', 'open bookcase, fixed shelves'
    material_guess       text,
    confidence           text,        -- 'high' | 'medium' | 'low'
    notes                text,        -- plain-English caveats from the vision model
    created_at           timestamptz not null default now()
);
create index if not exists furniture_lookups_user_id_created_at_idx on public.furniture_lookups(user_id, created_at desc);

alter table public.furniture_lookups enable row level security;

-- A user can see their own lookup history. All writes go through the identify-furniture Edge
-- Function using the service-role key — deliberately no client-side insert policy, same
-- "browser can't self-grant/self-log" principle as part_lookups, since letting the browser
-- insert its own rows would defeat the daily-use cap the Edge Function enforces by counting them.
drop policy if exists "furniture lookups own select" on public.furniture_lookups;
create policy "furniture lookups own select" on public.furniture_lookups
    for select using (auth.uid() = user_id);
