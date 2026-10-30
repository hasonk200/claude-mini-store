// 幾個頁面共用的片段：時間軸色條、工作日標籤。
import { esc, icon, KIND } from '../ui.js';
import { dateKey, fmtTime, wdOf, wdOfKey, fmtDayMD, fmtMD, HOUR, addDays, dayStart } from '../time.js';
import { intervalsAround } from '../logic.js';

const LANES = [
  ['work', '工作', ['work', 'deliv']],
  ['commute', '通勤', ['commute']],
  ['meal', '用餐', ['meal']],
  ['sleep', '睡眠', ['sleep']]
];

export function pct(t, a, b) {
  return `${(((t - a) / (b - a)) * 100).toFixed(2)}%`;
}

function ticksFor(a, b, dense = true) {
  const out = [];
  const span = b - a;
  const step = span > 30 * HOUR || !dense ? 6 : 4;
  const d = new Date(a);
  d.setMinutes(0, 0, 0);
  if (d.getTime() < a) d.setHours(d.getHours() + 1);
  while (d.getTime() <= b) {
    const h = d.getHours();
    if (h % step === 0) {
      const t = d.getTime();
      out.push({ t, mid: h === 0, label: h === 0 ? `${wdOf(t)} 00:00` : fmtTime(t) });
    }
    d.setHours(d.getHours() + 1);
  }
  return out;
}

// 估算文字寬度，挑出不會互相重疊的刻度標籤；午夜標籤優先保留。
function textWidth(str) {
  let w = 0;
  for (const ch of str) w += /[\u0000-\u00ff]/.test(ch) ? 6.6 : 11.5;
  return w;
}

export function tickLabels(ticks, a, b, trackPx) {
  const items = ticks.map((t) => {
    const f = (t.t - a) / (b - a);
    const w = textWidth(t.label);
    const x = f * trackPx;
    let left = x - w / 2;
    let anchor = '-50%';
    if (left < 0) { left = Math.max(0, x); anchor = '0'; if (x + w > trackPx) { left = trackPx - w; } }
    if (left + w > trackPx) { left = x - w; anchor = '-100%'; }
    return { t, f, left, right: left + w, anchor };
  });
  const order = [...items].sort((p, q) => (q.t.mid ? 1 : 0) - (p.t.mid ? 1 : 0));
  const kept = [];
  for (const it of order) {
    if (kept.some((k) => it.left < k.right + 8 && it.right + 8 > k.left)) continue;
    kept.push(it);
  }
  return kept.sort((p, q) => p.f - q.f).map((it) => `<span class="tick-label${it.t.mid ? ' is-mid' : ''}" style="left:${(it.f * 100).toFixed(2)}%;transform:translateX(${it.anchor})">${esc(it.t.label)}</span>`).join('');
}

function segHTML(x, a, b) {
  const s = Math.max(x.a, a);
  const e = Math.min(x.b, b);
  const w = ((e - s) / (b - a)) * 100;
  const label = w > 9 && x.label ? `<span>${esc(x.label)}</span>` : '';
  return `<div class="seg-bar k-${x.kind}${x.plan ? ' is-plan' : ''}" style="left:${pct(s, a, b)};width:${w.toFixed(2)}%" title="${esc(KIND[x.kind]?.label || '')} ${fmtTime(x.a)}–${fmtTime(x.b)}${x.plan ? '（計畫）' : ''}">${label}</div>`;
}

// 單一色條（手機）或分行色條（桌面）。
export function ribbon(data, a, b, now, { lanes = false } = {}) {
  const items = intervalsAround(data, a, b, now);
  const ticks = ticksFor(a, b, lanes);
  const showNow = now > a && now < b;
  const nowMark = showNow ? `<div class="now-line" style="left:${pct(now, a, b)}"><span class="now-pill">現在 ${fmtTime(now)}</span></div>` : '';
  const grid = ticks.map((t) => `<div class="tick-line${t.mid ? ' is-mid' : ''}" style="left:${pct(t.t, a, b)}"></div>`).join('');
  const labels = tickLabels(ticks, a, b, 2000);
  if (!lanes) {
    const order = { sleep: 0, work: 1, deliv: 1, commute: 2, meal: 3 };
    const segs = items.sort((x, y) => (order[x.kind] ?? 9) - (order[y.kind] ?? 9)).map((x) => segHTML({ ...x, label: '' }, a, b)).join('');
    return `<div class="ribbon"><div class="ribbon-track">${grid}${segs}</div>${nowMark}<div class="ribbon-labels">${labels}</div></div>`;
  }
  const rows = LANES.map(([key, label, kinds]) => {
    const segs = items.filter((x) => kinds.includes(x.kind)).map((x) => segHTML(x, a, b)).join('');
    return `<div class="lane"><span class="lane-name">${label}</span><div class="lane-track">${grid}${segs}</div></div>`;
  }).join('');
  const empty = items.length ? '' : '<div class="lanes-empty"><span>這段時間還沒有紀錄</span></div>';
  return `<div class="lanes${items.length ? '' : ' is-empty'}"><div class="lane-head"><span></span><div class="lane-labels">${labels}</div></div>${rows}<div class="lanes-now">${nowMark}${empty}</div></div>`;
}

export function legend(withPlan = true, data = null) {
  const jobs = data && data.jobs.length ? data.jobs.map((j) => [j.color === 'deliv' ? 'deliv' : 'work', j.name]) : [['work', '工作']];
  const items = [...jobs, ['commute', '通勤'], ['meal', '用餐'], ['sleep', '睡眠']];
  return `<div class="legend">${items.map(([k, l]) => `<span><i class="sw k-${k}"></i>${esc(l)}</span>`).join('')}${withPlan ? '<span><i class="sw is-plan-sw"></i>計畫</span><span><i class="sw is-unknown-sw"></i>未記錄</span>' : ''}</div>`;
}

export function wdLabel(wd) {
  return `${fmtDayMD(wd)}`;
}

// 同步狀態的摘要：首頁入口、側邊欄、同步面板共用。sy = syncState()，st = store.status()。
export function syncSummary(sy = {}, st = {}) {
  const time = (t) => (t ? fmtTime(t) : '');
  if (st.saveError) {
    return { tone: 'warn', short: '未能儲存', line: '未能儲存', detail: `${st.saveError}。請盡快到「我的」匯出備份。`, actions: ['settings'] };
  }
  switch (sy.status) {
    case 'cloud': return { tone: 'ok', short: '已同步', line: '已同步到雲端', detail: `${sy.user?.email ? `${sy.user.email} · ` : ''}${sy.lastSync ? `最後同步 ${time(sy.lastSync)}` : ''}`, actions: ['settings'] };
    case 'loading': return { tone: 'off', short: '同步中', line: '正在同步…', detail: '已存在這部裝置，正在上傳到雲端。', actions: [] };
    case 'signin': return { tone: 'off', short: '待同步', line: '已存在這部裝置，待同步', detail: '雲端同步還沒登入。紀錄已安全存在這部裝置。', actions: ['signin'] };
    case 'offline': return { tone: 'off', short: '待同步', line: '已存在這部裝置，待同步', detail: sy.message || '離線中，連線後會自動上傳。', actions: ['retry'] };
    case 'error': return { tone: 'warn', short: '同步失敗', line: '已存在這部裝置，待同步', detail: sy.message || '同步失敗，稍後會再試。', actions: ['retry', 'settings'] };
    case 'full': return { tone: 'warn', short: '雲端已滿', line: '已存在這部裝置，待同步', detail: sy.message || '雲端空間不足：請匯出備份，再刪除舊紀錄。', actions: ['settings'] };
    default: return { tone: 'ok', short: '已存本機', line: '已存在這部裝置', detail: '沒有開雲端同步，紀錄只在這部裝置。', actions: ['signin'] };
  }
}

export function emptyHint(title, body, actionHTML = '') {
  return `<div class="empty"><div class="empty-title">${esc(title)}</div><p>${esc(body)}</p>${actionHTML}</div>`;
}

export function pageHead(title, sub, right = '') {
  return `<header class="page-head"><div class="page-head-text"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${right ? `<div class="page-head-tools">${right}</div>` : ''}</header>`;
}

export function dayNav(action, label, sub = '') {
  return `<div class="day-nav"><button type="button" class="icon-btn" data-action="${action}" data-dir="-1" aria-label="上一個">${icon('left', 18, 2)}</button><div class="day-nav-text"><strong>${esc(label)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div><button type="button" class="icon-btn" data-action="${action}" data-dir="1" aria-label="下一個">${icon('right', 18, 2)}</button></div>`;
}

export { addDays };

// ---------- 歸屬工作日（用餐、休息、獨立通勤共用）----------
// mode：sheet = 跟補登面板頂部的工作日；manual = 手動指定；auto = 自動推算。
// 「改返自動」按鈕一直都在，自動時收埋，揀日子時即時出返，唔使重畫成個面板。
export function workdayField({ mode, value }) {
  if (mode === 'sheet') return `<input type="hidden" name="wd" value="${esc(value || '')}"><input type="hidden" name="wdMode" value="sheet" data-keep>`;
  return `<div class="field-pair wd-pick"><label class="field"><span>歸屬工作日</span><input type="date" name="wd" value="${esc(value || '')}"></label>
    <div class="wd-pick-side"><input type="hidden" name="wdMode" value="${mode}" data-keep><button type="button" class="btn btn-line btn-sm" data-action="wd-auto"${mode === 'manual' ? '' : ' hidden'}>改返自動</button><span class="fine" data-wd-auto-note${mode === 'manual' ? ' hidden' : ''}>自動推算</span></div></div>`;
}

// 「會存成 週四 10/29 10:10 · 歸屬 週三 10/28 工作日（手動指定）」。
export function workdayPreview(t, wk, auto, extra = '') {
  if (t == null || Number.isNaN(t) || !wk) return '';
  return `會存成 <strong>${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}</strong>${extra} · 歸屬 ${wdOfKey(wk)} ${fmtMD(wk)} 工作日${wk !== auto ? '（手動指定）' : ''}`;
}
