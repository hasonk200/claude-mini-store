import { $, esc } from '../shared/dom.mjs';
import { PLACEINFO, NPCLINES, flv } from '../data/pet.mjs';
import { PET } from '../art/pet.mjs';
import { state, persist } from '../state.mjs';
import { tickNeeds, canFindEgg, traitBump, petO, need, addEgg } from './model.mjs';
import { toast, segSet } from '../shared/controls.mjs';
import { pick } from '../shared/helpers.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { petAward } from './rewards.mjs';
import { keyOf, defaultDay } from '../shared/dates.mjs';
import { bubble, setPetExpr, fx } from './effects.mjs';
import { showPetTab } from './page.mjs';
import { openPhoto } from './photos.mjs';

let trip = null;

let tripTimer = null;

function cancelTrip() {
  clearTimeout(tripTimer);
  tripTimer = null;
  trip = null;
}

function renderOutChoose() {
  const h = new Date().getHours();
  $('#out-choose').innerHTML =
    '<div class="places">' +
    Object.entries(PLACEINFO)
      .map(
        ([k, v]) =>
          '<button class="place" data-place="' +
          k +
          '"><div class="th">' +
          PET.PLACES[k].f({ hour: h }) +
          '</div><b>' +
          PET.PLACES[k].n +
          '</b><span>' +
          v.d +
          '</span></button>',
      )
      .join('') +
    '</div><p class="muted" style="margin-top:12px">出街會用少少精神，' +
    esc(state.pet.name) +
    '會好開心。有機會識到新朋友，或者拾到寶物。</p>';
  $('#out-choose').hidden = false;
  $('#out-trip').hidden = true;
}

function startTrip(place) {
  if (!state.pet || !PLACEINFO[place]) return;
  stopGame();
  cancelTrip();
  const p = state.pet;
  tickNeeds();
  if (p.needs.energy < 30) {
    toast(p.name + '有啲眼瞓，哄佢瞓陣先出街啦。');
    return;
  }
  const info = PLACEINFO[place];
  const meetP = place === 'cafe' ? 1 : 0.75;
  const npc = Math.random() < meetP ? pick(info.meet) : null;
  const found = Math.random() < 0.5 ? pick(info.find) : null;
  const egg = canFindEgg() && Math.random() < 0.3;
  trip = { place, npc, found, egg, met: false, game: null };
  traitBump('adv');
  $('#out-choose').hidden = true;
  $('#out-trip').hidden = false;
  $('#outstage').innerHTML =
    PET.PLACES[place].f({ hour: new Date().getHours() }) +
    '<button class="on-stage walking" style="left:-14%" aria-label="' +
    esc(p.name) +
    '">' +
    PET.svg(petO('happy')) +
    '</button>' +
    (npc
      ? '<div class="npc-on" style="right:-30%;opacity:0">' +
        PET.svg(
          Object.assign(
            { stage: 1 },
            PET.NPC.find((n) => n.id === npc),
          ),
        ) +
        '</div>'
      : '') +
    '<div class="bubble" id="obubble" hidden></div><div class="bubble npc" id="nbubble" hidden></div><div class="fx" id="ofx"></div><div class="ball" id="ball" hidden></div>';
  $('#out-panel').innerHTML = '<p>同' + esc(p.name) + '行緊去' + PET.PLACES[place].n + '……</p>';
  try {
    $('#outstage').scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    });
  } catch (e) {}
  const pe = $('#outstage .on-stage');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      pe.style.left = npc ? '30%' : '50%';
    }),
  );
  need('energy', -10);
  need('fun', 20);
  p.walks = (p.walks || 0) + 1;
  petAward('walk', 5, 3);
  persist();
  const current = trip;
  tripTimer = setTimeout(
    () => {
      if (trip !== current) return;
      pe.classList.remove('walking');
      arrive();
    },
    prefersReducedMotion() ? 50 : 3100,
  );
}

function arrive() {
  if (!trip || !state.pet) return;
  const current = trip;
  const p = state.pet;
  let msg = pick(['到喇！好舒服呀！', '呢度好靚！', '行吓行吓，心情好咗好多！']);
  if (trip.found) {
    p.treasure = p.treasure || {};
    p.treasure[trip.found] = (p.treasure[trip.found] || 0) + 1;
    persist();
    msg = '我拾到' + trip.found + '！送俾你！';
  }
  if (trip.egg) {
    addEgg('normal');
    p.eggDay = keyOf(new Date());
    persist();
    msg = '咦，草叢入面有隻發光嘅蛋！我哋帶佢返屋企孵！';
  }
  bubble('obubble', msg);
  if (trip.npc) {
    const n = $('#outstage .npc-on');
    setTimeout(
      () => {
        if (trip !== current || !n.isConnected) return;
        n.style.right = '10%';
        n.style.opacity = '1';
        setTimeout(
          () => {
            if (trip === current) bubble('nbubble', pick(NPCLINES[current.npc]));
          },
          prefersReducedMotion() ? 0 : 1700,
        );
      },
      prefersReducedMotion() ? 0 : 500,
    );
  }
  renderOutPanel();
}

function renderOutPanel() {
  stopGame();
  if (!trip || !state.pet) return;
  const p = state.pet;
  const nf = trip.npc ? PET.NPC.find((x) => x.id === trip.npc) : null;
  const fr = nf ? (p.friends || {})[nf.id] || { xp: 0, met: 0 } : null;
  let h = '';
  if (nf)
    h +=
      '<div class="npc-card">' +
      PET.svg(Object.assign({ stage: 1, expr: 'happy' }, nf), 'mini') +
      '<div><b>遇到' +
      nf.name +
      '（' +
      nf.kind +
      '）</b><span class="muted">' +
      nf.bio +
      '</span><span class="chip">' +
      flv(fr.xp) +
      '・友誼 ' +
      fr.xp +
      '</span></div></div><div class="row" style="margin:10px 0 4px"><button class="btn small" data-soc="hi">打招呼</button><button class="btn small" data-soc="play">一齊玩</button><button class="btn small ghost" data-soc="snack">分零食（3 金幣）</button></div>';
  else h += '<p class="muted">今次冇遇到其他寵物，但' + esc(p.name) + '都玩得好開心。</p>';
  if (trip.found)
    h +=
      '<p style="margin-top:8px">拾到寶物：<b>' + trip.found + '</b>（已放入朋友頁嘅寶物盒）</p>';
  if (trip.egg)
    h +=
      '<div class="row" style="margin-top:8px;gap:10px;flex-wrap:nowrap"><div style="width:48px;flex:none">' +
      PET.egg({ kind: 'normal', warmth: 0 }) +
      '</div><p style="margin:0">拾到一隻<b>賽博蛋</b>！已經放咗喺屋企嘅孵蛋座。你照顧自己同照顧' +
      esc(p.name) +
      '，佢就會慢慢暖起嚟。</p></div>';
  h +=
    '<hr class="sep"><div class="row">' +
    (trip.place === 'park' || trip.place === 'lake'
      ? '<button class="btn ghost" id="game-go">拋波仔</button>'
      : '') +
    '<button class="btn ghost" id="trip-photo">影相</button><button class="btn" id="trip-home">返屋企</button></div><div id="game" hidden></div>';
  $('#out-panel').innerHTML = h;
}

let ballGame = null;

function stopGame() {
  if (!ballGame) return;
  cancelAnimationFrame(ballGame.raf);
  cancelAnimationFrame(ballGame.flight);
  clearTimeout(ballGame.timer);
  ballGame = null;
  const ball = $('#ball');
  if (ball) ball.hidden = true;
  const box = $('#game');
  if (box)
    box.innerHTML =
      '<p>今局暫停咗，隨時再玩。</p><button class="btn ghost small" data-start-ball>重新開始</button>';
}

function startGame() {
  stopGame();
  const box = $('#game');
  if (!box || !trip || !state.pet) return;
  box.hidden = false;
  const g = (ballGame = {
    n: 0,
    score: 0,
    t0: performance.now(),
    raf: 0,
    flight: 0,
    timer: 0,
    busy: false,
    x: 0.5,
    petId: state.pet.id,
    static: prefersReducedMotion(),
  });
  box.innerHTML =
    '<p>' +
    (g.static
      ? '減少動態模式：拖動滑桿揀力度，再撳「拋！」。'
      : '撳「拋！」嘅時候，指針喺中間綠色位就最準。') +
    '一共 5 球。</p>' +
    (g.static
      ? '<label>拋波力度<input id="game-aim" type="range" min="0" max="100" value="50"></label>'
      : '<div class="power"><i id="pw"></i></div>') +
    '<div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn" id="game-throw">拋！</button><span id="game-score" class="muted" role="status">0 球・0 分</span></div>';
  if (!g.static) {
    const loop = (t) => {
      if (ballGame !== g) return;
      g.x = (Math.sin((t - g.t0) / 380) + 1) / 2;
      const pw = $('#pw');
      if (pw) pw.style.left = 'calc(' + g.x * 100 + '% - 2px)';
      g.raf = requestAnimationFrame(loop);
    };
    g.raf = requestAnimationFrame(loop);
  }
}

function finishBall(g, pts) {
  if (ballGame !== g || !trip || !state.pet || state.pet.id !== g.petId) return;
  const ball = $('#ball');
  if (ball) ball.hidden = true;
  const pe = $('#outstage .on-stage');
  if (pe) {
    pe.classList.remove('walking');
    pe.style.left = trip.npc ? '30%' : '50%';
  }
  setPetExpr('outstage', pts === 3 ? 'love' : pts ? 'happy' : 'wow', 1500);
  bubble('obubble', pts === 3 ? '接得好靚！' : pts ? '接住咗！' : '跑遠咗少少，再試就得。');
  $('#game-score').textContent = g.n + ' 球・' + g.score + ' 分';
  g.busy = false;
  $('#game-throw').disabled = false;
  if (g.n < 5) return;
  cancelAnimationFrame(g.raf);
  const p = state.pet,
    win = g.score,
    k = defaultDay();
  p.best = Math.max(p.best || 0, win);
  p.ballRewards = p.ballRewards || {};
  const count = p.ballRewards[k] || 0;
  const gain = count < 2 ? win : 0;
  p.ballRewards[k] = count + 1;
  p.coins += gain;
  traitBump('active');
  need('fun', 20);
  need('energy', -6);
  if (win > 0) petAward('game', Math.min(10, win), 1, '拋波仔');
  persist();
  $('#game').innerHTML =
    '<p><b>五球完成！' +
    win +
    ' 分</b>（最高 ' +
    p.best +
    ' 分）。' +
    (gain ? '拋波獎勵 +' + gain + ' 金幣。' : '今日嘅金幣獎勵已領晒，可以繼續慢慢玩。') +
    '</p><button class="btn ghost small" data-start-ball>再玩一次</button>';
  ballGame = null;
}

function throwBall() {
  const g = ballGame;
  if (!g || g.busy || !trip) return;
  g.busy = true;
  $('#game-throw').disabled = true;
  const x = g.static ? Number($('#game-aim').value) / 100 : g.x,
    pts = x > 0.42 && x < 0.58 ? 3 : x > 0.3 && x < 0.7 ? 1 : 0;
  g.n++;
  g.score += pts;
  if (g.static) {
    finishBall(g, pts);
    return;
  }
  const ball = $('#ball');
  if (!ball) {
    stopGame();
    return;
  }
  ball.hidden = false;
  let st = null;
  const dist = pts === 3 ? 78 : pts === 1 ? 64 : 45;
  const anim = (t) => {
    if (ballGame !== g) return;
    if (st === null) st = t;
    const k = Math.min(1, (t - st) / 900);
    ball.style.left = 18 + dist * k * 0.9 + '%';
    ball.style.bottom = 20 + Math.sin(k * Math.PI) * 46 + '%';
    if (k < 1) g.flight = requestAnimationFrame(anim);
    else {
      const pe = $('#outstage .on-stage');
      if (pe) {
        pe.classList.add('walking');
        pe.style.transition = 'left .6s ease';
        pe.style.left = Math.min(72, dist * 0.8) + '%';
      }
      g.timer = setTimeout(() => finishBall(g, pts), 700);
    }
  };
  g.flight = requestAnimationFrame(anim);
}

function initializePetOutings() {
  document.addEventListener('click', (e) => {
    const pl = e.target.closest('[data-place]');
    if (pl) {
      startTrip(pl.dataset.place);
      return;
    }
    const so = e.target.closest('[data-soc]');
    if (so && trip && trip.npc) {
      const p = state.pet;
      p.friends = p.friends || {};
      const fr = (p.friends[trip.npc] = p.friends[trip.npc] || { xp: 0, met: 0 });
      const nf = PET.NPC.find((x) => x.id === trip.npc);
      const k = so.dataset.soc;
      if (k === 'snack') {
        if (p.coins < 3) {
          toast('金幣唔夠，下次先分啦');
          return;
        }
        p.coins -= 3;
      }
      const before = flv(fr.xp);
      const gain = { hi: 3, play: 6, snack: 10 }[k];
      fr.xp += gain;
      if (!trip.met) {
        fr.met++;
        trip.met = true;
      }
      if (k === 'play') {
        need('fun', 10);
        need('energy', -4);
      }
      traitBump('social');
      petAward('social', 3, 3);
      persist();
      bubble(
        'nbubble',
        k === 'snack' ? '多謝你！' + nf.likes + '係我最鍾意嘅！' : pick(NPCLINES[trip.npc]),
      );
      setTimeout(
        () =>
          bubble(
            'obubble',
            k === 'hi' ? '你好呀' + nf.name + '！' : k === 'play' ? '追我呀！' : '一齊食！',
          ),
        900,
      );
      fx('ofx', ['♥', '♪', '✦'], 5);
      if (flv(fr.xp) !== before)
        setTimeout(() => toast('同' + nf.name + '嘅關係升級：' + flv(fr.xp)), 1400);
      renderOutPanel();
      return;
    }
    if (e.target.id === 'trip-home') {
      stopGame();
      cancelTrip();
      segSet('pettab', 'home');
      showPetTab();
      return;
    }
    if (e.target.id === 'trip-photo' && trip) {
      openPhoto(trip.place, trip.npc);
      return;
    }
    if (e.target.id === 'game-go' || e.target.closest('[data-start-ball]')) {
      startGame();
      return;
    }
    if (e.target.id === 'game-throw') {
      throwBall();
      return;
    }
  });
}

export { stopGame, cancelTrip, trip, renderOutChoose, initializePetOutings };
