// 獨立休息：不屬於班別、不影響工時，只在時間軸出現。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceAll, getRaw, visible, emptyData } from '../js/store.js';
import { toggleRest } from '../js/actions.js';
import { activeRest, statusOf, workdayEvents } from '../js/logic.js';

const at = (s) => Date.parse(s);
const cycle = (session = null) => ({ session, journey: null });

test('按一次開始休息，再按一次結束', () => {
  replaceAll({ ...emptyData() });
  const t1 = at('2026-10-18T11:00:00-04:00');
  const t2 = at('2026-10-18T11:40:00-04:00');

  const a = toggleRest(t1);
  assert.equal(a.opened, true);
  assert.equal(activeRest(visible(getRaw())).start, t1);
  assert.equal(activeRest(visible(getRaw())).end, null);

  const b = toggleRest(t2);
  assert.equal(b.opened, false);
  assert.equal(visible(getRaw()).rests.length, 1);
  assert.equal(visible(getRaw()).rests[0].end, t2);
  assert.equal(activeRest(visible(getRaw())), null);
});

test('沒有班別時，狀態顯示休息中', () => {
  replaceAll({ ...emptyData() });
  toggleRest(at('2026-10-18T11:00:00-04:00'));
  const st = statusOf(cycle(), visible(getRaw()), at('2026-10-18T11:20:00-04:00'));
  assert.equal(st.key, 'rest');
  assert.equal(st.title, '休息中');
});

test('上班中的班內休息優先於獨立休息', () => {
  replaceAll({ ...emptyData() });
  const session = { id: 'se1', jobId: 'j1', start: at('2026-10-18T08:00:00-04:00'), end: null, breaks: [{ start: at('2026-10-18T10:00:00-04:00'), end: null }] };
  replaceAll({ ...emptyData(), sessions: [session] });
  toggleRest(at('2026-10-18T11:00:00-04:00'));
  const st = statusOf(cycle(session), visible(getRaw()), at('2026-10-18T11:20:00-04:00'));
  assert.equal(st.key, 'break');
});

test('休息會出現在所屬工作日的時間軸', () => {
  replaceAll({ ...emptyData() });
  toggleRest(at('2026-10-18T11:00:00-04:00'));
  const ev = workdayEvents(visible(getRaw()), '2026-10-18', at('2026-10-18T11:20:00-04:00'));
  const rest = ev.filter((e) => e.ref?.type === 'rest');
  assert.equal(rest.length, 1);
  assert.equal(rest[0].title, '休息');
  assert.equal(rest[0].detail, '進行中');
});
