import { emailHtml } from './email-template.ts';
const SENDER = 'esemmoc@gmail.com';

function base64(text) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

export function gmailMessage(recipient, replyTo, text, signupId, role) {
  // Addresses go into MIME headers: reject newlines and other header syntax.
  for (const address of [recipient, replyTo]) {
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(address)) {
      throw new Error('Invalid email address.');
    }
  }
  const mime = [
    'From: Meal Train <' + SENDER + '>',
    'To: ' + recipient,
    'Reply-To: ' + replyTo,
    'Subject: Anne',
    'Message-ID: <anne-' + signupId + '-' + role + '@gmail.com>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="anne-confirmation"',
    '',
    '--anne-confirmation',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64(text).match(/.{1,76}/g)?.join('\r\n') || '',
    '--anne-confirmation',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64(emailHtml(text)).match(/.{1,76}/g)?.join('\r\n') || '',
    '--anne-confirmation--'
  ].join('\r\n');
  return base64(mime).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function gmailToken(env, fetcher) {
  const clientId = env('GMAIL_CLIENT_ID');
  const clientSecret = env('GMAIL_CLIENT_SECRET');
  const refreshToken = env('GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Gmail authorization is not configured.');
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    console.error('Anne Gmail authorization failed:', response.status, result.error || 'missing_token');
    throw new Error('Gmail authorization failed.');
  }
  return result.access_token;
}

export async function sendGmail(token, recipient, replyTo, text, signupId, role, fetcher) {
  const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: gmailMessage(recipient, replyTo, text, signupId, role) }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.id) {
    // Never log recipients, message bodies, or credentials.
    console.error('Anne Gmail send failed:', role, response.status, result.error?.status || 'missing_id');
    throw new Error('Gmail did not accept the ' + role + ' email.');
  }
  return result.id;
}
