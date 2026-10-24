const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/core.js');
const LS='dicky-care-v1',day='2026-10-23';
const ci=(t=1)=>({mood:5,anx:3,energy:6,t});
const evidence={id:'e1',date:day,type:'做到',text:'保留呢條記錄'};
const pet={id:'p1',sp:'cat',name:'雲端伙伴',xp:20,coins:55,needs:{food:80,water:80,energy:80,clean:80,fun:80}};
const cloudCore=()=>({t:10,years:['2025'],drawMonths:['2025-12'],evidence:[evidence],habits:[{id:'h1',name:'散步',log:{[day]:true}}],pet,settings:{theme:'dark'},ladders:[],plan:{warn:'雲端內容'},phq:[],weeks:{},favs:['sun'],miles:{old:true},cardNotes:{sun:'記住'},journey:C.journey()});
const clone=x=>JSON.parse(JSON.stringify(x));
function memoryStorage(entries={}){
 const data=new Map(Object.entries(entries));
 return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))};
}
// Run the actual app storage/auth-loading code, substituting only DOM and I/O.
function app(storage){
 const elements=new Map();
 const node=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',classList:{toggle(){}}});return elements.get(id);};
 const context={localStorage:storage,document:{querySelector:node},window:{JournalCore:C,IslandAdventure:require('../js/adventure.js'),JournalSync:require('../js/sync.js')},hbDefaults:()=>[],render(){},milesSoon(){},setTimeout:()=>1,clearTimeout(){}};
 vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../js/app.js'),'utf8').split('async function connect(){')[0];
 vm.runInContext(source+`globalThis.app={get state(){return S;},persist,loadCloudFor,saveLocal,flush,renderRecoveryStatus,setDb(db){fbDb=db;}};})();`,context);
 return {...context.app,get state(){return context.app.state;},node};
}
function database(core=cloudCore(),options={}){
 const writes=[],reads=[];
 const db={doc:path=>({
  async get(opts){
   reads.push({path,opts:clone(opts)});
   if(options.fail)throw new Error('offline');
   if(path.endsWith('/core')){if(options.wait)await options.wait;return {exists:core!==null,data:()=>clone(core)};}
   if(options.missing)return {exists:false};
   return {exists:true,data:()=>({entries:path.includes('/ci-')?{'2025-01-01':ci()}:{'2025-12-01':{date:'2025-12-01',text:'old',card:'sun',t:1}}})};
  },
  async set(body){writes.push({path,body:clone(body)});}
 })};
 return {db,writes,reads,options};
}

test('local recovery preserves valid siblings and unknown future fields',()=>{
 const original={checkins:{[day]:ci(),'2026-10-22':{mood:99}},evidence:[evidence,{id:'bad',date:'bad',text:'bad'}],pet:{sp:'future-species'},habits:[{id:'h1',log:{}}],futureFeature:{version:2,note:'keep'}};
 const {data,repaired}=C.readLocal(JSON.stringify(original));
 assert.equal(repaired,true);assert.deepEqual(data.checkins,{[day]:ci()});assert.deepEqual(data.evidence,[evidence]);assert.deepEqual(data.habits,original.habits);assert.deepEqual(data.futureFeature,original.futureFeature);assert(!('pet' in data));assert.equal(data._localRecovery,true);
 assert.throws(()=>C.validateBackup(original));
});
test('future fields alone and legacy missing optional fields do not trigger recovery',()=>{
 const original={checkins:{[day]:ci()},futureField:{version:999}};
 assert.deepEqual(C.readLocal(JSON.stringify(original)),{data:{...original,draws:{}},repaired:false});
 assert.deepEqual(C.readLocal(null),{data:null,repaired:false});
});
test('unparseable roots and prototype keys recover without losing valid records',()=>{
 for(const raw of ['{broken','null','[]','123',''])assert.equal(C.readLocal(raw).data._localRecovery,true);
 const result=C.readLocal('{"checkins":{},"evidence":[],"__proto__":{"polluted":true},"future":{"constructor":1,"safe":2}}');
 assert.equal(result.repaired,true);assert.deepEqual(result.data.future,{safe:2});assert.deepEqual(result.data.evidence,[]);assert.equal({}.polluted,undefined);
});
test('local recovery flag survives serialization and blocks newer core replacement',()=>{
 const repaired=C.readLocal('{broken').data;repaired.checkins={[day]:ci()};repaired.t=999;
 const reloaded=C.readLocal(JSON.stringify(repaired));
 assert.equal(reloaded.data._localRecovery,true);assert.equal(C.localCoreMayReplace(reloaded.data,{t:1}),false);
 assert.equal(C.localCoreMayReplace({t:999},{t:1}),true);
});
test('broken cache, offline edit, reload and edit during cloud load preserve remote core and both check-ins',async()=>{
 const raw='{"checkins":',storage=memoryStorage({[LS]:raw});
 let a=app(storage);
 a.state.checkins['2026-10-22']=ci(100);a.persist({year:'2026'});
 assert.equal(storage.getItem(LS+'-unreadable-backup'),raw);
 const offline=database(null,{fail:true});a.setDb(offline.db);await a.loadCloudFor({uid:'u1'});
 assert.equal(offline.writes.length,0);assert.equal(a.state._localRecovery,true);
 a=app(storage);
 let release;const wait=new Promise(r=>release=r),remote=cloudCore(),net=database(remote,{wait});a.setDb(net.db);
 const loading=a.loadCloudFor({uid:'u1'});
 a.state.checkins[day]=ci(200);a.state.pet=null;a.state.evidence=[];a.state.habits=[];a.persist({year:'2026'});
 release();await loading;
 for(const key of ['pet','evidence','habits','favs','cardNotes'])assert.deepEqual(clone(a.state[key]),remote[key]);
 assert.equal(a.state.plan.warn,remote.plan.warn);
 assert(a.state.checkins['2025-01-01']);assert(a.state.checkins['2026-10-22']);assert(a.state.checkins[day]);assert(a.state.draws['2025-12-01']);
 assert.equal(a.state._localRecovery,undefined);
 const coreWrite=net.writes.find(w=>w.path.endsWith('/core')).body;
 assert.deepEqual(coreWrite.pet,remote.pet);assert.deepEqual(coreWrite.evidence,remote.evidence);assert.deepEqual(coreWrite.habits,remote.habits);assert(!('_localRecovery' in coreWrite));
 assert.equal(storage.getItem(LS+'-unreadable-backup'),raw);
 assert.equal(JSON.parse(storage.getItem(LS+'-recovery-edits')).pet,null);
 assert.equal(a.node('#recovery-warning').hidden,false);assert.equal(a.node('#bk-recovery-edits').hidden,false);
 assert(net.reads.every(r=>r.opts.source==='server'));
});
test('partial local corruption does not reset other usable data at startup',()=>{
 const a=app(memoryStorage({[LS]:JSON.stringify({checkins:{[day]:ci()},evidence:[evidence],pet:{name:'bad'},habits:[{id:'h1',log:{}}]})}));
 assert.deepEqual(clone(a.state.evidence),[evidence]);assert(a.state.checkins[day]);assert.equal(a.state.habits.length,1);assert.equal(a.state._localRecovery,true);
 a.renderRecoveryStatus();assert.equal(a.node('#recovery-warning').hidden,false);assert.equal(a.node('#bk-recovery').hidden,false);
});
test('failed partition read leaves recovery pending and never flushes partial cloud data',async()=>{
 const storage=memoryStorage({[LS]:'bad'}),a=app(storage),net=database(cloudCore(),{missing:true});a.setDb(net.db);
 a.state.checkins[day]=ci();a.persist({year:'2026'});await a.loadCloudFor({uid:'u1'});await a.flush();
 assert.equal(net.writes.length,0);assert.equal(a.state._localRecovery,true);assert(a.state.checkins[day]);
 net.options.missing=false;await a.loadCloudFor({uid:'u1'});assert.equal(a.state._localRecovery,undefined);assert.deepEqual(clone(a.state.pet),pet);
});
test('recovery backup write failure blocks cloud writes and keeps local edits',async()=>{
 const storage=memoryStorage({[LS]:'bad'}),a=app(storage),net=database();a.setDb(net.db);
 a.state.checkins[day]=ci();a.persist({year:'2026'});
 const set=storage.setItem;storage.setItem=(k,v)=>{if(k.endsWith('-recovery-edits'))throw new Error('quota');set(k,v);};
 await a.loadCloudFor({uid:'u1'});assert.equal(net.writes.length,0);assert.equal(a.state._localRecovery,true);assert(a.state.checkins[day]);
});
test('a confirmed missing server core safely releases recovery for a new account',async()=>{
 const storage=memoryStorage({[LS]:'bad'}),a=app(storage),net=database(null);a.setDb(net.db);
 a.state.checkins[day]=ci();a.persist({year:'2026'});await a.loadCloudFor({uid:'u1'});
 assert.equal(a.state._localRecovery,undefined);assert(net.writes.some(w=>w.path.endsWith('/core')));assert.equal(storage.getItem(LS+'-unreadable-backup'),'bad');
});
test('valid newer local core retains existing merge behavior',async()=>{
 const local={...cloudCore(),checkins:{},draws:{},t:Date.now(),evidence:[{...evidence,text:'new local'}]};
 const a=app(memoryStorage({[LS]:JSON.stringify(local)})),net=database();a.setDb(net.db);await a.loadCloudFor({uid:'u1'});
 assert.deepEqual(clone(a.state.evidence),local.evidence);assert.equal(a.state.t,local.t);assert(net.writes.some(w=>w.path.endsWith('/core')));
});
test('malformed per-account cache is quarantined when switching accounts',async()=>{
 const storage=memoryStorage({[LS]:JSON.stringify({checkins:{},pet:null}),[LS+'-account-u2']:'bad','dicky-care-firebase-uid-v1':'u1'});
 const a=app(storage),net=database();a.setDb(net.db);await a.loadCloudFor({uid:'u2'});
 assert.deepEqual(clone(a.state.pet),pet);assert.equal(storage.getItem(LS+'-unreadable-backup'),'bad');assert(storage.getItem(LS+'-account-u1'));assert.equal(a.state._localRecovery,undefined);
});

test('null collections recover individually instead of breaking application rendering',()=>{
 const raw=JSON.stringify({checkins:{[day]:ci()},evidence:null,ladders:null,phq:null,weeks:null,pet:null});
 const a=app(memoryStorage({[LS]:raw}));
 assert(a.state.checkins[day]);assert(Array.isArray(a.state.evidence));assert(Array.isArray(a.state.ladders));assert(Array.isArray(a.state.phq));assert.equal(typeof a.state.weeks,'object');assert.notEqual(a.state.weeks,null);assert.equal(a.state.pet,null);assert.equal(a.state._localRecovery,true);
});
test('failure to preserve the raw cache cannot overwrite it or upload defaults',async()=>{
 const storage=memoryStorage({[LS]:'bad'}),a=app(storage),net=database();a.setDb(net.db);
 const set=storage.setItem;storage.setItem=(k,v)=>{if(k.endsWith('-unreadable-backup'))throw new Error('quota');set(k,v);};
 a.state.checkins[day]=ci();a.persist({year:'2026'});await a.loadCloudFor({uid:'u1'});
 assert.equal(storage.getItem(LS),'bad');assert.equal(net.writes.length,0);assert.equal(a.state._localRecovery,true);assert.equal(a.node('#storage-warning').hidden,false);
});
