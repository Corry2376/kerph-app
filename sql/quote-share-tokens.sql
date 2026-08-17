-- Quote Builder: client-facing share links (quote-view.html) + accept/decline.
-- Run this whole script in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Root-cause fix: supabase-client.js's kerphGetQuoteByShareToken/kerphRespondToQuote have
-- called rpc('get_quote_by_share_token', ...) / rpc('respond_to_quote', ...) since the quote
-- share feature was built, but neither function was ever actually created in the database --
-- there was no sql/*.sql migration file for them (unlike the near-identical, working
-- get_project_by_share_token / get_layout_by_share_token pattern this mirrors). Every quote
-- share link has been dead on arrival ("This quote link isn't valid...") until this runs.
--
-- Unlike saved_projects/saved_layouts, the quotes table has no real share_token column --
-- ensureQuoteSavedAndShared() in quote-builder.html has always stored the token nested inside
-- the `data` jsonb blob (quote.shareToken), so these functions match that existing shape
-- rather than requiring a client-side change too.

-- Security-definer function: bypasses RLS, but only ever returns the single row whose data
-- blob's shareToken matches the exact, unguessable token passed in -- same pattern as
-- get_project_by_share_token/get_layout_by_share_token, just keyed on a jsonb field instead
-- of a real column since that's how quotes already stores it.
create or replace function public.get_quote_by_share_token(p_token text)
returns table (id uuid, name text, data jsonb)
language sql
security definer
set search_path = public
as $$
    select id, name, data
    from public.quotes
    where data->>'shareToken' = p_token
    limit 1;
$$;
grant execute on function public.get_quote_by_share_token(text) to anon, authenticated;

-- Records the client's accept/decline. clientResponse is written separately from status (and
-- never overwritten again after this) so the shop can later move status on to "completed"
-- without losing the record of how -- and whether -- the client actually responded; status
-- keeps tracking the shop's own workflow stage (draft/sent/accepted/rejected/completed).
create or replace function public.respond_to_quote(p_token text, p_response text, p_notes text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if p_response not in ('accepted', 'rejected') then
        raise exception 'invalid response: %', p_response;
    end if;

    select id into v_id from public.quotes where data->>'shareToken' = p_token limit 1;
    if v_id is null then
        raise exception 'quote not found for token';
    end if;

    update public.quotes
    set data = data || jsonb_build_object(
            'status', p_response,
            'clientResponse', p_response,
            'clientRespondedAt', now(),
            'clientNotes', coalesce(p_notes, '')
        ),
        updated_at = now()
    where id = v_id;
end;
$$;
grant execute on function public.respond_to_quote(text, text, text) to anon, authenticated;
