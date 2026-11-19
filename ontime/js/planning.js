// Calendar arithmetic uses local dates so overnight entries keep their wall clocks across DST.
import { addDays, dateKey, fmtDayMD, fmtTime, fmtDurLong, fromInputs, normTime, HOUR, MIN, DAY } from './time.js';
import { awakeSince, lastMeal, workdayOfSession, journeyOfSession, sleepByWorkday, sessionsOfWorkday, latestOpenSleep, STEPS, shiftsOfWorkday, tripState, currentWorkday, currentCycle } from './logic.js';

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
  // 啱啱返到屋企 4 個鐘內（正常收工準備去瞓）：暫唔彈單日漏記睡眠，避免同主掣「去瞓」打架；超過 48 小時多日未記照提。
  const recentHome = (data.journeys || []).some((j) => j.home != null && j.home <= now && now - j.home < 4 * HOUR);
  if (prefs.sleep !== false && !sleeping && awake?.ms >= 20 * HOUR) {
    if (awake.ms >= 48 * HOUR) {
      const days = Math.floor(awake.ms / DAY);
      rows.push({ title: `已經 ${days} 日冇記過瞓覺`, action: 'sleep-catchup', label: '補返近幾日', t: awake.since });
    } else if (!recentHome) {
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
  if (prefs.meal !== false && !sleeping && meal?.ms >= 6 * HOUR) {
    const title = meal.ms >= 48 * HOUR
      ? `已經 ${Math.floor(meal.ms / DAY)} 日冇記過食飯`
      : `上一餐已過 ${fmtDurLong(meal.ms)}`;
    rows.push({ title, action:'quick-meal', label:'食咗飯', t:meal.at });
  }
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
      const e0 = s0 + tplDur;
      // 唔好估一覺啱啱瞓到「而家」；未瞓完嘅時段直接跳過。
      if (e0 > now) continue;
      sd = dateKey(s0); st = fmtTime(s0); et = fmtTime(e0);
    } else if (daytimeSleeper) {
      // 夜班朝早先瞓：工作日 wd 的睡眠發生在隔天早上（wd + 1）；若預計起床未到（> now）就跳過，唔好截短估到「而家」。
      const nextDay = addDays(wd, 1);
      const rNext = clockRange(nextDay, tplStart, tplEnd);
      if (!rNext || rNext.end > now) continue;
      sd = nextDay;
    }
    const r = clockRange(sd, st, et);
    if (!r || r.end > now) continue;
    const end = r.end;
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

// ---------- 整趟面板輔助（2.42）：通勤時間差預填、單一「現在」步驟、兩點即時時長 ----------
// 不改 resolveTrip / tripState / checkTrip 任何規則；只算出 HH:MM 與起始日交回原本邏輯推算與驗證。
const MAX_COMMUTE_OFFSET_MS = 4 * HOUR;

export function tripCommuteTemplate(data, { jobId = null, excludeSessionId = null, excludeJourneyId = null } = {}) {
  const sessions = (data.sessions || [])
    .filter((s) => s.id !== excludeSessionId && s.start != null)
    .sort((a, b) => b.start - a.start);
  const ordered = jobId
    ? [...sessions.filter((s) => s.jobId === jobId), ...sessions.filter((s) => s.jobId !== jobId)]
    : sessions;

  let go = null;
  let back = null;
  let hasHistory = false;

  for (const s of ordered) {
    const j = journeyOfSession(data, s);
    if (!j || j.id === excludeJourneyId) continue;
    if (!go) {
      const out = j.out != null && s.start >= j.out && s.start - j.out <= MAX_COMMUTE_OFFSET_MS ? s.start - j.out : null;
      const ride = j.ride != null && s.start >= j.ride && s.start - j.ride <= MAX_COMMUTE_OFFSET_MS ? s.start - j.ride : null;
      const arrive = j.arrive != null && s.start >= j.arrive && s.start - j.arrive <= MAX_COMMUTE_OFFSET_MS ? s.start - j.arrive : null;
      const okOrder = (out == null || ride == null || out >= ride)
        && (ride == null || arrive == null || ride >= arrive)
        && (out == null || arrive == null || out >= arrive);
      if (okOrder && (out != null || ride != null || arrive != null)) {
        go = { out, ride, arrive };
        hasHistory = true;
      }
    }
    if (!back && s.end != null) {
      const ride2 = j.ride2 != null && j.ride2 >= s.end && j.ride2 - s.end <= MAX_COMMUTE_OFFSET_MS ? j.ride2 - s.end : null;
      const home = j.home != null && j.home >= s.end && j.home - s.end <= MAX_COMMUTE_OFFSET_MS ? j.home - s.end : null;
      const okOrder = ride2 == null || home == null || home >= ride2;
      if (okOrder && (ride2 != null || home != null)) {
        back = { ride2, home };
        hasHistory = true;
      }
    }
    if (go && back) break;
  }

  const outMin = data.settings?.commuteOutMin ?? 45;
  const backMin = data.settings?.commuteBackMin ?? 45;
  if (!go && outMin > 0) go = { out: outMin * MIN, ride: null, arrive: null };
  if (!back && backMin > 0) back = { ride2: null, home: backMin * MIN };
  return { go, back, hasHistory };
}

export function tripPrefill(data, sh, now, mode = 'all') {
  const cur = tripState(data, sh, now);
  const vals = { ...cur.vals };
  const ts = { ...cur.times };
  const preSet = new Set(sh.prefilled || []);
  const canFill = (k) => !vals[k] || preSet.has(k);
  const shifts = shiftsOfWorkday(data, sh.wd);
  const shift = (sh.jobId && shifts.find((x) => x.jobId === sh.jobId)) || shifts[0] || null;
  const targetJobId = sh.jobId || cur.trip?.session?.jobId || shift?.jobId || data.jobs?.[0]?.id || null;
  const tpl = tripCommuteTemplate(data, {
    jobId: targetJobId,
    excludeSessionId: cur.trip?.session?.id ?? null,
    excludeJourneyId: cur.trip?.journey?.id ?? null
  });

  const filledSteps = [];
  const skippedFuture = [];
  let nextJobId = sh.jobId || null;

  if (mode === 'shift' || mode === 'all') {
    if (!shift) {
      return { ok: false, reason: 'no-shift' };
    }
    if (!sh.jobId && !cur.exists && shift.jobId) nextJobId = shift.jobId;
    for (const [k, t] of [['clockIn', shift.start], ['clockOut', shift.end]]) {
      if (t == null || !canFill(k)) continue;
      if (t <= now) {
        ts[k] = t;
        vals[k] = fmtTime(t);
        filledSteps.push(k);
      } else {
        skippedFuture.push(k);
      }
    }
  }

  if (mode === 'commute' || mode === 'all') {
    const ci = ts.clockIn;
    const co = ts.clockOut;
    if (ci == null && co == null) {
      if (mode === 'commute') return { ok: false, reason: 'need-work-time' };
    } else {
      if (ci != null && tpl.go) {
        for (const k of ['out', 'ride', 'arrive']) {
          const off = tpl.go[k];
          if (off == null || !canFill(k)) continue;
          const t = ci - off;
          if (t <= now) {
            ts[k] = t;
            vals[k] = fmtTime(t);
            filledSteps.push(k);
          } else {
            skippedFuture.push(k);
          }
        }
      }
      if (co != null && tpl.back) {
        for (const k of ['ride2', 'home']) {
          const off = tpl.back[k];
          if (off == null || !canFill(k)) continue;
          const t = co + off;
          if (t <= now) {
            ts[k] = t;
            vals[k] = fmtTime(t);
            filledSteps.push(k);
          } else {
            skippedFuture.push(k);
          }
        }
      }
    }
  }

  if (!filledSteps.length) {
    return { ok: false, reason: skippedFuture.length ? 'all-future' : 'already-filled' };
  }

  const firstStep = STEPS.find((k) => vals[k]);
  const earliestT = firstStep ? ts[firstStep] : null;
  const prevAnchor = cur.anchor;
  const newAnchor = earliestT != null ? dateKey(earliestT) : prevAnchor;
  const anchorShifted = newAnchor !== prevAnchor;
  const anchorShiftNote = anchorShifted
    ? (newAnchor < prevAnchor
      ? `已自動調前至 ${fmtDayMD(newAnchor)}（第一格在午夜前）`
      : `已自動調至 ${fmtDayMD(newAnchor)}`)
    : '';

  return {
    ok: true,
    vals,
    anchor: newAnchor,
    anchorShifted,
    anchorShiftFrom: prevAnchor,
    anchorShiftNote,
    filledSteps,
    skippedFuture,
    jobId: nextJobId,
    hasHistory: tpl.hasHistory
  };
}

// 「現在」掣：補舊日子完全唔出；只有今日進行緊嗰趟，喺下一格未填嘅位置保留一粒。
export function tripNowStep(data, sh, st, now, { commuteCollapsed = false } = {}) {
  const todayWd = currentWorkday(data, now);
  if (sh.wd !== todayWd && st.workday !== todayWd) return null;
  if (st.times.home != null) return null;
  if (st.exists) {
    const s = st.trip.session;
    if (s && (data.sessions || []).some((x) => x.id !== s.id && x.start > s.start)) return null;
    if (s && s.end != null && now - s.end > 6 * HOUR) return null;
    const cyc = currentCycle(data, now);
    if (cyc.session && (!s || cyc.session.id !== s.id)) return null;
  }
  let lastIdx = -1;
  STEPS.forEach((k, i) => { if (st.times[k] != null) lastIdx = i; });
  if (lastIdx === -1) return commuteCollapsed ? 'clockIn' : 'out';
  if (lastIdx >= STEPS.length - 1) return null;
  if (commuteCollapsed && lastIdx === 4) return null;
  return STEPS[lastIdx + 1];
}

export function tripWorkBreakMs(st) {
  const ci = st.times?.clockIn;
  const co = st.times?.clockOut;
  if (ci == null || co == null) return 0;
  return (st.trip?.session?.breaks || []).reduce((n, b) => {
    if (b.start == null || b.end == null) return n;
    const a = Math.max(b.start, ci);
    const e = Math.min(b.end, co);
    return e > a ? n + (e - a) : n;
  }, 0);
}

// 相鄰已填步驟之間的真實用時（支援中間跳格，例如出門直接到上班）。
export function tripStepGaps(st) {
  const gaps = {};
  let prevStep = null;
  let prevT = null;
  let prevIdx = -1;
  STEPS.forEach((k, idx) => {
    const t = st.times?.[k];
    if (t == null) return;
    if (prevT != null && t >= prevT) {
      gaps[k] = { from: prevStep, to: k, ms: t - prevT, skipped: idx - prevIdx > 1 };
    }
    prevStep = k;
    prevT = t;
    prevIdx = idx;
  });
  return gaps;
}
