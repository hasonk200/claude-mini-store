// The 3D pet. Proportions, colours and accessories follow js/art/pet-character.mjs: parts are
// authored on the SVG's 200-unit grid (x right, y up from the feet, z towards the viewer)
// and the whole body is scaled down to room units.
import { PAL, STAGES } from '../art/pet-character.mjs';
import { createBuilder, outlineOf, blobShadow } from './props.mjs';
import { PET_UNIT } from './layout.mjs';

const HAT_ACCESSORIES = ['beanie', 'bow', 'flower'];
const BLINKING = ['normal', 'ask'];

function createPet3D(THREE, options, shared) {
  const { materials, textures, reducedMotion } = shared;
  const c = PAL[options.color] || PAL.milktea;
  const species = options.sp || 'cat';
  const stage = options.stage || 0;
  const cloud = species === 'cloud';
  const head = cloud ? { x: 0, y: 84, z: 0, r: 50 } : { x: 0, y: 96, z: 4, r: 48 };
  const visorShift = species === 'dog' ? -8 : cloud ? 10 : 0;
  const lit = createBuilder(THREE),
    glow = createBuilder(THREE),
    tailLit = createBuilder(THREE),
    tailGlow = createBuilder(THREE),
    shine = createBuilder(THREE);
  lit.shade = 0.1;
  const ellipsoid = (b, hex, x, y, z, sx, sy, sz, extra = {}, detail = 14) =>
    b.ball(1, hex, { x, y, z, sx, sy, sz, ...extra }, detail);
  const onHead = (dx, dy, lift = 0) => {
    const dz = Math.sqrt(Math.max(0, head.r * head.r - dx * dx - dy * dy));
    const k = (head.r + lift) / head.r;
    return { x: head.x + dx * k, y: head.y + dy * k, z: head.z + dz * k };
  };

  const tail = new THREE.Group();
  if (!cloud) {
    ellipsoid(lit, c.body, 0, 38, 0, 46, 38, 40, {}, 18);
    ellipsoid(lit, c.belly, 0, 30, 20, 28, 22, 24);
    for (const side of [-1, 1]) {
      ellipsoid(lit, c.shade, side * 22, 6, 24, 14, 7.5, 17, {}, 10);
      ellipsoid(lit, c.body, side * 18, species === 'dog' ? 18 : 20, 40, 11, 9, 9, {}, 10);
    }
    lit.ball(head.r, c.body, head, 20);
  }
  if (species === 'cat') {
    for (const side of [-1, 1]) {
      lit.cone(20, 42, c.body, { x: side * 28, y: 138, z: 2, rz: -side * 0.22, sz: 0.55 }, 8);
      lit.cone(11, 26, c.accent, { x: side * 28, y: 136, z: 9, rz: -side * 0.22, sz: 0.4 }, 8);
    }
    lit.cylinder(1.7, 1.7, 22, c.shade, { x: 0, y: 155, z: 4 }, 6);
    glow.ball(6.5, c.glow, { x: 0, y: 169, z: 4 }, 10);
    const curve = new THREE.CatmullRomCurve3(
      [
        [0, 0, 0],
        [26, 2, -8],
        [34, 22, -12],
        [34, 44, -10],
        [40, 58, -8],
      ].map((p) => new THREE.Vector3(...p)),
    );
    tailLit.add(new THREE.TubeGeometry(curve, 14, 6.5, 8), c.body);
    tailLit.ball(6.5, c.body, { x: 0, y: 0, z: 0 }, 8);
    tailGlow.ball(8, c.glow, { x: 40, y: 58, z: -8 }, 10);
    tail.position.set(34, 30, -22);
  } else if (species === 'dog') {
    for (const side of [-1, 1])
      ellipsoid(lit, c.shade, side * 31, 141, 0, 15, 20, 9, { rz: -side * 0.3 }, 10);
    lit.cylinder(1.7, 1.7, 12, c.shade, { x: 0, y: 150, z: 4 }, 6);
    ellipsoid(glow, c.glow, 0, 158, 4, 10, 7, 10, {}, 10);
    ellipsoid(lit, c.belly, 0, 66, 40, 24, 15, 14);
    ellipsoid(lit, '#3a2a20', 0, 72, 53, 7, 5, 5, {}, 8);
    tailLit.torus(14, 4.5, c.body, { x: 6, y: 12, z: 0 });
    tailGlow.ball(4, c.glow, { x: 6, y: 26, z: 0 }, 8);
    tail.position.set(40, 46, -28);
  } else {
    for (const side of [-1, 1]) {
      lit.ball(30, c.body, { x: side * 42, y: 54, z: 0 }, 14);
      lit.ball(28, c.body, { x: side * 22, y: 34, z: 8 }, 14);
      lit.ball(18, c.body, { x: side * 24, y: 118, z: 0 }, 12);
      glow.cone(6, 20, c.glow, { x: side * 12, y: 148, z: 0, rz: -side * 0.2 }, 6);
    }
    lit.ball(24, c.body, { x: 0, y: 28, z: 14 }, 12);
    lit.ball(34, c.body, { x: 0, y: 50, z: -18 }, 12);
    lit.ball(head.r, c.body, head, 20);
    glow.ball(6, c.glow, { x: -72, y: 98, z: 10 }, 4);
    glow.ball(4, c.glow, { x: 70, y: 120, z: 10 }, 4);
  }
  for (const side of [-1, 1]) {
    const cheek = onHead(side * 37, cloud ? -21 : -19, 0.5);
    ellipsoid(lit, c.accent, cheek.x, cheek.y, cheek.z, 7, 4.5, 2.4, { ry: side * 0.95 }, 8);
  }

  // Accessories sit a little lower on the floating cloud, as they do in the SVG.
  const drop = cloud ? -10 : 0;
  const hat = HAT_ACCESSORIES.includes(options.acc);
  const collar = { x: 0, y: 56 + drop, z: 2, rx: Math.PI / 2 };
  switch (options.acc) {
    case 'scarf':
      lit.torus(40, 7.5, '#c64b3a', collar);
      lit.rbox(13, 26, 5, 2.0, '#b13c2d', { x: 18, y: 38 + drop, z: 42, rz: -0.1 });
      break;
    case 'bell':
      lit.torus(40, 3.5, '#c64b3a', collar);
      lit.ball(8, '#f2c94a', { x: 0, y: 48 + drop, z: 45 }, 10);
      break;
    case 'bow': {
      const at = onHead(19, 42, 5);
      lit.cone(9, 16, '#ff7f9e', { ...at, x: at.x - 9, rz: -Math.PI / 2 }, 8);
      lit.cone(9, 16, '#ff7f9e', { ...at, x: at.x + 9, rz: Math.PI / 2 }, 8);
      lit.ball(5, '#e85c80', at, 8);
      break;
    }
    case 'flower':
      lit.within({ ...onHead(28, 40, 3), rx: -0.6, ry: 0.5 }, (b) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          b.ball(7, '#fff4c8', { x: Math.sin(a) * 7, y: Math.cos(a) * 7, z: 0, sz: 0.4 }, 8);
        }
        b.ball(4.5, '#f2b71e', { z: 2 }, 8);
      });
      break;
    case 'beanie': {
      const r = head.r + 2.5,
        cut = 0.42 * Math.PI;
      lit.add(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, cut), '#3f6f93', head);
      lit.torus(r * Math.sin(cut), 6, '#2f5675', {
        x: head.x,
        y: head.y + r * Math.cos(cut),
        z: head.z,
        rx: Math.PI / 2,
      });
      lit.ball(9, '#f4ead3', { x: head.x, y: head.y + r + 7, z: head.z }, 10);
      break;
    }
  }
  if (options.trait && stage >= 1) {
    const top = head.y + head.r;
    switch (options.trait) {
      case 'adv':
        lit.rbox(32, 38, 18, 7.2, '#c4704f', { x: 0, y: 46 + drop, z: -46 });
        lit.rbox(22, 10, 5, 2.0, '#a85a3e', { x: 0, y: 44 + drop, z: -57 });
        for (const side of [-1, 1])
          lit.rbox(5, 46, 3, 1.2, '#7a5638', {
            x: side * 20,
            y: 50 + drop,
            z: 35,
            rz: side * 0.22,
          });
        break;
      case 'food':
        if (hat) break;
        lit.cylinder(30, 30, 14, '#fffdf6', { x: 0, y: top - 2, z: head.z });
        for (const [x, y] of [
          [-17, 18],
          [17, 18],
          [0, 26],
        ])
          lit.ball(18, '#fffdf6', { x, y: top + y, z: head.z }, 10);
        break;
      case 'photo':
        lit.torus(40, 1.6, '#2b2a28', { ...collar, rx: Math.PI / 2 - 0.25 });
        lit.rbox(28, 20, 12, 4.8, '#2b2a28', { x: 0, y: 40 + drop, z: 47 });
        lit.cylinder(6.5, 6.5, 5, '#9ff0ff', { x: 0, y: 40 + drop, z: 55, rx: Math.PI / 2 });
        break;
      case 'talk':
        lit.rbox(38, 24, 5, 2.0, '#fffdf6', { x: 46, y: top + 14, z: 0 });
        lit.cone(5, 9, '#fffdf6', { x: 34, y: top, z: 0, rz: Math.PI }, 4);
        for (const x of [36, 46, 56]) lit.ball(2.8, '#8a8a90', { x, y: top + 14, z: 3 }, 6);
        break;
      case 'social':
        lit.torus(40, 3, '#3f6f93', collar);
        lit.cone(22, 30, '#3f6f93', { x: 0, y: 42 + drop, z: 41, rz: Math.PI, sz: 0.3 }, 3);
        break;
      case 'active': {
        if (hat) break;
        const up = 26;
        lit.torus(Math.sqrt(head.r * head.r - up * up) + 1.5, 4.5, '#c64b3a', {
          x: head.x,
          y: head.y + up,
          z: head.z,
          rx: Math.PI / 2,
        });
        lit.rbox(4, 16, 2, 0.8, '#c64b3a', { x: 44, y: head.y + 16, z: -6, rz: 0.5 });
        lit.rbox(4, 16, 2, 0.8, '#c64b3a', { x: 47, y: head.y + 20, z: -10, rz: 0.9 });
        break;
      }
      case 'cozy':
        if (hat) break;
        lit.within({ x: head.x, y: head.y + 18, z: head.z, rz: -0.3 }, (b) => {
          b.torus(44, 5, '#fff4c8', { rx: Math.PI / 2 });
          b.cone(42, 56, '#5b6aa8', { y: 30 }, 12);
          b.ball(7, '#fff4c8', { y: 60 }, 8);
        });
        break;
    }
  }

  // A soft highlight on the crown, like light catching a vinyl toy.
  const gleam = onHead(-20, 27, 0.6);
  ellipsoid(
    shine,
    '#ffffff',
    gleam.x,
    gleam.y,
    gleam.z,
    11,
    6.5,
    2,
    { ry: -0.5, rx: -0.6, rz: 0.5 },
    8,
  );

  const body = new THREE.Group();
  const inner = new THREE.Group();
  const outlineColour = new THREE.Color(c.shade).multiplyScalar(0.5);
  const owned = [];
  const skin = lit.build(materials.lit);
  const skinOutline = outlineOf(THREE, skin, 2.4, outlineColour);
  owned.push(skinOutline.material);
  inner.add(skin, skinOutline);
  if (!glow.empty) inner.add(glow.build(materials.glow));
  if (!tailLit.empty) {
    const tailSkin = tailLit.build(materials.lit);
    const tailOutline = outlineOf(THREE, tailSkin, 2.4, outlineColour);
    owned.push(tailOutline.material);
    tail.add(tailSkin, tailOutline, tailGlow.build(materials.glow));
    inner.add(tail);
  }
  const shineMesh = shine.build(materials.soft);
  shineMesh.renderOrder = 2;
  inner.add(shineMesh);

  // Visor: a patch of sphere hugging the head, textured with the current expression.
  // The SVG visor spans y 76–118 (plus the species shift) around a head centred on y 94/106.
  const top = (cloud ? 106 : 94) - 76 - visorShift,
    bottom = top - 42;
  const thetaStart = Math.acos(top / head.r),
    thetaEnd = Math.acos(bottom / head.r),
    middle = (thetaStart + thetaEnd) / 2,
    half = Math.asin(Math.min(0.98, 36 / (head.r * Math.sin(middle))));
  const faceMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(
      head.r * 1.012,
      14,
      8,
      Math.PI / 2 - half,
      half * 2,
      thetaStart,
      thetaEnd - thetaStart,
    ),
    faceMaterial,
  );
  face.position.set(head.x, head.y, head.z);
  face.renderOrder = 2;
  inner.add(face);

  const sprites = [];
  const sprite = (texture, x, y, z, size, opacity = 1) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }),
    );
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    s.renderOrder = 3;
    inner.add(s);
    sprites.push(s);
    return s;
  };
  const zzz = [
    sprite(textures.glyph('z', c.glow), 54, 152, 12, 26),
    sprite(textures.glyph('z', c.glow), 70, 174, 12, 18),
  ];
  const sparkles = [];
  if (options.shiny) {
    const halo = sprite(
      textures.radial('shiny', 'rgba(255,224,160,.55)', 'rgba(255,170,220,0)'),
      0,
      84,
      -30,
      230,
    );
    halo.renderOrder = 0;
    [
      [26, 70, 14],
      [174, 56, 12],
      [22, 150, 10],
      [180, 140, 14],
      [60, 24, 10],
      [150, 186, 10],
    ].forEach(([x, y, r], i) => {
      const s = sprite(textures.glyph('✦', '#ffd27a'), x - 100, 190 - y, 20, r * 2.2, 0.9);
      s.userData = { y: 190 - y, phase: i * 1.7 };
      sparkles.push(s);
    });
  }

  const scale = PET_UNIT * (STAGES[stage] || STAGES[0]).s;
  body.scale.setScalar(scale);
  body.add(inner);
  const lift = new THREE.Group();
  lift.add(body);
  const group = new THREE.Group();
  const shadow = blobShadow(
    THREE,
    textures.radial('shadow', 'rgba(40,28,18,.5)', 'rgba(40,28,18,0)'),
    (cloud ? 44 : 60) * scale,
  );
  shadow.position.y = 0.012;
  group.add(shadow, lift);

  let expression = '';
  let blinkAt = 2 + Math.random() * 3;
  const phase = Math.random() * 6;
  function showFace(name) {
    faceMaterial.map = textures.face(name, c.glow);
    faceMaterial.needsUpdate = true;
  }
  function setExpr(expr) {
    expression = expr || 'normal';
    showFace(expression);
    for (const z of zzz) z.visible = expression === 'sleep';
  }
  setExpr(options.expr);
  if (cloud) inner.position.y = 6;

  return {
    group,
    species,
    scale,
    signature: petSignature(options),
    get expr() {
      return expression;
    },
    setExpr,
    setHeld(held) {
      lift.position.y = held ? 0.42 : 0;
      lift.rotation.z = held ? 0.1 : 0;
      shadow.material.opacity = held ? 0.35 : 0.55;
    },
    hop(height) {
      lift.position.y = height;
    },
    // Gentle idle life: breathing, an occasional blink, a swaying tail. Never called when
    // the user prefers reduced motion.
    tick(time) {
      if (reducedMotion) return;
      const t = time + phase;
      body.scale.set(scale, scale * (1 + 0.02 * Math.sin(t * 1.8)), scale);
      if (cloud) inner.position.y = 6 + Math.sin(t * 1.2) * 5;
      else if (species === 'cat') tail.rotation.y = Math.sin(t * 2.2) * 0.2;
      else tail.rotation.z = Math.sin(t * (expression === 'happy' ? 7 : 3.5)) * 0.28;
      zzz.forEach((z, i) => {
        if (z.visible) z.position.y = (i ? 174 : 152) + Math.sin(t * 1.4 + i) * 4;
      });
      for (const s of sparkles)
        s.position.y = s.userData.y + Math.sin(t * 0.7 + s.userData.phase) * 7;
      if (BLINKING.includes(expression)) {
        if (time > blinkAt + 0.13) {
          blinkAt = time + 3 + Math.random() * 3;
          showFace(expression);
        } else if (time > blinkAt && faceMaterial.map !== textures.face('blink', c.glow))
          showFace('blink');
      }
    },
    dispose() {
      group.traverse((node) => {
        // Sprites share one built-in geometry; leave it alone.
        if (node.geometry && !node.isSprite) node.geometry.dispose();
      });
      faceMaterial.dispose();
      for (const material of owned) material.dispose();
      shadow.material.dispose();
      for (const s of sprites) s.material.dispose();
    },
  };
}

const petSignature = (o) =>
  [o.sp, o.color, o.stage || 0, o.acc || '', o.shiny ? 1 : 0, o.trait || ''].join('|');

export { createPet3D, petSignature };
