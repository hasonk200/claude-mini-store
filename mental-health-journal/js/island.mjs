import { $, $$, esc } from './shared/dom.mjs';
import { state, persist } from './state.mjs';
import { defaultDay, md } from './shared/dates.mjs';
import { drawCounts } from './cards/model.mjs';
import { companionArt } from './pet/presentation.mjs';
import { card } from './data/cards.mjs';
import { cardFace } from './cards/markup.mjs';
import { MILES } from './milestones.mjs';
import { toast } from './shared/controls.mjs';
import { prefersReducedMotion, applyTheme } from './shared/preferences.mjs';
import { go } from './navigation.mjs';

const JC = window.JournalCore;

const DESTINATIONS = {
  home: {
    name: '暖暖屋',
    icon: '⌂',
    text: '探吓你嘅伙伴、佈置屋企，或者一齊去散步。',
    button: '入屋坐吓',
    page: 'pet',
    x: 28,
    y: 40,
  },
  library: {
    name: '觀星書屋',
    icon: '✦',
    text: '留低今晚嘅故事，遇見一張屬於今日嘅牌。',
    button: '推門入去',
    page: 'draw',
    x: 72,
    y: 42,
  },
  garden: {
    name: '成長花園',
    icon: '❀',
    text: '每一日嘅記錄都會留低，花園跟住你慢慢長大。',
    button: '去花園',
    page: null,
    x: 28,
    y: 70,
  },
  lake: {
    name: '靜靜湖畔',
    icon: '≈',
    text: '望吓湖水，陪自己停一停。乜都唔做都可以。',
    button: '去坐一陣',
    page: 'haven',
    x: 75,
    y: 74,
  },
  plaza: {
    name: '小遊戲廣場',
    icon: '◇',
    text: '帶伙伴去星光尋路、推箱解謎，或者慢慢玩配對。',
    button: '去玩遊戲',
    page: 'arcade',
    x: 50,
    y: 59,
  },
};

let destination = 'home';

let worldTime = 'auto';

function worldHour() {
  return worldTime === 'night' ? 22 : worldTime === 'day' ? 13 : new Date().getHours();
}

function renderWorldTime() {
  const hour = worldHour();
  const night = hour >= 19 || hour < 6;
  $('#island-world').dataset.time = night ? 'night' : 'day';
  $('#island-world .world-art').src = 'assets/island-' + (night ? 'night' : 'day') + '.webp';
  $$('[data-world-time]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.worldTime === worldTime)),
  );
  $('#island-season').textContent =
    (hour >= 19 || hour < 6 ? '月光小島' : '日光小島') + ' · 隨時歡迎你';
}

function chooseDestination(k) {
  if (!DESTINATIONS[k]) return;
  destination = k;
  const d = DESTINATIONS[k];
  $$('[data-destination]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.destination === k)),
  );
  $('#world-companion').style.left = d.x + '%';
  $('#world-companion').style.top = d.y + '%';
  $('#island-destination').innerHTML =
    '<div class="destination-icon" aria-hidden="true">' +
    d.icon +
    '</div><div><h2>' +
    d.name +
    '</h2><p>' +
    d.text +
    '</p></div><button class="btn" id="destination-enter">' +
    d.button +
    ' →</button>';
}

function gardenSVG(level, decor, watered) {
  const flowers = (count) =>
    Array.from({ length: count }, (_, i) => {
      const x = 58 + ((i * 47) % 380),
        y = 167 + ((i * 23) % 62),
        c = ['#dd9b96', '#dab858', '#9eafce', '#9bb679'][i % 4];
      return (
        '<g transform="translate(' +
        x +
        ' ' +
        y +
        ')"><path d="M0 7Q-5 -8 0 -24" stroke="#52795a" stroke-width="2" fill="none"/><ellipse cx="-5" cy="-5" rx="7" ry="3" fill="#759563" transform="rotate(30)"/><g fill="' +
        c +
        '"><circle cy="-26" r="7"/><circle cx="-6" cy="-19" r="7"/><circle cx="6" cy="-19" r="7"/></g><circle cy="-20" r="4" fill="#fff0b0"/></g>'
      );
    }).join('');
  const tree = (x, y, r) =>
    '<g><path d="M' +
    x +
    ' ' +
    y +
    'v-50" stroke="#977959" stroke-width="9" stroke-linecap="round"/><circle cx="' +
    x +
    '" cy="' +
    (y - 67) +
    '" r="' +
    r +
    '" fill="#70926a"/><circle cx="' +
    (x - 18) +
    '" cy="' +
    (y - 51) +
    '" r="' +
    r * 0.7 +
    '" fill="#819f74"/><circle cx="' +
    (x + 17) +
    '" cy="' +
    (y - 53) +
    '" r="' +
    r * 0.7 +
    '" fill="#567d61"/></g>';
  return (
    '<svg viewBox="0 0 500 280" role="img" aria-label="' +
    ['剛播種的小花園', '小徑旁開始長出葉子', '花朵逐漸盛開', '溫室亮起暖燈', '繁花盛開的小島花園'][
      level
    ] +
    '"><defs><linearGradient id="garden-sky" x2="0" y2="1"><stop stop-color="#d7e6db"/><stop offset="1" stop-color="#fcf3d6"/></linearGradient></defs><rect width="500" height="280" fill="url(#garden-sky)"/><circle cx="415" cy="53" r="25" fill="#fff4c6"/><path d="M0 145Q110 83 235 143T500 125V280H0" fill="#c2d2a8"/><path d="M0 185Q130 124 260 184T500 166V280H0" fill="#a8bf90"/><ellipse cx="255" cy="240" rx="204" ry="31" fill="#97b083"/><path d="M265 280Q210 240 270 210T265 139" stroke="#e9ddbd" stroke-width="27" fill="none"/>' +
    tree(75, 173, 30) +
    (level >= 1 ? tree(430, 174, 35) : '') +
    '<g fill="#b58860" stroke="#9f7857" stroke-width="2"><path d="M134 204l65 -17 39 17 -65 20z"/><path d="M134 204v14l39 20v-14M173 238l65 -20v-14"/></g><g fill="#6c8350">' +
    [0, 1, 2]
      .map(
        (i) =>
          '<path d="M' +
          (166 + i * 19) +
          ' ' +
          (205 - i * 3) +
          'q-13 -22 -20 -12q10 13 20 12q1 -21 12 -17q4 14 -12 17"/>',
      )
      .join('') +
    '</g>' +
    (level >= 2
      ? '<g fill="#e9ead8" stroke="#729787" stroke-width="3"><path d="M315 170V105l44 -31 44 31v65z"/><path d="M315 105h88M359 74v96M337 90v80M381 90v80" fill="none"/><path d="M349 170v-39h20v39" fill="#f5d99d"/></g>'
      : '') +
    flowers(level * 5 + (decor === 'flowers' ? 7 : 1)) +
    (decor === 'lantern'
      ? '<path d="M302 208v-55q0 -12 13 -12" stroke="#7d7959" stroke-width="3" fill="none"/><rect x="308" y="139" width="14" height="22" rx="4" fill="#ffe4a2" stroke="#b1995d"/><circle cx="315" cy="150" r="24" fill="#ffe9ad" opacity=".22"/>'
      : '') +
    (decor === 'stars'
      ? '<g fill="#fff6be"><path d="M100 39l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM215 69l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM355 35l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>'
      : '') +
    (watered
      ? '<g fill="#649fa2" opacity=".8"><path d="M150 164q-9 13 0 13t0 -13M180 155q-9 13 0 13t0 -13M210 163q-9 13 0 13t0 -13"/></g>'
      : '') +
    '</svg>'
  );
}

function renderGarden() {
  const p = JC.progress(state),
    j = state.journey,
    k = defaultDay(),
    watered = !!j.watered[k];
  $('#garden-stage').textContent = p.name;
  $('#garden-title').textContent = p.days + ' 日照顧自己嘅足跡';
  $('#garden-description').textContent = '每記錄一日心情、日記、習慣或小成就，花園就會長大一點。';
  $('#garden-progress-text').textContent = p.next
    ? '再記錄 ' + p.remaining + ' 日，就會到「' + p.next + '」。'
    : '花園已經盛開，之後嘅每一日仍會繼續記低。';
  $('#garden-progress').value = p.percent;
  $('#garden-progress').setAttribute('aria-label', '下一個花園階段進度');
  $('#garden-art').innerHTML = gardenSVG(p.level, j.decor, watered);
  $('#garden-water').disabled = watered;
  $('#garden-water').textContent = watered ? '今日淋過喇 ✓' : '淋一淋花';
  $('#garden-water-note').textContent = watered
    ? '今日淋過水喇。'
    : '淋一淋花，留低今日到訪嘅足跡。';
  $$('[data-decor]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.decor === j.decor)),
  );
}

function renderIsland() {
  const p = JC.progress(state),
    k = defaultDay(),
    cnt = drawCounts(),
    owned = Object.keys(cnt).length;
  $('#quiet-toggle').setAttribute('aria-pressed', String(!!state.settings.quiet));
  $('#quiet-toggle').textContent = state.settings.quiet ? '減少動態：開' : '減少動態';
  $('#world-companion').innerHTML = companionArt();
  renderWorldTime();
  chooseDestination(destination);
  $('#island-pet-link').textContent = state.pet ? '探吓' + state.pet.name : '領養小伙伴';
  $('#island-passport').innerHTML =
    '<span class="section-kicker">ISLAND PASSPORT</span><div class="passport-top"><div class="passport-avatar">' +
    companionArt() +
    '</div><div><h2>' +
    esc(state.pet ? state.pet.name + '陪住你' : '你嘅小小世界') +
    '</h2><p>' +
    p.name +
    '</p></div></div><div class="passport-stats"><div><b>' +
    p.days +
    '</b><span>記錄日子</span></div><div><b>' +
    owned +
    '</b><span>遇見牌卡</span></div><div><b>' +
    (state.pet ? state.pet.coins : 0) +
    '</b><span>寵物金幣</span></div></div>';
  $('#island-date').textContent = md(k) + ' · 夜班跟開工日';
  $('#island-tasks').innerHTML = JC.tasks(state, k)
    .map(
      (t) =>
        '<button class="quest ' +
        (t.done ? 'done' : '') +
        '" data-goto="' +
        t.page +
        '"><span class="quest-check" aria-hidden="true">' +
        (t.done ? '✓' : '○') +
        '</span><span><b>' +
        t.name +
        (t.done ? ' · 已留低' : '') +
        '</b><small>' +
        t.detail +
        '</small></span><span class="quest-arrow">↗</span></button>',
    )
    .join('');
  const recent = Object.values(state.draws || {}).sort((a, b) => b.date.localeCompare(a.date))[0];
  $('#island-souvenir').innerHTML =
    recent && card(recent.card)
      ? '<span class="section-kicker">A MEMORY TO KEEP</span><div class="souvenir-preview">' +
        cardFace(card(recent.card), false, 1) +
        '</div><h2>最近遇見：' +
        esc(card(recent.card).name) +
        '</h2><p>每一張牌，都收住一晚嘅故事。</p><button class="linkbtn" data-goto="draw">返書屋睇返 →</button>'
      : '<span class="section-kicker">A MEMORY TO KEEP</span><h2>第一個故事，等緊你。</h2><p>寫低一句今晚想講嘅說話，書屋就會多一張牌。</p><button class="linkbtn" data-goto="draw">去書屋 →</button>';
  renderGarden();
  renderPostcards();
  const earned = MILES.filter((m) => state.miles[m.id]);
  $('#achievement-count').textContent = earned.length + ' / ' + MILES.length;
  $('#island-achievements').innerHTML = MILES.map(
    (m, i) =>
      '<div class="achievement ' +
      (state.miles[m.id] ? 'earned' : '') +
      '"><span class="achievement-medal" aria-hidden="true">' +
      (state.miles[m.id] ? '✹' : '◇') +
      '</span><div><b>' +
      esc(m.t) +
      '</b><small>' +
      (state.miles[m.id] ? '已留低 · ' + md(state.miles[m.id]) : '慢慢嚟，隨時開始') +
      '</small></div></div>',
  ).join('');
}

const POSTCARDS = {
  home: ['有燈嘅地方', '返到屋企，先放低今日。'],
  library: ['替故事留個位', '每一晚，都有一頁值得留低。'],
  garden: ['慢慢長大', '泥土記得落過嘅雨，花園記得你行過嘅路。'],
  lake: ['湖邊一分鐘', '坐低一陣，湖水會繼續慢慢流。'],
  plaza: ['一點遊戲時間', '玩得開心，已經係一個好理由。'],
};

function discoverPlace(id) {
  if (state.journey.discovered[id]) return;
  state.journey.discovered[id] = defaultDay();
  if (state.pet) state.pet.coins += 3;
  persist();
  renderPostcards();
  toast('發現「' + POSTCARDS[id][0] + '」明信片' + (state.pet ? ' · 金幣 +3' : ''));
}

function renderPostcards() {
  const d = state.journey.discovered;
  $('#postcard-count').textContent = Object.keys(POSTCARDS).filter((k) => d[k]).length + ' / 5';
  $('#island-postcards').innerHTML = Object.entries(POSTCARDS)
    .map(
      ([k, v]) =>
        '<button class="postcard ' +
        (d[k] ? 'collected' : '') +
        '" data-postcard="' +
        k +
        '" aria-label="' +
        (d[k] ? v[0] : '未發現：' + DESTINATIONS[k].name) +
        '"><span class="postcard-art postcard-' +
        k +
        '">' +
        (!d[k] ? '<i>◇</i>' : '') +
        '</span><b>' +
        (d[k] ? v[0] : DESTINATIONS[k].name) +
        '</b><small>' +
        (d[k] ? '已收藏 · ' + md(d[k]) : '去探一探就會遇見') +
        '</small></button>',
    )
    .join('');
}

function initializeIsland() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-postcard]');
    if (!b) return;
    const k = b.dataset.postcard;
    if (!state.journey.discovered[k]) {
      chooseDestination(k);
      $('#island-world').scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
      return;
    }
    $('#postcard-title').textContent = POSTCARDS[k][0];
    $('#postcard-message').textContent = POSTCARDS[k][1];
    $('#postcard-picture').className = 'postcard-picture postcard-' + k;
    $('#postcard-dialog').showModal();
  });
  $('#postcard-close').addEventListener('click', () => $('#postcard-dialog').close());
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-destination]');
    if (d) chooseDestination(d.dataset.destination);
    const t = e.target.closest('[data-world-time]');
    if (t) {
      worldTime = t.dataset.worldTime;
      renderWorldTime();
    }
    if (e.target.closest('#destination-enter')) {
      const x = DESTINATIONS[destination];
      discoverPlace(destination);
      if (x.page) go(x.page);
      else
        $('#garden-section').scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'center',
        });
    }
    if (e.target.closest('#quiet-toggle')) {
      state.settings.quiet = !state.settings.quiet;
      applyTheme();
      persist();
      renderIsland();
    }
    const decor = e.target.closest('[data-decor]');
    if (decor) {
      state.journey.decor = decor.dataset.decor;
      persist();
      renderGarden();
    }
    if (e.target.closest('#garden-water')) {
      const k = defaultDay();
      if (state.journey.watered[k]) return;
      state.journey.watered[k] = true;
      persist();
      renderGarden();
      toast('花園收到你嘅心意 🌱');
    }
  });
}

export { JC, renderIsland, initializeIsland };
