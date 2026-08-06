-- Real name collected at sign-up, kept separate from `username` (the public handle used on
-- Showcase/Portfolio/Reviews) -- used only for the personal "Welcome back, {name}" greeting on
-- the home page.
--
-- Safe to re-run.

alter table public.profiles
    add column if not exists full_name text;
