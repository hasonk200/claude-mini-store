// 一撳就記（2.31）：「我瞓醒喇」「食咗飯」。重點係跨夜唔會撈亂日期：
// 你只答鐘數或者「幾耐之前」，日期由現在倒數；工作日歸屬照舊用起床邊界。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at, HOUR, MIN, dateKey, fmtTime } from '../js/time.js';
import { lastClockBefore, quickWakeState, homeSuggestion, sleepWorkday, mealWorkday, currentWorkday, dayOf } from '../js/logic.js';
import { quickWake, quickMeal, moveMeal, startSleep } from '../js/actions.js';
import { todayView } from '../js/views/today.js';
import { sheetView, quickWakePreview } from '../js/views/sheet.js';
import { defaultSleepPair } from '../js/views/sleep.js';

const fresh = (d = {}) => replaceAll({ ...emptyData(), ...d }, { tombstone: false });
const ses = (id, a, b) => ({ id, jobId: 'j', shiftId: null, start: a, end: b, breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null, note: '' });
const slp = (id, a, b) => ({ id, start: a, end: b, planStart: null, planEnd: null, note: '' });
// 連續兩晚夜班：週三晚 21:00–週四 07:00、週四晚 21:00–週五 07:00；週四日頭有瞓（已記）。
const twoNights = () => ({
  jobs: [{ id: 'j', name: '夜班', color: 'work', payMode: 'hourly', rate: 20 }],
  sessions: [ses('n1', at('2026-11-11', '21:00'), at('2026-11-12', '07:00')), ses('n2', at('2026-11-12', '21:00'), at('2026-11-13', '07:00'))],
  journeys: [{ id: 'h1', sessionId: 'n1', home: at('2026-11-12', '07:50') }, { id: 'h2', sessionId: 'n2', home: at('2026-11-13', '07:45') }],
  sleeps: [slp('a', at('2026-11-11', '09:00'), at('2026-11-11', '17:00')), slp('b', at('2026-11-12', '09:10'), at('2026-11-12', '17:30'))]
});

test('lastClockBefore：過咗午夜，夜晚嘅鐘數自動係前一日；未過嘅鐘數係今日', () => {
  const now = at('2026-11-13', '02:00');
  assert.equal(lastClockBefore('23:30', now), at('2026-11-12', '23:30'));
  assert.equal(lastClockBefore('01:15', now), at('2026-11-13', '01:15'));
  assert.equal(lastClockBefore('02:00', now), at('2026-11-12', '02:00'));
  assert.equal(lastClockBefore('02:00', now, { inclusive: true }), now);
  assert.equal(lastClockBefore('', now), null);
});

test('lastClockBefore：夏令時間結束嗰日（11/1 多一個鐘）都係真實嘅前一晚', () => {
  const now = at('2026-11-01', '09:00');
  const t = lastClockBefore('23:00', now);
  assert.equal(dateKey(t), '2026-10-31');
  assert.equal(fmtTime(t), '23:00');
  assert.equal(now - t, 11 * HOUR); // 23:00 → 09:00 本來 10 個鐘，嗰晚多咗一個鐘
});

test('瞓醒喇（日頭瞓）：週五 15:30 起身，答 08:30 瞓 → 同一日；計入週四工作日，起身後係週五', () => {
  fresh(twoNights());
  const now = at('2026-11-13', '15:30');
  const st = quickWakeState(get(), now, { startSel: 'custom', startTime: '08:30' });
  assert.equal(st.error, null);
  assert.equal(st.start, at('2026-11-13', '08:30'));
  assert.equal(st.wake, now);
  const r = quickWake({ start: st.start, wake: st.wake }, now);
  assert.equal(r.ok, true);
  assert.equal(r.wd, '2026-11-12');
  const d = get();
  const rec = d.sleeps.find((x) => x.id === r.id);
  assert.equal(sleepWorkday(rec, d), '2026-11-12');
  assert.equal(dayOf(d, now), '2026-11-13');
  assert.equal(currentWorkday(d, now), '2026-11-13');
  // 連續兩晚：第一晚（週三夜班）之後嗰覺仍然計入週三，冇因為補咗第二覺而走位。
  assert.equal(sleepWorkday(d.sleeps.find((x) => x.id === 'b'), d), '2026-11-11');
});

test('瞓醒喇（跨午夜）：週六 06:40 起身，答 23:30 瞓 → 一定係週五 23:30', () => {
  fresh({ sleeps: [slp('a', at('2026-11-12', '23:00'), at('2026-11-13', '07:00'))] });
  const now = at('2026-11-14', '06:40');
  const st = quickWakeState(get(), now, { startSel: 'custom', startTime: '23:30' });
  assert.equal(st.start, at('2026-11-13', '23:30'));
  assert.equal(st.error, null);
  const html = quickWakePreview(get(), st);
  assert.match(html, /<strong>週五 11\/13 23:30<\/strong> 瞓<\/span> → <span class=\"nw\"><strong>週六 11\/14 06:40<\/strong> 起身/);
  assert.match(html, /瞓咗 <strong>7 小時 10 分<\/strong> · 計入 <strong>週五 11\/13<\/strong> 工作日/);
  assert.match(html, /起身之後開始 <strong>週六 11\/14<\/strong> 工作日/);
});

test('瞓醒喇（午夜後先瞓）：週六 09:00 起身，答 01:20 瞓 → 同一日凌晨', () => {
  fresh({ sleeps: [slp('a', at('2026-11-13', '01:00'), at('2026-11-13', '08:00'))] });
  const now = at('2026-11-14', '09:00');
  const st = quickWakeState(get(), now, { startSel: 'custom', startTime: '01:20' });
  assert.equal(st.start, at('2026-11-14', '01:20'));
  assert.equal(st.error, null);
});

test('瞓醒喇：快捷掣有「同上次一樣」「到家後半個鐘」同瞓咗幾耐；預先揀最似嗰個', () => {
  fresh(twoNights());
  const now = at('2026-11-13', '16:00');
  const st = quickWakeState(get(), now);
  const byKey = Object.fromEntries(st.options.map((o) => [o.key, o]));
  assert.equal(byKey.last.t, at('2026-11-13', '09:10'));
  assert.equal(byKey.home.t, at('2026-11-13', '08:15'));
  assert.equal(byKey.d7.t, at('2026-11-13', '09:00'));
  assert.equal(st.startSel, 'last');
  assert.equal(st.error, null);
});

test('瞓醒喇：起身時間可以揀「半個鐘前」；瞓咗幾耐跟住起身時間計', () => {
  fresh(twoNights());
  const now = at('2026-11-13', '16:00');
  const st = quickWakeState(get(), now, { wakeSel: 'm30', startSel: 'd6' });
  assert.equal(st.wake, at('2026-11-13', '15:30'));
  assert.equal(st.start, at('2026-11-13', '09:30'));
});

test('瞓醒喇：唔會同已有睡眠重疊；早過上一覺起身嘅選項會停用', () => {
  fresh({ sleeps: [slp('a', at('2026-11-13', '02:00'), at('2026-11-13', '10:00'))] });
  const now = at('2026-11-13', '13:00');
  const st = quickWakeState(get(), now);
  assert.equal(st.options.find((o) => o.key === 'd2').disabled, false);
  assert.equal(st.options.find((o) => o.key === 'd6').disabled, true);
  // 自己打 09:00（仲喺上一覺入面）→ 擋住，唔會存到。
  const bad = quickWakeState(get(), now, { startSel: 'custom', startTime: '09:00' });
  assert.equal(bad.error, 'overlap');
  assert.equal(quickWake({ start: bad.start, wake: bad.wake }, now).ok, false);
  assert.equal(get().sleeps.length, 1);
});

test('瞓醒喇：瞓之前撳過「去瞓」→ 只問起身時間，入睡時間照用已記嗰個', () => {
  fresh();
  startSleep(at('2026-11-13', '08:40'));
  const now = at('2026-11-13', '16:10');
  const st = quickWakeState(get(), now, { wakeSel: 'm60' });
  assert.equal(st.start, at('2026-11-13', '08:40'));
  assert.equal(st.wake, at('2026-11-13', '15:10'));
  const r = quickWake({ start: st.start, wake: st.wake }, now);
  assert.equal(r.ok, true);
  const all = get().sleeps;
  assert.equal(all.length, 1);
  assert.equal(all[0].end, at('2026-11-13', '15:10'));
});

test('食咗飯：凌晨 01:20 撳 → 存真實日期週五 01:20；夜班中計入週四工作日', () => {
  fresh({ ...twoNights(), sessions: [ses('n1', at('2026-11-11', '21:00'), at('2026-11-12', '07:00')), ses('n2', at('2026-11-12', '21:00'), null)], journeys: [] });
  const now = at('2026-11-13', '01:20');
  const r = quickMeal(now);
  assert.equal(r.ok, true);
  const d = get();
  const m = d.meals.find((x) => x.id === r.id);
  assert.equal(m.start, now);
  assert.equal(m.confirmed, true);
  assert.equal(mealWorkday(m, d, now), '2026-11-12');
  // 2 分鐘內再撳唔會記多一餐。
  assert.equal(quickMeal(now + MIN).ok, false);
  assert.equal(get().meals.length, 1);
});

test('食咗飯：00:20 撳完改「1 個鐘前」→ 跨返去前一日 23:20；有結束時間就一齊移', () => {
  fresh();
  const now = at('2026-11-14', '00:20');
  const r = quickMeal(now);
  assert.equal(moveMeal(r.id, now - 60 * MIN, now).ok, true);
  assert.equal(get().meals[0].start, at('2026-11-13', '23:20'));
  assert.equal(moveMeal(r.id, now + MIN, now).reason, 'future');
  fresh({ meals: [{ id: 'm', start: at('2026-11-13', '12:00'), end: at('2026-11-13', '12:30'), confirmed: true }] });
  moveMeal('m', at('2026-11-13', '11:00'), now);
  assert.equal(get().meals[0].end, at('2026-11-13', '11:30'));
});

test('首頁主掣跟場合：好耐冇睡眠紀錄 → 我瞓醒喇；啱啱收工 → 去瞓；返工途中 → 通勤下一步', () => {
  const d = { ...emptyData(), ...twoNights() };
  // 週五 16:00：上次起身係週四 17:30（22.5 個鐘前），收工返到屋企之後 8 個鐘冇紀錄。
  assert.equal(homeSuggestion(d, at('2026-11-13', '16:00')), 'wake');
  // 週五 08:00：啱啱返到屋企。
  assert.equal(homeSuggestion(d, at('2026-11-13', '08:00')), 'sleep');
  // 上班中：照舊係通勤／出勤下一步。
  const working = { ...d, sessions: [...d.sessions, ses('n3', at('2026-11-13', '21:00'), null)] };
  assert.equal(homeSuggestion(working, at('2026-11-13', '23:00')), 'step');
  // 全新、冇任何紀錄：唔好亂估，照舊「記錄出門」。
  assert.equal(homeSuggestion(emptyData(), at('2026-11-13', '16:00')), 'step');
  // 睡眠中：現在起床。
  assert.equal(homeSuggestion({ ...d, sleeps: [...d.sleeps, slp('o', at('2026-11-13', '09:00'), null)] }, at('2026-11-13', '12:00')), 'wakeNow');
});

test('首頁：狀態卡下面有三粒「一撳就記」；詳細預設收起；睡眠中唔出三粒掣', () => {
  const d = { ...emptyData(), ...twoNights() };
  const now = at('2026-11-13', '16:00');
  const html = todayView({ data: d, now, ui: {}, wd: currentWorkday(d, now), isDesktop: false });
  const pos = (s) => html.indexOf(s);
  assert.match(html, /class="btn btn-lime btn-block main-act" data-action="quick-wake">我瞓醒喇/);
  assert.ok(pos('aria-label="現在狀態"') < pos('aria-label="一撳就記"'));
  assert.ok(pos('aria-label="一撳就記"') < pos('aria-label="下一件事"'));
  for (const a of ['quick-meal', 'quick-wake', 'sleep-start']) assert.match(html, new RegExp(`class="tile life-tile" data-action="${a}"`));
  assert.match(html, /<details class="today-more" data-pref="todayMore"><summary/);
  assert.match(todayView({ data: d, now, ui: { todayMore: true }, wd: '2026-11-13', isDesktop: false }), /<details class="today-more" data-pref="todayMore" open>/);
  const sleeping = { ...d, sleeps: [...d.sleeps, slp('o', at('2026-11-13', '09:00'), null)] };
  const sh = todayView({ data: sleeping, now, ui: {}, wd: '2026-11-12', isDesktop: false });
  assert.doesNotMatch(sh, /aria-label="一撳就記"/);
  assert.match(sh, /data-action="wake">現在起床/);
  assert.match(sh, /data-action="quick-wake">唔係啱啱起身/);
});

test('面板：我瞓醒喇有確認行同「存低」；這一餐有「唔係啱啱食？」', () => {
  const d = { ...emptyData(), ...twoNights(), meals: [{ id: 'm', start: at('2026-11-13', '15:55'), end: null, confirmed: true, name: '' }] };
  const now = at('2026-11-13', '16:00');
  const w = sheetView({ data: d, now, ui: { sheet: { type: 'quick-wake' } } });
  assert.match(w, /data-form="quick-wake"/);
  assert.match(w, /data-action="qw-start" data-key="last" aria-pressed="true"><strong>同上次一樣<\/strong><small>09:10<\/small>/);
  assert.match(w, /data-qw-preview[^>]*><span class=\"nw\"><strong>週五 11\/13 09:10<\/strong> 瞓<\/span> → <span class=\"nw\"><strong>週五 11\/13 16:00<\/strong> 起身/);
  assert.match(w, /type="submit">存低/);
  const m = sheetView({ data: d, now, ui: { sheet: { type: 'meal-quick', id: 'm', base: at('2026-11-13', '15:55') } } });
  assert.match(m, /已記低一餐<\/span><strong>週五 11\/13 15:55<\/strong>/);
  assert.match(m, /data-action="meal-shift" data-min="30" aria-pressed="false"><strong>半個鐘前<\/strong><small>15:25<\/small>/);
});

test('補記睡眠嘅預設時段：有收工紀錄就放喺到家之後（夜班日頭瞓），唔再一律 23:00–07:00', () => {
  const d = { ...emptyData(), ...twoNights() };
  const now = at('2026-11-13', '18:00');
  const p = defaultSleepPair('2026-11-12', now, d);
  assert.equal(p.start, at('2026-11-13', '08:15'));
  assert.equal(p.end, at('2026-11-13', '16:15'));
  // 仲未夠 8 個鐘：計到現在，唔會去到未來。
  const early = defaultSleepPair('2026-11-12', at('2026-11-13', '12:02'), d);
  assert.equal(early.end, at('2026-11-13', '12:00'));
});
