// 整趟一次過填（2.32）：七格鐘數 → 真實時間。做法同臨時版一樣：由上而下，鐘數細過上一格就係隔天；
// 原有、冇改過嘅格唔會走位。重點測跨夜、連續兩晚夜班、同埋擋住唔合理嘅時間。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at, HOUR, fmtTime } from '../js/time.js';
import { tripWorkdaySuggestion, resolveTrip, checkTrip, tripState, tripsOfWorkday, tripTimes, findTrip, tripSummary, tripErrorText, tripAllVerified, workdayOfSession, sessionWorkMs, STEPS } from '../js/logic.js';
import { saveTrip, deleteTrip } from '../js/actions.js';
import { sheetView, openTripSheet } from '../js/views/sheet.js';

const fresh = (d = {}) => replaceAll({ ...emptyData(), ...d }, { tombstone: false });
const blank = () => Object.fromEntries(STEPS.map((k) => [k, null]));
const typed = (o) => ({ ...Object.fromEntries(STEPS.map((k) => [k, ''])), ...o });
const ses = (id, a, b, extra = {}) => ({ id, jobId: 'j', shiftId: null, start: a, end: b, breaks: [], payMode: 'hourly', rate: 20, income: null, orders: null, note: '', ...extra });
const job = { id: 'j', name: '夜班', color: 'work', payMode: 'hourly', rate: 20 };

test('新一趟（夜班）：一個日期、七格鐘數，過咗午夜自動係隔天', () => {
  const t = resolveTrip(blank(), typed({ out: '20:10', ride: '20:20', arrive: '20:45', clockIn: '21:00', clockOut: '07:30', ride2: '07:40', home: '08:15' }), '2026-11-13');
  assert.equal(t.out, at('2026-11-13', '20:10'));
  assert.equal(t.clockIn, at('2026-11-13', '21:00'));
  assert.equal(t.clockOut, at('2026-11-14', '07:30'));
  assert.equal(t.ride2, at('2026-11-14', '07:40'));
  assert.equal(t.home, at('2026-11-14', '08:15'));
  assert.deepEqual(tripSummary(t), { go: 50 * 60000, work: 10.5 * HOUR, back: 45 * 60000 });
});

test('新一趟：午夜前出門、午夜後先上班；中間留空都照樣接得上', () => {
  const t = resolveTrip(blank(), typed({ out: '23:40', clockIn: '00:15', clockOut: '08:00' }), '2026-11-13');
  assert.equal(t.out, at('2026-11-13', '23:40'));
  assert.equal(t.clockIn, at('2026-11-14', '00:15'));
  assert.equal(t.clockOut, at('2026-11-14', '08:00'));
  assert.equal(t.ride, null);
});

test('修改已有嘅一趟：只改一格，其他格一分鐘都唔會郁', () => {
  const orig = { ...blank(), out: at('2026-11-13', '20:12'), arrive: at('2026-11-13', '20:47'), clockIn: at('2026-11-13', '20:58') + 17000, clockOut: at('2026-11-14', '09:04') };
  const vals = Object.fromEntries(STEPS.map((k) => [k, orig[k] == null ? '' : fmtTime(orig[k])]));
  const t = resolveTrip(orig, { ...vals, home: '09:50' }, '2026-11-13');
  // 上班原本有秒數（即場撳掣記低），冇改過就原封不動。
  assert.equal(t.clockIn, orig.clockIn);
  assert.equal(t.out, orig.out);
  assert.equal(t.clockOut, orig.clockOut);
  assert.equal(t.home, at('2026-11-14', '09:50'));
});

test('修改已有嘅一趟：補返最頂嗰格，日期貼住下面原有嘅時間（唔會跌咗去第二日）', () => {
  const orig = { ...blank(), clockIn: at('2026-11-14', '00:20'), clockOut: at('2026-11-14', '08:00') };
  const t = resolveTrip(orig, typed({ out: '23:30', clockIn: '00:20', clockOut: '08:00' }), '2026-11-14');
  assert.equal(t.out, at('2026-11-13', '23:30'));
  assert.equal(t.clockIn, orig.clockIn);
});

test('改咗實際日期：成趟由新日期重新排（搬去另一日）', () => {
  const orig = { ...blank(), out: at('2026-11-13', '20:10'), clockIn: at('2026-11-13', '21:00'), clockOut: at('2026-11-14', '07:30') };
  const t = resolveTrip(orig, typed({ out: '20:10', clockIn: '21:00', clockOut: '07:30' }), '2026-11-12', { rechain: true });
  assert.equal(t.out, at('2026-11-12', '20:10'));
  assert.equal(t.clockOut, at('2026-11-13', '07:30'));
});

test('夏令時間結束嗰晚（11/1 多一個鐘）：鐘數照寫，工時係真實嘅 11 個鐘', () => {
  const t = resolveTrip(blank(), typed({ clockIn: '21:00', clockOut: '07:00' }), '2026-10-31');
  assert.equal(fmtTime(t.clockOut), '07:00');
  assert.equal(t.clockOut - t.clockIn, 11 * HOUR);
});

test('擋住唔合理：次序錯、相隔太耐、未到嘅時間、有下班冇上班、乜都冇填', () => {
  fresh({ jobs: [job] });
  const now = at('2026-11-14', '10:00');
  const d = get();
  const mk = (o, anchor = '2026-11-13') => resolveTrip(blank(), typed(o), anchor);
  assert.equal(checkTrip(d, { times: mk({}) }, now).reason, 'empty');
  assert.equal(checkTrip(d, { times: mk({ clockOut: '07:00' }) }, now).reason, 'no-clock-in');
  // 到家 08:00 打咗做 20:00 之前嘅 19:00：接落去會變成第二晚，相隔太耐 → 擋。
  const gap = checkTrip(d, { times: mk({ out: '20:00', home: '19:00' }, '2026-11-12') }, now);
  assert.equal(gap.reason, 'gap');
  assert.match(tripErrorText(gap), /「到家」早過「出門」/);
  assert.equal(checkTrip(d, { times: mk({ clockIn: '21:00', clockOut: '11:00' }) }, now).reason, 'future');
  assert.equal(checkTrip(d, { times: mk({ out: '20:10', clockIn: '21:00', clockOut: '07:30', home: '08:10' }) }, now), null);
  // 原有時間冇改、但你將上面嗰格改到遲過佢 → 次序錯。
  const orig = { ...blank(), out: at('2026-11-13', '20:10'), clockIn: at('2026-11-13', '21:00') };
  const bad = resolveTrip(orig, typed({ out: '20:10', arrive: '21:30', clockIn: '21:00' }), '2026-11-13');
  assert.equal(checkTrip(d, { times: bad }, now).reason, 'order');
});

test('saveTrip：一次過寫入出勤同通勤；工作日就係你揀嗰日；工時啱', () => {
  fresh({ jobs: [job] });
  const now = at('2026-11-14', '10:00');
  const times = resolveTrip(blank(), typed({ out: '20:10', ride: '20:20', arrive: '20:45', clockIn: '21:00', clockOut: '07:30', ride2: '07:40', home: '08:15' }), '2026-11-13');
  const r = saveTrip({ wd: '2026-11-13', times, verified: true }, now);
  assert.equal(r.ok, true);
  const d = get();
  assert.equal(d.sessions.length, 1);
  assert.equal(d.journeys.length, 1);
  const s = d.sessions[0];
  assert.equal(workdayOfSession(s, d), '2026-11-13');
  assert.equal(sessionWorkMs(s, now), 10.5 * HOUR);
  assert.equal(d.journeys[0].sessionId, s.id);
  assert.equal(d.journeys[0].home, at('2026-11-14', '08:15'));
  assert.equal(tripAllVerified(findTrip(d, { sessionId: s.id })), true);
  assert.deepEqual(tripsOfWorkday(d, '2026-11-13').map((t) => t.session.id), [s.id]);
});

test('saveTrip：連續兩晚夜班，兩趟各歸各日，互不影響；重疊嘅班存唔到', () => {
  fresh({ jobs: [job] });
  const now = at('2026-11-14', '10:00');
  const a = resolveTrip(blank(), typed({ out: '20:10', clockIn: '21:00', clockOut: '07:30', home: '08:15' }), '2026-11-12');
  const b = resolveTrip(blank(), typed({ out: '20:05', clockIn: '21:00', clockOut: '07:40', home: '08:20' }), '2026-11-13');
  assert.equal(saveTrip({ wd: '2026-11-12', times: a }, now).ok, true);
  assert.equal(saveTrip({ wd: '2026-11-13', times: b }, now).ok, true);
  const d = get();
  assert.equal(tripsOfWorkday(d, '2026-11-12').length, 1);
  assert.equal(tripsOfWorkday(d, '2026-11-13').length, 1);
  assert.equal(tripTimes(tripsOfWorkday(d, '2026-11-12')[0]).clockOut, at('2026-11-13', '07:30'));
  assert.equal(tripTimes(tripsOfWorkday(d, '2026-11-13')[0]).clockOut, at('2026-11-14', '07:40'));
  // 第三趟同第一晚重疊 → 擋住，資料唔變。
  const c = resolveTrip(blank(), typed({ clockIn: '23:00', clockOut: '03:00' }), '2026-11-12');
  const r = saveTrip({ wd: '2026-11-12', times: c }, now);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'overlap');
  assert.equal(get().sessions.length, 2);
});

test('saveTrip：修改已有一趟（補下班同到家），班內休息、收入、其他時間原封不動', () => {
  const s0 = ses('s1', at('2026-11-13', '20:58'), null, { breaks: [{ start: at('2026-11-14', '01:00'), end: at('2026-11-14', '01:30') }], income: 123, verified: { start: true } });
  fresh({ jobs: [job], sessions: [s0], journeys: [{ id: 'j1', sessionId: 's1', out: at('2026-11-13', '20:12'), ride: null, arrive: at('2026-11-13', '20:47'), leave: null, ride2: null, home: null }] });
  const now = at('2026-11-14', '10:30');
  const sh = { type: 'trip', wd: '2026-11-13', sessionId: 's1' };
  const st0 = tripState(get(), sh, now);
  assert.equal(st0.error, null);
  const st = tripState(get(), { ...sh, vals: { ...st0.vals, clockOut: '09:05', home: '09:50' } }, now);
  assert.equal(st.error, null);
  assert.deepEqual(st.rows.map((r) => r.off), [0, 0, 0, 0, 1, 0, 1]);
  const r = saveTrip({ sessionId: 's1', wd: '2026-11-13', times: st.times }, now);
  assert.equal(r.ok, true);
  const d = get();
  const s = d.sessions[0];
  assert.equal(s.start, s0.start);
  assert.equal(s.end, at('2026-11-14', '09:05'));
  assert.equal(s.income, 123);
  assert.deepEqual(s.breaks, s0.breaks);
  assert.deepEqual(s.verified, { start: true });
  assert.equal(d.journeys[0].out, at('2026-11-13', '20:12'));
  assert.equal(d.journeys[0].home, at('2026-11-14', '09:50'));
});

test('saveTrip：只有通勤（冇上班）都記得到；之後補返上班就自動掛埋一齊', () => {
  fresh({ jobs: [job] });
  const now = at('2026-11-14', '10:00');
  const t1 = resolveTrip(blank(), typed({ out: '20:10', arrive: '20:45' }), '2026-11-13');
  const r1 = saveTrip({ wd: '2026-11-13', times: t1 }, now);
  assert.equal(r1.ok, true);
  assert.equal(get().sessions.length, 0);
  const trip = tripsOfWorkday(get(), '2026-11-13')[0];
  assert.equal(trip.journey.id, r1.journeyId);
  const st = tripState(get(), { wd: '2026-11-13', journeyId: r1.journeyId, vals: { out: '20:10', ride: '', arrive: '20:45', clockIn: '21:00', clockOut: '07:30', ride2: '', home: '' } }, now);
  assert.equal(st.error, null);
  const r2 = saveTrip({ journeyId: r1.journeyId, wd: '2026-11-13', times: st.times }, now);
  assert.equal(r2.ok, true);
  const d = get();
  assert.equal(d.sessions.length, 1);
  assert.equal(d.journeys.length, 1);
  assert.equal(d.journeys[0].sessionId, d.sessions[0].id);
});

test('saveTrip：舊班唔可以清空下班（會變成一直返工到現在）；上班唔可以留空', () => {
  fresh({ jobs: [job], sessions: [ses('s1', at('2026-11-10', '21:00'), at('2026-11-11', '07:00')), ses('s2', at('2026-11-12', '21:00'), at('2026-11-13', '07:00'))] });
  const now = at('2026-11-14', '10:00');
  const st = tripState(get(), { wd: '2026-11-10', sessionId: 's1', vals: { out: '', ride: '', arrive: '', clockIn: '21:00', clockOut: '', ride2: '', home: '' } }, now);
  assert.equal(st.error.reason, 'clear-end');
  const st2 = tripState(get(), { wd: '2026-11-10', sessionId: 's1', vals: { out: '', ride: '', arrive: '', clockIn: '', clockOut: '07:00', ride2: '', home: '' } }, now);
  assert.equal(st2.error.reason, 'need-clock-in');
  assert.equal(saveTrip({ sessionId: 's1', wd: '2026-11-10', times: st.times }, now).ok, false);
  assert.equal(get().sessions.find((x) => x.id === 's1').end, at('2026-11-11', '07:00'));
});

test('deleteTrip：出勤連通勤一齊刪；獨立通勤只刪嗰段', () => {
  fresh({ jobs: [job], sessions: [ses('s1', at('2026-11-12', '21:00'), at('2026-11-13', '07:00'))], journeys: [{ id: 'j1', sessionId: 's1', out: at('2026-11-12', '20:10') }, { id: 'j2', sessionId: null, out: at('2026-11-10', '20:10'), workdayDate: '2026-11-10' }] });
  assert.equal(deleteTrip({ journeyId: 'j2' }).ok, true);
  assert.deepEqual(get().journeys.map((j) => j.id), ['j1']);
  assert.equal(deleteTrip({ sessionId: 's1' }).ok, true);
  assert.equal(get().sessions.length, 0);
  assert.equal(get().journeys.length, 0);
});

test('整趟面板：七格都喺度，每格下面寫明邊一日；「＋」先出選單', () => {
  fresh({ jobs: [job], sessions: [ses('s1', at('2026-11-13', '20:58'), at('2026-11-14', '09:04'))], journeys: [{ id: 'j1', sessionId: 's1', out: at('2026-11-13', '20:12'), ride: null, arrive: null, leave: null, ride2: null, home: at('2026-11-14', '09:50') }] });
  const now = at('2026-11-14', '12:00');
  const sh = openTripSheet(get(), '2026-11-13', now);
  assert.equal(sh.sessionId, 's1');
  const html = sheetView({ data: get(), now, ui: { sheet: sh } });
  for (const k of STEPS) assert.match(html, new RegExp(`name="t_${k}"`));
  assert.match(html, /name="t_out" value="20:12"/);
  assert.match(html, /data-trip-hint="clockOut" class="is-next">週六 11\/14 隔天</);
  assert.match(html, /data-trip-hint="ride">未填</);
  assert.match(html, /去程 <strong>0h 46m<\/strong> · 上班 <strong>12h 06m<\/strong> · 回程 <strong>0h 46m<\/strong>/);
  assert.match(html, /data-action="trip-delete">刪除這一趟/);
  // 冇紀錄嘅日子：開一張新嘅，實際日期預設就係嗰個工作日。
  const blankSheet = openTripSheet(get(), '2026-11-09', now);
  assert.equal(blankSheet.isNew, true);
  assert.match(sheetView({ data: get(), now, ui: { sheet: blankSheet } }), /name="anchor" value="2026-11-09"/);
  const menu = sheetView({ data: get(), now, ui: { sheet: { type: 'add-menu', wd: '2026-11-13' } } });
  assert.match(menu, /data-action="open-trip" data-wd="2026-11-13"/);
  assert.match(menu, /返工＋通勤（整趟）/);
});

test('漏記睡眠嘅提示：週四晚開工但計咗入週三工作日 → 建議改返週四；一撳就改，其他時間唔郁', () => {
  // 週三 17:00 起身（有記），週四日頭瞓咗冇記，週四 21:00 即場撳掣開工 → 自動規則會計入週三。
  fresh({ jobs: [job], sleeps: [{ id: 'z', start: at('2026-11-11', '09:00'), end: at('2026-11-11', '17:00') }], sessions: [ses('s1', at('2026-11-12', '21:00'), at('2026-11-13', '07:00'))] });
  const now = at('2026-11-13', '12:00');
  const d = get();
  assert.equal(workdayOfSession(d.sessions[0], d), '2026-11-11');
  const trip = findTrip(d, { sessionId: 's1' });
  assert.equal(tripWorkdaySuggestion(d, trip), '2026-11-12');
  const html = sheetView({ data: d, now, ui: { sheet: { type: 'trip', wd: '2026-11-11', sessionId: 's1' } } });
  assert.match(html, /data-action="trip-wdfix" data-wd="2026-11-12">改為計入 週四 11\/12/);
  const st = tripState(d, { wd: '2026-11-11', sessionId: 's1', wdTo: '2026-11-12' }, now);
  assert.equal(saveTrip({ sessionId: 's1', wd: '2026-11-11', wdTo: '2026-11-12', times: st.times }, now).ok, true);
  const d2 = get();
  assert.equal(workdayOfSession(d2.sessions[0], d2), '2026-11-12');
  assert.equal(d2.sessions[0].start, at('2026-11-12', '21:00'));
  assert.equal(tripWorkdaySuggestion(d2, findTrip(d2, { sessionId: 's1' })), null);
  // 啱啱起身幾個鐘就開工（正常情況）：唔會提示。
  fresh({ jobs: [job], sleeps: [{ id: 'z', start: at('2026-11-12', '09:00'), end: at('2026-11-12', '17:00') }], sessions: [ses('s1', at('2026-11-13', '00:30'), at('2026-11-13', '07:00'))] });
  assert.equal(tripWorkdaySuggestion(get(), findTrip(get(), { sessionId: 's1' })), null);
});
