import * as store from './store.js';
import * as act from './actions.js';
import { icon, esc } from './ui.js';
import { dateKey, addDays, fromInputs, monthStartKey, monthEndKey, MIN, HOUR, fmtTime } from './time.js';
import { currentWorkday, currentCycle, workdayEvents } from './logic.js';
import { todayView, refKey, heroFor } from './views/today.js';
import { timelineView } from './views/timeline.js';
import { weekView } from './views/week.js';
import { sleepView } from './views/sleep.js';
import { mealsView } from './views/meals.js';
import { statsView } from './views/stats.js';
import { settingsView } from './views/settings.js';
import { sheetView, defaultStep } from './views/sheet.js';
import { initSync, onSync, syncState, signIn, signOut } from './sync.js';

const ROUTES = {
  today: { title: '今天', icon: 'clock', view: todayView },
  timeline: { title: '時間線', icon: 'list', view: timelineView },
  week: { title: '一週與班表', icon: 'calendar', view: weekView },
  sleep: { title: '睡眠', icon: 'moon', view: sleepView },
  meals: { title: '用餐', icon: 'meal', view: mealsView },
  stats: { title: '統計與收入', icon: 'chart', view: statsView },
  settings: { title: '我的', icon: 'user', view: settingsView }
};
const SIDEBAR = ['today', 'timeline', 'week', 'sleep', 'meals', 'stats'];
const TABBAR = [['today', '今天', 'clock'], ['timeline', '時間線', 'list'], ['+', '', 'plus'], ['sleep', '睡眠', 'moon'], ['stats', '統計', 'chart']];

const ui = {
  route: 'today', wd: null, tlMode: 'workday', calKey: null, weekMode: 'workday', weekOffset: 0,
  monthKey: null, calDay: null, batch: false, batchDays: [], statsPeriod: 'week', statsOffset: 0, statsJob: 'all',
  selRef: null, sheet: null, mealEdit: null, mealPhoto: undefined, incomeEdit: null, jobEdit: null, canInstall: false
};

// 測試可以用 ?now=2026-10-13T03:18 固定時間。
const params = new URLSearchParams(location.search);
const fixedNow = params.get('now') ? new Date(params.get('now')).getTime() : null;
const nowFn = () => fixedNow ?? Date.now();

const desktopMQ = matchMedia('(min-width: 1024px)');
const $ = (s, r = document) => r.querySelector(s);

function ctx() {
  const data = store.get();
  const now = nowFn();
  const wd = ui.wd || currentWorkday(data, now);
  return { data, now, ui, wd, isDesktop: desktopMQ.matches };
}

function shell() {
  const side = SIDEBAR.map((r) => `<a href="#/${r}" class="side-link" data-route="${r}">${icon(ROUTES[r].icon, 20, 1.9)}<span>${ROUTES[r].title}</span></a>`).join('');
  const tabs = TABBAR.map(([r, label, ic]) => r === '+'
    ? `<button type="button" class="tab-plus" data-action="open-record" aria-label="新增記錄">${icon(ic, 24, 2.4)}</button>`
    : `<a href="#/${r}" class="tab" data-route="${r}">${icon(ic, 23, 1.9)}<span>${label}</span></a>`).join('');
  document.body.innerHTML = `
  <a class="skip" href="#view">跳到主要內容</a>
  <div class="app">
    <aside class="sidebar" aria-label="側邊導覽">
      <a class="brand" href="#/today"><span class="brand-mark">${icon('clock', 20, 2.2)}</span><span>ONTIME</span></a>
      <nav class="side-nav" aria-label="主要導覽">${side}</nav>
      <button type="button" class="btn btn-ink side-add" data-action="open-record">${icon('plus', 18, 2.4)}新增記錄 <kbd>N</kbd></button>
      <div class="side-foot"><div class="sync-card" id="sync-card"></div><a href="#/settings" class="side-link" data-route="settings">${icon('user', 20, 1.9)}<span>我的 · 資料</span></a></div>
    </aside>
    <main class="main"><div id="hero-host"></div><div id="view" tabindex="-1"></div></main>
    <nav class="tabbar" aria-label="主要導覽">${tabs}</nav>
  </div>
  <div id="sheet-host"></div>
  <div id="toast" role="status" aria-live="polite"></div>`;
}

let lastHero = '';
let lastView = '';
let lastSheet = '';
let dirty = false;

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme; else delete root.dataset.theme;
  try { localStorage.setItem('ontime-theme', theme || 'auto'); } catch { /* 忽略 */ }
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0E1116' : '#F4F5F1');
}

function render() {
  const c = ctx();
  applyTheme(c.data.settings.theme);
  const r = ROUTES[ui.route] || ROUTES.today;
  document.title = `${r.title} · ONTIME`;
  // 首頁頂部場景只在內容改變時才重畫，動畫不會因定時更新而跳回起點。
  const heroHost = $('#hero-host');
  const heroHTML = ui.route === 'today' ? heroFor(c.data, c.wd, currentCycle(c.data, c.now), c.now, !c.isDesktop) : '';
  if (heroHTML !== lastHero) { heroHost.innerHTML = heroHTML; lastHero = heroHTML; }
  const html = r.view(c);
  if (html !== lastView) {
    const view = $('#view');
    const focusedName = document.activeElement?.name;
    view.innerHTML = html;
    lastView = html;
    if (focusedName) view.querySelector(`[name="${CSS.escape(focusedName)}"]`)?.focus();
    fixLabels();
  }
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === ui.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const sheetHTML = sheetView(c);
  if (sheetHTML !== lastSheet) { $('#sheet-host').innerHTML = sheetHTML; lastSheet = sheetHTML; }
  const st = store.status();
  const sy = syncState();
  const SYNC_TEXT = { cloud: '已同步到雲端', loading: '正在同步…', signin: '未登入雲端', error: '同步失敗', offline: '離線中', full: '雲端空間不足' };
  const cloudOn = sy.status !== 'off';
  const line = st.saveError ? '未能儲存' : cloudOn ? SYNC_TEXT[sy.status] || '已存在這部裝置' : '已存在這部裝置';
  const dot = st.saveError || ['error', 'full'].includes(sy.status) ? 'is-warn' : sy.status === 'cloud' || !cloudOn ? 'k-ok' : 'is-off';
  const sub = sy.status === 'cloud' && sy.user ? `${esc(sy.user.email)}${sy.lastSync ? ' · ' + fmtTime(sy.lastSync) : ''}` : cloudOn ? esc(sy.message || '離線也能記錄') : `${st.lastSaved ? `最後儲存 ${fmtTime(st.lastSaved)} · ` : ''}<a href="#/settings">登入 Google 同步</a>`;
  $('#sync-card').innerHTML = `<span class="sync-line"><i class="dot ${dot}"></i>${line}</span><span class="fine">${sub}</span>`;
}

// 按實際寬度隱藏會互相重疊的時間刻度；午夜的刻度優先保留。
function fixLabels() {
  document.querySelectorAll('.lane-labels, .ribbon-labels, .wk-track-head').forEach((box) => {
    const spans = [...box.children];
    spans.forEach((sp) => { sp.style.visibility = ''; });
    const boxRect = box.getBoundingClientRect();
    const order = spans.slice().sort((x, y) => (y.classList.contains('is-mid') ? 1 : 0) - (x.classList.contains('is-mid') ? 1 : 0));
    const kept = [];
    for (const sp of order) {
      const r = sp.getBoundingClientRect();
      const outside = r.left < boxRect.left - 1 || r.right > boxRect.right + 1;
      if (outside || kept.some((k) => r.left < k.right + 10 && r.right + 10 > k.left)) { sp.style.visibility = 'hidden'; continue; }
      kept.push(r);
    }
  });
}

function toast(msg, actionHTML = '') {
  const el = $('#toast');
  el.innerHTML = `<span>${msg}</span>${actionHTML}`;
  el.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-on'), 3200);
}

function route() {
  const r = (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0];
  ui.route = ROUTES[r] ? r : 'today';
  ui.mealEdit = null;
  ui.mealPhoto = undefined;
  lastView = '';
  dirty = false;
  render();
  if (ui.route !== 'today') $('#view')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function parseRef(s) {
  const [type, id, field] = s.split(':');
  return { type, id, field: field || undefined };
}

function openRecord(wd) {
  const c = ctx();
  const key = wd || c.wd;
  ui.sheet = { type: 'record', wd: key, step: defaultStep(c.data, key) };
  render();
  setTimeout(() => $('.sheet button, .sheet input')?.focus(), 30);
}

function closeSheet() {
  ui.sheet = null;
  render();
}

function confirmFirst(el, title, body, confirm) {
  if (el.dataset.confirmed) { ui.sheet = null; return true; }
  ui.sheet = { type: 'confirm', title, body, confirm, action: el.dataset.action };
  render();
  return false;
}

// 相片：裝置上縮小到最長邊 1280px、256 KiB 以內的 JPEG。
async function compressPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.82, 0.7, 0.58, 0.46]) {
        const out = canvas.toDataURL('image/jpeg', q);
        if ((out.length - 23) * 0.75 <= 256 * 1024) return out;
      }
      scale *= 0.75;
    }
    throw new Error('too-big');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const handlers = {
  'sync-in': () => signIn(),
  'sync-out': () => { signOut(); toast('已登出，這部裝置上的紀錄仍然保留'); },
  'hero-poke': () => {
    const h = $('.hero');
    if (!h) return;
    h.classList.remove('is-poked');
    void h.getBoundingClientRect();
    h.classList.add('is-poked');
    clearTimeout(handlers.pokeT);
    handlers.pokeT = setTimeout(() => h.classList.remove('is-poked'), 1000);
  },
  'step': (el) => {
    const step = el.dataset.step;
    act.recordStep(step, nowFn());
    toast(`已記錄${el.textContent.replace(' · 現在', '').replace('記錄', '').trim()} ${fmtTime(nowFn())}`);
  },
  'break': () => { act.toggleBreak(nowFn()); toast('已更新休息'); },
  'sleep-start': () => { act.startSleep(nowFn()); toast(`已開始睡眠計時 ${fmtTime(nowFn())}`); },
  'wake': () => { act.wakeUp(nowFn()); toast(`早安，起床時間 ${fmtTime(nowFn())}`); },
  'open-record': (el) => openRecord(el.dataset.wd),
  'close-sheet': closeSheet,
  'close-sheet-nav': () => { ui.sheet = null; },
  'rec-step': (el) => { ui.sheet.step = el.dataset.step; render(); },
  'rec-now': () => { const t = nowFn(); $('#record-form [name=date]').value = dateKey(t); $('#record-form [name=time]').value = fmtTime(t); },
  'rec-minus': () => {
    const f = $('#record-form');
    const t = fromInputs(f.date.value, f.time.value) - 15 * MIN;
    f.date.value = dateKey(t); f.time.value = fmtTime(t);
  },
  'rec-plan': (el) => { const t = Number(el.dataset.t); const f = $('#record-form'); f.date.value = dateKey(t); f.time.value = fmtTime(t); },
  'wd-shift': (el) => { const c = ctx(); ui.wd = addDays(c.wd, Number(el.dataset.dir)); render(); },
  'wd-auto': () => { ui.wd = null; render(); },
  'tl-shift': (el) => {
    const c = ctx();
    if (ui.tlMode === 'workday') ui.wd = addDays(c.wd, Number(el.dataset.dir));
    else ui.calKey = addDays(ui.calKey || dateKey(c.now), Number(el.dataset.dir));
    render();
  },
  'tl-day': (el) => { if (ui.tlMode === 'workday') ui.wd = el.dataset.key; else ui.calKey = el.dataset.key; render(); },
  'seg': (el) => {
    if (el.dataset.seg === 'theme') { act.saveSettings({ theme: el.dataset.value }); return; }
    ui[el.dataset.seg] = el.dataset.value;
    if (el.dataset.seg === 'statsPeriod') ui.statsOffset = 0;
    render();
  },
  'select-ref': (el) => { ui.selRef = el.dataset.ref; render(); },
  'edit-ref': (el) => { ui.sheet = { type: 'ref', ref: parseRef(el.dataset.ref), t: Number(el.dataset.t), title: el.dataset.title }; render(); },
  'week-shift': (el) => { ui.weekOffset += Number(el.dataset.dir); render(); },
  'month-shift': (el) => {
    const c = ctx();
    const m = ui.monthKey || monthStartKey(dateKey(c.now));
    ui.monthKey = Number(el.dataset.dir) < 0 ? monthStartKey(addDays(m, -1)) : monthEndKey(m);
    render();
  },
  'cal-pick': (el) => {
    const k = el.dataset.key;
    if (ui.batch) ui.batchDays = ui.batchDays.includes(k) ? ui.batchDays.filter((x) => x !== k) : [...ui.batchDays, k];
    else ui.calDay = ui.calDay === k ? null : k;
    render();
  },
  'batch-toggle': () => { ui.batch = !ui.batch; ui.batchDays = []; render(); },
  'batch-clear': () => { ui.batchDays = []; render(); },
  'batch-off': () => { for (const k of ui.batchDays) act.toggleDayOff(k); ui.batchDays = []; toast('已更新休息日'); },
  'tpl-apply': (el) => {
    const keys = ui.batch ? ui.batchDays : ui.calDay ? [ui.calDay] : [];
    act.applyTemplate(el.dataset.id, keys);
    if (ui.batch) ui.batchDays = [];
    toast(`已建立 ${keys.length} 天的班次`);
  },
  'tpl-delete': (el) => act.deleteTemplate(el.dataset.id),
  'shift-delete': (el) => act.deleteShift(el.dataset.id),
  'day-off': (el) => { const on = store.get().dayMarks.some((m) => m.date === el.dataset.key); act.toggleDayOff(el.dataset.key); toast(on ? '已取消休息日' : '已設為休息日'); },
  'sleep-wd-clear': (el) => { act.updateSleep(el.dataset.id, { workdayDate: null }); toast('改為按入睡日期'); },
  'sleep-delete': (el) => act.deleteSleep(el.dataset.id),
  'sleep-reuse': () => {
    const d = store.get();
    const now = nowFn();
    const last = d.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
    if (!last) return;
    let start = fromInputs(dateKey(now), fmtTime(last.start));
    if (start <= now) start = fromInputs(addDays(dateKey(now), 1), fmtTime(last.start));
    act.addSleepPlan(start, start + (last.end - last.start));
    toast(`已建立計畫 ${fmtTime(start)} 開始`);
  },
  'meal-confirm': (el) => { act.confirmMeal(el.dataset.id); toast('已確認這一餐'); },
  'meal-delete': (el) => { act.deleteMeal(el.dataset.id); if (ui.sheet?.type === 'ref') ui.sheet = null; toast('已刪除'); },
  'meal-edit': (el) => { ui.mealEdit = el.dataset.id; ui.mealPhoto = undefined; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  'meal-cancel': () => { ui.mealEdit = null; ui.mealPhoto = undefined; render(); },
  'meal-photo-remove': () => { ui.mealPhoto = null; lastView = ''; render(); },
  'stats-shift': (el) => { ui.statsOffset += Number(el.dataset.dir); render(); },
  'stats-job': (el) => { ui.statsJob = el.dataset.id; render(); },
  'income-edit': (el) => { ui.incomeEdit = el.dataset.id; render(); },
  'income-cancel': () => { ui.incomeEdit = null; render(); },
  'job-edit': (el) => { ui.jobEdit = el.dataset.id; render(); },
  'job-cancel': () => { ui.jobEdit = null; render(); },
  'job-delete': (el) => act.deleteJob(el.dataset.id),
  'export-json': () => { download(`ontime-backup-${dateKey(nowFn())}.json`, act.exportJSON(), 'application/json'); toast('已匯出 JSON 備份'); },
  'export-csv': () => { download(`ontime-${dateKey(nowFn())}.csv`, act.exportCSV(nowFn()), 'text/csv;charset=utf-8'); toast('已匯出 CSV'); },
  'demo': (el) => { if (confirmFirst(el, '載入示範資料？', '會用一組示範紀錄取代目前所有資料。如果有自己的紀錄，請先匯出備份。', '載入示範')) { act.loadDemo(nowFn()); ui.wd = null; location.hash = '#/today'; toast('已載入示範資料'); } },
  'clear-all': (el) => { if (confirmFirst(el, '清除所有資料？', '這部裝置上的所有紀錄都會刪除，不能復原。建議先匯出 JSON 備份。', '全部清除')) { act.clearAll(); toast('已清除所有資料'); } },
  'install': async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; ui.canInstall = false; render(); } }
};

const forms = {
  'record': (f) => {
    const t = fromInputs(f.date.value, f.time.value);
    if (t == null) return;
    const extra = {};
    if (f.endTime && f.endTime.value) extra.end = fromInputs(f.endDate.value || f.date.value, f.endTime.value);
    act.setStepTime(f.wd.value, f.step.value, t, extra);
    ui.sheet = null;
    toast(`已儲存 ${fmtTime(t)}`);
  },
  'ref-time': (f) => {
    const t = fromInputs(f.date.value, f.time.value);
    act.setRefTime({ type: f.type.value, id: f.id.value, field: f.field.value || undefined }, t);
    ui.selRef = `${f.type.value}:${f.id.value}:${f.field.value}`;
    ui.sheet = null;
    toast('已更新時間');
  },
  'meal': (f) => {
    const start = fromInputs(f.date.value, f.start.value);
    let end = f.end.value ? fromInputs(f.date.value, f.end.value) : null;
    if (end != null && end < start) end += 24 * HOUR;
    const existing = f.id.value ? store.get().meals.find((m) => m.id === f.id.value) : null;
    act.saveMeal({
      ...(f.id.value ? { id: f.id.value } : {}),
      start, end, confirmed: f.confirmed.value === '1',
      name: f.name.value.trim(), place: f.place.value.trim(), note: f.note.value.trim(),
      photo: ui.mealPhoto !== undefined ? ui.mealPhoto : existing?.photo ?? null
    });
    ui.mealEdit = null; ui.mealPhoto = undefined;
    toast('已儲存這一餐');
  },
  'sleep-plan': (f) => {
    const s = fromInputs(f.sd.value, f.st.value);
    const e = fromInputs(f.ed.value, f.et.value);
    if (e <= s) { toast('起床時間要晚於入睡時間'); return; }
    act.addSleepPlan(s, e);
    toast('已儲存睡眠計畫');
  },
  'sleep-workday': (f) => { act.updateSleep(f.id.value, { workdayDate: f.wd.value || null }); toast('已更改所屬工作日'); },
  'tpl-add': (f) => { act.saveTemplate({ name: f.name.value.trim(), jobId: f.jobId.value, start: f.start.value, end: f.end.value }); toast('已新增範本'); },
  'shift-add': (f) => { act.addShift(f.jobId.value, f.key.value, f.start.value, f.end.value); toast('已加入班次'); },
  'income': (f) => {
    const inc = f.income.value === '' ? null : Number(f.income.value);
    const ord = f.orders.value === '' ? null : Number(f.orders.value);
    act.setSessionIncome(f.id.value, { income: inc, orders: ord });
    ui.incomeEdit = null;
    toast('已儲存收入');
  },
  'settings': (f) => { act.saveSettings({ name: f.name.value.trim(), commuteOutMin: Number(f.commuteOutMin.value) || 0, commuteBackMin: Number(f.commuteBackMin.value) || 0 }); toast('已儲存設定'); },
  'job': (f) => {
    act.saveJob({ ...(f.id.value ? { id: f.id.value } : {}), name: f.name.value.trim(), color: f.color.value, payMode: f.payMode.value, rate: f.rate.value === '' ? null : Number(f.rate.value) });
    ui.jobEdit = null;
    toast('已儲存工作');
  }
};

let deferredPrompt = null;

function bind() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = handlers[el.dataset.action];
    if (!fn) return;
    if (el.tagName !== 'A') e.preventDefault();
    if (el.dataset.action === 'close-sheet-nav') { ui.sheet = null; return; }
    fn(el);
  });
  document.addEventListener('input', (e) => { if (e.target.closest('form')) dirty = true; });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    dirty = false;
    forms[f.dataset.form]?.(f);
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.dataset.action === 'rec-wd' && el.value) {
      ui.sheet.wd = el.value;
      ui.sheet.step = defaultStep(store.get(), el.value);
      render();
    }
    if (el.dataset.action === 'meal-photo' && el.files?.[0]) {
      try {
        ui.mealPhoto = await compressPhoto(el.files[0]);
        lastView = '';
        render();
      } catch {
        toast('這張相片太大或無法讀取，請換一張');
      }
    }
    if (el.dataset.action === 'import-json' && el.files?.[0]) {
      const mode = document.querySelector('input[name=importMode]:checked')?.value || 'merge';
      try {
        const text = await el.files[0].text();
        act.importJSON(text, mode);
        toast(mode === 'replace' ? '已用備份取代目前資料' : '已合併備份中的新紀錄');
      } catch (err) {
        toast(err.message && err.message.includes('ONTIME') ? err.message : '讀取失敗：檔案格式不正確');
      }
      el.value = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sheet) { closeSheet(); return; }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.key === 'n' || e.key === 'N') && !ui.sheet) { e.preventDefault(); openRecord(); }
  });
  window.addEventListener('hashchange', route);
  desktopMQ.addEventListener('change', () => { lastView = ''; render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render());
  let resizeT = null;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(fixLabels, 120); });
  document.fonts?.ready.then(fixLabels);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; ui.canInstall = true; render(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

async function start() {
  shell();
  await store.load();
  store.subscribe(() => render());
  onSync(() => { lastView = ''; render(); });
  initSync();
  bind();
  route();
  // 每 30 秒更新倒數；正在輸入時不重畫，避免打斷。
  setInterval(() => {
    const a = document.activeElement;
    if (dirty || (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) return;
    render();
  }, 30000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !params.has('nosw')) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            toast('有新版本', '<button type="button" class="btn btn-lime btn-sm" onclick="location.reload()">更新</button>');
          }
        });
      });
    }).catch(() => {});
  }
}

start();
