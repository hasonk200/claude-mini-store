import { uid } from '../shared/helpers.mjs';
import { keyOf, mins } from '../shared/dates.mjs';
import { PET } from '../art/pet.mjs';
import { state, persist } from '../state.mjs';
import { DECAY, NEEDS, TRAITS, HOUSE_MAX, EGGNEED } from '../data/pet.mjs';
import { toast } from '../shared/controls.mjs';

function petNew(o) {
  return {
    id: uid(),
    shiny: 0,
    traits: {},
    eggs: [],
    others: [],
    eggDay: '',
    name: o.name,
    sp: o.sp,
    color: o.color,
    acc: '',
    born: keyOf(new Date()),
    xp: 0,
    coins: 30,
    needs: { food: 80, water: 80, energy: 80, clean: 85, fun: 80 },
    nt: Date.now(),
    own: {},
    accs: [],
    friends: {},
    album: [],
    aw: {},
    chat: [],
    lastVisit: '',
    walks: 0,
    best: 0,
    treasure: {},
    fed: '',
    sleepAt: 0,
  };
}

function petStage(p) {
  return p.xp >= PET.STAGES[2].xp ? 2 : p.xp >= PET.STAGES[1].xp ? 1 : 0;
}

function inSleep() {
  const n = new Date(),
    m = n.getHours() * 60 + n.getMinutes(),
    a = mins(state.settings.a),
    b = mins(state.settings.b);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

function decayOne(p, h) {
  Object.keys(DECAY).forEach((k) => {
    let v = p.needs[k] - DECAY[k] * h;
    if (k === 'energy' && inSleep()) v = p.needs[k] + 6 * h;
    p.needs[k] = Math.max(20, Math.min(100, v));
  });
  p.nt = Date.now();
}

function tickNeeds(save) {
  const p = state.pet;
  if (!p) return;
  ensurePet();
  const h = (Date.now() - (p.nt || Date.now())) / 36e5;
  if (h < 0.02) return;
  decayOne(p, h);
  p.others.forEach((o) => {
    const h2 = (Date.now() - (o.nt || Date.now())) / 36e5;
    if (h2 >= 0.02) decayOne(o, h2);
  });
  if (save) persist();
}

function need(k, dv) {
  const p = state.pet;
  p.needs[k] = Math.max(20, Math.min(100, p.needs[k] + dv));
}

const petO = (expr, extra) =>
  Object.assign(
    {
      sp: state.pet.sp,
      color: state.pet.color,
      stage: petStage(state.pet),
      acc: state.pet.acc,
      name: state.pet.name,
      shiny: state.pet.shiny,
      trait: traitOf(state.pet),
      expr: expr || 'normal',
    },
    extra || {},
  );

function homeExpr() {
  const p = state.pet;
  if (inSleep()) return 'sleep';
  const low = NEEDS.some(([k]) => p.needs[k] < 40);
  return low ? 'ask' : 'normal';
}

function ensurePet() {
  const p = state.pet;
  if (!p) return;
  if (!p.id) p.id = uid();
  if (!Array.isArray(p.others)) p.others = [];
  if (!Array.isArray(p.eggs)) p.eggs = [];
  if (!p.traits || typeof p.traits !== 'object') p.traits = {};
  p.others.forEach((o) => {
    if (!o.id) o.id = uid();
    if (!o.traits) o.traits = {};
    if (!o.needs) o.needs = { food: 80, water: 80, energy: 80, clean: 85, fun: 80 };
    if (o.xp == null) o.xp = 0;
    if (!o.chat) o.chat = [];
  });
}

function household() {
  const p = state.pet;
  return p ? 1 + (p.others || []).length : 0;
}

function allPets() {
  const p = state.pet;
  if (!p) return [];
  return [p].concat(p.others || []);
}

function traitBump(k) {
  if (!k || !state.pet) return;
  const t = (state.pet.traits = state.pet.traits || {});
  t[k] = (t[k] || 0) + 1;
}

function traitOf(p) {
  if (!p || petStage(p) < 1) return null;
  const t = p.traits || {};
  let best = null,
    bv = 2;
  Object.keys(TRAITS).forEach((k) => {
    if ((t[k] || 0) > bv) {
      bv = t[k];
      best = k;
    }
  });
  return best;
}

function canFindEgg() {
  const p = state.pet;
  ensurePet();
  return (
    p.eggDay !== keyOf(new Date()) && p.eggs.length < 3 && household() + p.eggs.length < HOUSE_MAX
  );
}

function addEgg(kind) {
  const p = state.pet;
  if (!p) return false;
  ensurePet();
  if (p.eggs.length >= 3 || household() + p.eggs.length >= HOUSE_MAX) return false;
  p.eggs.push({ id: uid(), kind, warmth: 0, need: EGGNEED[kind], t: Date.now() });
  return true;
}

function petWarm(pts) {
  const p = state.pet;
  if (!p || !(p.eggs || []).length) return;
  p.eggs.forEach((e) => {
    const was = e.warmth >= e.need;
    e.warmth = Math.min(e.need, e.warmth + pts);
    if (!was && e.warmth >= e.need)
      setTimeout(
        () => toast((e.kind === 'gold' ? '金蛋' : '賽博蛋') + '暖晒喇，可以孵！去屋企睇吓'),
        3600,
      );
  });
}

export {
  petStage,
  petWarm,
  petO,
  homeExpr,
  ensurePet,
  traitOf,
  tickNeeds,
  traitBump,
  need,
  allPets,
  household,
  petNew,
  canFindEgg,
  addEgg,
  inSleep,
};
