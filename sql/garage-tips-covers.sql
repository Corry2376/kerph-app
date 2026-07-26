-- Sets a cover image on the 3 Garage Tips articles published earlier. These aren't uploaded
-- Storage photos (no live admin session available to upload real files from here) -- they're
-- original branded SVG graphics committed into the repo at images/garage-tips/, one per
-- article, matching Kerph's own navy/red palette. kerphGarageTipImageUrl() (supabase-client.js)
-- now recognizes any cover_image_path starting with "images/" and serves it directly instead of
-- resolving it against the garage-tips-images Storage bucket, so this works without a real
-- Storage upload. Run this whole script once in the Supabase SQL Editor.

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/table-saws-cover.svg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'Top 10 Most Popular Table Saws in 2026';

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/tool-maintenance-cover.svg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'The Shop Maintenance Guide: Table Saw, Band Saw & Jointer/Planer';

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/dust-collection-cover.svg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'Dust Collection Setup: Tips & Tricks for a Shop That Actually Breathes';
