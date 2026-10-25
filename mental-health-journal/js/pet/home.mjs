import { $, esc } from '../shared/dom.mjs';
import { PET } from '../art/pet.mjs';
import { state, persist } from '../state.mjs';
import { frameCardSVG, rainingToday, icon } from './presentation.mjs';
import {
  ensurePet,
  petO,
  petStage,
  traitOf,
  tickNeeds,
  traitBump,
  need,
  allPets,
  household,
  petNew,
} from './model.mjs';
import { roamPlace, spotOf, roamExpr, othersHTML, resetRoamingPositions } from './positions.mjs';
import { roamArm, consumeRoamDrag } from './roaming.mjs';
import { NEEDS, TRAITS, PFOOD, PLN, HOUSE_MAX } from '../data/pet.mjs';
import { keyOf } from '../shared/dates.mjs';
import { petBusy, bubble, setPetExpr, fx } from './effects.mjs';
import { go } from '../navigation.mjs';
import { openPhoto } from './photos.mjs';
import { segSet, toast, segGet } from '../shared/controls.mjs';
import { showPetTab, renderPet } from './page.mjs';
import { petAward } from './rewards.mjs';
import { pick, uid } from '../shared/helpers.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { celebrate } from '../shared/celebration.mjs';
import { switchPet } from './selection.mjs';

let adoptSp = 'cat';

let adoptColor = 'milktea';

function renderAdopt() {
  $('#adopt-sp').innerHTML = Object.entries(PET.SPECIES)
    .map(
      ([k, n]) =>
        '<button class="adopt-card' +
        (adoptSp === k ? ' on' : '') +
        '" data-sp="' +
        k +
        '">' +
        PET.svg({
          sp: k,
          color: adoptColor,
          stage: 1,
          expr: adoptSp === k ? 'happy' : 'normal',
        }) +
        '<b>' +
        n +
        '</b><span>' +
        {
          cat: '有天線同發光尾巴，好黐人',
          dog: '機械耳仔，見到你就搖尾',
          cloud: '浮喺半空，軟綿綿',
        }[k] +
        '</span></button>',
    )
    .join('');
  $('#adopt-color').innerHTML = Object.entries(PET.PAL)
    .filter(([k, c]) => !c.rare)
    .map(
      ([k, c]) =>
        '<button class="swatch' +
        (adoptColor === k ? ' on' : '') +
        '" data-col="' +
        k +
        '" style="--c:' +
        c.body +
        ';--g:' +
        c.glow +
        '" aria-label="' +
        c.n +
        '"><i></i>' +
        c.n +
        '</button>',
    )
    .join('');
}

function renderRoom() {
  const p = state.pet;
  const frame = frameCardSVG();
  ensurePet();
  roamPlace();
  const sp = spotOf(p.id);
  $('#room').innerHTML =
    PET.room({
      hour: new Date().getHours(),
      own: p.own,
      rain: rainingToday(),
      books: Math.max(6, Math.min(40, Object.keys(state.draws || {}).length + 6)),
      frameCard: frame,
    }) +
    nestHTML() +
    '<button class="on-stage" data-pid="' +
    p.id +
    '" style="left:' +
    sp.x +
    '%;bottom:' +
    sp.b +
    '%" aria-label="摸摸' +
    esc(p.name) +
    '">' +
    PET.svg(petO(roamExpr())) +
    '</button>' +
    othersHTML() +
    '<div class="bubble" id="bubble" hidden></div><div class="fx" id="fx"></div>';
  roamArm();
}

function meterHTML() {
  return NEEDS.map(([k, n, hi, mid, lo]) => {
    const v = Math.round(state.pet.needs[k]);
    const c = v >= 60 ? 'good' : v >= 40 ? 'warn' : 'calm';
    return (
      '<div class="meter"><span>' +
      n +
      '</span><div class="bar"><i class="' +
      c +
      '" style="width:' +
      v +
      '%"></i></div><span class="muted">' +
      (v >= 70 ? hi : v >= 40 ? mid : lo) +
      '</span></div>'
    );
  }).join('');
}

function renderStatus() {
  const p = state.pet,
    st = petStage(p),
    nx = PET.STAGES[st + 1];
  ensurePet();
  const tr = traitOf(p);
  const prog = nx
    ? Math.round(((p.xp - PET.STAGES[st].xp) / (nx.xp - PET.STAGES[st].xp)) * 100)
    : 100;
  $('#pet-status').innerHTML =
    familyBar() +
    '<div class="row" style="justify-content:space-between;align-items:baseline"><h2>' +
    esc(p.name) +
    '</h2><span class="chip">' +
    PET.SPECIES[p.sp] +
    '・' +
    PET.STAGES[st].n +
    '</span></div>' +
    '<div class="row" style="gap:6px;margin-top:6px">' +
    (p.shiny ? '<span class="chip shiny">✦ 閃光</span>' : '') +
    (tr
      ? '<span class="chip calm" title="' + TRAITS[tr][1] + '">' + TRAITS[tr][0] + '</span>'
      : st < 1
        ? '<span class="chip">少年期會出性格</span>'
        : '<span class="chip">性格慢慢形成中</span>') +
    '</div>' +
    '<div class="love"><span>愛你嘅程度</span><b>∞</b><span class="muted">無條件，永遠唔會變</span></div>' +
    '<div class="meter"><span>羈絆</span><div class="bar"><i class="red" style="width:' +
    prog +
    '%"></i></div><span class="muted">' +
    (nx ? p.xp + '／' + nx.xp : '滿級') +
    '</span></div>' +
    '<div class="coins">金幣 <b>' +
    p.coins +
    '</b></div><hr class="sep">' +
    meterHTML() +
    '<p class="muted" style="margin-top:10px">得閒返嚟，陪' +
    esc(p.name) +
    '食啲嘢、玩一陣。</p>';
}

function renderEarn() {
  const p = state.pet,
    k = keyOf(new Date()),
    done = (p.aw || {})[k] || [];
  const cnt = (x) => done.filter((y) => y === x).length;
  const L = [
    ['ci', '今日打卡', 10, 1, 'today'],
    ['habit', '完成習慣', 3, 3, 'today'],
    ['draw', '收工抽卡', 10, 1, 'draw'],
    ['talk', '同人傾咗偈（打卡時揀）', 5, 1, 'today'],
    ['move', '有郁身（打卡時揀）', 5, 1, 'today'],
    ['ev', '加一條證據', 5, 3, 'evidence'],
    ['lad', '行一級細步階梯', 15, 2, 'ladder'],
    ['sos', '用卡住急救', 10, 1, 'sos'],
    ['wk', '寫每週三省', 20, 1, 'review'],
    ['phq', '做 PHQ-4', 15, 1, 'review'],
    ['walk', '帶' + p.name + '出街', 5, 3, null],
    ['care', '親手照顧（餵食、飲水、沖涼）', 2, 6, null],
  ];
  $('#pet-earn').innerHTML =
    '<h2>今日點樣加羈絆</h2><div class="sub">你照顧自己，同照顧' +
    esc(p.name) +
    '，佢都會長大。</div><ul class="list">' +
    L.map(([id, n, pt, cap, go]) => {
      const c = cnt(id);
      return (
        '<li class="item" style="align-items:center"><span class="chip ' +
        (c >= cap ? 'good' : '') +
        '">' +
        (c >= cap ? '完成' : '+' + pt) +
        '</span><div class="txt">' +
        (go ? '<button class="linkbtn" data-goto="' + go + '">' + n + '</button>' : n) +
        (cap > 1 ? '<span class="muted">　' + c + '／' + cap + '</span>' : '') +
        '</div></li>'
      );
    }).join('') +
    '</ul>';
}

function renderChat() {
  const p = state.pet;
  const box = $('#chat-log');
  box.innerHTML =
    (p.chat || [])
      .slice(-12)
      .map((m) => '<div class="msg ' + (m.r === 'me' ? 'me' : 'pet') + '">' + esc(m.t) + '</div>')
      .join('') || '<p class="muted">同' + esc(p.name) + '講吓今日發生咩事，開心定唔開心都得。</p>';
  box.scrollTop = box.scrollHeight;
  $('#chat-title').textContent = '同' + p.name + '傾偈';
}

function renderHome() {
  if (!$('#care-row').children.length)
    $('#care-row').innerHTML = [
      ['feed', '餵食'],
      ['water', '飲水'],
      ['bath', '沖涼'],
      ['pat', '摸摸頭'],
      ['play', '去玩遊戲'],
      ['sleep', '哄佢瞓'],
      ['out', '出街'],
      ['photo', '影相'],
    ]
      .map(
        ([k, n]) =>
          '<button class="care" data-care="' +
          k +
          '">' +
          icon(k) +
          '<span>' +
          n +
          '</span></button>',
      )
      .join('');
  renderRoom();
  renderStatus();
  renderEarn();
  renderChat();
  $('#care-panel').hidden = true;
}

function care(kind) {
  const p = state.pet;
  if (!p || petBusy) return;
  tickNeeds();
  if (kind === 'feed') {
    const k = keyOf(new Date());
    $('#care-panel').innerHTML =
      '<h3 style="margin-bottom:8px">揀嘢俾' +
      esc(p.name) +
      '食</h3><div class="foods">' +
      PFOOD.map((f) => {
        const used = f.daily && p.fed === k;
        return (
          '<button class="food" data-food="' +
          f.id +
          '"' +
          (used || (!f.daily && p.coins < f.p) ? ' disabled' : '') +
          '><b>' +
          f.n +
          '</b><span>' +
          (f.daily ? (used ? '今日食咗' : '免費') : f.p + ' 金幣') +
          '</span><small>' +
          f.d +
          '</small></button>'
        );
      }).join('') +
      '</div>';
    $('#care-panel').hidden = false;
    return;
  }
  if (kind === 'chat') {
    $('#chat-in').focus();
    return;
  }
  if (kind === 'play') {
    go('arcade');
    return;
  }
  if (kind === 'photo') {
    openPhoto('home');
    return;
  }
  if (kind === 'out') {
    segSet('pettab', 'out');
    showPetTab();
    return;
  }
  const map = {
    water: ['water', 40, 'drink', 'eat', ['💧'], 'water'],
    bath: ['clean', 50, 'bath', 'happy', ['○', '◦', '○'], 'bath'],
    pat: ['fun', 6, 'pat', 'love', ['♥', '♥', '♥'], 'pat'],
    play: ['fun', 18, 'play', 'happy', ['★', '✦'], 'play'],
    sleep: ['energy', 25, 'sleep', 'sleep', ['z', 'Z'], 'sleep'],
  };
  const m = map[kind];
  if (!m) return;
  traitBump({ water: 'food', bath: 'cozy', pat: 'cozy', play: 'active', sleep: 'cozy' }[kind]);
  if (kind === 'sleep' && Date.now() - (p.sleepAt || 0) < 2 * 36e5) {
    bubble('bubble', '我啱啱瞓醒，仲好精神！遲啲再瞓。');
    return;
  }
  need(m[0], m[1]);
  if (kind === 'play') need('energy', -5);
  if (kind === 'sleep') p.sleepAt = Date.now();
  if (kind === 'pat') petAward('care-pat', 1, 5);
  else petAward('care', 2, 6);
  setPetExpr('room', m[3], kind === 'sleep' ? 6000 : 2600);
  bubble('bubble', pick(kind === 'pat' ? PLN.pat.concat(PLN.love) : PLN[m[2]]));
  fx('fx', m[4] === '💧' ? ['◦', '◦', '◦'] : m[4], 6);
  persist();
  renderStatus();
  renderEarn();
}

function familyBar() {
  const p = state.pet;
  if (!p || !(p.others || []).length) return '';
  return (
    '<div class="fam-bar" role="group" aria-label="揀照顧邊隻"><span class="muted">屋企</span>' +
    allPets()
      .map(
        (x) =>
          '<button class="fam' +
          (x === p ? ' on' : '') +
          '" ' +
          (x === p ? 'aria-current="true" disabled' : 'data-switch="' + x.id + '"') +
          ' aria-label="' +
          esc(x.name) +
          '">' +
          PET.svg(
            {
              sp: x.sp,
              color: x.color,
              stage: petStage(x),
              acc: x.acc,
              shiny: x.shiny,
              trait: traitOf(x),
              expr: x === p ? 'happy' : 'normal',
            },
            'mini',
          ) +
          '<span>' +
          esc(x.name) +
          '</span></button>',
      )
      .join('') +
    '</div>'
  );
}

function renderFamily() {
  const p = state.pet,
    box = $('#family');
  if (!box || !p) return;
  ensurePet();
  const seen = {};
  allPets().forEach((x) => {
    seen[x.sp + '-' + (x.shiny ? 's' : 'n')] = 1;
  });
  const coll = Object.keys(PET.SPECIES)
    .map((sp) => [sp, 0])
    .concat(Object.keys(PET.SPECIES).map((sp) => [sp, 1]));
  box.innerHTML =
    '<div class="fam-grid">' +
    allPets()
      .map((x) => {
        const tr = traitOf(x);
        return (
          '<div class="fam-card' +
          (x === p ? ' on' : '') +
          '"><div class="f-pic">' +
          PET.svg(
            {
              sp: x.sp,
              color: x.color,
              stage: petStage(x),
              acc: x.acc,
              shiny: x.shiny,
              trait: tr,
              expr: 'happy',
            },
            'mini',
          ) +
          '</div><b>' +
          esc(x.name) +
          '</b><span class="muted">' +
          PET.SPECIES[x.sp] +
          '・' +
          PET.STAGES[petStage(x)].n +
          '</span><div class="row" style="gap:4px;justify-content:center">' +
          (x.shiny ? '<span class="chip shiny">✦ 閃光</span>' : '') +
          (tr ? '<span class="chip calm">' + TRAITS[tr][0] + '</span>' : '') +
          '</div>' +
          (x === p
            ? '<span class="chip good">照顧緊</span>'
            : '<button class="btn small ghost" data-switch="' + x.id + '">照顧佢</button>') +
          '</div>'
        );
      })
      .join('') +
    '</div>' +
    '<h3 style="margin:16px 0 8px">收集冊</h3><div class="coll">' +
    coll
      .map(([sp, sh]) => {
        const got = seen[sp + '-' + (sh ? 's' : 'n')];
        return (
          '<div class="coll-i' +
          (got ? '' : ' locked') +
          '"><div class="f-pic">' +
          PET.svg(
            {
              sp,
              color: sh ? 'aurora' : 'milktea',
              stage: 1,
              shiny: sh,
              expr: got ? 'happy' : 'sleep',
            },
            'mini',
          ) +
          '</div><span>' +
          (got ? (sh ? '閃光' + PET.SPECIES[sp] : PET.SPECIES[sp]) : sh ? '？ 閃光' : '？') +
          '</span></div>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="muted" style="margin-top:10px">屋企最多住 ' +
    HOUSE_MAX +
    ' 隻。散步有機會拾到賽博蛋；里程碑會送金蛋，金蛋好大機會孵出閃光寵物。</p>';
}

function nestHTML() {
  const p = state.pet;
  const eggs = p.eggs || [];
  if (!eggs.length) return '';
  const e = eggs[0];
  const ready = eggs.some((x) => x.warmth >= x.need);
  return (
    '<button class="nest" id="nest" aria-label="孵蛋座，' +
    eggs.length +
    ' 隻蛋' +
    (ready ? '，可以孵喇' : '') +
    '"><svg viewBox="0 0 120 40" class="nest-bed" aria-hidden="true"><ellipse cx="60" cy="26" rx="56" ry="13" fill="#a8835e"/><ellipse cx="60" cy="22" rx="46" ry="10" fill="#e9d8b8"/><path d="M14 24q10 -8 20 0t20 0t20 0t20 0t20 0" stroke="#8a6a48" stroke-width="2" fill="none"/></svg><span class="nest-egg">' +
    PET.egg({
      kind: e.kind,
      warmth: e.warmth,
      need: e.need,
      wobble: ready && !prefersReducedMotion(),
    }) +
    '</span>' +
    (eggs.length > 1 ? '<span class="nest-n">×' + eggs.length + '</span>' : '') +
    '<span class="nest-bar"><i style="width:' +
    Math.round((e.warmth / e.need) * 100) +
    '%"></i></span>' +
    (ready ? '<span class="nest-tag">可以孵喇</span>' : '') +
    '</button>'
  );
}

function renderEggPanel() {
  const p = state.pet;
  const full = household() >= HOUSE_MAX;
  $('#care-panel').innerHTML =
    '<div class="row" style="justify-content:space-between"><h3>孵蛋座</h3><button class="btn ghost small" id="egg-close">收埋</button></div><p class="muted" style="margin:4px 0 12px">打卡、完成習慣、收工抽卡、照顧寵物都會令蛋暖啲。你做嘅每樣好嘢，都喺度慢慢孵緊。</p><div class="eggs">' +
    (p.eggs || [])
      .map((e) => {
        const ready = e.warmth >= e.need;
        const pc = Math.round((e.warmth / e.need) * 100);
        return (
          '<div class="egg-row"><div class="egg-pic">' +
          PET.egg({
            kind: e.kind,
            warmth: e.warmth,
            need: e.need,
            wobble: ready && !prefersReducedMotion(),
          }) +
          '</div><div style="flex:1;min-width:0"><b>' +
          (e.kind === 'gold' ? '金色賽博蛋' : '賽博蛋') +
          '</b><span class="muted">　' +
          (e.kind === 'gold' ? '好大機會孵出閃光寵物' : '有機會孵出閃光寵物') +
          '</span><div class="bar" style="margin:8px 0"><i class="' +
          (ready ? 'good' : 'warn') +
          '" style="width:' +
          pc +
          '%"></i></div>' +
          (ready
            ? full
              ? '<p class="muted">屋企已經住滿 ' + HOUSE_MAX + ' 隻，暫時孵唔到。</p>'
              : '<div class="row" style="flex-wrap:nowrap"><input type="text" id="egg-name-' +
                e.id +
                '" maxlength="12" placeholder="幫佢改個名" style="flex:1;min-width:0"><button class="btn" data-hatch="' +
                e.id +
                '">孵化</button></div>'
            : '<span class="muted">溫度 ' + pc + '%</span>') +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';
  $('#care-panel').hidden = false;
}

const BABYN = ['布丁', '芝士', '湯圓', '豆腐', '奶茶', '雪條', '魚蛋', '菠蘿包', '小籠包', '西多'];

function hatchEgg(id) {
  const p = state.pet;
  const e = (p.eggs || []).find((x) => x.id === id);
  if (!e || e.warmth < e.need || household() >= HOUSE_MAX) return;
  const inp = $('#egg-name-' + id);
  const name = ((inp && inp.value.trim()) || pick(BABYN)).slice(0, 12);
  const shiny = Math.random() < (e.kind === 'gold' ? 0.5 : 0.125) ? 1 : 0;
  const sps = Object.keys(PET.SPECIES);
  const cols = Object.keys(PET.PAL).filter((k) => !PET.PAL[k].rare);
  const color = shiny && Math.random() < 0.5 ? 'aurora' : pick(cols);
  const baby = {
    id: uid(),
    name,
    sp: pick(sps),
    color,
    acc: '',
    xp: 0,
    needs: { food: 85, water: 85, energy: 85, clean: 90, fun: 90 },
    nt: Date.now(),
    chat: [],
    fed: '',
    sleepAt: 0,
    born: keyOf(new Date()),
    shiny,
    traits: {},
  };
  p.eggs = p.eggs.filter((x) => x.id !== id);
  p.others.push(baby);
  p.hatched = (p.hatched || 0) + 1;
  persist();
  $('#care-panel').hidden = true;
  renderRoom();
  renderStatus();
  const art = PET.svg(Object.assign({ stage: 0, expr: 'love' }, baby));
  if (typeof celebrate === 'function')
    celebrate({
      eyebrow: shiny ? '✦ 稀有' : '孵化',
      title: name + ' 出世喇！',
      sub:
        (shiny
          ? '係閃光' + PET.SPECIES[baby.sp] + '！好罕有。'
          : '係一隻' + PET.PAL[color].n + '嘅' + PET.SPECIES[baby.sp] + '。') +
        '佢同' +
        p.name +
        '一齊住，喺屋企撳佢就可以轉去照顧佢。',
      art,
    });
  else toast(name + ' 出世喇！');
}

function initializePetHome() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-sp]');
    if (a && a.closest('#adopt-sp')) {
      adoptSp = a.dataset.sp;
      renderAdopt();
      return;
    }
    const c = e.target.closest('[data-col]');
    if (c && c.closest('#adopt-color')) {
      adoptColor = c.dataset.col;
      renderAdopt();
    }
  });
  $('#adopt-go').addEventListener('click', () => {
    const n = $('#adopt-name').value.trim() || '波子';
    state.pet = petNew({ name: n.slice(0, 12), sp: adoptSp, color: adoptColor });
    resetRoamingPositions();
    persist();
    renderPet();
    setTimeout(() => {
      bubble('bubble', '你好呀主人！我係' + state.pet.name + '，以後我哋一齊住！');
      fx('fx', ['♥', '♥', '✦'], 6);
    }, 300);
  });
  $('#care-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-care]');
    if (b) care(b.dataset.care);
  });
  $('#care-panel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-food]');
    if (!b || b.disabled) return;
    const p = state.pet,
      f = PFOOD.find((x) => x.id === b.dataset.food);
    if (f.daily) p.fed = keyOf(new Date());
    else {
      if (p.coins < f.p) return;
      p.coins -= f.p;
    }
    need('food', f.food);
    need('fun', f.fun);
    traitBump('food');
    petAward('care', 2, 6);
    persist();
    $('#care-panel').hidden = true;
    setPetExpr('room', 'eat', 2600);
    bubble('bubble', f.id === 'pork' ? '東坡肉！火候足時他自美～好好食！' : pick(PLN.eat));
    fx('fx', ['♥', '✦'], 4);
    renderStatus();
    renderEarn();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#room .on-stage');
    if (!b) return;
    if (consumeRoamDrag()) {
      return;
    }
    if (b.classList.contains('other')) {
      switchPet(b.dataset.pid);
      return;
    }
    care('pat');
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-switch]');
    if (b) {
      switchPet(b.dataset.switch);
      if (segGet('pettab') !== 'home') {
        segSet('pettab', 'home');
        showPetTab();
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#nest')) {
      renderEggPanel();
      try {
        $('#care-panel').scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'nearest',
        });
      } catch (err) {}
      return;
    }
    if (e.target.id === 'egg-close') {
      $('#care-panel').hidden = true;
      return;
    }
    const h = e.target.closest('[data-hatch]');
    if (h) {
      hatchEgg(h.dataset.hatch);
    }
  });
}

export {
  renderChat,
  renderFamily,
  renderHome,
  renderAdopt,
  renderStatus,
  renderRoom,
  initializePetHome,
};
