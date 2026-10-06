'use strict';
const API_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co/rest/v1/anne_katz_mealtrain_signups';
const NOTIFY_URL = 'https://fgomaujsdblpzxhnnqrg.supabase.co/functions/v1/anne-katz-notify';
// Publishable browser key; never use a server secret here.
const API_KEY = 'sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i';
const form = document.getElementById('signup');
const dates = Array.from(form.querySelectorAll('input[name="date"]'));
const nameInput = document.getElementById('full-name');
const phoneInput = document.getElementById('phone');
const status = document.getElementById('status');
const closeButton = document.getElementById('close-page');
const loadStatus = document.getElementById('load-status');
let savedSignups = [];
let busy = false;
let submitted = false;
const submitButton = form.querySelector('button[type="submit"]');
let refreshBusy = false;
let submissionId = crypto.randomUUID();
function validate() {
  const availableDates = dates.filter(input => !input.disabled);
  nameInput.setCustomValidity(!nameInput.value.trim() ? 'Please enter your name.' : !busy && !availableDates.length ? 'All meal dates are already filled.' : '');
  dates.forEach(input => input.setCustomValidity(''));
  if (availableDates.length) availableDates[0].setCustomValidity(availableDates.some(input => input.checked) ? '' : 'Please select at least one date.');
  phoneInput.setCustomValidity(phoneInput.value.replace(/\D/g, '').length >= 10 ? '' : 'Please include your area code and phone number.');
}
function renderNames() {
  document.querySelectorAll('.name-line').forEach(line => {
    const names = savedSignups.filter(row => row.signup_dates.includes(line.dataset.date)).map(row => row.full_name);
    const checkbox = dates.find(input => input.value === line.dataset.date);
    const reserved = checkbox.dataset.reserved === 'true';
    const filled = reserved || names.length > 0;
    checkbox.disabled = busy || filled;
    if (filled) checkbox.checked = false;
    checkbox.closest('.date-row').classList.toggle('filled', filled);
    checkbox.title = reserved ? 'CCC (committee member handling)' : filled ? 'This date already has a meal signup.' : '';
    line.replaceChildren(document.createTextNode(reserved ? 'CCC (committee member handling)' : names.join(', ')));
    if (checkbox.checked && nameInput.value.trim()) {
      const pending = document.createElement('span');
      pending.className = 'pending-name';
      pending.textContent = (names.length ? ', ' : '') + nameInput.value.trim();
      line.append(pending);
    }
  });
  validate();
}
async function refreshNames() {
  if (refreshBusy) return;
  refreshBusy = true;
  try {
    const response = await fetch(API_URL + '?select=full_name,signup_dates', { headers: { apikey: API_KEY }, cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot load names.');
    savedSignups = await response.json();
    renderNames();
    loadStatus.textContent = '';
  } catch {
    loadStatus.textContent = 'Saved names could not be refreshed. We will try again shortly.';
  } finally { refreshBusy = false; }
}
form.addEventListener('input', () => { validate(); renderNames(); });
form.addEventListener('change', () => { validate(); renderNames(); });
form.addEventListener('reset', event => {
  if (busy) { event.preventDefault(); return; }
  submitted = false;
  submitButton.disabled = false;
  submissionId = crypto.randomUUID();
  status.textContent = '';
  closeButton.hidden = true;
  setTimeout(() => { validate(); renderNames(); }, 0);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  validate();
  if (busy || submitted || !form.reportValidity()) return;
  const data = new FormData(form);
  const payload = { id: submissionId, full_name: data.get('full_name').trim(), meal_type: data.get('meal_type'), signup_dates: data.getAll('date'), email: data.get('email').trim(), phone: data.get('phone').trim(), comment: data.get('comment').trim() };
  busy = true;
  const controls = Array.from(form.elements);
  controls.forEach(control => { control.disabled = true; });
  status.textContent = 'Email sent to ' + payload.email + '.';
  closeButton.hidden = false;
  closeButton.disabled = false;
  document.querySelector('main').classList.add('confirmation');
  let success = false;
  let emailSent = false;
  try {
    const response = await fetch(API_URL, { method: 'POST', keepalive: true, headers: { apikey: API_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(payload) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Retrying a request after a lost response must not create a duplicate.
      if (error.code !== '23505') throw new Error('Submission failed.');
    }
    success = true;
    // Email failure must not discard a signup that is already saved.
    try {
      const notification = await fetch(NOTIFY_URL, {
        method: 'POST', keepalive: true,
        headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signup_id: payload.id })
      });
      emailSent = notification.ok && (await notification.json()).emailed === true;
    } catch { /* Report the saved signup separately from email status below. */ }
  } catch {
    document.querySelector('main').classList.remove('confirmation');
    closeButton.hidden = true;
    status.textContent = 'We could not save your signup. Your entries are still here; please try Submit again.';
  } finally {
    busy = false;
    controls.forEach(control => { control.disabled = false; });
    renderNames();
  }
  if (success) {
    form.reset();
    submitted = true;
    submitButton.disabled = true;
    status.textContent = emailSent
      ? 'Email sent to ' + payload.email + '.'
      : 'Your meal signup has been saved, but we could not confirm all emails were sent. Please let the organizer know; you do not need to sign up again.';
    closeButton.hidden = false;
    await refreshNames();
  }
});
closeButton.addEventListener('click', () => {
  window.location.assign('thank-you.html');
});
validate();
refreshNames();
setInterval(() => { if (!document.hidden && !busy) refreshNames(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNames(); });
