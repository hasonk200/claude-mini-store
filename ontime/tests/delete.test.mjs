// 刪除各種紀錄：整筆刪、只刪一段休息、只清一個行程欄位。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, getRaw, visible, emptyData } from '../js/store.js';
import { deleteRef } from '../js/actions.js';

const at = (s) => Date.parse(s);

test('刪除睡眠／用餐／休息：整筆消失', () => {
  replaceAll({
    ...emptyData(),
    sleeps: [{ id: 'sl1', start: 1, end: 2 }],
    meals: [{ id: 'ml1', start: 1, end: 2, name: 'x' }],
    rests: [{ id: 'rs1', start: 1, end: 2 }]
  });
  assert.equal(deleteRef({ type: 'sleep', id: 'sl1' }).ok, true);
  assert.equal(deleteRef({ type: 'meal', id: 'ml1' }).ok, true);
  assert.equal(deleteRef({ type: 'rest', id: 'rs1' }).ok, true);
  const d = visible(getRaw());
  assert.equal(d.sleeps.length, 0);
  assert.equal(d.meals.length, 0);
  assert.equal(d.rests.length, 0);
});

test('刪除出勤：連同行程一起刪，班表不受影響', () => {
  replaceAll({
    ...emptyData(),
    jobs: [{ id: 'j1', name: 'x' }],
    shifts: [{ id: 'sh1', jobId: 'j1', start: 1, end: 2 }],
    sessions: [{ id: 'se1', jobId: 'j1', start: 1, end: 2, breaks: [] }],
    journeys: [{ id: 'jr1', sessionId: 'se1', out: 1, arrive: 2 }]
  });
  assert.equal(deleteRef({ type: 'session', id: 'se1', field: 'start' }).ok, true);
  const d = visible(getRaw());
  assert.equal(d.sessions.length, 0);
  assert.equal(d.journeys.length, 0);
  assert.equal(d.shifts.length, 1);
});

test('刪除班內休息：只刪指定的那一段', () => {
  replaceAll({
    ...emptyData(),
    sessions: [{
      id: 'se1', jobId: 'j1', start: at('2026-10-18T08:00:00-04:00'), end: null,
      breaks: [{ start: 100, end: 200 }, { start: 300, end: null }]
    }]
  });
  assert.equal(deleteRef({ type: 'session', id: 'se1', field: 'break' }, 300).ok, true);
  const s = visible(getRaw()).sessions[0];
  assert.equal(s.breaks.length, 1);
  assert.equal(s.breaks[0].start, 100);
  assert.equal(visible(getRaw()).sessions.length, 1, '整班要留著');
});

test('刪除行程欄位：其他欄位保留，全空才移除容器', () => {
  replaceAll({ ...emptyData(), journeys: [{ id: 'jr1', out: 100, arrive: 200 }] });
  deleteRef({ type: 'journey', id: 'jr1', field: 'out' });
  assert.equal(visible(getRaw()).journeys.length, 1);
  assert.equal(visible(getRaw()).journeys[0].out, null);
  assert.equal(visible(getRaw()).journeys[0].arrive, 200);

  deleteRef({ type: 'journey', id: 'jr1', field: 'arrive' });
  assert.equal(visible(getRaw()).journeys.length, 0);
});

test('刪除班表', () => {
  replaceAll({ ...emptyData(), shifts: [{ id: 'sh1', start: 1, end: 2 }] });
  deleteRef({ type: 'shift', id: 'sh1' });
  assert.equal(visible(getRaw()).shifts.length, 0);
});

test('找不到的紀錄回報失敗，不會假裝成功', () => {
  replaceAll({ ...emptyData() });
  assert.equal(deleteRef({ type: 'sleep', id: 'nope' }).ok, true, '整筆刪除本身是幂等的');
  assert.equal(deleteRef(null).ok, false);
  assert.equal(deleteRef({ type: 'nope', id: 'x' }).ok, false);
});

test('刪「下班」只清掉下班時間，整班與行程都留著', () => {
  replaceAll({
    ...emptyData(),
    sessions: [{ id: 'se1', jobId: 'j1', start: 1, end: 2, breaks: [] }],
    journeys: [{ id: 'jr1', sessionId: 'se1', out: 1 }]
  });
  assert.equal(deleteRef({ type: 'session', id: 'se1', field: 'end' }).ok, true);
  const d = visible(getRaw());
  assert.equal(d.sessions.length, 1, '整班要留著');
  assert.equal(d.sessions[0].end, null, '要變回進行中');
  assert.equal(d.journeys.length, 1, '行程不能跟著消失');
});

test('這班本來就沒有下班時間，刪「下班」要回報失敗', () => {
  replaceAll({ ...emptyData(), sessions: [{ id: 'se2', jobId: 'j1', start: 1, end: null, breaks: [] }] });
  assert.deepEqual(deleteRef({ type: 'session', id: 'se2', field: 'end' }), { ok: false, reason: 'no-end' });
});

test('舊班不能清空下班時間（會變成長期進行中）', () => {
  replaceAll({
    ...emptyData(),
    sessions: [
      { id: 'old', jobId: 'j1', start: 100, end: 200, breaks: [] },
      { id: 'new', jobId: 'j1', start: 300, end: 400, breaks: [] }
    ]
  });
  assert.deepEqual(deleteRef({ type: 'session', id: 'old', field: 'end' }), { ok: false, reason: 'not-latest' });
  assert.equal(visible(getRaw()).sessions.find((x) => x.id === 'old').end, 200, '時間不能被清掉');
});

test('最後一班可以清空下班時間', () => {
  replaceAll({
    ...emptyData(),
    sessions: [
      { id: 'old', jobId: 'j1', start: 100, end: 200, breaks: [] },
      { id: 'new', jobId: 'j1', start: 300, end: 400, breaks: [] }
    ]
  });
  assert.equal(deleteRef({ type: 'session', id: 'new', field: 'end' }).ok, true);
  assert.equal(visible(getRaw()).sessions.find((x) => x.id === 'new').end, null);
});
