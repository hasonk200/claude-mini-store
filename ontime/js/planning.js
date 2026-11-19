// Calendar arithmetic uses local dates so overnight entries keep their wall clocks across DST.
import { addDays, dateKey, fmtDayMD, fmtTime, fmtDurLong, fromInputs, normTime, HOUR, MIN, DAY } from './time.js';
import { awakeSince, lastMeal, workdayOfSession, journeyOfSession, sleepByWorkday, sessionsOfWorkday, latestOpenSleep } from './logic.js';

export function clockAt(date, raw) {
  const clock = normTime(raw);
  if (!clock || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = fromInputs(date, clock);
  return t != null && dateKey(t) === date && fmtTime(t) === clock ? t : null;
}

export function clockRange(date, first, last) {
  const a = normTime(first), b = normTime(last);
  if (!a || !b || a === b) return null;
  const start = clockAt(date, a);
  const end = clockAt(b < a ? addDays(date, 1) : date, b);
  return start != null && end != null && end > start ? { start, end } : null;
}

export function copyWeek(data, week) {
  const from = addDays(week, -7);
  return data.shifts.filter(s => dateKey(s.start) >= from && dateKey(s.start) < week).map(s => {
    const date = addDays(dateKey(s.start), 7);
    const start = clockAt(date, fmtTime(s.start));
    const end = clockAt(addDays(dateKey(s.end), 7), fmtTime(s.end));
    const skip = start == null || end == null ? '轉鐘日沒有這個時間'
      : data.dayMarks.some(m => m.date === date) ? '已標休假'
      : data.shifts.some(sh => dateKey(sh.start) === date || sh.start < end && sh.end > start) ? '已有班次' : '';
    return { date, jobId: s.jobId, start, end, skip };
  });
}

export function reminders(data, now) {
  const prefs = data.settings.reminders || {};
  const awake = awakeSince(data, now), meal = lastMeal(data, now), rows = [];
  const sleeping = data.sleeps.some(s => s.start != null && s.end == null);
  if (prefs.sleep !== false && !sleeping && awake?.ms >= 20 * HOUR) {
    if (awake.ms >= 48 * HOUR) {
      const days = Math.floor(awake.ms / DAY);
      rows.push({ title: `已經 ${days} 日冇記過瞓覺`, action: 'sleep-catchup', label: '補返近幾日', t: awake.since });
    } else {
      rows.push({ title: `起身後已過 ${fmtDurLong(awake.ms)}，可能漏記咗瞓覺`, action: 'quick-wake', label: '瞓醒喇', t: awake.since });
    }
  }
  const closed = data.sessions.filter(s => s.end != null && s.end <= now).sort((a,b) => b.end-a.end);
  const s = closed[0];
  if (prefs.home !== false && s && now - s.end >= 3 * HOUR && !journeyOfSession(data,s)?.home) {
    const gap = now - s.end;
    const title = gap >= 48 * HOUR
      ? `${fmtDayMD(workdayOfSession(s, data))} 那班未記到家`
      : `收工已經 ${fmtDurLong(gap)}，未記到家`;
    rows.push({ title, action: 'open-trip', label: '補到家', t:s.end, sid:s.id, wd:workdayOfSession(s,data), step:'home' });
  }
  if (prefs.meal !== false && !sleeping && meal?.ms >= 6 * HOUR)
    rows.push({ title: `上一餐已過 ${fmtDurLong(meal.ms)}`, action:'quick-meal', label:'食咗飯', t:meal.at });
  if (prefs.income !== false) {
    for (const session of closed) {
      if (now - session.end > 48 * HOUR) break;
      if (session.payMode !== 'perOrder' || session.income != null) continue;
      const day = fmtDayMD(workdayOfSession(session, data));
      rows.push({ title: `${day} 工作日收入未填`, action: 'income-open', label: '填收入／單數', t: session.end, id: session.id });
    }
  }
  return rows;
}

// 掛住超過 4 小時仍未上班的獨立通勤旅程（例如 01:42 已抵達但一直冇上班）：主動問用戶要補記定清除。
const STALE_JOURNEY_MS = 4 * HOUR;
export function staleJourney(data, now, cycle) {
  if (!cycle?.journey || cycle.session || cycle.journey.sessionId || cycle.journey.home != null) return null;
  if (latestOpenSleep(data)) return null;
  const j = cycle.journey;
  let lastStep = null;
  let lastT = null;
  for (const k of ['out', 'ride', 'arrive', 'leave', 'ride2']) {
    if (j[k] != null && (lastT == null || j[k] >= lastT)) { lastStep = k; lastT = j[k]; }
  }
  if (lastT == null || now - lastT < STALE_JOURNEY_MS) return null;
  return { journey: j, step: lastStep, t: lastT, ms: now - lastT };
}

// 過去 N 個工作日中缺少實際睡眠的日子（由近到遠），附每日常用預設入睡日期與起止鐘數（跨午夜與轉鐘日安全）。
export function missingSleepDays(data, now, count = 7) {
  const today = dateKey(now);
  const by = sleepByWorkday(data, now);
  const lastMain = (data.sleeps || [])
    .filter((s) => s.start != null && s.end != null && s.end - s.start >= 3 * HOUR)
    .sort((a, b) => b.end - a.end)[0];
  const tplStart = lastMain ? fmtTime(lastMain.start) : '23:00';
  const tplEnd = lastMain ? fmtTime(lastMain.end) : '07:00';
  const tplDur = lastMain ? Math.min(9 * HOUR, Math.max(5 * HOUR, lastMain.end - lastMain.start)) : 7.5 * HOUR;
  const daytimeSleeper = lastMain ? Number(tplStart.slice(0, 2)) < 15 : false;
  const rows = [];
  const used = [];
  const overlapsExisting = (a, b) => (data.sleeps || []).some((x) => x.start != null && x.start < b && (x.end ?? now) > a)
    || used.some(([x, y]) => x < b && y > a);
  for (let i = 1; i <= count; i++) {
    const wd = addDays(today, -i);
    if (by[wd] != null) continue;
    let sd = wd;
    let st = tplStart;
    let et = tplEnd;
    const sess = sessionsOfWorkday(data, wd).filter((x) => x.end != null && x.end < now).sort((a, b) => b.end - a.end)[0];
    if (sess) {
      const home = journeyOfSession(data, sess)?.home;
      const raw = home != null && home >= sess.end ? home + 30 * MIN : sess.end + 60 * MIN;
      const s0 = Math.ceil(raw / (5 * MIN)) * 5 * MIN;
      const e0 = Math.min(s0 + tplDur, Math.floor(now / (5 * MIN)) * 5 * MIN);
      if (e0 - s0 >= HOUR) { sd = dateKey(s0); st = fmtTime(s0); et = fmtTime(e0); }
    } else if (daytimeSleeper) {
      // 夜班朝早先瞓：工作日 wd 的睡眠發生在隔天早上（wd + 1）；若還沒開始睡就跳過，不跟前一日撞日。
      const nextDay = addDays(wd, 1);
      const rNext = clockRange(nextDay, tplStart, tplEnd);
      if (!rNext || rNext.start >= now - HOUR) continue;
      sd = nextDay;
    }
    const r = clockRange(sd, st, et);
    if (!r || r.start >= now - HOUR) continue;
    let end = r.end;
    if (end > now) {
      end = Math.floor(now / (5 * MIN)) * 5 * MIN;
      if (end - r.start < HOUR) continue;
      et = fmtTime(end);
    }
    if (overlapsExisting(r.start, end)) continue;
    used.push([r.start, end]);
    rows.push({ wd, sd, st, et });
  }
  return rows;
}

export function reminderCalendar(data, now) {
  const prefs = data.settings.reminders || {}, events = [];
  if (prefs.home !== false) for (const sh of data.shifts) events.push([sh.end + 30 * MIN, '記到家', 'home', sh.id]);
  if (prefs.sleep !== false) for (const s of data.sleeps) if (s.planEnd && !s.end) events.push([s.planEnd, '記瞓醒', 'wake', s.id]);
  const stamp = t => new Date(t).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//OnTime//Reminders//ZH','CALSCALE:GREGORIAN'];
  let count = 0;
  for (const [t,title,type,id] of events.filter(e=>e[0]>=now)) {
    lines.push('BEGIN:VEVENT','UID:'+type+'-'+encodeURIComponent(id)+'@ontime','DTSTAMP:'+stamp(now),'DTSTART:'+stamp(t),'DURATION:PT1M','SUMMARY:'+title,'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:'+title,'END:VALARM','END:VEVENT');
    count++;
  }
  return { count, text:[...lines,'END:VCALENDAR',''].join('\r\n') };
}

export function restTarget(data, range, mode, now) {
  if (!range) return {error:'請填有效的開始及結束時間'};
  const {start,end} = range;
  if (end>now) return {error:'休息不能記在將來'};
  const session = mode === 'auto'
    ? data.sessions.find(s => s.start<=start && (s.end ?? (s.endPending ? s.start : now))>=end)
    : data.sessions.find(s=>s.id===mode);
  if (mode !== 'auto' && mode !== 'alone' && !session) return {error:'找不到這班'};
  if (session && (start<session.start || end>(session.end ?? now))) return {error:'班內休息須在上班與下班之間'};
  const overlap = r => r.start<end && (r.end ?? now)>start;
  if (data.rests.some(overlap) || data.sessions.some(s=>(s.breaks||[]).some(overlap))) return {error:'和已有休息重疊'};
  if (!session && mode === 'auto' && data.sessions.some(s => s.start<end && (s.end ?? (s.endPending?s.start:now))>start))
    return {error:'休息跨過上下班，請分開兩段'};
  return {session};
}
