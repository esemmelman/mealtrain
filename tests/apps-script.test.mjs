import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { handle } from '../supabase/functions/anne-katz-notify/index.ts';

const id = '66961555-e184-4f1f-b0f7-27c0d77593b2';
const token = 'test-private-token';
const source = (await readFile(new URL('../apps-script/Code.gs', import.meta.url), 'utf8')).replace("const MEAL_TRAIN_TOKEN = '__PRIVATE_TOKEN__';", 'const MEAL_TRAIN_TOKEN = ' + JSON.stringify(token) + ';');
function scriptMock(fail = false) {
  const sent = [], ledger = new Map();
  let released = 0;
  const context = vm.createContext({ console,
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => text }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ledger.get(key), setProperty: (key, value) => ledger.set(key, value) }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: mail => { if (fail) throw new Error('Test failure'); sent.push(mail); } }
  });
  vm.runInContext(source, context);
  return { sent, ledger, released: () => released, invoke: input => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(input) } })) };
}
const notification = { token, id, role: 'participant', email: 'test@example.com', text: 'Thank YOU! Café — Anne' };

test('script refuses a request without its secret', () => {
  const script = scriptMock();
  assert.equal(script.invoke({ ...notification, token: 'wrong' }).error, 'unauthorized');
  assert.equal(script.sent.length, 0);
});
test('script sends to fixed organizer and saved participant with correct content', () => {
  const script = scriptMock();
  assert.equal(script.invoke({ ...notification, role: 'organizer', to: 'attacker@example.com', subject: 'Override' }).ok, true);
  assert.equal(script.invoke(notification).ok, true);
  assert.equal(script.sent[0].to, 'esemmoc@gmail.com');
  assert.equal(script.sent[1].to, notification.email);
  assert.equal(script.sent[0].replyTo, notification.email);
  assert.equal(script.sent[1].replyTo, 'esemmoc@gmail.com');
  for (const mail of script.sent) {
    assert.equal(mail.subject, 'Anne');
    assert.equal(mail.name, 'Meal Train');
    assert.equal(mail.body, notification.text);
  }
});
test('script repeated receipt does not resend', () => {
  const script = scriptMock();
  const first = script.invoke(notification);
  assert.deepEqual(script.invoke(notification), first);
  assert.equal(script.sent.length, 1);
  assert.equal(script.released(), 2);
});
test('script failure does not record acceptance and releases the lock', () => {
  const script = scriptMock(true);
  assert.equal(script.invoke(notification).error, 'send_failed');
  assert.equal(script.ledger.size, 0);
  assert.equal(script.released(), 1);
});
test('script connection check reports quota without sending', () => {
  const script = scriptMock();
  assert.deepEqual(script.invoke({ token, action: 'check' }), { ok: true, quota: 100 });
  assert.equal(script.sent.length, 0);
});
test('script rejects address injection and invalid roles', () => {
  const script = scriptMock();
  assert.equal(script.invoke({ ...notification, email: 'test@example.com\r\nBcc: attacker@example.com' }).error, 'invalid_notification');
  assert.equal(script.invoke({ ...notification, role: 'attacker' }).error, 'invalid_notification');
  assert.equal(script.sent.length, 0);
});
test('backend routes saved signup to configured script and records both receipts', async () => {
  const script = scriptMock();
  const settings = { script_url: 'https://script.google.com/macros/s/test-deployment/exec', token };
  const saved = { id, email: notification.email, signup_dates: ['2026-10-10'] };
  const updates = [];
  const request = new Request('https://example.com', { method: 'POST', headers: { apikey: 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i' }, body: JSON.stringify({ signup_id: id }) });
  const response = await handle(request, name => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-server-key' })[name], async (url, options) => {
    if (url.includes('anne_katz_email_settings')) return Response.json([settings]);
    if (url.includes('&select=*') || url.includes('&or=')) return Response.json([saved]);
    if (url === settings.script_url) return Response.json(script.invoke(JSON.parse(options.body)));
    updates.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  });
  assert.equal(response.status, 200);
  assert.equal(script.sent.length, 2);
  assert.equal(updates[0].gmail_organizer_id, 'anne-' + id + '-organizer');
  assert.equal(updates[1].gmail_participant_id, 'anne-' + id + '-participant');
  assert.ok(updates[2].email_notified_at);
});
