// Painted surfaces for the night street: the pavement and road with their pools of light,
// the shop windows and their signs. Everything glows steadily – nothing blinks.
import { rng } from '../../art/math.mjs';

const SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

function glow(g, x, y, rx, ry, colour, alpha) {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const fill = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  fill.addColorStop(0, `rgba(${colour},${alpha})`);
  fill.addColorStop(1, `rgba(${colour},0)`);
  g.fillStyle = fill;
  g.globalCompositeOperation = 'lighter';
  g.fillRect(-rx, -rx, rx * 2, rx * 2);
  g.restore();
}

// The ground from above: paving by the shops (top of the picture), a kerb, then the road.
// `kerb` and `line` are how far down the picture those sit (0–1); `lights` are
// [x 0–1, y 0–1, reach 0–1, 'r,g,b', strength] pools of light on the ground.
function paintStreet(g, w, h, { kerb, line, lights, wide }) {
  const random = rng(41),
    edge = kerb * h,
    unit = w / wide;
  // Paving slabs, laid in staggered rows.
  g.fillStyle = '#343b56';
  g.fillRect(0, 0, w, edge);
  const slab = unit * 0.8,
    rows = Math.ceil(edge / (slab * 0.8));
  for (let r = 0; r < rows; r++)
    for (let x = -(r % 2) * slab * 0.5; x < w; x += slab) {
      const tone = 0.03 + random() * 0.07;
      g.fillStyle = random() < 0.5 ? `rgba(255,255,255,${tone})` : `rgba(0,0,0,${tone * 1.6})`;
      g.fillRect(x + 1, r * slab * 0.8 + 1, slab - 2, slab * 0.8 - 2);
    }
  g.strokeStyle = 'rgba(16,20,40,.55)';
  g.lineWidth = 1.5;
  for (let r = 0; r <= rows; r++) {
    g.beginPath();
    g.moveTo(0, r * slab * 0.8);
    g.lineTo(w, r * slab * 0.8);
    g.stroke();
  }
  // Kerb stones.
  g.fillStyle = '#5a607c';
  g.fillRect(0, edge, w, h * 0.028);
  g.fillStyle = 'rgba(14,18,36,.6)';
  for (let x = 0; x < w; x += unit * 1.6) g.fillRect(x, edge, 1.5, h * 0.028);
  // The road.
  const top = edge + h * 0.028;
  g.fillStyle = '#20253a';
  g.fillRect(0, top, w, h - top);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${random() * 0.045})`;
    g.fillRect(random() * w, top + random() * (h - top), 2, 2);
  }
  g.fillStyle = 'rgba(8,10,24,.35)';
  g.fillRect(0, top, w, h * 0.02);
  // Dashed centre line, as on the 2D street.
  g.fillStyle = 'rgba(242,201,74,.6)';
  for (let x = unit * 0.3; x < w; x += unit * 2.2) g.fillRect(x, line * h, unit * 1.3, h * 0.014);
  // A drain cover.
  g.fillStyle = '#2b3048';
  g.strokeStyle = '#3d4360';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(w * 0.585, h * (kerb + 0.16), unit * 0.42, unit * 0.42 * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  for (const [x, y, reach, colour, strength] of lights)
    glow(g, x * w, y * h, reach * w, reach * w * 0.46, colour, strength);
  g.globalCompositeOperation = 'source-over';
  // Long, faint reflections on the road, as if it had rained earlier.
  for (let i = 0; i < 22; i++) {
    g.fillStyle = `rgba(255,214,140,${0.05 + random() * 0.1})`;
    g.fillRect(random() * w, top + h * 0.05 + random() * (h - top) * 0.85, 30 + random() * 90, 2.5);
  }
}

// The convenience store seen through its glass front: shelves, a fridge and the counter.
function paintStore(g, w, h) {
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#fffbe6');
  wall.addColorStop(1, '#f1e6c2');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  // Ceiling lights.
  g.fillStyle = '#ffffff';
  for (let x = w * 0.08; x < w; x += w * 0.2) g.fillRect(x, h * 0.05, w * 0.12, h * 0.025);
  const goods = ['#e8593f', '#f2c94a', '#6fb3d9', '#8fcf8a', '#f29fb5', '#f7f2e4', '#b28ad6'];
  const random = rng(77);
  const shelf = (x, y, wide, rows) => {
    for (let r = 0; r < rows; r++) {
      const top = y + r * h * 0.15;
      for (let px = x + 3; px < x + wide - 6;) {
        const pw = 7 + random() * 9,
          ph = h * (0.07 + random() * 0.045);
        g.fillStyle = goods[Math.floor(random() * goods.length)];
        g.fillRect(px, top + h * 0.125 - ph, pw, ph);
        px += pw + 2;
      }
      g.fillStyle = '#c9bd9c';
      g.fillRect(x, top + h * 0.125, wide, h * 0.02);
    }
  };
  shelf(w * 0.04, h * 0.2, w * 0.3, 4);
  shelf(w * 0.68, h * 0.2, w * 0.28, 4);
  // The fridge at the back, glowing a little cooler.
  g.fillStyle = '#dff3f7';
  g.fillRect(w * 0.37, h * 0.22, w * 0.27, h * 0.5);
  g.strokeStyle = '#9fc4cf';
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) g.strokeRect(w * (0.375 + i * 0.088), h * 0.24, w * 0.084, h * 0.46);
  for (let r = 0; r < 4; r++)
    for (let i = 0; i < 12; i++) {
      g.fillStyle = goods[(i + r * 3) % goods.length];
      g.fillRect(w * (0.383 + i * 0.0215), h * (0.27 + r * 0.11), w * 0.014, h * 0.07);
    }
  // Counter with a till.
  g.fillStyle = '#d9c9a0';
  g.fillRect(w * 0.36, h * 0.74, w * 0.3, h * 0.26);
  g.fillStyle = '#4a5270';
  g.fillRect(w * 0.55, h * 0.64, w * 0.07, h * 0.1);
  // Floor.
  g.fillStyle = 'rgba(180,160,110,.35)';
  g.fillRect(0, h * 0.9, w, h * 0.1);
}

// The store's red sign, with the same words as the 2D street.
function paintStoreSign(g, w, h) {
  g.fillStyle = '#c64b3a';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e06a55';
  g.fillRect(0, 0, w, h * 0.12);
  g.fillStyle = '#f7f2e4';
  g.fillRect(0, h * 0.86, w, h * 0.06);
  g.fillStyle = '#fff8ea';
  g.font = '700 ' + Math.round(h * 0.52) + 'px ' + SANS;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('便利店 24h', w / 2, h * 0.5);
}

// The noodle shop's sliding doors: a wooden lattice with warm light behind paper.
function paintLattice(g, w, h) {
  const paper = g.createLinearGradient(0, 0, 0, h);
  paper.addColorStop(0, '#ffe3a6');
  paper.addColorStop(1, '#f6c77c');
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  // Someone's bowl and the cook, as soft shadows on the paper.
  g.fillStyle = 'rgba(150,96,50,.22)';
  g.beginPath();
  g.ellipse(w * 0.3, h * 0.62, w * 0.1, h * 0.2, 0, 0, Math.PI * 2);
  g.ellipse(w * 0.72, h * 0.66, w * 0.08, h * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#5a3a2e';
  g.lineWidth = 5;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo((i / 8) * w, 0);
    g.lineTo((i / 8) * w, h);
    g.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    g.beginPath();
    g.moveTo(0, (i / 5) * h);
    g.lineTo(w, (i / 5) * h);
    g.stroke();
  }
  g.fillStyle = '#4a2f26';
  g.fillRect(w * 0.49, 0, w * 0.02, h);
  g.fillRect(0, h * 0.78, w, h * 0.22);
  g.strokeStyle = '#6b463a';
  g.lineWidth = 3;
  g.strokeRect(w * 0.04, h * 0.82, w * 0.42, h * 0.14);
  g.strokeRect(w * 0.54, h * 0.82, w * 0.42, h * 0.14);
}

// A hanging sign with characters written down it.
function paintBanner(g, w, h, { text, paper, ink, edge }) {
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = edge;
  g.lineWidth = 6;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = ink;
  g.font = '700 ' + Math.round(w * 0.62) + 'px ' + SANS;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const glyphs = [...text];
  glyphs.forEach((glyph, i) =>
    g.fillText(glyph, w / 2, (h * (i + 0.5)) / glyphs.length + h * 0.01),
  );
}

// The launderette: a row of machines behind a cool, bright window.
function paintLaundry(g, w, h) {
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#e6fbff');
  wall.addColorStop(1, '#bfe6ee');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const x = w * (0.06 + i * 0.235),
      size = w * 0.2;
    g.fillStyle = '#f7fbfc';
    g.fillRect(x, h * 0.34, size, h * 0.6);
    g.fillStyle = '#9fc4cf';
    g.fillRect(x, h * 0.34, size, h * 0.08);
    g.fillStyle = '#5d7f93';
    g.beginPath();
    g.arc(x + size / 2, h * 0.68, size * 0.36, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ['#7fd0e6', '#f29fb5', '#8fd9c0', '#f2d98a'][i];
    g.beginPath();
    g.arc(x + size / 2, h * 0.68, size * 0.27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.arc(x + size * 0.42, h * 0.63, size * 0.08, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#d7eef2';
  g.fillRect(0, h * 0.12, w, h * 0.05);
}

// A glowing sign: bright letters on a dark board.
function paintNeon(g, w, h, { text, colour }) {
  g.fillStyle = '#161b36';
  g.fillRect(0, 0, w, h);
  g.font = '700 ' + Math.round(h * 0.58) + 'px ' + SANS;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colour;
  g.shadowBlur = h * 0.22;
  g.fillStyle = colour;
  g.fillText(text, w / 2, h * 0.53);
  g.shadowBlur = h * 0.08;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.55;
  g.fillText(text, w / 2, h * 0.53);
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  g.strokeStyle = colour;
  g.lineWidth = 4;
  g.strokeRect(6, 6, w - 12, h - 12);
}

// The lit front of a drinks machine.
function paintVending(g, w, h, body) {
  g.fillStyle = body;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f4fbff';
  g.fillRect(w * 0.1, h * 0.07, w * 0.8, h * 0.52);
  const drinks = ['#e8593f', '#f2c94a', '#6fb3d9', '#8fcf8a', '#f29fb5', '#b28ad6', '#f08a4b'];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) {
      g.fillStyle = drinks[(i * 2 + r * 3) % drinks.length];
      g.fillRect(w * (0.15 + i * 0.148), h * (0.1 + r * 0.165), w * 0.1, h * 0.11);
      g.fillStyle = '#c9d6de';
      g.fillRect(w * (0.165 + i * 0.148), h * (0.215 + r * 0.165), w * 0.07, h * 0.02);
    }
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(w * 0.1, h * 0.66, w * 0.5, h * 0.06);
  g.fillStyle = '#ffe9a8';
  g.fillRect(w * 0.68, h * 0.64, w * 0.2, h * 0.1);
  g.fillStyle = 'rgba(0,0,0,.45)';
  g.fillRect(w * 0.14, h * 0.8, w * 0.72, h * 0.12);
}

// A shop that has closed for the night: a rolled-down shutter.
function paintShutter(g, w, h) {
  g.fillStyle = '#4a5270';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += h / 16) {
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fillRect(0, y, w, h / 48);
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(0, y + h / 22, w, h / 60);
  }
  g.fillStyle = '#3a4160';
  g.fillRect(w * 0.44, h * 0.9, w * 0.12, h * 0.05);
}

export {
  paintStreet,
  paintStore,
  paintStoreSign,
  paintLattice,
  paintBanner,
  paintLaundry,
  paintNeon,
  paintVending,
  paintShutter,
};
