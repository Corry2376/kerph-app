-- Adds shop/business contact info to profiles, so a Quote PDF can carry the sender's real
-- business name/phone/email/address instead of just a bare username -- used by
-- quote-builder.html's PDF export and print-to-PDF flow.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).

alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists business_phone text;
alter table public.profiles add column if not exists business_email text;
alter table public.profiles add column if not exists business_address text;
