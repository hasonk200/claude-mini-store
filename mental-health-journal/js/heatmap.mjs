import { state } from './state.mjs';
import { keyOf, parseKey, addDays, md } from './shared/dates.mjs';
import { $ } from './shared/dom.mjs';

function goodByDay() {
  const m = {};
  const add = (k, n) => {
    if (k) m[k] = (m[k] || 0) + n;
  };
  Object.keys(state.checkins).forEach((k) => add(k, 1));
  Object.keys(state.draws || {}).forEach((k) => add(k, 1));
  (state.habits || []).forEach((h) => Object.keys(h.log || {}).forEach((k) => add(k, 1)));
  (state.evidence || []).forEach((e) => {
    if (!e.seed) add(e.date, 1);
  });
  return m;
}

function heatSVG() {
  const m = goodByDay();
  const today = keyOf(new Date());
  const td = parseKey(today);
  const mon = (td.getDay() + 6) % 7;
  const start = addDays(today, -mon - 7 * 15);
  const C = 15,
    ballGame = 3,
    L = 22,
    T = 18;
  let s = '',
    active = 0,
    total = 0;
  const lv = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
  const op = [0, 0.28, 0.5, 0.72, 0.95];
  let lastM = -1;
  for (let w = 0; w < 16; w++) {
    const wd = addDays(start, w * 7);
    const mo = parseKey(wd).getMonth();
    if (mo !== lastM) {
      s +=
        '<text x="' +
        (L + w * (C + ballGame)) +
        '" y="11" font-size="10" fill="var(--ink-3)">' +
        (mo + 1) +
        '月</text>';
      lastM = mo;
    }
    for (let d = 0; d < 7; d++) {
      const k = addDays(start, w * 7 + d);
      if (k > today) continue;
      const n = m[k] || 0;
      if (n) {
        active++;
        total += n;
      }
      const x = L + w * (C + ballGame),
        y = T + d * (C + ballGame);
      s +=
        '<rect x="' +
        x +
        '" y="' +
        y +
        '" width="' +
        C +
        '" height="' +
        C +
        '" rx="3" ' +
        (n ? 'fill="var(--good)" fill-opacity="' + op[lv(n)] + '"' : 'fill="var(--kraft)"') +
        '><title>' +
        md(k) +
        (n ? '：' + n + ' 樣好嘢' : '') +
        '</title></rect>';
    }
  }
  ['一', '三', '五', '日'].forEach((t, i) => {
    const d = [0, 2, 4, 6][i];
    s +=
      '<text x="0" y="' +
      (T + d * (C + ballGame) + 11) +
      '" font-size="10" fill="var(--ink-3)">' +
      t +
      '</text>';
  });
  const W = L + 16 * (C + ballGame),
    H = T + 7 * (C + ballGame);
  return {
    svg:
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" class="heat" role="img" aria-label="最近 16 個星期做咗好嘢嘅日子">' +
      s +
      '</svg>',
    active,
    total,
  };
}

function renderHeat() {
  const box = $('#heat');
  if (!box) return;
  const r = heatSVG();
  box.innerHTML = r.svg;
  $('#heat-sum').innerHTML =
    '最近 16 個星期，有 <b>' + r.active + '</b> 日做咗好嘢，加埋一共 <b>' + r.total + '</b> 樣。';
}

export { renderHeat };
