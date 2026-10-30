// 用餐可以手動指定歸屬工作日（同睡眠、班次一致）：
// 補登面板揀 10/28 工作日、用餐 10/29 10:10 → 歸屬 10/28；可以改返自動；同步、匯入匯出都保留。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, getRaw, emptyData, visible } from '../js/store.js';
import { saveMeal, exportJSON, parseBackup } from '../js/actions.js';
import { mealWorkday, mealAutoWorkday } from '../js/logic.js';
import { mergeData } from '../js/sync.js';
import { mealPreview, mealsView } from '../js/views/meals.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const now = at('2026-10-30', '12:00');
const t = at('2026-10-29', '10:10');

test('補登面板揀 10/28、用餐 10/29 10:10：歸屬 10/28，標成手動指定', () => {
  replaceAll(emptyData());
  const id = saveMeal({ start: t, name: '早餐', workday: '2026-10-28' }, now);
  const m = get().meals.find((x) => x.id === id);
  assert.equal(m.workdayDate, '2026-10-28');
  assert.equal(m.workdayManual, true);
  assert.equal(mealWorkday(m, get(), now), '2026-10-28');
  assert.equal(mealAutoWorkday(m, get(), now), '2026-10-29');
});

test('揀的工作日同自動推算一樣：唔標手動，保持自動', () => {
  replaceAll(emptyData());
  const id = saveMeal({ start: t, workday: '2026-10-29' }, now);
  const m = get().meals.find((x) => x.id === id);
  assert.equal('workdayManual' in m, false);
  assert.equal('workdayDate' in m, false);
});

test('改返自動：清除手動指定，歸屬回到 10/29', () => {
  replaceAll(emptyData());
  const id = saveMeal({ start: t, workday: '2026-10-28' }, now);
  saveMeal({ id, workday: null }, now);
  const m = get().meals.find((x) => x.id === id);
  assert.equal('workdayManual' in m, false);
  assert.equal(mealWorkday(m, get(), now), '2026-10-29');
});

test('只改名唔傳 workday：手動歸屬保持不變', () => {
  replaceAll(emptyData());
  const id = saveMeal({ start: t, workday: '2026-10-28' }, now);
  saveMeal({ id, name: '改名' }, now);
  assert.equal(get().meals.find((x) => x.id === id).workdayDate, '2026-10-28');
});

test('同步合併後手動指定仍然保留（兩個方向）', () => {
  // 雲端：舊版本（自動）；本機：較新、手動指定 10/28。
  replaceAll({ ...emptyData(), meals: [{ id: 'm', start: t, name: '早餐', confirmed: true, updatedAt: 1 }] }, { tombstone: false });
  const cloud = structuredClone(getRaw());
  saveMeal({ id: 'm', workday: '2026-10-28' }, now);
  const local = getRaw();
  for (const merged of [mergeData(local, cloud), mergeData(cloud, local)]) {
    const m = visible(merged).meals[0];
    assert.equal(m.workdayManual, true);
    assert.equal(mealWorkday(m, visible(merged), now), '2026-10-28');
  }
});

test('匯出再匯入保留手動歸屬；舊資料冇呢兩個欄位照舊自動推算', () => {
  replaceAll(emptyData());
  saveMeal({ start: t, workday: '2026-10-28' }, now);
  const back = parseBackup(exportJSON());
  assert.equal(back.meals[0].workdayDate, '2026-10-28');
  assert.equal(back.meals[0].workdayManual, true);
  const old = { ...emptyData(), meals: [{ id: 'o', start: t, confirmed: true }] };
  assert.equal(mealWorkday(old.meals[0], old, now), '2026-10-29');
});

test('預覽：同自動唔同就寫「（手動指定）」；一樣就唔寫', () => {
  const d = emptyData();
  assert.match(mealPreview(d, t, now, { wd: '2026-10-28', mode: 'sheet' }), /歸屬 週三 10\/28 工作日（手動指定）/);
  assert.doesNotMatch(mealPreview(d, t, now, { wd: '2026-10-29', mode: 'sheet' }), /手動指定/);
  assert.match(mealPreview(d, t, now, { wd: '2026-10-28', mode: 'auto' }), /歸屬 週四 10\/29 工作日$/);
});

test('補登面板（用餐）：用頂部工作日，預覽即時顯示手動指定', () => {
  const html = sheetView({ data: emptyData(), now, ui: { drafts: { 'meal:new': { date: '2026-10-29', start: '10:10' } }, sheet: { type: 'record', wd: '2026-10-28', cat: 'meal' } } });
  assert.match(html, /<input type="hidden" name="wd" value="2026-10-28"><input type="hidden" name="wdMode" value="sheet" data-keep>/);
  assert.match(html, /歸屬 週三 10\/28 工作日（手動指定）/);
});

test('修改面板：手動歸屬可以改返自動；自動的顯示「自動推算」', () => {
  const data = { ...emptyData(), meals: [
    { id: 'a', start: t, name: '早餐', confirmed: true, workdayDate: '2026-10-28', workdayManual: true },
    { id: 'b', start: t, name: '午餐', confirmed: true }
  ] };
  const a = sheetView({ data, now, ui: { drafts: {}, sheet: { type: 'meal', id: 'a' } } });
  assert.match(a, /name="wd" value="2026-10-28"/);
  assert.match(a, /name="wdMode" value="manual"/);
  assert.match(a, /data-action="meal-wd-auto">改返自動/);
  assert.match(a, /（手動指定）/);
  const b = sheetView({ data, now, ui: { drafts: {}, sheet: { type: 'meal', id: 'b' } } });
  assert.match(b, /name="wd" value="2026-10-29"/);
  assert.match(b, /自動推算/);
  // 草稿已經「改返自動」：重畫時用草稿，不再顯示手動
  const c = sheetView({ data, now, ui: { drafts: { 'meal:a': { wdMode: 'auto', wd: '2026-10-29' } }, sheet: { type: 'meal', id: 'a' } } });
  assert.match(c, /name="wdMode" value="auto"/);
  assert.doesNotMatch(c, /（手動指定）/);
});

test('用餐頁：10/28 工作日列出這一餐，並標明手動歸屬同實際日期', () => {
  const data = { ...emptyData(), meals: [{ id: 'a', start: t, name: '早餐', confirmed: true, workdayDate: '2026-10-28', workdayManual: true }] };
  const html = mealsView({ data, now, ui: { drafts: {} }, wd: '2026-10-28', isDesktop: false });
  assert.match(html, /data-id="a"/);
  assert.match(html, /週四 10\/29<\/small>/);
  assert.match(html, /chip chip-soft">手動歸屬</);
  const other = mealsView({ data, now, ui: { drafts: {} }, wd: '2026-10-29', isDesktop: false });
  assert.doesNotMatch(other, /data-action="meal-open" data-id="a"/);
});
