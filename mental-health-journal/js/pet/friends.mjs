import { state } from '../state.mjs';
import { renderFamily } from './home.mjs';
import { $, esc } from '../shared/dom.mjs';
import { PET } from '../art/pet.mjs';
import { FLV, flv } from '../data/pet.mjs';

function renderFriends() {
  const p = state.pet;
  const fr = p.friends || {};
  renderFamily();
  $('#friends').innerHTML =
    '<div class="grid g2">' +
    PET.NPC.map((n) => {
      const f = fr[n.id];
      if (!f)
        return (
          '<div class="sheet friend locked"><div class="f-pic">' +
          PET.svg(Object.assign({ stage: 1, expr: 'sleep' }, n), 'mini') +
          '</div><div><b>？？？</b><span class="muted">未識。帶' +
          esc(p.name) +
          '出街，可能會遇到。</span></div></div>'
        );
      const lvIdx = FLV.reduce((a, [t], i) => (f.xp >= t ? i : a), 0),
        next = FLV[lvIdx + 1];
      const prog = next
        ? Math.round(((f.xp - FLV[lvIdx][0]) / (next[0] - FLV[lvIdx][0])) * 100)
        : 100;
      return (
        '<div class="sheet friend"><div class="f-pic">' +
        PET.svg(Object.assign({ stage: 1, expr: 'happy' }, n), 'mini') +
        '</div><div style="flex:1;min-width:0"><div class="row" style="justify-content:space-between"><b>' +
        n.name +
        '</b><span class="chip">' +
        flv(f.xp) +
        '</span></div><span class="muted">' +
        n.kind +
        '・見過 ' +
        f.met +
        ' 次・最鍾意' +
        n.likes +
        '</span><p style="font-size:14px;margin-top:4px">' +
        n.bio +
        '</p><div class="bar" style="margin-top:8px"><i class="red" style="width:' +
        prog +
        '%"></i></div></div></div>'
      );
    }).join('') +
    '</div>';
  const tr = p.treasure || {};
  const keys = Object.keys(tr);
  $('#treasure').innerHTML = keys.length
    ? '<div class="row" style="gap:8px">' +
      keys.map((k) => '<span class="chip">' + k + ' ×' + tr[k] + '</span>').join('') +
      '</div>'
    : '<p class="muted">出街散步有機會拾到寶物，會放喺呢度。</p>';
}

export { renderFriends };
