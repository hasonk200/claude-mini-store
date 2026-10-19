import * as store from './store.js';
import * as act from './actions.js';
import { icon, esc } from './ui.js';
import { dateKey, addDays, fromInputs, monthStartKey, monthEndKey, MIN, HOUR, fmtTime, wdOfKey, fmtMD } from './time.js';
import { currentWorkday, currentCycle, workdayEvents, sleepWorkdayChanges, dayOf, inferSleepWorkday, sleepWorkday } from './logic.js';
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
  selRef: null, sheet: null, mealEdit: null, mealPhoto: undefined, incomeEdit: null, jobEdit: null, canInstall: false,
  pendingRecord: null, pendingDelete: null
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
      <p class="kbd-help"><kbd>Space</kbd> 主按鈕 · <kbd>[</kbd><kbd>]</kbd> 切換工作日</p>
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

const UNDO = '<button type="button" class="btn btn-lime btn-sm" data-action="undo">復原</button>';
function toastUndo(msg) { toast(msg, UNDO, 6000); }

function toast(msg, actionHTML = '', ms = 3200) {
  const el = $('#toast');
  el.innerHTML = `<span>${msg}</span>${actionHTML}`;
  el.classList.add('is-on');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('is-on'), ms);
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

const RECORD_STEPS = new Set(['out', 'ride', 'arrive', 'clockIn', 'clockOut', 'break', 'leave', 'ride2', 'home', 'meal', 'sleepStart', 'sleepEnd']);

function openRecord(wd, step) {
  const c = ctx();
  const key = wd || c.wd;
  ui.sheet = { type: 'record', wd: key, step: RECORD_STEPS.has(step) ? step : defaultStep(c.data, key) };
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

const DELETE_TEXT = {
  sleep: '整筆睡眠都會刪除，前後工作日的歸屬可能跟著改變。',
  meal: '這一餐和它的相片都會刪除。',
  shift: '這個班表會刪除，這天會變成沒有排班。',
  rest: '這一段休息會刪除，不影響工時。'
};

function deleteBody(ref) {
  if (ref.type === 'session') {
    if (ref.field === 'break') return '只會刪除這一段休息，工時會跟著調整。';
    if (ref.field === 'end') return '只會清掉下班時間，這班回到「工作中」；收入不會刪除。';
    return '整班都會刪除：上班時間、收入、休息、去程和回程一起消失，班表不會受影響。';
  }
  if (ref.type === 'journey') return '只會清掉這一個時間，其他行程欄位保留。';
  return DELETE_TEXT[ref.type] || '這一筆紀錄會刪除。';
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
    const r = act.recordStep(step, nowFn());
    if (!r.ok) { toast('剛剛已經記過了，等一下再按'); return; }
    toastUndo(`已記錄${el.textContent.replace(' · 現在', '').replace('記錄', '').trim()} ${fmtTime(nowFn())}`);
  },
  'meal-fill': (el) => {
    const input = document.querySelector(`form[data-form=meal] [name="${el.dataset.field}"]`);
    if (!input) return;
    input.value = el.dataset.value;
    dirty = true;
    input.focus();
  },
  'undo': () => { if (store.undo()) toast('已復原'); },
  'show-templates': () => { ui.showTemplates = true; render(); },
  'break': () => {
    const working = store.get().sessions.some((x) => x.end == null);
    if (working) { act.toggleBreak(nowFn()); toastUndo('已更新休息'); return; }
    const r = act.toggleRest(nowFn());
    toastUndo(r.opened ? '開始休息' : '結束休息');
  },
  'sleep-start': () => {
    const r = act.startSleep(nowFn());
    if (!r.ok) { toast('已經有一筆進行中的睡眠，先按「現在起床」'); return; }
    toastUndo(`已開始睡眠計時 ${fmtTime(nowFn())}`);
  },
  'wake': () => {
    const r = act.wakeUp(nowFn());
    if (!r.ok) {
      toast(r.reason === 'before-start' ? '起床時間不能早於入睡時間' : '現在沒有進行中的睡眠');
      return;
    }
    toastUndo(`早安，起床時間 ${fmtTime(nowFn())}`);
  },
  'open-record': (el) => openRecord(el.dataset.wd, el.dataset.step),
  'close-sheet': closeSheet,
  'close-sheet-nav': () => { ui.sheet = null; },
  'record-force': () => {
    const p = ui.pendingRecord;
    ui.pendingRecord = null;
    if (p) applyRecord(p);
  },
  'record-cancel': () => {
    // 取消後回到補登面板，保留剛才填的時間。
    const p = ui.pendingRecord;
    ui.pendingRecord = null;
    ui.sheet = p ? { type: 'record', wd: p.wd, step: p.step, t: p.t } : null;
    render();
  },
  'rec-step': (el) => { ui.sheet.step = el.dataset.step; render(); },
  'rec-now': () => { const t = nowFn(); $('#record-form [name=date]').value = dateKey(t); $('#record-form [name=time]').value = fmtTime(t); },
  'rec-minus': () => {
    const f = $('#record-form');
    const t = fromInputs(f.date.value, f.time.value) - 15 * MIN;
    f.date.value = dateKey(t); f.time.value = fmtTime(t);
  },
  'ride-mode': (el) => {
    const f = el.closest('form');
    f.mode.value = f.mode.value === el.dataset.v ? '' : el.dataset.v;
    f.querySelectorAll('[data-action="ride-mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === f.mode.value)));
  },
  'ride-place': (el) => { el.closest('form').from.value = el.dataset.v; },
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
  'batch-off': () => { for (const k of ui.batchDays) act.toggleDayOff(k); ui.batchDays = []; toast('已更新休假'); },
  'tpl-apply': (el) => {
    const keys = ui.batch ? ui.batchDays : ui.calDay ? [ui.calDay] : [];
    act.applyTemplate(el.dataset.id, keys);
    if (ui.batch) ui.batchDays = [];
    toast(`已建立 ${keys.length} 天的班次`);
  },
  'tpl-delete': (el) => act.deleteTemplate(el.dataset.id),
  'shift-delete': (el) => act.deleteShift(el.dataset.id),
  'day-off': (el) => act.toggleDayOff(el.dataset.key),
  'sleep-wd-clear': (el) => { act.setSleepWorkday(el.dataset.id, null); toast('改為按入睡日期'); },
  'sleep-wd-reset': (el) => {
    const n = sleepWorkdayChanges(store.get()).length;
    if (!n) { toast('全部已是最新'); return; }
    if (confirmFirst(el, '重新計算所屬工作日？', `${n} 筆睡眠會依入睡時間重新歸屬；你手動指定過的不受影響。`, '重新計算')) {
      const done = act.resetSleepWorkdays();
      toast(`已重新計算 ${done} 筆睡眠歸屬`);
    }
  },
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
  'meal-confirm': (el) => { act.confirmMeal(el.dataset.id); toastUndo('已確認這一餐'); },
  'meal-delete': (el) => { act.deleteMeal(el.dataset.id); if (ui.sheet?.type === 'ref') ui.sheet = null; toastUndo('已刪除'); },
  'delete-ref': () => {
    const sh = ui.sheet;
    if (!sh || sh.type !== 'ref' || !sh.ref) return;
    // 舊班不能清空下班時間（會變成長期進行中），先擋下來不要跳確認。
    if (sh.ref.type === 'session' && sh.ref.field === 'end') {
      const data = store.get();
      const s = data.sessions.find((x) => x.id === sh.ref.id);
      if (s && data.sessions.some((x) => x.id !== s.id && x.start > s.start)) {
        toast('這班不是最近一班，請直接改時間，不能清空');
        return;
      }
      if (s && s.end != null && nowFn() - s.end > 24 * HOUR) {
        toast('下班已經超過 24 小時，請直接改時間，不能清空');
        return;
      }
    }
    ui.pendingDelete = { ref: sh.ref, t: sh.t };
    ui.sheet = { type: 'confirm', title: '刪除這一筆？', body: deleteBody(sh.ref), confirm: '刪除', action: 'delete-ref-confirm' };
    render();
  },
  'delete-ref-confirm': () => {
    const p = ui.pendingDelete;
    ui.pendingDelete = null;
    ui.sheet = null;
    if (!p) { render(); return; }
    const r = act.deleteRef(p.ref, p.t);
    const msg = r.ok ? '已刪除'
      : r.reason === 'no-end' ? '這班還沒有下班時間'
      : r.reason === 'not-latest' ? '這班不是最近一班，請直接改時間，不能清空'
      : r.reason === 'too-old' ? '下班已經超過 24 小時，請直接改時間，不能清空'
      : '找不到這一筆，可能已經刪除';
    toast(msg);
    render();
  },
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

const RECORD_ERROR = {
  sleeping: '已經有一筆進行中的睡眠，先記「起床」',
  missing: '找不到可以更新的睡眠，請先補登入睡',
  'missing-start': '這筆睡眠沒有入睡時間，請先補登入睡',
  'before-start': '起床時間不能早於入睡時間'
};

// 實際寫入補登，並把「這筆歸到哪個工作日」講清楚。
function applyRecord(p) {
  ui.sheet = null;
  const r = act.setStepTime(p.wd, p.step, p.t, p.extra);
  if (!r.ok) {
    toast(RECORD_ERROR[r.reason] || '沒有可更新的紀錄');
    // 「儲存」模式失敗時留在面板，保留剛填的時間。
    ui.sheet = p.stay ? { type: 'record', wd: p.wd, step: p.step, t: p.t } : null;
    render();
    return;
  }
  let note = '';
  if (r.sleepId) {
    const data = store.get();
    const rec = data.sleeps.find((x) => x.id === r.sleepId);
    if (rec) {
      const wk = sleepWorkday(rec, data);
      if (wk !== p.wd) note = `，歸屬 ${wdOfKey(wk)} ${fmtMD(wk)}`;
    }
  }
  toast(`已儲存 ${fmtTime(p.t)}${note}`);
  // 「儲存」只存不關，讓同一頁可以接著補下一個步驟。
  if (p.stay) ui.sheet = { type: 'record', wd: p.wd, step: p.step };
  render();
}

const forms = {
  'record': (f, e) => {
    const stay = e?.submitter?.value === 'stay';
    const t = fromInputs(f.date.value, f.time.value);
    if (t == null) return;
    const extra = {};
    if (f.endTime && f.endTime.value) extra.end = fromInputs(f.endDate.value || f.date.value, f.endTime.value);
    if (f.mode) { extra.mode = f.mode.value.trim(); extra.from = f.from.value.trim(); }
    if (f.replace && f.replace.checked) extra.replace = true;
    const p = { wd: f.wd.value, step: f.step.value, t, extra, stay };
    // 只能補登「入睡」時先預告歸屬；起床的歸屬由該筆入睡時間決定。
    if (p.step === 'sleepStart') {
      const data = store.get();
      const autoWk = dayOf(data, t) || inferSleepWorkday(t, data);
      if (autoWk !== p.wd) {
        ui.pendingRecord = p;
        ui.sheet = {
          type: 'confirm', title: '所屬工作日不同',
          body: `這筆會歸到 ${wdOfKey(autoWk)} ${fmtMD(autoWk)}，不是 ${wdOfKey(p.wd)} ${fmtMD(p.wd)}。儲存後可在睡眠頁改成你要的工作日。`,
          confirm: '照樣儲存', action: 'record-force', tone: 'ink', cancel: 'record-cancel'
        };
        render();
        return;
      }
    }
    applyRecord(p);
  },
  'ref-time': (f) => {
    const t = fromInputs(f.date.value, f.time.value);
    const extra = f.mode ? { mode: f.mode.value.trim(), from: f.from.value.trim() } : {};
    act.setRefTime({ type: f.type.value, id: f.id.value, field: f.field.value || undefined }, t, extra);
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
  'sleep-workday': (f) => { act.setSleepWorkday(f.id.value, f.wd.value || null); toast('已更改所屬工作日'); },
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
    forms[f.dataset.form]?.(f, e);
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
    if (ui.sheet || tag === 'BUTTON' || tag === 'A') {
      if (!ui.sheet && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); openRecord(); }
      return;
    }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openRecord(); return; }
    const dir = e.key === '[' || e.key === 'ArrowLeft' ? -1 : e.key === ']' || e.key === 'ArrowRight' ? 1 : 0;
    if (dir && ['today', 'timeline', 'meals'].includes(ui.route)) {
      e.preventDefault();
      const c = ctx();
      if (ui.route === 'timeline' && ui.tlMode === 'calendar') ui.calKey = addDays(ui.calKey || dateKey(c.now), dir);
      else ui.wd = addDays(c.wd, dir);
      render();
      return;
    }
    if (e.key === ' ' && ui.route === 'today') {
      if (e.repeat) return; // 長按 Space 只算一次
      const main = document.querySelector('#view .status-card [data-action=step], #view .status-card [data-action=wake]');
      if (main) { e.preventDefault(); main.click(); }
    }
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
  // 主畫面捷徑：?do=out|clockIn|sleep|meal
  const doAct = params.get('do');
  if (doAct) {
    history.replaceState(null, '', location.pathname + (fixedNow ? `?now=${params.get('now')}` : '') + location.hash);
    if (doAct === 'meal') location.hash = '#/meals';
    else if (doAct === 'sleep') {
      const r = act.startSleep(nowFn());
      if (r.ok) toastUndo(`已開始睡眠計時 ${fmtTime(nowFn())}`);
      else toast('已經有一筆進行中的睡眠，先按「現在起床」');
    }
    else if (doAct === 'out' || doAct === 'clockIn') {
      const r = act.recordStep(doAct, nowFn());
      if (r.ok) toastUndo(`已記錄${doAct === 'out' ? '出門' : '上班'} ${fmtTime(nowFn())}`);
      else toast('剛剛已經記過了，等一下再按');
    }
  }
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
