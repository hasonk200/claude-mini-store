import { $, $$ } from './dom.mjs';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2000);
}

function segGet(name) {
  const b = document.querySelector('.seg[data-name="' + name + '"] button.on');
  return b ? b.dataset.v : null;
}

function segSet(name, v) {
  $$('.seg[data-name="' + name + '"] button').forEach((b) =>
    b.classList.toggle('on', v != null && b.dataset.v === String(v)),
  );
}

function initializeControls({ onRangeChange }) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-name] button');
    if (!b) return;
    const seg = b.parentElement;
    const wasOn = b.classList.contains('on');
    const sticky =
      ['evtype', 'range', 'theme', 'wth', 'drawtab', 'pettab', 'drawmode', 'buddy'].includes(
        seg.dataset.name,
      ) || /^phq/.test(seg.dataset.name);
    seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    if (!wasOn || sticky) b.classList.add('on');
    if (seg.dataset.name === 'range') onRangeChange();
  });
}

export { toast, segGet, segSet, initializeControls };
