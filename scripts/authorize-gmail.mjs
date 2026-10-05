// Run locally: node scripts/authorize-gmail.mjs path/to/gmail-client.json
// Credentials are written only to an ignored local file, never printed.
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const clientFile = process.argv[2];
if (!clientFile) throw new Error('Provide the downloaded Google Desktop app OAuth client JSON file.');
const { installed: client } = JSON.parse(await readFile(clientFile, 'utf8'));
if (!client?.client_id || !client?.client_secret) throw new Error('A Google Desktop app OAuth client is required.');
const state = randomBytes(32).toString('hex');
const redirectUri = 'http://127.0.0.1:8765';
const outputFile = new URL('../.env.gmail', import.meta.url);
const server = createServer(async (request, response) => {
  const url = new URL(request.url, redirectUri);
  if (url.pathname !== '/') { response.writeHead(404).end(); return; }
  const suppliedState = Buffer.from(url.searchParams.get('state') || '');
  const expectedState = Buffer.from(state);
  if (suppliedState.length !== expectedState.length || !timingSafeEqual(suppliedState, expectedState)) {
    response.writeHead(400).end('Invalid authorization state.'); return;
  }
  try {
    if (!url.searchParams.get('code')) throw new Error('Authorization was declined.');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, code: url.searchParams.get('code'), redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(15000)
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.refresh_token || !token.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.send')) {
      throw new Error('Google did not provide persistent Gmail send authorization.');
    }
    const values = { GMAIL_CLIENT_ID: client.client_id, GMAIL_CLIENT_SECRET: client.client_secret, GMAIL_REFRESH_TOKEN: token.refresh_token };
    if (Object.values(values).some(value => /[\r\n]/.test(value))) throw new Error('Invalid credential format.');
    await writeFile(outputFile, Object.entries(values).map(([name, value]) => name + '=' + value).join('\n') + '\n', { mode: 0o600 });
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Gmail authorization saved locally. You can close this tab.');
    console.log('Authorization saved to .env.gmail. Upload those three values to the bnaimitzvah Edge Function secrets. Do not paste them into chat.');
    clearTimeout(timeout);
    server.close();
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end('Authorization failed. Check the terminal for the next step.');
    console.error(error.message);
    clearTimeout(timeout);
    server.close();
    process.exitCode = 1;
  }
});
const timeout = setTimeout(() => { console.error('Authorization timed out; run the command again.'); server.close(); process.exitCode = 1; }, 600000);
server.on('error', error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
server.listen(8765, '127.0.0.1', () => {
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.send', access_type: 'offline', prompt: 'consent', state, login_hint: 'esemmoc@gmail.com' }).toString();
  console.log('Open this URL and sign in as esemmoc@gmail.com:\n' + authorization);
});
