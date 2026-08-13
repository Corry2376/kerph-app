// Sends a builder quote request directly from Kerph instead of handing the user a mailto:
// link (which just opens their email client and, per explicit feedback, "only encourages
// them to leave Kerph"). Called from find-a-builder.html's "Send from Kerph" button.
//
// Sent as one Resend call per recipient (not one call with multiple `to` addresses) so
// builders never see each other's email address in a shared quote-request thread.
//
// Requires the RESEND_API_KEY secret (already set for the other Kerph email functions --
// Supabase Dashboard > Edge Functions > Secrets). SUPABASE_URL / SUPABASE_ANON_KEY are
// auto-injected, not secrets you need to set yourself.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FROM_ADDRESS = 'Kerph Concierge <concierge@kerphplans.com>';

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

function escapeHtml(str: unknown) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Must be a signed-in Kerph user -- their JWT proves that, and their email becomes the
    // Reply-To so a builder hitting "reply" reaches the actual user, not a shared Kerph inbox.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not signed in.' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Not signed in.' }, 401);

    const { recipients, projectType, bodyText } = await req.json();
    if (!Array.isArray(recipients) || !recipients.length) {
      return json({ error: 'Enter at least one builder email address.' }, 400);
    }
    const validRecipients = recipients.map((r: unknown) => String(r).trim()).filter((r: string) => EMAIL_RE.test(r));
    if (!validRecipients.length) return json({ error: 'None of the entered addresses look like valid emails.' }, 400);
    if (validRecipients.length > 25) return json({ error: 'Too many recipients (max 25).' }, 400);

    const text = String(bodyText || '').trim();
    if (!text) return json({ error: 'Nothing to send.' }, 400);
    if (text.length > 5000) return json({ error: 'Message is too long.' }, 400);

    const senderName = user.user_metadata?.username || user.email;
    const subject = `Quote request: ${String(projectType || 'shop project').slice(0, 120)}`;
    const html = `<div style="font-family:sans-serif; max-width:560px; margin:0 auto; white-space:pre-wrap; line-height:1.6;">${escapeHtml(text)}</div>`;

    const results = await Promise.all(validRecipients.map(async (to: string) => {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [to],
          reply_to: user.email,
          subject,
          html,
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error('Resend send failed for', to, resp.status, errText);
        return { to, ok: false };
      }
      return { to, ok: true };
    }));

    const sent = results.filter((r) => r.ok).map((r) => r.to);
    const failed = results.filter((r) => !r.ok).map((r) => r.to);

    if (!sent.length) return json({ error: 'Could not send to any recipient. Try again in a moment.' }, 502);
    return json({ sent, failed, senderReplyTo: user.email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
