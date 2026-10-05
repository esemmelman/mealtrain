const API_KEY = 'sb_publishable_j7q6Ox0GVsUv68D3oQiOBA_2Avx50il';
Deno.serve(async request => {
  const respond = (body, status = 200) => Response.json(body, { status });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('apikey') !== API_KEY) return respond({ error: 'Invalid API key.' }, 401);
  let row;
  try { row = await request.json(); } catch { return respond({ error: 'Invalid request.' }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(row?.id || '') || typeof row?.text !== 'string' || row.text.length > 8000 || typeof row?.reply_to !== 'string' || row.reply_to.length > 254) {
    return respond({ error: 'Invalid notification.' }, 400);
  }
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('REMINDER_EMAIL_FROM');
  if (!key || !from) return respond({ error: 'DayFlow email sending is not configured.' }, 503);
  // Fixed recipient and subject; this relay cannot send to arbitrary addresses.
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': 'anne-katz-signup/' + row.id },
      body: JSON.stringify({ from, to: ['esemmoc@gmail.com'], subject: 'Anne', text: row.text, reply_to: row.reply_to })
    });
    if (!response.ok) {
      console.error('Anne email provider response:', response.status);
      return respond({ error: 'Email provider rejected the notification.' }, 502);
    }
    const sent = await response.json();
    return respond({ id: sent.id });
  } catch { return respond({ error: 'Email provider is unavailable.' }, 502); }
});
