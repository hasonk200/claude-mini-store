import { esc, icon, bubble } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, wdShort, fmtDur, addDays, HOUR, toDateInput, toTimeInput } from '../time.js';
import { sleepWorkday, sleepByWorkday, sleepAverage, nextSleepPlan } from '../logic.js';
import { pageHead } from './shared.js';

function ring(frac) {
  const r = 90;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
    <circle cx="110" cy="110" r="${r}" class="ring-plan"/>
    <circle cx="110" cy="110" r="${r}" class="ring-real" stroke-dasharray="${(c * Math.min(1, frac)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 110 110)"/>
  </svg>`;
}

function hero(data, now) {
  const active = data.sleeps.find((s) => s.start != null && s.end == null);
  const last = data.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
  if (active) {
    const planLen = active.planEnd ? active.planEnd - active.start : 8 * HOUR;
    const el = now - active.start;
    return `<section class="card sleep-hero" aria-label="睡眠計時">
      <div class="ring-wrap">${ring(el / planLen)}<div class="ring-text"><span class="eyebrow c-sleep">睡眠中</span><strong>${Math.floor(el / HOUR)}:${String(Math.floor((el % HOUR) / 60000)).padStart(2, '0')}</strong><span>實際已睡 · 計至現在 ${fmtTime(now)}</span></div></div>
      <div class="pair">
        <div class="pair-box"><span>入睡 · 實際</span><strong>${fmtTime(active.start)}</strong><small>${wdOf(active.start)} ${fmtMD(dateKey(active.start))}</small></div>
        <div class="pair-box is-plan-box"><span>預計起床 · 計畫</span><strong>${active.planEnd ? fmtTime(active.planEnd) : '未設定'}</strong><small>${active.planEnd ? '不計入實際時數' : '可以在下面設定'}</small></div>
      </div>
      <button type="button" class="btn btn-night btn-block" data-action="wake">現在起床</button>
    </section>`;
  }
  return `<section class="card sleep-hero" aria-label="睡眠計時">
    <div class="ring-wrap">${ring(last ? 1 : 0)}<div class="ring-text"><span class="eyebrow c-sleep">${last ? '上一次睡眠' : '還沒有紀錄'}</span><strong>${last ? fmtDur(last.end - last.start).replace(' ', '') : '—'}</strong><span>${last ? `${wdOf(last.start)} ${fmtTime(last.start)} → ${wdOf(last.end)} ${fmtTime(last.end)}` : '按下面的按鈕開始計時'}</span></div></div>
    <button type="button" class="btn btn-night btn-block" data-action="sleep-start">現在入睡</button>
  </section>`;
}

function attribution(data, now) {
  const target = data.sleeps.find((s) => s.start != null && s.end == null)
    || data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start)[0];
  if (!target) return '';
  const wd = sleepWorkday(target, data);
  const how = target.workdayDate === null ? '按入睡日期' : target.workdayDate ? '已指定' : '按入睡前一次起床計算';
  return `<section class="card" aria-label="所屬工作日"><form class="form" data-form="sleep-workday"><input type="hidden" name="id" value="${target.id}">
    <div class="row-card"><div class="row-card-text"><span class="eyebrow">所屬工作日（由起床到下一次起床）· ${how}</span><strong>${wdOfKey(wd)} ${fmtMD(wd)}</strong><span>修改歸屬不會改動入睡或起床時間</span></div></div>
    <div class="form-inline"><label class="field"><span>改成</span><input type="date" name="wd" value="${wd}"></label><button class="btn btn-ink" type="submit">更改</button><button class="btn btn-line" type="button" data-action="sleep-wd-clear" data-id="${target.id}">按入睡日期</button></div>
  </form></section>`;
}

function trend(data, now) {
  const end = dateKey(now);
  const keys = Array.from({ length: 7 }, (_, i) => addDays(end, i - 7));
  const by = sleepByWorkday(data, now);
  const avg = sleepAverage(data, keys, now);
  const max = 10 * HOUR;
  const bars = keys.map((k) => {
    const v = by[k];
    const h = v == null ? 0 : Math.min(1, v / max) * 100;
    return `<div class="bar-col"><span class="bar-val">${v == null ? '—' : fmtDur(v).replace(' ', '')}</span><div class="bar-slot"><i class="${v == null ? 'is-unknown' : v >= 7 * HOUR ? 'k-sleep' : 'k-sleep-light'}" style="height:${v == null ? 18 : h}%"></i></div><span class="bar-label">${wdShort(k)}<br>${fmtMD(k)}</span></div>`;
  }).join('');
  return `<section class="card" aria-label="近七個工作日"><div class="card-head"><div><h2 class="card-title">近七個工作日</h2><span class="muted small">平均只計完整實際紀錄（${avg.count} / 7）</span></div><strong class="big-num">${avg.avg == null ? '—' : fmtDur(avg.avg)}</strong></div>
    <div class="bars bars-sleep" style="--goal:${(8 * HOUR / max) * 100}%">${bars}<span class="goal-line"><b>目標 8h</b></span></div></section>`;
}

function plans(data, now) {
  const next = nextSleepPlan(data, now);
  const last = data.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
  const defStart = next ? next.planStart : now + HOUR;
  const defEnd = next ? next.planEnd : now + 9 * HOUR;
  const reuse = last ? `<button type="button" class="btn btn-soft-night btn-block" data-action="sleep-reuse">沿用最近一次時段 ${fmtTime(last.start)}–${fmtTime(last.end)}</button>` : '';
  const list = data.sleeps.filter((s) => s.start == null && s.planStart != null && s.planStart > now).sort((a, b) => a.planStart - b.planStart).slice(0, 5)
    .map((s) => `<li>${bubble('moon', 'sleep', { plan: true, size: 'sm', iconSize: 15 })}<span>${wdOf(s.planStart)} ${fmtMD(dateKey(s.planStart))} ${fmtTime(s.planStart)} → ${fmtTime(s.planEnd)}</span><button type="button" class="icon-btn icon-btn-sm" data-action="sleep-delete" data-id="${s.id}" aria-label="刪除計畫">${icon('trash', 16)}</button></li>`).join('');
  return `<section class="card card-plan" aria-label="睡眠計畫">
    <div class="card-head"><div><span class="eyebrow">下一次計畫</span><h2 class="card-title">${next ? `${wdOf(next.planStart)} ${fmtTime(next.planStart)} → ${fmtTime(next.planEnd)}` : '未設定'}</h2></div><span class="chip chip-plan">計畫</span></div>
    ${list ? `<ul class="plain-list">${list}</ul>` : ''}
    ${reuse}
    <details class="more"><summary>新增計畫</summary><form class="form" data-form="sleep-plan">
      <div class="field-pair"><label class="field"><span>入睡日期</span><input type="date" name="sd" value="${toDateInput(defStart)}" required></label><label class="field"><span>入睡時間</span><input type="time" name="st" value="${toTimeInput(defStart)}" required></label></div>
      <div class="field-pair"><label class="field"><span>起床日期</span><input type="date" name="ed" value="${toDateInput(defEnd)}" required></label><label class="field"><span>起床時間</span><input type="time" name="et" value="${toTimeInput(defEnd)}" required></label></div>
      <button class="btn btn-ink" type="submit">儲存計畫</button></form></details>
    <p class="fine">計畫只是安排，不會產生實際睡眠紀錄。</p>
  </section>`;
}

function history(data, now) {
  const list = data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start).slice(0, 8);
  if (!list.length) return '';
  return `<section class="card card-flush"><div class="card-head"><h2 class="card-title">最近的睡眠</h2></div><div class="table-wrap"><table class="table"><thead><tr><th scope="col">所屬工作日</th><th scope="col">入睡</th><th scope="col">起床</th><th scope="col" class="t-right">時數</th></tr></thead><tbody>
    ${list.map((s) => `<tr><td>${wdOfKey(sleepWorkday(s, data))} ${fmtMD(sleepWorkday(s, data))}</td><td>${wdOf(s.start)} ${fmtTime(s.start)}</td><td>${s.end ? `${wdOf(s.end)} ${fmtTime(s.end)}` : '<span class="chip chip-real">進行中</span>'}</td><td class="t-right"><b>${fmtDur((s.end ?? now) - s.start)}</b> <button type="button" class="icon-btn icon-btn-sm" data-action="sleep-delete" data-id="${s.id}" aria-label="刪除這筆睡眠">${icon('trash', 15)}</button></td></tr>`).join('')}
  </tbody></table></div></section>`;
}

export function sleepView(ctx) {
  const { data, now, isDesktop } = ctx;
  const head = pageHead('睡眠', '自己記下的時間最重要，計畫另外放');
  if (isDesktop) {
    return `${head}<div class="grid-1-2"><div class="stack">${hero(data, now)}${attribution(data, now)}</div><div class="stack">${trend(data, now)}${plans(data, now)}</div></div>${history(data, now)}`;
  }
  return `${head}${hero(data, now)}${attribution(data, now)}${trend(data, now)}${plans(data, now)}${history(data, now)}`;
}
