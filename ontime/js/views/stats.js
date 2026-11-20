import { esc, icon, seg, money } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdShort, fmtDur, addDays, weekStartKey, monthStartKey, monthEndKey, fromKey, HOUR, daysBetween, wdOfKey } from '../time.js';
import { periodStats, sessionWorkMs, splitWorkByDay, jobOf, sessionPay, sleepAverage, STEPS, tripTimes, tripSummary, journeyOfSession, workdayOfSession } from '../logic.js';
import { pageHead } from './shared.js';

export function periodRange(ui, now) {
  const today = dateKey(now);
  if (ui.statsPeriod === 'month') {
    let m = monthStartKey(today);
    for (let i = 0; i < Math.abs(ui.statsOffset); i++) m = ui.statsOffset < 0 ? monthStartKey(addDays(m, -1)) : monthEndKey(m);
    return [m, monthEndKey(m)];
  }
  const ws = addDays(weekStartKey(today), ui.statsOffset * 7);
  return [ws, addDays(ws, 7)];
}

// 收入：時薪顯示金額；按單已填就顯示金額同單數，未填就一粒「未填收入」掣開收入面板；不計薪唔顯示。
function payOf(s, now) {
  if (s.payMode === 'hourly') return s.rate == null ? { label: '未設時薪', missing: true } : { amount: money(sessionPay(s, now)) };
  if (s.payMode === 'perOrder') return s.income == null ? { missing: true } : { amount: money(s.income), sub: s.orders != null ? `${s.orders} 單` : '' };
  return null;
}
function payButton(s) { return `<button type="button" class="att-missing" data-action="income-open" data-id="${esc(s.id)}">未填收入</button>`; }
function incomeCell(s, now) {
  const p = payOf(s, now);
  if (!p) return '<span class="muted">—</span>';
  if (p.missing) return p.label ? `<span class="chip chip-plan">${p.label}</span>` : payButton(s);
  return `<b>${p.amount}</b>${p.sub ? `<br><span class="muted small">${p.sub}</span>` : ''}`;
}

// 按比例嘅細色條：去程（通勤青）、上班（工作色）、回程（通勤青）；每段最少 6px，冇紀錄嘅段唔畫。
function attBar(sum, workMs, kind) {
  const parts = [[sum.go, 'commute', '去程'], [workMs, kind, '上班'], [sum.back, 'commute', '回程']].filter(([ms]) => ms > 0);
  const total = parts.reduce((a, [ms]) => a + ms, 0) || 1;
  return `<div class="att-bar" aria-hidden="true">${parts.map(([ms, k]) => `<i class="k-${k}" style="flex-grow:${(ms / total).toFixed(4)}"></i>`).join('')}</div>`;
}

// 手機：每一趟一張卡。收埋時只顯示重點（實際日期、做咗幾耐、收入、色條、時間）；撳卡原地展開睇七格同「整趟修改」。
const CELL_LABEL = { out: '出門', ride: '上車', arrive: '抵達', clockIn: '上班', clockOut: '下班', ride2: '上車', home: '到家' };
export function tripCard(data, s, now, open = false) {
  const job = jobOf(data, s.jobId);
  const kind = job?.color === 'deliv' ? 'deliv' : 'work';
  const wd = workdayOfSession(s, data);
  const times = tripTimes({ session: s, journey: journeyOfSession(data, s) });
  const sum = tripSummary(times);
  const workMs = sessionWorkMs(s, now);
  const startKey = dateKey(s.start);
  const nextDay = (t) => t != null && dateKey(t) !== startKey;
  const range = `${fmtTime(s.start)} → ${s.end ? `${nextDay(s.end) ? '<span class="att-next">隔天</span> ' : ''}${fmtTime(s.end)}` : '進行中'}`;
  const pay = payOf(s, now);
  const big = pay && !pay.missing ? `<strong class="att-big">${pay.amount}</strong>` : `<strong class="att-big">${fmtDur(workMs)}</strong>`;
  const right = pay?.missing
    ? (pay.label ? `<span class="chip chip-plan">${pay.label}</span>` : payButton(s))
    : pay ? `<span class="att-sub">${fmtDur(workMs)}${pay.sub ? ` · ${pay.sub}` : ''}</span>` : '';
  const facts = [sum.go != null ? `去程 ${fmtDur(sum.go)}` : '', sum.back != null ? `回程 ${fmtDur(sum.back)}` : ''].filter(Boolean).join(' · ');
  const otherWd = wd !== startKey ? `<span class="att-wd">計入 ${wdOfKey(wd)} ${fmtMD(wd)} 工作日</span>` : '';
  const cells = STEPS.map((k) => `<div class="trip-cell${k === 'clockIn' || k === 'clockOut' ? ` is-work k-${kind}` : ''}${times[k] == null ? ' is-empty' : ''}"><span>${CELL_LABEL[k]}</span><b>${times[k] != null ? fmtTime(times[k]) : '—'}</b><small>${nextDay(times[k]) ? '隔天' : ''}</small></div>`).join('');
  return `<li><details class="att-card" data-sid="${esc(s.id)}"${open ? ' open' : ''}>
    <summary>
      <div class="att-top"><span class="att-date">${wdOf(s.start)} ${fmtMD(startKey)}</span><span class="dot-label"><i class="sw k-${kind}"></i>${esc(job?.name ?? '工作')}</span><span class="att-chev" aria-hidden="true">${icon('right', 16, 2)}</span></div>
      <div class="att-mid"><div class="att-lead">${big}<span class="att-range">${range}</span></div>${right}</div>
      ${attBar(sum, workMs, kind)}
      <div class="att-foot"><span>${facts || '冇記通勤'}</span>${otherWd}</div>
    </summary>
    <div class="att-more"><div class="trip-cells">${cells}</div>
      <div class="att-actions"><span class="muted small">上班 ${fmtDur(workMs)}${s.end == null ? '（進行中）' : ''}</span><button type="button" class="btn btn-soft btn-sm" data-action="open-trip" data-wd="${wd}" data-sid="${esc(s.id)}">整趟修改</button></div></div>
  </details></li>`;
}

export function statsView(ctx) {
  const { data, now, ui, isDesktop } = ctx;
  const [from, to] = periodRange(ui, now);
  const st = periodStats(data, from, to, now);
  const days = daysBetween(from, to);
  const keys = Array.from({ length: days }, (_, i) => addDays(from, i));
  const sleep = sleepAverage(data, keys.filter((k) => k < dateKey(now)), now);
  const jobFilter = ui.statsJob || 'all';
  const title = ui.statsPeriod === 'month' ? `${fromKey(from).getFullYear()} 年 ${fromKey(from).getMonth() + 1} 月` : `${fmtMD(from)} – ${fmtMD(addDays(to, -1))}`;
  const tools = `${seg('statsPeriod', '期間', [['week', '週'], ['month', '月']], ui.statsPeriod)}
    <div class="day-switch"><button type="button" class="icon-btn" data-action="stats-shift" data-dir="-1" aria-label="上一段">${icon('left', 18, 2)}</button><button type="button" class="icon-btn" data-action="stats-shift" data-dir="1" aria-label="下一段">${icon('right', 18, 2)}</button></div>
    <button type="button" class="btn btn-ink btn-sm" data-action="export-csv">${icon('download', 16, 2)}匯出 CSV</button>`;

  // 每個日曆日的工時：前一個工作日帶過來的部分和當天開始的部分分開顯示。
  const maxMs = Math.max(4 * HOUR, ...keys.map((k) => st.byDay[k] || 0));
  // 包括上一段期間開始、跨進這段期間的夜班（periodStats 已算好）。
  const prevPart = st.carryByDay;
  const bars = keys.map((k) => {
    const total = st.byDay[k] || 0;
    const prev = prevPart[k] || 0;
    const own = total - prev;
    const label = ui.statsPeriod === 'month' ? Number(k.slice(8)) : `${wdShort(k)}<br>${fmtMD(k)}`;
    return `<div class="bar-col"><span class="bar-val">${total ? fmtDur(total).replace(' ', '') : ''}</span><div class="bar-slot stack-bar"><i class="k-work-light" style="height:${(own / maxMs) * 100}%"></i><i class="k-work" style="height:${(prev / maxMs) * 100}%"></i></div><span class="bar-label">${label}</span></div>`;
  }).join('');

  const jobs = [...new Set(st.sessions.map((s) => s.jobId))];
  const filters = jobs.length > 1 ? `<div class="btn-wrap">${[['all', '全部'], ...jobs.map((id) => [id, jobOf(data, id)?.name ?? '工作'])].map(([id, n]) => `<button type="button" class="btn btn-sm ${jobFilter === id ? 'btn-ink' : 'btn-line'}" data-action="stats-job" data-id="${id}" aria-pressed="${jobFilter === id}">${esc(n)}</button>`).join('')}</div>` : '';
  const rows = st.sessions.filter((s) => jobFilter === 'all' || s.jobId === jobFilter).sort((a, b) => b.start - a.start).map((s) => {
    const split = Object.entries(splitWorkByDay(s, now));
    const job = jobOf(data, s.jobId);
    const wd = workdayOfSession(s, data);
    return `<tr><td><b>${wdOf(s.start)} ${fmtMD(dateKey(s.start))}</b>${wd !== dateKey(s.start) ? `<br><span class="muted small">計入 ${wdOfKey(wd)} ${fmtMD(wd)} 工作日</span>` : ''}</td><td><span class="dot-label"><i class="sw k-${job?.color === 'deliv' ? 'deliv' : 'work'}"></i>${esc(job?.name ?? '工作')}</span></td>
      <td>${fmtTime(s.start)} → ${s.end ? `${dateKey(s.end) !== dateKey(s.start) ? wdOf(s.end) + ' ' : ''}${fmtTime(s.end)}` : '<span class="chip chip-real">進行中</span>'}${attBar(tripSummary(tripTimes({ session: s, journey: journeyOfSession(data, s) })), sessionWorkMs(s, now), job?.color === 'deliv' ? 'deliv' : 'work')}</td>
      <td><b>${fmtDur(sessionWorkMs(s, now))}</b>${split.length > 1 ? `<br><span class="muted small">${split.map(([k, v]) => `${wdShort(k)} ${fmtDur(v)}`).join(' · ')}</span>` : ''}</td>
      <td class="muted">${{ hourly: '時薪', perOrder: '按單 · 整次實收', none: '不計薪' }[s.payMode] || ''}</td>
      <td class="t-right">${incomeCell(s, now)}</td>
      <td class="t-right"><button type="button" class="btn btn-line btn-sm" data-action="open-trip" data-wd="${wd}" data-sid="${esc(s.id)}">修改</button></td></tr>`;
  }).join('');

  const cards = st.sessions.filter((s) => jobFilter === 'all' || s.jobId === jobFilter).sort((a, b) => b.start - a.start).map((s) => tripCard(data, s, now, ui.attOpen?.has(s.id))).join('');

  const hasHourly = st.sessions.some((s) => s.payMode === 'hourly');
  const totalPay = (hasHourly ? st.hourlyPay : 0) + (st.perOrderCount ? st.income : 0);
  const missingOrders = st.perOrderCount - st.incomeKnown;
  const totalLine = (hasHourly || st.perOrderCount)
    ? `合計收入 <b>${money(totalPay)}</b>${missingOrders ? `（另有 ${missingOrders} 班按單未填）` : ''}`
    : '';

  return `${pageHead('統計與收入', `${title} · 收入按開始上班日期歸屬，跨日只算一次`, tools)}
    <section class="kpis">
      <div class="card card-ink kpi"><span>實際工時（按開班日）</span><strong>${fmtDur(st.workMs)}</strong><small class="c-lime">${st.sessions.length} 次出勤${totalLine ? ` · ${totalLine}` : ' · 跨期間的班算在開班那段'}</small></div>
      ${hasHourly
        ? `<div class="card kpi k-work-soft"><span>計薪 · 時薪</span><strong>${money(st.hourlyPay)}</strong><small>${st.hourlyKnown ? '用每班的計薪快照' : '部分班次未設時薪'}</small></div>`
        : `<div class="card kpi"><span>平均每班工時</span><strong>${st.sessions.length ? fmtDur(st.workMs / st.sessions.length) : '—'}</strong><small>${st.sessions.length} 班</small></div>`}
      <div class="card kpi k-deliv-soft"><span>按單實收</span><strong>${st.perOrderCount ? money(st.income) : '—'}</strong><small>${st.perOrderCount ? `${st.orders} 單 · ${missingOrders} 班未填` : '沒有按單班次'}</small></div>
      <div class="card kpi k-commute-soft"><span>通勤</span><strong>${fmtDur(st.commuteMs)}</strong><small>只計完整路程</small></div>
      <div class="card kpi k-sleep-soft"><span>平均睡眠</span><strong>${sleep.avg == null ? '—' : fmtDur(sleep.avg)}</strong><small>${sleep.count} 天有完整紀錄</small></div>
    </section>
    <section class="card"><div class="card-head"><h2 class="card-title">每個日曆日的工時（按日曆日）</h2><div class="legend"><span><i class="sw k-work"></i>前一工作日帶過來</span><span><i class="sw k-work-light"></i>當天開始</span></div></div>
      <div class="bars ${ui.statsPeriod === 'month' ? 'bars-dense' : ''}">${bars}</div>
      <p class="fine">這裡按實際發生的日曆日計，包括上一段期間開始、跨午夜進來的夜班，所以加起來可能跟上面「按開班日」的實際工時不一樣。</p></section>
    <section class="card card-flush"><div class="card-head"><h2 class="card-title">出勤明細</h2>${filters}</div>
      ${!isDesktop && rows ? `<ul class="trip-cards">${cards}</ul>` : rows ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">實際開工日</th><th scope="col">工作</th><th scope="col">實際時段</th><th scope="col">工時（分日）</th><th scope="col">計算方式</th><th scope="col" class="t-right">收入</th><th scope="col" class="t-right">操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted pad">這段期間沒有出勤紀錄。</p>'}
    </section>`;
}
