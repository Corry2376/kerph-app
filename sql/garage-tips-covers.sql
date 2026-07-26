-- Sets a real cover PHOTO on the 3 Garage Tips articles (replaces the earlier abstract icon-art
-- version of this script). These are free-license stock photos (Pexels License -- free for
-- commercial use, no attribution required) downloaded and committed into the repo at
-- images/garage-tips/, not uploaded Storage photos (no live admin session available to upload
-- real files from here). kerphGarageTipImageUrl() (supabase-client.js) recognizes any
-- cover_image_path starting with "images/" and serves it directly instead of resolving it
-- against the garage-tips-images Storage bucket, so this works without a real Storage upload.
-- Safe to re-run -- it just overwrites cover_image_path with these values again.

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/table-saws-cover.jpg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'Top 10 Most Popular Table Saws in 2026';

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/tool-maintenance-cover.jpg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'The Shop Maintenance Guide: Table Saw, Band Saw & Jointer/Planer';

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
update public.garage_tips
set cover_image_path = 'images/garage-tips/dust-collection-cover.jpg'
from target_user
where garage_tips.user_id = target_user.id
  and garage_tips.title = 'Dust Collection Setup: Tips & Tricks for a Shop That Actually Breathes';
