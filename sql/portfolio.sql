-- Portfolio feature: permanent per-user project pages, tied into Shop Showcase.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

create table public.portfolio_projects (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    title        text not null,
    description  text,
    materials    text,
    finish       text,
    plan_source  text,
    cover_path   text,
    gallery_paths text[] not null default '{}',
    is_public    boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index portfolio_projects_user_id_idx on public.portfolio_projects(user_id);
create index portfolio_projects_public_idx on public.portfolio_projects(user_id, is_public);

alter table public.portfolio_projects enable row level security;

-- Owner can always see all their own projects (public or private).
create policy "portfolio projects own select" on public.portfolio_projects
    for select using (auth.uid() = user_id);

-- Anyone (including signed-out visitors) can see a project marked public.
create policy "portfolio projects public select" on public.portfolio_projects
    for select using (is_public = true);

create policy "portfolio projects own insert" on public.portfolio_projects
    for insert with check (auth.uid() = user_id);

create policy "portfolio projects own update" on public.portfolio_projects
    for update using (auth.uid() = user_id);

create policy "portfolio projects own delete" on public.portfolio_projects
    for delete using (auth.uid() = user_id);

-- Storage bucket for cover + gallery photos, public read, folder-per-user write.
insert into storage.buckets (id, name, public)
values ('portfolio-photos', 'portfolio-photos', true)
on conflict (id) do nothing;

create policy "portfolio photos public read"
on storage.objects for select
using (bucket_id = 'portfolio-photos');

create policy "portfolio photos own upload"
on storage.objects for insert
with check (bucket_id = 'portfolio-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "portfolio photos own delete"
on storage.objects for delete
using (bucket_id = 'portfolio-photos' and auth.uid()::text = (storage.foldername(name))[1]);
