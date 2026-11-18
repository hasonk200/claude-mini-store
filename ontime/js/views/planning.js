import { esc } from '../ui.js';
import { fmtDayMD, dateKey, fmtTime, fmtDur, HOUR, addDays } from '../time.js';
import { copyWeek, clockRange } from '../planning.js';
import { jobOf, STEPS, STEP_LABEL } from '../logic.js';

export const momentText = t => t == null ? '—' : fmtDayMD(dateKey(t))+' '+fmtTime(t);
export const rangeText = r => r ? momentText(r.start)+' 至 '+momentText(r.end)+' · '+fmtDur(r.end-r.start) : '請確認日期及時間，轉鐘日可能沒有這個時刻';
const button = (action,label,extra='') => `<button type="button" class="btn btn-line" data-action="${action}" ${extra}>${label}</button>`;
const input = (label,name,type,value) => `<label class="field"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" required></label>`;
export function incomeFields(s={}) {
  return `<div class="field-pair"><label class="field"><span>整趟收入（元）</span><input type="number" min="0" step=".01" name="income" inputmode="decimal" value="${esc(s.income ?? '')}"></label>
    <label class="field"><span>單數</span><input type="number" min="0" step="1" name="orders" inputmode="numeric" value="${esc(s.orders ?? '')}"></label></div>`;
}
export function inlineIncome(s) {
  return `<form class="form inline-income" data-form="income"><input type="hidden" name="id" value="${esc(s.id)}">${incomeFields(s)}<button class="btn btn-soft" type="submit">儲存收入</button></form>`;
}

export function planningSheet(ctx,wrap) {
  const {data,now,ui:{sheet:sh}} = ctx;
  if (sh.type==='shift-editor') {
    const s = data.shifts.find(x=>x.id===sh.id);
    if (sh.id&&!s) return wrap('修改班次','這班已移除');
    const key = s ? dateKey(s.start) : sh.key, st = s ? fmtTime(s.start) : '21:00', en = s ? fmtTime(s.end) : '09:00';
    const opts = data.jobs.map(j=>`<option value="${esc(j.id)}" ${s?.jobId===j.id?'selected':''}>${esc(j.name)}</option>`).join('');
    return wrap(s?'修改班次':'加入班次',`<form class="form" data-form="shift-editor"><input type="hidden" name="id" value="${esc(sh.id||'')}">${input('開始日期','date','date',key)}
      <label class="field"><span>工作</span><select name="jobId">${opts}</select></label><div class="field-pair">${input('上班','start','time',st)}${input('下班','end','time',en)}</div>
      <div class="cross-note" data-range-preview aria-live="polite">${rangeText(clockRange(key,st,en))}</div><button class="btn btn-ink">儲存班表</button>
      ${s?button('remove-plan','刪除這個排班'):''}</form>`);
  }
  if (sh.type==='copy-week') {
    const rows=sh.rows ?? copyWeek(data,sh.week);
    return wrap('複製上一週的班表',`<p>目標週由 ${fmtDayMD(sh.week)} 開始。已有班次或休假的日子會跳過。</p><ul class="plain-list">${rows.map(r=>`<li><div><strong>${esc(jobOf(data,r.jobId)?.name||'工作')} · ${fmtDayMD(r.date)}</strong><span>${rangeText(r.start!=null && r.end!=null ? r:null)} · ${r.skip||'會加入'}</span></div></li>`).join('')||'上一週沒有班次。'}</ul>${rows.some(r=>!r.skip)?button('copy-confirm','確認加入'):''}`);
  }
  if (sh.type==='plan-clock') {
    const s = data.sleeps.find(x=>x.id===sh.id);
    const last=data.sleeps.filter(x=>x.start!=null&&x.end!=null).sort((a,b)=>b.end-a.end)[0];
    const st=s?.planStart??last?.start??now+HOUR, en=s?.planEnd??last?.end??now+9*HOUR;
    const date=s?dateKey(st):addDays(dateKey(now),fmtTime(st)<=fmtTime(now)?1:0);
    return wrap(s?'修改睡眠計畫':'設定睡眠計畫',`<form class="form" data-form="plan-clock">${input('入睡日期','date','date',date)}<div class="field-pair">${input('預計入睡','start','time',fmtTime(st))}${input('預計起身','end','time',fmtTime(en))}</div><div class="cross-note" data-range-preview aria-live="polite">${rangeText(clockRange(date,fmtTime(st),fmtTime(en)))}</div><button class="btn btn-ink">儲存計畫</button>${s?button('sleep-delete','刪除這個計畫',`data-id="${esc(s.id)}"`):''}</form>`);
  }
  if(sh.type==='income-entry'){
    const s=data.sessions.find(x=>x.id===sh.id);
    return wrap('收入／單數',s ? `<p>${momentText(s.start)} · ${esc(jobOf(data,s.jobId)?.name||'工作')}</p>${inlineIncome(s)}`:'找不到這班');
  }
  if(sh.type==='temp-import'){
    if(!sh.rows)return wrap('從臨時版匯入',`<form class="form" data-form="temp-preview"><label class="field"><span>在臨時版「備份」選「匯出 JSON」，將完整內容貼在這裡</span><textarea name="source" rows="7" required></textarea></label><button class="btn btn-ink">預覽匯入</button></form>`);
    const count=sh.rows.filter(r=>!r.skip).length;
    return wrap('核對臨時版紀錄',`<p>${sh.rows.length} 筆 · ${sh.rows.filter(r=>r.type==='commute').length} 趟通勤 · 會加入 ${count} 筆</p><ul class="plain-list">${sh.rows.map(r=>`<li><div><strong>${r.type==='commute'?'通勤':'睡眠'} · ${r.wd?'工作日 '+esc(r.wd):'實際 '+esc(r.date)} · ${esc(r.skip||'會加入')}</strong><span>${r.times?STEPS.map(k=>esc(k==='ride'||k==='ride2'?'上車':STEP_LABEL[k])+' '+momentText(r.times[k])).join(' ／ '):r.clocks.length ? r.clocks.map(v=>esc(v||'—')).join(' ／ ') :momentText(r.start)+' 至 '+momentText(r.end)}</span></div></li>`).join('')}</ul>${count?button('temp-confirm','確認匯入 '+count+' 筆'):''}`);
  }
  return '';
}
