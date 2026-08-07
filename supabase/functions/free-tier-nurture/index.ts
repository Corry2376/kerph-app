// Daily sweep (see sql/free-tier-nurture.sql for the pg_cron schedule that calls this)
// that emails a one-time "try Pro/Premier" discount offer to accounts that turned 30 days
// old today and are still on the Free plan. Mirrors recordCancellationAndSendWinBack in
// lemon-squeezy-webhook/index.ts closely -- same Resend pattern, same "stays inert until a
// real discount is configured" convention -- but the dedup here is a database unique
// constraint (user_id, email_type) rather than a time-window check, since this is a
// once-ever-per-user email rather than a repeatable-per-cancellation one.
//
// Deploy with --no-verify-jwt: the caller is a pg_cron -> pg_net HTTP call with no user
// session, and the function takes no request input (it only reads its own query), so
// there is nothing here a public caller could abuse beyond triggering the sweep early --
// harmless since the unique constraint caps each user at exactly one email regardless of
// how many times this runs.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

const NURTURE_DISCOUNT_CODE = Deno.env.get('KERPH_NURTURE_DISCOUNT_CODE') ?? '';
const NURTURE_DISCOUNT_LABEL = Deno.env.get('KERPH_NURTURE_DISCOUNT_LABEL') || 'a special discount';
const NURTURE_FROM_ADDRESS = 'Kerph <team@kerphplans.com>';

const PAID_STATUSES = ['active', 'on_trial', 'past_due'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function escapeHtml(str: unknown) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

Deno.serve(async (_req) => {
  try {
    if (!NURTURE_DISCOUNT_CODE) {
      return json({ ok: true, skipped: 'KERPH_NURTURE_DISCOUNT_CODE not configured yet' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Whoever turned exactly 30 (to just under 31) days old since sign-up in this run --
    // a 24-hour-wide window so a daily cron catches everyone exactly once as they cross it.
    const windowStart = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: candidatesError } = await supabaseAdmin
      .from('profiles')
      .select('id, created_at')
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd);
    if (candidatesError) throw candidatesError;

    let sent = 0;
    let skippedPaid = 0;
    let skippedNoEmail = 0;
    let alreadySent = 0;

    for (const profile of candidates ?? []) {
      const { data: sub } = await supabaseAdmin
        .from('my_current_subscription')
        .select('plan, status')
        .eq('user_id', profile.id)
        .maybeSingle();
      const isPaid = !!sub && ['pro', 'premier'].includes(sub.plan) && PAID_STATUSES.includes(sub.status);
      if (isPaid) { skippedPaid++; continue; }

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id);
      const email = userData?.user?.email ?? null;
      if (!email) { skippedNoEmail++; continue; }

      const { data: row, error: insertError } = await supabaseAdmin
        .from('nurture_emails')
        .insert({ user_id: profile.id, email_type: 'free_30_day', email })
        .select()
        .single();
      if (insertError) {
        // Unique-violation means this user already got this email -- expected, not an error.
        if (insertError.code !== '23505') console.error('nurture_emails insert failed', insertError);
        alreadySent++;
        continue;
      }

      const upgradeUrl = `https://kerphplans.com/pricing.html?promo=${encodeURIComponent(NURTURE_DISCOUNT_CODE)}`;
      const html = `
        <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
          <h2 style="color:#1e3a8a;">Ready to unlock the rest of Kerph?</h2>
          <p>You have had Kerph free for a month now. If saved layouts, custom shop shapes, cabinetry, or any of the Pro/Premier tools sound useful, here is ${escapeHtml(NURTURE_DISCOUNT_LABEL)} to try one:</p>
          <p><a href="${upgradeUrl}" style="display:inline-block; background:#1e3a8a; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">See Plans &amp; Pricing</a></p>
          <p style="color:#6b7280; font-size:13px;">The discount applies automatically at checkout &mdash; nothing to type in. No pressure either way &mdash; the Free plan keeps working exactly as it does today.</p>
        </div>
      `;

      try {
        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: NURTURE_FROM_ADDRESS,
            to: [email],
            subject: 'A month in on Kerph — here is something for you',
            html,
          }),
        });
        if (resendResp.ok) {
          sent++;
        } else {
          const errBody = await resendResp.text();
          console.error('Nurture Resend send failed', resendResp.status, errBody);
        }
      } catch (e) {
        console.error('Nurture email send threw', e);
      }
    }

    return json({ ok: true, candidates: candidates?.length ?? 0, sent, skippedPaid, skippedNoEmail, alreadySent });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
