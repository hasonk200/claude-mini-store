import { $ } from '../shared/dom.mjs';
import { companionArt } from '../pet/presentation.mjs';

function renderHaven() {
  $('#haven-scene').innerHTML =
    '<img class="haven-art" src="assets/lakeside.webp" width="1536" height="1024" alt="金色陽光下的湖畔碼頭、木椅與遠山">' +
    '<div class="haven-pet">' +
    companionArt('normal') +
    '</div>';
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
