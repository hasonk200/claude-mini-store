import { segGet } from '../shared/controls.mjs';
import { $ } from '../shared/dom.mjs';

let drawViews;

function showDrawTab() {
  const v = segGet('drawtab') || 'draw';
  $('#dv-draw').hidden = v !== 'draw';
  $('#dv-deck').hidden = v !== 'deck';
  $('#dv-shelf').hidden = v !== 'shelf';
  drawViews[v]();
}

function initializeDrawTabs(views) {
  drawViews = views;
  document.addEventListener('click', (e) => {
    if (e.target.closest('.seg[data-name="drawtab"] button')) setTimeout(showDrawTab, 0);
  });
}

export { showDrawTab, initializeDrawTabs };
