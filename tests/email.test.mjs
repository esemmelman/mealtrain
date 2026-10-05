import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { handle, emailText } from '../supabase/functions/anne-katz-notify/index.ts';

const id = '66961555-e184-4f1f-b0f7-27c0d77593b2';
const key = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const row = { id, full_name: 'Test Person', meal_type: 'homecooked', signup_dates: ['2026-10-10','2026-10-22'], email: 'test@example.com', phone: '555-555-0100', comment: 'Test comment' };
const env = name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-test-key' })[name];
const request = () => new Request('https://example.com', {method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({signup_id:id})});

test('uses document confirmation wording and only selected dates', () => {
  const text = emailText(row);
  for (const answer of ['Thank YOU for being part','Sat. Oct. 10th, Wed. Oct. 22nd','approx. 5 p.m.','CONTACT INFORMATION','TYPES OF MEALS','sharethecaring@templebethdavid.org']) assert.ok(text.includes(answer));
  for (const excluded of ['<signup-dates>', 'Wed. Oct. 14th', 'Sat. Oct. 18th', 'My Name:', 'Test comment']) assert.ok(!text.includes(excluded));
});
test('reads saved answers, relays them, and records success', async () => {
  const calls = [];
  const response = await handle(request(), env, async (url,options) => {
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
  const response = await handle(request(),env,async () => { calls++; return calls === 1 ? Response.json([row]) : Response.json({error:'provider failure'},{status:502}); });
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
