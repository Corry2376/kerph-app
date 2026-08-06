-- Kerph teams: lets a Pro or Premier subscriber invite teammates for free up to their
-- plan's included seat count (2 total seats on Pro, 4 total on Premier, owner included),
-- then $7/mo per seat beyond that — synced to Lemon Squeezy's "Extra Seats" variant via
-- the sync-team-seats Edge Function. A team member without their own subscription inherits
-- the owner's plan tier through team membership (see kerphGetMyEffectivePlan in
-- supabase-client.js).
--
-- Safe to re-run — every statement is guarded. Run this whole script in the Supabase SQL
-- Editor after sql/lemon-squeezy-subscriptions.sql (this file's RLS depends on the
-- my_current_subscription view that script creates).

create table if not exists public.teams (
    id                                uuid primary key default gen_random_uuid(),
    owner_id                          uuid not null unique references auth.users(id) on delete cascade,
    extra_seats_subscription_id      text,     -- Lemon Squeezy subscription id for the "Extra Seats" variant, once purchased
    extra_seats_subscription_item_id text,     -- the specific subscription-item id the quantity-sync API call targets
    extra_seats_quantity             integer not null default 0,
    created_at                       timestamptz not null default now(),
    updated_at                       timestamptz not null default now()
);
create index if not exists teams_owner_id_idx on public.teams(owner_id);

create table if not exists public.team_members (
    id            uuid primary key default gen_random_uuid(),
    team_id       uuid not null references public.teams(id) on delete cascade,
    user_id       uuid references auth.users(id) on delete cascade,  -- null until the invite is accepted
    invited_email text not null,
    status        text not null default 'invited',                  -- 'invited' | 'active'
    invite_token  uuid not null default gen_random_uuid(),
    invited_at    timestamptz not null default now(),
    joined_at     timestamptz
);
create unique index if not exists team_members_team_email_idx on public.team_members(team_id, invited_email);
create index if not exists team_members_user_id_idx on public.team_members(user_id);
create index if not exists team_members_invite_token_idx on public.team_members(invite_token);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Owner has full control (select/insert/update/delete) of their own team row. Team-row
-- creation itself isn't plan-gated (an empty team costs and grants nothing on its own) —
-- the real enforcement point is the invite policy below.
drop policy if exists "team owner all" on public.teams;
create policy "team owner all" on public.teams
    for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- An active member can see (but not edit) the team they belong to.
drop policy if exists "team member select" on public.teams;
create policy "team member select" on public.teams
    for select using (
        id in (select team_id from public.team_members where user_id = auth.uid() and status = 'active')
    );

-- Owner can see every row (invited + active) on their own team.
drop policy if exists "team owner select members" on public.team_members;
create policy "team owner select members" on public.team_members
    for select using (team_id in (select id from public.teams where owner_id = auth.uid()));

-- An active member can see their own teammates' roster (not any other team's).
drop policy if exists "team member select own roster" on public.team_members;
create policy "team member select own roster" on public.team_members
    for select using (
        team_id in (select team_id from public.team_members tm2 where tm2.user_id = auth.uid() and tm2.status = 'active')
    );

-- Only the owner can invite, and only while their own subscription is a currently-entitled
-- Pro or Premier plan. This is the real enforcement point (same principle as sql/lemon-
-- squeezy-subscriptions.sql: a browser can't grant itself paid access by calling the table
-- directly — Postgres checks the owner's real subscription row here, not anything the
-- client claims). Per-plan seat limits (2 for Pro, 4 for Premier) are enforced in the
-- application layer (sync-team-seats), not here — this policy only gates "paid at all".
drop policy if exists "team owner invite" on public.team_members;
create policy "team owner invite" on public.team_members
    for insert with check (
        team_id in (select id from public.teams where owner_id = auth.uid())
        and exists (
            select 1 from public.my_current_subscription
            where user_id = auth.uid() and plan in ('pro', 'premier') and status in ('active', 'on_trial', 'past_due')
        )
    );

-- Owner can remove any member of their own team.
drop policy if exists "team owner remove" on public.team_members;
create policy "team owner remove" on public.team_members
    for delete using (team_id in (select id from public.teams where owner_id = auth.uid()));

-- A member can remove themselves (leave the team).
drop policy if exists "team member leave" on public.team_members;
create policy "team member leave" on public.team_members
    for delete using (auth.uid() = user_id);

-- Lets a team member (or the owner) find out which plan tier they've inherited via team
-- membership (Pro vs Premier — the seat count and gated features differ) without exposing
-- the owner's full subscription row. RLS on subscriptions/my_current_subscription is
-- "auth.uid() = user_id" only, so a member's browser can't otherwise see the owner's plan
-- at all — same reasoning as kerph_is_admin() in sql/admin-dashboard.sql: a narrow
-- SECURITY DEFINER function instead of a broader read grant. Returns null (never over-
-- grants) if the caller isn't actually the owner or an active member of that team, or if
-- the owner has no currently-entitled subscription.
create or replace function public.kerph_team_owner_plan(p_team_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
    select ms.plan
    from public.teams t
    join public.my_current_subscription ms on ms.user_id = t.owner_id
    where t.id = p_team_id
      and ms.status in ('active', 'on_trial', 'past_due')
      and (
          t.owner_id = auth.uid()
          or exists (
              select 1 from public.team_members tm
              where tm.team_id = t.id and tm.user_id = auth.uid() and tm.status = 'active'
          )
      )
$$;
grant execute on function public.kerph_team_owner_plan(uuid) to authenticated;
