// Notifies the Kerph user who sent a quote when their client accepts or declines it via
// quote-view.html. This function is NOT called directly by any page — it's wired to fire
// from a Supabase Database Webhook on UPDATE of the `quotes` table (see setup steps
// delivered alongside this file). The webhook payload format below is Supabase's standard
// shape for that feature: { type, table, record, old_record }.
//
// Uses the service-role key (auto-injected, not a secret you set) to look up the quote
// owner's email via the Auth admin API — this function runs server-to-server from the
// webhook, never called by a browser, so that elevated access is safe here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = 'Kerph Quotes <quotes@kerphplans.com>';

function escapeHtml(str: unknown) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record;
    if (!record || payload.table !== 'quotes') return new Response('ignored', { status: 200 });

    const newStatus = record.data?.status;
    const oldStatus = oldRecord?.data?.status;
    // Only a genuine transition into accepted/rejected triggers a notification — an
    // unrelated edit to an already-responded quote (or a re-save with the same status)
    // must not re-notify the shop.
    if (newStatus === oldStatus) return new Response('no status change', { status: 200 });
    if (newStatus !== 'accepted' && newStatus !== 'rejected') return new Response('not a response', { status: 200 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(record.user_id);
    if (userError || !userData?.user?.email) return new Response('owner email not found', { status: 200 });

    const ownerEmail = userData.user.email;
    const quoteName = record.data?.name || 'Untitled Quote';
    const clientName = record.data?.clientName || 'Your client';
    const notes = record.data?.clientNotes;
    const accepted = newStatus === 'accepted';

    const html = `
      <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
        <h2 style="color:${accepted ? '#15803d' : '#b91c1c'};">${accepted ? 'Quote accepted' : 'Quote declined'}</h2>
        <p><strong>${escapeHtml(clientName)}</strong> ${accepted ? 'accepted' : 'declined'} your quote "<strong>${escapeHtml(quoteName)}</strong>".</p>
        ${notes ? `<p style="background:#f8fafc; border-left:4px solid #cbd5e1; padding:10px 14px;">${escapeHtml(notes)}</p>` : ''}
        <p><a href="https://kerphplans.com/quote-builder.html" style="color:#1e3a8a;">Open Quote Builder</a></p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [ownerEmail],
        subject: `${clientName} ${accepted ? 'accepted' : 'declined'} your quote: ${quoteName}`,
        html,
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
