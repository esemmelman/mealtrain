export async function sendAppsScript(settings, row, role, text, fetcher) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(settings.script_url || '') || !settings.token) {
    throw new Error('Apps Script is not configured.');
  }
  const response = await fetcher(settings.script_url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: settings.token, id: row.id, role, email: row.email, text }),
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok || result.ok !== true || result.id !== 'anne-' + row.id + '-' + role) {
    console.error('Anne Apps Script send failed:', role, response.status);
    throw new Error('Apps Script did not confirm acceptance.');
  }
  return result.id;
}
