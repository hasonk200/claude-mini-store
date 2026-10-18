// 使用者動作：每個函式只改它負責的那一筆資料。
import { update, get, getRaw, uid, replaceAll, emptyData, normalize } from './store.js';
import { mergeData } from './sync.js';
import { isLegacyBackup, convertLegacy } from './legacy.js';
import { MIN, HOUR, dateKey, at, addDays, fmtTime, fromInputs } from './time.js';
import {
  currentCycle, activeSession, shiftForClockIn, sessionsOfWorkday, shiftsOfWorkday,
  journeyOfSession, sessionWorkMs, splitWorkByDay, jobOf, sleepWorkday, latestOpenSleep, sleepEndTarget,
  sleepWorkdayChanges, activeRest
} from './logic.js';

function ensureJob(d) {
  if (!d.jobs.length) d.jobs.push({ id: uid('job'), name: '我的工作', color: 'work', payMode: 'hourly', rate: null });
  return d.jobs[0];
}

function newSession(d, t, wdHint) {
  let sh = shiftForClockIn(d, t);
  if (!sh && wdHint) sh = shiftsOfWorkday(d, wdHint).find((x) => !d.sessions.some((s) => s.shiftId === x.id)) || null;
  const job = (sh && d.jobs.find((j) => j.id === sh.jobId)) || ensureJob(d);
  const s = {
    id: uid('ses'), jobId: job.id, shiftId: sh?.id ?? null, start: t, end: null, breaks: [],
    payMode: job.payMode, rate: job.rate ?? null, income: null, orders: null, note: ''
  };
  d.sessions.push(s);
  return s;
}

// 防連點／長按快捷鍵：同一個步驟 1.5 秒內只記一次。
const RECENT_STEPS = new Map();
const STEP_GAP_MS = 1500;

// 首頁主按鈕：記錄下一個環節。
export function recordStep(step, t = Date.now()) {
  const now = Date.now();
  if (now - (RECENT_STEPS.get(step) || 0) < STEP_GAP_MS) return { ok: false, reason: 'too-fast' };
  RECENT_STEPS.set(step, now);
  update((d) => {
    const cyc = currentCycle(d, t);
    let j = cyc.journey ? d.journeys.find((x) => x.id === cyc.journey.id) : null;
    let s = cyc.session ? d.sessions.find((x) => x.id === cyc.session.id) : null;
    if (step === 'clockIn') {
      s = newSession(d, t);
      if (j && !j.sessionId) j.sessionId = s.id;
      if (!j) d.journeys.push({ id: uid('jr'), sessionId: s.id, out: null, ride: null, arrive: null, leave: null, ride2: null, home: null });
      return;
    }
    if (step === 'clockOut') {
      if (!s) return;
      s.end = t;
      for (const b of s.breaks) if (b.end == null) b.end = t;
      return;
    }
    if (!j) {
      j = { id: uid('jr'), sessionId: s?.id ?? null, out: null, ride: null, arrive: null, leave: null, ride2: null, home: null };
      d.journeys.push(j);
    }
    j[step] = t;
  });
  return { ok: true };
}

export function toggleBreak(t = Date.now()) {
  update((d) => {
    const s = d.sessions.find((x) => x.end == null);
    if (!s) return;
    const open = s.breaks.find((b) => b.end == null);
    if (open) open.end = t;
    else s.breaks.push({ start: t, end: null });
  });
}

// 獨立休息：不屬於任何班別，不影響工時。
export function toggleRest(t = Date.now()) {
  let opened = false;
  update((d) => {
    const r = activeRest(d);
    if (r) { if (t > r.start) r.end = t; }
    else {
      d.rests.push({ id: uid('rst'), start: t, end: null, note: '' });
      opened = true;
    }
  });
  return { ok: true, opened };
}

// ---------- 補登：只改一個欄位 ----------
export function findWorkdayTargets(d, wd) {
  const s = sessionsOfWorkday(d, wd)[0] || null;
  let j = s ? journeyOfSession(d, s) : null;
  if (!j) {
    j = d.journeys.find((x) => !x.sessionId && x.out != null && dateKey(x.out) === wd) || null;
  }
  const sleeps = d.sleeps.filter((x) => sleepWorkday(x, d) === wd);
  const sleep = sleeps.filter((x) => x.start != null).sort((a, b) => b.start - a.start)[0] || sleeps[0] || null;
  const shift = shiftsOfWorkday(d, wd)[0] || null;
  return { session: s, journey: j, sleep, shift };
}

export function setStepTime(wd, step, t, extra = {}) {
  let result = { ok: true };
  update((d) => {
    const tg = findWorkdayTargets(d, wd);
    const s = tg.session ? d.sessions.find((x) => x.id === tg.session.id) : null;
    let j = tg.journey ? d.journeys.find((x) => x.id === tg.journey.id) : null;
    if (step === 'clockIn') {
      if (s) s.start = t;
      else {
        const ns = newSession(d, t, wd);
        ns.end = extra.end ?? null;
        if (j && !j.sessionId) j.sessionId = ns.id;
      }
      return;
    }
    if (step === 'clockOut') {
      if (s) s.end = t;
      return;
    }
    if (step === 'break') {
      if (!s) return;
      s.breaks.push({ start: t, end: extra.end ?? null });
      return;
    }
    if (step === 'sleepStart' || step === 'sleepEnd') {
      let sl = tg.sleep ? d.sleeps.find((x) => x.id === tg.sleep.id) : null;
      let touched = null;
      if (step === 'sleepStart') {
        // 同時只能有一筆進行中的睡眠。
        const open = latestOpenSleep(d);
        if (open && (!sl || open.id !== sl.id)) { result = { ok: false, reason: 'sleeping' }; return; }
        if (sl && sl.start == null) {
          // 計畫轉為實際：保留原本的計畫時間，歸屬交給自動推算。
          sl.start = t;
          if (!sl.workdayManual) delete sl.workdayDate;
          touched = sl.id;
        } else if (sl && sl.end == null) {
          // 更正進行中的入睡時間。
          sl.start = t;
          touched = sl.id;
        } else if (sl && extra.replace) {
          // 使用者明確選擇「取代這天最後一筆」。
          sl.start = t;
          if (sl.end != null && sl.end <= t) sl.end = null;
          if (!sl.workdayManual) delete sl.workdayDate;
          touched = sl.id;
        } else {
          // 這天可以有多段睡眠（小睡＋主睡眠），預設新增一筆。
          const rec = { id: uid('slp'), start: t, end: null, planStart: null, planEnd: null, note: '' };
          d.sleeps.push(rec);
          touched = rec.id;
        }
      } else {
        // 起床：先看所屬工作日，找不到就關掉進行中的那一筆（它可能被算到別的日期）。
        const target = sleepEndTarget(d, wd) || sl;
        if (!target) { result = { ok: false, reason: 'missing' }; return; }
        const x = d.sleeps.find((y) => y.id === target.id);
        if (!x) { result = { ok: false, reason: 'missing' }; return; }
        if (x.start == null) x.start = x.planStart;
        if (x.start == null) { result = { ok: false, reason: 'missing-start' }; return; }
        if (t <= x.start) { result = { ok: false, reason: 'before-start' }; return; }
        x.end = t;
        touched = x.id;
      }
      result = { ok: true, sleepId: touched };
      return;
    }
    if (!j) {
      j = { id: uid('jr'), sessionId: s?.id ?? null, out: null, ride: null, arrive: null, leave: null, ride2: null, home: null };
      d.journeys.push(j);
    }
    j[step] = t;
    if (step === 'ride' || step === 'ride2') {
      if (extra.from !== undefined) j[`${step}From`] = extra.from || null;
      if (extra.mode !== undefined) j[`${step}Mode`] = extra.mode || null;
    }
  });
  return result;
}

export function clearStepTime(wd, step) {
  update((d) => {
    const tg = findWorkdayTargets(d, wd);
    if (['out', 'ride', 'arrive', 'leave', 'ride2', 'home'].includes(step) && tg.journey) {
      d.journeys.find((x) => x.id === tg.journey.id)[step] = null;
    }
    if (step === 'clockOut' && tg.session) d.sessions.find((x) => x.id === tg.session.id).end = null;
  });
}

// 直接改某一筆事件（桌面檢視面板用）。
export function setRefTime(ref, t, extra = {}) {
  update((d) => {
    if (ref.type === 'journey') {
      const j = d.journeys.find((x) => x.id === ref.id);
      if (!j) return;
      j[ref.field] = t;
      if (ref.field === 'ride' || ref.field === 'ride2') {
        if (extra.mode !== undefined) j[`${ref.field}Mode`] = extra.mode || null;
        if (extra.from !== undefined) j[`${ref.field}From`] = extra.from || null;
      }
    } else if (ref.type === 'session') {
      const s = d.sessions.find((x) => x.id === ref.id);
      if (s && (ref.field === 'start' || ref.field === 'end')) s[ref.field] = t;
    } else if (ref.type === 'rest') {
      const r = d.rests.find((x) => x.id === ref.id);
      if (r) r[ref.field] = t;
    } else if (ref.type === 'sleep') {
      const s = d.sleeps.find((x) => x.id === ref.id);
      if (!s) return;
      if (ref.field === 'start') { if (s.start == null) s.planStart = t; else s.start = t; }
      if (ref.field === 'end') { if (s.start == null || s.end == null) s.planEnd = t; else s.end = t; }
    } else if (ref.type === 'meal') {
      const m = d.meals.find((x) => x.id === ref.id);
      if (m) { const len = (m.end ?? m.start) - m.start; m.start = t; if (m.end != null) m.end = t + len; }
    } else if (ref.type === 'shift') {
      const sh = d.shifts.find((x) => x.id === ref.id);
      if (sh) { const len = sh.end - sh.start; sh.start = t; sh.end = t + len; }
    }
  });
}

// ---------- 睡眠 ----------
export function startSleep(t = Date.now()) {
  if (latestOpenSleep(get())) return { ok: false, reason: 'sleeping' };
  update((d) => {
    const plan = d.sleeps
      .filter((s) => s.start == null && s.planStart != null && Math.abs(s.planStart - t) < 6 * HOUR)
      .sort((a, b) => Math.abs(a.planStart - t) - Math.abs(b.planStart - t))[0];
    if (plan) {
      plan.start = t;
      // 計畫上的歸屬只是當時的推算，除非使用者手動指定過，否則交給自動規則。
      if (!plan.workdayManual) delete plan.workdayDate;
    } else {
      d.sleeps.push({ id: uid('slp'), start: t, end: null, planStart: null, planEnd: null, note: '' });
    }
  });
  return { ok: true };
}

export function wakeUp(t = Date.now()) {
  const s = latestOpenSleep(get());
  if (!s) return { ok: false, reason: 'missing' };
  if (t <= s.start) return { ok: false, reason: 'before-start' };
  update((d) => {
    const x = d.sleeps.find((y) => y.id === s.id);
    if (x && t > x.start) x.end = t;
  });
  return { ok: true };
}

export function addSleepPlan(start, end, wd) {
  update((d) => {
    d.sleeps.push({ id: uid('slp'), start: null, end: null, planStart: start, planEnd: end, workdayDate: wd ?? undefined, note: '' });
  });
}

export function updateSleep(id, patch) {
  update((d) => {
    const s = d.sleeps.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  });
}

// 手動指定所屬工作日（null = 按入睡日期）。只有這裡會設定 workdayManual。
export function setSleepWorkday(id, wd) {
  update((d) => {
    const s = d.sleeps.find((x) => x.id === id);
    if (!s) return;
    s.workdayDate = wd;
    s.workdayManual = true;
  });
}

// 清掉舊資料被自動寫死的歸屬，之後全部即時推算；手動指定的不動。
// 回傳「歸屬真的改變」的筆數，與設定頁的預覽一致。
export function resetSleepWorkdays() {
  const changed = sleepWorkdayChanges(get()).length;
  update((d) => {
    for (const s of d.sleeps) {
      if (s.workdayManual) continue;
      // workdayDate === null 是使用者明確選的「按入睡日期」，保留。
      if (s.workdayDate != null) delete s.workdayDate;
    }
  });
  return changed;
}

export function deleteSleep(id) {
  update((d) => { d.sleeps = d.sleeps.filter((x) => x.id !== id); });
}

export function deleteRest(id) {
  update((d) => { d.rests = d.rests.filter((x) => x.id !== id); });
}

// ---------- 用餐 ----------
export function saveMeal(meal) {
  update((d) => {
    const i = d.meals.findIndex((m) => m.id === meal.id);
    if (i >= 0) d.meals[i] = { ...d.meals[i], ...meal };
    else d.meals.push({ id: uid('meal'), confirmed: true, name: '', place: '', note: '', photo: null, ...meal });
  });
}

export function confirmMeal(id, t) {
  update((d) => {
    const m = d.meals.find((x) => x.id === id);
    if (!m) return;
    m.confirmed = true;
    if (t != null) { const len = (m.end ?? m.start + 20 * MIN) - m.start; m.start = t; m.end = t + len; }
  });
}

export function deleteMeal(id) {
  update((d) => { d.meals = d.meals.filter((m) => m.id !== id); });
}

// ---------- 工作與班表 ----------
export function saveJob(job) {
  update((d) => {
    const i = d.jobs.findIndex((j) => j.id === job.id);
    if (i >= 0) d.jobs[i] = { ...d.jobs[i], ...job };
    else d.jobs.push({ id: uid('job'), color: 'work', payMode: 'hourly', rate: null, ...job });
  });
}

export function deleteJob(id) {
  update((d) => {
    if (d.sessions.some((s) => s.jobId === id)) return;
    d.jobs = d.jobs.filter((j) => j.id !== id);
    d.shifts = d.shifts.filter((s) => s.jobId !== id);
    d.templates = d.templates.filter((t) => t.jobId !== id);
  });
}

export function saveTemplate(tpl) {
  update((d) => {
    const i = d.templates.findIndex((t) => t.id === tpl.id);
    if (i >= 0) d.templates[i] = { ...d.templates[i], ...tpl };
    else d.templates.push({ id: uid('tpl'), ...tpl });
  });
}

export function deleteTemplate(id) {
  update((d) => { d.templates = d.templates.filter((t) => t.id !== id); });
}

// 範本的結束時間早於開始時間時，代表在隔日結束。
export function shiftFromTemplate(tpl, key) {
  const start = at(key, tpl.start);
  let end = at(key, tpl.end);
  if (end <= start) end = at(addDays(key, 1), tpl.end);
  return { start, end };
}

export function applyTemplate(tplId, keys) {
  update((d) => {
    const tpl = d.templates.find((t) => t.id === tplId);
    if (!tpl) return;
    for (const key of keys) {
      const { start, end } = shiftFromTemplate(tpl, key);
      if (d.shifts.some((s) => s.jobId === tpl.jobId && s.start === start)) continue;
      d.shifts.push({ id: uid('sh'), jobId: tpl.jobId, start, end });
      d.dayMarks = d.dayMarks.filter((m) => m.date !== key);
    }
  });
}

export function addShift(jobId, key, startHHMM, endHHMM) {
  const r = shiftFromTemplate({ start: startHHMM, end: endHHMM }, key);
  update((d) => { d.shifts.push({ id: uid('sh'), jobId, ...r }); });
}

export function deleteShift(id) {
  update((d) => { d.shifts = d.shifts.filter((s) => s.id !== id); });
}

export function toggleDayOff(key) {
  update((d) => {
    if (d.dayMarks.some((m) => m.date === key)) d.dayMarks = d.dayMarks.filter((m) => m.date !== key);
    else d.dayMarks.push({ date: key, kind: 'off' });
  });
}

// ---------- 收入 ----------
export function setSessionIncome(id, patch) {
  update((d) => {
    const s = d.sessions.find((x) => x.id === id);
    if (s) Object.assign(s, patch);
  });
}

export function deleteSession(id) {
  update((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== id);
    // 同一次出勤的行程一起刪，避免留下看不見的孤兒紀錄。
    d.journeys = d.journeys.filter((j) => j.sessionId !== id);
  });
}

// 時間線／面板的「刪除這一筆」。t 只用來定位班內某一段休息。
export function deleteRef(ref, t) {
  if (!ref || !ref.id) return { ok: false, reason: 'missing' };
  if (ref.type === 'sleep') { deleteSleep(ref.id); return { ok: true }; }
  if (ref.type === 'meal') { deleteMeal(ref.id); return { ok: true }; }
  if (ref.type === 'shift') { deleteShift(ref.id); return { ok: true }; }
  if (ref.type === 'rest') { deleteRest(ref.id); return { ok: true }; }
  if (ref.type === 'session') {
    if (ref.field === 'break') {
      update((d) => {
        const s = d.sessions.find((x) => x.id === ref.id);
        if (!s) return;
        const i = (s.breaks || []).findIndex((b) => b.start === t);
        if (i >= 0) s.breaks.splice(i, 1);
      });
      return { ok: true };
    }
    deleteSession(ref.id);
    return { ok: true };
  }
  if (ref.type === 'journey') {
    update((d) => {
      const j = d.journeys.find((x) => x.id === ref.id);
      if (!j) return;
      j[ref.field] = null;
      const left = ['out', 'ride', 'arrive', 'leave', 'ride2', 'home'].some((k) => j[k] != null);
      if (!left) d.journeys = d.journeys.filter((x) => x.id !== j.id);
    });
    return { ok: true };
  }
  return { ok: false, reason: 'unknown' };
}

// ---------- 設定 ----------
export function saveSettings(patch) {
  update((d) => { d.settings = { ...d.settings, ...patch }; });
}

// ---------- 匯入與匯出 ----------
export function exportJSON() {
  return JSON.stringify({ app: 'ONTIME', exportedAt: new Date().toISOString(), data: getRaw() }, null, 2);
}

export function parseBackup(text) {
  const obj = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  if (isLegacyBackup(obj)) return convertLegacy(obj);
  const raw = obj && obj.app === 'ONTIME' && obj.data ? obj.data : obj;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions) || !Array.isArray(raw.sleeps)) {
    throw new Error('這不是 ONTIME 的備份檔');
  }
  return normalize(raw);
}

export function importJSON(text, mode = 'replace') {
  const incoming = parseBackup(text);
  if (mode === 'replace') { replaceAll(incoming); return; }
  // 合併：逐筆比較，較新的版本勝出；只在一邊有的紀錄都保留。
  replaceAll(mergeData(getRaw(), incoming));
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(now = Date.now()) {
  const d = get();
  const rows = [['上班日', '工作', '上班', '下班', '工時(小時)', '各日曆日工時', '休息(分鐘)', '去程(分鐘)', '回程(分鐘)', '計算方式', '時薪', '計薪', '實收', '訂單數', '備註', '去程交通', '去程上車處', '回程交通', '回程上車處']];
  for (const s of [...d.sessions].sort((a, b) => a.start - b.start)) {
    const job = jobOf(d, s.jobId);
    const j = journeyOfSession(d, s);
    const work = sessionWorkMs(s, now);
    const split = Object.entries(splitWorkByDay(s, now)).map(([k, v]) => `${k} ${(v / HOUR).toFixed(2)}`).join('; ');
    const brk = (s.breaks || []).reduce((n, b) => n + ((b.end ?? now) - b.start), 0);
    const go = j && j.out != null ? ((j.arrive ?? s.start) - j.out) / MIN : '';
    const back = j && j.home != null ? (j.home - (j.leave ?? s.end ?? j.home)) / MIN : '';
    const pay = s.payMode === 'hourly' && s.rate != null ? ((work / HOUR) * s.rate).toFixed(2) : '';
    rows.push([
      dateKey(s.start), job?.name ?? '', `${dateKey(s.start)} ${fmtTime(s.start)}`, s.end ? `${dateKey(s.end)} ${fmtTime(s.end)}` : '',
      (work / HOUR).toFixed(2), split, Math.round(brk / MIN), go === '' ? '' : Math.round(go), back === '' ? '' : Math.round(back),
      { hourly: '時薪', perOrder: '按單', none: '不計薪' }[s.payMode] ?? '', s.rate ?? '', pay,
      s.payMode === 'perOrder' ? (s.income ?? '未填') : '', s.payMode === 'perOrder' ? (s.orders ?? '未填') : '', s.note ?? '',
      j?.rideMode ?? '', j?.rideFrom ?? '', j?.ride2Mode ?? '', j?.ride2From ?? ''
    ]);
  }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function clearAll() {
  replaceAll(emptyData());
}

// ---------- 示範資料：以「現在」為準，建立一個進行中的夜班 ----------
export function demoData(now = Date.now()) {
  const d = emptyData();
  const today = dateKey(now);
  const night = { id: 'job_demo_night', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 };
  const deliv = { id: 'job_demo_deliv', name: '外送', color: 'deliv', payMode: 'perOrder', rate: null };
  d.jobs.push(night, deliv);
  d.templates.push({ id: 'tpl_demo_n', jobId: night.id, name: '夜班', start: '21:00', end: '09:00' });
  d.templates.push({ id: 'tpl_demo_d', jobId: deliv.id, name: '外送晚市', start: '18:00', end: '23:00' });
  // 「現在」所在的夜班：如果現在早於 21:00，就把上班日放在前一天，讓畫面顯示跨午夜的情境。
  const curWd = fromInputs(today, fmtTime(now)) >= at(today, '21:00') ? today : addDays(today, -1);
  for (let i = -10; i <= 10; i++) {
    const key = addDays(curWd, i);
    const wd = new Date(at(key, '12:00')).getDay();
    if (wd === 3 || wd === 0) { d.dayMarks.push({ date: key, kind: 'off' }); continue; }
    if (wd === 6) {
      const sh = { id: uid('sh'), jobId: deliv.id, start: at(key, '18:00'), end: at(key, '23:00') };
      d.shifts.push(sh);
      if (sh.end < now) {
        d.sessions.push({ id: uid('ses'), jobId: deliv.id, shiftId: sh.id, start: sh.start + 5 * MIN, end: sh.end - 10 * MIN, breaks: [], payMode: 'perOrder', rate: null, income: i % 2 ? 86.5 : null, orders: i % 2 ? 11 : null, note: '' });
      }
      continue;
    }
    const sh = { id: uid('sh'), jobId: night.id, start: at(key, '21:00'), end: at(addDays(key, 1), '09:00') };
    d.shifts.push(sh);
    if (sh.start > now) continue;
    const jitter = ((i * 7) % 5) * MIN;
    const s = { id: uid('ses'), jobId: night.id, shiftId: sh.id, start: sh.start - 2 * MIN - jitter, end: sh.end < now ? sh.end + 4 * MIN : null, breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null, note: '' };
    if (at(addDays(key, 1), '03:30') < now) s.breaks.push({ start: at(addDays(key, 1), '03:00'), end: at(addDays(key, 1), '03:30') });
    d.sessions.push(s);
    const j = { id: uid('jr'), sessionId: s.id, out: s.start - 46 * MIN, ride: s.start - 37 * MIN, arrive: s.start - 11 * MIN, leave: null, ride2: null, home: null };
    if (s.end) { j.ride2 = s.end + 12 * MIN; j.home = s.end + 54 * MIN; }
    if (j.home && j.home > now) { j.home = null; if (j.ride2 > now) j.ride2 = null; }
    d.journeys.push(j);
    d.meals.push({ id: uid('meal'), name: '宵夜', place: '公司休息室', note: '', photo: null, start: at(addDays(key, 1), '01:10'), end: at(addDays(key, 1), '01:35'), confirmed: at(addDays(key, 1), '01:10') < now });
    const sleepStart = at(addDays(key, 1), '12:00') + ((i * 11) % 30) * MIN;
    const sleepEnd = sleepStart + (6.5 + ((i * 3) % 4) * 0.5) * HOUR;
    if (sleepEnd < now && i !== -6) d.sleeps.push({ id: uid('slp'), start: sleepStart, end: sleepEnd, planStart: null, planEnd: null, note: '' });
    else if (sleepStart > now) d.sleeps.push({ id: uid('slp'), start: null, end: null, planStart: at(addDays(key, 1), '12:00'), planEnd: at(addDays(key, 1), '20:00'), note: '' });
  }
  d.settings.name = '示範';
  return d;
}

export function loadDemo(now = Date.now()) {
  replaceAll(demoData(now));
}
