// 毛孩茶室 in 3D: a warm little café with a counter, a big four-pane window, bunting and
// three floor cushions. Colours follow the 2D café (js/art/pet-scenes.mjs).
import { createOuting } from './outing.mjs';
import {
  ROOM,
  LAMPS,
  FLOOR_SIZE,
  BACK_SIZE,
  SIDE_SIZE,
  paintCafeFloor,
  paintCafeBack,
  paintCafeSide,
  paintSign,
  paintMenu,
} from './cafe-paint.mjs';

const CAMERA = {
  fov: 35,
  target: [-0.1, 1.45, 0.3],
  distance: 13,
  azimuth: 7,
  azimuthRange: 12,
  polar: 73,
  polarMin: 66,
  polarMax: 80,
  needWidth: 12.4,
  needHeight: 6.9,
};
const WINDOW = { x: 3.5, y: 2.25, w: 3.4, h: 2.2 };
const CUSHIONS = [
  [-2, '#e7b45a'],
  [0, '#d9826a'],
  [2.9, '#a9c3b0'],
];
const FLAGS = ['#ff9fb2', '#ffcf6b', '#9ff0ff', '#c9f29b'];

function build(env) {
  const { THREE, B, G, S, group, animated, textures, pal, time, night } = env;
  const { back: BACK, left: LEFT, width: W, depth: D, height: H, sideDepth } = ROOM;
  const painted = (name, size, paint) =>
    textures.canvasTexture('place:cafe:' + name + ':' + time, size[0], size[1], (g, w, h) =>
      paint(g, w, h, { time }),
    );

  /* island and shell */
  const grass = night ? '#5f8f7c' : time === 'dusk' ? '#a9c489' : '#9fd08a';
  B.rbox(W + 2.6, 1.5, D + 2.4, 0.7, night ? '#6b5a58' : '#b08a64', {
    x: 0,
    y: -1.22,
    z: 0.4,
    shade: 0.4,
  });
  B.rbox(W + 3.0, 0.5, D + 2.8, 0.24, grass, { x: 0, y: -0.58, z: 0.4, shade: 0.1 });
  B.rbox(W + 0.5, 0.34, D + 0.5, 0.08, '#a98560', {
    x: -0.15,
    y: -0.19,
    z: BACK + D / 2 - 0.15,
    shade: 0.25,
  });
  const floor = env.flat(
    new THREE.PlaneGeometry(W, D),
    painted('floor', FLOOR_SIZE, paintCafeFloor),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, BACK + D / 2);
  const backWall = env.flat(
    new THREE.PlaneGeometry(W, H),
    painted('back', BACK_SIZE, paintCafeBack),
  );
  backWall.position.set(0, H / 2, BACK);
  const sideWall = env.flat(
    new THREE.PlaneGeometry(sideDepth, H),
    painted('side', SIDE_SIZE, paintCafeSide),
  );
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(LEFT, H / 2, BACK + sideDepth / 2);
  group.add(floor, backWall, sideWall);
  const outer = night ? '#8f86a6' : time === 'dusk' ? '#dcc3a6' : '#e0cfb0',
    cap = night ? '#a49ab6' : '#f3e7d0';
  B.box(W + 0.3, H + 0.02, 0.22, outer, { x: -0.15, y: H / 2, z: BACK - 0.112, shade: 0 });
  B.box(0.22, H + 0.02, sideDepth, outer, {
    x: LEFT - 0.112,
    y: H / 2,
    z: BACK + sideDepth / 2,
    shade: 0,
  });
  B.rbox(W + 0.42, 0.1, 0.34, 0.04, cap, { x: -0.15, y: H + 0.04, z: BACK - 0.1, shade: 0 });
  B.rbox(0.34, 0.1, sideDepth + 0.12, 0.04, cap, {
    x: LEFT - 0.1,
    y: H + 0.04,
    z: BACK + sideDepth / 2 + 0.05,
    shade: 0,
  });
  // The side wall stops at a doorway: a post and a welcome mat mark the entrance.
  B.rbox(0.26, H + 0.1, 0.26, 0.05, '#8a6040', {
    x: LEFT - 0.05,
    y: H / 2,
    z: BACK + sideDepth + 0.05,
    shade: 0.1,
  });
  B.rbox(1.3, 0.03, 0.9, 0.012, '#9fb3a0', { x: LEFT + 0.9, y: 0.015, z: 1.7, shade: 0 });

  /* sign */
  B.rbox(3.3, 1.05, 0.12, 0.06, '#5d3f2a', { x: -3.9, y: 3.07, z: BACK + 0.06, shade: 0.1 });
  const sign = env.flat(
    new THREE.PlaneGeometry(3.1, 0.88),
    textures.canvasTexture('place:cafe:sign', 620, 176, paintSign),
    { transparent: true },
  );
  sign.position.set(-3.9, 3.07, BACK + 0.125);
  group.add(sign);

  /* big four-pane window with a view that follows the time of day */
  const Wn = WINDOW;
  B.rbox(Wn.w + 0.34, Wn.h + 0.34, 0.1, 0.04, '#b8916a', {
    x: Wn.x,
    y: Wn.y,
    z: BACK + 0.04,
    shade: 0,
  });
  B.box(Wn.w + 0.14, Wn.h + 0.14, 0.11, '#fbf6ea', { x: Wn.x, y: Wn.y, z: BACK + 0.05, shade: 0 });
  const view = env.flat(new THREE.PlaneGeometry(Wn.w, Wn.h), textures.windowView(pal));
  view.position.set(Wn.x, Wn.y, BACK + 0.108);
  group.add(view);
  B.box(0.07, Wn.h, 0.03, '#fbf6ea', { x: Wn.x, y: Wn.y, z: BACK + 0.125, shade: 0 });
  B.box(Wn.w, 0.07, 0.03, '#fbf6ea', { x: Wn.x, y: Wn.y, z: BACK + 0.125, shade: 0 });
  B.rbox(Wn.w + 0.6, 0.1, 0.3, 0.04, '#b8916a', {
    x: Wn.x,
    y: Wn.y - Wn.h / 2 - 0.19,
    z: BACK + 0.15,
  });
  for (const [dx, leaf] of [
    [-1.3, '#7fb56c'],
    [1.25, '#6aa35a'],
  ]) {
    B.cylinder(
      0.11,
      0.08,
      0.15,
      '#f4efe4',
      { x: Wn.x + dx, y: Wn.y - Wn.h / 2 - 0.065, z: BACK + 0.2 },
      10,
    );
    B.ball(0.12, leaf, { x: Wn.x + dx, y: Wn.y - Wn.h / 2 + 0.08, z: BACK + 0.2, sy: 1.2 }, 7);
  }

  /* bunting across the top right */
  const pennant = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pennant.push([0.7 + t * 5.2, 3.95 - Math.sin(t * Math.PI) * 0.28]);
  }
  pennant.forEach(([x, y], i) => {
    const next = pennant[i + 1];
    if (next) {
      const dx = next[0] - x,
        dy = next[1] - y;
      B.box(Math.hypot(dx, dy), 0.014, 0.014, '#6b5a48', {
        x: x + dx / 2,
        y: y + dy / 2,
        z: BACK + 0.07,
        rz: Math.atan2(dy, dx),
        shade: 0,
      });
    }
    if (i > 0 && i < 10)
      B.cone(
        0.17,
        0.3,
        FLAGS[i % 4],
        { x, y: y - 0.17, z: BACK + 0.07, rz: Math.PI, sz: 0.08, shade: 0 },
        3,
      );
  });

  /* counter with cups, cake and doughnuts */
  B.within({ x: -3.7, z: BACK + 0.6 }, (b) => {
    b.rbox(3.9, 1.1, 1.05, 0.07, '#8a6040', { y: 0.55 });
    for (let i = -2; i <= 2; i++)
      b.box(0.02, 0.86, 0.01, '#6f4c31', { x: i * 0.7, y: 0.55, z: 0.531, shade: 0 });
    b.rbox(4.1, 0.12, 1.2, 0.05, '#5d3f2a', { y: 1.16, shade: 0 });
    /* espresso machine */
    b.rbox(0.8, 0.62, 0.6, 0.08, '#c64b3a', { x: -1.45, y: 1.53 });
    b.rbox(0.82, 0.08, 0.62, 0.03, '#d9d3c4', { x: -1.45, y: 1.86, shade: 0 });
    b.cylinder(0.05, 0.05, 0.18, '#d9d3c4', { x: -1.6, y: 1.46, z: 0.32, shade: 0 }, 8);
    b.cylinder(0.05, 0.05, 0.18, '#d9d3c4', { x: -1.3, y: 1.46, z: 0.32, shade: 0 }, 8);
    b.cylinder(0.1, 0.08, 0.13, '#f4ead3', { x: -1.45, y: 1.29, z: 0.34 }, 10);
    /* cup and saucer */
    b.cylinder(0.2, 0.16, 0.03, '#fffdf6', { x: -0.55, y: 1.235, z: 0.2, shade: 0 }, 14);
    b.cylinder(0.12, 0.09, 0.15, '#f4ead3', { x: -0.55, y: 1.32, z: 0.2 }, 12);
    b.cylinder(0.105, 0.105, 0.01, '#6b4429', { x: -0.55, y: 1.39, z: 0.2, shade: 0 }, 12);
    b.torus(0.055, 0.016, '#f4ead3', { x: -0.4, y: 1.32, z: 0.2 });
    /* slice of cake on a plate */
    b.cylinder(0.24, 0.2, 0.03, '#fffdf6', { x: 0.15, y: 1.235, z: 0.15, shade: 0 }, 14);
    b.add(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10, 1, false, 0, 0.9), '#c64b3a', {
      x: 0.05,
      y: 1.35,
      z: 0.05,
      ry: 0.5,
    });
    b.add(new THREE.CylinderGeometry(0.265, 0.265, 0.05, 10, 1, false, 0, 0.9), '#fff4e2', {
      x: 0.05,
      y: 1.47,
      z: 0.05,
      ry: 0.5,
      shade: 0,
    });
    b.ball(0.045, '#e23d4f', { x: 0.17, y: 1.52, z: 0.2 }, 6);
    /* doughnuts under a glass dome */
    b.cylinder(0.36, 0.36, 0.03, '#fffdf6', { x: 1.0, y: 1.5, z: 0.1, shade: 0 }, 16);
    b.cylinder(0.05, 0.12, 0.27, '#fffdf6', { x: 1.0, y: 1.36, z: 0.1 }, 10);
    for (const [dx, dz, icing] of [
      [-0.14, 0.02, '#ff9fb2'],
      [0.14, -0.02, '#f4ead3'],
      [0, 0.16, '#8a5a33'],
    ]) {
      b.torus(0.085, 0.05, '#e7b45a', {
        x: 1.0 + dx,
        y: 1.57,
        z: 0.1 + dz,
        rx: Math.PI / 2,
        shade: 0,
      });
      b.torus(0.085, 0.036, icing, { x: 1.0 + dx, y: 1.6, z: 0.1 + dz, rx: Math.PI / 2, shade: 0 });
    }
    /* cookie jar */
    b.cylinder(0.14, 0.14, 0.3, '#dba862', { x: 1.6, y: 1.37, z: 0.25 }, 12);
    b.cylinder(0.16, 0.16, 0.05, '#8a6040', { x: 1.6, y: 1.55, z: 0.25, shade: 0 }, 12);
    b.ball(0.04, '#5d3f2a', { x: 1.6, y: 1.6, z: 0.25 }, 6);
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: '#dff4fb',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  dome.position.set(-2.7, 1.515, BACK + 0.7);
  dome.renderOrder = 2;
  group.add(dome);
  [0, 1].forEach((i) => {
    const base = { x: -4.25, z: BACK + 0.9 };
    const steam = env.sprite(
      textures.radial('steam', 'rgba(255,255,255,.8)', 'rgba(255,255,255,0)'),
      base.x,
      1.6 + i * 0.2,
      base.z,
      0.24,
      0.45 - i * 0.15,
    );
    animated.push((t) => {
      const rise = (t * 0.17 + i / 2) % 1;
      steam.position.y = 1.5 + rise * 0.55;
      steam.position.x = base.x + Math.sin(t * 0.8 + i * 2) * 0.04;
      steam.scale.setScalar(0.18 + rise * 0.2);
      steam.material.opacity = 0.55 * Math.sin(rise * Math.PI);
    });
  });

  /* wall shelf with cups and jars */
  B.rbox(3.5, 0.08, 0.34, 0.03, '#8a6040', { x: -3.75, y: 1.93, z: BACK + 0.17 });
  [
    [-5.2, '#f4ead3', 0.11, 0.16],
    [-4.85, '#ff9fb2', 0.1, 0.14],
    [-4.5, '#9ff0ff', 0.1, 0.14],
    [-3.9, '#dba862', 0.13, 0.3],
    [-3.5, '#c9f29b', 0.1, 0.14],
    [-3.0, '#6b4429', 0.13, 0.3],
    [-2.5, '#f4ead3', 0.11, 0.16],
  ].forEach(([x, colour, r, h]) => {
    B.cylinder(r, r * 0.85, h, colour, { x, y: 1.97 + h / 2, z: BACK + 0.2 }, 10);
    if (h > 0.2)
      B.cylinder(
        r * 1.05,
        r * 1.05,
        0.04,
        '#8a6040',
        { x, y: 1.99 + h, z: BACK + 0.2, shade: 0 },
        10,
      );
  });

  /* chalkboard menu on the side wall */
  B.rbox(0.06, 1.5, 1.3, 0.025, '#8a6040', { x: LEFT + 0.03, y: 2.35, z: BACK + 1.6, shade: 0 });
  const menu = env.flat(
    new THREE.PlaneGeometry(1.14, 1.34),
    textures.canvasTexture('place:cafe:menu', 200, 236, paintMenu),
  );
  menu.rotation.y = Math.PI / 2;
  menu.position.set(LEFT + 0.065, 2.35, BACK + 1.6);
  group.add(menu);

  /* three floor cushions */
  CUSHIONS.forEach(([x, colour]) => {
    B.cylinder(0.86, 0.9, 0.2, colour, { x, y: 0.1, z: 1.6, shade: 0.3 }, 22);
    B.torus(0.84, 0.1, colour, { x, y: 0.13, z: 1.6, rx: Math.PI / 2, shade: 0.2 });
    B.cylinder(0.68, 0.68, 0.03, '#fbf3e3', { x, y: 0.205, z: 1.6, shade: 0 }, 20);
    B.ball(0.05, colour, { x, y: 0.22, z: 1.6, sy: 0.5 }, 6);
  });

  /* small round table with two stools, and a plant in the corner */
  B.cylinder(0.72, 0.72, 0.07, '#8a6040', { x: 4.5, y: 0.94, z: -1.2, shade: 0 }, 20);
  B.cylinder(0.07, 0.07, 0.9, '#5d3f2a', { x: 4.5, y: 0.45, z: -1.2 }, 8);
  B.cylinder(0.34, 0.38, 0.06, '#5d3f2a', { x: 4.5, y: 0.03, z: -1.2 }, 12);
  B.cylinder(0.11, 0.09, 0.13, '#ff9fb2', { x: 4.3, y: 1.04, z: -1.1 }, 10);
  B.cylinder(0.11, 0.09, 0.13, '#9ff0ff', { x: 4.72, y: 1.04, z: -1.28 }, 10);
  B.cylinder(0.05, 0.07, 0.2, '#f4efe4', { x: 4.52, y: 1.08, z: -1.42 }, 8);
  (night ? B : G).ball(0.07, '#ffcf6b', { x: 4.52, y: 1.26, z: -1.42 }, 6);
  for (const x of [3.5, 5.4]) {
    B.cylinder(0.28, 0.28, 0.1, '#d9826a', { x, y: 0.6, z: -0.75, shade: 0 }, 14);
    B.cylinder(0.05, 0.05, 0.56, '#5d3f2a', { x, y: 0.28, z: -0.75 }, 6);
    B.cylinder(0.2, 0.22, 0.04, '#5d3f2a', { x, y: 0.02, z: -0.75 }, 10);
  }
  B.within({ x: 5.45, z: -2.15 }, (b) => {
    b.cylinder(0.32, 0.24, 0.5, '#f4efe4', { y: 0.25 }, 12);
    b.torus(0.33, 0.04, '#d9d3c4', { y: 0.5, rx: Math.PI / 2 });
    [
      [0, 1.5, 0.05, 0.5],
      [-0.34, 1.15, -0.85, 0.46],
      [0.3, 1.2, 0.8, 0.46],
      [-0.2, 1.75, -0.3, 0.4],
      [0.18, 0.95, 0.5, 0.4],
    ].forEach(([x, y, lean, length], i) => {
      b.cylinder(
        0.014,
        0.018,
        y - 0.5,
        '#4f7a3e',
        { x: x / 2, y: (y + 0.5) / 2, rz: -lean * 0.36, shade: 0 },
        5,
      );
      b.ball(
        1,
        i % 2 ? '#6aa35a' : '#558a49',
        { x, y, sx: length / 2, sy: length / 3.6, sz: 0.07, rz: Math.PI / 2 - lean, shade: 0.2 },
        8,
      );
    });
  });

  /* wall-arm lamps: lit softly at dusk and night */
  const lit = time !== 'day';
  LAMPS.forEach((x, i) => {
    B.box(0.05, 0.05, 0.85, '#5d3f2a', { x, y: 3.95, z: BACK + 0.42, shade: 0 });
    B.cylinder(0.012, 0.012, 0.42, '#5d3f2a', { x, y: 3.74, z: BACK + 0.8, shade: 0 }, 5);
    (lit ? G : B).cylinder(
      0.12,
      0.3,
      0.3,
      lit ? '#ffe6ae' : '#f2d7a6',
      { x, y: 3.4, z: BACK + 0.8, shade: 0.1 },
      14,
      true,
    );
    B.torus(0.3, 0.014, '#d9b779', { x, y: 3.25, z: BACK + 0.8, rx: Math.PI / 2 });
    if (lit) {
      G.ball(0.08, '#fff3c4', { x, y: 3.32, z: BACK + 0.8 }, 8);
      env.sprite(
        textures.radial('lamp', 'rgba(255,224,150,.6)', 'rgba(255,217,138,0)'),
        x,
        3.34,
        BACK + 0.9,
        night ? 2.1 : 1.4,
      );
      const light = new THREE.PointLight('#ffd98a', night ? 7 : 3, 10, 1.6);
      light.position.set(x + (i ? 1.6 : -1.8), 3.2, BACK + 1.6);
      group.add(light);
    }
  });
}

function createScene(ctx) {
  return createOuting(ctx, { camera: CAMERA, lineZ: 1.6, standY: 0.21, build });
}

export { createScene };
