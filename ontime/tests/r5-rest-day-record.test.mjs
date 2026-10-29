// R5：休息日（這天沒有班次）用「＋」打開補登，不會被強制跳去新增班次，睡眠、用餐照樣可以揀。
// 第二輪改成「先揀類別」之後，同一個要求仍然成立。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { sheetView, openRecordSheet } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const wd = '2026-10-24';
const now = at('2026-10-24', '15:00');
const render = (data, sheet) => sheetView({ data, now, ui: { drafts: {}, sheet: { type: 'record', wd, ...sheet } } });

test('空白日用一般「＋」打開：先問要補什麼，不會出現新增班次表單', () => {
  const data = emptyData();
  const sheet = openRecordSheet(data, wd, null);
  assert.equal(sheet.cat, null);
  const html = render(data, sheet);
  assert.doesNotMatch(html, /data-form="new-shift"/);
  for (const k of ['work', 'commute', 'sleep', 'meal']) {
    const chip = html.match(new RegExp(`<button[^>]*data-cat="${k}"[^>]*>`))[0];
    assert.doesNotMatch(chip, /disabled/, `${k} 不應該被停用`);
  }
});

test('通勤類別但沒有班次：表單位置是提示加「＋ 新增班次」，睡眠、用餐類別仍然可以揀', () => {
  const html = render(emptyData(), { cat: 'commute', step: 'out' });
  const note = html.slice(html.lastIndexOf('<div class="sheet-note">'));
  assert.match(note, /要先有班次/);
  assert.match(note, /data-action="rec-newshift"/);
  assert.doesNotMatch(html, /data-form="record"/);
  assert.doesNotMatch(html.match(/<button[^>]*data-cat="sleep"[^>]*>/)[0], /disabled/);
  assert.match(html.match(/<button[^>]*data-step="out"[^>]*>/)[0], /disabled/);
});

test('揀了睡眠 → 只補入睡：直接出現補登表單', () => {
  const html = render(emptyData(), { cat: 'sleep', step: 'sleepStart' });
  assert.match(html, /data-form="record"/);
  assert.match(html, /name="step" value="sleepStart"/);
  assert.doesNotMatch(html, /data-form="new-shift"/);
});

test('明確按了「＋ 新增班次」才換成新增班次表單', () => {
  const html = render(emptyData(), { cat: 'commute', step: 'out', newShift: true });
  assert.match(html, /data-form="new-shift"/);
});
