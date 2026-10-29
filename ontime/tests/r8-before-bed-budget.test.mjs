// R8：睡前空檔估算。正在上班但不知道幾點收工時不估空檔（只保留倒數）；
// 上緊班、超時未收工、收工後回程都要扣，不能把整段當成自由時間。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { beforeBedBudget, workEndEstimate } from '../js/logic.js';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setExpectedEnd } from '../js/actions.js';
import { todayView, heroFor } from '../js/views/today.js';
import { sheetView } from '../js/views/sheet.js';
import { currentCycle } from '../js/logic.js';
import { at, HOUR, MIN } from '../js/time.js';

const now = at('2026-10-24', '15:00');
const plan = () => ({ id: 'p', start: null, end: null, planStart: at('2026-10-24', '23:00'), planEnd: at('2026-10-25', '07:00') });
const base = () => ({ ...emptyData(), jobs: [{ id: 'j', name: 'x' }], sleeps: [plan()] });
const working = (extra = {}) => ({ id: 's', jobId: 'j', start: at('2026-10-24', '12:00'), end: null, breaks: [], ...extra });

test('A 冇排班上緊班：收工時間未知，保留倒數，不給空檔數字', () => {
  const d = base(); d.sessions.push(working());
  const b = beforeBedBudget(d, now);
  assert.equal(b.state, 'unknown-end');
  assert.equal(b.reason, 'no-shift');
  assert.equal(b.countdown, 8 * HOUR);
  assert.equal(b.free, undefined);
});

test('A 填了預計收工 19:00：工作到 19:00 + 回程 45 分都扣掉', () => {
  const d = base(); d.sessions.push(working({ expectedEnd: at('2026-10-24', '19:00') }));
  const b = beforeBedBudget(d, now);
  assert.equal(b.state, 'ok');
  assert.equal(b.free, 8 * HOUR - (4 * HOUR + 45 * MIN));
  assert.equal(b.workEnd.source, 'expected');
});

test('預計收工已經過了：當作未知，不會繼續用舊的估計', () => {
  const d = base(); d.sessions.push(working({ expectedEnd: at('2026-10-24', '14:00') }));
  assert.equal(beforeBedBudget(d, now).state, 'unknown-end');
});

test('B 排班 14:00 已過、仍未收工：超時，收工時間未知', () => {
  const d = base();
  d.shifts.push({ id: 'sh', jobId: 'j', start: at('2026-10-24', '09:00'), end: at('2026-10-24', '14:00') });
  d.sessions.push(working({ shiftId: 'sh', start: at('2026-10-24', '09:00') }));
  const b = beforeBedBudget(d, now);
  assert.equal(b.state, 'unknown-end');
  assert.equal(b.reason, 'overtime');
});

test('有排班、未到下班：照舊扣到排班下班 + 回程', () => {
  const d = base();
  d.shifts.push({ id: 'sh', jobId: 'j', start: at('2026-10-24', '09:00'), end: at('2026-10-24', '17:00') });
  d.sessions.push(working({ shiftId: 'sh', start: at('2026-10-24', '09:00') }));
  const b = beforeBedBudget(d, now);
  assert.equal(b.state, 'ok');
  assert.equal(b.free, 8 * HOUR - (2 * HOUR + 45 * MIN));
});

test('C 14:30 收工但完全沒有行程紀錄：回程照扣', () => {
  const d = base(); d.sessions.push(working({ start: at('2026-10-24', '09:00'), end: at('2026-10-24', '14:30') }));
  const b = beforeBedBudget(d, now);
  assert.equal(b.state, 'ok');
  // 14:30 + 45 分 = 15:15，由現在 15:00 起扣 15 分
  assert.equal(b.free, 8 * HOUR - 15 * MIN);
});

test('C 已記到家：不再扣回程', () => {
  const d = base(); d.sessions.push(working({ start: at('2026-10-24', '09:00'), end: at('2026-10-24', '14:30') }));
  d.journeys.push({ id: 'jr', sessionId: 's', home: at('2026-10-24', '14:50') });
  assert.equal(beforeBedBudget(d, now).free, 8 * HOUR);
});

test('預計收工：只寫 expectedEnd，不寫收工、不計工時；早過現在或上班要拒絕', () => {
  replaceAll({ ...base(), sessions: [working()] });
  assert.equal(setExpectedEnd('s', at('2026-10-24', '14:00'), now).reason, 'expected-past');
  assert.equal(setExpectedEnd('s', at('2026-10-24', '11:00'), now).reason, 'before-clock-in');
  assert.equal(setExpectedEnd('s', at('2026-10-24', '19:00'), now).ok, true);
  const s = get().sessions[0];
  assert.equal(s.expectedEnd, at('2026-10-24', '19:00'));
  assert.equal(s.end, null);
  assert.equal(workEndEstimate(get(), s, now).source, 'expected');
  setExpectedEnd('s', null, now);
  assert.equal('expectedEnd' in get().sessions[0], false);
});

test('今天頁：顯示「收工時間未知」和「填預計收工」，倒數照樣顯示', () => {
  const d = base(); d.sessions.push(working());
  const html = todayView({ data: d, now, ui: {}, wd: '2026-10-24', isDesktop: false });
  assert.match(html, /收工時間未知/);
  assert.match(html, /data-action="expected-end-open" data-id="s"/);
  assert.match(html, /距離預計入睡/);
  const hero = heroFor(d, '2026-10-24', currentCycle(d, now), now);
  assert.match(hero, /距離入睡 8h 00m · 收工時間未知/);
});

test('預計收工面板寫明只用來估算', () => {
  const d = base(); d.sessions.push(working());
  const html = sheetView({ data: d, now, ui: { sheet: { type: 'expected-end', sid: 's' } } });
  assert.match(html, /data-form="expected-end"/);
  assert.match(html, /不會記成下班時間/);
});
