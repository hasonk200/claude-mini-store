// PR B（2.40.0）測試：
// 1. H6 獨立休息 1 分鐘內撳結束自動取消（含復原）
// 2. H2 整趟面板選工作（未排班記外送＋收入、既有紀錄快照不受影響）
// 3. H3 掛住舊旅程提示＋自動備份與復原、>=48h 提醒改天數、時間帶顯示獨立通勤不動計算法、
//    批次追補多日睡眠（跨午夜、連續兩晚夜班、夏令時間、整批復原、擋重疊）
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replaceAll, get, getRaw, visible, emptyData, undo } from '../js/store.js';
import { toggleRest, saveTrip, tripJobId, tripPayMode, saveSleepBatch } from '../js/actions.js';
import { activeRest, currentCycle, intervalsAround, calendarAllocation, sleepWorkday } from '../js/logic.js';
import { reminders, staleJourney, missingSleepDays, clockRange } from '../js/planning.js';
import { bandItems, dayBand } from '../js/views/shared.js';
import { sleepEndKey } from '../js/views/sleep.js';
import { sheetView } from '../js/views/sheet.js';
import { at, MIN, HOUR, DAY, dateKey, fromInputs } from '../js/time.js';

const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const nightJob = { id: 'j_night', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 22 };
const delivJob = { id: 'j_deliv', name: '外送', color: 'deliv', payMode: 'perOrder', rate: null };

test('H6：獨立休息 1 分鐘內再按結束當誤按取消並可復原；滿 1 分鐘正常結束', () => {
  replaceAll(emptyData(), { tombstone: false });
  const t0 = Date.parse('2026-11-18T02:00:00-05:00');
  toggleRest(t0);
  // 30 秒後按結束 → 取消
  const c30 = toggleRest(t0 + 30 * 1000);
  assert.equal(c30.canceled, true);
  assert.equal(c30.opened, false);
  assert.equal(activeRest(visible(getRaw())), null);
  assert.equal(visible(getRaw()).rests.length, 0);

  // 復原後 59 秒按結束 → 仍然取消
  assert.equal(undo(), true);
  const c59 = toggleRest(t0 + 59 * 1000);
  assert.equal(c59.canceled, true);
  assert.equal(activeRest(visible(getRaw())), null);

  // 復原後滿 60 秒按結束 → 正常結束
  assert.equal(undo(), true);
  const ok60 = toggleRest(t0 + MIN);
  assert.equal(ok60.canceled, false);
  assert.equal(ok60.opened, false);
  assert.equal(visible(getRaw()).rests[0].end, t0 + MIN);
});

test('H2：未排班時整趟選「外送」可正確儲存按單工作與收入／單數，不會誤綁倉庫排班', () => {
  const now = at('2026-11-18', '15:00');
  const d = emptyData();
  d.jobs = [nightJob, delivJob];
  // 同一天晚上有倉庫排班，但上午臨時去跑外送
  d.shifts = [{ id: 'sh_night', jobId: nightJob.id, start: at('2026-11-18', '21:00'), end: at('2026-11-19', '06:00') }];
  replaceAll(d, { tombstone: false });

  assert.equal(tripPayMode(get(), { session: null, journey: null }, '2026-11-18', at('2026-11-18', '10:00'), delivJob.id), 'perOrder');
  assert.equal(tripJobId(get(), { session: null, journey: null }, '2026-11-18', at('2026-11-18', '10:00'), delivJob.id), delivJob.id);

  // 面板選外送時，收入／單數欄位不應隱藏
  const html = sheetView({
    data: get(), now, wd: '2026-11-18', isDesktop: false,
    ui: { sheet: { type: 'trip', wd: '2026-11-18', isNew: true, jobId: delivJob.id }, drafts: {} }
  });
  assert.match(html, /data-action="trip-job"/);
  assert.match(html, /<fieldset data-trip-pay >/);

  const times = { out: at('2026-11-18', '09:45'), clockIn: at('2026-11-18', '10:00'), clockOut: at('2026-11-18', '13:30'), home: at('2026-11-18', '13:50') };
  const r = saveTrip({ wd: '2026-11-18', times, jobId: delivJob.id, pay: { income: 92.5, orders: 11 } }, now);
  assert.equal(r.ok, true);
  const s = get().sessions[0];
  assert.equal(s.jobId, delivJob.id);
  assert.equal(s.shiftId, null);
  assert.equal(s.payMode, 'perOrder');
  assert.equal(s.income, 92.5);
  assert.equal(s.orders, 11);
});

test('H2：修改既有出勤時不切工作，原本 jobId、payMode 與舊時薪快照完整保留；其他班不受影響', () => {
  const now = at('2026-11-18', '15:00');
  const d = emptyData();
  d.jobs = [nightJob, delivJob]; // nightJob 目前時薪已改為 22
  d.sessions = [
    // 舊紀錄當時時薪快照是 18
    { id: 's_old', jobId: nightJob.id, shiftId: null, start: at('2026-11-16', '21:00'), end: at('2026-11-17', '06:00'), breaks: [], payMode: 'hourly', rate: 18, income: null, orders: null, note: '' },
    { id: 's_other', jobId: delivJob.id, shiftId: null, start: at('2026-11-17', '12:00'), end: at('2026-11-17', '15:00'), breaks: [], payMode: 'perOrder', rate: null, income: 60, orders: 7, note: '' }
  ];
  replaceAll(d, { tombstone: false });

  // 只改 s_old 的下班時間，不切工作
  const r = saveTrip({
    sessionId: 's_old', wd: '2026-11-16',
    times: { clockIn: at('2026-11-16', '21:00'), clockOut: at('2026-11-17', '06:15') }
  }, now);
  assert.equal(r.ok, true);
  const oldAfter = get().sessions.find((x) => x.id === 's_old');
  assert.equal(oldAfter.jobId, nightJob.id);
  assert.equal(oldAfter.payMode, 'hourly');
  assert.equal(oldAfter.rate, 18); // 歷史時薪快照不能被覆蓋成 22
  // 另一班原封不動
  const otherAfter = get().sessions.find((x) => x.id === 's_other');
  assert.equal(otherAfter.jobId, delivJob.id);
  assert.equal(otherAfter.income, 60);
});

test('H3：掛住超過 4 小時的舊抵達旅程會觸發提示，且清除前經過自動安全備份與復原', () => {
  const now = at('2026-11-18', '13:35');
  const d = emptyData();
  d.journeys = [{ id: 'jr1', sessionId: null, out: at('2026-11-18', '01:05'), ride: null, arrive: at('2026-11-18', '01:42'), leave: null, ride2: null, home: null }];
  const cyc = currentCycle(d, now);
  const st = staleJourney(d, now, cyc);
  assert.ok(st);
  assert.equal(st.step, 'arrive');
  assert.equal(st.journey.id, 'jr1');

  // 未滿 4 小時不觸發
  assert.equal(staleJourney(d, at('2026-11-18', '05:00'), currentCycle(d, at('2026-11-18', '05:00'))), null);
  // 確認 app.js stale-clear 使用 afterRecovery（自動備份）＋ toastUndo（復原）
  assert.match(appSrc, /'stale-clear':[\s\S]*?afterRecovery\([\s\S]*?toastUndo\(/);
});

test('H3：超過 48 小時提醒改顯示天數並切到批次追補；時間帶顯示獨立通勤但不改核心計算', () => {
  const now = at('2026-11-18', '13:35');
  const d = emptyData();
  d.jobs = [nightJob];
  d.sessions = [{ id: 's0', jobId: nightJob.id, start: at('2026-11-06', '21:00'), end: at('2026-11-07', '06:00'), breaks: [], payMode: 'hourly', rate: 20 }];
  d.sleeps = [{ id: 'sl0', start: at('2026-11-07', '08:00'), end: at('2026-11-07', '15:30') }];
  d.journeys = [{ id: 'jr_alone', sessionId: null, out: at('2026-11-18', '01:05'), ride: null, arrive: at('2026-11-18', '01:42'), leave: null, ride2: null, home: null }];

  const rows = reminders(d, now);
  const slRem = rows.find((r) => r.action === 'sleep-catchup');
  assert.ok(slRem);
  assert.match(slRem.title, /已經 10 日冇記過瞓覺/);
  const homeRem = rows.find((r) => r.action === 'open-trip');
  assert.ok(homeRem);
  assert.doesNotMatch(homeRem.title, /271 小時/);
  assert.match(homeRem.title, /那班未記到家/);

  // 核心 intervalsAround 與 calendarAllocation 不動，但 bandItems / dayBand 會畫出獨立通勤
  const a = at('2026-11-18', '00:00');
  const b = at('2026-11-19', '00:00');
  assert.equal(intervalsAround(d, a, b, now).length, 0);
  assert.equal(calendarAllocation(d, '2026-11-18', now).commute, 0);
  const vis = bandItems(d, a, b, now);
  assert.equal(vis.length, 1);
  assert.equal(vis[0].kind, 'commute');
  assert.match(dayBand(d, a, b, now), /band-seg k-commute/);
});

test('H3 批次補記多日睡眠：跨午夜、連續兩晚夜班白天補睡、多倫多夏令時間、擋重疊與整批復原', () => {
  // 1) 連續兩晚夜班後白天補睡（週一夜班週二 08:00–15:30 瞓；週二夜班週三 08:30–16:00 瞓）
  const now = at('2026-11-18', '18:00');
  const d = emptyData();
  d.jobs = [nightJob];
  d.sessions = [
    { id: 's1', jobId: nightJob.id, start: at('2026-11-16', '21:00'), end: at('2026-11-17', '06:30'), breaks: [], payMode: 'hourly', rate: 22 },
    { id: 's2', jobId: nightJob.id, start: at('2026-11-17', '21:00'), end: at('2026-11-18', '06:30'), breaks: [], payMode: 'hourly', rate: 22 }
  ];
  replaceAll(d, { tombstone: false });

  const miss = missingSleepDays(get(), now, 3);
  assert.ok(miss.some((x) => x.wd === '2026-11-17'));
  assert.ok(miss.some((x) => x.wd === '2026-11-16'));

  const batch = saveSleepBatch([
    { start: at('2026-11-17', '08:00'), end: at('2026-11-17', '15:30') },
    { start: at('2026-11-18', '08:30'), end: at('2026-11-18', '16:00') }
  ], now);
  assert.equal(batch.ok, true);
  assert.equal(batch.count, 2);
  const sleeps = get().sleeps;
  assert.equal(sleepWorkday(sleeps[0], get()), '2026-11-16');
  assert.equal(sleepWorkday(sleeps[1], get()), '2026-11-17');

  // 一次復原整批撤銷
  assert.equal(undo(), true);
  assert.equal(get().sleeps.length, 0);

  // 2) 批內兩筆重疊應整批擋住，不寫入任何一筆
  const badOverlap = saveSleepBatch([
    { start: at('2026-11-17', '08:00'), end: at('2026-11-17', '15:30') },
    { start: at('2026-11-17', '14:00'), end: at('2026-11-17', '17:00') }
  ], now);
  assert.equal(badOverlap.ok, false);
  assert.equal(badOverlap.reason, 'overlap');
  assert.equal(get().sleeps.length, 0);

  // 3) 跨午夜與多倫多夏令時間（春季 2026-03-07→08 少 1h = 7h；秋季 2026-10-31→11-01 多 1h = 9h）
  replaceAll(emptyData(), { tombstone: false });
  const springEd = sleepEndKey('2026-03-07', '23:00', '07:00');
  assert.equal(springEd, '2026-03-08');
  const sStart = fromInputs('2026-03-07', '23:00');
  const sEnd = fromInputs(springEd, '07:00');
  assert.equal(sEnd - sStart, 7 * HOUR);

  const fallEd = sleepEndKey('2026-10-31', '23:00', '07:00');
  assert.equal(fallEd, '2026-11-01');
  const fStart = fromInputs('2026-10-31', '23:00');
  const fEnd = fromInputs(fallEd, '07:00');
  assert.equal(fEnd - fStart, 9 * HOUR);

  const dstBatch = saveSleepBatch([
    { start: sStart, end: sEnd },
    { start: fStart, end: fEnd }
  ], at('2026-11-18', '18:00'));
  assert.equal(dstBatch.ok, true);
  assert.equal(dateKey(get().sleeps[0].end), '2026-03-08');
  assert.equal(dateKey(get().sleeps[1].end), '2026-11-01');

  // 4) 夜班朝早瞓（08:00–15:30），中午 13:35 開補睡眠：missingSleepDays 產生的 7 筆彼此不重疊，可直接整批存下
  const dDay = emptyData();
  dDay.sleeps = [{ id: 'sl0', start: at('2026-11-07', '08:00'), end: at('2026-11-07', '15:30') }];
  replaceAll(dDay, { tombstone: false });
  const nowNoon = at('2026-11-18', '13:35');
  const gen = missingSleepDays(get(), nowNoon, 7);
  assert.equal(gen.length, 7);
  const items = gen.map((r) => ({ start: fromInputs(r.sd, r.st), end: fromInputs(sleepEndKey(r.sd, r.st, r.et), r.et) }));
  const okAll = saveSleepBatch(items, nowNoon);
  assert.equal(okAll.ok, true);
  assert.equal(okAll.count, 7);
});
