-- 3D Print Library: let the owner edit their own plan, and let an admin edit or delete any
-- plan (not just their own). Run this whole script in the Supabase SQL Editor.
-- Safe to re-run -- every policy is dropped and recreated; public.kerph_is_admin() already
-- exists (sql/admin-dashboard.sql) and is reused here rather than duplicated.

drop policy if exists "print plans own delete" on public.print_plans;
create policy "print plans owner or admin delete" on public.print_plans
    for delete using (auth.uid() = user_id or public.kerph_is_admin());

-- No update policy existed at all before this -- print_plans was insert-once, delete-only.
create policy "print plans owner or admin update" on public.print_plans
    for update using (auth.uid() = user_id or public.kerph_is_admin());

-- Storage cleanup on delete/replace needs the same owner-or-admin allowance, or an admin
-- deleting/editing someone else's plan succeeds on the database row but silently fails to
-- remove their file from Storage, leaving it orphaned.
drop policy if exists "print plan files own delete" on storage.objects;
create policy "print plan files owner or admin delete"
on storage.objects for delete
using (bucket_id = 'print-plans' and (auth.uid()::text = (storage.foldername(name))[1] or public.kerph_is_admin()));

drop policy if exists "print plan preview images own delete" on storage.objects;
create policy "print plan preview images owner or admin delete"
on storage.objects for delete
using (bucket_id = 'print-plan-previews' and (auth.uid()::text = (storage.foldername(name))[1] or public.kerph_is_admin()));
