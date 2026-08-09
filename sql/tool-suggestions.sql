-- User-submitted catalog suggestions from the "Add Custom Tool" modal's "Suggest this tool
-- for the Kerph catalog" checkbox (workshop-planner.html). This is a signal queue, not a
-- live catalog write -- entries here never auto-publish. They're a real-demand worklist:
-- periodically research the highest-signal names (same manual, verified-source research
-- process used for the rest of the catalog) and add them to catalog-data.js/workshop-planner.html
-- by hand, same as every other tool already in the catalog. No automated research/publish
-- pipeline on purpose -- see project memory on why.
--
-- Safe to re-run.

create table if not exists public.tool_suggestions (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    tool_name   text not null,
    width_in    numeric,
    depth_in    numeric,
    height_in   numeric,
    status      text not null default 'new',   -- 'new' | 'researching' | 'added' | 'declined'
    created_at  timestamptz not null default now()
);
create index if not exists tool_suggestions_created_at_idx on public.tool_suggestions(created_at desc);
create index if not exists tool_suggestions_status_idx on public.tool_suggestions(status);

alter table public.tool_suggestions enable row level security;

-- A signed-in user can submit a suggestion under their own id -- same pattern as every other
-- user-owned table, no service-role function needed since this isn't reachable signed-out.
drop policy if exists "tool suggestions insert own" on public.tool_suggestions;
create policy "tool suggestions insert own" on public.tool_suggestions
    for insert with check (auth.uid() = user_id);

-- Admin-only read, same kerph_is_admin() pattern as every other internal-log table.
drop policy if exists "tool suggestions admin select" on public.tool_suggestions;
create policy "tool suggestions admin select" on public.tool_suggestions
    for select using (public.kerph_is_admin());
