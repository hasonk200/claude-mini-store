// 2.42 整趟面板重新設計測試：預填（跨午夜、午夜前調日期、連續兩晚夜班、夏令時間）、
// 未改過預填格數確認、單一「現在」掣、兩點即時時長、清雜訊與外送收摺通勤。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at, HOUR, MIN, fmtTime } from '../js/time.js';
import { STEPS, tripState, resolveTrip, checkTrip } from '../js/logic.js';
import { saveTrip } from '../js/actions.js';
import { tripPrefill, shiftTripPrefill, tripCommuteTemplate, tripNowStep, tripStepGaps } from '../js/planning.js';
import { sheetView, tripSummaryHTML } from '../js/views/sheet.js';

const fresh = (d = {}) => replaceAll({ ...emptyData(), ...d }, { tombstone: false });
const jobW = { id: 'jw', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 };
const jobD = { id: 'jd', name: '外送', color: 'deliv', payMode: 'perOrder', rate: null };
const ses = (id, a, b, extra = {}) => ({ id, jobId: 'jw', shiftId: null, start: a, end: b, breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null, note: '', ...extra });

test('預填（跨午夜夜班 21:00–09:00）：照班表＋上次通勤一次填齊 7 格，交回 resolveTrip 零誤差', () => {
  fresh({
    jobs: [jobW, jobD],
    sessions: [ses('s0', at('2026-11-16', '21:00'), at('2026-11-17', '09:00'))],
    journeys: [{
      id: 'j0', sessionId: 's0',
      out: at('2026-11-16', '20:14'), ride: at('2026-11-16', '20:23'), arrive: at('2026-11-16', '20:49'),
      ride2: at('2026-11-17', '09:12'), home: at('2026-11-17', '09:54')
    }],
    shifts: [{ id: 'sh1', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00') }]
  });
  const now = at('2026-11-18', '13:00');
  const d = get();
  const sh = { type: 'trip', wd: '2026-11-17', isNew: true };
  const res = tripPrefill(d, sh, now, 'all');
  assert.equal(res.ok, true);
  assert.equal(res.anchorShifted, false);
  assert.equal(res.anchor, '2026-11-17');
  assert.deepEqual(res.filledSteps.sort(), [...STEPS].sort());
  assert.equal(res.vals.out, '20:14');
  assert.equal(res.vals.ride, '20:23');
  assert.equal(res.vals.arrive, '20:49');
  assert.equal(res.vals.clockIn, '21:00');
  assert.equal(res.vals.clockOut, '09:00');
  assert.equal(res.vals.ride2, '09:12');
  assert.equal(res.vals.home, '09:54');

  // 交回原本 tripState / resolveTrip / checkTrip，結果完全吻合
  const st = tripState(d, { ...sh, vals: res.vals, anchor: res.anchor }, now);
  assert.equal(st.error, null);
  assert.equal(st.times.out, at('2026-11-17', '20:14'));
  assert.equal(st.times.clockIn, at('2026-11-17', '21:00'));
  assert.equal(st.times.clockOut, at('2026-11-18', '09:00'));
  assert.equal(st.times.home, at('2026-11-18', '09:54'));
  assert.deepEqual(st.summary, { go: 46 * MIN, work: 12 * HOUR, back: 54 * MIN });
});

test('預填（凌晨 00:15 開工推前到前一日 23:29 出門）：主動回報實際日期已調前並顯示提示，絕唔靜靜雞改', () => {
  fresh({
    jobs: [jobW],
    sessions: [ses('s0', at('2026-11-16', '21:00'), at('2026-11-17', '05:00'))],
    journeys: [{ id: 'j0', sessionId: 's0', out: at('2026-11-16', '20:14'), ride: null, arrive: at('2026-11-16', '20:49'), ride2: null, home: at('2026-11-17', '05:45') }],
    shifts: [{ id: 'sh1', jobId: 'jw', start: at('2026-11-18', '00:15'), end: at('2026-11-18', '08:15') }]
  });
  const now = at('2026-11-18', '13:00');
  const d = get();
  const sh = { type: 'trip', wd: '2026-11-18', isNew: true };
  const res = tripPrefill(d, sh, now, 'all');
  assert.equal(res.ok, true);
  assert.equal(res.anchorShifted, true);
  assert.equal(res.anchorShiftFrom, '2026-11-18');
  assert.equal(res.anchor, '2026-11-17');
  assert.match(res.anchorShiftNote, /11\/17/);
  assert.equal(res.vals.out, '23:29');
  assert.equal(res.vals.clockIn, '00:15');

  const nextSh = { ...sh, vals: res.vals, anchor: res.anchor, anchorShifted: res.anchorShifted, anchorShiftNote: res.anchorShiftNote, prefilled: res.filledSteps };
  const st = tripState(d, nextSh, now);
  assert.equal(st.error, null);
  assert.equal(st.times.out, at('2026-11-17', '23:29'));
  assert.equal(st.times.clockIn, at('2026-11-18', '00:15'));
  assert.equal(st.times.clockOut, at('2026-11-18', '08:15'));
  assert.equal(st.times.home, at('2026-11-18', '09:00'));

  const html = sheetView({ data: d, now, ui: { sheet: nextSh } });
  assert.match(html, /class="field trip-date is-shifted"/);
  assert.match(html, /name="anchor" value="2026-11-17"/);
  assert.match(html, /已自動調前至/);
});

test('預填（進行中夜班）：未到嘅收工同回程時間自動留空，唔會一撳就報紅字', () => {
  fresh({
    jobs: [jobW],
    sessions: [ses('s0', at('2026-11-16', '21:00'), at('2026-11-17', '09:00'))],
    journeys: [{ id: 'j0', sessionId: 's0', out: at('2026-11-16', '20:15'), home: at('2026-11-17', '09:45') }],
    shifts: [{ id: 'sh1', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00') }]
  });
  const now = at('2026-11-18', '02:00');
  const d = get();
  const sh = { type: 'trip', wd: '2026-11-17', isNew: true };
  const res = tripPrefill(d, sh, now, 'all');
  assert.equal(res.ok, true);
  assert.equal(res.vals.out, '20:15');
  assert.equal(res.vals.clockIn, '21:00');
  assert.equal(res.vals.clockOut, '');
  assert.equal(res.vals.home, '');
  assert.ok(res.skippedFuture.includes('clockOut'));
  const st = tripState(d, { ...sh, vals: res.vals, anchor: res.anchor }, now);
  assert.equal(st.error, null);
});

test('預填（連續兩晚夜班）：週二揀啱週二班表，唔會撈錯週一朝早收工，亦唔會覆寫已手動輸入時間', () => {
  fresh({
    jobs: [jobW],
    sessions: [ses('s1', at('2026-11-16', '21:00'), at('2026-11-17', '09:00'))],
    journeys: [{ id: 'j1', sessionId: 's1', out: at('2026-11-16', '20:10'), ride: at('2026-11-16', '20:20'), arrive: at('2026-11-16', '20:48'), ride2: at('2026-11-17', '09:10'), home: at('2026-11-17', '09:50') }],
    shifts: [
      { id: 'sh1', jobId: 'jw', start: at('2026-11-16', '21:00'), end: at('2026-11-17', '09:00') },
      { id: 'sh2', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00') }
    ]
  });
  const now = at('2026-11-18', '13:00');
  const d = get();
  // 先手動填實際遲咗 15 分鐘收工（09:15），再撳「通勤同上次一樣」
  const sh = { type: 'trip', wd: '2026-11-17', isNew: true, vals: { out: '', ride: '', arrive: '', clockIn: '21:00', clockOut: '09:15', ride2: '', home: '' } };
  const res = tripPrefill(d, sh, now, 'commute');
  assert.equal(res.ok, true);
  assert.equal(res.vals.clockIn, '21:00');
  assert.equal(res.vals.clockOut, '09:15'); // 保留手動改過嘅下班時間
  assert.equal(res.vals.out, '20:10');
  assert.equal(res.vals.ride2, '09:25'); // 跟 09:15 + 10m
  assert.equal(res.vals.home, '10:05');  // 跟 09:15 + 50m

  const st = tripState(d, { ...sh, vals: res.vals, anchor: res.anchor }, now);
  assert.equal(st.error, null);
  assert.equal(saveTrip({ wd: '2026-11-17', times: st.times }, now).ok, true);
  assert.equal(get().sessions.length, 2);
});

test('預填（多倫多夏令時間 DST 春季少 1 鐘 & 秋季多 1 鐘）：用真實毫秒差推算，絕唔會生出唔存在嘅 02:30', () => {
  // 1) 春季跳鐘 2026-03-08 02:00 → 03:00：
  // 假設上班喺 03:15，上次去程係 45 分鐘前 → 真實 45 分鐘前係 01:30（跳過唔存在嘅 02:30）！
  fresh({
    jobs: [jobW],
    sessions: [ses('sPrev', at('2026-03-06', '21:00'), at('2026-03-07', '07:00'))],
    journeys: [{ id: 'jPrev', sessionId: 'sPrev', out: at('2026-03-06', '20:15'), home: at('2026-03-07', '07:40') }],
    shifts: [
      { id: 'shSpringNight', jobId: 'jw', start: at('2026-03-07', '21:00'), end: at('2026-03-08', '07:00') },
      { id: 'shSpringGap', jobId: 'jw', start: at('2026-03-08', '03:15'), end: at('2026-03-08', '11:15') }
    ]
  });
  const nowSpring = at('2026-03-08', '15:00');
  const d1 = get();
  const rNight = tripPrefill(d1, { type: 'trip', wd: '2026-03-07', isNew: true }, nowSpring, 'all');
  assert.equal(rNight.ok, true);
  const stNight = tripState(d1, { wd: '2026-03-07', isNew: true, vals: rNight.vals, anchor: rNight.anchor }, nowSpring);
  assert.equal(stNight.error, null);
  assert.equal(stNight.times.clockOut - stNight.times.clockIn, 9 * HOUR); // 春季 21:00→07:00 實得 9 小時
  assert.equal(stNight.summary.go, 45 * MIN);
  assert.equal(stNight.summary.back, 40 * MIN);

  // 03:15 上班前 45 分鐘 → 01:30（唔係唔存在嘅 02:30）
  const rGap = tripPrefill(d1, { type: 'trip', wd: '2026-03-08', isNew: true }, nowSpring, 'all');
  assert.equal(rGap.ok, true);
  assert.equal(rGap.vals.out, '01:30');
  const stGap = tripState(d1, { wd: '2026-03-08', isNew: true, vals: rGap.vals, anchor: rGap.anchor }, nowSpring);
  assert.equal(stGap.error, null);
  assert.equal(stGap.times.clockIn - stGap.times.out, 45 * MIN);

  // 2) 秋季回撥 2026-11-01 02:00 重複兩次：21:00→07:00 實得 11 小時，通勤一樣準確
  fresh({
    jobs: [jobW],
    sessions: [ses('sOct', at('2026-10-30', '21:00'), at('2026-10-31', '07:00'))],
    journeys: [{ id: 'jOct', sessionId: 'sOct', out: at('2026-10-30', '20:14'), home: at('2026-10-31', '07:46') }],
    shifts: [{ id: 'shFall', jobId: 'jw', start: at('2026-10-31', '21:00'), end: at('2026-11-01', '07:00') }]
  });
  const nowFall = at('2026-11-01', '12:00');
  const d2 = get();
  const rFall = tripPrefill(d2, { type: 'trip', wd: '2026-10-31', isNew: true }, nowFall, 'all');
  assert.equal(rFall.ok, true);
  assert.equal(rFall.vals.out, '20:14');
  assert.equal(rFall.vals.home, '07:46');
  const stFall = tripState(d2, { wd: '2026-10-31', isNew: true, vals: rFall.vals, anchor: rFall.anchor }, nowFall);
  assert.equal(stFall.error, null);
  assert.equal(stFall.times.clockOut - stFall.times.clockIn, 11 * HOUR);
  assert.equal(stFall.summary.go, 46 * MIN);
  assert.equal(stFall.summary.back, 46 * MIN);
});

test('底部確認：顯示實際起止日期、計入工作日，並寫明幾多格係預填未改過', () => {
  fresh({ jobs: [jobW] });
  const now = at('2026-11-18', '13:00');
  const vals = { out: '20:14', ride: '20:23', arrive: '20:49', clockIn: '21:00', clockOut: '09:00', ride2: '09:12', home: '09:54' };
  const st = tripState(get(), { wd: '2026-11-17', isNew: true, vals }, now);

  const htmlAllPre = tripSummaryHTML(st, { prefilled: [...STEPS] });
  assert.match(htmlAllPre, /週二 11\/17 20:14 → 週三 11\/18 09:54/);
  assert.match(htmlAllPre, /計入 <strong>週二 11\/17 工作日<\/strong>/);
  assert.match(htmlAllPre, /7 格入面 7 格係預填/);

  // 改咗其中 2 格（clockOut, home）後 → 變「7 格入面 5 格係預填」
  const html5Pre = tripSummaryHTML(st, { prefilled: ['out', 'ride', 'arrive', 'clockIn', 'ride2'] });
  assert.match(html5Pre, /7 格入面 5 格係預填/);

  // 全部改完後 → 唔再顯示預填提示
  const htmlNone = tripSummaryHTML(st, { prefilled: [] });
  assert.doesNotMatch(htmlNone, /格係預填/);
});

test('「現在」掣：補舊日子完全唔出；只有今日進行中嗰趟喺下一格未填出現一粒', () => {
  const now = at('2026-11-18', '22:30');
  fresh({
    jobs: [jobW],
    sleeps: [{ id: 'sl1', start: at('2026-11-18', '10:00'), end: at('2026-11-18', '17:00') }],
    sessions: [ses('sToday', at('2026-11-18', '21:00'), null)],
    journeys: [{ id: 'jToday', sessionId: 'sToday', out: at('2026-11-18', '20:15') }]
  });
  const d = get();

  // 補舊日子（11/15）：0 粒「現在」掣
  const oldSh = { type: 'trip', wd: '2026-11-15', isNew: true };
  assert.equal(tripNowStep(d, oldSh, tripState(d, oldSh, now), now), null);
  const oldHtml = sheetView({ data: d, now, ui: { sheet: oldSh } });
  assert.equal((oldHtml.match(/data-action="trip-now"/g) || []).length, 0);

  // 今日進行中（已出門＋已上班，下一格未填係下班）：只喺 clockOut 出現 1 粒「現在」掣
  const curSh = { type: 'trip', wd: '2026-11-18', sessionId: 'sToday' };
  const curSt = tripState(d, curSh, now);
  assert.equal(tripNowStep(d, curSh, curSt, now), 'clockOut');
  const curHtml = sheetView({ data: d, now, ui: { sheet: curSh } });
  assert.equal((curHtml.match(/data-action="trip-now"/g) || []).length, 1);
  assert.match(curHtml, /data-action="trip-now" data-step="clockOut"/);
});

test('介面潔淨度與階層：保留雙日期頂部、無「未填／例如 1830」、兩點即時時長支援跳格、外送預設收摺通勤', () => {
  fresh({ jobs: [jobW, jobD] });
  const now = at('2026-11-18', '13:00');
  const d = get();

  // 空表單：保留雙日期、無「未填」、無「例如 1830」
  const emptyHtml = sheetView({ data: d, now, ui: { sheet: { type: 'trip', wd: '2026-11-17', isNew: true } } });
  assert.match(emptyHtml, /週二工作日 · 11\/17/);
  assert.match(emptyHtml, /name="anchor" value="2026-11-17"/);
  assert.doesNotMatch(emptyHtml, />未填</);
  assert.doesNotMatch(emptyHtml, /例如 1830/);

  // 跳格填（只填出門 20:10、上班 21:00、下班 09:00、到家 09:45）→ 兩點之間照計到 50m / 12h / 45m
  const skipSt = tripState(d, { wd: '2026-11-17', isNew: true, vals: { out: '20:10', ride: '', arrive: '', clockIn: '21:00', clockOut: '09:00', ride2: '', home: '09:45' } }, now);
  const gaps = tripStepGaps(skipSt);
  assert.equal(gaps.clockIn.ms, 50 * MIN);
  assert.equal(gaps.clockIn.skipped, true);
  assert.equal(gaps.clockOut.ms, 12 * HOUR);
  assert.equal(gaps.home.ms, 45 * MIN);

  // 按單外送無通勤紀錄 → 預設收摺通勤，但 7 格 input 仍在 DOM
  const delivHtml = sheetView({ data: d, now, ui: { sheet: { type: 'trip', wd: '2026-11-17', isNew: true, jobId: 'jd' } } });
  assert.match(delivHtml, /is-commute-collapsed/);
  assert.match(delivHtml, /data-action="trip-commute-show"/);
  for (const k of STEPS) assert.match(delivHtml, new RegExp(`name="t_${k}"`));
});

test('預填後改下班遲 15 分鐘（09:00 → 09:15）：唔報錯，後面未改過嘅回程上車同到家跟住遲 15 分鐘；已手動改過嘅格唔郁', () => {
  fresh({
    jobs: [jobW],
    sessions: [ses('s0', at('2026-11-16', '21:00'), at('2026-11-17', '09:00'))],
    journeys: [{
      id: 'j0', sessionId: 's0',
      out: at('2026-11-16', '20:14'), ride: at('2026-11-16', '20:23'), arrive: at('2026-11-16', '20:49'),
      ride2: at('2026-11-17', '09:12'), home: at('2026-11-17', '09:54')
    }],
    shifts: [{ id: 'sh1', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00') }]
  });
  const now = at('2026-11-18', '13:00');
  const d = get();
  const baseSh = { type: 'trip', wd: '2026-11-17', isNew: true };
  const pre = tripPrefill(d, baseSh, now, 'all');
  assert.equal(pre.ok, true);
  let sh = { ...baseSh, vals: pre.vals, anchor: pre.anchor, prefilled: pre.filledSteps, prefillTimes: pre.prefillTimes };

  // 改下班 09:00 → 09:15（遲 15 分鐘）
  const s1 = shiftTripPrefill(d, sh, now, 'clockOut', { ...sh.vals, clockOut: '09:15' });
  assert.deepEqual(s1.shiftedSteps, ['ride2', 'home']);
  assert.equal(s1.vals.clockOut, '09:15');
  assert.equal(s1.vals.ride2, '09:27'); // 09:12 + 15m
  assert.equal(s1.vals.home, '10:09');  // 09:54 + 15m
  assert.equal(s1.prefilled.includes('clockOut'), false);
  assert.equal(s1.prefilled.includes('ride2'), true);
  assert.equal(s1.prefilled.includes('home'), true);

  sh = { ...sh, vals: s1.vals, prefilled: s1.prefilled, prefillTimes: s1.prefillTimes };
  const st1 = tripState(d, sh, now);
  assert.equal(st1.error, null);
  assert.equal(st1.times.clockOut, at('2026-11-18', '09:15'));
  assert.equal(st1.times.ride2, at('2026-11-18', '09:27'));
  assert.equal(st1.times.home, at('2026-11-18', '10:09'));
  assert.match(tripSummaryHTML(st1, { prefilled: sh.prefilled }), /7 格入面 6 格係預填/);

  // 再手動改「到家」做 10:20（脫離預填），之後再改下班遲 10 分鐘（09:15 → 09:25）
  const s2 = shiftTripPrefill(d, sh, now, 'home', { ...sh.vals, home: '10:20' });
  sh = { ...sh, vals: s2.vals, prefilled: s2.prefilled, prefillTimes: s2.prefillTimes };
  assert.equal(sh.prefilled.includes('home'), false);

  const s3 = shiftTripPrefill(d, sh, now, 'clockOut', { ...sh.vals, clockOut: '09:25' });
  assert.deepEqual(s3.shiftedSteps, ['ride2']); // 只移仲係預填嘅 ride2
  assert.equal(s3.vals.ride2, '09:37'); // 09:27 + 10m
  assert.equal(s3.vals.home, '10:20');  // 手動改過嘅到家保持 10:20 唔郁！
  const st3 = tripState(d, { ...sh, vals: s3.vals, prefilled: s3.prefilled, prefillTimes: s3.prefillTimes }, now);
  assert.equal(st3.error, null);
});

test('工作日嗰班已經有出勤紀錄時，「新一趟」預填掣變灰並寫「呢班已經記咗」，且不可再預填該班', () => {
  fresh({
    jobs: [jobW, jobD],
    sessions: [ses('s1', at('2026-11-17', '20:58'), at('2026-11-18', '09:04'))],
    shifts: [{ id: 'sh1', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00') }]
  });
  const now = at('2026-11-18', '13:00');
  const d = get();

  // 開啟「新一趟」
  const newSh = { type: 'trip', wd: '2026-11-17', isNew: true };
  const res = tripPrefill(d, newSh, now, 'all');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'shift-recorded');
  assert.equal(tripPrefill(d, newSh, now, 'shift').reason, 'shift-recorded');

  const html = sheetView({ data: d, now, ui: { sheet: newSh } });
  assert.match(html, /data-trip-recorded disabled>呢班已經記咗/);
  assert.doesNotMatch(html, /data-action="trip-prefill" data-mode="all"/);
  assert.doesNotMatch(html, /data-action="trip-prefill" data-mode="shift"/);
});
