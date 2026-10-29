// 第二輪 5：用餐草稿保留——日期、時間、文字、相片都從草稿重畫，
// 加相片、同步、重畫、切換分頁都不會清空未儲存的輸入。
// （草稿怎樣被記下來要在瀏覽器測；這裡測「有草稿時畫面一定用草稿」。）
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { mealsView, mealForm } from '../js/views/meals.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const now = at('2026-10-24', '15:00');
const draft = { date: '2026-10-23', start: '1930', end: '20:10', confirmed: '1', name: '拉麵', place: '家', note: '加蛋', verified: true, photo: 'data:image/jpeg;base64,AAAA' };

test('新增表單：重畫時用草稿的日期、時間、文字和相片', () => {
  const html = mealsView({ data: emptyData(), now, ui: { drafts: { 'meal:new': draft } }, wd: '2026-10-24', isDesktop: false });
  assert.match(html, /name="date" value="2026-10-23"/);
  assert.match(html, /name="start" value="1930"/);
  assert.match(html, /name="end" value="20:10"/);
  assert.match(html, /name="name" value="拉麵"/);
  assert.match(html, /name="place" value="家"/);
  assert.match(html, /<textarea name="note" rows="2">加蛋<\/textarea>/);
  assert.match(html, /name="verified" checked/);
  assert.match(html, /<img class="photo-preview" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /data-action="draft-clear" data-key="meal:new"/);
  // 預覽用草稿的時間（1930 也看得懂）
  assert.match(html, /會存成 <strong>週五 10\/23 19:30<\/strong>/);
});

test('修改一餐：草稿蓋過已存的值；草稿把相片移除時不再顯示舊相片', () => {
  const data = { ...emptyData(), meals: [{ id: 'm', start: at('2026-10-24', '12:00'), name: '便當', photo: 'data:image/jpeg;base64,OLD', confirmed: true }] };
  const html = sheetView({ data, now, ui: { drafts: { 'meal:m': { name: '飯糰', photo: null } }, sheet: { type: 'meal', id: 'm' } } });
  assert.match(html, /name="name" value="飯糰"/);
  assert.match(html, /name="start" value="12:00"/);
  assert.doesNotMatch(html, /OLD/);
});

test('沒有草稿：用預設值，不出現清除按鈕', () => {
  const html = mealForm({ data: emptyData(), now, ui: { drafts: {} }, key: 'meal:new' });
  assert.match(html, /name="date" value="2026-10-24"/);
  assert.doesNotMatch(html, /draft-clear/);
});

test('表單帶 data-draft，草稿以表單為單位（新增與修改分開）', () => {
  assert.match(mealForm({ data: emptyData(), now, ui: {}, key: 'meal:new' }), /data-form="meal" data-draft="meal:new"/);
});
