/* ==========================================================================
   AgriHire - front-end script (loaded on every page, after the HTML)

   1. Helpers            4. Sign-in flow (login, SMS code, role)
   2. Language & size    5. Lists, dashboards and booking pages
   3. Server API         6. Forms, clicks and start-up
   All data lives in MongoDB (see backend/). localStorage only keeps the login
   token and the choices a user makes while moving between pages.
   ========================================================================== */
'use strict';

/* ---------- 1. Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const PAGE = () => document.body.dataset.page || '';

const PUBLIC_PAGES = ['index', 'login', 'register', 'otp', 'forgot'];          // open without logging in
const AUTH_PAGES = ['index', 'login', 'register'];                             // a logged-in user is sent on from these
const SESSION_KEYS = ['token', 'name', 'phone', 'role', 'pendingPhone', 'item', 'itemId', 'itemSub', 'itemType',
  'kind', 'rate', 'team', 'field', 'task', 'date', 'hrs'];

const ROLE_HOME = { farmer: 'farmer-home.html', owner: 'owner-home.html', worker: 'worker-home.html' };
const ROLE_PAGES = {                                                           // pages only that role may open
  farmer: ['farmer-home', 'machines', 'machine-detail', 'workforce', 'worker-detail', 'book-1', 'book-2', 'book-3', 'book-done',
    'bookings', 'fields', 'field-add', 'price-compare', 'dashboard', 'weather'],
  owner: ['owner-home', 'my-machines', 'add-machine', 'requests', 'earnings'],
  worker: ['worker-home', 'worker-setup', 'jobs']
};
const ROLE_NAV = { farmer: 'F', owner: 'O', worker: 'W' };
const ROLE_LABEL = { farmer: 'Farmer', owner: 'Machine owner', worker: 'Worker' };

const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const bind = (key, text) => $$('[data-bind="' + key + '"]').forEach(el => { el.textContent = text; });
const clearSession = () => SESSION_KEYS.forEach(k => localStorage.removeItem(k));

/* ---------- 2. Language & text size ---------- */
const L = () => localStorage.lang || 'en';

const MSG = {
  offline:    { en: 'Cannot reach the server. Is it running?', hi: 'सर्वर से संपर्क नहीं हो पा रहा है।' },
  accept:     { en: 'Accept', hi: 'स्वीकार करें' },
  decline:    { en: 'Decline', hi: 'अस्वीकार करें' },
  done:       { en: 'Mark done', hi: 'पूरा हुआ' },
  cancel:     { en: 'Cancel', hi: 'रद्द करें' },
  updated:    { en: 'Updated', hi: 'अपडेट हो गया' },
  codeSent:   { en: 'SMS code sent', hi: 'SMS कोड भेज दिया गया' },
  resetDone:  { en: 'Password changed. Please log in.', hi: 'पासवर्ड बदल गया। कृपया लॉगिन करें।' },
  resendIn:   { en: 'Send the code again in', hi: 'कोड दोबारा भेजें:' },
  resend:     { en: 'Send the code again', hi: 'कोड दोबारा भेजें' },
  noLocation: { en: 'Location not supported on this device', hi: 'इस डिवाइस पर लोकेशन उपलब्ध नहीं' },
  denied:     { en: 'Location permission denied', hi: 'लोकेशन की अनुमति नहीं मिली' },
  addField:   { en: 'Add a field first', hi: 'पहले खेत जोड़ें' },
  on:         { en: 'On', hi: 'चालू' },
  off:        { en: 'Off', hi: 'बंद' }
};
const tr = key => (MSG[key] && (MSG[key][L()] || MSG[key].en)) || key;

function applyLanguage() {
  document.documentElement.lang = L();
  $$('[data-en]').forEach(el => { el.textContent = el.dataset[L()] || el.dataset.en; });
  document.documentElement.style.fontSize = (+localStorage.fs || 18) + 'px';
}

function fs(direction) {                                                      // A- / A+ on the settings page
  localStorage.fs = Math.min(24, Math.max(15, (+localStorage.fs || 18) + direction * 2));
  applyLanguage();
}

function toast(text, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || 'error');
  el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------- 3. Server API ---------- */
// Every call to the Node.js backend goes through here.
async function api(path, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (localStorage.token) headers.Authorization = 'Bearer ' + localStorage.token;

  let res;
  try {
    res = await fetch('/api' + path, { method: method || 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw Object.assign(new Error(tr('offline')), { offline: true });
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !PUBLIC_PAGES.includes(PAGE())) {                 // session ended -> back to login
    clearSession();
    location.replace('index.html');
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Server error ' + res.status), { status: res.status, data });
  return data;
}

/* ---------- 4. Sign-in flow: login -> SMS code -> role -> home ---------- */
function saveUser(user) {
  localStorage.name = user.name;
  localStorage.phone = user.phone;
  if (user.role) localStorage.role = user.role; else localStorage.removeItem('role');
}

// Where should this user go now?
async function routeAfterAuth(user) {
  saveUser(user);
  if (!user.role) return location.replace('role.html');
  if (user.role === 'worker') {                                               // a worker needs a profile before anything else
    try { await api('/workers/me'); } catch (e) { if (e.status === 404) return location.replace('worker-setup.html'); }
  }
  location.replace(ROLE_HOME[user.role]);
}

// Block pages the user may not open (not logged in, no role yet, or another role's pages).
function accessAllowed() {
  const page = PAGE(), role = localStorage.role;
  if (PUBLIC_PAGES.includes(page)) return true;
  if (!localStorage.token) { location.replace('index.html'); return false; }
  if (!role) {
    if (page === 'role') return true;
    location.replace('role.html'); return false;
  }
  if (page === 'role') { location.replace(ROLE_HOME[role]); return false; }
  const mine = ROLE_PAGES[role] || [];
  const others = Object.keys(ROLE_PAGES).filter(r => r !== role).reduce((all, r) => all.concat(ROLE_PAGES[r]), []);
  if (!mine.includes(page) && others.includes(page)) { location.replace(ROLE_HOME[role]); return false; }
  return true;
}

// Already logged in? Skip the login screens.
function skipLoginIfSignedIn() {
  if (!AUTH_PAGES.includes(PAGE()) || !localStorage.token) return;
  api('/auth/me').then(r => routeAfterAuth(r.user)).catch(() => clearSession());
}

// "Who are you?" cards
async function chooseRole(role) {
  try {
    const d = await api('/auth/me', 'PATCH', { role });
    localStorage.token = d.token;                                             // new token that contains the role
    await routeAfterAuth(d.user);
  } catch (e) { toast(e.message); }
}

// SMS code page: show the number and a resend button with a 30 second wait
function initOtpPage() {
  if (PAGE() !== 'otp') return;
  if (!localStorage.pendingPhone) { location.replace('index.html'); return; }
  bind('pendingPhone', '+91 ' + localStorage.pendingPhone);
  const button = $('#resend');
  let left = 30;
  const tick = () => {
    button.disabled = left > 0;
    button.textContent = left > 0 ? tr('resendIn') + ' ' + left + 's' : tr('resend');
    if (left-- > 0) setTimeout(tick, 1000);
  };
  tick();
  button.addEventListener('click', async () => {
    left = 30; tick();
    try { await api('/auth/resend', 'POST', { phone: localStorage.pendingPhone }); toast(tr('codeSent'), 'ok'); }
    catch (e) { toast(e.message); left = 0; tick(); }
  });
}

// Forgot password: step 1 asks for the number, step 2 for the SMS code and a new password
function initForgotPage() {
  if (PAGE() !== 'forgot') return;
  const step1 = $('#forgot-1'), step2 = $('#forgot-2');
  let phone = '';
  step1.addEventListener('submit', async e => {
    e.preventDefault();
    phone = $('[data-k="phone"]', step1).value;
    try {
      await api('/auth/forgot', 'POST', { phone });
      toast(tr('codeSent'), 'ok');
      step1.hidden = true; step2.hidden = false;
    } catch (err) { toast(err.message); }
  });
  step2.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await api('/auth/reset', 'POST', { phone, code: $('[data-k="code"]', step2).value, password: $('[data-k="password"]', step2).value });
      toast(tr('resetDone'), 'ok');
      setTimeout(() => location.replace('index.html'), 1200);
    } catch (err) { toast(err.message); }
  });
}

/* ---------- 5. Lists, dashboards and booking pages ---------- */
const ICON = { Tractor: '🚜', Harvester: '🌽', Rotavator: '🌾', 'Seed drill': '🌱', Thresher: '🌾' };

function card(icon, title, sub, tag, href, attrs) {
  const open = href ? '<a href="' + esc(href) + '" class="card"' : '<div class="card"';
  return open + (attrs || '') + '><div class="ic">' + icon + '</div><div><b>' + esc(title) + '</b><small>' + esc(sub) +
    '</small></div>' + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + (href ? '</a>' : '</div>');
}

function actionButtons(b, isOwner) {
  const btn = (status, key, cls) => '<button type="button" class="btn sm ' + cls + '" data-act="' + status + '" data-id="' + esc(b._id) + '">' + tr(key) + '</button>';
  if (b.status === 'pending') return '<div class="actions">' + (isOwner ? btn('confirmed', 'accept', '') + btn('cancelled', 'decline', 'ghost') : btn('cancelled', 'cancel', 'ghost')) + '</div>';
  if (b.status === 'confirmed') return '<div class="actions">' + (isOwner ? btn('done', 'done', '') : '') + btn('cancelled', 'cancel', 'ghost') + '</div>';
  return '';
}

function bookingRow(b, isOwner) {
  const unit = b.kind === 'worker' ? ' days' : ' hrs';
  const who = isOwner && b.userName ? b.userName + ' · ' : '';
  const info = card(b.kind === 'worker' ? '👥' : '🚜', b.item, who + b.date + ' · ' + b.hours + unit + ' · ' + rupee(b.total), b.status, 'booking-detail.html?id=' + b._id);
  return '<div class="req">' + info + actionButtons(b, isOwner) + '</div>';
}

// A machine / worker card remembers its details in data-* attributes (read when it is tapped)
const itemAttrs = (kind, x, sub, type, team) =>
  ' data-kind="' + kind + '" data-id="' + esc(x._id) + '" data-item="' + esc(x.name) + '" data-rate="' + x.rate +
  '" data-sub="' + esc(sub) + '" data-type="' + esc(type) + '" data-team="' + team + '"';

// One renderer per API path. A list container uses  data-list="/path".
const RENDER = {
  '/machines': m => {
    const sub = [m.ownerName, m.location].filter(Boolean).join(' · ');
    return card(ICON[m.type] || '🚜', m.name, sub || m.type, '₹' + m.rate + '/hr', 'machine-detail.html', itemAttrs('machine', m, sub, m.type, 1));
  },
  '/machines/mine': m => card(ICON[m.type] || '🚜', m.name, [m.type, m.location].filter(Boolean).join(' · '), '₹' + m.rate + '/hr'),
  '/workers': w => {
    const sub = [w.skill, w.village].filter(Boolean).join(' · ');
    return card(w.groupSize > 1 ? '👥' : '👨‍🌾', w.name, sub + (w.groupSize > 1 ? ' · team of ' + w.groupSize : ''), '₹' + w.rate + '/day', 'worker-detail.html',
      itemAttrs('worker', w, sub, w.skill, w.groupSize || 1));
  },
  '/fields': f => card('🌾', f.name, f.area + ' acre · ' + (f.crop || ''), '', ''),
  '/bookings': b => bookingRow(b, false),
  '/bookings/requests': b => bookingRow(b, true)
};
const EMPTY = {
  '/machines': 'No machines registered yet.',
  '/machines/mine': 'You have not added any machine yet.',
  '/workers': 'No workers registered yet.',
  '/fields': 'No fields yet. Add your first field.',
  '/bookings': 'No bookings yet.',
  '/bookings/requests': 'No requests yet.'
};

async function loadLists() {
  await Promise.all($$('[data-list]').map(async box => {
    const path = box.dataset.list;
    try {
      const rows = await api(path);
      box.innerHTML = rows.length ? rows.map(RENDER[path]).join('') : '<div class="empty">' + esc(EMPTY[path] || 'Nothing here yet.') + '</div>';
    } catch (e) {
      box.innerHTML = '<div class="alert">' + esc(e.message) + '</div>';
    }
  }));
}

// <select data-src="/fields"> gets its options from the database
async function loadSelects() {
  for (const sel of $$('select[data-src]')) {
    try {
      const rows = await api(sel.dataset.src);
      sel.innerHTML = rows.length ? rows.map(r => '<option>' + esc(r.name) + ' · ' + esc(r.area) + ' acre</option>').join('') : '<option value="">' + esc(tr('addField')) + '</option>';
    } catch (e) { sel.innerHTML = '<option value="">' + esc(e.message) + '</option>'; }
  }
}

// ---- bar charts and donut ----
function fillBars(card, rows) {
  $$('.row, .empty', card).forEach(el => el.remove());
  const max = Math.max.apply(null, rows.map(r => r.value).concat(1));
  card.insertAdjacentHTML('beforeend', rows.length ? rows.map(r =>
    '<div class="row"><span>' + esc(r.label) + '</span><div style="flex:1"><i style="width:' + Math.round(r.value / max * 100) + '%"></i></div><b>' + rupee(r.value) + '</b></div>').join('')
    : '<div class="empty">No data yet.</div>');
}

function setDonut(card, pct) {
  const ring = $$('circle', card)[1];
  if (ring) ring.setAttribute('stroke-dasharray', pct + ' ' + (100 - pct));
  const label = $('text', card);
  if (label) label.textContent = pct + '%';
}

// ---- dashboards: numbers come from /api/stats ----
async function loadStats() {
  const as = { 'farmer-home': 'user', dashboard: 'user', 'owner-home': 'owner', earnings: 'owner', 'worker-home': 'owner' }[PAGE()];
  if (!as) return;
  try {
    const s = await api('/stats?as=' + as);
    bind('fields', s.fields); bind('machines', s.machines);
    bind('bookings', s.bookings); bind('jobs', s.bookings); bind('pending', s.pending);
    bind('amount', rupee(s.amount)); bind('month', rupee(s.month));
    $$('[data-chart="spend"], [data-chart="earn"]').forEach(c => fillBars(c, s.byMonth));
    $$('[data-donut]').forEach(d => setDonut(d, s.completedPct));
  } catch (e) { toast(e.message); }
}

// ---- price comparison: from the machines and workers that are really registered ----
async function loadPriceCompare() {
  if (PAGE() !== 'price-compare') return;
  const fill = async (key, path) => {
    try {
      const rows = (await api(path)).slice(0, 8).map(r => ({ label: r.name.slice(0, 9), value: r.rate }));
      fillBars($('[data-chart="' + key + '"]'), rows);
    } catch (e) { toast(e.message); }
  };
  await Promise.all([fill('price-machines', '/machines'), fill('price-workers', '/workers')]);
}

// ---- profile ----
async function loadProfile() {
  if (!$('[data-bind="name"]')) return;
  const show = u => { bind('name', u.name); bind('phone', u.phone + ' · ' + (ROLE_LABEL[u.role] || '')); };
  show({ name: localStorage.name || '', phone: localStorage.phone || '', role: localStorage.role });
  try { const r = await api('/auth/me'); saveUser(r.user); show(r.user); } catch (e) { /* 401 handler redirects */ }
}

// ---- machine / worker detail (values were saved when the card was tapped) ----
function loadItemDetail() {
  if (!['machine-detail', 'worker-detail'].includes(PAGE())) return;
  if (!localStorage.itemId) { location.replace(PAGE() === 'machine-detail' ? 'machines.html' : 'workforce.html'); return; }
  bind('item', localStorage.item);
  bind('sub', localStorage.itemSub || '');
  bind('rate', rupee(localStorage.rate) + (PAGE() === 'machine-detail' ? '/hr' : '/day'));
  bind('type', localStorage.itemType || '');
  bind('team', localStorage.team || '1');
}

async function loadBookingDetail() {
  if (PAGE() !== 'booking-detail') return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { bind('item', '—'); return; }
  try {
    const b = await api('/bookings/' + encodeURIComponent(id));
    bind('item', b.item); bind('total', rupee(b.total));
    bind('duration', b.hours + (b.kind === 'worker' ? ' days' : ' hrs'));
    bind('meta', [b.date, b.field, b.task].filter(Boolean).join(' · '));
    const box = $('#bstatus');
    box.textContent = 'Status: ' + b.status;
    box.className = 'alert ' + ({ confirmed: 'ok', done: 'ok', pending: 'warn' }[b.status] || '');
    if (b.contact) { bind('contactName', b.contact.name); bind('contactPhone', b.contact.phone); $('#bcontact').hidden = false; }
  } catch (e) { toast(e.message); }
}

// ---- booking steps 1-3 and the final save ----
function initBooking() {
  const p = PAGE();
  if (['book-1', 'book-2', 'book-3', 'book-done'].includes(p) && !localStorage.itemId) { location.replace('machines.html'); return; }

  if (p === 'book-3') {
    const hours = +localStorage.hrs || 1, date = localStorage.date || '';
    $('#bitem').textContent = localStorage.item;
    $('#bd').textContent = date || '—'; $('#bh').textContent = hours;
    $('#bc').textContent = rupee((+localStorage.rate || 0) * hours);
    const confirmBtn = $('#ok');
    const block = () => { confirmBtn.setAttribute('aria-disabled', 'true'); confirmBtn.style.opacity = '.5'; confirmBtn.style.pointerEvents = 'none'; };
    if (!date) block();
    else api('/bookings/check?itemId=' + encodeURIComponent(localStorage.itemId) + '&date=' + date)
      .then(r => { if (!r.available) { $('#cf').hidden = false; block(); } })     // the database knows every booking
      .catch(e => toast(e.message));
  }

  if (p === 'book-done') {
    const key = localStorage.date + '|' + localStorage.itemId, status = $('#done');
    const success = () => { status.hidden = true; $('#bok').hidden = false; };
    if (sessionStorage.saved === key) return success();                         // page refresh: do not book twice
    api('/bookings', 'POST', {
      kind: localStorage.kind || 'machine', itemId: localStorage.itemId, date: localStorage.date,
      hours: +localStorage.hrs || 1, field: localStorage.field, task: localStorage.task
    }).then(() => { sessionStorage.saved = key; success(); })
      .catch(e => { status.className = 'alert'; status.textContent = e.message; });
  }
}

// ---- worker home: "available for work" switch ----
async function initAvailability() {
  const box = $('#avail');
  if (!box) return;
  const show = w => { $('#avail-tag').textContent = tr(w.available ? 'on' : 'off'); $('#avail-tag').classList.toggle('off', !w.available); box.hidden = false; box.dataset.on = w.available ? '1' : ''; };
  try { show(await api('/workers/me')); }
  catch (e) { if (e.status === 404) location.replace('worker-setup.html'); else toast(e.message); return; }
  const flip = async () => {
    try { show(await api('/workers/me', 'PATCH', { available: !box.dataset.on })); } catch (e) { toast(e.message); }
  };
  box.addEventListener('click', flip);
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
}

// ---- weather card (today, or the chosen booking date) ----
async function loadWeather() {
  const lat = localStorage.la || 27.49, lon = localStorage.lo || 77.67;
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&daily=temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=16');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = (await res.json()).daily;
    let i = d.time.indexOf(localStorage.date); if (i < 0) i = 0;
    const rain = d.precipitation_probability_max[i] == null ? 0 : d.precipitation_probability_max[i];
    $('#t').textContent = Math.round(d.temperature_2m_max[i]);
    $('#r').textContent = rain;
    $('#wxa').hidden = rain < 60;
  } catch (e) {                                                                 // offline: show nothing rather than wrong data
    $('#t').textContent = '--'; $('#r').textContent = '--'; $('#wxa').hidden = true;
  }
}

function detectLocation() {
  const out = $('#ll');
  if (!navigator.geolocation) { out.textContent = tr('noLocation'); return; }
  navigator.geolocation.getCurrentPosition(
    p => { localStorage.la = p.coords.latitude; localStorage.lo = p.coords.longitude; out.textContent = p.coords.latitude.toFixed(3) + ', ' + p.coords.longitude.toFixed(3); },
    () => { out.textContent = tr('denied'); }, { timeout: 8000 });
}
function loc() { detectLocation(); }                                           // used by onclick="loc()" in the pages

/* ---------- 6. Forms, clicks and start-up ---------- */
async function submitForm(form) {
  const data = {};
  $$('[data-k]', form).forEach(el => { data[el.dataset.k] = el.value; });
  if (form.hasAttribute('data-with-phone')) data.phone = localStorage.pendingPhone;
  let next = form.dataset.next;

  if (!form.dataset.api) {                                                     // booking choices kept between the steps
    Object.keys(data).forEach(k => { localStorage[k] = data[k]; });
    location.href = next;
    return;
  }

  const button = $('button[type="submit"]', form);
  button.disabled = true;
  try {
    const d = await api(form.dataset.api, form.dataset.method || 'POST', data);
    if (form.dataset.api === '/auth/register') {                               // SMS code was sent -> enter it on the next page
      localStorage.pendingPhone = data.phone;
      return location.assign('otp.html');
    }
    if (form.dataset.api === '/auth/login' || form.dataset.api === '/auth/verify') {
      localStorage.token = d.token;
      return routeAfterAuth(d.user);                                           // role page, worker profile or home
    }
    if (form.dataset.api === '/auth/me' && d.user) { localStorage.token = d.token; saveUser(d.user); }
  } catch (e) {
    button.disabled = false;
    if (e.data && e.data.needsVerify) {                                        // correct password but number not confirmed yet
      localStorage.pendingPhone = e.data.phone;
      toast(e.message);
      return setTimeout(() => location.assign('otp.html'), 1200);
    }
    return toast(e.message);
  }
  location.href = next;
}

function initForms() {
  $$('form[data-next]').forEach(form => {
    form.addEventListener('submit', e => { e.preventDefault(); submitForm(form); });
    const source = form.dataset.prefill;                                       // edit forms start with the saved values
    if (source) {
      api(source).then(r => { const rec = r.user || r; $$('[data-k]', form).forEach(el => { if (rec[el.dataset.k] != null) el.value = rec[el.dataset.k]; }); }).catch(() => {});
    }
  });
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $$('input[data-date]').forEach(el => { el.min = today; });                   // no past dates
}

function initClicks() {
  document.addEventListener('click', async ev => {
    const role = ev.target.closest('[data-role]');                             // role cards
    if (role) { ev.preventDefault(); chooseRole(role.dataset.role); return; }

    const act = ev.target.closest('[data-act]');                               // Accept / Decline / Done / Cancel
    if (act) {
      act.disabled = true;
      try { await api('/bookings/' + act.dataset.id, 'PATCH', { status: act.dataset.act }); toast(tr('updated'), 'ok'); await loadLists(); }
      catch (e) { toast(e.message); act.disabled = false; }
      return;
    }

    if (ev.target.closest('[data-logout]')) { clearSession(); return; }

    const item = ev.target.closest('[data-item]');                             // a machine / worker card was tapped
    if (item) {
      const d = item.dataset;
      localStorage.item = d.item; localStorage.itemId = d.id; localStorage.kind = d.kind;
      localStorage.rate = d.rate; localStorage.itemSub = d.sub; localStorage.itemType = d.type; localStorage.team = d.team;
      ['date', 'hrs', 'field', 'task'].forEach(k => localStorage.removeItem(k));   // start a fresh booking
    }
  });
}

function initChrome() {
  const langButton = $('#lg');
  if (langButton) langButton.onclick = () => { localStorage.lang = L() === 'en' ? 'hi' : 'en'; applyLanguage(); };

  // bottom tabs follow the user's role on shared pages, and the current tab is highlighted
  $$('nav[data-nav]').forEach(n => { n.hidden = n.dataset.nav !== (ROLE_NAV[localStorage.role] || 'F'); });
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('nav:not([hidden]) a').forEach(a => { if (a.getAttribute('href') === here) a.classList.add('on'); });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!accessAllowed()) return;

  applyLanguage();
  initChrome();
  initForms();
  initClicks();
  initOtpPage();
  initForgotPage();
  skipLoginIfSignedIn();
  initBooking();
  initAvailability();
  loadItemDetail();
  loadBookingDetail();
  loadProfile();
  loadLists();
  loadSelects();
  loadStats();
  loadPriceCompare();
  if ($('#t') && PAGE() !== 'weather') loadWeather();                          // weather.html has its own script (weather.js)
});
