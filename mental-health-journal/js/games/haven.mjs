import { $ } from '../shared/dom.mjs';
import { companionArt } from '../pet/presentation.mjs';
import { state } from '../state.mjs';
import { petO } from '../pet/model.mjs';
import { mount3D, use3D } from '../scene3d/mount.mjs';

// The same lakeside in 3D (when 3D is on). The scene only shows the place and the companion
// sitting in it; the one-minute rest below works exactly as in the flat version.
function haven3D() {
  const scene = $('#haven-scene');
  if (!$('#page-haven').classList.contains('on')) return false;
  return mount3D('haven', scene, () => ({
    hour: new Date().getHours(),
    pet: state.pet
      ? { id: state.pet.id, ...petO('normal') }
      : { id: 'visitor', sp: 'cloud', color: 'milktea', stage: 1, expr: 'normal' },
  }));
}

function renderHaven() {
  const scene = $('#haven-scene'),
    three = use3D();
  // With 3D on, the painted picture is not fetched at all; the box keeps its shape while
  // the scene loads, and says what it shows to anyone who cannot see it.
  if (!three)
    scene.innerHTML =
      '<img class="haven-art" src="assets/lakeside.webp" width="1536" height="1024" alt="金色陽光下的湖畔碼頭、木椅與遠山">' +
      '<div class="haven-pet">' +
      companionArt('normal') +
      '</div>';
  else for (const flat of scene.querySelectorAll('.haven-art, .haven-pet')) flat.remove();
  scene.classList.toggle('awaits-3d', three);
  if (three) {
    scene.setAttribute('role', 'img');
    scene.setAttribute('aria-label', '湖畔碼頭、木椅、提燈與遠山，伙伴靜靜坐喺度');
  } else {
    scene.removeAttribute('role');
    scene.removeAttribute('aria-label');
  }
  haven3D();
  $('#haven-copy').textContent = '坐低一陣，望吓湖水同遠山。';
}

let havenTimer = null;

let havenEnd = 0;

function stopHaven() {
  clearInterval(havenTimer);
  havenTimer = null;
  const b = $('#haven-rest');
  if (b) b.textContent = '陪我坐一分鐘';
}

function startHaven() {
  if (havenTimer) {
    stopHaven();
    $('#haven-copy').textContent = '下次再嚟坐吓。';
    return;
  }
  havenEnd = Date.now() + 60000;
  $('#haven-rest').textContent = '隨時結束';
  const tick = () => {
    const left = Math.max(0, Math.ceil((havenEnd - Date.now()) / 1000));
    $('#haven-copy').textContent =
      left > 0
        ? '仲有 ' + left + ' 秒。望吓遠處，照平時咁呼吸就得。'
        : '一分鐘過咗。想繼續坐吓，定返小島行吓？';
    if (left === 0) stopHaven();
  };
  tick();
  havenTimer = setInterval(tick, 1000);
}

function initializeHaven() {
  $('#haven-rest').addEventListener('click', startHaven);
}

export { stopHaven, renderHaven, initializeHaven };
