import { stopGame } from './pet/outings.mjs';
import { roamStop, roamArm } from './pet/roaming.mjs';
import { stopHaven } from './games/haven.mjs';
import { $ } from './shared/dom.mjs';
import { segGet } from './shared/controls.mjs';
import { state } from './state.mjs';

function initializeLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGame();
      roamStop();
      stopHaven();
    } else if ($('#page-pet').classList.contains('on') && segGet('pettab') === 'home' && state.pet)
      roamArm();
  });
}

export { initializeLifecycle };
