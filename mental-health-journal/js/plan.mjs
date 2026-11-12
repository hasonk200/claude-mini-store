import { $ } from './shared/dom.mjs';
import { state, persist } from './state.mjs';
import { toast } from './shared/controls.mjs';
import { selectText } from './review.mjs';

const PL = ['warn', 'self', 'place', 'people', 'safe', 'reason'];

const RES = [
  ['988 危機熱線', '打或者 text 988，24 小時，免費', '988'],
  [
    '康福心理健康協會（Hong Fook / Hf Care）',
    '廣東話、普通話輔導同支援，407 Huron St，近 St George 站',
    '416-493-4242',
  ],
  [
    '安省免費 CBT（Ontario Structured Psychotherapy）',
    '專做焦慮同抑鬱，可以自己轉介，唔使 OHIP 卡或家庭醫生。多倫多經 CAMH，打完揀 2',
    '416-535-8501',
  ],
  ['ConnexOntario', '24 小時，幫你搵合適嘅心理服務', '1-866-531-2600'],
  ['家庭醫生／Walk-in 診所', '有 OHIP 免費，可以轉介精神科', null],
  ['即時危險', '自己或者身邊人有即時危險', '911'],
];

function renderRes() {
  $('#res-list').innerHTML = RES.map(
    ([n, d, num], i) =>
      '<div class="res"><div><b>' +
      n +
      '</b><span class="muted">' +
      d +
      '</span></div>' +
      (num
        ? '<div class="num"><code id="num-' +
          i +
          '">' +
          num +
          '</code><button class="btn ghost small" data-copy="' +
          i +
          '">複製</button></div>'
        : '') +
      '</div>',
  ).join('');
}

function renderPlan() {
  PL.forEach((k) => ($('#pl-' + k).value = state.plan[k] || ''));
}

function initializePlan() {
  $('#res-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const el = $('#num-' + b.dataset.copy);
    const txt = el.textContent;
    try {
      navigator.clipboard.writeText(txt).then(
        () => toast('複製咗 ' + txt),
        () => {
          selectText(el);
          toast('已揀好號碼，手動複製');
        },
      );
    } catch (err) {
      selectText(el);
    }
  });
  $('#pl-save').addEventListener('click', () => {
    PL.forEach((k) => (state.plan[k] = $('#pl-' + k).value));
    persist();
    $('#pl-status').textContent = '儲存咗。';
  });
}

export { renderPlan, renderRes, initializePlan };
