// R7：週日 23:00 → 週一 07:00 的夜班，在由週一開始的一週裡，週一要顯示 7 小時（按日曆日）；
// 工時總數、收入、班數仍按開班日期，算在上一週。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { periodStats } from '../js/logic.js';
import { statsView } from '../js/views/stats.js';
import { emptyData } from '../js/store.js';
import { at, HOUR } from '../js/time.js';

const data = () => ({
  ...emptyData(),
  jobs: [{ id: 'j1', name: 'x', payMode: 'perOrder' }],
  sessions: [
    // 週日 10/18 23:00 → 週一 10/19 07:00
    { id: 'a', jobId: 'j1', start: at('2026-10-18', '23:00'), end: at('2026-10-19', '07:00'), breaks: [], payMode: 'perOrder', income: 120, orders: 9 },
    // 週日 10/25 22:00 → 週一 10/26 02:00（跨出這一週）
    { id: 'b', jobId: 'j1', start: at('2026-10-25', '22:00'), end: at('2026-10-26', '02:00'), breaks: [], payMode: 'perOrder', income: 40, orders: 3 }
  ]
});
const now = at('2026-10-28', '12:00');

test('由週一開始的一週：週一包括上週日帶過來的 7 小時', () => {
  const st = periodStats(data(), '2026-10-19', '2026-10-26', now);
  assert.equal(st.byDay['2026-10-19'], 7 * HOUR);
  assert.equal(st.carryByDay['2026-10-19'], 7 * HOUR);
  // 週日開的班只計週日那 2 小時；跨出期間的週一不計。
  assert.equal(st.byDay['2026-10-25'], 2 * HOUR);
  assert.equal(st.byDay['2026-10-26'], undefined);
});

test('工時總數、收入、班數仍按開班日期', () => {
  const st = periodStats(data(), '2026-10-19', '2026-10-26', now);
  assert.deepEqual(st.sessions.map((s) => s.id), ['b']);
  assert.equal(st.workMs, 4 * HOUR);
  assert.equal(st.income, 40);
  assert.equal(st.orders, 3);
  const prev = periodStats(data(), '2026-10-12', '2026-10-19', now);
  assert.equal(prev.workMs, 8 * HOUR);
  assert.equal(prev.income, 120);
  assert.equal(prev.byDay['2026-10-18'], 1 * HOUR);
  assert.equal(prev.byDay['2026-10-19'], undefined);
});

test('待補收工的班不會因為重疊判斷而算出工時', () => {
  const d = data();
  d.sessions.push({ id: 'c', jobId: 'j1', start: at('2026-10-18', '20:00'), end: null, endPending: true, breaks: [], payMode: 'none' });
  const st = periodStats(d, '2026-10-19', '2026-10-26', now);
  assert.equal(st.byDay['2026-10-19'], 7 * HOUR);
});

test('統計頁標明哪個按日曆日、哪個按開班日', () => {
  const html = statsView({ data: data(), now, ui: { statsPeriod: 'week', statsOffset: -1 } });
  assert.match(html, /實際工時（按開班日）/);
  assert.match(html, /每個日曆日的工時（按日曆日）/);
  // 週一棒形顯示 7 小時，而且整段算作「前一工作日帶過來」（深色）。
  assert.match(html, /<span class="bar-val">7h00m<\/span><div class="bar-slot stack-bar"><i class="k-work-light" style="height:0%"><\/i><i class="k-work" style="height:100%"><\/i>/);
});
