import { state, persist } from '../state.mjs';
import { $ } from '../shared/dom.mjs';
import { PFURN, PACC } from '../data/pet.mjs';
import { PET } from '../art/pet.mjs';
import { petO } from './model.mjs';
import { toast } from '../shared/controls.mjs';

function renderShop() {
  const p = state.pet;
  $('#shop-coins').textContent = p.coins;
  $('#shop-furn').innerHTML = PFURN.map((f) => {
    const own = p.own[f.id];
    return (
      '<div class="shop-item"><div><b>' +
      f.n +
      '</b><span class="muted">' +
      f.d +
      '</span></div>' +
      (own
        ? '<span class="chip good">已擺好</span>'
        : '<button class="btn small' +
          (p.coins < f.p ? ' ghost' : '') +
          '" data-buy="' +
          f.id +
          '"' +
          (p.coins < f.p ? ' disabled' : '') +
          '>' +
          f.p +
          ' 金幣</button>') +
      '</div>'
    );
  }).join('');
  $('#shop-acc').innerHTML =
    '<div class="shop-item"><div><b>唔戴</b><span class="muted">原本個樣</span></div>' +
    (p.acc
      ? '<button class="btn small ghost" data-wear="">戴</button>'
      : '<span class="chip good">戴緊</span>') +
    '</div>' +
    PACC.map((a) => {
      const own = (p.accs || []).includes(a.id);
      return (
        '<div class="shop-item"><div class="row" style="gap:10px;flex-wrap:nowrap"><div style="width:52px;flex:none">' +
        PET.svg(petO('happy', { acc: a.id, stage: 2 }), 'mini') +
        '</div><div><b>' +
        a.n +
        '</b></div></div>' +
        (own
          ? p.acc === a.id
            ? '<span class="chip good">戴緊</span>'
            : '<button class="btn small ghost" data-wear="' + a.id + '">戴</button>'
          : '<button class="btn small' +
            (p.coins < a.p ? ' ghost' : '') +
            '" data-buyacc="' +
            a.id +
            '"' +
            (p.coins < a.p ? ' disabled' : '') +
            '>' +
            a.p +
            ' 金幣</button>') +
        '</div>'
      );
    }).join('');
}

function initializePetShop() {
  document.addEventListener('click', (e) => {
    const p = state.pet;
    if (!p) return;
    const b = e.target.closest('[data-buy]');
    if (b && !b.disabled) {
      const f = PFURN.find((x) => x.id === b.dataset.buy);
      if (p.coins < f.p) return;
      p.coins -= f.p;
      p.own[f.id] = 1;
      persist();
      renderShop();
      toast(f.n + '已經擺入屋企');
      return;
    }
    const a = e.target.closest('[data-buyacc]');
    if (a && !a.disabled) {
      const x = PACC.find((y) => y.id === a.dataset.buyacc);
      if (p.coins < x.p) return;
      p.coins -= x.p;
      p.accs = (p.accs || []).concat([x.id]);
      p.acc = x.id;
      persist();
      renderShop();
      toast(p.name + '戴咗' + x.n + '，好靚！');
      return;
    }
    const w = e.target.closest('[data-wear]');
    if (w) {
      p.acc = w.dataset.wear;
      persist();
      renderShop();
    }
  });
}

export { renderShop, initializePetShop };
