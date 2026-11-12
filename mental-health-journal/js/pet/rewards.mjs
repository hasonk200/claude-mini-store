import { state, persist } from '../state.mjs';
import { keyOf, addDays } from '../shared/dates.mjs';
import { petStage, petWarm } from './model.mjs';
import { toast } from '../shared/controls.mjs';
import { buddyCheer } from './buddy.mjs';
import { PET } from '../art/pet.mjs';

function petAward(kind, pts, cap = 1, label) {
  const p = state.pet;
  if (!p) return;
  const k = keyOf(new Date());
  p.aw = p.aw || {};
  const list = (p.aw[k] = p.aw[k] || []);
  if (list.filter((x) => x === kind).length >= cap) return;
  list.push(kind);
  Object.keys(p.aw).forEach((d) => {
    if (d < addDays(k, -40)) delete p.aw[d];
  });
  const before = petStage(p);
  p.xp += pts;
  p.coins += pts;
  petWarm(pts);
  persist();
  toast(p.name + ' 好開心：羈絆 +' + pts + (label ? '（' + label + '）' : ''));
  if (label) buddyCheer(label);
  if (petStage(p) > before)
    setTimeout(() => toast(p.name + ' 長大咗！而家係' + PET.STAGES[petStage(p)].n), 1800);
}

export { petAward };
