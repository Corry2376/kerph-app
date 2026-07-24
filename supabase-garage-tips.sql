-- Garage Tips & How-To's — run this whole script once in the Supabase SQL Editor.

-- Marks an account as an admin (able to write/edit/delete articles, and see drafts).
-- Nothing here is exposed to the client except a true/false flag.
alter table public.profiles
    add column if not exists is_admin boolean not null default false;

create table public.garage_tips (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users(id) on delete cascade,
    title             text not null,
    excerpt           text,
    body_html         text not null,
    cover_image_path  text,
    video_url         text,
    category          text,
    tags              text[] not null default '{}',
    published         boolean not null default false,
    author            text not null,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index garage_tips_created_at_idx on public.garage_tips(created_at desc);
alter table public.garage_tips enable row level security;

-- Everyone (including signed-out visitors) can read published articles; only an admin can
-- also see drafts — which is what lets an admin browse their own unfinished work.
create policy "garage tips public read" on public.garage_tips
    for select using (
        published = true
        or auth.uid() in (select id from public.profiles where is_admin)
    );

create policy "garage tips admin insert" on public.garage_tips
    for insert with check (auth.uid() in (select id from public.profiles where is_admin));

create policy "garage tips admin update" on public.garage_tips
    for update using (auth.uid() in (select id from public.profiles where is_admin));

create policy "garage tips admin delete" on public.garage_tips
    for delete using (auth.uid() in (select id from public.profiles where is_admin));

-- Storage bucket for article cover images (public read, admin-only write — same pattern as
-- showcase-photos, just gated to admins instead of "any signed-in user").
insert into storage.buckets (id, name, public)
values ('garage-tips-images', 'garage-tips-images', true)
on conflict (id) do nothing;

create policy "garage tips images public read"
on storage.objects for select
using (bucket_id = 'garage-tips-images');

create policy "garage tips images admin upload"
on storage.objects for insert
with check (
    bucket_id = 'garage-tips-images'
    and auth.uid() in (select id from public.profiles where is_admin)
);

create policy "garage tips images admin delete"
on storage.objects for delete
using (
    bucket_id = 'garage-tips-images'
    and auth.uid() in (select id from public.profiles where is_admin)
);

-- Last step: grant yourself admin access. Replace the email, then run just this one line
-- (everything above only needs to run once; this line is safe to re-run for any account).
-- update public.profiles set is_admin = true where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
