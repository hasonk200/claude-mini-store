import { PET } from '../art/pet.mjs';
import { state } from '../state.mjs';
import { petStage, petO, homeExpr } from './model.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { roamExpr } from './positions.mjs';

let petBusy = false;

const BT = {};

function placeBubble(b) {
  const wrap = b.parentElement;
  if (!wrap) return;
  const tgt =
    b.id === 'nbubble'
      ? wrap.querySelector('.npc-on svg')
      : wrap.querySelector('.on-stage:not(.other) svg');
  if (!tgt) return;
  const W = wrap.getBoundingClientRect(),
    T = tgt.getBoundingClientRect();
  if (!W.width || !T.width) return;
  const sc =
    b.id === 'nbubble' ? PET.STAGES[1].s : PET.STAGES[state.pet ? petStage(state.pet) : 0].s;
  const top = T.bottom - (T.height * (10 + 180 * sc)) / 200;
  b.style.bottom = Math.max(8, W.bottom - top + 8) + 'px';
  const bw = b.offsetWidth,
    cx = T.left + T.width / 2 - W.left;
  b.style.left = Math.max(6, Math.min(W.width - bw - 6, cx - bw / 2)) + 'px';
  b.style.right = 'auto';
  b.style.transform = 'none';
  const tail = Math.max(12, Math.min(bw - 12, cx - parseFloat(b.style.left)));
  b.style.setProperty('--tail', tail + 'px');
}

function bubble(id, txt) {
  const b = document.getElementById(id);
  if (!b) return;
  b.textContent = txt;
  b.hidden = false;
  placeBubble(b);
  clearTimeout(BT[id]);
  BT[id] = setTimeout(() => {
    b.hidden = true;
  }, 5200);
}

function fx(id, chars, n = 5) {
  const box = document.getElementById(id);
  if (!box || prefersReducedMotion()) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = chars[i % chars.length];
    s.style.left = 42 + Math.random() * 16 + '%';
    s.style.bottom = 26 + Math.random() * 10 + '%';
    s.style.animationDelay = i * 120 + 'ms';
    s.style.color = ['#ff7f9e', '#ffcf6b', '#7cc6ff', '#5fe3cf'][i % 4];
    box.appendChild(s);
    setTimeout(() => s.remove(), 1800 + i * 120);
  }
}

function setPetExpr(stageId, expr, ms) {
  const petId = state.pet?.id;
  const el = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
  if (!el) return;
  el.innerHTML = PET.svg(petO(expr));
  if (ms)
    setTimeout(() => {
      if (!state.pet || state.pet.id !== petId) return;
      const e2 = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
      if (e2) e2.innerHTML = PET.svg(petO(stageId === 'room' ? roamExpr() : homeExpr()));
    }, ms);
}

export { petBusy, bubble, setPetExpr, fx };
