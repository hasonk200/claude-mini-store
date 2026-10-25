import { state } from '../state.mjs';
import { allPets, inSleep, petStage, traitOf } from './model.mjs';
import { NEEDS } from '../data/pet.mjs';
import { esc } from '../shared/dom.mjs';
import { PET } from '../art/pet.mjs';

const SPOTS = [
  { id: 'rug', x: 44, b: 7, ex: 'happy', l: ['地氈好軟呀～', '喺度打個滾！'] },
  { id: 'bed', x: 80, b: 8, ex: 'sleep', l: ['借我瞓陣……', '好暖……'] },
  {
    id: 'sofa',
    x: 66,
    b: 41,
    req: 'sofa',
    ex: 'happy',
    l: ['梳化好舒服！你都嚟坐吓？', '攤喺度最正。'],
  },
  { id: 'ball', x: 36, b: 3, req: 'ball', ex: 'happy', l: ['波波！陪我玩！'] },
  { id: 'kitchen', x: 14, b: 16, req: 'kitchen', ex: 'ask', l: ['好香呀……今晚食咩？'] },
  { id: 'shelf', x: 28, b: 9, req: 'shelf', ex: 'normal', l: ['好多書，都係你抽卡嘅回憶。'] },
  { id: 'tank', x: 43, b: 13, req: 'tank', ex: 'wow', l: ['魚仔游嚟游去～'] },
  { id: 'window', x: 72, b: 6, not: 'sofa', ex: 'wow', l: ['出面好靚……'] },
  { id: 'corner', x: 22, b: 3, ex: 'happy', l: ['呢個角落好舒服。'] },
  { id: 'back', x: 60, b: 24, ex: 'normal', l: ['我喺度望住你。'] },
];

let roamingPositions = {};

function spotsAvail() {
  const own = (state.pet && state.pet.own) || {};
  return SPOTS.filter((s) => (!s.req || own[s.req]) && (!s.not || !own[s.not]));
}

function spotOf(pid) {
  return SPOTS.find((s) => s.id === roamingPositions[pid]) || SPOTS[0];
}

const PREF = ['rug', 'sofa', 'bed', 'window', 'kitchen', 'corner', 'back', 'ball', 'shelf', 'tank'];

const near = (a, b) => Math.abs(a.x - b.x) < 15 && Math.abs(a.b - b.b) < 16;

function freeSpots(except) {
  const occ = Object.keys(roamingPositions)
    .filter((k) => k !== except && allPets().some((x) => x.id === k))
    .map((k) => SPOTS.find((s) => s.id === roamingPositions[k]))
    .filter(Boolean);
  return spotsAvail().filter((s) => !occ.some((o) => o.id === s.id || near(o, s)));
}

function roamPlace() {
  const av = spotsAvail();
  const live = allPets().map((x) => x.id);
  Object.keys(roamingPositions).forEach((k) => {
    if (!live.includes(k)) delete roamingPositions[k];
  });
  allPets().forEach((x, i) => {
    const cur = roamingPositions[x.id];
    delete roamingPositions[x.id];
    const fr = freeSpots(x.id);
    const ok = cur && fr.some((s) => s.id === cur);
    let s = cur;
    if (!ok) {
      const want = i === 0 && inSleep() ? ['bed'].concat(PREF) : PREF;
      s = (
        want.map((id) => fr.find((f) => f.id === id)).find(Boolean) ||
        fr[0] ||
        av[i % av.length]
      ).id;
    }
    roamingPositions[x.id] = s;
  });
}

function roamExpr() {
  const p = state.pet;
  if (inSleep()) return 'sleep';
  const s = spotOf(p.id);
  if (NEEDS.some(([k]) => p.needs[k] < 40)) return 'ask';
  return s.ex || 'normal';
}

function othersHTML() {
  const p = state.pet;
  return (p.others || [])
    .map((o) => {
      const s = spotOf(o.id);
      return (
        '<button class="on-stage other" data-pid="' +
        o.id +
        '" style="left:' +
        s.x +
        '%;bottom:' +
        s.b +
        '%" aria-label="轉去照顧' +
        esc(o.name) +
        '">' +
        PET.svg({
          sp: o.sp,
          color: o.color,
          stage: petStage(o),
          acc: o.acc,
          shiny: o.shiny,
          trait: traitOf(o),
          expr: inSleep() ? 'sleep' : s.ex,
        }) +
        '</button>'
      );
    })
    .join('');
}

function resetRoamingPositions() {
  roamingPositions = {};
}

export {
  roamExpr,
  roamPlace,
  spotOf,
  othersHTML,
  resetRoamingPositions,
  freeSpots,
  roamingPositions,
  spotsAvail,
  SPOTS,
  near,
};
