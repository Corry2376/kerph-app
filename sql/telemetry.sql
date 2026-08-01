-- Error monitoring, lightweight pageview analytics, and a real support-ticket inbox.
-- All three tables follow the same "browser can't self-grant" pattern used everywhere else
-- in this app: no direct client insert policy, every write goes through an Edge Function
-- using the service-role key. Admins (is_admin on profiles) can read all rows for triage.
--
-- Safe to re-run — every statement is guarded.

create table if not exists public.client_errors (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid references auth.users(id) on delete set null,
    message    text not null check (char_length(message) < 2000),
    stack      text check (stack is null or char_length(stack) < 4000),
    page_url   text,
    user_agent text,
    created_at timestamptz not null default now()
);
create index if not exists client_errors_created_at_idx on public.client_errors(created_at desc);

create table if not exists public.analytics_events (
    id         uuid primary key default gen_random_uuid(),
    event_type text not null,  -- 'pageview' for now, room for more later
    path       text not null,
    user_id    uuid references auth.users(id) on delete set null,
    session_id text,           -- anonymous per-browser id from localStorage, not PII
    created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_path_idx on public.analytics_events(path);

create table if not exists public.support_tickets (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users(id) on delete set null,
    email        text not null,
    subject      text not null,
    message      text not null check (char_length(message) < 5000),
    page_context text,
    status       text not null default 'open',  -- 'open' | 'resolved'
    created_at   timestamptz not null default now()
);
create index if not exists support_tickets_status_created_idx on public.support_tickets(status, created_at desc);

alter table public.client_errors enable row level security;
alter table public.analytics_events enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "client errors admin select" on public.client_errors;
create policy "client errors admin select" on public.client_errors
    for select using (auth.uid() in (select id from public.profiles where is_admin));

drop policy if exists "analytics events admin select" on public.analytics_events;
create policy "analytics events admin select" on public.analytics_events
    for select using (auth.uid() in (select id from public.profiles where is_admin));

drop policy if exists "support tickets admin select" on public.support_tickets;
create policy "support tickets admin select" on public.support_tickets
    for select using (auth.uid() in (select id from public.profiles where is_admin));

drop policy if exists "support tickets admin update" on public.support_tickets;
create policy "support tickets admin update" on public.support_tickets
    for update using (auth.uid() in (select id from public.profiles where is_admin));
