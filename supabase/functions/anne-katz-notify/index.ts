import { EMAIL_TEMPLATE } from './email-template.ts';
const BROWSER_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const TABLE = 'anne_katz_mealtrain_signups';
const headers = {
  'Access-Control-Allow-Origin': 'https://esemmelman.github.io',
  'Access-Control-Allow-Headers': 'apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store'
};
function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function serverKey(env) {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    const key = Object.values(keys).find(value => typeof value === 'string');
    if (key) return key;
  } catch {}
  return env('SUPABASE_SERVICE_ROLE_KEY') || '';
}
export function emailText(row) {
  const labels = {
    '2026-10-10': 'Sat. Oct. 10th',
    '2026-10-14': 'Wed. Oct. 14th',
    '2026-10-18': 'Sat. Oct. 18th',
    '2026-10-22': 'Wed. Oct. 22nd'
  };
  return EMAIL_TEMPLATE.replace('<signup-dates>', row.signup_dates.map(date => labels[date] || date).join(', '));
}
export async function handle(request, env = name => Deno.env.get(name), fetcher = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  // Public form has no login; validate the project publishable API key.
  if (request.headers.get('apikey') !== BROWSER_KEY) return reply({ error: 'Invalid API key.' }, 401);
  let input;
  try { input = await request.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input?.signup_id || '')) {
    return reply({ error: 'A valid signup ID is required.' }, 400);
  }
  const key = serverKey(env);
  const url = env('SUPABASE_URL');
  if (!key || !url) return reply({ error: 'Server database access is not configured.' }, 503);
  const databaseHeaders = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    const recordUrl = url + '/rest/v1/' + TABLE + '?id=eq.' + input.signup_id;
    const recordResponse = await fetcher(recordUrl + '&select=*', { headers: databaseHeaders });
    if (!recordResponse.ok) throw new Error('Cannot read signup.');
    const rows = await recordResponse.json();
    if (!rows.length) return reply({ error: 'Signup not found.' }, 404);
    const row = rows[0];
    if (row.email_notified_at) return reply({ emailed: true });
    // Read saved answers on the server; the browser cannot change the recipient or subject.
    const response = await fetcher('https://ynfjfanvdvpyycoeweca.supabase.co/functions/v1/anne-katz-email-relay', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_j7q6Ox0GVsUv68D3oQiOBA_2Avx50il', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, text: emailText(row), reply_to: row.email })
    });
    if (!response.ok) return reply({ error: 'The email provider did not accept the notification.' }, 502);
    const sent = await response.json();
    if (!Array.isArray(sent.ids) || sent.ids.length !== 2 || sent.ids.some(id => !id)) return reply({ error: 'The email provider did not confirm both emails.' }, 502);
    const marked = await fetcher(recordUrl, {
      method: 'PATCH', headers: { ...databaseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ email_notified_at: new Date().toISOString() })
    });
    if (!marked.ok) console.error('Anne notification sent; status update failed.');
    return reply({ emailed: true });
  } catch {
    return reply({ error: 'Could not send the email notification.' }, 502);
  }
}
if (import.meta.main) Deno.serve(request => handle(request));

