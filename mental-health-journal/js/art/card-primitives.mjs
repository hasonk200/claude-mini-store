import { f, rng } from './math.mjs';
// Each renderer owns its SVG gradient definitions and ID prefix.
export function createCardPrimitives() {
  let P = '',
    D = [];
  function begin(prefix) {
    P = prefix;
    D = [];
  }
  function definitions() {
    return D.join('');
  }
  function lg(stops, vert = true) {
    const id = P + 'g' + D.length;
    D.push(
      '<linearGradient id="' +
        id +
        '" x1="0" y1="0" x2="' +
        (vert ? 0 : 1) +
        '" y2="' +
        (vert ? 1 : 0) +
        '">' +
        stops
          .map(
            (c, i) =>
              '<stop offset="' +
              (stops.length > 1 ? i / (stops.length - 1) : 0) +
              '" stop-color="' +
              c +
              '"/>',
          )
          .join('') +
        '</linearGradient>',
    );
    return 'url(#' + id + ')';
  }
  function glow(c, o = 0.85) {
    const id = P + 'r' + D.length;
    D.push(
      '<radialGradient id="' +
        id +
        '"><stop offset="0" stop-color="' +
        c +
        '" stop-opacity="' +
        o +
        '"/><stop offset="1" stop-color="' +
        c +
        '" stop-opacity="0"/></radialGradient>',
    );
    return 'url(#' + id + ')';
  }
  const sky = (...c) => '<rect x="20" y="48" width="260" height="352" fill="' + lg(c) + '"/>';
  const ground = (y, c) =>
    '<rect x="20" y="' + y + '" width="260" height="' + (400 - y) + '" fill="' + c + '"/>';
  function hill(y, c, amp = 14, ph = 0) {
    return (
      '<path d="M20 ' +
      y +
      'Q' +
      (85 + ph) +
      ' ' +
      (y - amp) +
      ' 150 ' +
      (y - 2) +
      'T280 ' +
      (y - 6) +
      'V400H20Z" fill="' +
      c +
      '"/>'
    );
  }
  function mountains(y, c, seed, h = 60) {
    const R = rng(seed);
    let p = 'M20 ' + y;
    let x = 20;
    while (x < 280) {
      const w = 34 + R() * 46;
      p +=
        'L' +
        f(x + w / 2) +
        ' ' +
        f(y - h * (0.55 + R() * 0.55)) +
        'L' +
        f(Math.min(280, x + w)) +
        ' ' +
        y;
      x += w;
    }
    return '<path d="' + p + 'V400H20Z" fill="' + c + '"/>';
  }
  function snowcaps(y, c, seed, h = 60) {
    /* same peaks with white caps */ const R = rng(seed);
    let p = '',
      x = 20;
    while (x < 280) {
      const w = 34 + R() * 46;
      const px = x + w / 2,
        py = y - h * (0.55 + R() * 0.55);
      const k = 0.22;
      p +=
        'M' +
        f(px) +
        ' ' +
        f(py) +
        'L' +
        f(px - (w / 2) * k) +
        ' ' +
        f(py + (y - py) * k) +
        'L' +
        f(px) +
        ' ' +
        f(py + (y - py) * k * 0.7) +
        'L' +
        f(px + (w / 2) * k) +
        ' ' +
        f(py + (y - py) * k) +
        'Z';
      x += w;
    }
    return '<path d="' + p + '" fill="' + c + '"/>';
  }
  function cloud(cx, cy, w, c = '#ffffff', o = 1) {
    const h = w * 0.36;
    return (
      '<g fill="' +
      c +
      '" opacity="' +
      o +
      '"><ellipse cx="' +
      cx +
      '" cy="' +
      cy +
      '" rx="' +
      f(w / 2) +
      '" ry="' +
      f(h / 2) +
      '"/><circle cx="' +
      f(cx - w * 0.22) +
      '" cy="' +
      f(cy - h * 0.3) +
      '" r="' +
      f(h * 0.5) +
      '"/><circle cx="' +
      f(cx + w * 0.1) +
      '" cy="' +
      f(cy - h * 0.48) +
      '" r="' +
      f(h * 0.68) +
      '"/><circle cx="' +
      f(cx + w * 0.3) +
      '" cy="' +
      f(cy - h * 0.2) +
      '" r="' +
      f(h * 0.45) +
      '"/></g>'
    );
  }
  function stars(n, seed, c = '#ffffff', y0 = 58, y1 = 210, x0 = 30, x1 = 270) {
    const R = rng(seed);
    let s = '';
    for (let i = 0; i < n; i++)
      s +=
        '<circle cx="' +
        f(x0 + R() * (x1 - x0)) +
        '" cy="' +
        f(y0 + R() * (y1 - y0)) +
        '" r="' +
        f(0.5 + R() * 1.3) +
        '" fill="' +
        c +
        '" opacity="' +
        f(0.45 + R() * 0.55) +
        '"/>';
    return s;
  }
  function star8(cx, cy, r, fill, k = 0.38, stroke) {
    let p = '';
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * i) / 8 - Math.PI / 2,
        rr = i % 2 ? r * k : r;
      p += (i ? 'L' : 'M') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a));
    }
    return (
      '<path d="' +
      p +
      'Z" fill="' +
      fill +
      '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="1"' : '') +
      '/>'
    );
  }
  function star5(cx, cy, r, fill, stroke) {
    let p = '';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      p += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
    }
    return (
      '<path d="' +
      p +
      'Z" fill="' +
      fill +
      '" stroke="' +
      (stroke || 'none') +
      '" stroke-width="1.2" stroke-linejoin="round"/>'
    );
  }
  function sun(cx, cy, r, face, core = '#f7c948', ray = '#e39b22') {
    let s =
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      f(r * 2.1) +
      '" fill="' +
      glow('#fff3b0', 0.7) +
      '"/>';
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24,
        a1 = r * 1.12,
        l = i % 2 ? r * 1.5 : r * 1.85;
      if (i % 2)
        s +=
          '<path d="M' +
          f(cx + Math.cos(a) * a1) +
          ' ' +
          f(cy + Math.sin(a) * a1) +
          'L' +
          f(cx + Math.cos(a) * l) +
          ' ' +
          f(cy + Math.sin(a) * l) +
          '" stroke="' +
          ray +
          '" stroke-width="2.4" stroke-linecap="round"/>';
      else {
        const b = a + 0.09,
          c2 = a - 0.09;
        s +=
          '<path d="M' +
          f(cx + Math.cos(b) * a1) +
          ' ' +
          f(cy + Math.sin(b) * a1) +
          'L' +
          f(cx + Math.cos(a) * l) +
          ' ' +
          f(cy + Math.sin(a) * l) +
          'L' +
          f(cx + Math.cos(c2) * a1) +
          ' ' +
          f(cy + Math.sin(c2) * a1) +
          'Z" fill="' +
          ray +
          '"/>';
      }
    }
    s +=
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="' +
      core +
      '" stroke="' +
      ray +
      '" stroke-width="2"/>';
    if (face)
      s +=
        '<path d="M' +
        f(cx - r * 0.42) +
        ' ' +
        f(cy - r * 0.12) +
        'q' +
        f(r * 0.14) +
        ' ' +
        f(-r * 0.14) +
        ' ' +
        f(r * 0.28) +
        ' 0M' +
        f(cx + r * 0.14) +
        ' ' +
        f(cy - r * 0.12) +
        'q' +
        f(r * 0.14) +
        ' ' +
        f(-r * 0.14) +
        ' ' +
        f(r * 0.28) +
        ' 0M' +
        f(cx - r * 0.3) +
        ' ' +
        f(cy + r * 0.3) +
        'q' +
        f(r * 0.3) +
        ' ' +
        f(r * 0.22) +
        ' ' +
        f(r * 0.6) +
        ' 0" stroke="#b5751c" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="' +
        f(cx - r * 0.5) +
        '" cy="' +
        f(cy + r * 0.15) +
        '" r="' +
        f(r * 0.1) +
        '" fill="#f0a24a" opacity=".6"/><circle cx="' +
        f(cx + r * 0.5) +
        '" cy="' +
        f(cy + r * 0.15) +
        '" r="' +
        f(r * 0.1) +
        '" fill="#f0a24a" opacity=".6"/>';
    return s;
  }
  function crescent(cx, cy, r, fill, k = 0.78) {
    return (
      '<path d="M' +
      cx +
      ' ' +
      f(cy - r) +
      'A' +
      r +
      ' ' +
      r +
      ' 0 1 0 ' +
      cx +
      ' ' +
      f(cy + r) +
      'A' +
      f(r * k) +
      ' ' +
      r +
      ' 0 1 1 ' +
      cx +
      ' ' +
      f(cy - r) +
      'Z" fill="' +
      fill +
      '"/>'
    );
  }
  function rose(x, y, r, c = '#b73b3b', d = '#7a1f1f') {
    return (
      '<circle cx="' +
      x +
      '" cy="' +
      y +
      '" r="' +
      r +
      '" fill="' +
      c +
      '"/><path d="M' +
      f(x - r * 0.5) +
      ' ' +
      y +
      'a' +
      f(r * 0.5) +
      ' ' +
      f(r * 0.5) +
      ' 0 1 1 ' +
      f(r * 0.5) +
      ' ' +
      f(r * 0.5) +
      '" stroke="' +
      d +
      '" stroke-width="1" fill="none"/>'
    );
  }
  function leaf(x, y, a, c = '#5d8a4e', l = 10) {
    return (
      '<ellipse cx="' +
      x +
      '" cy="' +
      y +
      '" rx="' +
      f(l / 2) +
      '" ry="' +
      f(l / 5) +
      '" transform="rotate(' +
      a +
      ' ' +
      x +
      ' ' +
      y +
      ')" fill="' +
      c +
      '"/>'
    );
  }
  function lily(x, y, s = 1) {
    return (
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') scale(' +
      s +
      ')"><path d="M0 0V-18" stroke="#5d8a4e" stroke-width="1.6"/><path d="M0 -18L-6 -28L-2 -20L0 -32L2 -20L6 -28Z" fill="#fbf8ef" stroke="#c8c0aa" stroke-width=".6"/>' +
      leaf(-4, -8, -40, '#5d8a4e', 9) +
      '</g>'
    );
  }
  function sunflower(x, y, s = 1) {
    let g =
      '<path d="M0 0V-34" stroke="#4f7a3e" stroke-width="2.4"/>' +
      leaf(-6, -14, -30, '#5d8a4e', 12) +
      leaf(6, -20, 30, '#5d8a4e', 12);
    for (let i = 0; i < 12; i++) {
      const a = i * 30;
      g +=
        '<ellipse cx="0" cy="-48" rx="3.2" ry="9" fill="#f2b71e" transform="rotate(' +
        a +
        ' 0 -40)"/>';
    }
    g += '<circle cx="0" cy="-40" r="6" fill="#6b4a2a"/>';
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + g + '</g>';
  }
  function wheat(x, y, h, c = '#d9a83f') {
    let s = '<path d="M' + x + ' ' + y + 'V' + (y - h) + '" stroke="#b8862f" stroke-width="1.3"/>';
    for (let i = 0; i < 5; i++)
      s +=
        leaf(x - 2.4, y - h + 3 + i * 4.6, -38, c, 7.5) +
        leaf(x + 2.4, y - h + 3 + i * 4.6, 38, c, 7.5);
    return s;
  }
  function cypress(x, y, h, c = '#2f5a3c') {
    return (
      '<path d="M' +
      x +
      ' ' +
      (y - h) +
      'Q' +
      f(x + h * 0.17) +
      ' ' +
      f(y - h * 0.45) +
      ' ' +
      x +
      ' ' +
      y +
      'Q' +
      f(x - h * 0.17) +
      ' ' +
      f(y - h * 0.45) +
      ' ' +
      x +
      ' ' +
      (y - h) +
      'Z" fill="' +
      c +
      '"/>'
    );
  }
  function tree(x, y, h, lc = '#3f6b45', tc = '#5c3d24', lc2) {
    return (
      '<path d="M' +
      (x - 3.5) +
      ' ' +
      y +
      'L' +
      (x - 2) +
      ' ' +
      f(y - h * 0.5) +
      'H' +
      (x + 2) +
      'L' +
      (x + 3.5) +
      ' ' +
      y +
      'Z" fill="' +
      tc +
      '"/><circle cx="' +
      x +
      '" cy="' +
      f(y - h * 0.62) +
      '" r="' +
      f(h * 0.3) +
      '" fill="' +
      lc +
      '"/><circle cx="' +
      f(x - h * 0.2) +
      '" cy="' +
      f(y - h * 0.52) +
      '" r="' +
      f(h * 0.2) +
      '" fill="' +
      lc +
      '"/><circle cx="' +
      f(x + h * 0.2) +
      '" cy="' +
      f(y - h * 0.55) +
      '" r="' +
      f(h * 0.21) +
      '" fill="' +
      (lc2 || lc) +
      '"/>'
    );
  }
  function pillar(x, top, w, c, cap, label, lc, bottom = 400) {
    return (
      '<rect x="' +
      x +
      '" y="' +
      top +
      '" width="' +
      w +
      '" height="' +
      (bottom - top) +
      '" fill="' +
      c +
      '"/><rect x="' +
      (x + w * 0.18) +
      '" y="' +
      top +
      '" width="' +
      f(w * 0.1) +
      '" height="' +
      (bottom - top) +
      '" fill="#ffffff" opacity=".12"/><rect x="' +
      (x - 5) +
      '" y="' +
      (top - 10) +
      '" width="' +
      (w + 10) +
      '" height="12" rx="2" fill="' +
      cap +
      '"/><rect x="' +
      (x - 2) +
      '" y="' +
      (top - 16) +
      '" width="' +
      (w + 4) +
      '" height="7" rx="2" fill="' +
      cap +
      '"/>' +
      (label
        ? '<text x="' +
          (x + w / 2) +
          '" y="' +
          (top + 42) +
          '" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="' +
          lc +
          '">' +
          label +
          '</text>'
        : '')
    );
  }
  function wand(x1, y1, x2, y2, c = '#8a5a33', w = 4) {
    return (
      '<path d="M' +
      x1 +
      ' ' +
      y1 +
      'L' +
      x2 +
      ' ' +
      y2 +
      '" stroke="' +
      c +
      '" stroke-width="' +
      w +
      '" stroke-linecap="round"/>'
    );
  }
  function cup(x, y, s = 1, c = '#e0bd5a', st = '#8a6d2f') {
    return (
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') scale(' +
      s +
      ')"><path d="M-11 -30H11Q11 -14 2.5 -9V-3H8V2H-8V-3H-2.5V-9Q-11 -14 -11 -30Z" fill="' +
      c +
      '" stroke="' +
      st +
      '" stroke-width="1.1" stroke-linejoin="round"/><path d="M-7 -26Q-7 -16 -2 -12" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none"/></g>'
    );
  }
  function jug(x, y, s = 1, a = 0, c = '#c24a3a') {
    return (
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') rotate(' +
      a +
      ') scale(' +
      s +
      ')"><path d="M-8 -20Q-12 -6 -8 4H8Q12 -6 8 -20L10 -24H-10Z" fill="' +
      c +
      '" stroke="#7a2a20" stroke-width="1"/><path d="M8 -16Q16 -12 9 -4" stroke="#7a2a20" stroke-width="1.6" fill="none"/></g>'
    );
  }
  function sword(x, y, len, ang, c = '#d4d9e0') {
    return (
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') rotate(' +
      ang +
      ')"><path d="M-2.6 0V-' +
      len +
      'L0 -' +
      (len + 9) +
      'L2.6 -' +
      len +
      'V0Z" fill="' +
      c +
      '" stroke="#6b7280" stroke-width=".8"/><path d="M0 -4V-' +
      (len - 2) +
      '" stroke="#9aa2ad" stroke-width=".8"/><rect x="-10" y="-1.5" width="20" height="4.5" rx="1.5" fill="#d8b45a" stroke="#8a6d2f" stroke-width=".6"/><rect x="-2.2" y="3" width="4.4" height="13" rx="1" fill="#6b4a2a"/><circle cx="0" cy="17.5" r="2.8" fill="#d8b45a"/></g>'
    );
  }
  function coin(cx, cy, r) {
    return (
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      r +
      '" fill="#e3bf5c" stroke="#8a6d2f" stroke-width="1.2"/><circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="' +
      f(r * 0.8) +
      '" fill="none" stroke="#8a6d2f" stroke-width=".6"/>' +
      star5(cx, cy, r * 0.66, 'none', '#8a6d2f')
    );
  }
  function inf(cx, cy, w, c = '#d8b45a', sw = 3) {
    const h = w / 2.2;
    return (
      '<path d="M' +
      cx +
      ' ' +
      cy +
      'C' +
      f(cx - w * 0.2) +
      ' ' +
      f(cy - h) +
      ' ' +
      f(cx - w * 0.5) +
      ' ' +
      f(cy - h) +
      ' ' +
      f(cx - w * 0.5) +
      ' ' +
      cy +
      'S' +
      f(cx - w * 0.2) +
      ' ' +
      f(cy + h) +
      ' ' +
      cx +
      ' ' +
      cy +
      'S' +
      f(cx + w * 0.5) +
      ' ' +
      f(cy - h) +
      ' ' +
      f(cx + w * 0.5) +
      ' ' +
      cy +
      'S' +
      f(cx + w * 0.2) +
      ' ' +
      f(cy + h) +
      ' ' +
      cx +
      ' ' +
      cy +
      'Z" stroke="' +
      c +
      '" stroke-width="' +
      sw +
      '" fill="none"/>'
    );
  }
  function brick(x, y, w, h, c = '#9a8f7c', line = '#7f7563', rowH = 10) {
    let s =
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
    for (let r = 0; r * rowH < h; r++) {
      const yy = y + r * rowH;
      s +=
        '<path d="M' + x + ' ' + yy + 'H' + (x + w) + '" stroke="' + line + '" stroke-width=".7"/>';
      for (let xx = x + (r % 2 ? 10 : 0); xx < x + w; xx += 20)
        s +=
          '<path d="M' +
          xx +
          ' ' +
          yy +
          'V' +
          Math.min(y + h, yy + rowH) +
          '" stroke="' +
          line +
          '" stroke-width=".7"/>';
    }
    return s;
  }
  function waterLines(y0, y1, c = '#ffffff', o = 0.35, seed = 3) {
    const R = rng(seed);
    let s = '';
    for (let i = 0; i < 10; i++) {
      const y = y0 + R() * (y1 - y0),
        x = 28 + R() * 220;
      s +=
        '<path d="M' +
        f(x) +
        ' ' +
        f(y) +
        'h' +
        f(10 + R() * 20) +
        '" stroke="' +
        c +
        '" stroke-opacity="' +
        o +
        '" stroke-width="1.4" stroke-linecap="round"/>';
    }
    return s;
  }
  const POSE = {
    down: [
      [-21, -48],
      [21, -48],
    ],
    up: [
      [-21, -50],
      [24, -132],
    ],
    out: [
      [-46, -78],
      [46, -78],
    ],
    hold: [
      [-9, -60],
      [9, -60],
    ],
    pour: [
      [-36, -98],
      [36, -56],
    ],
    raise2: [
      [-30, -130],
      [30, -130],
    ],
    bless: [
      [-12, -60],
      [24, -114],
    ],
    lantern: [
      [-26, -54],
      [32, -104],
    ],
    walk: [
      [-26, -54],
      [28, -108],
    ],
    regal: [
      [-28, -66],
      [28, -98],
    ],
    justice: [
      [-36, -72],
      [24, -112],
    ],
    reach: [
      [-16, -58],
      [36, -74],
    ],
    back: [
      [-9, -70],
      [9, -70],
    ],
    dance: [
      [-46, -96],
      [44, -58],
    ],
    bless2: [
      [-32, -66],
      [24, -114],
    ],
    temper: [
      [-32, -86],
      [30, -58],
    ],
  };
  function person(o) {
    const s = o.s || 1,
      x = o.x,
      y = o.y,
      robe = o.robe || '#3d5a80',
      trim = o.trim || '#d8b45a',
      skin = o.skin || '#efd0ad',
      hair = o.hair || '#2a1d14';
    const pose = POSE[o.pose || 'down'];
    let g = '';
    if (o.wings)
      g +=
        '<path d="M-12 -86C-58 -132 -92 -74 -62 -22C-50 -46 -36 -64 -12 -72Z" fill="' +
        o.wings +
        '"/><path d="M-14 -82C-48 -112 -74 -72 -58 -36" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none"/><path d="M12 -86C58 -132 92 -74 62 -22C50 -46 36 -64 12 -72Z" fill="' +
        o.wings +
        '"/><path d="M14 -82C48 -112 74 -72 58 -36" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none"/>';
    if (o.halo)
      g +=
        '<circle cx="0" cy="-112" r="22" fill="' +
        o.halo +
        '" opacity=".28"/><circle cx="0" cy="-112" r="22" fill="none" stroke="' +
        o.halo +
        '" stroke-width="2.2"/>';
    if (o.cape)
      g +=
        '<path d="M-16 -88Q-30 -40 -36 2H36Q30 -40 16 -88Z" fill="' +
        o.cape +
        '"/><path d="M-22 -40Q-26 -18 -30 0M22 -40Q26 -18 30 0" stroke="#000" stroke-opacity=".15" stroke-width="1.4" fill="none"/>';
    if (o.long)
      g +=
        '<path d="M-14 -116Q-19 -94 -16 -84H-8Q-12 -98 -11 -114ZM14 -116Q19 -94 16 -84H8Q12 -98 11 -114Z" fill="' +
        hair +
        '"/>';
    g += '<path d="M-24 0Q-21 -48 -16 -86Q0 -96 16 -86Q21 -48 24 0Z" fill="' + robe + '"/>';
    if (o.pattern) g += o.pattern;
    g +=
      '<path d="M-9 -46Q-12 -22 -15 -3M9 -46Q12 -22 15 -3M0 -54V-3" stroke="#000" stroke-opacity=".13" stroke-width="1.4" fill="none"/>';
    g +=
      '<path d="M-24 0Q-21 -48 -16 -86" stroke="#000" stroke-opacity=".12" stroke-width="3" fill="none"/>';
    g +=
      '<rect x="-24.5" y="-7" width="49" height="7" fill="' +
      trim +
      '"/><path d="M-24.5 -3.5H24.5" stroke="#000" stroke-opacity=".15" stroke-dasharray="2 3"/><rect x="-17" y="-64" width="34" height="4.5" rx="1" fill="' +
      (o.belt || trim) +
      '"/><path d="M-8 -90Q0 -80 8 -90" stroke="' +
      trim +
      '" stroke-width="2.4" fill="none"/>';
    if (o.chest) g += o.chest;
    pose.forEach(([hx, hy], i) => {
      const sx = i ? 14 : -14;
      const mx = f((sx + hx) / 2 + (i ? 3 : -3)),
        my = f((-84 + hy) / 2);
      g +=
        '<path d="M' +
        sx +
        ' -84Q' +
        mx +
        ' ' +
        my +
        ' ' +
        hx +
        ' ' +
        hy +
        '" stroke="' +
        (o.sleeve || robe) +
        '" stroke-width="10.5" stroke-linecap="round" fill="none"/><path d="M' +
        sx +
        ' -84Q' +
        mx +
        ' ' +
        my +
        ' ' +
        hx +
        ' ' +
        hy +
        '" stroke="#000" stroke-opacity=".1" stroke-width="10.5" stroke-dasharray="0 6 30" fill="none"/><circle cx="' +
        hx +
        '" cy="' +
        hy +
        '" r="4.8" fill="' +
        skin +
        '"/>';
    });
    g +=
      '<path d="M-4 -101H4V-90H-4Z" fill="' +
      skin +
      '"/><path d="M-4 -94H4" stroke="#000" stroke-opacity=".12"/><ellipse cx="0" cy="-112" rx="12.5" ry="13.5" fill="' +
      skin +
      '"/>';
    g +=
      '<path d="M-13.5 -110Q-15.5 -129 0 -128Q15.5 -129 13.5 -110Q10 -121 2 -121Q-4 -117 -13.5 -110Z" fill="' +
      hair +
      '"/>';
    if (o.beard)
      g +=
        '<path d="M-11 -110Q-12 -84 0 -78Q12 -84 11 -110Q6 -101 0 -102Q-6 -101 -11 -110Z" fill="' +
        o.beard +
        '"/><path d="M-6 -104Q0 -107 6 -104" stroke="' +
        o.beard +
        '" stroke-width="2.4" fill="none"/>';
    g +=
      '<path d="M-7 -113.5Q-4.6 -115.5 -2.2 -113.5M2.2 -113.5Q4.6 -115.5 7 -113.5" stroke="#3a2a20" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
    if (o.eyesOpen)
      g +=
        '<circle cx="-4.6" cy="-112" r="1.4" fill="#3a2a20"/><circle cx="4.6" cy="-112" r="1.4" fill="#3a2a20"/>';
    if (!o.beard)
      g +=
        '<path d="M-2.8 -105Q0 -103.2 2.8 -105" stroke="#a0624a" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="-7" cy="-107" r="2" fill="#e6a08a" opacity=".45"/><circle cx="7" cy="-107" r="2" fill="#e6a08a" opacity=".45"/>';
    if (o.hood)
      g +=
        '<path d="M-17 -98Q-21 -138 0 -138Q21 -138 17 -98Q14 -124 0 -125Q-14 -124 -17 -98Z" fill="' +
        o.hood +
        '"/>';
    if (o.crown)
      g +=
        '<path d="M-12.5 -121V-134L-6 -128L0 -140L6 -128L12.5 -134V-121Z" fill="' +
        o.crown +
        '" stroke="#8a6d2f" stroke-width=".8" stroke-linejoin="round"/><circle cx="0" cy="-127" r="1.8" fill="#b73b3b"/>';
    if (o.tiara)
      g +=
        '<path d="M-11 -122V-146Q0 -160 11 -146V-122Z" fill="' +
        o.tiara +
        '" stroke="#8a6d2f" stroke-width=".8"/><path d="M-11 -130H11M-11 -138H11" stroke="#8a6d2f" stroke-width="1.6"/><path d="M0 -156V-163M-3 -160H3" stroke="#8a6d2f" stroke-width="1.4"/>';
    if (o.wreath)
      g +=
        '<path d="M-14 -119Q0 -129 14 -119" stroke="' +
        o.wreath +
        '" stroke-width="4" fill="none" stroke-dasharray="3.5 2" stroke-linecap="round"/>';
    if (o.hat) g += o.hat;
    const H = pose.map(([hx, hy]) => [f(x + hx * s), f(y + hy * s)]);
    return {
      svg: '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + g + '</g>',
      L: H[0],
      R: H[1],
      head: [x, f(y - 112 * s)],
    };
  }
  function backFig(x, y, s, robe, hair, pattern = '') {
    return (
      '<g transform="translate(' +
      x +
      ' ' +
      y +
      ') scale(' +
      s +
      ')"><path d="M-26 0Q-24 -46 -16 -78Q0 -88 16 -78Q24 -46 26 0Z" fill="' +
      robe +
      '"/>' +
      pattern +
      '<path d="M-9 -40Q-12 -20 -14 0M9 -40Q12 -20 14 0" stroke="#000" stroke-opacity=".14" stroke-width="1.4" fill="none"/><ellipse cx="0" cy="-92" rx="12" ry="13" fill="' +
      hair +
      '"/><path d="M-10 -84H10" stroke="#000" stroke-opacity=".15"/></g>'
    );
  }
  function quad(o) {
    const s = o.s || 1,
      c = o.c || '#f4f1ea',
      d = o.dir || 1,
      sh = o.shade || '#000';
    let g = '';
    g +=
      '<path d="M-28 -32Q-44 -40 -40 -58" stroke="' +
      c +
      '" stroke-width="' +
      (o.lion ? 3.5 : 4.5) +
      '" fill="none" stroke-linecap="round"/>' +
      (o.lion ? '<circle cx="-40" cy="-58" r="4" fill="' + (o.mane || c) + '"/>' : '');
    if (o.lying)
      g +=
        '<ellipse cx="-14" cy="-6" rx="16" ry="6" fill="' +
        c +
        '"/><ellipse cx="20" cy="-5" rx="16" ry="5" fill="' +
        c +
        '"/>';
    else
      [
        [-22, -1],
        [-12, 1],
        [12, -1],
        [22, 1],
      ].forEach(([lx, dx]) => {
        g +=
          '<path d="M' +
          lx +
          ' -20L' +
          (lx + dx) +
          ' -1" stroke="' +
          c +
          '" stroke-width="7" stroke-linecap="round"/><path d="M' +
          (lx + dx - 3) +
          ' -1H' +
          (lx + dx + 4) +
          '" stroke="' +
          sh +
          '" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>';
      });
    g +=
      '<ellipse cx="0" cy="' +
      (o.lying ? -18 : -28) +
      '" rx="31" ry="14" fill="' +
      c +
      '"/><path d="M-26 ' +
      (o.lying ? -12 : -22) +
      'Q0 ' +
      (o.lying ? -4 : -14) +
      ' 26 ' +
      (o.lying ? -12 : -22) +
      '" stroke="' +
      sh +
      '" stroke-opacity=".15" stroke-width="2" fill="none"/>';
    const hy = o.lying ? -44 : -56;
    g +=
      '<path d="M20 ' +
      (hy + 22) +
      'L32 ' +
      (hy + 4) +
      '" stroke="' +
      c +
      '" stroke-width="15" stroke-linecap="round"/>';
    if (o.mane) {
      for (let i = 0; i < 14; i++) {
        const a = (i * Math.PI * 2) / 14;
        g +=
          '<ellipse cx="' +
          f(36 + Math.cos(a) * 13) +
          '" cy="' +
          f(hy + Math.sin(a) * 13) +
          '" rx="7" ry="4.5" transform="rotate(' +
          f((a * 180) / Math.PI) +
          ' ' +
          f(36 + Math.cos(a) * 13) +
          ' ' +
          f(hy + Math.sin(a) * 13) +
          ')" fill="' +
          o.mane +
          '"/>';
      }
    }
    g +=
      '<ellipse cx="38" cy="' +
      hy +
      '" rx="' +
      (o.lion ? 11 : 10) +
      '" ry="' +
      (o.lion ? 10 : 8.5) +
      '" fill="' +
      c +
      '"/><path d="M44 ' +
      (hy - 3) +
      'Q55 ' +
      hy +
      ' 53 ' +
      (hy + 4) +
      'Q48 ' +
      (hy + 7) +
      ' 42 ' +
      (hy + 5) +
      'Z" fill="' +
      c +
      '"/><circle cx="53" cy="' +
      (hy + 1.5) +
      '" r="1.8" fill="#2b2420"/>';
    if (!o.lion)
      g +=
        '<path d="M32 ' +
        (hy - 6) +
        'L28 ' +
        (hy - 17) +
        'L37 ' +
        (hy - 8) +
        'Z" fill="' +
        (o.ear || c) +
        '"/>';
    else g += '<circle cx="31" cy="' + (hy - 9) + '" r="3.5" fill="' + c + '"/>';
    g += '<circle cx="42" cy="' + (hy - 2.5) + '" r="1.6" fill="#2b2420"/>';
    if (o.collar)
      g +=
        '<path d="M24 ' +
        (hy + 12) +
        'L34 ' +
        (hy + 16) +
        '" stroke="' +
        o.collar +
        '" stroke-width="3"/>';
    return (
      '<g transform="translate(' +
      o.x +
      ' ' +
      o.y +
      ') scale(' +
      f(s * d) +
      ' ' +
      s +
      ')">' +
      g +
      '</g>'
    );
  }
  function rider(o) {
    const sc = o.s || 1;
    let g = '';
    if (o.lamp) g += '<path d="M36 -68L150 -100L150 -26Z" fill="' + glow(o.lamp, 0.55) + '"/>';
    [
      [-40, -24],
      [40, -24],
    ].forEach(([wx, wy]) => {
      g +=
        '<circle cx="' +
        wx +
        '" cy="' +
        wy +
        '" r="22" fill="none" stroke="#17171c" stroke-width="5"/><circle cx="' +
        wx +
        '" cy="' +
        wy +
        '" r="19" fill="none" stroke="#9aa2ad" stroke-width=".8" stroke-dasharray="1 5"/><circle cx="' +
        wx +
        '" cy="' +
        wy +
        '" r="3.2" fill="#9aa2ad"/>';
    });
    g +=
      '<path d="M-40 -24L-10 -24L20 -60M-10 -24L-20 -62L20 -60L40 -24M-27 -64H-12M20 -60L24 -74H34" stroke="' +
      (o.frame || '#9b2c2c') +
      '" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    g += '<path d="M-10 -24L-4 -14" stroke="#555" stroke-width="2"/>';
    g +=
      '<rect x="-50" y="-132" width="38" height="42" rx="5" fill="' +
      (o.bag || '#2b2a28') +
      '"/><rect x="-50" y="-118" width="38" height="6" fill="#000" opacity=".22"/><rect x="-46" y="-128" width="12" height="6" rx="2" fill="#fff" opacity=".25"/>';
    g +=
      '<path d="M-16 -70L6 -48L-2 -30" stroke="' +
      (o.pants || '#2a2a33') +
      '" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 -30H4" stroke="#17171c" stroke-width="4" stroke-linecap="round"/>';
    g +=
      '<path d="M-22 -66L-6 -114Q4 -118 14 -110L4 -66Z" fill="' +
      (o.coat || '#e8c23a') +
      '"/><path d="M-12 -92L6 -88" stroke="#000" stroke-opacity=".15" stroke-width="2"/>';
    g +=
      '<path d="M6 -106Q20 -96 33 -74" stroke="' +
      (o.coat || '#e8c23a') +
      '" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="34" cy="-73" r="4.4" fill="#efd0ad"/>';
    g +=
      '<ellipse cx="16" cy="-122" rx="10" ry="10.5" fill="#efd0ad"/><circle cx="21" cy="-123" r="1.3" fill="#3a2a20"/><path d="M4 -122Q4 -138 18 -138Q30 -137 30 -124Q22 -128 4 -122Z" fill="' +
      (o.helmet || '#2b2a28') +
      '"/><path d="M8 -132Q18 -136 26 -130" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" fill="none"/>';
    if (o.hood)
      g +=
        '<path d="M2 -118Q0 -140 16 -142Q32 -142 32 -124" stroke="' +
        o.hood +
        '" stroke-width="4" fill="none"/>';
    return '<g transform="translate(' + o.x + ' ' + o.y + ') scale(' + sc + ')">' + g + '</g>';
  }
  function runner(o) {
    let g = '';
    const sk = '#efd0ad';
    g +=
      '<path d="M-2 -62L-16 -38L-34 -36" stroke="' +
      (o.shorts || '#2b2a28') +
      '" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-16 -38L-34 -36" stroke="' +
      sk +
      '" stroke-width="7" stroke-linecap="round"/><path d="M-40 -40L-30 -33" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/>';
    g +=
      '<path d="M-6 -88Q-18 -76 -10 -66" stroke="' +
      sk +
      '" stroke-width="6" fill="none" stroke-linecap="round"/>';
    g +=
      '<path d="M-6 -60L-2 -108Q8 -112 16 -104L8 -60Z" fill="' +
      (o.shirt || '#9b2c2c') +
      '"/><path d="M-6 -66H8" stroke="' +
      (o.shorts || '#2b2a28') +
      '" stroke-width="10"/>';
    g +=
      '<path d="M2 -60L20 -38L12 -6" stroke="' +
      sk +
      '" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 -62L18 -42" stroke="' +
      (o.shorts || '#2b2a28') +
      '" stroke-width="10" stroke-linecap="round"/><path d="M8 -4H22" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/>';
    g +=
      '<path d="M10 -100L24 -86L32 -98" stroke="' +
      sk +
      '" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 -102L20 -90" stroke="' +
      (o.shirt || '#9b2c2c') +
      '" stroke-width="8" stroke-linecap="round"/>';
    g +=
      '<ellipse cx="14" cy="-120" rx="10" ry="11" fill="' +
      sk +
      '"/><path d="M3 -121Q3 -134 16 -133Q25 -132 24 -123Q16 -126 3 -121Z" fill="#2a1d14"/><path d="M4 -124L24 -126" stroke="' +
      (o.band || '#f4f1ea') +
      '" stroke-width="2.4"/><circle cx="19" cy="-119" r="1.3" fill="#3a2a20"/>';
    return (
      '<g transform="translate(' + o.x + ' ' + o.y + ') scale(' + (o.s || 1) + ')">' + g + '</g>'
    );
  }
  function skyline(base, c, seed, win, hMax = 90) {
    const R = rng(seed);
    let s = '',
      x = 20;
    while (x < 280) {
      const w = 14 + R() * 22,
        h = 30 + R() * hMax;
      s +=
        '<rect x="' +
        f(x) +
        '" y="' +
        f(base - h) +
        '" width="' +
        f(w) +
        '" height="' +
        f(h) +
        '" fill="' +
        c +
        '"/>';
      if (win) {
        for (let wy = base - h + 6; wy < base - 6; wy += 9)
          for (let wx = x + 3; wx < x + w - 4; wx += 6)
            if (R() < 0.35)
              s +=
                '<rect x="' +
                f(wx) +
                '" y="' +
                f(wy) +
                '" width="2.6" height="3.6" fill="' +
                win +
                '" opacity="' +
                f(0.5 + R() * 0.5) +
                '"/>';
      }
      x += w + R() * 3;
    }
    return s;
  }
  function rain(n, seed, c = '#a9c6e6', o = 0.55) {
    const R = rng(seed);
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = 20 + R() * 270,
        y = 48 + R() * 350,
        l = 10 + R() * 12;
      s +=
        '<path d="M' +
        f(x) +
        ' ' +
        f(y) +
        'l' +
        f(-l * 0.35) +
        ' ' +
        f(l) +
        '" stroke="' +
        c +
        '" stroke-opacity="' +
        f(o * (0.5 + R() * 0.5)) +
        '" stroke-width="1.2" stroke-linecap="round"/>';
    }
    return s;
  }
  function sparks(n, seed, c, x0, x1, y0, y1) {
    const R = rng(seed);
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0),
        y = y0 + R() * (y1 - y0);
      s +=
        '<path d="M' +
        f(x) +
        ' ' +
        f(y) +
        'q2.5 4 0 7q-2.5 -3 0 -7Z" fill="' +
        c +
        '" transform="rotate(' +
        f(R() * 40 - 20) +
        ' ' +
        f(x) +
        ' ' +
        f(y) +
        ')"/>';
    }
    return s;
  }
  return {
    begin,
    definitions,
    f,
    rng,
    lg,
    glow,
    sky,
    ground,
    hill,
    mountains,
    snowcaps,
    cloud,
    stars,
    star8,
    star5,
    sun,
    crescent,
    rose,
    leaf,
    lily,
    sunflower,
    wheat,
    cypress,
    tree,
    pillar,
    wand,
    cup,
    jug,
    sword,
    coin,
    inf,
    brick,
    waterLines,
    POSE,
    person,
    backFig,
    quad,
    rider,
    runner,
    skyline,
    rain,
    sparks,
  };
}
