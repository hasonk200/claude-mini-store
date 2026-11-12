// 湖邊 in 3D: a wooden boardwalk, the lake with sailing boats, and the city across the
// water. Follows the 2D lake (js/art/pet-scenes.mjs): skyline with its tall tower, a white
// and a pink sail, sun by day and moon by night.
import { createOuting } from './outing.mjs';
import { buildingRow, stars, clouds, lampPost } from './city.mjs';
import { paintWater, paintRipples, paintBoards } from './lake-paint.mjs';
import { rng } from '../../art/math.mjs';

// A low, level view so the water and the sky both have room.
const CAMERA = {
  fov: 35,
  target: [0, 1.6, 0.2],
  distance: 12.6,
  azimuth: 0,
  azimuthRange: 12,
  polar: 82,
  polarMin: 77,
  polarMax: 86,
  needWidth: 11.6,
  needHeight: 6.4,
};

const DECK = { back: -0.6, front: 9, wide: 44 };
const WATER = { y: -0.45, far: -41, farHalf: 52, nearHalf: 16 };
const SHORE = -42;
const LAMPS = [-5.3, 5.5];
const JETTY = { x: -7, half: 0.75, end: -6.2 };
const SUN_X = -10;

const TONES = {
  day: {
    city: ['#8d8fb0', '#9799b9', '#8286a8'],
    quay: '#7d80a0',
    rail: '#f3ecdc',
    railDark: '#d9cfba',
    post: '#3a3f5c',
    wood: '#a67d55',
    woodDark: '#8a6444',
    hull: '#fbf7ee',
    haze: '#d6e8f2',
    hill: '#9fbfae',
    cloud: '#ffffff',
    leaf: '#6fa25d',
  },
  dusk: {
    city: ['#75638f', '#6a5985', '#806c98'],
    quay: '#5f4f7a',
    rail: '#f3dcc8',
    railDark: '#d6b9a6',
    post: '#3a3554',
    wood: '#a27150',
    woodDark: '#855a41',
    hull: '#fbe9d8',
    haze: '#f5cdae',
    hill: '#8f7f9a',
    cloud: '#ffd9c8',
    leaf: '#7b9258',
  },
  night: {
    city: ['#1c2347', '#182040', '#222b52'],
    quay: '#141a38',
    rail: '#9a9bb4',
    railDark: '#7f819c',
    post: '#2c3050',
    wood: '#4c4257',
    woodDark: '#3b3246',
    hull: '#b9bdd4',
    haze: '#33457a',
    hill: '#1f2b4a',
    cloud: '#5d6790',
    leaf: '#356654',
  },
};

// The lake's surface: wide at the far shore and narrow by the boardwalk, so the painted
// detail is finest where it is seen up close. `repeat` tiles the picture instead.
function waterSheet(THREE, y, repeat) {
  const rows = 20,
    positions = [],
    uvs = [],
    index = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows,
      z = WATER.far + (DECK.back - WATER.far) * t,
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

// A flat, two-sided triangle (a sail).
function sail(THREE, a, b, c) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([...a, ...b, ...c, ...c, ...b, ...a], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function build(env) {
  const { THREE, B, G, S, group, animated, textures, materials, time, night } = env;
  const c = TONES[time],
    dusk = time === 'dusk';
  B.bevel = 1;

  /* ---- the far shore: the city, its tower, and hills at either end ---- */
  const far = { day: '#a9abc6', dusk: '#8f7ba3', night: '#232c57' }[time];
  buildingRow(env, {
    builder: G,
    from: -44,
    to: 44,
    z: SHORE - 3.4,
    depth: 2,
    base: WATER.y,
    widths: [2.2, 4.6],
    heights: [3.4, 8.4],
    colours: [far],
    seed: 61,
    lit: night ? 0.2 : 0,
    windowSize: 0.18,
    windowTones: ['#c9a05e', '#b8905a'],
  });
  const blocks = buildingRow(env, {
    builder: G,
    from: -40,
    to: 40,
    z: SHORE,
    depth: 2.4,
    base: WATER.y,
    widths: [1.6, 3.8],
    heights: [2.2, 6.2],
    colours: c.city,
    seed: 23,
    lit: night ? 0.36 : dusk ? 0.1 : 0,
    windowSize: 0.22,
  });
  // Set-back upper floors, roof plant and the odd mast break up the flat tops.
  const roof = rng(7);
  for (const block of blocks) {
    const kind = roof();
    if (kind < 0.4)
      G.box(block.w * 0.6, 0.9 + roof() * 1.3, 1.6, c.city[Math.floor(roof() * 3)], {
        x: block.x + (roof() - 0.5) * block.w * 0.3,
        y: WATER.y + block.h + 0.5,
        z: block.z,
        shade: 0,
      });
    else if (kind < 0.6)
      G.cylinder(
        0.03,
        0.03,
        1.4,
        c.city[2],
        { x: block.x, y: WATER.y + block.h + 0.7, z: block.z },
        4,
      );
  }
  const tower = { x: 7.6, z: SHORE - 0.6 };
  G.cylinder(0.2, 0.5, 10.4, c.city[2], { ...tower, y: WATER.y + 5.2 }, 10);
  G.cylinder(0.95, 0.6, 0.5, c.city[2], { ...tower, y: WATER.y + 7.3 }, 14);
  G.ball(0.9, c.city[1], { ...tower, y: WATER.y + 7.62, sy: 0.4 }, 12);
  G.cone(0.1, 3.4, c.city[2], { ...tower, y: WATER.y + 12.1 }, 6);
  if (time !== 'day') G.ball(0.14, '#ff6b5e', { ...tower, y: WATER.y + 13.8 }, 8);
  G.box(96, 0.3, 3, c.quay, { y: WATER.y + 0.1, z: SHORE + 0.4 });
  G.ball(1, c.hill, { x: -37, y: WATER.y, z: SHORE - 5, sx: 13, sy: 3.4, sz: 4 }, 14);
  G.ball(1, c.hill, { x: 39, y: WATER.y, z: SHORE - 6, sx: 15, sy: 4.2, sz: 4 }, 14);
  // Haze softens where the city meets the water.
  S.box(110, 1.5, 0.1, c.haze, { y: WATER.y + 0.6, z: SHORE + 2.2 });

  /* ---- the lake ---- */
  const wide = WATER.farHalf * 2;
  const water = env.flat(
    waterSheet(THREE, WATER.y),
    textures.canvasTexture('place:lake:water:' + time, 1024, 512, (g, w, h) =>
      paintWater(g, w, h, {
        time,
        sun: 0.5 + SUN_X / wide,
        shore: blocks.map((b) => [0.5 + b.x / wide, b.w / wide, b.h / 6.2]),
      }),
    ),
  );
  water.material.map.anisotropy = 8;
  group.add(water);
  const ripples = textures.canvasTexture('place:lake:ripples:' + time, 256, 256, (g, w, h) =>
    paintRipples(g, w, h, time),
  );
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping;
  const drift = env.flat(waterSheet(THREE, WATER.y + 0.012, [5, 9]), ripples, {
    transparent: true,
    depthWrite: false,
    opacity: 0.6,
  });
  drift.renderOrder = 1;
  group.add(drift);
  // The ripples slide sideways very slowly: the lake's gentle motion.
  animated.push((t) => (ripples.offset.x = (t * 0.006) % 1));

  /* boats: bobbing gently, drifting a little */
  const afloat = (x, z, make, scale = 1, sway = 1.2) => {
    const boat = new THREE.Group(),
      b = env.builder();
    b.shade = 0.14;
    make(b);
    boat.add(b.build(materials.lit));
    boat.position.set(x, WATER.y, z);
    boat.scale.setScalar(scale);
    group.add(boat);
    const phase = x * 0.7 + z;
    animated.push((t) => {
      boat.position.y = WATER.y + Math.sin(t * 0.7 + phase) * 0.03;
      boat.rotation.z = Math.sin(t * 0.5 + phase) * 0.03;
      boat.position.x = x + Math.sin(t * 0.03 + phase) * sway;
    });
    return boat;
  };
  const sailboat = (canvas, stripe) => (b) => {
    b.ball(1, c.hull, { y: 0.08, sx: 1.05, sy: 0.3, sz: 0.36 }, 10);
    b.ball(1, stripe, { y: 0.2, sx: 0.96, sy: 0.07, sz: 0.3 }, 10);
    b.cylinder(0.025, 0.035, 2.3, '#8a6a4c', { y: 1.3, shade: 0 }, 6);
    b.add(sail(THREE, [0.06, 0.38, 0], [0.06, 2.4, 0], [1.0, 0.38, 0]), canvas, { shade: 0.1 });
    b.add(sail(THREE, [-0.06, 0.42, 0], [-0.06, 1.9, 0], [-0.78, 0.42, 0]), canvas, {
      shade: 0.1,
    });
  };
  afloat(1.4, -17, sailboat(night ? '#d5d8ea' : '#fffdf6', '#5b8fc0'), 1.5);
  afloat(8.6, -26, sailboat(night ? '#c98fa6' : '#ff9fb2', '#c64b3a'), 1.8);
  // A rowing boat tied up beside the jetty.
  afloat(
    JETTY.x + 1.7,
    -3.4,
    (b) => {
      b.ball(1, night ? '#5b6b8c' : '#6fa9c9', { y: 0.06, sx: 1.0, sy: 0.3, sz: 0.42 }, 10);
      b.ball(1, c.woodDark, { y: 0.2, sx: 0.86, sy: 0.05, sz: 0.32 }, 10);
      for (const x of [-0.3, 0.32]) b.box(0.14, 0.05, 0.6, c.wood, { x, y: 0.27 });
      b.cylinder(0.02, 0.02, 1.2, c.wood, { x: 0.1, y: 0.3, z: 0.1, rz: 1.3, ry: 0.5 }, 5);
    },
    1,
    0.08,
  );
  // Marker buoys.
  afloat(
    2.4,
    -5.4,
    (b) => {
      b.ball(0.2, '#e8593f', { y: 0.08, sy: 0.9 }, 8);
      b.cylinder(0.2, 0.2, 0.07, '#fbf7ee', { y: 0.1 }, 10);
      b.cylinder(0.02, 0.02, 0.4, '#3a3f5c', { y: 0.4 }, 5);
    },
    1,
    0.15,
  );

  /* ---- the boardwalk ---- */
  const deck = env.flat(
    new THREE.PlaneGeometry(DECK.wide, DECK.front - DECK.back),
    textures.canvasTexture('place:lake:deck:' + time, 2048, 512, (g, w, h) =>
      paintBoards(g, w, h, {
        time,
        planks: 104,
        lamps: time === 'day' ? [] : LAMPS.map((x) => [0.5 + x / DECK.wide, night ? 1 : 0.5]),
      }),
    ),
  );
  deck.material.map.anisotropy = 8;
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, (DECK.front + DECK.back) / 2);
  group.add(deck);
  B.box(DECK.wide, 0.14, 0.2, c.woodDark, { y: 0.03, z: DECK.back + 0.06, shade: 0 });

  /* railing along the water, open where the jetty begins */
  const railZ = DECK.back + 0.16,
    gap = [JETTY.x - JETTY.half - 0.15, JETTY.x + JETTY.half + 0.15];
  for (let x = -19.8; x <= 20; x += 2.2) {
    if (x > gap[0] - 0.4 && x < gap[1] + 0.4) continue;
    B.box(0.13, 1.0, 0.13, c.rail, { x, y: 0.5, z: railZ });
    B.ball(0.1, c.post, { x, y: 1.05, z: railZ }, 8);
  }
  for (const x of gap) {
    B.box(0.16, 1.15, 0.16, c.rail, { x, y: 0.575, z: railZ });
    B.ball(0.12, c.post, { x, y: 1.2, z: railZ }, 8);
  }
  for (const [from, to] of [
    [-20, gap[0]],
    [gap[1], 20],
  ]) {
    const middle = (from + to) / 2,
      length = to - from;
    B.box(length, 0.08, 0.1, c.rail, { x: middle, y: 0.95, z: railZ, shade: 0 });
    B.box(length, 0.05, 0.06, c.railDark, { x: middle, y: 0.52, z: railZ, shade: 0 });
  }

  /* jetty reaching out into the lake, with a small lantern at its end */
  const long = DECK.back - JETTY.end;
  B.box(JETTY.half * 2, 0.12, long, c.wood, {
    x: JETTY.x,
    y: -0.06,
    z: DECK.back - long / 2,
    shade: 0,
  });
  for (let z = DECK.back - 0.45; z > JETTY.end; z -= 0.45)
    B.box(JETTY.half * 2, 0.02, 0.04, c.woodDark, { x: JETTY.x, y: 0.005, z, shade: 0 });
  for (const z of [-2.4, -4.3, JETTY.end + 0.1])
    for (const side of [-1, 1])
      B.cylinder(
        0.09,
        0.1,
        1.1,
        c.woodDark,
        { x: JETTY.x + side * JETTY.half, y: 0.05, z, shade: 0.2 },
        7,
      );
  lampPost(env, {
    x: JETTY.x - JETTY.half,
    z: JETTY.end + 0.1,
    height: 1.5,
    colour: c.post,
    glow: night ? 0.5 : dusk ? 0.3 : 0,
  });

  /* lamps on the boardwalk */
  for (const x of LAMPS)
    lampPost(env, {
      x,
      z: DECK.back + 0.42,
      height: 3,
      colour: c.post,
      glow: night ? 1 : dusk ? 0.5 : 0,
      light: night ? 8 : dusk ? 3 : 0,
    });

  /* a bench facing the water */
  B.within({ x: 1.3, z: 0.3, ry: Math.PI }, (b) => {
    for (const z of [-0.14, 0.02, 0.18]) b.box(1.9, 0.06, 0.14, c.wood, { y: 0.52, z });
    for (const y of [0.78, 0.98]) b.box(1.9, 0.13, 0.05, c.wood, { y, z: -0.26, rx: -0.12 });
    for (const x of [-0.8, 0.8]) {
      b.box(0.07, 0.52, 0.07, c.post, { x, y: 0.26, z: 0.16 });
      b.box(0.07, 1.06, 0.07, c.post, { x, y: 0.53, z: -0.24, rx: -0.12 });
      b.box(0.07, 0.06, 0.5, c.post, { x, y: 0.66, z: -0.04 });
    }
  });
  S.box(2.1, 0.01, 0.8, '#2a1c20', { x: 1.3, y: 0.02, z: 0.45 });

  /* a viewer for looking across the lake */
  B.within({ x: -0.9, z: DECK.back + 0.55 }, (b) => {
    b.cylinder(0.16, 0.2, 0.1, c.post, { y: 0.05 }, 10);
    b.cylinder(0.05, 0.06, 1.0, c.post, { y: 0.55, shade: 0 }, 8);
    b.rbox(0.42, 0.26, 0.3, 0.08, night ? '#8f6f5a' : '#d9826a', { y: 1.15 });
    for (const x of [-0.11, 0.11])
      b.cylinder(0.06, 0.06, 0.12, c.post, { x, y: 1.15, z: 0.2, rx: Math.PI / 2 }, 8);
  });

  /* a lifebuoy hung on the railing */
  B.torus(0.24, 0.075, night ? '#b8674f' : '#f0714f', { x: 7.7, y: 0.6, z: railZ + 0.14 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    B.box(0.17, 0.17, 0.17, c.rail, {
      x: 7.7 + Math.cos(a) * 0.24,
      y: 0.6 + Math.sin(a) * 0.24,
      z: railZ + 0.14,
      rz: a,
      shade: 0,
    });
  }

  /* planters with flowers */
  const petals = ['#ff9fb2', '#fff4c8', '#ffcf6b', '#c9b7f0'];
  [
    [-3.8, 0.05],
    [9.4, 0.05],
    [-10.6, 0.05],
  ].forEach(([x, z], n) =>
    B.within({ x, z }, (b) => {
      b.rbox(1.3, 0.46, 0.5, 0.06, c.wood, { y: 0.23 });
      b.box(1.34, 0.06, 0.54, c.woodDark, { y: 0.47, shade: 0 });
      b.ball(0.34, c.leaf, { x: -0.34, y: 0.62, sy: 0.7 }, 7);
      b.ball(0.38, c.leaf, { x: 0.08, y: 0.66, sy: 0.7 }, 7);
      b.ball(0.3, c.leaf, { x: 0.42, y: 0.6, sy: 0.7 }, 7);
    }),
  );
  // Flowers are bright by day; at night they take the evening's light like everything else.
  for (const [n, x] of [-3.8, 9.4, -10.6].entries())
    for (let i = 0; i < 7; i++)
      (night ? B : G).ball(
        0.065,
        petals[(i + n) % 4],
        {
          x: x - 0.5 + i * 0.17,
          y: 0.78 + Math.sin(i * 2.1) * 0.08,
          z: 0.17 + Math.cos(i * 1.7) * 0.1,
        },
        5,
      );

  /* a gull resting on a railing post */
  B.within({ x: 6.6, y: 1.13, z: railZ }, (b) => {
    b.ball(1, night ? '#b9bdd4' : '#fbf7ee', { y: 0.12, sx: 0.2, sy: 0.13, sz: 0.12 }, 8);
    b.ball(0.085, night ? '#b9bdd4' : '#fbf7ee', { x: 0.17, y: 0.25 }, 8);
    b.cone(0.03, 0.1, '#f2b94a', { x: 0.28, y: 0.24, rz: -Math.PI / 2 }, 5);
    b.ball(
      1,
      night ? '#77798f' : '#b9bfd0',
      { x: -0.06, y: 0.15, sx: 0.19, sy: 0.07, sz: 0.13 },
      8,
    );
  });

  /* ---- sky ---- */
  if (night) {
    G.ball(1.5, '#f3e6b4', { x: SUN_X, y: 9.2, z: -52 }, 16);
    env.sprite(
      textures.radial('moon', 'rgba(243,230,180,.35)', 'rgba(243,230,180,0)'),
      SUN_X,
      9.2,
      -51.5,
      9,
    );
    stars(env, { count: 80, seed: 5, x: [-40, 40], y: [6.5, 16], z: -56, size: 0.24 });
  } else {
    G.ball(
      dusk ? 2.3 : 1.9,
      dusk ? '#ffc27a' : '#ffe08a',
      { x: SUN_X, y: dusk ? 6.6 : 10, z: -52 },
      16,
    );
    env.sprite(
      textures.radial(
        dusk ? 'sun-dusk' : 'sun',
        dusk ? 'rgba(255,194,122,.55)' : 'rgba(255,240,170,.55)',
        'rgba(255,220,150,0)',
      ),
      SUN_X,
      dusk ? 6.6 : 10,
      -51.5,
      dusk ? 16 : 12,
    );
    // Gulls gliding high over the water.
    [
      [-7, 7.2, -20, 0.02],
      [5, 8.3, -26, -0.015],
    ].forEach(([x, y, z, speed], i) => {
      const gull = new THREE.Group(),
        b = env.builder();
      // Seen from the boardwalk a gliding gull is a shallow "M": two raised wings.
      b.ball(1, '#fbf7ee', { sx: 0.14, sy: 0.1, sz: 0.3 }, 6);
      for (const side of [-1, 1]) {
        b.box(0.5, 0.04, 0.2, '#fbf7ee', { x: side * 0.3, y: 0.08, rz: side * 0.35 });
        b.box(0.42, 0.04, 0.16, '#8f96a8', { x: side * 0.7, y: 0.14, rz: side * -0.2 });
      }
      gull.add(b.build(materials.glow));
      gull.position.set(x, y, z);
      gull.scale.setScalar(1.5);
      group.add(gull);
      animated.push((t) => {
        gull.position.x = ((x + t * speed * 20 + 40) % 80) - 40;
        gull.position.y = y + Math.sin(t * 0.4 + i * 2) * 0.3;
        gull.rotation.x = Math.sin(t * 0.3 + i) * 0.15;
      });
    });
  }
  clouds(
    env,
    [
      [-14, 11, -46, 1.5, 0.04],
      [1, 12.5, -48, 1.2, 0.03],
      [22, 10.4, -44, 1.3, 0.035],
    ],
    c.cloud,
  );
}

function createScene(ctx) {
  return createOuting(ctx, { camera: CAMERA, lineZ: 1.6, standY: 0, build });
}

export { createScene };
