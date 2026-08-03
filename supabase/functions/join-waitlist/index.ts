// "Notify me at launch" capture on coming-soon.html — no sign-in required, since this runs
// before anyone has an account. Writes go through the service-role key (same "browser can't
// self-grant" pattern as every other table here) rather than a public insert policy, so the
// list can't be read or scraped by anyone but an admin even though writing to it doesn't
// require sign-in. Deploys with JWT verification OFF, same as log-telemetry/send-support-ticket.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = 'Kerph <hello@kerphplans.com>';

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim();

    if (!email || !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (email.length > 300) return json({ error: 'Enter a valid email address.' }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: insertError } = await supabaseAdmin.from('waitlist_signups').insert({ email });

    if (insertError) {
      // Unique violation on the case-insensitive email index — they're already on the list,
      // which is a success from the visitor's point of view, not an error.
      if (insertError.code === '23505') return json({ ok: true, alreadyOnList: true });
      console.error('waitlist_signups insert failed', insertError);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }

    // Confirmation email is a nice-to-have, not the point of the endpoint — the signup is
    // already saved above, so a failure here shouldn't turn into an error response.
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [email],
          subject: "You're on the Kerph waitlist",
          html: `
            <p>Thanks for your interest in Kerph &mdash; you're on the list.</p>
            <p>We'll email this address the moment Kerph opens up. No spam in the meantime.</p>
            <p>&mdash; The Kerph team</p>
          `,
        }),
      });
    } catch (e) {
      console.error('waitlist confirmation email failed', e);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
