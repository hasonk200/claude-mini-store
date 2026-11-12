// Pieces the town scenes share (the skyline across the lake, the buildings behind the night
// street): rows of simple blocks with steadily lit windows, and a street lamp.
import { rng } from '../../art/math.mjs';

// A row of buildings from `from` to `to` along x. Windows are small squares of light that
// stay lit (nothing blinks). Returns the blocks so a caller can add to them.
function buildingRow(env, options) {
  const { THREE, group } = env;
  const {
    builder,
    from,
    to,
    z,
    depth = 2,
    base = 0,
    widths,
    heights,
    colours,
    seed,
    lit = 0,
    windowSize = 0.2,
    windowTones = ['#ffd27a', '#ffe6a8', '#ffb86b'],
    grid = [0.38, 0.46],
  } = options;
  const random = rng(seed);
  const blocks = [],
    points = [],
    tones = [];
  const tone = new THREE.Color();
  let x = from;
  while (x < to) {
    // The last block is trimmed so the row ends where it was asked to.
    const w = Math.min(widths[0] + random() * (widths[1] - widths[0]), to - x),
      h = heights[0] + random() * (heights[1] - heights[0]),
      back = random() * depth * 0.6;
    builder.box(w, h, depth, colours[Math.floor(random() * colours.length)], {
      x: x + w / 2,
      y: base + h / 2,
      z: z - back,
      shade: 0,
    });
    blocks.push({ x: x + w / 2, w, h, z: z - back });
    if (lit > 0)
      for (let wy = base + h - 0.4; wy > base + 0.5; wy -= grid[1])
        for (let wx = x + 0.3; wx < x + w - 0.25; wx += grid[0]) {
          const on = random() < lit,
            which = Math.floor(random() * windowTones.length),
            dim = 0.55 + random() * 0.45;
          if (!on) continue;
          points.push(wx, wy, z - back + depth / 2 + 0.03);
          tone.set(windowTones[which]).multiplyScalar(dim);
          tones.push(tone.r, tone.g, tone.b);
        }
    x += w + (options.gap ? random() * options.gap : 0);
  }
  if (points.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(tones, 3));
    group.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({ size: windowSize, vertexColors: true, fog: false }),
      ),
    );
  }
  return blocks;
}

// Still stars: points high in the sky. Never animated.
function stars(env, { count, seed, x = [-30, 30], y = [3, 9], z = -48, size = 0.2 }) {
  const { THREE, group } = env;
  const random = rng(seed),
    positions = [];
  for (let i = 0; i < count; i++)
    positions.push(x[0] + random() * (x[1] - x[0]), y[0] + random() * (y[1] - y[0]), z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  group.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: '#ffffff', size, transparent: true, opacity: 0.85 }),
    ),
  );
}

// Clouds that drift very slowly across the sky.
function clouds(env, list, tone) {
  const { THREE, group, animated, materials } = env;
  list.forEach(([x, y, z, s, speed]) => {
    const cloud = new THREE.Group();
    const builder = env.builder();
    builder.ball(1.0, tone, { sy: 0.6 }, 8);
    builder.ball(0.8, tone, { x: 1.0, y: 0.1, sy: 0.6 }, 8);
    builder.ball(0.7, tone, { x: -1.0, y: 0.05, sy: 0.6 }, 8);
    builder.ball(0.75, tone, { x: 0.3, y: 0.45, sy: 0.7 }, 8);
    cloud.add(builder.build(materials.glow));
    cloud.position.set(x, y, z);
    cloud.scale.setScalar(s * 1.6);
    group.add(cloud);
    animated.push((t) => (cloud.position.x = ((x + t * speed * 6 + 40) % 80) - 40));
  });
}

// A lamp post with a round lantern. When `glow` is above zero it is lit: a soft halo, and
// (if `light` is given) a real light for the things nearby.
function lampPost(env, { x, z, height = 3, colour = '#3a3f5c', glow = 0, light = 0, arm = 0 }) {
  const { THREE, B, G, group, textures } = env;
  B.cylinder(0.14, 0.18, 0.16, colour, { x, y: 0.08, z }, 10);
  B.cylinder(0.05, 0.065, height, colour, { x, y: height / 2 + 0.1, z, shade: 0 }, 8);
  const head = { x: x + arm, y: height + 0.3, z };
  if (arm) {
    // An arm reaching out over the pavement, with the lantern hanging under its tip.
    const rise = 0.45,
      length = Math.hypot(arm, rise);
    B.cylinder(0.04, 0.045, length, colour, {
      x: x + arm / 2,
      y: height + 0.1 + rise / 2,
      z,
      rz: -Math.atan2(arm, rise),
      shade: 0,
    });
    head.y = height + 0.36;
    B.cone(0.3, 0.2, colour, { ...head, y: head.y + 0.2, shade: 0 }, 10);
  } else {
    B.cylinder(0.2, 0.08, 0.1, colour, { x, y: height + 0.1, z, shade: 0 }, 8);
    B.cone(0.26, 0.14, colour, { ...head, y: head.y + 0.26, shade: 0 }, 8);
  }
  (glow ? G : B).ball(arm ? 0.17 : 0.24, glow ? '#fff3c4' : '#f1ecdd', { ...head, shade: 0 }, 12);
  if (!glow) return head;
  env.sprite(
    textures.radial('lamp', 'rgba(255,238,180,.6)', 'rgba(255,238,180,0)'),
    head.x,
    head.y,
    head.z + 0.1,
    2 + glow * 1.6,
  );
  if (light) {
    const bulb = new THREE.PointLight('#ffe9b0', light, 11, 1.5);
    bulb.position.set(head.x, head.y - 0.1, head.z + 0.7);
    group.add(bulb);
  }
  return head;
}

export { buildingRow, stars, clouds, lampPost };
