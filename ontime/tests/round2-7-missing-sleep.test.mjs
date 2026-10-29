// 第二輪 7：缺少睡眠紀錄時，不顯示誤導的「已清醒好耐」或「過去 24 小時睡了 0」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { todayView, heroFor } from '../js/views/today.js';
import { currentCycle } from '../js/logic.js';
import { at } from '../js/time.js';

const now = at('2026-10-24', '15:00');
const view = (d) => todayView({ data: d, now, ui: {}, wd: '2026-10-24', isDesktop: false });

test('完全沒有睡眠紀錄：兩格都寫「未記錄」，有補記睡眠入口，沒有 0h', () => {
  const html = view(emptyData());
  assert.doesNotMatch(html, /已清醒/);
  assert.match(html, /距離上次記錄起床/);
  assert.equal((html.match(/metric-value metric-text">未記錄/g) || []).length, 2);
  assert.match(html, /data-action="open-record" data-step="sleepPair">補記睡眠/);
  assert.doesNotMatch(html, /過去 24 小時睡了<\/span><span class="metric-value[^"]*"[^>]*>0/);
});

test('上次起床是三天前：顯示「距離上次記錄起床」並提示可能漏記；24 小時內沒紀錄寫未記錄', () => {
  const d = { ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-20', '23:00'), end: at('2026-10-21', '07:00') }] };
  const html = view(d);
  assert.match(html, /距離上次記錄起床/);
  assert.match(html, /上次記錄起床 週三 10\/21 07:00 · 可能漏記了睡眠/);
  assert.match(html, /這 24 小時沒有睡眠紀錄/);
  const hero = heroFor(d, '2026-10-24', currentCycle(d, now), now);
  assert.match(hero, /距離上次記錄起床/);
  assert.doesNotMatch(hero, /已清醒/);
});

test('昨晚有睡：照常顯示時數，不出補記按鈕', () => {
  const d = { ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-23', '23:30'), end: at('2026-10-24', '07:30') }] };
  const html = view(d);
  assert.match(html, /分 1 段/);
  assert.doesNotMatch(html, /補記睡眠/);
});
