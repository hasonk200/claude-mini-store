// 第三輪：介面精修——緊湊首頁、內容次序、補登面板、手機列表、用語標記、
// 驗證按鈕可點範圍、同步狀態入口、不閃爍、鍵盤與讀屏標籤。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData } from '../js/store.js';
import { pendingItems } from '../js/logic.js';
import { stateTag, STATE_TEXT } from '../js/ui.js';
import { syncSummary } from '../js/views/shared.js';
import { todayView, heroFor } from '../js/views/today.js';
import { sheetView } from '../js/views/sheet.js';
import { sleepView } from '../js/views/sleep.js';
import { mealsView } from '../js/views/meals.js';
import { timelineView } from '../js/views/timeline.js';
import { currentCycle } from '../js/logic.js';
import { at } from '../js/time.js';

const now = at('2026-10-24', '15:00');
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const rich = () => ({
  ...emptyData(),
  jobs: [{ id: 'j1', name: '倉庫' }, { id: 'j2', name: '外送' }],
  shifts: [{ id: 'sh', jobId: 'j1', start: at('2026-10-26', '09:00'), end: at('2026-10-26', '17:00') }],
  sessions: [{ id: 'sp', jobId: 'j2', start: at('2026-10-21', '18:00'), end: null, endPending: true, breaks: [], workdayDate: '2026-10-21', workdayManual: true }],
  meals: [{ id: 'm1', start: at('2026-10-24', '12:00'), name: '午餐', confirmed: false }, { id: 'm2', start: at('2026-10-24', '19:00'), name: '晚餐', confirmed: false }],
  sleeps: [{ id: 'z', start: at('2026-10-23', '23:30'), end: at('2026-10-24', '07:20') }]
});
const today = (d, extra = {}) => todayView({ data: d, now, ui: {}, wd: '2026-10-24', isDesktop: false, ...extra });

test('需要補的紀錄：待補收工、計畫中但已過時間的餐；未來的餐不算', () => {
  const items = pendingItems(rich(), now);
  assert.deepEqual(items.map((x) => x.kind).sort(), ['meal', 'pending-end']);
  assert.equal(items.find((x) => x.kind === 'meal').id, 'm1');
  const none = pendingItems({ ...emptyData(), sleeps: [] }, now);
  assert.deepEqual(none.map((x) => x.kind), ['sleep']);
});

test('手機首頁次序：現在狀態 → 需要補的紀錄 → 下一件事 → 詳細', () => {
  const html = today(rich());
  const pos = (s) => html.indexOf(s);
  assert.ok(pos('aria-label="現在狀態"') < pos('aria-label="需要補的紀錄"'));
  assert.ok(pos('aria-label="需要補的紀錄"') < pos('aria-label="下一件事"'));
  assert.ok(pos('aria-label="下一件事"') < pos('class="section-label">詳細'));
  assert.ok(pos('class="section-label">詳細') < pos('aria-label="工作日作息"'));
  assert.match(html, /下一班 週一 10\/26 09:00/);
  assert.match(html, /晚餐 19:00/);
});

test('手機首頁頂部只一行：工作日切換、現在時間、同步入口、我的；「今天」標題留給讀屏', () => {
  const html = today(rich());
  assert.match(html, /<header class="today-head is-compact">/);
  assert.match(html, /<h1 class="sr-only">今天<\/h1>/);
  assert.match(html, /<strong>週六工作日 · 10\/24<\/strong><small>現在 15:00<\/small>/);
  assert.match(html, /data-action="sync-open" aria-label="同步狀態：已存在這部裝置，點開看詳情"/);
});

test('街景可以收起成細條；收起和展開按鈕講清楚狀態', () => {
  const d = rich();
  const open = heroFor(d, '2026-10-24', currentCycle(d, now), now, true, false);
  assert.match(open, /data-action="hero-toggle" aria-expanded="true" aria-label="收起街景"/);
  assert.match(open, /<svg/);
  const strip = heroFor(d, '2026-10-24', currentCycle(d, now), now, true, true);
  assert.match(strip, /class="hero hero-strip"/);
  assert.match(strip, /aria-expanded="false" aria-label="展開街景"/);
  assert.doesNotMatch(strip, /<svg/);
});

test('同步狀態：每種情況都講紀錄在哪裡，並提供處理方法', () => {
  assert.equal(syncSummary({ status: 'off' }, {}).line, '已存在這部裝置');
  assert.equal(syncSummary({ status: 'error', message: '同步失敗，稍後會再試' }, {}).line, '已存在這部裝置，待同步');
  assert.deepEqual(syncSummary({ status: 'error' }, {}).actions, ['retry', 'settings']);
  assert.deepEqual(syncSummary({ status: 'signin' }, {}).actions, ['signin']);
  assert.equal(syncSummary({ status: 'cloud', user: { email: 'a@b.c' } }, {}).short, '已同步');
  assert.equal(syncSummary({ status: 'cloud' }, { saveError: '儲存失敗：裝置空間可能不足' }).tone, 'warn');
  const html = sheetView({ data: emptyData(), now, ui: { sheet: { type: 'sync' } }, sync: { state: { status: 'error', message: '同步失敗，稍後會再試' }, status: { lastSaved: now } } });
  assert.match(html, /已存在這部裝置，待同步/);
  assert.match(html, /同步失敗，稍後會再試/);
  assert.match(html, /data-action="sync-retry">再試一次/);
});

test('補登面板：揀了類別後類別縮成一行，頂部固定顯示正在補甚麼', () => {
  const html = sheetView({ data: emptyData(), now, ui: { drafts: {}, sheet: { type: 'record', wd: '2026-10-24', cat: 'sleep', step: 'sleepPair' } } });
  assert.match(html, /class="step-chips cat-chips is-compact"/);
  assert.match(html, /<div class="sheet-crumb" aria-live="polite">正在補：<strong>睡眠 › 整段<\/strong> · 週六 10\/24 工作日<\/div>/);
  const first = sheetView({ data: emptyData(), now, ui: { drafts: {}, sheet: { type: 'record', wd: '2026-10-24', cat: null } } });
  assert.doesNotMatch(first, /sheet-crumb/);
  assert.doesNotMatch(first, /is-compact/);
  assert.match(css, /\.sheet-crumb \{ position: sticky;/);
});

test('手機列表：睡眠和用餐都是可點的一行，有完整的讀屏標籤', () => {
  const d = rich();
  const sl = sleepView({ data: d, now, ui: { drafts: {} }, wd: '2026-10-24', isDesktop: false });
  assert.match(sl, /<button type="button" class="rec-row" data-action="sleep-open" data-id="z" aria-label="修改睡眠：週五 10\/23 23:30 到 週六 10\/24 07:20，7h 50m">/);
  assert.match(sl, /<span class="rec-span"><strong>23:30 → 07:20<\/strong><small>週五 10\/23 → 週六 10\/24<\/small>/);
  const ml = mealsView({ data: d, now, ui: { drafts: {} }, wd: '2026-10-24', isDesktop: false });
  assert.match(ml, /class="rec-row meal-row" data-action="meal-open" data-id="m1" aria-label="修改這一餐：午餐 週六 12:00"/);
});

test('狀態用語只有五個，每個都有文字和符號，不只靠顏色', () => {
  assert.deepEqual(Object.values(STATE_TEXT), ['實際', '計畫', '未記錄', '待補', '已驗證']);
  for (const k of Object.keys(STATE_TEXT)) {
    const t = stateTag(k);
    assert.match(t, new RegExp(STATE_TEXT[k]));
    assert.match(t, /chip-mark|<svg/);
  }
  const tl = timelineView({ data: rich(), now, ui: { tlMode: 'workday' }, wd: '2026-10-21', isDesktop: false });
  assert.match(tl, /chip chip-pending/);
  assert.doesNotMatch(tl, /隔日 \+|前一日/);
});

test('驗證小勾勾：外觀仍是 24×24，可點範圍延伸到 44×44', () => {
  assert.match(css, /\.vf-btn \{ margin-top: 4px; width: 24px; height: 24px;/);
  assert.match(css, /\.vf-btn::before \{ content: ''; position: absolute; inset: -10px;/);
});

test('不閃爍：剛儲存的標示沒有動畫，只有靜態底色和「已更新」文字', () => {
  assert.doesNotMatch(css, /flash-row/);
  const rule = css.match(/\.is-flash, tr\.is-flash td \{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /animation/);
});
