// 時間準確度：每個時間點可以標「大約」，預設準確；可以隨時改回準確。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setStepTime, setRefTime, setApprox, saveMeal } from '../js/actions.js';
import { workdayEvents, isApprox, markApprox, sessionApproxCount } from '../js/logic.js';
import { at } from '../js/time.js';

const WD = '2026-10-20';
const NOW = at('2026-10-21', '12:00');
const job = { id: 'j1', name: 'food delivery', payMode: 'none' };
const ev = () => workdayEvents(get(), WD, NOW);
const find = (t) => ev().find((e) => e.t === t);

test('markApprox：標記、取消，空了就移除欄位', () => {
  const r = {};
  markApprox(r, 'start', true);
  assert.equal(isApprox(r, 'start'), true);
  markApprox(r, 'start', false);
  assert.equal(r.approx, undefined);
});

test('補登預設準確；選「大約」才標記', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const a = at(WD, '21:00');
  const b = at(WD, '21:40');
  setStepTime(WD, 'out', a, { approx: false });
  setStepTime(WD, 'clockIn', b, { approx: true });
  assert.equal(find(a).approx, false);
  assert.equal(find(b).approx, true);
});

test('沒有傳 approx（例如即時按掣）不改原本的標記', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '21:40');
  setStepTime(WD, 'clockIn', t, { approx: true });
  setStepTime(WD, 'clockIn', t);
  assert.equal(find(t).approx, true);
});

test('每一種時間都可以標大約：行程、上下班、休息、入睡起床', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const pts = {
    out: at(WD, '21:00'), clockIn: at(WD, '21:40'), break: at(WD, '23:30'),
    clockOut: at('2026-10-21', '06:00'), home: at('2026-10-21', '06:50'),
    sleepStart: at('2026-10-21', '08:00'), sleepEnd: at('2026-10-21', '11:00')
  };
  for (const [step, t] of Object.entries(pts)) {
    const extra = { approx: true };
    if (step === 'break') extra.end = at('2026-10-21', '00:00');
    assert.equal(setStepTime(WD, step, t, extra).ok, true, step);
  }
  const s = get().sessions[0];
  assert.equal(sessionApproxCount(s), 4); // 上班、下班、休息開始、休息結束
  for (const t of [pts.out, pts.clockIn, pts.break, pts.clockOut, pts.home]) assert.equal(find(t).approx, true);
});

test('待確認：只改準確度，不動時間', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '21:40');
  setStepTime(WD, 'clockIn', t, { approx: true });
  const e = find(t);
  setApprox(e.ref, false, e.t);
  assert.equal(find(t).approx, false);
  assert.equal(get().sessions[0].start, t);
});

test('時間線面板：改時間時一起改準確度；班內休息也能改時間', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  setStepTime(WD, 'clockIn', at(WD, '21:40'));
  const b0 = at(WD, '23:30');
  setStepTime(WD, 'break', b0, { end: at(WD, '23:50') });
  const e = find(b0);
  const b1 = at(WD, '23:35');
  setRefTime(e.ref, b1, { approx: true, origT: b0 });
  const br = get().sessions[0].breaks[0];
  assert.equal(br.start, b1);
  assert.equal(br.end, at(WD, '23:55'));
  assert.equal(find(b1).approx, true);
});

test('用餐：可以標大約', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '18:00');
  saveMeal({ start: t, end: null, confirmed: true, approx: { start: true } });
  assert.equal(find(t).approx, true);
});

test('計畫不會顯示成大約', () => {
  replaceAll({ ...emptyData(), jobs: [job], sleeps: [{ id: 'p', start: null, end: null, planStart: at(WD, '23:00'), planEnd: at('2026-10-21', '07:00'), approx: { start: true } }] });
  const e = find(at(WD, '23:00'));
  assert.equal(e.plan, true);
  assert.equal(e.approx, false);
});
