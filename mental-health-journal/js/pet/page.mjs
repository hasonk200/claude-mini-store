import { segGet } from '../shared/controls.mjs';
import { roamStop } from './roaming.mjs';
import { $ } from '../shared/dom.mjs';
import { closePhotoEditor } from './photos.mjs';
import { state, persist } from '../state.mjs';
import { ensurePet, tickNeeds, petStage, traitOf, inSleep } from './model.mjs';
import { updBuddy } from './buddy.mjs';
import { PET } from '../art/pet.mjs';
import { keyOf, parseKey, defaultDay } from '../shared/dates.mjs';
import { pick } from '../shared/helpers.mjs';
import { PLN, TLN } from '../data/pet.mjs';
import { bubble, fx } from './effects.mjs';

let petViews, adoptionView, statusView, stopOuting;

function showPetTab() {
  const v = segGet('pettab') || 'home';
  if (v !== 'out') {
    stopOuting();
  }
  if (v !== 'home') roamStop();
  ['home', 'out', 'friends', 'album', 'shop'].forEach((k) => {
    $('#pv-' + k).hidden = v !== k;
  });
  closePhotoEditor();
  petViews[v]();
}

function renderPet() {
  const p = state.pet;
  $('#pet-adopt').hidden = !!p;
  $('#pet-main').hidden = !p;
  if (p) ensurePet();
  updBuddy();
  if (!p) {
    adoptionView();
    return;
  }
  tickNeeds();
  const st = petStage(p);
  $('#pet-title').textContent = p.name + '嘅屋企';
  $('#pet-eyebrow').textContent =
    PET.SPECIES[p.sp] +
    '・' +
    PET.STAGES[st].n +
    '・' +
    (PET.tod(new Date().getHours()) === 'night' ? '夜晚' : '日頭');
  showPetTab();
}

function petGreet() {
  const p = state.pet;
  if (!p) return;
  const k = keyOf(new Date());
  const gap = p.lastVisit ? Math.round((parseKey(k) - parseKey(p.lastVisit)) / 864e5) : 0;
  p.lastVisit = k;
  persist();
  const h = new Date().getHours();
  const ck = state.checkins[defaultDay()];
  let line;
  const tr = traitOf(p);
  if (inSleep()) line = pick(PLN.sleep);
  else if (gap >= 2) line = pick(PLN.back);
  else if (ck && (ck.contact === '2' || ck.contact === '3')) line = pick(PLN.talk);
  else if (ck && ck.move === '2') line = pick(PLN.move);
  else if (h >= 5 && h < 11) line = pick(PLN.morning);
  else if (h >= 18 || h < 2) line = pick(PLN.night);
  else line = pick(PLN.greet);
  if (!inSleep() && gap < 2 && tr && Math.random() < 0.45) line = pick(TLN[tr]);
  setTimeout(() => {
    bubble('bubble', line);
    fx('fx', ['♥', '♥'], 3);
  }, 400);
}

function initializePetPage(options) {
  ({ views: petViews, renderAdopt: adoptionView, renderStatus: statusView, stopOuting } = options);
  document.addEventListener('click', (e) => {
    if (e.target.closest('.seg[data-name="pettab"] button')) setTimeout(showPetTab, 0);
  });
  setInterval(() => {
    if (
      state.pet &&
      $('#page-pet').classList.contains('on') &&
      segGet('pettab') === 'home' &&
      !$('#pv-home').hidden
    ) {
      tickNeeds();
      statusView();
    }
  }, 60000);
}

export { showPetTab, renderPet, petGreet, initializePetPage };
