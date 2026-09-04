// Sitewide "Contact Us" (footer link) -- no sign-in required. Publicly displays
// contactus@kerphplans.com but actually delivers to the real inbox below via Resend, with
// Reply-To set to the submitter so replying reaches them directly -- same pattern as
// send-support-ticket, just a different public alias and destination, and a categorized
// "reason" dropdown instead of a free-text subject.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = 'Kerph Contact <contactus@kerphplans.com>';
// Same pattern as the support inbox: a setting rather than a constant, so it can move without
// a redeploy. Default preserves the address this has always used.
const CONTACT_INBOX = Deno.env.get('CONTACT_INBOX_EMAIL') ?? 'cjstalcup@kerphplans.com';

const REASONS = [
  'Suggest a feature',
  'Report a bug or issue',
  'Billing or subscription question',
  'Partnership or business inquiry',
  'Press or media inquiry',
  'General question',
  'Other',
];

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
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim();
    const reason = String(body.reason ?? '').trim();
    const message = String(body.message ?? '').trim();
    const pageContext = body.pageContext ? String(body.pageContext).slice(0, 300) : null;

    if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400);
    if (!REASONS.includes(reason)) return json({ error: 'Choose a reason for contacting us.' }, 400);
    if (!message) return json({ error: 'A message is required.' }, 400);
    if (message.length > 4900) return json({ error: 'Message is too long.' }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: insertError } = await supabaseAdmin.from('contact_messages').insert({
      user_id: body.userId || null,
      email,
      reason,
      message,
      page_context: pageContext,
    });
    if (insertError) console.error('contact_messages insert failed', insertError);

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [CONTACT_INBOX],
        reply_to: email,
        subject: `[Kerph Contact] ${reason}`,
        html: `
          <p><strong>From:</strong> ${escapeHtml(email)}</p>
          <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
          ${pageContext ? `<p><strong>Page:</strong> ${escapeHtml(pageContext)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        `,
      }),
    });

    if (!resendResp.ok) {
      const errBody = await resendResp.text();
      console.error('Resend send failed', resendResp.status, errBody);
      return json({ error: "Your message was logged, but the notification email failed to send. We'll still see it." }, 200);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
