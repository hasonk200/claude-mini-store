// 夜街 in 3D: a quiet street after dark – the 24-hour convenience store, a noodle shop with
// its lantern, a launderette, drinks machines, street lamps and lit windows above.
// Follows the 2D street (js/art/pet-scenes.mjs), which is always night. Every light is
// steady: no blinking signs.
import { createOuting } from './outing.mjs';
import { buildingRow, stars, lampPost } from './city.mjs';
import {
  paintStreet,
  paintStore,
  paintStoreSign,
  paintLattice,
  paintBanner,
  paintLaundry,
  paintNeon,
  paintVending,
  paintShutter,
} from './street-paint.mjs';
import { rng } from '../../art/math.mjs';

const CAMERA = {
  fov: 35,
  target: [0, 1.7, 0.2],
  distance: 12.6,
  azimuth: 0,
  azimuthRange: 12,
  polar: 82,
  polarMin: 77,
  polarMax: 86,
  needWidth: 11.6,
  needHeight: 6.4,
};

const GROUND = { back: -1.4, front: 9.6, wide: 44, kerb: 2.65, line: 4.0 };
const FRONT = GROUND.back;
const DEPTH = 3;
// The shops, left to right: [from x, to x, height, wall colour].
const SHOPS = {
  laundry: [-11.4, -6.9, 5.4, '#2a3157'],
  noodles: [-6.6, -1.7, 3.0, '#5a3a2e'],
  store: [-1.3, 4.5, 6.4, '#2f3760'],
  closed: [4.9, 10.4, 4.7, '#283055'],
};
const LAMPS = [
  [-4.4, 0.7],
  [4.6, -0.7],
];
const across = (x) => 0.5 + x / GROUND.wide;
const along = (z) => (z - GROUND.back) / (GROUND.front - GROUND.back);
const middle = ([from, to]) => (from + to) / 2;

function build(env) {
  const { THREE, B, G, group, animated, textures } = env;
  B.bevel = 1;
  const random = rng(19);
  const panel = (key, w, h, pw, ph, paint, x, y, z = FRONT + 0.03, options) => {
    const mesh = env.flat(
      new THREE.PlaneGeometry(w, h),
      textures.canvasTexture('place:street:' + key, pw, ph, paint),
      options,
    );
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  /* ---- ground: pavement, kerb and road, with the light that falls on them ---- */
  const ground = env.flat(
    new THREE.PlaneGeometry(GROUND.wide, GROUND.front - GROUND.back),
    textures.canvasTexture('place:street:ground', 2048, 512, (g, w, h) =>
      paintStreet(g, w, h, {
        wide: GROUND.wide,
        kerb: along(GROUND.kerb),
        line: along(GROUND.line),
        lights: [
          [across(middle(SHOPS.store)), along(0.1), 0.075, '255,236,190', 0.5],
          [across(middle(SHOPS.noodles)), along(-0.2), 0.06, '255,186,116', 0.5],
          [across(middle(SHOPS.laundry)), along(-0.2), 0.06, '150,230,255', 0.35],
          [across(5.95), along(-0.2), 0.035, '205,228,255', 0.35],
          ...LAMPS.map(([x, arm]) => [across(x + arm), along(2.2), 0.05, '255,225,160', 0.3]),
        ],
      }),
    ),
  );
  // Seen at a shallow angle, so keep the paving sharp into the distance.
  ground.material.map.anisotropy = 8;
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (GROUND.front + GROUND.back) / 2);
  group.add(ground);
  // The kerb stands a little proud of the road.
  B.box(GROUND.wide, 0.1, 0.16, '#5a607c', { y: 0.02, z: GROUND.kerb + 0.08, shade: 0 });

  /* ---- buildings: the shops' own blocks, and taller ones behind ---- */
  for (const [from, to, height, colour] of Object.values(SHOPS))
    B.box(to - from, height, DEPTH, colour, {
      x: (from + to) / 2,
      y: height / 2,
      z: FRONT - DEPTH / 2,
      shade: 0.2,
    });
  // Upper-floor windows: some lit (warm, steady), some dark.
  const pane = (x, y, lit) =>
    lit
      ? G.box(0.34, 0.42, 0.05, ['#ffd27a', '#ffe6a8', '#ffb86b'][Math.floor(random() * 3)], {
          x,
          y,
          z: FRONT + 0.02,
        })
      : B.box(0.34, 0.42, 0.05, '#1a2040', { x, y, z: FRONT + 0.02, shade: 0 });
  for (const [from, to, height] of [SHOPS.laundry, SHOPS.store, SHOPS.closed])
    for (let y = 3.75; y < height - 0.3; y += 0.86)
      for (let x = from + 0.5; x < to - 0.3; x += 0.78) {
        pane(x, y, random() < 0.48);
        B.box(0.46, 0.05, 0.1, '#444c70', { x, y: y - 0.26, z: FRONT + 0.05, shade: 0 });
      }
  for (const [from, to, height] of [SHOPS.laundry, SHOPS.store, SHOPS.closed])
    B.box(to - from + 0.16, 0.14, DEPTH + 0.16, '#3a4268', {
      x: (from + to) / 2,
      y: height + 0.07,
      z: FRONT - DEPTH / 2,
      shade: 0,
    });
  const tones = ['#222a4d', '#1d2442', '#283158'];
  for (const [from, to, seed] of [
    [-28, -7.6, 41],
    [-1.2, 28, 47],
  ])
    buildingRow(env, {
      builder: G,
      from,
      to,
      z: -11,
      depth: 3,
      widths: [2.6, 5],
      heights: [6.5, 12.5],
      colours: tones,
      seed,
      lit: 0.42,
      windowSize: 0.34,
      grid: [0.62, 0.72],
    });
  // Lower roofs further off, so there is sky – and the moon – above the noodle shop.
  buildingRow(env, {
    builder: G,
    from: -9,
    to: 0,
    z: -18,
    depth: 3,
    widths: [2.2, 3.4],
    heights: [2.6, 3.8],
    colours: tones,
    seed: 88,
    lit: 0.3,
    windowSize: 0.3,
    grid: [0.6, 0.7],
  });

  /* ---- the convenience store ---- */
  const store = middle(SHOPS.store);
  panel('store', 5.0, 1.9, 640, 256, paintStore, store, 1.15);
  B.box(5.8, 0.1, 0.5, '#f7f2e4', { x: store, y: 2.2, z: FRONT + 0.25, shade: 0 });
  B.box(5.72, 0.86, 0.2, '#a53c2e', { x: store, y: 2.68, z: FRONT + 0.04, shade: 0 });
  panel('store-sign', 5.6, 0.76, 768, 104, paintStoreSign, store, 2.68, FRONT + 0.15);
  // Window frame and the sliding doors.
  for (const x of [-2.5, -0.62, 0.62, 2.5])
    B.box(0.07, 1.96, 0.07, '#dfe4ee', { x: store + x, y: 1.13, z: FRONT + 0.06, shade: 0 });
  B.box(5.07, 0.07, 0.07, '#dfe4ee', { x: store, y: 2.1, z: FRONT + 0.06, shade: 0 });
  B.box(5.07, 0.2, 0.1, '#c9cfdc', { x: store, y: 0.1, z: FRONT + 0.06, shade: 0 });
  B.box(1.1, 0.03, 0.55, '#3f6f5a', { x: store, y: 0.015, z: FRONT + 0.42, shade: 0 });
  B.cylinder(0.2, 0.17, 0.56, '#5d6f8c', { x: store + 2.7, y: 0.28, z: FRONT + 0.36 }, 10);
  // A sandwich board by the door.
  B.within({ x: store - 2.55, z: FRONT + 0.85, ry: 0.25 }, (b) => {
    b.box(0.56, 0.86, 0.04, '#f7f2e4', { y: 0.44, z: 0.1, rx: -0.2 });
    b.box(0.56, 0.86, 0.04, '#d9d2c0', { y: 0.44, z: -0.1, rx: 0.2 });
    for (const [y, colour] of [
      [0.66, '#e8593f'],
      [0.48, '#6fb3d9'],
      [0.3, '#f2c94a'],
    ])
      b.box(0.38, 0.07, 0.02, colour, { y, z: 0.14 + (0.44 - y) * 0.2, rx: -0.2, shade: 0 });
  });
  const shop = new THREE.PointLight('#fff1cf', 10, 9, 1.5);
  shop.position.set(store, 2.0, 1.0);
  group.add(shop);

  /* ---- the noodle shop ---- */
  const noodles = middle(SHOPS.noodles),
    [left, right, eaves] = SHOPS.noodles;
  panel('lattice', 2.6, 1.9, 384, 256, paintLattice, noodles, 0.98);
  B.box(2.84, 0.12, 0.14, '#3a2a22', { x: noodles, y: 2.0, z: FRONT + 0.06, shade: 0 });
  for (const side of [-1, 1])
    B.box(0.12, 2.0, 0.14, '#3a2a22', {
      x: noodles + side * 1.36,
      y: 1.0,
      z: FRONT + 0.06,
      shade: 0,
    });
  // Tiled eave, and the shop curtain under it.
  B.box(right - left + 0.5, 0.14, 1.3, '#39405f', {
    x: noodles,
    y: eaves + 0.12,
    z: FRONT + 0.2,
    rx: 0.3,
    shade: 0,
  });
  for (let x = left; x <= right + 0.01; x += 0.35)
    B.cylinder(
      0.05,
      0.05,
      1.3,
      '#4a5278',
      { x, y: eaves + 0.2, z: FRONT + 0.2, rx: Math.PI / 2 + 0.3 },
      5,
    );
  B.cylinder(
    0.025,
    0.025,
    2.9,
    '#3a2a22',
    { x: noodles, y: 2.24, z: FRONT + 0.16, rz: Math.PI / 2 },
    6,
  );
  for (let i = 0; i < 4; i++) {
    const x = noodles + (i - 1.5) * 0.68;
    B.box(0.62, 0.58, 0.03, '#2f4a7a', { x, y: 1.94, z: FRONT + 0.16, shade: 0.12 });
    B.cylinder(0.13, 0.13, 0.012, '#f4ead3', { x, y: 1.96, z: FRONT + 0.18, rx: Math.PI / 2 }, 12);
  }
  // A paper lantern on one side, the shop's banner on the other.
  const lantern = { x: left + 0.55, y: 1.75, z: FRONT + 0.34 };
  B.cylinder(0.01, 0.01, 0.9, '#3a2a22', { ...lantern, y: 2.5 }, 4);
  G.ball(0.26, '#ff7f57', { ...lantern, sy: 1.18 }, 12);
  for (const y of [-0.3, 0.3])
    B.cylinder(0.14, 0.14, 0.06, '#3a2a22', { ...lantern, y: lantern.y + y }, 10);
  env.sprite(
    textures.radial('lantern', 'rgba(255,140,90,.55)', 'rgba(255,140,90,0)'),
    lantern.x,
    lantern.y,
    lantern.z + 0.1,
    2.1,
  );
  panel(
    'noodle-banner',
    0.5,
    1.3,
    96,
    250,
    (g, w, h) =>
      paintBanner(g, w, h, { text: '拉麵', paper: '#f4ead3', ink: '#7a2f25', edge: '#7a2f25' }),
    right - 0.6,
    1.3,
    FRONT + 0.08,
  );
  B.box(0.58, 0.06, 0.08, '#3a2a22', { x: right - 0.6, y: 1.98, z: FRONT + 0.06, shade: 0 });
  // Plants either side of the door.
  for (const x of [noodles - 1.75, noodles + 1.72]) {
    B.cylinder(0.2, 0.15, 0.3, '#8a5a44', { x, y: 0.15, z: FRONT + 0.4 }, 9);
    B.ball(0.26, '#3f7a5c', { x, y: 0.5, z: FRONT + 0.4, sy: 1.1 }, 7);
    B.ball(0.18, '#4f8f6a', { x: x + 0.12, y: 0.74, z: FRONT + 0.42 }, 6);
  }
  const warm = new THREE.PointLight('#ffb46b', 6, 7, 1.5);
  warm.position.set(noodles, 1.6, 0.6);
  group.add(warm);
  // Steam drifting up from the kitchen vent.
  const vent = { x: right - 1.0, y: eaves + 0.75, z: FRONT - 1.2 };
  B.cylinder(0.13, 0.13, 0.7, '#6a708a', { ...vent, y: eaves + 0.35 }, 8);
  B.cone(0.22, 0.14, '#6a708a', { ...vent, y: eaves + 0.77 }, 8);
  for (let i = 0; i < 3; i++) {
    const puff = env.sprite(
      textures.radial('steam', 'rgba(235,238,255,.4)', 'rgba(235,238,255,0)'),
      vent.x,
      vent.y + 0.3 + i * 0.55,
      vent.z,
      0.6 + i * 0.3,
      0.5 - i * 0.12,
    );
    animated.push((t) => {
      const k = (t * 0.12 + i / 3) % 1;
      puff.position.set(vent.x + Math.sin(k * 3 + i) * 0.18, vent.y + 0.2 + k * 1.7, vent.z);
      puff.scale.setScalar(0.5 + k * 0.9);
      puff.material.opacity = Math.sin(k * Math.PI) * 0.5;
    });
  }
  // A cat keeping watch from the roof.
  B.within({ x: left + 1.2, y: eaves + 0.42, z: FRONT + 0.1 }, (b) => {
    const fur = '#e9e2d0';
    b.ball(1, fur, { y: 0.2, sx: 0.2, sy: 0.22, sz: 0.25 }, 9);
    b.ball(0.15, fur, { y: 0.5, z: 0.08 }, 9);
    for (const x of [-0.08, 0.08]) b.cone(0.05, 0.11, fur, { x, y: 0.66, z: 0.08 }, 4);
    b.torus(0.14, 0.03, fur, { x: 0.18, y: 0.14, z: 0.02, rx: Math.PI / 2 }, Math.PI);
  });

  /* ---- the launderette ---- */
  const laundry = middle(SHOPS.laundry);
  panel('laundry', 3.5, 1.75, 512, 256, paintLaundry, laundry, 1.15);
  for (const side of [-1, 1])
    B.box(0.08, 1.85, 0.08, '#dfe4ee', {
      x: laundry + side * 1.76,
      y: 1.15,
      z: FRONT + 0.06,
      shade: 0,
    });
  B.box(3.6, 0.08, 0.08, '#dfe4ee', { x: laundry, y: 2.06, z: FRONT + 0.06, shade: 0 });
  panel(
    'laundry-sign',
    2.7,
    0.62,
    432,
    100,
    (g, w, h) => paintNeon(g, w, h, { text: '自助洗衣', colour: '#7fe6ff' }),
    laundry,
    2.68,
    FRONT + 0.08,
  );
  // A bicycle leaning outside.
  B.within({ x: laundry + 1.3, z: FRONT + 0.75 }, (b) => {
    for (const x of [-0.52, 0.52]) b.torus(0.3, 0.03, '#1c2038', { x, y: 0.33 });
    b.box(0.72, 0.04, 0.04, '#e8593f', { y: 0.6, rz: 0.12 });
    b.box(0.6, 0.04, 0.04, '#e8593f', { x: -0.2, y: 0.46, rz: -0.85 });
    b.box(0.62, 0.04, 0.04, '#e8593f', { x: 0.22, y: 0.5, rz: 0.95 });
    b.box(0.26, 0.05, 0.1, '#1c2038', { x: -0.36, y: 0.78 });
    b.box(0.05, 0.3, 0.05, '#c9cfdc', { x: 0.42, y: 0.84, rz: 0.2 });
    b.box(0.06, 0.05, 0.42, '#1c2038', { x: 0.4, y: 0.98 });
  });

  /* ---- the closed shop and the drinks machines ---- */
  const closed = middle(SHOPS.closed);
  panel('shutter', 3.1, 2.1, 256, 256, paintShutter, closed + 0.75, 1.05);
  panel(
    'closed-sign',
    2.0,
    0.6,
    320,
    100,
    (g, w, h) => paintNeon(g, w, h, { text: '唱片行', colour: '#ff9fd0' }),
    closed + 0.75,
    2.62,
    FRONT + 0.08,
  );
  [
    [5.5, '#c64b3a'],
    [6.4, '#3f6fb0'],
  ].forEach(([x, body], i) => {
    B.rbox(0.82, 1.78, 0.6, 0.04, body, { x, y: 0.89, z: FRONT + 0.4 });
    panel(
      'vending-' + i,
      0.74,
      1.64,
      128,
      288,
      (g, w, h) => paintVending(g, w, h, body),
      x,
      0.9,
      FRONT + 0.71,
    );
  });
  // Post box in the gap between the shops, and a hydrant by the kerb.
  B.rbox(0.46, 1.0, 0.4, 0.07, '#c64b3a', { x: 4.72, y: 0.5, z: FRONT + 0.5 });
  B.box(0.28, 0.04, 0.02, '#1c2038', { x: 4.72, y: 0.72, z: FRONT + 0.71, shade: 0 });
  B.within({ x: 1.1, z: GROUND.kerb - 0.3 }, (b) => {
    b.cylinder(0.11, 0.13, 0.42, '#e8593f', { y: 0.21 }, 9);
    b.ball(0.12, '#e8593f', { y: 0.44, sy: 0.7 }, 8);
    b.cylinder(0.05, 0.05, 0.34, '#e8593f', { y: 0.28, rz: Math.PI / 2 }, 6);
  });

  /* ---- street lamps and overhead wires ---- */
  for (const [x, arm] of LAMPS)
    lampPost(env, {
      x,
      z: GROUND.kerb - 0.35,
      height: 3.9,
      colour: '#3a3f5c',
      glow: 1,
      light: 7,
      arm,
    });
  for (const [y, z, tilt] of [
    [4.55, 0.6, 0.004],
    [4.8, 0.9, -0.006],
  ])
    B.box(46, 0.018, 0.018, '#10142a', { y, z, rz: tilt, shade: 0 });

  /* ---- sky ---- */
  G.ball(1.25, '#f3e6b4', { x: -8.2, y: 6.9, z: -34 }, 16);
  env.sprite(
    textures.radial('moon', 'rgba(243,230,180,.35)', 'rgba(243,230,180,0)'),
    -8.2,
    6.9,
    -33.5,
    8,
  );
  stars(env, { count: 70, seed: 31, x: [-36, 36], y: [5, 14], z: -40, size: 0.22 });
}

function createScene(ctx) {
  // The street is a night scene whatever the hour, as in 2D.
  return createOuting(ctx, { camera: CAMERA, lineZ: 1.6, standY: 0, hour: 22, build });
}

export { createScene };
