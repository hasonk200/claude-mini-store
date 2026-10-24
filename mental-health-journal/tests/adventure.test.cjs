const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/adventure.js');
function solve(level) {
  const start = A.create(level),
    queue = [{ s: start, path: [], events: [] }],
    seen = new Set();
  const key = (s) =>
    [
      s.player,
      [...s.crates].sort((a, b) => a - b),
      [...s.collected].sort((a, b) => a - b),
      s.key,
    ].join('/');
  seen.add(key(start));
  for (let head = 0; head < queue.length; head++) {
    const { s, path, events } = queue[head];
    if (s.won) return { s, path, events };
    assert(queue.length < 50000, 'level should remain a small, tractable puzzle');
    for (const direction of Object.keys(A.dirs)) {
      const r = A.step(s, direction),
        k = key(r.state);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ s: r.state, path: [...path, direction], events: [...events, r.event] });
      }
    }
  }
  throw new Error('Unsolvable level ' + level);
}
for (let level = 0; level < A.LEVELS.length; level++)
  test('chapter ' + (level + 1) + ' is solvable with all stars and its teaching mechanic', () => {
    const r = solve(level),
      b = A.board(level);
    assert.equal(r.s.player, b.exit);
    assert.equal(r.s.collected.length, 3);
    assert.equal(r.s.moves, r.path.length);
    assert(r.s.won);
    if (level === 1) assert(r.events.includes('key'), 'key door must not be bypassable');
    if (level >= 2) assert(r.events.includes('push'), 'crate mechanic must be necessary');
    if (level === 3) assert(A.platesOpen(b, r.s), 'final gate must require a pressed plate');
    console.log(
      'chapter ' +
        (level + 1) +
        ' solution (' +
        r.s.moves +
        ' moves): ' +
        r.path.map((d) => d[0]).join(''),
    );
  });
test('walls/invalid input do not move or increase moves; successful moves do not mutate undo snapshot', () => {
  const initial = A.create(0),
    copy = JSON.stringify(initial);
  assert.equal(A.step(initial, 'up').event, 'wall');
  assert.equal(A.step(initial, 'sideways').event, 'ignored');
  assert.equal(A.step(initial, 'up').state, initial);
  const n = A.step(initial, 'right').state;
  assert.equal(n.moves, 1);
  assert.equal(n.player, initial.player + 1);
  assert.equal(JSON.stringify(initial), copy);
  assert.notEqual(n.collected, initial.collected);
});
test('exit cannot finish before collecting stars and completed runs ignore further input', () => {
  let s = A.create(0);
  const b = A.board(0);
  s.player = b.exit - 1;
  let r = A.step(s, 'right');
  assert.equal(r.event, 'need-stars');
  assert.equal(r.state.won, false);
  s = { ...s, collected: [...b.stars] };
  r = A.step(s, 'right');
  assert.equal(r.event, 'win');
  assert.equal(A.step(r.state, 'left').event, 'ignored');
});
test('locked doors and plate gates block movement until their condition is met', () => {
  let s = A.create(1),
    b = A.board(1),
    i = b.tiles.indexOf('D');
  s.player = i - 11;
  assert.equal(A.step(s, 'down').event, 'locked');
  s.key = true;
  assert.notEqual(A.step(s, 'down').state, s);
  s = A.create(3);
  b = A.board(3);
  i = b.tiles.indexOf('G');
  s.player = i + 11;
  assert.equal(A.step(s, 'up').event, 'plate');
  s.crates = [...b.plates];
  assert.notEqual(A.step(s, 'up').state, s);
});
test('crate pushes cannot overlap a wall or another crate', () => {
  let s = A.create(2);
  const box = s.crates[0];
  s.player = box + 11;
  assert.equal(A.step(s, 'up').event, 'push');
  const n = A.step(s, 'up').state;
  assert.equal(A.step(n, 'up').event, 'crate-blocked');
  s.crates = [box, box - 11];
  assert.equal(A.step(s, 'up').event, 'crate-blocked');
});
test('campaign survives save/restore and rejects malformed/out-of-range runs', () => {
  const c = A.campaign();
  c.run = A.step(A.create(0), 'right').state;
  assert.deepEqual(A.campaign(JSON.parse(JSON.stringify(c))), c);
  for (const bad of [
    { ...c.run, player: 0 },
    { ...c.run, player: 1000 },
    { ...c.run, collected: [1] },
    { ...c.run, crates: [4] },
    { ...c.run, moves: -1 },
  ])
    assert.equal(A.restore(bad), null);
  assert.equal(A.campaign({ unlocked: 1, run: A.create(3) }).run, null);
  assert.equal(A.campaign({ unlocked: 2.9 }).unlocked, 2);
  assert.deepEqual(A.campaign({ best: { 0: -1, 1: '8', unknown: 15 } }).best, {});
});
test('one-time chapter rewards, unlocks and best scores survive replay', () => {
  const c = A.campaign(),
    s = solve(0).s;
  assert.equal(A.finish(c, A.create(0)), 0);
  assert.equal(A.finish(c, s), 12);
  assert.equal(c.unlocked, 2);
  assert.equal(c.run, null);
  assert.equal(A.finish(c, { ...s, moves: s.moves + 10 }), 0);
  assert.equal(c.best[0], s.moves);
  assert.equal(A.finish(c, s), 0);
  const restored = A.campaign(JSON.parse(JSON.stringify(c)));
  assert.equal(A.finish(restored, s), 0);
});
