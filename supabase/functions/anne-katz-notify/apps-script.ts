export async function sendAppsScript(settings, row, role, text, fetcher) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(settings.script_url || '') || !settings.token) {
    throw new Error('Apps Script is not configured.');
  }
  // The existing deployed script supports organizer/participant roles. Give the
  // coordinator copy its own stable UUID and participant receipt for safe retries.
  let scriptRow = row;
  let scriptRole = role;
  if (role === 'coordinator') {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('anne-coordinator/' + row.id)));
    const hex = Array.from(digest.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    scriptRow = { ...row, id, email: 'kerigee1@aol.com' };
    scriptRole = 'participant';
  }
  const response = await fetcher(settings.script_url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: settings.token, id: scriptRow.id, role: scriptRole, email: scriptRow.email, text }),
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || result.id !== 'anne-' + scriptRow.id + '-' + scriptRole) {
    console.error('Anne Apps Script send failed:', role, response.status);
    throw new Error('Apps Script did not confirm acceptance.');
  }
  return result.id;
}
