import { $, esc } from '../shared/dom.mjs';
import { state } from '../state.mjs';
import { drawCards, lvOf, drawCounts } from './model.mjs';
import { card } from '../data/cards.mjs';
import { md, parseKey } from '../shared/dates.mjs';
import { readingHTML, zoomCard } from './markup.mjs';
import { segSet } from '../shared/controls.mjs';
import { showDrawTab } from './tabs.mjs';

let shelfSel = null;

function renderShelf() {
  const q = $('#shelf-q').value.trim().toLowerCase();
  const all = Object.values(state.draws || {})
    .filter(
      (d) =>
        !q ||
        d.text.toLowerCase().includes(q) ||
        drawCards(d).some((x) => card(x.card).name.includes(q)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!all.length) {
    $('#shelf').innerHTML =
      '<p class="muted" style="padding:30px 0;text-align:center">' +
      (q ? '搵唔到「' + esc(q) + '」。' : '書櫃仲係空嘅。今晚收工抽第一張，第一本書就會放上嚟。') +
      '</p>';
    $('#shelf-detail').hidden = true;
    return;
  }
  const months = {};
  all.forEach((d) => {
    (months[d.date.slice(0, 7)] = months[d.date.slice(0, 7)] || []).push(d);
  });
  $('#shelf').innerHTML = Object.keys(months)
    .sort()
    .reverse()
    .map((m) => {
      const [y, mo] = m.split('-');
      return (
        '<div class="shelf-m"><h3>' +
        y +
        ' 年 ' +
        +mo +
        ' 月・' +
        months[m].length +
        ' 本</h3><div class="shelf">' +
        months[m]
          .map((d) => {
            const c = card(d.card);
            const h = 110 + Math.min(60, Math.round(d.text.length / 5));
            return (
              '<button class="spine t-' +
              c.tone +
              (shelfSel === d.date ? ' on' : '') +
              '" style="height:' +
              h +
              'px" data-openday="' +
              d.date +
              '" aria-label="' +
              md(d.date) +
              ' ' +
              c.name +
              '"><b>' +
              parseKey(d.date).getDate() +
              '</b><span>' +
              (d.cards ? '三張牌陣' : c.name) +
              '</span></button>'
            );
          })
          .join('') +
        '</div></div>'
      );
    })
    .join('');
  renderShelfDetail();
}

function renderShelfDetail() {
  const box = $('#shelf-detail');
  const d = shelfSel && (state.draws || {})[shelfSel];
  if (!d) {
    box.hidden = true;
    return;
  }
  const c = card(d.card);
  box.innerHTML = d.cards
    ? readingHTML(d, true)
    : '<div class="row" style="align-items:flex-start;gap:18px"><div class="mini-card" style="width:150px">' +
      zoomCard(c, d.rev, lvOf(drawCounts()[c.id] || 0)) +
      '</div><div style="flex:1;min-width:220px">' +
      readingHTML(d, true) +
      '</div></div>';
  box.hidden = false;
}

function initializeShelf() {
  $('#shelf-q').addEventListener('input', renderShelf);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-openday]');
    if (!b) return;
    shelfSel = b.dataset.openday;
    segSet('drawtab', 'shelf');
    showDrawTab();
    renderShelf();
    $('#shelf-detail').scrollIntoView({ block: 'nearest' });
  });
}

export { renderShelf, initializeShelf };
