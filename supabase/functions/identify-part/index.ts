// Identifies a mystery hardware part (screw, bolt, bracket, fastener) from a photo using
// Claude's vision API, and returns retailer search links rather than a claimed exact-SKU
// match — hardware parts are often visually near-identical across brands/sizes, so a search
// link is the honest, always-correct-format way to point someone toward buying it.
//
// Deploy with JWT verification ON — the caller must be a real signed-in Kerph user. This is
// deliberately NOT built like every other free, unlimited Shop Jig: it has real per-photo
// API cost, so it's gated to an entitled Premier subscription (checked server-side against
// the real subscriptions table, not the local plan-preview toggle a browser could self-grant)
// plus a generous daily cap as abuse/cost protection.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

// claude-opus-5 gives the best identification accuracy on obscure/generic hardware. Swap to
// a cheaper/faster model here (e.g. claude-haiku-4-5) if real usage volume makes that
// tradeoff worth it later — this is the only line that needs to change.
const MODEL = 'claude-opus-5';

const INCLUDED_DAILY_LOOKUPS = 30;

const IDENTIFY_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Best-guess common name for the part, e.g. "1/4-20 x 1in hex bolt" or "Simpson Strong-Tie L-angle bracket"' },
    description: { type: 'string', description: 'A sentence describing what it is and what it is typically used for' },
    specs: { type: 'string', description: 'Likely size/thread/material spec if determinable from the photo, or "not determinable from photo" if not' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    search_terms: { type: 'string', description: 'A short, retailer-search-friendly query string for this part' },
  },
  required: ['name', 'description', 'specs', 'confidence', 'search_terms'],
  additionalProperties: false,
};

function buildSearchLinks(searchTerms: string) {
  const q = encodeURIComponent(searchTerms);
  return {
    amazon: `https://www.amazon.com/s?k=${q}`,
    homeDepot: `https://www.homedepot.com/s/${q}`,
    mcmasterCarr: `https://www.mcmaster.com/#/search=${q}`,
    grainger: `https://www.grainger.com/search?searchQuery=${q}`,
    fastenal: `https://www.fastenal.com/products?query=${q}`,
  };
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Not signed in.' }), { status: 401 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: sub } = await supabaseAdmin
      .from('my_current_subscription')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();
    const entitled = !!sub && sub.plan === 'premier' && ['active', 'on_trial', 'past_due'].includes(sub.status);
    if (!entitled) {
      return new Response(JSON.stringify({ error: 'Part Finder is a Premier feature.' }), { status: 403 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('part_lookups').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since);
    if ((count ?? 0) >= INCLUDED_DAILY_LOOKUPS) {
      return new Response(JSON.stringify({ error: `Daily limit reached (${INCLUDED_DAILY_LOOKUPS} lookups/day) — try again tomorrow.` }), { status: 429 });
    }

    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64 || !mediaType) {
      return new Response(JSON.stringify({ error: 'No photo received.' }), { status: 400 });
    }

    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: IDENTIFY_SCHEMA },
        },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: 'This photo shows a mystery hardware part from a home workshop or garage — a screw, bolt, nut, bracket, fastener, or similar small part. Identify it as specifically as you reasonably can from what\'s visible (thread type, head style, size, material, brand markings). If you genuinely cannot tell, say so honestly in the description and set confidence to "low" rather than guessing a specific size.',
            },
          ],
        }],
      }),
    });

    if (!claudeResp.ok) {
      const errBody = await claudeResp.text();
      console.error('Claude API error', claudeResp.status, errBody);
      return new Response(JSON.stringify({ error: 'Could not identify that part right now — try again in a moment.' }), { status: 502 });
    }

    const claudeData = await claudeResp.json();
    if (claudeData.stop_reason === 'refusal') {
      return new Response(JSON.stringify({ error: 'Could not identify that part from this photo.' }), { status: 200 });
    }

    const textBlock = (claudeData.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!textBlock) {
      return new Response(JSON.stringify({ error: 'No identification returned — try a clearer, closer photo.' }), { status: 200 });
    }

    let identification;
    try {
      identification = JSON.parse(textBlock.text);
    } catch {
      return new Response(JSON.stringify({ error: 'Could not parse the identification — try again.' }), { status: 502 });
    }

    const { error: insertError } = await supabaseAdmin.from('part_lookups').insert({
      user_id: user.id,
      identified_name: identification.name,
      description: identification.description,
      specs: identification.specs,
      confidence: identification.confidence,
      search_terms: identification.search_terms,
    });
    if (insertError) console.error('part_lookups insert failed', insertError);

    return new Response(JSON.stringify({
      ...identification,
      buyLinks: buildSearchLinks(identification.search_terms),
    }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), { status: 500 });
  }
});
