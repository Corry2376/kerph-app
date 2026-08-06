-- "How did you hear about us?" — asked once per account (a small corner prompt, not a
-- blocking step in sign-up itself) and shown as a breakdown on the admin dashboard.
-- Reuses the existing admin-read policy on profiles (sql/admin-dashboard.sql) -- this is
-- just one more column on a table admins can already read in full.
--
-- Safe to re-run.

alter table public.profiles
    add column if not exists referral_source text;
