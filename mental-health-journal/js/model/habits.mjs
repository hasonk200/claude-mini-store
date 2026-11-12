import { defaultDay, addDays } from '../shared/dates.mjs';

const HB_M = Math.pow(0.5, 1 / 14);

function hbStrength(h, upto) {
  const days = Object.keys(h.log || {}).sort();
  if (!days.length) return 0;
  const end = upto || defaultDay();
  let d = days[0];
  if (addDays(end, -400) > d) d = addDays(end, -400);
  let s = 0,
    guard = 0;
  while (d <= end && guard < 500) {
    let c = 0;
    for (let i = 0; i < 7; i++) if (h.log[addDays(d, -i)]) c++;
    const v = Math.min(1, c / h.freq);
    s = s * HB_M + v * (1 - HB_M);
    d = addDays(d, 1);
    guard++;
  }
  return Math.round(s * 100);
}

export { hbStrength };
