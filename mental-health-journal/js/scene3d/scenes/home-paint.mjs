// Hand-painted surfaces for the 3D home: wood floor, striped walls, rug and sky backdrop.
// Soft shadows, corner shading, window light and lamp glow are painted straight into these
// textures, so the room looks lit without any real-time shadow maps.
import { rng } from '../../art/math.mjs';

const U = 128; // pixels per room unit
const FLOOR_SIZE = [1024, 768],
  BACK_SIZE = [1024, 461],
  SIDE_SIZE = [768, 461];

// Draws only the blurred shadow of a shape (the shape itself is parked off-canvas).
function soft(g, blur, colour, draw) {
  g.save();
  g.shadowColor = colour;
  g.shadowBlur = blur;
  g.shadowOffsetX = 4000;
  g.translate(-4000, 0);
  g.fillStyle = '#000';
  g.beginPath();
  draw(g);
  g.fill();
  g.restore();
}
const shade = (alpha) => `rgba(74,44,22,${alpha})`;

function glowSpot(g, x, y, radius, colour, alpha) {
  const gradient = g.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, colour.replace('A', alpha));
  gradient.addColorStop(1, colour.replace('A', 0));
  g.fillStyle = gradient;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
const WARM = 'rgba(255,200,128,A)';
const BULB_GLOW = [
  'rgba(255,210,122,A)',
  'rgba(255,159,178,A)',
  'rgba(159,240,255,A)',
  'rgba(201,242,155,A)',
];

function mood(g, w, h, time) {
  if (time === 'day') return;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = time === 'night' ? '#9f96ba' : '#f4d9c6';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

function paintFloor(g, w, h, { time, own, egg }) {
  const X = (x) => (x + 4) * U,
    Z = (z) => (z + 3) * U;
  const random = rng(23);
  const tones = ['#cb9f70', '#c4966a', '#d0a676', '#bf9163', '#c89b6f', '#c9a073'];
  const rows = 10,
    rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -random() * 220;
    while (x < w) {
      const length = 190 + random() * 230;
      g.fillStyle = tones[Math.floor(random() * tones.length)];
      g.fillRect(x, r * rowH, length + 1, rowH);
      g.strokeStyle = 'rgba(120,78,40,.11)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const y = r * rowH + 10 + random() * (rowH - 20);
        g.beginPath();
        g.moveTo(x + 8, y);
        g.bezierCurveTo(
          x + length * 0.3,
          y + (random() - 0.5) * 9,
          x + length * 0.65,
          y + (random() - 0.5) * 9,
          x + length - 8,
          y,
        );
        g.stroke();
      }
      if (random() < 0.22) {
        g.fillStyle = 'rgba(120,78,40,.16)';
        g.beginPath();
        g.ellipse(x + 30 + random() * (length - 60), r * rowH + rowH / 2, 7, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(104,66,34,.5)';
      g.fillRect(x + length - 1, r * rowH, 2.5, rowH);
      x += length;
    }
    g.fillStyle = 'rgba(104,66,34,.5)';
    g.fillRect(0, r * rowH - 1, w, 2.5);
    g.fillStyle = 'rgba(255,238,205,.2)';
    g.fillRect(0, r * rowH + 1.5, w, 1.5);
  }

  /* corner shading where the floor meets the two walls */
  let edge = g.createLinearGradient(0, 0, 0, 120);
  edge.addColorStop(0, shade(0.34));
  edge.addColorStop(1, shade(0));
  g.fillStyle = edge;
  g.fillRect(0, 0, w, 120);
  edge = g.createLinearGradient(0, 0, 120, 0);
  edge.addColorStop(0, shade(0.3));
  edge.addColorStop(1, shade(0));
  g.fillStyle = edge;
  g.fillRect(0, 0, 120, h);

  /* contact shadows under whatever furniture is owned */
  const box = (x, z, sx, sz, alpha = 0.42, blur = 26) =>
    soft(g, blur, shade(alpha), (c) => c.rect(X(x - sx / 2), Z(z - sz / 2), sx * U, sz * U));
  const round = (x, z, rx, rz, alpha = 0.4, blur = 22) =>
    soft(g, blur, shade(alpha), (c) => c.ellipse(X(x), Z(z), rx * U, rz * U, 0, 0, Math.PI * 2));
  round(0.2, 0.8, 2.56, 1.42, 0.3, 16);
  round(2.6, 1.6, 0.98, 0.92, 0.45);
  if (own.sofa) box(1.36, -2.28, 2.95, 1.2);
  if (own.shelf) box(-2.74, -2.62, 1.1, 0.62);
  if (own.record && !own.shelf) box(-2.74, -2.62, 0.86, 0.6);
  if (own.tank) box(-1.34, -2.52, 1.04, 0.66);
  if (own.lamp) round(-0.38, -2.52, 0.34, 0.3, 0.42, 14);
  if (own.plant) round(3.36, -2.4, 0.42, 0.38, 0.42, 16);
  if (own.kitchen) box(-3.6, -0.9, 0.9, 2.12);
  if (own.ball) round(-1.58, 2.08, 0.22, 0.2, 0.4, 10);
  if (own.shoes) round(-3.34, 0.82, 0.5, 0.46, 0.25, 12);
  if (egg) round(-3.32, 2.47, 0.56, 0.52, 0.42, 16);

  mood(g, w, h, time);

  g.globalCompositeOperation = 'screen';
  if (time !== 'day') {
    if (own.lamp) glowSpot(g, X(-0.35), Z(-1.7), 4.4 * U, WARM, time === 'night' ? 0.7 : 0.25);
    if (own.lights && time === 'night') {
      edge = g.createLinearGradient(0, 0, 0, 230);
      edge.addColorStop(0, 'rgba(255,205,160,.2)');
      edge.addColorStop(1, 'rgba(255,205,160,0)');
      g.fillStyle = edge;
      g.fillRect(0, 0, w, 230);
    }
  }
  g.globalCompositeOperation = 'source-over';
}

// Shared wall dressing: paper stripes above a panelled wainscot.
function paintWallBase(g, w, h, seed) {
  const rail = (3.6 - 1.07) * U;
  g.fillStyle = '#f1e4cd';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8d8bd';
  for (let x = 0.2 * U - 9; x < w; x += 0.4 * U) g.fillRect(x, 0, 18, rail);
  const random = rng(seed);
  g.fillStyle = 'rgba(150,115,70,.06)';
  for (let i = 0; i < 520; i++) g.fillRect(random() * w, random() * rail, 2, 2);
  const top = g.createLinearGradient(0, 0, 0, 190);
  top.addColorStop(0, shade(0.14));
  top.addColorStop(1, shade(0));
  g.fillStyle = top;
  g.fillRect(0, 0, w, 190);
  g.fillStyle = '#e4d1b1';
  g.fillRect(0, rail, w, h - rail);
  for (let x = 12; x < w; x += 82) {
    g.fillStyle = '#dcc7a3';
    g.fillRect(x, rail + 20, 58, h - rail - 46);
    g.strokeStyle = '#c9b089';
    g.lineWidth = 2;
    g.strokeRect(x, rail + 20, 58, h - rail - 46);
    g.fillStyle = 'rgba(255,246,226,.55)';
    g.fillRect(x + 2, h - 27, 56, 2);
    g.fillRect(x + 56, rail + 22, 2, h - rail - 48);
  }
  g.fillStyle = shade(0.16);
  g.fillRect(0, rail + 6, w, 6);
  g.fillStyle = '#d8c198';
  g.fillRect(0, rail - 6, w, 12);
  g.fillStyle = 'rgba(255,246,226,.7)';
  g.fillRect(0, rail - 6, w, 2);
  g.fillStyle = '#b99670';
  g.fillRect(0, h - 16, w, 16);
  g.fillStyle = 'rgba(255,240,214,.5)';
  g.fillRect(0, h - 16, w, 2);
  const low = g.createLinearGradient(0, h - 70, 0, h);
  low.addColorStop(0, shade(0));
  low.addColorStop(1, shade(0.26));
  g.fillStyle = low;
  g.fillRect(0, h - 70, w, 70);
}

function paintBackWall(g, w, h, { time, own, bulbs }) {
  const X = (x) => (x + 4) * U,
    Y = (y) => (3.6 - y) * U;
  paintWallBase(g, w, h, 5);
  const corner = g.createLinearGradient(0, 0, 110, 0);
  corner.addColorStop(0, shade(0.3));
  corner.addColorStop(1, shade(0));
  g.fillStyle = corner;
  g.fillRect(0, 0, 110, h);
  // Furniture throws a soft shadow a little to the left and down (the sun is front-right).
  const cast = (x0, x1, y0, y1, alpha = 0.3, blur = 20, dx = -0.14) =>
    soft(g, blur, shade(alpha), (c) =>
      c.rect(X(x0 + dx), Y(y1), (x1 - x0) * U, (y1 - y0) * U + 20),
    );
  cast(0.24, 2.56, 1.2, 2.94, 0.34, 12, -0.07);
  if (own.sofa) cast(0, 2.8, 0, 1.28);
  if (own.shelf) cast(-3.22, -2.18, 0, 2.52, 0.34);
  if (own.record) cast(-3.08, -2.32, own.shelf ? 2.5 : 0, own.shelf ? 2.68 : 0.88, 0.3);
  if (own.tank) cast(-1.8, -0.8, 0, 1.46);
  if (own.frame) cast(-1.63, -0.97, 1.92, 2.92, 0.36, 9, -0.06);
  if (own.lamp) {
    cast(-0.39, -0.31, 0, 1.7, 0.2, 8);
    cast(-0.68, -0.02, 1.68, 2.12, 0.18, 14);
  }
  if (own.plant)
    soft(g, 22, shade(0.26), (c) =>
      c.ellipse(X(3.28), Y(1.05), 0.6 * U, 0.62 * U, 0, 0, Math.PI * 2),
    );
  soft(g, 8, shade(0.3), (c) => c.arc(X(3.26), Y(2.66), 0.3 * U, 0, Math.PI * 2));
  mood(g, w, h, time);
  g.globalCompositeOperation = 'screen';
  if (own.lamp && time !== 'day')
    glowSpot(g, X(-0.35), Y(1.9), 2.7 * U, WARM, time === 'night' ? 0.85 : 0.35);
  if (own.lights && time !== 'day')
    bulbs.forEach(([x, y, z], i) => {
      if (z < -2.8)
        glowSpot(g, X(x), Y(y), 0.5 * U, BULB_GLOW[i % 4], time === 'night' ? 0.5 : 0.22);
    });
  g.globalCompositeOperation = 'source-over';
}

function paintSideWall(g, w, h, { time, own, bulbs }) {
  const X = (z) => (3 - z) * U,
    Y = (y) => (3.6 - y) * U;
  paintWallBase(g, w, h, 9);
  if (own.kitchen) {
    // Tiled splashback between the worktop and the wall cupboard.
    const x0 = X(0.07),
      x1 = X(-1.97),
      y0 = Y(2.09),
      y1 = Y(0.96);
    g.fillStyle = '#f6f1e6';
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = '#ddd2bd';
    g.lineWidth = 2;
    for (let x = x0; x <= x1 + 1; x += (x1 - x0) / 8) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
    for (let y = y0; y <= y1 + 1; y += (y1 - y0) / 4) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x1, y);
      g.stroke();
    }
    soft(g, 18, shade(0.3), (c) => c.rect(X(0.05) + 12, Y(0.98), 2.0 * U, 0.98 * U + 20));
    soft(g, 16, shade(0.3), (c) => c.rect(X(0.05) + 10, Y(2.71) + 10, 2.0 * U, 0.62 * U));
  }
  soft(g, 8, shade(0.3), (c) => c.rect(X(2.42) + 6, Y(2.66) + 6, 0.62 * U, 0.76 * U));
  soft(g, 8, shade(0.3), (c) => c.rect(X(1.62) + 6, Y(2.36) + 6, 0.5 * U, 0.5 * U));
  const corner = g.createLinearGradient(w - 110, 0, w, 0);
  corner.addColorStop(0, shade(0));
  corner.addColorStop(1, shade(0.3));
  g.fillStyle = corner;
  g.fillRect(w - 110, 0, 110, h);
  // The side wall faces away from the sun, so it sits a shade darker than the back wall.
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#efe6e0';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  mood(g, w, h, time);
  g.globalCompositeOperation = 'screen';
  if (own.lights && time !== 'day')
    bulbs.forEach(([, y, z], i) => {
      if (z >= -2.8)
        glowSpot(g, X(z), Y(y), 0.5 * U, BULB_GLOW[i % 4], time === 'night' ? 0.5 : 0.22);
    });
  g.globalCompositeOperation = 'source-over';
}

// Light falling through the four window panes, drawn on a see-through sheet that lies just
// above the floor and rug. The sheet covers x ∈ [-1.6, 2.6], z ∈ [-1.7, 2.5].
const LIGHT_AREA = { x: -1.6, z: -1.7, size: 4.2 };
function paintWindowLight(g, w, h, time) {
  const k = w / LIGHT_AREA.size;
  const X = (x) => (x - LIGHT_AREA.x) * k,
    Z = (z) => (z - LIGHT_AREA.z) * k;
  const [colour, lean, reach] = {
    day: ['rgba(255,244,210,.95)', 0.3, 0],
    dusk: ['rgba(255,186,120,.95)', 0.5, 0.7],
    night: ['rgba(176,196,255,.8)', 0.3, 0],
  }[time];
  for (const [z0, z1] of [
    [-1.45, -0.6 + reach * 0.4],
    [-0.48 + reach * 0.4, 0.5 + reach],
  ])
    for (const [x0, x1] of [
      [0.46, 1.34],
      [1.46, 2.34],
    ]) {
      const skew = (z) => -(z + 2.6) * lean;
      soft(g, 7, colour, (c) => {
        c.moveTo(X(x0 + skew(z0)), Z(z0));
        c.lineTo(X(x1 + skew(z0)), Z(z0));
        c.lineTo(X(x1 + skew(z1) + 0.06), Z(z1));
        c.lineTo(X(x0 + skew(z1) - 0.06), Z(z1));
      });
    }
}

function paintRug(g, w, h) {
  const cx = w / 2,
    cy = h / 2;
  const ring = (k, colour) => {
    g.fillStyle = colour;
    g.beginPath();
    g.ellipse(cx, cy, cx * k, cy * k, 0, 0, Math.PI * 2);
    g.fill();
  };
  ring(1, '#d67f66');
  g.fillStyle = '#f4d3b8';
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    g.beginPath();
    g.ellipse(
      cx + Math.cos(a) * cx * 0.925,
      cy + Math.sin(a) * cy * 0.925,
      11,
      11,
      0,
      0,
      Math.PI * 2,
    );
    g.fill();
  }
  ring(0.86, '#e08e73');
  ring(0.8, '#f4d3b8');
  ring(0.775, '#dd8a70');
  g.strokeStyle = '#c96f58';
  g.lineWidth = 3;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.ellipse(cx, cy, cx * 0.62, cy * 0.62, 0, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  ring(0.4, '#e89a7e');
  // A paw print in the middle.
  g.fillStyle = '#f6dcc4';
  g.beginPath();
  g.ellipse(cx, cy + 12, 34, 26, 0, 0, Math.PI * 2);
  g.fill();
  for (const [dx, dy, r] of [
    [-40, -18, 13],
    [-14, -36, 14],
    [14, -36, 14],
    [40, -18, 13],
  ]) {
    g.beginPath();
    g.ellipse(cx + dx, cy + dy, r, r * 1.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Woven texture.
  g.strokeStyle = 'rgba(120,50,30,.06)';
  g.lineWidth = 1;
  for (let y = 0; y < h; y += 4) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
}

function paintBackdrop(g, w, h, time) {
  const stops = {
    day: ['#a9dcf2', '#d9eff5', '#fdf0dc'],
    dusk: ['#7f6aa8', '#e79a86', '#f9c98f'],
    night: ['#11163a', '#262c5e', '#4a4680'],
  }[time];
  const sky = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((colour, i) => sky.addColorStop(i / 2, colour));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const random = rng(41);
  if (time === 'night') {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + random() * 0.6})`;
      const r = 0.6 + random() * 1.3;
      g.beginPath();
      g.arc(random() * w, random() * h * 0.8, r, 0, Math.PI * 2);
      g.fill();
    }
    glowSpot(g, w * 0.84, h * 0.16, 110, 'rgba(210,220,255,A)', 0.3);
  } else {
    glowSpot(
      g,
      w * 0.84,
      h * (time === 'day' ? 0.14 : 0.5),
      190,
      time === 'day' ? 'rgba(255,250,225,A)' : 'rgba(255,214,150,A)',
      0.75,
    );
    for (const [x, y, s] of [
      [0.14, 0.2, 1],
      [0.62, 0.1, 0.7],
      [0.9, 0.42, 0.85],
      [0.05, 0.62, 0.6],
    ]) {
      g.fillStyle = time === 'day' ? 'rgba(255,255,255,.7)' : 'rgba(255,226,214,.4)';
      for (const [dx, dy, r] of [
        [0, 0, 30],
        [28, 6, 24],
        [-28, 8, 22],
        [10, -14, 22],
        [52, 12, 16],
        [-50, 14, 14],
      ]) {
        g.beginPath();
        g.ellipse(x * w + dx * s, y * h + dy * s, r * s * 1.2, r * s * 0.8, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  for (let i = 0; i < 16; i++)
    glowSpot(
      g,
      random() * w,
      random() * h,
      14 + random() * 34,
      'rgba(255,255,255,A)',
      time === 'night' ? 0.06 : 0.16,
    );
}

export {
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
};
