// R2：修改時間不合理（開始晚過結束、結束早過開始）就不寫入；表單保留剛填的時間。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, emptyData } from '../js/store.js';
import { setRefTime, checkRefTime, setStepTime } from '../js/actions.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const base = () => ({
  ...emptyData(),
  jobs: [{ id: 'j1', name: 'x', payMode: 'none' }],
  sessions: [{ id: 's1', jobId: 'j1', start: at('2026-10-20', '09:00'), end: at('2026-10-20', '17:00'), breaks: [], payMode: 'none' }],
  sleeps: [{ id: 'sl1', start: at('2026-10-20', '23:00'), end: at('2026-10-21', '07:00') }],
  rests: [{ id: 'r1', start: at('2026-10-21', '12:00'), end: at('2026-10-21', '13:00') }]
});

test('上班改成晚過下班：拒絕，資料不變', () => {
  replaceAll(base());
  const r = setRefTime({ type: 'session', id: 's1', field: 'start' }, at('2026-10-20', '18:00'));
  assert.deepEqual(r, { ok: false, reason: 'after-clock-out' });
  assert.equal(get().sessions[0].start, at('2026-10-20', '09:00'));
});

test('下班改成早過上班：拒絕', () => {
  replaceAll(base());
  const r = setRefTime({ type: 'session', id: 's1', field: 'end' }, at('2026-10-20', '08:00'));
  assert.deepEqual(r, { ok: false, reason: 'before-clock-in' });
  assert.equal(get().sessions[0].end, at('2026-10-20', '17:00'));
});

test('起床早過入睡、休息開始晚過結束：拒絕', () => {
  replaceAll(base());
  assert.equal(setRefTime({ type: 'sleep', id: 'sl1', field: 'end' }, at('2026-10-20', '22:00')).reason, 'before-start');
  assert.equal(setRefTime({ type: 'rest', id: 'r1', field: 'start' }, at('2026-10-21', '14:00')).reason, 'after-end');
  assert.equal(get().sleeps[0].end, at('2026-10-21', '07:00'));
  assert.equal(get().rests[0].start, at('2026-10-21', '12:00'));
});

test('合理的時間照樣存，回傳 ok', () => {
  replaceAll(base());
  assert.deepEqual(setRefTime({ type: 'session', id: 's1', field: 'end' }, at('2026-10-20', '17:30')), { ok: true });
  assert.equal(get().sessions[0].end, at('2026-10-20', '17:30'));
});

test('空白或無效時間：bad-time', () => {
  assert.equal(checkRefTime(base(), { type: 'session', id: 's1', field: 'end' }, null), 'bad-time');
  assert.equal(checkRefTime(base(), { type: 'session', id: 's1', field: 'end' }, NaN), 'bad-time');
});

test('補登上班晚過已有的下班：拒絕', () => {
  replaceAll(base());
  const r = setStepTime('2026-10-20', 'clockIn', at('2026-10-20', '18:00'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'after-clock-out');
  assert.equal(get().sessions[0].start, at('2026-10-20', '09:00'));
});

test('儲存失敗後重畫面板：顯示剛填的時間（draftT），不是原本的時間', () => {
  const data = base();
  const html = sheetView({ data, now: at('2026-10-21', '12:00'), ui: { sheet: { type: 'ref', ref: { type: 'session', id: 's1', field: 'end' }, t: data.sessions[0].end, title: '下班', draftT: at('2026-10-20', '08:00') } } });
  assert.match(html, /name="time" value="08:00"/);
  assert.doesNotMatch(html, /name="time" value="17:00"/);
});
