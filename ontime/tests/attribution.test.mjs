// 睡眠歸屬：只有手動指定才算數，其餘依入睡時間即時推算。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { at } from '../js/time.js';
import { sleepWorkday, latestOpenSleep, sleepWorkdayChanges, dayOf } from '../js/logic.js';

const base = () => ({
  jobs: [], shifts: [], sessions: [], journeys: [], meals: [], dayMarks: [], templates: [], settings: {},
  sleeps: []
});

// 10/12 12:00–20:00 睡 8 小時 → 產生「10/12 工作日」的起床邊界。
const withBoundary = () => {
  const d = base();
  d.sleeps.push({ id: 'main', start: at('2026-10-12', '12:00'), end: at('2026-10-12', '20:00') });
  return d;
};

test('舊資料寫死的 workdayDate 不再生效，改用自動推算', () => {
  const d = withBoundary();
  d.sleeps.push({ id: 'old', start: at('2026-10-14', '09:00'), end: at('2026-10-14', '13:00'), workdayDate: '2026-10-12' });
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-14');
});

test('手動指定（workdayManual）優先', () => {
  const d = withBoundary();
  d.sleeps.push({ id: 'manual', start: at('2026-10-14', '09:00'), end: at('2026-10-14', '13:00'), workdayDate: '2026-10-13', workdayManual: true });
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-13');
});

test('手動指定為 null 時按入睡日期', () => {
  const d = withBoundary();
  d.sleeps.push({ id: 'byDate', start: at('2026-10-14', '09:00'), end: at('2026-10-14', '13:00'), workdayDate: null, workdayManual: true });
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-14');
});

test('多筆進行中的睡眠，取最晚開始那一筆', () => {
  const d = base();
  d.sleeps.push({ id: 'old', start: at('2026-10-10', '22:00'), end: null });
  d.sleeps.push({ id: 'new', start: at('2026-10-11', '18:00'), end: null });
  assert.equal(latestOpenSleep(d).id, 'new');
  assert.equal(latestOpenSleep(base()), null);
});

test('重新計算預覽只列出真正會改變的紀錄', () => {
  const d = withBoundary();
  d.sleeps.push({ id: 'changed', start: at('2026-10-14', '09:00'), end: at('2026-10-14', '13:00'), workdayDate: '2026-10-12' });
  d.sleeps.push({ id: 'same', start: at('2026-10-12', '21:00'), end: at('2026-10-12', '21:30'), workdayDate: '2026-10-12' });
  d.sleeps.push({ id: 'manual', start: at('2026-10-14', '15:00'), end: at('2026-10-14', '19:00'), workdayDate: '2026-10-01', workdayManual: true });
  const changes = sleepWorkdayChanges(d);
  assert.deepEqual(changes.map((x) => x.id), ['changed']);
  assert.equal(changes[0].from, '2026-10-12');
  assert.equal(changes[0].to, '2026-10-14');
});

test('36 小時上限：35h45m 仍在範圍內，超過 36h 改用後備規則', () => {
  const d = withBoundary();
  assert.equal(dayOf(d, at('2026-10-14', '07:45')), '2026-10-12');
  assert.equal(dayOf(d, at('2026-10-14', '09:00')), null);
});
