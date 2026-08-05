-- Fixes "infinite recursion detected in policy" (Postgres error 42P17) on public.teams and
-- public.team_members, live in production as of 2026-08-05. Confirmed via a direct REST
-- query against both tables.
--
-- Root cause: two of sql/teams.sql's policies subquery a table protected by its own RLS
-- policy, which re-triggers that policy, which re-runs the same subquery, forever:
--   - "team member select" (on teams) subqueries team_members, whose own "team owner select
--     members" policy subqueries teams right back -- a two-table cycle.
--   - "team member select own roster" (on team_members) subqueries team_members itself
--     directly -- a same-table cycle.
--
-- Fix: two SECURITY DEFINER helper functions that look up a user's team memberships/
-- ownership while bypassing RLS (safe here -- they only ever return team_ids tied to
-- auth.uid(), nothing a user couldn't already legitimately learn), then repoint every
-- policy that used to subquery the other RLS-protected table at these functions instead.
-- This is the standard, documented fix for this exact Postgres/Supabase RLS recursion shape.
--
-- Safe to re-run -- every statement is guarded (create or replace / drop policy if exists).
-- Run this AFTER sql/teams.sql (it replaces policies that script created).

create or replace function public.kerph_user_active_team_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
    select team_id from public.team_members where user_id = auth.uid() and status = 'active';
$$;

create or replace function public.kerph_user_owned_team_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
    select id from public.teams where owner_id = auth.uid();
$$;

drop policy if exists "team member select" on public.teams;
create policy "team member select" on public.teams
    for select using (id in (select public.kerph_user_active_team_ids()));

drop policy if exists "team owner select members" on public.team_members;
create policy "team owner select members" on public.team_members
    for select using (team_id in (select public.kerph_user_owned_team_ids()));

drop policy if exists "team member select own roster" on public.team_members;
create policy "team member select own roster" on public.team_members
    for select using (team_id in (select public.kerph_user_active_team_ids()));

drop policy if exists "team owner invite" on public.team_members;
create policy "team owner invite" on public.team_members
    for insert with check (
        team_id in (select public.kerph_user_owned_team_ids())
        and exists (
            select 1 from public.my_current_subscription
            where user_id = auth.uid() and plan = 'premier' and status in ('active', 'on_trial', 'past_due')
        )
    );

drop policy if exists "team owner remove" on public.team_members;
create policy "team owner remove" on public.team_members
    for delete using (team_id in (select public.kerph_user_owned_team_ids()));
