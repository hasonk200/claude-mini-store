// 暖暖屋 in 3D: a dollhouse cutaway of the pet's room. The room, furniture and pets are all
// built from the same state the 2D SVG room uses; nothing here changes that state.
import { createBuilder, createMaterials, disposeTree } from '../props.mjs';
import { createTextureCache } from '../textures.mjs';
import { createPet3D, petSignature } from '../pet3d.mjs';
import { rng } from '../../art/math.mjs';
import {
  FLOOR_SIZE,
  BACK_SIZE,
  SIDE_SIZE,
  LIGHT_AREA,
  paintWindowLight,
  paintFloor,
  paintBackWall,
  paintSideWall,
  paintRug,
  paintBackdrop,
} from './home-paint.mjs';
import {
  ROOM,
  HOME_CAMERA,
  NEST_3D,
  PET_BOX,
  spotPosition,
  clampToFloor,
  orbitPosition,
  frameHome,
} from '../layout.mjs';

const HALF_W = ROOM.width / 2,
  HALF_D = ROOM.depth / 2;
const BACK = -HALF_D,
  LEFT = -HALF_W;
const WINDOW = { x: 1.4, y: 2.08, w: 1.96, h: 1.36 };
const ease = (t) => t * t * (3 - 2 * t);
const hash = (text) => {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h;
};

function createScene(ctx) {
  const { THREE, reducedMotion } = ctx;
  const requestRender = ctx.requestRender || (() => {});
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(HOME_CAMERA.fov, 8 / 5, 0.5, 60);
  camera.position.set(...orbitPosition(HOME_CAMERA));
  camera.lookAt(...HOME_CAMERA.target);
  const materials = createMaterials(THREE);
  const shared = new Set([materials.lit, materials.glow, materials.soft]);
  const textures = createTextureCache(THREE, requestRender);
  const petShared = { materials, textures, reducedMotion };
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  scene.add(hemisphere, sun);

  let room = null,
    roomKey = '',
    animated = [],
    nest = null,
    snapshot = null,
    clock = 0;
  const pets = new Map();

  // The fairy lights: two swags along the back wall and one along the side wall.
  function stringBulbs() {
    const bulbs = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20,
        local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      bulbs.push([
        LEFT + 0.15 + t * (ROOM.width - 0.3),
        3.36 - 0.42 * 4 * local * (1 - local),
        BACK + 0.09,
      ]);
    }
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      bulbs.push([
        LEFT + 0.09,
        3.36 - 0.42 * 4 * t * (1 - t),
        BACK + 0.15 + t * (ROOM.depth - 0.4),
      ]);
    }
    return bulbs;
  }

  function buildRoom(snap) {
    const pal = ctx.palette(snap.hour),
      C = pal.room,
      own = snap.own || {},
      night = pal.night,
      time = pal.time;
    const group = new THREE.Group();
    const B = createBuilder(THREE),
      G = createBuilder(THREE),
      S = createBuilder(THREE);
    B.shade = 0.16;
    animated = [];
    nest = null;
    const egg = snap.eggs && snap.eggs[0];
    const bulbs = stringBulbs();
    const paintKey = [
      time,
      Object.keys(own)
        .filter((k) => own[k])
        .sort()
        .join(','),
      egg ? 1 : 0,
    ].join('|');
    const painted = (name, size, paint, details) =>
      textures.canvasTexture('room:' + name + ':' + paintKey, size[0], size[1], (g, w, h) =>
        paint(g, w, h, details),
      );
    const flat = (geometry, texture) =>
      new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    const sprite = (texture, x, y, z, size, opacity = 1) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }),
      );
      s.position.set(x, y, z);
      s.scale.setScalar(size);
      s.renderOrder = 4;
      group.add(s);
      return s;
    };

    scene.background = textures.canvasTexture('backdrop:' + time, 640, 400, (g, w, h) =>
      paintBackdrop(g, w, h, time),
    );
    hemisphere.color.set(pal.hemiSky);
    hemisphere.groundColor.set(pal.hemiGround);
    hemisphere.intensity = pal.hemi;
    sun.color.set(pal.sun);
    sun.intensity = pal.sunPower;
    sun.position.set(...pal.sunFrom);

    /* a little floating island for the house to sit on */
    const grass = night ? '#5f8f7c' : time === 'dusk' ? '#a9c489' : '#9fd08a',
      grassDark = night ? '#4f7d6c' : time === 'dusk' ? '#8fb277' : '#84bd74';
    B.rbox(9.9, 1.5, 8.0, 0.7, night ? '#6b5a58' : '#b08a64', {
      x: -0.05,
      y: -1.22,
      z: 0.3,
      shade: 0.4,
    });
    B.rbox(10.3, 0.5, 8.4, 0.24, grass, { x: -0.05, y: -0.58, z: 0.3, shade: 0.1 });
    B.rbox(ROOM.width + 0.5, 0.34, ROOM.depth + 0.5, 0.08, C.slab, {
      x: -0.15,
      y: -0.19,
      z: -0.15,
      shade: 0.25,
    });
    for (const [x, z, s] of [
      [4.55, -1.9, 0.9],
      [4.62, 1.0, 0.65],
      [-3.4, 3.78, 0.85],
      [3.9, 3.85, 0.6],
    ])
      B.within({ x, y: -0.36, z, s }, (b) => {
        b.ball(0.34, grassDark, { y: 0.24 }, 8);
        b.ball(0.26, grass, { x: 0.3, y: 0.16, z: 0.1 }, 8);
        b.ball(0.24, grassDark, { x: -0.28, y: 0.14, z: 0.14 }, 8);
      });
    [
      [0.5, 3.62, 0.34],
      [1.3, 3.9, 0.3],
      [2.15, 3.66, 0.32],
    ].forEach(([x, z, r]) =>
      B.cylinder(r, r * 1.05, 0.07, night ? '#8f8ea0' : '#e2dccd', { x, y: -0.31, z, sz: 0.8 }, 10),
    );
    const petals = ['#ff9fb2', '#fff4c8', '#ffd27a', '#c9a6f0', '#ffffff'];
    [
      [-1.2, 3.75],
      [-0.6, 3.95],
      [-2.2, 3.6],
      [3.0, 3.72],
      [4.5, -0.4],
      [4.62, 2.2],
      [4.45, 3.4],
      [-4.2, 3.9],
      [4.55, -3.0],
    ].forEach(([x, z], i) => {
      B.cylinder(0.012, 0.012, 0.16, grassDark, { x, y: -0.26, z }, 4);
      (night ? B : G).ball(0.06, petals[i % 5], { x, y: -0.16, z, sy: 0.7 }, 6);
    });

    /* shell: painted floor and walls */
    const floorMesh = flat(
      new THREE.PlaneGeometry(ROOM.width, ROOM.depth),
      painted('floor', FLOOR_SIZE, paintFloor, { time, own, egg }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    const back = flat(
      new THREE.PlaneGeometry(ROOM.width, ROOM.height),
      painted('back', BACK_SIZE, paintBackWall, { time, own, bulbs }),
    );
    back.position.set(0, ROOM.height / 2, BACK);
    const side = flat(
      new THREE.PlaneGeometry(ROOM.depth, ROOM.height),
      painted('side', SIDE_SIZE, paintSideWall, { time, own, bulbs }),
    );
    side.rotation.y = Math.PI / 2;
    side.position.set(LEFT, ROOM.height / 2, 0);
    group.add(floorMesh, back, side);
    const wallOuter = night ? '#8f86a6' : time === 'dusk' ? '#dcc3a6' : '#e0cfb0',
      wallCap = night ? '#a49ab6' : '#f3e7d0';
    B.box(ROOM.width + 0.3, ROOM.height + 0.02, 0.22, wallOuter, {
      x: -0.15,
      y: ROOM.height / 2,
      z: BACK - 0.112,
      shade: 0,
    });
    B.box(0.22, ROOM.height + 0.02, ROOM.depth, wallOuter, {
      x: LEFT - 0.112,
      y: ROOM.height / 2,
      z: 0,
      shade: 0,
    });
    B.rbox(ROOM.width + 0.42, 0.1, 0.34, 0.04, wallCap, {
      x: -0.15,
      y: ROOM.height + 0.04,
      z: BACK - 0.1,
      shade: 0,
    });
    B.rbox(0.34, 0.1, ROOM.depth + 0.12, 0.04, wallCap, {
      x: LEFT - 0.1,
      y: ROOM.height + 0.04,
      z: 0.05,
      shade: 0,
    });

    /* window */
    const W = WINDOW;
    B.rbox(W.w + 0.3, W.h + 0.3, 0.1, 0.04, C.windowWood, {
      x: W.x,
      y: W.y,
      z: BACK + 0.04,
      shade: 0,
    });
    B.box(W.w + 0.14, W.h + 0.14, 0.11, C.window, { x: W.x, y: W.y, z: BACK + 0.05, shade: 0 });
    const view = flat(new THREE.PlaneGeometry(W.w, W.h), textures.windowView(pal));
    view.position.set(W.x, W.y, BACK + 0.108);
    group.add(view);
    B.box(0.06, W.h, 0.03, C.window, { x: W.x, y: W.y, z: BACK + 0.125, shade: 0 });
    B.box(W.w, 0.06, 0.03, C.window, { x: W.x, y: W.y, z: BACK + 0.125, shade: 0 });
    B.rbox(W.w + 0.5, 0.1, 0.26, 0.04, C.windowWood, {
      x: W.x,
      y: W.y - W.h / 2 - 0.17,
      z: BACK + 0.13,
    });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        B.cylinder(
          0.062,
          0.075,
          W.h + 0.62,
          i % 2 ? '#9cb8a4' : C.curtain,
          { x: W.x + side * (W.w / 2 + 0.06 + i * 0.1), y: W.y - 0.06, z: BACK + 0.2, shade: 0.22 },
          8,
        );
      B.torus(0.21, 0.022, '#e7b45a', {
        x: W.x + side * (W.w / 2 + 0.21),
        y: W.y - 0.42,
        z: BACK + 0.2,
        rx: Math.PI / 2,
        sz: 0.5,
      });
      B.ball(
        0.07,
        C.rod,
        { x: W.x + side * (W.w / 2 + 0.52), y: W.y + W.h / 2 + 0.29, z: BACK + 0.2 },
        8,
      );
    }
    B.cylinder(
      0.035,
      0.035,
      W.w + 1.0,
      C.rod,
      { x: W.x, y: W.y + W.h / 2 + 0.29, z: BACK + 0.2, rz: Math.PI / 2, shade: 0 },
      8,
    );
    // A tiny succulent on the sill.
    B.cylinder(
      0.085,
      0.065,
      0.11,
      '#f4efe4',
      { x: W.x + 0.82, y: W.y - W.h / 2 - 0.065, z: BACK + 0.17 },
      10,
    );
    B.ball(
      0.075,
      '#7fb56c',
      { x: W.x + 0.82, y: W.y - W.h / 2 + 0.02, z: BACK + 0.17, sy: 1.15 },
      7,
    );
    if (snap.rain) {
      const random = rng(11),
        points = [];
      for (let i = 0; i < 40; i++) {
        const x = (random() - 0.5) * W.w,
          y = (random() - 0.5) * W.h;
        points.push(x, y, 0, x - 0.04, y - 0.12, 0);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const rain = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: '#dcebf8', transparent: true, opacity: 0.75 }),
      );
      rain.position.set(W.x, W.y, BACK + 0.112);
      group.add(rain);
      // Slow, steady drift; each streak wraps inside the window frame. No flicker.
      const start = points.slice();
      animated.push((time) => {
        const p = geometry.attributes.position;
        for (let i = 0; i < 40; i++) {
          const fall = (time * 0.35 + i * 0.137) % 1,
            y =
              ((start[i * 6 + 1] + W.h / 2 - fall * W.h + W.h * 4) % (W.h - 0.12)) - W.h / 2 + 0.12;
          p.setY(i * 2, y);
          p.setY(i * 2 + 1, y - 0.12);
        }
        p.needsUpdate = true;
      });
    }

    /* window light lying across the floor and rug */
    const lightSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(LIGHT_AREA.size, LIGHT_AREA.size),
      new THREE.MeshBasicMaterial({
        map: textures.canvasTexture('light:' + time, 384, 384, (g, w, h) =>
          paintWindowLight(g, w, h, time),
        ),
        transparent: true,
        depthWrite: false,
        opacity: { day: 0.3, dusk: 0.36, night: 0.14 }[time],
        blending: THREE.AdditiveBlending,
      }),
    );
    lightSheet.rotation.x = -Math.PI / 2;
    lightSheet.position.set(
      LIGHT_AREA.x + LIGHT_AREA.size / 2,
      0.045,
      LIGHT_AREA.z + LIGHT_AREA.size / 2,
    );
    lightSheet.renderOrder = 1;
    group.add(lightSheet);

    /* wall clock and two little pictures: part of the house itself */
    B.cylinder(
      0.27,
      0.27,
      0.06,
      '#8a6d4a',
      { x: 3.3, y: 2.7, z: BACK + 0.03, rx: Math.PI / 2, shade: 0 },
      20,
    );
    B.cylinder(
      0.225,
      0.225,
      0.07,
      '#fffdf6',
      { x: 3.3, y: 2.7, z: BACK + 0.032, rx: Math.PI / 2, shade: 0 },
      20,
    );
    B.box(0.025, 0.15, 0.01, '#5e4a38', { x: 3.3, y: 2.76, z: BACK + 0.072, shade: 0 });
    B.box(0.02, 0.19, 0.01, '#5e4a38', { x: 3.36, y: 2.74, z: BACK + 0.072, rz: -1.1, shade: 0 });
    B.ball(0.025, '#c64b3a', { x: 3.3, y: 2.7, z: BACK + 0.075 }, 6);
    [
      [2.1, 2.3, 0.56, 0.7, '#bfe0ee', '#ffe08a'],
      [1.35, 2.12, 0.44, 0.44, '#f6d9c0', '#d9826a'],
    ].forEach(([z, y, w, h, mat, accent]) => {
      B.rbox(0.05, h, w, 0.02, '#a0744c', { x: LEFT + 0.025, y, z, shade: 0 });
      B.box(0.052, h - 0.1, w - 0.1, mat, { x: LEFT + 0.027, y, z, shade: 0 });
      B.ball(0.07, accent, { x: LEFT + 0.05, y: y + 0.04, z: z - 0.04, sx: 0.2 }, 8);
      B.cone(
        0.13,
        0.16,
        '#7fa88a',
        { x: LEFT + 0.05, y: y - h / 2 + 0.13, z: z + 0.06, sx: 0.15 },
        3,
      );
    });

    /* rug and pet bed are always there */
    B.cylinder(
      1,
      1,
      0.035,
      '#c9715a',
      { x: 0.2, y: 0.018, z: 0.78, sx: 2.5, sz: 1.36, shade: 0 },
      40,
    );
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshLambertMaterial({ map: textures.canvasTexture('rug', 640, 348, paintRug) }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.scale.set(2.5, 1.36, 1);
    rug.position.set(0.2, 0.037, 0.78);
    group.add(rug);
    B.torus(0.7, 0.21, C.bed, { x: 2.65, y: 0.2, z: 1.55, rx: Math.PI / 2, shade: 0.28 });
    B.cylinder(0.62, 0.62, 0.2, C.bedPad, { x: 2.65, y: 0.11, z: 1.55, shade: 0 }, 20);
    B.rbox(0.3, 0.05, 0.2, 0.02, '#f4efe4', { x: 2.65, y: 0.3, z: 2.4, rx: -0.9, shade: 0 });
    B.ball(0.03, '#d9826a', { x: 2.65, y: 0.3, z: 2.47 }, 6);

    if (own.sofa)
      B.within({ x: 1.4, z: -2.4 }, (b) => {
        const fabric = '#8eaab8',
          fabricDark = '#7b98a7',
          fabricLight = '#a1bbc7';
        b.rbox(2.84, 0.4, 1.02, 0.14, fabricDark, { y: 0.32 });
        b.rbox(2.62, 0.95, 0.32, 0.15, fabric, { y: 0.84, z: -0.36 });
        for (const side of [-1, 1]) {
          b.rbox(0.36, 0.74, 1.06, 0.17, fabric, { x: side * 1.42, y: 0.5 });
          b.rbox(1.2, 0.2, 0.8, 0.09, fabricLight, {
            x: side * 0.61,
            y: 0.58,
            z: 0.08,
            shade: 0.08,
          });
          b.rbox(1.18, 0.5, 0.2, 0.09, fabricLight, {
            x: side * 0.61,
            y: 0.92,
            z: -0.2,
            rx: -0.14,
            shade: 0.08,
          });
          for (const z of [0.38, -0.38])
            b.cylinder(0.05, 0.035, 0.14, '#6b4a2e', { x: side * 1.3, y: 0.07, z }, 6);
        }
        b.rbox(0.5, 0.46, 0.2, 0.09, '#e7b45a', {
          x: -1.0,
          y: 0.9,
          z: 0.02,
          rz: -0.16,
          rx: -0.3,
          shade: 0.1,
        });
        b.rbox(0.46, 0.42, 0.2, 0.09, '#d9826a', {
          x: 1.02,
          y: 0.88,
          z: 0.02,
          rz: 0.16,
          rx: -0.3,
          shade: 0.1,
        });
      });

    if (own.plant)
      B.within({ x: 3.4, z: -2.45 }, (b) => {
        b.cylinder(0.33, 0.23, 0.48, '#c4704f', { y: 0.24 }, 14);
        b.torus(0.34, 0.045, '#b05f40', { y: 0.48, rx: Math.PI / 2 });
        b.cylinder(0.3, 0.3, 0.03, '#5e4a38', { y: 0.47, shade: 0 }, 12);
        [
          [0, 1.42, 0.05, 0.52, 0],
          [-0.36, 1.1, -0.85, 0.5, 0.2],
          [0.36, 1.12, 0.85, 0.5, -0.2],
          [0.08, 1.7, 0.12, 0.46, 0],
          [-0.5, 0.82, -1.25, 0.4, -0.2],
          [0.5, 0.84, 1.25, 0.4, 0.2],
          [-0.2, 1.3, -0.5, 0.42, 0.5],
          [0.22, 1.36, 0.5, 0.42, -0.5],
          [0, 1.0, 0, 0.44, 0.9],
        ].forEach(([x, y, lean, length, forward], i) => {
          const z = forward * 0.3;
          b.cylinder(
            0.014,
            0.018,
            y - 0.48,
            '#4f7a3e',
            {
              x: x / 2,
              y: (y + 0.48) / 2,
              z: z / 2,
              rz: -lean * 0.36,
              rx: forward * 0.3,
              shade: 0,
            },
            5,
          );
          b.ball(
            1,
            i % 2 ? '#6aa35a' : '#558a49',
            {
              x,
              y,
              z,
              sx: length / 2,
              sy: length / 3.6,
              sz: 0.07,
              rz: Math.PI / 2 - lean,
              rx: forward * 0.8,
              shade: 0.2,
            },
            8,
          );
        });
      });

    if (own.lamp) {
      const at = { x: -0.35, z: -2.55 };
      B.cylinder(0.24, 0.27, 0.06, '#5e4a38', { ...at, y: 0.03 }, 16);
      B.cylinder(0.028, 0.028, 1.72, '#6b5644', { ...at, y: 0.88, shade: 0 }, 6);
      (time === 'day' ? B : G).cylinder(
        0.2,
        0.37,
        0.46,
        time === 'day' ? '#f6dfb4' : '#ffe6ae',
        { ...at, y: 1.9, shade: 0.12 },
        18,
        true,
      );
      B.torus(0.37, 0.014, '#d9b779', { ...at, y: 1.67, rx: Math.PI / 2 });
      B.torus(0.2, 0.012, '#d9b779', { ...at, y: 2.13, rx: Math.PI / 2 });
      if (time !== 'day') {
        const light = new THREE.PointLight(C.lampWarm, night ? 6 : 3, 9, 1.6);
        light.position.set(at.x, 1.8, at.z + 0.5);
        group.add(light);
        sprite(
          textures.radial('lamp', 'rgba(255,224,150,.6)', 'rgba(255,217,138,0)'),
          at.x,
          1.86,
          at.z + 0.2,
          night ? 2.5 : 1.7,
        );
      }
    }

    if (own.tank) {
      const at = { x: -1.3, z: -2.62 };
      B.rbox(1.0, 0.8, 0.52, 0.06, '#a0744c', { ...at, y: 0.4 });
      B.box(0.012, 0.6, 0.01, '#7d5a3a', { ...at, y: 0.4, z: at.z + 0.263, shade: 0 });
      for (const side of [-1, 1])
        B.ball(0.03, '#e7b45a', { x: at.x + side * 0.07, y: 0.48, z: at.z + 0.27 }, 6);
      B.rbox(0.96, 0.06, 0.48, 0.02, '#6fa9bb', { ...at, y: 0.83, shade: 0 });
      B.box(0.86, 0.035, 0.38, '#eadcbd', { ...at, y: 0.875, shade: 0 });
      for (const [x, h, colour] of [
        [-0.28, 0.22, '#5d8a4e'],
        [-0.2, 0.15, '#74a85f'],
        [0.22, 0.28, '#5d8a4e'],
        [0.3, 0.17, '#74a85f'],
      ])
        B.cone(0.04, h, colour, { x: at.x + x, y: 0.89 + h / 2, z: at.z - 0.04, shade: 0 }, 5);
      B.ball(0.07, '#b9a58c', { x: at.x + 0.02, y: 0.91, z: at.z + 0.04, sy: 0.6 }, 6);
      for (const [x, y, r] of [
        [0.34, 1.05, 0.02],
        [0.36, 1.18, 0.026],
        [0.33, 1.3, 0.018],
      ])
        S.ball(r, '#ffffff', { x: at.x + x, y, z: at.z }, 6);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.6, 0.44),
        new THREE.MeshBasicMaterial({
          color: night ? '#7fb6d6' : '#a8e2f2',
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        }),
      );
      glass.position.set(at.x, 1.16, at.z);
      glass.renderOrder = 2;
      group.add(glass);
      B.rbox(0.96, 0.05, 0.48, 0.02, '#6fa9bb', { ...at, y: 1.48, shade: 0 });
      if (night)
        sprite(
          textures.radial('tank', 'rgba(150,225,255,.4)', 'rgba(150,225,255,0)'),
          at.x,
          1.16,
          at.z + 0.24,
          1.5,
        );
      [
        ['#f08c2e', 1.2, 0.3, 0.42, 0],
        ['#ff7f9e', 1.04, 0.26, 0.6, 2],
      ].forEach(([colour, y, reach, speed, offset]) => {
        const f = createBuilder(THREE);
        f.ball(1, colour, { sx: 0.085, sy: 0.055, sz: 0.035 }, 8);
        f.cone(0.05, 0.08, colour, { x: -0.11, rz: -Math.PI / 2, sz: 0.4 }, 4);
        f.ball(0.012, '#1c2136', { x: 0.045, y: 0.012, z: 0.03 }, 4);
        const fish = f.build(materials.glow);
        fish.position.set(at.x + (offset ? 0.12 : -0.1), y, at.z + (offset ? 0.06 : -0.04));
        group.add(fish);
        animated.push((time) => {
          fish.position.x = at.x + Math.sin(time * speed + offset) * reach;
          fish.rotation.y = Math.cos(time * speed + offset) >= 0 ? 0 : Math.PI;
        });
      });
    }

    if (own.frame) {
      const at = { x: -1.3, y: 2.42 };
      B.rbox(0.66, 1.0, 0.06, 0.025, '#8a6d4a', { ...at, z: BACK + 0.03, shade: 0 });
      B.box(0.55, 0.89, 0.062, '#f4ead3', { ...at, z: BACK + 0.032, shade: 0 });
      const texture = snap.frameCard
        ? textures.svg(
            'card:' + hash(snap.frameCard),
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500" width="300" height="500">' +
              snap.frameCard +
              '</svg>',
            300,
            500,
          )
        : textures.canvasTexture('card:none', 150, 250, (g) => {
            g.fillStyle = '#f4ead3';
            g.fillRect(0, 0, 150, 250);
            g.fillStyle = '#8a6d4a';
            g.font = '60px Georgia, serif';
            g.textAlign = 'center';
            g.fillText('?', 75, 145);
          });
      const card = flat(new THREE.PlaneGeometry(0.49, 0.82), texture);
      card.position.set(at.x, at.y, BACK + 0.066);
      group.add(card);
    }

    if (own.shelf)
      B.within({ x: -2.7, z: -2.74 }, (b) => {
        const w = 1.06,
          h = 2.5,
          d = 0.46;
        b.box(w - 0.04, h - 0.04, 0.04, '#7d5a3a', { y: h / 2, z: -d / 2 + 0.02, shade: 0 });
        for (const side of [-1, 1])
          b.rbox(0.07, h, d, 0.025, '#a0744c', { x: side * (w / 2 - 0.035), y: h / 2 });
        b.rbox(w + 0.04, 0.08, d + 0.03, 0.03, '#ad8055', { y: h - 0.04, shade: 0 });
        const random = rng(17),
          colours = ['#c64b3a', '#3f6f93', '#e2b84a', '#5d8a4e', '#9a7aa8', '#e9dcc0', '#d9826a'];
        let k = 0;
        for (let row = 0; row < 4; row++) {
          const y = 0.07 + row * 0.59;
          b.box(w - 0.1, 0.06, d - 0.02, '#a0744c', { y: y - 0.03, shade: 0 });
          let x = -w / 2 + 0.1;
          while (x < w / 2 - 0.17 && k < (snap.books || 18)) {
            const bw = 0.075 + random() * 0.065,
              bh = 0.33 + random() * 0.15,
              lean = random() < 0.14 ? -0.16 : 0;
            b.box(bw, bh, 0.3, colours[k % 7], {
              x: x + bw / 2 + (lean ? 0.03 : 0),
              y: y + bh / 2,
              z: 0.02,
              rz: lean,
              shade: 0.12,
            });
            b.box(bw + 0.002, 0.03, 0.302, '#f4ead3', {
              x: x + bw / 2 + (lean ? 0.03 : 0),
              y: y + bh * 0.72,
              z: 0.02,
              rz: lean,
              shade: 0,
            });
            x += bw + 0.014 + (lean ? 0.05 : 0);
            k++;
          }
        }
      });

    if (own.record) {
      // Sits on top of the bookshelf when there is one, otherwise on a small side table.
      const top = own.shelf ? 2.5 : 0.7,
        at = { x: -2.7, z: -2.74 };
      if (!own.shelf) B.rbox(0.82, 0.7, 0.46, 0.05, '#a0744c', { ...at, y: 0.35 });
      B.rbox(0.78, 0.17, 0.44, 0.04, '#6b4a2e', { ...at, y: top + 0.085 });
      B.cylinder(
        0.17,
        0.17,
        0.02,
        '#1d1d22',
        { x: at.x - 0.1, y: top + 0.18, z: at.z, shade: 0 },
        22,
      );
      B.cylinder(
        0.11,
        0.11,
        0.022,
        '#2b2b33',
        { x: at.x - 0.1, y: top + 0.18, z: at.z, shade: 0 },
        18,
      );
      B.cylinder(
        0.045,
        0.045,
        0.026,
        '#c64b3a',
        { x: at.x - 0.1, y: top + 0.18, z: at.z, shade: 0 },
        10,
      );
      B.box(0.24, 0.02, 0.025, '#d9d3c4', {
        x: at.x + 0.2,
        y: top + 0.21,
        z: at.z + 0.02,
        ry: 0.5,
        shade: 0,
      });
      B.ball(0.03, '#e7b45a', { x: at.x + 0.3, y: top + 0.2, z: at.z - 0.06 }, 6);
      ['♪', '♫'].forEach((note, i) => {
        const base = { x: at.x + 0.14 + i * 0.28, y: top + 0.52 + i * 0.26 };
        const s = sprite(
          textures.glyph(note, night ? '#ffe2a6' : '#8a6d4a'),
          base.x,
          base.y,
          at.z + 0.14,
          0.32 - i * 0.05,
        );
        animated.push((time) => {
          s.position.y = base.y + Math.sin(time * 1.1 + i * 1.6) * 0.07;
          s.position.x = base.x + Math.sin(time * 0.7 + i) * 0.04;
        });
      });
    }

    if (own.kitchen) {
      B.within({ x: LEFT, z: -0.95 }, (b) => {
        const len = 2.0;
        b.rbox(0.7, 0.9, len, 0.05, '#e1d5bd', { x: 0.35, y: 0.45 });
        b.rbox(0.78, 0.09, len + 0.08, 0.035, '#8a6d4a', { x: 0.39, y: 0.945, shade: 0 });
        for (const z of [-0.5, 0.5]) {
          b.rbox(0.02, 0.66, 0.86, 0.01, '#d3c5a8', { x: 0.705, y: 0.45, z, shade: 0 });
          b.ball(0.03, '#8a6d4a', { x: 0.725, y: 0.68, z: z * 0.84 }, 6);
        }
        b.rbox(0.42, 0.62, len, 0.045, '#f1e9da', { x: 0.21, y: 2.4 });
        for (const z of [-0.5, 0.5]) {
          b.rbox(0.02, 0.5, 0.86, 0.01, '#e2d8c3', { x: 0.425, y: 2.4, z, shade: 0 });
          b.ball(0.03, '#8a6d4a', { x: 0.445, y: 2.22, z: z * 0.84 }, 6);
        }
        /* pot, mug and a plate of buns on the worktop */
        b.cylinder(0.21, 0.19, 0.18, '#3d3d45', { x: 0.36, y: 1.08, z: -0.5 }, 16);
        b.cylinder(0.225, 0.225, 0.03, '#2b2b30', { x: 0.36, y: 1.18, z: -0.5, shade: 0 }, 16);
        b.ball(0.03, '#e7b45a', { x: 0.36, y: 1.21, z: -0.5 }, 6);
        b.rbox(0.04, 0.04, 0.16, 0.015, '#2b2b30', { x: 0.36, y: 1.13, z: -0.22, shade: 0 });
        b.cylinder(0.07, 0.06, 0.13, '#ff9fb2', { x: 0.42, y: 1.055, z: 0.12 }, 12);
        b.torus(0.04, 0.012, '#ff9fb2', { x: 0.42, y: 1.055, z: 0.2, ry: Math.PI / 2 });
        b.cylinder(0.17, 0.12, 0.025, '#fffdf6', { x: 0.36, y: 1.0, z: 0.55, shade: 0 }, 16);
        for (const [x, z] of [
          [0.32, 0.5],
          [0.42, 0.56],
          [0.34, 0.62],
        ])
          b.ball(0.06, '#e9b676', { x, y: 1.04, z, sy: 0.7 }, 8);
        /* rail with hanging utensils */
        b.cylinder(
          0.012,
          0.012,
          0.7,
          '#8a6d4a',
          { x: 0.05, y: 1.82, z: 0.4, rx: Math.PI / 2, shade: 0 },
          6,
        );
        [
          [0.16, 0.26, 0.055, '#c9ced6'],
          [0.4, 0.2, 0.045, '#e7b45a'],
          [0.64, 0.28, 0.06, '#c9ced6'],
        ].forEach(([z, drop, r, colour]) => {
          b.box(0.012, drop, 0.012, '#8a6d4a', { x: 0.055, y: 1.82 - drop / 2, z, shade: 0 });
          b.ball(r, colour, { x: 0.055, y: 1.82 - drop - r * 0.7, z, sx: 0.35 }, 8);
        });
      });
      [0, 1, 2].forEach((i) => {
        const base = { x: LEFT + 0.36, z: -1.45 };
        const steam = sprite(
          textures.radial('steam', 'rgba(255,255,255,.8)', 'rgba(255,255,255,0)'),
          base.x,
          1.45 + i * 0.22,
          base.z,
          0.3 + i * 0.09,
          0.5 - i * 0.12,
        );
        animated.push((time) => {
          const rise = (time * 0.16 + i / 3) % 1;
          steam.position.y = 1.3 + rise * 0.75;
          steam.position.x = base.x + Math.sin(time * 0.8 + i * 2) * 0.05;
          steam.scale.setScalar(0.24 + rise * 0.24);
          steam.material.opacity = 0.6 * Math.sin(rise * Math.PI);
        });
      });
    }

    if (own.lights) {
      const colour = new THREE.Color(),
        glowPositions = [],
        glowColours = [];
      bulbs.forEach(([x, y, z], i) => {
        G.ball(0.062, C.bulbs[i % 4], { x, y: y - 0.05, z, sy: 1.25 }, 8);
        B.cylinder(0.022, 0.022, 0.04, '#6b5a48', { x, y: y + 0.015, z, shade: 0 }, 5);
        glowPositions.push(x, y - 0.05, z + 0.03);
        colour.set(C.bulbs[i % 4]);
        glowColours.push(colour.r, colour.g, colour.b);
        const next = bulbs[i + 1];
        if (!next || i === 20) return;
        const dx = next[0] - x,
          dy = next[1] - y,
          dz = next[2] - z,
          length = Math.hypot(dx, dy, dz);
        B.box(0.012, length, 0.012, '#6b5a48', {
          x: x + dx / 2,
          y: y + dy / 2,
          z: z + dz / 2,
          ry: Math.atan2(dx, dz),
          rx: Math.acos(dy / length),
          shade: 0,
        });
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(glowColours, 3));
      const halo = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          map: textures.radial('bulb', 'rgba(255,255,255,.9)', 'rgba(255,255,255,0)'),
          size: time === 'day' ? 0.3 : 0.62,
          vertexColors: true,
          transparent: true,
          opacity: time === 'day' ? 0.55 : 0.9,
          depthWrite: false,
          blending: time === 'day' ? THREE.NormalBlending : THREE.AdditiveBlending,
        }),
      );
      halo.renderOrder = 4;
      group.add(halo);
      if (night) {
        const light = new THREE.PointLight('#ffdcae', 3, 9, 1.5);
        light.position.set(0.4, 3.0, BACK + 1.2);
        group.add(light);
      }
    }

    if (own.shoes) {
      B.rbox(0.95, 0.03, 0.62, 0.012, '#9fb3a0', {
        x: -3.36,
        y: 0.015,
        z: 0.82,
        ry: 0.06,
        shade: 0,
      });
      [
        [-3.44, 0.66, 1.35],
        [-3.34, 0.98, 1.2],
      ].forEach(([x, z, ry]) =>
        B.within({ x, y: 0.03, z, ry }, (b) => {
          b.rbox(0.2, 0.05, 0.46, 0.02, '#f4f1ea', { y: 0.025, shade: 0 });
          b.ball(1, '#c64b3a', { y: 0.085, z: -0.02, sx: 0.1, sy: 0.075, sz: 0.22 }, 10);
          b.ball(1, '#d85a48', { y: 0.14, z: -0.13, sx: 0.085, sy: 0.07, sz: 0.09 }, 8);
          b.ball(1, '#f4f1ea', { y: 0.1, z: 0.17, sx: 0.09, sy: 0.05, sz: 0.06 }, 6);
        }),
      );
    }
    if (own.ball) {
      const at = { x: -1.55, y: 0.2, z: 2.05 };
      B.ball(0.2, '#f2c94a', at, 16);
      B.torus(0.198, 0.016, '#c64b3a', { ...at, rx: Math.PI / 2 + 0.35 });
      B.torus(0.198, 0.016, '#c64b3a', { ...at, rx: Math.PI / 2 - 0.35 });
      S.ball(0.045, '#ffffff', { x: at.x - 0.07, y: at.y + 0.12, z: at.z + 0.12 }, 6);
    }

    /* egg nest: a woven basket with a cushion */
    if (egg) {
      const N = NEST_3D,
        gold = egg.kind === 'gold',
        warmth = Math.max(0, Math.min(1, (egg.warmth || 0) / (egg.need || 100)));
      for (let i = 0; i < 3; i++)
        B.torus(0.4 + i * 0.03, 0.055, i % 2 ? '#b8926a' : '#a8835e', {
          x: N.x,
          y: 0.06 + i * 0.085,
          z: N.z,
          rx: Math.PI / 2,
          shade: 0,
        });
      B.cylinder(0.4, 0.38, 0.2, '#8a6a48', { x: N.x, y: 0.1, z: N.z, shade: 0 }, 14);
      B.cylinder(0.37, 0.37, 0.05, '#f1e2c4', { x: N.x, y: 0.22, z: N.z, shade: 0 }, 14);
      const e = createBuilder(THREE),
        eg = createBuilder(THREE);
      e.shade = 0.14;
      e.ball(1, gold ? '#f6d77a' : '#e8ecf6', { y: 0.27, sx: 0.2, sy: 0.27, sz: 0.2 }, 16);
      eg.torus(0.196, 0.012, gold ? '#fff0b0' : '#9ff0ff', { y: 0.24, rx: Math.PI / 2 });
      eg.torus(0.168, 0.01, gold ? '#fff0b0' : '#9ff0ff', { y: 0.4, rx: Math.PI / 2 });
      const eggGroup = new THREE.Group();
      eggGroup.add(e.build(materials.lit), eg.build(materials.glow));
      eggGroup.position.set(N.x, 0.22, N.z);
      const halo = sprite(
        textures.radial(
          gold ? 'egg-gold' : 'egg',
          gold ? 'rgba(255,240,176,.9)' : 'rgba(159,240,255,.9)',
          'rgba(255,255,255,0)',
        ),
        N.x,
        0.52,
        N.z,
        0.95 + warmth * 0.35,
        0.22 + warmth * 0.4,
      );
      halo.renderOrder = 1;
      group.add(eggGroup);
      nest = eggGroup;
      if (snap.eggs.some((x) => x.warmth >= x.need))
        animated.push((time) => (eggGroup.rotation.z = Math.sin(time * 3) * 0.08));
    }

    /* a few motes of dust drifting in the window light: slow and soft */
    if (!night) {
      const random = rng(31);
      for (let i = 0; i < 7; i++) {
        const base = { x: 0.2 + random() * 2.2, y: 0.6 + random() * 1.8, z: -2.2 + random() * 2.4 };
        const mote = sprite(
          textures.radial('mote', 'rgba(255,248,220,.9)', 'rgba(255,248,220,0)'),
          base.x,
          base.y,
          base.z,
          0.05 + random() * 0.05,
          0.55,
        );
        animated.push((time) => {
          mote.position.y = base.y + Math.sin(time * 0.25 + i) * 0.16;
          mote.position.x = base.x + Math.sin(time * 0.18 + i * 2.1) * 0.12;
        });
      }
    }

    group.add(B.build(materials.lit), G.build(materials.glow));
    if (!S.empty) {
      const haze = S.build(materials.soft);
      haze.renderOrder = 4;
      group.add(haze);
    }
    return group;
  }

  function placeAt(entry, spotId) {
    const p = spotPosition(spotId);
    entry.spot = spotId;
    entry.move = null;
    entry.pet.group.position.set(p.x, p.y, p.z);
    entry.pet.group.rotation.y = p.face;
    entry.pet.hop(0);
  }

  function update(snap) {
    snapshot = snap;
    const key = JSON.stringify([
      ctx.palette(snap.hour).time,
      snap.own,
      !!snap.rain,
      snap.books,
      snap.frameCard ? hash(snap.frameCard) : 0,
      (snap.eggs || []).map((e) => [e.kind, e.warmth, e.need]),
    ]);
    if (key !== roomKey) {
      if (room) {
        scene.remove(room);
        disposeTree(room, shared);
        textures.release('card:');
        textures.release('room:');
      }
      roomKey = key;
      room = buildRoom(snap);
      scene.add(room);
    }
    const live = new Set();
    for (const p of snap.pets || []) {
      live.add(p.id);
      let entry = pets.get(p.id);
      if (!entry || entry.pet.signature !== petSignature(p)) {
        const previous = entry;
        entry = { pet: createPet3D(THREE, p, petShared), spot: null, move: null, held: false };
        scene.add(entry.pet.group);
        if (previous) {
          entry.pet.group.position.copy(previous.pet.group.position);
          entry.pet.group.rotation.y = previous.pet.group.rotation.y;
          entry.spot = previous.spot;
          scene.remove(previous.pet.group);
          previous.pet.dispose();
        }
        pets.set(p.id, entry);
      }
      entry.pet.setExpr(p.expr);
      if (entry.spot !== p.spot && !entry.held) placeAt(entry, p.spot);
    }
    for (const [id, entry] of pets)
      if (!live.has(id)) {
        scene.remove(entry.pet.group);
        entry.pet.dispose();
        pets.delete(id);
      }
    tickAmbient(0);
    requestRender();
  }

  function tickAmbient(dt) {
    clock += dt;
    for (const animate of animated) animate(clock);
    for (const entry of pets.values()) entry.pet.tick(clock);
  }

  const raycaster = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  return {
    scene,
    camera,
    cameraSetup: HOME_CAMERA,
    // Fits the camera to the stage; returns the distance and focus point to orbit around.
    frame(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      return frameHome(width, height);
    },
    update,
    // Per-frame animation. The loop does not call this when motion is reduced.
    tick(dt) {
      tickAmbient(dt);
      for (const entry of pets.values()) {
        const m = entry.move;
        if (!m) continue;
        m.t = Math.min(1, m.t + dt / m.duration);
        const k = ease(m.t),
          g = entry.pet.group;
        g.position.set(
          m.from.x + (m.to.x - m.from.x) * k,
          m.from.y + (m.to.y - m.from.y) * k,
          m.from.z + (m.to.z - m.from.z) * k,
        );
        entry.pet.hop(Math.abs(Math.sin(m.t * Math.PI * m.hops)) * 0.09);
        g.rotation.y = m.t < 0.85 ? m.heading : m.to.face;
        if (m.t >= 1) placeAt(entry, entry.spot);
      }
    },
    // True while something needs full-rate frames (a pet walking or being carried).
    busy() {
      for (const entry of pets.values()) if (entry.move || entry.held) return true;
      return false;
    },
    ambient: () => animated.length > 0 || pets.size > 0,
    movePet(id, spotId, ms) {
      const entry = pets.get(id);
      if (!entry) return;
      entry.held = false;
      entry.pet.setHeld(false);
      const to = spotPosition(spotId),
        g = entry.pet.group;
      entry.spot = spotId;
      if (reducedMotion || !ms) {
        placeAt(entry, spotId);
        requestRender();
        return;
      }
      const from = { x: g.position.x, y: g.position.y, z: g.position.z };
      const length = Math.hypot(to.x - from.x, to.z - from.z);
      entry.move = {
        from,
        to,
        t: 0,
        duration: ms / 1000,
        hops: Math.max(1, Math.round(length * 1.4)),
        heading: Math.max(-1.1, Math.min(1.1, Math.atan2(to.x - from.x, to.z - from.z))),
      };
      requestRender();
    },
    setExpr(id, expr) {
      const entry = pets.get(id);
      if (!entry) return;
      entry.pet.setExpr(expr);
      requestRender();
    },
    // Carries a pet over the floor under the pointer (ndc: x,y in [-1,1]).
    dragPet(id, ndc) {
      const entry = pets.get(id);
      if (!entry) return;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(floor, hit)) return;
      const p = clampToFloor(hit.x, hit.z);
      entry.move = null;
      entry.held = true;
      entry.pet.setHeld(true);
      entry.pet.group.position.set(p.x, 0, p.z);
      entry.pet.group.rotation.y = 0;
      requestRender();
    },
    petPosition(id) {
      const entry = pets.get(id);
      return entry ? { x: entry.pet.group.position.x, z: entry.pet.group.position.z } : null;
    },
    pick(ndc) {
      raycaster.setFromCamera(ndc, camera);
      let best = null,
        bestDistance = Infinity;
      const test = (object, id) => {
        const hits = raycaster.intersectObject(object, true).filter((h) => !h.object.isSprite);
        if (hits.length && hits[0].distance < bestDistance) {
          bestDistance = hits[0].distance;
          best = id;
        }
      };
      for (const [id, entry] of pets) test(entry.pet.group, 'pet:' + id);
      if (nest) test(nest, 'nest');
      return best;
    },
    // World positions the DOM overlay follows: each pet's feet and the egg nest.
    anchors() {
      const list = [];
      for (const [id, entry] of pets) {
        const g = entry.pet.group.position;
        list.push({
          id: 'pet:' + id,
          x: g.x,
          y: g.y + (entry.held ? 0.42 : 0),
          z: g.z,
          size: PET_BOX,
          // The part of the box the pet actually fills, so buttons of neighbours never overlap.
          width: 124 * entry.pet.scale,
          height: 176 * entry.pet.scale,
        });
      }
      if (nest) list.push({ id: 'nest', x: NEST_3D.x, y: 0, z: NEST_3D.z, size: 1.0 });
      return list;
    },
    // What is on stage right now, for the diagnostics the browser tests read.
    describe: () => ({
      time: snapshot ? ctx.palette(snapshot.hour).time : null,
      animated: animated.length,
      // Main pet first, then housemates: the same order as the buttons on stage.
      pets: ((snapshot && snapshot.pets) || [])
        .filter((p) => pets.has(p.id))
        .map(({ id }) => {
          const entry = pets.get(id);
          return {
            id,
            spot: entry.spot,
            expr: entry.pet.expr,
            held: entry.held,
            moving: !!entry.move,
          };
        }),
    }),
    dispose() {
      for (const entry of pets.values()) entry.pet.dispose();
      pets.clear();
      if (room) disposeTree(room, shared);
      for (const material of shared) material.dispose();
      materials.ramp.dispose();
      // Sprites share one built-in quad; hand it back too so nothing of ours stays on the GPU.
      new THREE.Sprite().geometry.dispose();
      textures.dispose();
      room = null;
      snapshot = null;
    },
  };
}

export { createScene };
