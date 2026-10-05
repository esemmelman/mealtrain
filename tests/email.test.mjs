import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { handle, emailText } from '../supabase/functions/anne-katz-notify/index.ts';
import { gmailMessage } from '../supabase/functions/anne-katz-notify/gmail.ts';

const id = '66961555-e184-4f1f-b0f7-27c0d77593b2';
const key = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const row = { id, full_name: 'Test Person', meal_type: 'homecooked', signup_dates: ['2026-10-10','2026-10-21'], email: 'test@example.com', phone: '555-555-0100', comment: 'Test comment' };
const env = name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-test-key' })[name];
const request = () => new Request('https://example.com', {method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({signup_id:id})});
const gmailEnv = name => ({ ANNE_EMAIL_PROVIDER: 'gmail', GMAIL_CLIENT_ID: 'test-client', GMAIL_CLIENT_SECRET: 'test-secret', GMAIL_REFRESH_TOKEN: 'test-refresh' })[name] || env(name);

function gmailMock(savedRow = row, failedRole = '', claimed = true) {
  const sent = [];
  const updates = [];
  return { sent, updates, fetcher: async (url, options) => {
    if (url.includes('anne_katz_email_settings')) return Response.json([]);
    if (url.includes('&select=*')) return Response.json([savedRow]);
    if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'test-access' });
    if (url.includes('&or=')) return Response.json(claimed ? [savedRow] : []);
    if (url.includes('gmail.googleapis.com')) {
      const mime = Buffer.from(JSON.parse(options.body).raw, 'base64url').toString('utf8');
      const role = /^To: esemmoc@gmail.com\r?$/m.test(mime) ? 'organizer' : 'participant';
      sent.push({ mime, role });
      return role === failedRole ? Response.json({ error: { status: 'PERMISSION_DENIED' } }, { status: 403 }) : Response.json({ id: role + '-gmail-id' });
    }
    updates.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  } };
}

test('Gmail MIME preserves UTF-8 text and rejects header injection', () => {
  const text = 'Thank YOU! Café — Anne';
  const mime = Buffer.from(gmailMessage(row.email, 'esemmoc@gmail.com', text, id, 'participant'), 'base64url').toString('utf8');
  assert.ok(mime.includes('From: Meal Train <esemmoc@gmail.com>\r\n'));
  assert.ok(mime.includes('Subject: Anne\r\n'));
  assert.equal(Buffer.from(mime.split('\r\n\r\n')[1], 'base64').toString('utf8'), text);
  assert.throws(() => gmailMessage('test@example.com\r\nBcc: other@example.com', 'esemmoc@gmail.com', text, id, 'participant'));
});

test('Gmail sends separate confirmations and records each acceptance', async () => {
  const mock = gmailMock();
  assert.equal((await handle(request(), gmailEnv, mock.fetcher)).status, 200);
  assert.deepEqual(mock.sent.map(send => send.role), ['organizer', 'participant']);
  assert.ok(mock.sent[0].mime.includes('Reply-To: ' + row.email + '\r\n'));
  assert.ok(mock.sent[1].mime.includes('Reply-To: esemmoc@gmail.com\r\n'));
  assert.deepEqual(mock.updates.slice(0, 2), [{ gmail_organizer_id: 'organizer-gmail-id' }, { gmail_participant_id: 'participant-gmail-id' }]);
  assert.ok(mock.updates[2].email_notified_at);
  assert.deepEqual(mock.updates.at(-1), { email_send_started_at: null });
});

test('Gmail retry skips organizer already accepted and sends participant', async () => {
  const mock = gmailMock({ ...row, gmail_organizer_id: 'existing-id' });
  assert.equal((await handle(request(), gmailEnv, mock.fetcher)).status, 200);
  assert.deepEqual(mock.sent.map(send => send.role), ['participant']);
});

test('Gmail still attempts participant after organizer failure', async () => {
  const mock = gmailMock(row, 'organizer');
  assert.equal((await handle(request(), gmailEnv, mock.fetcher)).status, 502);
  assert.deepEqual(mock.sent.map(send => send.role), ['organizer', 'participant']);
  assert.ok(mock.updates.some(update => update.gmail_participant_id));
  assert.ok(!mock.updates.some(update => update.email_notified_at));
  assert.deepEqual(mock.updates.at(-1), { email_send_started_at: null });
});

test('Gmail preserves organizer acceptance when participant fails', async () => {
  const mock = gmailMock(row, 'participant');
  assert.equal((await handle(request(), gmailEnv, mock.fetcher)).status, 502);
  assert.ok(mock.updates.some(update => update.gmail_organizer_id));
  assert.ok(!mock.updates.some(update => update.gmail_participant_id || update.email_notified_at));
});

test('Gmail overlapping request does not send while lease is held', async () => {
  const mock = gmailMock(row, '', false);
  assert.equal((await handle(request(), gmailEnv, mock.fetcher)).status, 409);
  assert.equal(mock.sent.length, 0);
});

test('Gmail authorization failure does not send or mark the signup', async () => {
  const calls = [];
  const response = await handle(request(), gmailEnv, async url => {
    if (url.includes('anne_katz_email_settings')) return Response.json([]);
    calls.push(url);
    return url.includes('&select=*') ? Response.json([row]) : Response.json({ error: 'invalid_grant' }, { status: 400 });
  });
  assert.equal(response.status, 502);
  assert.equal(calls.length, 2);
});

test('uses document confirmation wording and only selected dates', () => {
  const text = emailText(row);
  for (const answer of ['Thank YOU for being part','Sat. Oct. 10th, Wed. Oct. 21st','approx. 5 p.m.','CONTACT INFORMATION','TYPES OF MEALS','sharethecaring@templebethdavid.org']) assert.ok(text.includes(answer));
  for (const excluded of ['<signup-dates>', 'Tues. Oct. 13th', 'Sat. Oct. 17th', 'My Name:', 'Test comment']) assert.ok(!text.includes(excluded));
});
test('reads saved answers, relays them, and records success', async () => {
  const calls = [];
  const response = await handle(request(), env, async (url,options) => {
    if (url.includes('anne_katz_email_settings')) return Response.json([]);
    calls.push({url,options});
    if (url.includes('&select=*')) return Response.json([row]);
    if (url.includes('email-relay')) return Response.json({ids:['organizer-email-id','participant-email-id']});
    return new Response(null,{status:204});
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).emailed,true);
  assert.equal(calls.length,3);
  assert.equal(JSON.parse(calls[1].options.body).text,emailText(row));
  assert.ok(JSON.parse(calls[2].options.body).email_notified_at);
});
test('does not resend a notification already marked sent', async () => {
  let calls = 0;
  const response = await handle(request(),env,async () => { calls++; return Response.json([{...row,email_notified_at:'2026-10-05T00:00:00Z'}]); });
  assert.equal(response.status,200);
  assert.equal(calls,1);
});
test('email failure leaves the signup unchanged and reports failure', async () => {
  let calls = 0;
  const response = await handle(request(),env,async url => { if (url.includes('anne_katz_email_settings')) return Response.json([]); calls++; return calls === 1 ? Response.json([row]) : Response.json({error:'provider failure'},{status:502}); });
  assert.equal(response.status,502);
  assert.equal(calls,2);
});
test('rejects invalid API keys and signup IDs', async () => {
  assert.equal((await handle(new Request('https://example.com',{method:'POST'}),env)).status,401);
  assert.equal((await handle(new Request('https://example.com',{method:'POST',headers:{apikey:key},body:JSON.stringify({signup_id:'bad'})}),env)).status,400);
});
test('DayFlow relay sends separate organizer and participant emails', async () => {
  let handler;
  const sent = [];
  const context = vm.createContext({Response,console,Deno:{env:{get:name=>({RESEND_API_KEY:'fake-resend-key',REMINDER_EMAIL_FROM:'DayFlow <sender@example.com>'})[name]},serve:fn=>{handler=fn;}},fetch:async (_url,options)=>{sent.push(options);return Response.json({id:'mail-id-'+sent.length});}});
  vm.runInContext(await readFile(new URL('../supabase/functions/anne-katz-email-relay/index.ts',import.meta.url),'utf8'),context);
  const response = await handler(new Request('https://example.com',{method:'POST',headers:{apikey:'sb_publishable_j7q6Ox0GVsUv68D3oQiOBA_2Avx50il'},body:JSON.stringify({id,text:emailText(row),reply_to:row.email,to:'someone-else@example.com',subject:'Ignore'})}));
  assert.equal(response.status,200);
  assert.equal(sent.length,2);
  const emails = sent.map(request => JSON.parse(request.body));
  assert.deepEqual(emails[0].to,['esemmoc@gmail.com']);
  assert.deepEqual(emails[1].to,[row.email]);
  for (const email of emails) {
    assert.equal(email.subject,'Anne');
    assert.equal(email.from,'Meal Train <sender@example.com>');
    assert.equal(email.text,emailText(row));
  }
  assert.equal(sent[0].headers['Idempotency-Key'],'anne-katz-confirmation/'+id+'/organizer');
  assert.equal(sent[1].headers['Idempotency-Key'],'anne-katz-confirmation/'+id+'/participant');
});
