// R1：修改面板（ref-time）的「當作工作日分界」勾選要真的存下來。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setRefTime } from '../js/actions.js';
import { sheetView } from '../js/views/sheet.js';
import { dayBoundaries } from '../js/logic.js';
import { at } from '../js/time.js';

const nap = () => ({ id: 'sl1', start: at('2026-10-21', '01:39'), end: at('2026-10-21', '05:23') });

test('修改睡眠時間時勾選分界：mainSleep 存成 true，工作日由這次起床切開', () => {
  replaceAll({ ...emptyData(), sleeps: [nap()] });
  const r = setRefTime({ type: 'sleep', id: 'sl1', field: 'end' }, at('2026-10-21', '05:30'), { mainSleep: true });
  assert.equal(r.ok, true);
  const s = get().sleeps[0];
  assert.equal(s.mainSleep, true);
  assert.equal(s.end, at('2026-10-21', '05:30'));
  assert.deepEqual(dayBoundaries(get()), [at('2026-10-21', '05:30')]);
});

test('取消勾選：mainSleep 改回 false', () => {
  replaceAll({ ...emptyData(), sleeps: [{ ...nap(), mainSleep: true }] });
  setRefTime({ type: 'sleep', id: 'sl1', field: 'end' }, at('2026-10-21', '05:23'), { mainSleep: false });
  assert.equal(get().sleeps[0].mainSleep, false);
});

test('修改面板顯示勾選框，並反映目前的 mainSleep', () => {
  const data = { ...emptyData(), sleeps: [{ ...nap(), mainSleep: true }] };
  const html = sheetView({ data, now: at('2026-10-21', '12:00'), ui: { sheet: { type: 'ref', ref: { type: 'sleep', id: 'sl1', field: 'end' }, t: data.sleeps[0].end, title: '起床' } } });
  assert.match(html, /<input type="checkbox" name="mainSleep" checked>/);
});
