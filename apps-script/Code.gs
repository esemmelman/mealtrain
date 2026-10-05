// Copy the personalized .local-mailtrain/Code.gs file into Google Apps Script.
// Deploy as a web app: Execute as Me; access Anyone.
const MEAL_TRAIN_TOKEN = '__PRIVATE_TOKEN__';

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return jsonResponse({ service: 'Meal Train email', ready: true });
}

function doPost(event) {
  let input;
  try { input = JSON.parse(event.postData.contents); } catch (_) {
    return jsonResponse({ ok: false, error: 'invalid_request' });
  }
  if (MEAL_TRAIN_TOKEN === '__PRIVATE_TOKEN__' || input.token !== MEAL_TRAIN_TOKEN) {
    return jsonResponse({ ok: false, error: 'unauthorized' });
  }
  if (input.action === 'check') {
    return jsonResponse({ ok: true, quota: MailApp.getRemainingDailyQuota() });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id || '') ||
      !['organizer', 'participant'].includes(input.role) ||
      typeof input.text !== 'string' || input.text.length > 8000 ||
      typeof input.email !== 'string' || input.email.length > 254 ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.email)) {
    return jsonResponse({ ok: false, error: 'invalid_notification' });
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonResponse({ ok: false, error: 'busy' });
  try {
    const properties = PropertiesService.getScriptProperties();
    const receipt = 'anne-' + input.id + '-' + input.role;
    if (properties.getProperty(receipt)) return jsonResponse({ ok: true, id: receipt });
    if (MailApp.getRemainingDailyQuota() < 1) return jsonResponse({ ok: false, error: 'daily_quota' });
    MailApp.sendEmail({
      to: input.role === 'organizer' ? 'esemmoc@gmail.com' : input.email,
      replyTo: input.role === 'organizer' ? input.email : 'esemmoc@gmail.com',
      name: 'Meal Train', subject: 'Anne', body: input.text, htmlBody: emailHtml(input.text)
    });
    properties.setProperty(receipt, new Date().toISOString());
    return jsonResponse({ ok: true, id: receipt });
  } catch (_) {
    console.error('Meal Train send failed: ' + input.role);
    return jsonResponse({ ok: false, error: 'send_failed' });
  } finally { lock.releaseLock(); }
}

function emailHtml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<div style="font-family:'Comic Sans MS','Comic Sans',cursive;font-size:14pt;color:#222;line-height:1.4">${escaped.replace(/\r?\n/g, '<br>')}</div>`;
}
