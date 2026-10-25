import { state, persist } from './state.mjs';
import { $, esc } from './shared/dom.mjs';
import { md, keyOf } from './shared/dates.mjs';
import { uid } from './shared/helpers.mjs';
import { segGet, toast } from './shared/controls.mjs';
import { petAward } from './pet/rewards.mjs';

const typeColor = { 做到: 'good', 頂住咗唔舒服: 'warn', 學識咗: 'calm', 幫到人: 'red' };

function renderEvidence() {
  const list = state.evidence.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  $('#ev-count').textContent = '而家有 ' + list.length + ' 條';
  $('#ev-list').innerHTML = list.length
    ? list
        .map(
          (x) =>
            '<li class="item"><span class="chip ' +
            (typeColor[x.type] || '') +
            '">' +
            esc(x.type) +
            '</span><div class="txt">' +
            esc(x.text) +
            '<div class="meta">' +
            md(x.date) +
            (x.seed ? '・起步證據' : '') +
            (x.src ? '・來自' + esc(x.src) : '') +
            '</div></div><button class="x" data-del-ev="' +
            esc(x.id) +
            '" aria-label="刪除">×</button></li>',
        )
        .join('')
    : '<li class="muted">未有記錄。</li>';
}

function initializeEvidence() {
  $('#ev-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-ev]');
    if (!b) return;
    state.evidence = state.evidence.filter((x) => x.id !== b.dataset.delEv);
    persist();
    renderEvidence();
  });
  $('#ev-add').addEventListener('click', () => {
    const t = $('#ev-text').value.trim();
    if (!t) {
      $('#ev-text').focus();
      return;
    }
    state.evidence.push({
      id: uid(),
      date: keyOf(new Date()),
      type: segGet('evtype') || '做到',
      text: t,
    });
    persist();
    petAward('ev', 5, 3, '證據');
    $('#ev-text').value = '';
    renderEvidence();
    toast('加咗一條');
  });
  $('#ev-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#ev-add').click();
  });
  $('#ev-pick').addEventListener('click', () => {
    if (!state.evidence.length) return;
    const x = state.evidence[Math.floor(Math.random() * state.evidence.length)];
    const p = $('#ev-picked');
    p.innerHTML =
      esc(x.text) +
      '<div class="muted" style="margin-top:6px;font-family:var(--f-body)">' +
      esc(x.type) +
      '・' +
      md(x.date) +
      '</div>';
    p.hidden = false;
  });
}

export { renderEvidence, initializeEvidence };
