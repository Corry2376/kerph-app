-- Project Designer: real joinery (rabbet/dado) between panels.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

alter table public.project_live_state add column if not exists joints jsonb not null default '[]'::jsonb;
