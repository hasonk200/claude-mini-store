import { addDays } from '../shared/dates.mjs';
import { state } from '../state.mjs';

function recentEntries(k, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(k, -i);
    if (state.checkins[d]) out.push(state.checkins[d]);
  }
  return out;
}

export { recentEntries };
