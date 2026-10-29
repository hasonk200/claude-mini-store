// R6：復原是一次新的修改，帶刪除標記／新時間戳，跟雲端合併後不會「回魂」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, update, undo, getRaw, visible, emptyData } from '../js/store.js';
import { mergeData } from '../js/sync.js';

const meal = { id: 'm1', start: 1000, end: 2000, name: '午餐', confirmed: true, updatedAt: 1 };
const seen = (full) => visible(full).meals;

test('新增 → 復原 → 跟新增後的雲端快照合併：0 筆', () => {
  replaceAll(emptyData(), { tombstone: false });
  update((d) => { d.meals.push({ id: 'm1', start: 1000, name: '午餐' }); });
  const cloud = structuredClone(getRaw()); // 新增後已上傳的雲端快照
  assert.equal(undo(), true);
  const raw = getRaw();
  assert.ok(raw.meals.find((m) => m.id === 'm1').deletedAt, '復原後要留下刪除標記');
  assert.equal(seen(raw).length, 0);
  assert.equal(seen(mergeData(raw, cloud)).length, 0);
  // 另一部裝置拿到雲端快照，再合併這邊的結果，也要是 0 筆。
  assert.equal(seen(mergeData(cloud, raw)).length, 0);
});

test('刪除 → 復原 → 合併：1 筆', () => {
  replaceAll({ ...emptyData(), meals: [meal] }, { tombstone: false });
  update((d) => { d.meals = []; });
  const cloud = structuredClone(getRaw());
  assert.ok(cloud.meals[0].deletedAt);
  undo();
  const raw = getRaw();
  assert.equal(seen(raw).length, 1);
  assert.ok(raw.meals[0].updatedAt > cloud.meals[0].updatedAt, '還原的紀錄要有新的時間戳');
  assert.equal(seen(mergeData(raw, cloud)).length, 1);
  assert.equal(seen(mergeData(cloud, raw)).length, 1);
});

test('修改 → 復原 → 合併：保持舊值', () => {
  replaceAll({ ...emptyData(), meals: [meal] }, { tombstone: false });
  update((d) => { d.meals[0].name = '晚餐'; });
  const cloud = structuredClone(getRaw());
  undo();
  const raw = getRaw();
  assert.equal(seen(raw)[0].name, '午餐');
  assert.equal(seen(mergeData(raw, cloud))[0].name, '午餐');
  assert.equal(seen(mergeData(cloud, raw))[0].name, '午餐');
});

test('沒有上一步：undo 回傳 false；同一步不能復原兩次', () => {
  replaceAll(emptyData(), { tombstone: false });
  assert.equal(undo(), false);
  update((d) => { d.meals.push({ id: 'm2', start: 1 }); });
  assert.equal(undo(), true);
  assert.equal(undo(), false);
});

test('早已刪除的紀錄（舊刪除標記）復原後保持刪除', () => {
  const old = { id: 'm0', start: 1, deletedAt: 5, updatedAt: 5 };
  replaceAll({ ...emptyData(), meals: [old] }, { tombstone: false });
  update((d) => { d.meals.push({ id: 'm3', start: 2 }); });
  undo();
  const raw = getRaw();
  assert.deepEqual(raw.meals.find((m) => m.id === 'm0'), old);
  assert.equal(seen(raw).length, 0);
});
