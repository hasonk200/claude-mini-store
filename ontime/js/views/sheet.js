import { esc, icon, bubble, STEP_ICON, STEP_KIND } from '../ui.js';
import { dateKey, fmtTime, wdOfKey, fmtMD, toDateInput, toTimeInput, MIN } from '../time.js';
import { STEP_LABEL, shiftOf, sleepWorkday, RIDE_MODES, recentPlaces } from '../logic.js';
import { findWorkdayTargets } from '../actions.js';

const GROUPS = [
  ['去程', ['out', 'ride', 'arrive']],
  ['出勤', ['clockIn', 'clockOut', 'break']],
  ['回程', ['leave', 'ride2', 'home']],
  ['生活', ['meal', 'sleepStart', 'sleepEnd']]
];
const LABEL = { ...STEP_LABEL, ride: '搭車', ride2: '搭車', break: '休息', meal: '用餐', sleepStart: '入睡', sleepEnd: '起床' };
const ICON = { ...STEP_ICON, break: 'cup', meal: 'meal', sleepStart: 'moon', sleepEnd: 'sun' };
const KINDS = { ...STEP_KIND, break: 'commute', meal: 'meal', sleepStart: 'sleep', sleepEnd: 'sleep' };

function valuesFor(data, wd) {
  const tg = findWorkdayTargets(data, wd);
  const s = tg.session;
  const j = tg.journey;
  const sh = (s && shiftOf(data, s)) || tg.shift;
  const sl = tg.sleep;
  const st = data.settings;
  const val = {
    out: j?.out, ride: j?.ride, arrive: j?.arrive, leave: j?.leave, ride2: j?.ride2, home: j?.home,
    clockIn: s?.start, clockOut: s?.end,
    break: s?.breaks?.length ? s.breaks[s.breaks.length - 1].start : null,
    meal: null,
    sleepStart: sl?.start, sleepEnd: sl?.end
  };
  const plan = {
    out: sh ? sh.start - (st.commuteOutMin ?? 45) * MIN : null, clockIn: sh?.start, clockOut: sh?.end,
    leave: sh?.end, home: sh ? sh.end + (st.commuteBackMin ?? 45) * MIN : null,
    sleepStart: sl?.planStart, sleepEnd: sl?.planEnd
  };
  return { val, plan, session: s };
}

export function defaultStep(data, wd) {
  const { val, session } = valuesFor(data, wd);
  if (session && session.end == null) return 'clockOut';
  for (const [, steps] of GROUPS) for (const k of steps) if (k !== 'meal' && k !== 'break' && val[k] == null) return k;
  return 'clockOut';
}

// 搭車的交通工具與上車地點，補登和時間線修改共用。
export function rideFieldsHtml(data, mode, from) {
  const places = recentPlaces(data);
  return `<div class="ride-fields">
      <span class="chip-group-name">交通工具</span><input type="hidden" name="mode" value="${esc(mode || '')}">
      <div class="btn-wrap">${RIDE_MODES.map((m) => `<button type="button" class="btn btn-soft btn-sm" data-action="ride-mode" data-v="${m}" aria-pressed="${m === mode}">${m}</button>`).join('')}</div>
      <label class="field"><span>哪裡搭車（可空白）</span><input type="text" name="from" value="${esc(from || '')}" placeholder="例如：Dundas Station" maxlength="60" autocomplete="off"></label>
      ${places.length ? `<div class="btn-wrap">${places.map((p) => `<button type="button" class="btn btn-line btn-sm" data-action="ride-place" data-v="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
    </div>`;
}

function recordSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const wd = sh.wd;
  const step = sh.step;
  const { val, plan, session } = valuesFor(data, wd);
  const groups = GROUPS.map(([name, steps]) => `<div class="chip-group"><span class="chip-group-name">${name}</span><div class="step-chips">${steps.map((k) => {
    const v = val[k];
    const on = k === step;
    const needSession = (k === 'clockOut' || k === 'break') && !session;
    return `<button type="button" class="step-chip${on ? ' is-on' : ''}${v == null ? ' is-missing' : ''}" data-action="rec-step" data-step="${k}" aria-pressed="${on}" ${needSession ? 'disabled' : ''}>
      ${bubble(ICON[k], KINDS[k], { size: 'sm', iconSize: 14 })}<span class="step-chip-text"><strong>${LABEL[k]}</strong><small>${k === 'meal' ? '另開表單' : needSession ? '先記上班' : v != null ? fmtTime(v) : '未記錄'}</small></span></button>`;
  }).join('')}</div></div>`).join('');

  const t = sh.t ?? val[step] ?? plan[step] ?? now;
  const isBreak = step === 'break';
  // 已經有這一段休息時，顯示它真正存下的結束時間；還沒結束的顯示現在；新的一段預設 30 分鐘。
  const savedBreak = isBreak ? (session?.breaks || []).find((b) => b.start === t) : null;
  const breakEnd = !isBreak ? null
    : savedBreak ? (savedBreak.end ?? now)
    : session?.breaks?.find((b) => b.end == null) ? now : t + 30 * MIN;
  const isRide = step === 'ride' || step === 'ride2';
  const tg = findWorkdayTargets(data, wd);
  const jr = tg.journey;
  const replaceable = step === 'sleepStart' && tg.sleep && tg.sleep.start != null && tg.sleep.end != null;
  const rideFields = isRide ? rideFieldsHtml(data, jr?.[`${step}Mode`], jr?.[`${step}From`]) : '';
  const form = step === 'meal'
    ? `<div class="sheet-note">用餐有自己的表單，可以加餐點和相片。<a class="btn btn-ink" href="#/meals" data-action="close-sheet-nav">前往記一餐</a></div>`
    : `<form class="form" data-form="record" id="record-form"><input type="hidden" name="wd" value="${wd}"><input type="hidden" name="step" value="${step}">
      <div class="sheet-step-title"><span class="step-no">2</span>「${LABEL[step]}」在什麼時候？</div>
      <div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>${isBreak ? '開始時間' : '時間'}</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>
      ${isBreak ? `<div class="field-pair"><label class="field"><span>結束日期</span><input type="date" name="endDate" value="${toDateInput(breakEnd)}"></label><label class="field"><span>結束時間（可空白）</span><input type="time" name="endTime" value="${toTimeInput(breakEnd)}"></label></div>` : ''}
      ${rideFields}
      ${replaceable ? `<label class="fine"><input type="checkbox" name="replace"> 取代這天最後一筆的入睡時間（不勾就新增一筆）</label>` : ''}
      ${dateKey(t) !== wd ? `<div class="cross-note"><span class="badge-cross">隔日</span>仍屬${wdOfKey(wd)}工作日，實際發生在${wdOfKey(dateKey(t))}</div>` : ''}
      <div class="btn-wrap"><button type="button" class="btn btn-soft btn-sm" data-action="rec-now">現在</button><button type="button" class="btn btn-soft btn-sm" data-action="rec-minus">−15 分</button>${plan[step] ? `<button type="button" class="btn btn-line btn-sm" data-action="rec-plan" data-t="${plan[step]}">用預計 ${fmtTime(plan[step])}</button>` : ''}</div>
      <p class="fine">只會修改「${LABEL[step]}」這一個時間；其他打卡、收入、休息、備註都保持不變。</p>
      <div class="sheet-foot btn-pair"><button class="btn btn-line btn-lg" type="submit" name="after" value="stay">儲存</button><button class="btn btn-ink btn-lg" type="submit" name="after" value="close">完成</button></div>
      <p class="fine">「儲存」會留在這一頁繼續補；「完成」儲存後關閉。</p>
    </form>`;

  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">補登一個時間</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body">
      <label class="field wd-field"><span>所屬工作日（由起床到下一次起床）</span><input type="date" value="${wd}" data-action="rec-wd"></label>
      <div class="sheet-step-title"><span class="step-no">1</span>先選要補哪一個</div>
      ${groups}
      ${form}
    </div>
  </section>`;
}

function refSheet(ctx) {
  const { ui, data } = ctx;
  const { ref, t, title } = ui.sheet;
  const isRideRef = ref.type === 'journey' && (ref.field === 'ride' || ref.field === 'ride2');
  const jr = isRideRef ? data.journeys.find((x) => x.id === ref.id) : null;
  const rideRef = isRideRef ? { mode: jr?.[`${ref.field}Mode`], from: jr?.[`${ref.field}From`] } : null;
  const canDelete = ['journey', 'session', 'sleep', 'meal', 'shift', 'rest'].includes(ref.type);
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">修改「${esc(title)}」</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body"><form class="form" data-form="ref-time">
      <input type="hidden" name="type" value="${esc(ref.type)}"><input type="hidden" name="id" value="${esc(ref.id)}"><input type="hidden" name="field" value="${esc(ref.field || '')}">
      <div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>時間</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>
      ${rideRef ? rideFieldsHtml(ctx.data, rideRef.mode, rideRef.from) : ''}
      <p class="fine">只會改這一個時間${rideRef ? '和交通工具、上車地點' : ''}；其他紀錄保持不變。</p>
      <button class="btn btn-ink btn-block btn-lg" type="submit">儲存</button>
      ${canDelete ? `<button type="button" class="btn btn-danger btn-block" data-action="delete-ref">刪除此紀錄</button>` : ''}
    </form></div>
  </section>`;
}

function confirmSheet(ctx) {
  const { title, body, confirm, action, tone, cancel } = ctx.ui.sheet;
  const okClass = tone === 'ink' ? 'btn-ink' : 'btn-danger';
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="alertdialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2></div>
    <div class="sheet-body"><p>${esc(body)}</p><div class="btn-pair"><button type="button" class="btn ${okClass}" data-action="${esc(action)}" data-confirmed="1">${esc(confirm)}</button><button type="button" class="btn btn-line" data-action="${esc(cancel || 'close-sheet')}">取消</button></div></div>
  </section>`;
}

export function sheetView(ctx) {
  const sh = ctx.ui.sheet;
  if (!sh) return '';
  if (sh.type === 'record') return recordSheet(ctx);
  if (sh.type === 'ref') return refSheet(ctx);
  if (sh.type === 'confirm') return confirmSheet(ctx);
  return '';
}
