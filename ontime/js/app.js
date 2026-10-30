import * as store from './store.js';
import * as act from './actions.js';
import { icon, esc } from './ui.js';
import { dateKey, addDays, fromInputs, monthStartKey, monthEndKey, MIN, HOUR, fmtTime, wdOfKey, fmtMD, normTime, endOnOrAfter, fmtDur } from './time.js';
import { activeSession, shiftDateMismatch, mealWorkday, mealAutoWorkday, restWorkday, restAutoWorkday, journeyAutoWorkday, needsWorkdayConfirm, currentWorkday, currentCycle, workdayEvents, sleepWorkdayChanges, dayOf, inferSleepWorkday, sleepWorkday, resolveStepTime, shiftDistance, SHIFT_FAR_MS } from './logic.js';
import { todayView, refKey, heroFor } from './views/today.js';
import { timelineView } from './views/timeline.js';
import { weekView } from './views/week.js';
import { sleepView } from './views/sleep.js';
import { mealsView } from './views/meals.js';
import { statsView } from './views/stats.js';
import { settingsView } from './views/settings.js';
import { sheetView, defaultStepIn, openRecordSheet, previewText, freePreviewText } from './views/sheet.js';
import { sleepPairPreview, SLEEP_PAIR_ERROR } from './views/sleep.js';
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

const ui = {
  route: 'today', wd: null, tlMode: 'workday', calKey: null, weekMode: 'workday', weekOffset: 0,
  monthKey: null, calDay: null, batch: false, batchDays: [], statsPeriod: 'week', statsOffset: 0, statsJob: 'all',
  selRef: null, sheet: null, incomeEdit: null, jobEdit: null, canInstall: false,
  pendingRecord: null, pendingDelete: null, flash: null, sleepSaved: null,
  drafts: loadDrafts(), heroCollapsed: loadPref('ontime-hero') === 'collapsed'
};

// 只屬於這部裝置的小偏好（例如街景收起）；讀不到就用預設。
function loadPref(key) { try { return localStorage.getItem(key); } catch { return null; } }
function savePref(key, v) { try { localStorage.setItem(key, v); } catch { /* 忽略 */ } }

// ---------- 表單草稿 ----------
// 有 data-draft 的表單，每次輸入都存一份（連相片）。重畫、同步、加相片、切換分頁都用草稿的值，
// 不會清空未儲存的輸入；同一個分頁重新載入也還在（sessionStorage）。儲存或清除後才刪。
function loadDrafts() {
  try { return JSON.parse(sessionStorage.getItem('ontime-drafts')) || {}; } catch { return {}; }
}
function persistDrafts() {
  try { sessionStorage.setItem('ontime-drafts', JSON.stringify(ui.drafts)); } catch { /* 空間不足或不能用：只留在記憶體 */ }
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

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme; else delete root.dataset.theme;
  try { localStorage.setItem('ontime-theme', theme || 'auto'); } catch { /* 忽略 */ }
  const dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0E1116' : '#F4F5F1');
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
  applyTheme(c.data.settings.theme);
  const r = ROUTES[ui.route] || ROUTES.today;
  document.title = `${r.title} · ONTIME`;
  // 首頁頂部場景只在內容改變時才重畫，動畫不會因定時更新而跳回起點。
  const heroHost = $('#hero-host');
  const heroHTML = ui.route === 'today' ? heroFor(c.data, c.wd, currentCycle(c.data, c.now), c.now, !c.isDesktop, ui.heroCollapsed) : '';
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

const RECORD_STEPS = new Set(['out', 'ride', 'arrive', 'clockIn', 'clockOut', 'break', 'leave', 'ride2', 'home', 'meal', 'sleepStart', 'sleepEnd', 'sleepPair']);

function openRecord(wd, step) {
  const c = ctx();
  const key = wd || c.wd;
  ui.sheet = openRecordSheet(c.data, key, RECORD_STEPS.has(step) ? step : null);
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

const handlers = {
  'sync-in': () => { if (ui.sheet?.type === 'sync') ui.sheet = null; signIn(); render(); },
  'sync-open': () => { ui.sheet = { type: 'sync' }; render(); },
  'sync-retry': () => { retrySync(); toast('正在再試一次同步'); render(); },
  'hero-toggle': () => {
    ui.heroCollapsed = !ui.heroCollapsed;
    savePref('ontime-hero', ui.heroCollapsed ? 'collapsed' : 'open');
    render();
    $('#hero-host .hero-toggle')?.focus();
  },
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
  'sleep-open': (el) => { ui.sheet = { type: 'sleep', id: el.dataset.id }; render(); },
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
  'sleep-delete': (el) => {
    const id = el.dataset.id;
    if (ui.sheet?.type === 'sleep') ui.sheet = null;
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
  'meal-delete': (el) => { act.deleteMeal(el.dataset.id); if (ui.sheet?.type === 'ref' || ui.sheet?.type === 'meal') ui.sheet = null; clearDraft(`meal:${el.dataset.id}`); toastUndo('已刪除'); render(); },
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
  // 「改返自動」：清除手動指定，歸屬交返自動推算（用餐、休息、獨立通勤共用）。
  'wd-auto': (el) => {
    const form = el.closest('form');
    if (!form?.wdMode) return;
    setWdMode(form, 'auto');
    updateFormPreview(form);
    captureDraft(form.closest('form[data-draft]'));
    form.wd?.focus();
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

// 一邊填一邊更新「會存成…、歸屬…」的預覽。
function updateFormPreview(form) {
  const data = store.get();
  const now = nowFn();
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
    const end = form.ed.value && normTime(form.et.value) ? fromInputs(form.ed.value, normTime(form.et.value)) : null;
    if (box) box.innerHTML = sleepPairPreview(data, start, end, { id: form.id.value || null, now });
  } else if (form.id === 'record-form' && !form.dataset.anchored) {
    updatePreview(form);
  }
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
        photo: 'photo' in dr ? dr.photo : existing?.photo ?? null
      }
    };
    if (mode === 'sheet' && askWorkday(p, workday, mealAutoWorkday({ start }, store.get(), nowFn()))) return;
    savePending(p);
  },
  'rest': (f, e) => {
    const start = fromInputs(f.date.value, f.start.value);
    const end = f.end.value ? endOnOrAfter(f.date.value, start, f.end.value) : null;
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
    const end = f.ed.value && f.et.value ? fromInputs(f.ed.value, f.et.value) : null;
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
    if (e.target.classList?.contains('time-text')) fixTimeText(e.target);
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
  document.addEventListener('change', (e) => {
    const any = e.target.closest('form');
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
    if (el.dataset.action === 'rec-wd' && el.value) {
      // 換工作日：保留揀好的類別，步驟按新的一天重新建議。
      // wdTouched：你特登改過工作日，儲存時就唔使再問「要用邊個工作日」。
      const cat = ui.sheet.cat;
      ui.sheet = { ...(cat ? { type: 'record', wd: el.value, cat, step: defaultStepIn(store.get(), el.value, cat) } : openRecordSheet(store.get(), el.value, null)), wdTouched: true };
      asUser(render);
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
    if (ui.sheet || tag === 'BUTTON' || tag === 'A') {
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
