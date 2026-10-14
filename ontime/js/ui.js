// 畫面小工具：跳脫文字、圖示、共用片段。
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const ICONS = {
  door: 'M5 21V4.6a1 1 0 0 1 .8-1l8-1.5a1 1 0 0 1 1.2 1V21M15 5h3a1 1 0 0 1 1 1v15M3 21h18M11.5 12.5h1',
  bus: 'M7 3.5h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3zM4 11h16M7.5 17.5V21M16.5 17.5V21M8 14.5h.01M16 14.5h.01M8 7h8',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  bag: 'M6 7h12a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17V9.5A2.5 2.5 0 0 1 6 7zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17',
  flag: 'M5 21V4M5 4h12l-2.5 4 2.5 4H5',
  home: 'M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5M10 20v-5h4v5',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l2-4 3 2 2 3M8 9l3-1',
  meal: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v4h3v8',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
  sun: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  cup: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3',
  clock: 'M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0M12 7.5V12l3 2',
  clockPlus: 'M4 13a7 7 0 1 0 14 0a7 7 0 1 0-14 0M11 9.5V13l2.5 1.5M19 2v5M16.5 4.5h5',
  list: 'M4 6h10M4 12h16M4 18h7',
  calendar: 'M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM4 10h16M9 3v4M15 3v4',
  chart: 'M5 20V11M12 20V4M19 20v-7',
  wallet: 'M6 6h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3zM3 10h18M16 14.5h2',
  user: 'M8.5 8.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M5 20a7 7 0 0 1 14 0',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  camera: 'M6 7h1.5L9 5h6l1.5 2H18a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3zM8.5 13.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
};

export function icon(name, size = 20, stroke = 1.9) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>`;
}

export const KIND = {
  work: { label: '工作', icon: 'bag' },
  deliv: { label: '外送', icon: 'bag' },
  commute: { label: '通勤', icon: 'bus' },
  home: { label: '到家', icon: 'home' },
  meal: { label: '用餐', icon: 'meal' },
  sleep: { label: '睡眠', icon: 'moon' },
  break: { label: '休息', icon: 'cup' }
};

export const STEP_ICON = { out: 'door', ride: 'bus', arrive: 'pin', clockIn: 'bag', clockOut: 'flag', leave: 'walk', ride2: 'bus', home: 'home' };
export const STEP_KIND = { out: 'commute', ride: 'commute', arrive: 'commute', clockIn: 'work', clockOut: 'work', leave: 'commute', ride2: 'commute', home: 'home' };

export function bubble(name, kind, opts = {}) {
  const cls = ['bubble', `k-${kind}`];
  if (opts.plan) cls.push('is-plan');
  if (opts.current) cls.push('is-current');
  if (opts.empty) cls.push('is-empty');
  if (opts.size) cls.push(`b-${opts.size}`);
  const check = opts.done ? `<span class="bubble-check">${icon('check', 9, 4)}</span>` : '';
  return `<span class="${cls.join(' ')}">${icon(name, opts.iconSize || 18)}${check}</span>`;
}

export function durHTML(ms, cls = '') {
  if (ms == null) return `<span class="num ${cls}">—</span>`;
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  return `<span class="num ${cls}">${h}<small>h</small> ${m}<small>m</small></span>`;
}

export function money(v) {
  if (v == null) return '未填';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function seg(key, name, options, value) {
  return `<div class="seg" role="group" aria-label="${esc(name)}">${options.map(([v, label]) =>
    `<button type="button" data-action="seg" data-seg="${esc(key)}" data-value="${esc(v)}" aria-pressed="${v === value}">${esc(label)}</button>`).join('')}</div>`;
}
