import { state, persist } from '../state.mjs';
import { ensurePet, tickNeeds } from './model.mjs';
import { PERPET } from '../data/pet.mjs';
import { renderPet } from './page.mjs';
import { toast } from '../shared/controls.mjs';
import { bubble, fx } from './effects.mjs';
import { pick } from '../shared/helpers.mjs';

function switchPet(id) {
  const p = state.pet;
  ensurePet();
  const i = p.others.findIndex((o) => o.id === id);
  if (i < 0) return;
  tickNeeds();
  const o = p.others[i],
    cur = {};
  PERPET.forEach((k) => {
    cur[k] = p[k];
  });
  PERPET.forEach((k) => {
    p[k] = o[k];
  });
  if (!p.traits) p.traits = {};
  p.others.splice(i, 1, cur);
  persist();
  renderPet();
  toast('而家照顧緊 ' + p.name);
  setTimeout(() => {
    bubble('bubble', pick(['到我喇！主人！', '你揀咗我！好開心！', '我喺度～']));
    fx('fx', ['♥', '✦'], 4);
  }, 300);
}

export { switchPet };
