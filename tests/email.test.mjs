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

test('includes every answer and both selected dates', () => {
  const text = emailText(row);
  for (const answer of ['Test Person','homecooked meal','Sat. Oct. 10th','Wed. Oct. 22nd','test@example.com','555-555-0100','Test comment']) assert.ok(text.includes(answer));
});
test('reads saved answers, relays them, and records success', async () => {
  const calls = [];
  const response = await handle(request(), env, async (url,options) => {
    calls.push({url,options});
    if (url.includes('&select=*')) return Response.json([row]);
    if (url.includes('email-relay')) return Response.json({id:'provider-email-id'});
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
test('DayFlow relay fixes recipient and subject and reuses existing secrets', async () => {
  let handler, sent;
  const context = vm.createContext({Response,console,Deno:{env:{get:name=>({RESEND_API_KEY:'fake-resend-key',REMINDER_EMAIL_FROM:'DayFlow <sender@example.com>'})[name]},serve:fn=>{handler=fn;}},fetch:async (_url,options)=>{sent=options;return Response.json({id:'mail-id'});}});
  vm.runInContext(await readFile(new URL('../supabase/functions/anne-katz-email-relay/index.ts',import.meta.url),'utf8'),context);
  const response = await handler(new Request('https://example.com',{method:'POST',headers:{apikey:'sb_publishable_j7q6Ox0GVsUv68D3oQiOBA_2Avx50il'},body:JSON.stringify({id,text:emailText(row),reply_to:row.email,to:'someone-else@example.com',subject:'Ignore'})}));
  assert.equal(response.status,200);
  const email = JSON.parse(sent.body);
  assert.deepEqual(email.to,['esemmoc@gmail.com']);
  assert.equal(email.subject,'Anne');
  assert.equal(email.from,'DayFlow <sender@example.com>');
  assert.equal(sent.headers['Idempotency-Key'],'anne-katz-signup/'+id);
});
