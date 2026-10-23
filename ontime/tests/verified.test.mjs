// 已驗證：每個時間點可以手動打勾，確認「這個時間是對的」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setStepTime, setRefTime, setVerified, saveMeal } from '../js/actions.js';
import { workdayEvents, isFlag, markFlag } from '../js/logic.js';
import { at } from '../js/time.js';

const WD = '2026-10-20';
const NOW = at('2026-10-21', '12:00');
const job = { id: 'j1', name: 'food delivery', payMode: 'none' };
const ev = () => workdayEvents(get(), WD, NOW);
const find = (t) => ev().find((e) => e.t === t);

test('markFlag：標記、取消，空了就移除欄位', () => {
  const r = {};
  markFlag(r, 'verified', 'start', true);
  assert.equal(isFlag(r, 'verified', 'start'), true);
  markFlag(r, 'verified', 'start', false);
  assert.equal(r.verified, undefined);
});

test('補登：沒勾就是未驗證；勾了才標記', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const a = at(WD, '21:00');
  const b = at(WD, '21:40');
  setStepTime(WD, 'out', a, { verified: false });
  setStepTime(WD, 'clockIn', b, { verified: true });
  assert.equal(find(a).verified, false);
  assert.equal(find(b).verified, true);
});

test('沒有傳 verified（例如即時按掣）不改原本的打勾', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '21:40');
  setStepTime(WD, 'clockIn', t, { verified: true });
  setStepTime(WD, 'clockIn', t);
  assert.equal(find(t).verified, true);
});

test('每一種時間都可以打勾：行程、上下班、休息、入睡起床', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const pts = {
    out: at(WD, '21:00'), clockIn: at(WD, '21:40'), break: at(WD, '23:30'),
    clockOut: at('2026-10-21', '06:00'), home: at('2026-10-21', '06:50'),
    sleepStart: at('2026-10-21', '08:00'), sleepEnd: at('2026-10-21', '11:00')
  };
  for (const [step, t] of Object.entries(pts)) {
    const extra = { verified: true };
    if (step === 'break') extra.end = at('2026-10-21', '00:00');
    assert.equal(setStepTime(WD, step, t, extra).ok, true, step);
  }
  for (const t of [pts.out, pts.clockIn, pts.break, pts.clockOut, pts.home, pts.sleepStart, pts.sleepEnd]) {
    assert.equal(find(t)?.verified, true, `${new Date(t).toISOString()} 應該已驗證`);
  }
});

test('時間線小勾勾：只改打勾，不動時間；再點一次取消', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '21:40');
  setStepTime(WD, 'clockIn', t);
  const e = find(t);
  setVerified(e.ref, true, e.t);
  assert.equal(find(t).verified, true);
  assert.equal(get().sessions[0].start, t);
  setVerified(e.ref, false, e.t);
  assert.equal(find(t).verified, false);
});

test('修改面板：改時間時一起改打勾；班內休息也能改', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  setStepTime(WD, 'clockIn', at(WD, '21:40'));
  const b0 = at(WD, '23:30');
  setStepTime(WD, 'break', b0, { end: at(WD, '23:50') });
  const e = find(b0);
  const b1 = at(WD, '23:35');
  setRefTime(e.ref, b1, { verified: true, origT: b0 });
  const br = get().sessions[0].breaks[0];
  assert.equal(br.start, b1);
  assert.equal(br.end, at(WD, '23:55'));
  assert.equal(find(b1).verified, true);
});

test('用餐：可以打勾', () => {
  replaceAll({ ...emptyData(), jobs: [job] });
  const t = at(WD, '18:00');
  saveMeal({ start: t, end: null, confirmed: true, verified: { start: true } });
  assert.equal(find(t).verified, true);
});

test('計畫不會顯示成已驗證', () => {
  replaceAll({ ...emptyData(), jobs: [job], sleeps: [{ id: 'p', start: null, end: null, planStart: at(WD, '23:00'), planEnd: at('2026-10-21', '07:00'), verified: { start: true } }] });
  const e = find(at(WD, '23:00'));
  assert.equal(e.plan, true);
  assert.equal(e.verified, false);
});

test('舊資料裡殘留的 approx 欄位不影響任何東西', () => {
  replaceAll({ ...emptyData(), jobs: [job], sessions: [{ id: 's', jobId: 'j1', start: at(WD, '21:40'), end: null, breaks: [], approx: { start: true } }] });
  assert.equal(find(at(WD, '21:40')).verified, false);
});
