// 「存了就一定看得到」：補登面板每一個步驟，存完都要出現在你揀的工作日；
// 做不到就一定要回報失敗，不能假裝「已儲存」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setStepTime } from '../js/actions.js';
import { workdayEvents, sleepWorkday } from '../js/logic.js';
import { at } from '../js/time.js';

const NOW = at('2026-10-21', '07:00');
const WD = '2026-10-20'; // 週二工作日
const job = { id: 'j1', name: 'food delivery', payMode: 'none' };

// 背景一：週一 10:00 有主睡眠起床，之後沒再記主睡眠（36 小時內，自動規則會把週二的事算回週一）。
const withWake = () => ({ ...emptyData(), jobs: [job], sleeps: [{ id: 'z', start: at('2026-10-19', '02:00'), end: at('2026-10-19', '10:00') }] });
// 背景二：完全沒有睡眠紀錄。
const blank = () => ({ ...emptyData(), jobs: [job] });

const shown = (wd, t) => workdayEvents(get(), wd, NOW).some((e) => e.t === t);

const STEPS = [
  ['out', '21:00'], ['ride', '21:10'], ['arrive', '21:35'], ['clockIn', '21:40'], ['break', '23:30'],
  ['clockOut', '06:00+'], ['leave', '06:05+'], ['ride2', '06:15+'], ['home', '06:50+']
];
const timeOf = (s) => (s.endsWith('+') ? at('2026-10-21', s.slice(0, -1)) : at(WD, s));

for (const [name, bg] of [['有週一起床紀錄', withWake], ['沒有睡眠紀錄', blank]]) {
  test(`逐步補登一整班（${name}）：每一步都出現在週二`, () => {
    replaceAll(bg());
    for (const [step, hhmm] of STEPS) {
      const t = timeOf(hhmm);
      const r = setStepTime(WD, step, t);
      assert.equal(r.ok, true, `${step} 應該成功`);
      assert.ok(shown(WD, t), `${step} 存了卻沒有出現在週二`);
    }
    assert.equal(get().journeys.length, 1, '同一班只應該有一段行程');
    assert.equal(get().sessions.length, 1);
  });

  test(`只補單一步驟（${name}）：存了就看得到，不然要報錯`, () => {
    for (const [step, hhmm] of STEPS) {
      replaceAll(bg());
      const t = timeOf(hhmm);
      const r = setStepTime(WD, step, t);
      if (r.ok) assert.ok(shown(WD, t), `${step} 回報成功，但週二看不到`);
      else assert.ok(['no-session'].includes(r.reason), `${step} 失敗原因不明：${r.reason}`);
    }
  });
}

test('沒有上班紀錄時補「下班」：明確報錯，不會假裝已儲存', () => {
  replaceAll(withWake());
  const r = setStepTime(WD, 'clockOut', at('2026-10-21', '06:00'));
  assert.deepEqual(r, { ok: false, reason: 'no-session' });
});

test('先補「抵達」再補「出門」：只有一段行程，兩個時間都在週二', () => {
  replaceAll(withWake());
  setStepTime(WD, 'arrive', at(WD, '22:30'));
  setStepTime(WD, 'out', at(WD, '22:00'));
  assert.equal(get().journeys.length, 1);
  assert.ok(shown(WD, at(WD, '22:30')));
  assert.ok(shown(WD, at(WD, '22:00')));
});

test('先補行程、後補上班：行程掛到這一班，不會重複顯示', () => {
  replaceAll(withWake());
  setStepTime(WD, 'out', at(WD, '21:00'));
  setStepTime(WD, 'clockIn', at(WD, '21:40'));
  const d = get();
  assert.equal(d.journeys[0].sessionId, d.sessions[0].id);
  const outs = workdayEvents(d, WD, NOW).filter((e) => e.step === 'out');
  assert.equal(outs.length, 1);
});

test('入睡／起床：存完一定在某個工作日看得到（就是提示裡說的那一天）', () => {
  replaceAll(withWake());
  const t1 = at(WD, '12:00');
  const r1 = setStepTime(WD, 'sleepStart', t1);
  assert.equal(r1.ok, true);
  const rec = get().sleeps.find((x) => x.id === r1.sleepId);
  assert.ok(shown(sleepWorkday(rec, get()), t1));
  const t2 = at(WD, '19:00');
  const r2 = setStepTime(WD, 'sleepEnd', t2);
  assert.equal(r2.ok, true);
  const rec2 = get().sleeps.find((x) => x.id === r2.sleepId);
  assert.ok(shown(sleepWorkday(rec2, get()), t2));
});

test('休息：同一段再按儲存（補上結束時間）是更新，不會多一筆', () => {
  replaceAll({ ...emptyData(), jobs: [job], sessions: [{ id: 's', jobId: 'j1', start: at(WD, '22:00'), end: at('2026-10-21', '09:00'), breaks: [], workdayDate: WD, workdayManual: true }] });
  const a = at('2026-10-21', '13:36');
  setStepTime(WD, 'break', a);
  setStepTime(WD, 'break', a, { end: at('2026-10-21', '14:47') });
  const br = get().sessions[0].breaks;
  assert.equal(br.length, 1);
  assert.equal(br[0].end, at('2026-10-21', '14:47'));
  const ev = workdayEvents(get(), WD, NOW).filter((e) => e.kind === 'break');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].detail, '71 分鐘');
});

test('休息：結束早於開始會報錯', () => {
  replaceAll({ ...emptyData(), jobs: [job], sessions: [{ id: 's', jobId: 'j1', start: at(WD, '22:00'), end: null, breaks: [] }] });
  const r = setStepTime(WD, 'break', at(WD, '23:00'), { end: at(WD, '22:30') });
  assert.deepEqual(r, { ok: false, reason: 'break-end-before-start' });
});
