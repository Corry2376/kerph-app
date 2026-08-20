-- My Workbench: a running to-do list of projects. Each item is a real, independently
-- addressable row (NOT a singleton JSON blob -- see the data-loss-guard work earlier this
-- session) and can optionally link to one of the user's real saved Project Designer plans.
-- Private to its owner -- same shape/RLS pattern as saved_layouts/saved_projects/quotes
-- (sql/core-schema.sql), not the public print_plans pattern. Run this whole script in the
-- Supabase SQL Editor.

create table public.todos (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    title        text not null,
    done         boolean not null default false,
    -- on delete SET NULL, not cascade -- deleting a saved Project Designer plan should unlink
    -- it from the to-do item, not silently delete the to-do item itself.
    project_id   uuid references public.saved_projects(id) on delete set null,
    -- Denormalized snapshot of the linked project's name at attach time, so the list renders
    -- without an extra join/fetch -- same pattern as every other card elsewhere in this app
    -- that references another saved record (e.g. workshop-planner.html's Cost Rollup).
    project_name text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index todos_user_id_idx on public.todos(user_id);
alter table public.todos enable row level security;
create policy "own todos select" on public.todos for select using (auth.uid() = user_id);
create policy "own todos insert" on public.todos for insert with check (auth.uid() = user_id);
create policy "own todos update" on public.todos for update using (auth.uid() = user_id);
create policy "own todos delete" on public.todos for delete using (auth.uid() = user_id);
