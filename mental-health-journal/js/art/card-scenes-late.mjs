export function createLateScenes(primitives) {
  const {
    f,
    glow,
    sky,
    ground,
    hill,
    mountains,
    snowcaps,
    cloud,
    stars,
    star8,
    sun,
    crescent,
    rose,
    leaf,
    sunflower,
    tree,
    pillar,
    wand,
    cup,
    jug,
    sword,
    brick,
    waterLines,
    person,
    quad,
    sparks,
  } = primitives;
  const SC = {};
  SC.c10 = () => {
    let s = sky('#6c9fc4', '#c2dcea');
    [
      [56, 96],
      [244, 96],
      [56, 366],
      [244, 366],
    ].forEach(([x, y], i) => {
      s += cloud(x, y, 74, '#ffffff');
      s +=
        '<g transform="translate(' +
        x +
        ' ' +
        (y - 14) +
        ')"><path d="M-12 0Q-6 -4 0 0Q6 -4 12 0V10Q6 6 0 10Q-6 6 -12 10Z" fill="#fbf8ef" stroke="#8a6d2f" stroke-width=".9"/><path d="M0 0V10" stroke="#8a6d2f" stroke-width=".9"/></g>';
    });
    const cx = 150,
      cy = 226;
    s +=
      '<circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="86" fill="#e19a45" stroke="#8a5a2c" stroke-width="2"/><circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="66" fill="#f3d58c" stroke="#8a5a2c" stroke-width="1.6"/><circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="30" fill="#e19a45" stroke="#8a5a2c" stroke-width="1.4"/><circle cx="' +
      cx +
      '" cy="' +
      cy +
      '" r="9" fill="#f3d58c" stroke="#8a5a2c" stroke-width="1.2"/>';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      s +=
        '<path d="M' +
        f(cx + Math.cos(a) * 9) +
        ' ' +
        f(cy + Math.sin(a) * 9) +
        'L' +
        f(cx + Math.cos(a) * 66) +
        ' ' +
        f(cy + Math.sin(a) * 66) +
        '" stroke="#8a5a2c" stroke-width="2"/>';
    }
    'TAROTARO'.split('').forEach((ch, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 4;
      s +=
        '<text x="' +
        f(cx + Math.cos(a) * 76) +
        '" y="' +
        f(cy + Math.sin(a) * 76 + 5) +
        '" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#5e3a18">' +
        ch +
        '</text>';
    });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 2;
      s +=
        '<circle cx="' +
        f(cx + Math.cos(a) * 46) +
        '" cy="' +
        f(cy + Math.sin(a) * 46) +
        '" r="5" fill="none" stroke="#8a5a2c" stroke-width="1.6"/>';
    }
    s +=
      '<path d="M64 156q16 22 0 44t0 44t0 44" stroke="#e2b84a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M58 150l6 -8l6 8z" fill="#e2b84a"/>';
    s += quad({ x: 136, y: 142, s: 0.5, c: '#4a78a8', lying: 1, dir: 1 }) + sword(162, 134, 20, 0);
    s += person({ x: 246, y: 316, s: 0.5, pose: 'raise2', robe: '#b3352b', hair: '#3a2618' }).svg;
    return s;
  };
  SC.c11 = () => {
    let s = sky('#e6be62', '#f2d995');
    s +=
      '<rect x="66" y="84" width="168" height="290" fill="#6b3a6b"/><path d="M82 84V374M110 84V374M190 84V374M218 84V374" stroke="#000" stroke-opacity=".18" stroke-width="3"/>';
    s += pillar(40, 104, 28, '#8d877a', '#a39d90') + pillar(232, 104, 28, '#8d877a', '#a39d90');
    s += '<rect x="102" y="170" width="96" height="200" rx="6" fill="#a39d90"/>';
    s +=
      '<rect x="20" y="372" width="260" height="28" fill="#c5bca8"/><path d="M20 386H280" stroke="#a89e88"/>';
    const p = person({
      x: 150,
      y: 376,
      s: 1.12,
      pose: 'justice',
      robe: '#b3352b',
      cape: '#4f7a52',
      trim: '#d8b45a',
      crown: '#d8b45a',
      hair: '#8a5326',
      long: 1,
      chest: '<rect x="-5" y="-84" width="10" height="10" rx="2" fill="#d8b45a"/>',
    });
    s += p.svg + sword(p.R[0], p.R[1] + 8, 74, 0);
    const bx = p.L[0],
      by = p.L[1];
    s +=
      '<path d="M' +
      bx +
      ' ' +
      (by - 4) +
      'V' +
      (by - 26) +
      'M' +
      (bx - 22) +
      ' ' +
      (by - 22) +
      'H' +
      (bx + 22) +
      '" stroke="#d8b45a" stroke-width="2.4"/><path d="M' +
      (bx - 22) +
      ' ' +
      (by - 22) +
      'L' +
      (bx - 30) +
      ' ' +
      (by - 4) +
      'M' +
      (bx - 22) +
      ' ' +
      (by - 22) +
      'L' +
      (bx - 14) +
      ' ' +
      (by - 4) +
      'M' +
      (bx + 22) +
      ' ' +
      (by - 22) +
      'L' +
      (bx + 14) +
      ' ' +
      (by - 4) +
      'M' +
      (bx + 22) +
      ' ' +
      (by - 22) +
      'L' +
      (bx + 30) +
      ' ' +
      (by - 4) +
      '" stroke="#d8b45a" stroke-width="1"/><path d="M' +
      (bx - 32) +
      ' ' +
      (by - 4) +
      'Q' +
      (bx - 22) +
      ' ' +
      (by + 6) +
      ' ' +
      (bx - 12) +
      ' ' +
      (by - 4) +
      'ZM' +
      (bx + 12) +
      ' ' +
      (by - 4) +
      'Q' +
      (bx + 22) +
      ' ' +
      (by + 6) +
      ' ' +
      (bx + 32) +
      ' ' +
      (by - 4) +
      'Z" fill="#e3bf5c" stroke="#8a6d2f" stroke-width=".8"/>';
    return s;
  };
  SC.c12 = () => {
    let s = sky('#cde0d4', '#eef3e9');
    s += hill(370, '#8aa56f', 6);
    s +=
      '<path d="M76 400V92M224 400V92" stroke="#6b4a2a" stroke-width="12" stroke-linecap="round"/><path d="M64 96H236" stroke="#6b4a2a" stroke-width="13" stroke-linecap="round"/>';
    [
      [76, 170],
      [76, 240],
      [224, 200],
      [224, 300],
      [120, 96],
      [190, 96],
    ].forEach(([x, y], i) => {
      s += leaf(x + (i % 2 ? 7 : -7), y - 4, i % 2 ? 30 : -30, '#5d8a4e', 12);
    });
    s += '<path d="M149 100V110" stroke="#8a6d2f" stroke-width="2.4"/>';
    s +=
      '<path d="M146 150L148 112" stroke="#b73b3b" stroke-width="9" stroke-linecap="round"/><path d="M156 150L174 132L152 120" stroke="#b73b3b" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M144 108H154" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>';
    const p = person({
      x: 150,
      y: 150,
      s: 1.02,
      pose: 'back',
      robe: '#3f6a9a',
      trim: '#b73b3b',
      halo: '#f2c94a',
      hair: '#d9a440',
      belt: '#d8b45a',
    });
    s += '<g transform="rotate(180 150 150)">' + p.svg + '</g>';
    return s;
  };
  SC.c13 = () => {
    let s = sky('#273356', '#6d5d86', '#f0b27a');
    s += sun(150, 306, 26, false, '#f9d27a', '#f0a24a');
    s +=
      '<rect x="96" y="232" width="24" height="82" fill="#3a3550"/><path d="M94 232L108 216L122 232Z" fill="#3a3550"/><rect x="180" y="232" width="24" height="82" fill="#3a3550"/><path d="M178 232L192 216L206 232Z" fill="#3a3550"/>';
    s +=
      '<path d="M20 316H280V340Q150 330 20 344Z" fill="#43648c"/>' +
      waterLines(318, 336, '#ffd9a8', 0.5, 13);
    s += '<path d="M20 400V352Q80 340 128 356T210 350T280 344V400Z" fill="#2c3b2d"/>';
    s +=
      '<path d="M20 116Q70 110 108 128Q118 136 128 132" stroke="#4a3626" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      leaf(60, 108, -20, '#3f6b45', 14) +
      leaf(96, 120, 20, '#3f6b45', 12);
    s +=
      '<path d="M90 128q9 4 7 22q-2 13 -9 15q-7 -2 -7 -15q0 -18 9 -22z" fill="#9db27a" stroke="#6f8455" stroke-width="1"/><path d="M86 150l4 -6l4 6" stroke="#6f8455" fill="none"/>';
    const bx = 164,
      by = 210;
    s += '<g transform="translate(' + bx + ' ' + by + ') rotate(-12)">';
    [-1, 1].forEach((d) => {
      s +=
        '<path d="M0 -4C' +
        d * 20 +
        ' -50 ' +
        d * 72 +
        ' -46 ' +
        d * 62 +
        ' -8C' +
        d * 56 +
        ' 10 ' +
        d * 24 +
        ' 6 0 0Z" fill="#ec8d36" stroke="#3a2416" stroke-width="2.4"/><path d="M0 2C' +
        d * 18 +
        ' 10 ' +
        d * 50 +
        ' 16 ' +
        d * 40 +
        ' 42C' +
        d * 30 +
        ' 56 ' +
        d * 10 +
        ' 34 0 6Z" fill="#e07428" stroke="#3a2416" stroke-width="2.4"/>';
      s +=
        '<circle cx="' +
        d * 50 +
        '" cy="-28" r="4" fill="#fbf3dc"/><circle cx="' +
        d * 58 +
        '" cy="-14" r="3" fill="#fbf3dc"/><circle cx="' +
        d * 30 +
        '" cy="34" r="3" fill="#fbf3dc"/><path d="M' +
        d * 8 +
        ' -6C' +
        d * 24 +
        ' -30 ' +
        d * 44 +
        ' -32 ' +
        d * 52 +
        ' -18" stroke="#3a2416" stroke-width="1.2" fill="none"/>';
    });
    s +=
      '<ellipse cx="0" cy="4" rx="3.6" ry="22" fill="#3a2416"/><circle cx="0" cy="-20" r="4.4" fill="#3a2416"/><path d="M-1 -23Q-8 -38 -14 -40M1 -23Q8 -38 14 -40" stroke="#3a2416" stroke-width="1.4" fill="none"/></g>';
    s +=
      rose(232, 374, 8, '#f4f1ea', '#c9c3b4') +
      leaf(222, 380, -30, '#5d8a4e', 10) +
      rose(248, 384, 6, '#f4f1ea', '#c9c3b4');
    return s;
  };
  SC.c14 = () => {
    let s = sky('#b9d5e8', '#f6ecd2');
    s += mountains(254, '#9fb3c8', 31, 44) + snowcaps(254, '#eef3f8', 31, 44);
    s +=
      '<path d="M20 400V302Q150 284 280 302V400Z" fill="#87a86b"/><path d="M170 300Q120 330 136 400H162Q150 340 196 300Z" fill="#e7d8b2"/>';
    s +=
      '<circle cx="214" cy="244" r="12" fill="#f6d35c"/><path d="M204 238L208 228L214 236L220 228L224 238Z" fill="#f6d35c"/>';
    s +=
      '<ellipse cx="94" cy="384" rx="80" ry="22" fill="#78acd6"/>' +
      waterLines(372, 396, '#fff', 0.45, 21);
    for (let i = 0; i < 4; i++) {
      const x = 196 + i * 20;
      s +=
        '<path d="M' +
        x +
        ' 400V376" stroke="#4f7a3e" stroke-width="2"/><path d="M' +
        x +
        ' 376l-5 -8l5 3l5 -3z" fill="#f2c94a"/>' +
        leaf(x - 5, 390, -40, '#4f7a3e', 12);
    }
    const p = person({
      x: 150,
      y: 390,
      s: 1.12,
      pose: 'temper',
      robe: '#f6f3ea',
      wings: '#c64b3a',
      hair: '#d9a440',
      halo: '#f2c94a',
      trim: '#d8b45a',
      chest:
        '<rect x="-8" y="-82" width="16" height="16" fill="none" stroke="#d8b45a" stroke-width="1.4"/><path d="M-5 -70L0 -79L5 -70Z" fill="#d8b45a"/>',
    });
    s += p.svg;
    s +=
      '<path d="M' +
      f(p.L[0] + 9) +
      ' ' +
      f(p.L[1] - 20) +
      'Q' +
      f((p.L[0] + p.R[0]) / 2) +
      ' ' +
      f(p.L[1] + 6) +
      ' ' +
      f(p.R[0] - 4) +
      ' ' +
      f(p.R[1] - 20) +
      '" stroke="#8fc6ea" stroke-width="4" fill="none" stroke-linecap="round"/>';
    s +=
      '<g transform="rotate(28 ' +
      p.L[0] +
      ' ' +
      p.L[1] +
      ')">' +
      cup(p.L[0], p.L[1] + 6, 1, '#e3bf5c') +
      '</g>' +
      cup(p.R[0], p.R[1] + 6, 1, '#e3bf5c');
    return s;
  };
  SC.c15 = () => {
    let s = sky('#161114', '#3a2a2f');
    s += '<circle cx="150" cy="200" r="120" fill="' + glow('#7a2a2a', 0.6) + '"/>';
    s +=
      '<path d="M150 150C108 140 58 176 34 226C76 206 100 218 112 244L122 286H178L188 244C200 218 224 206 266 226C242 176 192 140 150 150Z" fill="#0c0a0c"/><path d="M60 214Q90 200 106 214M240 214Q210 200 194 214" stroke="#2a2226" stroke-width="2" fill="none"/>';
    s +=
      '<circle cx="150" cy="134" r="22" fill="#0c0a0c"/><path d="M126 128H174V142H126Z" fill="#e9e1d6"/><ellipse cx="140" cy="135" rx="5" ry="3" fill="#0c0a0c"/><ellipse cx="160" cy="135" rx="5" ry="3" fill="#0c0a0c"/><path d="M174 132q12 -2 18 6q-8 -2 -18 2z" fill="#e9e1d6"/>';
    s +=
      '<rect x="108" y="284" width="84" height="12" fill="#3a3135"/><rect x="116" y="296" width="68" height="44" fill="#2a2326"/><circle cx="150" cy="316" r="6" fill="none" stroke="#c9a24a" stroke-width="2.4"/>';
    s += ground(340, '#241c1f');
    const a = person({ x: 92, y: 396, s: 0.64, pose: 'down', robe: '#a76a5a', hair: '#5a3a22' }),
      b = person({
        x: 208,
        y: 396,
        s: 0.64,
        pose: 'down',
        robe: '#6a7aa6',
        hair: '#2a1d14',
        long: 1,
      });
    s += a.svg + b.svg;
    s +=
      '<path d="M144 320Q118 360 96 ' +
      f(a.head[1] + 16) +
      '" stroke="#c9a24a" stroke-width="2" stroke-dasharray="4 3" fill="none"/><path d="M156 320Q182 360 204 ' +
      f(b.head[1] + 16) +
      '" stroke="#c9a24a" stroke-width="2" stroke-dasharray="4 3" fill="none"/>';
    s +=
      '<ellipse cx="92" cy="' +
      f(a.head[1] + 16) +
      '" rx="8" ry="3" fill="none" stroke="#c9a24a" stroke-width="2"/><ellipse cx="208" cy="' +
      f(b.head[1] + 16) +
      '" rx="8" ry="3" fill="none" stroke="#c9a24a" stroke-width="2"/>';
    return s;
  };
  SC.c16 = () => {
    let s = sky('#10142a', '#323858');
    s +=
      cloud(72, 92, 96, '#4a4f6b') + cloud(222, 82, 86, '#4a4f6b') + cloud(160, 112, 70, '#3c4160');
    s +=
      '<path d="M54 400L92 318H208L246 400Z" fill="#4a4540"/><path d="M92 318L110 340L130 326L160 346L190 328L208 318" stroke="#5e5852" stroke-width="2" fill="none"/>';
    s += brick(114, 150, 72, 170, '#8d877a', '#6f6a62', 12);
    s +=
      '<path d="M114 150V140H122V146H132V140H142V146H158V140H168V146H178V140H186V150Z" fill="#8d877a"/>';
    [
      [126, 186],
      [160, 232],
      [132, 272],
    ].forEach(([x, y]) => {
      s +=
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="14" height="22" rx="7" fill="#1b1416"/><path d="M' +
        (x + 2) +
        ' ' +
        (y + 22) +
        'Q' +
        (x + 7) +
        ' ' +
        (y + 4) +
        ' ' +
        (x + 12) +
        ' ' +
        (y + 22) +
        'Z" fill="#f08c2e"/>';
    });
    s +=
      '<path d="M114 156Q100 132 112 110Q118 132 130 140Q136 118 150 108Q150 132 166 140Q176 120 188 116Q180 138 186 156Z" fill="#f08c2e" opacity=".9"/><path d="M124 152Q122 134 132 124Q138 140 150 144Q160 130 172 126Q168 142 176 152Z" fill="#f6c548"/>';
    s +=
      '<g transform="translate(208 112) rotate(32)"><path d="M-14 6V-6L-7 0L0 -12L7 0L14 -6V6Z" fill="#d8b45a" stroke="#8a6d2f"/></g>';
    s +=
      '<path d="M60 56L118 118L100 122L152 156" stroke="#fff5c0" stroke-width="7" fill="none" stroke-linejoin="round" opacity=".5"/><path d="M60 56L118 118L100 122L152 156" stroke="#f6d34a" stroke-width="3.4" fill="none" stroke-linejoin="round"/>';
    s += sparks(16, 7, '#f6c548', 40, 260, 120, 380);
    return s;
  };
  SC.c17 = () => {
    let s = sky('#142040', '#3d5b8b');
    s += stars(30, 17, '#ffffff', 56, 200);
    s +=
      '<circle cx="150" cy="110" r="48" fill="' +
      glow('#fff0b0', 0.6) +
      '"/>' +
      star8(150, 110, 36, '#f6d35c', 0.36, '#e0a62a');
    [
      [70, 82],
      [230, 82],
      [56, 148],
      [244, 148],
      [96, 196],
      [204, 196],
      [150, 186],
    ].forEach(([x, y]) => {
      s += star8(x, y, 10, '#fbf8ef', 0.36);
    });
    s +=
      hill(316, '#4f7a5c', 10) +
      '<path d="M150 400Q140 350 196 338T280 344V400Z" fill="#6f9fd0"/>' +
      waterLines(350, 396, '#fff', 0.4, 4);
    s += tree(252, 320, 96, '#3f6b45', '#5c3d24');
    s +=
      '<path d="M246 262q8 -10 16 -4q-4 2 -6 6q-6 -2 -10 -2z" fill="#e08a3a"/><path d="M260 258l6 -2" stroke="#8a5a2c" stroke-width="1.4"/>';
    const p = person({
      x: 126,
      y: 386,
      s: 0.9,
      pose: 'pour',
      robe: '#dfe8f4',
      trim: '#b9c7da',
      hair: '#d9a440',
      long: 1,
    });
    s += p.svg + jug(p.L[0], p.L[1] + 6, 1, -60) + jug(p.R[0], p.R[1] + 6, 1, 70);
    const lx = p.L[0] - 12,
      ly = p.L[1] + 4;
    for (let i = 0; i < 5; i++)
      s +=
        '<path d="M' +
        lx +
        ' ' +
        ly +
        'Q' +
        f(lx - 8 - i * 4) +
        ' ' +
        f(ly + 20) +
        ' ' +
        f(lx - 10 - i * 6) +
        ' ' +
        f(386) +
        '" stroke="#a9d3f0" stroke-width="1.6" fill="none"/>';
    s +=
      '<path d="M' +
      f(p.R[0] + 14) +
      ' ' +
      f(p.R[1] + 8) +
      'Q' +
      f(p.R[0] + 24) +
      ' ' +
      f(p.R[1] + 24) +
      ' ' +
      f(p.R[0] + 26) +
      ' 366" stroke="#a9d3f0" stroke-width="3.4" fill="none"/>';
    return s;
  };
  SC.c18 = () => {
    let s = sky('#152240', '#45608c');
    s += stars(24, 23, '#ffffff', 58, 160);
    s +=
      '<circle cx="150" cy="106" r="54" fill="' +
      glow('#fff3c4', 0.5) +
      '"/><circle cx="150" cy="106" r="32" fill="#f3e6b4"/>' +
      crescent(150, 106, 32, '#d9c78c', 0.55) +
      '<path d="M140 98q4 -3 8 0" stroke="#a89660" stroke-width="1.6" fill="none"/>';
    s += sparks(12, 31, '#f3d26a', 90, 210, 150, 230);
    s += mountains(246, '#5a6f96', 41, 44) + hill(300, '#355f4c', 8);
    s +=
      '<rect x="38" y="178" width="34" height="132" fill="#8a8fa0"/><path d="M36 178L55 160L74 178Z" fill="#6f7488"/><rect x="50" y="200" width="10" height="16" rx="5" fill="#2a2f44"/><rect x="228" y="178" width="34" height="132" fill="#8a8fa0"/><path d="M226 178L245 160L264 178Z" fill="#6f7488"/><rect x="240" y="200" width="10" height="16" rx="5" fill="#2a2f44"/>';
    s +=
      '<path d="M150 360Q118 330 160 300T140 236" stroke="#d8cfb8" stroke-width="7" fill="none" stroke-linecap="round"/>';
    s +=
      '<path d="M20 400V352Q150 338 280 352V400Z" fill="#3c6ca6"/>' +
      waterLines(356, 396, '#fff', 0.3, 9);
    s +=
      '<g transform="translate(150 368)"><ellipse rx="10" ry="6" fill="#c64a3a"/><path d="M-8 -4l-10 -10l2 6M8 -4l10 -10l-2 6M-6 4l-6 6M6 4l6 6" stroke="#c64a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>';
    s +=
      quad({ x: 80, y: 334, s: 0.62, c: '#ece4d6', dir: 1, ear: '#c9b89a' }) +
      quad({ x: 220, y: 334, s: 0.62, c: '#6b6f7a', dir: -1 });
    return s;
  };
  SC.c19 = () => {
    let s = sky('#f5c240', '#fbe9a8');
    s += sun(150, 122, 40, true);
    s += brick(20, 264, 260, 60, '#a39784', '#857a68', 12);
    [40, 92, 208, 260].forEach((x, i) => {
      s += sunflower(x, 268, 1.05 + (i % 2) * 0.1);
    });
    s += ground(324, '#8fb36b');
    const hx = 144,
      hy = 394;
    s += quad({ x: hx, y: hy, s: 1.5, c: '#f8f5ee', dir: 1, shade: '#6b6355' });
    s +=
      '<path d="M' +
      f(hx - 16) +
      ' ' +
      (hy - 61) +
      'Q' +
      hx +
      ' ' +
      (hy - 48) +
      ' ' +
      f(hx + 20) +
      ' ' +
      (hy - 60) +
      '" stroke="#c24a3a" stroke-width="5" fill="none"/>';
    const c = person({
      x: hx - 6,
      y: hy - 52,
      s: 0.5,
      pose: 'up',
      robe: '#f6f2ea',
      trim: '#f2c94a',
      hair: '#f2c94a',
      wreath: '#c94a4a',
    });
    s += c.svg;
    s +=
      wand(c.R[0], c.R[1] + 10, c.R[0] - 2, c.R[1] - 40, '#6b4a2a', 2.4) +
      '<path d="M' +
      f(c.R[0] - 2) +
      ' ' +
      f(c.R[1] - 40) +
      'Q' +
      f(c.R[0] - 26) +
      ' ' +
      f(c.R[1] - 50) +
      ' ' +
      f(c.R[0] - 46) +
      ' ' +
      f(c.R[1] - 30) +
      'Q' +
      f(c.R[0] - 30) +
      ' ' +
      f(c.R[1] - 20) +
      ' ' +
      f(c.R[0] - 2) +
      ' ' +
      f(c.R[1] - 16) +
      'Z" fill="#c24a3a"/>';
    return s;
  };
  SC.c20 = () => {
    let s = sky('#97c0de', '#e9f0f5');
    s += mountains(330, '#d9e2ea', 51, 80) + snowcaps(330, '#ffffff', 51, 80);
    s +=
      '<rect x="20" y="330" width="260" height="70" fill="#5c8cb6"/>' +
      waterLines(336, 396, '#fff', 0.35, 51);
    s += cloud(70, 196, 90, '#f2f5fa') + cloud(232, 192, 90, '#f2f5fa');
    const a = person({
      x: 140,
      y: 194,
      s: 0.9,
      pose: 'out',
      robe: '#d9e4f2',
      wings: '#c64b3a',
      hair: '#d9a440',
      trim: '#f2c94a',
    });
    s +=
      a.svg +
      '<g fill="#ffffff"><ellipse cx="146" cy="200" rx="96" ry="18"/><circle cx="100" cy="190" r="16"/><circle cx="128" cy="184" r="18"/><circle cx="160" cy="186" r="17"/><circle cx="190" cy="192" r="14"/></g>';
    s +=
      '<path d="M' +
      f(a.R[0] - 4) +
      ' ' +
      f(a.R[1] - 2) +
      'L' +
      f(a.R[0] + 44) +
      ' ' +
      f(a.R[1] + 30) +
      'L' +
      f(a.R[0] + 50) +
      ' ' +
      f(a.R[1] + 18) +
      'Z" fill="#e0bd5a" stroke="#8a6d2f" stroke-width="1"/><rect x="' +
      f(a.R[0] + 20) +
      '" y="' +
      f(a.R[1] + 18) +
      '" width="18" height="16" fill="#fbf8ef" stroke="#c9c3b4"/><path d="M' +
      f(a.R[0] + 29) +
      ' ' +
      f(a.R[1] + 20) +
      'v12M' +
      f(a.R[0] + 23) +
      ' ' +
      f(a.R[1] + 26) +
      'h12" stroke="#c24a3a" stroke-width="2.4"/>';
    {
      const bx = a.R[0] + 47,
        by = a.R[1] + 24;
      for (let i = 0; i < 5; i++) {
        const ang = -0.5 + i * 0.25;
        s +=
          '<path d="M' +
          f(bx + Math.cos(ang) * 10) +
          ' ' +
          f(by + Math.sin(ang) * 10) +
          'L' +
          f(bx + Math.cos(ang) * 24) +
          ' ' +
          f(by + Math.sin(ang) * 24) +
          '" stroke="#e0bd5a" stroke-width="1.6" stroke-linecap="round"/>';
      }
    }
    [
      [72, 378, '#d8c2b0'],
      [150, 388, '#e6d3b3'],
      [228, 378, '#c9b7d6'],
    ].forEach(([x, y, c]) => {
      const p = person({ x, y: y - 6, s: 0.46, pose: 'raise2', robe: c, hair: '#5a3a22' });
      s +=
        p.svg +
        '<path d="M' +
        (x - 28) +
        ' ' +
        (y - 8) +
        'H' +
        (x + 28) +
        'L' +
        (x + 20) +
        ' ' +
        (y + 6) +
        'H' +
        (x - 20) +
        'Z" fill="#7a5030"/>';
    });
    return s;
  };
  SC.c21 = () => {
    let s = sky('#3a7894', '#a7d2d8');
    [
      [56, 92],
      [244, 92],
      [56, 368],
      [244, 368],
    ].forEach(([x, y], i) => {
      s += cloud(x, y, 72, '#ffffff');
      s += star8(x, y - 14, 7, ['#f2c94a', '#c64b3a', '#5d8a4e', '#3f5f86'][i]);
    });
    const cx = 150,
      cy = 226;
    s +=
      '<ellipse cx="' +
      cx +
      '" cy="' +
      cy +
      '" rx="80" ry="116" fill="none" stroke="#3f7a43" stroke-width="12"/>';
    for (let i = 0; i < 40; i++) {
      const a = (i * Math.PI * 2) / 40;
      const x = cx + Math.cos(a) * 80,
        y = cy + Math.sin(a) * 116;
      s += leaf(f(x), f(y), f((a * 180) / Math.PI + 90 + (i % 2 ? 30 : -30)), '#5d9a52', 13);
    }
    [
      [cx, cy - 116],
      [cx, cy + 116],
    ].forEach(([x, y]) => {
      s +=
        '<path d="M' +
        (x - 14) +
        ' ' +
        (y - 8) +
        'L' +
        x +
        ' ' +
        y +
        'L' +
        (x - 14) +
        ' ' +
        (y + 8) +
        'ZM' +
        (x + 14) +
        ' ' +
        (y - 8) +
        'L' +
        x +
        ' ' +
        y +
        'L' +
        (x + 14) +
        ' ' +
        (y + 8) +
        'Z" fill="#c64b3a"/><circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="4" fill="#c64b3a"/>';
    });
    const p = person({
      x: cx,
      y: cy + 78,
      s: 0.92,
      pose: 'dance',
      robe: '#f6f3ea',
      cape: '#7a4f9a',
      trim: '#d8b45a',
      hair: '#8a5326',
      long: 1,
    });
    s +=
      p.svg +
      wand(p.L[0], p.L[1] + 12, p.L[0], p.L[1] - 14, '#d8b45a', 2.6) +
      wand(p.R[0], p.R[1] + 12, p.R[0], p.R[1] - 14, '#d8b45a', 2.6);
    return s;
  };
  return SC;
}
