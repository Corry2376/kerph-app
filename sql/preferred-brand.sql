-- Preferred Tool Brand — asked (optionally) at sign-up, editable later in Account Settings.
-- Drives the catalog's "Preferred Brand" badge (client-side match against the tool's brand,
-- derived from its name — see window.kerphExtractBrand in catalog-data.js).
--
-- Safe to re-run.

alter table public.profiles
    add column if not exists preferred_brand text;
