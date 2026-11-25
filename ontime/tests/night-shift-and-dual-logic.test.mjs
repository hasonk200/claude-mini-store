// 2.49.0：夜班隔天一鍵掣 ＋ 整趟／逐項補登底層邏輯、驗證與資料一致性測試
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at, addDays, HOUR, MIN } from '../js/time.js';
import { STEPS, tripState, journeyOfSession } from '../js/logic.js';
import { createShift, setStepTime, checkRefTime, setRefTime, saveTrip } from '../js/actions.js';
import { sheetView, nextRecordStep } from '../js/views/sheet.js';
import { timelineView } from '../js/views/timeline.js';

const fresh = (d = {}) => replaceAll({ ...emptyData(), ...d }, { tombstone: false });
const jobW = { id: 'jw', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 };
const jobD = { id: 'jd', name: '外送', color: 'deliv', payMode: 'perOrder', rate: null };

test('整趟面板「🌙 夜班隔天」快捷掣：當日 vs 隔天亮燈狀態正確，凌晨 < 04:00 自動亮隔天', () => {
  fresh({ jobs: [jobW, jobD] });
  const now = at('2026-11-25', '15:00');
  const wd = '2026-11-24';

  // 預設 anchor = 當日 11/24
  const hDay = sheetView({ data: get(), now, ui: { sheet: { type: 'trip', wd, isNew: true } } });
  assert.match(hDay, /data-action="trip-anchor-day" data-offset="0" aria-pressed="true"/);
  assert.match(hDay, /data-action="trip-anchor-day" data-offset="1" aria-pressed="false"/);
  assert.match(hDay, /夜班隔天 11\/25/);

  // 手動按「夜班隔天」後（anchor = 11/25）：隔天掣亮燈，左邊工作日仍鎖定 週二 11/24
  const hManual = sheetView({ data: get(), now, ui: { sheet: { type: 'trip', wd, isNew: true, anchor: '2026-11-25' } } });
  assert.match(hManual, /週二工作日 · 11\/24/);
  assert.match(hManual, /data-action="trip-anchor-day" data-offset="1" aria-pressed="true"/);
  assert.match(hManual, /name="anchor" value="2026-11-25"/);

  // 第一格打 01:07（< 04:00）自動推算隔天 → 隔天掣一樣自動亮燈
  const hAuto = sheetView({ data: get(), now, ui: { sheet: { type: 'trip', wd, isNew: true, vals: { out: '01:07' } } } });
  assert.match(hAuto, /name="anchor" value="2026-11-25"/);
  assert.match(hAuto, /data-action="trip-anchor-day" data-offset="1" aria-pressed="true"/);
});

test('app.js 修走改「實際日期」偷偷改埋工作日嘅 bug，並有夜班快捷與 toastUndo', () => {
  const src = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(src, /'trip-anchor-day':/);
  const anchorBlock = src.slice(src.indexOf("el.dataset.action === 'trip-anchor'"), src.indexOf("el.dataset.action === 'trip-wdto'"));
  assert.doesNotMatch(anchorBlock, /follow/);
  assert.match(src, /function applyRecord[\s\S]{0,1200}toastUndo\(/);
  const refBlock = src.slice(src.indexOf("'ref-time': (f) =>"), src.indexOf("'meal': (f, e) =>"));
  assert.match(refBlock, /toastUndo\('已更新時間'\)/);
  const delBlock = src.slice(src.indexOf("'delete-ref-confirm':"), src.indexOf("'wd-auto':"));
  assert.match(delBlock, /toastUndo\(msg\)/);
});

test('選項 A：逐項補登通勤只顯示 5 步（無「離開」）、清楚分「去程上車／回程上車」，時間線通勤卡不帶 leave', () => {
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true };
  const j = { id: 'j1', sessionId: 's1', out: at('2026-11-24', '20:10'), ride: null, arrive: at('2026-11-24', '20:45'), leave: null, ride2: null, home: null };
  fresh({ jobs: [jobW, jobD], sessions: [s], journeys: [j] });
  const now = at('2026-11-25', '12:00');

  const html = sheetView({ data: get(), now, ui: { drafts: {}, sheet: { type: 'record', wd: '2026-11-24', cat: 'commute', step: 'out', sid: 's1' } } });
  assert.doesNotMatch(html, /data-step="leave"/);
  assert.match(html, /去程上車/);
  assert.match(html, /回程上車/);
  assert.equal((html.match(/data-action="rec-step"/g) || []).length, 5);

  const tl = timelineView({ data: get(), wd: '2026-11-24', now, ui: { tlMode: 'workday' } });
  assert.doesNotMatch(tl, /data-step="leave"/);
  assert.match(tl, /data-action="open-trip" data-wd="2026-11-24" data-step="home"/);
});

test('逐項補登「＋ 新增班次」支援揀工作、有「夜班隔天」掣，且自動掛接獨立通勤紀錄', () => {
  fresh({
    jobs: [jobW, jobD],
    journeys: [{ id: 'jSolo', sessionId: null, workdayDate: '2026-11-24', workdayManual: true, out: at('2026-11-25', '01:05'), ride: null, arrive: at('2026-11-25', '01:40'), leave: null, ride2: null, home: null }]
  });
  const now = at('2026-11-25', '14:00');
  const html = sheetView({ data: get(), now, ui: { drafts: {}, sheet: { type: 'record', wd: '2026-11-24', cat: 'work', step: 'clockIn', newShift: true } } });
  assert.match(html, /data-action="newshift-job" data-job="jd"/);
  assert.match(html, /data-action="newshift-day" data-date="2026-11-25"/);

  const r = createShift('2026-11-24', at('2026-11-25', '01:52'), at('2026-11-25', '12:00'), now, { jobId: 'jd' });
  assert.equal(r.ok, true);
  const d = get();
  const s = d.sessions.find((x) => x.id === r.id);
  assert.equal(s.jobId, 'jd');
  assert.equal(s.payMode, 'perOrder');
  assert.equal(journeyOfSession(d, s)?.id, 'jSolo', '既有獨立通勤應自動掛入新建班次');
});

test('createShift 驗證：阻擋未來時間、時間重疊、雙開進行中班次', () => {
  const now = at('2026-11-25', '12:00');
  fresh({ jobs: [jobW], sessions: [{ id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [] }] });
  assert.deepEqual(createShift('2026-11-25', at('2026-11-25', '14:00'), null, now), { ok: false, reason: 'future' });
  assert.deepEqual(createShift('2026-11-24', at('2026-11-24', '22:00'), at('2026-11-25', '06:00'), now), { ok: false, reason: 'overlap' });

  fresh({ jobs: [jobW], sessions: [{ id: 'sOpen', jobId: 'jw', start: at('2026-11-25', '08:00'), end: null, breaks: [] }] });
  assert.deepEqual(createShift('2026-11-25', now, null, now), { ok: false, reason: 'has-open' });
});

test('setStepTime 與 setRefTime 驗證一致性：攔截未來時間、步驟亂序、以及改休息開始唔會複製多筆', () => {
  const now = at('2026-11-25', '12:00');
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [{ start: at('2026-11-25', '01:00'), end: at('2026-11-25', '01:30') }], workdayDate: '2026-11-24', workdayManual: true };
  fresh({ jobs: [jobW], sessions: [s] });

  // 未來時間
  assert.equal(setStepTime('2026-11-24', 'home', at('2026-11-25', '15:00'), { sessionId: 's1', now }).reason, 'future');
  assert.equal(checkRefTime(get(), { type: 'session', id: 's1', field: 'end' }, at('2026-11-25', '15:00'), now), 'future');

  // 步驟亂序：出門晚過上班、到家早過下班、修改單一事件令上班晚過原本下班／到家早過下班
  assert.equal(setStepTime('2026-11-24', 'out', at('2026-11-24', '21:30'), { sessionId: 's1', now }).reason, 'order');
  assert.equal(setStepTime('2026-11-24', 'home', at('2026-11-25', '08:30'), { sessionId: 's1', now }).reason, 'order');
  assert.equal(setStepTime('2026-11-24', 'home', at('2026-11-25', '09:45'), { sessionId: 's1', now }).ok, true);
  assert.equal(setRefTime({ type: 'journey', id: get().journeys[0].id, field: 'home' }, at('2026-11-25', '08:45'), { now }).reason, 'order');

  // 計畫中的睡眠與未確定用餐：允許未來時間
  fresh({
    jobs: [jobW],
    sleeps: [{ id: 'slp', start: null, end: null, planStart: at('2026-11-25', '14:00'), planEnd: at('2026-11-25', '21:00') }],
    meals: [{ id: 'ml', start: at('2026-11-25', '13:00'), end: null, confirmed: false, name: '晚餐' }]
  });
  assert.equal(checkRefTime(get(), { type: 'sleep', id: 'slp', field: 'start' }, at('2026-11-25', '15:00'), now), null);
  assert.equal(checkRefTime(get(), { type: 'meal', id: 'ml' }, at('2026-11-25', '13:30'), now), null);

  // L6：修改班內休息嘅開始時間（origStart）唔會複製多一筆
  fresh({ jobs: [jobW], sessions: [s] });
  const rBr = setStepTime('2026-11-24', 'break', at('2026-11-25', '01:05'), { sessionId: 's1', origStart: at('2026-11-25', '01:00'), end: at('2026-11-25', '01:35'), now });
  assert.equal(rBr.ok, true);
  assert.equal(get().sessions[0].breaks.length, 1);
  assert.equal(get().sessions[0].breaks[0].start, at('2026-11-25', '01:05'));
});

test('saveTrip 兼容舊版 leave：改遲下班會清走過期 leave 防止倒流，有效 leave 會跟住已驗證勾選', () => {
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true };
  const j = { id: 'j1', sessionId: 's1', out: at('2026-11-24', '20:10'), ride: null, arrive: null, leave: at('2026-11-25', '09:10'), ride2: at('2026-11-25', '09:20'), home: at('2026-11-25', '10:00') };
  fresh({ jobs: [jobW], sessions: [s], journeys: [j] });
  const now = at('2026-11-25', '12:00');

  // 1) 下班由 09:00 改去 09:05，leave 09:10 仍然有效 → 保留 leave 並同步 verified.leave
  const st1 = tripState(get(), { wd: '2026-11-24', sessionId: 's1', vals: { out: '20:10', ride: '', arrive: '', clockIn: '21:00', clockOut: '09:05', ride2: '09:20', home: '10:00' } }, now);
  assert.equal(saveTrip({ sessionId: 's1', wd: '2026-11-24', times: st1.times, verified: true }, now).ok, true);
  assert.equal(get().journeys[0].leave, at('2026-11-25', '09:10'));
  assert.equal(get().journeys[0].verified?.leave, true);

  // 2) 下班再改遲去 09:15（> leave 09:10）→ 自動清走過期 leave 避免時序倒流
  const st2 = tripState(get(), { wd: '2026-11-24', sessionId: 's1', vals: { out: '20:10', ride: '', arrive: '', clockIn: '21:00', clockOut: '09:15', ride2: '09:25', home: '10:05' } }, now);
  assert.equal(saveTrip({ sessionId: 's1', wd: '2026-11-24', times: st2.times, verified: true }, now).ok, true);
  assert.equal(get().journeys[0].leave, null);
  assert.equal(get().journeys[0].verified?.leave, undefined);
});

test('nextRecordStep：「儲存並繼續」自動跳去同類別下一格未填步驟，全部填完回傳 null', () => {
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true };
  const j = { id: 'j1', sessionId: 's1', out: at('2026-11-24', '20:10'), ride: null, arrive: at('2026-11-24', '20:45'), leave: null, ride2: null, home: null };
  fresh({ jobs: [jobW], sessions: [s], journeys: [j] });
  const d = get();
  assert.equal(nextRecordStep(d, '2026-11-24', 'commute', 'out', 's1'), 'ride');
  assert.equal(nextRecordStep(d, '2026-11-24', 'commute', 'arrive', 's1'), 'ride2');
  // 全部填滿 → null
  j.ride = at('2026-11-24', '20:20');
  j.ride2 = at('2026-11-25', '09:10');
  j.home = at('2026-11-25', '09:50');
  assert.equal(nextRecordStep(d, '2026-11-24', 'commute', 'home', 's1'), null);
});
