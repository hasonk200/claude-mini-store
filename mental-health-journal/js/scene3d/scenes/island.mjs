// 心晴小島 map in 3D: a wooded, rocky island in a teal lake, after the painted map it
// replaces. The five places stand where DESTINATIONS (js/data/island.mjs) puts them, and the
// garden grows from the same progress level, decoration and watering state as gardenSVG().
import { createBuilder, createMaterials, disposeTree, leafClump, leafyTree } from '../props.mjs';
import { createTextureCache } from '../textures.mjs';
import { createPet3D, petSignature } from '../pet3d.mjs';
import { ISLAND_CAMERA, destinationPosition, orbitPosition } from '../layout.mjs';
import { createTerrain } from './island-terrain.mjs';
import {
  EXTENT,
  LAKE_EXTENT,
  HAZE,
  lakeDeep,
  paintGround,
  paintLake,
  paintIslandSky,
} from './island-paint.mjs';
import { rng } from '../../art/math.mjs';

const ORDER = ['home', 'library', 'garden', 'lake', 'plaza'];
// How far above the ground each map stop floats, so its label clears the building.
const PIN_LIFT = { home: 3.3, library: 3.7, garden: 2.2, lake: 2.2, plaza: 2.5 };
// Where the companion waits at each place: beside it, on the side facing the plaza.
const VISIT = {
  home: [1.5, 1.0],
  library: [-1.55, 1.05],
  garden: [1.9, -0.1],
  lake: [-0.8, 0.3],
  plaza: [-0.2, 1.95],
};
const FLOWERS = ['#ff9fb2', '#ffe27a', '#c9a6f0', '#ffffff', '#ffb36b'];
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const now = () => performance.now();

const TONES = {
  day: {
    pine: ['#2f7257', '#3b8766', '#4c9c74'],
    round: [
      ['#ee8f3e', '#d9772f'],
      ['#8fc45a', '#6fa848'],
      ['#f2b749', '#e09a32'],
      ['#f6b9c9', '#ea9fb5'],
      ['#a6cf63', '#86b54d'],
    ],
    trunk: '#8a5a33',
    bark: '#6b4a3a',
    petal: '#fff3f6',
    rock: ['#cfc2ad', '#b9aa93', '#ddd2bf'],
    stone: '#e4d8c0',
    wall: '#f4e4c5',
    timber: '#7a5638',
    thatch: ['#6f9f55', '#5c8a4a', '#8fbd66'],
    straw: '#e2c98a',
    moss: '#b5d67c',
    dome: '#3f9c98',
    brass: '#d9a441',
    wood: ['#b58860', '#a2764f'],
    pad: '#5fae6a',
    glass: '#ffe7b0',
  },
  dusk: {
    pine: ['#3d6f55', '#4b8262', '#5f946d'],
    round: [
      ['#f08a45', '#d86f33'],
      ['#a3b45a', '#869848'],
      ['#f6b352', '#e2933a'],
      ['#f3a9b6', '#e38ea2'],
      ['#b9c267', '#9aa651'],
    ],
    trunk: '#8a5a33',
    bark: '#6b4a3a',
    petal: '#fff3f6',
    rock: ['#d9bfa6', '#c0a38a', '#e6cfb8'],
    stone: '#ecd3b2',
    wall: '#f6d9b6',
    timber: '#7a5638',
    thatch: ['#84a058', '#6f8a4b', '#a3ba68'],
    straw: '#e9bf7c',
    moss: '#c2cf7a',
    dome: '#4f9a96',
    brass: '#e2a84a',
    wood: ['#b9865c', '#a5734b'],
    pad: '#7aa868',
    glass: '#ffd98a',
  },
  night: {
    pine: ['#1f4a44', '#28584f', '#32675a'],
    round: [
      ['#8a6a62', '#75584f'],
      ['#3f7260', '#346253'],
      ['#8d7c5c', '#77684c'],
      ['#8a6f92', '#75607f'],
      ['#487a62', '#3b6853'],
    ],
    trunk: '#5a463c',
    bark: '#4a3b3c',
    petal: '#c9b3cf',
    rock: ['#7e7f95', '#6a6b81', '#8d8ea4'],
    stone: '#9495aa',
    wall: '#b6abbd',
    timber: '#5a463c',
    thatch: ['#3f6f5a', '#345f4d', '#4b7d66'],
    straw: '#7f8f86',
    moss: '#5f957a',
    dome: '#2f7f86',
    brass: '#c79a4a',
    wood: ['#7d624e', '#6c5342'],
    pad: '#2f6a58',
    glass: '#ffd98a',
  },
};

function createScene(ctx) {
  const { THREE, reducedMotion } = ctx;
  const requestRender = ctx.requestRender || (() => {});
  const setup = ISLAND_CAMERA;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(setup.fov, 3 / 2, 0.5, 220);
  camera.position.set(...orbitPosition(setup));
  camera.lookAt(...setup.target);
  const materials = createMaterials(THREE);
  const shared = new Set([materials.lit, materials.glow, materials.soft, materials.leaf]);
  const textures = createTextureCache(THREE, requestRender);
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  // Sliding `world` is how the view glides towards the chosen place.
  const world = new THREE.Group();
  scene.add(hemisphere, sun, world);

  let land = null,
    landKey = '',
    garden = null,
    gardenKey = '',
    animated = [],
    gardenAnimated = [],
    buildings = {},
    places = null,
    terrain = null,
    snapshot = null,
    clock = 0,
    companion = null,
    walk = null,
    glide = null;

  const H = (x, z) => Math.max(terrain.height(x, z), -0.3);

  const sprite = (group, texture, x, y, z, size, opacity = 1) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }),
    );
    s.position.set(x, y, z);
    s.scale.setScalar(size);
    s.renderOrder = 4;
    group.add(s);
    return s;
  };

  // Builds one self-contained piece (a building) so it can be picked as a unit.
  function piece(at, make) {
    const B = createBuilder(THREE),
      G = createBuilder(THREE),
      S = createBuilder(THREE);
    B.shade = 0.16;
    B.bevel = 1;
    const group = new THREE.Group();
    make(B, G, S, group);
    group.add(B.build(materials.lit));
    if (B.leaves) group.add(B.leaves.build(materials));
    if (!G.empty) group.add(G.build(materials.glow));
    if (!S.empty) {
      const haze = S.build(materials.soft);
      haze.renderOrder = 3;
      group.add(haze);
    }
    group.position.set(at.x, at.y ?? H(at.x, at.z), at.z);
    if (at.ry) group.rotation.y = at.ry;
    if (at.s) group.scale.setScalar(at.s);
    return group;
  }

  const pine = (B, c, x, z, s, turn = 0) => {
    const y = H(x, z);
    B.cylinder(0.06 * s, 0.09 * s, 0.4 * s, c.trunk, { x, y: y + 0.2 * s, z, shade: 0 }, 5);
    [
      [0.54, 0.62, 0.56, 0],
      [0.44, 0.6, 0.94, 0],
      [0.33, 0.56, 1.32, 1],
      [0.21, 0.52, 1.7, 2],
    ].forEach(([r, h, up, tone], i) =>
      B.cone(
        r * s,
        h * s,
        c.pine[tone],
        { x, y: y + up * s, z, ry: turn + i * 0.5, shade: 0.34 },
        7,
      ),
    );
  };
  // Which of the leafy colours are blossom trees (pink) rather than plain foliage.
  const BLOSSOM = 3;
  const roundTree = (B, c, x, z, s, tint, seed = tint) => {
    const colours = c.round[tint % c.round.length],
      blossom = tint % c.round.length === BLOSSOM,
      kind = blossom ? 'blossom' : seed % 5 === 2 ? 'slim' : 'round';
    leafyTree(
      THREE,
      B,
      { x, y: H(x, z), z },
      s,
      kind === 'slim' ? [c.pine[2], c.pine[1]] : colours,
      blossom ? c.bark : c.trunk,
      seed,
      kind,
      blossom ? c.petal : null,
    );
  };
  const boulder = (B, c, x, y, z, s, i) =>
    B.ball(
      1,
      c.rock[i % 3],
      {
        x,
        y,
        z,
        sx: s * (0.85 + (i % 5) * 0.08),
        sy: s * (0.6 + (i % 3) * 0.12),
        sz: s * (0.8 + (i % 4) * 0.09),
        ry: i * 1.3,
        rz: (i % 7) * 0.12,
        shade: 0.3,
        flat: true,
      },
      5,
    );
  const flower = (B, G, night, x, y, z, colour, s = 1) => {
    B.cylinder(0.012 * s, 0.012 * s, 0.18 * s, '#52795a', { x, y: y + 0.09 * s, z, shade: 0 }, 3);
    (night ? B : G).ball(0.075 * s, colour, { x, y: y + 0.21 * s, z, sy: 0.75 }, 5);
    (night ? B : G).ball(0.035 * s, '#fff0b0', { x, y: y + 0.24 * s, z: z + 0.045 * s }, 4);
  };
  const lantern = (B, G, group, lit, x, y, z, height = 1.1, glow = 1.3) => {
    B.cylinder(0.04, 0.06, height, '#5e5a4a', { x, y: y + height / 2, z, shade: 0 }, 6);
    (lit ? G : B).rbox(0.17, 0.22, 0.17, 0.04, lit ? '#ffe4a2' : '#f4ecd2', {
      x,
      y: y + height + 0.1,
      z,
      shade: 0,
    });
    B.cone(0.16, 0.1, '#5e5a4a', { x, y: y + height + 0.26, z, shade: 0 }, 6);
    if (lit)
      sprite(
        group,
        textures.radial('lantern', 'rgba(255,228,162,.65)', 'rgba(255,228,162,0)'),
        x,
        y + height + 0.1,
        z,
        glow,
      );
  };

  function buildLand(snap) {
    const pal = ctx.palette(snap.hour),
      time = pal.time,
      night = pal.night,
      lit = time !== 'day',
      c = TONES[time];
    const group = new THREE.Group();
    const B = createBuilder(THREE),
      G = createBuilder(THREE),
      S = createBuilder(THREE);
    B.shade = 0.16;
    B.bevel = 1;
    animated = [];
    buildings = {};
    scene.background = textures.canvasTexture('island:sky:' + time, 512, 320, (g, w, h) =>
      paintIslandSky(g, w, h, time),
    );
    // Distance haze melts the far water and islets into the sky, as in the painted map.
    scene.fog = new THREE.Fog(HAZE[time], 26, 82);
    hemisphere.color.set(pal.hemiSky);
    hemisphere.groundColor.set(night ? '#3a4a66' : '#86b39a');
    hemisphere.intensity = pal.hemi * 0.95;
    sun.color.set(time === 'day' ? '#ffe9c2' : pal.sun);
    sun.intensity = pal.sunPower * (time === 'day' ? 1.12 : 1);
    sun.position.set(-6, 9, 7);
    const random = rng(52);

    /* ---- where things go (decided first: the ground is painted around them) ---- */
    const plaza = places.plaza;
    const front = (k) => ({
      x: places[k].x + VISIT[k][0] * 0.55,
      z: places[k].z + VISIT[k][1] * 0.55,
    });
    const landing = { x: 0.35, z: terrain.coast(Math.PI / 2 - 0.06) - 0.35 };
    const route = (to, bend) => {
      const mx = (plaza.x + to.x) / 2 + bend[0],
        mz = (plaza.z + to.z) / 2 + bend[1],
        points = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10,
          u = 1 - t;
        points.push([
          u * u * plaza.x + 2 * u * t * mx + t * t * to.x,
          u * u * plaza.z + 2 * u * t * mz + t * t * to.z,
        ]);
      }
      // Start at the rim of the plaza rather than under the fountain.
      return points.filter(([x, z]) => Math.hypot(x - plaza.x, z - plaza.z) > 1.55);
    };
    const paths = [
      route(front('home'), [0.5, -0.3]),
      route(front('library'), [-0.5, -0.2]),
      route(front('garden'), [0.2, 0.5]),
      route(front('lake'), [0.1, 0.5]),
      route(landing, [0.5, 0]),
    ];
    const nearPath = (x, z, gap) =>
      paths.some((path) => path.some(([px, pz]) => Math.hypot(px - x, pz - z) < gap));
    const clearOf = { home: 2.0, library: 2.0, garden: 2.25, lake: 1.5, plaza: 2.15 };
    const free = (x, z, pad = 0) =>
      terrain.onLand(x, z, 0.55) &&
      ORDER.every((k) => Math.hypot(places[k].x - x, places[k].z - z) > clearOf[k] + pad) &&
      !nearPath(x, z, 0.62);
    const trees = [];
    const waiting = ORDER.map((k) => ({
      x: places[k].x + VISIT[k][0],
      z: places[k].z + VISIT[k][1],
    }));
    for (let i = 0; i < 900 && trees.length < 56; i++) {
      const a = random() * Math.PI * 2,
        r = 1.6 + random() * 4.3,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (!free(x, z)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 0.6)) continue;
      // Leave the companion's waiting spots and the view of the plaza clear.
      if (waiting.some((w) => Math.hypot(w.x - x, w.z - z) < 1.0)) continue;
      if (z > plaza.z + 0.4 && Math.abs(x - plaza.x) < 2.3 && z < plaza.z + 3.2) continue;
      // More evergreens on the high ground at the back; colourful trees towards the front.
      const evergreen = random() < (z < -1 ? 0.78 : 0.45);
      // Trees nearer the viewer are kept small so they do not hide what is behind them.
      const size = (0.72 + random() * 0.36) * (z > 2 ? 0.8 : 1);
      trees.push({ x, z, s: size, evergreen, tint: trees.length });
    }
    const lights = [
      [places.home.x + 0.3, places.home.z + 1.2, 2.2],
      [places.library.x - 0.2, places.library.z + 1.2, 2.2],
      [plaza.x, plaza.z, 2.8],
      [places.lake.x, places.lake.z, 1.9],
      [landing.x, landing.z - 0.5, 1.7],
      [places.garden.x + 0.6, places.garden.z, 1.8],
    ];

    /* ---- lake ---- */
    const lake = new THREE.Mesh(
      new THREE.PlaneGeometry(LAKE_EXTENT, LAKE_EXTENT),
      new THREE.MeshBasicMaterial({
        map: textures.canvasTexture('island:lake:' + time, 1024, 1024, (g, w, h) =>
          paintLake(g, w, h, { terrain, time }),
        ),
      }),
    );
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = -0.34;
    const deep = new THREE.Mesh(
      new THREE.CircleGeometry(140, 40),
      new THREE.MeshBasicMaterial({ color: lakeDeep(time) }),
    );
    deep.rotation.x = -Math.PI / 2;
    deep.position.y = -0.36;
    group.add(deep, lake);
    // A band of foam the shape of the coast drifts slowly outwards: the lake's only motion.
    const foam = [0, 1].map((n) => {
      const positions = [],
        index = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2,
          r = terrain.coast(a) + 0.3;
        positions.push(
          Math.cos(a) * r,
          0,
          Math.sin(a) * r,
          Math.cos(a) * (r + 0.07),
          0,
          Math.sin(a) * (r + 0.07),
        );
        if (i < 96) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(index);
      const ring = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.y = -0.32;
      ring.scale.setScalar(1.06 + n * 0.08);
      group.add(ring);
      return ring;
    });
    animated.push((t) =>
      foam.forEach((ring, n) => {
        const k = (t * 0.045 + n / 2) % 1;
        const s = 1.01 + k * 0.2;
        ring.scale.set(s, 1, s);
        ring.material.opacity = (night ? 0.22 : 0.42) * Math.sin(k * Math.PI);
      }),
    );

    /* ---- the ground: one sculpted, painted surface ---- */
    const N = 52,
      step = EXTENT / N,
      positions = [],
      uvs = [],
      index = [];
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const x = -EXTENT / 2 + i * step,
          z = -EXTENT / 2 + j * step,
          outside = Math.hypot(x, z) > terrain.coast(Math.atan2(z, x)) + 0.25;
        positions.push(x, outside ? -0.8 : terrain.height(x, z), z);
        uvs.push(i / N, 1 - j / N);
        if (i < N && j < N) {
          const a = j * (N + 1) + i,
            b = a + N + 1;
          index.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    const groundGeometry = new THREE.BufferGeometry();
    groundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    groundGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    groundGeometry.setIndex(index);
    groundGeometry.computeVertexNormals();
    group.add(
      new THREE.Mesh(
        groundGeometry,
        new THREE.MeshLambertMaterial({
          map: textures.canvasTexture('island:ground:' + time, 1024, 1024, (g, w, h) =>
            paintGround(g, w, h, { terrain, places, paths, trees, lights, time }),
          ),
        }),
      ),
    );

    /* ---- rocks: a tumbled shoreline, and outcrops on the terrace faces ---- */
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + random() * 0.08,
        r = terrain.coast(a) + 0.02 + random() * 0.22,
        s = 0.24 + random() * 0.24;
      boulder(B, c, Math.cos(a) * r, -0.22 + random() * 0.14, Math.sin(a) * r, s, i);
      if (i % 3 === 0)
        boulder(
          B,
          c,
          Math.cos(a + 0.05) * (r + 0.5),
          -0.34,
          Math.sin(a + 0.05) * (r + 0.5),
          s * 0.7,
          i + 1,
        );
    }
    let outcrops = 0;
    for (let i = 0; i < 400 && outcrops < 22; i++) {
      const x = -5 + random() * 10,
        z = -5 + random() * 8;
      if (terrain.slope(x, z) < 0.75 || !terrain.onLand(x, z, 0.9) || nearPath(x, z, 0.5)) continue;
      boulder(B, c, x, terrain.height(x, z) + 0.02, z, 0.2 + random() * 0.22, i);
      outcrops++;
    }
    /* stone steps where a path climbs a terrace */
    for (const path of paths.slice(0, 2))
      for (let i = 1; i < path.length; i++) {
        const [x0, z0p] = path[i - 1],
          [x1, z1] = path[i];
        for (let n = 0; n < 4; n++) {
          const t = n / 4,
            x = x0 + (x1 - x0) * t,
            z = z0p + (z1 - z0p) * t;
          if (terrain.slope(x, z) < 0.5) continue;
          B.rbox(0.74, 0.1, 0.24, 0.03, c.stone, {
            x,
            y: terrain.height(x, z) + 0.02,
            z,
            ry: -Math.atan2(z1 - z0p, x1 - x0) + Math.PI / 2,
            shade: 0.2,
          });
        }
      }

    /* ---- trees ---- */
    for (const t of trees) {
      if (t.evergreen) pine(B, c, t.x, t.z, t.s, t.tint);
      else roundTree(B, c, t.x, t.z, t.s * 1.05, t.tint);
    }
    /* bushes and flowers that stand up out of the painted meadows */
    for (let i = 0; i < 60; i++) {
      const a = random() * Math.PI * 2,
        r = 1.9 + random() * 3.6,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (!free(x, z, -0.5) || terrain.slope(x, z) > 0.4) continue;
      const y = terrain.height(x, z);
      if (i % 3 === 0) {
        B.ball(0.2, c.round[1][1], { x, y: y + 0.1, z, sy: 0.75, flat: true }, 5);
        (night ? B : G).ball(0.05, FLOWERS[i % 5], { x: x + 0.08, y: y + 0.24, z: z + 0.08 }, 4);
        (night ? B : G).ball(0.05, FLOWERS[(i + 2) % 5], { x: x - 0.1, y: y + 0.2, z: z + 0.1 }, 4);
      } else flower(B, G, night, x, y, z, FLOWERS[i % 5], 0.9);
    }

    /* ---- water's edge: stone landing with lanterns, stepping stones, lilies, reeds ---- */
    B.within({ x: landing.x, z: landing.z, ry: 0 }, (b) => {
      for (let i = 0; i < 4; i++)
        b.rbox(1.2 - i * 0.04, 0.12, 0.3, 0.03, c.stone, {
          y: -0.02 - i * 0.09,
          z: 0.1 + i * 0.27,
          shade: 0.2,
        });
      for (const side of [-1, 1]) {
        b.rbox(0.3, 0.6, 0.3, 0.05, c.rock[0], { x: side * 0.78, y: 0.2, z: 0.15, shade: 0.25 });
        (lit ? G : b).rbox(0.18, 0.2, 0.18, 0.04, lit ? '#ffe4a2' : '#f4ecd2', {
          x: side * 0.78,
          y: 0.6,
          z: 0.15,
          shade: 0,
        });
        b.cone(0.18, 0.12, '#5e5a4a', { x: side * 0.78, y: 0.76, z: 0.15, shade: 0 }, 6);
        if (lit)
          sprite(
            group,
            textures.radial('lantern', 'rgba(255,228,162,.65)', 'rgba(255,228,162,0)'),
            landing.x + side * 0.78,
            0.6,
            landing.z + 0.15,
            1.3,
          );
      }
    });
    for (let i = 0; i < 6; i++) {
      const s = 0.3 - i * 0.02;
      B.cylinder(
        s,
        s * 1.1,
        0.1,
        c.rock[i % 3],
        {
          x: landing.x + Math.sin(i * 1.3) * 0.35,
          y: -0.33,
          z: landing.z + 1.25 + i * 0.6,
          sz: 0.8,
          flat: true,
          shade: 0,
        },
        7,
      );
    }
    const pads = [];
    for (const [a0, n] of [
      [1.95, 6],
      [1.15, 5],
      [0.35, 5],
      [2.75, 4],
    ])
      for (let i = 0; i < n; i++) {
        const a = a0 + (random() - 0.5) * 0.5,
          r = terrain.coast(a) + 0.7 + random() * 1.1;
        pads.push([Math.cos(a) * r, Math.sin(a) * r, 0.15 + random() * 0.12, i]);
      }
    pads.forEach(([x, z, r, i]) => {
      B.add(new THREE.CylinderGeometry(r, r, 0.02, 9, 1, false, 0.5, Math.PI * 1.8), c.pad, {
        x,
        y: -0.325,
        z,
        ry: i * 1.9,
        shade: 0,
      });
      if (i % 2 === 0) {
        (night ? B : G).ball(0.07, i % 4 ? '#ffffff' : '#ffc0d2', { x, y: -0.27, z, sy: 0.7 }, 5);
        (night ? B : G).ball(0.03, '#ffe27a', { x, y: -0.23, z }, 4);
      }
    });
    for (const a0 of [1.35, 0.6, 2.35, 3.3]) {
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i - 3) * 0.035,
          r = terrain.coast(a) + 0.28 + (i % 2) * 0.12;
        B.cone(
          0.035,
          0.55 + (i % 3) * 0.12,
          night ? '#3f7a5c' : '#7fae5c',
          { x: Math.cos(a) * r, y: -0.05, z: Math.sin(a) * r, rz: (i - 3) * 0.05, shade: 0.3 },
          4,
        );
      }
    }

    /* ---- far islets with pines, fading into the haze ---- */
    [
      [-15, -14, 1.7],
      [15, -19, 2.2],
      [-22, 2, 1.4],
      [24, -5, 1.6],
      [3, -30, 2.6],
    ].forEach(([x, z, s], n) => {
      for (let i = 0; i < 5; i++)
        boulder(
          B,
          c,
          x + Math.cos(i * 1.3) * s,
          -0.3,
          z + Math.sin(i * 1.3) * s * 0.8,
          0.5 * s,
          i + n,
        );
      B.ball(
        1,
        night ? '#3f7566' : '#8fc866',
        { x, y: -0.1, z, sx: 1.1 * s, sy: 0.3 * s, sz: 0.9 * s, shade: 0 },
        7,
      );
      for (let i = 0; i < 4; i++) {
        const tx = x + (i - 1.5) * 0.45 * s,
          tz = z + (i % 2) * 0.3 * s;
        B.cylinder(
          0.05 * s,
          0.07 * s,
          0.3 * s,
          c.trunk,
          { x: tx, y: 0.25 * s, z: tz, shade: 0 },
          4,
        );
        B.cone(0.36 * s, 0.7 * s, c.pine[i % 3], { x: tx, y: 0.75 * s, z: tz, shade: 0.3 }, 6);
        B.cone(
          0.24 * s,
          0.55 * s,
          c.pine[(i + 1) % 3],
          { x: tx, y: 1.15 * s, z: tz, shade: 0.3 },
          6,
        );
      }
    });

    /* lamp posts beside the plaza and along the paths */
    for (const [x, z] of [
      [plaza.x - 1.75, plaza.z - 0.9],
      [plaza.x + 1.8, plaza.z - 0.75],
      [plaza.x - 1.7, plaza.z + 1.1],
      [plaza.x + 1.75, plaza.z + 1.15],
    ])
      lantern(B, G, group, lit, x, H(x, z), z, 1.0, night ? 1.5 : 1.0);

    group.add(B.build(materials.lit));
    if (B.leaves) group.add(B.leaves.build(materials));
    if (!G.empty) group.add(G.build(materials.glow));
    if (!S.empty) {
      const haze = S.build(materials.soft);
      haze.renderOrder = 3;
      group.add(haze);
    }

    /* ================= the five places ================= */
    const arched = (b, g, x, y, z, w, h, ry = 0) => {
      b.rbox(w + 0.12, h + 0.12, 0.07, Math.min(w, h) * 0.4, c.timber, { x, y, z, ry, shade: 0 });
      g.rbox(w, h, 0.08, Math.min(w, h) * 0.38, c.glass, { x, y, z, ry, shade: 0 });
      b.box(0.03, h, 0.09, c.timber, { x, y, z, ry, shade: 0 });
      b.box(w, 0.03, 0.09, c.timber, { x, y: y + h * 0.1, z, ry, shade: 0 });
    };

    // 暖暖屋: a stone-and-timber cottage under a thick mossy roof, chimney smoking.
    buildings.home = piece({ ...places.home, ry: 0.42, s: 1.12 }, (b, g, s, grp) => {
      b.rbox(2.2, 0.26, 1.8, 0.08, c.rock[1], { y: 0.1, shade: 0.2 });
      b.rbox(1.95, 1.0, 1.55, 0.08, c.wall, { y: 0.74 });
      for (const x of [-0.95, 0.95])
        b.box(0.09, 1.0, 0.09, c.timber, { x, y: 0.74, z: 0.76, shade: 0 });
      b.box(1.95, 0.08, 0.09, c.timber, { y: 1.2, z: 0.77, shade: 0 });
      b.box(0.08, 0.5, 0.09, c.timber, { x: -0.48, y: 0.95, z: 0.77, rz: 0.5, shade: 0 });
      b.box(0.08, 0.5, 0.09, c.timber, { x: 0.48, y: 0.95, z: 0.77, rz: -0.5, shade: 0 });
      /* roof: thatch laid in three overlapping layers, each shorter and paler than the one
         beneath, with a straw ridge and a few clumps of moss */
      const layer = (r, length, colour, y, cover) =>
        b.add(
          new THREE.CylinderGeometry(
            r,
            r,
            length,
            12,
            1,
            false,
            (Math.PI * (1 - cover)) / 2,
            Math.PI * cover,
          ),
          colour,
          { y, rz: Math.PI / 2, sx: 0.88, shade: 0.2 },
        );
      layer(1.1, 2.4, c.thatch[1], 1.18, 1);
      layer(1.16, 2.28, c.thatch[0], 1.18, 0.7);
      layer(1.22, 2.16, c.thatch[2], 1.18, 0.38);
      b.rbox(2.3, 0.1, 0.2, 0.04, c.straw, { y: 2.27, shade: 0.1 });
      // Gable ends under the thatch.
      for (const x of [-1.0, 1.0])
        b.add(new THREE.CylinderGeometry(0.94, 0.94, 0.06, 12, 1, false, 0, Math.PI), c.wall, {
          x,
          y: 1.2,
          rz: Math.PI / 2,
          sx: 0.84,
          shade: 0,
        });
      [
        [-0.8, 0.95, 0.2],
        [0.15, 0.62, 0.16],
        [-0.2, -0.9, 0.18],
        [0.9, 1.02, 0.14],
      ].forEach(([x, angle, r], n) =>
        b.add(leafClump(THREE, r, n + 2, 0), c.moss, {
          x,
          y: 1.18 + Math.cos(angle) * 1.1 * 0.88,
          z: Math.sin(angle) * 1.12,
          sy: 0.55,
          flat: true,
          shade: 0.1,
        }),
      );
      /* stone chimney */
      b.rbox(0.38, 1.0, 0.38, 0.06, c.rock[1], { x: 0.62, y: 2.05, z: -0.3, shade: 0.2 });
      b.rbox(0.48, 0.1, 0.48, 0.03, c.rock[0], { x: 0.62, y: 2.57, z: -0.3, shade: 0 });
      /* door, lantern, windows, flower boxes */
      b.rbox(0.62, 0.9, 0.08, 0.26, c.rock[0], { y: 0.66, z: 0.78, shade: 0 });
      b.rbox(0.48, 0.8, 0.1, 0.2, '#8a5a33', { y: 0.63, z: 0.79, shade: 0.1 });
      b.ball(0.035, c.brass, { x: 0.14, y: 0.6, z: 0.86 }, 5);
      (lit ? g : b).rbox(0.12, 0.16, 0.1, 0.03, lit ? '#ffe4a2' : '#f4ecd2', {
        x: 0.42,
        y: 1.02,
        z: 0.84,
        shade: 0,
      });
      arched(b, g, -0.62, 0.84, 0.78, 0.36, 0.46);
      arched(b, g, 0.72, 0.84, 0.78, 0.3, 0.46);
      arched(b, g, 0.98, 0.84, 0.1, 0.36, 0.46, Math.PI / 2);
      for (const x of [-0.62, 0.72]) {
        b.rbox(0.5, 0.1, 0.14, 0.03, '#8a5a33', { x, y: 0.52, z: 0.85, shade: 0 });
        for (let i = -1; i <= 1; i++)
          (night ? b : g).ball(
            0.055,
            FLOWERS[(i + 5) % 5],
            { x: x + i * 0.14, y: 0.6, z: 0.86 },
            5,
          );
      }
      b.rbox(0.8, 0.1, 0.36, 0.03, c.stone, { y: 0.05, z: 1.02, shade: 0.1 });
      b.rbox(0.62, 0.1, 0.3, 0.03, c.stone, { y: -0.05, z: 1.28, shade: 0.1 });
      /* fence, barrel, flowering bushes */
      for (let i = 0; i < 4; i++) {
        b.box(0.06, 0.36, 0.06, '#f6efe0', {
          x: -1.45 - i * 0.02,
          y: 0.18,
          z: 1.3 - i * 0.42,
          shade: 0,
        });
        b.box(0.06, 0.36, 0.06, '#f6efe0', {
          x: 1.45,
          y: 0.18,
          z: 1.3 - i * 0.42,
          shade: 0,
        });
      }
      b.box(0.04, 0.05, 1.4, '#f6efe0', { x: -1.47, y: 0.26, z: 0.67, shade: 0 });
      b.box(0.04, 0.05, 1.4, '#f6efe0', { x: 1.45, y: 0.26, z: 0.67, shade: 0 });
      b.cylinder(0.17, 0.15, 0.36, c.wood[1], { x: -1.15, y: 0.28, z: 0.95 }, 9);
      b.torus(0.17, 0.015, c.timber, { x: -1.15, y: 0.36, z: 0.95, rx: Math.PI / 2, shade: 0 });
      for (const [x, z] of [
        [-1.05, 1.25],
        [1.1, 1.2],
        [1.15, 0.85],
      ]) {
        b.ball(0.22, c.round[1][1], { x, y: 0.2, z, sy: 0.8, flat: true }, 5);
        for (let i = 0; i < 3; i++)
          (night ? b : g).ball(
            0.05,
            FLOWERS[i],
            { x: x + Math.cos(i * 2.1) * 0.14, y: 0.36, z: z + Math.sin(i * 2.1) * 0.12 },
            4,
          );
      }
      if (lit)
        sprite(
          grp,
          textures.radial('window', 'rgba(255,217,138,.5)', 'rgba(255,217,138,0)'),
          0,
          0.84,
          1.0,
          2.5,
        );
      [0, 1, 2].forEach((i) => {
        const puff = sprite(
          grp,
          textures.radial('smoke', 'rgba(255,255,255,.85)', 'rgba(255,255,255,0)'),
          0.62,
          2.8 + i * 0.3,
          -0.32,
          0.34 + i * 0.1,
          0.5 - i * 0.13,
        );
        animated.push((t) => {
          const rise = (t * 0.12 + i / 3) % 1;
          puff.position.y = 2.72 + rise * 1.1;
          puff.position.x = 0.62 + rise * 0.3 + Math.sin(t * 0.6 + i) * 0.04;
          puff.scale.setScalar(0.26 + rise * 0.36);
          puff.material.opacity = 0.6 * Math.sin(rise * Math.PI);
        });
      });
    });

    // 觀星書屋: a stone tower under a copper dome, a brass telescope watching the sky.
    buildings.library = piece({ ...places.library, ry: -0.3, s: 1.1 }, (b, g, s, grp) => {
      b.cylinder(1.22, 1.3, 0.3, c.rock[1], { y: 0.12, flat: true, shade: 0.2 }, 12);
      b.cylinder(0.98, 1.0, 1.5, c.wall, { y: 1.0 }, 16);
      b.torus(1.0, 0.07, c.rock[0], { y: 0.72, rx: Math.PI / 2, shade: 0 });
      b.torus(1.02, 0.09, c.rock[1], { y: 1.74, rx: Math.PI / 2, shade: 0 });
      b.add(new THREE.SphereGeometry(1.02, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c.dome, {
        y: 1.78,
        shade: 0.14,
      });
      b.torus(1.03, 0.045, c.brass, { y: 1.8, rx: Math.PI / 2, shade: 0 });
      for (let i = 0; i < 4; i++)
        b.torus(1.035, 0.03, c.brass, { y: 1.78, ry: (i / 4) * Math.PI + 0.4, shade: 0 }, Math.PI);
      b.ball(0.11, c.brass, { y: 2.84 }, 8);
      b.cone(0.05, 0.3, c.brass, { y: 3.02, shade: 0 }, 6);
      /* the slit and the telescope poking out of it */
      b.box(0.34, 0.8, 0.6, '#1f3b4a', {
        x: 0.42,
        y: 2.38,
        z: 0.42,
        rz: -0.55,
        ry: 0.78,
        shade: 0,
      });
      b.cylinder(
        0.13,
        0.19,
        1.25,
        c.brass,
        { x: 0.78, y: 2.72, z: 0.74, rz: -0.95, ry: -0.78, shade: 0.1 },
        12,
      );
      b.torus(0.2, 0.03, '#a97c2f', {
        x: 1.14,
        y: 2.97,
        z: 1.09,
        rz: -0.95 + Math.PI / 2,
        ry: -0.78,
        rx: 0,
        shade: 0,
      });
      g.cylinder(
        0.14,
        0.14,
        0.03,
        '#bff6ff',
        { x: 1.3, y: 3.08, z: 1.25, rz: -0.95, ry: -0.78 },
        12,
      );
      /* door with steps, round windows */
      b.rbox(0.6, 0.96, 0.1, 0.26, c.rock[0], { y: 0.73, z: 0.97, shade: 0 });
      b.rbox(0.46, 0.84, 0.12, 0.2, '#6b4a2e', { y: 0.7, z: 0.99, shade: 0.1 });
      b.ball(0.035, c.brass, { x: 0.13, y: 0.68, z: 1.06 }, 5);
      b.rbox(0.9, 0.12, 0.34, 0.03, c.stone, { y: 0.2, z: 1.3, shade: 0.1 });
      b.rbox(0.74, 0.12, 0.3, 0.03, c.stone, { y: 0.08, z: 1.56, shade: 0.1 });
      for (const a of [-0.95, 0.95, 2.2]) {
        const x = Math.sin(a) * 0.99,
          z = Math.cos(a) * 0.99;
        g.cylinder(
          0.19,
          0.19,
          0.05,
          c.glass,
          { x, y: 1.22, z, ry: a, rx: Math.PI / 2, shade: 0 },
          14,
        );
        b.torus(0.2, 0.035, c.brass, { x, y: 1.22, z, ry: a, shade: 0 });
      }
      /* balcony rail, a reading bench, a stack of books and a lantern */
      for (let i = 0; i < 7; i++) {
        const a = -0.9 + i * 0.3;
        b.cylinder(
          0.03,
          0.03,
          0.3,
          c.timber,
          { x: Math.sin(a) * 1.2, y: 0.42, z: Math.cos(a) * 1.2, shade: 0 },
          4,
        );
      }
      b.torus(1.2, 0.025, c.timber, { y: 0.57, rx: Math.PI / 2, ry: 0, shade: 0 }, 1.9);
      [
        ['#c64b3a', 0],
        ['#3f6f93', 0.09],
        ['#e2b84a', 0.18],
      ].forEach(([colour, y], i) =>
        b.box(0.38, 0.09, 0.27, colour, {
          x: -1.25,
          y: 0.05 + y,
          z: 1.05,
          ry: i * 0.3,
          shade: 0,
        }),
      );
      lantern(b, g, grp, lit, 1.35, 0, 0.95, 0.9, night ? 1.5 : 1.0);
      if (lit)
        sprite(
          grp,
          textures.radial('window', 'rgba(255,217,138,.5)', 'rgba(255,217,138,0)'),
          0,
          1.1,
          1.2,
          2.6,
        );
    });

    // 靜靜湖畔: a wooden deck over the water with a bench, a lantern and a rowing boat.
    const out = Math.atan2(places.lake.z, places.lake.x);
    const shoreAt = terrain.coast(out) - Math.hypot(places.lake.x, places.lake.z);
    buildings.lake = piece({ ...places.lake, y: 0, ry: -out }, (b, g, s, grp) => {
      const start = shoreAt - 0.5;
      for (let i = 0; i < 4; i++)
        b.box(0.36, 0.08, 0.9, c.wood[i % 2], {
          x: start + 0.1 + i * 0.38,
          y: -0.02,
          shade: 0,
        });
      for (let i = 0; i < 6; i++)
        b.box(0.3, 0.08, 1.7, c.wood[i % 2], {
          x: start + 1.7 + i * 0.32,
          y: -0.02,
          shade: 0,
        });
      for (const [x, z] of [
        [1.62, -0.82],
        [1.62, 0.82],
        [3.4, -0.82],
        [3.4, 0.82],
        [2.5, -0.82],
        [2.5, 0.82],
      ]) {
        b.cylinder(0.08, 0.08, 1.0, c.timber, { x: start + x, y: -0.1, z, shade: 0.3 }, 6);
        b.ball(0.1, c.timber, { x: start + x, y: 0.42, z }, 5);
      }
      b.box(1.8, 0.03, 0.03, '#d9c79f', { x: start + 2.5, y: 0.3, z: -0.82, shade: 0 });
      /* bench facing the water, potted plants */
      b.within({ x: start + 2.2, z: -0.4, ry: 0 }, (k) => {
        for (const z of [-0.08, 0.08]) k.box(1.0, 0.05, 0.13, '#8a5a33', { y: 0.36, z });
        k.box(1.0, 0.24, 0.05, '#8a5a33', { y: 0.58, z: -0.18, rx: -0.14 });
        for (const x of [-0.42, 0.42]) k.box(0.06, 0.56, 0.3, '#3a3a40', { x, y: 0.3, z: -0.04 });
      });
      for (const z of [-0.58, 0.6]) {
        b.cylinder(0.13, 0.1, 0.2, '#c4704f', { x: start + 3.2, y: 0.12, z }, 8);
        b.ball(0.16, c.round[1][0], { x: start + 3.2, y: 0.32, z, flat: true }, 5);
      }
      /* lantern post with a hanging lamp */
      const lx = start + 3.25,
        lz = 0.2;
      b.cylinder(0.05, 0.06, 1.5, c.timber, { x: lx, y: 0.75, z: lz, shade: 0 }, 6);
      b.box(0.5, 0.05, 0.05, c.timber, { x: lx + 0.2, y: 1.45, z: lz, shade: 0 });
      (lit ? g : b).rbox(0.18, 0.24, 0.18, 0.04, lit ? '#ffe4a2' : '#f4ecd2', {
        x: lx + 0.42,
        y: 1.22,
        z: lz,
        shade: 0,
      });
      b.cone(0.16, 0.1, c.timber, { x: lx + 0.42, y: 1.39, z: lz, shade: 0 }, 6);
      if (lit)
        sprite(
          grp,
          textures.radial('lantern', 'rgba(255,228,162,.65)', 'rgba(255,228,162,0)'),
          lx + 0.42,
          1.22,
          lz,
          night ? 1.7 : 1.1,
        );
    });
    const boat = piece(
      {
        x: places.lake.x + Math.cos(out) * (shoreAt + 2.2) + Math.sin(out) * 1.5,
        y: 0,
        z: places.lake.z + Math.sin(out) * (shoreAt + 2.2) - Math.cos(out) * 1.5,
        ry: 0.5,
      },
      (b) => {
        b.add(
          new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
          '#f4ead3',
          { y: -0.14, sx: 0.7, sy: 0.3, sz: 0.32 },
        );
        b.cylinder(1, 1, 0.03, c.wood[0], { y: -0.15, sx: 0.66, sz: 0.28, shade: 0 }, 12);
        b.torus(1, 0.035, '#c64b3a', { y: -0.14, rx: Math.PI / 2, sx: 0.7, sy: 0.32, shade: 0 });
        for (const x of [-0.2, 0.2]) b.box(0.08, 0.03, 0.54, c.wood[1], { x, y: -0.1, shade: 0 });
      },
    );
    animated.push((t) => {
      boat.position.y = Math.sin(t * 0.9) * 0.03;
      boat.rotation.z = Math.sin(t * 0.7) * 0.04;
    });

    // 小遊戲廣場: a tiered fountain ringed with flowers, benches and a striped game stall.
    buildings.plaza = piece(places.plaza, (b, g, s, grp) => {
      b.cylinder(0.86, 0.92, 0.26, c.stone, { y: 0.13, shade: 0.2 }, 18);
      b.torus(0.87, 0.06, c.rock[0], { y: 0.27, rx: Math.PI / 2, shade: 0 });
      b.cylinder(0.13, 0.2, 0.62, c.stone, { y: 0.56 }, 8);
      b.cylinder(0.44, 0.2, 0.12, c.stone, { y: 0.9 }, 14);
      b.cylinder(0.08, 0.1, 0.36, c.stone, { y: 1.1 }, 8);
      b.cylinder(0.22, 0.1, 0.08, c.stone, { y: 1.3 }, 12);
      for (const [r, y] of [
        [0.78, 0.28],
        [0.38, 0.955],
        [0.18, 1.34],
      ]) {
        const pool = new THREE.Mesh(
          new THREE.CircleGeometry(r, 18),
          new THREE.MeshBasicMaterial({ color: night ? '#5f8fc8' : '#9fe2ee' }),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.y = y;
        grp.add(pool);
      }
      s.ball(0.16, '#e8fbff', { y: 1.46, sy: 1.4 }, 8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        for (let k = 1; k <= 3; k++)
          s.ball(
            0.045,
            '#e8fbff',
            { x: Math.cos(a) * 0.11 * k, y: 1.4 - k * k * 0.045, z: Math.sin(a) * 0.11 * k },
            4,
          );
        for (let k = 1; k <= 3; k++)
          s.ball(
            0.045,
            '#e8fbff',
            {
              x: Math.cos(a + 0.4) * (0.42 + 0.1 * k),
              y: 0.96 - k * k * 0.07,
              z: Math.sin(a + 0.4) * (0.42 + 0.1 * k),
            },
            4,
          );
      }
      /* a ring of flowers around the basin */
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        b.ball(
          0.11,
          c.round[1][1],
          { x: Math.cos(a) * 1.12, y: 0.07, z: Math.sin(a) * 1.12, sy: 0.7, flat: true },
          4,
        );
        (night ? b : g).ball(
          0.06,
          FLOWERS[i % 5],
          { x: Math.cos(a) * 1.12, y: 0.17, z: Math.sin(a) * 1.12 },
          4,
        );
      }
      /* two benches */
      for (const [x, z, ry] of [
        [-1.42, 0.35, Math.PI / 2 - 0.25],
        [1.42, 0.4, -Math.PI / 2 + 0.25],
      ])
        b.within({ x, z, ry }, (k) => {
          for (const dz of [-0.07, 0.07]) k.box(0.8, 0.05, 0.12, '#8a5a33', { y: 0.3, z: dz });
          k.box(0.8, 0.2, 0.05, '#8a5a33', { y: 0.5, z: -0.16, rx: -0.14 });
          for (const dx of [-0.33, 0.33])
            k.box(0.05, 0.48, 0.26, '#3a3a40', { x: dx, y: 0.25, z: -0.03 });
        });
      /* game stall with a striped awning, and a big die */
      b.within({ x: 0.95, z: -1.3, ry: -0.3 }, (k) => {
        k.rbox(0.9, 0.5, 0.5, 0.05, '#3f6f93', { y: 0.27 });
        k.box(1.0, 0.06, 0.6, c.wood[0], { y: 0.55, shade: 0 });
        for (const x of [-0.45, 0.45])
          k.cylinder(0.03, 0.03, 1.0, c.timber, { x, y: 1.0, z: 0.22, shade: 0 }, 5);
        for (let i = 0; i < 6; i++)
          k.box(0.19, 0.05, 0.75, i % 2 ? '#fbf3e3' : '#e2674f', {
            x: -0.47 + i * 0.19,
            y: 1.5,
            z: 0.12,
            rx: 0.32,
            shade: 0,
          });
        for (const [x, colour] of [
          [-0.25, '#ffcf6b'],
          [0, '#ff9fb2'],
          [0.25, '#9ff0ff'],
        ])
          (night ? k : g).ball(0.09, colour, { x, y: 0.68, z: 0.05 }, 6);
      });
      b.rbox(0.34, 0.34, 0.34, 0.07, '#fffdf6', { x: -1.0, y: 0.19, z: -1.25, ry: 0.5 });
      for (const [dx, dy] of [
        [-0.08, 0.08],
        [0.08, -0.08],
        [0, 0],
      ])
        b.ball(0.035, '#c64b3a', { x: -0.96 + dx, y: 0.19 + dy, z: -1.08 + dx * 0.5 }, 5);
    });

    for (const k of ['home', 'library', 'lake', 'plaza']) group.add(buildings[k]);
    group.add(boat);

    if (night) {
      for (const [p, colour, power, lift] of [
        [places.home, '#ffd98a', 3, 0.8],
        [places.plaza, '#ffe4a2', 3.5, 0],
        [places.library, '#ffd98a', 3, 0.9],
      ]) {
        const light = new THREE.PointLight(colour, power, 7, 1.6);
        light.position.set(p.x, 1.3 + lift, p.z + 1.8);
        group.add(light);
      }
    }
    return group;
  }

  // 成長花園 grows with the journey: more flowers each stage, a second tree, then the
  // glasshouse, which glows from 微光花房 onwards. Decoration and watering show too.
  function buildGarden(snap) {
    const pal = ctx.palette(snap.hour),
      time = pal.time,
      night = pal.night,
      lit = time !== 'day',
      c = TONES[time];
    const { level, decor, watered } = snap.garden;
    gardenAnimated = [];
    return piece({ ...places.garden, ry: 0.28 }, (b, g, s, grp) => {
      /* low stone walls around two raised flower beds */
      for (const [x, z, w, d] of [
        [-0.75, 0.55, 1.5, 0.62],
        [-0.75, -0.3, 1.5, 0.62],
      ]) {
        b.rbox(w + 0.14, 0.2, d + 0.14, 0.05, c.rock[0], { x, y: 0.08, z, shade: 0.2 });
        b.box(w, 0.06, d, night ? '#5b4a48' : '#8f6a48', { x, y: 0.2, z, shade: 0 });
        for (let i = 0; i < 5; i++) {
          b.cone(0.05, 0.16, '#6c9a56', { x: x - 0.56 + i * 0.28, y: 0.3, z, rz: 0.3 }, 4);
          b.cone(0.05, 0.16, '#7fb06a', { x: x - 0.5 + i * 0.28, y: 0.3, z, rz: -0.3 }, 4);
        }
      }
      b.box(0.5, 0.05, 0.9, c.stone, { x: 0.28, y: 0.02, z: 0.15, shade: 0 });
      const tree = (x, z, sz, colours, seed = 1, blossom = false) =>
        leafyTree(
          THREE,
          b,
          { x, y: 0, z },
          sz,
          colours,
          blossom ? c.bark : c.trunk,
          seed,
          blossom ? 'blossom' : 'round',
          blossom ? c.petal : null,
        );
      tree(-1.75, -0.75, 1.0, c.round[1]);
      if (level >= 1) {
        tree(1.55, -0.95, 1.1, c.round[0], 2);
        // 三葉草小徑: clover along the little path.
        for (let i = 0; i < 7; i++)
          for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI * 2 + i;
            b.ball(
              0.06,
              night ? '#3f7a5c' : '#74b85f',
              {
                x: -1.3 + i * 0.26 + Math.cos(a) * 0.055,
                y: 0.035,
                z: 1.1 + Math.sin(a) * 0.055,
                sy: 0.4,
              },
              4,
            );
          }
      }
      if (level >= 2) {
        // An arched glasshouse: white ribs over a barrel of glass.
        const glow = level >= 3,
          gx = 0.95,
          gz = 0.25;
        b.rbox(1.2, 0.16, 1.0, 0.04, c.rock[0], { x: gx, y: 0.06, z: gz, shade: 0.2 });
        for (let i = 0; i < 5; i++)
          b.torus(
            0.46,
            0.022,
            '#f6f1e3',
            { x: gx - 0.5 + i * 0.25, y: 0.14, z: gz, ry: Math.PI / 2, shade: 0 },
            Math.PI,
          );
        b.box(1.04, 0.03, 0.03, '#f6f1e3', { x: gx, y: 0.6, z: gz, shade: 0 });
        for (const z of [-0.46, 0.46])
          b.box(1.04, 0.03, 0.03, '#f6f1e3', { x: gx, y: 0.16, z: gz + z, shade: 0 });
        const glass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 1.0, 14, 1, false, 0, Math.PI),
          new THREE.MeshBasicMaterial({
            color: glow && lit ? '#ffe9ad' : '#d9f3ea',
            transparent: true,
            opacity: glow && lit ? 0.8 : 0.42,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        glass.rotation.z = Math.PI / 2;
        glass.rotation.y = Math.PI / 2;
        glass.position.set(gx, 0.14, gz);
        glass.renderOrder = 2;
        grp.add(glass);
        b.box(0.04, 0.4, 0.26, glow ? '#f5d99d' : '#cfe3d6', {
          x: gx + 0.51,
          y: 0.32,
          z: gz,
          shade: 0,
        });
        for (const [x, colour] of [
          [-0.3, '#ff9fb2'],
          [0, '#ffe27a'],
          [0.3, '#c9a6f0'],
        ])
          b.ball(0.08, colour, { x: gx + x, y: 0.26, z: gz, flat: true }, 4);
        if (glow)
          sprite(
            grp,
            textures.radial('glasshouse', 'rgba(255,233,173,.6)', 'rgba(255,233,173,0)'),
            gx,
            0.4,
            gz + 0.2,
            lit ? 2.2 : 1.2,
          );
      }
      if (level >= 4) {
        // 繁花小島: a rose arch at the gate and a tree in full blossom.
        b.torus(0.42, 0.045, c.round[1][1], { x: 0.28, y: 0.04, z: 0.95, shade: 0 }, Math.PI);
        for (let i = 0; i < 7; i++) {
          const a = (i / 6) * Math.PI;
          (night ? b : g).ball(
            0.065,
            i % 2 ? '#ff9fb2' : '#ffffff',
            { x: 0.28 + Math.cos(a) * 0.42, y: 0.04 + Math.sin(a) * 0.42, z: 0.99 },
            4,
          );
        }
        tree(0.2, -1.05, 0.95, c.round[3], 4, true);
      }
      /* flowers: the same count the 2D garden draws, planted in the beds and borders */
      const count = level * 5 + (decor === 'flowers' ? 7 : 1);
      for (let i = 0; i < count; i++) {
        const bed = i % 2,
          col = Math.floor(i / 2) % 6,
          row = Math.floor(i / 12);
        const x = -1.38 + col * 0.25 + (row % 2) * 0.1,
          z = (bed ? -0.3 : 0.55) + (row - 0.5) * 0.24 + (i % 3) * 0.03;
        flower(b, g, night, x, 0.2, z, FLOWERS[i % 5], 1.1);
      }
      if (decor === 'lantern') lantern(b, g, grp, true, 0.3, 0, -0.55, 1.0, night ? 1.6 : 1.1);
      if (decor === 'stars')
        [
          [-1.0, 1.75, 0.2],
          [0.1, 2.05, -0.4],
          [1.1, 1.7, 0.5],
        ].forEach(([x, y, z], i) => {
          const star = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.11),
            new THREE.MeshBasicMaterial({ color: '#fff6be' }),
          );
          star.position.set(x, y, z);
          star.scale.y = 1.4;
          grp.add(star);
          sprite(
            grp,
            textures.radial('star', 'rgba(255,246,190,.5)', 'rgba(255,246,190,0)'),
            x,
            y,
            z,
            0.7,
          );
          // A slow bob; the stars glow steadily and never twinkle.
          gardenAnimated.push((t) => (star.position.y = y + Math.sin(t * 0.5 + i * 2) * 0.08));
        });
      if (watered)
        for (const [x, z] of [
          [-1.2, 0.55],
          [-0.7, -0.3],
          [-0.25, 0.55],
        ]) {
          s.cylinder(0.17, 0.17, 0.01, '#bfe7f2', { x, y: 0.235, z, sz: 0.7 }, 10);
          (night ? b : g).ball(0.04, '#7fc4d8', { x, y: 0.46, z, sy: 1.5 }, 5);
        }
    });
  }

  const visitSpot = (k) => {
    const x = places[k].x + VISIT[k][0],
      z = places[k].z + VISIT[k][1];
    return { x, y: H(x, z), z };
  };
  // The view leans a little towards the chosen place without losing the rest of the island.
  const focusOf = (k) => ({ x: -places[k].x * 0.3, z: -places[k].z * 0.28 });

  function layout() {
    if (!snapshot) return;
    const t = now();
    if (companion) {
      const g = companion.group;
      if (walk && t < walk.start + walk.ms) {
        const p = clamp01((t - walk.start) / walk.ms),
          k = ease(p),
          x = walk.from.x + (walk.to.x - walk.from.x) * k,
          z = walk.from.z + (walk.to.z - walk.from.z) * k;
        g.position.set(x, H(x, z), z);
        companion.hop(Math.abs(Math.sin(p * Math.PI * walk.hops)) * 0.09);
        g.rotation.y = Math.max(
          -1.2,
          Math.min(1.2, Math.atan2(walk.to.x - walk.from.x, walk.to.z - walk.from.z)),
        );
      } else {
        const spot = visitSpot(snapshot.destination);
        g.position.set(spot.x, spot.y, spot.z);
        g.rotation.y = 0;
        companion.hop(0);
        walk = null;
      }
    }
    const focus = focusOf(snapshot.destination);
    if (glide && t < glide.start + glide.ms) {
      const k = ease(clamp01((t - glide.start) / glide.ms));
      world.position.set(
        glide.from.x + (focus.x - glide.from.x) * k,
        0,
        glide.from.z + (focus.z - glide.from.z) * k,
      );
    } else {
      world.position.set(focus.x, 0, focus.z);
      glide = null;
    }
  }

  function update(snap) {
    const pal = ctx.palette(snap.hour);
    const key = pal.time;
    const previous = snapshot;
    snapshot = snap;
    if (!places) {
      places = Object.fromEntries(ORDER.map((k) => [k, destinationPosition(snap.destinations[k])]));
      terrain = createTerrain(places);
    }
    if (key !== landKey) {
      if (land) {
        world.remove(land);
        disposeTree(land, shared);
        textures.release('island:');
      }
      landKey = key;
      gardenKey = '';
      land = buildLand(snap);
      world.add(land);
    }
    const wanted = JSON.stringify([key, snap.garden]);
    if (wanted !== gardenKey) {
      if (garden) {
        world.remove(garden);
        disposeTree(garden, shared);
      }
      gardenKey = wanted;
      garden = buildGarden(snap);
      buildings.garden = garden;
      world.add(garden);
    }
    if (!companion || companion.signature !== petSignature(snap.pet)) {
      const at = companion ? companion.group.position.clone() : null;
      if (companion) {
        world.remove(companion.group);
        companion.dispose();
      }
      companion = createPet3D(THREE, snap.pet, { materials, textures, reducedMotion });
      companion.group.scale.setScalar(0.8);
      world.add(companion.group);
      if (at) companion.group.position.copy(at);
    }
    companion.setExpr(snap.pet.expr);
    if (previous && previous.destination !== snap.destination && !reducedMotion) {
      // Stroll to the newly chosen place while the view glides after it (about 0.8s).
      const from = { x: companion.group.position.x, z: companion.group.position.z },
        to = visitSpot(snap.destination),
        length = Math.hypot(to.x - from.x, to.z - from.z);
      walk = {
        from,
        to,
        start: now(),
        ms: 500 + length * 150,
        hops: Math.max(2, Math.round(length * 1.3)),
      };
      glide = { from: { x: world.position.x, z: world.position.z }, start: now(), ms: 800 };
    } else if (!previous || previous.destination !== snap.destination) {
      walk = null;
      glide = null;
    }
    for (const animate of animated) animate(clock);
    for (const animate of gardenAnimated) animate(clock);
    layout();
    requestRender();
  }

  const raycaster = new THREE.Raycaster();

  return {
    scene,
    camera,
    cameraSetup: setup,
    frame(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const spread = 2 * Math.tan((setup.fov * Math.PI) / 360);
      return {
        distance: Math.max(
          setup.needWidth / (spread * (width / height)),
          setup.needHeight / spread,
        ),
        target: setup.target,
      };
    },
    update,
    tick(dt) {
      clock += dt;
      for (const animate of animated) animate(clock);
      for (const animate of gardenAnimated) animate(clock);
      if (companion) companion.tick(clock);
      layout();
    },
    busy() {
      const t = now();
      return !!((walk && t < walk.start + walk.ms) || (glide && t < glide.start + glide.ms));
    },
    ambient: () => true,
    // A click on a building counts as a click on its map stop.
    pick(ndc) {
      raycaster.setFromCamera(ndc, camera);
      let best = null,
        distance = Infinity;
      for (const k of ORDER) {
        const hits = buildings[k]
          ? raycaster.intersectObject(buildings[k], true).filter((h) => !h.object.isSprite)
          : [];
        if (hits.length && hits[0].distance < distance) {
          distance = hits[0].distance;
          best = k;
        }
      }
      return best && '[data-destination="' + best + '"]';
    },
    // Map stops float above their buildings.
    anchors: () =>
      places
        ? ORDER.map((k) => ({
            selector: '.map-stop[data-destination="' + k + '"]',
            kind: 'pin',
            x: places[k].x + world.position.x,
            y: H(places[k].x, places[k].z) + PIN_LIFT[k],
            z: places[k].z + world.position.z,
            size: 1,
          }))
        : [],
    describe: () => ({
      time: landKey,
      destination: snapshot ? snapshot.destination : null,
      garden: snapshot ? snapshot.garden : null,
      flowers: snapshot
        ? snapshot.garden.level * 5 + (snapshot.garden.decor === 'flowers' ? 7 : 1)
        : 0,
      places: Object.fromEntries(
        Object.entries(places || {}).map(([k, p]) => [
          k,
          { x: +p.x.toFixed(2), y: +H(p.x, p.z).toFixed(2), z: +p.z.toFixed(2) },
        ]),
      ),
      visit: VISIT,
      companion: companion
        ? {
            x: +companion.group.position.x.toFixed(2),
            z: +companion.group.position.z.toFixed(2),
            sp: companion.species,
          }
        : null,
      // How far the view has glided towards the chosen place.
      pan: { x: +world.position.x.toFixed(2), z: +world.position.z.toFixed(2) },
      moving: !!(walk || glide),
    }),
    dispose() {
      if (companion) companion.dispose();
      if (garden) disposeTree(garden, shared);
      if (land) disposeTree(land, shared);
      for (const material of shared) material.dispose();
      materials.ramp.dispose();
      if (materials.leaf.map) materials.leaf.map.dispose();
      new THREE.Sprite().geometry.dispose();
      textures.dispose();
      scene.fog = null;
      companion = garden = land = snapshot = null;
    },
  };
}

export { createScene };
