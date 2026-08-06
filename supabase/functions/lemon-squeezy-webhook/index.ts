// Keeps public.subscriptions in sync with reality by listening to Lemon Squeezy's own
// webhook events. Unlike notify-quote-response/post-to-social, this function is NOT
// wired to a Supabase Database Webhook — Lemon Squeezy calls this function's public URL
// directly over HTTPS whenever a subscription is created/updated/cancelled/etc. Because
// the caller is Lemon Squeezy's server, not a signed-in Kerph user, this function must be
// deployed with JWT verification OFF (see the deploy step in the setup doc this shipped
// alongside) — Supabase would otherwise reject every request for missing a user token
// that Lemon Squeezy has no way to send.
//
// Authenticity instead comes from Lemon Squeezy's own signature: every request carries
// an X-Signature header, which is an HMAC-SHA256 of the RAW request body using the
// webhook secret you set when creating the webhook in the Lemon Squeezy dashboard. That
// secret is verified below before anything in the payload is trusted.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

// Win-back email on cancellation. Both are optional and unset ('') by default -- same
// "not configured yet = silently do nothing" convention as KERPH_INTRO_DISCOUNT in
// pricing.html -- so this stays inert until a real discount exists to offer. Create the
// discount in the Lemon Squeezy dashboard (Store > Discounts) valid across all four
// Pro/Premier variants, then set these two as Edge Function secrets (same place
// RESEND_API_KEY lives).
const WINBACK_DISCOUNT_CODE = Deno.env.get('KERPH_WINBACK_DISCOUNT_CODE') ?? '';
const WINBACK_DISCOUNT_LABEL = Deno.env.get('KERPH_WINBACK_DISCOUNT_LABEL') || 'a special discount';
const WINBACK_FROM_ADDRESS = 'Kerph <team@kerphplans.com>';

// Variant IDs come from the Lemon Squeezy dashboard (Products > [product] > variant) —
// see Phase 2 of the setup doc. Both the monthly and annual variant of a tier map to the
// same plan name, since billing cadence doesn't affect feature access. The *_ANNUAL_VARIANT_ID
// secrets are optional (default '') until annual checkout is wired up on the pricing page —
// an empty string key is harmless here since real Lemon Squeezy variant IDs are never empty.
const VARIANT_PLAN_MAP: Record<string, string> = {
  [Deno.env.get('LEMON_SQUEEZY_PRO_VARIANT_ID') ?? '']: 'pro',
  [Deno.env.get('LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID') ?? '']: 'pro',
  [Deno.env.get('LEMON_SQUEEZY_PREMIER_VARIANT_ID') ?? '']: 'premier',
  [Deno.env.get('LEMON_SQUEEZY_PREMIER_ANNUAL_VARIANT_ID') ?? '']: 'premier',
};
delete VARIANT_PLAN_MAP[''];

// The "Extra Seats" variant is a separate per-seat-priced line item a Premier owner checks
// out for once their team grows past the 4 included seats (see sql/teams.sql and
// supabase/functions/sync-team-seats). Its events update the teams table instead of
// subscriptions — a team's paid seat count isn't itself a Kerph plan tier.
const EXTRA_SEAT_VARIANT_ID = Deno.env.get('LEMON_SQUEEZY_PREMIER_EXTRA_SEAT_VARIANT_ID') ?? '';

function escapeHtml(str: unknown) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
}

// Records the cancellation (so it shows up in the admin dashboard's Cancellations list
// even if no discount is configured yet or the email fails) and, if a discount is
// configured, emails the user a link back to pricing.html with it pre-applied. Guards
// against double-sends from a Lemon Squeezy webhook retry by skipping if this exact
// subscription already got a cancellation_events row in the last 24 hours -- a genuine
// later cancellation (cancel -> resume -> cancel again) still gets a fresh row and a
// fresh email, since that's a real new win-back opportunity.
async function recordCancellationAndSendWinBack(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  lsSubscriptionId: string,
  plan: string,
  endsAt: string | null
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('cancellation_events')
    .select('id')
    .eq('ls_subscription_id', lsSubscriptionId)
    .gte('cancelled_at', since)
    .maybeSingle();
  if (recent) return;

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email ?? null;

  const { data: row, error: insertError } = await supabaseAdmin
    .from('cancellation_events')
    .insert({ user_id: userId, ls_subscription_id: lsSubscriptionId, plan, ends_at: endsAt, email })
    .select()
    .single();
  if (insertError || !row) {
    console.error('cancellation_events insert failed', insertError);
    return;
  }
  if (!email || !WINBACK_DISCOUNT_CODE) return;

  const resubUrl = `https://kerphplans.com/pricing.html?promo=${encodeURIComponent(WINBACK_DISCOUNT_CODE)}`;
  const planLabel = plan === 'premier' ? 'Premier' : 'Pro';
  const html = `
    <div style="font-family:sans-serif; max-width:520px; margin:0 auto;">
      <h2 style="color:#1e3a8a;">We'd love to have you back</h2>
      <p>We noticed you cancelled your Kerph ${escapeHtml(planLabel)} plan. Plans change, no hard feelings &mdash; but if you ever want to come back, here's ${escapeHtml(WINBACK_DISCOUNT_LABEL)} on us:</p>
      <p><a href="${resubUrl}" style="display:inline-block; background:#1e3a8a; color:#fff; padding:10px 18px; border-radius:6px; text-decoration:none;">Reactivate My Plan</a></p>
      <p style="color:#6b7280; font-size:13px;">The discount applies automatically at checkout &mdash; nothing to type in. If there's anything we could've done better, just reply to this email and let us know.</p>
    </div>
  `;

  try {
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: WINBACK_FROM_ADDRESS,
        to: [email],
        subject: "We'd love to have you back at Kerph",
        html,
      }),
    });
    if (resendResp.ok) {
      await supabaseAdmin.from('cancellation_events')
        .update({ winback_email_sent_at: new Date().toISOString(), winback_discount_code: WINBACK_DISCOUNT_CODE })
        .eq('id', row.id);
    } else {
      const errBody = await resendResp.text();
      console.error('Win-back Resend send failed', resendResp.status, errBody);
      await supabaseAdmin.from('cancellation_events').update({ winback_email_error: errBody.slice(0, 500) }).eq('id', row.id);
    }
  } catch (e) {
    console.error('Win-back email send threw', e);
    await supabaseAdmin.from('cancellation_events')
      .update({ winback_email_error: e instanceof Error ? e.message : 'error' })
      .eq('id', row.id);
  }
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time-ish compare — avoids leaking timing info about how much of the
// signature matched, cheap enough to always do even though the practical risk here is
// low (an attacker would need to guess a 64-char hex string blind either way).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return safeEqual(hex(digest), signatureHeader.toLowerCase());
}

Deno.serve(async (req) => {
  try {
    // Signature is computed over the exact raw bytes Lemon Squeezy sent — read as text
    // FIRST and verify against that, then parse. Parsing first and re-stringifying could
    // produce different bytes (whitespace, key order) and always fail verification.
    const rawBody = await req.text();
    const signature = req.headers.get('X-Signature');
    if (!(await verifySignature(rawBody, signature))) {
      return new Response('invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventName: string = payload?.meta?.event_name ?? '';
    if (!eventName.startsWith('subscription_')) {
      return new Response('ignored (not a subscription event)', { status: 200 });
    }

    // Passed through from the checkout URL as checkout[custom][user_id] — see the
    // checkout-button code in the setup doc. Every subscription event echoes back
    // whatever custom data was present at checkout time.
    const kerphUserId: string | undefined = payload?.meta?.custom_data?.user_id;
    if (!kerphUserId) {
      // Nothing we can do without knowing which Kerph account this is — logging this
      // case (rather than erroring) matters because it usually means the checkout link
      // was opened without the custom user_id param, which is a bug worth noticing.
      console.error('Lemon Squeezy webhook with no custom_data.user_id', eventName);
      return new Response('no kerph user id in custom data', { status: 200 });
    }

    const attrs = payload?.data?.attributes ?? {};
    const variantId: string = String(attrs.variant_id ?? '');
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (EXTRA_SEAT_VARIANT_ID && variantId === EXTRA_SEAT_VARIANT_ID) {
      // kerphUserId here is the team OWNER (they're the one who completed this checkout),
      // not a plan grant for themselves — their base pro/premier subscription event (a
      // separate webhook call) already handled that.
      const subscriptionItemId = attrs.first_subscription_item?.id;
      const { error: teamError } = await supabaseAdmin
        .from('teams')
        .update({
          extra_seats_subscription_id: String(payload.data.id),
          extra_seats_subscription_item_id: subscriptionItemId != null ? String(subscriptionItemId) : null,
          extra_seats_quantity: attrs.first_subscription_item?.quantity ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('owner_id', kerphUserId);
      if (teamError) throw teamError;
      return new Response('ok (extra seats)', { status: 200 });
    }

    const plan = VARIANT_PLAN_MAP[variantId];
    if (!plan) {
      console.error('Lemon Squeezy webhook for unrecognized variant_id', variantId);
      return new Response('unrecognized variant', { status: 200 });
    }

    const { error } = await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: kerphUserId,
        ls_customer_id: attrs.customer_id != null ? String(attrs.customer_id) : null,
        ls_subscription_id: String(payload.data.id),
        ls_variant_id: variantId,
        plan,
        status: attrs.status ?? 'active',
        customer_portal_url: attrs.urls?.customer_portal ?? null,
        renews_at: attrs.renews_at ?? null,
        ends_at: attrs.ends_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ls_subscription_id' }
    );
    if (error) throw error;

    if (eventName === 'subscription_cancelled') {
      await recordCancellationAndSendWinBack(supabaseAdmin, kerphUserId, String(payload.data.id), plan, attrs.ends_at ?? null);
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
