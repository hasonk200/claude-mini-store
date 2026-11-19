// 第三輪（2.41.0）測試：
// PR B 回饋三項（補睡眠預設唔剔、唔估到而家、食飯 >=48h 改寫幾多日）＋ PR C/D/E 全部介面與提醒改動，
// 以及「瞓醒喇」預設揀法在跨午夜、連續兩晚夜班與多倫多夏令時間轉鐘日嘅測試。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData } from '../js/store.js';
import { at, MIN, HOUR, DAY, fromInputs } from '../js/time.js';
import { quickWakeState, tripState } from '../js/logic.js';
import { reminders, missingSleepDays } from '../js/planning.js';
import { dayBand } from '../js/views/shared.js';
import { todayView } from '../js/views/today.js';
import { sheetView, tripSummaryHTML } from '../js/views/sheet.js';
import { mealsView } from '../js/views/meals.js';
import { statsView } from '../js/views/stats.js';
import { settingsView } from '../js/views/settings.js';
import { sleepEndKey } from '../js/views/sleep.js';

const swSrc = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('PR B 回饋：補睡眠預設唔剔、唔估一覺瞓到而家；食飯超過 2 日改寫幾多日', () => {
  const now = at('2026-11-18', '14:00');
  const d = emptyData();
  d.sleeps = [{ id: 's0', start: at('2026-11-07', '11:49'), end: at('2026-11-07', '16:49') }];
  d.meals = [{ id: 'm0', start: at('2026-11-08', '02:00'), confirmed: true }];

  // 食飯超過 2 日：寫「已經 X 日冇記過食飯」，唔再寫 252 小時
  const rems = reminders(d, now);
  const mealRem = rems.find((r) => r.action === 'quick-meal');
  assert.ok(mealRem);
  assert.match(mealRem.title, /已經 10 日冇記過食飯/);
  assert.doesNotMatch(mealRem.title, /小時/);

  // 補睡眠唔會估 11:49→14:00（啱啱瞓到而家）
  const rows = missingSleepDays(d, now, 7);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    const end = fromInputs(sleepEndKey(r.sd, r.st, r.et), r.et);
    assert.ok(end <= now - 1, '不可截短估到現在');
  }

  // 預設開補睡眠面板：全部唔剔、送出掣 disabled
  const html = sheetView({ data: d, now, wd: '2026-11-18', isDesktop: false, ui: { sheet: { type: 'sleep-catchup', rows }, drafts: {} } });
  assert.doesNotMatch(html, /type="checkbox" name="use_\d+" checked/);
  assert.match(html, /data-cu-submit disabled>請先剔選要補的日子/);

  // 喺睡眠頁點特定灰柱（focusWd）：只剔嗰一日
  const focus = sheetView({ data: d, now, wd: '2026-11-18', isDesktop: false, ui: { sheet: { type: 'sleep-catchup', rows, focusWd: rows[0].wd }, drafts: {} } });
  assert.equal((focus.match(/type="checkbox" name="use_\d+" checked/g) || []).length, 1);
  assert.match(focus, /一次存低 1 筆睡眠/);
});

test('M4：剛到家 4 小時內唔催單日漏記睡眠；到期計畫餐唔同下一件事重複；全新空白不催補睡眠', () => {
  const now = at('2026-11-18', '13:35');
  const d = emptyData();
  d.sleeps = [{ id: 's0', start: at('2026-11-17', '11:49'), end: at('2026-11-17', '16:49') }]; // 已過 20h46m
  d.journeys = [{ id: 'j0', sessionId: null, home: at('2026-11-18', '10:00') }]; // 剛到家 3h35m < 4h
  assert.equal(reminders(d, now).some((r) => r.action === 'quick-wake'), false);

  // 到家超過 4 小時後恢復提醒
  assert.equal(reminders(d, at('2026-11-18', '14:05')).some((r) => r.action === 'quick-wake'), true);

  // 全新空白首頁：顯示溫和引導，唔彈「需要補的紀錄」
  const emptyHome = todayView({ data: emptyData(), now, wd: '2026-11-18', isDesktop: false, ui: { drafts: {} } });
  assert.match(emptyHome, /開始記第一筆/);
  assert.doesNotMatch(emptyHome, /需要補的紀錄/);

  // 過去 10 分鐘到期嘅未確認餐：只在「需要補的紀錄」出現一次，唔再重複喺「下一件事」
  const dMeal = emptyData();
  dMeal.meals = [{ id: 'm_due', name: '午餐', start: now - 10 * MIN, confirmed: false }];
  const mealHome = todayView({ data: dMeal, now, wd: '2026-11-18', isDesktop: false, ui: { drafts: {} } });
  assert.equal((mealHome.match(/data-action="meal-confirm" data-id="m_due"/g) || []).length, 1);
});

test('M2：時間帶隱藏俾「而家」遮住嘅鐘數，且班內休息唔會畫出兩個重複「上班」標籤', () => {
  const d = emptyData();
  d.jobs = [{ id: 'j1', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 }];
  d.sessions = [{
    id: 's1', jobId: 'j1', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '09:00'),
    breaks: [{ start: at('2026-11-18', '03:00'), end: at('2026-11-18', '03:30') }], payMode: 'hourly', rate: 20
  }];
  const a = at('2026-11-17', '16:00');
  const b = at('2026-11-18', '14:00');
  const band = dayBand(d, a, b, at('2026-11-18', '06:30'));
  // 只應該有一個「上班」標籤
  assert.equal((band.match(/>上班<\/span>/g) || []).length, 1);
  // 08:00 鐘數貼住「而家 06:30」應被避讓隱藏
  assert.doesNotMatch(band, /class="band-hour[^"]*">08<\/span>/);
});

test('M1：整趟摘要扣除既有班內休息，同時間線及統計工時一致', () => {
  const now = at('2026-11-18', '13:35');
  const d = emptyData();
  d.jobs = [{ id: 'j1', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 }];
  d.sessions = [{
    id: 's1', jobId: 'j1', start: at('2026-11-17', '20:58'), end: at('2026-11-18', '09:04'),
    breaks: [{ start: at('2026-11-18', '03:00'), end: at('2026-11-18', '03:30') }], payMode: 'hourly', rate: 20
  }];
  const st = tripState(d, { wd: '2026-11-17', sessionId: 's1' }, now);
  const sumHtml = tripSummaryHTML(st);
  assert.match(sumHtml, /11h 36m/);
  assert.match(sumHtml, /已扣 0h 30m 休息/);
});

test('M6、M7、M8、M9、M11：桌面去重與修改掣、用餐頁次序、設定還原次序、版本一致與 iPhone 安全區', () => {
  const now = at('2026-11-18', '13:35');
  const d = emptyData();
  d.jobs = [
    { id: 'j1', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 },
    { id: 'j2', name: '外送', color: 'deliv', payMode: 'perOrder', rate: null }
  ];
  d.sessions = [
    { id: 's1', jobId: 'j1', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '07:00'), breaks: [], payMode: 'hourly', rate: 20 },
    { id: 's2', jobId: 'j2', start: at('2026-11-18', '10:00'), end: at('2026-11-18', '12:00'), breaks: [], payMode: 'perOrder', income: 55, orders: 6 }
  ];
  // 桌面首頁唔再重複顯示右上角新增掣
  const deskHome = todayView({ data: d, now, wd: '2026-11-17', isDesktop: true, ui: { drafts: {} } });
  assert.doesNotMatch(deskHome, /class="today-tools"/);

  // 統計頁有合計收入且電腦版明細有修改掣
  const deskStats = statsView({ data: d, now, wd: '2026-11-17', isDesktop: true, ui: { statsPeriod: 'week', statsOffset: 0, statsJob: 'all' } });
  assert.match(deskStats, /合計收入 <b>\$255\.00<\/b>/);
  assert.match(deskStats, /data-action="open-trip" data-wd="2026-11-18" data-sid="s2">修改/);

  // 手機用餐頁：清單在補記表單上面，且補記表單預設收起
  const mobMeals = mealsView({ data: d, now, wd: '2026-11-17', isDesktop: false, ui: { drafts: {} } });
  assert.ok(mobMeals.indexOf('這個工作日還沒有用餐紀錄') < mobMeals.indexOf('補記或安排一餐'));
  assert.match(mobMeals, /<details class="card card-fold" aria-label="補記或安排一餐"/);

  // 設定頁：先揀合併／取代在匯入掣上面；版本號與 sw.js 同步
  const setHtml = settingsView({ data: d, now, wd: '2026-11-17', isDesktop: false, ui: { heroCollapsed: true, appVersion: '2.41.0' } });
  assert.ok(setHtml.indexOf('name="importMode"') < setHtml.indexOf('data-action="import-json"'));
  const swVer = swSrc.match(/const VERSION = '([^']+)'/)[1];
  const appVer = appSrc.match(/const APP_VERSION = '([^']+)'/)[1];
  assert.equal(appVer, swVer);

  // PWA 安全區
  assert.match(htmlSrc, /apple-mobile-web-app-capable/);
  assert.match(cssSrc, /safe-area-inset-top/);
});

test('L3「瞓醒喇」預設揀法：上次鐘數只得 <3h 但到家後半個鐘係合理長覺時，優先預選到家後半個鐘（含跨午夜、連兩晚夜班、夏令時間）', () => {
  // 1) 一般日頭瞓：上次 11:49 瞓，今次 07:00 到家、14:00 起身 → 「同上次」只得 2h11m，改預選「到家後半個鐘」07:30（6h30m）
  const d1 = emptyData();
  d1.sleeps = [{ id: 's0', start: at('2026-11-17', '11:49'), end: at('2026-11-17', '16:49') }];
  d1.journeys = [{ id: 'j1', sessionId: null, home: at('2026-11-18', '07:00') }];
  const st1 = quickWakeState(d1, at('2026-11-18', '14:00'));
  assert.equal(st1.startSel, 'home');
  assert.equal(st1.start, at('2026-11-18', '07:30'));

  // 2) 跨午夜：23:00 到家，隔天 07:00 起身，上次入睡 05:30（得 1.5h）→ 預選 23:30（隔夜 7.5h）
  const d2 = emptyData();
  d2.sleeps = [{ id: 's0', start: at('2026-11-17', '05:30'), end: at('2026-11-17', '12:00') }];
  d2.journeys = [{ id: 'j2', sessionId: null, home: at('2026-11-17', '23:00') }];
  const st2 = quickWakeState(d2, at('2026-11-18', '07:00'));
  assert.equal(st2.startSel, 'home');
  assert.equal(st2.start, at('2026-11-17', '23:30'));

  // 3) 連續兩晚夜班：第二晚 06:30 到家、14:00 起身
  const d3 = emptyData();
  d3.sleeps = [{ id: 's1', start: at('2026-11-17', '12:00'), end: at('2026-11-17', '18:00') }];
  d3.journeys = [
    { id: 'j1', sessionId: null, home: at('2026-11-17', '07:00') },
    { id: 'j2', sessionId: null, home: at('2026-11-18', '06:30') }
  ];
  const st3 = quickWakeState(d3, at('2026-11-18', '14:00'));
  assert.equal(st3.startSel, 'home');
  assert.equal(st3.start, at('2026-11-18', '07:00'));

  // 4) 多倫多夏令時間轉鐘日（2026-03-08 春季少 1h；2026-11-01 秋季多 1h）
  const dSpring = emptyData();
  dSpring.sleeps = [{ id: 'sp0', start: at('2026-03-07', '06:00'), end: at('2026-03-07', '12:00') }];
  dSpring.journeys = [{ id: 'jsp', sessionId: null, home: at('2026-03-07', '23:00') }];
  const stSp = quickWakeState(dSpring, at('2026-03-08', '07:30'));
  assert.equal(stSp.startSel, 'home');
  assert.equal(stSp.wake - stSp.start, 7 * HOUR); // 23:30 → 07:30 跨春季撥快 = 7 小時

  const dFall = emptyData();
  dFall.sleeps = [{ id: 'fa0', start: at('2026-10-31', '06:00'), end: at('2026-10-31', '12:00') }];
  dFall.journeys = [{ id: 'jfa', sessionId: null, home: at('2026-10-31', '23:00') }];
  const stFa = quickWakeState(dFall, at('2026-11-01', '07:30'));
  assert.equal(stFa.startSel, 'home');
  assert.equal(stFa.wake - stFa.start, 9 * HOUR); // 23:30 → 07:30 跨秋季撥慢 = 9 小時
});
