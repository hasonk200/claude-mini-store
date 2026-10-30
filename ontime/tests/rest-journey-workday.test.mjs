// 休息、冇班次的獨立通勤：可以手動指定歸屬工作日（同用餐 #28 一致），
// 以及補登面板的防撳錯確認。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, get, getRaw, emptyData, visible } from '../js/store.js';
import { addRest, setRefTime, setStepTime, exportJSON, parseBackup } from '../js/actions.js';
import { restWorkday, restAutoWorkday, journeyWorkday, journeyAutoWorkday, standaloneJourneys, workdayEvents, needsWorkdayConfirm } from '../js/logic.js';
import { mergeData } from '../js/sync.js';
import { sheetView } from '../js/views/sheet.js';
import { at } from '../js/time.js';

const now = at('2026-10-30', '12:00');
const t = at('2026-10-29', '10:00');

// ---------- 休息 ----------
test('休息：工作日揀 10/28、實際 10/29 10:00 → 歸屬 10/28 並標手動', () => {
  replaceAll(emptyData());
  const r = addRest({ start: t, end: at('2026-10-29', '10:30'), workday: '2026-10-28' }, now);
  assert.equal(r.ok, true);
  const rest = get().rests[0];
  assert.equal(rest.workdayDate, '2026-10-28');
  assert.equal(rest.workdayManual, true);
  assert.equal(restWorkday(rest, get()), '2026-10-28');
  assert.equal(restAutoWorkday(rest, get()), '2026-10-29');
  assert.ok(workdayEvents(get(), '2026-10-28', now).some((e) => e.ref.type === 'rest'));
  assert.ok(!workdayEvents(get(), '2026-10-29', now).some((e) => e.ref.type === 'rest'));
});

test('休息：揀的日子同自動一樣就唔標手動', () => {
  replaceAll(emptyData());
  addRest({ start: t, end: at('2026-10-29', '10:30'), workday: '2026-10-29' }, now);
  assert.equal('workdayManual' in get().rests[0], false);
});

test('休息：不合理的時間不寫入（結束早過開始、未來）', () => {
  replaceAll(emptyData());
  assert.equal(addRest({ start: t, end: t - 60000, workday: null }, now).reason, 'before-start');
  assert.equal(addRest({ start: at('2026-10-30', '11:00'), end: at('2026-10-30', '13:00') }, now).reason, 'future');
  assert.equal(get().rests.length, 0);
});

test('休息：修改面板改返自動；只改時間唔傳 workday 時手動保持', () => {
  replaceAll({ ...emptyData(), rests: [{ id: 'r', start: t, end: at('2026-10-29', '10:30'), workdayDate: '2026-10-28', workdayManual: true }] });
  setRefTime({ type: 'rest', id: 'r', field: 'start' }, at('2026-10-29', '10:05'), {});
  assert.equal(get().rests[0].workdayDate, '2026-10-28');
  setRefTime({ type: 'rest', id: 'r', field: 'start' }, at('2026-10-29', '10:05'), { workday: null });
  assert.equal('workdayManual' in get().rests[0], false);
  assert.equal(restWorkday(get().rests[0], get()), '2026-10-29');
  setRefTime({ type: 'rest', id: 'r', field: 'start' }, at('2026-10-29', '10:05'), { workday: '2026-10-28' });
  assert.equal(get().rests[0].workdayManual, true);
});

test('休息：同步合併兩個方向後手動仍保留；舊資料照舊自動', () => {
  replaceAll({ ...emptyData(), rests: [{ id: 'r', start: t, end: at('2026-10-29', '10:30'), updatedAt: 1 }] }, { tombstone: false });
  const cloud = structuredClone(getRaw());
  setRefTime({ type: 'rest', id: 'r', field: 'start' }, t, { workday: '2026-10-28' });
  const local = getRaw();
  for (const merged of [mergeData(local, cloud), mergeData(cloud, local)]) {
    const v = visible(merged);
    assert.equal(restWorkday(v.rests[0], v), '2026-10-28');
  }
  const old = { ...emptyData(), rests: [{ id: 'o', start: t, end: t + 60000 }] };
  assert.equal(restWorkday(old.rests[0], old), '2026-10-29');
});

// ---------- 獨立通勤 ----------
const sj = (extra = {}) => ({ id: 'j', sessionId: null, out: t, ride: null, arrive: null, leave: null, ride2: null, home: null, ...extra });

test('獨立通勤：補登時頂部工作日 10/28、實際 10/29 10:00 → 歸屬 10/28 並標手動；一樣就保持自動', () => {
  replaceAll(emptyData());
  setStepTime('2026-10-28', 'out', t);
  const j = get().journeys[0];
  assert.equal(j.sessionId, null);
  assert.equal(j.workdayDate, '2026-10-28');
  assert.equal(j.workdayManual, true);
  assert.equal(journeyWorkday(j, get()), '2026-10-28');
  replaceAll(emptyData());
  setStepTime('2026-10-29', 'out', t);
  assert.equal('workdayManual' in get().journeys[0], false);
  assert.equal('workdayDate' in get().journeys[0], false);
  assert.equal(journeyWorkday(get().journeys[0], get()), '2026-10-29');
});

test('獨立通勤：修改面板改歸屬、改返自動', () => {
  replaceAll({ ...emptyData(), journeys: [sj()] });
  setRefTime({ type: 'journey', id: 'j', field: 'out' }, t, { workday: '2026-10-28' });
  assert.equal(get().journeys[0].workdayManual, true);
  assert.equal(standaloneJourneys(get(), '2026-10-28').length, 1);
  setRefTime({ type: 'journey', id: 'j', field: 'out' }, t, { workday: null });
  assert.equal('workdayDate' in get().journeys[0], false);
  assert.equal(journeyWorkday(get().journeys[0], get()), '2026-10-29');
});

test('獨立通勤：舊資料有 workdayDate 冇 workdayManual，歸屬維持不變（唔會跳去 10/29）', () => {
  const d = { ...emptyData(), journeys: [sj({ workdayDate: '2026-10-28' })] };
  assert.equal(journeyWorkday(d.journeys[0], d), '2026-10-28');
  assert.equal(journeyAutoWorkday(d.journeys[0], d), '2026-10-29');
  replaceAll(d);
  // 只改時間、冇傳 workday：保持 10/28
  setRefTime({ type: 'journey', id: 'j', field: 'out' }, at('2026-10-29', '10:05'), {});
  assert.equal(journeyWorkday(get().journeys[0], get()), '2026-10-28');
});

test('有班次的行程：跟班次走，改歸屬參數冇作用', () => {
  replaceAll({ ...emptyData(), jobs: [{ id: 'x', name: 'x' }], sessions: [{ id: 's', jobId: 'x', start: t, end: t + 3600000, breaks: [] }], journeys: [sj({ sessionId: 's' })] });
  setRefTime({ type: 'journey', id: 'j', field: 'out' }, t - 600000, { workday: '2026-10-28' });
  assert.equal('workdayDate' in get().journeys[0], false);
});

test('獨立通勤：同步合併兩個方向後手動仍保留；匯出匯入保留', () => {
  replaceAll({ ...emptyData(), journeys: [sj({ updatedAt: 1 })] }, { tombstone: false });
  const cloud = structuredClone(getRaw());
  setRefTime({ type: 'journey', id: 'j', field: 'out' }, t, { workday: '2026-10-28' });
  const local = getRaw();
  for (const merged of [mergeData(local, cloud), mergeData(cloud, local)]) {
    const v = visible(merged);
    assert.equal(journeyWorkday(v.journeys[0], v), '2026-10-28');
  }
  const back = parseBackup(exportJSON());
  assert.equal(back.journeys[0].workdayManual, true);
});

// ---------- 防撳錯 ----------
test('防撳錯：預設工作日 + 不一致 → 會問；特登改過工作日 → 唔問；一致 → 唔問', () => {
  assert.equal(needsWorkdayConfirm({ wd: '2026-10-28', auto: '2026-10-29', touched: false }), true);
  assert.equal(needsWorkdayConfirm({ wd: '2026-10-28', auto: '2026-10-29', touched: true }), false);
  assert.equal(needsWorkdayConfirm({ wd: '2026-10-29', auto: '2026-10-29', touched: false }), false);
});

// ---------- 畫面 ----------
test('補登面板有「休息」類別：表單跟頂部工作日，預覽寫手動指定', () => {
  const html = sheetView({ data: emptyData(), now, ui: { drafts: { 'rest:new': { date: '2026-10-29', start: '10:00', end: '10:30' } }, sheet: { type: 'record', wd: '2026-10-28', cat: 'rest' } } });
  assert.match(html, /data-cat="rest"/);
  assert.match(html, /data-form="rest"/);
  assert.match(html, /name="wdMode" value="sheet"/);
  assert.match(html, /歸屬 週三 10\/28 工作日（手動指定）/);
});

test('修改面板：休息、獨立通勤有歸屬工作日欄；有班次的行程冇', () => {
  const data = { ...emptyData(), jobs: [{ id: 'x', name: 'x' }],
    rests: [{ id: 'r', start: t, end: t + 1800000, workdayDate: '2026-10-28', workdayManual: true }],
    sessions: [{ id: 's', jobId: 'x', start: t, end: t + 3600000, breaks: [] }],
    journeys: [sj({ id: 'a' }), sj({ id: 'b', sessionId: 's' })] };
  const rest = sheetView({ data, now, ui: { sheet: { type: 'ref', ref: { type: 'rest', id: 'r', field: 'start' }, t, title: '休息' } } });
  assert.match(rest, /name="wd" value="2026-10-28"/);
  assert.match(rest, /name="wdMode" value="manual"/);
  assert.match(rest, /data-action="wd-auto">改返自動/);
  const a = sheetView({ data, now, ui: { sheet: { type: 'ref', ref: { type: 'journey', id: 'a', field: 'out' }, t, title: '出門' } } });
  assert.match(a, /data-wd-kind="journey"/);
  assert.match(a, /name="wdMode" value="auto"/);
  const b = sheetView({ data, now, ui: { sheet: { type: 'ref', ref: { type: 'journey', id: 'b', field: 'out' }, t, title: '出門' } } });
  assert.doesNotMatch(b, /歸屬工作日/);
});

test('修改面板：舊資料獨立行程 workdayDate 同自動唔同 → 顯示成手動，保留原本歸屬', () => {
  const data = { ...emptyData(), journeys: [sj({ workdayDate: '2026-10-28' })] };
  const html = sheetView({ data, now, ui: { sheet: { type: 'ref', ref: { type: 'journey', id: 'j', field: 'out' }, t, title: '出門' } } });
  assert.match(html, /name="wd" value="2026-10-28"/);
  assert.match(html, /name="wdMode" value="manual"/);
});
