// R9：Service Worker 啟用新版時，只清 OnTime 自己的舊快取，不刪同網域其他 App 的快取。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

function loadSW(keys) {
  const listeners = {};
  const deleted = [];
  const ctx = {
    self: { addEventListener: (type, fn) => { listeners[type] = fn; }, clients: { claim: async () => {} } },
    caches: { keys: async () => keys, delete: async (k) => { deleted.push(k); return true; } },
    location: { origin: 'https://example.test' }, URL, Request: class {}, Response: {}, fetch: async () => {}
  };
  vm.runInNewContext(src, ctx);
  return { listeners, deleted, version: src.match(/const VERSION = '([^']+)'/)[1] };
}

test('版本號是 2.26.0', () => {
  assert.equal(loadSW([]).version, '2.26.0');
});

test('activate：刪 ontime 舊版快取，保留目前版本、字體和其他 App 的快取', async () => {
  const keys = ['ontime-2.24.0', 'ontime-2.25.0', 'ontime-2.26.0', 'ontime-fonts', 'commute-log-temp', 'heartland-journal-v3'];
  const sw = loadSW(keys);
  let done;
  sw.listeners.activate({ waitUntil: (p) => { done = p; } });
  await done;
  assert.deepEqual(sw.deleted.sort(), ['ontime-2.24.0', 'ontime-2.25.0']);
});
