import { f, rng } from './math.mjs';

let SID = 0;
function tod(h) {
  return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night';
}
function skyColors(t) {
  return t === 'day'
    ? ['#9fd0f0', '#e6f4fb']
    : t === 'dusk'
      ? ['#f4a96f', '#7d6aa6']
      : ['#141c3c', '#34436f'];
}
function lg(id, c, vert = true) {
  return (
    '<linearGradient id="' +
    id +
    '" x1="0" y1="0" x2="' +
    (vert ? 0 : 1) +
    '" y2="' +
    (vert ? 1 : 0) +
    '">' +
    c.map((x, i) => '<stop offset="' + i / (c.length - 1) + '" stop-color="' + x + '"/>').join('') +
    '</linearGradient>'
  );
}
function rg(id, c, o = 0.8) {
  return (
    '<radialGradient id="' +
    id +
    '"><stop offset="0" stop-color="' +
    c +
    '" stop-opacity="' +
    o +
    '"/><stop offset="1" stop-color="' +
    c +
    '" stop-opacity="0"/></radialGradient>'
  );
}
function starsS(n, seed, x0, x1, y0, y1) {
  const R = rng(seed);
  let s = '';
  for (let i = 0; i < n; i++)
    s +=
      '<circle cx="' +
      f(x0 + R() * (x1 - x0)) +
      '" cy="' +
      f(y0 + R() * (y1 - y0)) +
      '" r="' +
      f(0.6 + R() * 1.4) +
      '" fill="#fff" opacity="' +
      f(0.5 + R() * 0.5) +
      '"/>';
  return s;
}
function rainS(n, seed, x0, x1, y0, y1) {
  const R = rng(seed);
  let s = '<g class="rain">';
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0),
      y = y0 + R() * (y1 - y0);
    s +=
      '<path d="M' +
      f(x) +
      ' ' +
      f(y) +
      'l-4 12" stroke="#cfe3f6" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>';
  }
  return s + '</g>';
}
function leafE(x, y, a, c, l) {
  return (
    '<ellipse cx="' +
    x +
    '" cy="' +
    y +
    '" rx="' +
    f(l / 2) +
    '" ry="' +
    f(l / 4.2) +
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
function treeS(x, y, h, c1 = '#5f8f58', c2 = '#4f7d4a') {
  return (
    '<rect x="' +
    (x - 5) +
    '" y="' +
    (y - h * 0.42) +
    '" width="10" height="' +
    f(h * 0.42) +
    '" fill="#7a5638"/><circle cx="' +
    x +
    '" cy="' +
    f(y - h * 0.62) +
    '" r="' +
    f(h * 0.28) +
    '" fill="' +
    c1 +
    '"/><circle cx="' +
    f(x - h * 0.2) +
    '" cy="' +
    f(y - h * 0.5) +
    '" r="' +
    f(h * 0.2) +
    '" fill="' +
    c2 +
    '"/><circle cx="' +
    f(x + h * 0.2) +
    '" cy="' +
    f(y - h * 0.52) +
    '" r="' +
    f(h * 0.21) +
    '" fill="' +
    c1 +
    '"/>'
  );
}
function room(o) {
  const id = 'rm' + ++SID,
    t = tod(o.hour),
    own = o.own || {},
    night = t === 'night';
  const [s1, s2] = skyColors(t);
  let d =
    '<defs>' +
    lg(id + 'sky', [s1, s2]) +
    rg(id + 'lamp', '#ffd98a', 0.85) +
    rg(id + 'win', '#fff3c4', 0.5) +
    '<clipPath id="' +
    id +
    'wc"><rect x="482" y="72" width="196" height="136"/></clipPath></defs>';
  let s = '<rect width="800" height="340" fill="#efe1c9"/>';
  for (let x = 0; x < 800; x += 40)
    s += '<path d="M' + x + ' 0V250" stroke="#e6d6bb" stroke-width="14" opacity=".45"/>';
  s += '<rect y="250" width="800" height="90" fill="#e3d0b0"/>';
  for (let x = 20; x < 800; x += 64)
    s +=
      '<rect x="' +
      x +
      '" y="262" width="48" height="64" rx="3" fill="none" stroke="#cdb58f" stroke-width="1.6"/>';
  s +=
    '<rect y="330" width="800" height="12" fill="#b99670"/><rect y="342" width="800" height="158" fill="#c79a6b"/>';
  for (let i = 0; i < 5; i++) {
    const y = 356 + i * 30;
    s += '<path d="M0 ' + y + 'H800" stroke="#b38758" stroke-width="1.6"/>';
    for (let x = (i % 2) * 90; x < 800; x += 180)
      s += '<path d="M' + x + ' ' + (y - 30) + 'V' + y + '" stroke="#b38758" stroke-width="1.6"/>';
  }
  /* window */
  s +=
    '<rect x="468" y="58" width="224" height="164" rx="6" fill="#fbf6ea" stroke="#b8916a" stroke-width="6"/><g clip-path="url(#' +
    id +
    'wc)"><rect x="482" y="72" width="196" height="136" fill="url(#' +
    id +
    'sky)"/>';
  if (night)
    s +=
      starsS(22, 7, 486, 676, 76, 170) +
      '<circle cx="640" cy="100" r="14" fill="#f3e6b4"/><circle cx="634" cy="96" r="14" fill="' +
      s1 +
      '"/>';
  else if (t === 'day')
    s +=
      '<circle cx="640" cy="104" r="16" fill="#ffe08a"/><g fill="#fff" opacity=".9"><ellipse cx="540" cy="110" rx="28" ry="10"/><circle cx="530" cy="104" r="10"/><circle cx="548" cy="100" r="12"/></g>';
  else s += '<circle cx="620" cy="160" r="20" fill="#ffd27a" opacity=".9"/>';
  s +=
    '<path d="M482 208V172L500 168V150H514V160H530V140H548V172H566V132H580V166H600V150H618V176H640V158H656V180H678V208Z" fill="' +
    (night ? '#1c2340' : '#7f8fa8') +
    '" opacity=".85"/>';
  if (night) {
    const R = rng(3);
    for (let i = 0; i < 22; i++)
      s +=
        '<rect x="' +
        f(486 + R() * 188) +
        '" y="' +
        f(150 + R() * 52) +
        '" width="3" height="4" fill="#ffd27a" opacity="' +
        f(0.5 + R() * 0.5) +
        '"/>';
  }
  if (o.rain) s += rainS(40, 11, 482, 690, 62, 206);
  s +=
    '</g><path d="M580 72V208M482 140H678" stroke="#fbf6ea" stroke-width="6"/><rect x="460" y="218" width="240" height="10" rx="3" fill="#b8916a"/>';
  s +=
    '<path d="M452 50Q470 140 456 236H486Q478 140 492 50Z" fill="#a9c3b0"/><path d="M708 50Q690 140 704 236H674Q682 140 668 50Z" fill="#a9c3b0"/><rect x="446" y="44" width="268" height="8" rx="4" fill="#8a6d4a"/>';
  if (night)
    s += '<rect x="468" y="58" width="224" height="164" fill="url(#' + id + 'win)" opacity=".0"/>';
  /* fairy lights */
  if (own.lights) {
    s +=
      '<path d="M10 34Q205 92 400 34Q595 92 790 34" stroke="#6b5a48" stroke-width="1.6" fill="none"/>';
    const cols = ['#ffd27a', '#ff9fb2', '#9ff0ff', '#c9f29b'];
    for (let i = 0; i <= 20; i++) {
      const tt = i / 20,
        x = 10 + tt * 780;
      const local = tt < 0.5 ? tt * 2 : (tt - 0.5) * 2;
      const y = 34 + 58 * 4 * local * (1 - local) * 0.95;
      s +=
        (night
          ? '<circle cx="' +
            f(x) +
            '" cy="' +
            f(y + 5) +
            '" r="11" fill="' +
            cols[i % 4] +
            '" opacity=".25"/>'
          : '') +
        '<circle cx="' +
        f(x) +
        '" cy="' +
        f(y + 5) +
        '" r="4.6" fill="' +
        cols[i % 4] +
        '" class="bulb"/>';
    }
  }
  /* card frame */
  if (own.frame) {
    s +=
      '<rect x="296" y="78" width="78" height="118" rx="4" fill="#8a6d4a"/><rect x="302" y="84" width="66" height="106" fill="#f4ead3"/>';
    s += o.frameCard
      ? '<svg x="306" y="88" width="58" height="98" viewBox="0 0 300 500">' + o.frameCard + '</svg>'
      : '<text x="335" y="142" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#8a6d4a">?</text>';
  }
  /* kitchen */
  if (own.kitchen) {
    s +=
      '<rect x="24" y="104" width="142" height="58" rx="3" fill="#ebe2d2" stroke="#cbbf9f"/><path d="M95 104V162" stroke="#cbbf9f"/><circle cx="88" cy="134" r="2.4" fill="#8a6d4a"/><circle cx="102" cy="134" r="2.4" fill="#8a6d4a"/>';
    s +=
      '<rect x="24" y="232" width="142" height="108" fill="#d9cdb6"/><path d="M95 232V340M24 286H166" stroke="#bfae8c"/><circle cx="88" cy="258" r="2.4" fill="#8a6d4a"/><circle cx="102" cy="258" r="2.4" fill="#8a6d4a"/><rect x="20" y="224" width="150" height="10" rx="2" fill="#8a6d4a"/>';
    s +=
      '<path d="M40 224V210H84V224" fill="#3a3a40"/><rect x="36" y="206" width="52" height="6" rx="3" fill="#2b2b30"/><path d="M84 210H96" stroke="#2b2b30" stroke-width="4" stroke-linecap="round"/>';
    s +=
      '<g class="steam"><path d="M52 200Q46 188 54 178Q60 170 54 160M66 200Q60 186 68 176Q74 168 68 156" stroke="#fff" stroke-opacity=".75" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
    s +=
      '<path d="M118 172V196M128 172V190M138 172V198" stroke="#8a6d4a" stroke-width="2"/><ellipse cx="118" cy="200" rx="5" ry="6" fill="#9aa2ad"/><rect x="125" y="190" width="6" height="12" rx="2" fill="#9aa2ad"/><ellipse cx="138" cy="202" rx="6" ry="4" fill="#9aa2ad"/><rect x="108" y="168" width="40" height="4" fill="#8a6d4a"/>';
  }
  /* bookshelf + record player */
  if (own.shelf) {
    s +=
      '<rect x="186" y="110" width="94" height="230" rx="3" fill="#a0744c"/><rect x="192" y="116" width="82" height="218" fill="#8a6040"/>';
    const R = rng(17);
    const cols = ['#c64b3a', '#3f6f93', '#e2b84a', '#5d8a4e', '#9a7aa8', '#e9dcc0', '#d9826a'];
    const n = o.books || 18;
    let k = 0;
    for (let sh = 0; sh < 4; sh++) {
      const y = 172 + sh * 54;
      s += '<rect x="192" y="' + y + '" width="82" height="6" fill="#a0744c"/>';
      let x = 196;
      while (x < 268 && k < n) {
        const w = 7 + R() * 6,
          h = 30 + R() * 14;
        s +=
          '<rect x="' +
          f(x) +
          '" y="' +
          f(y - h) +
          '" width="' +
          f(w) +
          '" height="' +
          f(h) +
          '" fill="' +
          cols[k % 7] +
          '"/>';
        x += w + 1.2;
        k++;
      }
    }
  }
  if (own.record) {
    s +=
      '<rect x="192" y="86" width="82" height="24" rx="3" fill="#6b4a2e"/><ellipse cx="226" cy="88" rx="26" ry="6" fill="#1d1d22"/><ellipse cx="226" cy="88" rx="6" ry="1.8" fill="#c64b3a"/><path d="M262 82L248 90" stroke="#c9c3b4" stroke-width="2.4" stroke-linecap="round"/>';
    s +=
      '<g class="notes"><text x="250" y="62" font-family="Georgia, serif" font-size="20" fill="#8a6d4a">♪</text><text x="270" y="44" font-family="Georgia, serif" font-size="16" fill="#8a6d4a">♫</text></g>';
  }
  /* fish tank */
  if (own.tank) {
    s +=
      '<rect x="296" y="264" width="80" height="76" rx="3" fill="#a0744c"/><path d="M336 264V340" stroke="#8a6040"/><rect x="298" y="210" width="76" height="56" rx="4" fill="#a8dbe9" opacity=".85" stroke="#7fb3c4" stroke-width="2"/><path d="M300 254Q310 244 318 254M340 258Q346 246 352 258" stroke="#5d8a4e" stroke-width="2.4" fill="none"/>';
    s +=
      '<g class="fish"><ellipse cx="320" cy="232" rx="7" ry="4" fill="#f08c2e"/><path d="M313 232l-6 -4v8z" fill="#f08c2e"/></g><g class="fish f2"><ellipse cx="350" cy="244" rx="6" ry="3.4" fill="#ff7f9e"/><path d="M356 244l5 -3v6z" fill="#ff7f9e"/></g><circle cx="330" cy="222" r="2" fill="#fff" opacity=".8" class="bubble"/>';
  }
  /* lamp */
  if (own.lamp) {
    s +=
      '<circle cx="404" cy="196" r="' +
      (night ? 130 : 80) +
      '" fill="url(#' +
      id +
      'lamp)" opacity="' +
      (night ? 1 : 0.45) +
      '"/><path d="M404 196V336" stroke="#5e4a38" stroke-width="4"/><ellipse cx="404" cy="338" rx="20" ry="5" fill="#5e4a38"/><path d="M382 196L390 160H418L426 196Z" fill="#f2d7a6"/><path d="M382 196H426" stroke="#d9b779" stroke-width="2"/>';
  }
  /* sofa */
  if (own.sofa) {
    s +=
      '<rect x="452" y="238" width="218" height="58" rx="18" fill="#7f9aa8"/><rect x="438" y="264" width="246" height="66" rx="16" fill="#8eaab8"/><rect x="430" y="256" width="30" height="74" rx="14" fill="#7f9aa8"/><rect x="662" y="256" width="30" height="74" rx="14" fill="#7f9aa8"/><rect x="474" y="244" width="46" height="40" rx="12" fill="#e7b45a" transform="rotate(-8 497 264)"/><rect x="610" y="244" width="46" height="40" rx="12" fill="#d9826a" transform="rotate(8 633 264)"/><path d="M452 330V342M670 330V342" stroke="#5e4a38" stroke-width="5"/>';
  }
  /* plant */
  if (own.plant) {
    s +=
      '<path d="M712 298H764L756 340H720Z" fill="#c4704f"/><rect x="708" y="292" width="60" height="8" rx="3" fill="#b05f40"/>';
    [
      [738, 250, -20, 46],
      [724, 262, -55, 40],
      [752, 262, 50, 40],
      [738, 232, 5, 42],
      [714, 280, -80, 30],
      [762, 280, 80, 30],
    ].forEach(([x, y, a, l]) => {
      s +=
        '<path d="M738 294Q' +
        (x + 738) / 2 +
        ' ' +
        (y + 20) +
        ' ' +
        x +
        ' ' +
        y +
        '" stroke="#4f7a3e" stroke-width="2.2" fill="none"/>' +
        leafE(x, y, a, '#5d8f50', l);
    });
  }
  /* rug + bed */
  s +=
    '<ellipse cx="400" cy="436" rx="236" ry="48" fill="#d9826a"/><ellipse cx="400" cy="436" rx="206" ry="38" fill="none" stroke="#f1c6a8" stroke-width="3" stroke-dasharray="10 8"/><ellipse cx="400" cy="436" rx="150" ry="24" fill="none" stroke="#c76c55" stroke-width="2"/>';
  s +=
    '<ellipse cx="640" cy="446" rx="62" ry="20" fill="#d0a77c"/><ellipse cx="640" cy="440" rx="50" ry="13" fill="#f0dcc0"/>';
  if (own.shoes)
    s +=
      '<g transform="translate(110 446)"><path d="M0 0Q2 -16 16 -16Q26 -14 34 -6L36 0Z" fill="#c64b3a"/><rect x="-1" y="-2" width="38" height="5" rx="2" fill="#f4f1ea"/></g><g transform="translate(150 456)"><path d="M0 0Q2 -16 16 -16Q26 -14 34 -6L36 0Z" fill="#c64b3a"/><rect x="-1" y="-2" width="38" height="5" rx="2" fill="#f4f1ea"/></g>';
  if (own.ball)
    s +=
      '<g transform="translate(250 456)"><circle r="15" fill="#f2c94a"/><path d="M-15 0Q0 -8 15 0M-15 0Q0 8 15 0" stroke="#c64b3a" stroke-width="3" fill="none"/></g>';
  if (night)
    s +=
      '<rect width="800" height="500" fill="#151a38" opacity=".28"/>' +
      (own.lamp
        ? '<circle cx="404" cy="196" r="150" fill="url(#' + id + 'lamp)" opacity=".5"/>'
        : '');
  return (
    '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">' +
    d +
    s +
    '</svg>'
  );
}
function park(o) {
  const id = 'pk' + ++SID,
    t = tod(o.hour);
  const [s1, s2] = skyColors(t);
  let s =
    '<defs>' +
    lg(id + 's', [s1, s2]) +
    rg(id + 'g', '#fff3c4', 0.5) +
    '</defs><rect width="800" height="500" fill="url(#' +
    id +
    's)"/>';
  if (t === 'night')
    s += starsS(40, 5, 0, 800, 0, 200) + '<circle cx="660" cy="80" r="22" fill="#f3e6b4"/>';
  else if (t === 'day') s += '<circle cx="660" cy="86" r="30" fill="#ffe08a"/>';
  else s += '<circle cx="660" cy="220" r="34" fill="#ffc27a"/>';
  s +=
    '<g fill="#fff" opacity="' +
    (t === 'night' ? 0.15 : 0.85) +
    '"><ellipse cx="180" cy="90" rx="60" ry="18"/><circle cx="160" cy="80" r="20"/><circle cx="190" cy="74" r="24"/><ellipse cx="480" cy="60" rx="46" ry="14"/><circle cx="470" cy="52" r="16"/></g>';
  s +=
    '<path d="M0 300Q200 250 400 290T800 270V500H0Z" fill="' +
    (t === 'night' ? '#2f4a3a' : '#8fc07a') +
    '"/><path d="M0 340Q250 300 500 340T800 330V500H0Z" fill="' +
    (t === 'night' ? '#28402f' : '#7fb36b') +
    '"/>';
  s +=
    treeS(
      80,
      330,
      170,
      t === 'night' ? '#2f5a3c' : '#5f8f58',
      t === 'night' ? '#284d33' : '#4f7d4a',
    ) +
    treeS(720, 320, 190, t === 'night' ? '#2f5a3c' : '#5f8f58') +
    treeS(610, 300, 120);
  s +=
    '<ellipse cx="560" cy="380" rx="120" ry="26" fill="#7fb2d8" opacity=".9"/><path d="M470 378h30M560 386h40" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>';
  s += '<path d="M0 470Q300 410 520 440T800 420V500H0Z" fill="#d9c79f"/>';
  s +=
    '<g transform="translate(200 352)"><rect x="0" y="0" width="120" height="10" rx="3" fill="#8a5a33"/><rect x="0" y="-26" width="120" height="8" rx="3" fill="#8a5a33"/><rect x="0" y="-14" width="120" height="8" rx="3" fill="#8a5a33"/><path d="M10 10V34M110 10V34" stroke="#3a3a40" stroke-width="5"/></g>';
  s +=
    '<path d="M380 470V300" stroke="#3a3f5c" stroke-width="6"/><circle cx="380" cy="292" r="10" fill="' +
    (t === 'night' ? '#fff3c4' : '#e9e3d2') +
    '"/>' +
    (t === 'night' ? '<circle cx="380" cy="300" r="80" fill="url(#' + id + 'g)"/>' : '');
  const R = rng(9);
  for (let i = 0; i < 26; i++) {
    const x = R() * 800,
      y = 400 + R() * 90;
    s +=
      '<circle cx="' +
      f(x) +
      '" cy="' +
      f(y) +
      '" r="3.4" fill="' +
      ['#ff9fb2', '#fff4c8', '#ffcf6b', '#c9b7f0'][i % 4] +
      '"/>';
  }
  return (
    '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">' + s + '</svg>'
  );
}
function lake(o) {
  const id = 'lk' + ++SID,
    t = tod(o.hour);
  const [s1, s2] = skyColors(t);
  let s =
    '<defs>' +
    lg(id + 's', [s1, s2]) +
    '</defs><rect width="800" height="500" fill="url(#' +
    id +
    's)"/>';
  if (t === 'night') s += starsS(40, 15, 0, 800, 0, 200);
  s +=
    t === 'day'
      ? '<circle cx="160" cy="90" r="26" fill="#ffe08a"/>'
      : t === 'dusk'
        ? '<circle cx="400" cy="250" r="44" fill="#ffc27a"/>'
        : '<circle cx="160" cy="90" r="18" fill="#f3e6b4"/>';
  const sk = t === 'night' ? '#1a2140' : '#8b8fa8';
  const R = rng(21);
  let x = 40;
  while (x < 760) {
    const w = 20 + R() * 30,
      h = 30 + R() * 70;
    s +=
      '<rect x="' +
      f(x) +
      '" y="' +
      f(256 - h) +
      '" width="' +
      f(w) +
      '" height="' +
      f(h) +
      '" fill="' +
      sk +
      '"/>';
    if (t === 'night')
      for (let k = 0; k < 6; k++)
        s +=
          '<rect x="' +
          f(x + 3 + R() * (w - 6)) +
          '" y="' +
          f(256 - h + 6 + R() * (h - 12)) +
          '" width="3" height="4" fill="#ffd27a" opacity=".8"/>';
    x += w + 2;
  }
  s +=
    '<rect x="520" y="70" width="6" height="110" fill="' +
    sk +
    '"/><ellipse cx="523" cy="176" rx="18" ry="8" fill="' +
    sk +
    '"/><path d="M516 182L510 256H536L530 182Z" fill="' +
    sk +
    '"/>' +
    (t === 'night' ? '<circle cx="523" cy="68" r="3" fill="#e05a4a"/>' : '');
  s +=
    '<rect y="256" width="800" height="140" fill="' +
    (t === 'night' ? '#24365e' : '#6d9cc4') +
    '"/>';
  for (let i = 0; i < 16; i++)
    s +=
      '<path d="M' +
      f(R() * 760) +
      ' ' +
      f(270 + R() * 120) +
      'h' +
      f(20 + R() * 30) +
      '" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>';
  s +=
    '<g transform="translate(240 300)"><path d="M0 0H60L50 12H8Z" fill="#f4f1ea"/><path d="M30 0V-50L56 -4Z" fill="#fbf8ef"/></g><g transform="translate(620 320) scale(.7)"><path d="M0 0H60L50 12H8Z" fill="#f4f1ea"/><path d="M30 0V-50L4 -4Z" fill="#ff9fb2"/></g>';
  s += '<rect y="396" width="800" height="104" fill="#b8916a"/>';
  for (let x2 = 0; x2 < 800; x2 += 40)
    s += '<path d="M' + x2 + ' 396V500" stroke="#a07a54" stroke-width="2"/>';
  s += '<rect y="390" width="800" height="8" fill="#8a6d4a"/>';
  return (
    '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">' + s + '</svg>'
  );
}
function street(o) {
  const id = 'st' + ++SID;
  let s =
    '<defs>' +
    rg(id + 'g', '#fff3c4', 0.55) +
    '</defs><rect width="800" height="500" fill="#151b38"/>' +
    starsS(30, 31, 0, 800, 0, 140);
  const R = rng(41);
  let x = 0;
  while (x < 800) {
    const w = 60 + R() * 70,
      h = 160 + R() * 160;
    s +=
      '<rect x="' +
      f(x) +
      '" y="' +
      f(380 - h) +
      '" width="' +
      f(w) +
      '" height="' +
      f(h) +
      '" fill="' +
      ['#222a4d', '#1d2442', '#283158'][Math.floor(R() * 3)] +
      '"/>';
    for (let wy = 380 - h + 14; wy < 370; wy += 22)
      for (let wx = x + 10; wx < x + w - 14; wx += 18)
        if (R() < 0.45)
          s +=
            '<rect x="' +
            f(wx) +
            '" y="' +
            f(wy) +
            '" width="8" height="10" fill="#ffd27a" opacity="' +
            f(0.5 + R() * 0.5) +
            '"/>';
    x += w;
  }
  s +=
    '<rect x="430" y="250" width="200" height="130" fill="#2a3358"/><rect x="430" y="250" width="200" height="34" fill="#c64b3a"/><text x="530" y="274" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="20" font-weight="700" fill="#fff4c8" letter-spacing="4">便利店 24h</text><rect x="446" y="296" width="168" height="84" fill="#fff3c4" opacity=".85"/><rect x="510" y="300" width="40" height="80" fill="#e9dcc0"/>';
  s +=
    '<rect y="380" width="800" height="120" fill="#1f2433"/><path d="M0 440H800" stroke="#f2c94a" stroke-opacity=".5" stroke-width="3" stroke-dasharray="30 20"/>';
  [120, 700].forEach((lx) => {
    s +=
      '<path d="M' +
      lx +
      ' 400V250Q' +
      lx +
      ' 236 ' +
      (lx + 18) +
      ' 236" stroke="#3a3f5c" stroke-width="6" fill="none"/><circle cx="' +
      (lx + 20) +
      '" cy="250" r="80" fill="url(#' +
      id +
      'g)"/><circle cx="' +
      (lx + 20) +
      '" cy="242" r="7" fill="#fff3c4"/>';
  });
  for (let i = 0; i < 8; i++)
    s +=
      '<path d="M' +
      f(R() * 800) +
      ' ' +
      f(400 + R() * 90) +
      'h' +
      f(20 + R() * 40) +
      '" stroke="#ffd27a" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>';
  return (
    '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">' + s + '</svg>'
  );
}
function cafe(o) {
  let s = '<rect width="800" height="500" fill="#f3e2c8"/>';
  for (let x = 0; x < 800; x += 50)
    s += '<path d="M' + x + ' 0V320" stroke="#ead6b5" stroke-width="22"/>';
  s += '<rect y="320" width="800" height="180" fill="#b98a5c"/>';
  for (let i = 0; i < 4; i++)
    s += '<path d="M0 ' + (350 + i * 40) + 'H800" stroke="#a87a4e" stroke-width="2"/>';
  s +=
    '<rect x="40" y="60" width="220" height="70" rx="8" fill="#5d3f2a"/><text x="150" y="104" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="26" font-weight="600" fill="#f4ead3" letter-spacing="6">毛孩茶室</text>';
  s +=
    '<rect x="520" y="70" width="230" height="150" rx="6" fill="#fbf6ea" stroke="#b8916a" stroke-width="6"/><path d="M635 70V220M520 145H750" stroke="#b8916a" stroke-width="4"/><g fill="#9fd0f0"><rect x="526" y="76" width="104" height="64"/><rect x="640" y="76" width="104" height="64"/><rect x="526" y="150" width="104" height="64"/><rect x="640" y="150" width="104" height="64"/></g>';
  s +=
    '<rect x="40" y="220" width="260" height="100" rx="6" fill="#8a6040"/><rect x="34" y="212" width="272" height="12" rx="4" fill="#5d3f2a"/><g transform="translate(80 200)"><path d="M0 0H20V-4Q20 -16 10 -16Q0 -16 0 -4Z" fill="#f4ead3"/></g><g transform="translate(130 200)"><path d="M0 0H24L20 -22H4Z" fill="#c64b3a"/></g><g transform="translate(200 212)"><circle cx="0" cy="-14" r="14" fill="#e7b45a"/><circle cx="0" cy="-14" r="6" fill="#f4ead3"/></g>';
  [
    [180, 450, '#e7b45a'],
    [420, 460, '#d9826a'],
    [640, 450, '#a9c3b0'],
  ].forEach(([cx, cy, c]) => {
    s +=
      '<ellipse cx="' +
      cx +
      '" cy="' +
      cy +
      '" rx="80" ry="22" fill="' +
      c +
      '"/><ellipse cx="' +
      cx +
      '" cy="' +
      (cy - 6) +
      '" rx="64" ry="14" fill="#fbf3e3" opacity=".5"/>';
  });
  s += '<path d="M330 40Q560 90 790 40" stroke="#6b5a48" stroke-width="1.6" fill="none"/>';
  for (let i = 0; i < 10; i++) {
    const x = 340 + i * 46;
    s +=
      '<path d="M' +
      x +
      ' ' +
      (48 + Math.sin((i / 9) * Math.PI) * 28) +
      'l10 22h-20z" fill="' +
      ['#ff9fb2', '#ffcf6b', '#9ff0ff', '#c9f29b'][i % 4] +
      '"/>';
  }
  return (
    '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">' + s + '</svg>'
  );
}
const PLACES = {
  home: { n: '屋企', f: room },
  park: { n: '公園', f: park },
  lake: { n: '湖邊', f: lake },
  street: { n: '夜街', f: street },
  cafe: { n: '寵物 café', f: cafe },
};
export { PLACES, room, park, lake, street, cafe, tod };
