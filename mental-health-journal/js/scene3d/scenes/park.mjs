// 公園 in 3D: rolling grass, a sandy path, trees, a pond, a bench and a lamp post.
// Colours follow the 2D park (js/art/pet-scenes.mjs) for day, dusk and night.
import { createOuting } from './outing.mjs';
import { rng } from '../../art/math.mjs';

const CAMERA = {
  fov: 35,
  target: [0, 1.15, 0.2],
  distance: 12.6,
  azimuth: 0,
  azimuthRange: 12,
  polar: 75,
  polarMin: 69,
  polarMax: 81,
  needWidth: 11.6,
  needHeight: 6.4,
};

const GREENS = {
  day: {
    near: '#86bd72',
    mid: '#8fc57b',
    far: '#a6d19a',
    haze: '#bcdcb6',
    leaf: '#5f9a58',
    leafDark: '#4f864b',
    sand: '#e2cfa4',
  },
  dusk: {
    near: '#9cb876',
    mid: '#a9c07e',
    far: '#c5c08f',
    haze: '#d9bfa3',
    leaf: '#6f9258',
    leafDark: '#5c7d4b',
    sand: '#e6c79a',
  },
  night: {
    near: '#3a5f52',
    mid: '#41685a',
    far: '#3f5f66',
    haze: '#44587a',
    leaf: '#356654',
    leafDark: '#2c5546',
    sand: '#8f8a86',
  },
};

function build(env) {
  const { THREE, B, G, S, group, animated, textures, time, night } = env;
  const c = GREENS[time];
  const random = rng(9);

  /* ground: a broad lawn with soft hills behind, hazier with distance */
  B.cylinder(34, 34, 0.6, c.near, { y: -0.3, shade: 0 }, 40);
  [
    [-7, -9, 13, 2.0, 5.5, c.mid],
    [8, -11, 14, 2.5, 5.5, c.mid],
    [0, -19, 24, 2.9, 6, c.far],
    [-17, -23, 16, 3.5, 6, c.haze],
    [18, -25, 18, 3.9, 6, c.haze],
  ].forEach(([x, z, rx, ry, rz, colour]) =>
    B.ball(1, colour, { x, y: -0.5, z, sx: rx, sy: ry, sz: rz, shade: 0.12 }, 18),
  );

  /* the sandy path the pets walk along: a gently winding ribbon */
  const strip = [];
  const index = [];
  for (let i = 0; i <= 44; i++) {
    const x = -11 + i * 0.5,
      z = 1.62 + Math.sin(x * 0.45) * 0.22,
      half = 0.86 + Math.sin(x * 0.9 + 1) * 0.07;
    strip.push(x, 0.012, z - half, x, 0.012, z + half);
    if (i < 44) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const path = new THREE.BufferGeometry();
  path.setAttribute('position', new THREE.Float32BufferAttribute(strip, 3));
  path.setIndex(index);
  path.computeVertexNormals();
  B.add(path, c.sand, { shade: 0 });
  for (let i = 0; i < 16; i++) {
    const x = -8 + random() * 16,
      side = random() < 0.5 ? -1 : 1;
    B.ball(
      0.09 + random() * 0.07,
      night ? '#77788a' : '#cfc8b8',
      {
        x,
        y: 0.02,
        z: 1.62 + Math.sin(x * 0.45) * 0.22 + side * (0.95 + random() * 0.12),
        sy: 0.5,
      },
      6,
    );
  }

  /* trees */
  const tree = (x, z, h, leaf = c.leaf, dark = c.leafDark) => {
    B.cylinder(0.14 * h, 0.2 * h, 1.1 * h, night ? '#5a463c' : '#8a5a33', { x, y: 0.55 * h, z }, 7);
    B.ball(0.95 * h, dark, { x, y: 1.55 * h, z, shade: 0.22 }, 9);
    B.ball(0.72 * h, leaf, { x: x - 0.5 * h, y: 1.95 * h, z: z + 0.2 * h, shade: 0.18 }, 8);
    B.ball(0.68 * h, leaf, { x: x + 0.52 * h, y: 1.85 * h, z: z + 0.25 * h, shade: 0.18 }, 8);
    B.ball(0.6 * h, leaf, { x, y: 2.45 * h, z, shade: 0.14 }, 8);
    S.cylinder(
      1.25 * h,
      1.25 * h,
      0.01,
      '#20301e',
      { x: x - 0.3 * h, y: 0.02, z: z + 0.2 * h, sz: 0.6 },
      14,
    );
  };
  tree(-5.6, -1.4, 1.25);
  tree(5.9, -2.0, 1.4);
  // One tree in blossom for a touch of colour.
  tree(3.9, -5.2, 1.0, night ? '#8a6f92' : '#f6c1cf', night ? '#75607f' : '#eaa6b8');
  tree(-2.4, -5.6, 0.95);
  tree(-8.4, -4.4, 1.15, c.leafDark, c.leaf);
  tree(9.4, -6.0, 1.1);

  /* pond with a ring of stones */
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 36),
    new THREE.MeshBasicMaterial({
      color: night ? '#3f5f92' : time === 'dusk' ? '#d69a8e' : '#86bfe2',
      transparent: true,
      opacity: 0.92,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(1.9, 1.05, 1);
  water.position.set(2.7, 0.045, -1.3);
  group.add(water);
  B.cylinder(
    1,
    1,
    0.05,
    night ? '#33503f' : '#74ad66',
    { x: 2.7, y: 0.005, z: -1.3, sx: 2.08, sz: 1.2, shade: 0 },
    32,
  );
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + random() * 0.2;
    B.ball(
      0.13 + random() * 0.08,
      night ? '#6f7186' : i % 2 ? '#d9d2c4' : '#c4bcae',
      { x: 2.7 + Math.cos(a) * 1.98, y: 0.05, z: -1.3 + Math.sin(a) * 1.12, sy: 0.6 },
      6,
    );
  }
  const ripples = [
    [2.2, -1.2, 0.34],
    [3.3, -1.5, 0.24],
  ].map(([x, z, r]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.86, r, 28),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.055, z);
    ring.scale.set(1.6, 1, 1);
    group.add(ring);
    return ring;
  });
  // Ripples breathe slowly outwards; no sparkle or flashing.
  animated.push((t) =>
    ripples.forEach((ring, i) => {
      const k = (t * 0.12 + i * 0.5) % 1;
      ring.scale.set(1.6 * (0.7 + k * 0.8), 0.7 + k * 0.8, 1);
      ring.material.opacity = 0.5 * (1 - k);
    }),
  );
  for (const [x, z] of [
    [1.5, -1.9],
    [3.9, -0.9],
  ]) {
    B.cylinder(0.28, 0.28, 0.02, night ? '#3f7a5c' : '#6fb35c', { x, y: 0.06, z, shade: 0 }, 10);
    (night ? B : G).ball(0.07, '#ff9fb2', { x: x + 0.05, y: 0.12, z, sy: 0.7 }, 6);
  }

  /* bench */
  B.within({ x: -2.9, z: -0.5 }, (b) => {
    const wood = night ? '#6a4a36' : '#8a5a33';
    for (const z of [-0.14, 0.02, 0.18]) b.rbox(1.9, 0.06, 0.14, 0.025, wood, { y: 0.52, z });
    for (const y of [0.78, 0.98]) b.rbox(1.9, 0.13, 0.05, 0.02, wood, { y, z: -0.26, rx: -0.12 });
    for (const x of [-0.8, 0.8]) {
      b.box(0.07, 0.52, 0.07, '#3a3a40', { x, y: 0.26, z: 0.16 });
      b.box(0.07, 1.06, 0.07, '#3a3a40', { x, y: 0.53, z: -0.24, rx: -0.12 });
      b.box(0.07, 0.06, 0.5, '#3a3a40', { x, y: 0.66, z: -0.04 });
    }
  });
  S.box(2.1, 0.01, 0.8, '#20301e', { x: -3.05, y: 0.02, z: -0.35 });

  /* lamp post */
  const lamp = { x: -0.4, z: -0.7 };
  B.cylinder(0.14, 0.18, 0.16, '#3a3f5c', { ...lamp, y: 0.08 }, 10);
  B.cylinder(0.05, 0.06, 2.9, '#3a3f5c', { ...lamp, y: 1.55, shade: 0 }, 8);
  B.cylinder(0.2, 0.08, 0.1, '#3a3f5c', { ...lamp, y: 3.02, shade: 0 }, 8);
  (night ? G : B).ball(0.24, night ? '#fff3c4' : '#f1ecdd', { ...lamp, y: 3.24, shade: 0 }, 12);
  B.cone(0.26, 0.14, '#3a3f5c', { ...lamp, y: 3.5, shade: 0 }, 8);
  if (time !== 'day') {
    const light = new THREE.PointLight('#ffe9b0', night ? 9 : 3, 11, 1.5);
    light.position.set(lamp.x, 3.1, lamp.z + 0.6);
    group.add(light);
    env.sprite(
      textures.radial('lamp', 'rgba(255,238,180,.6)', 'rgba(255,238,180,0)'),
      lamp.x,
      3.24,
      lamp.z + 0.1,
      night ? 3.4 : 2,
    );
    // A soft pool of lamplight on the grass and path.
    const pool = env.flat(
      new THREE.PlaneGeometry(7.4, 4.6),
      textures.radial('pool', 'rgba(255,233,176,.5)', 'rgba(255,233,176,0)'),
      {
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: night ? 0.8 : 0.35,
      },
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(lamp.x, 0.04, lamp.z + 1.3);
    pool.renderOrder = 1;
    group.add(pool);
  }

  /* flower bushes and scattered flowers */
  const petals = ['#ff9fb2', '#fff4c8', '#ffcf6b', '#c9b7f0'];
  [
    [-6.6, 0.4, 1],
    [6.4, 0.2, 0.9],
    [0.9, -3.2, 0.8],
    [-4.4, -3.4, 0.75],
  ].forEach(([x, z, s], n) =>
    B.within({ x, z, s }, (b) => {
      b.ball(0.5, c.leafDark, { y: 0.3, sy: 0.75 }, 8);
      b.ball(0.38, c.leaf, { x: 0.42, y: 0.24, z: 0.1, sy: 0.75 }, 8);
      b.ball(0.36, c.leaf, { x: -0.4, y: 0.22, z: 0.12, sy: 0.75 }, 8);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.ball(
          0.07,
          petals[(i + n) % 4],
          { x: Math.cos(a) * 0.42, y: 0.42 + Math.sin(a * 2) * 0.1, z: 0.25 + Math.sin(a) * 0.2 },
          6,
        );
      }
    }),
  );
  for (let i = 0; i < 30; i++) {
    const x = -7.5 + random() * 15,
      z = 2.9 + random() * 1.9;
    B.cylinder(0.012, 0.012, 0.14, c.leafDark, { x, y: 0.07, z, shade: 0 }, 4);
    (night ? B : G).ball(0.058, petals[i % 4], { x, y: 0.16, z, sy: 0.7 }, 6);
  }
  for (let i = 0; i < 14; i++) {
    const x = -8 + random() * 16,
      z = -0.4 + random() * 1.0;
    if (Math.abs(x - 2.7) < 2.4 && z < 0.2) continue;
    B.cone(0.05, 0.2, c.leafDark, { x, y: 0.1, z, rz: 0.2 }, 4);
    B.cone(0.05, 0.24, c.leaf, { x: x + 0.06, y: 0.12, z }, 4);
    B.cone(0.05, 0.18, c.leafDark, { x: x + 0.12, y: 0.09, z, rz: -0.25 }, 4);
  }

  /* sky: sun or moon, drifting clouds, and still stars at night */
  if (night) {
    G.ball(1.0, '#f3e6b4', { x: 10, y: 5.1, z: -30 }, 16);
    env.sprite(
      textures.radial('moon', 'rgba(243,230,180,.35)', 'rgba(243,230,180,0)'),
      11,
      10,
      -29.5,
      7,
    );
    const stars = [],
      r = rng(5);
    for (let i = 0; i < 70; i++) stars.push(-26 + r() * 52, 2.6 + r() * 5, -34);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    group.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: '#ffffff',
          size: 0.16,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    // Fireflies drift slowly near the lamp; steady glow, no blinking.
    const fr = rng(13);
    for (let i = 0; i < 6; i++) {
      const base = { x: -3 + fr() * 6, y: 0.7 + fr() * 1.3, z: -0.6 + fr() * 1.6 };
      const fly = env.sprite(
        textures.radial('firefly', 'rgba(255,244,170,.9)', 'rgba(255,244,170,0)'),
        base.x,
        base.y,
        base.z,
        0.16,
        0.8,
      );
      animated.push((t) => {
        fly.position.x = base.x + Math.sin(t * 0.3 + i * 1.7) * 0.5;
        fly.position.y = base.y + Math.sin(t * 0.22 + i) * 0.25;
      });
    }
  } else {
    const dusk = time === 'dusk';
    G.ball(
      dusk ? 1.7 : 1.4,
      dusk ? '#ffc27a' : '#ffe08a',
      { x: 10, y: dusk ? 3.3 : 5.0, z: -30 },
      16,
    );
    env.sprite(
      textures.radial(
        dusk ? 'sun-dusk' : 'sun',
        dusk ? 'rgba(255,194,122,.55)' : 'rgba(255,240,170,.55)',
        'rgba(255,220,150,0)',
      ),
      10,
      dusk ? 3.3 : 5.0,
      -29.5,
      dusk ? 12 : 9,
    );
  }
  [
    [-9, 4.6, -24, 1.0, 0.05],
    [2, 5.4, -26, 0.8, 0.035],
    [15, 4.2, -22, 0.7, 0.045],
  ].forEach(([x, y, z, s, speed]) => {
    const cloud = new THREE.Group();
    const builder = env.builder();
    const tone = night ? '#5d6790' : time === 'dusk' ? '#ffd9c8' : '#ffffff';
    builder.ball(1.0, tone, { sy: 0.6 }, 8);
    builder.ball(0.8, tone, { x: 1.0, y: 0.1, sy: 0.6 }, 8);
    builder.ball(0.7, tone, { x: -1.0, y: 0.05, sy: 0.6 }, 8);
    builder.ball(0.75, tone, { x: 0.3, y: 0.45, sy: 0.7 }, 8);
    cloud.add(builder.build(env.materials.glow));
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(s * 1.6);
    group.add(cloud);
    animated.push((t) => (cloud.position.x = ((x + t * speed * 6 + 30) % 60) - 30));
  });
}

function createScene(ctx) {
  return createOuting(ctx, { camera: CAMERA, lineZ: 1.6, standY: 0, build });
}

export { createScene };
