-- Admin dashboard (admin.html): lets an admin see subscriber counts by tier and total user
-- count, neither of which is possible today since profiles/subscriptions only grant a user
-- read access to their own row.
--
-- The existing admin-read policies elsewhere (client_errors/analytics_events/support_tickets
-- in sql/telemetry.sql) subquery public.profiles directly, which is safe because profiles is a
-- *different* table from the one being protected. A policy on profiles itself can't do the same
-- thing -- subquerying profiles from within a profiles policy is the exact "policy subqueries
-- its own table" recursion shape that caused the real production 42P17 infinite-recursion bug
-- fixed in sql/teams-rls-fix.sql. Same fix here: a SECURITY DEFINER helper function that checks
-- admin status while bypassing RLS (safe -- it only ever answers "is the calling user an admin",
-- nothing a user couldn't already legitimately learn about themselves), so the policy never has
-- to re-trigger its own evaluation.
--
-- Page-view/feature-usage numbers and "logins per day" (really: distinct active-user-days) come
-- from the analytics_events table, whose admin-read policy already exists and isn't self-
-- referential (it subqueries profiles, not analytics_events).
--
-- Safe to re-run -- every statement is guarded.

create or replace function public.kerph_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "profiles admin select" on public.profiles;
create policy "profiles admin select" on public.profiles
    for select using (public.kerph_is_admin());

drop policy if exists "subscriptions admin select" on public.subscriptions;
create policy "subscriptions admin select" on public.subscriptions
    for select using (public.kerph_is_admin());
