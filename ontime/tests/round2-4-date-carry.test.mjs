// 第二輪 4：日期承接——切到舊工作日時，補登和用餐新表單沿用所選日期並預覽歸屬；
// 即時打卡的按鈕講明是「記錄現在」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { timeOnWorkday } from '../js/logic.js';
import { sheetView, freePreviewText } from '../js/views/sheet.js';
import { mealsView } from '../js/views/meals.js';
import { todayView } from '../js/views/today.js';
import { at } from '../js/time.js';

const now = at('2026-10-29', '08:54'); // 週四
const past = '2026-10-24'; // 週六

test('看的是現在這個工作日：預設用現在；切到週六：日期用週六、時間用現在的時分', () => {
  const d = emptyData();
  assert.equal(timeOnWorkday(d, '2026-10-29', now), now);
  assert.equal(timeOnWorkday(d, past, now), at(past, '08:54'));
});

test('補登面板（只補入睡）在舊工作日：日期是那一天，並預覽「補 週六 10/24 工作日」', () => {
  const html = sheetView({ data: emptyData(), now, ui: { drafts: {}, sheet: { type: 'record', wd: past, cat: 'sleep', step: 'sleepStart' } } });
  assert.match(html, /name="date" value="2026-10-24"/);
  assert.match(html, /會存成 <strong>週六 10\/24 08:54<\/strong> · 補 週六 10\/24 工作日/);
});

test('補登面板的用餐、睡眠表單也沿用那一天', () => {
  const meal = sheetView({ data: emptyData(), now, ui: { drafts: {}, sheet: { type: 'record', wd: past, cat: 'meal' } } });
  assert.match(meal, /name="date" value="2026-10-24"/);
  const sleep = sheetView({ data: emptyData(), now, ui: { drafts: {}, sheet: { type: 'record', wd: past, cat: 'sleep' } } });
  assert.match(sleep, /name="sd" value="2026-10-24"/);
});

test('用餐頁切到週六：新表單日期是週六，預覽歸屬週六工作日', () => {
  const html = mealsView({ data: emptyData(), now, ui: { drafts: {} }, wd: past, isDesktop: false });
  assert.match(html, /name="date" value="2026-10-24"/);
  assert.match(html, /會存成 <strong>週六 10\/24 08:54<\/strong> · 歸屬 週六 10\/24 工作日/);
});

test('預覽在日期跟工作日不同時加標記', () => {
  assert.match(freePreviewText(at('2026-10-25', '02:00'), past), /隔日/);
  assert.match(freePreviewText(at('2026-10-23', '22:00'), past), /前一日/);
});

test('今天頁切到舊工作日：打卡按鈕講明記錄的是現在；看今天時不顯示', () => {
  const old = todayView({ data: emptyData(), now, ui: { wd: past }, wd: past, isDesktop: false });
  assert.match(old, /這裡的按鈕記錄的是<strong>現在 週四 10\/29 08:54<\/strong>，不是 週六 10\/24/);
  assert.match(old, /直接上班 · 現在/);
  assert.match(old, /補登 週六 10\/24 的時間/);
  const today = todayView({ data: emptyData(), now, ui: {}, wd: '2026-10-29', isDesktop: false });
  assert.doesNotMatch(today, /這裡的按鈕記錄的是/);
  assert.match(today, /記錄出門 · 現在/);
});
