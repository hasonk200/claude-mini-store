const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');
const empty = () => ({ checkins: {}, draws: {}, evidence: [], habits: [] });
const ci = () => ({ mood: 5, anx: 3, energy: 6 });
test('validates real dates including leap days', () => {
  assert(C.day('2024-02-29'));
  assert(!C.day('2026-02-29'));
  assert(!C.day('2026-13-01'));
  assert(!C.day('x'));
});
test('legacy backups remain valid without new journey fields', () => {
  const d = empty();
  d.checkins['2026-10-23'] = ci();
  assert.equal(C.validateBackup(d), d);
  assert.deepEqual(C.journey(), {
    version: 1,
    discovered: {},
    watered: {},
    games: {},
    decor: 'lantern',
    best: null,
    adventure: null,
  });
});
test('rejects malformed backups before any state change', () => {
  for (const d of [
    null,
    [],
    {},
    { checkins: [] },
    { checkins: { bad: ci() } },
    { checkins: { '2026-10-23': { mood: 99, anx: 4, energy: 5 } } },
    { checkins: {}, evidence: {} },
    { checkins: {}, ladders: [{ steps: null }] },
    { checkins: {}, pet: { name: 'A' } },
  ])
    assert.throws(() => C.validateBackup(d));
});
test('rejects prototype-shaped JSON keys', () => {
  assert.throws(() => C.validateBackup(JSON.parse('{"checkins":{},"__proto__":{"x":1}}')));
});
test('rejects unsupported card IDs and partial spreads', () => {
  const d = empty();
  d.draws['2026-10-23'] = { date: '2026-10-23', text: 'hello', card: 'unknown' };
  assert.throws(() => C.validateBackup(d, ['sun']));
  d.draws['2026-10-23'].card = 'sun';
  assert.doesNotThrow(() => C.validateBackup(d, ['sun']));
  d.draws['2026-10-23'].cards = [{ card: 'sun' }];
  assert.throws(() => C.validateBackup(d, ['sun']));
});
test('growth counts a date once across activities, excludes example evidence and auto milestones', () => {
  const d = empty();
  d.checkins['2026-10-20'] = ci();
  d.draws['2026-10-20'] = {};
  d.habits = [{ log: { '2026-10-20': true, '2026-10-21': false, '2026-10-22': true } }];
  d.evidence = [
    { date: '2026-10-01', seed: true },
    { date: '2026-10-02', src: '里程碑' },
    { date: '2026-10-22' },
    { date: '2026-10-23' },
  ];
  assert.deepEqual(C.activeDays(d), ['2026-10-20', '2026-10-22', '2026-10-23']);
  assert.equal(C.progress(d).level, 1);
});
test('garden progression uses lifetime days, no clock or absence penalty', () => {
  const d = empty();
  for (let i = 1; i <= 30; i++) d.checkins['2020-01-' + String(i).padStart(2, '0')] = ci();
  const p = C.progress(d);
  assert.equal(p.level, 4);
  assert.equal(p.days, 30);
  assert.equal(p.percent, 100);
  assert.equal(p.next, null);
});
test('tasks follow selected night-shift day', () => {
  const d = empty();
  d.checkins['2026-10-22'] = ci();
  assert(C.tasks(d, '2026-10-22')[0].done);
  assert(!C.tasks(d, '2026-10-23')[0].done);
});
test('shuffled deck always has six pairs', () => {
  for (let n = 0; n < 30; n++) {
    const g = C.createMemory();
    assert.equal(g.cards.length, 12);
    for (let i = 0; i < 6; i++) assert.equal(g.cards.filter((x) => x === i).length, 2);
  }
});
test('memory ignores repeated tile, invalid index and input during mismatch', () => {
  const g = C.createMemory(() => 0.5);
  assert.equal(C.flipMemory(g, -1), 'ignored');
  assert.equal(C.flipMemory(g, 0), 'open');
  assert.equal(C.flipMemory(g, 0), 'ignored');
  const other = g.cards.findIndex((x) => x !== g.cards[0]);
  assert.equal(C.flipMemory(g, other), 'miss');
  assert.equal(C.flipMemory(g, 3), 'ignored');
  assert.equal(g.moves, 1);
  C.closeMemory(g);
  assert.equal(g.busy, false);
  assert.deepEqual(g.open, []);
});
test('memory completes once and cannot award from further flips', () => {
  const g = C.createMemory();
  for (let v = 0; v < 6; v++) {
    const ids = g.cards.flatMap((x, i) => (x === v ? [i] : []));
    C.flipMemory(g, ids[0]);
    assert.equal(C.flipMemory(g, ids[1]), v === 5 ? 'complete' : 'match');
  }
  assert.equal(g.moves, 6);
  assert.equal(g.complete, true);
  assert.equal(C.flipMemory(g, 0), 'ignored');
});
test('arcade rewards stop after two games and reset on a new shift date', () => {
  const j = C.journey();
  assert.equal(C.gameReward(j, '2026-10-22'), 5);
  assert.equal(C.gameReward(j, '2026-10-22'), 5);
  assert.equal(C.gameReward(j, '2026-10-22'), 0);
  assert.equal(C.gameReward(j, '2026-10-23'), 5);
  assert.equal(j.games['2026-10-22'], 3);
});
test('restore includes old and imported draw/check-in partitions', () => {
  const before = { checkins: { '2025-01-01': {} }, draws: { '2025-12-01': {} } },
    after = { checkins: { '2026-01-01': {} }, draws: { '2026-10-22': {} } };
  assert.deepEqual(C.backupPeriods(before, after), {
    years: ['2025', '2026'],
    months: ['2025-12', '2026-10'],
  });
});

test('rejects malformed questionnaire scores and unsafe identifiers', () => {
  assert.throws(() =>
    C.validateBackup({ checkins: {}, phq: [{ date: '2026-10-23', total: 99, anx: 0, dep: 0 }] }),
  );
  assert.throws(() =>
    C.validateBackup({
      checkins: {},
      evidence: [{ id: 'bad" onclick="x', date: '2026-10-23', text: 'test' }],
    }),
  );
});
test('journey ignores malformed discoveries, watering flags and reward counters', () => {
  const j = C.journey({
    discovered: { home: 123, library: '2026-10-23', unknown: '2026-10-23' },
    watered: { bad: true, '2026-10-23': 'true' },
    games: { '2026-10-23': -3 },
  });
  assert.deepEqual(j.discovered, { library: '2026-10-23' });
  assert.deepEqual(j.watered, {});
  assert.deepEqual(j.games, {});
});
