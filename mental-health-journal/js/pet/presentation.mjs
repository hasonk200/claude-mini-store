import { state } from '../state.mjs';
import { card } from '../data/cards.mjs';
import { ART } from '../art/cards.mjs';
import { lvOf, drawCounts } from '../cards/model.mjs';
import { defaultDay } from '../shared/dates.mjs';
import { PET } from '../art/pet.mjs';
import { petO } from './model.mjs';

const PICON = {
  feed: '<path d="M4 13h16a8 8 0 0 1 -16 0z" fill="currentColor"/><path d="M9 9q0 -3 3 -5M13 9q0 -3 3 -5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  water: '<path d="M12 3q7 8 7 12a7 7 0 0 1 -14 0q0 -4 7 -12z" fill="currentColor"/>',
  bath: '<circle cx="8" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="9" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  pat: '<path d="M12 20s-7 -4.4 -7 -9.6a4 4 0 0 1 7 -2.6a4 4 0 0 1 7 2.6c0 5.2 -7 9.6 -7 9.6z" fill="currentColor"/>',
  play: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12q8 -5 16 0M4 12q8 5 16 0" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  sleep: '<path d="M15 3a9 9 0 1 0 6 13a7 7 0 0 1 -6 -13z" fill="currentColor"/>',
  photo:
    '<rect x="3" y="7" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7l1.6 -3h4.8l1.6 3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  chat: '<path d="M4 5h16v11h-9l-5 4v-4h-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  out: '<path d="M12 21s-6 -6.5 -6 -11a6 6 0 0 1 12 0c0 4.5 -6 11 -6 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',
};

const icon = (k) =>
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + PICON[k] + '</svg>';

function frameCardSVG() {
  const ds = Object.values(state.draws || {}).sort((a, b) => b.date.localeCompare(a.date));
  if (!ds.length) return null;
  const c = card(ds[0].card);
  if (!c) return null;
  return ART.face(c, lvOf(drawCounts()[c.id] || 0))
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
}

function rainingToday() {
  const d = (state.draws || {})[defaultDay()];
  return !!(d && /雨|雪/.test(d.text));
}

function companionArt(expr = 'happy') {
  return state.pet
    ? PET.svg(petO(expr))
    : PET.svg({ sp: 'cloud', color: 'milktea', stage: 1, expr });
}

export { frameCardSVG, rainingToday, icon, companionArt };
