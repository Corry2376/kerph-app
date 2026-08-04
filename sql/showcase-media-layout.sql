-- Shop Showcase: multiple photos per post, an optional video, and attaching one of the
-- poster's own saved shop layouts so viewers can open the real grid (not just a text mention).
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

alter table public.showcase_posts add column if not exists gallery_paths jsonb not null default '[]'::jsonb;
alter table public.showcase_posts add column if not exists video_path text;
alter table public.showcase_posts add column if not exists layout_id uuid references public.saved_layouts(id) on delete set null;
alter table public.showcase_posts add column if not exists layout_share_token text;
alter table public.showcase_posts add column if not exists layout_name text;

-- Same security-definer-RPC pattern as get_project_by_share_token / get_quote_by_share_token:
-- bypasses saved_layouts' owner-only RLS, but only for the exact unguessable token, so a
-- Showcase viewer can open the attached layout in workshop-planner.html without being signed
-- in as its owner.
alter table public.saved_layouts add column if not exists share_token text;
create unique index if not exists saved_layouts_share_token_idx
    on public.saved_layouts(share_token) where share_token is not null;

create or replace function public.get_layout_by_share_token(p_token text)
returns table (id uuid, name text, layout_type text, data jsonb)
language sql
security definer
set search_path = public
as $$
    select id, name, layout_type, data
    from public.saved_layouts
    where share_token = p_token and share_token is not null
    limit 1;
$$;
grant execute on function public.get_layout_by_share_token(text) to anon, authenticated;
