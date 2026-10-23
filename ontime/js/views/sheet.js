import { esc, icon, bubble, STEP_ICON, STEP_KIND, verifyToggle } from '../ui.js';
import { dateKey, fmtTime, wdOf, wdOfKey, fmtMD, toDateInput, toTimeInput, MIN } from '../time.js';
import { STEP_LABEL, shiftOf, sleepWorkday, RIDE_MODES, recentPlaces, isFlag, eventVerified, journeyOfSession, sessionsOfWorkday, defaultStepTime, SHIFT_BOUND_STEPS, recentShiftRanges, jobOf } from '../logic.js';
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

function valuesFor(data, wd, sid) {
  const tg = findWorkdayTargets(data, wd);
  // 有指定班次就用那一班和它的行程；沒有才照舊找這個工作日的第一班。
  const picked = sid ? data.sessions.find((x) => x.id === sid) || null : null;
  const s = picked || tg.session;
  const j = picked ? journeyOfSession(data, picked) : tg.journey;
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

// 補登面板上，目前這個步驟已存的時間有沒有某個標記（目前只有 verified 已驗證）。
function stepFlag(tg, step, t, key) {
  const s = tg.session;
  if (['out', 'ride', 'arrive', 'leave', 'ride2', 'home'].includes(step)) return isFlag(tg.journey, key, step);
  if (step === 'clockIn') return isFlag(s, key, 'start');
  if (step === 'clockOut') return isFlag(s, key, 'end');
  if (step === 'break') return isFlag((s?.breaks || []).find((b) => b.start === t), key, 'start');
  if (step === 'sleepStart') return isFlag(tg.sleep, key, 'start');
  if (step === 'sleepEnd') return isFlag(tg.sleep, key, 'end');
  return false;
}

// 班次的一行說明，例如「07:13–15:29」。
const shiftRange = (x) => `${fmtTime(x.start)}–${x.end != null ? fmtTime(x.end) : '進行中'}`;

function shiftChips(data, sessions, sid, newShift) {
  const chips = sessions.map((x) => {
    const on = !newShift && x.id === sid;
    const job = jobOf(data, x.jobId);
    return `<button type="button" class="step-chip shift-chip${on ? ' is-on' : ''}" data-action="rec-shift" data-sid="${esc(x.id)}" aria-pressed="${on}">
      <span class="step-chip-text"><strong>${shiftRange(x)}</strong><small>${esc(job?.name ?? '工作')} · ${wdOf(x.start)} ${fmtMD(dateKey(x.start))}${dateKey(x.end ?? x.start) !== dateKey(x.start) ? ' · 跨日' : ''}</small></span></button>`;
  }).join('');
  const add = `<button type="button" class="step-chip shift-chip shift-add${newShift ? ' is-on' : ''}" data-action="rec-newshift" aria-pressed="${newShift}"><span class="step-chip-text"><strong>＋ 新增班次</strong><small>填開工和收工時間</small></span></button>`;
  return `<div class="step-chips shift-chips">${chips}${add}</div>`;
}

function newShiftForm(data, wd) {
  const recent = recentShiftRanges(data);
  return `<form class="form" data-form="new-shift"><input type="hidden" name="wd" value="${wd}">
    <div class="sheet-step-title"><span class="step-no">2</span>新增班次：幾點開工、幾點收工？</div>
    ${recent.length ? `<div class="btn-wrap">${recent.map((r) => `<button type="button" class="btn btn-soft btn-sm" data-action="shift-range" data-from="${r.from}" data-to="${r.to}">${r.key}</button>`).join('')}</div>` : ''}
    <div class="field-pair big-fields"><label class="field"><span>開工日期</span><input type="date" name="date" value="${wd}" required></label>
    <label class="field field-strong"><span>開工時間</span><input type="time" name="start" required></label></div>
    <label class="field"><span>收工時間（可空白；跨午夜會自動算隔天）</span><input type="time" name="end"></label>
    <p class="fine">建好之後，這班的出門、搭車、抵達、下班、到家，都會自動算在這一班上。</p>
    <div class="sheet-foot btn-pair"><button type="button" class="btn btn-line btn-lg" data-action="rec-newshift-cancel">取消</button><button class="btn btn-ink btn-lg" type="submit">建立班次</button></div>
  </form>`;
}

function recordSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const wd = sh.wd;
  const step = sh.step;
  const bound = SHIFT_BOUND_STEPS.has(step);
  const sessions = sessionsOfWorkday(data, wd);
  const sid = sessions.some((x) => x.id === sh.sid) ? sh.sid : (sessions.find((x) => x.end == null) || sessions[0])?.id ?? null;
  const sess = sessions.find((x) => x.id === sid) || null;
  // 要補的是跟班次有關的步驟、但這天一班都沒有：直接引導去新增班次。
  const newShift = !!sh.newShift || (bound && !sess);
  const { val, plan, session } = valuesFor(data, wd, sid);
  const groups = GROUPS.map(([name, steps]) => `<div class="chip-group"><span class="chip-group-name">${name}</span><div class="step-chips">${steps.map((k) => {
    const v = val[k];
    const on = k === step;
    const needShift = SHIFT_BOUND_STEPS.has(k) && !session;
    return `<button type="button" class="step-chip${on ? ' is-on' : ''}${v == null ? ' is-missing' : ''}" data-action="rec-step" data-step="${k}" aria-pressed="${on}" ${needShift ? 'disabled' : ''}>
      ${bubble(ICON[k], KINDS[k], { size: 'sm', iconSize: 14 })}<span class="step-chip-text"><strong>${LABEL[k]}</strong><small>${k === 'meal' ? '另開表單' : needShift ? '先選班次' : v != null ? fmtTime(v) : '未記錄'}</small></span></button>`;
  }).join('')}</div></div>`).join('');

  // 跟班次有關的步驟：預設時間放在班次附近（不是「現在」）；睡眠、用餐照舊。
  const t = sh.t ?? val[step] ?? plan[step] ?? (bound && sess ? defaultStepTime(step, sess) : now);
  const isBreak = step === 'break';
  // 已經有這一段休息時，顯示它真正存下的結束時間；還沒結束的顯示現在；新的一段預設 30 分鐘。
  const savedBreak = isBreak ? (session?.breaks || []).find((b) => b.start === t) : null;
  const breakEnd = !isBreak ? null
    : savedBreak ? (savedBreak.end ?? now)
    : session?.breaks?.find((b) => b.end == null) ? now : t + 30 * MIN;
  const isRide = step === 'ride' || step === 'ride2';
  const tg0 = findWorkdayTargets(data, wd);
  const tg = { ...tg0, session: session || tg0.session, journey: (session && journeyOfSession(data, session)) || (sid ? null : tg0.journey) };
  const jr = tg.journey;
  const replaceable = step === 'sleepStart' && tg.sleep && tg.sleep.start != null && tg.sleep.end != null;
  const rideFields = isRide ? rideFieldsHtml(data, jr?.[`${step}Mode`], jr?.[`${step}From`]) : '';
  const anchored = bound && !!sess;
  const stepNo = anchored ? 3 : 2;
  const timeBlock = anchored
    ? `<label class="field field-strong"><span>${isBreak ? '開始時間' : '時間'}</span><input type="time" name="time" value="${toTimeInput(t)}" required></label>
      <div class="cross-note" id="rec-preview" aria-live="polite">${previewText(t, sess)}</div>
      <details class="more"><summary>日期不對？手動改日期</summary>
        <label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label></details>`
    : `<div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>${isBreak ? '開始時間' : '時間'}</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>`;
  const form = newShift ? newShiftForm(data, wd) : step === 'meal'
    ? `<div class="sheet-note">用餐有自己的表單，可以加餐點和相片。<a class="btn btn-ink" href="#/meals" data-action="close-sheet-nav">前往記一餐</a></div>`
    : `<form class="form" data-form="record" id="record-form" ${anchored ? `data-anchored="1" data-s-start="${sess.start}" data-s-end="${sess.end ?? ''}"` : ''}><input type="hidden" name="wd" value="${wd}"><input type="hidden" name="step" value="${step}"><input type="hidden" name="sid" value="${anchored ? esc(sess.id) : ''}">
      <div class="sheet-step-title"><span class="step-no">${stepNo}</span>「${LABEL[step]}」在什麼時候？</div>
      ${timeBlock}
      ${isBreak ? `<div class="field-pair"><label class="field"><span>結束日期</span><input type="date" name="endDate" value="${toDateInput(breakEnd)}"></label><label class="field"><span>結束時間（可空白）</span><input type="time" name="endTime" value="${toTimeInput(breakEnd)}"></label></div>` : ''}
      ${verifyToggle(stepFlag(tg, step, t, 'verified'))}
      ${rideFields}
      ${replaceable ? `<label class="fine"><input type="checkbox" name="replace"> 取代這天最後一筆的入睡時間（不勾就新增一筆）</label>` : ''}
      ${!anchored && dateKey(t) !== wd ? `<div class="cross-note"><span class="badge-cross">隔日</span>仍屬${wdOfKey(wd)}工作日，實際發生在${wdOfKey(dateKey(t))}</div>` : ''}
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
      <label class="field wd-field"><span>工作日</span><input type="date" value="${wd}" data-action="rec-wd"></label>
      <div class="sheet-step-title"><span class="step-no">1</span>選班次</div>
      ${shiftChips(data, sessions, sid, newShift)}
      ${newShift ? '' : `<div class="sheet-step-title"><span class="step-no">2</span>先選要補哪一個</div>
      ${groups}`}
      ${form}
    </div>
  </section>`;
}

// 「會存成 週二 10/20 07:05 · 屬於 23:00–07:00 這班」。補登時即時更新，讓你一眼看到日期對不對。
export function previewText(t, s) {
  return `會存成 <strong>${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}</strong> · 屬於 ${shiftRange(s)} 這班`;
}

function refSheet(ctx) {
  const { ui, data } = ctx;
  const { ref, t, title } = ui.sheet;
  const isRideRef = ref.type === 'journey' && (ref.field === 'ride' || ref.field === 'ride2');
  const jr = isRideRef ? data.journeys.find((x) => x.id === ref.id) : null;
  const rideRef = isRideRef ? { mode: jr?.[`${ref.field}Mode`], from: jr?.[`${ref.field}From`] } : null;
  const canDelete = ['journey', 'session', 'sleep', 'meal', 'shift', 'rest'].includes(ref.type);
  const sleep = ref.type === 'sleep' ? (data.sleeps || []).find((x) => x.id === ref.id) : null;
  const mainSleepBox = sleep
    ? `<label class="fine"><input type="checkbox" name="mainSleep" ${sleep.mainSleep ? 'checked' : ''}> 當作工作日分界（不到 4 小時也算）</label>`
    : '';
  const canVerify = ref.type !== 'shift' && !ui.sheet.plan;
  const origT = `<input type="hidden" name="origT" value="${t}">`;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">修改「${esc(title)}」</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body"><form class="form" data-form="ref-time">
      <input type="hidden" name="type" value="${esc(ref.type)}"><input type="hidden" name="id" value="${esc(ref.id)}"><input type="hidden" name="field" value="${esc(ref.field || '')}">${origT}
      <div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>時間</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>
      ${canVerify ? verifyToggle(eventVerified(data, { ref, t })) : ''}
      ${rideRef ? rideFieldsHtml(ctx.data, rideRef.mode, rideRef.from) : ''}
      ${mainSleepBox}
      <p class="fine">${sleep ? '會改這個時間和「工作日分界」設定' : `只會改這一個時間${rideRef ? '和交通工具、上車地點' : ''}`}；其他紀錄保持不變。</p>
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
