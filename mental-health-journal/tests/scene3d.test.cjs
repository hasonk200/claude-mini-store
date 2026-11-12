const test = require('node:test');
const assert = require('node:assert/strict');

const load = () =>
  Promise.all([
    import('../js/scene3d/layout.mjs'),
    import('../js/scene3d/palette.mjs'),
    import('../js/scene3d/support.mjs'),
    import('../js/pet/positions.mjs'),
    import('../js/art/pet-scenes.mjs'),
  ]);

test('every 2D pet spot has a 3D position inside the room', async () => {
  const [layout, , , { SPOTS }] = await load();
  for (const spot of SPOTS) {
    const p = layout.SPOT_3D[spot.id];
    assert.ok(p, spot.id + ' has no SPOT_3D entry');
    assert.ok(Math.abs(p.x) <= layout.ROOM.width / 2, spot.id + ' x is outside the room');
    assert.ok(Math.abs(p.z) <= layout.ROOM.depth / 2, spot.id + ' z is outside the room');
    assert.ok(p.y >= 0 && p.y < 1, spot.id + ' stands on a sensible surface');
    assert.equal(typeof p.face, 'number');
    assert.deepEqual(layout.spotPosition(spot), p);
    assert.deepEqual(layout.spotPosition(spot.id), p);
  }
  assert.deepEqual(Object.keys(layout.SPOT_3D).sort(), SPOTS.map((s) => s.id).sort());
});

test('spots that two pets may occupy together are at least one pet apart in 3D', async () => {
  const [layout, , , { SPOTS, near }] = await load();
  for (const a of SPOTS)
    for (const b of SPOTS) {
      if (a.id >= b.id || near(a, b)) continue;
      // The window spot only exists without the sofa, so those two never coexist.
      if ([a.id, b.id].sort().join() === 'sofa,window') continue;
      const gap = layout.distance(layout.SPOT_3D[a.id], layout.SPOT_3D[b.id]);
      assert.ok(gap >= layout.PET_WIDTH, `${a.id} and ${b.id} are only ${gap.toFixed(2)} apart`);
    }
});

test('an unknown spot falls back to a floor position derived from its 2D coordinates', async () => {
  const [layout] = await load();
  const left = layout.spotPosition({ id: 'new-spot', x: 10, b: 0 });
  const right = layout.spotPosition({ id: 'new-spot', x: 90, b: 40 });
  assert.ok(left.x < 0 && right.x > 0);
  assert.ok(left.z > right.z, 'a higher bottom% is further back in the room');
  for (const p of [left, right]) {
    assert.ok(Math.abs(p.x) < layout.ROOM.width / 2 && Math.abs(p.z) < layout.ROOM.depth / 2);
  }
});

test('a dropped pet snaps to the nearest available spot and stays over the floor', async () => {
  const [layout, , , { SPOTS }] = await load();
  const available = SPOTS.filter((s) => s.id !== 'window');
  for (const spot of available) {
    const p = layout.SPOT_3D[spot.id];
    assert.equal(layout.nearestSpot({ x: p.x + 0.1, z: p.z - 0.1 }, available).id, spot.id);
  }
  const withoutBed = available.filter((s) => s.id !== 'bed');
  assert.notEqual(layout.nearestSpot(layout.SPOT_3D.bed, withoutBed).id, 'bed');
  assert.equal(layout.nearestSpot({ x: 0, z: 0 }, []), null);
  const clamped = layout.clampToFloor(99, -99);
  assert.ok(clamped.x < layout.ROOM.width / 2 && clamped.z > -layout.ROOM.depth / 2);
});

test('the home camera stays inside its orbit limits and frames phones more tightly', async () => {
  const [layout] = await load();
  const c = layout.HOME_CAMERA;
  assert.equal(c.azimuthRange, 25);
  assert.deepEqual([c.polarMin, c.polarMax], [55, 75]);
  assert.ok(c.polar >= c.polarMin && c.polar <= c.polarMax);
  // The side wall must always be seen from inside the room, even turned fully left.
  const [x] = layout.orbitPosition(c, c.azimuth - c.azimuthRange);
  assert.ok(x > -layout.ROOM.width / 2);
  const desktop = layout.frameHome(640, 480),
    phone = layout.frameHome(360, 288);
  assert.equal(desktop.compact, false);
  assert.equal(phone.compact, true);
  assert.ok(desktop.distance > 0 && phone.distance > 0);
  const tall = layout.frameHome(640, 1200);
  assert.ok(tall.distance > desktop.distance, 'a narrow aspect moves back to keep the room in');
});

test('palette uses the same day, dusk and night boundaries as the 2D art', async () => {
  const [, { palette }, , , { tod }] = await load();
  for (let hour = 0; hour < 24; hour++) assert.equal(palette(hour).time, tod(hour), 'hour ' + hour);
  assert.deepEqual(
    [5, 6, 16, 17, 19, 20].map((hour) => palette(hour).time),
    ['night', 'day', 'day', 'dusk', 'dusk', 'night'],
  );
  assert.equal(palette(22).night, true);
  assert.equal(palette(12).night, false);
  for (const hour of [12, 18, 22]) {
    const p = palette(hour);
    assert.match(p.backdrop, /^#[0-9a-f]{6}$/);
    assert.equal(p.sky.length, 2);
    assert.ok(p.hemi > 0 && p.sunPower > 0);
  }
});

test('3D is used only when hardware, the local setting and quiet mode all allow it', async () => {
  const [, , { resolve3D, canUse3DWith, autoAllows, normalizeSetting }] = await load();
  const capable = { webgl2: true, deviceMemory: 8, hardwareConcurrency: 8 };
  assert.equal(resolve3D({ ...capable, setting: 'auto' }), true);
  assert.equal(resolve3D({ ...capable, setting: 'on' }), true);
  // The three cases the plan calls out: quiet mode, a local "off", and no WebGL.
  assert.equal(resolve3D({ ...capable, setting: 'on', quiet: true }), false);
  assert.equal(resolve3D({ ...capable, setting: 'off' }), false);
  assert.equal(resolve3D({ ...capable, webgl2: false, setting: 'on' }), false);
  // A lost context keeps the rest of the visit in 2D.
  assert.equal(resolve3D({ ...capable, setting: 'on', failed: true }), false);
  // "Auto" stays flat on modest hardware, but an explicit "on" is respected.
  assert.equal(resolve3D({ ...capable, deviceMemory: 2, setting: 'auto' }), false);
  assert.equal(resolve3D({ ...capable, hardwareConcurrency: 4, setting: 'auto' }), false);
  assert.equal(resolve3D({ ...capable, hardwareConcurrency: 4, setting: 'on' }), true);
  assert.equal(resolve3D({ ...capable, deviceMemory: 1, setting: 'on' }), false);
  // Browsers that do not report memory or cores are treated as capable.
  assert.equal(resolve3D({ webgl2: true, setting: 'auto' }), true);
  assert.equal(canUse3DWith({ webgl2: true }), true);
  assert.equal(autoAllows({}), true);
  assert.equal(normalizeSetting('nonsense'), 'auto');
  assert.equal(normalizeSetting(null), 'auto');
  assert.equal(resolve3D({ ...capable, setting: 'nonsense' }), true);
});

test('ambient animation backs off when the device cannot keep up', async () => {
  const { ambientInterval } = await import('../js/scene3d/loop.mjs');
  const normal = ambientInterval(16);
  assert.ok(normal > 25 && normal < 34, 'about 30fps on a healthy device');
  assert.equal(ambientInterval(40), normal);
  assert.equal(ambientInterval(60), 180);
  assert.equal(ambientInterval(500), 300, 'never slower than a few frames a second');
});

test('the vendored three.js matches the pinned npm package', () => {
  const { execFileSync } = require('node:child_process');
  const path = require('node:path');
  const output = execFileSync(
    process.execPath,
    [path.join(__dirname, '..', 'scripts', 'vendor-three.cjs'), '--check'],
    { encoding: 'utf8' },
  );
  assert.match(output, /matches three@0\.170\.0/);
});
