// R3：補很久以前的班、收工留空 → 「待補收工」，不當作正在上班，也不累計工時到現在。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { createShift, setStepTime, setRefTime } from '../js/actions.js';
import { activeSession, isOpenSession, sessionWorkMs, workdayEvents, periodStats } from '../js/logic.js';
import { at, HOUR } from '../js/time.js';

const now = at('2026-10-25', '12:00');

test('補三天前的班、收工留空：標成待補收工，不是進行中', () => {
  replaceAll(emptyData());
  createShift('2026-10-22', at('2026-10-22', '09:00'), null, now);
  const s = get().sessions[0];
  assert.equal(s.endPending, true);
  assert.equal(isOpenSession(s), false);
  assert.equal(activeSession(get()), null);
  assert.equal(sessionWorkMs(s, now), 0);
  assert.equal(periodStats(get(), '2026-10-19', '2026-10-26', now).workMs, 0);
});

test('時間線顯示「待補收工」事件', () => {
  replaceAll(emptyData());
  createShift('2026-10-22', at('2026-10-22', '09:00'), null, now);
  const ev = workdayEvents(get(), '2026-10-22', now);
  assert.ok(ev.some((e) => e.title === '待補收工' && e.step === 'clockOut'));
});

test('剛開工不久、收工留空：仍然是進行中的那一班', () => {
  replaceAll(emptyData());
  createShift('2026-10-25', at('2026-10-25', '08:00'), null, now);
  const s = get().sessions[0];
  assert.equal(s.endPending, undefined);
  assert.equal(activeSession(get())?.id, s.id);
});

test('補登上班（沒有現成班次）也一樣標待補收工', () => {
  replaceAll(emptyData());
  setStepTime('2026-10-22', 'clockIn', at('2026-10-22', '09:00'), { now });
  assert.equal(get().sessions[0].endPending, true);
  assert.equal(activeSession(get()), null);
});

test('補上收工後清掉待補標記，工時正常計', () => {
  replaceAll(emptyData());
  createShift('2026-10-22', at('2026-10-22', '09:00'), null, now);
  const r = setStepTime('2026-10-22', 'clockOut', at('2026-10-22', '17:00'));
  assert.notEqual(r?.ok, false);
  const s = get().sessions[0];
  assert.equal('endPending' in s, false);
  assert.equal(sessionWorkMs(s, now), 8 * HOUR);
});

test('在時間線直接改收工，也會清掉待補標記', () => {
  replaceAll(emptyData());
  createShift('2026-10-22', at('2026-10-22', '09:00'), null, now);
  const id = get().sessions[0].id;
  assert.equal(setRefTime({ type: 'session', id, field: 'end' }, at('2026-10-22', '16:00')).ok, true);
  assert.equal('endPending' in get().sessions[0], false);
});
