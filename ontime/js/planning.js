// Calendar arithmetic uses local dates so overnight entries keep their wall clocks across DST.
import { addDays, dateKey, fmtDayMD, fmtTime, fromInputs, normTime, HOUR, MIN } from './time.js';
import { awakeSince, lastMeal, workdayOfSession, journeyOfSession } from './logic.js';

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
  if (prefs.sleep !== false && !sleeping && awake?.ms >= 20 * HOUR)
    rows.push({ title: '上次起身後已過 20 小時', action: 'quick-wake', label: '瞓醒喇', t: awake.since });
  const closed = data.sessions.filter(s => s.end != null && s.end <= now).sort((a,b) => b.end-a.end);
  const s = closed[0];
  if (prefs.home !== false && s && now - s.end >= 3 * HOUR && !journeyOfSession(data,s)?.home)
    rows.push({ title: '收工超過 3 小時，未記到家', action: 'open-trip', label: '補到家', t:s.end, sid:s.id, wd:workdayOfSession(s,data), step:'home' });
  if (prefs.meal !== false && !sleeping && meal?.ms >= 6 * HOUR)
    rows.push({ title:'上一餐已過 6 小時', action:'quick-meal', label:'食咗飯', t:meal.at });
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
