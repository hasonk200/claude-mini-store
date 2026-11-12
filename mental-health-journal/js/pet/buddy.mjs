import { $ } from '../shared/dom.mjs';
import { state } from '../state.mjs';
import { PET } from '../art/pet.mjs';
import { petO, inSleep } from './model.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { pick } from '../shared/helpers.mjs';
import { go } from '../navigation.mjs';

let BUD = 0;

function updBuddy() {
  const b = $('#buddy');
  if (!b) return;
  const show =
    !!state.pet &&
    state.settings.buddy !== false &&
    !$('#page-pet').classList.contains('on') &&
    !$('#page-adventure').classList.contains('on') &&
    !$('#page-arcade').classList.contains('on');
  b.hidden = !show;
  if (show) $('#buddy-pet').innerHTML = PET.svg(petO(inSleep() ? 'sleep' : 'normal'), 'mini');
}

function buddyCheer(label) {
  const b = $('#buddy');
  if (!b || b.hidden) return;
  $('#buddy-pet').innerHTML = PET.svg(petO('love'), 'mini');
  if (!prefersReducedMotion()) {
    b.classList.remove('jump');
    void b.offsetWidth;
    b.classList.add('jump');
  }
  const tx = $('#buddy-b');
  tx.textContent = pick(['好叻！', '做得好！', '我見到喇！', '你好犀利！', '耶！']) + ' ' + label;
  tx.hidden = false;
  clearTimeout(BUD);
  BUD = setTimeout(() => {
    tx.hidden = true;
    b.classList.remove('jump');
    if (!b.hidden)
      $('#buddy-pet').innerHTML = PET.svg(petO(inSleep() ? 'sleep' : 'normal'), 'mini');
  }, 3200);
}

function initializePetBuddy() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#buddy')) go('pet');
  });
}

export { buddyCheer, updBuddy, initializePetBuddy };
