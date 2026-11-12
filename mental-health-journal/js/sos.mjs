import { $$, $, esc } from './shared/dom.mjs';
import { pad, keyOf } from './shared/dates.mjs';
import { state, persist } from './state.mjs';
import { uid } from './shared/helpers.mjs';
import { toast } from './shared/controls.mjs';
import { petAward } from './pet/rewards.mjs';

function sosGo(n) {
  $$('#sos-steps button').forEach((b) => b.classList.toggle('on', b.dataset.s === String(n)));
  $$('.sos-pane').forEach((p) => p.classList.toggle('on', p.dataset.s === String(n)));
}

let breathTimer = null;

function stopBreath(msg) {
  clearTimeout(breathTimer);
  breathTimer = null;
  const o = $('#orb');
  o.style.transitionDuration = '1.2s';
  o.style.transform = 'scale(.62)';
  $('#orb-txt').textContent = msg || '準備';
}

function thoughtReply() {
  const v = $('#thought').value.trim();
  $('#thought-reply').innerHTML = v
    ? '讀多次：「我留意到我有個念頭話『' +
      esc(v) +
      '』。」<br>佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。'
    : '寫低之後，再讀一次。佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。';
}

const tTotal = 15 * 60;

let tLeft = tTotal;

let tEnd = null;

let tInt = null;

function tDraw() {
  const s = Math.max(0, Math.round(tLeft));
  $('#timer').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}

function tTick() {
  tLeft = (tEnd - Date.now()) / 1000;
  if (tLeft <= 0) {
    tLeft = 0;
    clearInterval(tInt);
    tInt = null;
    $('#t-after').hidden = false;
  }
  tDraw();
}

function initializeSos() {
  $$('#sos-steps button').forEach((b) => b.addEventListener('click', () => sosGo(b.dataset.s)));
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => sosGo(b.dataset.go)));
  $('#breath-start').addEventListener('click', () => {
    stopBreath();
    const phases = [
      ['吸', 2000, 0.86],
      ['再吸少少', 1000, 1],
      ['慢慢呼', 6000, 0.62],
    ];
    let round = 0,
      i = 0;
    const total = 6;
    const o = $('#orb');
    function step() {
      if (i === 0) {
        round++;
        if (round > total) {
          stopBreath('做完喇');
          $('#breath-count').textContent = '做完 6 輪，可以去下一步。';
          return;
        }
        $('#breath-count').textContent = '第 ' + round + ' / ' + total + ' 輪';
      }
      const [txt, dur, sc] = phases[i];
      $('#orb-txt').textContent = txt;
      o.style.transitionDuration = dur + 'ms';
      o.style.transform = 'scale(' + sc + ')';
      i = (i + 1) % phases.length;
      breathTimer = setTimeout(step, dur);
    }
    step();
  });
  $('#breath-stop').addEventListener('click', () => {
    stopBreath();
    $('#breath-count').textContent = '每輪 9 秒，做 6 輪';
  });
  $$('#thought-chips button').forEach((b) =>
    b.addEventListener('click', () => {
      $('#thought').value = b.dataset.t;
      thoughtReply();
    }),
  );
  $('#thought').addEventListener('input', thoughtReply);
  $('#t-start').addEventListener('click', () => {
    if (tInt) return;
    if (tLeft <= 0) tLeft = tTotal;
    tEnd = Date.now() + tLeft * 1000;
    tInt = setInterval(tTick, 250);
    $('#t-after').hidden = true;
  });
  $('#t-pause').addEventListener('click', () => {
    if (!tInt) return;
    clearInterval(tInt);
    tInt = null;
    tLeft = (tEnd - Date.now()) / 1000;
    tDraw();
  });
  $('#t-reset').addEventListener('click', () => {
    clearInterval(tInt);
    tInt = null;
    tLeft = tTotal;
    tDraw();
    $('#t-after').hidden = true;
  });
  $('#sos-log').addEventListener('click', () => {
    const used = Math.round((tTotal - Math.max(0, tLeft)) / 60);
    const step = $('#tiny-step').value.trim();
    state.evidence.push({
      id: uid(),
      date: keyOf(new Date()),
      type: '頂住咗唔舒服',
      text:
        '卡住時冇即刻放棄' +
        (used > 0 ? '，自己試咗 ' + used + ' 分鐘' : '') +
        (step ? '：' + step : ''),
      src: '急救',
    });
    persist();
    toast('已經記入證據簿');
    petAward('sos', 10, 1, '卡住急救');
  });
}

export { initializeSos };
