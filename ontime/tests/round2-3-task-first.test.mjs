// 第二輪 3：任務先行的補登——先揀類別（工作／通勤／睡眠／用餐），
// 只有工作和通勤要揀班次；按鈕是「儲存並繼續」「儲存並關閉」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { sheetView, openRecordSheet, catOf, defaultStepIn } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const wd = '2026-10-24';
const now = at('2026-10-24', '15:00');
const withShift = () => ({
  ...emptyData(), jobs: [{ id: 'j', name: 'x' }],
  sessions: [{ id: 's', jobId: 'j', start: at(wd, '09:00'), end: at(wd, '14:00'), breaks: [], workdayDate: wd, workdayManual: true }]
});
const render = (data, sheet) => sheetView({ data, now, ui: { drafts: {}, sheet: { type: 'record', wd, ...sheet } } });

test('類別對應', () => {
  assert.equal(catOf('clockOut'), 'work');
  assert.equal(catOf('ride2'), 'commute');
  assert.equal(catOf('sleepPair'), 'sleep');
  assert.equal(catOf('meal'), 'meal');
});

test('這天有班次：一般「＋」預先揀好最需要補的類別', () => {
  const sh = openRecordSheet(withShift(), wd, null);
  assert.equal(sh.cat, 'commute');
  assert.equal(sh.step, 'out');
  assert.equal(openRecordSheet(withShift(), wd, 'sleepPair').cat, 'sleep');
});

test('睡眠：不顯示選班次，預設「一段睡眠」，直接出現入睡＋起床表單', () => {
  const html = render(withShift(), { cat: 'sleep' });
  assert.doesNotMatch(html, /<\/span>選班次<\/div>/);
  assert.doesNotMatch(html, /shift-chips/);
  assert.match(html, /data-form="sleep-pair"/);
  assert.match(html, /儲存並繼續/);
  assert.match(html, /儲存並關閉/);
});

test('用餐：不顯示選班次，表單直接在面板裡', () => {
  const html = render(emptyData(), { cat: 'meal' });
  assert.doesNotMatch(html, /<\/span>選班次<\/div>/);
  assert.match(html, /data-form="meal"/);
  assert.match(html, /value="stay">儲存並繼續/);
  assert.doesNotMatch(html, /前往記一餐/);
});

test('工作：要先選班次，只列出工作相關的步驟', () => {
  const html = render(withShift(), { cat: 'work' });
  assert.match(html, /<\/span>選班次<\/div>/);
  assert.match(html, /data-step="clockIn"/);
  assert.doesNotMatch(html, /data-step="out"/);
  assert.doesNotMatch(html, /data-step="sleepStart"/);
  assert.match(html, /value="stay">儲存並繼續/);
  assert.match(html, /value="close">儲存並關閉/);
  assert.equal(defaultStepIn(withShift(), wd, 'work'), 'clockOut');
});
