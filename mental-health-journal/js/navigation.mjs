import { $$ } from './shared/dom.mjs';

const PAGES = [
  'island',
  'arcade',
  'adventure',
  'haven',
  'today',
  'pet',
  'draw',
  'sos',
  'evidence',
  'ladder',
  'wisdom',
  'review',
  'plan',
  'about',
];
let routes, beforeNavigate, afterNavigate;
function go(page) {
  if (!PAGES.includes(page)) return;
  beforeNavigate(page);
  $$('.page').forEach((p) => p.classList.toggle('on', p.id === 'page-' + page));
  $$('.tab').forEach((t) =>
    t.setAttribute(
      'aria-current',
      t.dataset.page === page ||
        (t.dataset.page === 'island' && page === 'haven') ||
        (t.dataset.page === 'arcade' && page === 'adventure')
        ? 'page'
        : 'false',
    ),
  );
  routes[page]?.();
  afterNavigate();
  try {
    history.replaceState(null, '', '#' + page);
  } catch (e) {}
  window.scrollTo(0, 0);
}
function initializeNavigation(options) {
  ({ routes, beforeNavigate, afterNavigate } = options);
  $$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.page)));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (a) {
      e.preventDefault();
      go(a.dataset.goto);
    }
  });
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
}

export { go, PAGES, initializeNavigation };
