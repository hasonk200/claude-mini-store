// Hand-painted surfaces for the 3D café: wood floor, striped walls and the shop sign.
// As in the home, shadows and light are painted in rather than computed every frame.
import { rng } from '../../art/math.mjs';
import { soft, shade, glowSpot, mood, WARM } from './home-paint.mjs';

const U = 100; // pixels per room unit
const ROOM = { width: 12, depth: 6, height: 4.2, back: -2.6, left: -6, sideDepth: 3.3 };
const FLOOR_SIZE = [ROOM.width * U, ROOM.depth * U],
  BACK_SIZE = [ROOM.width * U, ROOM.height * U],
  SIDE_SIZE = [ROOM.sideDepth * U, ROOM.height * U];
// Wall-arm lamps along the back wall (x positions).
const LAMPS = [-1.35, 0.55];

function paintCafeFloor(g, w, h, { time }) {
  const X = (x) => (x - ROOM.left) * U,
    Z = (z) => (z - ROOM.back) * U;
  const random = rng(77);
  const tones = ['#bd8e60', '#b6875a', '#c29466', '#b08255', '#ba8b5e'];
  const rows = 8,
    rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -random() * 200;
    while (x < w) {
      const length = 170 + random() * 200;
      g.fillStyle = tones[Math.floor(random() * tones.length)];
      g.fillRect(x, r * rowH, length + 1, rowH);
      g.strokeStyle = 'rgba(110,70,36,.1)';
      g.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const y = r * rowH + 8 + random() * (rowH - 16);
        g.beginPath();
        g.moveTo(x + 6, y);
        g.bezierCurveTo(
          x + length * 0.3,
          y + (random() - 0.5) * 8,
          x + length * 0.65,
          y + (random() - 0.5) * 8,
          x + length - 6,
          y,
        );
        g.stroke();
      }
      g.fillStyle = 'rgba(96,60,30,.5)';
      g.fillRect(x + length - 1, r * rowH, 2.2, rowH);
      x += length;
    }
    g.fillStyle = 'rgba(96,60,30,.5)';
    g.fillRect(0, r * rowH - 1, w, 2.2);
    g.fillStyle = 'rgba(255,236,200,.18)';
    g.fillRect(0, r * rowH + 1.4, w, 1.4);
  }
  let edge = g.createLinearGradient(0, 0, 0, 110);
  edge.addColorStop(0, shade(0.34));
  edge.addColorStop(1, shade(0));
  g.fillStyle = edge;
  g.fillRect(0, 0, w, 110);
  edge = g.createLinearGradient(0, 0, 100, 0);
  edge.addColorStop(0, shade(0.3));
  edge.addColorStop(1, shade(0));
  g.fillStyle = edge;
  g.fillRect(0, 0, 100, ROOM.sideDepth * U);
  const box = (x0, x1, z0, z1, alpha = 0.42, blur = 24) =>
    soft(g, blur, shade(alpha), (c) => c.rect(X(x0), Z(z0), (x1 - x0) * U, (z1 - z0) * U));
  const round = (x, z, rx, rz, alpha = 0.4, blur = 18) =>
    soft(g, blur, shade(alpha), (c) => c.ellipse(X(x), Z(z), rx * U, rz * U, 0, 0, Math.PI * 2));
  box(-5.75, -1.65, -2.6, -1.3);
  for (const x of [-2, 0, 2.9]) round(x, 1.66, 0.98, 0.62, 0.42);
  round(4.5, -1.2, 0.8, 0.6);
  for (const x of [3.5, 5.4]) round(x, -0.75, 0.3, 0.24, 0.36, 12);
  round(5.45, -2.15, 0.42, 0.36);
  mood(g, w, h, time);
  g.globalCompositeOperation = 'screen';
  const [colour, lean, reach] = {
    day: ['rgba(255,240,200,.4)', 0.28, 0],
    dusk: ['rgba(255,178,108,.48)', 0.5, 0.7],
    night: ['rgba(170,192,255,.18)', 0.28, 0],
  }[time];
  for (const [z0, z1] of [
    [-1.55, -0.35 + reach * 0.4],
    [-0.2 + reach * 0.4, 1.15 + reach],
  ])
    for (const [x0, x1] of [
      [1.9, 3.42],
      [3.58, 5.1],
    ]) {
      const skew = (z) => -(z + 2.6) * lean;
      soft(g, 9, colour, (c) => {
        c.moveTo(X(x0 + skew(z0)), Z(z0));
        c.lineTo(X(x1 + skew(z0)), Z(z0));
        c.lineTo(X(x1 + skew(z1) + 0.06), Z(z1));
        c.lineTo(X(x0 + skew(z1) - 0.06), Z(z1));
      });
    }
  if (time !== 'day')
    for (const x of LAMPS) glowSpot(g, X(x), Z(-1.2), 3.0 * U, WARM, time === 'night' ? 0.6 : 0.22);
  g.globalCompositeOperation = 'source-over';
}

function paintWall(g, w, h, seed) {
  const dado = (ROOM.height - 1.05) * U;
  g.fillStyle = '#f4e4cb';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ead6b5';
  for (let x = 20; x < w; x += 75) g.fillRect(x, 0, 33, dado);
  const random = rng(seed);
  g.fillStyle = 'rgba(150,110,66,.06)';
  for (let i = 0; i < 480; i++) g.fillRect(random() * w, random() * dado, 2, 2);
  const top = g.createLinearGradient(0, 0, 0, 170);
  top.addColorStop(0, shade(0.14));
  top.addColorStop(1, shade(0));
  g.fillStyle = top;
  g.fillRect(0, 0, w, 170);
  g.fillStyle = '#c9a47a';
  g.fillRect(0, dado, w, h - dado);
  g.strokeStyle = '#b08a60';
  g.lineWidth = 2;
  for (let x = 0; x < w; x += 46) {
    g.beginPath();
    g.moveTo(x, dado + 8);
    g.lineTo(x, h - 14);
    g.stroke();
    g.fillStyle = 'rgba(255,236,204,.3)';
    g.fillRect(x + 2, dado + 8, 2, h - dado - 22);
  }
  g.fillStyle = shade(0.18);
  g.fillRect(0, dado + 7, w, 6);
  g.fillStyle = '#a87a4e';
  g.fillRect(0, dado - 7, w, 14);
  g.fillStyle = 'rgba(255,236,204,.55)';
  g.fillRect(0, dado - 7, w, 2);
  g.fillStyle = '#8a6040';
  g.fillRect(0, h - 14, w, 14);
  const low = g.createLinearGradient(0, h - 64, 0, h);
  low.addColorStop(0, shade(0));
  low.addColorStop(1, shade(0.28));
  g.fillStyle = low;
  g.fillRect(0, h - 64, w, 64);
}

function paintCafeBack(g, w, h, { time }) {
  const X = (x) => (x - ROOM.left) * U,
    Y = (y) => (ROOM.height - y) * U;
  paintWall(g, w, h, 3);
  const corner = g.createLinearGradient(0, 0, 100, 0);
  corner.addColorStop(0, shade(0.3));
  corner.addColorStop(1, shade(0));
  g.fillStyle = corner;
  g.fillRect(0, 0, 100, h);
  const cast = (x0, x1, y0, y1, alpha = 0.3, blur = 18, dx = -0.12) =>
    soft(g, blur, shade(alpha), (c) =>
      c.rect(X(x0 + dx), Y(y1), (x1 - x0) * U, (y1 - y0) * U + 16),
    );
  cast(-5.75, -1.65, 0, 1.22, 0.36);
  cast(-5.6, -2.2, 2.52, 3.62, 0.38, 10, -0.06);
  cast(-5.5, -2.0, 1.86, 2.0, 0.3, 8, -0.05);
  cast(1.62, 5.38, 1.0, 3.56, 0.34, 12, -0.07);
  cast(3.8, 5.2, 0, 0.95, 0.24);
  soft(g, 20, shade(0.26), (c) => c.ellipse(X(5.35), Y(1.1), 0.55 * U, 0.7 * U, 0, 0, Math.PI * 2));
  mood(g, w, h, time);
  if (time !== 'day') {
    g.globalCompositeOperation = 'screen';
    for (const x of LAMPS) glowSpot(g, X(x), Y(3.2), 2.2 * U, WARM, time === 'night' ? 0.8 : 0.32);
    g.globalCompositeOperation = 'source-over';
  }
}

function paintCafeSide(g, w, h, { time }) {
  paintWall(g, w, h, 8);
  soft(g, 9, shade(0.32), (c) =>
    c.rect(w - 2.25 * U + 8, (ROOM.height - 3.1) * U + 8, 1.3 * U, 1.5 * U),
  );
  const corner = g.createLinearGradient(w - 100, 0, w, 0);
  corner.addColorStop(0, shade(0));
  corner.addColorStop(1, shade(0.3));
  g.fillStyle = corner;
  g.fillRect(w - 100, 0, 100, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#efe6e0';
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  mood(g, w, h, time);
}

// 「毛孩茶室」 in the same serif face as the 2D sign, cream on the dark board.
function paintSign(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#f4ead3';
  g.font = '600 ' + Math.round(h * 0.56) + 'px "Noto Serif TC", "Songti TC", "PMingLiU", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  [...'毛孩茶室'].forEach((glyph, i) => g.fillText(glyph, w * (0.17 + i * 0.22), h * 0.53));
  g.strokeStyle = 'rgba(244,234,211,.55)';
  g.lineWidth = 3;
  g.strokeRect(10, 10, w - 20, h - 20);
}

// The little chalkboard menu by the door.
function paintMenu(g, w, h) {
  g.fillStyle = '#34423c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4ead3';
  g.font = '600 30px "Noto Serif TC", "Songti TC", serif';
  g.textAlign = 'center';
  g.fillText('今日', w / 2, 44);
  g.strokeStyle = 'rgba(244,234,211,.7)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(26, 78 + i * 28);
    g.lineTo(w - 26 - (i % 2) * 34, 78 + i * 28);
    g.stroke();
  }
  g.fillStyle = '#ffcf6b';
  g.beginPath();
  g.arc(w / 2, h - 30, 12, 0, Math.PI * 2);
  g.fill();
}

export {
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
};
