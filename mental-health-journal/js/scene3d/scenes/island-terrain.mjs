// The shape of the island: an uneven coastline and a few raised terraces. Pure maths, so
// the scenery, the painted ground and the tests all agree on where the land is.
import { ISLAND } from '../layout.mjs';

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => {
  const k = clamp01(t);
  return k * k * (3 - 2 * k);
};

// Distance from the centre to the shore in direction `angle` (never less than radius - 0.6).
function coast(angle) {
  return (
    ISLAND.radius +
    0.05 +
    0.35 * Math.sin(3 * angle + 0.8) +
    0.2 * Math.sin(5 * angle + 2.1) +
    0.1 * Math.sin(9 * angle + 0.4)
  );
}

// `places` are the destination positions. The cottage and the observatory stand on raised
// ground with a wooded ridge between them; the garden is a low terrace; the rest is lawn.
function createTerrain(places) {
  const terraces = [
    { x: places.home.x, z: places.home.z - 0.1, r: 1.7, h: 0.8 },
    { x: places.library.x, z: places.library.z - 0.1, r: 1.65, h: 0.9 },
    { x: 0, z: -3.7, r: 1.4, h: 0.55 },
    { x: places.garden.x, z: places.garden.z, r: 1.8, h: 0.22 },
  ];
  const height = (x, z) => {
    const d = Math.hypot(x, z),
      inland = smooth((coast(Math.atan2(z, x)) - d) / 0.8);
    let terrace = 0;
    for (const t of terraces)
      terrace = Math.max(terrace, t.h * (1 - smooth((Math.hypot(x - t.x, z - t.z) - t.r) / 0.6)));
    const openLawn = smooth((Math.hypot(x - places.plaza.x, z - places.plaza.z) - 1.7) / 1.2);
    const roll = 0.05 * Math.sin(x * 1.3 + 0.5) * Math.sin(z * 1.1 + 1.2) * openLawn;
    return (terrace + roll) * inland - (1 - inland) * 0.38;
  };
  // How steep the ground is at a point (0 = flat); cliffs are where this is large.
  const slope = (x, z, step = 0.12) =>
    Math.hypot(
      height(x + step, z) - height(x - step, z),
      height(x, z + step) - height(x, z - step),
    ) /
    (2 * step);
  const onLand = (x, z, margin = 0) => Math.hypot(x, z) < coast(Math.atan2(z, x)) - margin;
  return { terraces, height, slope, onLand, coast };
}

export { coast, createTerrain, smooth, clamp01 };
