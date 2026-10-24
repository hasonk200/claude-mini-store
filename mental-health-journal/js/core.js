/* Pure, dependency-free rules shared by the journal and regression tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JournalCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const day=k=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return false;const [y,m,d]=k.split('-').map(Number),v=new Date(y,m-1,d);return v.getFullYear()===y&&v.getMonth()===m-1&&v.getDate()===d;};
const safeId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const finite=(x,min=0,max=1e9)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
function validateBackup(d,cardIds){
 if(!record(d)||!record(d.checkins))throw new Error('缺少有效打卡記錄');
 const walk=(v)=>{if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('檔案含不支援欄位');walk(v[k]);}};walk(d);
 for(const [k,v] of Object.entries(d.checkins)){if(!day(k)||!record(v)||!['mood','anx','energy'].every(n=>finite(v[n],0,10)))throw new Error('打卡日期或分數格式不正確');}
 for(const k of ['evidence','ladders','phq','favs','habits'])if(d[k]!=null&&!Array.isArray(d[k]))throw new Error(k+' 格式不正確');
 for(const k of ['settings','plan','weeks','draws','miles','cardNotes','journey'])if(d[k]!=null&&!record(d[k]))throw new Error(k+' 格式不正確');
 for(const e of d.evidence||[])if(!record(e)||!safeId(e.id)||typeof e.text!=='string'||!day(e.date))throw new Error('證據簿格式不正確');
 for(const l of d.ladders||[])if(!record(l)||!safeId(l.id)||typeof l.name!=='string'||!Array.isArray(l.steps)||l.steps.some(s=>!record(s)||!safeId(s.id)||typeof s.text!=='string'||!finite(s.fear,0,10)||!Array.isArray(s.log)||s.log.some(v=>!record(v)||!day(v.date)||!finite(v.before,0,10)||!finite(v.after,0,10))))throw new Error('階梯格式不正確');
 for(const h of d.habits||[])if(!record(h)||!record(h.log)||!safeId(h.id))throw new Error('習慣格式不正確');
 for(const q of d.phq||[])if(!record(q)||!day(q.date)||!finite(q.total,0,12)||!finite(q.anx,0,6)||!finite(q.dep,0,6))throw new Error('問卷記錄格式不正確');
 for(const [k,v] of Object.entries(d.draws||{})){
  if(!day(k)||!record(v)||v.date!==k||typeof v.text!=='string'||typeof v.card!=='string'||(cardIds&&!cardIds.includes(v.card)))throw new Error('抽卡記錄格式不正確');
  if(v.cards&&(!Array.isArray(v.cards)||v.cards.length!==3||v.cards.some(c=>!record(c)||(cardIds&&!cardIds.includes(c.card)))))throw new Error('三張牌格式不正確');
 }
 if(d.pet!=null){const p=d.pet;if(!record(p)||!['cat','dog','cloud'].includes(p.sp)||typeof p.name!=='string'||!finite(p.xp)||!finite(p.coins)||!record(p.needs)||!['food','water','energy','clean','fun'].every(k=>finite(p.needs[k],0,100)))throw new Error('寵物資料不完整');
  for(const k of ['others','eggs','chat','album','accs'])if(p[k]!=null&&!Array.isArray(p[k]))throw new Error('寵物收藏格式不正確');
  for(const o of [p,...(p.others||[])])if(o.id!=null&&!safeId(o.id))throw new Error('寵物識別格式不正確');
  for(const sh of p.album||[])if(!record(sh)||!safeId(sh.id)||!['home','park','lake','street','cafe'].includes(sh.place)||!day(sh.date)||!finite(sh.stage,0,2)||!finite(sh.hour,0,23)||sh.stickers!=null&&!Array.isArray(sh.stickers))throw new Error('相簿記錄格式不正確');
  if((p.others||[]).some(o=>!record(o)||!['cat','dog','cloud'].includes(o.sp)||typeof o.name!=='string'))throw new Error('家庭成員格式不正確');
 }
 return d;
}
/* Local storage is a recoverable cache, not an all-or-nothing imported file.
 * Keep unfamiliar fields and valid siblings; retain the original JSON in the
 * application whenever repairs are needed. The recovery flag is local-only. */
function readLocal(raw){
 if(raw==null)return {data:null,repaired:false};
 let repaired=false;
 const clean=v=>{
  if(Array.isArray(v))return v.map(clean);
  if(!record(v))return v;
  const out={};
  for(const [k,value] of Object.entries(v)){
   if(['__proto__','constructor','prototype'].includes(k)){repaired=true;continue;}
   out[k]=clean(value);
  }
  return out;
 };
 try{
  const d=clean(JSON.parse(raw));
  if(!record(d))throw new Error('Invalid local root');
  const valid=(key,value)=>{try{validateBackup({checkins:{},[key]:value});return true;}catch(e){return false;}};
  for(const key of ['checkins','draws']){
   if(!record(d[key])){
    if(key==='checkins'||key in d)repaired=true;
    d[key]={};continue;
   }
   for(const [date,value] of Object.entries(d[key]))if(!valid(key,{[date]:value})){delete d[key][date];repaired=true;}
  }
  for(const key of ['evidence','ladders','phq','favs','habits']){
   if(!(key in d))continue;
   if(!Array.isArray(d[key])){delete d[key];repaired=true;continue;}
   d[key]=d[key].filter(value=>{if(valid(key,[value]))return true;repaired=true;return false;});
  }
  for(const key of ['settings','plan','weeks','miles','cardNotes','journey','pet']){
   if(key in d&&!(key==='pet'&&d[key]===null)&&(!record(d[key])||!valid(key,d[key]))){delete d[key];repaired=true;}
  }
  if(d.t!=null&&!finite(d.t,0,Number.MAX_SAFE_INTEGER)){delete d.t;repaired=true;}
  if(repaired||d._localRecovery)d._localRecovery=true;
  else delete d._localRecovery;
  return {data:d,repaired};
 }catch(e){return {data:{_localRecovery:true},repaired:true};}
}
function localCoreMayReplace(local,remote){return !local._localRecovery&&(local.t||0)>(remote.t||0);}
function journey(raw){const d=record(raw)?raw:{},discovered={},watered={},games={};for(const k of ['home','library','garden','lake','plaza'])if(day(d.discovered?.[k]))discovered[k]=d.discovered[k];for(const [k,v] of Object.entries(record(d.watered)?d.watered:{}))if(day(k)&&v===true)watered[k]=true;for(const [k,v] of Object.entries(record(d.games)?d.games:{}))if(day(k)&&Number.isInteger(v)&&v>=0)games[k]=v;return {version:1,discovered,watered,games,decor:['lantern','flowers','stars'].includes(d.decor)?d.decor:'lantern',best:finite(d.best,6,1e5)?d.best:null,adventure:record(d.adventure)?d.adventure:null};}
function activeDays(s){const set=new Set([...Object.keys(s.checkins||{}),...Object.keys(s.draws||{})]);for(const h of s.habits||[])for(const [k,v] of Object.entries(h.log||{}))if(v)set.add(k);for(const e of s.evidence||[])if(!e.seed&&e.src!=='里程碑')set.add(e.date);return [...set].filter(day).sort();}
const stages=[{at:0,name:'初到小島',next:'三葉草小徑'},{at:3,name:'三葉草小徑',next:'開花小園'},{at:7,name:'開花小園',next:'微光花房'},{at:14,name:'微光花房',next:'繁花小島'},{at:30,name:'繁花小島',next:null}];
function progress(s){const days=activeDays(s),n=days.length;let level=0;stages.forEach((x,i)=>{if(n>=x.at)level=i;});const current=stages[level],next=stages[level+1];return {days:n,level,name:current.name,next:next?.name||null,remaining:next?next.at-n:0,percent:next?Math.round((n-current.at)/(next.at-current.at)*100):100};}
function tasks(s,k){return [{id:'checkin',name:'留低今日嘅心情',detail:'一分鐘就得',page:'today',done:!!s.checkins?.[k]},{id:'draw',name:'寫一句，遇見一張牌',detail:'收工後慢慢寫',page:'draw',done:!!s.draws?.[k]},{id:'habit',name:'照顧自己一小步',detail:'做咗一個習慣就算',page:'today',done:(s.habits||[]).some(h=>!!h.log?.[k])}];}
function shuffledPairs(random=Math.random){const a=[0,1,2,3,4,5,0,1,2,3,4,5];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function createMemory(random){return {cards:shuffledPairs(random),open:[],matched:[],moves:0,busy:false,complete:false};}
function flipMemory(g,i){if(!g||g.complete||g.busy||!Number.isInteger(i)||i<0||i>=12||g.open.includes(i)||g.matched.includes(i))return 'ignored';g.open.push(i);if(g.open.length<2)return 'open';g.moves++;const [a,b]=g.open;if(g.cards[a]===g.cards[b]){g.matched.push(a,b);g.open=[];g.complete=g.matched.length===12;return g.complete?'complete':'match';}g.busy=true;return 'miss';}
function closeMemory(g){g.open=[];g.busy=false;}
function gameReward(j,k){j.games=j.games||{};const n=Number(j.games[k])||0;j.games[k]=n+1;return n<2?5:0;}
function backupPeriods(before,after){const union=(k,n)=>[...new Set([...Object.keys(before[k]||{}),...Object.keys(after[k]||{})].map(d=>d.slice(0,n)))];return {years:union('checkins',4),months:union('draws',7)};}
return {record,day,validateBackup,readLocal,localCoreMayReplace,journey,activeDays,progress,tasks,stages,createMemory,flipMemory,closeMemory,gameReward,backupPeriods};
});
