// Emails an invited teammate when a new team_members row is created. Wired to a Supabase
// Database Webhook on INSERT of team_members — same pattern as notify-quote-response, not
// called directly by any page. Uses the service-role key (auto-injected) to look up the
// inviting owner's email for the message body — this runs server-to-server from the
// webhook, never called by a browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDRESS = 'Kerph <team@kerphplans.com>';
const APP_URL = 'https://kerphplans.com';

function escapeHtml(str: unknown) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record || payload.table !== 'team_members' || payload.type !== 'INSERT') {
      return new Response('ignored', { status: 200 });
    }
    if (record.status !== 'invited' || !record.invited_email) return new Response('nothing to send', { status: 200 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: team } = await supabaseAdmin.from('teams').select('owner_id').eq('id', record.team_id).maybeSingle();
    let ownerLabel = 'A Kerph user';
    let planLabel = 'Pro';
    if (team?.owner_id) {
      const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(team.owner_id);
      if (ownerData?.user?.email) ownerLabel = ownerData.user.email;
      const { data: ownerSub } = await supabaseAdmin
        .from('my_current_subscription').select('plan').eq('user_id', team.owner_id).maybeSingle();
      if (ownerSub?.plan === 'premier') planLabel = 'Premier';
    }

    const acceptUrl = `${APP_URL}/pricing.html?acceptInvite=${record.invite_token}`;
    const html = `
      <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
        <h2 style="color:#1e3a8a;">You're invited to a Kerph ${planLabel} team</h2>
        <p><strong>${escapeHtml(ownerLabel)}</strong> invited you to join their Kerph ${planLabel} plan as a teammate — a free seat is included, no card needed from you.</p>
        <p><a href="${acceptUrl}" style="display:inline-block; background:#1e3a8a; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Accept invite</a></p>
        <p style="color:#6b7280; font-size:13px;">If you don't have a Kerph account yet, sign up first with this same email address (${escapeHtml(record.invited_email)}), then click the link again.</p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [record.invited_email],
        subject: `${ownerLabel} invited you to their Kerph ${planLabel} team`,
        html,
      }),
    });

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
