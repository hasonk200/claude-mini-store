import { esc, icon, bubble, seg } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, wdShort, fmtDur, addDays, weekStartKey, dayStart, dayEnd, HOUR } from '../time.js';
import {
  workdayEvents, workdaySpan, sessionsOfWorkday, splitWorkByDay, sessionWorkMs, calendarAllocation,
  intervalsAround, totalOf, clip, sleepWorkday, shiftsOfWorkday, wakeSpan
} from '../logic.js';
import { ribbon, legend, crossBadge, pageHead, dayNav } from './shared.js';
import { refKey } from './today.js';
import { findWorkdayTargets } from '../actions.js';

function weekStrip(data, key, now) {
  const start = weekStartKey(key);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return `<div class="week-strip" role="group" aria-label="本週">${days.map((k) => {
    const hasWork = sessionsOfWorkday(data, k).length || shiftsOfWorkday(data, k).length;
    const off = data.dayMarks.some((m) => m.date === k);
    const today = k === dateKey(now);
    return `<button type="button" data-action="tl-day" data-key="${k}" aria-pressed="${k === key}" class="${today ? 'is-today' : ''}">
      <span>${wdShort(k)}</span><strong>${Number(k.slice(8))}</strong><i class="dot ${hasWork ? 'k-work' : off ? 'is-off' : 'is-none'}"></i></button>`;
  }).join('')}</div>`;
}

function workdayList(data, wd, now) {
  const ev = workdayEvents(data, wd, now);
  if (!ev.length) return `<div class="card"><p class="muted">這個工作日還沒有紀錄或排班。</p><button type="button" class="btn btn-ink" data-action="open-record" data-wd="${wd}">補登一個時間</button></div>`;
  let crossed = false;
  const items = ev.map((e, i) => {
    let divider = '';
    if (!crossed && dateKey(e.t) !== wd) {
      crossed = true;
      divider = `<li class="tl-divider"><span>午夜 · 進入${wdOf(e.t)}，仍屬${wdOfKey(wd)}工作日</span></li>`;
    }
    const last = i === ev.length - 1;
    return `${divider}<li class="tl-item${last ? ' is-last' : ''} k-${e.kind}">
      <div class="tl-time${e.plan ? ' is-plan-text' : ''}"><strong>${fmtTime(e.t)}</strong><span>${wdOf(e.t)}</span></div>
      <div class="tl-rail">${bubble(e.icon, e.kind, { plan: e.plan, iconSize: 18 })}<i></i></div>
      <button type="button" class="tl-body" data-action="edit-ref" data-ref="${esc(refKey(e.ref))}" data-t="${e.t}" data-title="${esc(e.title)}">
        <strong>${esc(e.title)}</strong>${e.detail ? `<span>${esc(e.detail)}</span>` : ''}${e.plan ? '<span class="chip chip-plan">計畫</span>' : ''}
      </button>
    </li>`;
  }).join('');
  return `<div class="card"><div class="card-head"><h2 class="card-title">${wdOfKey(wd)}工作日 · ${fmtMD(wd)}</h2><span class="muted small">點一項可以修改時間</span></div><ol class="tl">${items}</ol></div>`;
}

function workdaySummary(data, wd, now) {
  const sessions = sessionsOfWorkday(data, wd);
  const work = sessions.reduce((n, s) => n + sessionWorkMs(s, now), 0);
  const split = {};
  for (const s of sessions) for (const [k, v] of Object.entries(splitWorkByDay(s, now))) split[k] = (split[k] || 0) + v;
  const splitText = Object.entries(split).map(([k, v]) => `${wdShort(k)} ${fmtDur(v)}`).join(' · ') || '沒有出勤';
  const [a, b] = workdaySpan(data, wd, now);
  const items = intervalsAround(data, a, b, now).filter((x) => !x.plan);
  const commute = totalOf(items.filter((x) => x.kind === 'commute').map((x) => [x.a, x.b]));
  const sleeps = data.sleeps.filter((s) => sleepWorkday(s, data) === wd && s.start != null);
  const sleepMs = totalOf(sleeps.map((s) => [s.start, s.end ?? now]));
  const sleeping = sleeps.some((s) => s.end == null);
  // 三張摘要卡都可以點：打開「補登一個時間」，並直接選到最需要補的那一項。
  const tg = findWorkdayTargets(data, wd);
  const sess = tg.session;
  const jr = tg.journey;
  const workStep = !sess || sess.start == null ? 'clockIn' : sess.end == null ? 'clockOut' : 'clockIn';
  const commuteStep = ['out', 'arrive', 'leave', 'home'].find((k) => jr?.[k] == null) || 'out';
  const sl = tg.sleep;
  const sleepStep = !sl || sl.start == null ? 'sleepStart' : sl.end == null ? 'sleepEnd' : 'sleepStart';
  const card = (cls, label, value, note, step) =>
    `<button type="button" class="card mini mini-btn ${cls}" data-action="open-record" data-wd="${wd}" data-step="${step}" aria-label="修改${label}"><span>${label}</span><strong>${value}</strong><small>${note}</small></button>`;
  return `<section class="summary-3">
    ${card('', '工時', fmtDur(work), esc(splitText), workStep)}
    ${card('', '通勤', fmtDur(commute), '只計有完整起止的路程', commuteStep)}
    ${card('k-sleep-soft', '睡眠', sleeps.length ? fmtDur(sleepMs) : '—', sleeping ? '進行中，計至現在' : sleeps.length ? '實際紀錄' : '未記錄', sleepStep)}
  </section>`;
}

function calendarView(data, key, now) {
  const a = dayStart(key);
  const b = dayEnd(key);
  const al = calendarAllocation(data, key, now);
  const plannedSleep = totalOf(clip(intervalsAround(data, a, b, now).filter((x) => x.plan && x.kind === 'sleep').map((x) => [x.a, x.b]), a, b));
  const rows = [
    ['work', '工作', al.work, '跨日班次按實際日期拆開'],
    ['commute', '通勤', al.commute, '去程與回程'],
    ['sleep', '睡眠', al.sleep, plannedSleep ? `另有計畫 ${fmtDur(plannedSleep)}，未發生前不計入` : '只計實際紀錄'],
    ['meal', '用餐', al.meal, '與工作重疊的時間不重複計入合計'],
    ['none', '未安排／未記錄', al.unscheduled, now < b ? '計至現在；沒有紀錄的時間可能偏高' : '沒有紀錄的空檔']
  ];
  return `<div class="card"><div class="card-head"><h2 class="card-title">${wdOfKey(key)} ${fmtMD(key)}</h2><span class="muted small">00:00 → 24:00${al.length !== 24 * HOUR ? `（今天有 ${Math.round(al.length / HOUR)} 小時）` : ''}</span></div>
    ${ribbon(data, a, b, now)}
    ${legend(false, data)}
  </div>
  <ul class="card alloc">${rows.map(([k, l, v, n]) => `<li><i class="sw k-${k}"></i><div><strong>${l}</strong><span>${esc(n)}</span></div><b>${fmtDur(v)}</b></li>`).join('')}</ul>
  <p class="fine">跨日班次的工時按實際日期分開；收入只歸在開始上班那天，不會算兩次。</p>`;
}

function spanText(data, key) {
  const ws = wakeSpan(data, key);
  if (!ws) return '沒有主睡眠紀錄時，按上班日期';
  return `由${wdOf(ws.start)} ${fmtTime(ws.start)} 起床${ws.end ? ` 到${wdOf(ws.end)} ${fmtTime(ws.end)} 起床` : ' 開始'}`;
}

export function timelineView(ctx) {
  const { data, now, ui } = ctx;
  const mode = ui.tlMode;
  const key = mode === 'workday' ? ctx.wd : (ui.calKey || dateKey(now));
  const tools = `<a class="btn btn-line btn-sm" href="#/week">${icon('calendar', 16, 2)}班表與月曆</a>`;
  return `${pageHead('時間線', mode === 'workday' ? '把同一班的通勤、工作與睡眠接在一起' : '按日曆日查看 00:00–24:00', tools)}
    ${seg('tlMode', '查看方式', [['workday', '工作日'], ['calendar', '日曆日']], mode)}
    ${weekStrip(data, key, now)}
    ${mode === 'workday'
      ? `${dayNav('tl-shift', `${wdOfKey(key)}工作日 · ${fmtMD(key)}`, spanText(data, key))}${ctx.isDesktop ? `<div class="card">${(() => { const [a, b] = workdaySpan(data, key, now); return ribbon(data, a, b, now, { lanes: true }); })()}${legend(true, data)}</div>` : ''}<div class="grid-2-1 tl-grid">${workdayList(data, key, now)}<div class="stack">${workdaySummary(data, key, now)}</div></div>`
      : `${dayNav('tl-shift', `${wdOfKey(key)} ${fmtMD(key)}`, '日曆日')}${calendarView(data, key, now)}`}`;
}
