import { state, journalStore, persist } from './state.mjs';
import { hbStrength } from './model/habits.mjs';
import { drawCounts } from './cards/model.mjs';
import { allPets, petStage, addEgg } from './pet/model.mjs';
import { isDrawBusy } from './cards/draw.mjs';
import { keyOf } from './shared/dates.mjs';
import { CQ, showCele } from './shared/celebration.mjs';
import { uid } from './shared/helpers.mjs';

const nCI = () => Object.keys(state.checkins).length;

const nDR = () => Object.keys(state.draws || {}).length;

const hbMax = () => Math.max(0, ...(state.habits || []).map((h) => hbStrength(h)));

const MILES = [
  { id: 'ci1', t: '第一次打卡', s: '開始咗就係最難嘅一步。', f: () => nCI() >= 1 },
  {
    id: 'ci10',
    t: '打卡 10 日',
    s: '十日嘅記錄，已經睇得出你自己嘅節奏。',
    f: () => nCI() >= 10,
  },
  {
    id: 'ci30',
    t: '打卡 30 日',
    s: '一個月嘅自己，一日一日寫落嚟。',
    f: () => nCI() >= 30,
    egg: 1,
  },
  {
    id: 'ci100',
    t: '打卡 100 日',
    s: '一百日。呢份堅持係你自己嘅。',
    f: () => nCI() >= 100,
    egg: 1,
  },
  { id: 'dr1', t: '第一次收工抽卡', s: '書櫃上面多咗第一本書。', f: () => nDR() >= 1 },
  { id: 'dr7', t: '抽咗 7 晚卡', s: '一個星期嘅收工日記。', f: () => nDR() >= 7 },
  { id: 'dr30', t: '抽咗 30 晚卡', s: '成個書櫃開始滿起嚟。', f: () => nDR() >= 30, egg: 1 },
  {
    id: 'zhiji',
    t: '第一張「知己」牌',
    s: '同一張牌見咗 7 次，佢已經好熟你。',
    f: () => Object.values(drawCounts()).some((n) => n >= 7),
    egg: 1,
  },
  { id: 'hb50', t: '第一個習慣強度過 50%', s: '個習慣開始穩定落嚟。', f: () => hbMax() >= 50 },
  {
    id: 'hb80',
    t: '第一個「已經成為習慣」',
    s: '唔使諗都會做，就係習慣。',
    f: () => hbMax() >= 80,
    egg: 1,
  },
  {
    id: 'ev20',
    t: '證據簿有 20 條',
    s: '二十件真實做到嘅事。',
    f: () => (state.evidence || []).length >= 20,
  },
  {
    id: 'lad5',
    t: '細步階梯行咗 5 次',
    s: '每一級都係實際行過嘅。',
    f: () =>
      (state.ladders || []).reduce(
        (n, L) => n + L.steps.reduce((m, x) => m + (x.log || []).length, 0),
        0,
      ) >= 5,
  },
  {
    id: 'teen',
    t: '寵物長大到少年',
    s: '佢同你一齊大個咗。',
    f: () => !!state.pet && allPets().some((x) => petStage(x) >= 1),
  },
  {
    id: 'adult',
    t: '寵物長大到成年',
    s: '一路照顧落嚟嘅結果。',
    f: () => !!state.pet && allPets().some((x) => petStage(x) >= 2),
    egg: 1,
  },
  {
    id: 'hatch1',
    t: '第一隻蛋孵出嚟',
    s: '屋企多咗一位成員。',
    f: () => !!state.pet && (state.pet.hatched || 0) >= 1,
  },
  {
    id: 'friend',
    t: '識到第一個寵物朋友',
    s: '出街行吓，就會識到朋友。',
    f: () => !!state.pet && Object.keys(state.pet.friends || {}).length >= 1,
  },
  {
    id: 'album10',
    t: '相簿有 10 張相',
    s: '十個值得記住嘅畫面。',
    f: () => !!state.pet && (state.pet.album || []).length >= 10,
  },
];

let milesT = 0;

function milesSoon() {
  clearTimeout(milesT);
  milesT = setTimeout(checkMiles, 1200);
}

function checkMiles() {
  if (journalStore.initialLoadPending) {
    milesSoon();
    return;
  }
  if (isDrawBusy()) {
    milesSoon();
    return;
  }
  state.miles = state.miles || {};
  const fresh = MILES.filter(
    (m) =>
      !state.miles[m.id] &&
      (() => {
        try {
          return m.f();
        } catch (e) {
          return false;
        }
      })(),
  );
  if (!fresh.length) return;
  const k = keyOf(new Date());
  if (!state.milesInit) {
    state.milesInit = 1;
    fresh.forEach((m) => {
      state.miles[m.id] = k;
    });
    if (state.pet) state.pet.coins += 10 * fresh.length;
    persist();
    CQ.push({
      eyebrow: '你一路做到嘅',
      title: '之前已經達成 ' + fresh.length + ' 個里程碑',
      sub: fresh.map((m) => m.t).join('、') + '。',
      rew: state.pet ? '寵物金幣 +' + 10 * fresh.length : '',
    });
    showCele();
    return;
  }
  let changed = false;
  fresh.forEach((m) => {
    state.miles[m.id] = k;
    changed = true;
    let rew = [];
    if (state.pet) {
      state.pet.coins += 20;
      rew.push('金幣 +20');
      if (m.egg) {
        if (addEgg('gold')) rew.push('一隻金蛋');
        else {
          state.pet.coins += 20;
          rew.push('屋企滿咗，改送金幣 +20');
        }
      }
    }
    state.evidence.push({
      id: uid(),
      date: k,
      type: '做到',
      text: '里程碑：' + m.t,
      src: '里程碑',
    });
    rew.push('已記入證據簿');
    CQ.push({ eyebrow: '里程碑', title: m.t, sub: m.s, rew: rew.join('・') });
  });
  if (changed) {
    persist();
    showCele();
  }
}

export { MILES, milesSoon };
