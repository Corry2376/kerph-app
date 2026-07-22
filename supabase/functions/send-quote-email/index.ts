// Sends a quote to a client: PDF attached, plus a link to the accept/decline portal
// (quote-view.html). Called from quote-builder.html's "Email to Client" button.
//
// Requires the RESEND_API_KEY secret to be set (Supabase Dashboard > Edge Functions >
// Secrets). SUPABASE_URL / SUPABASE_ANON_KEY are auto-injected by Supabase, not secrets
// you need to set yourself.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const FROM_ADDRESS = 'Kerph Quotes <quotes@kerphplans.com>';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // The caller must be a signed-in Kerph user — their own JWT (not a service key) is what
    // proves that, and it's also where the Reply-To address comes from, so a client hitting
    // "reply" in their inbox reaches the actual shop, not a shared Kerph address.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Not signed in.' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: 'Not signed in.' }, 401);

    const { to, quoteName, clientName, shareLink, pdfBase64 } = await req.json();
    if (!to || !pdfBase64) return json({ error: 'Missing recipient or PDF.' }, 400);

    const senderName = user.user_metadata?.username || user.email;

    const html = `
      <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
        <h2 style="color:#1e3a8a;">${escapeHtml(quoteName || 'Your Quote')}</h2>
        <p>Hi${clientName ? ' ' + escapeHtml(clientName) : ''},</p>
        <p>${escapeHtml(senderName)} sent you a quote. It's attached as a PDF, or you can view and respond to it online:</p>
        <p><a href="${escapeHtml(shareLink)}" style="display:inline-block; background:#1e3a8a; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:bold;">View &amp; Respond to Quote</a></p>
        <p style="color:#6b7280; font-size:13px;">You can accept or decline the quote on that page, with a note back to the shop if you'd like — or just reply to this email with any questions.</p>
      </div>
    `;

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        reply_to: user.email,
        subject: `Quote from ${senderName}: ${quoteName || 'Untitled Quote'}`,
        html,
        attachments: [
          {
            filename: `${(quoteName || 'quote').replace(/[^a-z0-9]+/gi, '-')}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      return json({ error: `Resend error: ${errText}` }, 502);
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
