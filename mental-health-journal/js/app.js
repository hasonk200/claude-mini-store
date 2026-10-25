import { applyTheme } from './shared/preferences.mjs';
import { renderIsland, initializeIsland } from './island.mjs';
import { $ } from './shared/dom.mjs';
import { WD, parseKey, keyOf, defaultDay } from './shared/dates.mjs';
import { showDaily, renderWisdom, renderPlanFavs, initializeWisdom } from './wisdom.mjs';
import { loadForm, initializeCheckin } from './checkin.mjs';
import { renderPHQForm, renderReview, renderBadge, initializeReview } from './review.mjs';
import { renderPlan, renderRes, initializePlan } from './plan.mjs';
import { renderSettings, initializeSettings } from './settings.mjs';
import { renderEvidence, initializeEvidence } from './evidence.mjs';
import { renderLadders, initializeLadders } from './ladders.mjs';
import { showDrawTab, initializeDrawTabs } from './cards/tabs.mjs';
import { renderHabits, initializeHabits } from './habits.mjs';
import { renderPet, petGreet, initializePetPage } from './pet/page.mjs';
import { renderMemory, initializeMemory } from './games/memory.mjs';
import { renderAdventure, initializeAdventure } from './games/adventure.mjs';
import { renderHaven, stopHaven, initializeHaven } from './games/haven.mjs';
import { initializeState, journalStore } from './state.mjs';
import { fbDb, setSync, storageStatus, initializeAccount, googleLogin } from './account.mjs';
import { milesSoon } from './milestones.mjs';
import { initializeControls, toast } from './shared/controls.mjs';
import { initializeNavigation, go, PAGES } from './navigation.mjs';
import {
  stopGame,
  cancelTrip,
  trip,
  renderOutChoose,
  initializePetOutings,
} from './pet/outings.mjs';
import { roamStop, initializePetRoaming } from './pet/roaming.mjs';
import { updBuddy, initializePetBuddy } from './pet/buddy.mjs';
import { renderDraw, initializeDraw } from './cards/draw.mjs';
import { renderDeck, initializeCatalogue } from './cards/catalogue.mjs';
import { renderShelf, initializeShelf } from './cards/shelf.mjs';
import {
  renderHome,
  renderAdopt,
  renderStatus,
  renderRoom,
  initializePetHome,
} from './pet/home.mjs';
import { renderFriends } from './pet/friends.mjs';
import { renderAlbum, initializePetPhotos } from './pet/photos.mjs';
import { renderShop, initializePetShop } from './pet/shop.mjs';
import { initializeCelebration } from './shared/celebration.mjs';
import { initializeLightbox } from './shared/lightbox.mjs';
import { initializePetChat } from './pet/chat.mjs';
import { initializeSos } from './sos.mjs';
import { initializeLifecycle, resetTransientViews } from './lifecycle.mjs';

function render() {
  applyTheme();
  renderIsland();
  const now = new Date();
  $('#today-eyebrow').textContent =
    now.getMonth() + 1 + ' 月 ' + now.getDate() + ' 日・星期' + WD[now.getDay()];
  showDaily(Math.floor(parseKey(keyOf(now)).getTime() / 864e5));
  loadForm(defaultDay());
  renderPHQForm();
  renderPlan();
  renderSettings();
  renderEvidence();
  renderLadders();
  renderRes();
  renderReview();
  renderBadge();
  renderWisdom();
  renderPlanFavs();
  showDrawTab();
  renderHabits();
  if ($('#page-pet').classList.contains('on')) renderPet();
  if ($('#page-arcade').classList.contains('on')) renderMemory();
  if ($('#page-adventure').classList.contains('on')) renderAdventure();
  if ($('#page-haven').classList.contains('on')) renderHaven();
}

initializeState({
  getDatabase: () => fbDb,
  onChange: render,
  onReplace: resetTransientViews,
  onStatus: setSync,
  onStorage: storageStatus,
  onSettled: milesSoon,
});
initializeControls({ onRangeChange: renderReview });
initializeNavigation({
  routes: {
    island: renderIsland,
    arcade: renderMemory,
    adventure: renderAdventure,
    haven: renderHaven,
    review: renderReview,
    evidence: renderEvidence,
    ladder: renderLadders,
    wisdom: renderWisdom,
    draw: showDrawTab,
    pet: () => {
      renderPet();
      petGreet();
    },
    today: renderHabits,
  },
  beforeNavigate(page) {
    if (page !== 'pet') {
      stopGame();
      cancelTrip();
      roamStop();
    }
    if (page !== 'haven') stopHaven();
  },
  afterNavigate: updBuddy,
});
initializeDrawTabs({ draw: renderDraw, deck: renderDeck, shelf: renderShelf });
initializePetPage({
  views: {
    home: renderHome,
    out: () => {
      if (!trip) renderOutChoose();
    },
    friends: renderFriends,
    album: renderAlbum,
    shop: renderShop,
  },
  renderAdopt,
  renderStatus,
  stopOuting() {
    stopGame();
    cancelTrip();
  },
});
initializeCelebration({
  refreshPetHome() {
    renderRoom();
    renderStatus();
  },
});
initializeSettings({ renderAll: render });
initializeWisdom();
initializeDraw();
initializeLightbox();
initializeCatalogue();
initializeShelf();
initializePetHome();
initializePetChat();
initializePetOutings();
initializePetPhotos();
initializePetShop();
initializePetRoaming();
initializePetBuddy();
initializeHabits();
initializeCheckin();
initializeSos();
initializeEvidence();
initializeLadders();
initializeReview();
initializePlan();
initializeIsland();
initializeMemory();
initializeHaven();
initializeAdventure();
initializeLifecycle();
initializeAccount({
  onSessionChange() {
    resetTransientViews();
    render();
  },
});
render();
go(PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'island');
googleLogin.start();
if (journalStore.unreadableLocal) toast('有啲記錄暫時開唔到，可以到設定查看備份。');
milesSoon();
