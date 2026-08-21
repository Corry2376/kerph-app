-- Fix: kerphQueueSocialPost() lets any signed-in user queue a social post when they publish
-- a Portfolio project or a Shop Showcase post (see supabase-client.js), but the only RLS
-- policy on social_posts ("social posts admin all", from sql/social-posts.sql) restricted
-- every operation -- including insert -- to admins. A regular user's insert was silently
-- rejected by RLS, and the client-side call swallows the error (.catch(() => {})), so
-- Portfolio/Showcase auto-posting has never actually worked for anyone but an admin,
-- without ever surfacing as a visible bug. Garage Tips publishing is admin-only already,
-- so it was never affected.
--
-- Fix: any signed-in user can insert exactly one row for themselves. Select/update/delete
-- stay admin-only (via the existing "social posts admin all" policy) -- this table is an
-- internal queue/log, never meant to be read back by the user who queued the post; the
-- post-to-social Edge Function updates rows using the service-role key, which bypasses RLS.
--
-- Run this whole script once in the Supabase SQL Editor (Project > SQL Editor > New query).

drop policy if exists "social posts own insert" on public.social_posts;

create policy "social posts own insert" on public.social_posts
    for insert with check (auth.uid() = user_id);
