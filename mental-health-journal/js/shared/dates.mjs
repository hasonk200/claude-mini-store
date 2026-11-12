const pad = (n) => String(n).padStart(2, '0');

const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};

const WD = ['日', '一', '二', '三', '四', '五', '六'];

const md = (k) => {
  if (!k) return '';
  const d = parseKey(k);
  return d.getMonth() + 1 + '/' + d.getDate();
};

function mins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function sleepHours(a, b) {
  const x = mins(a),
    y = mins(b);
  if (x == null || y == null) return null;
  let d = y - x;
  if (d <= 0) d += 1440;
  return Math.round(d / 6) / 10;
}

function circDiff(a, b) {
  const x = mins(a),
    y = mins(b);
  if (x == null || y == null) return 0;
  const d = Math.abs(x - y);
  return Math.min(d, 1440 - d) / 60;
}

function defaultDay() {
  const n = new Date();
  if (n.getHours() < 12) n.setDate(n.getDate() - 1);
  return keyOf(n);
}

export { keyOf, md, defaultDay, WD, parseKey, addDays, mins, sleepHours, circDiff, pad };
