export function createEarlyScenes(primitives) {
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
    star5,
    sun,
    crescent,
    rose,
    leaf,
    lily,
    wheat,
    cypress,
    tree,
    pillar,
    wand,
    cup,
    sword,
    coin,
    inf,
    waterLines,
    person,
    backFig,
    quad,
  } = primitives;
  const SC = {};
  SC.c00 = () => {
    let s = sky('#f6d47a', '#fbeed0');
    s += sun(222, 104, 20, false);
    s += cloud(78, 126, 64, '#fff', 0.85);
    s +=
      mountains(292, '#c6d3e0', 3, 80) +
      snowcaps(292, '#f4f6f9', 3, 80) +
      mountains(312, '#9fb2c6', 9, 46);
    s +=
      '<path d="M20 400V334Q90 318 172 326L212 336L206 400Z" fill="#8aa76d"/><path d="M212 336L206 400H220Z" fill="#5f7a4a"/><path d="M60 352Q100 346 140 350" stroke="#6f8c56" stroke-width="2" fill="none"/>';
    s += quad({
      x: 88,
      y: 338,
      s: 0.55,
      c: '#f7f3ea',
      dir: 1,
      ear: '#d8c9b0',
      collar: '#b73b3b',
    });
    const dots =
      '<circle cx="-10" cy="-40" r="3.4" fill="#9b2c2c"/><circle cx="8" cy="-28" r="3.4" fill="#9b2c2c"/><circle cx="-6" cy="-18" r="3.4" fill="#9b2c2c"/><circle cx="12" cy="-56" r="3.4" fill="#9b2c2c"/><circle cx="-12" cy="-66" r="3" fill="#9b2c2c"/>';
    const p = person({
      x: 162,
      y: 336,
      s: 0.98,
      pose: 'walk',
      robe: '#e9b24c',
      trim: '#9b2c2c',
      cape: '#3f6f93',
      pattern: dots,
      hair: '#7a4a22',
      hat: '<path d="M-14 -121Q0 -138 14 -121Z" fill="#3f6b45"/><path d="M8 -131Q22 -150 34 -144Q22 -138 11 -127Z" fill="#b73b3b"/>',
    });
    s +=
      wand(p.R[0], p.R[1] + 6, p.R[0] + 32, p.R[1] - 24, '#6b4a2a', 3.4) +
      '<circle cx="' +
      f(p.R[0] + 34) +
      '" cy="' +
      f(p.R[1] - 20) +
      '" r="10" fill="#9b2c2c"/><path d="M' +
      f(p.R[0] + 26) +
      ' ' +
      f(p.R[1] - 20) +
      'q8 -6 16 0" stroke="#d8b45a" stroke-width="1.4" fill="none"/>';
    s += p.svg;
    s +=
      rose(p.L[0], p.L[1] - 5, 5, '#fbfbf6', '#c9c3b4') +
      leaf(p.L[0] - 4, p.L[1], -30, '#5d8a4e', 7);
    return s;
  };
  SC.c01 = () => {
    let s = sky('#f2cd5e', '#f8e8b2');
    for (let i = 0; i < 11; i++) {
      const x = 34 + i * 23.3,
        y = 74 + (i % 2) * 7;
      s +=
        leaf(x - 7, y + 6, -30, '#4f7a3e', 11) +
        leaf(x + 7, y + 7, 30, '#4f7a3e', 11) +
        rose(x, y, 7.5);
    }
    s += '<circle cx="150" cy="190" r="80" fill="' + glow('#fff6d0', 0.7) + '"/>';
    const p = person({
      x: 150,
      y: 336,
      s: 1.24,
      pose: 'up',
      robe: '#f3eee2',
      cape: '#a8322d',
      trim: '#d8b45a',
      hair: '#3a2618',
      belt: '#6b8f4a',
    });
    s += inf(150, p.head[1] - 30, 30);
    s += p.svg;
    s +=
      wand(p.R[0] - 2, p.R[1] + 16, p.R[0] + 3, p.R[1] - 22, '#fbf8ef', 4.5) +
      '<circle cx="' +
      f(p.R[0] + 3) +
      '" cy="' +
      f(p.R[1] - 24) +
      '" r="3" fill="#fbf8ef"/>';
    s +=
      '<rect x="52" y="306" width="196" height="14" rx="2" fill="#6f4526"/><rect x="60" y="320" width="180" height="80" fill="#8c5d35"/><path d="M60 336H240M60 366H240" stroke="#6f4526" stroke-width="1.2"/>';
    s +=
      cup(82, 306, 1.05) +
      sword(102, 302, 34, 90) +
      coin(196, 294, 11) +
      wand(214, 302, 242, 290, '#7a5030', 4) +
      leaf(226, 292, -30, '#5d8a4e', 8);
    for (let i = 0; i < 5; i++) s += lily(80 + i * 36, 398, 1.1);
    return s;
  };
  SC.c02 = () => {
    let s = sky('#20385a', '#4d7398');
    s += '<rect x="70" y="80" width="160" height="320" fill="#6e2c3c"/>';
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++) {
        const x = 84 + c * 33 + (r % 2) * 16,
          y = 98 + r * 40;
        s +=
          '<circle cx="' +
          x +
          '" cy="' +
          y +
          '" r="7" fill="#c2464a"/><path d="M' +
          (x - 2) +
          ' ' +
          (y - 7) +
          'l2 -4 2 4" fill="#c2464a"/>' +
          leaf(x - 9, y - 4, -40, '#3f6b45', 9) +
          leaf(x + 9, y - 4, 40, '#3f6b45', 9);
      }
    s +=
      pillar(36, 112, 32, '#1b2033', '#d8b45a', 'B', '#f4ead3') +
      pillar(232, 112, 32, '#efe9dc', '#d8b45a', 'J', '#1b2033');
    s +=
      '<path d="M20 400V372Q80 360 150 374T280 366V400Z" fill="#79b0d8"/>' +
      waterLines(372, 398, '#fff', 0.4, 5);
    const p = person({
      x: 150,
      y: 378,
      s: 1.08,
      pose: 'hold',
      robe: '#6f9fd0',
      cape: '#eef2f7',
      trim: '#eef2f7',
      hair: '#2a1d14',
      long: 1,
      hat: '<circle cx="0" cy="-134" r="6.5" fill="#eef2f7"/><path d="M-6 -134Q-15 -148 -24 -137Q-15 -141 -6 -134ZM6 -134Q15 -148 24 -137Q15 -141 6 -134Z" fill="#eef2f7"/>',
      chest: '<path d="M0 -82V-64M-7 -74H7" stroke="#eef2f7" stroke-width="3"/>',
    });
    s += p.svg;
    s +=
      '<rect x="' +
      f(p.L[0] - 6) +
      '" y="' +
      f(p.L[1] - 8) +
      '" width="30" height="15" rx="4" fill="#f6efd8" stroke="#8a6d2f" stroke-width=".8"/><path d="M' +
      f(p.L[0] - 2) +
      ' ' +
      f(p.L[1] - 2) +
      'h20M' +
      f(p.L[0] - 2) +
      ' ' +
      f(p.L[1] + 2) +
      'h14" stroke="#8a6d2f" stroke-width=".8"/>';
    s += crescent(150, 388, 11, '#ecd58e', 0.7);
    return s;
  };
  SC.c03 = () => {
    let s = sky('#a5cfe8', '#f4e4b8');
    s +=
      cypress(46, 300, 140) +
      cypress(70, 300, 104, '#386a46') +
      cypress(250, 300, 130) +
      cypress(228, 300, 96, '#386a46');
    s +=
      '<path d="M196 196H214V302H196Z" fill="#d6ecf7"/><path d="M200 200V300M206 200V300M211 200V300" stroke="#a9d1e8" stroke-width="1.4"/><ellipse cx="205" cy="304" rx="22" ry="6" fill="#d6ecf7"/>';
    s += '<path d="M20 400V306Q150 288 280 306V400Z" fill="#d7b35a"/>';
    s +=
      '<ellipse cx="150" cy="362" rx="84" ry="26" fill="#b73b3b"/><ellipse cx="150" cy="356" rx="74" ry="17" fill="#cf5048"/>';
    let crown = '';
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (1.1 + (i * 0.8) / 11);
      crown += star5(f(Math.cos(a) * 20), f(-118 + Math.sin(a) * 20), 3, '#f2c94a');
    }
    const pom =
      '<circle cx="-10" cy="-30" r="3.4" fill="#c2464a"/><circle cx="9" cy="-44" r="3.4" fill="#c2464a"/><circle cx="-6" cy="-58" r="3" fill="#c2464a"/><circle cx="11" cy="-18" r="3.4" fill="#c2464a"/><circle cx="-13" cy="-12" r="3" fill="#c2464a"/>';
    const p = person({
      x: 150,
      y: 368,
      s: 1.26,
      pose: 'hold',
      robe: '#f6f2e6',
      pattern: pom,
      trim: '#d8b45a',
      hair: '#8a5326',
      long: 1,
      hat: crown,
      wreath: '#5d8a4e',
    });
    s += p.svg;
    s +=
      wand(p.R[0], p.R[1] + 4, p.R[0] + 18, p.R[1] - 52, '#d8b45a', 3.4) +
      '<circle cx="' +
      f(p.R[0] + 19) +
      '" cy="' +
      f(p.R[1] - 56) +
      '" r="6" fill="#e3bf5c" stroke="#8a6d2f"/>';
    s +=
      '<path d="M66 384c-13-13-3-28 8-19 11-9 21 6 8 19l-8 8z" fill="#e2b84a" stroke="#8a6d2f"/><circle cx="74" cy="374" r="4" fill="none" stroke="#8a6d2f" stroke-width="1.5"/><path d="M74 378v7M71 382h6" stroke="#8a6d2f" stroke-width="1.5"/>';
    for (let i = 0; i < 12; i++) s += wheat(28 + i * 22 + (i % 3) * 3, 400, 26 + (i % 4) * 4);
    return s;
  };
  SC.c04 = () => {
    let s = sky('#e36f34', '#f5b66c');
    s += mountains(300, '#a2492a', 11, 100) + mountains(330, '#76321e', 5, 40);
    s +=
      '<rect x="84" y="176" width="132" height="224" rx="6" fill="#8d877a"/><rect x="76" y="166" width="148" height="26" rx="8" fill="#a39d90"/><path d="M84 260H216M84 320H216" stroke="#77716a" stroke-width="1.4"/>';
    [
      [90, 178],
      [210, 178],
    ].forEach(([x, y]) => {
      s +=
        '<circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="11" fill="#b2ab9d"/><path d="M' +
        x +
        ' ' +
        y +
        'm-6 0a6 6 0 1 1 6 6a3 3 0 1 1 -3 -3" stroke="#6a645b" stroke-width="2" fill="none"/>';
    });
    s +=
      '<path d="M136 170L150 150L164 170Z" fill="#a39d90"/><circle cx="150" cy="164" r="5" fill="#76321e"/>';
    const p = person({
      x: 150,
      y: 380,
      s: 1.14,
      pose: 'regal',
      robe: '#b3352b',
      cape: '#7a1f1f',
      trim: '#d8b45a',
      crown: '#d8b45a',
      beard: '#ece8df',
      hair: '#ece8df',
      chest: '<path d="M-12 -84L0 -70L12 -84" stroke="#9aa2ad" stroke-width="4" fill="none"/>',
    });
    s += p.svg;
    s +=
      wand(p.R[0], p.R[1] + 18, p.R[0], p.R[1] - 38, '#d8b45a', 3.6) +
      '<ellipse cx="' +
      p.R[0] +
      '" cy="' +
      f(p.R[1] - 46) +
      '" rx="5" ry="7" fill="none" stroke="#d8b45a" stroke-width="3"/><path d="M' +
      f(p.R[0] - 8) +
      ' ' +
      f(p.R[1] - 38) +
      'h16" stroke="#d8b45a" stroke-width="3"/>';
    s +=
      '<circle cx="' +
      p.L[0] +
      '" cy="' +
      f(p.L[1] - 6) +
      '" r="9" fill="#e3bf5c" stroke="#8a6d2f"/><path d="M' +
      p.L[0] +
      ' ' +
      f(p.L[1] - 15) +
      'v-7M' +
      f(p.L[0] - 3) +
      ' ' +
      f(p.L[1] - 19) +
      'h6" stroke="#8a6d2f" stroke-width="1.6"/>';
    return s;
  };
  SC.c05 = () => {
    let s = sky('#c8c0ae', '#ece6d8');
    s += pillar(38, 104, 30, '#8d877a', '#a39d90') + pillar(232, 104, 30, '#8d877a', '#a39d90');
    s += '<rect x="96" y="150" width="108" height="210" rx="4" fill="#a8a192"/>';
    const p = person({
      x: 150,
      y: 330,
      s: 1.1,
      pose: 'bless2',
      robe: '#b3352b',
      cape: '#7a1f1f',
      trim: '#d8b45a',
      tiara: '#d8b45a',
      beard: '#ece8df',
      hair: '#ece8df',
      chest: '<path d="M0 -84V-10M-8 -40H8" stroke="#ece8df" stroke-width="2.4"/>',
    });
    s += p.svg;
    s +=
      wand(p.L[0], p.L[1] + 60, p.L[0], p.L[1] - 70, '#d8b45a', 3.2) +
      '<path d="M' +
      f(p.L[0] - 10) +
      ' ' +
      f(p.L[1] - 62) +
      'h20M' +
      f(p.L[0] - 8) +
      ' ' +
      f(p.L[1] - 54) +
      'h16M' +
      f(p.L[0] - 6) +
      ' ' +
      f(p.L[1] - 46) +
      'h12" stroke="#d8b45a" stroke-width="3"/>';
    s +=
      '<path d="M' +
      f(p.R[0] - 2) +
      ' ' +
      f(p.R[1] - 4) +
      'v-8M' +
      f(p.R[0] + 2) +
      ' ' +
      f(p.R[1] - 4) +
      'v-8" stroke="#efd0ad" stroke-width="2.4" stroke-linecap="round"/>';
    s +=
      '<rect x="20" y="360" width="260" height="40" fill="#b5ad9c"/><path d="M20 372H280M20 386H280" stroke="#9e9686" stroke-width="1"/>';
    const rosePat =
      '<circle cx="-10" cy="-30" r="4" fill="#c2464a"/><circle cx="8" cy="-50" r="4" fill="#c2464a"/><circle cx="10" cy="-20" r="4" fill="#c2464a"/>';
    const lilyPat =
      '<circle cx="-10" cy="-30" r="4" fill="#fbf8ef"/><circle cx="8" cy="-50" r="4" fill="#fbf8ef"/><circle cx="10" cy="-20" r="4" fill="#fbf8ef"/>';
    s +=
      backFig(98, 400, 0.82, '#7a2a2a', '#5a3a22', rosePat) +
      backFig(202, 400, 0.82, '#3f5f86', '#2a1d14', lilyPat);
    s +=
      '<g transform="translate(150 382)"><g transform="rotate(-30)"><circle cx="0" cy="-14" r="5" fill="none" stroke="#e0bd5a" stroke-width="2.4"/><path d="M0 -9V10M0 4h4M0 8h4" stroke="#e0bd5a" stroke-width="2.4"/></g><g transform="rotate(30)"><circle cx="0" cy="-14" r="5" fill="none" stroke="#cfd4da" stroke-width="2.4"/><path d="M0 -9V10M0 4h-4M0 8h-4" stroke="#cfd4da" stroke-width="2.4"/></g></g>';
    return s;
  };
  SC.c06 = () => {
    let s = sky('#84b4d8', '#f2e4bc');
    s += sun(150, 86, 18, false);
    s +=
      '<path d="M108 362L150 250L192 362Z" fill="#a7b6c6"/><path d="M150 250L138 282L150 276L162 282Z" fill="#eef1f5"/>';
    s += hill(350, '#86a86a', 10);
    s += tree(64, 352, 128, '#3f6b45', '#5c3d24');
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7;
      s +=
        '<path d="M' +
        f(64 + Math.cos(a) * 28) +
        ' ' +
        f(274 + Math.sin(a) * 24) +
        'q-3 -6 0 -10q3 4 0 10Z" fill="#f08c2e"/>';
    }
    s += tree(236, 352, 128, '#3f6b45', '#5c3d24', '#4c7a4f');
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8 + 0.3;
      s +=
        '<circle cx="' +
        f(236 + Math.cos(a) * 26) +
        '" cy="' +
        f(276 + Math.sin(a) * 22) +
        '" r="3.4" fill="#c2464a"/>';
    }
    s +=
      '<path d="M224 340Q232 318 226 300Q240 296 238 310" stroke="#5d8a4e" stroke-width="3" fill="none"/>';
    s += cloud(96, 214, 80, '#f4f6fb') + cloud(206, 212, 80, '#f4f6fb');
    const a = person({
      x: 150,
      y: 206,
      s: 0.78,
      pose: 'raise2',
      robe: '#8a6bb0',
      wings: '#c25a4a',
      hair: '#c25a4a',
      trim: '#f2c94a',
    });
    s +=
      a.svg +
      '<g fill="#ffffff"><ellipse cx="150" cy="212" rx="78" ry="14"/><circle cx="118" cy="204" r="13"/><circle cx="140" cy="200" r="14"/><circle cx="164" cy="201" r="13"/><circle cx="186" cy="206" r="11"/></g>';
    s += person({
      x: 96,
      y: 398,
      s: 0.74,
      pose: 'out',
      robe: '#e6d3b3',
      trim: '#b88a5a',
      hair: '#5a3a22',
    }).svg;
    s += person({
      x: 204,
      y: 398,
      s: 0.74,
      pose: 'out',
      robe: '#d8c2df',
      trim: '#9a7aa8',
      hair: '#8a5326',
      long: 1,
    }).svg;
    return s;
  };
  SC.c07 = () => {
    let s = sky('#f1cd5f', '#f8ebc4');
    let w = 'M20 286';
    for (let x = 20; x < 280; x += 18) w += 'V272H' + (x + 9) + 'V286H' + (x + 18);
    s += '<path d="' + w + 'V306H20Z" fill="#b8ad97"/>';
    s +=
      '<rect x="40" y="248" width="22" height="58" fill="#a89e88"/><path d="M38 248L51 230L64 248Z" fill="#9b2c2c"/><rect x="236" y="244" width="22" height="62" fill="#a89e88"/><path d="M234 244L247 226L260 244Z" fill="#9b2c2c"/>';
    s +=
      '<rect x="20" y="304" width="260" height="18" fill="#86b6d6"/>' +
      waterLines(306, 320, '#fff', 0.5, 8) +
      ground(322, '#b9a272');
    s +=
      '<rect x="92" y="170" width="6" height="104" fill="#d8b45a"/><rect x="202" y="170" width="6" height="104" fill="#d8b45a"/><path d="M82 160H218L210 180H90Z" fill="#26386a"/>';
    for (let i = 0; i < 9; i++) s += star8(98 + i * 13, 169, 4, '#f4ead3');
    const p = person({
      x: 150,
      y: 330,
      s: 1.18,
      pose: 'hold',
      robe: '#8a929e',
      trim: '#d8b45a',
      crown: '#d8b45a',
      hair: '#3a2618',
      chest:
        '<rect x="-10" y="-84" width="20" height="16" rx="2" fill="#c8cdd6"/><circle cx="0" cy="-77" r="3" fill="#d8b45a"/>',
    });
    s += p.svg + wand(p.R[0], p.R[1] + 6, p.R[0] + 14, p.R[1] - 46, '#d8b45a', 3);
    s +=
      '<rect x="80" y="262" width="140" height="72" rx="4" fill="#d9d3c5" stroke="#8d877a" stroke-width="1.6"/><path d="M80 278H220" stroke="#8d877a"/>';
    s +=
      '<circle cx="150" cy="300" r="8" fill="#d8b45a"/><path d="M142 300Q122 290 110 300Q124 304 142 302ZM158 300Q178 290 190 300Q176 304 158 302Z" fill="#3f5f86"/>';
    s +=
      '<circle cx="80" cy="334" r="14" fill="none" stroke="#6b4a2a" stroke-width="4"/><circle cx="220" cy="334" r="14" fill="none" stroke="#6b4a2a" stroke-width="4"/>';
    s +=
      quad({ x: 112, y: 396, s: 0.78, c: '#2b2a33', lying: 1, dir: -1 }) +
      quad({ x: 188, y: 396, s: 0.78, c: '#f2eee6', lying: 1, dir: 1 });
    return s;
  };
  SC.c08 = () => {
    let s = sky('#f3d46a', '#fbf0c8');
    s +=
      sun(232, 96, 16, false) + cloud(84, 104, 70, '#fff', 0.9) + cloud(150, 140, 56, '#fff', 0.7);
    s += mountains(300, '#8db0cc', 21, 70) + snowcaps(300, '#eef3f8', 21, 70);
    s += hill(324, '#7fa363', 14) + hill(350, '#6f9556', 8, 40);
    s += quad({
      x: 198,
      y: 396,
      s: 1.55,
      c: '#e1a04a',
      dir: -1,
      mane: '#b4622a',
      lion: 1,
      shade: '#6b3a12',
    });
    const fl =
      '<circle cx="-10" cy="-30" r="3" fill="#c94a4a"/><circle cx="8" cy="-46" r="3" fill="#c94a4a"/><circle cx="-4" cy="-14" r="3" fill="#c94a4a"/>';
    const p = person({
      x: 86,
      y: 398,
      s: 1.22,
      pose: 'reach',
      robe: '#f6f2ea',
      pattern: fl,
      trim: '#5d8a4e',
      belt: '#c94a4a',
      hair: '#8a5326',
      long: 1,
      wreath: '#c94a4a',
    });
    s += inf(92, p.head[1] - 28, 28) + p.svg;
    return s;
  };
  SC.c09 = () => {
    let s = sky('#121828', '#2f3c58');
    s += stars(46, 9, '#ffffff', 58, 230);
    s +=
      '<path d="M20 400L150 252L280 400Z" fill="#c4ccd8"/><path d="M150 252L118 292L132 288L144 300L156 286L170 296L182 290Z" fill="#eef2f6"/><path d="M20 400L60 360L96 400Z" fill="#a5afbf"/>';
    const p = person({
      x: 150,
      y: 374,
      s: 1.08,
      pose: 'lantern',
      robe: '#7c7f88',
      cape: '#6a6d76',
      hood: '#62656e',
      beard: '#e9e6df',
      hair: '#9a9aa0',
    });
    s += wand(p.L[0], 400, p.L[0] - 2, p.L[1] - 74, '#c9a24a', 3.4);
    s += p.svg;
    const lx = p.R[0],
      ly = p.R[1];
    s +=
      '<circle cx="' +
      lx +
      '" cy="' +
      f(ly + 16) +
      '" r="42" fill="' +
      glow('#ffe7a0', 0.75) +
      '"/><path d="M' +
      lx +
      ' ' +
      ly +
      'V' +
      f(ly + 4) +
      '" stroke="#d8b45a" stroke-width="1.6"/><path d="M' +
      f(lx - 8) +
      ' ' +
      f(ly + 6) +
      'H' +
      f(lx + 8) +
      'L' +
      f(lx + 6) +
      ' ' +
      f(ly + 30) +
      'H' +
      f(lx - 6) +
      'Z" fill="#f9e7a8" stroke="#a68330" stroke-width="1.6"/>' +
      star8(lx, ly + 18, 6.5, '#f2b71e', 0.35) +
      '<path d="M' +
      f(lx - 9) +
      ' ' +
      f(ly + 6) +
      'L' +
      lx +
      ' ' +
      f(ly - 2) +
      'L' +
      f(lx + 9) +
      ' ' +
      f(ly + 6) +
      'Z" fill="#a68330"/>';
    return s;
  };
  return SC;
}
