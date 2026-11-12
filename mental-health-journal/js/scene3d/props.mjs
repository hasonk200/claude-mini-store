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
    rbox: (w, h, d, r, hex, at) => add(roundedBox(THREE, w, h, d, r), hex, at),
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
      add(new THREE.SphereGeometry(r, detail, Math.max(6, Math.round(detail * 0.7))), hex, at),
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

export { createBuilder, createMaterials, roundedBox, outlineOf, blobShadow, disposeTree };
