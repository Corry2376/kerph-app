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

// Variant IDs come from the Lemon Squeezy dashboard (Products > [product] > variant) —
// see Phase 2 of the setup doc. Starting monthly-only; add PRO_ANNUAL/PREMIER_ANNUAL
// here (and to the map below) once annual billing is wired up.
const VARIANT_PLAN_MAP: Record<string, string> = {
  [Deno.env.get('LEMON_SQUEEZY_PRO_VARIANT_ID') ?? '']: 'pro',
  [Deno.env.get('LEMON_SQUEEZY_PREMIER_VARIANT_ID') ?? '']: 'premier',
};

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
    const plan = VARIANT_PLAN_MAP[variantId];
    if (!plan) {
      console.error('Lemon Squeezy webhook for unrecognized variant_id', variantId);
      return new Response('unrecognized variant', { status: 200 });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { error } = await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: kerphUserId,
        ls_customer_id: attrs.customer_id != null ? String(attrs.customer_id) : null,
        ls_subscription_id: String(payload.data.id),
        ls_variant_id: variantId,
        plan,
        status: attrs.status ?? 'active',
        renews_at: attrs.renews_at ?? null,
        ends_at: attrs.ends_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ls_subscription_id' }
    );
    if (error) throw error;

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
