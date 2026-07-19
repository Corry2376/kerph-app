-- 3D-Print Plans Library: a shared, searchable library of printable shop jigs/fixtures.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

create table public.print_plans (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    title           text not null,
    description     text,
    category        text not null default 'other' check (category in ('jig', 'fixture', 'dust-collection', 'tool-holder', 'other')),
    license         text not null default 'own' check (license in ('own', 'cc-by', 'cc-by-sa', 'public-domain', 'link-only')),
    source_url      text,
    file_path       text,
    file_name       text,
    author          text not null,
    downloads_count integer not null default 0,
    created_at      timestamptz not null default now()
);
create index print_plans_created_at_idx on public.print_plans(created_at desc);
create index print_plans_category_idx on public.print_plans(category);

alter table public.print_plans enable row level security;

create policy "print plans public read" on public.print_plans
    for select using (true);

create policy "print plans own insert" on public.print_plans
    for insert with check (auth.uid() = user_id);

create policy "print plans own delete" on public.print_plans
    for delete using (auth.uid() = user_id);

-- Download count is purely informational, so it's bumped through this function (callable by
-- anyone, including signed-out visitors) rather than a client-writable column — same idea as
-- the showcase-likes/tool-review-votes triggers elsewhere, just without a backing join table
-- since there's nothing per-user to track here.
create or replace function public.increment_print_plan_downloads(plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.print_plans set downloads_count = downloads_count + 1 where id = plan_id;
end;
$$;

-- Storage bucket for uploaded plan files (STL/3MF/STEP), public read, folder-per-user write.
insert into storage.buckets (id, name, public)
values ('print-plans', 'print-plans', true)
on conflict (id) do nothing;

create policy "print plan files public read"
on storage.objects for select
using (bucket_id = 'print-plans');

create policy "print plan files own upload"
on storage.objects for insert
with check (bucket_id = 'print-plans' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "print plan files own delete"
on storage.objects for delete
using (bucket_id = 'print-plans' and auth.uid()::text = (storage.foldername(name))[1]);
