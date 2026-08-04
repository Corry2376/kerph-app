-- Lets a signed-in user's hidden-home-tile choices ("Customize Tiles" on index.html) follow
-- them across devices, the same way home_tile_order already does. The feature works purely
-- from localStorage without this column too -- this just adds cross-device sync on top.
--
-- Safe to re-run -- additive only.

alter table public.profiles
    add column if not exists home_tile_hidden jsonb not null default '[]'::jsonb;
