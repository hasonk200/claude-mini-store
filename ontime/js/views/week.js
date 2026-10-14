import { esc, icon, seg } from '../ui.js';
import {
  dateKey, fmtTime, fmtMD, wdOfKey, wdShort, addDays, weekStartKey, dayStart, HOUR, fmtDur, monthStartKey, fromKey, pad
} from '../time.js';
import {
  intervalsAround, sessionsOfWorkday, shiftsOfWorkday, sleepWorkday, mealWorkday, jobOf, sessionWorkMs, sleepByWorkday
} from '../logic.js';
import { pageHead, pct } from './shared.js';

function workdaySubset(data, k, now) {
  return {
    ...data,
    sessions: sessionsOfWorkday(data, k),
    shifts: shiftsOfWorkday(data, k),
    sleeps: data.sleeps.filter((s) => sleepWorkday(s, data) === k),
    meals: data.meals.filter((m) => mealWorkday(m, data, now) === k)
  };
}

function weekAxis(data, days, now) {
  let minOff = 18 * HOUR;
  let maxOff = 0;
  let any = false;
  for (const k of days) {
    const base = dayStart(k);
    const sub = workdaySubset(data, k, now);
    for (const x of intervalsAround(sub, base - 12 * HOUR, base + 48 * HOUR, now)) {
      if (x.kind === 'sleep' || x.kind === 'meal') continue;
      any = true;
      minOff = Math.min(minOff, x.a - base);
      maxOff = Math.max(maxOff, x.b - base);
    }
  }
  const start = any ? Math.max(0, Math.floor(minOff / (2 * HOUR)) * 2 * HOUR) : 0;
  let len = Math.max(24 * HOUR, Math.ceil((maxOff + 3 * HOUR - start) / (2 * HOUR)) * 2 * HOUR);
  len = Math.min(len, 32 * HOUR);
  return { start, len };
}

function weekGrid(data, ws, mode, now) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const axis = mode === 'workday' ? weekAxis(data, days, now) : { start: 0, len: 24 * HOUR };
  const ticks = [];
  for (let h = axis.start; h <= axis.start + axis.len; h += 2 * HOUR) ticks.push(h);
  const head = ticks.map((h, i) => {
    const hour = (h / HOUR) % 24;
    const mid = mode === 'workday' && h === 24 * HOUR;
    const shift = i === 0 ? '0' : i === ticks.length - 1 ? '-100%' : '-50%';
    return `<span class="tick-label${mid ? ' is-mid' : ''}" style="left:${(((h - axis.start) / axis.len) * 100).toFixed(2)}%;transform:translateX(${shift})">${mid ? '00:00 隔日' : pad(hour) + ':00'}</span>`;
  }).join('');
  const rows = days.map((k) => {
    const base = dayStart(k) + axis.start;
    const end = base + axis.len;
    const src = mode === 'workday' ? workdaySubset(data, k, now) : data;
    const items = intervalsAround(src, base, end, now);
    const off = data.dayMarks.some((m) => m.date === k);
    const grid = ticks.filter((h, i) => i > 0 && i < ticks.length - 1 && (h / HOUR) % 4 === 0)
      .map((h) => `<div class="tick-line${h % (24 * HOUR) === 0 ? ' is-mid' : ''}" style="left:${(((h - axis.start) / axis.len) * 100).toFixed(2)}%"></div>`).join('');
    const segs = items.map((x) => {
      const s = Math.max(x.a, base);
      const e = Math.min(x.b, end);
      const w = ((e - s) / axis.len) * 100;
      const cont = mode === 'calendar' && x.a < base ? '接續' : '';
      const label = w > 12 ? (cont || `${x.label || ''} ${fmtTime(x.a)}–${fmtTime(x.b)}`.trim()) : '';
      return `<div class="seg-bar k-${x.kind}${x.plan ? ' is-plan' : ''}${x.kind === 'meal' ? ' is-thin' : ''}" style="left:${pct(s, base, end)};width:${w.toFixed(2)}%" title="${esc(x.label || '')} ${fmtTime(x.a)}–${fmtTime(x.b)}"><span>${esc(label)}</span></div>`;
    }).join('');
    const nowLine = now >= base && now < end ? `<div class="now-line" style="left:${pct(now, base, end)}"></div>` : '';
    const note = off ? '休息日' : shiftsOfWorkday(data, k).map((sh) => jobOf(data, sh.jobId)?.name).filter(Boolean)[0] || '';
    return `<div class="wk-row${k === dateKey(now) ? ' is-today' : ''}">
      <div class="wk-day"><strong>${wdOfKey(k)}</strong><span>${fmtMD(k)}${note && !off ? ' · ' + esc(note) : ''}</span>
        <button type="button" class="off-toggle${off ? ' is-on' : ''}" data-action="day-off" data-key="${k}" aria-pressed="${off}" aria-label="${off ? '取消' : '設為'}${fmtMD(k)}休息日">${icon('cup', 14, 2)}${off ? '休息日' : '休息'}</button></div>
      <div class="wk-track${off ? ' is-off' : ''}">${grid}${segs}${off ? `<span class="off-label">${icon('cup', 16, 2)}休息日</span>` : ''}${nowLine}</div>
    </div>`;
  }).join('');
  return `<div class="table-wrap"><div class="wk-grid"><div class="wk-row wk-head"><div class="wk-day"></div><div class="wk-track-head">${head}</div></div>${rows}</div></div>`;
}

function weekSummary(data, ws, now) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  let planned = 0;
  const count = {};
  for (const k of days) {
    for (const sh of shiftsOfWorkday(data, k)) {
      const s = data.sessions.find((x) => x.shiftId === sh.id);
      planned += s ? sessionWorkMs(s, now) : sh.end - sh.start;
      const name = jobOf(data, sh.jobId)?.name ?? '工作';
      count[name] = (count[name] || 0) + 1;
    }
    for (const s of sessionsOfWorkday(data, k)) if (!s.shiftId) planned += sessionWorkMs(s, now);
  }
  const off = days.filter((k) => data.dayMarks.some((m) => m.date === k)).length;
  const plans = days.filter((k) => data.sleeps.some((s) => sleepWorkday(s, data) === k)).length;
  const jobs = Object.entries(count).map(([n, c]) => `${esc(n)} ${c}`).join(' · ') || '沒有排班';
  return `<section class="card card-ink kpi-card"><span class="muted-ink">本週工時（已做 + 預計）</span>
    <div class="kpi-grid">
      <div><strong>${fmtDur(planned)}</strong><span>工時</span></div>
      <div><strong class="c-lime">${Object.values(count).reduce((a, b) => a + b, 0)}</strong><span>${jobs}</span></div>
      <div><strong>${off}</strong><span>休息日</span></div>
      <div><strong>${plans} / 7</strong><span>有睡眠紀錄或計畫</span></div>
    </div></section>`;
}

function templatesCard(data, ui) {
  const tpls = data.templates.map((t) => {
    const job = jobOf(data, t.jobId);
    return `<div class="tpl k-${job?.color === 'deliv' ? 'deliv' : 'work'}"><i class="sw k-${job?.color === 'deliv' ? 'deliv' : 'work'}"></i><div><strong>${esc(t.name || job?.name || '班次')}</strong><span>${esc(t.start)}–${esc(t.end)}${t.end <= t.start ? '（隔日）' : ''}</span></div><button type="button" class="icon-btn icon-btn-sm" data-action="tpl-delete" data-id="${t.id}" aria-label="刪除範本 ${esc(t.name)}">${icon('trash', 16)}</button></div>`;
  }).join('');
  const jobOpts = data.jobs.map((j) => `<option value="${j.id}">${esc(j.name)}</option>`).join('');
  return `<section class="card"><div class="card-head"><h2 class="card-title">範本</h2><span class="muted small">在月曆選日期後套用</span></div>
    <div class="tpl-list">${tpls || '<p class="muted">還沒有範本。</p>'}</div>
    ${data.jobs.length ? `<details class="more"><summary>新增範本</summary><form class="form" data-form="tpl-add">
      <div class="field-pair"><label class="field"><span>名稱</span><input name="name" placeholder="例如：夜班" required></label>
      <label class="field"><span>工作</span><select name="jobId">${jobOpts}</select></label></div>
      <div class="field-pair"><label class="field"><span>開始</span><input type="time" name="start" value="21:00" required></label>
      <label class="field"><span>結束</span><input type="time" name="end" value="09:00" required></label></div>
      <p class="fine">結束早於開始時，會自動當作隔日結束。</p>
      <button class="btn btn-ink" type="submit">儲存範本</button></form></details>`
      : '<p class="muted">先到「我的 › 工作設定」新增一份工作。</p><a class="btn btn-soft" href="#/settings">新增工作</a>'}
  </section>`;
}

function monthCalendar(data, ui, now) {
  const mk = ui.monthKey || monthStartKey(dateKey(now));
  const first = fromKey(mk);
  const gridStart = weekStartKey(mk);
  const sleepBy = sleepByWorkday(data, now);
  const sel = new Set(ui.batch ? ui.batchDays : ui.calDay ? [ui.calDay] : []);
  let nights = 0;
  const jobCount = {};
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const k = addDays(gridStart, i);
    const inMonth = fromKey(k).getMonth() === first.getMonth();
    if (i >= 35 && !inMonth && i % 7 === 0) break;
    const shifts = shiftsOfWorkday(data, k);
    const sessions = sessionsOfWorkday(data, k);
    const off = data.dayMarks.some((m) => m.date === k);
    if (inMonth) for (const sh of shifts) { const n = jobOf(data, sh.jobId)?.name ?? '工作'; jobCount[n] = (jobCount[n] || 0) + 1; nights++; }
    const chips = shifts.map((sh) => {
      const job = jobOf(data, sh.jobId);
      const done = sessions.some((s) => s.shiftId === sh.id);
      return `<span class="cal-chip k-${job?.color === 'deliv' ? 'deliv' : 'work'}${done ? '' : ' is-plan'}">${esc(job?.name ?? '')} ${fmtTime(sh.start)}</span>`;
    }).join('') + sessions.filter((s) => !s.shiftId).map((s) => `<span class="cal-chip k-work">${esc(jobOf(data, s.jobId)?.name ?? '工作')} ${fmtTime(s.start)}</span>`).join('');
    const sl = sleepBy[k];
    cells.push(`<button type="button" class="cal-cell${inMonth ? '' : ' is-out'}${k === dateKey(now) ? ' is-today' : ''}${sel.has(k) ? ' is-selected' : ''}" data-action="cal-pick" data-key="${k}" aria-pressed="${sel.has(k)}" aria-label="${fmtMD(k)} ${wdOfKey(k)}">
      <span class="cal-top"><span class="cal-num">${Number(k.slice(8))}</span>${sl ? `<span class="cal-sleep">睡 ${fmtDur(sl).replace(' ', '')}</span>` : ''}</span>
      ${chips}${off ? '<span class="cal-off">休息日</span>' : ''}
    </button>`);
  }
  const summary = Object.entries(jobCount).map(([n, c]) => `<span class="chip chip-soft">${esc(n)} ${c}</span>`).join('');
  const offCount = data.dayMarks.filter((m) => m.date.startsWith(mk.slice(0, 7))).length;
  return `<section class="card month" aria-label="月曆">
    <div class="month-head">
      <div class="month-nav"><button type="button" class="icon-btn" data-action="month-shift" data-dir="-1" aria-label="上一個月">${icon('left', 18, 2)}</button><h2>${first.getFullYear()} 年 ${first.getMonth() + 1} 月</h2><button type="button" class="icon-btn" data-action="month-shift" data-dir="1" aria-label="下一個月">${icon('right', 18, 2)}</button></div>
      <div class="month-tools">${summary}${offCount ? `<span class="chip chip-soft">休息日 ${offCount}</span>` : ''}<button type="button" class="btn btn-sm ${ui.batch ? 'btn-ink' : 'btn-line'}" data-action="batch-toggle" aria-pressed="${ui.batch}">${ui.batch ? '完成多選' : '多選日期'}</button></div>
    </div>
    <div class="cal-week">${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<span>週${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
    ${dayPanel(data, ui, now)}
  </section>`;
}

function dayPanel(data, ui, now) {
  const keys = ui.batch ? ui.batchDays : ui.calDay ? [ui.calDay] : [];
  if (!keys.length) return `<div class="day-panel muted">${ui.batch ? '點選要排班的日期，再套用範本。' : '點一天查看或修改那天的班次。'}</div>`;
  const tplBtns = data.templates.map((t) => `<button type="button" class="btn btn-soft btn-sm" data-action="tpl-apply" data-id="${t.id}">套用「${esc(t.name)}」</button>`).join('');
  if (ui.batch) {
    return `<div class="day-panel"><strong>已選 ${keys.length} 天</strong><div class="btn-wrap">${tplBtns || '<span class="muted">先建立範本</span>'}<button type="button" class="btn btn-line btn-sm" data-action="batch-off">設為休息日</button><button type="button" class="btn btn-line btn-sm" data-action="batch-clear">清除選取</button></div></div>`;
  }
  const k = keys[0];
  const shifts = shiftsOfWorkday(data, k);
  const off = data.dayMarks.some((m) => m.date === k);
  const list = shifts.map((sh) => {
    const done = data.sessions.some((s) => s.shiftId === sh.id);
    return `<li><i class="sw k-${jobOf(data, sh.jobId)?.color === 'deliv' ? 'deliv' : 'work'}"></i><span>${esc(jobOf(data, sh.jobId)?.name ?? '')} ${fmtTime(sh.start)} → ${dateKey(sh.end) !== k ? '隔日 ' : ''}${fmtTime(sh.end)}${done ? '（已有實際出勤）' : ''}</span>${done ? '' : `<button type="button" class="icon-btn icon-btn-sm" data-action="shift-delete" data-id="${sh.id}" aria-label="刪除班次">${icon('trash', 16)}</button>`}</li>`;
  }).join('');
  const jobOpts = data.jobs.map((j) => `<option value="${j.id}">${esc(j.name)}</option>`).join('');
  return `<div class="day-panel">
    <div class="day-panel-head"><strong>${wdOfKey(k)} ${fmtMD(k)}${k === dateKey(now) ? ' · 今天' : ''}</strong><button type="button" class="btn btn-line btn-sm" data-action="day-off" data-key="${k}">${off ? '取消休息日' : '設為休息日'}</button></div>
    ${list ? `<ul class="shift-list">${list}</ul>` : `<p class="muted">${off ? '休息日，沒有排班。' : '沒有排班。'}</p>`}
    <div class="btn-wrap">${tplBtns}</div>
    ${data.jobs.length ? `<details class="more"><summary>自訂班次</summary><form class="form form-inline" data-form="shift-add"><input type="hidden" name="key" value="${k}">
      <label class="field"><span>工作</span><select name="jobId">${jobOpts}</select></label>
      <label class="field"><span>開始</span><input type="time" name="start" value="21:00" required></label>
      <label class="field"><span>結束</span><input type="time" name="end" value="09:00" required></label>
      <button class="btn btn-ink" type="submit">加入</button></form></details>` : ''}
  </div>`;
}

export function weekView(ctx) {
  const { data, now, ui } = ctx;
  const ws = addDays(weekStartKey(ctx.wd), ui.weekOffset * 7);
  const we = addDays(ws, 6);
  const tools = `${seg('weekMode', '排列方式', [['workday', '按工作日'], ['calendar', '按日曆日']], ui.weekMode)}
    <div class="day-switch"><button type="button" class="icon-btn" data-action="week-shift" data-dir="-1" aria-label="上一週">${icon('left', 18, 2)}</button><button type="button" class="icon-btn" data-action="week-shift" data-dir="1" aria-label="下一週">${icon('right', 18, 2)}</button></div>`;
  return `${pageHead('一週作息與班表', `${fmtMD(ws)} – ${fmtMD(we)} · 實際、預計、休息日一起看`, tools)}
    <section class="card"><p class="muted small">${ui.weekMode === 'workday' ? '每行是一個工作日；夜班和下班後的事不會被午夜切開。' : '每行是一個日曆日 00:00–24:00；夜班在午夜切開，標示「接續」。'}</p>${weekGrid(data, ws, ui.weekMode, now)}
    <div class="legend"><span><i class="sw k-work"></i>工作</span><span><i class="sw k-deliv"></i>外送／第二份工作</span><span><i class="sw k-commute"></i>通勤</span><span><i class="sw k-sleep"></i>睡眠</span><span><i class="sw k-meal"></i>用餐</span><span><i class="sw is-plan-sw"></i>預計</span></div></section>
    <div class="grid-1-2">${weekSummary(data, ws, now)}${templatesCard(data, ui)}</div>
    ${monthCalendar(data, ui, now)}`;
}
