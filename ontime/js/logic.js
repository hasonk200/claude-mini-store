// 作息規則：純函式，不碰畫面和儲存，方便測試。
// data = { jobs, shifts, sessions, journeys, meals, sleeps, dayMarks, settings }
import { MIN, HOUR, dateKey, dayStart, dayEnd, addDays, wdOfKey, at } from './time.js';

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

// ---------- 已驗證標記 ----------
// 通用：rec[key] = { start: true, ... }。
export const isFlag = (rec, key, field) => !!(rec && rec[key] && rec[key][field]);
export function markFlag(rec, key, field, on) {
  if (!rec || !field) return;
  if (on) { rec[key] = { ...(rec[key] || {}), [field]: true }; return; }
  if (!rec[key]) return;
  const a = { ...rec[key] };
  delete a[field];
  if (Object.keys(a).length) rec[key] = a; else delete rec[key];
}

// ---------- 已驗證 ----------
// 你手動打勾、確認「這個時間是對的」：rec.verified = { start: true, ... }。沒有標記 = 還沒驗證。
// 改時間不會自動取消打勾，要不要保留由你決定。
export const isVerified = (rec, field) => isFlag(rec, 'verified', field);
export const markVerified = (rec, field, on) => markFlag(rec, 'verified', field, on);

// 時間線上的一個事件，對應的時間有沒有某個標記（目前只有 verified 已驗證）。計畫不算。
function eventFlag(data, e, key) {
  if (e.plan || !e.ref) return false;
  const { type, id, field } = e.ref;
  if (type === 'journey') return isFlag(data.journeys.find((x) => x.id === id), key, field);
  if (type === 'session') {
    const s = data.sessions.find((x) => x.id === id);
    if (field === 'break') return isFlag((s?.breaks || []).find((b) => b.start === e.t), key, 'start');
    return isFlag(s, key, field);
  }
  if (type === 'sleep') return isFlag(data.sleeps.find((x) => x.id === id), key, field);
  if (type === 'rest') return isFlag((data.rests || []).find((x) => x.id === id), key, field);
  if (type === 'meal') return isFlag(data.meals.find((x) => x.id === id), key, 'start');
  return false;
}
export const eventVerified = (data, e) => eventFlag(data, e, 'verified');

// ---------- 出勤 ----------
// ---------- 工作日：由主睡眠起床開始，到下一次主睡眠起床為止 ----------
export const MAIN_SLEEP_MS = 4 * HOUR;
const DAY_REACH_MS = 36 * HOUR;

// 起床的日期就是新一天的名字；凌晨 4 點前起床，仍用前一天的日期。
export function dayKeyOfWake(t) {
  return new Date(t).getHours() < 4 ? addDays(dateKey(t), -1) : dateKey(t);
}

const boundaryCache = new WeakMap();
// 主睡眠的起床時間（排序）；間隔少於 30 分鐘的睡眠先合併，再看是否滿 4 小時。
export function dayBoundaries(data) {
  const sleeps = data.sleeps;
  const sig = sleeps.reduce((n, x) => n + (x.start || 0) + (x.end || 0) + (x.mainSleep ? 1 : 0), sleeps.length);
  const hit = boundaryCache.get(sleeps);
  if (hit && hit.sig === sig) return hit.out;
  const done = sleeps.filter((x) => x.start != null && x.end != null && x.end > x.start)
    .map((x) => [x.start, x.end, x.mainSleep === true])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [a, b, forced] of done) {
    const last = merged[merged.length - 1];
    if (last && a - last[1] < 30 * MIN) {
      last[1] = Math.max(last[1], b);
      last[2] = last[2] || forced;
    } else merged.push([a, b, forced]);
  }
  // 使用者手動標「當作工作日分界」的睡眠，即使不到 4 小時也算。
  const out = merged.filter(([a, b, forced]) => forced || b - a >= MAIN_SLEEP_MS).map(([, b]) => b);
  boundaryCache.set(sleeps, { sig, out });
  return out;
}

// 某一刻屬於哪個工作日；附近沒有主睡眠紀錄時回傳 null，由呼叫者用舊規則。
export function dayOf(data, t) {
  const bs = dayBoundaries(data);
  let lo = 0;
  let hi = bs.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bs[mid] <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (found < 0 || t - bs[found] > DAY_REACH_MS) return null;
  return dayKeyOfWake(bs[found]);
}

// 補登時揀咗嘅工作日（workdayManual）優先；即時按掣的紀錄才用起床邊界推算。
export const workdayOfSession = (s, data) => (s.workdayManual && s.workdayDate) || (data && dayOf(data, s.start)) || dateKey(s.start);
// 補舊班時收工留空 = 「待補收工」（endPending）：不是正在上班，也不會把工時一路算到現在。
// 只有「收工留空、又沒標待補」的才是進行中的那一班。
export const OPEN_LIMIT = 16 * HOUR;
export const isOpenSession = (s) => s.end == null && !s.endPending;
// 計算用的結束時間：已收工用收工；待補收工當作未知（不計工時）；進行中算到現在。
export const sessionEndAt = (s, now) => s.end ?? (s.endPending ? s.start : now);
export const activeSession = (data) => data.sessions.find(isOpenSession) || null;

export function breakIntervals(s, now) {
  return (s.breaks || []).map((b) => [b.start, b.end ?? now]);
}

export function sessionWorkIntervals(s, now) {
  const end = sessionEndAt(s, now);
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

// ---------- 補登：時間都扣在「班次」上 ----------
// 班次 = 一筆出勤（session）。補登時先選班次，只填「時：分」，日期由班次決定，不會跑去「現在」。
export const SHIFT_FAR_MS = 12 * HOUR;
const PRE_STEPS = new Set(['out', 'ride', 'arrive', 'clockIn']);
const POST_STEPS = new Set(['clockOut', 'leave', 'ride2', 'home']);
export const SHIFT_BOUND_STEPS = new Set(['out', 'ride', 'arrive', 'clockIn', 'break', 'clockOut', 'leave', 'ride2', 'home']);

// 這一步「通常」落在班次的哪個時間附近（選日期、預設時間都靠它）。
function stepAnchor(step, s) {
  const end = s.end ?? s.start + 8 * HOUR;
  if (PRE_STEPS.has(step)) return s.start;
  if (step === 'break') return s.start + (end - s.start) / 2;
  return end;
}

// 預設時間：還沒有這一步時，放在班次附近合理的位置（不是「現在」）。
const DEFAULT_OFFSET = { out: -45 * MIN, ride: -30 * MIN, arrive: -5 * MIN, clockIn: 0, break: 0, clockOut: 0, leave: 5 * MIN, ride2: 10 * MIN, home: 40 * MIN };
export function defaultStepTime(step, s) {
  return Math.round((stepAnchor(step, s) + (DEFAULT_OFFSET[step] || 0)) / MIN) * MIN;
}

// 你只打「時：分」，這個函式找出最合理的日期：前後一天裡，離這一步通常位置最近的那一個。
// 例如班次 23:00→07:00，打下班 07:05 → 隔天 07:05；打出門 22:20 → 班次當天 22:20。
export function resolveStepTime(step, hhmm, s) {
  if (!s || !SHIFT_BOUND_STEPS.has(step) || !hhmm) return null;
  const ref = stepAnchor(step, s);
  const base = dateKey(ref);
  let best = null;
  for (const k of [addDays(base, -1), base, addDays(base, 1)]) {
    const t = at(k, hhmm);
    if (Number.isNaN(t)) return null;
    if (best == null || Math.abs(t - ref) < Math.abs(best - ref)) best = t;
  }
  return best;
}

// 這個時間離班次（上班到下班）有多遠；在班次裡面是 0。
export function shiftDistance(t, s) {
  const end = s.end ?? s.start;
  if (t < s.start) return s.start - t;
  if (t > end) return t - end;
  return 0;
}

// 最近用過的班次時段（HH:MM–HH:MM），新增班次時一按就填好。
export function recentShiftRanges(data, n = 3) {
  const seen = [];
  for (const x of [...data.sessions].sort((a, b) => b.start - a.start)) {
    if (x.end == null) continue;
    const key = `${fmtClock(x.start)}–${fmtClock(x.end)}`;
    if (!seen.some((r) => r.key === key)) seen.push({ key, from: fmtClock(x.start), to: fmtClock(x.end) });
    if (seen.length >= n) break;
  }
  return seen;
}

// ---------- 通勤與這一趟 ----------
export function journeyOfSession(data, s) {
  return s ? data.journeys.find((j) => j.sessionId === s.id) || null : null;
}

const JOURNEY_KEYS = ['out', 'ride', 'arrive', 'leave', 'ride2', 'home'];
// 還沒掛到出勤的行程（例如只補登了「到家」）屬於哪個工作日。
export function journeyWorkday(j, data) {
  if (j.workdayDate) return j.workdayDate;
  const t = JOURNEY_KEYS.map((k) => j[k]).find((v) => v != null);
  if (t == null) return null;
  return (data && dayOf(data, t)) || dateKey(t);
}

export function standaloneJourneys(data, wd) {
  const ids = new Set(data.sessions.map((s) => s.id));
  return data.journeys.filter((j) => (!j.sessionId || !ids.has(j.sessionId)) && journeyWorkday(j, data) === wd);
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
  const sleeping = latestOpenSleep(data);
  if (sleeping) return { key: 'sleep', title: '睡眠中', since: sleeping.start };
  const s = cycle.session;
  if (s && isOpenSession(s)) {
    const onBreak = (s.breaks || []).find((b) => b.end == null);
    if (onBreak) return { key: 'break', title: '休息中', since: onBreak.start };
    return { key: 'work', title: '工作中', since: s.start };
  }
  const resting = activeRest(data);
  if (resting) return { key: 'rest', title: '休息中', since: resting.start };
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

// 只有使用者手動指定（workdayManual）才採用寫下來的日期；
// 舊資料沒有標記，先照舊保留，等使用者在設定頁按「重新計算」才改成自動。
export function sleepWorkday(sl, data) {
  const t = sl.start ?? sl.planStart;
  if (sl.workdayManual) return sl.workdayDate || dateKey(t);
  if (sl.workdayDate === null) return dateKey(t);
  if (sl.workdayDate) return sl.workdayDate;
  return dayOf(data, t) || inferSleepWorkday(t, data);
}

// 進行中的睡眠取「最晚開始」那一筆；wakeUp 與畫面都靠它，避免關到舊紀錄。
export function latestOpenSleep(data) {
  return data.sleeps.filter((s) => s.start != null && s.end == null).sort((a, b) => b.start - a.start)[0] || null;
}

// 獨立休息（不屬於任何班別，不扣工時）。
export function activeRest(data) {
  return (data.rests || []).filter((r) => r.start != null && r.end == null).sort((a, b) => b.start - a.start)[0] || null;
}

export const restWorkday = (r, data) => dayOf(data, r.start) || dateKey(r.start);

// 補登「起床」要找哪一筆：這天進行中 → 任何進行中 → 這天最後一筆完成的。
// 進行中的紀錄一律優先，避免改到已完成的小睡。
export function sleepEndTarget(data, wd) {
  const inWd = data.sleeps
    .filter((s) => s.start != null && sleepWorkday(s, data) === wd)
    .sort((a, b) => b.start - a.start);
  return inWd.find((s) => s.end == null) || latestOpenSleep(data) || inWd[0] || null;
}

// 舊資料裡被自動寫死的歸屬，列出重算後會改變的紀錄（給「重新計算」預覽用）。
export function sleepWorkdayChanges(data) {
  const out = [];
  for (const sl of data.sleeps) {
    if (sl.workdayManual || sl.workdayDate == null) continue;
    const t = sl.start ?? sl.planStart;
    const to = dayOf(data, t) || inferSleepWorkday(t, data);
    if (to !== sl.workdayDate) out.push({ id: sl.id, from: sl.workdayDate, to, start: t });
  }
  return out;
}

export function sleepActualMs(sl, now) {
  if (sl.start == null) return null;
  return (sl.end ?? now) - sl.start;
}

// ---------- 目前的工作日 ----------
// 16 小時例外：最後一次起床（或下班）之後超過 16 小時，又沒有新的班或睡眠，就視為新的一天，
// 避免沒有排班、沒有記錄時一直卡在舊的工作日。睡著或上班中時不套用。
const WAKE_GAP = 16 * HOUR;
export function currentWorkday(data, now) {
  const byWake = dayOf(data, now);
  const awakeIdle = !data.sleeps.some((x) => x.start != null && x.end == null)
    && !data.sessions.some((x) => x.start <= now && (isOpenSession(x) || (x.end != null && x.end > now)));
  if (awakeIdle) {
    const lastEnd = Math.max(
      0,
      ...dayBoundaries(data).filter((t) => t <= now),
      ...data.sessions.filter((x) => x.end != null && x.end <= now).map((x) => x.end)
    );
    const newShift = data.shifts.some((sh) => sh.start > lastEnd && sh.start <= now);
    if (now - lastEnd > WAKE_GAP && !newShift) return dateKey(now);
  }
  if (byWake) return byWake;
  const s = activeSession(data) || data.sessions.find((x) => x.start <= now && x.end != null && x.end > now);
  if (s) return workdayOfSession(s, data);
  const sleeping = latestOpenSleep(data);
  if (sleeping) return sleepWorkday(sleeping, data);
  const cyc = currentCycle(data, now);
  if (cyc.session) return workdayOfSession(cyc.session, data);
  if (cyc.journey) {
    const sh = data.shifts
      .filter((x) => x.start >= (cyc.journey.out ?? now) - HOUR)
      .sort((a, b) => a.start - b.start)[0];
    if (sh && sh.start - now < 6 * HOUR) return dateKey(sh.start);
    return dateKey(cyc.journey.out ?? now);
  }
  const done = data.sessions
    .filter((x) => x.end != null && x.end <= now && now - x.end <= 36 * HOUR)
    .sort((a, b) => b.end - a.end)[0];
  if (done) {
    const started = data.shifts.find((sh) => sh.start > done.end && sh.start <= now);
    return started ? dateKey(started.start) : workdayOfSession(done, data);
  }
  const upcoming = data.shifts
    .filter((sh) => sh.start > now && sh.start - now <= 24 * HOUR)
    .sort((a, b) => a.start - b.start)[0];
  if (upcoming) return dateKey(upcoming.start);
  return dateKey(now);
}

// ---------- 工作日範圍與事件 ----------
export function sessionsOfWorkday(data, wd) {
  return data.sessions.filter((s) => workdayOfSession(s, data) === wd).sort((a, b) => a.start - b.start);
}

export function shiftsOfWorkday(data, wd) {
  return data.shifts.filter((sh) => dateKey(sh.start) === wd).sort((a, b) => a.start - b.start);
}

// 這個工作日由哪次起床開始、到哪次起床結束（沒有主睡眠紀錄時回傳 null）。
export function wakeSpan(data, wd) {
  const bs = dayBoundaries(data);
  const i = bs.findIndex((b) => dayKeyOfWake(b) === wd);
  if (i < 0) return null;
  let j = i + 1;
  while (j < bs.length && dayKeyOfWake(bs[j]) === wd) j++;
  return { start: bs[i], end: j < bs.length ? bs[j] : null };
}

export function workdaySpan(data, wd, now) {
  const ws = wakeSpan(data, wd);
  if (ws) {
    let end = ws.end;
    if (end == null) {
      const open = data.sleeps.find((x) => x.start != null && x.end == null && x.start >= ws.start);
      end = Math.max(now, open?.planEnd ?? 0, ws.start + 16 * HOUR);
    }
    const first = new Date(ws.start - 30 * MIN);
    first.setMinutes(0, 0, 0);
    return [first.getTime(), end + 30 * MIN];
  }
  const times = [];
  for (const s of sessionsOfWorkday(data, wd)) {
    times.push(s.start, sessionEndAt(s, now));
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
  const byWake = dayOf(data, meal.start);
  if (byWake) return byWake;
  const wd = dateKey(meal.start);
  const prev = addDays(wd, -1);
  // 前一個工作日的班次可能跨過午夜，要先看它有沒有包住這一餐。
  for (const s of sessionsOfWorkday(data, prev)) {
    const j = journeyOfSession(data, s);
    const end = Math.max(sessionEndAt(s, now), j?.home ?? 0, j?.leave ?? 0);
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
        if (j[k] != null) ev.push({ t: j[k], step: k, kind: KIND_OF[k], icon: ICON_OF[k], title: k === 'ride' ? '去程搭車' : STEP_LABEL[k], detail: k === 'ride' ? rideDetail(j, 'ride') : undefined, ref: { type: 'journey', id: j.id, field: k } });
      }
    }
    ev.push({ t: s.start, step: 'clockIn', kind: 'work', icon: 'bag', title: `上班 · ${job?.name ?? '工作'}`, ref: { type: 'session', id: s.id, field: 'start' } });
    for (const b of s.breaks || []) {
      ev.push({ t: b.start, kind: 'break', icon: 'cup', title: '休息', detail: b.end ? `${Math.round((b.end - b.start) / MIN)} 分鐘` : '進行中', ref: { type: 'session', id: s.id, field: 'break' } });
    }
    if (s.end != null) {
      ev.push({ t: s.end, step: 'clockOut', kind: 'work', icon: 'flag', title: '下班', detail: `本班 ${fmtShort(sessionWorkMs(s, now))}`, ref: { type: 'session', id: s.id, field: 'end' } });
    } else if (s.endPending) {
      ev.push({ t: s.start, step: 'clockOut', kind: 'work', icon: 'flag', title: '待補收工', detail: '收工時間未知，點這裡補上', plan: true, ref: { type: 'session', id: s.id, field: 'end' } });
    } else if (sh) {
      ev.push({ t: sh.end, step: 'clockOut', kind: 'work', icon: 'flag', title: '預計下班', plan: true, ref: { type: 'session', id: s.id, field: 'end' } });
    }
    if (j) {
      for (const k of ['leave', 'ride2', 'home']) {
        if (j[k] != null) ev.push({ t: j[k], step: k, kind: KIND_OF[k], icon: ICON_OF[k], title: k === 'ride2' ? '回程搭車' : STEP_LABEL[k], detail: k === 'ride2' ? rideDetail(j, 'ride2') : undefined, ref: { type: 'journey', id: j.id, field: k } });
      }
    }
  }
  // 還沒有出勤的行程也要顯示，不然補登了會「看不到」。
  for (const j of standaloneJourneys(data, wd)) {
    for (const k of JOURNEY_KEYS) {
      if (j[k] == null) continue;
      const title = k === 'ride' ? '去程搭車' : k === 'ride2' ? '回程搭車' : STEP_LABEL[k];
      ev.push({ t: j[k], step: k, kind: KIND_OF[k], icon: ICON_OF[k], title, detail: k === 'ride' || k === 'ride2' ? rideDetail(j, k) : undefined, ref: { type: 'journey', id: j.id, field: k } });
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
      if (sl.end != null) {
        const next = dayBoundaries(data).includes(sl.end) ? dayKeyOfWake(sl.end) : null;
        const title = next && next !== wd ? `起床 · ${wdOfKey(next)}工作日開始` : '起床';
        ev.push({ t: sl.end, kind: 'sleep', icon: 'sun', title, ref: { type: 'sleep', id: sl.id, field: 'end' } });
      }
      else if (sl.planEnd != null) ev.push({ t: sl.planEnd, kind: 'sleep', icon: 'sun', title: '預計起床', detail: '計畫時間，發生前不計入睡眠時數', plan: true, ref: { type: 'sleep', id: sl.id, field: 'end' } });
    } else if (sl.planStart != null) {
      ev.push({ t: sl.planStart, kind: 'sleep', icon: 'moon', title: '預計入睡', plan: true, ref: { type: 'sleep', id: sl.id, field: 'start' } });
      if (sl.planEnd != null) ev.push({ t: sl.planEnd, kind: 'sleep', icon: 'sun', title: '預計起床', plan: true, ref: { type: 'sleep', id: sl.id, field: 'end' } });
    }
  }
  for (const r of data.rests || []) {
    if (r.start == null || restWorkday(r, data) !== wd) continue;
    ev.push({
      t: r.start, kind: 'break', icon: 'cup', title: '休息',
      detail: r.end ? `${Math.round((r.end - r.start) / MIN)} 分鐘` : '進行中',
      ref: { type: 'rest', id: r.id, field: 'start' }
    });
  }
  for (const m of data.meals) {
    if (mealWorkday(m, data, now) !== wd) continue;
    const during = sessions.some((s) => m.start >= s.start && m.start <= sessionEndAt(s, now));
    ev.push({
      t: m.start, kind: 'meal', icon: 'meal', title: (m.name || '用餐') + (during ? '（工作中）' : ''),
      detail: m.end ? `${fmtClock(m.start)}–${fmtClock(m.end)}` : '', plan: !m.confirmed, ref: { type: 'meal', id: m.id }
    });
  }
  for (const e of ev) e.verified = eventVerified(data, e);
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
    const actualEnd = s.endPending && s.end == null ? s.start : s.end ?? Math.max(now, s.start);
    for (const [a, b] of sessionWorkIntervals({ ...s, end: actualEnd }, now)) push(kind, a, b, false, job?.name ?? '');
    if (isOpenSession(s)) {
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

// 新表單的預設時間：看的是現在這個工作日就用現在；
// 切到別的工作日（例如今天頁往回看週六）就沿用那一天的日期，時間先用現在的時：分。
export function timeOnWorkday(data, wd, now) {
  if (!wd || wd === currentWorkday(data, now)) return now;
  return at(wd, `${String(new Date(now).getHours()).padStart(2, '0')}:${String(new Date(now).getMinutes()).padStart(2, '0')}`);
}

// 新增班次：開工日期要落在工作日當天，或者隔天（午夜後才開工的夜班）。
// 不在這範圍就回傳開工那天的日期，讓畫面問清楚要歸到哪一個工作日。
export function shiftDateMismatch(wd, start) {
  const k = dateKey(start);
  return k === wd || k === addDays(wd, 1) ? null : k;
}

// 進行中那一班估計幾點收工（只用來估算，不是收工紀錄）。
// 次序：你填的預計收工（expectedEnd）→ 排班的下班時間；已經過了的不算。
export function workEndEstimate(data, s, now) {
  if (s.expectedEnd != null && s.expectedEnd > now) return { at: s.expectedEnd, source: 'expected' };
  const sh = shiftOf(data, s);
  if (sh && sh.end > now) return { at: sh.end, source: 'shift' };
  return { at: null, reason: sh ? 'overtime' : 'no-shift' };
}

// 最近 16 小時內收工的一班（用來估回程）。
function latestEndedSession(data, now) {
  let best = null;
  for (const x of data.sessions) {
    if (x.end == null || x.end > now || now - x.end > 16 * HOUR) continue;
    if (!best || x.end > best.end) best = x;
  }
  return best;
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
  let workEnd = null;
  const s = activeSession(data);
  if (s) {
    // 正在上班：要知道幾點收工才估得到。先用你填的「預計收工」，再用排班；
    // 兩樣都沒有（或排班已過、仍未收工）就講明估算不到，不把整段當成自由時間。
    const end = workEndEstimate(data, s, now);
    if (end.at == null) {
      return { state: 'unknown-end', reason: end.reason, session: s, target, plan, countdown: target - now };
    }
    workEnd = { ...end, session: s };
    busy.push([now, end.at]);
    const j = journeyOfSession(data, s);
    if (!j || j.home == null) busy.push([end.at, end.at + backMs]);
  } else {
    // 收了工但還沒記到家（包括完全沒有行程紀錄）：回程時間也要扣。
    const last = latestEndedSession(data, now);
    if (last) {
      const j = journeyOfSession(data, last);
      if (!j || j.home == null) busy.push([now, Math.max(now, (j?.leave ?? last.end) + backMs)]);
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
  return { state: 'ok', target, plan, countdown: target - now, free: Math.max(0, target - now - occupied), workEnd };
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
  // byDay / carryByDay 按「日曆日」：所有跟期間重疊的班都計（例如週日 23:00 開、週一 07:00 收的夜班，週一那 7 小時也算），
  // 但只留期間內的日子。carryByDay 是其中「前一天開的班帶過來」的部分。
  // workMs、收入、班數仍然按「開班日期」，跨期間的班只算在開班那一段。
  const byDay = {};
  const carryByDay = {};
  for (const s of data.sessions) {
    if (s.start >= b || sessionEndAt(s, now) <= a) continue;
    for (const [k, v] of Object.entries(splitWorkByDay(s, now))) {
      if (k < fromKey || k >= toKey) continue;
      byDay[k] = (byDay[k] || 0) + v;
      if (k !== dateKey(s.start)) carryByDay[k] = (carryByDay[k] || 0) + v;
    }
  }
  for (const s of sessions) {
    workMs += sessionWorkMs(s, now);
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
  return { sessions, workMs, hourlyPay, hourlyKnown, income, incomeKnown, perOrderCount, orders, byDay, carryByDay, commuteMs };
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

// ---------- 用餐 ----------
// 上一餐：已確認、已經開始的最近一餐；以結束時間計（沒有結束時間就用開始時間）。
export function lastMeal(data, now) {
  const done = data.meals.filter((m) => m.confirmed !== false && m.start <= now)
    .map((m) => ({ meal: m, at: Math.min(m.end ?? m.start, now) }))
    .sort((a, b) => b.at - a.at)[0];
  return done ? { ...done, ms: now - done.at } : null;
}

// 最近常吃：最近 recent 筆用餐裡，某個欄位最常出現的前 n 個（忽略空白和大小寫差異）。
// 搭車的交通工具選項，以及最近用過的上車地點。
export const RIDE_MODES = ['巴士', '地鐵', '電車', '步行', '單車', '開車', '其他'];
export function recentPlaces(data, n = 5) {
  const counts = new Map();
  for (const j of [...data.journeys].reverse()) {
    for (const v of [j.rideFrom, j.ride2From]) {
      const t = String(v || '').trim();
      if (!t) continue;
      const c = counts.get(t.toLowerCase()) || { value: t, count: 0 };
      c.count++;
      counts.set(t.toLowerCase(), c);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, n).map((c) => c.value);
}
export const rideDetail = (j, k) => [j?.[`${k}Mode`], j?.[`${k}From`]].filter(Boolean).join(' · ');

export function frequentMealValues(data, field, n = 5, recent = 30) {
  const counts = new Map();
  for (const m of [...data.meals].sort((a, b) => b.start - a.start).slice(0, recent)) {
    const v = String(m[field] || '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    const c = counts.get(key) || { value: v, count: 0, last: 0 };
    c.count++;
    c.last = Math.max(c.last, m.start);
    counts.set(key, c);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || b.last - a.last).slice(0, n).map((c) => c.value);
}
