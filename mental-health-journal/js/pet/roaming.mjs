import { $ } from '../shared/dom.mjs';
import { state } from '../state.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { petBusy, bubble } from './effects.mjs';
import { inSleep, allPets, petO, petStage, traitOf } from './model.mjs';
import { pick } from '../shared/helpers.mjs';
import {
  freeSpots,
  roamingPositions,
  roamExpr,
  spotsAvail,
  spotOf,
  SPOTS,
  near,
} from './positions.mjs';
import { PET } from '../art/pet.mjs';

let roamT = 0;

let roamNext = 0;

let roamDragged = false;

let drag = null;

function roamStop() {
  clearInterval(roamT);
  roamT = 0;
}

function roamArm() {
  roamStop();
  roamNext = Date.now() + 7000 + Math.random() * 5000;
  roamT = setInterval(roamTick, 1000);
}

function roamTick() {
  const room = $('#room');
  if (
    !state.pet ||
    !room ||
    !$('#page-pet').classList.contains('on') ||
    $('#pv-home').hidden ||
    document.hidden
  ) {
    return;
  }
  if (prefersReducedMotion() || drag || petBusy || inSleep() || Date.now() < roamNext) return;
  roamNext = Date.now() + 7000 + Math.random() * 5000;
  const pets = allPets();
  const mover = Math.random() < 0.7 ? pets[0] : pick(pets);
  const el = room.querySelector('.on-stage[data-pid="' + mover.id + '"]');
  if (!el) return;
  const free = freeSpots(mover.id).filter((s) => s.id !== roamingPositions[mover.id]);
  if (!free.length) return;
  const to = pick(free);
  roamingPositions[mover.id] = to.id;
  const main = mover === state.pet;
  if (main) {
    const b = $('#bubble');
    if (b) b.hidden = true;
  }
  el.classList.add('walking');
  el.style.left = to.x + '%';
  el.style.bottom = to.b + '%';
  setTimeout(() => {
    el.classList.remove('walking');
    arriveSpot(el, mover, to, main && Math.random() < 0.45);
  }, 3000);
}

function arriveSpot(el, pet, to, talk) {
  if (!el.isConnected) return;
  const main = pet === state.pet;
  el.innerHTML = main
    ? PET.svg(petO(roamExpr()))
    : PET.svg({
        sp: pet.sp,
        color: pet.color,
        stage: petStage(pet),
        acc: pet.acc,
        shiny: pet.shiny,
        trait: traitOf(pet),
        expr: to.ex,
      });
  if (talk) bubble('bubble', pick(to.l));
}

function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag;
  drag = null;
  if (!d.moved) return;
  roamDragged = true;
  setTimeout(() => {
    roamDragged = false;
  }, 350);
  d.el.classList.remove('dragging');
  const x = parseFloat(d.el.style.left),
    b = parseFloat(d.el.style.bottom);
  const pid = d.el.dataset.pid,
    pet = allPets().find((q) => q.id === pid);
  if (!pet) return;
  const prev = roamingPositions[pid];
  let best = null,
    bd = 1e9;
  spotsAvail().forEach((s) => {
    const dd = Math.hypot(s.x - x, (s.b - b) * 1.6);
    if (dd < bd) {
      bd = dd;
      best = s;
    }
  });
  if (!best) best = spotOf(pid);
  allPets().forEach((q) => {
    if (q.id === pid) return;
    const qs = SPOTS.find((s) => s.id === roamingPositions[q.id]);
    if (!qs || !(qs.id === best.id || near(qs, best))) return;
    roamingPositions[pid] = best.id;
    const fr = freeSpots(q.id);
    const back = SPOTS.find((s) => s.id === prev);
    const to =
      (back &&
        back.id !== best.id &&
        !near(back, best) &&
        (!spotsAvail().includes(back) ? null : back)) ||
      fr.find((s) => s.id !== best.id && !near(s, best)) ||
      back;
    if (!to) return;
    roamingPositions[q.id] = to.id;
    const qe = document.querySelector('#room .on-stage[data-pid="' + q.id + '"]');
    if (qe) {
      qe.classList.add('settle');
      qe.style.left = to.x + '%';
      qe.style.bottom = to.b + '%';
      setTimeout(() => {
        qe.classList.remove('settle');
        arriveSpot(qe, q, to, false);
      }, 450);
    }
  });
  roamingPositions[pid] = best.id;
  d.el.classList.add('settle');
  d.el.style.left = best.x + '%';
  d.el.style.bottom = best.b + '%';
  setTimeout(() => d.el.classList.remove('settle'), 450);
  roamNext = Date.now() + 9000;
  setTimeout(() => arriveSpot(d.el, pet, best, pet === state.pet), 300);
}

function consumeRoamDrag() {
  const dragged = roamDragged;
  roamDragged = false;
  return dragged;
}

function initializePetRoaming() {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('#room .on-stage');
    if (!el || e.button > 0) return;
    drag = {
      el,
      x0: e.clientX,
      y0: e.clientY,
      id: e.pointerId,
      moved: false,
      W: $('#room').getBoundingClientRect(),
    };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0,
      dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      try {
        drag.el.setPointerCapture(drag.id);
      } catch (err) {}
      drag.el.classList.add('dragging');
      const b = $('#bubble');
      if (b) b.hidden = true;
      const pid = drag.el.dataset.pid,
        pet = allPets().find((x) => x.id === pid);
      if (pet)
        drag.el.innerHTML =
          pet === state.pet
            ? PET.svg(petO('wow'))
            : PET.svg({
                sp: pet.sp,
                color: pet.color,
                stage: petStage(pet),
                acc: pet.acc,
                shiny: pet.shiny,
                trait: traitOf(pet),
                expr: 'wow',
              });
    }
    const W = drag.W;
    const x = Math.max(8, Math.min(92, ((e.clientX - W.left) / W.width) * 100));
    const b = Math.max(0, Math.min(62, ((W.bottom - e.clientY) / W.height) * 100 - 8));
    drag.el.style.left = x + '%';
    drag.el.style.bottom = b + '%';
    e.preventDefault();
  });
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
}

export { roamArm, consumeRoamDrag, roamStop, initializePetRoaming };
