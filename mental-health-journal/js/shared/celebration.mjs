import { $ } from './dom.mjs';
import { state } from '../state.mjs';
import { PET } from '../art/pet.mjs';
import { petO } from '../pet/model.mjs';
import { segGet } from './controls.mjs';

const CQ = [];

function celebrate(o) {
  CQ.push(o);
  showCele();
}

function showCele() {
  const box = $('#cele');
  if (!box || !box.hidden || !CQ.length) return;
  const o = CQ.shift();
  $('#cele-eb').textContent = o.eyebrow || '里程碑';
  $('#cele-t').textContent = o.title;
  $('#cele-s').textContent = o.sub || '';
  $('#cele-r').textContent = o.rew || '';
  $('#cele-r').hidden = !o.rew;
  $('#cele-art').innerHTML =
    o.art ||
    (state.pet
      ? PET.svg(petO('love'))
      : '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="var(--good-soft)"/><path d="M50 22l8 17 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z" fill="var(--good)"/></svg>');
  box.hidden = false;
  $('#cele-ok').focus();
}

function initializeCelebration({ refreshPetHome }) {
  document.addEventListener('click', (e) => {
    if (e.target.id === 'cele-ok' || e.target.id === 'cele') {
      $('#cele').hidden = true;
      setTimeout(showCele, 250);
      if (
        !$('#page-pet').hidden &&
        $('#page-pet').classList.contains('on') &&
        segGet('pettab') === 'home' &&
        state.pet
      ) {
        refreshPetHome();
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#cele') && !$('#cele').hidden) {
      $('#cele').hidden = true;
      setTimeout(showCele, 250);
    }
  });
}

export { celebrate, CQ, showCele, initializeCelebration };
