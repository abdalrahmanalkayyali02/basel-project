/* ===========================================================================
 * MomsMed Guide - Vanilla JS client
 * ---------------------------------------------------------------------------
 * State
 *   - data: full catalog loaded from /api/data (mirrors file.txt)
 *   - region: current regional filter (all | jordan | europe | us)
 *   - tab: active category (green | yellow | red)
 *   - auth: { token, isAdmin }
 *   - quiz: answers map by quiz id
 *
 * The Red category is *always* visible regardless of region filter
 * because prohibited drugs/herbs are globally unsafe.
 * ===========================================================================
 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  data: null,
  region: localStorage.getItem('mm.region') || 'all',
  tab: 'green',
  quiz: {},
  auth: { token: localStorage.getItem('mm.token') || null, isAdmin: false },
  draft: null // editable copy for admin mode
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
const escapeHTML = (str = '') =>
  String(str).replace(/[&<>"']/g, (s) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));

function toast(msg, tone = 'default') {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('show', 'bg-emerald-600', 'bg-rose-600', 'bg-ink-900');
  el.classList.add(
    tone === 'success' ? 'bg-emerald-600' : tone === 'error' ? 'bg-rose-600' : 'bg-ink-900'
  );
  el.classList.add('show');
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    el.style.display = 'none';
  }, 2400);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('is-open');
  document.body.style.overflow = '';
}

function uid(prefix = 'id') {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.auth.token) headers.Authorization = `Bearer ${state.auth.token}`;
  const res = await fetch(path, { ...opts, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (isJson && body.error) || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return body;
}

async function loadData() {
  state.data = await api('/api/data');
  renderRegions();
  renderStats();
  renderCategorySummaries();
  renderCategoryView();
  renderQuiz();
}

// ---------------------------------------------------------------------------
// Region selector
// ---------------------------------------------------------------------------
function renderRegions() {
  const sel = $('#region-select');
  sel.innerHTML = state.data.regions
    .map(
      (r) => `<option value="${escapeHTML(r.id)}" ${
        r.id === state.region ? 'selected' : ''
      }>${escapeHTML(r.label)}</option>`
    )
    .join('');
  const active = state.data.regions.find((r) => r.id === state.region) || state.data.regions[0];
  $('#region-flag').textContent = active.flag;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
function renderStats() {
  const counts = {
    green:
      (state.data.categories.green.medications?.length || 0) +
      (state.data.categories.green.herbs?.length || 0),
    yellow:
      (state.data.categories.yellow.medications?.length || 0) +
      (state.data.categories.yellow.herbs?.length || 0),
    red:
      (state.data.categories.red.medications?.length || 0) +
      (state.data.categories.red.herbs?.length || 0)
  };
  $$('[data-count]').forEach((el) => {
    el.textContent = counts[el.dataset.count] ?? 0;
  });
}

function renderCategorySummaries() {
  const labels = {
    green: 'first-line OTC + permitted herbs',
    yellow: 'managed conditions',
    red: 'prohibited drugs + herbs'
  };
  $$('[data-summary]').forEach((el) => {
    const key = el.dataset.summary;
    const cat = state.data.categories[key];
    const total =
      (cat.medications?.length || 0) + (cat.herbs?.length || 0);
    el.textContent = `${total} entries · ${labels[key]}`;
  });
}

// ---------------------------------------------------------------------------
// Category content
// ---------------------------------------------------------------------------
const TONE_HEADER = {
  green: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/40',
    border: 'border-emerald-100',
    text: 'text-emerald-800',
    accent: 'bg-emerald-500'
  },
  yellow: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100/40',
    border: 'border-amber-100',
    text: 'text-amber-800',
    accent: 'bg-amber-500'
  },
  red: {
    bg: 'bg-gradient-to-br from-rose-50 to-rose-100/40',
    border: 'border-rose-100',
    text: 'text-rose-800',
    accent: 'bg-rose-500'
  }
};

function setTab(tab) {
  state.tab = tab;
  document.body.dataset.accent = tab;
  $$('.tab-pill').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
  if (state.data) renderCategoryView();
}

function renderCategoryView() {
  if (!state.data) return;
  const cat = state.data.categories[state.tab];
  const tone = TONE_HEADER[state.tab];

  // header
  const header = $('#category-header');
  header.className = `rounded-3xl border ${tone.border} ${tone.bg} p-6 shadow-soft transition-colors`;
  header.innerHTML = `
    <div class="flex items-center gap-4">
      <span class="grid h-14 w-14 place-items-center rounded-2xl ${tone.accent} text-3xl text-white shadow-lg">${cat.emoji}</span>
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide ${tone.text}/80">${escapeHTML(cat.label)} mode</p>
        <h2 class="mt-1 text-2xl font-extrabold ${tone.text}">${escapeHTML(cat.headline)}</h2>
        <p class="mt-1 max-w-2xl text-sm ${tone.text}/80">${escapeHTML(cat.blurb)}</p>
      </div>
    </div>
    ${state.tab === 'red'
      ? `<div class="mt-4 flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-xs font-semibold text-rose-700"><span class="text-base">🌐</span> Red entries are always shown regardless of the regional filter — these substances are globally dangerous.</div>`
      : ''}
  `;

  // body
  const wrap = $('#category-content');
  wrap.innerHTML = '';

  if (state.tab === 'green') {
    wrap.appendChild(renderMedSection(cat.medications, 'green', 'Safe medications'));
    wrap.appendChild(renderHerbSection(cat.herbs, 'green', 'Permitted herbs', false));
  } else if (state.tab === 'yellow') {
    wrap.appendChild(renderMedSection(cat.medications, 'yellow', 'Conditional medications'));
    if (cat.herbs?.length) {
      wrap.appendChild(renderHerbSection(cat.herbs, 'yellow', 'Conditional herbs', false));
    }
  } else if (state.tab === 'red') {
    wrap.appendChild(renderRedSection(cat.medications, 'Prohibited medications'));
    wrap.appendChild(renderRedSection(cat.herbs, 'Prohibited herbs'));
  }
}

function sectionShell(title, tone, body) {
  const wrap = document.createElement('section');
  wrap.className = 'fade-in';
  wrap.innerHTML = `
    <header class="mb-3 flex items-end justify-between">
      <h3 class="text-lg font-bold text-ink-900">${escapeHTML(title)}</h3>
      <span class="pill pill-${tone}">${tone}</span>
    </header>
    <div class="grid gap-3 sm:grid-cols-2"></div>
  `;
  const grid = wrap.querySelector('div.grid');
  body.forEach((node) => grid.appendChild(node));
  return wrap;
}

function renderMedSection(meds = [], tone, title) {
  const cards = meds.map((m) => medCard(m, tone));
  return sectionShell(title, tone, cards);
}

function medCard(m, tone) {
  const region = state.region;
  const brandsByRegion = m.brands || {};
  const visible = region === 'all'
    ? Object.entries(brandsByRegion)
    : Object.entries(brandsByRegion).filter(([r]) => r === region);

  const regionLabel = (id) => {
    const r = state.data.regions.find((x) => x.id === id);
    return r ? `${r.flag} ${r.label}` : id;
  };

  const brandsHTML = visible.length
    ? visible
        .map(
          ([r, list]) => `
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="pill pill-${tone}">${escapeHTML(regionLabel(r))}</span>
          ${list
            .map((b) => `<span class="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink-700 shadow-sm ring-1 ring-pink-100">${escapeHTML(b)}</span>`)
            .join('')}
        </div>`
        )
        .join('')
    : `<p class="rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-ink-500">No branded equivalents listed for the selected region.</p>`;

  const card = document.createElement('article');
  card.className = 'entry-card fade-in';
  card.dataset.tone = tone;
  card.innerHTML = `
    <header>
      <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">${escapeHTML(m.purpose || '')}</p>
      <h4 class="text-base font-extrabold text-ink-900">${escapeHTML(m.name || '')}</h4>
    </header>
    ${m.alert ? `<div class="rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-800">⚠ ${escapeHTML(m.alert)}</div>` : ''}
    <div class="grid gap-1.5">${brandsHTML}</div>
    ${m.dosage ? `<p class="rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-ink-700"><span class="font-bold text-ink-900">Dosage · </span>${escapeHTML(m.dosage)}</p>` : ''}
    ${m.warning ? `<p class="rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-ink-700"><span class="font-bold text-ink-900">Note · </span>${escapeHTML(m.warning)}</p>` : ''}
  `;
  return card;
}

function renderHerbSection(herbs = [], tone, title) {
  const cards = herbs.map((h) => {
    const card = document.createElement('article');
    card.className = 'entry-card fade-in';
    card.dataset.tone = tone;
    card.innerHTML = `
      <header class="flex items-start justify-between gap-2">
        <h4 class="text-base font-extrabold text-ink-900">🌿 ${escapeHTML(h.name)}</h4>
        <span class="pill pill-${tone}">herb</span>
      </header>
      <p class="text-sm leading-relaxed text-ink-700">${escapeHTML(h.benefit || h.reason || '')}</p>
    `;
    return card;
  });
  return sectionShell(title, tone, cards);
}

function renderRedSection(items = [], title) {
  const cards = items.map((item) => {
    const card = document.createElement('article');
    card.className = 'entry-card fade-in';
    card.dataset.tone = 'red';
    const isHerb = item.id?.startsWith('herb-');
    card.innerHTML = `
      <header class="flex items-start justify-between gap-2">
        <h4 class="text-base font-extrabold text-rose-800">${isHerb ? '🌿 ' : '💊 '}${escapeHTML(item.name)}</h4>
        <span class="pill pill-red">prohibited</span>
      </header>
      <p class="text-sm leading-relaxed text-rose-900/80">${escapeHTML(item.reason || '')}</p>
    `;
    return card;
  });
  return sectionShell(title, 'red', cards);
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
function renderQuiz() {
  const grid = $('#quiz-grid');
  grid.innerHTML = '';
  state.data.quiz.forEach((q, idx) => {
    const card = document.createElement('article');
    card.className = 'quiz-card fade-in';
    card.dataset.id = q.id;
    card.innerHTML = `
      <header class="flex items-start gap-2">
        <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">${idx + 1}</span>
        <p class="text-sm font-semibold leading-relaxed text-ink-900">${escapeHTML(q.statement)}</p>
      </header>
      <div class="quiz-buttons">
        <button class="quiz-btn" type="button" data-answer="true">True</button>
        <button class="quiz-btn" type="button" data-answer="false">False</button>
      </div>
      <div class="quiz-feedback hidden" data-tone="${escapeHTML(q.feedbackTone)}"></div>
    `;
    grid.appendChild(card);

    card.querySelectorAll('.quiz-btn').forEach((btn) => {
      btn.addEventListener('click', () => answerQuiz(q, card, btn));
    });
  });
  updateQuizScore();
}

function answerQuiz(q, card, btn) {
  const chosen = btn.dataset.answer === 'true';
  const correct = chosen === q.answer;
  state.quiz[q.id] = correct;

  card.querySelectorAll('.quiz-btn').forEach((b) => {
    b.disabled = true;
    const isThis = b === btn;
    if (isThis) b.dataset.state = correct ? 'correct' : 'wrong';
    else if (String(q.answer) === b.dataset.answer) b.dataset.state = 'correct';
  });

  const fb = card.querySelector('.quiz-feedback');
  fb.classList.remove('hidden');
  fb.innerHTML = `<strong>${correct ? '✅ Correct.' : '❌ Not quite.'}</strong> ${escapeHTML(q.explanation)}`;
  updateQuizScore();
}

function updateQuizScore() {
  const total = state.data?.quiz?.length || 0;
  const score = Object.values(state.quiz).filter(Boolean).length;
  $('#quiz-score').textContent = score;
  $('#quiz-total').textContent = total;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function applyAuth() {
  const isAdmin = !!state.auth.token;
  state.auth.isAdmin = isAdmin;
  $('#admin-panel-btn').classList.toggle('hidden', !isAdmin);
  $('#admin-panel-btn').classList.toggle('inline-flex', isAdmin);
  $('#open-login-btn').classList.toggle('hidden', isAdmin);
  $('#open-login-btn').classList.toggle('inline-flex', !isAdmin);
  $('#open-login-btn-mobile').classList.toggle('hidden', isAdmin);
}

async function handleLogin(e) {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const err = $('#login-error');
  err.classList.add('hidden');
  try {
    const res = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    state.auth.token = res.token;
    localStorage.setItem('mm.token', res.token);
    applyAuth();
    closeModal('login-modal');
    toast('Welcome, Doctor — admin tools unlocked.', 'success');
    $('#login-form').reset();
  } catch (e2) {
    err.textContent = e2.message || 'Login failed. Please try again.';
    err.classList.remove('hidden');
  }
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {}
  state.auth.token = null;
  localStorage.removeItem('mm.token');
  applyAuth();
  closeModal('admin-modal');
  toast('Logged out.', 'default');
}

// ---------------------------------------------------------------------------
// Admin dashboard (CRUD)
// ---------------------------------------------------------------------------
let adminTab = 'green';

function openAdmin() {
  if (!state.auth.token) return openModal('login-modal');
  state.draft = JSON.parse(JSON.stringify(state.data));
  setAdminTab('green');
  openModal('admin-modal');
}

function setAdminTab(tab) {
  adminTab = tab;
  $$('.admin-tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.adminTab === tab ? 'true' : 'false'));
  renderAdminBody();
}

function renderAdminBody() {
  const body = $('#admin-body');
  body.innerHTML = '';

  if (adminTab === 'quiz') {
    body.appendChild(renderAdminQuiz());
    return;
  }

  const cat = state.draft.categories[adminTab];
  const wrap = document.createElement('div');
  wrap.className = 'grid gap-5';

  // medications
  wrap.appendChild(
    renderAdminGroup(`💊 ${cat.label} medications`, cat.medications, (entry) => entryEditor(entry, 'medication', adminTab), () => {
      const blank =
        adminTab === 'red'
          ? { id: uid('red'), name: '', reason: '' }
          : {
              id: uid('med'),
              name: '',
              purpose: '',
              brands: { jordan: [], europe: [], us: [] },
              dosage: '',
              warning: ''
            };
      cat.medications.push(blank);
      renderAdminBody();
    })
  );

  // herbs
  wrap.appendChild(
    renderAdminGroup(`🌿 ${cat.label} herbs`, cat.herbs, (entry) => entryEditor(entry, 'herb', adminTab), () => {
      const blank =
        adminTab === 'red'
          ? { id: uid('herb'), name: '', reason: '' }
          : { id: uid('herb'), name: '', benefit: '' };
      cat.herbs.push(blank);
      renderAdminBody();
    })
  );

  body.appendChild(wrap);
}

function renderAdminGroup(title, list, editorFn, onAdd) {
  const section = document.createElement('section');
  section.innerHTML = `
    <header class="mb-2 flex items-center justify-between">
      <h3 class="text-sm font-bold">${escapeHTML(title)} <span class="text-ink-500">(${list.length})</span></h3>
      <button class="rounded-full border border-pink-200 px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50" type="button">+ Add</button>
    </header>
    <div class="grid gap-2"></div>
  `;
  section.querySelector('button').addEventListener('click', onAdd);
  const container = section.querySelector('div.grid');
  list.forEach((entry, idx) => container.appendChild(editorFn(entry, idx)));
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'rounded-xl border border-dashed border-pink-200 bg-white p-3 text-xs text-ink-500';
    empty.textContent = 'No entries yet — use “+ Add” to create one.';
    container.appendChild(empty);
  }
  return section;
}

function entryEditor(entry, kind, tab) {
  const node = document.createElement('div');
  node.className = 'admin-entry';

  const baseFields = `
    <label class="grid gap-1 text-xs font-semibold text-ink-700">
      <span>Name</span>
      <input data-field="name" type="text" value="${escapeHTML(entry.name || '')}" placeholder="e.g. Acetaminophen" />
    </label>
  `;

  let extra = '';
  if (tab === 'red') {
    extra = `
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Reason / risk</span>
        <textarea data-field="reason" placeholder="Why is it prohibited?">${escapeHTML(entry.reason || '')}</textarea>
      </label>
    `;
  } else if (kind === 'herb') {
    extra = `
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Benefit</span>
        <textarea data-field="benefit">${escapeHTML(entry.benefit || '')}</textarea>
      </label>
    `;
  } else {
    extra = `
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Purpose / condition</span>
        <input data-field="purpose" value="${escapeHTML(entry.purpose || '')}" />
      </label>
      <div class="grid gap-2 sm:grid-cols-3">
        <label class="grid gap-1 text-xs font-semibold text-ink-700">
          <span>🇯🇴 Jordan brands (comma sep.)</span>
          <input data-brand="jordan" value="${escapeHTML((entry.brands?.jordan || []).join(', '))}" />
        </label>
        <label class="grid gap-1 text-xs font-semibold text-ink-700">
          <span>🇪🇺 Europe/UK brands</span>
          <input data-brand="europe" value="${escapeHTML((entry.brands?.europe || []).join(', '))}" />
        </label>
        <label class="grid gap-1 text-xs font-semibold text-ink-700">
          <span>🇺🇸 US brands</span>
          <input data-brand="us" value="${escapeHTML((entry.brands?.us || []).join(', '))}" />
        </label>
      </div>
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Dosage</span>
        <textarea data-field="dosage">${escapeHTML(entry.dosage || '')}</textarea>
      </label>
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Warning / note</span>
        <textarea data-field="warning">${escapeHTML(entry.warning || '')}</textarea>
      </label>
      ${tab === 'yellow' ? `
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>High-visibility alert (optional)</span>
        <input data-field="alert" value="${escapeHTML(entry.alert || '')}" placeholder="e.g. HIGH SODIUM — caution if hypertensive" />
      </label>` : ''}
    `;
  }

  node.innerHTML = `
    ${baseFields}
    ${extra}
    <div class="flex items-center justify-between">
      <span class="text-[10px] uppercase tracking-wide text-ink-500">id: ${escapeHTML(entry.id || '—')}</span>
      <button type="button" class="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100">Delete</button>
    </div>
  `;

  // wire field updates onto draft (live)
  node.querySelectorAll('[data-field]').forEach((input) => {
    input.addEventListener('input', () => {
      entry[input.dataset.field] = input.value;
    });
  });
  node.querySelectorAll('[data-brand]').forEach((input) => {
    input.addEventListener('input', () => {
      entry.brands = entry.brands || {};
      entry.brands[input.dataset.brand] = input.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    });
  });

  // delete
  node.querySelector('button').addEventListener('click', () => {
    const cat = state.draft.categories[tab];
    const list = kind === 'herb' ? cat.herbs : cat.medications;
    const idx = list.indexOf(entry);
    if (idx > -1) list.splice(idx, 1);
    renderAdminBody();
  });

  return node;
}

function renderAdminQuiz() {
  const wrap = document.createElement('section');
  wrap.innerHTML = `
    <header class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-bold">❓ Quiz scenarios <span class="text-ink-500">(${state.draft.quiz.length})</span></h3>
      <button class="rounded-full border border-pink-200 px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50" type="button">+ Add</button>
    </header>
    <div class="grid gap-2"></div>
  `;
  const container = wrap.querySelector('div.grid');
  wrap.querySelector('button').addEventListener('click', () => {
    state.draft.quiz.push({
      id: uid('q'),
      statement: '',
      answer: true,
      feedbackTone: 'green',
      explanation: ''
    });
    renderAdminBody();
  });

  state.draft.quiz.forEach((q) => {
    const node = document.createElement('div');
    node.className = 'admin-entry';
    node.innerHTML = `
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Statement</span>
        <textarea data-field="statement">${escapeHTML(q.statement || '')}</textarea>
      </label>
      <div class="grid gap-2 sm:grid-cols-2">
        <label class="grid gap-1 text-xs font-semibold text-ink-700">
          <span>Correct answer</span>
          <select data-field="answer">
            <option value="true" ${q.answer ? 'selected' : ''}>True</option>
            <option value="false" ${!q.answer ? 'selected' : ''}>False</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs font-semibold text-ink-700">
          <span>Feedback tone</span>
          <select data-field="feedbackTone">
            <option value="green" ${q.feedbackTone === 'green' ? 'selected' : ''}>🟢 Green</option>
            <option value="yellow" ${q.feedbackTone === 'yellow' ? 'selected' : ''}>🟡 Yellow</option>
            <option value="red" ${q.feedbackTone === 'red' ? 'selected' : ''}>🔴 Red</option>
          </select>
        </label>
      </div>
      <label class="grid gap-1 text-xs font-semibold text-ink-700">
        <span>Explanation</span>
        <textarea data-field="explanation">${escapeHTML(q.explanation || '')}</textarea>
      </label>
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-wide text-ink-500">id: ${escapeHTML(q.id)}</span>
        <button type="button" class="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100">Delete</button>
      </div>
    `;
    node.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        if (input.dataset.field === 'answer') q.answer = input.value === 'true';
        else q[input.dataset.field] = input.value;
      });
    });
    node.querySelector('button').addEventListener('click', () => {
      const idx = state.draft.quiz.indexOf(q);
      if (idx > -1) state.draft.quiz.splice(idx, 1);
      renderAdminBody();
    });
    container.appendChild(node);
  });

  return wrap;
}

async function saveAdmin() {
  const btn = $('#save-changes-btn');
  btn.disabled = true;
  const oldLabel = btn.textContent;
  btn.textContent = 'Saving…';
  try {
    const res = await api('/api/save', {
      method: 'POST',
      body: JSON.stringify(state.draft)
    });
    state.data = res.data;
    renderStats();
    renderCategorySummaries();
    renderCategoryView();
    renderQuiz();
    $('#admin-status').textContent = `Saved to file.txt — version ${state.data.meta.version}.`;
    toast('Changes written to file.txt', 'success');
  } catch (err) {
    if (err.message?.toLowerCase().includes('unauthorized')) {
      state.auth.token = null;
      localStorage.removeItem('mm.token');
      applyAuth();
      closeModal('admin-modal');
      openModal('login-modal');
    }
    toast(err.message || 'Save failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
function bindEvents() {
  $('#region-select').addEventListener('change', (e) => {
    state.region = e.target.value;
    localStorage.setItem('mm.region', state.region);
    const active = state.data.regions.find((r) => r.id === state.region);
    $('#region-flag').textContent = active?.flag || '🌍';
    renderCategoryView();
  });

  $$('.traffic-card[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      setTab(b.dataset.tab);
      document.getElementById('category-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );

  $$('#tab-bar .tab-pill').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  ['open-login-btn', 'open-login-btn-mobile', 'open-login-footer'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      if (state.auth.token) {
        openAdmin();
      } else {
        openModal('login-modal');
      }
    });
  });

  $('#admin-panel-btn').addEventListener('click', openAdmin);
  $('#logout-btn').addEventListener('click', handleLogout);
  $('#login-form').addEventListener('submit', handleLogin);
  $('#save-changes-btn').addEventListener('click', saveAdmin);

  $$('#admin-tabs .admin-tab').forEach((b) =>
    b.addEventListener('click', () => setAdminTab(b.dataset.adminTab))
  );

  // close handlers
  $$('.close-modal').forEach((b) =>
    b.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.remove('is-open');
      document.body.style.overflow = '';
    })
  );
  $$('.modal').forEach((m) =>
    m.addEventListener('click', (e) => {
      if (e.target === m) {
        m.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    })
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal.is-open').forEach((m) => m.classList.remove('is-open'));
      document.body.style.overflow = '';
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  setTab(state.tab);
  applyAuth();
  bindEvents();
  try {
    await loadData();
    // Validate token by trying a silent admin probe? Skip — token revoked errors will simply prompt login.
  } catch (err) {
    console.error(err);
    toast('Failed to load catalog: ' + err.message, 'error');
  }
})();
