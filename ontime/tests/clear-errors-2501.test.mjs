// 2.50.1：撞班講清楚撞到邊一班、時間線改時間講清楚撞到邊一步、整趟「夜班隔天」成趟搬日要先確認。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at } from '../js/time.js';
import { tripState, tripMoveDays, overlapText, tripErrorText, checkTrip } from '../js/logic.js';
import { createShift, setStepTime, setRefTime, checkRefTime } from '../js/actions.js';

const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const job = { id: 'jw', name: '倉庫', color: 'work', payMode: 'hourly', rate: 20 };
const fresh = (d = {}) => replaceAll({ ...emptyData(), jobs: [job], ...d }, { tombstone: false });

test('忘記撳下班嘅舊班：補登今日嗰班時，講明係邊一班未記下班，並教你先補下班', () => {
  // 週一晚 21:00 撳咗上班，一直冇撳下班（冇標待補）。
  fresh({ sessions: [{ id: 'old', jobId: 'jw', start: at('2026-11-23', '21:00'), end: null, breaks: [], workdayDate: '2026-11-23', workdayManual: true }] });
  const now = at('2026-11-25', '20:00');
  for (const r of [
    createShift('2026-11-25', at('2026-11-25', '09:00'), at('2026-11-25', '17:00'), now),
    setStepTime('2026-11-25', 'clockIn', at('2026-11-25', '09:00'), { now })
  ]) {
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'overlap');
    assert.deepEqual({ id: r.other.id, open: r.other.open, wd: r.other.wd }, { id: 'old', open: true, wd: '2026-11-23' });
    assert.equal(overlapText(r.other), '週一 11/23 那班 21:00 開工後未記下班，請先補那班的下班時間');
  }
});

test('撞到已收工嘅另一班：講明嗰班幾點到幾點', () => {
  fresh({ sessions: [{ id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '05:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true }] });
  const r = createShift('2026-11-24', at('2026-11-24', '22:00'), at('2026-11-25', '06:00'), at('2026-11-25', '12:00'));
  assert.equal(overlapText(r.other), '同 週二 11/24 那班（21:00–05:00）時間重疊');
  // 整趟面板都用同一句
  const err = checkTrip(get(), { times: { clockIn: at('2026-11-24', '22:00'), clockOut: at('2026-11-25', '06:00') } }, at('2026-11-25', '12:00'));
  assert.equal(tripErrorText(err), '同 週二 11/24 那班（21:00–05:00）時間重疊');
});

test('時間線直接改時間：次序唔啱時講明撞到邊一步；checkRefTime 照舊回傳文字', () => {
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '05:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true };
  const j = { id: 'j1', sessionId: 's1', out: at('2026-11-24', '20:10'), ride: null, arrive: null, leave: null, ride2: null, home: null };
  fresh({ sessions: [s], journeys: [j] });
  const now = at('2026-11-25', '12:00');
  const r = setRefTime({ type: 'session', id: 's1', field: 'start' }, at('2026-11-24', '20:00'), { now });
  assert.deepEqual(r, { ok: false, reason: 'order', step: 'clockIn', prev: 'out' });
  const r2 = setRefTime({ type: 'journey', id: 'j1', field: 'out' }, at('2026-11-24', '21:30'), { now });
  assert.deepEqual(r2, { ok: false, reason: 'order', step: 'clockIn', prev: 'out' });
  assert.equal(checkRefTime(get(), { type: 'session', id: 's1', field: 'start' }, at('2026-11-24', '20:00'), now), 'order');
  // 畫面用「去程上車／回程上車」分開兩次上車，撞班時提示有掣跳去嗰班
  assert.match(appSrc, /ride: '去程上車', ride2: '回程上車'/);
  assert.match(appSrc, /data-step="clockOut">補那班下班<\/button>/);
  assert.match(appSrc, /data-action="open-trip"[^`]*>看那一班<\/button>/);
  assert.equal((appSrc.match(/recordErrorToast\(r\);/g) || []).length, 3, '補登、新增班次、時間線改時間都用同一個提示');
});

test('整趟：已存好嘅一趟撳「夜班隔天」= 成趟搬一日，要偵測得到；只改一格唔算', () => {
  const s = { id: 's1', jobId: 'jw', start: at('2026-11-17', '21:00'), end: at('2026-11-18', '05:00'), breaks: [], workdayDate: '2026-11-17', workdayManual: true };
  const j = { id: 'j1', sessionId: 's1', out: at('2026-11-17', '20:10'), ride: null, arrive: null, leave: null, ride2: null, home: at('2026-11-18', '05:50') };
  fresh({ sessions: [s], journeys: [j] });
  const now = at('2026-11-25', '12:00');
  const base = { type: 'trip', wd: '2026-11-17', sessionId: 's1' };
  assert.equal(tripMoveDays(tripState(get(), base, now)), 0, '冇改嘢');
  const moved = tripState(get(), { ...base, anchor: '2026-11-18' }, now);
  assert.equal(moved.error, null, '上星期嘅紀錄搬一日唔會被「未來時間」擋住，所以一定要另外確認');
  assert.equal(tripMoveDays(moved), 1);
  assert.equal(moved.origAnchor, '2026-11-17');
  const oneCell = tripState(get(), { ...base, vals: { clockOut: '06:00' } }, now);
  assert.equal(tripMoveDays(oneCell), 0, '只改一格唔使確認');
  assert.equal(tripMoveDays(tripState(get(), { type: 'trip', wd: '2026-11-17', isNew: true, anchor: '2026-11-18', vals: { out: '01:00' } }, now)), 0, '新嘅一趟唔使確認');
});

test('整趟：成趟搬日時日期格有提示，儲存前先彈確認；取消會返回面板保留已填時間', () => {
  assert.match(appSrc, /function tripAnchorTo\(sh, anchor\)/);
  assert.match(appSrc, /'trip-anchor-day':[\s\S]{0,200}tripAnchorTo\(sh, addDays\(sh\.wd, off\)\)/);
  assert.match(appSrc, /el\.dataset\.action === 'trip-anchor'[\s\S]{0,300}tripAnchorTo\(ui\.sheet, el\.value\)/);
  const save = appSrc.slice(appSrc.indexOf('  trip: (f) => {'), appSrc.indexOf("'sleep-catchup': (f) =>"));
  assert.match(save, /tripMoveDays\(st\)[\s\S]*!sh\.moveOk[\s\S]*action: 'trip-move-force'[\s\S]*cancel: 'trip-move-cancel'/);
  assert.match(appSrc, /'trip-move-cancel':[\s\S]{0,200}ui\.sheet = p \? p\.sheet : null/);
});
