// 第二輪 1：睡眠成對補記——入睡和起床一個表單填齊、一次寫入；
// 儲存後講清楚長度和歸屬哪個工作日，跨午夜一眼看到。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { saveSleepPair, checkSleepPair } from '../js/actions.js';
import { latestOpenSleep } from '../js/logic.js';
import { sleepView, sleepPairPreview, defaultSleepPair } from '../js/views/sleep.js';
import { at, HOUR } from '../js/time.js';

const now = at('2026-10-24', '15:00');

test('補記跨午夜睡眠：一次寫入入睡和起床，不會變成「睡眠中」', () => {
  replaceAll(emptyData());
  const r = saveSleepPair({ start: at('2026-10-22', '23:30'), end: at('2026-10-23', '07:15') }, now);
  assert.equal(r.ok, true);
  assert.equal(r.ms, 7 * HOUR + 45 * 60000);
  assert.equal(r.wd, '2026-10-22');
  const s = get().sleeps[0];
  assert.equal(s.start, at('2026-10-22', '23:30'));
  assert.equal(s.end, at('2026-10-23', '07:15'));
  assert.equal(latestOpenSleep(get()), null);
});

test('不合理的時段不寫入：起床早過入睡、未來、超過 24 小時、跟另一筆重疊', () => {
  replaceAll({ ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-22', '23:00'), end: at('2026-10-23', '07:00') }] });
  assert.equal(saveSleepPair({ start: at('2026-10-23', '07:00'), end: at('2026-10-23', '06:00') }, now).reason, 'before-start');
  assert.equal(saveSleepPair({ start: at('2026-10-24', '14:00'), end: at('2026-10-24', '16:00') }, now).reason, 'future');
  assert.equal(saveSleepPair({ start: at('2026-10-20', '22:00'), end: at('2026-10-21', '23:00') }, now).reason, 'too-long');
  assert.equal(saveSleepPair({ start: at('2026-10-23', '06:00'), end: at('2026-10-23', '09:00') }, now).reason, 'overlap');
  assert.equal(get().sleeps.length, 1);
});

test('修改原有的一筆：入睡、起床一起改；手動指定的工作日保持不變', () => {
  replaceAll({ ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-22', '23:00'), end: at('2026-10-23', '07:00'), workdayDate: '2026-10-23', workdayManual: true }] });
  const r = saveSleepPair({ id: 'a', start: at('2026-10-22', '22:30'), end: at('2026-10-23', '06:30') }, now);
  assert.equal(r.ok, true);
  const s = get().sleeps[0];
  assert.equal(s.start, at('2026-10-22', '22:30'));
  assert.equal(s.end, at('2026-10-23', '06:30'));
  assert.equal(s.workdayDate, '2026-10-23');
  assert.equal(r.wd, '2026-10-23');
});

test('進行中的睡眠可以只改入睡（起床留空）；新的補記一定要有起床', () => {
  replaceAll({ ...emptyData(), sleeps: [{ id: 'o', start: at('2026-10-24', '13:00'), end: null }] });
  assert.equal(saveSleepPair({ id: 'o', start: at('2026-10-24', '12:30'), end: null }, now).ok, true);
  assert.equal(checkSleepPair(get(), at('2026-10-20', '23:00'), null, { now }), 'bad-time');
});

test('預覽：長度、跨午夜、歸屬工作日；不合理時直接講', () => {
  const d = emptyData();
  const html = sleepPairPreview(d, at('2026-10-22', '23:30'), at('2026-10-23', '07:15'), { now });
  assert.match(html, /共 <strong>7h 45m<\/strong>/);
  assert.match(html, /入睡 週四 10\/22 23:30 → 起床 週五 10\/23 07:15/);
  assert.match(html, /跨午夜/);
  assert.match(html, /歸屬 <strong>週四 10\/22<\/strong> 工作日/);
  assert.match(sleepPairPreview(d, at('2026-10-23', '07:00'), at('2026-10-23', '06:00'), { now }), /起床時間要晚於入睡時間/);
});

test('預設時段不會在未來', () => {
  const p = defaultSleepPair('2026-10-24', now);
  assert.ok(p.end <= now);
  assert.equal(p.end - p.start, 8 * HOUR);
});

test('預設時段避開已有紀錄的晚上（第三輪：打開表單不會一開始就顯示重疊錯誤）', () => {
  const d = { ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-23', '23:30'), end: at('2026-10-24', '07:20') }] };
  const p = defaultSleepPair('2026-10-24', now, d);
  assert.equal(p.start, at('2026-10-22', '23:00'));
  assert.equal(p.end, at('2026-10-23', '07:00'));
});

test('睡眠頁有「補記睡眠」表單；剛存好的一筆顯示長度和歸屬', () => {
  const d = { ...emptyData(), sleeps: [{ id: 'a', start: at('2026-10-22', '23:30'), end: at('2026-10-23', '07:15') }] };
  const html = sleepView({ data: d, now, ui: { drafts: {}, sleepSaved: 'a' }, wd: '2026-10-24', isDesktop: false });
  assert.match(html, /data-form="sleep-pair"/);
  assert.match(html, /name="sd"[^>]*required/);
  assert.match(html, /<div class="saved-note"[^>]*>.*7h 45m · 歸屬 週四 10\/22 工作日/s);
  assert.match(html, /· 跨午夜/);
});
