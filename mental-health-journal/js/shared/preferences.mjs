import { state } from '../state.mjs';

function applyTheme() {
  document.documentElement.classList.toggle('quiet', !!state.settings.quiet);
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

const prefersReducedMotion = () =>
  !!state.settings.quiet || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export { prefersReducedMotion, applyTheme };
