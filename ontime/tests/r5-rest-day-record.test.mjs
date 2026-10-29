// R5：休息日（這天沒有班次）用「＋」打開補登，不會被強制跳去新增班次，睡眠、用餐照樣可以揀。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { sheetView, defaultStep } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const wd = '2026-10-24';
const now = at('2026-10-24', '15:00');
const render = (data, sheet) => sheetView({ data, now, ui: { sheet: { type: 'record', wd, ...sheet } } });

test('空白日用預設步驟（出門）打開：步驟選項照樣顯示，睡眠、用餐可以揀', () => {
  const data = emptyData();
  const step = defaultStep(data, wd);
  const html = render(data, { step });
  assert.doesNotMatch(html, /data-form="new-shift"/);
  assert.match(html, /先選要補哪一個/);
  for (const k of ['sleepStart', 'sleepEnd', 'meal']) {
    const chip = html.match(new RegExp(`<button[^>]*data-step="${k}"[^>]*>`))[0];
    assert.doesNotMatch(chip, /disabled/, `${k} 不應該被停用`);
  }
  // 跟班次有關的步驟仍然停用，寫「先選班次」。
  assert.match(html.match(/<button[^>]*data-step="out"[^>]*>/)[0], /disabled/);
  assert.match(html, /先選班次/);
});

test('選中的步驟需要班次：表單位置是提示加「＋ 新增班次」按鈕', () => {
  const html = render(emptyData(), { step: 'out' });
  const note = html.slice(html.lastIndexOf('<div class="sheet-note">'));
  assert.match(note, /要先有班次/);
  assert.match(note, /data-action="rec-newshift"/);
  assert.doesNotMatch(html, /data-form="record"/);
});

test('揀了入睡：直接出現補登表單', () => {
  const html = render(emptyData(), { step: 'sleepStart' });
  assert.match(html, /data-form="record"/);
  assert.match(html, /name="step" value="sleepStart"/);
  assert.doesNotMatch(html, /data-form="new-shift"/);
});

test('明確按了「＋ 新增班次」才換成新增班次表單', () => {
  const html = render(emptyData(), { step: 'out', newShift: true });
  assert.match(html, /data-form="new-shift"/);
  assert.doesNotMatch(html, /先選要補哪一個/);
});
