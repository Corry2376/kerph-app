-- Social auto-post log/queue: publishing a Garage Tips article or making a Portfolio project
-- public inserts a row here; a Database Webhook on INSERT fires the post-to-social Edge
-- Function, which posts to Facebook + Instagram and writes the result back onto the row.
-- Run this whole script once in the Supabase SQL Editor (Project > SQL Editor > New query).

create table public.social_posts (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    source            text not null,        -- 'garage_tips' | 'portfolio' | future content types
    source_id         uuid,
    title             text not null,
    excerpt           text,
    url               text not null,        -- public kerphplans.com link to the content
    image_url         text,                 -- full public https URL (not a storage path)
    status            text not null default 'pending',  -- pending | posted | failed
    facebook_post_id  text,
    facebook_error    text,
    instagram_post_id text,
    instagram_error   text,
    created_at        timestamptz not null default now(),
    posted_at         timestamptz
);
create index social_posts_created_at_idx on public.social_posts(created_at desc);
alter table public.social_posts enable row level security;

-- Admin-only, same is_admin subquery pattern as garage_tips — this table is an internal
-- log, never shown to regular users or the public.
create policy "social posts admin all" on public.social_posts
    for all using (auth.uid() in (select id from public.profiles where is_admin));
