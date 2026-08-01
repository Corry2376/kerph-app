// Public "Contact Support" form handler for help.html — no sign-in required (a locked-out or
// signed-out visitor needs this to work too). Emails support@kerphplans.com via Resend with
// Reply-To set to the submitter's own address so replying from that inbox reaches them
// directly, and logs a row in support_tickets (service-role write, same pattern as every
// other table here — no direct client insert policy) so nothing is lost if the email bounces.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = 'Kerph Support <support@kerphplans.com>';
const SUPPORT_INBOX = 'support@kerphplans.com';

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
    const subject = String(body.subject ?? '').trim().slice(0, 200) || 'Kerph support request';
    const message = String(body.message ?? '').trim();
    const pageContext = body.pageContext ? String(body.pageContext).slice(0, 300) : null;

    if (!email || !email.includes('@')) return json({ error: 'A valid email is required.' }, 400);
    if (!message) return json({ error: 'A message is required.' }, 400);
    if (message.length > 4900) return json({ error: 'Message is too long.' }, 400);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: insertError } = await supabaseAdmin.from('support_tickets').insert({
      user_id: body.userId || null,
      email,
      subject,
      message,
      page_context: pageContext,
    });
    if (insertError) console.error('support_tickets insert failed', insertError);

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [SUPPORT_INBOX],
        reply_to: email,
        subject: `[Kerph Support] ${subject}`,
        html: `
          <p><strong>From:</strong> ${escapeHtml(email)}</p>
          ${pageContext ? `<p><strong>Page:</strong> ${escapeHtml(pageContext)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        `,
      }),
    });

    if (!resendResp.ok) {
      const errBody = await resendResp.text();
      console.error('Resend send failed', resendResp.status, errBody);
      // The ticket is already logged in support_tickets even though the email failed, so
      // nothing is lost — just tell the truth about the email half failing.
      return json({ error: "Your message was logged, but the notification email failed to send. We'll still see it." }, 200);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
