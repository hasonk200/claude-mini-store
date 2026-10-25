import { W, THEMES, STORIES, PAIRS, DAILY } from './data/wisdom.mjs';
import { state, persist } from './state.mjs';
import { $, esc } from './shared/dom.mjs';
import { segGet } from './shared/controls.mjs';

const byId = (id) => W.find((x) => x.id === id);

const isFav = (id) => (state.favs || []).includes(id);

function toggleFav(id) {
  state.favs = state.favs || [];
  if (isFav(id)) state.favs = state.favs.filter((x) => x !== id);
  else state.favs.push(id);
  persist();
  renderWisdom();
  renderPlanFavs();
  updateDrawFav();
}

let drawn = null;

function showDraw(x) {
  drawn = x;
  $('#draw-orig').textContent = '「' + x.o + '」';
  $('#draw-src').textContent = x.s;
  $('#draw-plain').textContent = '白話：' + x.p;
  $('#draw-use').innerHTML =
    '<b style="color:var(--red);font-weight:500;margin-right:6px">對你</b>' + esc(x.u);
  updateDrawFav();
}

function updateDrawFav() {
  if (drawn) {
    $('#draw-fav').textContent = isFav(drawn.id) ? '已收藏' : '收藏';
  }
}

function wisItem(x) {
  return (
    '<div class="wis"><div class="orig">「' +
    esc(x.o) +
    '」</div><div class="src"><span>' +
    esc(x.s) +
    '</span><button class="star' +
    (isFav(x.id) ? ' on' : '') +
    '" data-fav="' +
    x.id +
    '">' +
    (isFav(x.id) ? '已收藏' : '收藏') +
    '</button></div><div class="plain">白話：' +
    esc(x.p) +
    '</div><div class="use"><b>對你</b>' +
    esc(x.u) +
    '</div></div>'
  );
}

function renderWisdom() {
  const segEl = document.querySelector('.seg[data-name="wth"]');
  if (!segEl.children.length) {
    segEl.innerHTML = THEMES.map(
      ([k, n], i) =>
        '<button data-v="' + k + '"' + (i === 0 ? ' class="on"' : '') + '>' + n + '</button>',
    ).join('');
  }
  const th = segGet('wth') || 'fail';
  $('#wis-list').innerHTML = W.filter((x) => x.th === th)
    .map(wisItem)
    .join('');
  $('#stories').innerHTML = STORIES.map(
    (s) =>
      '<div class="sheet story"><span class="era">' +
      esc(s.e) +
      '</span><h3>' +
      esc(s.n) +
      '</h3><p>' +
      esc(s.p) +
      '</p><div class="use"><b>對你</b>' +
      esc(s.u) +
      '</div></div>',
  ).join('');
  $('#pairs').innerHTML = PAIRS.map(
    ([a, b]) =>
      '<div class="pair"><div><span class="tag">現代心理學</span><b>' +
      esc(a) +
      '</b></div><div><span class="tag">古人</span><b>' +
      esc(b) +
      '</b></div></div>',
  ).join('');
  const favs = (state.favs || []).map(byId).filter(Boolean);
  $('#fav-list').innerHTML = favs.length
    ? favs
        .map(
          (x) =>
            '<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「' +
            esc(x.o) +
            '」</span><div class="meta">' +
            esc(x.s) +
            '</div></div><button class="x" data-fav="' +
            x.id +
            '" aria-label="取消收藏">×</button></li>',
        )
        .join('')
    : '<li class="muted">未收藏。上面揀一句啱心水嘅，撳「收藏」。</li>';
  if (!drawn) showDraw(W[Math.floor(Math.random() * W.length)]);
}

function renderPlanFavs() {
  let favs = (state.favs || []).map(byId).filter(Boolean);
  const starter = !favs.length;
  if (starter) favs = ['w63', 'w26', 'w41', 'w27'].map(byId);
  $('#plan-favs').innerHTML = favs
    .map(
      (x) =>
        '<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「' +
        esc(x.o) +
        '」</span><div class="meta">' +
        esc(x.s) +
        (starter ? '・起步句子' : '') +
        '</div><div style="font-size:14px;color:var(--ink-2);margin-top:4px">' +
        esc(x.u) +
        '</div></div></li>',
    )
    .join('');
}

let dailyIdx = 0;

function showDaily(i) {
  dailyIdx = (i + DAILY.length) % DAILY.length;
  const d = DAILY[dailyIdx];
  $('#daily-quote').textContent = d.o;
  $('#daily-src').textContent = d.s;
  $('#daily-toggle').hidden = !d.p;
  $('#daily-more').hidden = true;
  $('#daily-toggle').textContent = '點解？';
  $('#daily-more').innerHTML = d.p
    ? '<span>白話：' + esc(d.p) + '</span><span><b>對你</b>' + esc(d.u) + '</span>'
    : '';
}

function kq(id) {
  const x = byId(id);
  return x ? '<div class="kq">「' + esc(x.o) + '」<small>' + esc(x.s) + '</small></div>' : '';
}

function initializeWisdom() {
  $('#draw-btn').addEventListener('click', () => {
    let x;
    do {
      x = W[Math.floor(Math.random() * W.length)];
    } while (drawn && x.id === drawn.id && W.length > 1);
    showDraw(x);
  });
  $('#draw-fav').addEventListener('click', () => {
    if (drawn) toggleFav(drawn.id);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (b) {
      toggleFav(b.dataset.fav);
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-name="wth"] button');
    if (b) {
      setTimeout(renderWisdom, 0);
    }
  });
  $('#daily-toggle').addEventListener('click', () => {
    const m = $('#daily-more');
    m.hidden = !m.hidden;
    $('#daily-toggle').textContent = m.hidden ? '點解？' : '收埋';
  });
  $('#daily-next').addEventListener('click', () => showDaily(dailyIdx + 1));
}

export { byId, showDaily, renderWisdom, renderPlanFavs, initializeWisdom };
