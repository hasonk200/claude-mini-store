// 執行：TZ=America/Toronto node --test ontime/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { at, HOUR, MIN, dateKey } from '../js/time.js';
import {
  mergeIntervals, currentWorkday, inferSleepWorkday, sleepWorkday, nextStep, currentCycle,
  beforeBedBudget, calendarAllocation, splitWorkByDay, periodStats, workdayEvents, sessionWorkMs
} from '../js/logic.js';

const empty = () => ({ jobs: [{ id: 'j1', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 }], shifts: [], sessions: [], journeys: [], meals: [], sleeps: [], dayMarks: [], settings: { commuteOutMin: 45, commuteBackMin: 45 } });

// 週一 10/12 21:00 上班，週二 09:00 下班。
function nightShift() {
  const d = empty();
  d.shifts.push({ id: 'sh1', jobId: 'j1', start: at('2026-10-12', '21:00'), end: at('2026-10-13', '09:00') });
  d.shifts.push({ id: 'sh2', jobId: 'j1', start: at('2026-10-13', '21:00'), end: at('2026-10-14', '09:00') });
  d.sessions.push({ id: 's1', jobId: 'j1', shiftId: 'sh1', start: at('2026-10-12', '20:58'), end: null, breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null });
  d.journeys.push({ id: 'jr1', sessionId: 's1', out: at('2026-10-12', '20:12'), ride: at('2026-10-12', '20:21'), arrive: at('2026-10-12', '20:47'), leave: null, ride2: null, home: null });
  return d;
}

test('合併重疊區間', () => {
  assert.deepEqual(mergeIntervals([[5, 8], [1, 3], [2, 4], [8, 9]]), [[1, 4], [5, 9]]);
});

test('夜班過了午夜仍是週一工作日', () => {
  const d = nightShift();
  assert.equal(currentWorkday(d, at('2026-10-13', '03:18')), '2026-10-12');
});

test('下班後白天睡眠歸回週一工作日', () => {
  const d = nightShift();
  d.sessions[0].end = at('2026-10-13', '09:04');
  assert.equal(inferSleepWorkday(at('2026-10-13', '12:04'), d), '2026-10-12');
  d.sleeps.push({ id: 'z', start: at('2026-10-13', '12:04'), end: null });
  assert.equal(currentWorkday(d, at('2026-10-13', '15:00')), '2026-10-12');
});

test('明確清除歸屬時按入睡日期', () => {
  const d = nightShift();
  d.sessions[0].end = at('2026-10-13', '09:04');
  assert.equal(sleepWorkday({ start: at('2026-10-13', '12:04'), workdayDate: null }, d), '2026-10-13');
});

test('下一班開始後切到新的工作日', () => {
  const d = nightShift();
  d.sessions[0].end = at('2026-10-13', '09:04');
  d.journeys[0].home = at('2026-10-13', '09:58');
  assert.equal(currentWorkday(d, at('2026-10-13', '18:00')), '2026-10-12');
  assert.equal(currentWorkday(d, at('2026-10-13', '21:30')), '2026-10-13');
});

test('沒有紀錄時用日曆日', () => {
  assert.equal(currentWorkday(empty(), at('2026-10-14', '10:00')), '2026-10-14');
});

test('下一個環節依已記錄的最後一步', () => {
  const d = nightShift();
  assert.equal(nextStep(currentCycle(d, at('2026-10-13', '03:00'))), 'clockOut');
  d.sessions[0].end = at('2026-10-13', '09:04');
  assert.equal(nextStep(currentCycle(d, at('2026-10-13', '09:05'))), 'ride2');
  d.journeys[0].home = at('2026-10-13', '09:58');
  assert.equal(nextStep(currentCycle(d, at('2026-10-13', '10:00'))), 'out');
});

test('睡前未安排時間扣除工作、通勤與已確認用餐，重疊只算一次', () => {
  const d = nightShift();
  d.sleeps.push({ id: 'p', start: null, end: null, planStart: at('2026-10-13', '12:00'), planEnd: at('2026-10-13', '20:00') });
  d.meals.push({ id: 'm', start: at('2026-10-13', '04:30'), end: at('2026-10-13', '05:00'), confirmed: true });
  const b = beforeBedBudget(d, at('2026-10-13', '03:18'));
  assert.equal(b.state, 'ok');
  assert.equal(b.countdown, 8 * HOUR + 42 * MIN);
  // 03:18–09:00 工作 + 09:00–09:45 回程 = 6h27m
  assert.equal(b.free, 8 * HOUR + 42 * MIN - (6 * HOUR + 27 * MIN));
});

test('沒有睡眠計畫顯示未設定', () => {
  assert.equal(beforeBedBudget(nightShift(), at('2026-10-13', '03:18')).state, 'unset');
});

test('跨日工時按日曆日拆開', () => {
  const d = nightShift();
  d.sessions[0].end = at('2026-10-13', '09:04');
  const split = splitWorkByDay(d.sessions[0], at('2026-10-14', '00:00'));
  assert.equal(split['2026-10-12'], 3 * HOUR + 2 * MIN);
  assert.equal(split['2026-10-13'], 9 * HOUR + 4 * MIN);
});

test('休息從工時扣除', () => {
  const s = { start: at('2026-10-12', '21:00'), end: at('2026-10-13', '09:00'), breaks: [{ start: at('2026-10-13', '01:00'), end: at('2026-10-13', '01:30') }] };
  assert.equal(sessionWorkMs(s, 0), 11 * HOUR + 30 * MIN);
});

test('日曆日分配：工作中用餐不重複計入合計', () => {
  const d = nightShift();
  d.sessions[0].end = at('2026-10-13', '09:00');
  d.meals.push({ id: 'm', start: at('2026-10-13', '01:00'), end: at('2026-10-13', '01:30'), confirmed: true });
  const a = calendarAllocation(d, '2026-10-13', at('2026-10-14', '00:00'));
  assert.equal(a.work, 9 * HOUR);
  assert.equal(a.meal, 30 * MIN);
  assert.equal(a.total, 9 * HOUR);
});

test('按單收入只歸在上班日期，未填與 0 分開', () => {
  const d = empty();
  d.sessions.push({ id: 'a', jobId: 'j1', start: at('2026-10-17', '22:00'), end: at('2026-10-18', '02:00'), breaks: [], payMode: 'perOrder', income: 80, orders: 10 });
  d.sessions.push({ id: 'b', jobId: 'j1', start: at('2026-10-19', '18:00'), end: at('2026-10-19', '22:00'), breaks: [], payMode: 'perOrder', income: null, orders: null });
  const sat = periodStats(d, '2026-10-17', '2026-10-18', at('2026-10-20', '00:00'));
  const sun = periodStats(d, '2026-10-18', '2026-10-19', at('2026-10-20', '00:00'));
  assert.equal(sat.income, 80);
  assert.equal(sun.income, 0);
  assert.equal(sun.sessions.length, 0);
  const mon = periodStats(d, '2026-10-19', '2026-10-20', at('2026-10-20', '00:00'));
  assert.equal(mon.incomeKnown, 0);
  assert.equal(mon.perOrderCount, 1);
});

test('夏令時間結束當天（25 小時）工時正確', () => {
  const s = { start: at('2026-10-31', '22:00'), end: at('2026-11-01', '06:00'), breaks: [] };
  assert.equal(sessionWorkMs(s, 0), 9 * HOUR);
  const split = splitWorkByDay(s, 0);
  assert.equal(split['2026-10-31'], 2 * HOUR);
  assert.equal(split['2026-11-01'], 7 * HOUR);
});

test('工作日事件包含真實日期與跨日用餐', () => {
  const d = nightShift();
  d.meals.push({ id: 'm', name: '宵夜', start: at('2026-10-13', '01:10'), end: at('2026-10-13', '01:35'), confirmed: true });
  const ev = workdayEvents(d, '2026-10-12', at('2026-10-13', '03:18'));
  const meal = ev.find((e) => e.kind === 'meal');
  assert.ok(meal, '宵夜應在週一工作日');
  assert.equal(dateKey(meal.t), '2026-10-13');
  assert.ok(ev.some((e) => e.title === '預計下班' && e.plan));
});

test('雲端合併：雲端為準，加入只在本機的紀錄', async () => {
  const { mergeData, stripPhotos } = await import('../js/sync.js');
  const cloud = { ...empty(), meals: [{ id: 'a', name: '雲端', start: 1 }], dayMarks: [{ date: '2026-10-14', kind: 'off' }] };
  const local = { ...empty(), meals: [{ id: 'a', name: '本機', start: 1 }, { id: 'b', name: '只在本機', start: 2 }], dayMarks: [{ date: '2026-10-14', kind: 'off' }, { date: '2026-10-18', kind: 'off' }] };
  const m = mergeData(cloud, local);
  assert.deepEqual(m.meals.map((x) => x.name), ['雲端', '只在本機']);
  assert.equal(m.dayMarks.length, 2);
  const s = stripPhotos({ ...empty(), meals: [{ id: 'p', photo: 'data:image/jpeg;base64,xx' }] });
  assert.equal(s.meals[0].photo, null);
  assert.equal(s.meals[0].hasPhoto, true);
});
