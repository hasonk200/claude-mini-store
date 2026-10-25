import { stopGame, cancelTrip } from './pet/outings.mjs';
import { roamStop, roamArm } from './pet/roaming.mjs';
import { stopHaven } from './games/haven.mjs';
import { $ } from './shared/dom.mjs';
import { segGet } from './shared/controls.mjs';
import { state } from './state.mjs';
import { resetDrawSession } from './cards/draw.mjs';
import { clearMemorySession } from './games/memory.mjs';
import { closePhotoEditor } from './pet/photos.mjs';
import { closeLB } from './shared/lightbox.mjs';

function resetTransientViews() {
  stopGame();
  cancelTrip();
  roamStop();
  stopHaven();
  clearMemorySession();
  resetDrawSession();
  closePhotoEditor();
  closeLB();
}

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

export { initializeLifecycle, resetTransientViews };
