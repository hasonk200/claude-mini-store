// R4：只填「時：分」的跨日結束時間，用日曆日推算，不是固定 +24 小時。
// 2026-11-01 凌晨夏令時間結束（多一小時），23:00 → 07:00 實際是 9 小時。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { createShift } from '../js/actions.js';
import { sessionWorkMs } from '../js/logic.js';
import { at, endOnOrAfter, fromInputs, HOUR } from '../js/time.js';

test('2026-10-31 23:00 → 07:00：存成 11/1 07:00，實際 9 小時', () => {
  const start = at('2026-10-31', '23:00');
  const end = endOnOrAfter('2026-10-31', start, '07:00');
  assert.equal(end, at('2026-11-01', '07:00'));
  assert.equal(end - start, 9 * HOUR);
  // 舊寫法（同日 07:00 + 24 小時）會變成 11/1 06:00，差一小時。
  assert.notEqual(fromInputs('2026-10-31', '07:00') + 24 * HOUR, end);
});

test('新增班次用這個結束時間：工時 9 小時', () => {
  replaceAll(emptyData());
  const start = at('2026-10-31', '23:00');
  createShift('2026-10-31', start, endOnOrAfter('2026-10-31', start, '07:00'), at('2026-11-01', '12:00'));
  const s = get().sessions[0];
  assert.equal(s.end, at('2026-11-01', '07:00'));
  assert.equal(sessionWorkMs(s, 0), 9 * HOUR);
});

test('夏令時間開始（2027-03-14，少一小時）：23:00 → 07:00 是 7 小時', () => {
  const start = at('2027-03-13', '23:00');
  const end = endOnOrAfter('2027-03-13', start, '07:00');
  assert.equal(end, at('2027-03-14', '07:00'));
  assert.equal(end - start, 7 * HOUR);
});

test('同一天內的結束不跨日；用餐 allowSame 時等於開始不算隔天', () => {
  const start = at('2026-10-20', '09:00');
  assert.equal(endOnOrAfter('2026-10-20', start, '17:00'), at('2026-10-20', '17:00'));
  assert.equal(endOnOrAfter('2026-10-20', start, '09:00'), at('2026-10-21', '09:00'));
  assert.equal(endOnOrAfter('2026-10-20', start, '09:00', { allowSame: true }), start);
  assert.equal(endOnOrAfter('2026-10-20', start, ''), null);
});
