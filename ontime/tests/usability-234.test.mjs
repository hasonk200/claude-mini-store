import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData, get, getRaw, replaceAll, undo } from '../js/store.js';
import { at, HOUR, MIN, dateKey, fmtTime, addDays } from '../js/time.js';
import { tripPayMode, saveTrip, importJSON, exportJSON } from '../js/actions.js';
import { clockRange, copyWeek, reminderCalendar, reminders, restTarget } from '../js/planning.js';
import { backupCSV, decodeCSV } from '../js/backup.js';
import { tempPreview, importTemp, readTemp } from '../js/temp-import.js';
import { syncVersions, pendingCount } from '../js/sync.js';
import { timelineView } from '../js/views/timeline.js';
import { mealForm } from '../js/views/meals.js';
import { todayView } from '../js/views/today.js';
import { planningSheet } from '../js/views/planning.js';
import { sheetView, openTripSheet } from '../js/views/sheet.js';

const now=at('2026-11-16','12:00');
const fresh=()=>replaceAll(emptyData(),{tombstone:false});
const entry=(date,id=date)=>({id,type:'commute',date,work:date,t:['22:00','22:10','22:50','23:00','06:00','06:10','06:30']});
const job={id:'delivery',name:'外送',payMode:'perOrder',color:'deliv'};
const shift=(key,id)=>({id,jobId:'delivery',...clockRange(key,'21:00','06:00')});
const frame=(data,wd='2026-11-16')=>({data,now,wd,ui:{tlMode:'workday',drafts:{}},isDesktop:false});

test('提醒按真正經過的小時、班次 ID 和個別開關',()=>{
  const d=emptyData();d.jobs=[job];
  d.sessions=[{id:'s',jobId:job.id,start:now-12*HOUR,end:now-3*HOUR,payMode:'perOrder',income:null}];
  d.sleeps=[{id:'sleep',start:now-27*HOUR,end:now-20*HOUR}];
  d.meals=[{id:'m',start:now-6*HOUR}];
  const rows=reminders(d,now);
  assert.deepEqual(rows.map(x=>x.action),['quick-wake','open-trip','quick-meal','income-open']);
  assert.equal(rows[1].sid,'s');
  assert.equal(reminders(d,now-1).length,1);
  d.settings.reminders={sleep:false,home:false,meal:false};
  assert.deepEqual(reminders(d,now).map(x=>x.action),['income-open']);
});

for(const [key,hours] of [['2026-03-07',8],['2026-10-31',10],['2026-11-13',9],['2026-11-14',9]]) {
  test(key+' 班表、睡眠計畫、休息和匯入跨夜',()=>{
    const range=clockRange(key,'21:00','06:00'), d=emptyData();
    assert.equal(dateKey(range.end),addDays(key,1));assert.equal(range.end-range.start,hours*HOUR);
    d.shifts=[shift(key,'sh')];d.sleeps=[{planEnd:range.end+8*HOUR,id:'sl'}];
    const cal=reminderCalendar(d,range.start);
    assert.equal(cal.count,2);
    assert.ok(cal.text.includes(new Date(range.end+30*MIN).toISOString().replace(/[-:]/g,'').replace('.000','')));
    assert.equal((cal.text.match(/BEGIN:VALARM/g)||[]).length,2);
    d.settings.reminders={sleep:false,home:false};assert.equal(reminderCalendar(d,range.start).count,0);
    d.sessions=[{id:'s',...range,breaks:[]}];
    assert.equal(restTarget(d,clockRange(key,'23:55','00:15'),'auto',now).session.id,'s');
    assert.ok(!restTarget(d,clockRange(key,'23:55','00:15'),'alone',now).session);
    const row=tempPreview(emptyData(),[entry(key)],now)[0];
    assert.equal(row.skip,'');assert.equal(dateKey(row.times.home),addDays(key,1));
  });
}
test('不存在或重複的多倫多轉鐘時間需要核對',()=>{
  assert.equal(clockRange('2026-03-08','02:30','05:00'),null);
  const e=entry('2026-10-31');e.t[4]='01:15';
  assert.match(tempPreview(emptyData(),[e],now)[0].skip,/兩次/);
});
test('複製上週保留當地時刻，略過已排班與已放假',()=>{
  const d=emptyData();d.shifts=['2026-03-04','2026-03-05','2026-03-06','2026-03-13'].map((k,i)=>shift(k,String(i)));
  d.dayMarks=[{date:'2026-03-12'}];
  const rows=copyWeek(d,'2026-03-09');
  assert.deepEqual(rows.map(x=>x.skip),['','已標休假','已有班次']);
  assert.equal(fmtTime(rows[0].start),'21:00');assert.equal(fmtTime(rows[0].end),'06:00');
});
test('兩晚臨時紀錄先預覽，原工作日獨立於實際日期，去重並整批復原',()=>{
  fresh();const a=entry('2026-11-12'), b=entry('2026-11-13');a.work='2026-11-11';
  a.num='0021';a.ver=a.date+'|'+a.t.join(',')+'@'+a.work+'#0021';
  const list=readTemp(JSON.stringify({version:1,entries:[a,b,{...a,id:'copy'}]}));
  const rows=tempPreview(get(),list,now);assert.equal(get().sessions.length,0);
  assert.deepEqual(rows.map(r=>r.skip),['','','重複']);
  assert.equal(importTemp(list,rows,now).count,2);
  assert.equal(get().sessions[0].workdayDate,a.work);assert.equal(get().sessions[0].verified.start,true);
  assert.equal(get().journeys[0].trackingNumber,'0021');assert.equal(dateKey(get().journeys[0].home),'2026-11-13');
  assert.equal(importTemp(list,rows,now).changed,true);
  assert.equal(importTemp(list,tempPreview(get(),list,now),now).count,0);
  assert.equal(undo(),true);assert.equal(get().sessions.length,0);assert.equal(get().journeys.length,0);
});
test('舊格式、只有通勤、相同時間的既有手記、睡眠及時間衝突',()=>{
  fresh();assert.throws(()=>readTemp('{"sessions":[]}'));
  const partial={...entry('2026-11-10'),t:['22:15','','','','','','']};
  const sleep={type:'sleep',id:'sleep',date:'2026-11-10',sleep:'23:00',wake:'06:00'};
  const rows=tempPreview(get(),[partial,sleep],now);
  assert.equal(importTemp([partial,sleep],rows,now).count,2);
  assert.equal(get().journeys[0].sessionId,null);assert.equal(get().sleeps[0].end,at('2026-11-11','06:00'));
  assert.equal(tempPreview(get(),[{...partial,id:'other'}],now)[0].skip,'重複');
  assert.ok(tempPreview(get(),[{...partial,id:'more',t:['22:15','22:25','','','','','']}],now)[0].skip.includes('部分相同'));
});
test('跨夜休息擋住重疊、跨班和未來',()=>{
  const d=emptyData(),range=clockRange('2026-11-14','23:50','00:15');
  d.sessions=[{id:'s',start:range.start+MIN,end:range.end+HOUR,breaks:[]}];
  assert.ok(restTarget(d,range,'auto',now).error);
  assert.ok(restTarget(d,range,'s',now).error);
  d.rests=[range];assert.ok(restTarget(d,range,'alone',now).error);
  assert.ok(restTarget(emptyData(),range,'auto',range.start).error);
});
test('整趟按班表決定計薪，收入與時間只需一次復原',()=>{
  fresh();const d=emptyData();d.jobs=[{id:'other',payMode:'hourly'},job];d.shifts=[shift('2026-11-13','plan')];replaceAll(d,{tombstone:false});
  const times={clockIn:d.shifts[0].start,clockOut:d.shifts[0].end};
  assert.equal(tripPayMode(d,{},'2026-11-13',times.clockIn),'perOrder');
  assert.ok(saveTrip({wd:'2026-11-13',times,pay:{income:0,orders:0}},now).ok);
  assert.equal(get().sessions[0].income,0);assert.equal(get().sessions[0].orders,0);
  undo();assert.equal(get().sessions.length,0);
});
test('時間線指向正確班、窄屏班表提示獨立於輸入欄',()=>{
  const d=emptyData();d.jobs=[job];const sh=shift('2026-11-14','p');d.shifts=[sh];
  d.sessions=[{id:'missing',start:sh.start,end:sh.end,shiftId:sh.id,workdayDate:'2026-11-14',workdayManual:true,jobId:'delivery',breaks:[]}];
  const ctx=frame(d,'2026-11-14');
  assert.match(timelineView(ctx),/data-sid="missing" data-step="home"/);
  ctx.ui.sheet=openTripSheet(d,ctx.wd,now,{sessionId:'missing',focus:'home'});
  assert.match(sheetView(ctx),/trip-plan-hint">班表 06:00/);
});
test('到時用餐提醒有兩個直接動作，常用值在更多選項前',()=>{
  const d=emptyData();d.meals=[{id:'m',confirmed:false,start:now,name:'便當'},{id:'prev',confirmed:true,start:now-HOUR,name:'便當',place:'公司'}];
  const ctx=frame(d);const home=todayView(ctx);
  assert.match(home,/data-action="meal-confirm" data-id="m"/);
  assert.match(home,/data-action="meal-open" data-id="m"/);
  const html=mealForm({...ctx,key:'meal:new'});
  assert.ok(html.indexOf('data-action="meal-fill"')>=0 && html.indexOf('data-action="meal-fill"')<html.indexOf('<details'));
});
test('未設睡眠計畫兩個入口，計畫只有一個日期',()=>{
  const ctx=frame(emptyData());assert.ok((todayView(ctx).match(/data-action="plan-clock"/g)||[]).length>=2);
  ctx.ui.sheet={type:'plan-clock'};const html=planningSheet(ctx,(_,body)=>body);
  assert.equal((html.match(/type="date"/g)||[]).length,1);assert.equal((html.match(/type="time"/g)||[]).length,2);
});
test('備份完整往返，含引號、換行、相片、刪除標記及未知欄位',()=>{
  const d=emptyData();d.meals=[{id:'m',name:'湯,"飯"\n🍚',photo:'data:image/png;base64,YQ==',verified:{start:true},updatedAt:123}];
  d.journeys=[{id:'gone',deletedAt:12,updatedAt:12}];d.extra={a:1};d.settings.reminders={meal:false};
  const csv=backupCSV(d);
  assert.deepEqual(decodeCSV(csv),d);assert.throws(()=>decodeCSV(csv.split('\r\n').slice(0,-3).join('\r\n')));
  for(const text of [csv,JSON.stringify({app:'ONTIME',data:d})]){fresh();importJSON(text);assert.deepEqual(JSON.parse(exportJSON()).data,d);}
});
test('同步待上傳筆數包含新增、刪除標記和設定',()=>{
  const d=emptyData();d.jobs=[{id:'a',updatedAt:1}];const checkpoint=syncVersions(d);
  assert.equal(pendingCount(d,checkpoint),0);
  d.jobs[0].deletedAt=2;d.jobs[0].updatedAt=2;d.meals.push({id:'m'});d.settings.updatedAt=2;
  assert.equal(pendingCount(d,checkpoint),3);
});
