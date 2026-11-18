import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { at, HOUR } from '../js/time.js';
import { clockRange, reminders, restTarget } from '../js/planning.js';
import { settingsView } from '../js/views/settings.js';
import { pendingCard } from '../js/views/today.js';
import { sheetView } from '../js/views/sheet.js';

const now = at('2026-11-16', '06:00');
const shift = (id, day, fields = {}) => ({
  id, payMode: 'perOrder', ...clockRange(day, '22:00', '06:00'), ...fields,
});
const incomeRows = (data, when = now) => reminders(data, when).filter(row => row.action === 'income-open');

test('漏記提醒的四個開關有名稱、狀態文字，舊設定逐項保留', () => {
  const data = emptyData();
  const names = { sleep: '睡眠提醒', home: '到家提醒', meal: '用餐提醒', income: '收入提醒' };
  for (const prefs of [undefined, { meal: false }, { sleep: false, home: false, income: false }]) {
    data.settings.reminders = prefs;
    const html = settingsView({ data, ui: {} });
    const rows = [...html.matchAll(/<label class="reminder-row">([\s\S]*?)<\/label>/g)];
    assert.equal(rows.length, 4);
    for (const [key, name] of Object.entries(names)) {
      const row = rows.find(match => match[1].includes(`data-key="${key}"`))?.[1];
      assert.ok(row, name);
      assert.ok(row.includes(`id="reminder-${key}">${name}</strong>`));
      const input = row.match(/<input [^>]+>/)[0];
      assert.match(input, /type="checkbox" role="switch" data-action="reminder-set"/);
      assert.ok(input.includes(`aria-labelledby="reminder-${key}"`));
      assert.equal(/\schecked\b/.test(input), prefs?.[key] !== false);
      assert.match(row, /class="when-on">已開啟</);
      assert.match(row, /class="when-off">已關閉</);
    }
  }
});

test('連續兩晚夜班逐班列出工作日及實際收工時間，收入開關獨立生效', () => {
  const data = emptyData();
  data.sessions = [shift('sat', '2026-11-14'), shift('sun', '2026-11-15')];
  data.meals = [{ id: 'meal', start: now - 7 * HOUR }];
  assert.deepEqual(incomeRows(data).map(row => [row.id, row.title]), [
    ['sun', '週日 11/15 工作日收入未填'], ['sat', '週六 11/14 工作日收入未填'],
  ]);
  const home = pendingCard(data, now);
  assert.match(home, /週日 11\/15 工作日收入未填<\/strong><span>收工 週一 11\/16 06:00/);
  assert.match(home, /週六 11\/14 工作日收入未填<\/strong><span>收工 週日 11\/15 06:00/);
  data.sessions[1].workdayDate = '2026-11-12';
  data.sessions[1].workdayManual = true;
  assert.equal(incomeRows(data)[0].title, '週四 11/12 工作日收入未填');
  data.settings.reminders = { income: false };
  assert.deepEqual(reminders(data, now).map(row => row.action), ['quick-meal']);
});

test('收入提醒按收工時刻篩選，只收尚未填寫的按單班次，含剛好 48 小時', () => {
  const data = emptyData();
  const oldest = shift('boundary', '2026-11-13');
  assert.equal(now - oldest.end, 48 * HOUR);
  data.sessions = [
    oldest, { ...oldest, id: 'too-old', end: oldest.end - 1 },
    shift('paid', '2026-11-14', { income: 21 }), shift('zero', '2026-11-14', { income: 0 }),
    shift('hourly', '2026-11-15', { payMode: 'hourly' }), shift('open', '2026-11-15', { end: null }),
    shift('future', '2026-11-15', { end: now + 1 }),
  ];
  assert.deepEqual(incomeRows(data).map(row => row.id), ['boundary']);
  assert.deepEqual(incomeRows(data, now + 1).map(row => row.id), ['future']);
});

for (const [change, day, endDate, expiry, time] of [
  ['春季', '2026-03-06', '2026-03-07', '2026-03-09', '07:00'],
  ['秋季', '2026-10-30', '2026-10-31', '2026-11-02', '05:00'],
]) {
  test(change + '轉鐘的收入提醒按實際 48 小時到期', () => {
    const data = emptyData();
    data.sessions = [shift('overnight', day)];
    const limit = at(expiry, time);
    assert.equal(data.sessions[0].end, at(endDate, '06:00'));
    assert.equal(limit - data.sessions[0].end, 48 * HOUR);
    assert.equal(incomeRows(data, limit).length, 1);
    assert.equal(incomeRows(data, limit + 1).length, 0);
  });
}

test('兩個補記休息入口的說明及選項符合自動配對、指定班次與獨立休息的結果', () => {
  const data = emptyData(), wd = '2026-11-14';
  data.sessions = [shift('night', wd)];
  for (const type of ['record', 'rest-only']) {
    const html = sheetView({ data, now, ui: { drafts: {}, sheet: { type, cat: 'rest', wd } } });
    assert.match(html, /value="auto">按時間配對班次/);
    assert.match(html, /value="alone">獨立休息/);
    assert.match(html, /value="night">22:00 · 工作班內/);
    assert.match(html, /整段在同一班內就扣該班工時，整段在班外就記為獨立休息/);
    assert.match(html, /跨過上下班時間請分開填/);
    assert.match(html, /手動選班會扣該班工時，選「獨立休息」就不扣工時/);
    assert.doesNotMatch(html, /沒有班次時/);
  }
  const inside = clockRange(wd, '23:50', '00:20'), outside = clockRange(wd, '18:00', '18:30');
  for (const mode of ['auto', 'night']) assert.equal(restTarget(data, inside, mode, now).session.id, 'night');
  for (const [range, mode] of [[inside, 'alone'], [outside, 'auto']]) {
    assert.deepEqual(restTarget(data, range, mode, now), { session: undefined });
  }
  assert.ok(restTarget(data, outside, 'night', now).error);
  assert.ok(restTarget(data, clockRange(wd, '21:50', '22:10'), 'auto', now).error);
});
