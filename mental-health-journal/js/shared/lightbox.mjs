import { card } from '../data/cards.mjs';
import { lvOf, drawCounts } from '../cards/model.mjs';
import { $ } from './dom.mjs';
import { cardFace } from '../cards/markup.mjs';

function openLB(id, rev) {
  const c = card(id);
  if (!c) return;
  const lv = lvOf(drawCounts()[c.id] || 0);
  $('#lb-card').innerHTML = cardFace(c, rev, lv);
  $('#lb-cap').textContent = c.n + '　' + c.name + (rev ? '・提醒位' : '');
  $('#lb').hidden = false;
  $('#lb-close').focus();
}

function closeLB() {
  $('#lb').hidden = true;
}

function initializeLightbox() {
  document.addEventListener('click', (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z && !z.closest('.fan')) {
      if (z.classList.contains('flip') && !z.classList.contains('flipped')) return;
      const [id, r] = z.dataset.zoom.split('|');
      openLB(id, r === '1');
      return;
    }
    if (e.target.id === 'lb' || e.target.id === 'lb-close') closeLB();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#lb').hidden) closeLB();
  });
}

export { closeLB, initializeLightbox };
