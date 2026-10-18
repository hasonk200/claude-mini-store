// 取代匯入要能在雲端同步時真的刪掉紀錄。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, getRaw, visible, emptyData } from '../js/store.js';

const ses = (id) => ({ id, jobId: 'j1', start: 1, end: 2, breaks: [] });

test('取代匯入會替被移除的紀錄留下刪除標記（雲端才刪得掉）', () => {
  replaceAll({ ...emptyData(), sessions: [ses('ses_a')] });
  assert.equal(getRaw().sessions.length, 1);

  replaceAll({ ...emptyData(), sessions: [] });
  const raw = getRaw();
  assert.equal(raw.sessions.length, 1, '先留著墓碑，才能同步刪除');
  assert.ok(raw.sessions[0].deletedAt > 0);
  assert.equal(visible(raw).sessions.length, 0, '畫面上要看不到');
});

test('套用雲端資料時不會誤標刪除', () => {
  replaceAll({ ...emptyData(), sessions: [ses('ses_b')] });
  replaceAll({ ...emptyData(), sessions: [] }, { tombstone: false });
  assert.equal(getRaw().sessions.length, 0);
});
