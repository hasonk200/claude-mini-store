export function createHiddenScenes(primitives) {
  const {
    f,
    rng,
    glow,
    sky,
    stars,
    crescent,
    brick,
    waterLines,
    person,
    rider,
    runner,
    skyline,
    rain,
  } = primitives;
  const SC = {};
  SC.h1 = () => {
    let s = sky('#18242f', '#34495f');
    s += skyline(300, '#121b26', 61, '#e9c46a', 110);
    s += '<rect x="20" y="300" width="260" height="100" fill="#1f2731"/>';
    const R = rng(5);
    for (let i = 0; i < 14; i++) {
      const x = 24 + R() * 250,
        w = 8 + R() * 30;
      s +=
        '<path d="M' +
        f(x) +
        ' ' +
        f(320 + R() * 70) +
        'h' +
        f(w) +
        '" stroke="' +
        (R() < 0.5 ? '#e9c46a' : '#c64b3a') +
        '" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>';
    }
    s += '<ellipse cx="150" cy="386" rx="80" ry="7" fill="#2c3846"/>';
    s += rider({
      x: 150,
      y: 380,
      s: 1.15,
      coat: '#e8c23a',
      bag: '#2b2a28',
      frame: '#9b2c2c',
      helmet: '#2b2a28',
      hood: '#c9a42a',
      pants: '#2a2a33',
    });
    s += rain(90, 19, '#b7d2ee', 0.6);
    s +=
      '<g stroke="#b7d2ee" stroke-opacity=".5" fill="none"><ellipse cx="66" cy="384" rx="10" ry="2.4"/><ellipse cx="236" cy="372" rx="12" ry="2.6"/><ellipse cx="200" cy="394" rx="8" ry="2"/></g>';
    return s;
  };
  SC.h2 = () => {
    let s = sky('#0b1130', '#2a3366');
    s += stars(40, 71, '#ffffff', 58, 200);
    s += crescent(226, 92, 18, '#f3e6b4');
    s +=
      '<rect x="92" y="96" width="4" height="60" fill="#151a38"/><circle cx="94" cy="94" r="2.2" fill="#e05a4a"/><ellipse cx="94" cy="166" rx="14" ry="7" fill="#151a38"/><rect x="84" y="172" width="20" height="4" fill="#151a38"/><path d="M90 176L86 320H102L98 176Z" fill="#151a38"/><ellipse cx="94" cy="166" rx="14" ry="2" fill="#f2c94a" opacity=".6"/>';
    s += skyline(320, '#121735', 73, '#f2c94a', 90);
    s +=
      '<rect x="20" y="320" width="260" height="80" fill="#1a1e33"/><path d="M20 356H280" stroke="#f2c94a" stroke-opacity=".5" stroke-width="2" stroke-dasharray="14 10"/>';
    [
      [44, 236],
      [256, 236],
    ].forEach(([x, y]) => {
      s +=
        '<path d="M' +
        x +
        ' 322V' +
        y +
        'Q' +
        x +
        ' ' +
        (y - 8) +
        ' ' +
        (x + (x < 150 ? 10 : -10)) +
        ' ' +
        (y - 8) +
        '" stroke="#3a3f5c" stroke-width="3" fill="none"/><circle cx="' +
        (x + (x < 150 ? 12 : -12)) +
        '" cy="' +
        (y - 4) +
        '" r="26" fill="' +
        glow('#ffe7a0', 0.6) +
        '"/><circle cx="' +
        (x + (x < 150 ? 12 : -12)) +
        '" cy="' +
        (y - 5) +
        '" r="3.2" fill="#fff3c4"/>';
    });
    s += rider({
      x: 150,
      y: 388,
      s: 1.05,
      coat: '#3d4658',
      bag: '#b3352b',
      frame: '#c9a24a',
      helmet: '#d9d3c5',
      lamp: '#fff3b0',
      pants: '#20232e',
    });
    return s;
  };
  SC.h3 = () => {
    let s = sky('#6a2416', '#b4502a');
    s += brick(20, 48, 260, 352, '#8a3a24', '#6e2c1a', 14);
    s += '<rect x="20" y="48" width="260" height="352" fill="#000" opacity=".12"/>';
    [
      ['上天言好事', 248],
      ['下界保平安', 52],
    ].forEach(([t, x]) => {
      s +=
        '<rect x="' +
        (x - 14) +
        '" y="70" width="28" height="200" fill="#c4302b" stroke="#e0bd5a" stroke-width="1.6"/>';
      t.split('').forEach((ch, i) => {
        s +=
          '<text x="' +
          x +
          '" y="' +
          (102 + i * 36) +
          '" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="20" font-weight="600" fill="#f2d36b">' +
          ch +
          '</text>';
      });
    });
    s +=
      '<rect x="114" y="66" width="72" height="24" fill="#c4302b" stroke="#e0bd5a" stroke-width="1.4"/><text x="150" y="84" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="15" font-weight="600" fill="#f2d36b" letter-spacing="2">一家之主</text>';
    const p = person({
      x: 150,
      y: 324,
      s: 0.98,
      pose: 'hold',
      robe: '#b3352b',
      cape: '#7a1f1f',
      trim: '#e0bd5a',
      beard: '#2a1d14',
      hair: '#2a1d14',
      hat: '<path d="M-15 -121H15V-131Q0 -141 -15 -131Z" fill="#1d1d22"/><path d="M-15 -127H-32M15 -127H32" stroke="#1d1d22" stroke-width="4" stroke-linecap="round"/>',
      chest: '<rect x="-10" y="-82" width="20" height="18" fill="#e0bd5a" opacity=".85"/>',
    });
    s +=
      p.svg +
      '<rect x="' +
      f(p.L[0] - 2) +
      '" y="' +
      f(p.L[1] - 26) +
      '" width="22" height="34" rx="3" fill="#e9dcc0" stroke="#8a6d2f"/>';
    s +=
      '<path d="M98 252Q92 236 100 226Q104 240 110 236Q106 248 98 252ZM196 248Q190 234 196 222Q202 236 206 232Q204 246 196 248Z" fill="#fbf3dc" opacity=".5"/>';
    s += brick(62, 300, 176, 100, '#7d6a58', '#5f5042', 12);
    s += '<rect x="56" y="292" width="188" height="12" fill="#5f5042"/>';
    s +=
      '<path d="M90 292Q150 326 210 292Z" fill="#2b2a28"/><path d="M90 292H210" stroke="#55534f" stroke-width="2"/>';
    s +=
      '<path d="M122 286Q114 268 124 252Q130 266 128 286M150 286Q142 262 152 244Q158 262 156 286M176 286Q170 268 178 254Q184 268 180 286" stroke="#fbf3dc" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>';
    s +=
      '<path d="M124 350H176V400H124Z" fill="#241a14"/><path d="M130 400Q134 368 146 360Q144 380 152 384Q154 364 166 358Q164 384 170 400Z" fill="#f08c2e"/><path d="M140 400Q144 384 150 380Q152 390 158 400Z" fill="#f6d34a"/>';
    return s;
  };
  SC.h4 = () => {
    let s = sky('#ee9b55', '#f9dcae');
    s +=
      '<circle cx="212" cy="258" r="70" fill="' +
      glow('#fff0b0', 0.6) +
      '"/><circle cx="212" cy="262" r="24" fill="#f9e2a0"/>';
    s += skyline(270, '#8a7489', 91, null, 40);
    s +=
      '<rect x="20" y="268" width="260" height="62" fill="#6d9cc4"/>' +
      waterLines(272, 326, '#ffe6b8', 0.55, 91);
    s +=
      '<path d="M20 400V336Q150 318 280 332V400Z" fill="#c7b186"/><path d="M20 352Q150 338 280 350" stroke="#ad9870" stroke-width="2" fill="none"/>';
    for (let i = 0; i < 10; i++)
      s +=
        '<path d="M' +
        (26 + i * 28) +
        ' 400q2 -12 6 -16M' +
        (30 + i * 28) +
        ' 400q0 -10 -4 -14" stroke="#6f8c56" stroke-width="2" fill="none"/>';
    s += runner({ x: 140, y: 388, s: 1.35, shirt: '#9b2c2c', shorts: '#2b2a28' });
    s +=
      '<path d="M86 360h-30M92 340h-24M80 320h-18" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>';
    return s;
  };
  return SC;
}
