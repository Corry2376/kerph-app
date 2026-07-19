-- Kerph core schema — EVERYTHING except `profiles` (which already exists) is missing from
-- this database. Run this whole script in the Supabase SQL Editor first, then run
-- sql/portfolio.sql and sql/print-library.sql after it (in that order).
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS guards throughout.

create extension if not exists pgcrypto;

-- ---------- profiles: add any columns the app expects that might predate this script ----------
alter table public.profiles
    add column if not exists avatar_data_url text,
    add column if not exists unit_system text,
    add column if not exists maintenance_reminders_enabled boolean;

-- ---------- Singleton "live state" tables: one row per user, upsert-only ----------

create table public.current_layouts (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    data       jsonb not null,
    updated_at timestamptz not null default now()
);
alter table public.current_layouts enable row level security;
create policy "own current layout select" on public.current_layouts for select using (auth.uid() = user_id);
create policy "own current layout upsert" on public.current_layouts for insert with check (auth.uid() = user_id);
create policy "own current layout update" on public.current_layouts for update using (auth.uid() = user_id);

create table public.tool_status (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    data       jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.tool_status enable row level security;
create policy "own tool status select" on public.tool_status for select using (auth.uid() = user_id);
create policy "own tool status upsert" on public.tool_status for insert with check (auth.uid() = user_id);
create policy "own tool status update" on public.tool_status for update using (auth.uid() = user_id);

create table public.custom_tools (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    data       jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.custom_tools enable row level security;
create policy "own custom tools select" on public.custom_tools for select using (auth.uid() = user_id);
create policy "own custom tools upsert" on public.custom_tools for insert with check (auth.uid() = user_id);
create policy "own custom tools update" on public.custom_tools for update using (auth.uid() = user_id);

create table public.cabinet_templates (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    data       jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.cabinet_templates enable row level security;
create policy "own cabinet templates select" on public.cabinet_templates for select using (auth.uid() = user_id);
create policy "own cabinet templates upsert" on public.cabinet_templates for insert with check (auth.uid() = user_id);
create policy "own cabinet templates update" on public.cabinet_templates for update using (auth.uid() = user_id);

create table public.cutlist_live_parts (
    user_id    uuid primary key references auth.users(id) on delete cascade,
    data       jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.cutlist_live_parts enable row level security;
create policy "own cutlist parts select" on public.cutlist_live_parts for select using (auth.uid() = user_id);
create policy "own cutlist parts upsert" on public.cutlist_live_parts for insert with check (auth.uid() = user_id);
create policy "own cutlist parts update" on public.cutlist_live_parts for update using (auth.uid() = user_id);

-- One row holds all five of Project Designer's independently-autosaved pieces so each
-- save (panels/hardware/notes/labels/measurements) can upsert just its own column.
create table public.project_live_state (
    user_id      uuid primary key references auth.users(id) on delete cascade,
    panels       jsonb not null default '[]'::jsonb,
    hardware     jsonb not null default '[]'::jsonb,
    notes        text  not null default '',
    labels       jsonb not null default '[]'::jsonb,
    measurements jsonb not null default '[]'::jsonb,
    updated_at   timestamptz not null default now()
);
alter table public.project_live_state enable row level security;
create policy "own project live state select" on public.project_live_state for select using (auth.uid() = user_id);
create policy "own project live state upsert" on public.project_live_state for insert with check (auth.uid() = user_id);
create policy "own project live state update" on public.project_live_state for update using (auth.uid() = user_id);

-- ---------- Named-save tables: one row per item ----------

create table public.saved_layouts (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    name        text not null,
    layout_type text not null default 'workshop' check (layout_type in ('workshop', 'dust-collection', 'lighting')),
    data        jsonb not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index saved_layouts_user_id_idx on public.saved_layouts(user_id);
alter table public.saved_layouts enable row level security;
create policy "own saved layouts select" on public.saved_layouts for select using (auth.uid() = user_id);
create policy "own saved layouts insert" on public.saved_layouts for insert with check (auth.uid() = user_id);
create policy "own saved layouts update" on public.saved_layouts for update using (auth.uid() = user_id);
create policy "own saved layouts delete" on public.saved_layouts for delete using (auth.uid() = user_id);

create table public.saved_projects (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    name       text not null,
    data       jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index saved_projects_user_id_idx on public.saved_projects(user_id);
alter table public.saved_projects enable row level security;
create policy "own saved projects select" on public.saved_projects for select using (auth.uid() = user_id);
create policy "own saved projects insert" on public.saved_projects for insert with check (auth.uid() = user_id);
create policy "own saved projects update" on public.saved_projects for update using (auth.uid() = user_id);
create policy "own saved projects delete" on public.saved_projects for delete using (auth.uid() = user_id);

create table public.quotes (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users(id) on delete cascade,
    name       text not null,
    data       jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index quotes_user_id_idx on public.quotes(user_id);
alter table public.quotes enable row level security;
create policy "own quotes select" on public.quotes for select using (auth.uid() = user_id);
create policy "own quotes insert" on public.quotes for insert with check (auth.uid() = user_id);
create policy "own quotes update" on public.quotes for update using (auth.uid() = user_id);
create policy "own quotes delete" on public.quotes for delete using (auth.uid() = user_id);

-- ---------- Public content tables + vote-count triggers ----------

create table public.showcase_posts (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    title        text not null,
    description  text,
    image_path   text,
    tags         text[] not null default '{}',
    author       text not null,
    likes_count  integer not null default 0,
    created_at   timestamptz not null default now()
);
create index showcase_posts_created_at_idx on public.showcase_posts(created_at desc);
alter table public.showcase_posts enable row level security;
create policy "showcase posts public read" on public.showcase_posts for select using (true);
create policy "showcase posts own insert" on public.showcase_posts for insert with check (auth.uid() = user_id);
create policy "showcase posts own delete" on public.showcase_posts for delete using (auth.uid() = user_id);
-- Deliberately no UPDATE policy: likes_count only ever changes via the trigger below
-- (security definer bypasses RLS internally) — no authenticated client can tamper with it.

create table public.showcase_comments (
    id         uuid primary key default gen_random_uuid(),
    post_id    uuid not null references public.showcase_posts(id) on delete cascade,
    user_id    uuid not null references auth.users(id) on delete cascade,
    author     text not null,
    body       text not null,
    created_at timestamptz not null default now()
);
create index showcase_comments_post_id_idx on public.showcase_comments(post_id);
alter table public.showcase_comments enable row level security;
create policy "showcase comments public read" on public.showcase_comments for select using (true);
create policy "showcase comments own insert" on public.showcase_comments for insert with check (auth.uid() = user_id);
create policy "showcase comments own delete" on public.showcase_comments for delete using (auth.uid() = user_id);

create table public.showcase_likes (
    post_id    uuid not null references public.showcase_posts(id) on delete cascade,
    user_id    uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (post_id, user_id)
);
alter table public.showcase_likes enable row level security;
create policy "own showcase likes select" on public.showcase_likes for select using (auth.uid() = user_id);
create policy "own showcase likes insert" on public.showcase_likes for insert with check (auth.uid() = user_id);
create policy "own showcase likes delete" on public.showcase_likes for delete using (auth.uid() = user_id);

create or replace function public.sync_showcase_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        update public.showcase_posts set likes_count = likes_count + 1 where id = new.post_id;
        return new;
    elsif tg_op = 'DELETE' then
        update public.showcase_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
        return old;
    end if;
    return null;
end;
$$;
drop trigger if exists showcase_likes_count_sync on public.showcase_likes;
create trigger showcase_likes_count_sync
after insert or delete on public.showcase_likes
for each row execute function public.sync_showcase_likes_count();

create table public.tool_reviews (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null references auth.users(id) on delete cascade,
    tool_name     text not null,
    category      text not null,
    rating        smallint not null check (rating between 1 and 5),
    review_text   text not null,
    author        text not null,
    helpful_count integer not null default 0,
    created_at    timestamptz not null default now()
);
create index tool_reviews_created_at_idx on public.tool_reviews(created_at desc);
alter table public.tool_reviews enable row level security;
create policy "tool reviews public read" on public.tool_reviews for select using (true);
create policy "tool reviews own insert" on public.tool_reviews for insert with check (auth.uid() = user_id);
create policy "tool reviews own delete" on public.tool_reviews for delete using (auth.uid() = user_id);

create table public.tool_review_votes (
    review_id  uuid not null references public.tool_reviews(id) on delete cascade,
    user_id    uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (review_id, user_id)
);
alter table public.tool_review_votes enable row level security;
create policy "own review votes select" on public.tool_review_votes for select using (auth.uid() = user_id);
create policy "own review votes insert" on public.tool_review_votes for insert with check (auth.uid() = user_id);
create policy "own review votes delete" on public.tool_review_votes for delete using (auth.uid() = user_id);

create or replace function public.sync_tool_review_helpful_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        update public.tool_reviews set helpful_count = helpful_count + 1 where id = new.review_id;
        return new;
    elsif tg_op = 'DELETE' then
        update public.tool_reviews set helpful_count = greatest(0, helpful_count - 1) where id = old.review_id;
        return old;
    end if;
    return null;
end;
$$;
drop trigger if exists tool_review_votes_count_sync on public.tool_review_votes;
create trigger tool_review_votes_count_sync
after insert or delete on public.tool_review_votes
for each row execute function public.sync_tool_review_helpful_count();

-- ---------- Storage bucket for Shop Showcase photos ----------

insert into storage.buckets (id, name, public)
values ('showcase-photos', 'showcase-photos', true)
on conflict (id) do nothing;

drop policy if exists "showcase photos public read" on storage.objects;
create policy "showcase photos public read"
on storage.objects for select
using (bucket_id = 'showcase-photos');

drop policy if exists "showcase photos own upload" on storage.objects;
create policy "showcase photos own upload"
on storage.objects for insert
with check (bucket_id = 'showcase-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "showcase photos own delete" on storage.objects;
create policy "showcase photos own delete"
on storage.objects for delete
using (bucket_id = 'showcase-photos' and auth.uid()::text = (storage.foldername(name))[1]);
