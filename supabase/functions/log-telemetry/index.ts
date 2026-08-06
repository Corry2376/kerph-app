// Ingests lightweight client-side telemetry: JS errors and pageviews. No sign-in required —
// errors and pageviews happen for anonymous visitors too, so this deploys with JWT
// verification OFF. Writes go through the service-role key (same "browser can't self-grant"
// pattern as every other table in this app) rather than a public insert policy, so
// client_errors/analytics_events can't be read by anyone but an admin even though writing to
// them doesn't require sign-in.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (body.type === 'error') {
      const message = String(body.message ?? '').slice(0, 1900);
      if (!message) return json({ error: 'No message.' }, 400);
      const { error } = await supabaseAdmin.from('client_errors').insert({
        user_id: body.userId || null,
        message,
        stack: body.stack ? String(body.stack).slice(0, 3900) : null,
        page_url: body.pageUrl ? String(body.pageUrl).slice(0, 500) : null,
        user_agent: body.userAgent ? String(body.userAgent).slice(0, 500) : null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (body.type === 'pageview') {
      const path = String(body.path ?? '').slice(0, 500);
      if (!path) return json({ error: 'No path.' }, 400);
      const { error } = await supabaseAdmin.from('analytics_events').insert({
        event_type: 'pageview',
        path,
        user_id: body.userId || null,
        session_id: body.sessionId ? String(body.sessionId).slice(0, 100) : null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // Fired once per signed-in user per calendar day (deduped client-side) -- feeds the admin
    // dashboard's "active users per day" chart. Not a raw sign-in-event log: a user who keeps
    // an existing session open across many page loads only logs one of these a day, which is
    // the more useful "how many distinct people used Kerph today" number, not noisy auth-event
    // counting. No anonymous case -- there's no such thing as a signed-out "active user" here.
    if (body.type === 'login') {
      if (!body.userId) return json({ error: 'No userId.' }, 400);
      const { error } = await supabaseAdmin.from('analytics_events').insert({
        event_type: 'login',
        path: 'auth:active',
        user_id: body.userId,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: 'Unknown telemetry type.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
