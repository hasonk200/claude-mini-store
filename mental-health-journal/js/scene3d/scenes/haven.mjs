// 靜靜湖畔 in 3D: a wooden landing on a quiet lake – a bench with a blanket, a lantern on
// its post, a rowing boat among the lily pads, a village and mountains across the water.
// Follows the painted picture (assets/lakeside.webp) the flat page shows; here it also
// follows the time of day. The companion simply sits; nothing here asks anything of them.
import { createOuting } from './outing.mjs';
import { stars, clouds } from './city.mjs';
import { leafyTree } from '../props.mjs';
import { paintWater, paintRipples, paintBoards } from './lake-paint.mjs';
import { rng } from '../../art/math.mjs';

// Higher than the street scenes, to look out over the water as the picture does.
const CAMERA = {
  fov: 35,
  target: [0.4, 1.5, 0],
  distance: 13,
  azimuth: 0,
  azimuthRange: 10,
  polar: 78,
  polarMin: 73,
  polarMax: 83,
  needWidth: 12,
  needHeight: 7.4,
};

const DOCK = { left: -3.3, right: 14, back: -1.3, front: 9.4 };
const WATER = { y: -0.5, far: -37, farHalf: 50, nearHalf: 18 };
const SHORE = -38;
const SUN_X = 8;

const TONES = {
  day: {
    water: {
      far: '#c9ece0',
      mid: '#63c9c4',
      near: '#2f9dab',
      ripple: '255,255,255',
      glint: '255,244,200',
    },
    boards: {},
    peaks: ['#b9c6d8', '#9fb2cc', '#8aa3bd'],
    snow: '#f6f3ea',
    hills: ['#8fb59a', '#7aa888'],
    pine: ['#4f8f6f', '#437f63'],
    autumn: ['#e8a24f', '#d9793f', '#f0c05a'],
    rock: ['#cfc4b2', '#b9ad9b'],
    wall: '#f1e3c4',
    roof: ['#6f9f55', '#5c8a4a'],
    stone: '#d6cab6',
    wood: '#a8794f',
    woodDark: '#8a6040',
    rope: '#d8c08f',
    blanket: '#f1e3c4',
    plaid: '#7fa873',
    cushion: '#f6ecd6',
    hull: '#f4ead7',
    pad: ['#6fb35c', '#5d9f4e'],
    reed: '#5f9a58',
    leaf: ['#7dbb63', '#5f9d52'],
    haze: '#eaf2e4',
    cloud: '#fff1d6',
    sun: '#ffe08a',
    glow: 0.35,
  },
  dusk: {
    water: {
      far: '#f8c9a0',
      mid: '#cf93a2',
      near: '#66689f',
      ripple: '255,226,200',
      glint: '255,214,150',
    },
    boards: {},
    peaks: ['#8f7fa8', '#7d6d9a', '#6f6090'],
    snow: '#f6d9c8',
    hills: ['#86799a', '#75698c'],
    pine: ['#4d6f6a', '#41605c'],
    autumn: ['#d98a4f', '#c56a45', '#e0a85a'],
    rock: ['#c2a99c', '#a89184'],
    wall: '#f1d6b8',
    roof: ['#77905a', '#647b4c'],
    stone: '#c9b3a2',
    wood: '#a27150',
    woodDark: '#855a41',
    rope: '#d6b48a',
    blanket: '#f3dcc0',
    plaid: '#869a6c',
    cushion: '#f7e3cc',
    hull: '#f3dcc8',
    pad: ['#7b9e5a', '#69894c'],
    reed: '#6f8a52',
    leaf: ['#8aa85c', '#6f8a4c'],
    haze: '#f6cfb0',
    cloud: '#ffd3b8',
    sun: '#ffc27a',
    glow: 0.7,
  },
  night: {
    water: {},
    boards: {},
    peaks: ['#27325c', '#222c52', '#1d2648'],
    snow: '#5c6890',
    hills: ['#1f2c4a', '#1a2540'],
    pine: ['#1f3f48', '#1a363f'],
    autumn: ['#4f4660', '#463e58', '#58506a'],
    rock: ['#55597a', '#484c6a'],
    wall: '#5c5f84',
    roof: ['#2f4f52', '#284446'],
    stone: '#55597a',
    wood: '#4c4257',
    woodDark: '#3b3246',
    rope: '#7d7890',
    blanket: '#8f8ca6',
    plaid: '#4f6f66',
    cushion: '#9a97b0',
    hull: '#8f93ae',
    pad: ['#2f6658', '#28584c'],
    reed: '#2f5f50',
    leaf: ['#356654', '#2c5546'],
    haze: '#33457a',
    cloud: '#5d6790',
    sun: '#f3e6b4',
    glow: 1,
  },
};

function waterSheet(THREE, y, repeat) {
  const rows = 20,
    positions = [],
    uvs = [],
    index = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows,
      z = WATER.far + (DOCK.front - WATER.far) * t,
      half = WATER.farHalf + (WATER.nearHalf - WATER.farHalf) * t,
      v = 1 - t;
    positions.push(-half, y, z, half, y, z);
    uvs.push(0, repeat ? v * repeat[1] : v, repeat ? repeat[0] : 1, repeat ? v * repeat[1] : v);
    if (r < rows) index.push(r * 2, r * 2 + 2, r * 2 + 1, r * 2 + 1, r * 2 + 2, r * 2 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

function build(env) {
  const { THREE, B, G, S, group, animated, textures, materials, time, night } = env;
  const c = TONES[time],
    dusk = time === 'dusk',
    random = rng(27);
  B.bevel = 1;
  const lit = night ? B : G;

  /* ---- far away: mountains, wooded hills, the village ---- */
  [
    [-30, 8.6, 19, 0],
    [-13, 7.2, 16, 1],
    [4, 9.6, 21, 0],
    [20, 7.6, 17, 2],
    [36, 8.8, 19, 1],
    [-44, 7, 17, 2],
  ].forEach(([x, h, w, tone], i) => {
    const z = SHORE - 18 - (i % 2) * 4;
    G.cone(w / 2, h, c.peaks[tone], { x, y: WATER.y + h / 2, z, ry: i * 0.7 }, 5);
    G.cone(w * 0.17, h * 0.34, c.snow, { x, y: WATER.y + h * 0.835, z: z + 0.2, ry: i * 0.7 }, 5);
  });
  [
    [-24, 5.4, 15, 0],
    [-4, 4.2, 13, 1],
    [14, 5, 14, 0],
    [32, 4.4, 14, 1],
  ].forEach(([x, h, w, tone]) =>
    G.ball(1, c.hills[tone], { x, y: WATER.y, z: SHORE - 7, sx: w, sy: h, sz: 4 }, 12),
  );
  S.box(120, 5, 0.1, c.haze, { y: WATER.y + 2.6, z: SHORE - 4.5 });
  // The near shore across the water: a band of land with rocks along its edge.
  G.box(110, 0.5, 5, c.hills[1], { y: WATER.y + 0.2, z: SHORE - 1.6 });
  for (let i = 0; i < 46; i++) {
    const x = -44 + i * 1.95 + random() * 0.8;
    G.ball(
      0.4 + random() * 0.5,
      c.rock[i % 2],
      { x, y: WATER.y + 0.15, z: SHORE + 0.9 + random() * 0.5, sy: 0.6 },
      5,
    );
  }
  const pine = (x, z, s, tone) => {
    G.cone(0.75 * s, 1.5 * s, c.pine[tone], { x, y: WATER.y + 0.5 + 1.0 * s, z }, 6);
    G.cone(0.55 * s, 1.3 * s, c.pine[tone], { x, y: WATER.y + 0.5 + 1.8 * s, z }, 6);
    G.cone(0.34 * s, 1.0 * s, c.pine[1 - tone], { x, y: WATER.y + 0.5 + 2.5 * s, z }, 6);
  };
  const shore = [];
  for (let i = 0; i < 54; i++) {
    const x = -46 + i * 1.72 + random() * 0.9,
      z = SHORE - 1 - random() * 3.4,
      s = 0.8 + random() * 0.9;
    // Leave the village its clearing.
    if (x > -17 && x < -4.5 && z > SHORE - 3) continue;
    if (random() < 0.3) {
      const tone = c.autumn[i % 3];
      G.cylinder(0.08, 0.1, 0.8 * s, c.woodDark, { x, y: WATER.y + 0.5 + 0.4 * s, z }, 4);
      G.ball(0.85 * s, tone, { x, y: WATER.y + 0.5 + 1.25 * s, z, sy: 0.95 }, 6);
    } else pine(x, z, s, i % 2);
    shore.push([x, 1.8 * s, 1.6 * s]);
  }
  // The village: cottages with mossy roofs around a chapel with a green dome.
  const cottage = (x, z, w, h) => {
    G.box(w, h, 1.6, c.wall, { x, y: WATER.y + 0.5 + h / 2, z });
    G.add(new THREE.CylinderGeometry(0.01, 1, 0.9, 4, 1), c.roof[x > -11 ? 0 : 1], {
      x,
      y: WATER.y + 0.5 + h + 0.45,
      z,
      ry: Math.PI / 4,
      sx: w * 0.82,
      sz: 1.4,
    });
    for (const dx of [-0.2, 0.22])
      if (!night || dx > 0)
        G.box(0.24, 0.3, 0.05, c.woodDark, {
          x: x + w * dx,
          y: WATER.y + 0.5 + h * 0.5,
          z: z + 0.82,
        });
    if (!night) return;
    // A lit window.
    G.box(0.26, 0.3, 0.05, '#ffd27a', { x: x - w * 0.2, y: WATER.y + 0.5 + h * 0.5, z: z + 0.82 });
  };
  cottage(-15.4, SHORE - 1.4, 2.6, 1.5);
  cottage(-12.6, SHORE - 0.9, 2.2, 1.3);
  cottage(-7.4, SHORE - 1.2, 2.4, 1.4);
  cottage(-5.6, SHORE - 2.4, 2.0, 1.6);
  const chapel = { x: -10.1, z: SHORE - 2 };
  G.box(1.3, 3.6, 1.3, c.wall, { ...chapel, y: WATER.y + 0.5 + 1.8 });
  G.ball(0.8, c.roof[0], { ...chapel, y: WATER.y + 4.3, sy: 1.05 }, 9);
  G.cone(0.16, 0.9, c.roof[1], { ...chapel, y: WATER.y + 5.5 }, 6);
  if (night) G.box(0.3, 0.5, 0.05, '#ffd27a', { ...chapel, y: WATER.y + 2.8, z: chapel.z + 0.67 });
  shore.push([-10.1, 9, 5], [-15, 5, 3], [-6.5, 5, 3]);
  // A little island out in the lake.
  G.ball(1, c.hills[0], { x: 16, y: WATER.y, z: -25, sx: 5.4, sy: 0.9, sz: 2.4 }, 10);
  for (let i = 0; i < 9; i++)
    G.ball(
      0.35 + random() * 0.3,
      c.rock[i % 2],
      { x: 11.6 + i * 1.1, y: WATER.y + 0.1, z: -23 + Math.sin(i) * 0.5, sy: 0.6 },
      5,
    );
  [
    [13.6, -25.6, 1.1],
    [15.4, -25, 1.5],
    [17.2, -25.8, 1.2],
    [18.6, -25.2, 0.9],
  ].forEach(([x, z, s], i) => pine(x, z, s, i % 2));
  G.ball(1.0, c.autumn[0], { x: 14.5, y: WATER.y + 1.5, z: -24.6 }, 6);

  /* ---- the lake ---- */
  const wide = WATER.farHalf * 2;
  const water = env.flat(
    waterSheet(THREE, WATER.y),
    textures.canvasTexture('place:haven:water:' + time, 1024, 512, (g, w, h) =>
      paintWater(g, w, h, {
        time,
        tones: c.water,
        sun: 0.5 + SUN_X / wide,
        shore: shore.map(([x, height, width]) => [0.5 + x / wide, width / wide, height / 9]),
      }),
    ),
  );
  water.material.map.anisotropy = 8;
  group.add(water);
  const ripples = textures.canvasTexture('place:haven:ripples:' + time, 256, 256, (g, w, h) =>
    paintRipples(g, w, h, time),
  );
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  const drift = env.flat(waterSheet(THREE, WATER.y + 0.012, [5, 9]), ripples, {
    transparent: true,
    depthWrite: false,
    opacity: 0.45,
  });
  drift.renderOrder = 1;
  group.add(drift);
  animated.push((t) => (ripples.offset.x = (t * 0.004) % 1));

  /* lily pads with white flowers, drifting almost not at all */
  const pads = new THREE.Group(),
    pb = env.builder(),
    pg = env.builder();
  [
    [-7.6, -3.6, 0.5, 1],
    [-6.4, -4.6, 0.42, 0],
    [-5.2, -3.1, 0.55, 1],
    [-3.2, -4.2, 0.46, 0],
    [-1.4, -3.3, 0.6, 1],
    [0.4, -4.8, 0.44, 0],
    [1.8, -3.0, 0.5, 1],
    [3.6, -4.1, 0.4, 0],
    [-6.9, -1.9, 0.5, 0],
    [-4.6, -2.2, 0.46, 1],
    [-4.3, 2.6, 0.4, 0],
    [-5.4, 3.6, 0.46, 1],
  ].forEach(([x, z, r, flower], i) => {
    pb.cylinder(r, r, 0.02, c.pad[i % 2], { x, y: 0.02, z, ry: i, shade: 0 }, 9);
    if (!flower) return;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      (night ? pb : pg).cone(
        0.07,
        0.2,
        night ? '#b9bdd4' : '#fffdf6',
        {
          x: x + Math.cos(a) * 0.09,
          y: 0.11,
          z: z + Math.sin(a) * 0.09,
          rx: Math.sin(a) * 0.7,
          rz: -Math.cos(a) * 0.7,
        },
        4,
      );
    }
    (night ? pb : pg).ball(0.05, '#ffcf6b', { x, y: 0.12, z }, 5);
  });
  pads.add(pb.build(materials.lit));
  if (!pg.empty) pads.add(pg.build(materials.glow));
  pads.position.y = WATER.y;
  group.add(pads);
  animated.push((t) => (pads.position.x = Math.sin(t * 0.12) * 0.06));

  /* reeds and cattails by the landing */
  for (let i = 0; i < 16; i++) {
    const x = -7.6 + random() * 2.0,
      z = -2.2 + random() * 3.4,
      h = 1.3 + random() * 1.1,
      lean = (random() - 0.5) * 0.3;
    B.cylinder(0.02, 0.03, h, c.reed, { x, y: WATER.y + h / 2, z, rz: lean, shade: 0 }, 4);
    if (i % 2)
      B.cylinder(
        0.06,
        0.06,
        0.34,
        night ? '#4a3b3c' : '#8a5a33',
        { x: x - lean * h * 0.5, y: WATER.y + h - 0.1, z, rz: lean },
        6,
      );
  }
  for (const [x, z, s] of [
    [-7.4, 1.6, 0.9],
    [-6.6, -2.9, 0.6],
    [-6.0, 4.6, 0.6],
  ])
    B.ball(s, c.rock[0], { x, y: WATER.y + s * 0.2, z, sy: 0.62, flat: true }, 6);

  /* a rowing boat tied to the landing */
  const boat = new THREE.Group(),
    bb = env.builder();
  bb.shade = 0.14;
  bb.ball(1, c.hull, { y: 0.1, sx: 1.7, sy: 0.46, sz: 0.74 }, 12);
  bb.ball(1, c.woodDark, { y: 0.33, sx: 1.5, sy: 0.06, sz: 0.58 }, 12);
  bb.torus(1, 0.05, c.wood, { y: 0.36, rx: Math.PI / 2, sx: 1.56, sy: 0.62 });
  for (const x of [-0.55, 0.5]) bb.box(0.2, 0.06, 1.02, c.wood, { x, y: 0.42 });
  bb.cylinder(0.03, 0.03, 1.9, c.wood, { x: 0.1, y: 0.5, z: 0.2, rz: 1.35, ry: 0.4 }, 5);
  bb.box(0.36, 0.03, 0.2, c.wood, { x: 0.9, y: 0.3, z: 0.52, ry: 0.4 });
  boat.add(bb.build(materials.lit));
  boat.position.set(-5.0, WATER.y, 0.2);
  boat.rotation.y = 0.38;
  group.add(boat);
  animated.push((t) => {
    boat.position.y = WATER.y + Math.sin(t * 0.6) * 0.025;
    boat.rotation.z = Math.sin(t * 0.45) * 0.02;
  });

  /* ---- the landing ---- */
  const dockWide = DOCK.right - DOCK.left,
    dockLong = DOCK.front - DOCK.back;
  const lamp = { x: 5.9, z: -0.7 };
  const deck = env.flat(
    new THREE.PlaneGeometry(dockWide, dockLong),
    textures.canvasTexture('place:haven:deck:' + time, 1536, 768, (g, w, h) =>
      paintBoards(g, w, h, {
        time,
        tones: c.boards,
        planks: 46,
        lamps: [[(lamp.x - 0.9 - DOCK.left) / dockWide, c.glow * 0.9]],
      }),
    ),
  );
  deck.material.map.anisotropy = 8;
  deck.rotation.x = -Math.PI / 2;
  deck.position.set((DOCK.left + DOCK.right) / 2, 0, (DOCK.front + DOCK.back) / 2);
  group.add(deck);
  // Its edges: a beam along the water side and down the open left side.
  B.box(dockWide, 0.3, 0.22, c.woodDark, {
    x: (DOCK.left + DOCK.right) / 2,
    y: -0.12,
    z: DOCK.back + 0.02,
    shade: 0,
  });
  B.box(0.22, 0.3, dockLong, c.woodDark, {
    x: DOCK.left + 0.02,
    y: -0.12,
    z: (DOCK.front + DOCK.back) / 2,
    shade: 0,
  });
  // Mooring posts bound with rope.
  const post = (x, z, h = 0.9) => {
    B.cylinder(0.2, 0.22, h + 0.5, c.wood, { x, y: h / 2 - 0.25, z, shade: 0.2 }, 9);
    B.cylinder(0.21, 0.21, 0.03, c.woodDark, { x, y: h + 0.01, z, shade: 0 }, 9);
    for (const y of [0.52, 0.62, 0.72])
      B.torus(0.22, 0.045, c.rope, { x, y: h * y, z, rx: Math.PI / 2 });
  };
  post(DOCK.left + 0.05, DOCK.back + 0.1, 1.0);
  post(DOCK.left + 0.05, 1.5, 0.9);
  post(-1.1, DOCK.back + 0.05, 0.85);
  post(2.6, DOCK.back + 0.05, 0.8);
  // The painter from the boat to its post.
  B.cylinder(
    0.025,
    0.025,
    1.3,
    c.rope,
    { x: DOCK.left - 0.5, y: 0.3, z: 0.9, rz: 1.2, ry: 0.5 },
    4,
  );

  /* the bench, with a blanket and cushions */
  B.within({ x: 3.75, z: 0.35, ry: -0.3 }, (b) => {
    for (const z of [-0.22, 0, 0.22]) b.box(2.5, 0.08, 0.2, c.wood, { y: 0.56, z });
    for (const y of [0.86, 1.1, 1.34]) b.box(2.5, 0.16, 0.07, c.wood, { y, z: -0.4, rx: -0.12 });
    for (const x of [-1.18, 1.18]) {
      b.box(0.12, 0.6, 0.12, c.woodDark, { x, y: 0.28, z: 0.26 });
      b.box(0.12, 1.5, 0.12, c.woodDark, { x, y: 0.75, z: -0.36, rx: -0.12 });
      b.box(0.12, 0.08, 0.74, c.woodDark, { x, y: 0.84, z: -0.04 });
    }
    // Blanket over the right half, hanging a little over the front.
    b.rbox(1.1, 0.07, 0.78, 0.03, c.blanket, { x: 0.6, y: 0.63, z: 0.02 });
    b.rbox(1.1, 0.62, 0.07, 0.03, c.blanket, { x: 0.6, y: 1.12, z: -0.34, rx: -0.12 });
    b.rbox(1.1, 0.5, 0.06, 0.03, c.blanket, { x: 0.6, y: 0.4, z: 0.42 });
    for (let i = 0; i < 7; i++)
      b.box(0.05, 0.12, 0.03, c.blanket, { x: 0.12 + i * 0.16, y: 0.1, z: 0.42, shade: 0 });
    b.rbox(0.62, 0.56, 0.2, 0.09, c.plaid, { x: -0.55, y: 1.0, z: -0.2, rx: -0.2, rz: 0.08 });
    b.rbox(0.56, 0.5, 0.2, 0.09, c.cushion, { x: 0.3, y: 0.98, z: -0.12, rx: -0.25, rz: -0.1 });
  });
  S.box(2.9, 0.01, 1.3, '#2a1c20', { x: 3.9, y: 0.02, z: 0.6 });

  /* a crate with a small lantern, and a pot of daisies */
  const crate = { x: 1.55, z: -0.35 };
  B.rbox(0.62, 0.5, 0.62, 0.04, c.wood, { ...crate, y: 0.25, ry: 0.2 });
  B.box(0.3, 0.42, 0.3, night ? '#2c3050' : '#4a4f66', { ...crate, y: 0.72 });
  G.box(0.2, 0.26, 0.31, '#ffd98a', { ...crate, y: 0.7 });
  G.box(0.31, 0.26, 0.2, '#ffd98a', { ...crate, y: 0.7 });
  B.cone(0.24, 0.16, night ? '#2c3050' : '#4a4f66', { ...crate, y: 1.0, ry: Math.PI / 4 }, 4);
  B.cylinder(0.26, 0.2, 0.34, night ? '#77607a' : '#c98f6a', { x: 2.35, y: 0.17, z: -0.75 }, 10);
  B.ball(0.3, c.leaf[1], { x: 2.35, y: 0.5, z: -0.75, sy: 0.8 }, 7);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    lit.ball(
      0.07,
      i % 3 ? '#fffdf6' : '#ffd0dc',
      {
        x: 2.35 + Math.cos(a) * 0.22,
        y: 0.66 + Math.sin(i * 1.7) * 0.08,
        z: -0.75 + Math.sin(a) * 0.2,
      },
      5,
    );
  }

  /* the lantern post, with a climbing vine */
  B.box(0.22, 4.6, 0.22, c.wood, { ...lamp, y: 2.3, shade: 0.2 });
  B.box(1.1, 0.14, 0.16, c.wood, { x: lamp.x - 0.5, y: 4.0, z: lamp.z });
  B.box(0.1, 0.9, 0.1, c.woodDark, { x: lamp.x - 0.32, y: 3.6, z: lamp.z, rz: -0.75 });
  const lantern = { x: lamp.x - 0.9, z: lamp.z };
  B.cylinder(0.012, 0.012, 0.4, c.woodDark, { ...lantern, y: 3.75 }, 4);
  B.cone(0.3, 0.2, night ? '#2c3050' : '#5a4636', { ...lantern, y: 3.5 }, 6);
  G.cylinder(0.2, 0.17, 0.5, '#ffd98a', { ...lantern, y: 3.15 }, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.box(0.03, 0.52, 0.03, night ? '#2c3050' : '#5a4636', {
      x: lantern.x + Math.cos(a) * 0.2,
      y: 3.15,
      z: lantern.z + Math.sin(a) * 0.2,
      shade: 0,
    });
  }
  B.cylinder(0.2, 0.2, 0.05, night ? '#2c3050' : '#5a4636', { ...lantern, y: 2.88 }, 6);
  env.sprite(
    textures.radial('lantern-warm', 'rgba(255,214,140,.6)', 'rgba(255,214,140,0)'),
    lantern.x,
    3.15,
    lantern.z + 0.1,
    1.6 + c.glow * 2.2,
    0.5 + c.glow * 0.5,
  );
  if (time !== 'day') {
    const light = new THREE.PointLight('#ffd98a', night ? 9 : 4, 10, 1.5);
    light.position.set(lantern.x, 3.0, lantern.z + 0.6);
    group.add(light);
  }
  for (let i = 0; i < 12; i++) {
    const y = 0.5 + i * 0.36,
      side = i % 2 ? 1 : -1;
    B.ball(0.17, c.leaf[i % 2], { x: lamp.x + side * 0.16, y, z: lamp.z + 0.14, sy: 0.7 }, 5);
    if (i % 3 === 1)
      lit.ball(0.08, '#fffdf6', { x: lamp.x + side * 0.24, y: y + 0.1, z: lamp.z + 0.26 }, 5);
  }

  /* flowers at the corners nearest the viewer */
  [
    [-2.5, 3.5],
    [-1.3, 4.4],
    [4.5, 4.3],
    [5.5, 3.3],
    [3.4, 5.0],
  ].forEach(([x, z], n) => {
    B.ball(0.5, c.leaf[n % 2], { x, y: 0.2, z, sy: 0.6 }, 7);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + n,
        fx = x + Math.cos(a) * 0.3,
        fz = z + Math.sin(a) * 0.25,
        tall = 0.5 + ((i + n) % 3) * 0.16;
      B.cylinder(0.014, 0.014, tall, c.leaf[1], { x: fx, y: tall / 2, z: fz, shade: 0 }, 4);
      if ((i + n) % 3 === 0) {
        // A lupin: a little purple spire.
        lit.cone(0.07, 0.34, night ? '#77709a' : '#b79be8', { x: fx, y: tall + 0.12, z: fz }, 5);
      } else {
        lit.ball(0.1, night ? '#b9bdd4' : '#fffdf6', { x: fx, y: tall + 0.02, z: fz, sy: 0.45 }, 6);
        lit.ball(0.045, '#ffcf6b', { x: fx, y: tall + 0.05, z: fz }, 4);
      }
    }
  });
  // A branch reaching in overhead from a tree just out of view.
  leafyTree(THREE, B, { x: 9.4, y: 0, z: -1.6 }, 3.3, c.leaf, c.woodDark, 5);

  /* ---- sky ---- */
  if (night) {
    G.ball(1.5, c.sun, { x: SUN_X, y: 9.6, z: -60 }, 16);
    env.sprite(
      textures.radial('moon', 'rgba(243,230,180,.35)', 'rgba(243,230,180,0)'),
      SUN_X,
      9.6,
      -59.5,
      9,
    );
    stars(env, { count: 90, seed: 5, x: [-50, 50], y: [6, 13], z: -66, size: 0.26 });
    // Fireflies over the reeds: a steady glow that wanders slowly.
    const fr = rng(13);
    for (let i = 0; i < 7; i++) {
      const base = { x: -9.5 + fr() * 6, y: 0.6 + fr() * 1.6, z: -2 + fr() * 5 };
      const fly = env.sprite(
        textures.radial('firefly', 'rgba(255,244,170,.9)', 'rgba(255,244,170,0)'),
        base.x,
        base.y,
        base.z,
        0.18,
        0.8,
      );
      animated.push((t) => {
        fly.position.x = base.x + Math.sin(t * 0.3 + i * 1.7) * 0.5;
        fly.position.y = base.y + Math.sin(t * 0.22 + i) * 0.25;
      });
    }
  } else {
    G.ball(dusk ? 2.4 : 1.9, c.sun, { x: SUN_X, y: dusk ? 6.4 : 9.8, z: -64 }, 16);
    env.sprite(
      textures.radial(
        dusk ? 'sun-dusk' : 'sun',
        dusk ? 'rgba(255,194,122,.55)' : 'rgba(255,240,170,.55)',
        'rgba(255,220,150,0)',
      ),
      SUN_X,
      dusk ? 6.4 : 9.8,
      -63.5,
      dusk ? 20 : 14,
    );
  }
  clouds(
    env,
    [
      [-18, 9.6, -52, 1.6, 0.03],
      [-2, 10.6, -54, 1.2, 0.02],
      [24, 9.2, -50, 1.5, 0.025],
    ],
    c.cloud,
  );
}

function createScene(ctx) {
  return createOuting(ctx, { camera: CAMERA, lineZ: 1.7, standY: 0, build });
}

export { createScene };
