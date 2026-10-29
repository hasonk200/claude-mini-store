import { esc, icon, bubble, STEP_ICON, STEP_KIND, verifyToggle } from '../ui.js';
import { dateKey, fmtTime, wdOf, wdOfKey, fmtMD, toDateInput, toTimeInput, MIN } from '../time.js';
import { STEP_LABEL, shiftOf, sleepWorkday, RIDE_MODES, recentPlaces, isFlag, eventVerified, journeyOfSession, sessionsOfWorkday, defaultStepTime, SHIFT_BOUND_STEPS, recentShiftRanges, jobOf, timeOnWorkday } from '../logic.js';
import { findWorkdayTargets } from '../actions.js';
import { sleepPairForm } from './sleep.js';
import { mealForm } from './meals.js';
import { syncSummary } from './shared.js';

const GROUPS = [
  ['去程', ['out', 'ride', 'arrive']],
  ['出勤', ['clockIn', 'clockOut', 'break']],
  ['回程', ['leave', 'ride2', 'home']],
  ['生活', ['meal', 'sleepStart', 'sleepEnd']]
];
// 補登先揀「要補什麼」：只有工作和通勤要先選班次；睡眠、用餐直接填。
export const CATS = [
  ['work', '工作', 'bag', 'work', ['clockIn', 'clockOut', 'break']],
  ['commute', '通勤', 'bus', 'commute', ['out', 'ride', 'arrive', 'leave', 'ride2', 'home']],
  ['sleep', '睡眠', 'moon', 'sleep', ['sleepPair', 'sleepStart', 'sleepEnd']],
  ['meal', '用餐', 'meal', 'meal', ['meal']]
];
const CAT_STEPS = Object.fromEntries(CATS.map(([k, , , , steps]) => [k, steps]));
export const catOf = (step) => CATS.find(([, , , , steps]) => steps.includes(step))?.[0] ?? null;
const LABEL = { ...STEP_LABEL, ride: '搭車', ride2: '搭車', break: '休息', meal: '用餐', sleepStart: '入睡', sleepEnd: '起床', sleepPair: '整段' };
const ICON = { ...STEP_ICON, break: 'cup', meal: 'meal', sleepStart: 'moon', sleepEnd: 'sun', sleepPair: 'moon' };
const KINDS = { ...STEP_KIND, break: 'commute', meal: 'meal', sleepStart: 'sleep', sleepEnd: 'sleep', sleepPair: 'sleep' };

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

// 揀了類別之後預設補哪一項：工作／通勤揀第一個未記錄的；睡眠預設「一段睡眠」。
export function defaultStepIn(data, wd, cat, sid) {
  if (cat === 'sleep') return 'sleepPair';
  if (cat === 'meal') return 'meal';
  const { val, session } = valuesFor(data, wd, sid);
  if (cat === 'work') return session && session.end == null ? 'clockOut' : val.clockIn == null ? 'clockIn' : 'clockOut';
  return CAT_STEPS.commute.find((k) => val[k] == null) || 'out';
}

// 一般「＋」打開：這天有班次就預先揀好最需要補的類別；空白日（例如休息日）先問要補什麼。
export function openRecordSheet(data, wd, step) {
  if (step) return { type: 'record', wd, cat: catOf(step), step };
  if (!sessionsOfWorkday(data, wd).length) return { type: 'record', wd, cat: null, step: null };
  const st = defaultStep(data, wd);
  return { type: 'record', wd, cat: catOf(st), step: st };
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
const shiftRange = (x) => `${fmtTime(x.start)}–${x.end != null ? fmtTime(x.end) : x.endPending ? '待補收工' : '進行中'}`;

function shiftChips(data, sessions, sid, newShift) {
  const chips = sessions.map((x) => {
    const on = !newShift && x.id === sid;
    const job = jobOf(data, x.jobId);
    return `<button type="button" class="step-chip shift-chip${on ? ' is-on' : ''}" data-action="rec-shift" data-sid="${esc(x.id)}" aria-pressed="${on}">
      <span class="step-chip-text"><strong>${shiftRange(x)}</strong><small>${esc(job?.name ?? '工作')} · ${wdOf(x.start)} ${fmtMD(dateKey(x.start))}${dateKey(x.end ?? x.start) !== dateKey(x.start) ? ` → ${wdOf(x.end)} ${fmtMD(dateKey(x.end))}` : ''}</small></span></button>`;
  }).join('');
  const add = `<button type="button" class="step-chip shift-chip shift-add${newShift ? ' is-on' : ''}" data-action="rec-newshift" aria-pressed="${newShift}"><span class="step-chip-text"><strong>＋ 新增班次</strong><small>填開工和收工時間</small></span></button>`;
  return `<div class="step-chips shift-chips">${chips}${add}</div>`;
}

function newShiftForm(data, wd, no = 2) {
  const recent = recentShiftRanges(data);
  return `<form class="form" data-form="new-shift"><input type="hidden" name="wd" value="${wd}">
    <div class="sheet-step-title"><span class="step-no">${no}</span>新增班次：幾點開工、幾點收工？</div>
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
  const cat = sh.cat !== undefined ? sh.cat : catOf(sh.step);
  const sessions = sessionsOfWorkday(data, wd);
  const sid = sessions.some((x) => x.id === sh.sid) ? sh.sid : (sessions.find((x) => x.end == null) || sessions[0])?.id ?? null;
  const step = cat && CAT_STEPS[cat].includes(sh.step) ? sh.step : cat ? defaultStepIn(data, wd, cat, sid) : null;
  let n = 0;
  const title = (text) => `<div class="sheet-step-title"><span class="step-no">${++n}</span>${text}</div>`;
  // 揀好類別之後縮成一行，少捲動；頂部固定顯示「正在補：…」。
  const cats = `${title('要補什麼？')}<div class="step-chips cat-chips${cat ? ' is-compact' : ''}">${CATS.map(([k, label, ic, kind]) => `<button type="button" class="step-chip cat-chip${k === cat ? ' is-on' : ''}" data-action="rec-cat" data-cat="${k}" aria-pressed="${k === cat}">${bubble(ic, kind, { size: 'sm', iconSize: 14 })}<span class="step-chip-text"><strong>${label}</strong>${cat ? '' : `<small>${k === 'work' || k === 'commute' ? '先選班次' : '直接填'}</small>`}</span></button>`).join('')}</div>`;
  const catLabel = CATS.find(([k]) => k === cat)?.[1];
  const crumb = cat ? `<div class="sheet-crumb" aria-live="polite">正在補：<strong>${catLabel}${step && cat !== 'meal' ? ` › ${LABEL[step]}` : ''}</strong> · ${wdOfKey(wd)} ${fmtMD(wd)} 工作日</div>` : '';
  let body = '';
  if (!cat) {
    body = '<p class="fine">休息日也可以直接記睡眠和用餐，不用先建立班次。</p>';
  } else if (cat === 'meal') {
    body = `${title('這一餐在什麼時候？')}${mealForm({ data, now, ui, key: 'meal:new', defaultStart: timeOnWorkday(data, wd, now), inSheet: true })}`;
  } else if (cat === 'sleep') {
    const subs = stepChips(data, wd, sid, CAT_STEPS.sleep, step, null);
    body = `${title('補哪一種？')}${subs}${step === 'sleepPair'
      ? `${title('入睡和起床')}${sleepPairForm({ data, now, ui, key: 'sleep:rec', wd, inSheet: true })}`
      : recordForm(ctx, { wd, step, sid: null, sess: null, title })}`;
  } else {
    const sess = sessions.find((x) => x.id === sid) || null;
    const newShift = !!sh.newShift;
    body = `${title('選班次')}${shiftChips(data, sessions, sid, newShift)}`;
    if (newShift) body += newShiftForm(data, wd, ++n);
    else {
      body += `${title(cat === 'work' ? '補哪一個出勤時間？' : '補哪一段通勤？')}${stepChips(data, wd, sid, CAT_STEPS[cat], step, sess)}`;
      body += !sess
        ? `<div class="sheet-note">「${LABEL[step]}」要先有班次才能補。<button type="button" class="btn btn-ink" data-action="rec-newshift">＋ 新增班次</button></div>`
        : recordForm(ctx, { wd, step, sid, sess, title });
    }
  }
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">補登</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body">
      ${crumb}
      <label class="field wd-field"><span>工作日</span><input type="date" value="${wd}" data-action="rec-wd"></label>
      ${cats}
      ${body}
    </div>
  </section>`;
}

function stepChips(data, wd, sid, steps, step, sess) {
  const { val } = valuesFor(data, wd, sid);
  return `<div class="step-chips">${steps.map((k) => {
    const v = val[k];
    const on = k === step;
    const needShift = SHIFT_BOUND_STEPS.has(k) && !sess;
    const note = k === 'sleepPair' ? '入睡＋起床' : needShift ? '先選班次' : v != null ? fmtTime(v) : k === 'sleepStart' || k === 'sleepEnd' ? '只補這一個' : '未記錄';
    return `<button type="button" class="step-chip${on ? ' is-on' : ''}${v == null && k !== 'sleepPair' ? ' is-missing' : ''}" data-action="rec-step" data-step="${k}" aria-pressed="${on}" ${needShift ? 'disabled' : ''}>
      ${bubble(ICON[k], KINDS[k], { size: 'sm', iconSize: 14 })}<span class="step-chip-text"><strong>${LABEL[k]}</strong><small>${note}</small></span></button>`;
  }).join('')}</div>`;
}

// 單一時間的補登表單（工作、通勤、只補入睡／起床）。
function recordForm(ctx, { wd, step, sid, sess, title }) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const bound = SHIFT_BOUND_STEPS.has(step);
  const { val, plan, session } = valuesFor(data, wd, sid);
  // 跟班次有關的步驟：預設時間放在班次附近；其他的沿用所選工作日（不是「現在」那天）。
  const t = sh.t ?? val[step] ?? plan[step] ?? (bound && sess ? defaultStepTime(step, sess) : timeOnWorkday(data, wd, now));
  const isBreak = step === 'break';
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
  const timeBlock = anchored
    ? `<label class="field field-strong"><span>${isBreak ? '開始時間' : '時間'}</span><input type="time" name="time" value="${toTimeInput(t)}" required></label>
      <div class="cross-note" id="rec-preview" aria-live="polite">${previewText(t, sess)}</div>
      <details class="more"><summary>日期不對？手動改日期</summary>
        <label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label></details>`
    : `<div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>${isBreak ? '開始時間' : '時間'}</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>
      <div class="cross-note" id="rec-preview" data-wd="${wd}" aria-live="polite">${freePreviewText(t, wd)}</div>`;
  return `<form class="form" data-form="record" id="record-form" ${anchored ? `data-anchored="1" data-s-start="${sess.start}" data-s-end="${sess.end ?? ''}"` : ''}><input type="hidden" name="wd" value="${wd}"><input type="hidden" name="step" value="${step}"><input type="hidden" name="sid" value="${anchored ? esc(sess.id) : ''}">
      ${title(`「${LABEL[step]}」在什麼時候？`)}
      ${timeBlock}
      ${isBreak ? `<div class="field-pair"><label class="field"><span>結束日期</span><input type="date" name="endDate" value="${toDateInput(breakEnd)}"></label><label class="field"><span>結束時間（可空白）</span><input type="time" name="endTime" value="${toTimeInput(breakEnd)}"></label></div>` : ''}
      ${verifyToggle(stepFlag(tg, step, t, 'verified'))}
      ${rideFields}
      ${replaceable ? `<label class="fine"><input type="checkbox" name="replace"> 取代這天最後一筆的入睡時間（不勾就新增一筆）</label>` : ''}
      <div class="btn-wrap"><button type="button" class="btn btn-soft btn-sm" data-action="rec-now">現在</button><button type="button" class="btn btn-soft btn-sm" data-action="rec-minus">−15 分</button>${plan[step] ? `<button type="button" class="btn btn-line btn-sm" data-action="rec-plan" data-t="${plan[step]}">用預計 ${fmtTime(plan[step])}</button>` : ''}</div>
      <p class="fine">只會修改「${LABEL[step]}」這一個時間；其他打卡、收入、休息、備註都保持不變。</p>
      <div class="sheet-foot btn-pair"><button class="btn btn-line btn-lg" type="submit" name="after" value="stay">儲存並繼續</button><button class="btn btn-ink btn-lg" type="submit" name="after" value="close">儲存並關閉</button></div>
      <p class="fine">「儲存並繼續」會留在這裡，接著補下一項。</p>
    </form>`;
}

// 沒有班次可以對照時的預覽：「會存成 週六 10/24 15:00 · 補 週六 10/24 工作日」。
// 跨日直接寫出兩個日期，不用「隔日／前一日」。
export function freePreviewText(t, wd) {
  if (t == null || Number.isNaN(t)) return '';
  return `會存成 <strong>${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}</strong> · 補 ${wdOfKey(wd)} ${fmtMD(wd)} 工作日`;
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
  // 上次儲存失敗時，顯示你剛填的時間，不要跳回原本的時間。
  const shown = ui.sheet.draftT ?? t;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">修改「${esc(title)}」</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body"><form class="form" data-form="ref-time">
      <input type="hidden" name="type" value="${esc(ref.type)}"><input type="hidden" name="id" value="${esc(ref.id)}"><input type="hidden" name="field" value="${esc(ref.field || '')}">${origT}
      <div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(shown)}" required></label>
      <label class="field field-strong"><span>時間</span><input type="time" name="time" value="${toTimeInput(shown)}" required></label></div>
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
  const { title, body, confirm, action, tone, cancel, cancelLabel } = ctx.ui.sheet;
  const okClass = tone === 'ink' ? 'btn-ink' : 'btn-danger';
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="alertdialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2></div>
    <div class="sheet-body"><p>${esc(body)}</p><div class="btn-pair"><button type="button" class="btn ${okClass}" data-action="${esc(action)}" data-confirmed="1">${esc(confirm)}</button><button type="button" class="btn btn-line" data-action="${esc(cancel || 'close-sheet')}">${esc(cancelLabel || '取消')}</button></div></div>
  </section>`;
}

// 預計收工：只用來估算睡前空檔。預設在現在之後、最近的整點半點再加一小時。
function expectedEndSheet(ctx) {
  const { data, now, ui } = ctx;
  const s = data.sessions.find((x) => x.id === ui.sheet.sid);
  if (!s) return '';
  const half = 30 * MIN;
  const t = ui.sheet.draftT ?? s.expectedEnd ?? Math.ceil(now / half) * half + 2 * half;
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">預計幾點收工？</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body"><form class="form" data-form="expected-end"><input type="hidden" name="sid" value="${esc(s.id)}">
      <p class="fine">這班 ${wdOf(s.start)} ${fmtTime(s.start)} 上班。預計收工只用來估算睡前空檔，不會記成下班時間，也不影響工時。</p>
      <div class="field-pair big-fields"><label class="field"><span>日期</span><input type="date" name="date" value="${toDateInput(t)}" required></label>
      <label class="field field-strong"><span>預計收工</span><input type="time" name="time" value="${toTimeInput(t)}" required></label></div>
      <div class="sheet-foot btn-pair">${s.expectedEnd != null ? '<button type="button" class="btn btn-line btn-lg" data-action="expected-end-clear">清除預計</button>' : ''}<button class="btn btn-ink btn-lg" type="submit">用這個時間估算</button></div>
    </form></div>
  </section>`;
}

function sheetWrap(title, body, small = true) {
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet${small ? ' sheet-small' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body">${body}</div>
  </section>`;
}

// 由列表點一筆睡眠：入睡、起床一起改；計畫改計畫時間。刪除放在最底（次要）。
function sleepSheet(ctx) {
  const { data, now, ui } = ctx;
  const s = data.sleeps.find((x) => x.id === ui.sheet.id);
  if (!s) return '';
  if (s.start == null) {
    const d = ui.drafts?.[`plan:${s.id}`] || {};
    const v = (k, f) => (k in d ? d[k] : f);
    return sheetWrap('修改睡眠計畫', `<form class="form" data-form="sleep-plan-edit" data-draft="plan:${esc(s.id)}"><input type="hidden" name="id" value="${esc(s.id)}">
      <div class="field-pair"><label class="field"><span>入睡日期</span><input type="date" name="sd" value="${esc(v('sd', toDateInput(s.planStart)))}" required></label><label class="field field-strong"><span>入睡時間</span><input type="time" name="st" value="${esc(v('st', toTimeInput(s.planStart)))}" required></label></div>
      <div class="field-pair"><label class="field"><span>起床日期</span><input type="date" name="ed" value="${esc(v('ed', toDateInput(s.planEnd)))}" required></label><label class="field field-strong"><span>起床時間</span><input type="time" name="et" value="${esc(v('et', toTimeInput(s.planEnd)))}" required></label></div>
      <p class="fine">計畫只是安排，不會產生實際睡眠紀錄。</p>
      <div class="sheet-foot"><button class="btn btn-ink btn-block btn-lg" type="submit">儲存修改</button></div>
      <button type="button" class="btn btn-text-danger btn-block" data-action="sleep-delete" data-id="${esc(s.id)}">刪除這個計畫</button>
    </form>`);
  }
  return sheetWrap('修改這筆睡眠', sleepPairForm({ data, now, ui, sleep: s, key: `sleep:${s.id}`, wd: sleepWorkday(s, data), inSheet: true }));
}

function mealSheet(ctx) {
  const { data, now, ui } = ctx;
  const m = data.meals.find((x) => x.id === ui.sheet.id);
  if (!m) return '';
  return sheetWrap('修改這一餐', mealForm({ data, now, ui, meal: m, key: `meal:${m.id}`, inSheet: true }));
}

// 同步狀態詳情：講清楚紀錄現在在哪裡、出了甚麼問題、可以怎樣處理。
function syncSheet(ctx) {
  const sum = syncSummary(ctx.sync?.state, ctx.sync?.status);
  const st = ctx.sync?.status || {};
  const btn = {
    signin: '<button type="button" class="btn btn-ink btn-block" data-action="sync-in">登入 Google 同步</button>',
    retry: '<button type="button" class="btn btn-ink btn-block" data-action="sync-retry">再試一次</button>',
    settings: '<a class="btn btn-line btn-block" href="#/settings" data-action="close-sheet-nav">到「我的」匯出備份或管理同步</a>'
  };
  return sheetWrap('同步狀態', `<div class="sync-detail is-${sum.tone}" role="status"><strong>${esc(sum.line)}</strong><span>${esc(sum.detail)}</span></div>
    <dl class="dl"><dt>這部裝置</dt><dd>${st.saveError ? '未能儲存' : st.lastSaved ? `最後儲存 ${fmtTime(st.lastSaved)}` : '已儲存'}${st.persisted ? ' · 不會被瀏覽器自動清除' : ''}</dd></dl>
    <div class="stack-tight">${sum.actions.map((a) => btn[a]).join('')}</div>`);
}

export function sheetView(ctx) {
  const sh = ctx.ui.sheet;
  if (!sh) return '';
  if (sh.type === 'sync') return syncSheet(ctx);
  if (sh.type === 'sleep') return sleepSheet(ctx);
  if (sh.type === 'meal') return mealSheet(ctx);
  if (sh.type === 'expected-end') return expectedEndSheet(ctx);
  if (sh.type === 'record') return recordSheet(ctx);
  if (sh.type === 'ref') return refSheet(ctx);
  if (sh.type === 'confirm') return confirmSheet(ctx);
  return '';
}
