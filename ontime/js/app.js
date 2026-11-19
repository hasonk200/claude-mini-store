import { clockRange, restTarget, copyWeek, reminderCalendar, missingSleepDays, tripPrefill, shiftTripPrefill, tripStepGaps } from './planning.js';
import { rangeText } from './views/planning.js';
import { backupCSV } from './backup.js';
import { readTemp, tempPreview, importTemp } from './temp-import.js';
import { workdayOfSession } from './logic.js';
import * as store from './store.js';
import * as act from './actions.js';
import { icon, esc } from './ui.js';
import { dateKey, addDays, fromInputs, monthStartKey, monthEndKey, MIN, HOUR, fmtTime, wdOfKey, wdOf, fmtMD, fmtDayMD, normTime, endOnOrAfter, fmtDur } from './time.js';
import { quickWakeState, QUICK_WAKE_ERROR, lastClockBefore, latestOpenSleep, STEPS, tripState, tripErrorText, tripAllVerified } from './logic.js';
import { activeSession, shiftDateMismatch, mealWorkday, mealAutoWorkday, restWorkday, restAutoWorkday, journeyAutoWorkday, needsWorkdayConfirm, currentWorkday, currentCycle, workdayEvents, sleepWorkdayChanges, dayOf, inferSleepWorkday, sleepWorkday, resolveStepTime, shiftDistance, SHIFT_FAR_MS } from './logic.js';
import { todayView, refKey, heroFor } from './views/today.js';
import { phaseOf } from './views/shared.js';
import { timelineView } from './views/timeline.js';
import { weekView } from './views/week.js';
import { sleepView } from './views/sleep.js';
import { mealsView } from './views/meals.js';
import { statsView } from './views/stats.js';
import { settingsView } from './views/settings.js';
import { sheetView, defaultStepIn, openRecordSheet, previewText, freePreviewText, quickWakePreview, quickWakeChips, mealMovePreview, openTripSheet, tripHint, tripSummaryHTML, tripGroupDurText, tripGapHTML } from './views/sheet.js';
import { sleepPairPreview, SLEEP_PAIR_ERROR, sleepEndKey } from './views/sleep.js';
import { mealPreview } from './views/meals.js';
import { initSync, onSync, syncState, signIn, signOut, retrySync } from './sync.js';
import { syncSummary, workdayPreview } from './views/shared.js';

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

const APP_VERSION = '2.42.0';
const ui = {
  route: 'today', wd: null, tlMode: 'workday', calKey: null, weekMode: 'workday', weekOffset: 0,
  monthKey: null, calDay: null, batch: false, batchDays: [], statsPeriod: 'week', statsOffset: 0, statsJob: 'all',
  selRef: null, sheet: null, jobEdit: null, canInstall: false, appVersion: APP_VERSION,
  pendingRecord: null, pendingDelete: null, flash: null, sleepSaved: null,
  drafts: loadDrafts(), heroCollapsed: loadPref('ontime-scene') !== 'on',
  todayMore: loadPref('ontime-today-more') === 'open',
  sleepFill: loadPref('ontime-sleep-fill') === 'open', sleepAttr: loadPref('ontime-sleep-attr') === 'open',
  mealFill: loadPref('ontime-meal-fill') === 'open'
};
// 可以展開／收起、而且會記住的區塊。
const PREF_KEYS = { todayMore: 'ontime-today-more', sleepFill: 'ontime-sleep-fill', sleepAttr: 'ontime-sleep-attr', mealFill: 'ontime-meal-fill' };

// 只屬於這部裝置的小偏好（例如街景收起）；讀不到就用預設。
function loadPref(key) { try { return localStorage.getItem(key); } catch { return null; } }
function savePref(key, v) { try { localStorage.setItem(key, v); } catch { /* 忽略 */ } }

// ---------- 表單草稿 ----------
// 有 data-draft 的表單，每次輸入都存一份（連相片）。重畫、同步、加相片、切換分頁都用草稿的值，
// 不會清空未儲存的輸入；同一個分頁重新載入也還在（sessionStorage）。儲存或清除後才刪。
function loadDrafts() {
  try { return JSON.parse(sessionStorage.getItem((store.demoMode ? 'ontime-demo-drafts' : 'ontime-drafts'))) || {}; } catch { return {}; }
}
function persistDrafts() {
  try { sessionStorage.setItem((store.demoMode ? 'ontime-demo-drafts' : 'ontime-drafts'), JSON.stringify(ui.drafts)); } catch { /* 空間不足或不能用：只留在記憶體 */ }
}
function captureDraft(form) {
  const key = form?.dataset.draft;
  if (!key) return;
  const vals = {};
  for (const el of form.querySelectorAll('input[name], select[name], textarea[name]')) {
    if (el.type === 'file' || (el.type === 'hidden' && !el.hasAttribute('data-keep'))) continue;
    vals[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  ui.drafts[key] = { ...ui.drafts[key], ...vals };
  persistDrafts();
}
function clearDraft(key) {
  if (!key || !(key in ui.drafts)) return;
  delete ui.drafts[key];
  persistDrafts();
}

// 剛儲存的那一筆在列表原位亮一下，不捲動頁面。
let flashT = null;
function flash(key) {
  ui.flash = key;
  clearTimeout(flashT);
  flashT = setTimeout(() => { ui.flash = null; render(); }, 2600);
}

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
  return { data, now, ui, wd, isDesktop: desktopMQ.matches, sync: { state: syncState(), status: store.status() } };
}

function shell() {
  const side = SIDEBAR.map((r) => `<a href="#/${r}" class="side-link" data-route="${r}">${icon(ROUTES[r].icon, 20, 1.9)}<span>${ROUTES[r].title}</span></a>`).join('');
  const tabs = TABBAR.map(([r, label, ic]) => r === '+'
    ? `<button type="button" class="tab-plus" data-action="open-record" aria-label="新增記錄">${icon(ic, 24, 2.4)}</button>`
    : `<a href="#/${r}" class="tab" data-route="${r}">${icon(ic, 23, 1.9)}<span>${label}</span></a>`).join('');
  document.body.innerHTML = `
  <a class="skip" href="#view">跳到主要內容</a>
  ${store.demoMode ? '<div class="demo-banner">示範模式 <button class="btn btn-line" data-action="exit-demo">返回我的紀錄</button></div>' : ''}
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
let lastSheetType = null;
let sheetCloseTimer = null;
let sheetScrollToForm = false;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 焦點的「身分」：重畫後用來找回同一個按鈕或欄位（鍵盤操作時焦點不會掉到頁面最頂）。
function focusKey(el) {
  if (!el || el === document.body) return null;
  if (el.name) return `[name="${CSS.escape(el.name)}"]`;
  const a = el.dataset?.action;
  if (!a) return el.id ? `#${CSS.escape(el.id)}` : null;
  let sel = `[data-action="${CSS.escape(a)}"]`;
  for (const k of ['cat', 'step', 'sid', 'id', 'dir', 'key', 'ref']) if (el.dataset[k] != null) sel += `[data-${k}="${CSS.escape(el.dataset[k])}"]`;
  return sel;
}
let sheetOpener = null;
let sheetOpenerKey = null;

// 面板：第一次打開向上滑入；之後只換內容（不閃、捲動位置不變）；關閉時向下滑出再移除。
// 鍵盤／讀屏：打開時焦點移到面板標題；換內容時焦點留在同一個按鈕；關閉時回到打開它的按鈕。
function swapSheet(html, type) {
  const host = $('#sheet-host');
  clearTimeout(sheetCloseTimer);
  const old = host.querySelector('.sheet');
  const wasOpen = !!old && !old.classList.contains('is-leave');
  if (!html) {
    lastSheetType = null;
    const back = sheetOpener;
    const backKey = sheetOpenerKey;
    sheetOpener = null; sheetOpenerKey = null;
    const restore = () => {
      const el = back && back !== document.body && document.contains(back) ? back : backKey ? document.querySelector(`#view ${backKey}, .tabbar ${backKey}, #hero-host ${backKey}`) : null;
      (el || $('#view'))?.focus({ preventScroll: true });
    };
    if (!wasOpen || reduceMotion()) { host.innerHTML = ''; if (wasOpen) restore(); return; }
    host.querySelectorAll('.sheet, .sheet-backdrop').forEach((el) => { el.classList.remove('is-enter'); el.classList.add('is-leave'); });
    restore();
    sheetCloseTimer = setTimeout(() => { host.innerHTML = ''; }, 240);
    return;
  }
  const top = old?.querySelector('.sheet-body')?.scrollTop ?? 0;
  const enter = !wasOpen || type !== lastSheetType;
  const active = document.activeElement;
  const keepKey = !enter && host.contains(active) ? focusKey(active) : null;
  if (!wasOpen) { sheetOpener = active && !host.contains(active) ? active : null; sheetOpenerKey = focusKey(sheetOpener); }
  host.innerHTML = html;
  enhanceTimeInputs(host);
  lastSheetType = type;
  if (enter) {
    host.querySelectorAll('.sheet, .sheet-backdrop').forEach((el) => el.classList.add('is-enter'));
    const title = host.querySelector('#sheet-title');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  } else {
    const body = host.querySelector('.sheet-body'); if (body) body.scrollTop = top;
    if (keepKey) host.querySelector(keepKey)?.focus({ preventScroll: true });
  }
  if (sheetScrollToForm) {
    sheetScrollToForm = false;
    setTimeout(scrollSheetToForm, enter && !reduceMotion() ? 280 : 0);
  }
}

// 選了步驟之後，慢慢捲到「X 在什麼時候？」輸入時間的位置。
function scrollSheetToForm() {
  const body = $('#sheet-host .sheet-body');
  const target = $('#sheet-host #record-form .sheet-step-title');
  if (!body || !target) return;
  const y = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 8;
  body.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' });
}
let dirty = false;

const THEME_WASH = {
  light: { night: '#DCE1F0', dawn: '#FBE8DC', day: '#D6E7FF', dusk: '#EDE3F3' },
  dark: { night: '#111A31', dawn: '#21171A', day: '#111A28', dusk: '#1C1629' }
};
function applyTheme(theme, phase = 'day') {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme; else delete root.dataset.theme;
  try { localStorage.setItem('ontime-theme', theme || 'auto'); } catch { /* 忽略 */ }
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const wash = THEME_WASH[dark ? 'dark' : 'light'][phase] || (dark ? '#0B1018' : '#EEF1F5');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', wash);
}

// 背景重畫（同步、定時更新、標示過期）遇到你正在欄位裡打字：先不換畫面，離開欄位後才更新。
// 你自己按的按鈕、送出的表單照常立即更新。
let userDepth = 0;
let pendingView = false;
let pendingSheet = false;
function asUser(fn) { userDepth++; try { return fn(); } finally { userDepth--; } }
function typingIn(sel) {
  const a = document.activeElement;
  return !!(a && a.closest?.(sel) && a.matches('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"])'));
}

function render() {
  const c = ctx();
  // 頁頂底色跟時段（夜晚、清晨、日間、黃昏）；只按鐘數，唔會閃。
  const phase = phaseOf(c.now);
  applyTheme(c.data.settings.theme, phase);
  if (document.documentElement.dataset.phase !== phase) document.documentElement.dataset.phase = phase;
  const r = ROUTES[ui.route] || ROUTES.today;
  document.title = `${r.title} · ONTIME`;
  // 首頁頂部場景只在內容改變時才重畫，動畫不會因定時更新而跳回起點。
  const heroHost = $('#hero-host');
  // 街景（插畫）預設關閉，喺「我的 › 外觀」開；開咗先喺首頁頂顯示。
  const heroHTML = ui.route === 'today' && !ui.heroCollapsed ? heroFor(c.data, c.wd, currentCycle(c.data, c.now), c.now, !c.isDesktop, false) : '';
  if (heroHTML !== lastHero) { heroHost.innerHTML = heroHTML; lastHero = heroHTML; }
  const html = r.view(c);
  const holdView = !userDepth && typingIn('#view');
  if (html !== lastView && holdView) pendingView = true;
  else if (html !== lastView) {
    pendingView = false;
    const view = $('#view');
    const keep = focusKey(view.contains(document.activeElement) ? document.activeElement : null);
    const focusedName = document.activeElement?.name;
    view.innerHTML = html;
    lastView = html;
    if (focusedName) view.querySelector(`[name="${CSS.escape(focusedName)}"]`)?.focus();
    else if (keep) view.querySelector(keep)?.focus({ preventScroll: true });
    fixLabels();
    enhanceTimeInputs(view);
  }
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === ui.route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const sheetHTML = sheetView(c);
  const holdSheet = !userDepth && sheetHTML && typingIn('#sheet-host');
  if (sheetHTML !== lastSheet && holdSheet) pendingSheet = true;
  else if (sheetHTML !== lastSheet) { pendingSheet = false; swapSheet(sheetHTML, ui.sheet?.type || null); lastSheet = sheetHTML; }
  // 點了已經選中的步驟：內容沒變，也要捲到輸入位置。
  else if (sheetScrollToForm) { sheetScrollToForm = false; scrollSheetToForm(); }
  const st = store.status();
  const sy = syncState();
  const cloudOn = sy.status !== 'off';
  const sum = syncSummary(sy, st);
  const line = sum.line;
  const dot = sum.tone === 'warn' ? 'is-warn' : sum.tone === 'ok' ? 'k-ok' : 'is-off';
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
  ui.sleepSaved = null;
  lastView = '';
  dirty = false;
  // 切換分頁一定立即重畫（就算焦點還留在上一頁的欄位裡）。
  asUser(render);
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

const RECORD_STEPS = new Set(['out', 'ride', 'arrive', 'clockIn', 'clockOut', 'break', 'leave', 'ride2', 'home', 'meal', 'sleepStart', 'sleepEnd', 'sleepPair', 'rest']);

function openRecord(wd, step) {
  const c = ctx();
  const key = wd || c.wd;
  // 冇指定要補邊樣：先出選單（整趟返工、睡眠、用餐、休息），唔使一開始就對住一長串步驟。
  if (!RECORD_STEPS.has(step)) { ui.sheet = { type: 'add-menu', wd: key }; render(); return; }
  ui.sheet = openRecordSheet(c.data, key, step);
  // 由卡片直接指定步驟打開時，滑入後捲到輸入時間的位置。
  if (RECORD_STEPS.has(step)) sheetScrollToForm = true;
  render();
}

function closeSheet() {
  // 主動關掉「修改舊紀錄」的面板 = 放棄修改，不留草稿（免得下次打開以為已經存了）。
  // 新增用的表單照樣保留草稿。
  const sh = ui.sheet;
  if (sh?.type === 'sleep') { clearDraft(`sleep:${sh.id}`); clearDraft(`plan:${sh.id}`); }
  if (sh?.type === 'meal') clearDraft(`meal:${sh.id}`);
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

function showSheet(type, values = {}) {
  ui.sheet = { type, ...values };
  render();
}
function demoURL(on) {
  const url = new URL(location.href);
  if (on) url.searchParams.set('demo','1'); else url.searchParams.delete('demo');
  url.hash = '/today';
  location.assign(url);
}
async function afterRecovery(change) {
  try { await store.saveRecovery(); }
  catch { toast('安全備份未完成，請檢查裝置空間再試'); return; }
  asUser(change);
}
let replacingText = null;
let removeIds = [];
function removePlanned(ids) {
  store.update(d => {
    d.shifts = d.shifts.filter(s=>!ids.includes(s.id));
  });
}
function payFrom(f) {
  return { income:f.income.value === '' ? null : Number(f.income.value),
    orders:f.orders.value === '' ? null : Number(f.orders.value) };
}
const handlers = {
  'exit-demo': () => demoURL(false),
  'rest-open': el => showSheet('rest-only',{wd:el.dataset.wd || ctx().wd}),
  'shift-editor': el => showSheet('shift-editor',{id:el.dataset.id,key:el.dataset.key||ctx().wd}),
  'copy-week': el => showSheet('copy-week',{week:el.dataset.week,rows:copyWeek(store.get(),el.dataset.week)}),
  'copy-confirm': () => {
    const current=copyWeek(store.get(),ui.sheet.week);
    if(JSON.stringify(current)!==JSON.stringify(ui.sheet.rows)){
      ui.sheet.rows=current;render();toast('班表已更新，請再核對預覽');return;
    }
    const rows=current.filter(r=>!r.skip);
    ui.sheet=null;
    if(rows.length) store.update(d=>{for(const {jobId,start,end} of rows) d.shifts.push({id:store.uid('sh'),jobId,start,end});});
    render(); toastUndo(`已複製 ${rows.length} 個班次`);
  },
  'batch-remove': el => {
    if(!el.dataset.confirmed) removeIds=store.get().shifts.filter(s=>ui.batchDays.includes(dateKey(s.start))).map(s=>s.id);
    if(!removeIds.length) {toast('所選日子沒有排班');return}
    if(confirmFirst(el,'清除所選排班？',`將移除 ${removeIds.length} 個排班，保留實際出勤。`,'清除排班')) {
      removePlanned(removeIds); removeIds=[]; ui.batchDays=[]; render(); toastUndo('已清除排班');
    }
  },
  'remove-plan': el => {
    if(!el.dataset.confirmed) removeIds=[ui.sheet.id];
    if(confirmFirst(el,'刪除排班？','實際出勤時間和當時的薪酬會保留。','刪除排班')) {
      removePlanned(removeIds); removeIds=[]; render(); toastUndo('已刪除排班');
    }
  },
  'temp-open': () => showSheet('temp-import'),
  'temp-confirm': () => {
    const sh=ui.sheet, result=importTemp(sh.entries,sh.rows,nowFn());
    if(result.changed) {sh.rows=result.rows;render();toast('紀錄剛更新，請再核對預覽');return}
    ui.sheet=null;render();toastUndo(`已匯入 ${result.count} 筆紀錄`);
  },
  'plan-clock': () => showSheet('plan-clock'),
  'income-open': el => showSheet('income-entry',{id:el.dataset.id}),
  'export-ics': () => {
    const cal=reminderCalendar(store.get(),nowFn());
    if(!cal.count){toast('請先加入未來班表或睡眠計畫，並開啟相應提醒');return}
    download('ontime-reminders.ics',cal.text,'text/calendar;charset=utf-8');toast(`已匯出 ${cal.count} 個提醒`);
  },
  'export-full-csv': () => download(`ontime-backup-${dateKey(nowFn())}.csv`,backupCSV(store.getRaw()),'text/csv;charset=utf-8'),
  'recovery-download': async () => {
    try {
      const data=await store.readRecovery();
      if(!data){toast('這部裝置暫時沒有取代前的備份');return}
      download('ontime-before-replace.json',JSON.stringify({app:'ONTIME',data}),'application/json');
    } catch { toast('讀取安全備份失敗'); }
  },
  'replace-confirm': () => {
    const text=replacingText;
    if(text) afterRecovery(()=>{act.importJSON(text,'replace');replacingText=null;ui.sheet=null;render();toast('已還原完整備份');});
  },
  'sync-in': () => { if(store.demoMode){toast('請先返回自己的紀錄再登入同步');return;} if (ui.sheet?.type === 'sync') ui.sheet = null; signIn(); render(); },
  'sync-open': () => { ui.sheet = { type: 'sync' }; render(); },
  'sync-retry': () => { if(store.demoMode){toast('示範資料只存在這個裝置');return;} retrySync(); toast('正在再試一次同步'); render(); },
  'hero-toggle': () => {
    ui.heroCollapsed = !ui.heroCollapsed;
    savePref('ontime-scene', ui.heroCollapsed ? 'off' : 'on');
    render();
    $('#hero-host .hero-toggle')?.focus();
  },
  'sync-out': () => { signOut(); toast('已登出，這部裝置上的紀錄仍然保留'); },
  'step': (el) => {
    const step = el.dataset.step;
    const r = act.recordStep(step, nowFn());
    if (!r.ok) { toast('剛剛已經記過了，等一下再按'); return; }
    toastUndo(`已記錄${el.textContent.replace(' · 現在', '').replace('記錄', '').trim()} ${fmtTime(nowFn())}`);
  },
  'meal-fill': (el) => {
    const input = el.closest('form')?.querySelector(`[name="${el.dataset.field}"]`);
    if (!input) return;
    input.value = el.dataset.value;
    captureDraft(input.form);
    dirty = true;
    input.focus();
  },
  'undo': () => { if (store.undo()) toast('已復原'); },
  'show-templates': () => { ui.showTemplates = true; render(); },
  'break': () => {
    const working = !!activeSession(store.get());
    if (working) { act.toggleBreak(nowFn()); toastUndo('已更新休息'); return; }
    const r = act.toggleRest(nowFn());
    toastUndo(r.opened ? '開始休息' : r.canceled ? '已取消剛剛的休息' : '結束休息');
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
  // ---------- 整趟：七個時間一次過填 ----------
  'open-trip': (el) => {
    const c = ctx();
    const d = el?.dataset || {};
    ui.sheet = openTripSheet(c.data, d.wd || c.wd, c.now, { sessionId: d.sid || null, journeyId: d.jid || null, focus: d.step || null, isNew: !!d.new });
    render();
    if (d.step) document.querySelector('#sheet-host input[data-autofocus]')?.focus();
  },
  'trip-pick': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    ui.sheet = el.dataset.new ? { type: 'trip', wd: sh.wd, isNew: true } : { type: 'trip', wd: sh.wd, sessionId: el.dataset.sid || null, journeyId: el.dataset.jid || null };
    render();
  },
  'trip-job': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const st = tripState(store.get(), sh, nowFn());
    ui.sheet = { ...sh, focus: null, vals: st.vals, jobId: el.dataset.job };
    render();
  },
  'stale-clear': (el) => {
    if (!el.dataset.confirmed) staleJourneyToDelete = el.dataset.jid || null;
    if (!staleJourneyToDelete) return;
    if (confirmFirst(el, '清除這趟未上班紀錄？', '會先自動在本機保留一份安全備份，清除後亦可以即時「復原」。', '備份並清除')) {
      const jid = staleJourneyToDelete;
      staleJourneyToDelete = null;
      afterRecovery(() => {
        const r = act.deleteTrip({ journeyId: jid });
        lastView = ''; lastSheet = null;
        if (r.ok) toastUndo('已清除這趟未上班紀錄（已自動備份）'); else toast('找不到這一趟');
        render();
      });
    }
  },
  'sleep-catchup': () => {
    const rows = missingSleepDays(store.get(), nowFn(), 7);
    showSheet('sleep-catchup', { rows });
  },
  'sleep-day-fill': (el) => {
    const rows = missingSleepDays(store.get(), nowFn(), 7);
    showSheet('sleep-catchup', { rows, focusWd: el.dataset.wd || null });
  },
  'trip-day': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    ui.sheet = openTripSheet(store.get(), addDays(sh.wd, Number(el.dataset.dir)), nowFn());
    render();
  },
  'trip-now': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const now = nowFn();
    const data = store.get();
    const st = tripState(data, sh, now);
    const k = el.dataset.step;
    const above = STEPS.slice(0, STEPS.indexOf(k)).some((x) => st.vals[x]);
    const below = STEPS.slice(STEPS.indexOf(k) + 1).some((x) => st.vals[x]);
    // 第一格撳「現在」：實際日期一齊跟返今日，唔使自己改。
    const anchor = !above && !below ? dateKey(now) : sh.anchor;
    const nextVals = { ...st.vals, [k]: fmtTime(now) };
    const shifted = sh.prefilled?.length
      ? shiftTripPrefill(data, { ...sh, anchor }, now, k, nextVals)
      : { vals: nextVals, prefilled: [], prefillTimes: sh.prefillTimes };
    ui.sheet = { ...sh, focus: null, anchor, prefilled: shifted.prefilled, prefillTimes: shifted.prefillTimes, vals: shifted.vals };
    render();
  },
  'trip-prefill': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const mode = el.dataset.mode || 'all';
    const res = tripPrefill(store.get(), sh, nowFn(), mode);
    if (!res.ok) {
      const msg = res.reason === 'no-shift' ? '這天未排班'
        : res.reason === 'shift-recorded' ? '呢班已經記咗'
        : res.reason === 'need-work-time' ? '先填上班或下班時間，再補上次通勤'
        : res.reason === 'all-future' ? '班表時間仲未到，暫未有可預填嘅格'
        : '相關格子已經有時間，可以直接改';
      toast(msg);
      return;
    }
    const labels = { out: '出門', ride: '上車', arrive: '抵達', clockIn: '上班', clockOut: '下班', ride2: '上車', home: '到家' };
    const prefillNote = res.skippedFuture.length
      ? `${res.skippedFuture.map((k) => labels[k]).join('、')}未到時間，已留空`
      : '';
    const prefilled = [...new Set([...(sh.prefilled || []), ...res.filledSteps])];
    const hasCom = res.filledSteps.some((k) => ['out', 'ride', 'arrive', 'ride2', 'home'].includes(k));
    ui.sheet = {
      ...sh,
      focus: null,
      vals: res.vals,
      prefilled,
      prefillTimes: res.prefillTimes,
      prefillNote,
      ...(res.jobId ? { jobId: res.jobId } : {}),
      ...(hasCom ? { showCommute: true } : {}),
      ...(res.anchorShifted
        ? { anchor: res.anchor, anchorShifted: true, anchorShiftNote: res.anchorShiftNote }
        : { anchorShifted: false, anchorShiftNote: '' })
    };
    render();
  },
  'trip-commute-show': () => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    ui.sheet = { ...sh, showCommute: true };
    render();
  },
  'trip-wdfix': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const st = tripState(store.get(), sh, nowFn());
    ui.sheet = { ...sh, focus: null, vals: st.vals, wdTo: el.dataset.wd };
    render();
  },
  'trip-clear': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const st = tripState(store.get(), sh, nowFn());
    const k = el.dataset.step;
    const prefilled = (sh.prefilled || []).filter((x) => x !== k);
    const prefillTimes = { ...(sh.prefillTimes || {}) };
    delete prefillTimes[k];
    ui.sheet = { ...sh, focus: null, prefilled, prefillTimes, vals: { ...st.vals, [k]: '' } };
    render();
  },
  'trip-delete': (el) => {
    const sh = ui.sheet;
    if (!el.dataset.confirmed) {
      if (sh?.type !== 'trip') return;
      const st = tripState(store.get(), sh, nowFn());
      tripToDelete = { sessionId: st.trip.session?.id ?? null, journeyId: st.trip.session ? null : st.trip.journey?.id ?? null };
    }
    if (confirmFirst(el, '刪除這一趟？', '這一趟的出門、上班、下班、到家等時間，連同這班的休息和收入都會刪除。', '刪除整趟')) {
      const r = tripToDelete ? act.deleteTrip(tripToDelete) : { ok: false };
      tripToDelete = null;
      lastView = ''; lastSheet = null;
      if (r.ok) toastUndo('已刪除這一趟'); else toast('找不到這一趟');
      render();
    }
  },
  // ---------- 一撳就記 ----------
  // 食咗飯：一撳記低現在；提示裡可以復原或者改時間。
  'quick-meal': () => {
    if (ui.sheet?.type === 'add-menu') ui.sheet = null;
    const now = nowFn();
    const r = act.quickMeal(now);
    if (!r.ok) {
      const m = store.get().meals.find((x) => x.id === r.id);
      ui.sheet = { type: 'meal-quick', id: r.id, base: m?.start };
      toast('啱啱已經記過這一餐');
      render();
      return;
    }
    flash(`meal:${r.id}`);
    toast(`已記低食飯 ${wdOf(now)} ${fmtTime(now)}`, `${UNDO}<button type="button" class="btn btn-toast btn-sm" data-action="meal-quick-open" data-id="${esc(r.id)}">改時間／加相</button>`, 7000);
  },
  'meal-quick-open': (el) => {
    const m = store.get().meals.find((x) => x.id === el.dataset.id);
    if (!m) { toast('找不到這一餐，可能已經復原或刪除'); return; }
    $('#toast')?.classList.remove('is-on');
    ui.sheet = { type: 'meal-quick', id: m.id, base: m.start };
    render();
  },
  'meal-shift': (el) => {
    const sh = ui.sheet;
    if (sh?.type !== 'meal-quick') return;
    const t = sh.base - Number(el.dataset.min) * MIN;
    const r = act.moveMeal(sh.id, t, nowFn());
    if (!r.ok) { toast('這個時間存不到'); return; }
    render();
  },
  // 瞓醒喇：有進行中的睡眠就只問起身時間；沒有就問大概幾點瞓。
  'quick-wake': () => { ui.sheet = { type: 'quick-wake' }; render(); },
  'qw-wake': (el) => { if (ui.sheet?.type !== 'quick-wake') return; ui.sheet = { ...ui.sheet, wakeSel: el.dataset.key, wakeTime: '' }; render(); },
  'qw-start': (el) => { if (ui.sheet?.type !== 'quick-wake') return; ui.sheet = { ...ui.sheet, startSel: el.dataset.key, startTime: '' }; render(); },
  'open-record': (el) => openRecord(el.dataset.wd, el.dataset.step),
  'expected-end-open': (el) => { ui.sheet = { type: 'expected-end', sid: el.dataset.id }; render(); },
  'expected-end-clear': () => {
    const sid = ui.sheet?.sid;
    if (sid) act.setExpectedEnd(sid, null, nowFn());
    ui.sheet = null;
    toast('已清除預計收工');
    render();
  },
  'close-sheet': closeSheet,
  'close-sheet-nav': () => { ui.sheet = null; },
  'record-force': () => {
    const p = ui.pendingRecord;
    ui.pendingRecord = null;
    if (p) applyRecord(p);
  },
  'newshift-use-date': () => { const p = ui.pendingShift; ui.pendingShift = null; if (p) createShiftNow(p, dateKey(p.start)); },
  'newshift-keep-wd': () => { const p = ui.pendingShift; ui.pendingShift = null; if (p) createShiftNow(p, p.wd); },
  'record-cancel': () => {
    // 取消後回到補登面板，保留剛才填的時間。
    const p = ui.pendingRecord;
    ui.pendingRecord = null;
    ui.sheet = p ? { type: 'record', wd: p.wd, cat: p.cat, step: p.step, t: p.t, sid: p.extra?.sessionId } : null;
    render();
  },
  'rec-step': (el) => { ui.sheet.step = el.dataset.step; delete ui.sheet.t; ui.sheet.newShift = false; sheetScrollToForm = true; render(); },
  // 補登先揀類別；只有工作、通勤才需要班次。
  'rec-cat': (el) => {
    const cat = el.dataset.cat;
    ui.sheet.cat = cat;
    ui.sheet.newShift = false;
    delete ui.sheet.t;
    ui.sheet.step = defaultStepIn(store.get(), ui.sheet.wd, cat, ui.sheet.sid);
    render();
  },
  'meal-open': (el) => { ui.sheet = { type: 'meal', id: el.dataset.id }; render(); },
  'sleep-open': (el) => { const sl=store.get().sleeps.find(s=>s.id===el.dataset.id); if(sl && sl.start==null) {showSheet('plan-clock',{id:sl.id});return} ui.sheet = { type: 'sleep', id: el.dataset.id }; render(); },
  'draft-clear': (el) => { clearDraft(el.dataset.key); lastView = ''; lastSheet = null; render(); },
  // 補登先選班次：之後所有時間都扣在這一班上。
  'rec-shift': (el) => { ui.sheet.sid = el.dataset.sid; ui.sheet.newShift = false; delete ui.sheet.t; render(); },
  'rec-newshift': () => { ui.sheet.newShift = true; render(); },
  'rec-newshift-cancel': () => { ui.sheet.newShift = false; render(); },
  'shift-range': (el) => {
    const f = $('form[data-form=new-shift]');
    if (!f) return;
    f.start.value = el.dataset.from; f.end.value = el.dataset.to;
  },
  'rec-now': () => {
    const t = nowFn(); $('#record-form [name=date]').value = dateKey(t); $('#record-form [name=time]').value = fmtTime(t);
    markDateManual($('#record-form'));
  },
  'rec-minus': () => {
    const f = $('#record-form');
    const t = fromInputs(f.date.value, f.time.value) - 15 * MIN;
    f.date.value = dateKey(t); f.time.value = fmtTime(t);
    markDateManual(f);
  },
  'ride-mode': (el) => {
    const f = el.closest('form');
    f.mode.value = f.mode.value === el.dataset.v ? '' : el.dataset.v;
    f.querySelectorAll('[data-action="ride-mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === f.mode.value)));
  },
  'ride-place': (el) => { el.closest('form').from.value = el.dataset.v; },
  'rec-plan': (el) => { const t = Number(el.dataset.t); const f = $('#record-form'); f.date.value = dateKey(t); f.time.value = fmtTime(t); markDateManual(f); },
  'wd-shift': (el) => { const c = ctx(); ui.wd = addDays(c.wd, Number(el.dataset.dir)); render(); },
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
  'edit-ref': (el) => { ui.sheet = { type: 'ref', ref: parseRef(el.dataset.ref), t: Number(el.dataset.t), title: el.dataset.title, plan: el.dataset.plan === '1' }; render(); },
  // 時間線上的小勾勾：直接打勾／取消「已驗證」，不用打開面板。
  'toggle-verified': (el) => { act.setVerified(parseRef(el.dataset.ref), el.dataset.on !== '1', Number(el.dataset.t)); },
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
    else ui.calDay = k;
    render();
    if (!ui.batch) $('.day-panel')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  },
  'batch-toggle': () => { ui.batch = !ui.batch; ui.batchDays = []; render(); },
  'batch-clear': () => { ui.batchDays = []; render(); },
  'batch-off': () => { store.update(d=>{for(const k of ui.batchDays) if(!d.dayMarks.some(m=>m.date===k)) d.dayMarks.push({date:k,kind:'off'});}); ui.batchDays = []; toast('已更新休假'); },
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
  'sleep-delete': (el) => {
    const id = el.dataset.id;
    if (['sleep','plan-clock'].includes(ui.sheet?.type)) ui.sheet = null;
    clearDraft(`sleep:${id}`); clearDraft(`plan:${id}`);
    if (ui.sleepSaved === id) ui.sleepSaved = null;
    act.deleteSleep(id);
    toastUndo('已刪除');
    render();
  },
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
  'meal-delete': (el) => { act.deleteMeal(el.dataset.id); if (['ref', 'meal', 'meal-quick'].includes(ui.sheet?.type)) ui.sheet = null; clearDraft(`meal:${el.dataset.id}`); toastUndo('已刪除'); render(); },
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
  // 首頁「回到現在」或表單「改返自動」（用餐、休息、獨立通勤共用）。
  'wd-auto': (el) => {
    const form = el?.closest('form');
    if (form?.wdMode) {
      setWdMode(form, 'auto');
      updateFormPreview(form);
      captureDraft(form.closest('form[data-draft]'));
      form.wd?.focus();
      return;
    }
    ui.wd = null;
    render();
  },
  // 防撳錯確認：用你揀的工作日／用自動計算。
  'wdconfirm-mine': () => finishPendingSave(true),
  'wdconfirm-auto': () => finishPendingSave(false),
  'meal-photo-remove': (el) => {
    const form = el.closest('form[data-draft]');
    if (!form) return;
    captureDraft(form);
    ui.drafts[form.dataset.draft] = { ...ui.drafts[form.dataset.draft], photo: null };
    persistDrafts();
    lastView = ''; lastSheet = null;
    render();
  },
  'stats-shift': (el) => { ui.statsOffset += Number(el.dataset.dir); render(); },
  'stats-job': (el) => { ui.statsJob = el.dataset.id; render(); },
  'job-edit': (el) => { ui.jobEdit = el.dataset.id; render(); },
  'job-cancel': () => { ui.jobEdit = null; render(); },
  'job-delete': (el) => act.deleteJob(el.dataset.id),
  'export-json': () => { download(`ontime-backup-${dateKey(nowFn())}.json`, act.exportJSON(), 'application/json'); toast('已匯出 JSON 備份'); },
  'export-csv': () => { download(`ontime-${dateKey(nowFn())}.csv`, act.exportCSV(nowFn()), 'text/csv;charset=utf-8'); toast('已匯出 CSV'); },
  'demo': () => demoURL(true),
  'clear-all': el => {
    if(confirmFirst(el,'清除全部紀錄？','會先保留完整本機備份。清除也會在已登入的裝置同步。','備份並清除')) afterRecovery(()=>{act.clearAll();render();toast('已備份並清除紀錄');});
  },
  'install': async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; ui.canInstall = false; render(); } }
};

// 補登面板（已選班次）：你只打時間，日期由班次決定；按了「現在」、−15 分或手動改日期，就以你設的為準。
function markDateManual(f) {
  if (!f?.date) return;
  f.date.dataset.manual = '1';
  updatePreview(f);
}
function updatePreview(f) {
  const box = $('#rec-preview');
  if (box && f && !f.dataset.sStart && box.dataset.wd) {
    box.innerHTML = freePreviewText(fromInputs(f.date.value, normTime(f.time.value) || ''), box.dataset.wd);
    return;
  }
  if (!box || !f?.dataset.sStart) return;
  const hhmm = normTime(f.time.value);
  if (!hhmm) return;
  const s = { start: Number(f.dataset.sStart), end: f.dataset.sEnd ? Number(f.dataset.sEnd) : null };
  if (f.date.dataset.manual !== '1') {
    const t = resolveStepTime(f.step.value, hhmm, s);
    if (t != null) f.date.value = dateKey(t);
  }
  const t = fromInputs(f.date.value, hhmm);
  if (t != null) box.innerHTML = previewText(t, s);
}

// 歸屬工作日欄：切換自動／手動時，即時收埋或顯示「改返自動」，唔使重畫成個面板。
function setWdMode(form, mode) {
  form.wdMode.value = mode;
  form.querySelector('[data-action="wd-auto"]')?.toggleAttribute('hidden', mode !== 'manual');
  form.querySelector('[data-wd-auto-note]')?.toggleAttribute('hidden', mode === 'manual');
}

// 休息、獨立通勤：按表單裡的時間自動推算的工作日。
function formAutoWorkday(form, t) {
  const data = store.get();
  if (t == null) return null;
  if (form.dataset.wdKind === 'rest') return restAutoWorkday({ start: t }, data);
  if (form.dataset.wdKind === 'journey') {
    const j = data.journeys.find((x) => x.id === form.id.value);
    return j ? journeyAutoWorkday({ ...j, [form.field.value]: t }, data) : null;
  }
  return null;
}

// 批次補睡眠即時預覽：更新每行時數／跨午夜／錯誤與底部總筆數。
function updateCatchupPreview(f) {
  const n = Number(f.dataset.cuCount) || 0;
  const data = store.get();
  const now = nowFn();
  let count = 0;
  for (let i = 0; i < n; i++) {
    const on = !!f[`use_${i}`]?.checked;
    if (on) count++;
    const row = f.querySelector(`[data-cu-row="${i}"]`);
    if (row) {
      row.classList.toggle('is-off', !on);
      const hint = row.querySelector('.cu-head .muted');
      if (hint) hint.textContent = on ? '核對或改鐘數' : '剔咗先會存低';
    }
    const box = f.querySelector(`[data-cu-preview="${i}"]`);
    if (!box) continue;
    const sd = f[`sd_${i}`]?.value;
    const st = normTime(f[`st_${i}`]?.value || '');
    const et = normTime(f[`et_${i}`]?.value || '');
    const ed = sleepEndKey(sd, st || '', et || '');
    const start = st ? fromInputs(sd, st) : null;
    const end = ed && et ? fromInputs(ed, et) : null;
    box.innerHTML = start != null ? sleepPairPreview(data, start, end, { now }) : '<span class="c-danger">請填寫有效時間</span>';
  }
  const btn = f.querySelector('[data-cu-submit]');
  if (btn) {
    btn.disabled = count === 0;
    btn.textContent = count ? `一次存低 ${count} 筆睡眠` : '請先剔選要補的日子';
  }
}

// 一邊填一邊更新「會存成…、歸屬…」的預覽。
function updateFormPreview(form) {
  const data = store.get();
  const now = nowFn();
  const boxRange = form.querySelector('[data-range-preview]');
  if (boxRange) {
    const r=clockRange(form.date.value,form.start.value,form.end.value);
    let line=rangeText(r);
    if(form.restMode && r) {
      const {session,error}=restTarget(data,r,form.restMode.value,now);
      const wdKey = session ? workdayOfSession(session, data) : (form.wd?.value || restAutoWorkday(r, data));
      const wdLabel = wdKey ? fmtDayMD(wdKey) : '';
      const note = form.querySelector('[data-wd-preview]');
      if (note) {
        note.innerHTML = error
          ? `<span class="c-danger">${esc(error)}</span>`
          : `${esc(line)} · ${session ? '班內休息' : '獨立休息'}${wdLabel ? ` · 歸屬 ${wdLabel} 工作日` : ''}`;
        boxRange.textContent = '';
        return;
      }
      line = error || `${line} · ${session ? '班內休息' : '獨立休息'}${wdLabel ? ` · 工作日 ${wdLabel}` : ''}`;
    }
    boxRange.textContent=line;
  }
  if (form.dataset.wdKind) {
    const box = form.querySelector('[data-wd-preview]');
    const t = fromInputs(form.date.value, normTime((form.start || form.time).value) || '');
    const auto = formAutoWorkday(form, t);
    const mode = form.wdMode?.value || 'auto';
    if (mode === 'auto' && auto && form.wd) form.wd.value = auto;
    const wk = mode === 'auto' ? auto : form.wd?.value || auto;
    if (box) box.innerHTML = workdayPreview(t, wk, auto);
    return;
  }
  if (form.dataset.form === 'meal') {
    const box = form.querySelector('[data-meal-preview]');
    const t = fromInputs(form.date.value, normTime(form.start.value) || '');
    const mode = form.wdMode?.value || '';
    // 修改一餐：未手動揀過歸屬時，歸屬欄跟住新嘅時間自動更新。
    if (mode === 'auto' && t != null && form.wd) form.wd.value = mealAutoWorkday({ start: t }, data, now);
    if (box) box.innerHTML = mealPreview(data, t, now, mode ? { wd: form.wd?.value, mode } : {});
  } else if (form.dataset.form === 'sleep-pair') {
    const box = form.querySelector('[data-sleep-preview]');
    const start = fromInputs(form.sd.value, normTime(form.st.value) || '');
    const ed = sleepEndKey(form.sd.value, form.st.value, form.et.value);
    const end = ed ? fromInputs(ed, normTime(form.et.value)) : null;
    if (box) box.innerHTML = sleepPairPreview(data, start, end, { id: form.id.value || null, now });
  } else if (form.id === 'record-form' && !form.dataset.anchored) {
    updatePreview(form);
  }
}

// 「我瞓醒喇」自己打時間：即時更新確認行和快捷掣，不重畫面板（打字時焦點不會跳）。
function quickWakeTyped(f, name) {
  const sh = ui.sheet;
  if (sh?.type !== 'quick-wake' || !f[name]) return;
  const v = normTime(f[name].value);
  if (v === null) return;
  const [selKey, timeKey] = name === 'wakeTime' ? ['wakeSel', 'wakeTime'] : ['startSel', 'startTime'];
  if (v) { sh[selKey] = 'custom'; sh[timeKey] = v; }
  else if (sh[selKey] === 'custom') { sh[selKey] = null; sh[timeKey] = ''; }
  const data = store.get();
  const now = nowFn();
  const st = quickWakeState(data, now, sh);
  const box = f.querySelector('[data-qw-preview]');
  if (box) box.innerHTML = quickWakePreview(data, st);
  const chips = quickWakeChips(st, now);
  const paint = (action, list) => f.querySelectorAll(`[data-action="${action}"]`).forEach((b) => {
    const c = list.find((x) => x.key === b.dataset.key);
    b.setAttribute('aria-pressed', String(!!c?.on));
    b.disabled = !c || !!c.disabled;
    const small = b.querySelector('small');
    if (c && small) small.textContent = c.sub;
  });
  paint('qw-wake', chips.wake);
  paint('qw-start', chips.start);
}

// 整趟面板打字：即時更新每格下面的日期、去程／上班／回程和錯誤提示，不重畫面板。
let tripToDelete = null;
let staleJourneyToDelete = null;
function tripSync(f) {
  const sh = ui.sheet;
  if (sh?.type !== 'trip') return null;
  const cur = tripState(store.get(), sh, nowFn());
  const vals = { ...cur.vals };
  for (const k of STEPS) {
    const raw = (f[`t_${k}`]?.value ?? '').trim();
    vals[k] = raw === '' ? '' : normTime(raw);
  }
  if(f.income) sh.pay=payFrom(f);
  sh.vals = vals;
  return tripState(store.get(), sh, nowFn());
}
function tripTyped(f, editedStep = null, { forceShift = false } = {}) {
  const sh = ui.sheet;
  if (sh?.type !== 'trip') return;
  const data = store.get();
  const now = nowFn();
  if (editedStep && sh.prefilled?.length) {
    const raw = (f[`t_${editedStep}`]?.value ?? '').trim();
    const norm = raw === '' ? '' : normTime(raw);
    const complete = forceShift || /^\d{1,2}[:：.．]\d{2}$/.test(raw) || /^\d{4}$/.test(raw);
    if (raw === '') {
      sh.prefilled = sh.prefilled.filter((x) => x !== editedStep);
      if (sh.prefillTimes) delete sh.prefillTimes[editedStep];
    } else if (complete && norm) {
      const curVals = {};
      for (const k of STEPS) {
        const rv = (f[`t_${k}`]?.value ?? '').trim();
        curVals[k] = rv === '' ? '' : normTime(rv);
      }
      const shifted = shiftTripPrefill(data, sh, now, editedStep, curVals);
      sh.prefilled = shifted.prefilled;
      sh.prefillTimes = shifted.prefillTimes;
      for (const k of STEPS) {
        if (k === editedStep) continue;
        const inp = f[`t_${k}`];
        if (inp && inp.value !== (shifted.vals[k] || '')) inp.value = shifted.vals[k] || '';
      }
    }
  }
  const st = tripSync(f);
  if (!st) return;
  const preSet = new Set(ui.sheet?.prefilled || []);
  const pay=f.querySelector('[data-trip-pay]');
  if(pay) pay.hidden = act.tripPayMode(data,st.trip,st.workday,st.times.clockIn,ui.sheet?.jobId)!=='perOrder';
  for (const r of st.rows) {
    const row = f.querySelector(`.trip-row[data-step="${r.step}"]`);
    if (!row) continue;
    const hint = row.querySelector('[data-trip-hint]');
    if (hint) { hint.textContent = tripHint(r); hint.classList.toggle('is-next', r.off > 0); }
    const filled = !!st.vals[r.step] || st.vals[r.step] === null;
    const isPre = filled && preSet.has(r.step);
    row.classList.toggle('is-filled', filled);
    row.classList.toggle('is-prefill', isPre);
    row.classList.toggle('is-bad', st.error?.step === r.step);
    const preTag = row.querySelector('.trip-pre-tag');
    if (preTag) preTag.hidden = !isPre;
    const clr = row.querySelector('.trip-clear');
    if (clr) clr.hidden = !filled;
  }
  const gaps = tripStepGaps(st);
  f.querySelectorAll('[data-trip-gap]').forEach((el) => {
    const k = el.dataset.tripGap;
    el.innerHTML = tripGapHTML(k, gaps, st);
    el.classList.toggle('is-on', !!gaps[k]);
  });
  for (const g of ['go', 'work', 'back']) {
    const durEl = f.querySelector(`[data-trip-group-dur="${g}"]`);
    if (durEl) durEl.textContent = tripGroupDurText(g, st);
  }
  const comBtn = f.querySelector('[data-trip-commute-btn]');
  if (comBtn) comBtn.disabled = st.times.clockIn == null && st.times.clockOut == null;
  const sum = f.querySelector('[data-trip-sum]');
  if (sum) sum.innerHTML = tripSummaryHTML(st, { prefilled: ui.sheet?.prefilled });
  // 實際日期未手動揀過：跟住第一格自動變（凌晨 4 點前 = 工作日隔天）。
  if (st.anchorAuto && f.anchor && f.anchor.value !== st.anchor) f.anchor.value = st.anchor;
}

// ---------- 補登防撳錯 ----------
// 頂部工作日係預設（冇特登改過），但同按時間自動計的唔一樣：先問「用我揀的」定「用自動計算」。
function askWorkday(p, wd, auto) {
  if (!needsWorkdayConfirm({ wd, auto, touched: !!ui.sheet?.wdTouched })) return false;
  ui.pendingSave = { ...p, back: ui.sheet, wd, auto };
  ui.sheet = {
    type: 'confirm', title: '歸屬工作日不一樣',
    body: `這筆會歸到 ${wdOfKey(wd)} ${fmtMD(wd)} 工作日（你揀的），但按時間自動計應該係 ${wdOfKey(auto)} ${fmtMD(auto)}。要點樣？`,
    confirm: '用我揀的工作日', action: 'wdconfirm-mine', tone: 'ink',
    cancel: 'wdconfirm-auto', cancelLabel: '用自動計算'
  };
  render();
  return true;
}

function finishPendingSave(mine) {
  const p = ui.pendingSave;
  ui.pendingSave = null;
  if (!p) { closeSheet(); return; }
  ui.sheet = p.back;
  savePending({ ...p, payload: { ...p.payload, workday: mine ? p.wd : null } });
}

// 真正寫入（用餐、休息）。
function savePending(p) {
  const now = nowFn();
  let id;
  if (p.kind === 'meal') id = act.saveMeal(p.payload, now);
  else {
    const r = act.addRest(p.payload, now);
    if (!r.ok) { toast(RECORD_ERROR[r.reason] || SLEEP_PAIR_ERROR[r.reason] || '這段休息存不到'); render(); return; }
    id = r.id;
  }
  clearDraft(p.key);
  if (p.inSheet && !p.stay) ui.sheet = null;
  if (p.kind === 'meal') flash(`meal:${id}`);
  lastView = ''; lastSheet = null;
  const data = store.get();
  const rec = p.kind === 'meal' ? data.meals.find((m) => m.id === id) : data.rests.find((r) => r.id === id);
  const wk = rec ? (p.kind === 'meal' ? mealWorkday(rec, data, now) : restWorkday(rec, data)) : null;
  toast(`已儲存${p.kind === 'meal' ? '這一餐' : '休息'}${wk ? ` · 歸屬 ${wdOfKey(wk)} ${fmtMD(wk)} 工作日${rec.workdayManual ? '（手動指定）' : ''}` : ''}`);
  render();
}

const RECORD_ERROR = {
  sleeping: '已經有一筆進行中的睡眠，先記「起床」',
  missing: '找不到可以更新的睡眠，請先補登入睡',
  'missing-start': '這筆睡眠沒有入睡時間，請先補登入睡',
  'before-start': '起床時間不能早於入睡時間',
  'no-session': '這個工作日還沒有上班紀錄，請先補登「上班」',
  'before-clock-in': '下班時間不能早於上班時間',
  'break-end-before-start': '休息結束不能早於開始',
  'after-clock-out': '上班時間不能晚於下班時間',
  'after-end': '開始時間不能晚於結束時間',
  'bad-time': '請填寫日期和時間',
  'expected-past': '預計收工要晚於現在',
  future: '還沒發生的時間不能補登'
};

// 實際寫入補登，並把「這筆歸到哪個工作日」講清楚。
function applyRecord(p) {
  // 「儲存」：存檔期間面板保持打開，才不會先關再開而閃一下。
  ui.sheet = p.stay ? { type: 'record', wd: p.wd, cat: p.cat, step: p.step, t: p.t, sid: p.extra?.sessionId } : null;
  const r = act.setStepTime(p.wd, p.step, p.t, p.extra);
  if (!r.ok) {
    toast(RECORD_ERROR[r.reason] || '沒有可更新的紀錄');
    // 「儲存」模式失敗時留在面板，保留剛填的時間。
    ui.sheet = p.stay ? { type: 'record', wd: p.wd, cat: p.cat, step: p.step, t: p.t, sid: p.extra?.sessionId } : null;
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
  if (p.stay) ui.sheet = { type: 'record', wd: p.wd, cat: p.cat, step: p.step, sid: p.extra?.sessionId };
  render();
}

function createShiftNow(p, wd) {
  const r = act.createShift(wd, p.start, p.end, nowFn());
  ui.sheet = { type: 'record', wd, cat: p.back?.cat, step: p.back?.step || 'clockIn', sid: r.id };
  toast(wd === p.wd ? '已新增班次' : `已新增班次，歸到 ${wdOfKey(wd)} ${fmtMD(wd)}`);
  render();
}

const forms = {
  'shift-editor': f => {
    const range=clockRange(f.date.value,f.start.value,f.end.value),id=f.id.value;
    if(!range){toast('請確認日期及時間');return}
    if(store.get().shifts.some(s=>s.id!==id && s.start<range.end && s.end>range.start)){toast('和已有班次重疊');return}
    if(id && !store.get().shifts.some(s=>s.id===id)){toast('這個班次已移除');return}
    const jobId=f.jobId.value;
    store.update(d=>{
      if(id) Object.assign(d.shifts.find(s=>s.id===id),range,{jobId});
      else d.shifts.push({id:store.uid('sh'),jobId,...range});
      d.dayMarks=d.dayMarks.filter(m=>m.date!==f.date.value);
    });
    ui.sheet=null;render();toastUndo('已儲存班表');
  },
  'temp-preview': f => {
    try {const entries=readTemp(f.source.value);showSheet('temp-import',{entries,rows:tempPreview(store.get(),entries,nowFn())});}
    catch {toast('請貼上臨時版匯出的完整 JSON');}
  },
  'plan-clock': f => {
    const r=clockRange(f.date.value,f.start.value,f.end.value);
    if(!r || r.end<=nowFn()){toast('請確認計畫起止時間，起身應在將來');return}
    if(ui.sheet.id){const saved=act.saveSleepPlan(ui.sheet.id,r.start,r.end);if(!saved.ok){toast('計畫未能儲存');return}}
    else act.addSleepPlan(r.start,r.end);
    ui.sheet=null;render();toastUndo('已儲存睡眠計畫');
  },
  'record': (f, e) => {
    const stay = e?.submitter?.value === 'stay';
    const t = fromInputs(f.date.value, f.time.value);
    if (t == null) return;
    const extra = {};
    if (f.sid && f.sid.value) extra.sessionId = f.sid.value;
    if (f.endTime && f.endTime.value) extra.end = fromInputs(f.endDate.value || f.date.value, f.endTime.value);
    if (f.mode) { extra.mode = f.mode.value.trim(); extra.from = f.from.value.trim(); }
    if (f.replace && f.replace.checked) extra.replace = true;
    if (f.verified) extra.verified = f.verified.checked;
    if (f.mainSleep) extra.mainSleep = f.mainSleep.checked;
    const p = { wd: f.wd.value, cat: ui.sheet?.cat, step: f.step.value, t, extra, stay };
    // 離這一班太遠（例如把 16 號的時間記進 1 號的班）：先問清楚再存。
    if (f.dataset.sStart && !['clockIn', 'clockOut'].includes(p.step)) {
      const s = { start: Number(f.dataset.sStart), end: f.dataset.sEnd ? Number(f.dataset.sEnd) : null };
      if (shiftDistance(t, s) > SHIFT_FAR_MS) {
        ui.pendingRecord = p;
        ui.sheet = {
          type: 'confirm', title: '離這一班太遠',
          body: `你要存的是 ${wdOfKey(dateKey(t))} ${fmtMD(dateKey(t))} ${fmtTime(t)}，但這班是 ${fmtTime(s.start)}–${s.end != null ? fmtTime(s.end) : '待補／進行中'}（${wdOfKey(dateKey(s.start))} ${fmtMD(dateKey(s.start))}），相差超過 12 小時。日期是不是填錯了？`,
          confirm: '照樣儲存', action: 'record-force', tone: 'ink', cancel: 'record-cancel'
        };
        render();
        return;
      }
    }
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
  'new-shift': (f) => {
    const start = fromInputs(f.date.value, f.start.value);
    if (start == null) return;
    const end = f.end.value ? endOnOrAfter(f.date.value, start, f.end.value) : null;
    const p = { wd: f.wd.value, start, end, back: { ...ui.sheet } };
    // 開工日期跟工作日對不上（例如在 10/24 工作日填 10/21 開工）：先問要歸到哪一天，不要默默掛在 10/24。
    const other = shiftDateMismatch(p.wd, start);
    if (other) {
      ui.pendingShift = p;
      ui.sheet = {
        type: 'confirm', title: '開工日期和工作日不一致',
        body: `開工是 ${wdOfKey(other)} ${fmtMD(other)} ${fmtTime(start)}，但你在補 ${wdOfKey(p.wd)} ${fmtMD(p.wd)} 工作日。這班要歸到哪一天？`,
        confirm: `歸到 ${wdOfKey(other)} ${fmtMD(other)}`, action: 'newshift-use-date', tone: 'ink',
        cancel: 'newshift-keep-wd', cancelLabel: `仍屬 ${wdOfKey(p.wd)} ${fmtMD(p.wd)}`
      };
      render();
      return;
    }
    createShiftNow(p, p.wd);
  },
  'ref-time': (f) => {
    const t = fromInputs(f.date.value, f.time.value);
    const extra = f.mode ? { mode: f.mode.value.trim(), from: f.from.value.trim() } : {};
    if (f.verified) extra.verified = f.verified.checked;
    if (f.origT) extra.origT = Number(f.origT.value);
    if (f.mainSleep) extra.mainSleep = f.mainSleep.checked;
    if (f.wdMode) extra.workday = f.wdMode.value === 'manual' ? f.wd.value || null : null;
    const r = act.setRefTime({ type: f.type.value, id: f.id.value, field: f.field.value || undefined }, t, extra);
    if (!r.ok) {
      // 不合理的時間不存；面板保持打開，保留剛填的日期和時間。
      toast(RECORD_ERROR[r.reason] || '這個時間存不到');
      if (ui.sheet?.type === 'ref' && t != null) ui.sheet = { ...ui.sheet, draftT: t, ...(f.wdMode ? { wdMode: f.wdMode.value, wdValue: f.wd.value } : {}) };
      render();
      return;
    }
    ui.selRef = `${f.type.value}:${f.id.value}:${f.field.value}`;
    ui.sheet = null;
    toast('已更新時間');
  },
  'meal': (f, e) => {
    const key = f.dataset.draft;
    const dr = ui.drafts[key] || {};
    const start = fromInputs(f.date.value, f.start.value);
    if (start == null) return;
    const end = f.end.value ? endOnOrAfter(f.date.value, start, f.end.value, { allowSame: true }) : null;
    const existing = f.id.value ? store.get().meals.find((m) => m.id === f.id.value) : null;
    // 歸屬：補登面板用頂部揀的工作日；修改一餐用歸屬欄（auto = 改返自動）；用餐頁新增一律自動。
    const mode = f.wdMode?.value || '';
    const workday = mode === 'sheet' || mode === 'manual' ? f.wd.value || null : mode === 'auto' ? null : undefined;
    const p = {
      kind: 'meal', key, stay: e?.submitter?.value === 'stay', inSheet: !!f.closest('.sheet'),
      payload: {
        workday,
        verified: (f.verified ? f.verified.checked : !!existing?.verified?.start) ? { start: true } : undefined,
        ...(f.id.value ? { id: f.id.value } : {}),
        start, end, confirmed: f.confirmed.value === '1',
        name: f.name.value.trim(), place: f.place.value.trim(), note: f.note.value.trim(),
        photo: 'photo' in dr ? dr.photo : existing?.photo ?? null,
        ...('photo' in dr ? {hasPhoto:!!dr.photo} : {})
      }
    };
    if (mode === 'sheet' && askWorkday(p, workday, mealAutoWorkday({ start }, store.get(), nowFn()))) return;
    savePending(p);
  },
  'rest': (f, e) => {
    const range=clockRange(f.date.value,f.start.value,f.end.value);
    const target=restTarget(store.get(),range,f.restMode.value,nowFn());
    if(target.error){toast(target.error);return}
    const {start,end}=range;
    if(target.session){
      const id=target.session.id;
      store.update(d=>{const s=d.sessions.find(x=>x.id===id);(s.breaks ||= []).push({start,end,...(f.verified?.checked?{verified:{start:true}}:{})});});
      clearDraft(f.dataset.draft);ui.sheet=null;render();toastUndo('已儲存班內休息');return;
    }
    if (start == null || end == null) { toast('請填寫開始和結束時間'); return; }
    const p = {
      kind: 'rest', key: f.dataset.draft, stay: e?.submitter?.value === 'stay', inSheet: true,
      payload: { start, end, workday: f.wd.value || null, verified: f.verified?.checked }
    };
    if (askWorkday(p, p.payload.workday, restAutoWorkday({ start }, store.get()))) return;
    savePending(p);
  },
  'sleep-pair': (f, e) => {
    const key = f.dataset.draft;
    const id = f.id.value || null;
    const start = fromInputs(f.sd.value, f.st.value);
    const ed = sleepEndKey(f.sd.value, f.st.value, f.et.value);
    const end = ed ? fromInputs(ed, normTime(f.et.value)) : null;
    const r = act.saveSleepPair({ id, start, end, mainSleep: f.mainSleep.checked || (id ? false : undefined) }, nowFn());
    if (!r.ok) { toast(SLEEP_PAIR_ERROR[r.reason] || '這段睡眠存不到'); return; }
    clearDraft(key);
    const inSheet = !!f.closest('.sheet');
    if (inSheet && e?.submitter?.value !== 'stay') ui.sheet = null;
    if (!inSheet) ui.sleepSaved = r.id;
    flash(`sleep:${r.id}`);
    lastView = ''; lastSheet = null;
    toastUndo(`${id ? '已更新' : '已補記'} ${fmtDur(r.ms)} · 歸屬 ${wdOfKey(r.wd)} ${fmtMD(r.wd)} 工作日`);
    render();
  },
  trip: (f) => {
    const sh = ui.sheet;
    if (sh?.type !== 'trip') return;
    const st = tripSync(f);
    if (st.error) { toast(tripErrorText(st.error)); lastSheet = null; render(); return; }
    const now = nowFn();
    const was = tripAllVerified(st.trip);
    const on = f.verified.checked;
    // 打勾 = 全部已填的時間一齊標已驗證；原本沒有全勾、現在也沒勾 = 不動個別的勾。
    const verified = on ? true : was ? false : undefined;
    const r = act.saveTrip({
      sessionId: st.trip.session?.id ?? null,
      journeyId: st.trip.session ? null : st.trip.journey?.id ?? null,
      wd: sh.wd, wdTo: sh.wdTo && sh.wdTo !== st.wd0 ? sh.wdTo : null, times: st.times, verified,
      pay:f.income && !f.querySelector('[data-trip-pay]').hidden ? payFrom(f) : undefined,
      jobId: sh.jobId || null
    }, now);
    if (!r.ok) { toast(tripErrorText(r)); return; }
    ui.sheet = null;
    lastView = ''; lastSheet = null;
    toastUndo(`已儲存整趟${st.summary.work != null ? ` · 上班 ${fmtDur(st.summary.work)}` : ''}`);
    render();
  },
  'sleep-catchup': (f) => {
    const n = Number(f.dataset.cuCount) || 0;
    const now = nowFn();
    const items = [];
    for (let i = 0; i < n; i++) {
      if (!f[`use_${i}`]?.checked) continue;
      const sd = f[`sd_${i}`]?.value;
      const st = normTime(f[`st_${i}`]?.value || '');
      const et = normTime(f[`et_${i}`]?.value || '');
      const ed = sleepEndKey(sd, st || '', et || '');
      const start = st ? fromInputs(sd, st) : null;
      const end = ed && et ? fromInputs(ed, et) : null;
      if (start == null || end == null) { toast('有勾選的日子時間未填妥'); return; }
      items.push({ start, end });
    }
    if (!items.length) { toast('請最少剔選一日再儲存'); return; }
    const r = act.saveSleepBatch(items, now);
    if (!r.ok) { toast(`第 ${(r.index ?? 0) + 1} 筆：${SLEEP_PAIR_ERROR[r.reason] || '這段睡眠存不到'}`); return; }
    ui.sheet = null;
    lastView = ''; lastSheet = null;
    toastUndo(`已一次補記 ${r.count} 筆睡眠`);
    render();
  },
  'quick-wake': (f) => {
    const sh = ui.sheet;
    if (sh?.type !== 'quick-wake') return;
    const wt = normTime(f.wakeTime.value);
    if (wt) { sh.wakeSel = 'custom'; sh.wakeTime = wt; }
    const stt = f.startTime ? normTime(f.startTime.value) : '';
    if (stt) { sh.startSel = 'custom'; sh.startTime = stt; }
    const now = nowFn();
    const st = quickWakeState(store.get(), now, sh);
    if (st.error) { toast(QUICK_WAKE_ERROR[st.error] || '這個時間存不到'); lastSheet = null; render(); return; }
    const r = act.quickWake({ start: st.start, wake: st.wake }, now);
    if (!r.ok) { toast(SLEEP_PAIR_ERROR[r.reason] || '這段睡眠存不到'); return; }
    ui.sheet = null;
    flash(`sleep:${r.id}`);
    lastView = ''; lastSheet = null;
    toastUndo(`已記低 · 瞓咗 ${fmtDur(r.ms)} · 計入${wdOfKey(r.wd)} ${fmtMD(r.wd)}`);
    render();
  },
  'meal-move': (f) => {
    const now = nowFn();
    const t = lastClockBefore(normTime(f.time.value), now, { inclusive: true });
    const r = act.moveMeal(f.id.value, t, now);
    if (!r.ok) { toast('這個時間存不到'); return; }
    ui.sheet = null;
    flash(`meal:${r.id}`);
    lastView = ''; lastSheet = null;
    toastUndo(`已改成 ${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}`);
    render();
  },
  'sleep-plan-edit': (f) => {
    const r = act.saveSleepPlan(f.id.value, fromInputs(f.sd.value, f.st.value), fromInputs(f.ed.value, f.et.value));
    if (!r.ok) { toast(SLEEP_PAIR_ERROR[r.reason] || '這個計畫存不到'); return; }
    clearDraft(f.dataset.draft);
    ui.sheet = null;
    flash(`sleep:${r.id}`);
    toast('已更新睡眠計畫');
    render();
  },
  'expected-end': (f) => {
    const t = fromInputs(f.date.value, f.time.value);
    const r = act.setExpectedEnd(f.sid.value, t, nowFn());
    if (!r.ok) {
      toast(RECORD_ERROR[r.reason] || '這個時間存不到');
      if (t != null) ui.sheet = { ...ui.sheet, draftT: t };
      render();
      return;
    }
    ui.sheet = null;
    toast(`已用 ${fmtTime(t)} 收工估算睡前空檔`);
    render();
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
    if(ui.sheet?.type==='income-entry') ui.sheet=null;
    render();toastUndo('已儲存收入');
  },
  'settings': (f) => { act.saveSettings({ name: f.name.value.trim(), commuteOutMin: Number(f.commuteOutMin.value) || 0, commuteBackMin: Number(f.commuteBackMin.value) || 0 }); toast('已儲存設定'); },
  'job': (f) => {
    act.saveJob({ ...(f.id.value ? { id: f.id.value } : {}), name: f.name.value.trim(), color: f.color.value, payMode: f.payMode.value, rate: f.payMode.value!=='hourly' || f.rate.value === '' ? null : Number(f.rate.value) });
    ui.jobEdit = null;
    toast('已儲存工作');
  }
};

let deferredPrompt = null;

// ---------- 時間輸入：點數字直接打字；點旁邊的時鐘才開手機的時間選擇器 ----------
function fixTimeText(inp) {
  const v = normTime(inp.value);
  if (v === null) { inp.setCustomValidity('請輸入時間，例如 1830 或 18:30'); return false; }
  inp.setCustomValidity('');
  inp.value = v;
  return true;
}

// 畫面上每一個 <input type="time"> 換成「文字框＋時鐘按鈕」。
// 時鐘按鈕裡面疊了一個透明的原生時間輸入，所以點它會開 iOS 的滾輪、Android 的時鐘。
function enhanceTimeInputs(root) {
  root.querySelectorAll('input[type="time"]:not(.time-native)').forEach((inp) => {
    const wrap = document.createElement('span');
    wrap.className = 'time-input';
    inp.replaceWith(wrap);
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.autocomplete = 'off';
    inp.maxLength = 5;
    inp.classList.add('time-text');
    if (!inp.placeholder) inp.placeholder = '例如 1830';
    const pick = document.createElement('span');
    pick.className = 'time-pick';
    pick.innerHTML = icon('clock', 20, 2);
    const nat = document.createElement('input');
    nat.type = 'time';
    nat.className = 'time-native';
    nat.tabIndex = -1;
    nat.setAttribute('aria-label', '用時鐘選時間');
    pick.appendChild(nat);
    wrap.append(inp, pick);
  });
}

function bindTimeInputs() {
  // 打開選擇器前，先帶入文字框現在的時間。
  const seed = (e) => {
    const nat = e.target.closest?.('.time-native');
    if (!nat) return;
    const txt = nat.closest('.time-input')?.querySelector('.time-text');
    const v = txt ? normTime(txt.value) : '';
    if (v) nat.value = v;
  };
  document.addEventListener('pointerdown', seed, true);
  document.addEventListener('focusin', seed, true);
  // 電腦瀏覽器點一下不會自動打開，補叫一次。
  document.addEventListener('click', (e) => {
    const nat = e.target.closest?.('.time-native');
    if (nat && nat.showPicker) { try { nat.showPicker(); } catch {} }
  }, true);
  const sync = (e) => {
    const nat = e.target.closest?.('.time-native');
    if (!nat || !nat.value) return;
    const txt = nat.closest('.time-input')?.querySelector('.time-text');
    if (!txt) return;
    txt.value = nat.value;
    txt.setCustomValidity('');
    txt.dispatchEvent(new Event('input', { bubbles: true }));
  };
  document.addEventListener('input', sync, true);
  document.addEventListener('change', sync, true);
  // 打完字離開時就整理格式（1830 → 18:30）。
  document.addEventListener('focusout', (e) => {
    if (e.target.classList?.contains('time-text')) {
      fixTimeText(e.target);
      const tf = e.target.closest?.('form[data-form="trip"]');
      if (tf && e.target.name?.startsWith('t_')) tripTyped(tf, e.target.name.slice(2), { forceShift: true });
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.classList?.contains('time-text')) {
      e.target.setCustomValidity('');
      const f = e.target.closest('#record-form[data-anchored]');
      if (f && e.target.name === 'time') updatePreview(f);
    }
    if (e.target.name === 'date' && e.target.closest('#record-form[data-anchored]')) markDateManual(e.target.form);
  });
}

function bind() {
  bindTimeInputs();
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = handlers[el.dataset.action];
    if (!fn) return;
    if (el.tagName !== 'A') e.preventDefault();
    if (el.dataset.action === 'close-sheet-nav') { ui.sheet = null; return; }
    asUser(() => fn(el));
  });
  document.addEventListener('input', (e) => {
    const form = e.target.closest('form');
    if (!form) return;
    dirty = true;
    // 自己改了歸屬工作日 = 手動指定。
    if (e.target.name === 'wd' && form.wdMode && form.wdMode.value !== 'sheet') setWdMode(form, 'manual');
    captureDraft(form.closest('form[data-draft]'));
    updateFormPreview(form);
  });
  document.addEventListener('input', (e) => {
    const tf = e.target.closest?.('form[data-form="trip"]');
    if (tf && e.target.name?.startsWith('t_')) tripTyped(tf, e.target.name.slice(2));
    if (tf?.income && ['income','orders'].includes(e.target.name)) ui.sheet.pay=payFrom(tf);
    const qw = e.target.closest?.('form[data-form="quick-wake"]');
    if (qw && (e.target.name === 'wakeTime' || e.target.name === 'startTime')) quickWakeTyped(qw, e.target.name);
    const mm = e.target.closest?.('form[data-form="meal-move"]');
    if (mm && e.target.name === 'time') {
      const box = mm.querySelector('[data-mm-preview]');
      if (box) box.innerHTML = mealMovePreview(normTime(e.target.value), nowFn());
    }
    const cu = e.target.closest?.('form[data-form="sleep-catchup"]');
    if (cu) updateCatchupPreview(cu);
  });
  // 「詳細」展開或收起：記住你的選擇（toggle 事件不會冒泡，用捕獲階段）。
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    const key = d.matches?.('details[data-pref]') ? d.dataset.pref : null;
    if (!key || !(key in PREF_KEYS) || ui[key] === d.open) return;
    ui[key] = d.open;
    savePref(PREF_KEYS[key], d.open ? 'open' : 'closed');
    if (d.open) { fixLabels(); enhanceTimeInputs(d); }
  }, true);
  document.addEventListener('change', (e) => {
    const any = e.target.closest('form');
    if (any?.dataset.form === 'sleep-catchup') updateCatchupPreview(any);
    if (any && e.target.name === 'wd' && any.wdMode && any.wdMode.value !== 'sheet') { setWdMode(any, 'manual'); updateFormPreview(any); }
    const form = e.target.closest('form[data-draft]');
    if (form && e.target.type !== 'file') { captureDraft(form); updateFormPreview(form); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    // 自己打的時間（例如 1830）先整理成 18:30；看不懂的就提示，不送出。
    for (const inp of f.querySelectorAll('input.time-text')) {
      if (!fixTimeText(inp)) { inp.reportValidity(); return; }
    }
    dirty = false;
    asUser(() => forms[f.dataset.form]?.(f, e));
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if(el.name==='payMode' && el.form?.dataset.form==='job') {
      el.form.querySelector('[data-job-rate]').hidden=el.value!=='hourly';
    }
    // 設定頁「首頁街景插畫」開關：跟住剔咗定冇剔嚟存（之前只有按鈕會轉，開關撳咗無反應）。
    if (el.dataset.action === 'hero-toggle' && el.type === 'checkbox') {
      ui.heroCollapsed = !el.checked;
      savePref('ontime-scene', el.checked ? 'on' : 'off');
      toast(el.checked ? '已開啟首頁街景' : '已關閉首頁街景');
      render();
      return;
    }
    if(el.dataset.action==='reminder-set') {
      act.saveSettings({reminders:{...store.get().settings.reminders,[el.dataset.key]:el.checked}});return;
    }
    if (el.dataset.action === 'trip-anchor'  && el.value && ui.sheet?.type === 'trip') {
      const st = tripState(store.get(), ui.sheet, nowFn());
      // 新的一趟：工作日預設跟實際日期走（同臨時版一樣）；已有的一趟只改日期，不動歸屬。
      const follow = !st.exists && !ui.sheet.wdTo;
      ui.sheet = { ...ui.sheet, focus: null, vals: st.vals, anchor: el.value, anchorShifted: false, anchorShiftNote: '', ...(follow ? { wd: el.value } : {}) };
      asUser(render);
      return;
    }
    if (el.dataset.action === 'trip-wdto' && el.value && ui.sheet?.type === 'trip') {
      const st = tripState(store.get(), ui.sheet, nowFn());
      ui.sheet = { ...ui.sheet, focus: null, vals: st.vals, wdTo: el.value };
      asUser(render);
      return;
    }
    if (el.dataset.action === 'rec-wd' && el.value) {
      // 換工作日：保留揀好的類別，步驟按新的一天重新建議。
      // wdTouched：你特登改過工作日，儲存時就唔使再問「要用邊個工作日」。
      const cat = ui.sheet.cat;
      ui.sheet = { ...(cat ? { type: 'record', wd: el.value, cat, step: defaultStepIn(store.get(), el.value, cat) } : openRecordSheet(store.get(), el.value, null)), wdTouched: true };
      asUser(render);
    }
    if (el.dataset.action === 'meal-quick-photo' && el.files?.[0]) {
      const m = store.get().meals.find((x) => x.id === el.dataset.id);
      if (!m) { el.value = ''; return; }
      try {
        const photo = await compressPhoto(el.files[0]);
        act.saveMeal({ ...m, photo, hasPhoto: true }, nowFn());
        lastView = ''; lastSheet = null;
        toast('已加入相片');
        render();
      } catch {
        toast('這張相片太大或無法讀取，請換一張');
      }
      el.value = '';
      return;
    }
    if (el.dataset.action === 'meal-photo' && el.files?.[0]) {
      // 先存好已填的文字，再處理相片；處理完重畫時欄位不會被清空。
      const form = el.closest('form[data-draft]');
      captureDraft(form);
      try {
        const photo = await compressPhoto(el.files[0]);
        if (form) { ui.drafts[form.dataset.draft] = { ...ui.drafts[form.dataset.draft], photo }; persistDrafts(); }
        lastView = ''; lastSheet = null;
        render();
      } catch {
        toast('這張相片太大或無法讀取，請換一張');
      }
    }
    if (el.dataset.action === 'import-json' && el.files?.[0]) {
      const mode = document.querySelector('input[name=importMode]:checked')?.value || 'merge';
      try {
        const text = await el.files[0].text();
        act.parseBackup(text);
        if(mode==='replace'){
          replacingText=text;
          showSheet('confirm',{action:'replace-confirm',title:'用備份取代所有紀錄？',body:'會先保存完整本機備份，再還原所選檔案。已登入時會同步至其他裝置。',confirm:'備份並還原'});
          el.value='';return;
        }
        act.importJSON(text, mode);
        toast(mode === 'replace' ? '已用備份取代目前資料' : '已合併備份中的新紀錄');
      } catch (err) {
        toast(err.message && err.message.includes('ONTIME') ? err.message : '讀取失敗：檔案格式不正確');
      }
      el.value = '';
    }
  });
  // 延後了的畫面：離開欄位後補上。
  document.addEventListener('focusout', () => setTimeout(() => {
    if ((pendingView || pendingSheet) && !typingIn('#view') && !typingIn('#sheet-host')) render();
  }, 0));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sheet) { asUser(closeSheet); return; }
    // 面板打開時，Tab 只在面板裡循環。
    if (e.key === 'Tab' && ui.sheet) {
      const box = $('#sheet-host .sheet:not(.is-leave)');
      if (box) {
        const items = [...box.querySelectorAll('button, a[href], input:not([type="hidden"]):not(.time-native), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
        if (items.length) {
          const first = items[0];
          const last = items[items.length - 1];
          if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); return; }
          if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); return; }
        }
      }
      return;
    }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (ui.sheet || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') {
      if (!ui.sheet && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); asUser(() => openRecord()); }
      return;
    }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); asUser(() => openRecord()); return; }
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
      const main = document.querySelector('#view .main-act');
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
  if (store.demoMode) { if (!store.get().jobs.length) act.loadDemo(nowFn()); }
  else initSync();
  bind();
  route();
  // 主畫面捷徑：?do=out|clockIn|sleep|meal
  const doAct = params.get('do');
  if (doAct) {
    history.replaceState(null, '', location.pathname + (fixedNow ? `?now=${params.get('now')}` : '') + location.hash);
    if (doAct === 'meal') handlers['quick-meal']();
    else if (doAct === 'wake') {
      // 有進行中的睡眠：直接記現在起床；沒有就開「我瞓醒喇」問大概幾點瞓。
      if (latestOpenSleep(store.get())) handlers.wake();
      else handlers['quick-wake']();
    }
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
    // 新版本：按「更新」要叫等待中的新版接手，接手後才重新載入；
    // 只 reload 的話舊版會一直留著（之前「改了很多版，手機還是舊的」就是這個原因）。
    const sw = navigator.serviceWorker;
    const hadController = !!sw.controller;
    let reloading = false;
    sw.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    sw.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'version') { ui.appVersion = e.data.version; if (ui.route === 'settings') render(); }
    });
    sw.ready.then((r) => r.active?.postMessage('get-version')).catch(() => {});
    sw.register('./sw.js').then((reg) => {
      window.ontimeUpdate = () => {
        if (reg.waiting) reg.waiting.postMessage('skip-waiting');
        else location.reload();
      };
      const offer = () => toast('有新版本', '<button type="button" class="btn btn-lime btn-sm" onclick="window.ontimeUpdate()">更新</button>', 60000);
      if (reg.waiting && sw.controller) offer();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && sw.controller) offer();
        });
      });
      // 從背景回來時檢查新版本（手機上的 App 常常不會真的重開）。
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  }
}

start();
