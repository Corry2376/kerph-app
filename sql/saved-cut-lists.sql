-- Named, per-user saved parts lists for Cut List Optimizer -- same shape and RLS pattern as
-- saved_layouts/saved_projects (see makeNamedSaveDomain in supabase-client.js, which this
-- table is designed to plug straight into). No share_token column -- unlike saved layouts/
-- projects, sharing a parts list with someone else was never requested, so it's left out
-- rather than adding an unused column "in case."

create table if not exists public.saved_cut_lists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    data jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.saved_cut_lists enable row level security;

create policy "own saved cut lists select" on public.saved_cut_lists
    for select using (auth.uid() = user_id);

create policy "own saved cut lists insert" on public.saved_cut_lists
    for insert with check (auth.uid() = user_id);

create policy "own saved cut lists update" on public.saved_cut_lists
    for update using (auth.uid() = user_id);

create policy "own saved cut lists delete" on public.saved_cut_lists
    for delete using (auth.uid() = user_id);
