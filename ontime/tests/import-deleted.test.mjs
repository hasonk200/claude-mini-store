// 匯入備份時，已刪除（deletedAt）的紀錄必須維持已刪除，不能復活。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, getRaw, emptyData } from '../js/store.js';
import { importJSON } from '../js/actions.js';
import { at } from '../js/time.js';

const LATER = Date.now() + 60000; // 備份裡的刪除時間比目前紀錄新
const alive = { id: 'a', start: at('2026-10-16', '17:16'), end: null };
const gone = { id: 'g', start: at('2026-10-16', '17:01'), end: null, deletedAt: LATER, updatedAt: LATER };
const backup = () => JSON.stringify({ app: 'ONTIME', data: { ...emptyData(), sleeps: [{ ...alive, deletedAt: LATER, updatedAt: LATER }, gone] } });

for (const mode of ['replace', 'merge']) {
  test(`匯入（${mode}）：備份裡已刪除的紀錄不會復活`, () => {
    replaceAll({ ...emptyData(), sleeps: [alive] });
    importJSON(backup(), mode);
    assert.equal(get().sleeps.length, 0, '可見資料裡不該有任何睡眠');
    const raw = getRaw().sleeps;
    assert.ok(raw.every((s) => s.deletedAt), '兩筆都要保留刪除標記');
  });
}
