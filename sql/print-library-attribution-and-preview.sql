-- 3D Print Library: creator attribution + tile preview image.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Purely additive -- adds two nullable columns to the existing print_plans table (safe on
-- rows that already exist, they just read as null/no photo) and a new storage bucket for the
-- preview images, parallel to the existing print-plans bucket for the model files themselves.

alter table public.print_plans
    add column if not exists creator text,
    add column if not exists preview_image_path text;

insert into storage.buckets (id, name, public)
values ('print-plan-previews', 'print-plan-previews', true)
on conflict (id) do nothing;

create policy "print plan preview images public read"
on storage.objects for select
using (bucket_id = 'print-plan-previews');

create policy "print plan preview images own upload"
on storage.objects for insert
with check (bucket_id = 'print-plan-previews' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "print plan preview images own delete"
on storage.objects for delete
using (bucket_id = 'print-plan-previews' and auth.uid()::text = (storage.foldername(name))[1]);
