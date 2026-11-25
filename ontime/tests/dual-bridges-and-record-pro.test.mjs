// 2.50.0：雙面板互跳橋樑（整趟 ⇄ 逐項補登 ⇄ 時間線單筆）＋ 補登 Pro 深藍頂欄與類別著色測試
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, replaceAll, get } from '../js/store.js';
import { at } from '../js/time.js';
import { sheetView, openRecordSheet } from '../js/views/sheet.js';

const fresh = (d = {}) => replaceAll({ ...emptyData(), ...d }, { tombstone: false });
const jobW = { id: 'jw', name: '倉庫夜班', color: 'work', payMode: 'hourly', rate: 20 };
const jobD = { id: 'jd', name: 'food delivery', color: 'deliv', payMode: 'perOrder', rate: null };

test('補登面板 Pro 頂欄：深藍頂欄、換日左右掣、外送班次綠色著色、互跳整趟面板與兩欄通勤格', () => {
  const s = { id: 's_deliv', jobId: 'jd', start: at('2026-11-24', '01:52'), end: at('2026-11-24', '12:00'), breaks: [], payMode: 'perOrder', workdayDate: '2026-11-24', workdayManual: true };
  fresh({ jobs: [jobW, jobD], sessions: [s] });
  const now = at('2026-11-24', '15:00');
  const html = sheetView({ data: get(), now, ui: { drafts: {}, sheet: { type: 'record', wd: '2026-11-24', cat: 'commute', step: 'out', sid: 's_deliv' } } });

  assert.match(html, /class="sheet sheet-record"/);
  assert.match(html, /class="rec-hero"/);
  assert.match(html, /data-action="rec-day-shift" data-dir="-1"/);
  assert.match(html, /data-action="rec-wd"/);
  assert.match(html, /class="step-chip shift-chip k-deliv is-on"/);
  assert.match(html, /data-action="open-trip" data-wd="2026-11-24" data-sid="s_deliv"/);
  assert.match(html, /class="step-chips is-commute"/);
});

test('整趟面板橋樑：顯示已記交通／車站摘要，並提供跳去「交通與上車地點」同「班內休息」掣', () => {
  const s = {
    id: 's1', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'),
    breaks: [{ start: at('2026-11-25', '01:00'), end: at('2026-11-25', '01:30') }],
    workdayDate: '2026-11-24', workdayManual: true
  };
  const j = {
    id: 'j1', sessionId: 's1', out: at('2026-11-24', '20:10'), ride: at('2026-11-24', '20:20'),
    rideMode: '地鐵', rideFrom: 'Dundas Station', arrive: at('2026-11-24', '20:45'),
    leave: null, ride2: null, home: at('2026-11-25', '09:50')
  };
  fresh({ jobs: [jobW, jobD], sessions: [s], journeys: [j] });
  const now = at('2026-11-25', '12:00');
  const html = sheetView({ data: get(), now, ui: { sheet: { type: 'trip', wd: '2026-11-24', sessionId: 's1' } } });

  assert.match(html, /class="trip-ride-meta">地鐵 · Dundas Station<\/small>/);
  assert.match(html, /data-action="open-record" data-wd="2026-11-24" data-sid="s1" data-step="ride"/);
  assert.match(html, /data-action="open-record" data-wd="2026-11-24" data-sid="s1" data-step="break"/);
  assert.match(html, /已記 1 段 · 0h 30m/);
});

test('單筆修改與新增選單橋樑：時間線單筆可跳整趟面板，openRecordSheet 保留 sid，選單改傳 auto', () => {
  const s = { id: 's2', jobId: 'jw', start: at('2026-11-24', '21:00'), end: at('2026-11-25', '09:00'), breaks: [], workdayDate: '2026-11-24', workdayManual: true };
  const j = { id: 'j2', sessionId: 's2', out: at('2026-11-24', '20:10'), ride: null, arrive: null, leave: null, ride2: null, home: null };
  fresh({ jobs: [jobW, jobD], sessions: [s], journeys: [j] });
  const d = get();
  const now = at('2026-11-25', '12:00');

  assert.deepEqual(openRecordSheet(d, '2026-11-24', 'ride', 's2'), { type: 'record', wd: '2026-11-24', cat: 'commute', step: 'ride', sid: 's2' });
  assert.equal(openRecordSheet(d, '2026-11-24', 'auto', 's2').cat, 'commute');

  const menu = sheetView({ data: d, now, ui: { sheet: { type: 'add-menu', wd: '2026-11-24' } } });
  assert.match(menu, /data-action="open-record" data-wd="2026-11-24" data-step="auto"/);

  const refSessionHtml = sheetView({ data: d, now, ui: { sheet: { type: 'ref', ref: { type: 'session', id: 's2', field: 'start' }, t: s.start, title: '上班' } } });
  assert.match(refSessionHtml, /data-action="open-trip" data-wd="2026-11-24" data-sid="s2"/);

  const refJourneyHtml = sheetView({ data: d, now, ui: { sheet: { type: 'ref', ref: { type: 'journey', id: 'j2', field: 'out' }, t: j.out, title: '出門' } } });
  assert.match(refJourneyHtml, /data-action="open-trip" data-wd="2026-11-24" data-sid="s2"/);
});
