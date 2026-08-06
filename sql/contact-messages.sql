-- Sitewide "Contact Us" (footer link, bottom-center) -- logs every message even if the outbound
-- email fails, same "never lose it" pattern as support_tickets. No client insert policy --
-- all writes go through the contact-us Edge Function using the service-role key.
--
-- Safe to re-run.

create table if not exists public.contact_messages (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references auth.users(id) on delete set null,
    email        text not null,
    reason       text not null,
    message      text not null check (char_length(message) < 5000),
    page_context text,
    created_at   timestamptz not null default now()
);
create index if not exists contact_messages_created_at_idx on public.contact_messages(created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists "contact messages admin select" on public.contact_messages;
create policy "contact messages admin select" on public.contact_messages
    for select using (public.kerph_is_admin());
