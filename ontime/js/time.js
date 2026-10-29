// 時間工具：所有時間戳記都是毫秒數字，日期鍵是當地日期 YYYY-MM-DD。
export const MIN = 60000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const pad = (n) => String(n).padStart(2, '0');

export function dateKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export const dayStart = (key) => fromKey(key).getTime();
export const dayEnd = (key) => dayStart(addDays(key, 1));

const WD = ['日', '一', '二', '三', '四', '五', '六'];
export const wdShort = (key) => WD[fromKey(key).getDay()];
export const wdOfKey = (key) => '週' + wdShort(key);
export const wdOf = (t) => '週' + WD[new Date(t).getDay()];

export function fmtTime(t) {
  if (t == null) return '—';
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtMD(key) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const fmtDayMD = (key) => `${wdOfKey(key)} ${fmtMD(key)}`;

export function durParts(ms) {
  const total = Math.max(0, Math.round(ms / MIN));
  return { h: Math.floor(total / 60), m: total % 60 };
}

export function fmtDur(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  const { h, m } = durParts(ms);
  return `${h}h ${pad(m)}m`;
}

export function fmtDurLong(ms) {
  if (ms == null) return '—';
  const { h, m } = durParts(ms);
  if (h === 0) return `${m} 分鐘`;
  return `${h} 小時 ${pad(m)} 分`;
}

export const toDateInput = (t) => dateKey(t);
export const toTimeInput = (t) => fmtTime(t);

// 把日期欄和時間欄組合成當地時間。夏令時間跳過的時間交給 Date 自動調整。
export function fromInputs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}

export function at(key, hhmm) {
  return fromInputs(key, hhmm);
}

// 只填了結束「時：分」：結束早於開始就代表隔天。
// 用「下一個日曆日的同一時間」計，不是固定加 24 小時——夏令時間轉換那晚兩者會差一小時。
// allowSame = true 時，結束等於開始不算隔天（例如用餐只記開始）。
export function endOnOrAfter(dateStr, start, endHHMM, { allowSame = false } = {}) {
  if (start == null || !endHHMM) return null;
  const end = fromInputs(dateStr, endHHMM);
  if (end > start || (allowSame && end === start)) return end;
  return fromInputs(addDays(dateStr, 1), endHHMM);
}

export function weekStartKey(key) {
  const d = fromKey(key);
  const diff = (d.getDay() + 6) % 7; // 週一開始
  d.setDate(d.getDate() - diff);
  return dateKey(d);
}

export function monthStartKey(key) {
  const d = fromKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function monthEndKey(key) {
  const d = fromKey(key);
  return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

// 兩個日期鍵相差幾日（b - a）。
export function daysBetween(a, b) {
  return Math.round((dayStart(b) - dayStart(a)) / DAY);
}

// 把 1830、930、18、18:5、１８：３０ 都整理成 HH:MM；看不懂回傳 null。
export function normTime(raw) {
  let s = String(raw || '').trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[：.．]/g, ':').replace(/\s+/g, '');
  if (!s) return '';
  let h; let m;
  let mt = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (mt) { h = +mt[1]; m = +mt[2]; }
  else if ((mt = s.match(/^\d{3,4}$/))) { h = +s.slice(0, -2); m = +s.slice(-2); }
  else if ((mt = s.match(/^\d{1,2}$/))) { h = +s; m = 0; }
  else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
