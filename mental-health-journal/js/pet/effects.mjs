import { PET } from '../art/pet.mjs';
import { state } from '../state.mjs';
import { petStage, petO, homeExpr } from './model.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { roamExpr } from './positions.mjs';
import { scene3D, onOverlaySync, OUTING_SCENES } from '../scene3d/mount.mjs';

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
  let top = T.bottom - (T.height * (10 + 180 * sc)) / 200;
  // In 3D the companion's button is fitted to the model itself, so its top edge is the top
  // of the head (the hidden 2D art inside it is only a rough guide).
  const fitted = wrap.classList.contains('is-3d') && tgt.closest('.on-stage');
  if (fitted) top = Math.min(top, fitted.getBoundingClientRect().top - 6);
  const bw = b.offsetWidth,
    bh = b.offsetHeight,
    cx = T.left + T.width / 2 - W.left;
  let bottom = Math.max(8, W.bottom - top + 8),
    left = Math.max(6, Math.min(W.width - bw - 6, cx - bw / 2));
  if (wrap.classList.contains('is-3d') && bottom + bh > W.height - 4) {
    // No room above the head: sit beside it instead of over the face.
    const half = (fitted ? fitted.getBoundingClientRect().width : T.width * 0.6) / 2 + 10,
      onRight = cx + half + bw + 6 <= W.width;
    bottom = Math.max(8, W.height - bh - 6);
    left = onRight ? cx + half : Math.max(6, cx - half - bw);
  }
  b.style.bottom = bottom + 'px';
  b.style.left = left + 'px';
  b.style.right = 'auto';
  b.style.transform = 'none';
  const tail = Math.max(12, Math.min(bw - 12, cx - left));
  b.style.setProperty('--tail', tail + 'px');
}

// A 3D scene moves the buttons to follow its pets (and may only arrive after a bubble has
// been shown), so bubbles on show are put back over their speaker each time it does.
onOverlaySync((container) => {
  for (const b of container.querySelectorAll('.bubble:not([hidden])')) placeBubble(b);
});

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

// The 3D scene (if one is live) that mirrors this 2D stage.
const stage3D = (stageId) =>
  stageId === 'room'
    ? scene3D('home')
    : OUTING_SCENES.map((place) => scene3D(place)).find(Boolean) || null;

function setPetExpr(stageId, expr, ms) {
  const petId = state.pet?.id;
  const el = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
  if (!el) return;
  el.innerHTML = PET.svg(petO(expr));
  stage3D(stageId)?.setExpr(petId, expr);
  if (ms)
    setTimeout(() => {
      if (!state.pet || state.pet.id !== petId) return;
      const e2 = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
      if (!e2) return;
      const settled = stageId === 'room' ? roamExpr() : homeExpr();
      e2.innerHTML = PET.svg(petO(settled));
      stage3D(stageId)?.setExpr(petId, settled);
    }, ms);
}

export { petBusy, bubble, setPetExpr, fx };
