// Shared stage for the outing scenes (park, café): the pet walking in, a friend arriving,
// a found treasure, and the ball game. Each place supplies its own scenery.
//
// The outing itself (who is met, what is found, scores, rewards) is decided by
// js/pet/outings.mjs exactly as in 2D. This module only draws what that code describes.
import { createBuilder, createMaterials, disposeTree } from '../props.mjs';
import { createTextureCache } from '../textures.mjs';
import { createPet3D, petSignature } from '../pet3d.mjs';
import { PET_BOX, orbitPosition } from '../layout.mjs';
import { paintBackdrop } from './home-paint.mjs';

// The 2D stage places things by left %; the same numbers map onto the walking line.
const lineX = (percent) => (percent - 50) / 10;
const ENTER_X = -6.6,
  NPC_ENTER_X = 7.2,
  NPC_STOP = 79;
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t) * (1 - t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const now = () => performance.now();

// Little models for the treasures a pet can bring back.
function buildFound(THREE, name, materials) {
  const b = createBuilder(THREE),
    g = createBuilder(THREE);
  b.shade = 0.12;
  switch (name) {
    case '楓葉':
      for (let i = 0; i < 5; i++) {
        const a = ((i - 2) / 5) * 2.2;
        b.cone(
          0.07,
          0.22,
          i % 2 ? '#e0703a' : '#d9543a',
          { x: Math.sin(a) * 0.09, y: 0.12 + Math.cos(a) * 0.09, rz: -a, sz: 0.25 },
          4,
        );
      }
      b.cylinder(0.012, 0.012, 0.14, '#8a5a33', { y: 0.02, rz: 0.2 }, 4);
      break;
    case '橡果':
      b.ball(1, '#b9824a', { y: 0.1, sx: 0.1, sy: 0.12, sz: 0.1 }, 10);
      b.add(new THREE.SphereGeometry(0.108, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#6b4a2e', {
        y: 0.13,
      });
      b.cylinder(0.012, 0.012, 0.06, '#6b4a2e', { y: 0.26 }, 4);
      break;
    case '四葉草':
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        b.ball(
          1,
          i % 2 ? '#6fb35c' : '#5d9f4e',
          { x: Math.cos(a) * 0.075, y: 0.2 + Math.sin(a) * 0.075, sx: 0.075, sy: 0.075, sz: 0.02 },
          8,
        );
      }
      b.cylinder(0.012, 0.012, 0.16, '#4f7a3e', { y: 0.07, rz: 0.15 }, 4);
      break;
    case '曲奇碎':
      b.cylinder(0.13, 0.13, 0.045, '#dba862', { y: 0.06, rx: 0.5 }, 12);
      for (const [x, y] of [
        [-0.04, 0.09],
        [0.05, 0.07],
        [0.0, 0.03],
      ])
        b.ball(0.022, '#5d3f2a', { x, y, z: 0.03 }, 5);
      break;
    case '咖啡豆':
      for (const [x, r] of [
        [-0.06, 0.3],
        [0.07, -0.4],
      ]) {
        b.ball(1, '#6b4429', { x, y: 0.08, sx: 0.06, sy: 0.085, sz: 0.05, rz: r }, 8);
        b.box(0.008, 0.13, 0.01, '#3d2616', { x, y: 0.08, z: 0.05, rz: r });
      }
      break;
    case 'egg':
      b.ball(1, '#e8ecf6', { y: 0.16, sx: 0.12, sy: 0.16, sz: 0.12 }, 12);
      g.torus(0.118, 0.008, '#9ff0ff', { y: 0.14, rx: Math.PI / 2 });
      break;
    default:
      g.add(new THREE.OctahedronGeometry(0.1), '#ffd27a', { y: 0.14, sy: 1.3 });
  }
  const group = new THREE.Group();
  if (!b.empty) group.add(b.build(materials.lit));
  if (!g.empty) group.add(g.build(materials.glow));
  return group;
}

function createOuting(ctx, place) {
  const { THREE, reducedMotion } = ctx;
  const requestRender = ctx.requestRender || (() => {});
  const setup = place.camera;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(setup.fov, 8 / 5, 0.5, 140);
  camera.position.set(...orbitPosition(setup));
  camera.lookAt(...setup.target);
  const materials = createMaterials(THREE);
  const shared = new Set([materials.lit, materials.glow, materials.soft, materials.leaf]);
  const textures = createTextureCache(THREE, requestRender);
  const petShared = { materials, textures, reducedMotion };
  const hemisphere = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  // Everything in the place hangs off `world`, so sliding it sideways pans the view
  // without disturbing the orbit controls.
  const world = new THREE.Group();
  scene.add(hemisphere, sun, world);

  const lineZ = place.lineZ ?? 1.5,
    standY = place.standY ?? 0;
  let scenery = null,
    sceneryKey = '',
    animated = [],
    snapshot = null,
    clock = 0,
    pet = null,
    npc = null,
    npcId = null,
    found = null,
    foundKey = '',
    run = null,
    throwing = null;

  const ball = (() => {
    const b = createBuilder(THREE);
    b.ball(0.17, '#f2c94a', {}, 12);
    b.torus(0.168, 0.014, '#c64b3a', { rx: Math.PI / 2 + 0.35 });
    b.torus(0.168, 0.014, '#c64b3a', { rx: Math.PI / 2 - 0.35 });
    const mesh = b.build(materials.lit);
    mesh.visible = false;
    world.add(mesh);
    return mesh;
  })();

  function rebuild(snap) {
    const pal = ctx.palette(snap.hour);
    if (scenery) {
      world.remove(scenery);
      disposeTree(scenery, shared);
      textures.release('place:');
    }
    const group = new THREE.Group();
    const B = createBuilder(THREE),
      G = createBuilder(THREE),
      S = createBuilder(THREE);
    B.shade = 0.16;
    animated = [];
    scene.background = textures.canvasTexture('backdrop:' + pal.time, 640, 400, (g, w, h) =>
      paintBackdrop(g, w, h, pal.time),
    );
    hemisphere.color.set(pal.hemiSky);
    hemisphere.groundColor.set(pal.hemiGround);
    hemisphere.intensity = pal.hemi;
    sun.color.set(pal.sun);
    sun.intensity = pal.sunPower;
    sun.position.set(...pal.sunFrom);
    place.build({
      THREE,
      B,
      G,
      S,
      group,
      animated,
      textures,
      materials,
      pal,
      time: pal.time,
      night: pal.night,
      // A fresh builder for parts that move on their own (clouds, hanging lamps).
      builder: () => createBuilder(THREE),
      flat: (geometry, texture, options = {}) =>
        new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, ...options })),
      sprite(texture, x, y, z, size, opacity = 1) {
        const s = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }),
        );
        s.position.set(x, y, z);
        s.scale.setScalar(size);
        s.renderOrder = 4;
        group.add(s);
        return s;
      },
    });
    group.add(B.build(materials.lit));
    if (B.leaves) group.add(B.leaves.build(materials));
    if (!G.empty) group.add(G.build(materials.glow));
    if (!S.empty) {
      const haze = S.build(materials.soft);
      haze.renderOrder = 3;
      group.add(haze);
    }
    scenery = group;
    world.add(group);
  }

  function ensurePet(current, options) {
    if (current && current.signature === petSignature(options)) return current;
    if (current) {
      world.remove(current.group);
      current.dispose();
    }
    const created = createPet3D(THREE, options, petShared);
    world.add(created.group);
    return created;
  }

  const stopX = () => lineX(snapshot && snapshot.npc ? 30 : 50);

  // Places everyone for this instant. All motion is a pure function of the timeline the
  // outing code handed over, so a scene that mounts late simply joins in mid-walk.
  function layout() {
    if (!snapshot || !pet) return;
    const t = now();
    let x = stopX(),
      y = standY,
      hop = 0,
      heading = snapshot.npc ? 0.35 : 0,
      pan = 0;
    const walk = snapshot.walk;
    if (walk && t < walk.start + walk.ms) {
      const p = clamp01((t - walk.start) / walk.ms),
        k = easeOut(p);
      x = ENTER_X + (stopX() - ENTER_X) * k;
      y = standY * clamp01((p - 0.82) / 0.18);
      hop = Math.abs(Math.sin(p * Math.PI * 7)) * 0.1 * (1 - p * 0.5);
      heading = p < 0.9 ? 1.05 : heading;
      pan = (1 - ease(p)) * 2.2;
    }
    if (run) {
      const p = clamp01((t - run.start) / run.ms),
        k = ease(p);
      x = run.from + (run.to - run.from) * k;
      if (p < 1) {
        hop = Math.abs(Math.sin(p * Math.PI * 3)) * 0.1;
        heading = run.to > run.from ? 1.05 : -1.05;
      } else if (run.home) run = null;
    }
    pet.group.position.set(x, y, lineZ);
    pet.group.rotation.y = heading;
    pet.hop(hop);
    world.position.x = pan;

    if (npc) {
      const enter = snapshot.npcIn;
      let nx = lineX(NPC_STOP),
        nhop = 0,
        visible = !!enter;
      if (enter && t < enter.start + enter.ms) {
        const p = clamp01((t - enter.start) / enter.ms);
        nx = NPC_ENTER_X + (lineX(NPC_STOP) - NPC_ENTER_X) * easeOut(p);
        nhop = Math.abs(Math.sin(p * Math.PI * 5)) * 0.09 * (1 - p * 0.5);
        npc.group.rotation.y = p < 0.9 ? -1.05 : -0.35;
        npc.group.position.y = standY * clamp01((p - 0.82) / 0.18);
      } else {
        npc.group.rotation.y = -0.35;
        npc.group.position.y = standY;
      }
      npc.group.visible = visible;
      npc.group.position.x = nx;
      npc.group.position.z = lineZ;
      npc.hop(nhop);
    }

    if (found) {
      const since = snapshot.arrivedAt ? (t - snapshot.arrivedAt) / 520 : 1;
      const p = reducedMotion ? 1 : clamp01(since);
      // A gentle pop: grows a little past full size, then settles.
      const scale = p < 1 ? 1 + 0.18 * Math.sin(p * Math.PI) - (1 - p) * (1 - p) : 1;
      found.visible = !!snapshot.arrivedAt;
      found.scale.setScalar(Math.max(0.001, scale) * 1.7);
      found.position.set(stopX() - 0.95, standY + 0.02, lineZ + 0.45);
    }

    if (throwing) {
      const p = clamp01((t - throwing.start) / throwing.ms);
      ball.visible = true;
      ball.position.set(
        throwing.from + (throwing.to - throwing.from) * p,
        0.17 + Math.sin(p * Math.PI) * 2.3,
        lineZ + 0.35,
      );
      ball.rotation.z = -p * 9;
      if (p >= 1 && t > throwing.start + throwing.ms + 900) throwing = null;
    } else ball.visible = false;
  }

  function moving() {
    if (!snapshot) return false;
    const t = now(),
      active = (span) => span && t < span.start + span.ms;
    return !!(
      active(snapshot.walk) ||
      active(snapshot.npcIn) ||
      (run && t < run.start + run.ms + 50) ||
      throwing ||
      (found && snapshot.arrivedAt && t < snapshot.arrivedAt + 560)
    );
  }

  function update(snap) {
    const key = ctx.palette(snap.hour).time;
    if (key !== sceneryKey) {
      sceneryKey = key;
      rebuild(snap);
    }
    const first = !snapshot;
    snapshot = snap;
    pet = ensurePet(pet, snap.pet);
    pet.setExpr(snap.pet.expr);
    if (snap.npc) {
      if (npcId !== snap.npc.id) {
        if (npc) {
          world.remove(npc.group);
          npc.dispose();
        }
        npc = ensurePet(null, snap.npc);
        npcId = snap.npc.id;
      }
      npc.setExpr(snap.npc.expr || 'happy');
    } else if (npc) {
      world.remove(npc.group);
      npc.dispose();
      npc = null;
      npcId = null;
    }
    const wanted = snap.egg ? 'egg' : snap.found || '';
    if (wanted !== foundKey) {
      if (found) {
        world.remove(found);
        disposeTree(found, shared);
        found = null;
      }
      foundKey = wanted;
      if (wanted) {
        found = buildFound(THREE, wanted, materials);
        world.add(found);
      }
    }
    if (first) {
      run = null;
      throwing = null;
    }
    for (const animate of animated) animate(clock);
    layout();
    requestRender();
  }

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
      if (pet) pet.tick(clock);
      if (npc) npc.tick(clock);
      layout();
    },
    busy: moving,
    ambient: () => true,
    setExpr(id, expr) {
      const target = id === 'npc' ? npc : pet;
      if (!target) return;
      target.setExpr(expr);
      requestRender();
    },
    // Ball game: the 2D code decides distance and timing; these only draw it.
    throwBall(toPercent, ms) {
      if (reducedMotion) return;
      throwing = { from: lineX(18), to: lineX(toPercent) + 0.5, start: now(), ms };
      requestRender();
    },
    runTo(percent, ms, home = false) {
      if (!pet) return;
      const to = home ? stopX() : lineX(percent);
      if (reducedMotion || !ms) {
        run = home ? null : { from: to, to, start: now() - 1, ms: 1, home };
        layout();
      } else run = { from: pet.group.position.x, to, start: now(), ms, home };
      requestRender();
    },
    // Ends a throw at once (the game was paused or the outing cancelled).
    stopBall() {
      throwing = null;
      run = null;
      layout();
      requestRender();
    },
    pick: () => null,
    anchors() {
      const list = [];
      if (pet) {
        const g = pet.group.position;
        list.push({
          selector: '.on-stage',
          kind: 'pet',
          fx: '.fx',
          x: g.x + world.position.x,
          y: g.y,
          z: g.z,
          size: PET_BOX,
          width: 124 * pet.scale,
          height: 176 * pet.scale,
        });
      }
      if (npc && npc.group.visible) {
        const g = npc.group.position;
        list.push({
          selector: '.npc-on',
          kind: 'box',
          lift: 0.05,
          x: g.x + world.position.x,
          y: g.y,
          z: g.z,
          size: PET_BOX,
        });
      }
      return list;
    },
    describe: () => ({
      time: sceneryKey,
      animated: animated.length,
      pet: pet ? { expr: pet.expr, x: +pet.group.position.x.toFixed(2) } : null,
      npc: npc
        ? { id: npcId, visible: npc.group.visible, x: +npc.group.position.x.toFixed(2) }
        : null,
      found: found && found.visible ? foundKey : null,
      // In play from the moment it is thrown, not only once a frame has shown it.
      ball: ball.visible || !!throwing,
      moving: moving(),
    }),
    dispose() {
      if (pet) pet.dispose();
      if (npc) npc.dispose();
      if (found) disposeTree(found, shared);
      if (scenery) disposeTree(scenery, shared);
      ball.geometry.dispose();
      for (const material of shared) material.dispose();
      materials.ramp.dispose();
      if (materials.leaf.map) materials.leaf.map.dispose();
      new THREE.Sprite().geometry.dispose();
      textures.dispose();
      pet = npc = found = scenery = snapshot = null;
    },
  };
}

export { createOuting, lineX };
