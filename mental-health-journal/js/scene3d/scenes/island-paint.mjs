// Hand-painted surfaces for the 3D island: the ground (grass, rock faces, cobbled paths,
// the paved plaza, flower meadows) and the lake (deep teal with bright shallows).
import { rng } from '../../art/math.mjs';
import { soft, glowSpot } from './home-paint.mjs';

const EXTENT = 13.6; // the ground texture covers x,z ∈ [-EXTENT/2, EXTENT/2]
const LAKE_EXTENT = 46;

const GROUND = {
  day: {
    grass: '#8fc866',
    light: '#aadb78',
    dark: '#74b257',
    rock: '#cbbda6',
    rockDark: '#a8987f',
    stone: '#eadfc6',
    stoneEdge: '#bfae8d',
    dirt: '#d8c79f',
    soil: '#8f6a48',
  },
  dusk: {
    grass: '#a9bf67',
    light: '#c7d27a',
    dark: '#8da555',
    rock: '#d6bda2',
    rockDark: '#b0957c',
    stone: '#f0d9b7',
    stoneEdge: '#c6a682',
    dirt: '#dfc096',
    soil: '#8f6a48',
  },
  night: {
    grass: '#3f7566',
    light: '#4a8473',
    dark: '#346357',
    rock: '#7c7d92',
    rockDark: '#64657a',
    stone: '#9a9bb0',
    stoneEdge: '#75768b',
    dirt: '#84859a',
    soil: '#5b4a48',
  },
};
const MEADOW = ['#ffffff', '#ffe27a', '#ff9fb2', '#c9a6f0', '#ffb36b'];

function paintGround(g, w, h, { terrain, places, paths, trees, lights, time }) {
  const c = GROUND[time];
  const k = w / EXTENT,
    X = (x) => (x + EXTENT / 2) * k,
    Z = (z) => (z + EXTENT / 2) * k;
  const random = rng(88);
  g.fillStyle = c.grass;
  g.fillRect(0, 0, w, h);
  /* mottled grass: soft lighter and darker patches */
  for (let i = 0; i < 520; i++) {
    const x = random() * w,
      y = random() * h,
      r = 14 + random() * 44;
    const tone = [c.light, c.dark, c.light, c.grass][i % 4];
    const blob = g.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, tone + 'aa');
    blob.addColorStop(1, tone + '00');
    g.fillStyle = blob;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  /* short grass strokes */
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = random() * w,
      y = random() * h;
    g.strokeStyle = (i % 3 ? c.dark : c.light) + '66';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (random() - 0.5) * 3, y - 3 - random() * 4);
    g.stroke();
  }

  /* rock where the ground is steep (terrace faces) and along the shore */
  const cells = 150,
    cell = EXTENT / cells;
  for (let i = 0; i < cells; i++)
    for (let j = 0; j < cells; j++) {
      const x = -EXTENT / 2 + (i + 0.5) * cell,
        z = -EXTENT / 2 + (j + 0.5) * cell,
        d = Math.hypot(x, z),
        edge = terrain.coast(Math.atan2(z, x)) - d;
      const steep = Math.min(1, Math.max(0, (terrain.slope(x, z) - 0.42) / 0.5));
      const shore = Math.min(1, Math.max(0, (0.55 - edge) / 0.4));
      const amount = Math.max(steep, shore);
      if (amount <= 0.02) continue;
      g.globalAlpha = Math.min(1, amount * 1.15);
      g.fillStyle = random() < 0.3 ? c.rockDark : c.rock;
      g.beginPath();
      g.arc(
        X(x) + (random() - 0.5) * 4,
        Z(z) + (random() - 0.5) * 4,
        cell * k * (0.75 + random() * 0.4),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  g.globalAlpha = 1;

  /* soft shade under trees and buildings */
  const shade = (x, z, rx, rz, alpha) =>
    soft(g, 12, `rgba(30,52,34,${alpha})`, (ctx) =>
      ctx.ellipse(X(x), Z(z), rx * k, rz * k, 0, 0, Math.PI * 2),
    );
  for (const t of trees) shade(t.x - 0.12 * t.s, t.z + 0.16 * t.s, 0.62 * t.s, 0.42 * t.s, 0.34);
  shade(places.home.x - 0.1, places.home.z + 0.3, 1.5, 1.05, 0.34);
  shade(places.library.x - 0.1, places.library.z + 0.3, 1.45, 1.0, 0.34);
  shade(places.lake.x, places.lake.z, 0.9, 0.6, 0.22);

  /* the paved plaza: rings of stone around the fountain */
  const P = places.plaza,
    px = X(P.x),
    pz = Z(P.z);
  soft(g, 10, 'rgba(60,50,30,.3)', (ctx) => ctx.arc(px, pz, 1.78 * k, 0, Math.PI * 2));
  const ring = (r, colour) => {
    g.fillStyle = colour;
    g.beginPath();
    g.arc(px, pz, r * k, 0, Math.PI * 2);
    g.fill();
  };
  ring(1.72, c.stoneEdge);
  ring(1.64, c.stone);
  g.strokeStyle = c.stoneEdge;
  for (const [r, joints] of [
    [1.64, 30],
    [1.32, 24],
    [1.0, 18],
  ]) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px, pz, r * k, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < joints; i++) {
      const a = (i / joints) * Math.PI * 2 + r;
      g.beginPath();
      g.moveTo(px + Math.cos(a) * (r - 0.32) * k, pz + Math.sin(a) * (r - 0.32) * k);
      g.lineTo(px + Math.cos(a) * r * k, pz + Math.sin(a) * r * k);
      g.stroke();
    }
  }
  ring(0.94, c.grass);
  ring(0.9, time === 'night' ? '#4f8a70' : '#9fd27a');

  /* cobbled paths: a dirt bed with rounded stepping stones */
  for (const path of paths) {
    g.strokeStyle = c.dirt + 'cc';
    g.lineWidth = 0.5 * k;
    g.lineJoin = 'round';
    g.beginPath();
    path.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.stroke();
    for (let i = 1; i < path.length; i++) {
      const [x0, z0] = path[i - 1],
        [x1, z1] = path[i],
        length = Math.hypot(x1 - x0, z1 - z0),
        nx = -(z1 - z0) / length,
        nz = (x1 - x0) / length;
      for (let d = 0.1; d < length; d += 0.27) {
        for (const side of [-0.14, 0.14]) {
          const x = x0 + ((x1 - x0) * d) / length + nx * side + (random() - 0.5) * 0.05,
            z = z0 + ((z1 - z0) * d) / length + nz * side + (random() - 0.5) * 0.05;
          g.fillStyle = c.stoneEdge;
          g.beginPath();
          g.ellipse(X(x), Z(z) + 1.5, 0.125 * k, 0.1 * k, random() * 3, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = c.stone;
          g.beginPath();
          g.ellipse(X(x), Z(z), 0.115 * k, 0.09 * k, random() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }

  /* flower meadows in the open grass */
  for (let i = 0; i < 60; i++) {
    const a = random() * Math.PI * 2,
      r = 1.9 + random() * 3.4,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (!terrain.onLand(x, z, 0.9) || terrain.slope(x, z) > 0.3) continue;
    const colour = time === 'night' ? '#aab4d8' : MEADOW[i % MEADOW.length];
    for (let j = 0; j < 9; j++) {
      g.fillStyle = colour;
      g.beginPath();
      g.arc(
        X(x) + (random() - 0.5) * 30,
        Z(z) + (random() - 0.5) * 22,
        1.6 + random() * 1.6,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }

  /* evening: lamps and windows spill warm light onto the ground */
  if (time !== 'day') {
    g.globalCompositeOperation = 'screen';
    for (const [x, z, r] of lights)
      glowSpot(g, X(x), Z(z), r * k, 'rgba(255,214,140,A)', time === 'night' ? 0.55 : 0.25);
    g.globalCompositeOperation = 'source-over';
  }
}

const LAKE = {
  day: {
    deep: '#2b93a6',
    mid: '#3fb2b6',
    shallow: ['#55c4c0', '#7fd9cc', '#b0ecdb'],
    foam: 'rgba(255,255,255,.75)',
    stroke: 'rgba(255,255,255,.3)',
    rock: 'rgba(20,80,90,.14)',
  },
  dusk: {
    deep: '#7a6aa8',
    mid: '#c98f9c',
    shallow: ['#e3a79a', '#f5c3a0', '#ffe0b8'],
    foam: 'rgba(255,244,230,.75)',
    stroke: 'rgba(255,240,220,.32)',
    rock: 'rgba(70,40,80,.13)',
  },
  night: {
    deep: '#141f49',
    mid: '#1f3166',
    shallow: ['#2a4480', '#34589a', '#4672b0'],
    foam: 'rgba(200,220,255,.5)',
    stroke: 'rgba(190,210,255,.16)',
    rock: 'rgba(8,12,40,.2)',
  },
};

function paintLake(g, w, h, { terrain, time }) {
  const c = LAKE[time];
  const k = w / LAKE_EXTENT,
    cx = w / 2,
    cy = h / 2;
  const depth = g.createRadialGradient(cx, cy, 6 * k, cx, cy, w / 2);
  depth.addColorStop(0, c.mid);
  depth.addColorStop(1, c.deep);
  g.fillStyle = depth;
  g.fillRect(0, 0, w, h);
  // The island's own outline, grown outwards, gives shallows that follow the coast.
  const outline = (grow) => {
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        r = (terrain.coast(a) + grow) * k;
      const x = cx + Math.cos(a) * r,
        y = cy + Math.sin(a) * r;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.closePath();
  };
  [
    [2.6, 30],
    [1.5, 20],
    [0.7, 12],
  ].forEach(([grow, blur], i) =>
    soft(g, blur, c.shallow[i], (ctx) => {
      for (let j = 0; j <= 96; j++) {
        const a = (j / 96) * Math.PI * 2,
          r = (terrain.coast(a) + grow) * k;
        if (j) ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    }),
  );
  const random = rng(27);
  /* rocks seen through the shallow water */
  for (let i = 0; i < 46; i++) {
    const a = random() * Math.PI * 2,
      r = (terrain.coast(a) + 0.5 + random() * 1.8) * k;
    g.fillStyle = c.rock;
    g.beginPath();
    g.ellipse(
      cx + Math.cos(a) * r,
      cy + Math.sin(a) * r,
      (0.16 + random() * 0.22) * k,
      (0.12 + random() * 0.14) * k,
      random() * 3,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  /* a soft line of foam where water meets rock */
  g.strokeStyle = c.foam;
  g.lineWidth = 2.2;
  outline(0.22);
  g.stroke();
  g.strokeStyle = c.stroke;
  g.lineWidth = 1.4;
  outline(0.6);
  g.stroke();
  /* small wave marks across the lake */
  g.lineCap = 'round';
  g.strokeStyle = c.stroke;
  for (let i = 0; i < 260; i++) {
    const x = random() * w,
      y = random() * h,
      len = 4 + random() * 9;
    g.lineWidth = 1 + random();
    g.beginPath();
    g.moveTo(x - len, y);
    g.quadraticCurveTo(x, y - 2.4, x + len, y);
    g.stroke();
  }
}

// Sky for the island: warm and hazy near the horizon like the painted map.
function paintIslandSky(g, w, h, time) {
  const stops = {
    day: ['#f7dfae', '#fbeccb', '#cfe9df'],
    dusk: ['#8b74ad', '#f0a98c', '#f7cfa0'],
    night: ['#0f1538', '#1d2757', '#2a3a70'],
  }[time];
  const sky = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((colour, i) => sky.addColorStop(i / 2, colour));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const random = rng(64);
  if (time === 'night')
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + random() * 0.6})`;
      g.beginPath();
      g.arc(random() * w, random() * h * 0.7, 0.6 + random() * 1.2, 0, Math.PI * 2);
      g.fill();
    }
  else
    for (let i = 0; i < 9; i++)
      glowSpot(
        g,
        random() * w,
        random() * h * 0.6,
        40 + random() * 60,
        'rgba(255,255,255,A)',
        time === 'day' ? 0.4 : 0.22,
      );
}

const HAZE = { day: '#bfe3d6', dusk: '#eab79f', night: '#17224c' };

const lakeDeep = (time) => LAKE[time].deep;

export { EXTENT, LAKE_EXTENT, HAZE, lakeDeep, paintGround, paintLake, paintIslandSky };
