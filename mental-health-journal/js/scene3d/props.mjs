// Low-poly building blocks. Everything static is merged into a couple of vertex-coloured
// meshes so a whole room costs a handful of draw calls instead of one per plank and book.

function createBuilder(THREE) {
  const positions = [],
    normals = [],
    colours = [];
  const colour = new THREE.Color(),
    vertex = new THREE.Vector3(),
    normalMatrix = new THREE.Matrix3(),
    matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    euler = new THREE.Euler(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3();
  let base = null;
  const tint = new THREE.Color();

  function add(geometry, hex, at = {}) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    // `flat` gives faceted, chiselled shading (rocks); the default keeps smooth normals.
    if (at.flat) source.computeVertexNormals();
    euler.set(at.rx || 0, at.ry || 0, at.rz || 0, 'YXZ');
    quaternion.setFromEuler(euler);
    position.set(at.x || 0, at.y || 0, at.z || 0);
    scale.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
    matrix.compose(position, quaternion, scale);
    if (base) matrix.premultiply(base);
    normalMatrix.getNormalMatrix(matrix);
    colour.set(hex);
    const p = source.attributes.position,
      n = source.attributes.normal;
    // A soft painted gradient: each part is a touch darker towards its base, which grounds
    // it on the floor without any real-time shadows.
    const depth = at.shade ?? api.shade;
    let low = Infinity,
      high = -Infinity;
    const first = positions.length;
    for (let i = 0; i < p.count; i++) {
      vertex.fromBufferAttribute(p, i).applyMatrix4(matrix);
      positions.push(vertex.x, vertex.y, vertex.z);
      low = Math.min(low, vertex.y);
      high = Math.max(high, vertex.y);
      vertex.fromBufferAttribute(n, i).applyMatrix3(normalMatrix).normalize();
      normals.push(vertex.x, vertex.y, vertex.z);
    }
    const span = Math.max(1e-6, high - low);
    for (let i = 0; i < p.count; i++) {
      const t = (positions[first + i * 3 + 1] - low) / span;
      tint.copy(colour).multiplyScalar(1 - depth * (1 - t) * (1 - t));
      colours.push(tint.r, tint.g, tint.b);
    }
    if (source !== geometry) source.dispose();
    geometry.dispose();
    return api;
  }

  const api = {
    shade: 0,
    add,
    // How finely rounded boxes are bevelled (2 = smooth close-ups, 1 = distant scenery).
    bevel: 2,
    rbox: (w, h, d, r, hex, at) => add(roundedBox(THREE, w, h, d, r, api.bevel), hex, at),
    // Everything added inside `fn` is first placed in this local frame.
    within(at, fn) {
      const previous = base;
      euler.set(at.rx || 0, at.ry || 0, at.rz || 0, 'YXZ');
      const local = new THREE.Matrix4().compose(
        new THREE.Vector3(at.x || 0, at.y || 0, at.z || 0),
        new THREE.Quaternion().setFromEuler(euler),
        new THREE.Vector3(at.sx ?? at.s ?? 1, at.sy ?? at.s ?? 1, at.sz ?? at.s ?? 1),
      );
      base = previous ? previous.clone().multiply(local) : local;
      fn(api);
      base = previous;
      return api;
    },
    box: (w, h, d, hex, at) => add(new THREE.BoxGeometry(w, h, d), hex, at),
    ball: (r, hex, at, detail = 12) =>
      add(
        new THREE.SphereGeometry(
          r,
          detail,
          // Tiny things (petals, pebbles) get by with very few rings.
          detail < 6 ? Math.max(3, detail - 1) : Math.max(6, Math.round(detail * 0.7)),
        ),
        hex,
        at,
      ),
    cylinder: (rTop, rBottom, h, hex, at, sides = 14, open = false) =>
      add(new THREE.CylinderGeometry(rTop, rBottom, h, sides, 1, open), hex, at),
    cone: (r, h, hex, at, sides = 10) => add(new THREE.ConeGeometry(r, h, sides), hex, at),
    torus: (r, tube, hex, at, arc = Math.PI * 2) =>
      add(new THREE.TorusGeometry(r, tube, 8, 20, arc), hex, at),
    get triangles() {
      return positions.length / 9;
    },
    get empty() {
      return !positions.length;
    },
    build(material) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
      return new THREE.Mesh(geometry, material);
    },
  };
  return api;
}

// A box with soft, rounded edges and smooth normals (so it also takes an outline cleanly).
function roundedBox(THREE, w, h, d, radius, steps = 2) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const n = steps * 2 + 1;
  const geometry = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const p = geometry.attributes.position,
    normal = geometry.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const place = (u, size) => {
    const i = Math.round((u + 0.5) * n);
    if (i < steps) return -size + r * (1 - Math.cos(((i / steps) * Math.PI) / 2));
    if (i > n - steps) return size - r * (1 - Math.cos((((n - i) / steps) * Math.PI) / 2));
    return -size + r + ((i - steps) / (n - steps * 2)) * (size - r) * 2;
  };
  const v = new THREE.Vector3(),
    inner = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(place(p.getX(i), half[0]), place(p.getY(i), half[1]), place(p.getZ(i), half[2]));
    inner.set(
      Math.max(-half[0] + r, Math.min(half[0] - r, v.x)),
      Math.max(-half[1] + r, Math.min(half[1] - r, v.y)),
      Math.max(-half[2] + r, Math.min(half[2] - r, v.z)),
    );
    v.sub(inner);
    if (v.lengthSq() < 1e-12) v.set(normal.getX(i), normal.getY(i), normal.getZ(i));
    v.normalize();
    normal.setXYZ(i, v.x, v.y, v.z);
    p.setXYZ(i, inner.x + v.x * r, inner.y + v.y * r, inner.z + v.z * r);
  }
  return geometry;
}

// A clump of leaves: a faceted blob whose surface is nudged in and out so no two look alike
// and none is a perfect ball. `seed` picks the shape.
function leafClump(THREE, radius, seed, detail = 1) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    // The same corner appears in several faces; hashing its position keeps them together.
    const wobble = 1 + 0.17 * Math.sin((x * 12.9 + y * 78.2 + z * 37.7) / radius + seed * 3.1);
    p.setXYZ(i, x * wobble, y * wobble * 0.92, z * wobble);
  }
  return geometry;
}

// Bends a ball into another soft shape. `shape(direction, out)` says where the surface lies
// in each direction; the normals are measured from the shape itself, so it stays smooth.
function sculpt(THREE, wide, high, shape) {
  const geometry = new THREE.SphereGeometry(1, wide, high);
  const p = geometry.attributes.position,
    n = geometry.attributes.normal;
  const d = new THREE.Vector3(),
    t1 = new THREE.Vector3(),
    t2 = new THREE.Vector3(),
    here = new THREE.Vector3(),
    a = new THREE.Vector3(),
    c = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0),
    east = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    t1.crossVectors(d, Math.abs(d.y) > 0.95 ? east : up).normalize();
    t2.crossVectors(d, t1);
    shape(d, here);
    shape(a.copy(d).addScaledVector(t1, 0.05).normalize(), a);
    shape(c.copy(d).addScaledVector(t2, 0.05).normalize(), c);
    a.sub(here);
    c.sub(here);
    t1.crossVectors(a, c).normalize();
    if (t1.dot(d) < 0) t1.negate();
    p.setXYZ(i, here.x, here.y, here.z);
    n.setXYZ(i, t1.x, t1.y, t1.z);
  }
  return geometry;
}

const fraction = (v) => v - Math.floor(v);
const chance = (seed, n) => fraction(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453);

// Where the puffs of a broadleaf crown sit, and how far the crown reaches in a direction.
// `seed` picks the arrangement, so every tree is a little different.
function crownPuffs(seed) {
  const puffs = [[0.2 * Math.sin(seed * 2.3), 1, 0.2 * Math.cos(seed * 1.7), 0.26]];
  const count = 4 + (seed % 2);
  for (let i = 0; i < count; i++) {
    const turn = seed * 1.9 + (i / count) * Math.PI * 2 + (chance(seed, i) - 0.5) * 0.9,
      rise = 0.05 + chance(seed, i + 9) * 0.55,
      flat = Math.cos(rise);
    puffs.push([
      Math.cos(turn) * flat,
      Math.sin(rise),
      Math.sin(turn) * flat,
      0.18 + chance(seed, i + 21) * 0.2,
    ]);
  }
  return puffs;
}
function crownReach(puffs, d) {
  let r = 0.78;
  for (const [x, y, z, size] of puffs)
    r += size * Math.exp(5.5 * (d.x * x + d.y * y + d.z * z - 1));
  return r;
}
// The underside of a crown is flatter than the top.
const UNDERSIDE = 0.55;

// The solid heart of a broadleaf crown: one soft mass that swells into uneven puffs, like a
// small cloud. The leaves are laid over it.
function puffCrown(THREE, radius, seed, wide = 10, high = 6) {
  const puffs = crownPuffs(seed);
  return sculpt(THREE, wide, high, (d, out) => {
    const r = crownReach(puffs, d) * radius;
    out.set(d.x * r, d.y * r * (d.y < 0 ? UNDERSIDE : 1), d.z * r);
  });
}

// How wide a slim tree is at each height: a teardrop, fullest a third of the way up.
const slimGirth = (t, turn, seed) =>
  Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.8) *
  (1 + 0.07 * Math.sin(4 * turn + 9 * t + seed));

function slimCrown(THREE, width, height, seed, wide = 9, high = 7) {
  return sculpt(THREE, wide, high, (d, out) => {
    const t = Math.min(1, Math.max(0, d.y * 0.5 + 0.5)),
      turn = Math.atan2(d.z, d.x),
      girth = width * slimGirth(t, turn, seed);
    out.set(Math.cos(turn) * girth, t * height, Math.sin(turn) * girth);
  });
}

// Leaves are drawn as many small cards, each showing a spray of leaves, laid over the crown.
// They turn mostly towards where the scenes are viewed from, so the crown gets a soft, leafy
// edge instead of a hard ball's outline, and they are lit as part of the crown they sit on.
const VIEW = [0, 0.57, 0.82];
// Where the daylight comes from, to decide which leaves take the lighter colour.
const SUN = [-0.47, 0.7, 0.54];

function leafTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.translate(64, 64);
  g.fillStyle = '#f4f4f4';
  g.beginPath();
  g.arc(0, 0, 30, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 7; i++) {
    const long = 48 + (i % 3) * 6,
      broad = 22 + (i % 2) * 5;
    g.save();
    g.rotate((i / 7) * Math.PI * 2 + (i % 2) * 0.25);
    g.fillStyle = ['#ffffff', '#ececec', '#f7f7f7'][i % 3];
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(long * 0.55, -broad, long, 0);
    g.quadraticCurveTo(long * 0.55, broad, 0, 0);
    g.fill();
    g.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLeaves(THREE) {
  const positions = [],
    normals = [],
    colours = [],
    uvs = [],
    index = [];
  const colour = new THREE.Color(),
    face = new THREE.Vector3(),
    right = new THREE.Vector3(),
    up = new THREE.Vector3(),
    lit = new THREE.Vector3(),
    sky = new THREE.Vector3(0, 1, 0);
  return {
    get empty() {
      return !index.length;
    },
    // One card at (x, y, z). `out` is the way the crown's surface faces there.
    card(x, y, z, size, out, roll, hex, dim = 1) {
      face.set(out.x * 0.55 + VIEW[0], out.y * 0.55 + VIEW[1], out.z * 0.55 + VIEW[2]).normalize();
      right.crossVectors(sky, face).normalize();
      up.crossVectors(face, right);
      lit.set(out.x, out.y + 0.35, out.z).normalize();
      colour.set(hex).multiplyScalar(dim);
      const cos = (Math.cos(roll) * size) / 2,
        sin = (Math.sin(roll) * size) / 2,
        first = positions.length / 3;
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const a = u * cos - v * sin,
          c = u * sin + v * cos;
        positions.push(
          x + right.x * a + up.x * c,
          y + right.y * a + up.y * c,
          z + right.z * a + up.z * c,
        );
        normals.push(lit.x, lit.y, lit.z);
        colours.push(colour.r, colour.g, colour.b);
        uvs.push((u + 1) / 2, (v + 1) / 2);
      }
      index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    },
    build(materials) {
      if (!materials.leaf.map) {
        materials.leaf.map = leafTexture(THREE);
        materials.leaf.needsUpdate = true;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(index);
      return new THREE.Mesh(geometry, materials.leaf);
    },
  };
}

// A tree with leaves. Three kinds, each with its own outline:
//   'round'   – a trunk that forks into a cloud-shaped crown
//   'blossom' – lower and wider, sprinkled with flowers (`dots`)
//   'slim'    – a tall teardrop, like a cypress
// Leaves on the side the sun reaches take the lighter colour. The leaf cards are collected on
// the builder (`b.leaves`); whoever builds the mesh adds them with `b.leaves.build(materials)`.
function leafyTree(THREE, b, at, size, [light, dark], trunk, seed = 0, kind = 'round', dots) {
  const { x, y, z } = at,
    s = size,
    leaves = (b.leaves ||= createLeaves(THREE)),
    d = new THREE.Vector3();
  const leaf = (px, py, pz, span, n) => {
    const sun = d.x * SUN[0] + d.y * SUN[1] + d.z * SUN[2] + (chance(seed, n + 60) - 0.5) * 0.45;
    leaves.card(
      px,
      py,
      pz,
      span * (0.8 + chance(seed, n + 80) * 0.45),
      d,
      chance(seed, n + 100) * Math.PI * 2,
      sun > 0.28 ? light : dark,
      // Leaves low on the crown, away from the sun, sit in its shade.
      Math.min(1, 0.8 + Math.max(0, sun + 0.5) * 0.22) - chance(seed, n + 120) * 0.05,
    );
  };
  if (kind === 'slim') {
    const width = 0.34 * s,
      height = 1.9 * s;
    b.cylinder(0.05 * s, 0.08 * s, 0.4 * s, trunk, { x, y: y + 0.2 * s, z, shade: 0 }, 5);
    b.add(slimCrown(THREE, width, height, seed), dark, { x, y: y + 0.28 * s, z, shade: 0.3 });
    for (let i = 0; i < 30; i++) {
      const t = 0.08 + (i / 30) * 0.86,
        turn = i * 2.39996 + seed,
        girth = width * slimGirth(t, turn, seed) * 1.02;
      d.set(Math.cos(turn), 0.45, Math.sin(turn)).normalize();
      leaf(
        x + Math.cos(turn) * girth,
        y + 0.28 * s + t * height,
        z + Math.sin(turn) * girth,
        0.3 * s,
        i,
      );
    }
    return;
  }
  const wide = kind === 'blossom',
    spread = wide ? 1.22 : 1,
    tall = wide ? 0.8 : 0.96,
    lift = wide ? 1.08 : 1.24,
    r = 0.66 * s;
  // The trunk leans a touch and forks into two boughs that vanish into the leaves.
  const lean = (chance(seed, 3) - 0.5) * 0.16;
  b.cylinder(0.07 * s, 0.12 * s, 0.86 * s, trunk, { x, y: y + 0.43 * s, z, rz: lean, shade: 0 }, 6);
  for (const side of [-1, 1])
    b.cylinder(
      0.035 * s,
      0.055 * s,
      0.5 * s,
      trunk,
      {
        x: x + side * 0.16 * s * spread,
        y: y + (lift - 0.44) * s,
        z: z + side * 0.05 * s,
        rz: -side * (0.6 + chance(seed, 5 + side) * 0.25),
        shade: 0,
      },
      4,
    );
  b.add(puffCrown(THREE, r * 0.9, seed), dark, {
    x,
    y: y + lift * s,
    z,
    sx: spread,
    sy: tall,
    sz: spread,
    shade: 0.3,
  });
  const puffs = crownPuffs(seed),
    count = wide ? 50 : 46;
  for (let i = 0; i < count; i++) {
    // Spread evenly over the crown, from the top to a little way under its widest part.
    const v = 1 - ((i + 0.5) / count) * 1.5,
      ring = Math.sqrt(1 - v * v),
      turn = i * 2.39996 + seed;
    d.set(Math.cos(turn) * ring, v, Math.sin(turn) * ring);
    const reach = crownReach(puffs, d) * r;
    const flower = dots && i % 5 === 2;
    if (flower) {
      leaves.card(
        x + d.x * reach * spread * 1.04,
        y + lift * s + d.y * reach * (v < 0 ? UNDERSIDE : 1) * tall * 1.04,
        z + d.z * reach * spread * 1.04,
        0.26 * s,
        d,
        i,
        dots,
      );
      continue;
    }
    leaf(
      x + d.x * reach * spread,
      y + lift * s + d.y * reach * (v < 0 ? UNDERSIDE : 1) * tall,
      z + d.z * reach * spread,
      0.52 * s,
      i,
    );
  }
}

// The materials almost everything shares: cel-shaded, unlit (things that glow) and haze.
function createMaterials(THREE) {
  // Four soft tones instead of a smooth falloff gives the hand-painted, toy-like look.
  const ramp = new THREE.DataTexture(
    new Uint8Array([
      150, 150, 150, 255, 190, 190, 190, 255, 232, 232, 232, 255, 255, 255, 255, 255,
    ]),
    4,
    1,
  );
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return {
    ramp,
    lit: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }),
    // Leaf cards: the same cel shading, cut to the shape of the leaves painted on them.
    leaf: new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: ramp,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    soft: new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  };
}

// Sticker-style outline: the same shape pushed out along its normals and drawn inside-out.
function outlineOf(THREE, mesh, thickness, colour) {
  const geometry = mesh.geometry.clone();
  geometry.deleteAttribute('color');
  const p = geometry.attributes.position,
    n = geometry.attributes.normal;
  for (let i = 0; i < p.count; i++)
    p.setXYZ(
      i,
      p.getX(i) + n.getX(i) * thickness,
      p.getY(i) + n.getY(i) * thickness,
      p.getZ(i) + n.getZ(i) * thickness,
    );
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: colour, side: THREE.BackSide }),
  );
}

// Blob shadow: a soft dark disc instead of real-time shadow maps.
function blobShadow(THREE, texture, radius) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

// Frees every geometry and material under `root`, except materials in `keep` (the shared
// ones a scene reuses). Textures are owned by the texture cache.
function disposeTree(root, keep = new Set()) {
  root.traverse((node) => {
    // Sprites share one built-in geometry; only their material is ours.
    if (node.geometry && !node.isSprite) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) if (material && !keep.has(material)) material.dispose();
  });
}

export {
  createBuilder,
  createMaterials,
  roundedBox,
  leafClump,
  leafyTree,
  outlineOf,
  blobShadow,
  disposeTree,
};
