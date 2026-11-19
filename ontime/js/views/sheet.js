import { tripPayMode, tripJobId } from '../actions.js';
import { missingSleepDays, tripCommuteTemplate, tripNowStep, tripWorkBreakMs, tripStepGaps, workdayShiftForTrip } from '../planning.js';
import { planningSheet, incomeFields } from './planning.js';
import { esc, icon, bubble, STEP_ICON, STEP_KIND, verifyToggle } from '../ui.js';
import { dateKey, fmtTime, wdOf, wdOfKey, fmtMD, toDateInput, toTimeInput, MIN, fromInputs, normTime, fmtDurLong, fmtDur } from '../time.js';
import { STEP_LABEL, STEPS, shiftOf, sleepWorkday, RIDE_MODES, recentPlaces, isFlag, eventVerified, journeyOfSession, sessionsOfWorkday, defaultStepTime, SHIFT_BOUND_STEPS, recentShiftRanges, jobOf, timeOnWorkday, restAutoWorkday, journeyAutoWorkday,
  quickWakeState, WAKE_AGO, QUICK_WAKE_ERROR, MAIN_SLEEP_MS, dayKeyOfWake, mealWorkday, lastClockBefore,
  tripState, tripsOfWorkday, tripErrorText, shiftsOfWorkday, tripAllVerified, currentCycle } from '../logic.js';
import { findWorkdayTargets } from '../actions.js';
import { sleepPairForm, sleepEndKey, sleepPairPreview } from './sleep.js';
import { mealForm } from './meals.js';
import { syncSummary, workdayField, workdayPreview } from './shared.js';

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
  ['meal', '用餐', 'meal', 'meal', ['meal']],
  ['rest', '休息', 'cup', 'commute', ['rest']]
];
const CAT_STEPS = Object.fromEntries(CATS.map(([k, , , , steps]) => [k, steps]));
export const catOf = (step) => CATS.find(([, , , , steps]) => steps.includes(step))?.[0] ?? null;
const LABEL = { ...STEP_LABEL, ride: '搭車', ride2: '搭車', break: '休息', meal: '用餐', sleepStart: '入睡', sleepEnd: '起床', sleepPair: '整段', rest: '休息' };
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
  if (cat === 'rest') return 'rest';
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
  const crumb = cat ? `<div class="sheet-crumb" aria-live="polite">正在補：<strong>${catLabel}${step && cat !== 'meal' && cat !== 'rest' ? ` › ${LABEL[step]}` : ''}</strong> · ${wdOfKey(wd)} ${fmtMD(wd)} 工作日</div>` : '';
  let body = '';
  if (!cat) {
    body = '<p class="fine">休息日也可以直接記睡眠和用餐，不用先建立班次。</p>';
  } else if (cat === 'rest') {
    body = `${title('這段休息在什麼時候？')}${restForm(ctx, wd)}`;
  } else if (cat === 'meal') {
    body = `${title('這一餐在什麼時候？')}${mealForm({ data, now, ui, key: 'meal:new', defaultStart: timeOnWorkday(data, wd, now), inSheet: true, wd })}`;
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

// 班內與獨立休息共用同一個時間範圍表單。
function restForm(ctx, wd) {
  const { data, now, ui } = ctx;
  const key = 'rest:new';
  const dr = ui.drafts?.[key] || {};
  const v = (k, f) => (k in dr ? dr[k] : f);
  const start = timeOnWorkday(data, wd, now);
  const date = v('date', toDateInput(start));
  const st = v('start', toTimeInput(start));
  const t = fromInputs(date, normTime(st) || '');
  const auto = t != null ? restAutoWorkday({ start: t }, data) : null;
  return `<form class="form" data-form="rest" data-draft="${key}" data-wd-kind="rest">
      <div class="field-pair big-fields"><label class="field"><span>日期</span><input type="date" name="date" value="${esc(date)}" required></label>
      <label class="field field-strong"><span>開始</span><input type="time" name="start" value="${esc(st)}" required></label></div>
      <label class="field"><span>結束（跨午夜會自動算隔天）</span><input type="time" name="end" value="${esc(v('end', ''))}" required></label>
      <label class="field"><span>計入哪裡</span><select name="restMode"><option value="auto">按時間配對班次</option><option value="alone">獨立休息</option>${sessionsOfWorkday(data, wd).map(s=>`<option value="${esc(s.id)}">${fmtTime(s.start)} · ${esc(jobOf(data,s.jobId)?.name||'工作')}班內</option>`).join('')}</select></label><div class="fine" data-range-preview aria-live="polite"></div>
      ${workdayField({ mode: 'sheet', value: wd })}
      <div class="cross-note" data-wd-preview aria-live="polite">${workdayPreview(t, wd, auto)}</div>
      ${verifyToggle(v('verified', false))}
      <p class="fine">選「按時間配對班次」，整段在同一班內就扣該班工時，整段在班外就記為獨立休息。跨過上下班時間請分開填。手動選班會扣該班工時，選「獨立休息」就不扣工時。</p>
      <div class="sheet-foot btn-pair"><button class="btn btn-line btn-lg" type="submit" name="after" value="stay">儲存並繼續</button><button class="btn btn-ink btn-lg" type="submit" name="after" value="close">儲存並關閉</button></div>
    </form>`;
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
  // 休息、冇班次的行程：可以改歸屬工作日（有班次的行程跟班次走）。
  const rest = ref.type === 'rest' ? (data.rests || []).find((x) => x.id === ref.id) : null;
  const sj = ref.type === 'journey' ? data.journeys.find((x) => x.id === ref.id && !x.sessionId) : null;
  let wdBlock = '';
  if (rest || sj) {
    const autoNow = rest ? restAutoWorkday({ ...rest, [ref.field]: shown }, data) : journeyAutoWorkday({ ...sj, [ref.field]: shown }, data);
    const cur = rest ? (rest.workdayManual && rest.workdayDate) || null : sj.workdayDate || null;
    const mode = ui.sheet.wdMode ?? (cur && cur !== autoNow ? 'manual' : 'auto');
    const value = ui.sheet.wdValue ?? (mode === 'manual' ? cur : autoNow);
    wdBlock = `${workdayField({ mode, value })}<div class="cross-note" data-wd-preview aria-live="polite">${workdayPreview(shown, mode === 'manual' ? value : autoNow, autoNow)}</div>`;
  }
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet sheet-small" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">修改「${esc(title)}」</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body"><form class="form" data-form="ref-time"${rest ? ' data-wd-kind="rest"' : sj ? ' data-wd-kind="journey"' : ''}>
      <input type="hidden" name="type" value="${esc(ref.type)}"><input type="hidden" name="id" value="${esc(ref.id)}"><input type="hidden" name="field" value="${esc(ref.field || '')}">${origT}
      <div class="field-pair big-fields"><label class="field"><span>實際日期</span><input type="date" name="date" value="${toDateInput(shown)}" required></label>
      <label class="field field-strong"><span>時間</span><input type="time" name="time" value="${toTimeInput(shown)}" required></label></div>
      ${canVerify ? verifyToggle(eventVerified(data, { ref, t })) : ''}
      ${rideRef ? rideFieldsHtml(ctx.data, rideRef.mode, rideRef.from) : ''}
      ${wdBlock}
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

function sheetWrap(title, body, small = true, cls = '') {
  return `<div class="sheet-backdrop" data-action="close-sheet"></div>
  <section class="sheet${small ? ' sheet-small' : ''}${cls ? ` ${cls}` : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn" data-action="close-sheet" aria-label="關閉">${icon('close', 18, 2.2)}</button></div>
    <div class="sheet-body">${body}</div>
  </section>`;
}

// ---------- 整趟：七個時間一次過填（2.42 重新設計） ----------
// 打開整趟面板：預設揀「現在這一趟」（或者這個工作日的第一趟）；一趟都沒有就開一張新的。
export function openTripSheet(data, wd, now, pick = {}) {
  if (pick.isNew) return { type: 'trip', wd, isNew: true };
  if (pick.sessionId || pick.journeyId) return { type: 'trip', wd, sessionId: pick.sessionId || null, journeyId: pick.journeyId || null, focus: pick.focus };
  const trips = tripsOfWorkday(data, wd);
  const cyc = currentCycle(data, now);
  const cur = trips.find((t) => (cyc.session && t.session?.id === cyc.session.id) || (cyc.journey && t.journey?.id === cyc.journey.id));
  const t = cur || trips[trips.length - 1];
  if (!t) return { type: 'trip', wd, isNew: true, focus: pick.focus };
  return { type: 'trip', wd, sessionId: t.session?.id ?? null, journeyId: t.session ? null : t.journey?.id ?? null, focus: pick.focus };
}

const TRIP_LABEL = { out: '出門', ride: '上車', arrive: '抵達', clockIn: '上班', clockOut: '下班', ride2: '上車', home: '到家' };
export function tripHint(row) {
  if (row.t == null) return '';
  return `${wdOf(row.t)} ${fmtMD(dateKey(row.t))}${row.off === 1 ? ' 隔天' : row.off > 1 ? ` +${row.off}天` : ''}`;
}
export function tripGroupDurText(groupKey, st) {
  if (groupKey === 'go') return st.summary.go != null ? `共 ${fmtDur(st.summary.go)}` : '';
  if (groupKey === 'back') return st.summary.back != null ? `共 ${fmtDur(st.summary.back)}` : '';
  if (groupKey === 'work') {
    if (st.summary.work == null) return '';
    const brk = tripWorkBreakMs(st);
    return brk > 0 ? `淨 ${fmtDur(Math.max(0, st.summary.work - brk))}（已扣 ${fmtDur(brk)} 休）` : fmtDur(st.summary.work);
  }
  return '';
}
function fmtGapShort(ms) {
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${String(r).padStart(2, '0')}m` : `${h}h`;
}
export function tripGapHTML(step, gaps, st) {
  const g = gaps?.[step];
  if (!g) return '';
  let ms = g.ms;
  if (step === 'clockOut') {
    const brk = tripWorkBreakMs(st);
    if (brk > 0) ms = Math.max(0, ms - brk);
  }
  return `<span class="trip-gap-pill${g.skipped ? ' is-skip' : ''}">${fmtGapShort(ms)}</span>`;
}
export function tripSummaryHTML(st, opts = {}) {
  const { go, work, back } = st.summary;
  const parts = [];
  if (go != null) parts.push(`去程 <strong>${fmtDur(go)}</strong>`);
  if (work != null) {
    // 已有班內休息時，顯示扣除休息後的淨上班時長，同時間線與統計一致（只改顯示，不改計數）。
    const brk = tripWorkBreakMs(st);
    if (brk > 0) parts.push(`上班 <strong>${fmtDur(Math.max(0, work - brk))}</strong>（已扣 ${fmtDur(brk)} 休息）`);
    else parts.push(`上班 <strong>${fmtDur(work)}</strong>`);
  }
  if (back != null) parts.push(`回程 <strong>${fmtDur(back)}</strong>`);
  if (st.error && st.error.reason !== 'empty') return `<span class="c-danger">${esc(tripErrorText(st.error))}</span>`;

  const filledTimes = STEPS.map((k) => st.times?.[k]).filter((t) => t != null);
  if (!filledTimes.length) return '<span class="muted">填了頭尾就會計出去程、上班、回程用了多久</span>';

  const lines = [];
  if (parts.length) lines.push(`<span class="trip-sum-dur">${parts.join(' · ')}</span>`);
  const firstT = filledTimes[0];
  const lastT = filledTimes[filledTimes.length - 1];
  const span = filledTimes.length > 1
    ? `${wdOf(firstT)} ${fmtMD(dateKey(firstT))} ${fmtTime(firstT)} → ${wdOf(lastT)} ${fmtMD(dateKey(lastT))} ${fmtTime(lastT)}`
    : `${wdOf(firstT)} ${fmtMD(dateKey(firstT))} ${fmtTime(firstT)}`;
  const wdText = st.workday ? ` · 計入 <strong>${wdOfKey(st.workday)} ${fmtMD(st.workday)} 工作日</strong>` : '';
  lines.push(`<span class="trip-sum-meta">${span}${wdText}</span>`);

  const preSet = new Set(opts.prefilled || []);
  const preCount = STEPS.filter((k) => st.times?.[k] != null && preSet.has(k)).length;
  if (preCount > 0) {
    lines.push(`<span class="trip-sum-pre">${filledTimes.length} 格入面 ${preCount} 格係預填（未改過）</span>`);
  }
  return lines.join('');
}
const tripName = (data, t) => {
  if (t.session) {
    const s = t.session;
    return `${fmtTime(s.start)}–${s.end != null ? fmtTime(s.end) : s.endPending ? '待補' : '進行中'} ${esc(jobOf(data, s.jobId)?.name ?? '')}`;
  }
  const first = ['out', 'ride', 'arrive', 'leave', 'ride2', 'home'].map((k) => t.journey?.[k]).find((v) => v != null);
  return `通勤 ${first != null ? fmtTime(first) : ''}`;
};

function tripSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const st = tripState(data, sh, now);
  const trips = tripsOfWorkday(data, sh.wd);
  const isSel = (t) => !sh.isNew && ((t.session && t.session.id === st.trip.session?.id) || (!t.session && t.journey && t.journey.id === st.trip.journey?.id));
  const tabs = trips.length
    ? `<div class="trip-tabs" role="group" aria-label="這個工作日的每一趟">${trips.map((t) => `<button type="button" class="chip-btn" data-action="trip-pick" data-sid="${esc(t.session?.id ?? '')}" data-jid="${esc(t.session ? '' : t.journey?.id ?? '')}" aria-pressed="${isSel(t)}">${tripName(data, t)}</button>`).join('')}<button type="button" class="chip-btn" data-action="trip-pick" data-new="1" aria-pressed="${!!sh.isNew}">＋ 新一趟</button></div>`
    : '';

  const curJobId = tripJobId(data, st.trip, st.workday, st.times.clockIn, sh.jobId);
  const curJob = jobOf(data, curJobId);
  const payMode = tripPayMode(data, st.trip, st.workday, st.times.clockIn, sh.jobId);
  const isDelivJob = curJob?.color === 'deliv';
  const hasCommute = ['out', 'ride', 'arrive', 'ride2', 'home'].some((k) => !!st.vals[k]);
  const commuteCollapsed = payMode === 'perOrder' && !hasCommute && !sh.showCommute;

  const { shift, recorded: shiftRecorded } = workdayShiftForTrip(data, sh.wd, {
    jobId: curJobId,
    explicitJob: !!sh.jobId,
    excludeSessionId: st.trip?.session?.id ?? null
  });
  const usableShift = shift && !shiftRecorded ? shift : null;
  const tpl = tripCommuteTemplate(data, {
    jobId: curJobId,
    excludeSessionId: st.trip?.session?.id ?? null,
    excludeJourneyId: st.trip?.journey?.id ?? null
  });
  const hasWorkTimes = st.times.clockIn != null || st.times.clockOut != null;
  const preSet = new Set(sh.prefilled || []);
  const gaps = tripStepGaps(st);
  const nowStep = tripNowStep(data, sh, st, now, { commuteCollapsed });

  const placeholderFor = (k) => {
    if (k === 'clockIn' && usableShift) return fmtTime(usableShift.start);
    if (k === 'clockOut' && usableShift) return fmtTime(usableShift.end);
    return '--:--';
  };

  const planHint = {
    clockIn: usableShift ? `班表 ${fmtTime(usableShift.start)}` : '',
    clockOut: usableShift ? `班表 ${fmtTime(usableShift.end)}` : ''
  };
  const rowHTML = (k) => {
    const r = st.rows.find((x) => x.step === k);
    const v = st.vals[k] || '';
    const work = k === 'clockIn' || k === 'clockOut';
    const isPre = !!v && preSet.has(k);
    const showNow = nowStep === k;
    return `<div class="trip-row${work ? ' is-work' : ''}${v ? ' is-filled' : ''}${isPre ? ' is-prefill' : ''}${st.error?.step === k ? ' is-bad' : ''}${showNow ? ' has-now' : ''}" data-step="${k}">
      <div class="trip-lab">
        <div class="trip-lab-head"><strong>${TRIP_LABEL[k]}</strong><span class="trip-pre-tag"${isPre ? '' : ' hidden'}>預填</span></div>
        <small data-trip-hint="${k}"${r.off > 0 ? ' class="is-next"' : ''}>${tripHint(r)}</small>${planHint[k] ? `<small class="trip-plan-hint">${esc(planHint[k])}</small>` : ''}
      </div>
      <div class="trip-ctrl">
        <label class="field trip-time"><input type="time" name="t_${k}" value="${esc(v)}" placeholder="${esc(placeholderFor(k))}" aria-label="${TRIP_LABEL[k]}時間"${sh.focus === k ? ' data-autofocus' : ''}></label>
        ${showNow ? `<button type="button" class="btn btn-soft btn-sm trip-now" data-action="trip-now" data-step="${k}" aria-label="${TRIP_LABEL[k]}填入現在時間">現在</button>` : ''}
        <button type="button" class="icon-btn trip-clear" data-action="trip-clear" data-step="${k}" aria-label="清除${TRIP_LABEL[k]}時間"${v ? '' : ' hidden'}>${icon('close', 14, 2.4)}</button>
      </div>
    </div>`;
  };

  const gapEl = (k, cls = '') => `<div class="trip-gap${cls ? ` ${cls}` : ''}${gaps[k] ? ' is-on' : ''}" data-trip-gap="${k}">${tripGapHTML(k, gaps, st)}</div>`;
  const groupHTML = (key, title, steps, extraCls = '') => `<div class="trip-group is-${key}-group${extraCls ? ` ${extraCls}` : ''}" data-trip-group="${key}">
      <div class="trip-group-head"><span class="trip-group-name">${title}</span><span class="trip-group-dur" data-trip-group-dur="${key}">${tripGroupDurText(key, st)}</span></div>
      <div class="trip-group-steps">${steps.map((k, i) => `${i > 0 ? gapEl(k) : ''}${rowHTML(k)}`).join('')}</div>
    </div>`;

  const track = `<div class="trip-track${commuteCollapsed ? ' is-commute-collapsed' : ''}" data-trip-track>
      ${groupHTML('go', '去程', ['out', 'ride', 'arrive'])}
      ${gapEl('clockIn', 'is-bridge')}
      ${groupHTML('work', '上班・下班', ['clockIn', 'clockOut'], isDelivJob ? 'is-deliv' : '')}
      ${gapEl('ride2', 'is-bridge')}
      ${groupHTML('back', '回程', ['ride2', 'home'])}
    </div>${commuteCollapsed ? '<button type="button" class="btn btn-line btn-sm trip-commute-btn" data-action="trip-commute-show">＋ 補通勤時間（出門／上車／抵達／到家，可選）</button>' : ''}`;

  const allFilled = STEPS.every((k) => !!st.vals[k]);
  const showPrefillBar = (!st.exists || !allFilled || preSet.size > 0) && (shift || tpl.go || tpl.back);
  const prefillBar = showPrefillBar
    ? `<div class="trip-prefill" role="group" aria-label="快速預填">
        <span class="trip-prefill-label">快速預填</span>
        <div class="trip-prefill-btns">
          ${shift && shiftRecorded
            ? `<button type="button" class="btn btn-line btn-sm trip-pre-btn is-recorded" data-trip-recorded disabled>呢班已經記咗（${fmtTime(shift.start)}–${fmtTime(shift.end)}）</button>`
            : `${shift ? `<button type="button" class="btn btn-soft btn-sm trip-pre-btn" data-action="trip-prefill" data-mode="all">照班表＋上次通勤</button>` : ''}${shift ? `<button type="button" class="btn btn-line btn-sm trip-pre-btn" data-action="trip-prefill" data-mode="shift">只填班表 ${fmtTime(shift.start)}–${fmtTime(shift.end)}</button>` : ''}`}
          <button type="button" class="btn btn-line btn-sm trip-pre-btn" data-action="trip-prefill" data-mode="commute" data-trip-commute-btn${!hasWorkTimes ? ' disabled' : ''}>${tpl.hasHistory ? '通勤同上次一樣' : '用預設通勤時間'}</button>
        </div>
        ${sh.prefillNote ? `<p class="fine trip-prefill-note" role="status">${esc(sh.prefillNote)}</p>` : ''}
      </div>`
    : '';

  const allVerified = tripAllVerified(st.trip);
  const verified = sh.verified !== undefined ? sh.verified : allVerified;
  const wdNote = st.workday !== sh.wd ? ` · 計入 ${wdOfKey(st.workday)} ${fmtMD(st.workday)}` : '';
  const jobPicker = data.jobs.length > 1
    ? `<div class="trip-job-row" role="group" aria-label="這趟的工作"><span class="trip-group-name">工作</span><div class="trip-tabs">${data.jobs.map((j) => `<button type="button" class="chip-btn" data-action="trip-job" data-job="${esc(j.id)}" aria-pressed="${j.id === curJobId}"><i class="sw k-${j.color === 'deliv' ? 'deliv' : 'work'}"></i> ${esc(j.name)}${j.payMode === 'perOrder' ? ' · 按單' : ''}</button>`).join('')}</div></div>`
    : '';

  return sheetWrap(st.exists ? '整趟修改' : '補一整趟', `<form class="form trip-form" data-form="trip">
      <div class="trip-dates">
        <div class="day-nav trip-nav"><button type="button" class="icon-btn" data-action="trip-day" data-dir="-1" aria-label="前一個工作日">${icon('left', 18, 2)}</button><div class="day-nav-text"><strong>${wdOfKey(sh.wd)}工作日 · ${fmtMD(sh.wd)}</strong><span>${st.exists ? '修改這一趟' : '新的一趟'}${wdNote}</span></div><button type="button" class="icon-btn" data-action="trip-day" data-dir="1" aria-label="下一個工作日">${icon('right', 18, 2)}</button></div>
        <label class="field trip-date${sh.anchorShifted ? ' is-shifted' : ''}" data-trip-anchor-wrap><span>實際日期（第一格那天）</span><input type="date" name="anchor" value="${st.anchor}" data-action="trip-anchor">${sh.anchorShifted && sh.anchorShiftNote ? `<small class="trip-shift-note" role="status">${esc(sh.anchorShiftNote)}</small>` : ''}</label>
      </div>
      ${tabs}
      ${st.suggest ? `<div class="sheet-note trip-fix" role="status"><span>這一趟實際由 <strong>${wdOfKey(st.suggest)} ${fmtMD(st.suggest)}</strong> 開始，但現在計入 <strong>${wdOfKey(st.workday)} ${fmtMD(st.workday)}</strong> 工作日——多數是中間睡了覺沒有記。</span><button type="button" class="btn btn-ink btn-sm" data-action="trip-wdfix" data-wd="${st.suggest}">改為計入 ${wdOfKey(st.suggest)} ${fmtMD(st.suggest)}</button></div>` : ''}
      ${st.repaired.length ? `<div class="sheet-note trip-fix" role="status" data-trip-repair><span>原本記低的日期次序不對：${st.rows.filter((r) => r.repaired).map((r) => `「${TRIP_LABEL[r.step]}」記成 <strong>${wdOf(r.was)} ${fmtMD(dateKey(r.was))}</strong>，已按次序改成 <strong>${wdOf(r.t)} ${fmtMD(dateKey(r.t))}</strong>`).join('；')}。看看下面每格的日期，沒問題就按「儲存整趟」修正。</span></div>` : ''}
      <div class="trip-bar">
        ${jobPicker}
        ${prefillBar}
      </div>
      <p class="fine trip-tip">直打 4 位數（如 2100）或點時鐘選時間；過了午夜會自動算隔天。</p>
      ${track}
      <fieldset data-trip-pay ${payMode !== 'perOrder' ? 'hidden' : ''}><legend>收入／單數</legend>${incomeFields(sh.pay || st.trip.session || {})}</fieldset>
      <div class="trip-extras">
        <label class="verify-toggle"><input type="checkbox" name="verified"${verified ? ' checked' : ''}><span class="verify-box" aria-hidden="true">${icon('check', 14, 3.2)}</span><span class="verify-text"><strong>已對照追蹤 App</strong><small>上面的日期和時間都一樣</small></span></label>
        <details class="more"${sh.wdTo ? ' open' : ''}><summary>進階：計入另一個工作日</summary>
          <label class="field"><span>這一趟算哪一個工作日</span><input type="date" name="wdTo" value="${st.workday}" data-action="trip-wdto"></label>
          <p class="fine">平時不用改。只有這班明明屬於另一天（例如過了午夜才出門）才需要。</p></details>
        ${st.exists ? `<button type="button" class="btn btn-text-danger btn-block trip-del-btn" data-action="trip-delete">刪除這一趟</button>` : ''}
      </div>
      <div class="sheet-foot qw-foot trip-foot"><div class="cross-note trip-sum" data-trip-sum aria-live="polite">${tripSummaryHTML(st, { prefilled: sh.prefilled })}</div><button class="btn btn-ink btn-block btn-lg trip-submit" type="submit">儲存整趟</button></div>
    </form>`, false, 'sheet-trip');
}

// 「＋」打開的選單：先揀要補哪一類，不用一開始就面對一長串步驟。
function addMenuSheet(ctx) {
  const { ui } = ctx;
  const wd = ui.sheet.wd;
  const item = (action, attrs, ic, kind, title, sub) => `<button type="button" class="add-item" data-action="${action}"${attrs}>${bubble(ic, kind, { size: 'lg', iconSize: 20 })}<span><strong>${title}</strong><small>${sub}</small></span>${icon('right', 18, 2)}</button>`;
  return sheetWrap('新增／補記', `<div class="add-menu">
      ${item('open-trip', ` data-wd="${wd}"`, 'bag', 'work', '返工＋通勤（整趟）', '出門、上車、抵達、上班、下班、到家一次過填')}
      ${item('quick-wake', '', 'sun', 'sleep', '睡眠', '啱啱瞓醒，或者補之前嗰覺')}
      ${item('quick-meal', '', 'meal', 'meal', '用餐', '一撳記低現在，之後可以改時間')}
      ${item('rest-open', ` data-wd="${wd}" data-step="rest"`, 'cup', 'commute', '休息', '補一段休息')}
    </div>
    <h3 class="add-sub-title">其他補記方式</h3>
    <div class="add-sub">
      <button type="button" class="add-sub-row" data-action="open-record" data-wd="${wd}" data-step="meal">${icon('calendar', 18, 2)}<span>補舊的一餐，或者安排之後的一餐</span>${icon('right', 16, 2)}</button>
      <button type="button" class="add-sub-row" data-action="open-record" data-wd="${wd}" data-step="clockIn">${icon('edit', 18, 2)}<span>逐項補登：交通、上車地點、個別時間</span>${icon('right', 16, 2)}</button>
    </div>`);
}

// ---------- 一撳就記的小面板 ----------
const whenText = (t) => `${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}`;

// 「我瞓醒喇」存之前的確認行：真實日期、瞓咗幾耐、計入邊個工作日，一行睇晒。
export function quickWakePreview(data, st) {
  if (st.error === 'no-start') return `<span class="muted">${QUICK_WAKE_ERROR['no-start']}</span>`;
  if (st.error) return `<span class="c-danger">${QUICK_WAKE_ERROR[st.error] || '這個時間存不到'}</span>`;
  const rec = { ...(st.open || {}), id: st.open?.id || '_preview', start: st.start, end: st.wake };
  const wk = sleepWorkday(rec, { ...data, sleeps: [...data.sleeps.filter((x) => x.id !== rec.id), rec] });
  const ms = st.wake - st.start;
  const after = ms >= MAIN_SLEEP_MS ? `<br>起身之後開始 <strong>${wdOfKey(dayKeyOfWake(st.wake))} ${fmtMD(dayKeyOfWake(st.wake))}</strong> 工作日` : '';
  const long = ms > 14 * 60 * MIN ? '<br><span class="c-danger">瞓咗超過 14 個鐘，時間啱唔啱？</span>' : '';
  return `<span class="nw"><strong>${whenText(st.start)}</strong> 瞓</span> → <span class="nw"><strong>${whenText(st.wake)}</strong> 起身</span><br>瞓咗 <strong>${fmtDurLong(ms)}</strong> · 計入 <strong>${wdOfKey(wk)} ${fmtMD(wk)}</strong> 工作日${after}${long}`;
}

// 起身時間、入睡時間的快捷掣（畫面和打字時即時更新共用）。
export function quickWakeChips(st, now) {
  const wake = WAKE_AGO.map(([key, min, label]) => ({ key, label, sub: fmtTime(now - min * MIN), on: st.wakeSel === key }));
  const start = st.options.map((o) => ({ key: o.key, label: o.label, sub: fmtTime(o.t), on: st.startSel === o.key, disabled: !!o.disabled, dur: o.dur != null }));
  return { wake, start };
}

function quickWakeSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const st = quickWakeState(data, now, sh);
  const chips = quickWakeChips(st, now);
  const chip = (action, c) => `<button type="button" class="qw-chip" data-action="${action}" data-key="${c.key}" aria-pressed="${c.on}"${c.disabled ? ' disabled' : ''}><strong>${c.label}</strong><small>${c.sub}</small></button>`;
  const guess = chips.start.filter((c) => !c.dur);
  const durs = chips.start.filter((c) => c.dur);
  const startBlock = st.open
    ? `<div class="saved-note"><span>入睡時間已經記低</span><strong>${whenText(st.open.start)}</strong></div>`
    : `<div class="sheet-step-title"><span class="step-no">2</span>大概幾點瞓？</div>
      ${guess.length ? `<div class="qw-chips">${guess.map((c) => chip('qw-start', c)).join('')}</div>` : ''}
      <span class="chip-group-name">或者揀瞓咗幾耐</span>
      <div class="qw-chips qw-durs">${durs.map((c) => chip('qw-start', c)).join('')}</div>
      <label class="field"><span>或者自己打入睡時間（日期自動計）</span><input type="time" name="startTime" value="${esc(sh.startSel === 'custom' ? sh.startTime || '' : '')}"></label>`;
  return sheetWrap('我瞓醒喇', `<form class="form" data-form="quick-wake">
      <div class="sheet-step-title"><span class="step-no">1</span>幾時起身？</div>
      <div class="qw-chips qw-wakes">${chips.wake.map((c) => chip('qw-wake', c)).join('')}</div>
      <label class="field"><span>或者自己打起身時間（日期自動計）</span><input type="time" name="wakeTime" value="${esc(st.wakeSel === 'custom' ? sh.wakeTime || '' : '')}"></label>
      ${startBlock}
      ${st.open ? '' : '<button type="button" class="btn btn-text btn-block" data-action="open-record" data-step="sleepPair">要補更早嘅睡眠？用完整表格</button>'}
      <div class="sheet-foot qw-foot"><div class="cross-note qw-preview" data-qw-preview aria-live="polite">${quickWakePreview(data, st)}</div><button class="btn btn-ink btn-block btn-lg" type="submit">存低</button></div>
    </form>`);
}

// 「食咗飯」之後的小面板：唔係啱啱食就揀幾耐之前；餐名相片想加先加。
export const MEAL_AGO = [[0, '啱啱'], [15, '15 分鐘前'], [30, '半個鐘前'], [60, '1 個鐘前'], [120, '2 個鐘前'], [180, '3 個鐘前']];
export function mealMovePreview(hhmm, now) {
  const t = hhmm ? lastClockBefore(hhmm, now, { inclusive: true }) : null;
  return t == null ? '' : `會改成 <strong>${whenText(t)}</strong>`;
}
function mealQuickSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const m = data.meals.find((x) => x.id === sh.id);
  if (!m) return '';
  const base = sh.base ?? m.start;
  const wk = mealWorkday(m, data, now);
  const chips = MEAL_AGO.map(([min, label]) => {
    const t = base - min * MIN;
    return `<button type="button" class="qw-chip" data-action="meal-shift" data-min="${min}" aria-pressed="${m.start === t}"><strong>${label}</strong><small>${fmtTime(t)}</small></button>`;
  }).join('');
  return sheetWrap('這一餐', `<div class="saved-note is-meal" role="status"><span>已記低一餐</span><strong>${whenText(m.start)}</strong><span>計入 ${wdOfKey(wk)} ${fmtMD(wk)} 工作日</span></div>
    <div class="sheet-step-title">唔係啱啱食？</div>
    <div class="qw-chips">${chips}</div>
    <form class="form" data-form="meal-move"><input type="hidden" name="id" value="${esc(m.id)}">
      <label class="field"><span>或者自己打時間（日期自動計）</span><input type="time" name="time" required></label>
      <div class="cross-note" data-mm-preview aria-live="polite"></div>
      <button class="btn btn-line btn-block" type="submit">改做這個時間</button>
    </form>
    ${m.photo ? `<img class="photo-preview" src="${esc(m.photo)}" alt="這一餐的相片">` : ''}
    <div class="btn-pair">
      <label class="btn btn-soft file-btn">${icon('camera', 17, 2)}${m.photo ? '換張相片' : '順手加相片'}<input type="file" accept="image/*" data-action="meal-quick-photo" data-id="${esc(m.id)}" hidden></label>
      <button type="button" class="btn btn-soft" data-action="meal-open" data-id="${esc(m.id)}">加餐名、地點</button>
    </div>
    <button type="button" class="btn btn-text-danger btn-block" data-action="meal-delete" data-id="${esc(m.id)}">撳錯咗？刪除這一餐</button>
    <div class="sheet-foot"><button type="button" class="btn btn-ink btn-block btn-lg" data-action="close-sheet">得喇</button></div>`);
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

// 一次過補返近幾日缺漏的睡眠（按工作日列出，起床早過入睡自動算隔天，單次寫入可整批復原）。
function sleepCatchupSheet(ctx) {
  const { data, now, ui } = ctx;
  const sh = ui.sheet;
  const rows = sh.rows || missingSleepDays(data, now, 7);
  if (!rows.length) {
    return sheetWrap('補返近幾日睡眠', '<p class="muted">近七個工作日都已經有睡眠紀錄。</p><div class="sheet-foot"><button type="button" class="btn btn-ink btn-block btn-lg" data-action="close-sheet">得喇</button></div>');
  }
  const focusWd = sh.focusWd || null;
  const items = rows.map((r, i) => {
    // 預設全部唔剔（除非係喺睡眠頁特登點某一日灰柱入嚟），避免唔小心一次過存晒估出嚟嘅時間。
    const on = focusWd ? r.wd === focusWd : false;
    const ed = sleepEndKey(r.sd, r.st, r.et);
    const start = fromInputs(r.sd, normTime(r.st) || '');
    const end = ed && r.et ? fromInputs(ed, normTime(r.et) || '') : null;
    const prev = sleepPairPreview(data, start, end, { now });
    return `<div class="cu-row${on ? '' : ' is-off'}" data-cu-row="${i}">
      <label class="cu-head"><input type="checkbox" name="use_${i}"${on ? ' checked' : ''}><strong>${wdOfKey(r.wd)} ${fmtMD(r.wd)} 工作日</strong><span class="muted small">${on ? '核對或改鐘數' : '剔咗先會存低'}</span></label>
      <div class="cu-fields">
        <label class="field"><span>入睡那天</span><input type="date" name="sd_${i}" value="${esc(r.sd)}"></label>
        <label class="field"><span>入睡</span><input type="time" name="st_${i}" value="${esc(r.st)}"></label>
        <label class="field"><span>起床</span><input type="time" name="et_${i}" value="${esc(r.et)}"></label>
      </div>
      <div class="cross-note cu-preview" data-cu-preview="${i}" aria-live="polite">${prev}</div>
    </div>`;
  }).join('');
  const checkedCount = focusWd ? rows.filter((r) => r.wd === focusWd).length : 0;
  return sheetWrap('補返近幾日睡眠', `<form class="form cu-form" data-form="sleep-catchup" data-cu-count="${rows.length}">
      <p class="fine">下面鐘數只係參考；記得邊日就逐日剔選再改時間，起床早過入睡會自動算隔天。存低後可以一鍵「復原」。</p>
      <div class="cu-list">${items}</div>
      <div class="sheet-foot"><button class="btn btn-ink btn-block btn-lg" type="submit" data-cu-submit${checkedCount ? '' : ' disabled'}>${checkedCount ? `一次存低 ${checkedCount} 筆睡眠` : '請先剔選要補的日子'}</button></div>
    </form>`, false);
}

export function sheetView(ctx) {
  const sh = ctx.ui.sheet;
  if (!sh) return '';
  const extra = planningSheet(ctx,sheetWrap);
  if (extra) return extra;
  if (sh.type === 'rest-only') return sheetWrap('補記休息',restForm(ctx,sh.wd));
  if (sh.type === 'sleep-catchup') return sleepCatchupSheet(ctx);
  if (sh.type === 'sync') return syncSheet(ctx);
  if (sh.type === 'trip') return tripSheet(ctx);
  if (sh.type === 'add-menu') return addMenuSheet(ctx);
  if (sh.type === 'quick-wake') return quickWakeSheet(ctx);
  if (sh.type === 'meal-quick') return mealQuickSheet(ctx);
  if (sh.type === 'sleep') return sleepSheet(ctx);
  if (sh.type === 'meal') return mealSheet(ctx);
  if (sh.type === 'expected-end') return expectedEndSheet(ctx);
  if (sh.type === 'record') return recordSheet(ctx);
  if (sh.type === 'ref') return refSheet(ctx);
  if (sh.type === 'confirm') return confirmSheet(ctx);
  return '';
}
