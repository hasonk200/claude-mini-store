// 主按鈕防連點：同一個步驟 1.5 秒內只記一次。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { recordStep } from '../js/actions.js';

const t = Date.parse('2026-10-18T09:00:00-04:00');

test('同一個步驟連按兩次，只記第一次', () => {
  assert.deepEqual(recordStep('out', t), { ok: true });
  assert.deepEqual(recordStep('out', t), { ok: false, reason: 'too-fast' });
});

test('不同步驟不會被擋', () => {
  assert.deepEqual(recordStep('ride', t), { ok: true });
  assert.deepEqual(recordStep('arrive', t), { ok: true });
});
