-- Project Designer: shareable read-only 3D links + auto-generated hero thumbnails.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

alter table public.saved_projects add column if not exists share_token text;
create unique index if not exists saved_projects_share_token_idx
    on public.saved_projects(share_token) where share_token is not null;

-- Security-definer function: bypasses RLS, but only ever returns the single row matching an
-- exact, unguessable share token — same pattern as the existing get_quote_by_share_token used
-- for the client-facing quote portal (quote-view.html).
create or replace function public.get_project_by_share_token(p_token text)
returns table (id uuid, name text, data jsonb)
language sql
security definer
set search_path = public
as $$
    select id, name, data
    from public.saved_projects
    where share_token = p_token and share_token is not null
    limit 1;
$$;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;

-- Storage bucket for the auto-generated hero thumbnail, public read, folder-per-user write —
-- same shape as the existing portfolio-photos/showcase-photos buckets.
insert into storage.buckets (id, name, public)
values ('project-thumbnails', 'project-thumbnails', true)
on conflict (id) do nothing;

create policy "project thumbnails public read"
on storage.objects for select
using (bucket_id = 'project-thumbnails');

create policy "project thumbnails own upload"
on storage.objects for insert
with check (bucket_id = 'project-thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "project thumbnails own delete"
on storage.objects for delete
using (bucket_id = 'project-thumbnails' and auth.uid()::text = (storage.foldername(name))[1]);
