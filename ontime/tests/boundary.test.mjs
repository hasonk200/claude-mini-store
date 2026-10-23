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

test('兩段都不到 4 小時，合併後也不到 4 小時：有旗標才算分界', () => {
  const both = (flag) => data([
    { id: 'a', start: at('2026-10-21', '01:00'), end: at('2026-10-21', '02:30') },
    { id: 'b', start: at('2026-10-21', '02:45'), end: at('2026-10-21', '04:15'), ...(flag ? { mainSleep: true } : {}) }
  ]);
  // 合併後 01:00–04:15 只有 3h15m，沒有旗標不可能是分界。
  assert.deepEqual(dayBoundaries(both(false)), []);
  assert.deepEqual(dayBoundaries(both(true)), [at('2026-10-21', '04:15')]);
});

test('沒有旗標的舊資料行為不變', () => {
  const d = data([
    { id: 'a', start: at('2026-10-20', '17:57'), end: at('2026-10-21', '01:09') },
    { id: 'b', start: at('2026-10-21', '01:39'), end: at('2026-10-21', '05:23') }
  ]);
  assert.deepEqual(dayBoundaries(d), [at('2026-10-21', '01:09')]);
});
