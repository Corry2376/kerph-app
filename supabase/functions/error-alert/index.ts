// Emails an alert when new JavaScript errors appear, or when error volume spikes.
//
// client_errors has been collecting since 2026-08-05 and admin.html displays it, but the
// whole system was passive: an error affecting every Safari visitor would sit in the table
// indefinitely, indistinguishable from an old one, until someone happened to open the
// dashboard. This closes that.
//
// Runs hourly from pg_cron -- same pattern as free-tier-nurture (see sql/error-alerting.sql).
//
// MUST be deployed with --no-verify-jwt:
//     supabase functions deploy error-alert --no-verify-jwt
// The caller is a pg_cron -> pg_net HTTP POST with no Authorization header, exactly like
// free-tier-nurture. Deploy it with JWT verification on and every hourly run is rejected with
// a 401 before this code executes -- meaning the alerting system fails silently, which is the
// single worst way for an alerting system to fail.
//
// Deliberately stateless: rather than keeping a table of "already alerted" signatures, a NEW
// error is defined as one whose EARLIEST occurrence in client_errors falls inside the window.
// Nothing to keep in sync, nothing to get stuck, and re-running it is harmless.
//
// Sends nothing at all when there is nothing to report. An alert that arrives every hour
// saying "all fine" is an alert you stop reading, and then you miss the real one.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FROM_ADDRESS = 'Kerph Alerts <support@kerphplans.com>';
// Where alerts go. Set ALERT_EMAIL_TO in the function's secrets to change it.
const ALERT_TO = Deno.env.get('ALERT_EMAIL_TO') ?? 'support@kerphplans.com';

// How far back one run looks. Matches the hourly schedule, with a little overlap so an
// error landing exactly on the boundary is not missed.
const WINDOW_MINUTES = 70;
// A spike alert fires when the window's error count exceeds both of these: the absolute
// floor stops a quiet shop generating noise from two errors, and the multiplier catches a
// genuine surge relative to normal.
const SPIKE_FLOOR = 25;
const SPIKE_MULTIPLIER = 3;

type ErrorRow = {
  message: string;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
};

async function sb(path: string): Promise<any[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!resp.ok) throw new Error(`Supabase query failed (${resp.status}): ${await resp.text()}`);
  return await resp.json();
}

// Collapses the varying parts of a message so the same bug reported a hundred times with
// different ids, numbers or urls in the text groups as one signature instead of a hundred.
function signature(message: string): string {
  return message
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\d+/g, '<n>')
    .trim()
    .slice(0, 300);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async () => {
  try {
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MINUTES * 60 * 1000).toISOString();
    const dayStart = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const recent = (await sb(
      `client_errors?select=message,page_url,user_agent,created_at&created_at=gte.${windowStart}&order=created_at.desc&limit=1000`,
    )) as ErrorRow[];

    if (!recent.length) {
      return new Response(JSON.stringify({ ok: true, alerted: false, reason: 'no errors in window' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Everything older than the window, used only to decide which signatures are genuinely new.
    const older = (await sb(
      `client_errors?select=message&created_at=lt.${windowStart}&limit=5000`,
    )) as { message: string }[];
    const knownSignatures = new Set(older.map((r) => signature(r.message)));

    // Group this window's errors by signature.
    const groups = new Map<string, { count: number; sample: ErrorRow }>();
    for (const row of recent) {
      const sig = signature(row.message);
      const g = groups.get(sig);
      if (g) g.count++;
      else groups.set(sig, { count: 1, sample: row });
    }

    const newOnes = [...groups.entries()].filter(([sig]) => !knownSignatures.has(sig));

    // Volume check against the preceding 24 hours, excluding this window.
    const dayRows = (await sb(
      `client_errors?select=created_at&created_at=gte.${dayStart}&created_at=lt.${windowStart}&limit=10000`,
    )) as { created_at: string }[];
    const hourlyAverage = dayRows.length / 23;
    const isSpike = recent.length >= SPIKE_FLOOR && recent.length > hourlyAverage * SPIKE_MULTIPLIER;

    if (!newOnes.length && !isSpike) {
      return new Response(
        JSON.stringify({ ok: true, alerted: false, reason: 'nothing new, no spike', windowCount: recent.length }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    const parts: string[] = [];
    parts.push(`<p style="font:15px system-ui;color:#0f172a">`);
    parts.push(`<strong>${recent.length}</strong> error${recent.length === 1 ? '' : 's'} in the last ${WINDOW_MINUTES} minutes.`);
    if (isSpike) {
      parts.push(` That is well above the recent average of about <strong>${hourlyAverage.toFixed(1)}/hour</strong>.`);
    }
    parts.push(`</p>`);

    if (newOnes.length) {
      parts.push(`<h3 style="font:600 15px system-ui;color:#b23b3b;margin:18px 0 6px">New error${newOnes.length === 1 ? '' : 's'} not seen before (${newOnes.length})</h3>`);
      for (const [, g] of newOnes.slice(0, 15)) {
        parts.push(
          `<div style="font:13px system-ui;border-left:3px solid #b23b3b;padding:6px 10px;margin-bottom:8px;background:#faf7f7">` +
            `<div style="font-weight:600">${esc(g.sample.message.slice(0, 300))}</div>` +
            `<div style="color:#64748b;margin-top:3px">${g.count}&times; &middot; ${esc(g.sample.page_url ?? 'unknown page')}</div>` +
            `<div style="color:#94a3b8;margin-top:2px">${esc((g.sample.user_agent ?? '').slice(0, 140))}</div>` +
          `</div>`,
        );
      }
      if (newOnes.length > 15) parts.push(`<p style="font:13px system-ui;color:#64748b">and ${newOnes.length - 15} more.</p>`);
    }

    parts.push(
      `<p style="font:13px system-ui;color:#64748b;margin-top:20px">` +
        `Full detail is in the admin dashboard under Client Errors. ` +
        `This alert only fires for errors never seen before, or for a genuine volume spike &mdash; ` +
        `no message means nothing new happened.</p>`,
    );

    const subject = newOnes.length
      ? `Kerph: ${newOnes.length} new error type${newOnes.length === 1 ? '' : 's'}`
      : `Kerph: error volume spike (${recent.length} in the last hour)`;

    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [ALERT_TO], subject, html: parts.join('') }),
    });

    if (!mail.ok) throw new Error(`Resend failed (${mail.status}): ${await mail.text()}`);

    return new Response(
      JSON.stringify({ ok: true, alerted: true, newSignatures: newOnes.length, windowCount: recent.length, spike: isSpike }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Returns 500 so a failure is visible in the function logs rather than silently doing
    // nothing -- an alerting system that fails quietly is worse than none.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
