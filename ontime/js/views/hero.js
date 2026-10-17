// 首頁頂部的動畫場景：天色跟著現在時間，小人跟著目前狀態移動。點一下場景，小人會跳一下。
import { esc } from '../ui.js';

function skyOf(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19.5) return 'dusk';
  return 'night';
}

const SKY = {
  dawn: ['#F6B9A0', '#FBE3CF'],
  day: ['#9FD3EC', '#E3F3F7'],
  dusk: ['#E58C7A', '#F8CDA8'],
  night: ['#121736', '#2B3366']
};

// 太陽 6–18 點、月亮 18–6 點，沿弧線移動。
function celestial(hour, W, H, compact) {
  const isSun = hour >= 6 && hour < 18;
  const frac = isSun ? (hour - 6) / 12 : ((hour - 18 + 24) % 24) / 12;
  const x = compact ? W * 0.8 + (frac - 0.5) * W * 0.3 : (W * 0.52) + (frac - 0.5) * (W * 0.8);
  const y = compact ? H - 200 - Math.sin(Math.PI * frac) * 70 : H - 90 - Math.sin(Math.PI * frac) * (H - 150);
  if (isSun) {
    return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle r="44" class="sun-glow"/><circle r="34" class="sun-ray"/><circle r="24" class="sun-core"/></g>`;
  }
  return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle r="40" class="moon-glow"/><g mask="url(#hero-moon)"><circle r="20" class="moon-core"/><circle r="2.6" cx="-9" cy="5" class="moon-crater"/><circle r="1.8" cx="-6" cy="-8" class="moon-crater"/></g></g>`;
}

// 由座標算出固定的城市剪影，每次畫面都一樣。
function cityBlocks(W, seed = 3) {
  const out = [];
  let x = -10;
  let i = 0;
  while (x < W + 20) {
    const w = 34 + ((i * 37 + seed * 11) % 46);
    const top = 104 + ((i * 53 + seed * 7) % 62);
    out.push([x, top, w, i]);
    x += w + 4 + ((i * 17) % 10);
    i++;
  }
  return out;
}

function cityLayer(W, seed) {
  return cityBlocks(W, seed).map(([x, top, w, i]) => {
    const wins = [];
    for (let yy = top + 12; yy < 184; yy += 16) {
      for (let xx = x + 7; xx < x + w - 9; xx += 12) {
        if ((xx * 7 + yy * 3 + i) % 4 !== 0) wins.push(`<rect x="${xx}" y="${yy}" width="5" height="7" rx="1" class="win${(xx + yy + i) % 5 === 0 ? ' win-flicker' : ''}"/>`);
      }
    }
    const ant = i % 4 === 1 ? `<rect x="${x + w / 2 - 1}" y="${top - 16}" width="2" height="16" class="bldg"/><circle cx="${x + w / 2}" cy="${top - 17}" r="2.4" class="beacon"/>` : '';
    return `<rect x="${x}" y="${top}" width="${w}" height="${196 - top}" rx="2" class="bldg"/>${ant}${wins.join('')}`;
  }).join('');
}

function tree(x, i, hidden) {
  return `<g class="tree${hidden ? ' is-hidden' : ''}" transform="translate(${x} 192)"><rect x="-3" y="-26" width="6" height="26" rx="2" class="trunk"/><g class="canopy" style="animation-delay:${(-i * 0.7).toFixed(1)}s"><circle cx="0" cy="-36" r="16" class="leaf"/><circle cx="-10" cy="-28" r="11" class="leaf-2"/><circle cx="10" cy="-27" r="11" class="leaf-2"/></g></g>`;
}

function lamp(x, hidden) {
  return `<g class="lamp${hidden ? ' is-hidden' : ''}" transform="translate(${x} 192)"><path d="M-46 0 L-14 -60 H14 L46 0 Z" class="lamp-cone"/><rect x="-2" y="-66" width="4" height="66" class="lamp-pole"/><rect x="-10" y="-70" width="20" height="7" rx="3.5" class="lamp-head"/><circle cy="-62" r="3.5" class="lamp-bulb"/></g>`;
}

function streetLayer(W, from = 0, skip = null) {
  const parts = [];
  let i = 0;
  for (let x = from; x < W + 40; x += 150) {
    const hidden = skip ? x > skip[0] && x < skip[1] : false;
    parts.push(i % 2 ? lamp(x, hidden) : tree(x, i, hidden));
    i++;
  }
  return parts.join('');
}

// 小人：原點在腳底中間。
function person({ facing = 1, mood = '' } = {}) {
  return `<g class="pp ${mood}" transform="scale(${facing} 1)">
    <ellipse cx="0" cy="1" rx="13" ry="3" class="shadow"/>
    <g class="pp-bob">
      <g class="arm arm-back"><rect x="-3" y="-45" width="6" height="21" rx="3" class="sleeve-back"/></g>
      <g class="leg leg-back"><rect x="-4" y="-24" width="8" height="23" rx="3.5" class="pants"/><rect x="-4" y="-3" width="12" height="5" rx="2.5" class="shoe"/></g>
      <g class="leg leg-front"><rect x="-4" y="-24" width="8" height="23" rx="3.5" class="pants"/><rect x="-4" y="-3" width="12" height="5" rx="2.5" class="shoe"/></g>
      <rect x="-19" y="-47" width="11" height="21" rx="4" class="pack"/>
      <rect x="-11" y="-49" width="22" height="29" rx="9" class="shirt"/>
      <g class="arm arm-front"><rect x="-3" y="-45" width="6" height="21" rx="3" class="sleeve"/><circle cx="0" cy="-23" r="3.4" class="skin"/></g>
      <circle cx="1" cy="-59" r="9.5" class="skin"/>
      <path d="M-9 -61 a10 9 0 0 1 20 0 h6 a1.5 1.5 0 0 1 0 3 h-26 z" class="cap"/>
      <circle cx="6" cy="-58" r="1.3" class="eye"/>
      <path d="M4 -53.5 q2.5 1.6 5 0" class="smile"/>
    </g>
  </g>`;
}

// 走路：從 from 走到 to，循環播放。
function walker(from, to, { dur = 9 } = {}) {
  const facing = to >= from ? 1 : -1;
  return `<g class="walker" style="--from:${from}px;--to:${to}px;animation-duration:${dur}s"><g transform="translate(0 196)">${person({ facing, mood: 'is-walking' })}</g></g>`;
}

function standing(x, mood, facing = 1) {
  return `<g transform="translate(${x} 196)">${person({ facing, mood })}</g>`;
}

function car(cls, color, y, dir) {
  return `<g class="car ${cls}" style="--y:${y}px"><g transform="scale(${dir} 1)">
    <path d="M-34 -10 h68 a6 6 0 0 1 6 6 v6 a3 3 0 0 1 -3 3 h-74 a3 3 0 0 1 -3 -3 v-6 a6 6 0 0 1 6 -6 z" fill="${color}"/>
    <path d="M-20 -10 l7 -11 h24 l9 11 z" fill="${color}"/>
    <path d="M-15 -11 l5 -8 h9 v8 z M2 -11 v-8 h8 l6 8 z" class="car-win"/>
    <rect x="34" y="-6" width="5" height="4" rx="2" class="car-light"/>
    <circle cx="-20" cy="5" r="6" class="tyre"/><circle cx="20" cy="5" r="6" class="tyre"/>
  </g></g>`;
}

function bus(facing, cx) {
  return `<g class="bus" transform="translate(${cx} 0) scale(${facing} 1) translate(-96 0)">
    <g class="exhaust"><circle cx="-6" cy="182" r="5"/><circle cx="-6" cy="182" r="5" style="animation-delay:.5s"/><circle cx="-6" cy="182" r="5" style="animation-delay:1s"/></g>
    <g class="bus-body">
      <path d="M192 152 l70 -12 v30 z" class="bus-beam"/>
      <rect x="0" y="122" width="192" height="66" rx="16" class="bus-shell"/>
      <rect x="10" y="116" width="150" height="10" rx="5" class="bus-roof"/>
      <rect x="0" y="166" width="192" height="8" class="bus-stripe"/>
      <rect x="14" y="134" width="30" height="24" rx="6" class="bus-win"/><rect x="52" y="134" width="30" height="24" rx="6" class="bus-win"/>
      <rect x="90" y="134" width="30" height="24" rx="6" class="bus-win"/>
      <rect x="128" y="134" width="22" height="40" rx="5" class="bus-door"/>
      <path d="M158 134 h20 a8 8 0 0 1 8 8 v16 h-28 z" class="bus-win"/>
      <circle cx="104" cy="146" r="7" class="skin"/><path d="M97 145 a7 7 0 0 1 14 0 h3 v2 h-17 z" class="cap"/><rect x="96" y="152" width="16" height="6" rx="3" class="shirt"/>
      <rect x="184" y="150" width="8" height="10" rx="3" class="bus-light"/>
    </g>
    <g transform="translate(42 188)"><circle r="14" class="tyre"/><g class="spin"><circle r="6" class="hub"/><path d="M-6 0H6M0 -6V6" class="spoke"/></g></g>
    <g transform="translate(152 188)"><circle r="14" class="tyre"/><g class="spin"><circle r="6" class="hub"/><path d="M-6 0H6M0 -6V6" class="spoke"/></g></g>
  </g>`;
}

const STARS = [[60, 30], [140, 70], [210, 22], [300, 52], [380, 16], [460, 78], [540, 36], [620, 62], [700, 20], [780, 48], [860, 26], [940, 66], [1020, 30], [1100, 58], [1170, 18], [250, 96], [500, 104], [820, 98]];

export function heroHTML({ state, now, headline, line, eyebrow, compact = false }) {
  const W = compact ? 640 : 1200;
  const H = compact ? 300 : 300;
  const dy = H - 240;
  const hx = compact ? -100 : 0;
  const wx = compact ? W - 1200 + 50 : 0;
  const stopX = compact ? 262 : 470;
  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;
  const sky = skyOf(hour);
  const night = sky === 'night';
  const riding = state === 'ride' || state === 'ride2';
  const working = state === 'work' || state === 'break';
  const atWork = working || state === 'arrive';
  const homeX = 195 + hx;
  const workDoor = 1042 + wx;

  let actor = '';
  if (state === 'out') actor = walker(homeX + 40, stopX - 18, { dur: compact ? 7 : 9 });
  else if (state === 'arrive') actor = walker(stopX + 30, workDoor - 70, { dur: compact ? 8 : 11 });
  else if (state === 'off') actor = walker(workDoor - 60, stopX + 24, { dur: compact ? 8 : 11 });
  else if (state === 'work') actor = standing(workDoor - 62, 'is-working');
  else if (state === 'break') actor = `${standing(workDoor - 62, 'is-break')}<g class="steam" transform="translate(${workDoor - 46} ${196 - 40})"><path d="M-3 0 q3 -6 0 -12 M3 0 q3 -6 0 -12" class="steam-line"/></g>`;
  else if (state === 'free' && !night) actor = standing(homeX + 70, 'is-idle');

  const boxes = state === 'work' ? `<g class="belt-boxes">${[0, 1, 2].map((i) => `<rect x="${1012 + wx}" y="171" width="14" height="12" rx="2" class="box" style="animation-delay:${(-i * 1.4).toFixed(1)}s"/>`).join('')}</g>` : '';
  const zz = state === 'sleep' ? `<g class="zz" transform="translate(${hx} 0)"><text x="196" y="96">Z</text><text x="214" y="78" class="zz-2">z</text><text x="230" y="62" class="zz-3">z</text></g>` : '';
  const homeLit = night && state !== 'sleep';
  const silhouette = night && state === 'free' ? `<circle cx="${160 + hx}" cy="148" r="5" class="win-person"/><rect x="${154 + hx}" y="153" width="12" height="12" rx="4" class="win-person"/>` : '';
  const cat = night || sky === 'dusk' ? `<g class="cat" transform="translate(${146 + hx} 98)"><path d="M0 0 q-2 -10 4 -12 l2 -5 2 5 h4 l2 -5 2 5 q6 2 4 12 z" class="cat-body"/><path d="M18 -2 q10 -2 8 -14" class="cat-tail"/></g>` : '';
  const birds = !night ? `<g class="birds">${[0, 1, 2].map((i) => `<g class="bird-path" style="--by:${30 + (i % 2) * 14}px;animation-delay:${(-i * 0.9).toFixed(1)}s"><path d="M0 0 q5 -5 10 0 q5 -5 10 0" class="bird" style="animation-delay:${(i * 0.13).toFixed(2)}s"/></g>`).join('')}</g>` : '';
  const shooting = night ? '<line x1="0" y1="0" x2="70" y2="0" class="shooting"/>' : '';

  const skip = [930 + wx - 40, 1130 + wx];
  const travelling = riding ? `
      <g class="pan pan-far${state === 'ride2' ? ' is-back' : ''}" style="--w:${W}px"><g>${cityLayer(W, 3)}</g><g transform="translate(${W} 0)">${cityLayer(W, 3)}</g></g>
      <g class="pan pan-near${state === 'ride2' ? ' is-back' : ''}" style="--w:${W}px"><g>${streetLayer(W, 40)}</g><g transform="translate(${W} 0)">${streetLayer(W, 40)}</g></g>` : `
      <g class="city">${cityLayer(W, 3)}</g>
      <g class="street">${streetLayer(W, compact ? 340 : 590, skip)}</g>`;

  const buildings = riding ? '' : `
      <g class="home" transform="translate(${hx} 0)">
        <rect x="120" y="112" width="150" height="84" rx="6" class="house"/>
        <path d="M106 118 L195 62 L284 118 Z" class="roof"/>
        <rect x="236" y="72" width="14" height="24" class="chimney"/>
        <rect x="140" y="136" width="40" height="32" rx="4" class="house-win${homeLit ? ' is-lit' : ''}${state === 'sleep' ? ' is-dim' : ''}"/>
        <path d="M160 136 V168 M140 152 H180" class="win-frame"/>
        <rect x="210" y="138" width="34" height="58" rx="4" class="door"/>
        <circle cx="236" cy="168" r="2.4" class="knob"/>
        <text x="195" y="106" class="sign-text" text-anchor="middle">HOME</text>
        <rect x="124" y="184" width="34" height="12" rx="6" class="bush"/>
      </g>
      ${silhouette}${cat}${zz}
      <g class="stop" transform="translate(${stopX - 452} 0)"><rect x="452" y="128" width="4" height="68" class="pole"/><rect x="434" y="116" width="40" height="22" rx="7" class="stop-sign"/><text x="454" y="131" class="stop-text" text-anchor="middle">BUS</text><rect x="462" y="170" width="30" height="5" rx="2" class="bench"/><rect x="465" y="175" width="3" height="16" class="bench"/><rect x="486" y="175" width="3" height="16" class="bench"/></g>
      <g class="work" transform="translate(${wx} 0)">
        <path d="M930 196 V108 L962 92 V108 L994 92 V108 L1026 92 V108 L1058 92 V108 L1090 92 V108 L1122 92 V196 Z" class="factory"/>
        <rect x="1006" y="138" width="72" height="58" rx="4" class="door-frame"/>
        ${state === 'work'
          ? '<rect x="1010" y="142" width="64" height="20" rx="3" class="roller"/><rect x="1010" y="162" width="64" height="34" class="door-open"/><rect x="1006" y="183" width="100" height="5" rx="2" class="belt"/>'
          : '<rect x="1010" y="142" width="64" height="54" rx="3" class="roller"/><path d="M1010 152 H1074 M1010 162 H1074 M1010 172 H1074 M1010 182 H1074" class="roller-line"/>'}
        <rect x="946" y="122" width="22" height="16" rx="3" class="factory-win${atWork || night ? ' is-lit' : ''}"/><rect x="976" y="122" width="22" height="16" rx="3" class="factory-win${atWork ? ' is-lit' : ''}"/>
        <rect x="1088" y="122" width="22" height="16" rx="3" class="factory-win${atWork ? ' is-lit' : ''}"/>
        <rect x="986" y="100" width="76" height="20" rx="6" class="work-sign${working ? ' is-on' : ''}"/>
        <text x="1024" y="114" class="work-sign-text" text-anchor="middle">WORK</text>
      </g>
      ${boxes}`;

  const traffic = riding
    ? car('car-oncoming', '#FF5E7E', 208, -1)
    : `${car('car-a', '#FF8A3D', 228, 1)}${car('car-b', '#1FB8A8', 208, -1)}`;

  return `<section class="hero${compact ? ' is-compact' : ''}" data-sky="${sky}" data-state="${esc(state)}" style="--ar:${W}/${H};--sw:${W}px" aria-label="現在的場景">
    <svg class="hero-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="img" aria-label="${esc(headline)}">
      <defs><linearGradient id="hero-sky-${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[sky][0]}"/><stop offset="1" stop-color="${SKY[sky][1]}"/></linearGradient>
        <mask id="hero-moon" maskUnits="userSpaceOnUse" x="-30" y="-30" width="60" height="60"><circle r="21" fill="#fff"/><circle r="18" cx="10" cy="-7" fill="#000"/></mask></defs>
      <rect width="${W}" height="${H}" fill="url(#hero-sky-${sky})"/>
      ${night ? `<g class="stars">${STARS.filter(([x]) => x < W).map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.9 : 1.2}" style="animation-delay:${(i * 0.41).toFixed(2)}s"/>`).join('')}</g>` : ''}
      ${shooting}
      ${celestial(hour, W, H, compact)}
      ${birds}
      <g class="cloud cloud-a"><rect x="0" y="44" width="130" height="28" rx="14"/><rect x="28" y="28" width="66" height="30" rx="15"/></g>
      <g class="cloud cloud-b"><rect x="0" y="86" width="92" height="20" rx="10"/><rect x="22" y="74" width="46" height="22" rx="11"/></g>
      <g class="cloud cloud-c"><rect x="0" y="20" width="70" height="16" rx="8"/></g>
      <g transform="translate(0 ${dy})">
      ${travelling}
      ${buildings}
      <rect y="196" width="${W}" height="44" class="road"/>
      <rect y="191" width="${W}" height="6" class="curb"/>
      <line x1="0" y1="219" x2="${W}" y2="219" class="lane${riding ? (state === 'ride2' ? ' is-moving-back' : ' is-moving') : ''}"/>
      ${traffic}
      ${riding ? bus(state === 'ride2' ? -1 : 1, compact ? 320 : 600) : ''}
      ${actor}
      </g>
    </svg>
    <button type="button" class="hero-poke" data-action="hero-poke" aria-label="跟小人打招呼"></button>
    <div class="hero-text">
      <span class="hero-eyebrow">${esc(eyebrow)}</span>
      <strong class="hero-headline">${esc(headline)}</strong>
      ${line ? `<span class="hero-line">${esc(line)}</span>` : ''}
    </div>
  </section>`;
}
