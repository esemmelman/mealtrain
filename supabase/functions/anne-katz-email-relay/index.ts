const API_KEY = 'sb_publishable_j7q6Ox0GVsUv68D3oQiOBA_2Avx50il';
Deno.serve(async request => {
  const respond = (body, status = 200) => Response.json(body, { status });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  if (request.headers.get('apikey') !== API_KEY) return respond({ error: 'Invalid API key.' }, 401);
  let row;
  try { row = await request.json(); } catch { return respond({ error: 'Invalid request.' }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(row?.id || '') || typeof row?.text !== 'string' || row.text.length > 8000 || typeof row?.reply_to !== 'string' || row.reply_to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.reply_to)) {
    return respond({ error: 'Invalid notification.' }, 400);
  }
  const key = Deno.env.get('RESEND_API_KEY');
  const configuredFrom = Deno.env.get('REMINDER_EMAIL_FROM');
  if (!key || !configuredFrom) return respond({ error: 'DayFlow email sending is not configured.' }, 503);
  const senderAddress = (configuredFrom.match(/<([^<>]+)>/)?.[1] || configuredFrom).trim();
  const from = 'Meal Train <' + senderAddress + '>';
  // Send two separate messages; recipient lists are never shared between emails.
  try {
    const ids = [];
    for (const [role, recipient] of [['organizer', 'esemmoc@gmail.com'], ['participant', row.reply_to]]) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': 'anne-katz-confirmation/' + row.id + '/' + role },
      body: JSON.stringify({ from, to: [recipient], subject: 'Anne', text: row.text, html: emailHtml(row.text), reply_to: role === 'organizer' ? row.reply_to : 'esemmoc@gmail.com' })
    });
    if (!response.ok) {
      console.error('Anne email provider response:', response.status);
      return respond({ error: 'Email provider rejected the notification.' }, 502);
    }
    const sent = await response.json();
    if (!sent.id) return respond({ error: 'Email provider did not confirm acceptance.' }, 502);
    ids.push(sent.id);
    }
    return respond({ ids });
  } catch { return respond({ error: 'Email provider is unavailable.' }, 502); }
});

function emailHtml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<div style="font-family:'Comic Sans MS','Comic Sans',Arial,Helvetica,sans-serif;font-size:14pt;color:#222;line-height:1.4">${escaped.replace(/\r?\n/g, '<br>')}</div>`;
}
