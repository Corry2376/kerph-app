// Posts newly-published Kerph content to Facebook and Instagram. Not called directly by any
// page — it fires from a Supabase Database Webhook on INSERT of the `social_posts` table (see
// setup steps delivered alongside this file). The webhook payload format below is Supabase's
// standard shape for that feature: { type, table, record }.
//
// Uses the service-role key (auto-injected, not a secret you set) since this runs server-to-
// server from the webhook, never called by a browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FACEBOOK_PAGE_ACCESS_TOKEN = Deno.env.get('FACEBOOK_PAGE_ACCESS_TOKEN')!;
const FACEBOOK_PAGE_ID = Deno.env.get('FACEBOOK_PAGE_ID')!;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = Deno.env.get('INSTAGRAM_BUSINESS_ACCOUNT_ID')!;
const GRAPH_API = 'https://graph.facebook.com/v19.0';

async function postToFacebook(record: any) {
  const message = record.excerpt ? `${record.title}\n\n${record.excerpt}` : record.title;
  const resp = await fetch(`${GRAPH_API}/${FACEBOOK_PAGE_ID}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      link: record.url,
      access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
    }),
  });
  const body = await resp.json();
  if (!resp.ok) return { id: null, error: body?.error?.message || 'Facebook post failed.' };
  return { id: body.id as string, error: null };
}

// Instagram's API requires an image — there is no text/link-only post type — so this is
// skipped entirely (not an error) when the content has no cover image.
async function postToInstagram(record: any) {
  if (!record.image_url) return { id: null, error: null };

  const caption = record.excerpt ? `${record.title}\n\n${record.excerpt}\n\n${record.url}` : `${record.title}\n\n${record.url}`;
  const createResp = await fetch(`${GRAPH_API}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: record.image_url,
      caption,
      access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
    }),
  });
  const createBody = await createResp.json();
  if (!createResp.ok || !createBody.id) return { id: null, error: createBody?.error?.message || 'Instagram media creation failed.' };

  const publishResp = await fetch(`${GRAPH_API}/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: createBody.id,
      access_token: FACEBOOK_PAGE_ACCESS_TOKEN,
    }),
  });
  const publishBody = await publishResp.json();
  if (!publishResp.ok || !publishBody.id) return { id: null, error: publishBody?.error?.message || 'Instagram publish failed.' };
  return { id: publishBody.id as string, error: null };
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record || payload.table !== 'social_posts') return new Response('ignored', { status: 200 });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [facebook, instagram] = await Promise.all([
      postToFacebook(record).catch((e) => ({ id: null, error: e instanceof Error ? e.message : 'Facebook post failed.' })),
      postToInstagram(record).catch((e) => ({ id: null, error: e instanceof Error ? e.message : 'Instagram post failed.' })),
    ]);

    // A row counts as posted as long as at least one platform succeeded (or Instagram was
    // cleanly skipped for lack of an image) — a Facebook failure alongside a working
    // Instagram post shouldn't read as a total failure, and vice versa.
    const status = (facebook.error && instagram.error) ? 'failed' : 'posted';

    await supabaseAdmin.from('social_posts').update({
      status,
      facebook_post_id: facebook.id,
      facebook_error: facebook.error,
      instagram_post_id: instagram.id,
      instagram_error: instagram.error,
      posted_at: new Date().toISOString(),
    }).eq('id', record.id);

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
