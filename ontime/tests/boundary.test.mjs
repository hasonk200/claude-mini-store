// 工作日分界：主睡眠 4 小時門檻，以及「手動標成主睡眠」的例外。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { at } from '../js/time.js';
import { dayBoundaries, dayOf } from '../js/logic.js';

const data = (sleeps) => ({
  jobs: [], shifts: [], sessions: [], journeys: [], meals: [], sleeps,
  rests: [], dayMarks: [], templates: [], settings: {}
});

test('不到 4 小時的小睡不會切開工作日', () => {
  const d = data([{ id: 'a', start: at('2026-10-21', '01:39'), end: at('2026-10-21', '05:23') }]);
  assert.deepEqual(dayBoundaries(d), []);
});

test('標了 mainSleep，3h44m 也算工作日分界', () => {
  const d = data([{ id: 'a', start: at('2026-10-21', '01:39'), end: at('2026-10-21', '05:23'), mainSleep: true }]);
  assert.deepEqual(dayBoundaries(d), [at('2026-10-21', '05:23')]);
  assert.equal(dayOf(d, at('2026-10-21', '07:10')), '2026-10-21');
});

test('兩段睡眠合併時，mainSleep 旗標會保留', () => {
  const d = data([
    { id: 'a', start: at('2026-10-20', '17:57'), end: at('2026-10-21', '01:09') },
    { id: 'b', start: at('2026-10-21', '01:29'), end: at('2026-10-21', '05:23'), mainSleep: true }
  ]);
  assert.deepEqual(dayBoundaries(d), [at('2026-10-21', '05:23')]);
});

test('沒有旗標的舊資料行為不變', () => {
  const d = data([
    { id: 'a', start: at('2026-10-20', '17:57'), end: at('2026-10-21', '01:09') },
    { id: 'b', start: at('2026-10-21', '01:39'), end: at('2026-10-21', '05:23') }
  ]);
  assert.deepEqual(dayBoundaries(d), [at('2026-10-21', '01:09')]);
});
