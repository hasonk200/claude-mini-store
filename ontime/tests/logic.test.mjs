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

test('夜班下班、睡醒後沒有新班，換成當天工作日（不卡在週一）', () => {
  const d = empty();
  d.sessions.push({ id: 's1', jobId: 'j1', start: at('2026-10-12', '21:00'), end: at('2026-10-13', '09:04'), breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null });
  d.sleeps.push({ id: 'z', start: at('2026-10-13', '12:04'), end: at('2026-10-13', '19:00') });
  assert.equal(currentWorkday(d, at('2026-10-13', '21:30')), '2026-10-13');
  assert.equal(currentWorkday(d, at('2026-10-14', '19:49')), '2026-10-14');
});

test('下班後超過 16 小時沒有新班，也換成日曆日', () => {
  const d = empty();
  d.sessions.push({ id: 's1', jobId: 'j1', start: at('2026-10-12', '21:00'), end: at('2026-10-13', '09:04'), breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null });
  assert.equal(currentWorkday(d, at('2026-10-13', '18:00')), '2026-10-12');
  assert.equal(currentWorkday(d, at('2026-10-14', '19:49')), '2026-10-14');
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

test('讀取舊版 ONTIME 備份：取最新版本、略過已刪除、配對通勤', async () => {
  const { parseBackup } = await import('../js/actions.js');
  const rev = (id, type, eid, payload, parents = [], created = 1) => ({ schemaVersion: 1, revisionId: id, entityType: type, entityId: eid, parentIds: parents, payload, createdAtMs: created });
  const start = at('2026-10-12', '23:29');
  const end = at('2026-10-13', '10:16');
  const backup = {
    format: 'dicky-ontime-backup', schemaVersion: 1,
    revisions: [
      rev('j1', 'job', 'job', { id: 'job', name: 'food delivery', payMode: 'none', hourlyRateCents: 2000, commuteOutMinutes: 30, commuteBackMinutes: 45 }),
      rev('s1', 'session', 'ses', { id: 'ses', jobId: 'job', startMs: start, endMs: start + HOUR, breaks: [], payModeSnapshot: 'none' }),
      rev('s2', 'session', 'ses', { id: 'ses', jobId: 'job', startMs: start, endMs: end, breaks: [], payModeSnapshot: 'none' }, ['s1'], 2),
      rev('r1', 'journey', 'jr', { id: 'jr', jobId: 'job', sessionIds: [], leaveHomeMs: at('2026-10-12', '22:45'), arriveHomeMs: at('2026-10-13', '11:03') }),
      rev('m1', 'meal', 'm', { id: 'm', startMs: at('2026-10-13', '03:46'), food: 'chicken burrito', photo: { dataUrl: 'data:image/jpeg;base64,AA' }, confirmed: true }),
      rev('z1', 'sleep', 'gone', { id: 'gone', actualStartMs: 5, deletedAtMs: 9 }),
      rev('z2', 'sleep', 'zz', { id: 'zz', actualStartMs: at('2026-10-13', '12:00'), actualEndMs: at('2026-10-13', '19:00'), note: '很昏沉' })
    ]
  };
  const d = parseBackup('﻿' + JSON.stringify(backup));
  assert.equal(d.sessions.length, 1);
  assert.equal(d.sessions[0].end, end);
  assert.equal(d.journeys[0].sessionId, 'ses');
  assert.equal(d.meals[0].photo, 'data:image/jpeg;base64,AA');
  assert.equal(d.meals[0].name, 'chicken burrito');
  assert.equal(d.sleeps.length, 1);
  assert.equal(d.settings.commuteOutMin, 30);
  assert.equal(d.jobs[0].color, 'deliv');
});

test('已清醒時間與過去 24 小時分段睡眠', async () => {
  const { awakeSince, sleepLast24h } = await import('../js/logic.js');
  const d = empty();
  d.sleeps.push({ id: 'a', start: at('2026-10-13', '17:58'), end: at('2026-10-13', '21:15') });
  d.sleeps.push({ id: 'b', start: at('2026-10-13', '22:40'), end: at('2026-10-14', '02:00') });
  d.sleeps.push({ id: 'c', start: at('2026-10-14', '07:45'), end: at('2026-10-14', '11:55') });
  const now = at('2026-10-14', '18:30');
  assert.equal(awakeSince(d, now).ms, 6 * HOUR + 35 * MIN);
  const s = sleepLast24h(d, now);
  assert.equal(s.parts.length, 3);
  assert.equal(s.ms, 10 * HOUR + 15 * MIN);
});

test('復原上一步', async () => {
  const store = await import('../js/store.js');
  store.replaceAll(empty());
  store.update((d) => { d.meals.push({ id: 'x', start: 1 }); });
  assert.equal(store.get().meals.length, 1);
  assert.equal(store.undo(), true);
  assert.equal(store.get().meals.length, 0);
  assert.equal(store.undo(), false);
});

test('距離上一餐：只計已確認、已開始的用餐', async () => {
  const { lastMeal } = await import('../js/logic.js');
  const d = empty();
  d.meals.push({ id: 'a', name: 'chicken burrito', start: at('2026-10-13', '03:46'), end: at('2026-10-13', '04:10'), confirmed: true });
  d.meals.push({ id: 'b', name: '安排', start: at('2026-10-14', '19:00'), confirmed: false });
  d.meals.push({ id: 'c', name: '未來', start: at('2026-10-14', '20:00'), confirmed: true });
  const r = lastMeal(d, at('2026-10-14', '18:30'));
  assert.equal(r.meal.name, 'chicken burrito');
  assert.equal(r.ms, at('2026-10-14', '18:30') - at('2026-10-13', '04:10'));
});

test('最近常吃：按次數排序、忽略空白和大小寫', async () => {
  const { frequentMealValues } = await import('../js/logic.js');
  const d = empty();
  const names = ['Burrito', 'burrito ', '豆漿', '', 'burrito', '豆漿', '飯'];
  names.forEach((n, i) => d.meals.push({ id: 'm' + i, name: n, place: i % 2 ? 'grillies' : '', start: i }));
  assert.deepEqual(frequentMealValues(d, 'name', 2), ['burrito', '豆漿']);
  assert.deepEqual(frequentMealValues(d, 'place'), ['grillies']);
});

test('逐筆合併：較新的修改勝出，刪除在兩邊都生效', async () => {
  const { mergeData } = await import('../js/sync.js');
  const store = await import('../js/store.js');
  const phone = { ...empty(), meals: [{ id: 'a', name: '手機改過', start: 1, updatedAt: 200 }, { id: 'b', name: '要刪', start: 2, deletedAt: 300, updatedAt: 300 }] };
  const pc = { ...empty(), meals: [{ id: 'a', name: '舊分頁', start: 1, updatedAt: 100 }, { id: 'b', name: '要刪', start: 2, updatedAt: 50 }, { id: 'c', name: '電腦新增', start: 3, updatedAt: 250 }] };
  const now = Date.now();
  phone.meals.forEach((m) => { if (m.deletedAt) { m.deletedAt = now; m.updatedAt = now; } });
  const m = mergeData(pc, phone);
  const byId = Object.fromEntries(m.meals.map((x) => [x.id, x]));
  assert.equal(byId.a.name, '手機改過');
  assert.ok(byId.b.deletedAt);
  assert.equal(byId.c.name, '電腦新增');
  assert.deepEqual(store.visible(m).meals.map((x) => x.id).sort(), ['a', 'c']);
});

test('修改時自動蓋 updatedAt，刪除改為刪除標記', async () => {
  const store = await import('../js/store.js');
  store.replaceAll({ ...empty(), meals: [{ id: 'x', name: '舊', start: 1 }, { id: 'y', name: '不動', start: 2 }] });
  store.update((d) => { d.meals.find((m) => m.id === 'x').name = '新'; });
  const raw = store.getRaw().meals;
  assert.ok(raw.find((m) => m.id === 'x').updatedAt > 0);
  assert.equal(raw.find((m) => m.id === 'y').updatedAt, undefined);
  store.update((d) => { d.meals = d.meals.filter((m) => m.id !== 'y'); });
  assert.ok(store.getRaw().meals.find((m) => m.id === 'y').deletedAt);
  assert.deepEqual(store.get().meals.map((m) => m.id), ['x']);
});

// 用戶的實際情境：週三起床 → 夜班 → 週四早餐 → 週四白天睡覺 → 週四晚上起床後的一餐
function wakeDays() {
  const d = empty();
  d.sleeps.push({ id: 's0', start: at('2026-10-14', '06:00'), end: at('2026-10-14', '14:10') });
  d.sessions.push({ id: 'w', jobId: 'j1', start: at('2026-10-14', '23:20'), end: at('2026-10-15', '07:40'), breaks: [] });
  d.meals.push({ id: 'bf', name: '熱香餅+豆漿+吐司', start: at('2026-10-15', '08:32'), confirmed: true });
  d.sleeps.push({ id: 's1', start: at('2026-10-15', '12:59'), end: at('2026-10-15', '21:22') });
  d.meals.push({ id: 'dn', name: '用餐', start: at('2026-10-15', '21:40'), confirmed: true });
  return d;
}

test('工作日由起床到下一次起床：下班後的早餐和睡眠屬前一天', async () => {
  const L = await import('../js/logic.js');
  const d = wakeDays();
  const now = at('2026-10-15', '21:51');
  assert.equal(L.workdayOfSession(d.sessions[0], d), '2026-10-14');
  assert.equal(L.mealWorkday(d.meals[0], d, now), '2026-10-14');
  assert.equal(L.sleepWorkday(d.sleeps[1], d), '2026-10-14');
  assert.equal(L.mealWorkday(d.meals[1], d, now), '2026-10-15');
  assert.equal(L.currentWorkday(d, now), '2026-10-15');
  const ev = L.workdayEvents(d, '2026-10-14', now);
  assert.ok(ev.some((e) => e.title === '起床 · 週四工作日開始'));
  const [a, b] = L.workdaySpan(d, '2026-10-14', now);
  assert.ok(a <= at('2026-10-14', '14:10') && b >= at('2026-10-15', '21:22'));
});

test('少於 4 小時的小睡不切開一天；凌晨 4 點前起床用前一天日期', async () => {
  const L = await import('../js/logic.js');
  const d = wakeDays();
  d.sleeps.push({ id: 'nap', start: at('2026-10-14', '19:00'), end: at('2026-10-14', '21:00') });
  assert.equal(L.dayOf(d, at('2026-10-14', '22:00')), '2026-10-14');
  d.sleeps.push({ id: 'late', start: at('2026-10-16', '20:00'), end: at('2026-10-17', '02:00') });
  assert.equal(L.dayOf(d, at('2026-10-17', '03:00')), '2026-10-16');
});

test('手動指定的所屬工作日仍然優先', async () => {
  const L = await import('../js/logic.js');
  const d = wakeDays();
  d.sleeps[1].workdayDate = '2026-10-15';
  assert.equal(L.sleepWorkday(d.sleeps[1], d), '2026-10-15');
});
