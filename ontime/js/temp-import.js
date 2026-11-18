import { clockAt } from './planning.js';
import { addDays, fmtTime, HOUR } from './time.js';
import { STEPS, checkTrip, tripTimes, journeyOfSession, tripErrorText } from './logic.js';
import { checkSleepPair, writeTrip } from './actions.js';
import { update, get, uid } from './store.js';

const validDate = d => typeof d === 'string' && clockAt(d,'12:00') != null;
const validClock = t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function readTemp(text) {
  const obj = JSON.parse(text.trim().replace(/^\uFEFF/,''));
  if (obj?.version !== 1 || !Array.isArray(obj.entries)) throw Error('請貼上臨時版「匯出 JSON」的完整內容');
  return obj.entries;
}

function inspect(d, e, now) {
  if (!e || typeof e.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(e.id) || !validDate(e.date)) return { skip:'格式或實際日期無效' };
  const wd = e.work ?? e.date;
  const saved = [...d.sessions,...d.journeys,...d.sleeps].some(r => r.tempId === e.id);
  if (e.type === 'sleep') {
    const start = clockAt(e.date,e.sleep), end = clockAt(e.wake < e.sleep ? addDays(e.date,1) : e.date,e.wake);
    const ambiguous = [start,end].some(t=>t!=null && fmtTime(t)===fmtTime(t+HOUR));
    const bad = ambiguous || checkSleepPair(d,start,end,{now});
    const verified = !!e.num && e.ver === e.date+'|'+e.sleep+','+e.wake+'#'+e.num;
    return { start,end,verified,skip:saved || d.sleeps.some(s=>s.start===start && s.end===end) ? '重複' : bad ? '時間不完整、重疊或未到' : '' };
  }
  if (e.type !== 'commute' || !validDate(wd) || !Array.isArray(e.t) || e.t.length !== 7) return { skip:'類型、工作日或七格格式無效' };
  const times = {};
  let date = e.date, previous = '';
  for (const [i,k] of STEPS.entries()) {
    const t = e.t[i];
    if (t === '' || t === null) { times[k] = null; continue; }
    if (!validClock(t)) return { skip:'時刻格式無效' };
    if (previous && t < previous) date = addDays(date,1);
    times[k] = clockAt(date,t);
    if (times[k] == null) return { skip:'轉鐘日沒有這個時間' };
    if (fmtTime(times[k]+HOUR)===t) return { skip:'冬令轉鐘時刻出現兩次，請核對' };
    previous = t;
  }
  const trips = [...d.sessions.map(session=>({session,journey:journeyOfSession(d,session)})),...d.journeys.filter(j=>!j.sessionId).map(journey=>({journey}))];
  const filled = STEPS.filter(k=>times[k]!=null);
  const duplicate = filled.length && trips.some(trip => {
    const other = tripTimes(trip);
    return filled.every(k=>times[k]===other[k]);
  });
  const conflict = trips.some(trip => {
    const other = tripTimes(trip);
    return filled.some(k=>other[k]===times[k]);
  });
  const bad = checkTrip(d,{times},now);
  const verified = !!e.num && e.ver === e.date+'|'+e.t.join(',')+(wd!==e.date?'@'+wd:'')+'#'+e.num;
  return { wd,times,verified,skip:saved || duplicate ? '重複' : conflict ? '與現有趟次部分相同，請手動核對' : bad ? tripErrorText(bad) : '' };
}

function append(d,e,row,now) {
  const meta = { tempId:e.id, trackingNumber:String(e.num || '') };
  if (e.type === 'sleep') {
    d.sleeps.push({id:uid('slp'),...meta,start:row.start,end:row.end,planStart:null,planEnd:null,note:'',
      ...(row.verified ? {verified:{start:true,end:true}} : {})});
    return;
  }
  const result = writeTrip(d,{wd:row.wd,times:row.times,verified:row.verified},now);
  const s = d.sessions.find(x=>x.id===result.sessionId), j = d.journeys.find(x=>x.id===result.journeyId);
  if(s) Object.assign(s,meta);
  if(j) Object.assign(j,meta);
}

export function tempPreview(data,entries,now) {
  const draft = structuredClone(data);
  return entries.map(e=>{
    const row = inspect(draft,e,now);
    if (!row.skip) append(draft,e,row,now);
    return { ...row, type:e?.type || '', date:e?.date || '', wd:e?.work ?? row.wd, clocks:Array.isArray(e?.t)?e.t.map(t=>typeof t==='string'?t:''):[], id:e?.id || '' };
  });
}
export function importTemp(entries,preview,now) {
  const rows = tempPreview(get(),entries,now);
  if (JSON.stringify(rows)!==JSON.stringify(preview)) return {changed:true,rows};
  const count = rows.filter(r=>!r.skip).length;
  if (count) update(d=>rows.forEach((r,i)=>{if(!r.skip)append(d,entries[i],r,now)}));
  return {count};
}
