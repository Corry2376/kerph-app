// "Import from Photo" for Project Designer: looks at a photo of a cabinet, bookcase, or
// similar furniture piece and drafts a ROUGH starting build spec — estimated box dimensions,
// shelf/door/drawer counts, a guessed construction style and material — that the client turns
// into starter Project Designer panels via the existing assembly-template code path.
//
// Deliberately NOT a claimed exact reconstruction. A single 2D photo has no real-world scale
// reference unless the caller supplies one measurement, and hidden joinery (dado vs. rabbet,
// pocket screws vs. mortise-tenon) can't be seen from outside an assembled piece — the model is
// instructed to say so plainly rather than guess with false confidence. This mirrors the same
// honesty-first design as identify-part (Part Finder): a search-link handoff instead of a
// claimed exact SKU match, here a "draft, review before you cut" spec instead of a claimed
// exact plan.
//
// Deploy with JWT verification ON — the caller must be a real signed-in Kerph user. Real
// per-photo API cost, so this is Premier-gated server-side against the real subscriptions
// table (never the local plan-preview toggle a browser could self-grant), plus a daily cap —
// same principle and same cap (20/day) as Part Finder's Premier tier.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

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

// claude-opus-5 for the same reason as identify-part: best accuracy on an inherently fuzzy
// estimation task. Swap to a cheaper/faster model here if real usage volume makes that
// tradeoff worth it later — this is the only line that needs to change.
const MODEL = 'claude-opus-5';

const INCLUDED_DAILY_LOOKUPS = 20;

const FURNITURE_SCHEMA = {
  type: 'object',
  properties: {
    item_type: { type: 'string', description: 'Best-guess common name for the piece, e.g. "bookcase", "base cabinet", "dresser", "nightstand"' },
    estimated_width_in: { type: 'number', description: 'Estimated overall width in inches, using the supplied reference measurement if given, otherwise a best-effort guess from typical proportions for this type of piece' },
    estimated_height_in: { type: 'number', description: 'Estimated overall height in inches' },
    estimated_depth_in: { type: 'number', description: 'Estimated overall depth in inches' },
    shelf_count: { type: 'integer', description: 'Number of visible shelves (adjustable or fixed), not counting the top/bottom of the case itself' },
    door_count: { type: 'integer' },
    drawer_count: { type: 'integer' },
    construction_style: { type: 'string', description: 'e.g. "face-frame cabinet", "frameless/euro-style cabinet", "open bookcase, fixed shelves", "mitered frame"' },
    material_guess: { type: 'string', description: 'Best guess at material/finish from appearance, e.g. "painted MDF or poplar", "appears to be solid oak", "plywood with edge banding" — phrased as a guess, not a claim' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Low if no reference measurement was supplied and proportions had to be guessed, or if the photo angle/lighting makes counting shelves/doors/drawers unreliable' },
    notes: { type: 'string', description: 'Plain-English caveats: what could not be determined from the photo (exact joinery, precise dimensions, hidden interior structure), and what the user should verify before cutting any material' },
  },
  required: ['item_type', 'estimated_width_in', 'estimated_height_in', 'estimated_depth_in', 'shelf_count', 'door_count', 'drawer_count', 'construction_style', 'material_guess', 'confidence', 'notes'],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Not signed in.' }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: sub } = await supabaseAdmin
      .from('my_current_subscription')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();
    const entitled = !!sub && sub.plan === 'premier' && ['active', 'on_trial', 'past_due'].includes(sub.status);
    if (!entitled) {
      return json({ error: '"Import from Photo" is a Premier feature.' }, 403);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('furniture_lookups').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since);
    if ((count ?? 0) >= INCLUDED_DAILY_LOOKUPS) {
      return json({ error: `Daily limit reached (${INCLUDED_DAILY_LOOKUPS} lookups/day) — try again tomorrow.` }, 429);
    }

    const { imageBase64, mediaType, referenceMeasurementIn, referenceDescription } = await req.json();
    if (!imageBase64 || !mediaType) {
      return json({ error: 'No photo received.' }, 400);
    }

    const referenceNote = (typeof referenceMeasurementIn === 'number' && referenceMeasurementIn > 0)
      ? `The user tells you the ${referenceDescription || 'overall width'} of this piece is ${referenceMeasurementIn} inches — use that as your scale reference and derive the other dimensions from it as accurately as you can.`
      : 'No reference measurement was supplied — estimate dimensions from typical proportions for this type of furniture, and reflect that uncertainty honestly in confidence and notes.';

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
          effort: 'medium',
          format: { type: 'json_schema', schema: FURNITURE_SCHEMA },
        },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: `This photo shows a piece of furniture (cabinet, bookcase, dresser, or similar case-goods piece) that a home woodworker wants to build a similar version of. Draft a rough starting build spec: item type, estimated overall dimensions, shelf/door/drawer count, likely construction style, and a material guess. ${referenceNote} Be honest about what you can't determine from a single photo — you cannot see hidden joinery (dado vs. rabbet, pocket screws vs. mortise-tenon) from outside an assembled piece, so describe construction style in general terms rather than claiming exact joint types, and say so in your notes. This is a starting draft the user will review and adjust, not a claimed exact reconstruction — set confidence accordingly and never overstate certainty.`,
            },
          ],
        }],
      }),
    });

    if (!claudeResp.ok) {
      const errBody = await claudeResp.text();
      console.error('Claude API error', claudeResp.status, errBody);
      return json({ error: 'Could not analyze that photo right now — try again in a moment.' }, 502);
    }

    const claudeData = await claudeResp.json();
    if (claudeData.stop_reason === 'refusal') {
      return json({ error: 'Could not draft a spec from this photo.' }, 200);
    }

    const textBlock = (claudeData.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!textBlock) {
      return json({ error: 'No draft returned — try a clearer photo showing the whole piece.' }, 200);
    }

    let draft;
    try {
      draft = JSON.parse(textBlock.text);
    } catch {
      return json({ error: 'Could not parse the draft — try again.' }, 502);
    }

    const { error: insertError } = await supabaseAdmin.from('furniture_lookups').insert({
      user_id: user.id,
      item_type: draft.item_type,
      estimated_width_in: draft.estimated_width_in,
      estimated_height_in: draft.estimated_height_in,
      estimated_depth_in: draft.estimated_depth_in,
      shelf_count: draft.shelf_count,
      door_count: draft.door_count,
      drawer_count: draft.drawer_count,
      construction_style: draft.construction_style,
      material_guess: draft.material_guess,
      confidence: draft.confidence,
      notes: draft.notes,
    });
    if (insertError) console.error('furniture_lookups insert failed', insertError);

    return json(draft, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});
