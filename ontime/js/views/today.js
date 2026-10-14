import { esc, icon, bubble, durHTML, STEP_ICON, STEP_KIND, seg } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtDayMD, wdOfKey, fmtMD, MIN, HOUR, fmtDur, fmtDurLong, toDateInput, toTimeInput } from '../time.js';
import {
  STEPS, STEP_LABEL, awakeSince, sleepLast24h, currentCycle, nextStep, statusOf, beforeBedBudget, shiftOf, sessionWorkMs,
  workdaySpan, workdayEvents, jobOf, shiftsOfWorkday
} from '../logic.js';
import { findWorkdayTargets } from '../actions.js';
import { ribbon, legend, crossBadge } from './shared.js';
import { heroHTML } from './hero.js';

export function heroFor(data, wd, cycle, now, compact = false) {
  const st = statusOf(cycle, data, now);
  const s = cycle.session;
  const sh = s ? shiftOf(data, s) : null;
  const hour = new Date(now).getHours();
  const late = hour >= 21 || hour < 5;
  const H = {
    work: sh && sh.end > now ? `工作中，還有 ${fmtDurLong(sh.end - now)}。` : `工作中，已經 ${fmtDurLong(s ? sessionWorkMs(s, now) : 0)}。`,
    break: '休息一下，喝口水。',
    off: '下班了，準備回家。',
    ride2: '回家路上，慢慢來。',
    ride: '在路上，準時到。',
    out: '出門了，路上小心。',
    arrive: '到了，準備上班。',
    sleep: '好好睡一覺。',
    free: late ? '晚安，好好休息。' : '今天，留點時間給自己。'
  };
  const b = beforeBedBudget(data, now);
  const upcoming = data.shifts.filter((x) => x.start > now).sort((x, y) => x.start - y.start)[0];
  let line = '';
  if (b.state === 'ok') line = `睡前還有 ${fmtDur(b.free)} 未安排`;
  else if (b.state === 'unset' && awakeSince(data, now)) line = `已清醒 ${fmtDur(awakeSince(data, now).ms)}`;
  else if (st.key === 'sleep') line = `入睡 ${fmtTime(st.since)} · 已睡 ${fmtDur(now - st.since)}`;
  else if (upcoming) line = `下一班 ${wdOf(upcoming.start)} ${fmtTime(upcoming.start)}`;
  return heroHTML({ state: st.key, now, headline: H[st.key] || '', line, eyebrow: `ONTIME · ${wdOfKey(wd)}工作日`, compact });
}

function stepValues(data, wd, cycle) {
  const useCycle = cycle.session || cycle.journey;
  const tg = findWorkdayTargets(data, wd);
  const s = useCycle ? cycle.session : tg.session;
  const j = useCycle ? cycle.journey : tg.journey;
  const sh = (s && shiftOf(data, s)) || tg.shift;
  const st = data.settings;
  const plan = {
    out: sh ? sh.start - (st.commuteOutMin ?? 45) * MIN : null,
    clockIn: sh?.start ?? null,
    clockOut: sh?.end ?? null,
    home: sh ? sh.end + (st.commuteBackMin ?? 45) * MIN : null
  };
  const val = (k) => (k === 'clockIn' ? s?.start : k === 'clockOut' ? s?.end : j?.[k]) ?? null;
  return { val, plan, session: s, journey: j, shift: sh };
}

function stepper(data, wd, cycle, now) {
  const { val, plan } = stepValues(data, wd, cycle);
  const active = cycle.session || cycle.journey;
  const next = active ? nextStep(cycle) : null;
  let doneCount = 0;
  STEPS.forEach((k, i) => { if (val(k) != null) doneCount = i + 1; });
  const items = STEPS.map((k) => {
    const v = val(k);
    const isCur = k === next;
    const p = plan[k];
    const time = v != null ? fmtTime(v) : p != null ? fmtTime(p) : '—';
    const note = v != null ? wdOf(v) : p != null ? '預計' : '未知';
    return `<li class="step${v != null ? ' is-done' : ''}${isCur ? ' is-current' : ''}">
      ${bubble(STEP_ICON[k], STEP_KIND[k], { done: v != null, current: isCur, empty: v == null && !isCur, size: 'lg', iconSize: 20 })}
      <span class="step-label">${STEP_LABEL[k]}</span>
      <span class="step-time">${time}</span>
      <span class="step-note">${note}</span>
    </li>`;
  }).join('');
  const prog = Math.max(0, doneCount - 1) / (STEPS.length - 1) * 100;
  return `<ol class="stepper" style="--prog:${prog.toFixed(1)}%">${items}</ol>`;
}

function statusCard(data, wd, cycle, now) {
  const st = statusOf(cycle, data, now);
  const s = cycle.session;
  const sh = s ? shiftOf(data, s) : null;
  let sub = '';
  let progress = '';
  if (st.key === 'sleep') sub = `入睡 ${wdOf(st.since)} ${fmtTime(st.since)} · 已睡 ${fmtDurLong(now - st.since)}`;
  else if (st.key === 'work' || st.key === 'break') {
    const worked = sessionWorkMs(s, now);
    sub = `上班 ${wdOf(s.start)} ${fmtTime(s.start)} · 已工作 ${fmtDurLong(worked)}`;
    if (st.key === 'break') sub = `休息開始 ${fmtTime(st.since)} · ${fmtDurLong(now - st.since)}`;
    if (sh) {
      const p = Math.min(100, Math.max(0, ((now - s.start) / (sh.end - s.start)) * 100));
      progress = `<div class="progress"><div class="progress-bar"><i style="width:${p.toFixed(1)}%"></i></div><div class="progress-legend"><span>上班 ${wdOf(s.start)} ${fmtTime(s.start)}</span><span>預計下班 ${wdOf(sh.end)} ${fmtTime(sh.end)}</span></div></div>`;
    }
  } else if (st.since) sub = `${{ out: '出門', ride: '上車', arrive: '抵達', off: '下班', ride2: '上車' }[st.key] || ''} ${wdOf(st.since)} ${fmtTime(st.since)}`;
  else {
    const upcoming = data.shifts.filter((x) => x.start > now).sort((a, b) => a.start - b.start)[0];
    sub = upcoming ? `下一班 ${wdOf(upcoming.start)} ${fmtMD(dateKey(upcoming.start))} ${fmtTime(upcoming.start)} · ${esc(jobOf(data, upcoming.jobId)?.name ?? '')}` : '目前沒有排班';
  }

  const buttons = [];
  if (st.key === 'sleep') {
    buttons.push(`<button type="button" class="btn btn-lime btn-block" data-action="wake">現在起床</button>`);
  } else {
    const ns = nextStep(cycle) || 'out';
    buttons.push(`<button type="button" class="btn btn-lime btn-block" data-action="step" data-step="${ns}">記錄${STEP_LABEL[ns]} · 現在</button>`);
    const alt = [];
    if (ns === 'out') alt.push(['clockIn', '直接上班']);
    if (ns === 'ride') alt.push(['arrive', '步行直接抵達']);
    if (ns === 'arrive') alt.push(['clockIn', '直接上班']);
    if (ns === 'ride2') alt.push(['home', '直接到家']);
    const altHTML = alt.map(([k, l]) => `<button type="button" class="btn btn-ghost-dark" data-action="step" data-step="${k}">${l}</button>`).join('');
    const brk = st.key === 'work' ? '<button type="button" class="btn btn-ghost-dark" data-action="break">開始休息</button>'
      : st.key === 'break' ? '<button type="button" class="btn btn-ghost-dark" data-action="break">結束休息</button>' : '';
    const sleepBtn = ['free', 'off'].includes(st.key) || ns === 'out' ? '<button type="button" class="btn btn-ghost-dark" data-action="sleep-start">現在入睡</button>' : '';
    if (altHTML || brk || sleepBtn) buttons.push(`<div class="btn-row">${altHTML}${brk}${sleepBtn}</div>`);
  }
  return `<section class="card card-ink status-card" aria-label="現在狀態">
    <div class="status-top"><span class="live-dot"></span>現在狀態<span class="spacer"></span><span class="muted-ink">${esc(s ? jobOf(data, s.jobId)?.name ?? '' : '')}</span></div>
    <div class="status-main"><div class="status-title">${esc(st.title)}</div><div class="status-sub">${sub}</div></div>
    ${progress}
    ${buttons.join('')}
    <button type="button" class="link-ink" data-action="open-record">補登其他時間</button>
  </section>`;
}

function budgetCards(data, now) {
  const b = beforeBedBudget(data, now);
  if (b.state === 'sleeping') {
    return `<section class="metric-pair"><div class="card metric"><span class="metric-label">睡前未安排</span><span class="metric-value">—</span><span class="metric-note">正在睡眠</span></div><div class="card metric"><span class="metric-label">距離預計入睡</span><span class="metric-value">—</span><span class="metric-note">起床後重新計算</span></div></section>`;
  }
  if (b.state === 'unset') {
    const aw = awakeSince(data, now);
    const sl = sleepLast24h(data, now);
    const span = 24 * HOUR;
    const bars = sl.parts.map(([x, y]) => `<i style="left:${(((x - sl.from) / span) * 100).toFixed(1)}%;width:${(((y - x) / span) * 100).toFixed(1)}%"></i>`).join('');
    return `<section class="metric-pair">
    <div class="card metric"><span class="metric-label">已清醒</span>${aw ? durHTML(aw.ms, 'metric-value') : '<span class="metric-value">—</span>'}<span class="metric-note">${aw ? `${wdOf(aw.since)} ${fmtTime(aw.since)} 起床` : '還沒有起床紀錄'}</span></div>
    <div class="card metric k-sleep-soft"><span class="metric-label">過去 24 小時睡了</span>${durHTML(sl.ms, 'metric-value c-sleep')}<span class="sleep24" aria-hidden="true">${bars}</span><span class="metric-note">${sl.parts.length ? `分 ${sl.parts.length} 段` : '沒有睡眠紀錄'}</span></div>
  </section>`;
  }
  return `<section class="metric-pair">
    <div class="card metric"><span class="metric-label">睡前未安排</span>${durHTML(b.free, 'metric-value c-sleep')}<span class="metric-note">已扣工作、通勤、已確認用餐</span></div>
    <div class="card metric"><span class="metric-label">距離預計入睡</span>${durHTML(b.countdown, 'metric-value')}<span class="metric-note">${wdOf(b.target)} ${fmtTime(b.target)} · 仍含工作</span></div>
  </section>`;
}

function nextMealCard(data, now) {
  const next = data.meals.filter((m) => !m.confirmed && m.start >= now - 2 * HOUR).sort((a, b) => a.start - b.start)[0];
  if (!next) {
    return `<section class="card row-card"><span class="tile-icon k-meal">${icon('meal', 20)}</span><div class="row-card-text"><strong>下一餐還沒安排</strong><span>工作中用餐也可以記，不會扣休息或薪資</span></div><a class="btn btn-soft" href="#/meals">安排</a></section>`;
  }
  return `<section class="card" aria-label="下一餐"><div class="row-card"><span class="tile-icon k-meal">${icon('meal', 20)}</span><div class="row-card-text"><strong>下一餐 · ${esc(next.name || '用餐')} ${fmtTime(next.start)}（預計）</strong><span>${wdOf(next.start)} ${fmtMD(dateKey(next.start))} · 工作中用餐不扣休息，也不影響薪資</span></div></div>
    <div class="btn-pair"><button type="button" class="btn btn-ink" data-action="meal-confirm" data-id="${next.id}">已經吃了</button><button type="button" class="btn btn-line" data-action="meal-delete" data-id="${next.id}">略過</button></div></section>`;
}

function quickTiles(cycle, data, now) {
  const st = statusOf(cycle, data, now);
  const working = st.key === 'work' || st.key === 'break';
  return `<section class="tiles" aria-label="快捷記錄">
    <a class="tile" href="#/meals"><span class="tile-icon k-meal">${icon('meal', 20)}</span>用餐</a>
    <button type="button" class="tile" data-action="open-record"><span class="tile-icon k-work">${icon('clockPlus', 20)}</span>補登</button>
    <button type="button" class="tile" data-action="break" ${working ? '' : 'disabled'}><span class="tile-icon k-commute">${icon('cup', 20)}</span>${st.key === 'break' ? '結束休息' : '休息'}</button>
    <a class="tile" href="#/stats"><span class="tile-icon k-deliv">${icon('wallet', 20)}</span>收入</a>
  </section>`;
}

export function refKey(r) {
  return `${r.type}:${r.id}:${r.field || ''}`;
}

function eventTable(data, wd, now, ui) {
  const ev = workdayEvents(data, wd, now);
  if (!ev.length) return `<section class="card"><h2 class="card-title">這個工作日的紀錄</h2><p class="muted">還沒有紀錄。按「新增記錄」或上面的主按鈕開始。</p></section>`;
  const sel = ev.find((e) => refKey(e.ref) === ui.selRef) || ev[ev.length - 1];
  const rows = ev.map((e) => {
    const on = e === sel;
    const src = e.plan ? '計畫' : '紀錄';
    return `<tr class="${on ? 'is-selected' : ''}">
      <td class="t-time${e.plan ? ' is-plan-text' : ''}">${fmtTime(e.t)}</td>
      <td class="muted">${wdOf(e.t)} ${fmtMD(dateKey(e.t))} ${crossBadge(e.t, wd)}</td>
      <td><button type="button" class="row-btn" data-action="select-ref" data-ref="${esc(refKey(e.ref))}" aria-pressed="${on}">${bubble(e.icon, e.kind, { plan: e.plan, size: 'sm', iconSize: 15 })}${esc(e.title)}</button></td>
      <td class="t-right"><span class="chip ${e.plan ? 'chip-plan' : 'chip-real'}">${src}</span></td>
    </tr>`;
  }).join('');
  const r = sel.ref;
  const editable = ['journey', 'session', 'sleep', 'meal', 'shift'].includes(r.type) && r.field !== 'break';
  const inspector = `<aside class="card inspector" aria-label="選取的紀錄">
    <span class="eyebrow">選取的紀錄</span>
    <div class="inspector-title">${bubble(sel.icon, sel.kind, { plan: sel.plan, iconSize: 18 })}<div><strong>${esc(sel.title)}</strong><span>${sel.plan ? '計畫時間 · 尚未發生，不計入實際時數' : '實際時間'}</span></div></div>
    <dl class="dl"><dt>實際日期</dt><dd>${wdOf(sel.t)} ${fmtMD(dateKey(sel.t))} ${fmtTime(sel.t)}</dd><dt>所屬工作日</dt><dd>${fmtDayMD(wd)}</dd>${sel.detail ? `<dt>備註</dt><dd>${esc(sel.detail)}</dd>` : ''}</dl>
    ${editable ? `<form class="form" data-form="ref-time">
      <input type="hidden" name="type" value="${esc(r.type)}"><input type="hidden" name="id" value="${esc(r.id)}"><input type="hidden" name="field" value="${esc(r.field || '')}">
      <div class="field-pair"><label class="field"><span>日期</span><input type="date" name="date" value="${toDateInput(sel.t)}" required></label>
      <label class="field"><span>時間</span><input type="time" name="time" value="${toTimeInput(sel.t)}" required></label></div>
      <button class="btn btn-ink btn-block" type="submit">${sel.plan && r.type !== 'shift' ? '更新時間' : '修改這個時間'}</button>
    </form>` : ''}
    ${r.type === 'meal' ? `<button type="button" class="btn btn-line btn-block" data-action="meal-delete" data-id="${esc(r.id)}">刪除這一餐</button>` : ''}
    <p class="fine">只會改這一個時間；其他打卡、收入、休息與備註保持不變。</p>
  </aside>`;
  return `<div class="grid-2-1">
    <section class="card card-flush"><div class="card-head"><h2 class="card-title">這個工作日的紀錄</h2><span class="muted small">點一行查看或修改</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th scope="col">時間</th><th scope="col">實際日期</th><th scope="col">事件</th><th scope="col" class="t-right">來源</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    ${inspector}
  </div>`;
}

export function todayView(ctx) {
  const { data, now, ui, isDesktop } = ctx;
  const wd = ctx.wd;
  const cycle = currentCycle(data, now);
  const [a, b] = workdaySpan(data, wd, now);
  const isAuto = !ui.wd;
  const showCross = dateKey(now) !== wd;
  const head = `<header class="today-head">
    <div class="today-head-text">
      <span class="pill-lime">${wdOfKey(wd)}工作日 · ${fmtMD(wd)}${isAuto ? '' : ' · 已手動切換'}</span>
      <h1>今天</h1>
      <div class="now-row">現在 <strong>${wdOf(now)} ${fmtMD(dateKey(now))} ${fmtTime(now)}</strong>${showCross ? crossBadge(now, wd) : ''}</div>
    </div>
    <div class="today-tools">
      <div class="day-switch" role="group" aria-label="切換工作日"><button type="button" class="icon-btn" data-action="wd-shift" data-dir="-1" aria-label="前一個工作日">${icon('left', 18, 2)}</button>${isAuto ? '' : '<button type="button" class="btn btn-line btn-sm" data-action="wd-auto">回到現在</button>'}<button type="button" class="icon-btn" data-action="wd-shift" data-dir="1" aria-label="下一個工作日">${icon('right', 18, 2)}</button></div>
      <a class="avatar mobile-only" href="#/settings" aria-label="我的：設定與資料">${icon('user', 22, 1.8)}</a>
      <button type="button" class="btn btn-ink desktop-only" data-action="open-record">${icon('plus', 18, 2.4)}新增記錄 <kbd>N</kbd></button>
    </div>
  </header>`;

  const ribbonCard = `<section class="card" aria-label="工作日作息">
    <div class="card-head"><h2 class="card-title">${isDesktop ? `${wdOfKey(wd)}工作日 · 由 ${wdOf(a)} ${fmtTime(a)} 到 ${wdOf(b)} ${fmtTime(b)}` : '工作日作息'}</h2><a class="link" href="#/timeline">完整時間線 ${icon('arrow', 16, 2)}</a></div>
    ${ribbon(data, a, b, now, { lanes: isDesktop })}
    ${legend(isDesktop, data)}
  </section>`;
  const stepCard = `<section class="card" aria-label="這趟通勤與出勤"><h2 class="card-title">這趟通勤與出勤</h2>${stepper(data, wd, cycle, now)}</section>`;

  if (isDesktop) {
    return `${head}
      <div class="grid-today">
        ${statusCard(data, wd, cycle, now)}
        <div class="today-side">${budgetCards(data, now)}${stepCard}</div>
      </div>
      ${ribbonCard}
      ${eventTable(data, wd, now, ui)}
      <div class="grid-2">${nextMealCard(data, now)}${quickTiles(cycle, data, now)}</div>`;
  }
  return `${head}${statusCard(data, wd, cycle, now)}${budgetCards(data, now)}${ribbonCard}${stepCard}${quickTiles(cycle, data, now)}${nextMealCard(data, now)}`;
}
