import { f, rng } from './math.mjs';
const PAL = {
  milktea: {
    n: '奶茶',
    body: '#ecd3ad',
    shade: '#cfae80',
    belly: '#f8ead2',
    accent: '#ff9fb2',
    glow: '#5fe3cf',
  },
  mint: {
    n: '薄荷',
    body: '#c9ecdf',
    shade: '#93c9b6',
    belly: '#ecf9f3',
    accent: '#ff9fb2',
    glow: '#7cc6ff',
  },
  sakura: {
    n: '櫻花',
    body: '#f6cfd9',
    shade: '#dfa2b3',
    belly: '#fdecf1',
    accent: '#ff7f9e',
    glow: '#ffcf6b',
  },
  night: {
    n: '夜空',
    body: '#4a5480',
    shade: '#323a5c',
    belly: '#6d78a6',
    accent: '#ff9fb2',
    glow: '#9ff0ff',
  },
  snow: {
    n: '雪白',
    body: '#f3f0ea',
    shade: '#d3ccbf',
    belly: '#ffffff',
    accent: '#ff9fb2',
    glow: '#6fd2ff',
  },
  aurora: {
    n: '極光',
    body: '#e4dcff',
    shade: '#b2a2ec',
    belly: '#f6f1ff',
    accent: '#ff9fd0',
    glow: '#ffd27a',
    rare: 1,
  },
};
const SPECIES = { cat: '電波貓', dog: '機械柴', cloud: '雲朵獸' };
const STAGES = [
  { n: '幼崽', s: 0.74, xp: 0 },
  { n: '少年', s: 0.87, xp: 120 },
  { n: '成年', s: 1, xp: 420 },
];
const VISOR = '#1c2136';
function eyes(expr, g) {
  const st = 'stroke="' + g + '" stroke-width="4" stroke-linecap="round" fill="none"';
  switch (expr) {
    case 'happy':
      return (
        '<path d="M78 101Q86 89 94 101M106 101Q114 89 122 101" ' +
        st +
        '/><path d="M93 108Q100 116 107 108Z" fill="' +
        g +
        '"/>'
      );
    case 'love':
      return (
        '<path d="M86 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z" fill="' +
        g +
        '"/><path d="M114 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z" fill="' +
        g +
        '"/><path d="M95 110Q100 114 105 110" ' +
        st +
        ' stroke-width="3"/>'
      );
    case 'sleep':
      return (
        '<path d="M78 98H93M107 98H122" ' +
        st +
        '/><path d="M96 109Q100 111 104 109" ' +
        st +
        ' stroke-width="2.6"/>'
      );
    case 'eat':
      return (
        '<path d="M78 99Q86 89 94 99M106 99Q114 89 122 99" ' +
        st +
        '/><ellipse cx="100" cy="110" rx="6" ry="5" fill="' +
        g +
        '"/>'
      );
    case 'wow':
      return (
        '<circle cx="86" cy="96" r="6" ' +
        st +
        ' stroke-width="3.4"/><circle cx="114" cy="96" r="6" ' +
        st +
        ' stroke-width="3.4"/><circle cx="100" cy="110" r="3" fill="' +
        g +
        '"/>'
      );
    case 'ask':
      return (
        '<g class="blink"><rect x="81" y="88" width="9" height="15" rx="4.5" fill="' +
        g +
        '"/><rect x="110" y="88" width="9" height="15" rx="4.5" fill="' +
        g +
        '"/></g><path d="M95 110Q100 107 105 110" ' +
        st +
        ' stroke-width="2.6"/>'
      );
    default:
      return (
        '<g class="blink"><rect x="81" y="88" width="9" height="15" rx="4.5" fill="' +
        g +
        '"/><rect x="110" y="88" width="9" height="15" rx="4.5" fill="' +
        g +
        '"/></g><path d="M93 108Q96.5 112 100 108Q103.5 112 107 108" ' +
        st +
        ' stroke-width="2.6"/>'
      );
  }
}
function visor(expr, c, y = 0) {
  return (
    '<g transform="translate(0 ' +
    y +
    ')"><rect x="64" y="76" width="72" height="42" rx="19" fill="' +
    VISOR +
    '"/><rect x="64" y="76" width="72" height="42" rx="19" fill="none" stroke="' +
    c.glow +
    '" stroke-opacity=".35" stroke-width="2"/><path d="M74 84Q82 80 92 80" stroke="#fff" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" fill="none"/>' +
    eyes(expr, c.glow) +
    '</g>'
  );
}
function acc(a, stage) {
  const y = stage === 0 ? 0 : 0;
  switch (a) {
    case 'scarf':
      return '<path d="M58 128Q100 146 142 128L144 138Q100 158 56 138Z" fill="#c64b3a"/><path d="M118 142L126 168L112 166L110 144Z" fill="#b13c2d"/><path d="M60 133Q100 150 140 133" stroke="#f2c94a" stroke-width="2" stroke-dasharray="4 4" fill="none"/>';
    case 'bow':
      return '<path d="M118 52L134 42L136 62Z" fill="#ff7f9e"/><path d="M118 52L104 40L102 60Z" fill="#ff7f9e"/><circle cx="118" cy="52" r="5" fill="#e85c80"/>';
    case 'beanie':
      return '<path d="M56 74Q58 30 100 30Q142 30 144 74Z" fill="#3f6f93"/><rect x="54" y="66" width="92" height="14" rx="7" fill="#2f5675"/><circle cx="100" cy="28" r="9" fill="#f4ead3"/>';
    case 'flower':
      return (
        '<g transform="translate(130 50)">' +
        [0, 72, 144, 216, 288]
          .map(
            (r) =>
              '<ellipse cx="0" cy="-7" rx="5" ry="7" fill="#fff4c8" transform="rotate(' +
              r +
              ')"/>',
          )
          .join('') +
        '<circle r="4.5" fill="#f2b71e"/></g>'
      );
    case 'bell':
      return '<path d="M62 130Q100 146 138 130" stroke="#c64b3a" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="142" r="8" fill="#f2c94a" stroke="#b8862f"/><path d="M96 144H104" stroke="#b8862f" stroke-width="1.6"/>';
    default:
      return '';
  }
}
function body(o) {
  const c = PAL[o.color] || PAL.milktea,
    sp = o.sp || 'cat',
    st = o.stage || 0,
    expr = o.expr || 'normal';
  const sc = (STAGES[st] || STAGES[0]).s;
  let g =
    '<ellipse cx="100" cy="190" rx="' +
    (sp === 'cloud' ? 34 : 48) +
    '" ry="7" fill="#000" opacity=".16"/>';
  let inner = '';
  if (o.shiny) {
    inner +=
      '<circle cx="100" cy="112" r="86" fill="#ffd27a" opacity=".10"/><circle cx="100" cy="112" r="74" fill="#ff9fd0" opacity=".10"/><circle cx="100" cy="112" r="62" fill="#9ff0ff" opacity=".12"/>';
    [
      [26, 70, 7],
      [174, 56, 6],
      [22, 150, 5],
      [180, 140, 7],
      [60, 24, 5],
      [150, 186, 5],
    ].forEach(([x, y, r]) => {
      inner +=
        '<path d="M' +
        x +
        ' ' +
        (y - r * 2) +
        'Q' +
        (x + r * 0.3) +
        ' ' +
        (y - r * 0.3) +
        ' ' +
        (x + r * 2) +
        ' ' +
        y +
        'Q' +
        (x + r * 0.3) +
        ' ' +
        (y + r * 0.3) +
        ' ' +
        x +
        ' ' +
        (y + r * 2) +
        'Q' +
        (x - r * 0.3) +
        ' ' +
        (y + r * 0.3) +
        ' ' +
        (x - r * 2) +
        ' ' +
        y +
        'Q' +
        (x - r * 0.3) +
        ' ' +
        (y - r * 0.3) +
        ' ' +
        x +
        ' ' +
        (y - r * 2) +
        'Z" fill="#ffd27a" class="twinkle"/>';
    });
  }
  const ant =
    '<path d="M100 46V26" stroke="' +
    c.shade +
    '" stroke-width="3.4" stroke-linecap="round"/><circle cx="100" cy="21" r="13" fill="' +
    c.glow +
    '" opacity=".28" class="glowpulse"/><circle cx="100" cy="21" r="6.5" fill="' +
    c.glow +
    '"/><circle cx="98" cy="19" r="2" fill="#fff" opacity=".8"/>';
  const ol =
    'stroke="' +
    (o.shiny ? '#f2c94a' : c.shade) +
    '" stroke-width="' +
    (o.shiny ? 6 : 5) +
    '" stroke-linejoin="round"';
  if (sp !== 'cloud')
    inner +=
      '<g fill="' +
      c.shade +
      '" ' +
      ol +
      '><ellipse cx="100" cy="152" rx="46" ry="38"/><circle cx="100" cy="94" r="48"/></g>';
  if (sp === 'cat') {
    inner +=
      '<path d="M136 162Q172 160 168 124Q166 108 176 102" stroke="' +
      c.body +
      '" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="176" cy="100" r="8" fill="' +
      c.glow +
      '"/><circle cx="176" cy="100" r="14" fill="' +
      c.glow +
      '" opacity=".25"/>';
    inner +=
      '<ellipse cx="100" cy="152" rx="46" ry="38" fill="' +
      c.body +
      '"/><ellipse cx="100" cy="160" rx="28" ry="22" fill="' +
      c.belly +
      '"/>';
    inner +=
      '<ellipse cx="78" cy="185" rx="14" ry="7.5" fill="' +
      c.shade +
      '"/><ellipse cx="122" cy="185" rx="14" ry="7.5" fill="' +
      c.shade +
      '"/>';
    inner +=
      '<path d="M60 72L54 28Q56 24 60 26L92 52Z" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-width="2.4" stroke-linejoin="round"/><path d="M64 62L61 38L82 54Z" fill="' +
      c.accent +
      '" opacity=".7"/><path d="M140 72L146 28Q144 24 140 26L108 52Z" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-width="2.4" stroke-linejoin="round"/><path d="M136 62L139 38L118 54Z" fill="' +
      c.accent +
      '" opacity=".7"/>';
    inner +=
      ant +
      '<circle cx="100" cy="94" r="48" fill="' +
      c.body +
      '"/><path d="M62 114Q100 146 138 114" stroke="' +
      c.shade +
      '" stroke-opacity=".35" stroke-width="2" fill="none"/>';
    inner +=
      visor(expr, c) +
      '<ellipse cx="57" cy="114" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/><ellipse cx="143" cy="114" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/>';
    inner +=
      '<path d="M48 104H34M48 110L35 114M152 104H166M152 110L165 114" stroke="' +
      c.shade +
      '" stroke-width="2" stroke-linecap="round"/>';
    inner +=
      '<ellipse cx="82" cy="170" rx="11" ry="9" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-opacity=".5"/><ellipse cx="118" cy="170" rx="11" ry="9" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-opacity=".5"/>';
  } else if (sp === 'dog') {
    inner +=
      '<circle cx="146" cy="138" r="14" fill="none" stroke="' +
      c.body +
      '" stroke-width="9"/><circle cx="146" cy="124" r="4" fill="' +
      c.glow +
      '"/>';
    inner +=
      '<ellipse cx="100" cy="152" rx="46" ry="38" fill="' +
      c.body +
      '"/><ellipse cx="100" cy="160" rx="28" ry="22" fill="' +
      c.belly +
      '"/>';
    inner +=
      '<ellipse cx="78" cy="185" rx="14" ry="7.5" fill="' +
      c.shade +
      '"/><ellipse cx="122" cy="185" rx="14" ry="7.5" fill="' +
      c.shade +
      '"/>';
    inner +=
      '<path d="M58 66Q50 30 70 34Q84 40 88 56Z" fill="' +
      c.shade +
      '"/><path d="M142 66Q150 30 130 34Q116 40 112 56Z" fill="' +
      c.shade +
      '"/>';
    inner +=
      '<path d="M100 46V34" stroke="' +
      c.shade +
      '" stroke-width="3.4" stroke-linecap="round"/><path d="M90 32Q100 22 110 32Z" fill="' +
      c.glow +
      '"/><circle cx="100" cy="28" r="12" fill="' +
      c.glow +
      '" opacity=".25" class="glowpulse"/>';
    inner +=
      '<circle cx="100" cy="94" r="48" fill="' +
      c.body +
      '"/><ellipse cx="100" cy="124" rx="26" ry="16" fill="' +
      c.belly +
      '"/><ellipse cx="100" cy="118" rx="7" ry="5" fill="#3a2a20"/><path d="M100 123V128M94 130Q100 134 106 130" stroke="#3a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>';
    inner += '<g transform="translate(0 -8)">' + visor(expr, c) + '</g>';
    inner +=
      '<path d="M140 76l6 3v7l-6 3l-6 -3v-7z" fill="' +
      c.shade +
      '"/><circle cx="140" cy="82.5" r="2" fill="' +
      c.glow +
      '"/>';
    inner +=
      '<ellipse cx="58" cy="112" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/><ellipse cx="142" cy="112" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/>';
    inner +=
      '<ellipse cx="82" cy="172" rx="11" ry="9" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-opacity=".5"/><ellipse cx="118" cy="172" rx="11" ry="9" fill="' +
      c.body +
      '" stroke="' +
      c.shade +
      '" stroke-opacity=".5"/>';
  } else {
    /* cloud */
    inner += '<g class="floaty">';
    inner +=
      '<g fill="' +
      c.shade +
      '" ' +
      ol +
      '><circle cx="58" cy="136" r="30"/><circle cx="142" cy="136" r="30"/><circle cx="78" cy="156" r="28"/><circle cx="122" cy="156" r="28"/><circle cx="100" cy="162" r="24"/><circle cx="100" cy="106" r="50"/><circle cx="76" cy="72" r="18"/><circle cx="124" cy="72" r="18"/></g>';
    inner +=
      '<circle cx="58" cy="136" r="30" fill="' +
      c.body +
      '"/><circle cx="142" cy="136" r="30" fill="' +
      c.body +
      '"/><circle cx="78" cy="156" r="28" fill="' +
      c.body +
      '"/><circle cx="122" cy="156" r="28" fill="' +
      c.body +
      '"/><circle cx="100" cy="162" r="24" fill="' +
      c.body +
      '"/>';
    inner +=
      '<path d="M86 52Q80 34 90 30Q94 40 94 50M114 52Q120 34 110 30Q106 40 106 50" fill="' +
      c.glow +
      '" opacity=".9"/>';
    inner +=
      '<circle cx="100" cy="106" r="50" fill="' +
      c.body +
      '"/><circle cx="76" cy="72" r="18" fill="' +
      c.body +
      '"/><circle cx="124" cy="72" r="18" fill="' +
      c.body +
      '"/>';
    inner +=
      '<g transform="translate(0 10)">' +
      visor(expr, c) +
      '</g><ellipse cx="56" cy="128" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/><ellipse cx="144" cy="128" rx="7" ry="4.5" fill="' +
      c.accent +
      '" opacity=".75"/>';
    inner +=
      '<path d="M30 92l3 7l7 3l-7 3l-3 7l-3 -7l-7 -3l7 -3z" fill="' +
      c.glow +
      '" class="twinkle"/><path d="M170 70l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z" fill="' +
      c.glow +
      '" class="twinkle"/>';
    inner += '</g>';
  }
  if (o.acc)
    inner +=
      '<g transform="translate(0 ' + (sp === 'cloud' ? 10 : 0) + ')">' + acc(o.acc, st) + '</g>';
  if (o.trait && st >= 1)
    inner +=
      '<g transform="translate(0 ' +
      (sp === 'cloud' ? 10 : 0) +
      ')">' +
      traitItem(o.trait, o.acc) +
      '</g>';
  if (expr === 'sleep')
    inner +=
      '<text x="150" y="58" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="' +
      c.glow +
      '" class="zzz">z</text><text x="166" y="38" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="' +
      c.glow +
      '" class="zzz z2">z</text>';
  g += '<g transform="translate(100 190) scale(' + sc + ') translate(-100 -190)">' + inner + '</g>';
  return g;
}
function traitItem(t, a) {
  const hat = ['beanie', 'bow', 'flower'].includes(a);
  switch (t) {
    case 'adv':
      return '<path d="M72 128L84 176M128 128L116 176" stroke="#7a5638" stroke-width="5" stroke-linecap="round"/><rect x="138" y="132" width="30" height="36" rx="8" fill="#c4704f" stroke="#7a5638" stroke-width="2"/><rect x="142" y="146" width="22" height="10" rx="3" fill="#a85a3e"/>';
    case 'food':
      return hat
        ? ''
        : '<path d="M70 66Q60 40 80 40Q84 24 100 30Q116 24 120 40Q140 40 130 66Z" fill="#fffdf6" stroke="#d6cfc0" stroke-width="2"/><rect x="70" y="60" width="60" height="10" rx="3" fill="#fffdf6" stroke="#d6cfc0" stroke-width="2"/>';
    case 'photo':
      return '<path d="M66 126Q100 150 134 126" stroke="#2b2a28" stroke-width="2.6" fill="none"/><rect x="86" y="140" width="28" height="20" rx="4" fill="#2b2a28"/><circle cx="100" cy="150" r="6.5" fill="#9ff0ff" stroke="#555" stroke-width="2"/><rect x="104" y="136" width="7" height="5" rx="1" fill="#2b2a28"/>';
    case 'talk':
      return '<g transform="translate(124 18)"><path d="M0 0H30Q36 0 36 6V18Q36 24 30 24H12L4 32V24Q0 24 0 18V6Q0 0 6 0Z" fill="#fffdf6" stroke="#d6cfc0" stroke-width="1.6"/><circle cx="10" cy="12" r="2.4" fill="#8a8a90"/><circle cx="18" cy="12" r="2.4" fill="#8a8a90"/><circle cx="26" cy="12" r="2.4" fill="#8a8a90"/></g>';
    case 'social':
      return '<path d="M62 126Q100 142 138 126L100 168Z" fill="#3f6f93"/><circle cx="90" cy="140" r="2" fill="#f4ead3"/><circle cx="108" cy="146" r="2" fill="#f4ead3"/><circle cx="100" cy="134" r="2" fill="#f4ead3"/>';
    case 'active':
      return hat
        ? ''
        : '<path d="M54 66Q100 50 146 66" stroke="#c64b3a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M146 66L160 76M146 66L158 84" stroke="#c64b3a" stroke-width="5" stroke-linecap="round"/>';
    case 'cozy':
      return hat
        ? ''
        : '<path d="M58 64Q70 26 104 30Q140 34 150 74Q160 98 172 100" stroke="none" fill="#5b6aa8"/><path d="M58 64Q70 26 104 30Q140 34 150 74Q158 96 170 98L166 104Q150 100 142 72Z" fill="#5b6aa8"/><circle cx="170" cy="102" r="7" fill="#fff4c8"/><rect x="54" y="60" width="96" height="10" rx="5" fill="#fff4c8"/><path d="M98 42l2 4l4 1l-3 3l1 4l-4 -2l-4 2l1 -4l-3 -3l4 -1z" fill="#ffd27a"/>';
    default:
      return '';
  }
}
function egg(o) {
  const gold = o.kind === 'gold';
  const w = Math.max(0, Math.min(1, (o.warmth || 0) / (o.need || 100)));
  const base = gold ? '#f6d77a' : '#e8ecf6',
    sh = gold ? '#c99a2e' : '#a9b3c9',
    glow = gold ? '#fff0b0' : '#9ff0ff';
  let g = '<ellipse cx="100" cy="186" rx="40" ry="7" fill="#000" opacity=".15"/>';
  g +=
    '<g class="' +
    (o.wobble ? 'wobble' : 'eggbob') +
    '"><circle cx="100" cy="112" r="' +
    (56 + w * 14) +
    '" fill="' +
    glow +
    '" opacity="' +
    (0.12 + w * 0.25) +
    '"/>';
  g +=
    '<path d="M100 36C138 36 156 96 156 128C156 162 132 184 100 184C68 184 44 162 44 128C44 96 62 36 100 36Z" fill="' +
    base +
    '" stroke="' +
    sh +
    '" stroke-width="4"/>';
  g +=
    '<path d="M60 120H84L92 108H110L118 124H140M70 148H96L104 140H130" stroke="' +
    glow +
    '" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="' +
    (0.5 + w * 0.5) +
    '"/><circle cx="92" cy="108" r="3.4" fill="' +
    glow +
    '"/><circle cx="118" cy="124" r="3.4" fill="' +
    glow +
    '"/><circle cx="104" cy="140" r="3.4" fill="' +
    glow +
    '"/>';
  g +=
    '<path d="M76 64Q86 52 98 50" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none"/>';
  if (gold)
    g += '<path d="M100 76l4 9l10 1l-8 6l3 10l-9 -6l-9 6l3 -10l-8 -6l10 -1z" fill="#fff4c8"/>';
  if (o.crack)
    g +=
      '<path d="M50 112L70 100L82 116L98 98L112 118L128 100L150 114" stroke="#5a4a3a" stroke-width="3" fill="none" stroke-linejoin="round"/>';
  g += '</g>';
  return (
    '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="petsvg eggsvg" role="img" aria-label="賽博蛋">' +
    g +
    '</svg>'
  );
}
function svg(o, cls = '') {
  return (
    '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="petsvg ' +
    cls +
    '" role="img" aria-label="' +
    (o.name || '寵物') +
    '"><g class="bob">' +
    body(o) +
    '</g></svg>'
  );
}
const NPC = [
  {
    id: 'zima',
    name: '芝麻',
    kind: '黑貓',
    sp: 'cat',
    color: 'night',
    acc: 'bell',
    bio: '怕醜，但一熟就會黐住你。鍾意曬太陽。',
    likes: '魚仔餅',
  },
  {
    id: 'dodo',
    name: '豆豆',
    kind: '柯基',
    sp: 'dog',
    color: 'milktea',
    acc: 'scarf',
    bio: '超級熱情，見到邊個都搖尾。',
    likes: '雞肉乾',
  },
  {
    id: 'bobo',
    name: '波波',
    kind: '雲朵獸',
    sp: 'cloud',
    color: 'snow',
    acc: 'flower',
    bio: '講嘢好慢，但每句都好暖。',
    likes: '星星糖',
  },
  {
    id: 'afei',
    name: '阿肥',
    kind: '橘貓',
    sp: 'cat',
    color: 'sakura',
    acc: '',
    bio: '食神，識得分辨邊間餐廳出餐慢。',
    likes: '雞肉乾',
  },
  {
    id: 'xiaoyun',
    name: '小芸',
    kind: '機械柴',
    sp: 'dog',
    color: 'mint',
    acc: 'bow',
    bio: '晨跑隊隊長，每朝喺湖邊跑步。',
    likes: '能量餅',
  },
];
export { PAL, SPECIES, STAGES, NPC, body, svg, egg };
