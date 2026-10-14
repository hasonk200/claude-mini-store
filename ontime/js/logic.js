// 作息規則：純函式，不碰畫面和儲存，方便測試。
// data = { jobs, shifts, sessions, journeys, meals, sleeps, dayMarks, settings }
import { MIN, HOUR, dateKey, dayStart, dayEnd, addDays } from './time.js';

export const STEPS = ['out', 'ride', 'arrive', 'clockIn', 'clockOut', 'ride2', 'home'];
export const OPTIONAL_STEPS = new Set(['ride', 'ride2']);
export const STEP_LABEL = {
  out: '出門', ride: '上車', arrive: '抵達', clockIn: '上班', clockOut: '下班',
  leave: '離開', ride2: '上車', home: '到家'
};
const JOURNEY_FIELDS = new Set(['out', 'ride', 'arrive', 'leave', 'ride2', 'home']);

// ---------- 區間 ----------
export function mergeIntervals(list) {
  const xs = list.filter((x) => x && x[1] > x[0]).map((x) => [x[0], x[1]]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push(x);
  }
  return out;
}

export function clip(intervals, a, b) {
  return intervals.map(([s, e]) => [Math.max(s, a), Math.min(e, b)]).filter(([s, e]) => e > s);
}

export const totalOf = (intervals) => mergeIntervals(intervals).reduce((n, [s, e]) => n + (e - s), 0);

// ---------- 出勤 ----------
export const workdayOfSession = (s) => dateKey(s.start);
export const activeSession = (data) => data.sessions.find((s) => s.end == null) || null;

export function breakIntervals(s, now) {
  return (s.breaks || []).map((b) => [b.start, b.end ?? now]);
}

export function sessionWorkIntervals(s, now) {
  const end = s.end ?? now;
  const base = [[s.start, end]];
  const breaks = mergeIntervals(clip(breakIntervals(s, now), s.start, end));
  return subtract(base, breaks);
}

export function subtract(base, cuts) {
  let out = mergeIntervals(base);
  for (const [cs, ce] of mergeIntervals(cuts)) {
    const next = [];
    for (const [s, e] of out) {
      if (ce <= s || cs >= e) next.push([s, e]);
      else {
        if (cs > s) next.push([s, cs]);
        if (ce < e) next.push([ce, e]);
      }
    }
    out = next;
  }
  return out;
}

export const sessionWorkMs = (s, now) => totalOf(sessionWorkIntervals(s, now));

export function shiftOf(data, s) {
  return s && s.shiftId ? data.shifts.find((x) => x.id === s.shiftId) || null : null;
}

export function jobOf(data, id) {
  return data.jobs.find((j) => j.id === id) || null;
}

// 為「現在上班」找合適的排班：前後四小時內、還沒有實際出勤連結的班次。
export function shiftForClockIn(data, t) {
  const used = new Set(data.sessions.map((s) => s.shiftId).filter(Boolean));
  let best = null;
  for (const sh of data.shifts) {
    if (used.has(sh.id)) continue;
    const d = Math.abs(sh.start - t);
    if (d <= 4 * HOUR && (!best || d < Math.abs(best.start - t))) best = sh;
  }
  return best;
}

// ---------- 通勤與這一趟 ----------
export function journeyOfSession(data, s) {
  return s ? data.journeys.find((j) => j.sessionId === s.id) || null : null;
}

function journeyFirstTime(j) {
  return ['out', 'ride', 'arrive', 'leave', 'ride2', 'home'].map((k) => j[k]).find((v) => v != null) ?? j.created ?? null;
}

// 現在這一趟：進行中的出勤，或還沒到家的通勤。
export function currentCycle(data, now) {
  const s = activeSession(data);
  if (s) return { session: s, journey: journeyOfSession(data, s) };
  let best = null;
  for (const j of data.journeys) {
    if (j.home != null) continue;
    const t0 = journeyFirstTime(j);
    const session = j.sessionId ? data.sessions.find((x) => x.id === j.sessionId) : null;
    const ref = session?.end ?? t0;
    if (ref == null || now - ref > 16 * HOUR) continue;
    if (!best || (t0 ?? 0) > (best.t0 ?? 0)) best = { journey: j, session, t0 };
  }
  return best ? { session: best.session || null, journey: best.journey } : { session: null, journey: null };
}

export function stepValue(cycle, step) {
  if (step === 'clockIn') return cycle.session?.start ?? null;
  if (step === 'clockOut') return cycle.session?.end ?? null;
  return cycle.journey?.[step] ?? null;
}

// 下一個要記錄的環節：最後一個已記錄環節之後的第一個空格。
export function nextStep(cycle) {
  let last = -1;
  STEPS.forEach((st, i) => { if (stepValue(cycle, st) != null) last = i; });
  for (let i = last + 1; i < STEPS.length; i++) {
    if (stepValue(cycle, STEPS[i]) == null) return STEPS[i];
  }
  return null;
}

export function statusOf(cycle, data, now) {
  const sleeping = data.sleeps.find((s) => s.start != null && s.end == null);
  if (sleeping) return { key: 'sleep', title: '睡眠中', since: sleeping.start };
  const s = cycle.session;
  if (s && s.end == null) {
    const onBreak = (s.breaks || []).find((b) => b.end == null);
    if (onBreak) return { key: 'break', title: '休息中', since: onBreak.start };
    return { key: 'work', title: '工作中', since: s.start };
  }
  const j = cycle.journey;
  if (j) {
    if (s && s.end != null) {
      if (j.ride2 != null) return { key: 'ride2', title: '回程中', since: j.ride2 };
      return { key: 'off', title: '已下班', since: s.end };
    }
    if (j.arrive != null) return { key: 'arrive', title: '已抵達', since: j.arrive };
    if (j.ride != null) return { key: 'ride', title: '搭車中', since: j.ride };
    if (j.out != null) return { key: 'out', title: '已出門', since: j.out };
  }
  return { key: 'free', title: '自由時間', since: null };
}

// ---------- 睡眠歸屬 ----------
export function inferSleepWorkday(t, data) {
  let best = null;
  for (const s of data.sessions) {
    if (s.start > t) continue;
    const ok = s.end != null ? (s.end <= t + 30 * MIN && t - s.end <= 24 * HOUR) : t - s.start <= 16 * HOUR;
    if (ok && (!best || s.start > best.start)) best = s;
  }
  if (!best) {
    for (const sh of data.shifts) {
      if (sh.start > t) continue;
      if (sh.end <= t + 30 * MIN && t - sh.end <= 24 * HOUR && (!best || sh.start > best.start)) best = sh;
    }
  }
  return best ? dateKey(best.start) : dateKey(t);
}

export function sleepWorkday(sl, data) {
  const t = sl.start ?? sl.planStart;
  if (sl.workdayDate === null) return dateKey(t);
  if (sl.workdayDate) return sl.workdayDate;
  return inferSleepWorkday(t, data);
}

export function sleepActualMs(sl, now) {
  if (sl.start == null) return null;
  return (sl.end ?? now) - sl.start;
}

// ---------- 目前的工作日 ----------
export function currentWorkday(data, now) {
  const s = activeSession(data) || data.sessions.find((x) => x.start <= now && x.end != null && x.end > now);
  if (s) return workdayOfSession(s);
  const sleeping = data.sleeps.find((x) => x.start != null && x.end == null);
  if (sleeping) return sleepWorkday(sleeping, data);
  const cyc = currentCycle(data, now);
  if (cyc.session) return workdayOfSession(cyc.session);
  if (cyc.journey) {
    const sh = data.shifts
      .filter((x) => x.start >= (cyc.journey.out ?? now) - HOUR)
      .sort((a, b) => a.start - b.start)[0];
    if (sh && sh.start - now < 6 * HOUR) return dateKey(sh.start);
    return dateKey(cyc.journey.out ?? now);
  }
  // 剛下班的那個工作日，只在「還沒睡醒」而且下班後 16 小時內才繼續算。
  // 睡醒之後，或隔了太久都沒有新的班，就換成新的工作日（不然沒排班時會一直卡在舊的一天）。
  const done = data.sessions
    .filter((x) => x.end != null && x.end <= now && now - x.end <= 16 * HOUR)
    .sort((a, b) => b.end - a.end)[0];
  if (done) {
    const started = data.shifts.find((sh) => sh.start > done.end && sh.start <= now);
    if (started) return dateKey(started.start);
    const sleptAfter = data.sleeps.some((sl) => sl.start != null && sl.end != null && sl.start >= done.end && sl.end <= now);
    if (!sleptAfter) return workdayOfSession(done);
  }
  const upcoming = data.shifts
    .filter((sh) => sh.start > now && sh.start - now <= 24 * HOUR)
    .sort((a, b) => a.start - b.start)[0];
  if (upcoming) return dateKey(upcoming.start);
  return dateKey(now);
}

// ---------- 工作日範圍與事件 ----------
export function sessionsOfWorkday(data, wd) {
  return data.sessions.filter((s) => workdayOfSession(s) === wd).sort((a, b) => a.start - b.start);
}

export function shiftsOfWorkday(data, wd) {
  return data.shifts.filter((sh) => dateKey(sh.start) === wd).sort((a, b) => a.start - b.start);
}

export function workdaySpan(data, wd, now) {
  const times = [];
  for (const s of sessionsOfWorkday(data, wd)) {
    times.push(s.start, s.end ?? now);
    const j = journeyOfSession(data, s);
    if (j) for (const k of JOURNEY_FIELDS) if (j[k] != null) times.push(j[k]);
  }
  for (const sh of shiftsOfWorkday(data, wd)) times.push(sh.start, sh.end);
  for (const sl of data.sleeps) {
    if (sleepWorkday(sl, data) !== wd) continue;
    const a = sl.start ?? sl.planStart;
    const b = sl.end ?? (sl.start != null ? now : sl.planEnd);
    if (a != null) times.push(a);
    if (b != null) times.push(b);
  }
  if (!times.length) return [dayStart(wd), dayEnd(wd)];
  // 由第一件事前半小時開始，到最後一件事後半小時；至少顯示 16 小時。
  const first = new Date(Math.min(...times) - 30 * MIN);
  first.setMinutes(0, 0, 0);
  const a = first.getTime();
  const b = Math.max(Math.max(...times) + 30 * MIN, a + 16 * HOUR);
  return [a, b];
}

export function mealWorkday(meal, data, now) {
  const wd = dateKey(meal.start);
  const prev = addDays(wd, -1);
  // 前一個工作日的班次可能跨過午夜，要先看它有沒有包住這一餐。
  for (const s of sessionsOfWorkday(data, prev)) {
    const j = journeyOfSession(data, s);
    const end = Math.max(s.end ?? now, j?.home ?? 0, j?.leave ?? 0);
    if (meal.start >= (j?.out ?? s.start) && meal.start <= end) return prev;
  }
  return wd;
}

const ICON_OF = {
  out: 'door', ride: 'bus', arrive: 'pin', clockIn: 'bag', clockOut: 'flag', leave: 'walk', ride2: 'bus', home: 'home'
};
const KIND_OF = { out: 'commute', ride: 'commute', arrive: 'commute', clockIn: 'work', clockOut: 'work', leave: 'commute', ride2: 'commute', home: 'home' };

export function workdayEvents(data, wd, now) {
  const ev = [];
  const sessions = sessionsOfWorkday(data, wd);
  for (const s of sessions) {
    const job = jobOf(data, s.jobId);
    const sh = shiftOf(data, s);
    const j = journeyOfSession(data, s);
    if (j) {
      for (const k of ['out', 'ride', 'arrive']) {
        if (j[k] != null) ev.push({ t: j[k], step: k, kind: KIND_OF[k], icon: ICON_OF[k], title: k === 'ride' ? '去程搭車' : STEP_LABEL[k], ref: { type: 'journey', id: j.id, field: k } });
      }
    }
    ev.push({ t: s.start, step: 'clockIn', kind: 'work', icon: 'bag', title: `上班 · ${job?.name ?? '工作'}`, ref: { type: 'session', id: s.id, field: 'start' } });
    for (const b of s.breaks || []) {
      ev.push({ t: b.start, kind: 'break', icon: 'cup', title: '休息', detail: b.end ? `${Math.round((b.end - b.start) / MIN)} 分鐘` : '進行中', ref: { type: 'session', id: s.id, field: 'break' } });
    }
    if (s.end != null) {
      ev.push({ t: s.end, step: 'clockOut', kind: 'work', icon: 'flag', title: '下班', detail: `本班 ${fmtShort(sessionWorkMs(s, now))}`, ref: { type: 'session', id: s.id, field: 'end' } });
    } else if (sh) {
      ev.push({ t: sh.end, step: 'clockOut', kind: 'work', icon: 'flag', title: '預計下班', plan: true, ref: { type: 'session', id: s.id, field: 'end' } });
    }
    if (j) {
      for (const k of ['leave', 'ride2', 'home']) {
        if (j[k] != null) ev.push({ t: j[k], step: k, kind: KIND_OF[k], icon: ICON_OF[k], title: k === 'ride2' ? '回程搭車' : STEP_LABEL[k], ref: { type: 'journey', id: j.id, field: k } });
      }
    }
  }
  const usedShifts = new Set(sessions.map((s) => s.shiftId));
  for (const sh of shiftsOfWorkday(data, wd)) {
    if (usedShifts.has(sh.id)) continue;
    const job = jobOf(data, sh.jobId);
    ev.push({ t: sh.start, kind: 'work', icon: 'bag', title: `預計上班 · ${job?.name ?? '工作'}`, plan: true, ref: { type: 'shift', id: sh.id } });
    ev.push({ t: sh.end, kind: 'work', icon: 'flag', title: '預計下班', plan: true, ref: { type: 'shift', id: sh.id } });
  }
  for (const sl of data.sleeps) {
    if (sleepWorkday(sl, data) !== wd) continue;
    if (sl.start != null) {
      ev.push({ t: sl.start, kind: 'sleep', icon: 'moon', title: '入睡', detail: sl.end ? `睡了 ${fmtShort(sl.end - sl.start)}` : '睡眠中', ref: { type: 'sleep', id: sl.id, field: 'start' } });
      if (sl.end != null) ev.push({ t: sl.end, kind: 'sleep', icon: 'sun', title: '起床', ref: { type: 'sleep', id: sl.id, field: 'end' } });
      else if (sl.planEnd != null) ev.push({ t: sl.planEnd, kind: 'sleep', icon: 'sun', title: '預計起床', detail: '計畫時間，發生前不計入睡眠時數', plan: true, ref: { type: 'sleep', id: sl.id, field: 'end' } });
    } else if (sl.planStart != null) {
      ev.push({ t: sl.planStart, kind: 'sleep', icon: 'moon', title: '預計入睡', plan: true, ref: { type: 'sleep', id: sl.id, field: 'start' } });
      if (sl.planEnd != null) ev.push({ t: sl.planEnd, kind: 'sleep', icon: 'sun', title: '預計起床', plan: true, ref: { type: 'sleep', id: sl.id, field: 'end' } });
    }
  }
  for (const m of data.meals) {
    if (mealWorkday(m, data, now) !== wd) continue;
    const during = sessions.some((s) => m.start >= s.start && m.start <= (s.end ?? now));
    ev.push({
      t: m.start, kind: 'meal', icon: 'meal', title: (m.name || '用餐') + (during ? '（工作中）' : ''),
      detail: m.end ? `${fmtClock(m.start)}–${fmtClock(m.end)}` : '', plan: !m.confirmed, ref: { type: 'meal', id: m.id }
    });
  }
  return ev.sort((a, b) => a.t - b.t);
}

function fmtClock(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtShort(ms) {
  const m = Math.round(ms / MIN);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

// ---------- 區間（給時間軸和統計） ----------
// 回傳 [{kind, a, b, plan, label}]
export function intervalsAround(data, from, to, now) {
  const out = [];
  const push = (kind, a, b, plan = false, label = '') => {
    if (a == null || b == null || b <= a) return;
    if (b <= from || a >= to) return;
    out.push({ kind, a, b, plan, label });
  };
  for (const s of data.sessions) {
    const job = jobOf(data, s.jobId);
    const kind = job?.color === 'deliv' ? 'deliv' : 'work';
    const actualEnd = s.end ?? Math.max(now, s.start);
    for (const [a, b] of sessionWorkIntervals({ ...s, end: actualEnd }, now)) push(kind, a, b, false, job?.name ?? '');
    if (s.end == null) {
      const sh = shiftOf(data, s);
      if (sh && sh.end > now) push(kind, now, sh.end, true, '預計');
    }
    const j = journeyOfSession(data, s);
    if (j) {
      const go = j.arrive ?? (j.out != null ? s.start : null);
      if (j.out != null) push('commute', j.out, go);
      const from2 = j.leave ?? s.end;
      if (from2 != null && j.home != null) push('commute', from2, j.home);
    }
  }
  const used = new Set(data.sessions.map((s) => s.shiftId));
  for (const sh of data.shifts) {
    if (used.has(sh.id)) continue;
    const job = jobOf(data, sh.jobId);
    push(job?.color === 'deliv' ? 'deliv' : 'work', sh.start, sh.end, true, job?.name ?? '');
  }
  for (const sl of data.sleeps) {
    if (sl.start != null) {
      push('sleep', sl.start, sl.end ?? Math.max(now, sl.start));
      if (sl.end == null && sl.planEnd != null && sl.planEnd > now) push('sleep', now, sl.planEnd, true);
    } else if (sl.planStart != null && sl.planEnd != null) push('sleep', sl.planStart, sl.planEnd, true);
  }
  for (const m of data.meals) push('meal', m.start, m.end ?? m.start + 20 * MIN, !m.confirmed);
  return out;
}

export function calendarAllocation(data, key, now) {
  const a = dayStart(key);
  const b = dayEnd(key);
  const items = intervalsAround(data, a, b, now).filter((x) => !x.plan);
  const by = (kinds) => totalOf(clip(items.filter((x) => kinds.includes(x.kind)).map((x) => [x.a, x.b]), a, b));
  const all = totalOf(clip(items.map((x) => [x.a, x.b]), a, b));
  const end = Math.min(b, Math.max(a, now));
  return {
    work: by(['work', 'deliv']),
    commute: by(['commute']),
    sleep: by(['sleep']),
    meal: by(['meal']),
    unscheduled: Math.max(0, end - a - totalOf(clip(items.map((x) => [x.a, x.b]), a, end))),
    total: all,
    length: b - a
  };
}

// 把出勤工時按日曆日拆開。
export function splitWorkByDay(s, now) {
  const out = {};
  for (const [a, b] of sessionWorkIntervals(s, now)) {
    let t = a;
    while (t < b) {
      const k = dateKey(t);
      const e = Math.min(b, dayEnd(k));
      out[k] = (out[k] || 0) + (e - t);
      t = e;
    }
  }
  return out;
}

// ---------- 睡前預算 ----------
export function nextSleepPlan(data, now) {
  return data.sleeps
    .filter((s) => s.start == null && s.planStart != null && s.planStart > now && s.planStart - now <= 8 * 24 * HOUR)
    .sort((a, b) => a.planStart - b.planStart)[0] || null;
}

export function beforeBedBudget(data, now) {
  if (data.sleeps.some((s) => s.start != null && s.end == null)) return { state: 'sleeping' };
  const plan = nextSleepPlan(data, now);
  if (!plan) return { state: 'unset' };
  const target = plan.planStart;
  const st = data.settings || {};
  const goMs = (st.commuteOutMin ?? 45) * MIN;
  const backMs = (st.commuteBackMin ?? 45) * MIN;
  const busy = [];
  const s = activeSession(data);
  if (s) {
    const sh = shiftOf(data, s);
    if (sh && sh.end > now) {
      busy.push([now, sh.end]);
      const j = journeyOfSession(data, s);
      if (!j || j.home == null) busy.push([sh.end, sh.end + backMs]);
    }
  } else {
    const cyc = currentCycle(data, now);
    if (cyc.session && cyc.session.end != null && cyc.journey && cyc.journey.home == null) {
      busy.push([now, Math.max(now, (cyc.journey.leave ?? cyc.session.end) + backMs)]);
    }
  }
  const used = new Set(data.sessions.map((x) => x.shiftId));
  for (const sh of data.shifts) {
    if (used.has(sh.id) || sh.end <= now || sh.start >= target) continue;
    busy.push([sh.start - goMs, sh.start], [sh.start, sh.end], [sh.end, sh.end + backMs]);
  }
  for (const m of data.meals) {
    if (!m.confirmed) continue;
    busy.push([m.start, m.end ?? m.start + 20 * MIN]);
  }
  for (const sl of data.sleeps) {
    if (sl === plan || sl.start != null || sl.planStart == null || sl.planEnd == null) continue;
    busy.push([sl.planStart, sl.planEnd]);
  }
  const occupied = totalOf(clip(busy, now, target));
  return { state: 'ok', target, plan, countdown: target - now, free: Math.max(0, target - now - occupied) };
}

// ---------- 睡眠統計 ----------
export function sleepByWorkday(data, now) {
  const map = {};
  for (const sl of data.sleeps) {
    if (sl.start == null || sl.end == null) continue;
    const wd = sleepWorkday(sl, data);
    (map[wd] = map[wd] || []).push([sl.start, sl.end]);
  }
  const out = {};
  for (const k of Object.keys(map)) out[k] = totalOf(map[k]);
  return out;
}

export function sleepAverage(data, keys, now) {
  const by = sleepByWorkday(data, now);
  const vals = keys.map((k) => by[k]).filter((v) => v != null);
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: vals.length };
}

// ---------- 收入 ----------
export function sessionPay(s, now) {
  if (s.payMode === 'hourly') {
    if (s.rate == null) return null;
    return (sessionWorkMs(s, now) / HOUR) * s.rate;
  }
  if (s.payMode === 'perOrder') return s.income ?? null;
  return 0;
}

export function periodStats(data, fromKey, toKey, now) {
  const a = dayStart(fromKey);
  const b = dayStart(toKey);
  const sessions = data.sessions.filter((s) => s.start >= a && s.start < b);
  let workMs = 0;
  let hourlyPay = 0;
  let hourlyKnown = true;
  let income = 0;
  let incomeKnown = 0;
  let orders = 0;
  let perOrderCount = 0;
  const byDay = {};
  for (const s of sessions) {
    workMs += sessionWorkMs(s, now);
    for (const [k, v] of Object.entries(splitWorkByDay(s, now))) byDay[k] = (byDay[k] || 0) + v;
    if (s.payMode === 'hourly') {
      const p = sessionPay(s, now);
      if (p == null) hourlyKnown = false; else hourlyPay += p;
    } else if (s.payMode === 'perOrder') {
      perOrderCount++;
      if (s.income != null) { income += s.income; incomeKnown++; }
      if (s.orders != null) orders += s.orders;
    }
  }
  let commuteMs = 0;
  for (const x of intervalsAround(data, a, b, now)) if (x.kind === 'commute' && !x.plan) commuteMs += Math.min(x.b, b) - Math.max(x.a, a);
  return { sessions, workMs, hourlyPay, hourlyKnown, income, incomeKnown, perOrderCount, orders, byDay, commuteMs };
}

// ---------- 清醒時間與近 24 小時睡眠 ----------
export function awakeSince(data, now) {
  const last = data.sleeps.filter((s) => s.end != null && s.end <= now).sort((a, b) => b.end - a.end)[0];
  return last ? { since: last.end, ms: now - last.end } : null;
}

export function sleepLast24h(data, now) {
  const from = now - 24 * HOUR;
  const parts = mergeIntervals(clip(data.sleeps.filter((s) => s.start != null).map((s) => [s.start, s.end ?? now]), from, now));
  return { ms: parts.reduce((n, [a, b]) => n + (b - a), 0), parts, from };
}
