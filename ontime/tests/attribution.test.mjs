// 睡眠歸屬與補登流程：舊資料先保留、重算才改；起床找得到進行中的那一筆。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { at } from '../js/time.js';
import { sleepWorkday, latestOpenSleep, sleepWorkdayChanges, sleepEndTarget, dayOf } from '../js/logic.js';

const base = () => ({
  jobs: [], shifts: [], sessions: [], journeys: [], meals: [], dayMarks: [], templates: [], settings: {},
  sleeps: []
});

// 週四 10/15 12:59–21:22 睡 8h23m → 主睡眠，起床邊界在 10/15 21:22。
const withThursdayWake = () => {
  const d = base();
  d.sleeps.push({ id: 'main', start: at('2026-10-15', '12:59'), end: at('2026-10-15', '21:22') });
  return d;
};

test('舊資料沒有 workdayManual：先照舊保留，不會一部署就被改掉', () => {
  const d = withThursdayWake();
  d.sleeps.push({ id: 'old', start: at('2026-10-16', '09:17'), end: at('2026-10-16', '15:11'), workdayDate: '2026-10-15' });
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-15');
});

test('重算預覽列出會改變的紀錄；清掉後改用自動推算', () => {
  const d = withThursdayWake();
  d.sleeps.push({ id: 'wrong', start: at('2026-10-16', '09:17'), end: at('2026-10-16', '15:11'), workdayDate: '2026-10-12' });
  d.sleeps.push({ id: 'same', start: at('2026-10-16', '16:30'), end: at('2026-10-16', '17:00'), workdayDate: '2026-10-16' });
  const changes = sleepWorkdayChanges(d);
  assert.deepEqual(changes.map((x) => x.id), ['wrong']);
  assert.equal(changes[0].from, '2026-10-12');
  assert.equal(changes[0].to, '2026-10-15');

  delete d.sleeps[1].workdayDate; // 模擬按下「重新計算」
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-15');
  assert.equal(sleepWorkdayChanges(d).length, 0);
});

test('手動指定優先；指定 null 時按入睡日期', () => {
  const d = withThursdayWake();
  d.sleeps.push({ id: 'manual', start: at('2026-10-16', '09:17'), end: at('2026-10-16', '15:11'), workdayDate: '2026-10-13', workdayManual: true });
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-13');
  d.sleeps[1].workdayDate = null;
  assert.equal(sleepWorkday(d.sleeps[1], d), '2026-10-16');
});

test('多筆進行中的睡眠，取最晚開始那一筆', () => {
  const d = base();
  d.sleeps.push({ id: 'old', start: at('2026-10-10', '22:00'), end: null });
  d.sleeps.push({ id: 'new', start: at('2026-10-11', '18:00'), end: null });
  assert.equal(latestOpenSleep(d).id, 'new');
  assert.equal(latestOpenSleep(base()), null);
});

// 回報的實際情境：週四起床 21:22、週五補登入睡，睡眠被算到週四。
test('補登起床：週五找不到睡眠時，仍關得到進行中的那一筆', () => {
  const d = withThursdayWake();
  const sleep = { id: 'fri', start: at('2026-10-16', '09:17'), end: null, note: '' };
  d.sleeps.push(sleep);
  assert.equal(sleepWorkday(sleep, d), '2026-10-15'); // 自動規則算成週四
  const target = sleepEndTarget(d, '2026-10-16');
  assert.ok(target, '不應該找不到');
  assert.equal(target.id, 'fri');
});

test('補登入睡 → 補登起床：時間寫得進去，時數正確', () => {
  const d = withThursdayWake();
  d.sleeps.push({ id: 'fri', start: at('2026-10-16', '09:17'), end: null, note: '' });
  const t = at('2026-10-16', '15:11');
  const target = sleepEndTarget(d, '2026-10-16');
  target.end = t;
  assert.equal(target.end - target.start, 5 * 60 * 60 * 1000 + 54 * 60 * 1000);
});

test('完全沒有睡眠時，補登起床要回報找不到（不能假裝成功）', () => {
  assert.equal(sleepEndTarget(base(), '2026-10-16'), null);
});

test('36 小時上限：11h55m 仍算回上一個工作日，超過 36h 才改用後備規則', () => {
  const d = withThursdayWake();
  assert.equal(dayOf(d, at('2026-10-16', '09:17')), '2026-10-15');
  assert.equal(dayOf(d, at('2026-10-17', '10:00')), null);
});
