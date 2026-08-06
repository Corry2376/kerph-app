// Recomputes a team owner's paid extra-seat count and keeps Lemon Squeezy's "Extra Seats"
// subscription-item quantity in sync with it. Called by the owner's browser after any
// invite/remove (see kerphSyncTeamSeats in supabase-client.js). Deploy with JWT
// verification ON — the caller must be a real signed-in Kerph user.
//
// This can only ever adjust an EXISTING extra-seats subscription (PATCH .../subscription-
// items/{id}) or cancel one that's no longer needed — Lemon Squeezy has no server-side
// "start a brand-new subscription" call without the customer going through an actual
// checkout. When extraSeats > 0 and no subscription exists yet, this just reports that
// back (requiresCheckout: true) so the page can show the "add extra seats" checkout button
// instead of silently failing to bill for seats already in use.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LEMON_SQUEEZY_API_KEY = Deno.env.get('LEMON_SQUEEZY_API_KEY')!;

// Included seats depend on the owner's plan: Pro = 2 total (owner + 1 free teammate),
// Premier = 4 total (owner + 3 free teammates). Keep this in sync with
// kerphTeamIncludedSeatsForPlan in supabase-client.js if these numbers ever change.
function includedSeatsForPlan(plan: string | undefined) {
  return plan === 'premier' ? 4 : 2;
}

async function lemonSqueezyFetch(path: string, init: RequestInit = {}) {
  const resp = await fetch(`https://api.lemonsqueezy.com/v1${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${LEMON_SQUEEZY_API_KEY}`,
      ...(init.headers || {}),
    },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.errors?.[0]?.detail || `Lemon Squeezy API error (${resp.status})`);
  return json;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams').select('*').eq('owner_id', user.id).maybeSingle();
    if (teamError || !team) return new Response(JSON.stringify({ error: 'No team found for this account.' }), { status: 404 });

    const { data: ownerSub } = await supabaseAdmin
      .from('my_current_subscription').select('plan').eq('user_id', user.id).maybeSingle();
    const includedSeats = includedSeatsForPlan(ownerSub?.plan);

    const { count } = await supabaseAdmin
      .from('team_members').select('id', { count: 'exact', head: true })
      .eq('team_id', team.id).eq('status', 'active');
    const extraSeats = Math.max(0, (count ?? 0) - (includedSeats - 1));

    if (extraSeats === team.extra_seats_quantity) {
      return new Response(JSON.stringify({ extraSeats, requiresCheckout: false, unchanged: true }), { status: 200 });
    }

    if (!team.extra_seats_subscription_item_id) {
      // Nothing to sync to yet — either extraSeats is 0 (fine, nothing owed) or the owner
      // still needs to complete the one-time Extra Seats checkout before anything beyond
      // that can be kept in sync automatically.
      await supabaseAdmin.from('teams')
        .update({ extra_seats_quantity: extraSeats, updated_at: new Date().toISOString() })
        .eq('id', team.id);
      return new Response(JSON.stringify({ extraSeats, requiresCheckout: extraSeats > 0 }), { status: 200 });
    }

    if (extraSeats === 0) {
      // No paid extra seats needed anymore — cancel rather than try to bill a zero quantity.
      await lemonSqueezyFetch(`/subscriptions/${team.extra_seats_subscription_id}`, { method: 'DELETE' });
      await supabaseAdmin.from('teams').update({
        extra_seats_quantity: 0,
        extra_seats_subscription_id: null,
        extra_seats_subscription_item_id: null,
        updated_at: new Date().toISOString(),
      }).eq('id', team.id);
      return new Response(JSON.stringify({ extraSeats: 0, requiresCheckout: false, cancelled: true }), { status: 200 });
    }

    await lemonSqueezyFetch(`/subscription-items/${team.extra_seats_subscription_item_id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'subscription-items',
          id: team.extra_seats_subscription_item_id,
          attributes: { quantity: extraSeats, invoice_immediately: true },
        },
      }),
    });
    await supabaseAdmin.from('teams')
      .update({ extra_seats_quantity: extraSeats, updated_at: new Date().toISOString() })
      .eq('id', team.id);
    return new Response(JSON.stringify({ extraSeats, requiresCheckout: false, synced: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), { status: 500 });
  }
});
