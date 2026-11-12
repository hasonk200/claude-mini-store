// Pure layout maths shared by the 3D scenes and their tests. Nothing here touches the DOM or
// three.js, so it can run under `node --test`.

// The room is a dollhouse cutaway: floor x ∈ [-4, 4], z ∈ [-3, 3], back wall at z = -3,
// side wall at x = -4. One unit is roughly the width of a grown pet's head.
const ROOM = { width: 8, depth: 6, height: 3.6 };

// Pet art is authored on the same 200-unit grid as the SVG character; this converts it.
const PET_UNIT = 1 / 98;
const PET_WIDTH = 96 * PET_UNIT;
const PET_BOX = 200 * PET_UNIT;

// Where each 2D SPOTS id lives in the 3D room. `y` is the surface the pet stands on and
// `face` is the yaw (radians, 0 = looking out of the room towards the viewer).
const SPOT_3D = {
  rug: { x: 0.2, y: 0.03, z: 0.7, face: 0 },
  bed: { x: 2.65, y: 0.2, z: 1.55, face: -0.25 },
  sofa: { x: 1.4, y: 0.66, z: -2.22, face: 0 },
  ball: { x: -1.0, y: 0, z: 1.95, face: 0.35 },
  kitchen: { x: -2.75, y: 0, z: -0.55, face: 0.6 },
  shelf: { x: -2.55, y: 0, z: -1.85, face: 0.3 },
  tank: { x: -1.3, y: 0, z: -1.65, face: 0.15 },
  window: { x: 1.4, y: 0, z: -2.0, face: 0 },
  corner: { x: -2.7, y: 0, z: 1.55, face: 0.5 },
  back: { x: 0.55, y: 0, z: -1.15, face: 0 },
};

const NEST_3D = { x: -3.3, y: 0, z: 2.45 };

// Fallback for a spot that has no hand-placed entry yet: the 2D stage is a front elevation,
// so its x% maps to room x and its bottom% (0 = front of the floor) maps to depth.
function stageToFloor(xPercent, bottomPercent) {
  const x = (xPercent / 100 - 0.5) * ROOM.width * 0.88;
  const z = 2.5 - (Math.max(0, Math.min(45, bottomPercent)) / 45) * 5;
  return { x, y: 0, z, face: 0 };
}

function spotPosition(spot) {
  const id = typeof spot === 'string' ? spot : spot.id;
  if (SPOT_3D[id]) return SPOT_3D[id];
  return typeof spot === 'string' ? SPOT_3D.rug : stageToFloor(spot.x, spot.b);
}

const distance = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);

// A dragged pet stays over the floor, a little inside the walls.
function clampToFloor(x, z) {
  const halfW = ROOM.width / 2 - 0.5,
    halfD = ROOM.depth / 2 - 0.45;
  return { x: Math.max(-halfW, Math.min(halfW, x)), z: Math.max(-halfD, Math.min(halfD, z)) };
}

// The spot a pet dropped at `point` should snap to. Height is ignored so that a pet carried
// over the sofa lands on it even though it was dragged along the floor plane.
function nearestSpot(point, spots) {
  let best = null,
    bestDistance = Infinity;
  for (const spot of spots) {
    const p = spotPosition(spot);
    const d = Math.hypot(p.x - point.x, p.z - point.z);
    if (d < bestDistance) {
      bestDistance = d;
      best = spot;
    }
  }
  return best;
}

// Orbit limits for the home camera, in degrees. Azimuth is measured from straight ahead.
const HOME_CAMERA = {
  fov: 35,
  target: [-0.15, 1.0, 0.2],
  compactTarget: [-0.2, 1.1, 0.1],
  distance: 13.5,
  azimuth: 12,
  azimuthRange: 25,
  polar: 62,
  polarMin: 55,
  polarMax: 75,
};

// How far back the home camera sits so the room fills a stage of this size. The room is
// always framed whole; the floating island around it shows as far as the stage allows.
// Narrow (phone) stages frame a little tighter so pets stay big enough to tap.
const COMPACT_WIDTH = 560;
function frameHome(width, height) {
  const compact = width < COMPACT_WIDTH,
    aspect = width / height,
    spread = 2 * Math.tan((HOME_CAMERA.fov * Math.PI) / 360);
  const needWidth = compact ? 10.3 : 11.4,
    needHeight = compact ? 7.6 : 8.5;
  return {
    compact,
    distance: Math.max(needWidth / (spread * aspect), needHeight / spread),
    target: compact ? HOME_CAMERA.compactTarget : HOME_CAMERA.target,
  };
}

function orbitPosition(camera, azimuthDegrees = camera.azimuth, polarDegrees = camera.polar) {
  const a = (azimuthDegrees * Math.PI) / 180,
    p = (polarDegrees * Math.PI) / 180;
  return [
    camera.target[0] + camera.distance * Math.sin(p) * Math.sin(a),
    camera.target[1] + camera.distance * Math.cos(p),
    camera.target[2] + camera.distance * Math.sin(p) * Math.cos(a),
  ];
}

export {
  ROOM,
  PET_UNIT,
  PET_WIDTH,
  PET_BOX,
  SPOT_3D,
  NEST_3D,
  HOME_CAMERA,
  stageToFloor,
  spotPosition,
  distance,
  clampToFloor,
  nearestSpot,
  orbitPosition,
  frameHome,
  COMPACT_WIDTH,
};
