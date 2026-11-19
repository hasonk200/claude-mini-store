// PR A（2.39.0）回歸測試：H1 回到現在、H4 Space 快捷鍵、H5 月曆點選日面板、H6 獨立休息同分鐘取消、M3 黑框與 M10 深色示範條。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replaceAll, getRaw, visible, emptyData, undo } from '../js/store.js';
import { toggleRest } from '../js/actions.js';
import { activeRest } from '../js/logic.js';

const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

test('H1：handlers 只有一個 wd-auto，同時支援表單改返自動與首頁回到現在', () => {
  const matches = appSrc.match(/'wd-auto'\s*:/g) || [];
  assert.equal(matches.length, 1);
  assert.match(appSrc, /'wd-auto':\s*\(el\)\s*=>\s*\{[\s\S]*?form\?\.wdMode[\s\S]*?ui\.wd = null;/);
});

test('H4：電腦版 Space 快捷鍵指向 #view .main-act，不依賴已移除的 .status-card', () => {
  assert.doesNotMatch(appSrc, /#view \.status-card \.main-act/);
  assert.match(appSrc, /document\.querySelector\('#view \.main-act'\)/);
});

test('H5：月曆點選單班日期不再直接跳進 shift-editor，而是打開該日面板', () => {
  const m = appSrc.match(/'cal-pick':\s*\(el\)\s*=>\s*\{[\s\S]*?\n  \},/);
  assert.ok(m);
  assert.doesNotMatch(m[0], /showSheet\('shift-editor'/);
  assert.match(m[0], /ui\.calDay = k/);
});

test('H6：獨立休息同分鐘內連按開始與結束會取消該筆且可復原；跨午夜與轉鐘正常結束', () => {
  replaceAll(emptyData(), { tombstone: false });
  const t1 = Date.parse('2026-11-18T02:00:00-05:00');
  const open = toggleRest(t1);
  assert.equal(open.opened, true);
  assert.equal(open.canceled, false);
  assert.ok(activeRest(visible(getRaw())));

  const cancel = toggleRest(t1);
  assert.equal(cancel.opened, false);
  assert.equal(cancel.canceled, true);
  assert.equal(activeRest(visible(getRaw())), null);
  assert.equal(visible(getRaw()).rests.length, 0);

  // 復原會把剛剛取消的那筆救回來
  assert.equal(undo(), true);
  assert.equal(activeRest(visible(getRaw()))?.start, t1);

  // 跨午夜正常結束
  replaceAll(emptyData(), { tombstone: false });
  const a = Date.parse('2026-11-18T23:50:00-05:00');
  const b = Date.parse('2026-11-19T00:20:00-05:00');
  toggleRest(a);
  const done = toggleRest(b);
  assert.equal(done.opened, false);
  assert.equal(done.canceled, false);
  assert.equal(activeRest(visible(getRaw())), null);
  assert.equal(visible(getRaw()).rests[0].end, b);

  // 多倫多夏令時間結束（2026-11-01 01:30 EDT → 01:30 EST，實際過了 1 小時）
  replaceAll(emptyData(), { tombstone: false });
  const dst1 = Date.parse('2026-11-01T01:30:00-04:00');
  const dst2 = Date.parse('2026-11-01T01:30:00-05:00');
  toggleRest(dst1);
  const dstDone = toggleRest(dst2);
  assert.equal(dstDone.canceled, false);
  assert.equal(visible(getRaw()).rests[0].end - visible(getRaw()).rests[0].start, 3600000);
});

test('M3 黑框與 M10 深色示範條：CSS 規則到位', () => {
  assert.match(cssSrc, /\.wk-track button\.seg-bar\s*\{[^}]*border:\s*0/);
  assert.match(cssSrc, /:root\[data-theme="dark"\] \.demo-banner\s*\{[^}]*background:\s*#1B2B4B/);
});
