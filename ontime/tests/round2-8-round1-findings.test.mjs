// 第二輪 8：第一輪實測發現的問題。
// (a) 開工日期跟工作日對不上要先問；(b) 時間線不要把較早的日期寫成「進入下一天」；
// (c) 待補收工的工作日，工時卡不要寫「沒有出勤」。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../js/store.js';
import { shiftDateMismatch } from '../js/logic.js';
import { timelineView } from '../js/views/timeline.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

test('開工日期在工作日當天或隔天（午夜後開工）：不用問', () => {
  assert.equal(shiftDateMismatch('2026-10-24', at('2026-10-24', '09:00')), null);
  assert.equal(shiftDateMismatch('2026-10-24', at('2026-10-25', '00:30')), null);
});

test('開工日期早過或遠過工作日：回傳開工那天，讓畫面問清楚', () => {
  assert.equal(shiftDateMismatch('2026-10-24', at('2026-10-21', '09:00')), '2026-10-21');
  assert.equal(shiftDateMismatch('2026-10-24', at('2026-10-23', '23:00')), '2026-10-23');
  assert.equal(shiftDateMismatch('2026-10-24', at('2026-10-26', '09:00')), '2026-10-26');
});

test('確認面板可以自訂兩個選項的文字', () => {
  const html = sheetView({ data: emptyData(), now: 0, ui: { sheet: { type: 'confirm', title: 't', body: 'b', confirm: '歸到 週三 10/21', action: 'newshift-use-date', tone: 'ink', cancel: 'newshift-keep-wd', cancelLabel: '仍屬 週六 10/24' } } });
  assert.match(html, /data-action="newshift-use-date"[^>]*>歸到 週三 10\/21/);
  assert.match(html, /data-action="newshift-keep-wd">仍屬 週六 10\/24/);
});

const pendingDay = () => ({
  ...emptyData(), jobs: [{ id: 'j', name: 'x' }],
  sessions: [{ id: 's', jobId: 'j', start: at('2026-10-21', '09:00'), end: null, endPending: true, breaks: [], workdayDate: '2026-10-24', workdayManual: true }]
});
const tl = (d, wd) => timelineView({ data: d, now: at('2026-10-24', '15:00'), ui: { tlMode: 'workday' }, wd, isDesktop: false });

test('較早日期的紀錄：分隔線寫「早於工作日 3 天」，不是「午夜 · 進入週三」', () => {
  const html = tl(pendingDay(), '2026-10-24');
  assert.doesNotMatch(html, /午夜 · 進入週三/);
  assert.match(html, /週三 10\/21 · 早於工作日 3 天，仍屬週六工作日/);
});

test('夜班跨午夜照舊寫「午夜 · 進入」', () => {
  const d = { ...emptyData(), jobs: [{ id: 'j', name: 'x' }], sessions: [{ id: 's', jobId: 'j', start: at('2026-10-23', '23:00'), end: at('2026-10-24', '07:00'), breaks: [], workdayDate: '2026-10-23', workdayManual: true }] };
  assert.match(tl(d, '2026-10-23'), /午夜 · 進入週六，仍屬週五工作日/);
});

test('待補收工的工作日：工時卡寫「待補收工」，不是「沒有出勤」', () => {
  const html = tl(pendingDay(), '2026-10-24');
  assert.doesNotMatch(html, /沒有出勤/);
  assert.match(html, /<strong>待補收工<\/strong><small>收工時間未知，補上後才計工時<\/small>/);
  assert.match(html, /data-step="clockOut" aria-label="修改工時"/);
});
