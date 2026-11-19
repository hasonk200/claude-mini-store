import { esc, icon, bubble } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, wdShort, fmtDur, addDays, HOUR, MIN, DAY, dayStart, toDateInput, toTimeInput, at, fromInputs, normTime } from '../time.js';
import { sleepWorkday, sleepByWorkday, sleepAverage, nextSleepPlan, latestOpenSleep, sessionsOfWorkday, journeyOfSession } from '../logic.js';
import { checkSleepPair } from '../actions.js';
import { pageHead, dayBand, phaseOf } from './shared.js';


// 睡眠頁頂：同首頁一樣嘅時間帶外觀（跟時段轉色）。大數字係實際睡咗幾耐，下面係過去 30 個鐘嘅時間帶。
function hero(data, now) {
  const active = latestOpenSleep(data);
  const last = data.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
  const end = active?.planEnd && active.planEnd > now ? Math.min(active.planEnd, now + 10 * HOUR) : now + 4 * HOUR;
  const band = dayBand(data, now - 30 * HOUR, end, now);
  const big = (ms) => `${Math.floor(ms / HOUR)}<small>小時</small>${String(Math.floor((ms % HOUR) / MIN)).padStart(2, '0')}<small>分</small>`;
  if (active) {
    const el = now - active.start;
    return `<section class="dayhero sleep-hero2" data-phase="${phaseOf(now)}" aria-label="睡眠計時">
      <div class="sh-top"><span class="sh-label">睡眠中</span><span class="sh-big">${big(el)}</span>
        <span class="sh-sub">入睡 ${wdOf(active.start)} ${fmtMD(dateKey(active.start))} ${fmtTime(active.start)}${active.planEnd ? ` · 預計 ${wdOf(active.planEnd)} ${fmtTime(active.planEnd)} 起身` : ''}</span></div>
      <div class="dh-band">${band}</div>
      <div class="sh-actions"><button type="button" class="btn btn-lime btn-block" data-action="wake">現在起床</button>
        <button type="button" class="link-ink" data-action="quick-wake">唔係啱啱起身？改起身時間</button></div>
    </section>`;
  }
  return `<section class="dayhero sleep-hero2" data-phase="${phaseOf(now)}" aria-label="睡眠計時">
    <div class="sh-top"><span class="sh-label">${last ? '上一次睡眠' : '還沒有睡眠紀錄'}</span><span class="sh-big">${last ? big(last.end - last.start) : '—'}</span>
      <span class="sh-sub">${last ? `${wdOf(last.start)} ${fmtMD(dateKey(last.start))} ${fmtTime(last.start)} → ${wdOf(last.end)} ${fmtTime(last.end)}${now - last.end < 24 * HOUR ? ` · 起身咗 ${fmtDur(now - last.end)}` : ''}` : '瞓醒撳「我瞓醒喇」，或者瞓之前撳「現在入睡」'}</span></div>
    <div class="dh-band">${band}</div>
    <div class="sh-actions btn-row"><button type="button" class="btn btn-lime" data-action="quick-wake">我瞓醒喇</button><button type="button" class="btn btn-ghost-dark" data-action="sleep-start">現在入睡</button></div>
  </section>`;
}

function attribution(data, now, ui) {
  const target = latestOpenSleep(data)
    || data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start)[0];
  if (!target) return '';
  const wd = sleepWorkday(target, data);
  const how = target.workdayManual ? '手動指定'
    : target.workdayDate === null ? '按入睡日期'
    : '自動（依起床推算）';
  return `<details class="card card-fold" aria-label="所屬工作日" data-pref="sleepAttr"${ui?.sleepAttr ? ' open' : ''}><summary><div><h2 class="card-title">進階：最近一覺算哪個工作日</h2><span class="muted small">${wdOfKey(wd)} ${fmtMD(wd)} · ${how}</span></div></summary>
    <div class="card-fold-body"><form class="form" data-form="sleep-workday"><input type="hidden" name="id" value="${target.id}">
    <div class="row-card"><div class="row-card-text"><span class="eyebrow">所屬工作日（由起床到下一次起床）· ${how}</span><strong>${wdOfKey(wd)} ${fmtMD(wd)}</strong><span>修改歸屬不會改動入睡或起床時間</span></div></div>
    <div class="form-inline"><label class="field"><span>改成</span><input type="date" name="wd" value="${wd}"></label><button class="btn btn-ink" type="submit">更改</button><button class="btn btn-line" type="button" data-action="sleep-wd-clear" data-id="${target.id}">按入睡日期</button></div>
  </form></div></details>`;
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
    const inner = `<span class="bar-val">${v == null ? '—' : fmtDur(v).replace(' ', '')}</span><div class="bar-slot"><i class="${v == null ? 'is-unknown' : v >= 7 * HOUR ? 'k-sleep' : 'k-sleep-light'}" style="height:${v == null ? 18 : h}%"></i></div><span class="bar-label">${wdShort(k)}<br>${fmtMD(k)}</span>`;
    return v == null
      ? `<button type="button" class="bar-col bar-col-btn" data-action="sleep-day-fill" data-wd="${k}" aria-label="補記 ${wdShort(k)} ${fmtMD(k)} 的睡眠">${inner}</button>`
      : `<div class="bar-col">${inner}</div>`;
  }).join('');
  const missing = 7 - avg.count;
  const catchup = missing >= 2 ? `<button type="button" class="btn btn-soft btn-block" data-action="sleep-catchup">一次補返缺漏的 ${missing} 日睡眠</button>` : '';
  return `<section class="card" aria-label="近七個工作日"><div class="card-head"><div><h2 class="card-title">近七個工作日</h2><span class="muted small">平均只計完整實際紀錄（${avg.count} / 7）${missing ? ' · 點灰柱可補記' : ''}</span></div><strong class="big-num">${avg.avg == null ? '—' : fmtDur(avg.avg)}</strong></div>
    <div class="bars bars-sleep" style="--goal:${(8 * HOUR / max) * 100}%">${bars}<span class="goal-line"><b>目標 8h</b></span></div>${catchup}</section>`;
}

export const SLEEP_PAIR_ERROR = {
  'bad-time': '請填寫入睡和起床的日期時間',
  'before-start': '起床時間要晚於入睡時間',
  'too-long': '超過 24 小時，日期是不是填錯了？',
  future: '還沒發生的睡眠請用「睡眠計畫」',
  overlap: '跟另一筆睡眠重疊了',
  missing: '找不到這筆睡眠，可能已經刪除'
};

// 補記的預設時段：這個工作日晚上 23:00 → 隔天 07:00；還沒發生、或者那晚已經有紀錄，就往前一晚找。
export function defaultSleepPair(wd, now, data = null) {
  const taken = (a, b) => (data?.sleeps || []).some((x) => x.start != null && x.start < b && (x.end ?? now) > a);
  // 這個工作日有收工紀錄（例如夜班朝早收工、日頭先瞓）：預設放在到家後半個鐘／收工後一個鐘開始，
  // 唔好一律估 23:00–07:00。取整到 5 分鐘；還沒過完 8 小時就計到現在。
  if (data) {
    const s = sessionsOfWorkday(data, wd).filter((x) => x.end != null && x.end < now).sort((a, b) => b.end - a.end)[0];
    if (s) {
      const home = journeyOfSession(data, s)?.home;
      const raw = home != null && home >= s.end ? home + 30 * MIN : s.end + 60 * MIN;
      const start = Math.ceil(raw / (5 * MIN)) * 5 * MIN;
      const end = Math.min(start + 8 * HOUR, Math.floor(now / (5 * MIN)) * 5 * MIN);
      if (end - start >= HOUR && !taken(start, end)) return { start, end };
    }
  }
  let k = wd;
  let first = null;
  for (let i = 0; i < 8; i++) {
    const p = { start: at(k, '23:00'), end: at(addDays(k, 1), '07:00') };
    if (p.end <= now) {
      first = first || p;
      if (!taken(p.start, p.end)) return p;
    }
    k = addDays(k, -1);
  }
  return first || { start: at(k, '23:00'), end: at(addDays(k, 1), '07:00') };
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

// 同臨時版一樣：只填「入睡那天」一個日期。起床鐘數早過（或者等於）入睡鐘數，就係隔天。
// 一覺唔會超過 24 個鐘，所以起床日期只得一個答案，唔使自己揀。
export function sleepEndKey(sd, st, et) {
  const a = normTime(st);
  const b = normTime(et);
  if (!sd || !a || !b) return '';
  return b > a ? sd : addDays(sd, 1);
}

// 入睡、起床一個表單填齊。新增（睡眠頁、補登面板）和修改（面板）共用；欄位先看草稿。
export function sleepPairForm({ data, now, ui, sleep = null, key, wd, inSheet = false }) {
  const dr = ui.drafts?.[key] || {};
  const v = (k, fallback) => (k in dr ? dr[k] : fallback);
  const def = sleep ? { start: sleep.start, end: sleep.end } : defaultSleepPair(wd, now, data);
  const sd = v('sd', toDateInput(def.start));
  const st = v('st', toTimeInput(def.start));
  const et = v('et', def.end != null ? toTimeInput(def.end) : '');
  const ed = sleepEndKey(sd, st, et);
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
      <label class="field"><span>入睡那天（實際日期）</span><input type="date" name="sd" value="${esc(sd)}" required></label>
      <div class="field-pair"><label class="field field-strong"><span>入睡時間</span><input type="time" name="st" value="${esc(st)}" required></label><label class="field field-strong"><span>起床時間${open ? '（未起床可空白）' : ''}</span><input type="time" name="et" value="${esc(et)}"${open ? '' : ' required'}></label></div>
      <p class="fine">起床時間早過入睡時間，就自動算成隔天。</p>
      <div class="cross-note sleep-preview" data-sleep-preview aria-live="polite">${sleepPairPreview(data, start, end, { id: sleep?.id ?? null, now })}</div>
      <details class="more"${main ? ' open' : ''}><summary>進階：短睡眠當作工作日分界</summary>
        <label class="fine"><input type="checkbox" name="mainSleep"${main ? ' checked' : ''}> 當作工作日分界（不到 4 小時也算）</label>
        <p class="fine">平時唔使理：瞓夠 4 個鐘會自動當作新一日開始。只有真係換日嘅短睡眠先勾。</p></details>
      ${foot}
      ${!sleep && Object.keys(dr).length ? `<button type="button" class="btn btn-text btn-block" data-action="draft-clear" data-key="${esc(key)}">清除未儲存的內容</button>` : ''}
    </form>`;
}

// 睡眠頁的「補記睡眠」卡；剛存好的那一筆在上面講清楚長度和歸屬。
function backfill(data, now, ui, wd) {
  const saved = ui.sleepSaved ? data.sleeps.find((x) => x.id === ui.sleepSaved && x.start != null) : null;
  const note = saved ? `<div class="saved-note" role="status"><span>已補記</span><strong>${fmtDur((saved.end ?? now) - saved.start)} · 歸屬 ${wdOfKey(sleepWorkday(saved, data))} ${fmtMD(sleepWorkday(saved, data))} 工作日</strong><span>${wdOf(saved.start)} ${fmtMD(dateKey(saved.start))} ${fmtTime(saved.start)} → ${saved.end ? `${wdOf(saved.end)} ${fmtMD(dateKey(saved.end))} ${fmtTime(saved.end)}` : '進行中'}${saved.end && dateKey(saved.end) !== dateKey(saved.start) ? ' · 跨午夜' : ''}</span></div>` : '';
  // 預設收起：啱啱瞓醒用上面「我瞓醒喇」；呢度係補之前嗰啲。啱啱存完，或者有未存完嘅內容，就保持打開。
  const open = ui.sleepFill || !!saved || Object.keys(ui.drafts?.['sleep:new'] || {}).length > 0;
  return `<details class="card card-fold" aria-label="補記睡眠" id="sleep-backfill" data-pref="sleepFill"${open ? ' open' : ''}><summary><div><h2 class="card-title">補記之前的睡眠</h2><span class="muted small">一個日期、兩個時間；不會變成「睡眠中」</span></div></summary>
    <div class="card-fold-body">${note}${sleepPairForm({ data, now, ui, key: 'sleep:new', wd })}</div></details>`;
}

function plans(data, now, ui) {
  const next = nextSleepPlan(data, now);
  const last = data.sleeps.filter((s) => s.start != null && s.end != null).sort((a, b) => b.end - a.end)[0];
  const reuse = last ? `<button type="button" class="btn btn-soft-night btn-block" data-action="sleep-reuse">沿用最近一次時段 ${fmtTime(last.start)}–${fmtTime(last.end)}</button>` : '';
  const list = data.sleeps.filter((s) => s.start == null && s.planStart != null && s.planStart > now).sort((a, b) => a.planStart - b.planStart).slice(0, 5)
    .map((s) => `<li class="row-click${ui.flash === `sleep:${s.id}` ? ' is-flash' : ''}" data-action="sleep-open" data-id="${s.id}">${bubble('moon', 'sleep', { plan: true, size: 'sm', iconSize: 15 })}<span>${wdOf(s.planStart)} ${fmtMD(dateKey(s.planStart))} ${fmtTime(s.planStart)} → ${dateKey(s.planEnd) !== dateKey(s.planStart) ? `${wdOf(s.planEnd)} ${fmtMD(dateKey(s.planEnd))} ` : ''}${fmtTime(s.planEnd)}${ui.flash === `sleep:${s.id}` ? ' <span class="saved-tag" role="status">已更新</span>' : ''}</span><button type="button" class="icon-btn icon-btn-sm" data-action="sleep-open" data-id="${s.id}" aria-label="修改計畫">${icon('edit', 16)}</button></li>`).join('');
  return `<section class="card card-plan" aria-label="睡眠計畫">
    <div class="card-head"><div><span class="eyebrow">下一次計畫</span><h2 class="card-title">${next ? `${wdOf(next.planStart)} ${fmtTime(next.planStart)} → ${fmtTime(next.planEnd)}` : '未設定'}</h2></div><span class="chip chip-plan">計畫</span></div>
    ${list ? `<ul class="plain-list">${list}</ul>` : ''}
    ${reuse}
    <button type="button" class="btn btn-ink" data-action="plan-clock">設定睡眠計畫</button>
    <p class="fine">計畫只是安排，不會產生實際睡眠紀錄。</p>
  </section>`;
}

function history(data, now, ui, isDesktop = false) {
  const list = data.sleeps.filter((s) => s.start != null).sort((a, b) => b.start - a.start).slice(0, 8);
  if (!list.length) return '';
  if (!isDesktop) return historyCards(data, now, ui, list);
  const rows = list.map((s) => {
    const wd = sleepWorkday(s, data);
    const gap = Math.round((dayStart(dateKey(s.start)) - dayStart(wd)) / DAY);
    const ms = (s.end ?? now) - s.start;
    const gapBadge = Math.abs(gap) >= 2 ? `<span class="badge-cross is-warn">與入睡差 ${Math.abs(gap)} 天</span>` : '';
    const longBadge = ms > DAY ? `<span class="badge-cross is-warn">超過 24 小時</span>` : '';
    // 點整行就修改；刪除放在修改面板裡。
    return `<tr class="row-click${ui.flash === `sleep:${s.id}` ? ' is-flash' : ''}" data-action="sleep-open" data-id="${s.id}"><td>${wdOfKey(wd)} ${fmtMD(wd)} ${gapBadge}</td>
      <td>${wdOf(s.start)} ${fmtMD(dateKey(s.start))} ${fmtTime(s.start)}</td>
      <td>${s.end ? `${wdOf(s.end)} ${fmtMD(dateKey(s.end))} ${fmtTime(s.end)}` : '<span class="chip chip-real">進行中</span>'}</td>
      <td class="t-right"><b>${fmtDur(ms)}</b> ${longBadge}${ui.flash === `sleep:${s.id}` ? '<span class="saved-tag" role="status">已更新</span>' : ''}<button type="button" class="icon-btn icon-btn-sm" data-action="sleep-open" data-id="${s.id}" aria-label="修改這筆睡眠">${icon('edit', 15)}</button></td></tr>`;
  }).join('');
  return `<section class="card card-flush"><div class="card-head"><h2 class="card-title">最近的睡眠</h2><span class="muted small">點一行可以修改</span></div><div class="table-wrap"><table class="table"><thead><tr><th scope="col">所屬工作日</th><th scope="col">入睡</th><th scope="col">起床</th><th scope="col" class="t-right">時數</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// 手機：每筆睡眠一行，可直接點；歸屬工作日、入睡→起床、時數固定在同一位置。
function historyCards(data, now, ui, list) {
  const rows = list.map((s) => {
    const wd = sleepWorkday(s, data);
    const ms = (s.end ?? now) - s.start;
    const gap = Math.abs(Math.round((dayStart(dateKey(s.start)) - dayStart(wd)) / DAY));
    const warn = [gap >= 2 ? `與入睡差 ${gap} 天` : '', ms > DAY ? '超過 24 小時' : ''].filter(Boolean);
    const fresh = ui.flash === `sleep:${s.id}`;
    const endText = s.end ? `${wdOf(s.end)} ${fmtMD(dateKey(s.end))}` : '還沒起床';
    return `<li class="${fresh ? 'is-flash' : ''}"><button type="button" class="rec-row" data-action="sleep-open" data-id="${s.id}" aria-label="修改睡眠：${wdOf(s.start)} ${fmtMD(dateKey(s.start))} ${fmtTime(s.start)} 到 ${s.end ? `${endText} ${fmtTime(s.end)}` : '還沒起床'}，${fmtDur(ms)}">
      <span class="rec-date"><strong>${wdOfKey(wd)} ${fmtMD(wd)}</strong><small>工作日</small></span>
      <span class="rec-span"><strong>${fmtTime(s.start)} → ${s.end ? fmtTime(s.end) : '進行中'}</strong><small>${wdOf(s.start)} ${fmtMD(dateKey(s.start))} → ${endText}</small>${warn.length ? `<small class="c-danger">${warn.join(' · ')}</small>` : ''}</span>
      <span class="rec-dur"><strong>${fmtDur(ms)}</strong>${fresh ? '<small class="saved-tag" role="status">已更新</small>' : `<small>${s.end ? '實際' : '進行中'}</small>`}</span>
    </button></li>`;
  }).join('');
  return `<section class="card card-flush"><div class="card-head"><h2 class="card-title">最近的睡眠</h2><span class="muted small">點一行可以修改</span></div><ul class="rec-list">${rows}</ul></section>`;
}

export function sleepView(ctx) {
  const { data, now, isDesktop, ui } = ctx;
  const head = pageHead('睡眠', '自己記下的時間最重要，計畫另外放');
  const fill = backfill(data, now, ui, ctx.wd);
  if (isDesktop) {
    return `${head}<div class="grid-1-2"><div class="stack">${hero(data, now)}${fill}${attribution(data, now, ui)}</div><div class="stack">${trend(data, now)}${plans(data, now, ui)}</div></div>${history(data, now, ui, true)}`;
  }
  // 手機：先睇到最近嘅睡眠（點一行就改），補記同進階收起。
  return `${head}${hero(data, now)}${history(data, now, ui)}${fill}${trend(data, now)}${plans(data, now, ui)}${attribution(data, now, ui)}`;
}
