// 第二輪 2：列表直接修改——點整筆就打開修改面板；刪除放在面板裡做次要動作；
// 剛改好的那一筆在原位亮一下（is-flash）。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { saveSleepPlan, saveMeal } from '../js/actions.js';
import { sleepView } from '../js/views/sleep.js';
import { mealsView } from '../js/views/meals.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const now = at('2026-10-24', '15:00');
const data = () => ({
  ...emptyData(),
  sleeps: [
    { id: 'a', start: at('2026-10-23', '23:00'), end: at('2026-10-24', '07:00') },
    { id: 'p', start: null, end: null, planStart: at('2026-10-24', '23:00'), planEnd: at('2026-10-25', '07:00') }
  ],
  meals: [{ id: 'm', start: at('2026-10-24', '12:00'), end: at('2026-10-24', '12:30'), name: '便當', place: '公司', confirmed: true }]
});

test('最近睡眠（手機）：每筆是可點的一行，列表上沒有刪除按鈕；剛改好的那行有標示和「已更新」', () => {
  const html = sleepView({ data: data(), now, ui: { drafts: {}, flash: 'sleep:a' }, wd: '2026-10-24', isDesktop: false });
  assert.match(html, /<li class="is-flash"><button type="button" class="rec-row" data-action="sleep-open" data-id="a"/);
  assert.match(html, /已更新/);
  assert.match(html, /<li class="row-click" data-action="sleep-open" data-id="p">/);
  assert.doesNotMatch(html, /data-action="sleep-delete"/);
});

test('最近睡眠（桌面）：表格整行可點', () => {
  const html = sleepView({ data: data(), now, ui: { drafts: {}, flash: 'sleep:a' }, wd: '2026-10-24', isDesktop: true });
  assert.match(html, /<tr class="row-click is-flash" data-action="sleep-open" data-id="a">/);
  assert.doesNotMatch(html, /data-action="sleep-delete"/);
});

test('睡眠修改面板：入睡、起床一起改；刪除在底部', () => {
  const html = sheetView({ data: data(), now, ui: { drafts: {}, sheet: { type: 'sleep', id: 'a' } } });
  assert.match(html, /修改這筆睡眠/);
  assert.match(html, /name="sd" value="2026-10-23"/);
  assert.match(html, /name="et" value="07:00"/);
  assert.ok(html.indexOf('儲存修改') < html.indexOf('刪除這筆睡眠'));
  assert.match(html, /class="btn btn-text-danger btn-block" data-action="sleep-delete" data-id="a"/);
});

test('計畫也可以點來修改；起床早過入睡要拒絕', () => {
  const html = sheetView({ data: data(), now, ui: { drafts: {}, sheet: { type: 'sleep', id: 'p' } } });
  assert.match(html, /data-form="sleep-plan-edit"/);
  replaceAll(data());
  assert.equal(saveSleepPlan('p', at('2026-10-24', '23:30'), at('2026-10-24', '22:00')).reason, 'before-start');
  assert.equal(saveSleepPlan('p', at('2026-10-24', '23:30'), at('2026-10-25', '07:30')).ok, true);
  assert.equal(get().sleeps.find((x) => x.id === 'p').planStart, at('2026-10-24', '23:30'));
});

test('用餐列表：點一餐就打開修改，列表上不再有刪除；修改面板保留原本的內容', () => {
  const html = mealsView({ data: data(), now, ui: { drafts: {}, flash: 'meal:m' }, wd: '2026-10-24', isDesktop: false });
  assert.match(html, /<li class="is-flash"><button type="button" class="rec-row meal-row" data-action="meal-open" data-id="m"/);
  assert.doesNotMatch(html, /data-action="meal-delete" data-id="m"/);
  const sheet = sheetView({ data: data(), now, ui: { drafts: {}, sheet: { type: 'meal', id: 'm' } } });
  assert.match(sheet, /修改這一餐/);
  assert.match(sheet, /name="name" value="便當"/);
  assert.match(sheet, /name="start" value="12:00"/);
  assert.match(sheet, /data-action="meal-delete" data-id="m">刪除這一餐/);
});

test('saveMeal 回傳 id（新增和修改都有），畫面用來標亮', () => {
  replaceAll(data());
  assert.equal(saveMeal({ id: 'm', name: '飯糰' }), 'm');
  const id = saveMeal({ start: at('2026-10-24', '19:00'), name: '晚餐' });
  assert.ok(get().meals.some((x) => x.id === id && x.name === '晚餐'));
});
