// Flips a pending team_members invite to active for the signed-in caller. Called directly
// by the invitee's browser after they click the accept link in their invite email (see
// team-invite/index.ts). Deploy with JWT verification ON (the default) — Supabase already
// confirms the caller is a real signed-in Kerph user before this code runs. The service-role
// client below exists only because the invited row doesn't belong to this user's team yet
// (chicken-and-egg: RLS can't let someone update a row for a team they're not a member of
// until this exact step makes them one), not to skip the caller-identity check.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'Missing invite token.' }), { status: 400 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('team_members')
      .select('id, invited_email, status')
      .eq('invite_token', token)
      .maybeSingle();
    if (inviteError || !invite) return new Response(JSON.stringify({ error: 'Invite not found.' }), { status: 404 });
    if (invite.status === 'active') return new Response(JSON.stringify({ ok: true, alreadyActive: true }), { status: 200 });

    // The invite was addressed to a specific email — only that account may accept it, so a
    // leaked or guessed token alone isn't enough to join someone else's team.
    if ((user.email || '').toLowerCase() !== invite.invited_email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'This invite was sent to a different email address. Sign in with that address instead.' }), { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('team_members')
      .update({ user_id: user.id, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', invite.id);
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), { status: 500 });
  }
});
