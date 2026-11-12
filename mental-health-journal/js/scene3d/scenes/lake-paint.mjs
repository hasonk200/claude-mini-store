// Painted surfaces for the lakeside: the water (with the sun's or moon's path and the
// skyline's reflection), a layer of ripples that drifts over it, and the boardwalk's planks.
import { rng } from '../../art/math.mjs';

const WATER = {
  day: {
    far: '#a9cde6',
    mid: '#7fb0d6',
    near: '#5b8fc0',
    ripple: '255,255,255',
    glint: '255,250,220',
  },
  dusk: {
    far: '#f6c29c',
    mid: '#c98fa0',
    near: '#6d6aa3',
    ripple: '255,226,200',
    glint: '255,214,150',
  },
  night: {
    far: '#33477e',
    mid: '#25356a',
    near: '#18244f',
    ripple: '170,190,240',
    glint: '243,230,180',
  },
};

// `sun` is where the light sits across the water (0–1 along the far edge); the path of
// glints runs from there towards the viewer. `shore` lists the far buildings as
// [centre 0–1, width 0–1, height 0–1] so their reflections can be smudged in.
function paintWater(g, w, h, { time, sun, shore, tones }) {
  const c = { ...WATER[time], ...tones };
  const fill = g.createLinearGradient(0, 0, 0, h);
  fill.addColorStop(0, c.far);
  fill.addColorStop(0.3, c.mid);
  fill.addColorStop(1, c.near);
  g.fillStyle = fill;
  g.fillRect(0, 0, w, h);
  const random = rng(17);
  // Reflections of the far shore: soft vertical smudges just under it.
  for (const [centre, width, height] of shore) {
    const x = centre * w,
      half = (width * w) / 2,
      long = h * (0.05 + height * 0.1);
    const smudge = g.createLinearGradient(0, 0, 0, long);
    const ink = time === 'night' ? '16,22,54' : time === 'dusk' ? '92,72,120' : '110,120,160';
    smudge.addColorStop(0, `rgba(${ink},.5)`);
    smudge.addColorStop(1, `rgba(${ink},0)`);
    g.fillStyle = smudge;
    g.fillRect(x - half, 0, half * 2, long);
    if (time !== 'day')
      for (let i = 0; i < 3; i++) {
        g.fillStyle = `rgba(255,214,140,${time === 'night' ? 0.5 : 0.25})`;
        g.fillRect(
          x - half + random() * half * 2,
          2 + random() * long * 0.5,
          1.5,
          3 + random() * 9,
        );
      }
  }
  // The path of light: short bright dashes, sparse far away and broader close by.
  for (let i = 0; i < 150; i++) {
    const v = Math.pow(random(), 1.4),
      y = v * h,
      // The path leans from the light towards the middle of the near edge.
      centre = (sun + (0.5 - sun) * v) * w,
      spread = (4 + v * 46) * (time === 'night' ? 0.8 : 1),
      x = centre + (random() - 0.5) * spread * 2,
      long = 3 + v * 26 * random();
    g.fillStyle = `rgba(${c.glint},${(0.75 - v * 0.45) * (0.5 + random() * 0.5)})`;
    g.fillRect(x - long / 2, y, long, 1 + v * 2.2);
  }
  // Still ripples, smaller towards the far shore.
  for (let i = 0; i < 260; i++) {
    const v = Math.pow(random(), 1.2),
      long = 4 + v * 34 * (0.4 + random());
    g.fillStyle = `rgba(${c.ripple},${0.1 + random() * 0.2})`;
    g.fillRect(random() * w, v * h, long, 1 + v * 1.6);
  }
  // A darker band where the water meets the boardwalk.
  const edge = g.createLinearGradient(0, h * 0.965, 0, h);
  edge.addColorStop(0, 'rgba(10,20,50,0)');
  edge.addColorStop(1, 'rgba(10,20,50,.35)');
  g.fillStyle = edge;
  g.fillRect(0, h * 0.965, w, h * 0.035);
}

// A sparse, repeating sheet of ripples to slide slowly over the water.
function paintRipples(g, w, h, time) {
  g.clearRect(0, 0, w, h);
  const random = rng(29),
    c = WATER[time];
  for (let i = 0; i < 34; i++) {
    const x = random() * w,
      y = random() * h,
      long = 10 + random() * 26;
    g.fillStyle = `rgba(${c.ripple},${0.35 + random() * 0.4})`;
    // Drawn twice so a dash crossing the edge wraps round.
    g.fillRect(x, y, long, 2);
    g.fillRect(x - w, y, long, 2);
  }
}

const BOARDS = {
  day: { base: '#c39a6f', dark: '#a67d55', light: '#d6b085', gap: '#7c5a3c', nail: '#8a6a4c' },
  dusk: { base: '#c08d68', dark: '#a27150', light: '#d9a57c', gap: '#77503a', nail: '#845f47' },
  night: { base: '#4a4259', dark: '#3d364c', light: '#575066', gap: '#292236', nail: '#342c42' },
};

// The boardwalk seen from above. Planks run from the water towards the viewer.
// `lamps` are [x 0–1, strength] pools of lamplight at the far (water) edge.
function paintBoards(g, w, h, { time, planks, lamps, tones }) {
  const c = { ...BOARDS[time], ...tones },
    random = rng(53),
    wide = w / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * wide;
    g.fillStyle = [c.base, c.dark, c.light, c.base][Math.floor(random() * 4)];
    g.fillRect(x, 0, wide + 1, h);
    // Grain: a few long, faint strokes.
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `rgba(60,36,20,${0.05 + random() * 0.08})`;
      g.fillRect(x + 3 + random() * (wide - 6), random() * h, 1.5, 30 + random() * 120);
    }
    // Boards are cut to length: a joint somewhere along each run.
    const joint = h * (0.2 + random() * 0.6);
    g.fillStyle = c.gap;
    g.fillRect(x, joint, wide, 2);
    g.fillRect(x, 0, 2, h);
    g.fillStyle = c.nail;
    for (const y of [10, joint - 9, joint + 11, h - 12])
      for (const dx of [wide * 0.28, wide * 0.72]) {
        g.beginPath();
        g.arc(x + dx, y, 1.8, 0, Math.PI * 2);
        g.fill();
      }
  }
  // Soft shade under the railing along the water's edge, and towards the viewer.
  const far = g.createLinearGradient(0, 0, 0, h * 0.2);
  far.addColorStop(0, 'rgba(40,24,30,.38)');
  far.addColorStop(1, 'rgba(40,24,30,0)');
  g.fillStyle = far;
  g.fillRect(0, 0, w, h * 0.2);
  const near = g.createLinearGradient(0, h * 0.55, 0, h);
  near.addColorStop(0, 'rgba(40,24,30,0)');
  near.addColorStop(1, 'rgba(40,24,30,.3)');
  g.fillStyle = near;
  g.fillRect(0, h * 0.55, w, h * 0.45);
  for (const [x, strength] of lamps) {
    const pool = g.createRadialGradient(x * w, h * 0.14, 0, x * w, h * 0.14, h * 0.46);
    pool.addColorStop(0, `rgba(255,226,160,${0.4 * strength})`);
    pool.addColorStop(1, 'rgba(255,226,160,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
}

export { paintWater, paintRipples, paintBoards };
