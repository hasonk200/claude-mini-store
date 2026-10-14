import { esc, icon, seg, money } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdShort, fmtDur, addDays, weekStartKey, monthStartKey, monthEndKey, fromKey, HOUR, daysBetween } from '../time.js';
import { periodStats, sessionWorkMs, splitWorkByDay, jobOf, sessionPay, sleepAverage } from '../logic.js';
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

function incomeCell(s, now) {
  if (s.payMode === 'hourly') return s.rate == null ? '<span class="chip chip-plan">未設時薪</span>' : `<b>${money(sessionPay(s, now))}</b>`;
  if (s.payMode === 'perOrder') {
    return `<button type="button" class="chip ${s.income == null ? 'chip-plan' : 'chip-money'}" data-action="income-edit" data-id="${s.id}">${s.income == null ? '未填' : money(s.income)}${s.orders != null ? ` · ${s.orders} 單` : ''}</button>`;
  }
  return '<span class="muted">不計薪</span>';
}

export function statsView(ctx) {
  const { data, now, ui } = ctx;
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
  const prevPart = {};
  for (const s of st.sessions) for (const [k, v] of Object.entries(splitWorkByDay(s, now))) if (k !== dateKey(s.start)) prevPart[k] = (prevPart[k] || 0) + v;
  const bars = keys.map((k) => {
    const total = st.byDay[k] || 0;
    const prev = prevPart[k] || 0;
    const own = total - prev;
    const label = ui.statsPeriod === 'month' ? Number(k.slice(8)) : `${wdShort(k)}<br>${fmtMD(k)}`;
    return `<div class="bar-col"><span class="bar-val">${total ? fmtDur(total).replace(' ', '') : ''}</span><div class="bar-slot stack-bar"><i class="k-work-light" style="height:${(own / maxMs) * 100}%"></i><i class="k-work" style="height:${(prev / maxMs) * 100}%"></i></div><span class="bar-label">${label}</span></div>`;
  }).join('');

  const jobs = [...new Set(st.sessions.map((s) => s.jobId))];
  const filters = jobs.length > 1 ? `<div class="btn-wrap">${[['all', '全部'], ...jobs.map((id) => [id, jobOf(data, id)?.name ?? '工作'])].map(([id, n]) => `<button type="button" class="btn btn-sm ${jobFilter === id ? 'btn-ink' : 'btn-line'}" data-action="stats-job" data-id="${id}" aria-pressed="${jobFilter === id}">${esc(n)}</button>`).join('')}</div>` : '';
  const rows = st.sessions.filter((s) => jobFilter === 'all' || s.jobId === jobFilter).sort((a, b) => a.start - b.start).map((s) => {
    const split = Object.entries(splitWorkByDay(s, now));
    const job = jobOf(data, s.jobId);
    return `<tr><td><b>${wdOf(s.start)} ${fmtMD(dateKey(s.start))}</b></td><td><span class="dot-label"><i class="sw k-${job?.color === 'deliv' ? 'deliv' : 'work'}"></i>${esc(job?.name ?? '工作')}</span></td>
      <td>${fmtTime(s.start)} → ${s.end ? `${dateKey(s.end) !== dateKey(s.start) ? wdOf(s.end) + ' ' : ''}${fmtTime(s.end)}` : '<span class="chip chip-real">進行中</span>'}</td>
      <td><b>${fmtDur(sessionWorkMs(s, now))}</b>${split.length > 1 ? `<br><span class="muted small">${split.map(([k, v]) => `${wdShort(k)} ${fmtDur(v)}`).join(' · ')}</span>` : ''}</td>
      <td class="muted">${{ hourly: '時薪', perOrder: '按單 · 整次實收', none: '不計薪' }[s.payMode] || ''}</td>
      <td class="t-right">${incomeCell(s, now)}</td></tr>`;
  }).join('');

  const editing = ui.incomeEdit ? data.sessions.find((s) => s.id === ui.incomeEdit) : null;
  const incomeForm = editing ? `<section class="card"><form class="form" data-form="income"><input type="hidden" name="id" value="${editing.id}">
    <div class="card-head"><h2 class="card-title">${wdOf(editing.start)} ${fmtMD(dateKey(editing.start))} · ${esc(jobOf(data, editing.jobId)?.name ?? '')} 的收入</h2><button type="button" class="btn btn-line btn-sm" data-action="income-cancel">取消</button></div>
    <div class="field-pair"><label class="field"><span>整次實收（空白 = 未填）</span><input type="number" step="0.01" min="0" name="income" value="${editing.income ?? ''}" inputmode="decimal"></label>
    <label class="field"><span>完成訂單數</span><input type="number" step="1" min="0" name="orders" value="${editing.orders ?? ''}" inputmode="numeric"></label></div>
    <button class="btn btn-ink" type="submit">儲存</button><p class="fine">「未填」與「0」分開記錄：0 代表確實沒有收入。</p></form></section>` : '';

  return `${pageHead('統計與收入', `${title} · 收入按開始上班日期歸屬，跨日只算一次`, tools)}
    <section class="kpis">
      <div class="card card-ink kpi"><span>實際工時</span><strong>${fmtDur(st.workMs)}</strong><small class="c-lime">${st.sessions.length} 次出勤</small></div>
      <div class="card kpi"><span>計薪 · 時薪</span><strong>${money(st.hourlyPay)}</strong><small>${st.hourlyKnown ? '用每班的計薪快照' : '部分班次未設時薪'}</small></div>
      <div class="card kpi k-deliv-soft"><span>按單實收</span><strong>${st.perOrderCount ? money(st.income) : '—'}</strong><small>${st.perOrderCount ? `${st.orders} 單 · ${st.perOrderCount - st.incomeKnown} 班未填` : '沒有按單班次'}</small></div>
      <div class="card kpi"><span>通勤</span><strong>${fmtDur(st.commuteMs)}</strong><small>只計完整路程</small></div>
      <div class="card kpi k-sleep-soft"><span>平均睡眠</span><strong>${sleep.avg == null ? '—' : fmtDur(sleep.avg)}</strong><small>${sleep.count} 天有完整紀錄</small></div>
    </section>
    <section class="card"><div class="card-head"><h2 class="card-title">每個日曆日的工時</h2><div class="legend"><span><i class="sw k-work"></i>前一工作日帶過來</span><span><i class="sw k-work-light"></i>當天開始</span></div></div>
      <div class="bars ${ui.statsPeriod === 'month' ? 'bars-dense' : ''}">${bars}</div></section>
    ${incomeForm}
    <section class="card card-flush"><div class="card-head"><h2 class="card-title">出勤明細</h2>${filters}</div>
      ${rows ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">上班日</th><th scope="col">工作</th><th scope="col">實際時段</th><th scope="col">工時（分日）</th><th scope="col">計算方式</th><th scope="col" class="t-right">收入</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted pad">這段期間沒有出勤紀錄。</p>'}
    </section>`;
}
