import { esc, icon, bubble } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, wdShort, fmtDur, addDays, HOUR, DAY, dayStart, toDateInput, toTimeInput, at, fromInputs, normTime } from '../time.js';
import { sleepWorkday, sleepByWorkday, sleepAverage, nextSleepPlan, latestOpenSleep } from '../logic.js';
import { checkSleepPair } from '../actions.js';
import { pageHead, crossBadge } from './shared.js';

function ring(frac) {
  const r = 90;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
    <circle cx="110" cy="110" r="${r}" class="ring-plan"/>
    <circle cx="110" cy="110" r="${r}" class="ring-real" stroke-dasharray="${(c * Math.min(1, frac)).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 110 110)"/>
  </svg>`;
}

function hero(data, now) {
  const active = latestOpenSleep(data);
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
  const target = latestOpenSleep(data)
    || data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start)[0];
  if (!target) return '';
  const wd = sleepWorkday(target, data);
  const how = target.workdayManual ? '手動指定'
    : target.workdayDate === null ? '按入睡日期'
    : '自動（依起床推算）';
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

export const SLEEP_PAIR_ERROR = {
  'bad-time': '請填寫入睡和起床的日期時間',
  'before-start': '起床時間要晚於入睡時間',
  'too-long': '超過 24 小時，日期是不是填錯了？',
  future: '還沒發生的睡眠請用「睡眠計畫」',
  overlap: '跟另一筆睡眠重疊了',
  missing: '找不到這筆睡眠，可能已經刪除'
};

// 補記的預設時段：這個工作日晚上 23:00 → 隔天 07:00；還沒發生就往前一晚。
export function defaultSleepPair(wd, now) {
  let k = wd;
  for (let i = 0; i < 3; i++) {
    const end = at(addDays(k, 1), '07:00');
    if (end <= now) return { start: at(k, '23:00'), end };
    k = addDays(k, -1);
  }
  return { start: at(k, '23:00'), end: at(addDays(k, 1), '07:00') };
}

// 補記／修改睡眠時的即時預覽：長度、跨午夜、歸屬哪個工作日；不合理就直接講。
export function sleepPairPreview(data, start, end, { id = null, now } = {}) {
  if (start == null || Number.isNaN(start)) return '';
  const bad = end == null && !id ? 'bad-time' : checkSleepPair(data, start, end, { id, now });
  if (bad) return `<span class="c-danger">${SLEEP_PAIR_ERROR[bad] || '這個時間存不到'}</span>`;
  const old = id ? data.sleeps.find((x) => x.id === id) : null;
  const rec = { ...(old || {}), id: id || '_preview', start, end };
  if (!rec.workdayManual) delete rec.workdayDate;
  const wk = sleepWorkday(rec, { ...data, sleeps: [...data.sleeps.filter((x) => x.id !== id), rec] });
  const cross = end != null && dateKey(end) !== dateKey(start) ? ' <span class="badge-cross">跨午夜</span>' : '';
  return `共 <strong>${fmtDur((end ?? now) - start)}</strong>${end == null ? '（進行中）' : ''} · 入睡 ${wdOf(start)} ${fmtMD(dateKey(start))} ${fmtTime(start)} → ${end == null ? '還沒起床' : `起床 ${wdOf(end)} ${fmtMD(dateKey(end))} ${fmtTime(end)}`}${cross}<br>歸屬 <strong>${wdOfKey(wk)} ${fmtMD(wk)}</strong> 工作日`;
}

// 入睡、起床一個表單填齊。新增（睡眠頁、補登面板）和修改（面板）共用；欄位先看草稿。
export function sleepPairForm({ data, now, ui, sleep = null, key, wd, inSheet = false }) {
  const dr = ui.drafts?.[key] || {};
  const v = (k, fallback) => (k in dr ? dr[k] : fallback);
  const def = sleep ? { start: sleep.start, end: sleep.end } : defaultSleepPair(wd, now);
  const sd = v('sd', toDateInput(def.start));
  const st = v('st', toTimeInput(def.start));
  const ed = v('ed', def.end != null ? toDateInput(def.end) : '');
  const et = v('et', def.end != null ? toTimeInput(def.end) : '');
  const main = v('mainSleep', !!sleep?.mainSleep);
  const start = fromInputs(sd, normTime(st) || '');
  const end = ed && et ? fromInputs(ed, normTime(et) || '') : null;
  const open = sleep && sleep.end == null;
  const foot = sleep
    ? `<div class="sheet-foot"><button class="btn btn-ink btn-block btn-lg" type="submit" name="after" value="close">儲存修改</button></div>
      <button type="button" class="btn btn-text-danger btn-block" data-action="sleep-delete" data-id="${esc(sleep.id)}">刪除這筆睡眠</button>`
    : inSheet
      ? `<div class="sheet-foot btn-pair"><button class="btn btn-line btn-lg" type="submit" name="after" value="stay">儲存並繼續</button><button class="btn btn-ink btn-lg" type="submit" name="after" value="close">儲存並關閉</button></div>`
      : `<button class="btn btn-night btn-block" type="submit">補記這段睡眠</button>`;
  return `<form class="form" data-form="sleep-pair" data-draft="${esc(key)}"><input type="hidden" name="id" value="${esc(sleep?.id || '')}">
      <div class="field-pair"><label class="field"><span>入睡日期</span><input type="date" name="sd" value="${esc(sd)}" required></label><label class="field field-strong"><span>入睡時間</span><input type="time" name="st" value="${esc(st)}" required></label></div>
      <div class="field-pair"><label class="field"><span>起床日期</span><input type="date" name="ed" value="${esc(ed)}"${open ? '' : ' required'}></label><label class="field field-strong"><span>起床時間${open ? '（進行中可空白）' : ''}</span><input type="time" name="et" value="${esc(et)}"${open ? '' : ' required'}></label></div>
      <div class="cross-note sleep-preview" data-sleep-preview aria-live="polite">${sleepPairPreview(data, start, end, { id: sleep?.id ?? null, now })}</div>
      <label class="fine"><input type="checkbox" name="mainSleep"${main ? ' checked' : ''}> 當作工作日分界（不到 4 小時也算）</label>
      ${foot}
      ${!sleep && Object.keys(dr).length ? `<button type="button" class="btn btn-text btn-block" data-action="draft-clear" data-key="${esc(key)}">清除未儲存的內容</button>` : ''}
    </form>`;
}

// 睡眠頁的「補記睡眠」卡；剛存好的那一筆在上面講清楚長度和歸屬。
function backfill(data, now, ui, wd) {
  const saved = ui.sleepSaved ? data.sleeps.find((x) => x.id === ui.sleepSaved && x.start != null) : null;
  const note = saved ? `<div class="saved-note" role="status"><span>已補記</span><strong>${fmtDur((saved.end ?? now) - saved.start)} · 歸屬 ${wdOfKey(sleepWorkday(saved, data))} ${fmtMD(sleepWorkday(saved, data))} 工作日</strong><span>${wdOf(saved.start)} ${fmtMD(dateKey(saved.start))} ${fmtTime(saved.start)} → ${saved.end ? `${wdOf(saved.end)} ${fmtMD(dateKey(saved.end))} ${fmtTime(saved.end)}` : '進行中'}${saved.end && dateKey(saved.end) !== dateKey(saved.start) ? ' · 跨午夜' : ''}</span></div>` : '';
  return `<section class="card" aria-label="補記睡眠" id="sleep-backfill"><div class="card-head"><div><h2 class="card-title">補記睡眠</h2><span class="muted small">入睡和起床一次填好，不會變成「睡眠中」</span></div></div>
    ${note}${sleepPairForm({ data, now, ui, key: 'sleep:new', wd })}</section>`;
}

function plans(data, now, ui) {
  const next = nextSleepPlan(data, now);
  const last = data.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
  const defStart = next ? next.planStart : now + HOUR;
  const defEnd = next ? next.planEnd : now + 9 * HOUR;
  const reuse = last ? `<button type="button" class="btn btn-soft-night btn-block" data-action="sleep-reuse">沿用最近一次時段 ${fmtTime(last.start)}–${fmtTime(last.end)}</button>` : '';
  const list = data.sleeps.filter((s) => s.start == null && s.planStart != null && s.planStart > now).sort((a, b) => a.planStart - b.planStart).slice(0, 5)
    .map((s) => `<li class="row-click${ui.flash === `sleep:${s.id}` ? ' is-flash' : ''}" data-action="sleep-open" data-id="${s.id}">${bubble('moon', 'sleep', { plan: true, size: 'sm', iconSize: 15 })}<span>${wdOf(s.planStart)} ${fmtMD(dateKey(s.planStart))} ${fmtTime(s.planStart)} → ${fmtTime(s.planEnd)}</span><button type="button" class="icon-btn icon-btn-sm" data-action="sleep-open" data-id="${s.id}" aria-label="修改計畫">${icon('edit', 16)}</button></li>`).join('');
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

function history(data, now, ui) {
  const list = data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start).slice(0, 8);
  if (!list.length) return '';
  const rows = list.map((s) => {
    const wd = sleepWorkday(s, data);
    const gap = Math.round((dayStart(dateKey(s.start)) - dayStart(wd)) / DAY);
    const ms = (s.end ?? now) - s.start;
    const gapBadge = Math.abs(gap) >= 2 ? `<span class="badge-cross is-warn">與入睡差 ${Math.abs(gap)} 天</span>` : '';
    const longBadge = ms > DAY ? `<span class="badge-cross is-warn">超過 24 小時</span>` : '';
    // 點整行就修改；刪除放在修改面板裡。
    return `<tr class="row-click${ui.flash === `sleep:${s.id}` ? ' is-flash' : ''}" data-action="sleep-open" data-id="${s.id}"><td>${wdOfKey(wd)} ${fmtMD(wd)} ${gapBadge}</td>
      <td>${wdOf(s.start)} ${fmtMD(dateKey(s.start))} ${fmtTime(s.start)} ${crossBadge(s.start, wd)}</td>
      <td>${s.end ? `${wdOf(s.end)} ${fmtMD(dateKey(s.end))} ${fmtTime(s.end)} ${crossBadge(s.end, dateKey(s.start))}` : '<span class="chip chip-real">進行中</span>'}</td>
      <td class="t-right"><b>${fmtDur(ms)}</b> ${longBadge}<button type="button" class="icon-btn icon-btn-sm" data-action="sleep-open" data-id="${s.id}" aria-label="修改這筆睡眠">${icon('edit', 15)}</button></td></tr>`;
  }).join('');
  return `<section class="card card-flush"><div class="card-head"><h2 class="card-title">最近的睡眠</h2><span class="muted small">點一行可以修改</span></div><div class="table-wrap"><table class="table"><thead><tr><th scope="col">所屬工作日</th><th scope="col">入睡</th><th scope="col">起床</th><th scope="col" class="t-right">時數</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function sleepView(ctx) {
  const { data, now, isDesktop, ui } = ctx;
  const head = pageHead('睡眠', '自己記下的時間最重要，計畫另外放');
  const fill = backfill(data, now, ui, ctx.wd);
  if (isDesktop) {
    return `${head}<div class="grid-1-2"><div class="stack">${hero(data, now)}${fill}${attribution(data, now)}</div><div class="stack">${trend(data, now)}${plans(data, now, ui)}</div></div>${history(data, now, ui)}`;
  }
  return `${head}${hero(data, now)}${fill}${attribution(data, now)}${trend(data, now)}${plans(data, now, ui)}${history(data, now, ui)}`;
}
