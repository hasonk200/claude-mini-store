// 補登先選班次：時間都扣在班次上，日期由班次決定，不會跑去別日。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { createShift, setStepTime } from '../js/actions.js';
import { resolveStepTime, defaultStepTime, shiftDistance, recentShiftRanges, sessionsOfWorkday, SHIFT_FAR_MS } from '../js/logic.js';
import { at } from '../js/time.js';

const job = { id: 'j1', name: 'food delivery', payMode: 'none' };
const night = { start: at('2026-10-19', '23:00'), end: at('2026-10-20', '07:00') }; // 週一夜班
const day = { start: at('2026-10-20', '09:00'), end: at('2026-10-20', '18:00') };

test('只打時間：下班 07:05 自動算成隔天；出門 22:20 算成班次當天', () => {
  assert.equal(resolveStepTime('clockOut', '07:05', night), at('2026-10-20', '07:05'));
  assert.equal(resolveStepTime('out', '22:20', night), at('2026-10-19', '22:20'));
  assert.equal(resolveStepTime('home', '07:50', night), at('2026-10-20', '07:50'));
});

test('白天班：出門 08:15 在當天；到家 18:40 在當天', () => {
  assert.equal(resolveStepTime('out', '08:15', day), at('2026-10-20', '08:15'));
  assert.equal(resolveStepTime('home', '18:40', day), at('2026-10-20', '18:40'));
});

test('出門在午夜前、上班在午夜後：出門算前一天', () => {
  const s = { start: at('2026-10-21', '00:13'), end: at('2026-10-21', '10:24') };
  assert.equal(resolveStepTime('out', '23:40', s), at('2026-10-20', '23:40'));
});

test('不管「現在」是哪天，結果只看班次（在週三補週一的班）', () => {
  // resolveStepTime 完全不看現在的時間
  assert.equal(resolveStepTime('arrive', '08:50', day), at('2026-10-20', '08:50'));
});

test('預設時間在班次附近，不是現在', () => {
  assert.equal(defaultStepTime('out', day), at('2026-10-20', '08:15'));
  assert.equal(defaultStepTime('clockOut', day), day.end);
  assert.equal(defaultStepTime('home', day), at('2026-10-20', '18:40'));
  assert.equal(defaultStepTime('break', day), at('2026-10-20', '13:30'));
  // 還沒下班：用開工後 8 小時當作預設
  assert.equal(defaultStepTime('clockOut', { start: day.start, end: null }), at('2026-10-20', '17:00'));
});

test('離班次太遠會被量出來', () => {
  assert.equal(shiftDistance(at('2026-10-20', '12:00'), day), 0);
  assert.equal(shiftDistance(at('2026-10-20', '08:00'), day), 60 * 60000);
  assert.ok(shiftDistance(at('2026-10-05', '09:00'), day) > SHIFT_FAR_MS, '16 號跑去 1 號要被擋');
});

test('新增班次：建立一班出勤，固定屬於你選的工作日', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const r = createShift('2026-10-20', day.start, day.end);
  assert.equal(r.ok, true);
  const s = get().sessions[0];
  assert.equal(s.id, r.id);
  assert.equal(s.workdayDate, '2026-10-20');
  assert.equal(s.workdayManual, true);
  assert.deepEqual([s.start, s.end], [day.start, day.end]);
  assert.equal(sessionsOfWorkday(get(), '2026-10-20').length, 1);
});

test('同一個工作日有兩班：指定班次就一定寫進那一班', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const a = createShift('2026-10-20', at('2026-10-20', '09:00'), at('2026-10-20', '12:00')).id;
  const b = createShift('2026-10-20', at('2026-10-20', '18:00'), at('2026-10-20', '22:00')).id;
  assert.equal(setStepTime('2026-10-20', 'out', at('2026-10-20', '17:20'), { sessionId: b }).ok, true);
  assert.equal(setStepTime('2026-10-20', 'home', at('2026-10-20', '12:40'), { sessionId: a }).ok, true);
  const d = get();
  const ja = d.journeys.find((j) => j.sessionId === a);
  const jb = d.journeys.find((j) => j.sessionId === b);
  assert.equal(ja.home, at('2026-10-20', '12:40'));
  assert.equal(ja.out, null);
  assert.equal(jb.out, at('2026-10-20', '17:20'));
  assert.equal(jb.home, null);
  assert.equal(d.journeys.length, 2, '不會多出孤兒行程');
});

test('指定班次補下班、休息：只改那一班', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const a = createShift('2026-10-20', at('2026-10-20', '09:00')).id;
  const b = createShift('2026-10-20', at('2026-10-20', '18:00')).id;
  assert.equal(setStepTime('2026-10-20', 'clockOut', at('2026-10-20', '22:30'), { sessionId: b }).ok, true);
  assert.equal(setStepTime('2026-10-20', 'break', at('2026-10-20', '11:00'), { sessionId: a, end: at('2026-10-20', '11:30') }).ok, true);
  const d = get();
  assert.equal(d.sessions.find((s) => s.id === b).end, at('2026-10-20', '22:30'));
  assert.equal(d.sessions.find((s) => s.id === a).end, null);
  assert.equal(d.sessions.find((s) => s.id === a).breaks.length, 1);
  assert.equal(d.sessions.find((s) => s.id === b).breaks.length, 0);
});

test('指定的班次不存在：明確報錯，不會亂寫', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const r = setStepTime('2026-10-20', 'out', at('2026-10-20', '08:00'), { sessionId: 'nope' });
  assert.deepEqual(r, { ok: false, reason: 'no-session' });
  assert.equal(get().journeys.length, 0);
});

test('指定班次補上班：改這一班的開工時間', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const a = createShift('2026-10-20', at('2026-10-20', '09:00'), at('2026-10-20', '18:00')).id;
  setStepTime('2026-10-20', 'clockIn', at('2026-10-20', '09:10'), { sessionId: a });
  assert.equal(get().sessions.length, 1);
  assert.equal(get().sessions[0].start, at('2026-10-20', '09:10'));
});

test('最近用過的班次時段', () => {
  replaceAll({ ...emptyData(), jobs: [job], sessions: [
    { id: 's1', jobId: 'j1', start: at('2026-10-18', '09:00'), end: at('2026-10-18', '18:00'), breaks: [] },
    { id: 's2', jobId: 'j1', start: at('2026-10-19', '09:00'), end: at('2026-10-19', '18:00'), breaks: [] },
    { id: 's3', jobId: 'j1', start: at('2026-10-17', '23:00'), end: at('2026-10-18', '07:00'), breaks: [] }
  ] });
  const r = recentShiftRanges(get());
  assert.deepEqual(r.map((x) => x.key), ['09:00–18:00', '23:00–07:00']);
});
