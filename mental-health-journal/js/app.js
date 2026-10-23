
(function(){
const LS='dicky-care-v1';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const keyOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(k,n)=>{const d=parseKey(k);d.setDate(d.getDate()+n);return keyOf(d);};
const uid=()=>Math.random().toString(36).slice(2,10);
const WD=['日','一','二','三','四','五','六'];
const md=k=>{if(!k)return '';const d=parseKey(k);return (d.getMonth()+1)+'/'+d.getDate();};

function defaults(){
  const today=keyOf(new Date());
  return {
    checkins:{},
    evidence:[
      {id:uid(),date:today,type:'頂住咗唔舒服',text:'失業嗰段日子撐咗落嚟，最後自己搵返工作',seed:true},
      {id:uid(),date:today,type:'頂住咗唔舒服',text:'一個人喺異鄉夜班送單，遇過被騙單、無理客人、架車壞，都繼續做落去',seed:true},
      {id:uid(),date:today,type:'做到',text:'跑步維持到每 2 至 3 日跑 5.5 公里',seed:true},
      {id:uid(),date:today,type:'做到',text:'自己煮泰式青咖喱、白汁魚柳意粉，冇材料都識執生',seed:true},
      {id:uid(),date:today,type:'學識咗',text:'整咗自己嘅外送日報同排班 app，一步步改到啱用',seed:true},
      {id:uid(),date:today,type:'做到',text:'肯面對自己嘅情緒，寫咗一份十部分嘅自我整理',seed:true}
    ],
    ladders:[
      {id:uid(),name:'同人接觸',steps:[
        {id:uid(),text:'交單時同店員或者客人講多一句，例如「辛苦晒」',fear:2,log:[]},
        {id:uid(),text:'喺圖書館或者 café 坐 30 分鐘，唔使同人傾',fear:2,log:[]},
        {id:uid(),text:'去 run club 跑一次，跑完就走都得',fear:4,log:[]},
        {id:uid(),text:'喺 run club 問一個人：「你跑咗幾耐？」',fear:5,log:[]},
        {id:uid(),text:'報一堂有導師帶嘅初學班（舞蹈或者煮食都得）',fear:6,log:[]},
        {id:uid(),text:'約一個認識咗嘅人飲杯嘢',fear:7,log:[]}
      ]},
      {id:uid(),name:'學嘢唔再停喺初階',steps:[
        {id:uid(),text:'揀一樣想學嘅嘢，寫低「學識之後會點」',fear:1,log:[]},
        {id:uid(),text:'搵一個有人帶嘅初學班或者教學資源',fear:3,log:[]},
        {id:uid(),text:'自己練 15 分鐘，記低卡喺邊',fear:4,log:[]},
        {id:uid(),text:'帶住卡住嘅位去問人，講埋自己試過啲咩',fear:4,log:[]},
        {id:uid(),text:'完成一件細作品，唔使完美，記入證據簿',fear:6,log:[]}
      ]}
    ],
    plan:{
      warn:'瞓眠斷開三四段\n成日諗「我係 0」、同人比較\n唔想覆訊息、唔想出門\n連續幾日唔想煮嘢食',
      self:'煮一餐簡單嘅嘢（唔使靚）\n出去跑或者行 20 分鐘\n沖個熱水涼\n翻開證據簿，抽一條嚟睇\n做一次「卡住急救」第一步',
      place:'附近圖書館或者 café 坐吓\nrun club 練跑（跑完就走都得）',
      people:'（寫低名同電話，最好有兩三個）',
      safe:'低潮嗰陣唔飲酒\n將會令自己更差嘅嘢放遠啲\n太攰就早啲收工，唔好硬撐踩車',
      reason:'（例如：想學識嘅嘢、想去嘅地方、想見嘅人）'
    },
    journey:window.JournalCore.journey(), phq:[], weeks:{}, favs:[], draws:{}, pet:null, habits:hbDefaults(), miles:{}, milesInit:1, cardNotes:{},
    settings:{a:'09:00',b:'16:30',theme:'auto',buddy:true},
    t:0
  };
}
function normalize(d){
  const base=defaults();
  if(!d||typeof d!=='object')return base;
  const out=Object.assign(base,d);
  out.settings=Object.assign(defaults().settings,d.settings||{});
  out.plan=Object.assign(defaults().plan,d.plan||{});
  out.checkins=d.checkins||{};
  out.favs=Array.isArray(d.favs)?d.favs:[];
  out.draws=(d.draws&&typeof d.draws==='object')?d.draws:{};
  out.pet=(d.pet&&typeof d.pet==='object')?d.pet:null;
  out.habits=Array.isArray(d.habits)?d.habits:hbDefaults();
  out.miles=(d.miles&&typeof d.miles==='object')?d.miles:{};
  out.milesInit=d.milesInit||(d.miles?1:0);
  out.cardNotes=(d.cardNotes&&typeof d.cardNotes==='object')?d.cardNotes:{};
  out.journey=window.JournalCore.journey(d.journey);
  out.journey.adventure=window.IslandAdventure.campaign(out.journey.adventure);
  return out;
}
let unreadableLocal=false;
function loadLocal(){try{const raw=localStorage.getItem(LS);if(!raw)return null;const d=JSON.parse(raw);window.JournalCore.validateBackup(d);return normalize(d);}catch(e){unreadableLocal=true;return null;}}

let S=loadLocal()||defaults();

/* ---------- storage: local-first + authenticated Google Firebase ---------- */
let fbAuth=null, fbDb=null, fbUser=null, authEpoch=0, cloudInitPending=true;
const CLOUD_UID_KEY='dicky-care-firebase-uid-v1';
let cloud=null; // {core, years:{}}
const dirty={core:false,years:new Set(),months:new Set()};
let flushTimer=null, flushing=false;
function setSync(on,msg){
  $('#sync').classList.toggle('on',!!on);
  $('#sync-txt').textContent=msg;
  const status=$('#google-status');if(status)status.textContent=msg;
  const btn=$('#google-login');if(btn)btn.textContent=fbUser?'登出 Google':'使用 Google 登入';
  const mail=$('#google-email');if(mail)mail.textContent=fbUser?(fbUser.email||'已登入'):'未登入';
}
let storageOK=true;
function saveLocal(){try{if(unreadableLocal){const raw=localStorage.getItem(LS);if(raw)localStorage.setItem(LS+'-unreadable-backup',raw);unreadableLocal=false;}localStorage.setItem(LS,JSON.stringify(S));storageOK=true;}catch(e){storageOK=false;}const warning=$('#storage-warning');if(warning)warning.hidden=storageOK;return storageOK;}
function coreBody(){const years=Array.from(new Set(Object.keys(S.checkins).map(k=>k.slice(0,4))));return {journey:S.journey,evidence:S.evidence,ladders:S.ladders,plan:S.plan,phq:S.phq,weeks:S.weeks,settings:S.settings,favs:S.favs||[],pet:S.pet||null,habits:S.habits||[],miles:S.miles||{},milesInit:S.milesInit||0,cardNotes:S.cardNotes||{},drawMonths:Array.from(new Set(Object.keys(S.draws||{}).map(k=>k.slice(0,7)))),years,t:S.t};}
function monthBody(m){const o={};Object.keys(S.draws||{}).forEach(k=>{if(k.slice(0,7)===m)o[k]=S.draws[k];});return {entries:o};}
function yearBody(y){const o={};Object.keys(S.checkins).forEach(k=>{if(k.slice(0,4)===y)o[k]=S.checkins[k];});return {entries:o};}
function persist(opts){
  S.t=Date.now();
  saveLocal();
  if(opts&&opts.year)dirty.years.add(opts.year);
  if(opts&&opts.month)dirty.months.add(opts.month);
  if(!opts||opts.core!==false)dirty.core=true;
  if(cloud){clearTimeout(flushTimer);flushTimer=setTimeout(flush,700);}
  milesSoon();
}
async function flush(){
 if(!cloud||flushing)return;
 const session=cloud,epoch=authEpoch;flushing=true;
 const current=()=>cloud===session&&epoch===authEpoch;
 try{
  await window.JournalSync.drain({session,isCurrent:current,dirty,monthBody,yearBody,coreBody});
  if(current())setSync(true,storageOK?'已同步 Google Firebase。':'已同步雲端；本機儲存仍未成功，請匯出備份。');
 }catch(e){if(current()){
  setSync(false,storageOK?'雲端同步暫時失敗；本機記錄仍然保留。':'本機同雲端未儲存成功，請立即匯出備份。');
  dirty.core=true;Object.keys(S.checkins).forEach(k=>dirty.years.add(k.slice(0,4)));Object.keys(S.draws||{}).forEach(k=>dirty.months.add(k.slice(0,7)));
 }}finally{flushing=false;if(!current()&&cloud&&(dirty.core||dirty.years.size||dirty.months.size))setTimeout(flush,0);}
}
async function loadCloudFor(user){
  const run=++authEpoch;
  cloud=null;
  setSync(false,'正在讀取 Google 雲端資料…');
  try{
    const previous=localStorage.getItem(CLOUD_UID_KEY);
    if(previous && previous!==user.uid){
      // Keep previous account's data offline, never upload it to a different account.
      localStorage.setItem(LS+'-account-'+previous,JSON.stringify(S));
      const own=localStorage.getItem(LS+'-account-'+user.uid);
      S=own?normalize(JSON.parse(own)):defaults();
      saveLocal();render();
      dirty.core=false;dirty.years.clear();dirty.months.clear();
    }
    localStorage.setItem(CLOUD_UID_KEY,user.uid);
    const base='users/'+user.uid+'/mentalHealthJournal';
    const c={core:fbDb.doc(base+'/core'),year:y=>fbDb.doc(base+'/ci-'+y),month:m=>fbDb.doc(base+'/dr-'+m)};
    const snap=await c.core.get();
    if(run!==authEpoch)return;
    if(snap.exists){
      const remote=snap.data()||{};
      const merged=normalize(JSON.parse(JSON.stringify(remote)));

      merged.checkins={};
      for(const y of (remote.years||[])){
        const ys=await c.year(y).get();if(run!==authEpoch)return;
        if(ys.exists)Object.assign(merged.checkins,JSON.parse(JSON.stringify(ys.data().entries||{})));
      }

      merged.draws={};
      for(const m of (remote.drawMonths||[])){
        const ms=await c.month(m).get();if(run!==authEpoch)return;
        if(ms.exists)Object.assign(merged.draws,JSON.parse(JSON.stringify(ms.data().entries||{})));
      }
      const localCk=S.checkins||{},localDr=S.draws||{};
      const newerMonths=new Set(),newerYears=new Set();
      Object.keys(localDr).forEach(k=>{
        const cur=merged.draws[k];
        if(!cur||(localDr[k].t||0)>(cur.t||0)){merged.draws[k]=localDr[k];newerMonths.add(k.slice(0,7));}
      });
      Object.keys(localCk).forEach(k=>{
        const cur=merged.checkins[k];
        if(!cur||(localCk[k].t||0)>(cur.t||0)){merged.checkins[k]=localCk[k];newerYears.add(k.slice(0,4));}
      });
      const localCoreNewer=(S.t||0)>(remote.t||0);
      if(localCoreNewer){
        try{localStorage.setItem(LS+'-remote-backup-'+user.uid,JSON.stringify(remote));}catch(e){}
        ['journey','evidence','ladders','plan','phq','weeks','settings','favs','pet','habits','miles','milesInit','cardNotes'].forEach(k=>merged[k]=S[k]);
      }
      S=merged;saveLocal();render();
      newerYears.forEach(y=>dirty.years.add(y));
      newerMonths.forEach(m=>dirty.months.add(m));
      if(localCoreNewer||newerYears.size||newerMonths.size)dirty.core=true;
    }else{
      Object.keys(S.checkins||{}).forEach(k=>dirty.years.add(k.slice(0,4)));
      Object.keys(S.draws||{}).forEach(k=>dirty.months.add(k.slice(0,7)));
      dirty.core=true;
    }
    if(run!==authEpoch)return;
    cloud=c;
    if(dirty.core||dirty.months.size||dirty.years.size){
      setSync(false,'Google 登入成功，正在同步…');
      await flush();
    }else setSync(true,'已連接 Google Firebase，資料已更新。');
    cloudInitPending=false;milesSoon();
  }catch(e){
    if(run!==authEpoch)return;
    cloud=null;cloudInitPending=false;milesSoon();
    setSync(false,'Google 同步暫時失敗（'+(e.code||'網絡問題')+'）；本機記錄仍然保留。');
  }
}
async function connect(){
  if(!window.firebase||!window.FIREBASE_CONFIG){
    cloudInitPending=false;milesSoon();
    setSync(false,'Google 同步暫時不可用；資料仍然儲存在本機。');
    return;
  }
  try{
    if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
    fbAuth=firebase.auth();fbDb=firebase.firestore();
    await fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    fbAuth.onAuthStateChanged(user=>{
      fbUser=user||null;
      if(!user){
        authEpoch++;cloud=null;cloudInitPending=false;milesSoon();
        setSync(false,'未登入 Google，資料只儲存在呢個瀏覽器。');
      }else{cloudInitPending=true;loadCloudFor(user);}
    });
    fbAuth.getRedirectResult().catch(e=>setSync(false,'Google 登入未完成（'+(e.code||'')+'），請重試。'));
  }catch(e){cloudInitPending=false;milesSoon();setSync(false,'Firebase 初始化失敗；仍可使用本機手帳。');}
}
$('#google-login').addEventListener('click',async()=>{
  if(!fbAuth)await connect();
  if(!fbAuth){toast('Google 同步暫時不可用');return;}
  if(fbAuth.currentUser){
    try{await fbAuth.signOut();toast('已登出 Google；雲端同步暫停。');}
    catch(e){toast('Google 登出失敗');}
    return;
  }
  const provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try{await fbAuth.signInWithPopup(provider);}
  catch(e){
    if(e&&['auth/popup-blocked','auth/cancelled-popup-request'].includes(e.code)){
      try{await fbAuth.signInWithRedirect(provider);}
      catch(err){setSync(false,'Google 登入失敗：'+(err.code||'請重試'));}
    }else if(e&&e.code==='auth/popup-closed-by-user')toast('已取消 Google 登入');
    else setSync(false,'Google 登入失敗：'+(e.code||'請重試'));
  }
});
window.addEventListener('online',()=>{
  if(cloud&&(dirty.core||dirty.years.size||dirty.months.size))flush();
  else if(fbAuth&&fbAuth.currentUser&&!cloud)loadCloudFor(fbAuth.currentUser);
});

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2000);}
function applyTheme(){document.documentElement.classList.toggle('quiet',!!S.settings.quiet);const t=S.settings.theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');}

/* segmented controls */
function segGet(name){const b=document.querySelector('.seg[data-name="'+name+'"] button.on');return b?b.dataset.v:null;}
function segSet(name,v){$$('.seg[data-name="'+name+'"] button').forEach(b=>b.classList.toggle('on',v!=null&&b.dataset.v===String(v)));}
document.addEventListener('click',e=>{
  const b=e.target.closest('.seg[data-name] button');
  if(!b)return;
  const seg=b.parentElement;
  const wasOn=b.classList.contains('on');
  const sticky=['evtype','range','theme','wth','drawtab','pettab','drawmode','buddy'].includes(seg.dataset.name)||/^phq/.test(seg.dataset.name);
  seg.querySelectorAll('button').forEach(x=>x.classList.remove('on'));
  if(!wasOn||sticky)b.classList.add('on');
  if(seg.dataset.name==='range')renderReview();
});

/* navigation */
const PAGES=['island','arcade','adventure','haven','today','pet','draw','sos','evidence','ladder','wisdom','review','plan','about'];
function go(page){
  if(!PAGES.includes(page))return;
  if(page!=='pet'){stopGame();cancelTrip();}
  if(page!=='haven')stopHaven();
  if(page==='island')renderIsland();
  if(page==='arcade')renderMemory();
  if(page==='adventure')renderAdventure();
  if(page==='haven')renderHaven();
  $$('.page').forEach(p=>p.classList.toggle('on',p.id==='page-'+page));
  $$('.tab').forEach(t=>t.setAttribute('aria-current',(t.dataset.page===page||(t.dataset.page==='island'&&page==='haven')||(t.dataset.page==='arcade'&&page==='adventure'))?'page':'false'));
  if(page==='review')renderReview();
  if(page==='evidence')renderEvidence();
  if(page==='ladder')renderLadders();
  if(page==='wisdom')renderWisdom();
  if(page==='draw')showDrawTab();
  if(page==='pet'){renderPet();petGreet();}else roamStop();
  if(page==='today')renderHabits();
  updBuddy();
  try{history.replaceState(null,'','#'+page);}catch(e){}
  window.scrollTo(0,0);
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>go(t.dataset.page)));
document.addEventListener('click',e=>{const a=e.target.closest('[data-goto]');if(a){e.preventDefault();go(a.dataset.goto);}});

/* time helpers */
function mins(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m;}
function sleepHours(a,b){const x=mins(a),y=mins(b);if(x==null||y==null)return null;let d=y-x;if(d<=0)d+=1440;return Math.round(d/6)/10;}
function circDiff(a,b){const x=mins(a),y=mins(b);if(x==null||y==null)return 0;const d=Math.abs(x-y);return Math.min(d,1440-d)/60;}
function defaultDay(){const n=new Date();if(n.getHours()<12)n.setDate(n.getDate()-1);return keyOf(n);}

/* ---------- 古今智慧 ---------- */
const THEMES=[['fail','怕失敗'],['cmp','同人比較'],['stuck','卡住・焦慮'],['grow','進步慢'],['home','孤獨・異鄉'],['rely','搵人幫手'],['body','作息・身體'],['fun','幽默・放鬆']];
const W=[
 /* 怕失敗 */
 {id:'w01',th:'fail',o:'世以不得第為恥，吾以不得第動心為恥。',s:'王陽明（會試落第之後，見《年譜》）',p:'人哋覺得考唔到係醜，我覺得因為考唔到而亂晒陣先係醜。',u:'王陽明考進士考咗兩次都唔中。失敗本身唔係問題，被失敗嚇到唔敢再試先係。'},
 {id:'w02',th:'fail',o:'塞翁失馬，焉知非福。',s:'《淮南子・人間訓》',p:'塞翁唔見咗匹馬，點知唔係好事？後來匹馬仲帶埋另一匹返嚟。',u:'推銷工做唔掂，只係證明你唔啱截陌生人，唔係證明你冇用。可能正正因為咁，你先搵到夜班送單呢條自由啲嘅路。'},
 {id:'w03',th:'fail',o:'失之東隅，收之桑榆。',s:'《後漢書・馮異傳》',p:'東隅係日出嘅地方，桑榆係日落嘅地方。朝早輸咗，夜晚可以贏返。',u:'一日唔順唔代表一世。今晚爆單唔順，聽晚可以好返。'},
 {id:'w04',th:'fail',o:'古之立大事者，不惟有超世之才，亦必有堅忍不拔之志。',s:'蘇軾《晁錯論》',p:'古時做成大事嘅人，唔止有過人嘅才華，更加有撐得住嘅意志。',u:'你成日話自己冇天份。蘇東坡講明，成事嗰條公式入面，「撐得住」佔一半。'},
 {id:'w05',th:'fail',o:'阻礙行動嘅嘢，會推動行動；擋喺路中間嘅，就變成條路。',s:'馬可・奧理略《沉思錄》（古羅馬皇帝，斯多葛派）',p:'障礙本身就係練習嘅材料。',u:'卡住嗰樣嘢，正正就係你要練嗰樣嘢。'},
 {id:'w06',th:'fail',o:'天行健，君子以自強不息。',s:'《易經・乾卦》',p:'天每日都照轉，君子學佢，日日自己催谷自己，唔停。',u:'唔係叫你日日拼命，係叫你唔好停：今日行一細步都算。'},
 /* 同人比較 */
 {id:'w11',th:'cmp',o:'知人者智，自知者明；勝人者有力，自勝者強。',s:'老子《道德經》第三十三章',p:'識睇人係聰明，識睇自己先係清醒；贏人只係有力，贏自己先叫強。',u:'唔使同人比，同琴日嘅自己比。週回顧嘅圖表就係俾你咁比。'},
 {id:'w12',th:'cmp',o:'人皆知有用之用，而莫知無用之用也。',s:'《莊子・人間世》',p:'人人都識得「有用」嘅用處，冇人識得「冇用」嘅用處。',u:'你嘅價值唔係淨係計你叻唔叻、贏唔贏人。莊子講嗰棵冇用嘅大樹，正因為冇用先冇人斬，活得最長。'},
 {id:'w13',th:'cmp',o:'三人行，必有我師焉。擇其善者而從之，其不善者而改之。',s:'《論語・述而》',p:'三個人一齊行，入面一定有可以教我嘅人。好嘅學，唔好嘅自己改。',u:'見到人叻，當佢係老師，唔係對手。比較嘅目的係學，唔係判自己死刑。'},
 {id:'w14',th:'cmp',o:'一樣米養百樣人。',s:'廣東俗語',p:'食同一樣米，養出一百種唔同嘅人。',u:'你攞人哋最叻嗰樣同成個你比，本身就唔公平。'},
 {id:'w15',th:'cmp',o:'天生我材必有用。',s:'李白《將進酒》',p:'天生我呢副材料，總有用得着嘅地方。',u:'唔係話你一定好勁，係話總有一個位啱你。要做嘅係搵，唔係比。'},
 /* 卡住焦慮 */
 {id:'w21',th:'stuck',o:'破山中賊易，破心中賊難。',s:'王陽明《與楊仕德薛尚謙書》',p:'打山上嘅賊容易，打心入面嘅賊難。',u:'卡住時最大嘅敵人係腦入面嗰句「我搞唔掂」。用卡住急救第二步，將佢叫出嚟。'},
 {id:'w22',th:'stuck',o:'天下難事，必作於易；天下大事，必作於細。',s:'老子《道德經》第六十三章',p:'天下難事，一定由易嘅部分開始；天下大事，一定由細嘅部分開始。',u:'就係卡住急救第三步：拆到最細。'},
 {id:'w23',th:'stuck',o:'令人困擾嘅唔係事情本身，而係我哋對事情嘅看法。',s:'愛比克泰德《手冊》（古羅馬，認知治療嘅思想源頭）',p:'困擾你嘅，係你點樣睇件事。',u:'現代認知行為治療（CBT）就係由呢句發展出嚟。'},
 {id:'w24',th:'stuck',o:'我哋喺想像入面受嘅苦，往往多過現實。',s:'塞涅卡《道德書簡》（古羅馬斯多葛派）',p:'驚嘅時候，個腦會將事情諗到好恐怖。',u:'細步階梯「估幾驚、實際幾驚」就係逐次驗證呢句。'},
 {id:'w25',th:'stuck',o:'山重水複疑無路，柳暗花明又一村。',s:'陸游《遊山西村》',p:'山一重重、水一灣灣，以為冇路；再行多段，柳樹花叢後面又見到一條村。',u:'卡到覺得冇路，通常係仲未行到轉角。'},
 {id:'w26',th:'stuck',o:'莫聽穿林打葉聲，何妨吟嘯且徐行。竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。',s:'蘇軾《定風波》（被貶黃州時，出遊遇雨而作）',p:'唔好理啲雨打樹葉幾大聲，照樣唱住歌慢慢行。拎住竹枝、着住草鞋，仲輕鬆過騎馬，怕咩？成世人就披住件蓑衣行喺風雨入面。',u:'落雨夜送單嗰晚讀呢首。同行嘅人走雨走到好狼狽，蘇東坡照行照唱。'},
 {id:'w27',th:'stuck',o:'天跌落嚟當被冚。',s:'廣東俗語',p:'天塌落嚟，就當棉被咁蓋住瞓。',u:'焦慮到頂嗰陣講一次，通常會笑。最壞嘅情況，多數都捱得過。'},
 {id:'w28',th:'stuck',o:'行到水窮處，坐看雲起時。',s:'王維《終南別業》',p:'行到條河嘅盡頭冇路行，就坐低睇雲慢慢升起。',u:'就係卡住急救第一步：停一停。冇路嗰陣，唔使硬衝。'},
 /* 進步慢 */
 {id:'w31',th:'grow',o:'騏驥一躍，不能十步；駑馬十駕，功在不舍。',s:'荀子《勸學》',p:'千里馬跳一下，都唔夠十步；普通嘅馬拉十日車，成功係因為唔停。',u:'你話自己進步慢？荀子二千幾年前就答咗你：慢唔緊要，唔停就得。'},
 {id:'w32',th:'grow',o:'人一能之，己百之；人十能之，己千之。果能此道矣，雖愚必明，雖柔必強。',s:'《中庸》',p:'人哋做一次識，我做一百次；人哋做十次識，我做一千次。真係咁做，笨都會變聰明，弱都會變強。',u:'唔係叫你自虐，係話次數夠，慢都追得上。'},
 {id:'w33',th:'grow',o:'鍥而舍之，朽木不折；鍥而不舍，金石可鏤。',s:'荀子《勸學》',p:'刻兩刻就放棄，爛木都刻唔斷；一直刻落去，金同石都刻得穿。',u:'你卡喺中階，好多時係喺「刻兩刻」嗰度停咗。'},
 {id:'w34',th:'grow',o:'學而時習之，不亦說乎？',s:'《論語・學而》',p:'學完之後，按時去練，唔係好開心咩？',u:'「學」好新鮮，「習」好悶。進步係喺悶嗰部分發生。'},
 {id:'w35',th:'grow',o:'苟日新，日日新，又日新。',s:'《大學》（商湯刻喺洗面盆上嘅字）',p:'如果今日可以新一啲，就日日都新一啲。',u:'每日新少少就夠，唔使一次過變。'},
 {id:'w36',th:'grow',o:'慢著火，少著水，火候足時他自美。',s:'蘇軾《豬肉頌》（東坡肉嘅原始食譜）',p:'細火、少水，時候夠，自然好食。',u:'你鍾意煮嘢食，應該最明：有啲嘢急唔嚟，火候夠就得。學嘢都係。'},
 {id:'w37',th:'grow',o:'笨鳥先飛。',s:'俗語',p:'飛得慢嘅鳥，早啲出發。',u:'自嘲之餘都係一個好實際嘅方法：知道自己慢，就早啲開始，唔好拖到最後。'},
 /* 孤獨異鄉 */
 {id:'w41',th:'home',o:'此心安處是吾鄉。',s:'蘇軾《定風波・南海歸贈王定國侍人寓娘》',p:'個心安定嘅地方，就係我嘅家鄉。',u:'王定國被貶去嶺南，歌女柔奴跟住佢去。蘇東坡問佢嶺南好唔好，佢就答咗呢句。你喺多倫多，唔使等「融入」先有屋企：固定嘅作息、一餐自己煮嘅飯、一條熟悉嘅跑步路線，就係開始。'},
 {id:'w42',th:'home',o:'人生如逆旅，我亦是行人。',s:'蘇軾《臨江仙・送錢穆父》',p:'人生好似一間旅館，我都只係路過嘅人。',u:'一個人喺異鄉嘅感覺，蘇東坡都有。佢一生被貶到好多地方，最遠去到海南島。'},
 {id:'w43',th:'home',o:'德不孤，必有鄰。',s:'《論語・里仁》',p:'有德嘅人唔會一直孤單，總會有人行埋嚟。',u:'慢慢嚟。你去 run club、報堂初學班，就係俾「鄰」有機會出現。'},
 {id:'w44',th:'home',o:'海內存知己，天涯若比鄰。',s:'王勃《送杜少府之任蜀州》',p:'世界上有知心朋友，就算遠到天邊，都好似住隔籬。',u:'遠方嘅朋友都算數。打個電話返香港，喺打卡都算「傾咗幾句」。'},
 {id:'w45',th:'home',o:'採菊東籬下，悠然見南山。',s:'陶淵明《飲酒・其五》',p:'喺東邊籬笆下摘菊花，悠悠閒閒咁抬頭見到南山。',u:'陶淵明辭官返鄉，一個人種田。孤獨可以係寂寞，都可以係自在，分別在於你有冇俾自己做啲鍾意嘅嘢。'},
 /* 搵人幫手 */
 {id:'w51',th:'rely',o:'敏而好學，不恥下問。',s:'《論語・公冶長》',p:'聰明又好學，唔覺得問比自己低嘅人係羞恥。',u:'問人唔係弱，孔子都讚。重點係試完先問，帶住你試過嘅嘢去問。'},
 {id:'w52',th:'rely',o:'君子求諸己，小人求諸人。',s:'《論語・衛靈公》',p:'君子遇到問題，先喺自己身上搵答案；小人就先靠人或者怪人。',u:'唔係叫你唔好搵人，係先自己試 15 分鐘。'},
 {id:'w53',th:'rely',o:'知之為知之，不知為不知，是知也。',s:'《論語・為政》',p:'識就話識，唔識就認唔識，咁先係真正嘅智慧。',u:'認唔識唔係失敗，係開始學嘅第一步。'},
 {id:'w54',th:'rely',o:'授人以魚，不如授人以漁。',s:'俗語（常被誤當係老子講）',p:'送條魚俾人，不如教佢點釣魚。',u:'搵人幫手時，叫佢教你點做，唔好淨係叫佢幫你做。下次你就識。'},
 {id:'w55',th:'rely',o:'人須在事上磨，方立得住。',s:'王陽明《傳習錄》',p:'人要喺實際做事入面磨練，先企得穩。',u:'自信唔係諗出嚟，係喺做嘢入面磨出嚟。證據簿就係記低你磨過嘅地方。'},
 /* 作息身體 */
 {id:'w61',th:'body',o:'食飲有節，起居有常，不妄作勞。',s:'《黃帝內經・素問・上古天真論》',p:'食嘢有節制，起居有規律，唔好亂咁操勞。',u:'夜班都可以「起居有常」：固定嘅睡眠錨點就係你嘅「常」。'},
 {id:'w62',th:'body',o:'飢來喫飯，睏來即眠。',s:'大珠慧海禪師（《景德傳燈錄》）',p:'有人問禪師點樣修行，佢話：肚餓就食飯，眼瞓就瞓覺。',u:'聽落好簡單，但禪師補充：普通人食飯時諗百樣嘢，瞓覺時又諗千樣嘢。瞓覺就淨係瞓覺，手機放遠啲。'},
 {id:'w63',th:'body',o:'留得青山在，唔怕冇柴燒。',s:'廣東俗語',p:'座山仲喺度，就唔使驚冇柴。',u:'身體同心情係你座青山。好攰就早啲收工，機會遲啲都有。'},
 {id:'w64',th:'body',o:'盛年不重來，一日難再晨。及時當勉勵，歲月不待人。',s:'陶淵明《雜詩・其一》',p:'壯年唔會再嚟，一日都冇兩個朝早。趁而家鼓勵自己，時間唔會等人。',u:'用嚟提自己今日行一細步，唔係用嚟鬧自己浪費咗幾多年。'},
 /* 幽默放鬆 */
 {id:'w71',th:'fun',o:'累累若喪家之狗。……然哉！然哉！',s:'《史記・孔子世家》',p:'孔子同學生失散，有人形容佢「好似一隻冇屋企嘅狗」。子貢轉述，孔子笑住話：「講得啱！講得啱！」',u:'聖人被人話似流浪狗，佢都笑住認。有時自嘲比自責好用好多。'},
 {id:'w72',th:'fun',o:'子非魚，安知魚之樂？',s:'《莊子・秋水》',p:'莊子同惠子喺橋上睇魚，莊子話魚好開心，惠子話：你又唔係魚，點知魚開唔開心？',u:'反過嚟用：你又唔係人哋，點知人哋一定覺得你差？讀心術係焦慮最鍾意玩嘅把戲。'},
 {id:'w73',th:'fun',o:'難得糊塗。',s:'鄭板橋',p:'聰明難，糊塗難，由聰明轉入糊塗更難。',u:'唔使樣樣諗到盡。今日諗唔通嘅事，先放低，瞓醒再算。'},
 {id:'w74',th:'fun',o:'日啖荔枝三百顆，不辭長作嶺南人。',s:'蘇軾《惠州一絕》',p:'如果日日有三百粒荔枝食，我願意一世做嶺南人。',u:'佢被貶去當時算係蠻荒之地，第一時間搵到荔枝就開心晒。你喺多倫多嘅「荔枝」係乜？可以寫入收工三省。'},
 {id:'w75',th:'fun',o:'食得鹹魚抵得渴。',s:'廣東俗語',p:'揀咗食鹹魚，就要預咗口渴。',u:'揀咗夜班嘅自由，就接受佢嘅辛苦，唔使再怨自己點解揀錯。'},
 {id:'w76',th:'fun',o:'行行出狀元。',s:'俗語',p:'每一行都可以出最叻嘅人。',u:'送外賣都有人做到好專業：你自己整日報、計時薪、分析邊間餐廳出餐慢，本身就係專業做法。'}
];
const STORIES=[
 {n:'曾國藩',e:'晚清・湘軍統帥',p:'自己都承認資質一般。相傳有晚佢喺屋企背書，背極都背唔到，連匿埋偷嘢嘅賊都聽到背熟晒，忍唔住跳出嚟背一次俾佢聽先走。佢考秀才都考咗好多次。後來帶兵嘅方法係「結硬寨，打呆仗」：唔靠奇招，一步一步紮實咁做。佢仲日日寫日記檢討自己。',u:'笨方法都係方法。你嘅收工三省同證據簿，其實就係曾國藩嘅日記。'},
 {n:'王陽明',e:'明朝・心學宗師',p:'考進士落第兩次。後來得罪權臣，被打完再貶去貴州龍場，一個語言唔通、條件好差嘅地方。佢就喺嗰度悟出自己嘅學問，史稱「龍場悟道」。',u:'最差嘅環境，都可以係轉捩點。一個人喺陌生地方，唔一定係困局。'},
 {n:'蘇東坡',e:'北宋・文學家',p:'因為「烏台詩案」坐監，差啲冇命，出獄後被貶黃州，冇錢冇地位。佢自己開荒種田，用當時平價嘅豬肉研究出東坡肉，仲喺嗰段日子寫出《赤壁賦》同《定風波》。',u:'佢喺人生最低潮嗰陣煮嘢食、寫嘢，慢慢搵返自己。你都鍾意煮嘢食，呢個唔係細嘢。'},
 {n:'孔子',e:'春秋・思想家',p:'五十幾歲先帶學生周遊列國，十幾年都冇國君肯用佢，喺陳國同蔡國之間仲被困到斷糧。被人笑似喪家狗，佢笑住認。',u:'孔子一生都唔算「成功」，但佢冇因此停止做自己相信嘅嘢。'},
 {n:'韓信',e:'秦漢之際・名將',p:'後生時好窮，要靠人施捨先有飯食。有個屠夫當街逼佢鑽褲襠，佢諗咗一陣，鑽咗。後來成為漢朝開國名將。',u:'一時嘅屈辱，唔定義你係邊個。你遇過嘅無理客人同被騙單，都係咁。'},
 {n:'齊白石',e:'近代・畫家',p:'木匠出身，冇讀過幾多書。五十幾歲定居北京之後，覺得自己畫得唔夠好，決定「衰年變法」，全面改畫風，之後先成為大師。',u:'幾時開始都唔遲。你而家學乜都唔算晚。'},
 {n:'李小龍',e:'香港・武術家',p:'十八歲由香港一個人去美國，喺西雅圖一邊讀書，一邊喺中餐館打工，之後先慢慢開武館教功夫。',u:'同你一樣，都係香港人喺北美由打工開始。佢最出名嘅一句係叫人學水咁：遇到障礙就轉個形狀，繼續流。'},
 {n:'庖丁',e:'寓言・出自《莊子・養生主》',p:'庖丁幫魏王劏牛，把刀用咗十九年都好似新。佢話：「始臣之解牛之時，所見無非牛者。三年之後，未嘗見全牛也。」初學嗰陣，眼前淨係見到成隻牛；三年之後，先睇得出入面嘅紋理。',u:'初學時覺得好亂、無從入手，係正常階段，唔係你特別笨。進步係睇得出「紋理」嗰陣先出現。'}
];
const PAIRS=[
 ['行為激活：行動行先，心情跟尾','王陽明：知行合一、事上磨練'],
 ['認知治療：念頭唔等於事實','愛比克泰德：困擾你嘅係看法；王陽明：破心中賊'],
 ['漸進式面對：由細到唔太驚開始','荀子：不積跬步，無以至千里；老子：大事必作於細'],
 ['自我效能：親身做到先信自己','曾國藩：日記檢討、結硬寨打呆仗'],
 ['自我慈悲：對自己好似對朋友咁','孔子被笑喪家狗，笑住認'],
 ['正念：專注當下','禪宗：飢來喫飯，睏來即眠'],
 ['社會節律：固定作息穩定情緒','《黃帝內經》：起居有常'],
 ['接納與承諾：同困難共存，照行有價值嘅路','蘇東坡：一蓑煙雨任平生']
];
const byId=id=>W.find(x=>x.id===id);
const isFav=id=>(S.favs||[]).includes(id);
function toggleFav(id){S.favs=S.favs||[];if(isFav(id))S.favs=S.favs.filter(x=>x!==id);else S.favs.push(id);persist();renderWisdom();renderPlanFavs();updateDrawFav();}
let drawn=null;
function showDraw(x){drawn=x;$('#draw-orig').textContent='「'+x.o+'」';$('#draw-src').textContent=x.s;$('#draw-plain').textContent='白話：'+x.p;$('#draw-use').innerHTML='<b style="color:var(--red);font-weight:500;margin-right:6px">對你</b>'+esc(x.u);updateDrawFav();}
function updateDrawFav(){if(drawn){$('#draw-fav').textContent=isFav(drawn.id)?'已收藏':'收藏';}}
$('#draw-btn').addEventListener('click',()=>{let x;do{x=W[Math.floor(Math.random()*W.length)];}while(drawn&&x.id===drawn.id&&W.length>1);showDraw(x);});
$('#draw-fav').addEventListener('click',()=>{if(drawn)toggleFav(drawn.id);});
function wisItem(x){return '<div class="wis"><div class="orig">「'+esc(x.o)+'」</div><div class="src"><span>'+esc(x.s)+'</span><button class="star'+(isFav(x.id)?' on':'')+'" data-fav="'+x.id+'">'+(isFav(x.id)?'已收藏':'收藏')+'</button></div><div class="plain">白話：'+esc(x.p)+'</div><div class="use"><b>對你</b>'+esc(x.u)+'</div></div>';}
function renderWisdom(){
  const segEl=document.querySelector('.seg[data-name="wth"]');
  if(!segEl.children.length){segEl.innerHTML=THEMES.map(([k,n],i)=>'<button data-v="'+k+'"'+(i===0?' class="on"':'')+'>'+n+'</button>').join('');}
  const th=segGet('wth')||'fail';
  $('#wis-list').innerHTML=W.filter(x=>x.th===th).map(wisItem).join('');
  $('#stories').innerHTML=STORIES.map(s=>'<div class="sheet story"><span class="era">'+esc(s.e)+'</span><h3>'+esc(s.n)+'</h3><p>'+esc(s.p)+'</p><div class="use"><b>對你</b>'+esc(s.u)+'</div></div>').join('');
  $('#pairs').innerHTML=PAIRS.map(([a,b])=>'<div class="pair"><div><span class="tag">現代心理學</span><b>'+esc(a)+'</b></div><div><span class="tag">古人</span><b>'+esc(b)+'</b></div></div>').join('');
  const favs=(S.favs||[]).map(byId).filter(Boolean);
  $('#fav-list').innerHTML=favs.length?favs.map(x=>'<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「'+esc(x.o)+'」</span><div class="meta">'+esc(x.s)+'</div></div><button class="x" data-fav="'+x.id+'" aria-label="取消收藏">×</button></li>').join(''):'<li class="muted">未收藏。上面揀一句啱心水嘅，撳「收藏」。</li>';
  if(!drawn)showDraw(W[Math.floor(Math.random()*W.length)]);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-fav]');if(b){toggleFav(b.dataset.fav);}});
document.addEventListener('click',e=>{const b=e.target.closest('.seg[data-name="wth"] button');if(b){setTimeout(renderWisdom,0);}});
function renderPlanFavs(){
  let favs=(S.favs||[]).map(byId).filter(Boolean);
  const starter=!favs.length;
  if(starter)favs=['w63','w26','w41','w27'].map(byId);
  $('#plan-favs').innerHTML=favs.map(x=>'<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「'+esc(x.o)+'」</span><div class="meta">'+esc(x.s)+(starter?'・起步句子':'')+'</div><div style="font-size:14px;color:var(--ink-2);margin-top:4px">'+esc(x.u)+'</div></div></li>').join('');
}
/* 手帳自己嘅提醒，同古人句子一齊輪流做「今日一句」 */
const NOTES=[
  ['行動行先，心情跟尾。唔使等有心機先做。','心晴手帳・行為激活'],
  ['你同緊嘅，係一個集合晒全世界優點嘅人。咁比，邊個都輸。','心晴手帳'],
  ['搵人幫唔係錯。先自己試 15 分鐘，再帶住試過嘅嘢去問。','心晴手帳'],
  ['「我係 0」只係一個念頭，唔係一個事實。','心晴手帳・認知脫鉤'],
  ['完成一件麻麻地嘅嘢，好過冇開始一件完美嘅嘢。','心晴手帳']
];
const DAILY=W.map(x=>({o:'「'+x.o+'」',s:x.s,p:x.p,u:x.u})).concat(NOTES.map(([o,s])=>({o,s})));
let dailyIdx=0;
function showDaily(i){dailyIdx=(i+DAILY.length)%DAILY.length;const d=DAILY[dailyIdx];$('#daily-quote').textContent=d.o;$('#daily-src').textContent=d.s;$('#daily-toggle').hidden=!d.p;$('#daily-more').hidden=true;$('#daily-toggle').textContent='點解？';$('#daily-more').innerHTML=d.p?'<span>白話：'+esc(d.p)+'</span><span><b>對你</b>'+esc(d.u)+'</span>':'';}
$('#daily-toggle').addEventListener('click',()=>{const m=$('#daily-more');m.hidden=!m.hidden;$('#daily-toggle').textContent=m.hidden?'點解？':'收埋';});
$('#daily-next').addEventListener('click',()=>showDaily(dailyIdx+1));
function kq(id){const x=byId(id);return x?'<div class="kq">「'+esc(x.o)+'」<small>'+esc(x.s)+'</small></div>':'';}

/* ---------- 收工抽卡 ---------- */
const DECK=[
 {id:'c00',n:'0',name:'愚者',en:'The Fool',tone:'calm',kw:['第一次','新','開始','試','未試過','唔識','學','報名'],
  up:'新開始。唔識唔緊要，愚者嘅意思係肯行第一步。',rev:'開始前唔使諗到完美，亦唔好衝得太盡，帶少少準備就出發。',
  q:'如果唔驚做錯，聽日你想試咩？',act:'揀一樣從未做過嘅細事，聽日做 5 分鐘。',quote:['千里之行，始於足下。','老子《道德經》'],
  story:'愚者係第 0 張，代表旅程起點。廣東人話「初生之犢不畏虎」：初學者最大嘅優勢，就係未學識驚。'},
 {id:'c01',n:'I',name:'魔術師',en:'The Magician',tone:'red',kw:['搞掂','整','做到','方法','解決','執生','諗到','改好'],
  up:'你手上已經有工具。今日你用現有嘅嘢執生到，呢個就係魔術師。',rev:'唔好等齊晒資源先開始，亦唔好以為要識晒先叫有能力。',
  q:'你今日用咗邊樣本事？',act:'將今日執生到嘅事寫入證據簿。',quote:['人須在事上磨，方立得住。','王陽明《傳習錄》'],
  story:'魔術師枱面有齊杯、劍、杖、錢四樣嘢，意思係所需嘅嘢已經喺你面前。王陽明話學問要喺做事入面磨，唔係喺腦入面諗。'},
 {id:'c02',n:'II',name:'女祭司',en:'The High Priestess',tone:'calm',kw:['靜','諗','感覺','直覺','唔知點','迷惘','模糊','唔清楚'],
  up:'今日適合靜落嚟聽吓自己。唔使即刻有答案。',rev:'諗得太多會蓋過直覺。寫低，然後放低。',
  q:'如果唔理人點睇，你心入面其實想點？',act:'瞓前熄燈坐 3 分鐘，唔睇手機。',quote:['行到水窮處，坐看雲起時。','王維《終南別業》'],
  story:'女祭司坐喺兩條柱中間，守住一道簾，代表未講出口嘅知道。禪宗講「不立文字」：有啲答案要靜先聽得到。'},
 {id:'c03',n:'III',name:'皇后',en:'The Empress',tone:'good',kw:['食','飯','照顧','休息','舒服','攰','唞','熱水'],
  up:'滋養。今日食好啲、照顧好自己，唔係懶，係充電。',rev:'顧住做嘢，冇顧自己。今日有冇好好食過一餐？',
  q:'今日你點樣照顧咗自己？',act:'聽日食一餐唔使趕嘅飯，慢慢食。',quote:['留得青山在，唔怕冇柴燒。','廣東俗語'],
  story:'皇后坐喺麥田同河流之間，代表豐盛同滋養。照顧自己唔係自私，係令你可以行得遠嘅燃料。'},
 {id:'c04',n:'IV',name:'皇帝',en:'The Emperor',tone:'ink',kw:['計劃','規律','準時','時間','作息','安排','紀律','瞓覺','鬧鐘'],
  up:'結構。今日有規律、有安排，個人會穩啲。',rev:'作息開始散。唔使嚴厲，但要有一條底線：錨點時間上床。',
  q:'聽日邊個時間係你一定守住嘅？',act:'定一個鬧鐘，錨點時間上床。',quote:['食飲有節，起居有常，不妄作勞。','《黃帝內經》'],
  story:'皇帝坐喺石頭寶座，代表秩序。曾國藩最出名嘅唔係聰明，係幾十年如一日早起、寫日記。'},
 {id:'c05',n:'V',name:'教皇',en:'The Hierophant',tone:'calm',kw:['問人','老師','教','請教','前輩','跟人','學到'],
  up:'向人學。今日有人教你、或者你肯開口問，係好事。',rev:'搵人之前，先自己試 15 分鐘，再帶住試過嘅嘢去問。',
  q:'今日邊個值得你學？學佢邊一樣？',act:'聽日問一個問題，講埋自己試過咩。',quote:['三人行，必有我師焉。','《論語・述而》'],
  story:'教皇代表傳承同老師。孔子話「吾少也賤，故多能鄙事」：佢識咁多嘢，係因為細個窮，乜都要學。'},
 {id:'c06',n:'VI',name:'戀人',en:'The Lovers',tone:'red',kw:['朋友','傾偈','屋企','家人','微笑','多謝','好人','打電話','約'],
  up:'連結。今日有人同你有交流，再細都算。',rev:'唔好將所有希望放喺一個人身上，分散啲。',
  q:'今日邊一刻，你覺得同人有連繫？',act:'聽日主動同一個人講多一句。',quote:['德不孤，必有鄰。','《論語・里仁》'],
  story:'戀人牌除咗講愛，更深嘅意思係「連結」同「選擇」。莊子同惠子成日抬槓，惠子死咗之後，莊子話以後冇人可以傾偈。真朋友唔一定意見一樣。'},
 {id:'c07',n:'VII',name:'戰車',en:'The Chariot',tone:'red',kw:['衝','爆單','趕','快','踩車','落力','拼','頂住','多單'],
  up:'推進。今日你頂住壓力向前，呢份力係真嘅。',rev:'衝得太盡會翻車。踩車送單，攰就停，安全第一。',
  q:'今日你喺邊度頂住咗？',act:'聽日開工前檢查一次架車同燈。',quote:['天行健，君子以自強不息。','《易經・乾卦》'],
  story:'戰車由一黑一白兩隻獸拉，御者唔用韁繩，靠意志控制兩股相反嘅力：衝勁同謹慎。'},
 {id:'c08',n:'VIII',name:'力量',en:'Strength',tone:'good',kw:['忍','耐性','嬲','冷靜','忍住','無理','投訴','差評','鬧'],
  up:'溫柔嘅力量。今日你冇爆，係因為你強，唔係因為你弱。',rev:'忍得太耐都會傷。搵個安全嘅方式抒發，例如跑步。',
  q:'今日邊件事你處理得比以前冷靜？',act:'將「我冇爆」寫入證據簿。',quote:['勝人者有力，自勝者強。','老子《道德經》'],
  story:'力量牌畫住一個人溫柔咁合埋獅子個口，唔係打贏佢，係馴服佢。韓信當街鑽褲襠，唔係冇膽，係知道自己要去邊。'},
 {id:'c09',n:'IX',name:'隱者',en:'The Hermit',tone:'ink',kw:['一個人','孤獨','寂寞','自己','冇人','靜靜','獨處','悶'],
  up:'獨處。一個人唔一定係寂寞，可以係整理自己嘅時間。',rev:'獨處太耐會變孤立。今個星期揀一級細步階梯，見吓人。',
  q:'一個人嘅時候，你最鍾意做咩？',act:'寫低一樣一個人做都開心嘅事。',quote:['採菊東籬下，悠然見南山。','陶淵明《飲酒》'],
  story:'隱者提住一盞燈獨自上山。佢唔係逃避世界，係去搵光，搵到之後會返落山照人。'},
 {id:'c10',n:'X',name:'命運之輪',en:'Wheel of Fortune',tone:'warn',kw:['運','好彩','衰','唔好彩','突然','轉','估唔到','取消'],
  up:'起落。今日嘅運氣唔代表聽日，個輪會轉。',rev:'倒楣嘅一日，唔係你衰，係個輪喺低位。',
  q:'今日有咩係你控制唔到、但處理咗嘅？',act:'分兩欄寫：控制到同控制唔到，只理第一欄。',quote:['塞翁失馬，焉知非福。','《淮南子・人間訓》'],
  story:'命運之輪四角有四隻守護獸喺雲入面讀書：無論個輪點轉，佢哋照學。斯多葛派教人分清「控制到」同「控制唔到」，正正係呢張牌。'},
 {id:'c11',n:'XI',name:'正義',en:'Justice',tone:'ink',kw:['公平','唔公平','錯','怪','責任','計','錢','賠'],
  up:'公平睇事。唔誇大自己嘅錯，亦唔推晒落人。',rev:'你對自己好似唔太公平。用對朋友嘅標準對自己。',
  q:'如果朋友遇到你今日嘅事，你會點同佢講？',act:'用第三人稱寫一次今日嘅事，睇吓有冇唔同。',quote:['知之為知之，不知為不知，是知也。','《論語・為政》'],
  story:'正義一手拎劍，一手拎天秤。天秤唔係用嚟審判，係用嚟睇清楚兩邊。'},
 {id:'c12',n:'XII',name:'吊人',en:'The Hanged Man',tone:'calm',kw:['等','卡住','停','暫停','冇進展','慢','等單'],
  up:'換個角度。卡住嘅時候，倒轉嚟睇，可能有新發現。',rev:'等待唔等於放棄，但亦唔好無限期咁等，定個時限。',
  q:'如果倒轉嚟睇今日卡住嘅事，會見到咩？',act:'用卡住急救第三步，拆一個最細嘅下一步。',quote:['子非魚，安知魚之樂？','《莊子・秋水》'],
  story:'吊人倒吊喺樹上，個樣好平靜，頭上有光。佢自願暫停，換角度睇世界。莊子嘅「無用之用」，就係咁倒轉諗出嚟。'},
 {id:'c13',n:'XIII',name:'蛻變',en:'Transformation',tone:'warn',kw:['結束','唔做','辭','改變','放棄','新階段','搬','轉工'],
  up:'一個階段完咗，另一個開始。結束唔係失敗，係騰位。',rev:'有啲嘢已經唔啱你，但你仲攬住。放低少少。',
  q:'有咩係你可以放低嘅？',act:'執走一樣令你唔舒服嘅舊嘢。',quote:['窮則變，變則通，通則久。','《易經・繫辭》'],
  story:'傳統塔羅嘅第 XIII 號牌講結束同轉化，好似毛蟲變蝴蝶。齊白石五十幾歲「衰年變法」，放低舊畫風，先成為大師。'},
 {id:'c14',n:'XIV',name:'節制',en:'Temperance',tone:'good',kw:['平衡','適量','控制','少少','慢慢','剛好'],
  up:'平衡。唔使去盡，適量就得。',rev:'最近有啲嘢過咗龍：瞓得太少、做得太多、或者手機睇太耐。',
  q:'今日邊樣嘢過咗少少？',act:'聽日將嗰樣減少 15 分鐘。',quote:['過猶不及。','《論語・先進》'],
  story:'節制嘅天使將水由一個杯倒去另一個杯，一滴都唔漏。孔子話做過頭同做唔夠一樣差。'},
 {id:'c15',n:'XV',name:'心中賊',en:'The Devil',tone:'red',kw:['逃避','拖','手機','打機','唔想做','懶','廢','上癮','煙','酒'],
  up:'看見陷阱。你今日見到自己逃避，見到就係開始解。',rev:'條鎖鏈其實好鬆，你隨時除得到。由最細嘅一步開始。',
  q:'今日你喺逃避咩？逃避完，感覺好咗定差咗？',act:'將嗰件事拆細，聽日做第一步 2 分鐘。',quote:['破山中賊易，破心中賊難。','王陽明'],
  story:'傳統叫呢張做「惡魔」，畫住兩個人被鎖住，但細睇條鎖好鬆。王陽明叫呢啲做「心中賊」：懶、驚、拖，唔係你本身，係你可以捉嘅賊。'},
 {id:'c16',n:'XVI',name:'高塔',en:'The Tower',tone:'red',kw:['爆','崩','出事','意外','壞','騙','衰晒','炒','跌','爛'],
  up:'突發打擊。今日有嘢塌咗，唔係你嘅錯都會好難受。',rev:'最壞嘅已經過咗，而家係執拾嘅時間，唔使一次過執晒。',
  q:'今日塌咗嘅嘢入面，有冇一樣仲企得穩？',act:'今晚唔好做任何大決定，瞓醒先算。',quote:['天跌落嚟當被冚。','廣東俗語'],
  story:'高塔被雷劈中，代表突然崩塌。蘇東坡經歷烏台詩案，一夜由高官變階下囚，後來喺黃州寫出一生最好嘅作品。塔塌咗，地基仲喺度。'},
 {id:'c17',n:'XVII',name:'星星',en:'The Star',tone:'calm',kw:['希望','將來','夢','期待','好返','慢慢好','想去'],
  up:'希望同修復。風暴之後，見到星。',rev:'希望唔使好大，一粒細星都夠照路。',
  q:'有咩細嘢令你對聽日有少少期待？',act:'寫低一樣聽日想做嘅開心細事。',quote:['沉舟側畔千帆過，病樹前頭萬木春。','劉禹錫'],
  story:'星星牌喺高塔之後出現：崩塌過後，有人喺水邊慢慢倒水，天上有星。劉禹錫被貶二十三年，返嚟時寫咗呢句：沉船旁邊，仲有千帆駛過。'},
 {id:'c18',n:'XVIII',name:'月亮',en:'The Moon',tone:'warn',kw:['驚','擔心','焦慮','緊張','怕','諗多','唔安','亂諗','瞓唔著'],
  up:'不安同想像。夜晚啲嘢睇落特別大，係個腦喺度放大。',rev:'而家驚緊嘅事，有幾多係真發生咗，幾多係估？',
  q:'你最驚嗰樣嘢，真係發生嘅機會有幾大？',act:'做一次卡住急救第一步：生理嘆氣。',quote:['我哋喺想像入面受嘅苦，往往多過現實。','塞涅卡'],
  story:'月亮牌條路喺兩座塔之間，有狗吠、有龍蝦爬上岸，一切喺月光下都睇唔清。唔係危險變大咗，係光唔夠。天光就會睇清楚。'},
 {id:'c19',n:'XIX',name:'太陽',en:'The Sun',tone:'good',kw:['開心','好彩','爽','靚','好食','笑','正','好天','tips','貼士','讚'],
  up:'簡單嘅快樂。今日有開心嘅嘢，就盡情收下。',rev:'開心唔使有理由，亦唔使驚佢走。收低先。',
  q:'今日最開心嗰一刻係幾時？',act:'將呢一刻寫入收工三省。',quote:['日啖荔枝三百顆，不辭長作嶺南人。','蘇軾《惠州一絕》'],
  story:'太陽牌畫住一個細路騎白馬，好簡單嘅開心。蘇東坡被貶到惠州，第一件事係食荔枝，仲寫詩炫耀。快樂唔一定要等成功先有。'},
 {id:'c20',n:'XX',name:'審判',en:'Judgement',tone:'ink',kw:['反省','明白','原來','醒','發現','後悔','檢討','領悟'],
  up:'醒覺。今日你明白咗一樣嘢，呢個就係進步。',rev:'反省係為咗行前，唔係用嚟鬧自己。三省，唔係三罵。',
  q:'今日你明白咗咩？',act:'用一句說話寫低，放入證據簿「學識咗」。',quote:['吾日三省吾身。','《論語・學而》'],
  story:'審判牌入面天使吹號，人由地下企返起身，意思係重新開始。曾子嘅三省原本問嘅係：幫人有冇盡心、對朋友有冇守信、學咗有冇練，全部都係向前行嘅問題。'},
 {id:'c21',n:'XXI',name:'世界',en:'The World',tone:'good',kw:['完成','做完','終於','成功','達到','一週','完咗'],
  up:'完成一個循環。做完一件事，值得停一停慶祝。',rev:'仲差少少就完，唔好喺最後一步放棄。',
  q:'今日完成咗咩，大定細都算？',act:'獎勵自己一樣細嘢。',quote:['此心安處是吾鄉。','蘇軾《定風波》'],
  story:'世界係大阿爾克那最後一張，人喺花環中央跳舞，代表旅程完成。下一步又返去愚者，重新開始。'},
 {id:'h1',n:'✦',name:'雨中行者',en:'Hidden · Rain',tone:'calm',hidden:true,need:'kw',kw:['雨','落雨','濕','雪','風','凍','冷','打風'],hint:'落雨或者落雪嗰晚，可能遇到佢。',
  up:'風雨入面照行。今晚天氣差都撐完，呢份韌性係你自己嘅。',rev:'濕身唔緊要，路滑就慢啲，安全先。',
  q:'今晚喺風雨入面，你點樣照顧自己？',act:'返到屋企即刻沖熱水涼，飲杯暖嘢。',quote:['莫聽穿林打葉聲，何妨吟嘯且徐行。','蘇軾《定風波》'],
  story:'隱藏牌。蘇東坡同朋友出遊遇大雨，冇遮，人人走雨走到狼狽，佢照行照唱。雨停之後回頭望：也無風雨也無晴。'},
 {id:'h2',n:'✦',name:'夜行者',en:'Hidden · Night Rider',tone:'ink',hidden:true,need:'seven',kw:['單','送','夜','凌晨','收工','開工','uber','doordash'],hint:'抽滿 7 次之後，喺夜班日記入面出現。',
  up:'城市瞓咗，你仲喺路上。夜行者係專屬於你嘅牌。',rev:'夜班會偷走日光同人群，休息日記得見吓太陽、見吓人。',
  q:'今晚嘅城市，有咩只有你見到？',act:'休息日出去曬 20 分鐘太陽。',quote:['人生如逆旅，我亦是行人。','蘇軾《臨江仙》'],
  story:'隱藏牌。凌晨嘅多倫多、未熄燈嘅餐廳、等單嘅幾分鐘，係大部分人冇見過嘅城市。你每晚都喺度。'},
 {id:'h3',n:'✦',name:'灶君',en:'Hidden · Kitchen God',tone:'warn',hidden:true,need:'kw',kw:['煮','落廚','炒','焗','煲','餸','咖喱','意粉','麵'],hint:'寫到煮嘢食嗰日，可能遇到佢。',
  up:'自己煮，自己食。一餐飯係你同自己嘅約定。',rev:'麻煩就整簡單版，公仔麵加隻蛋都算煮。',
  q:'今日煮咗咩？邊一步最滿意？',act:'記低今日個做法，下次改良一樣。',quote:['慢著火，少著水，火候足時他自美。','蘇軾《豬肉頌》'],
  story:'隱藏牌。灶君係中國人廚房入面嘅神，傳統每年年廿三返天庭匯報一家人嘅生活。廚房係一個家最有溫度嘅地方，你嘅都係。'},
 {id:'h4',n:'✦',name:'跑者',en:'Hidden · Runner',tone:'good',hidden:true,need:'kw',kw:['跑','run','公里','km','行山','跑步'],hint:'跑完步嗰日寫日記，可能遇到佢。',
  up:'用腳整理個腦。跑步係你對抗焦慮最實在嘅方法。',rev:'今日唔想跑都唔緊要，行 15 分鐘都算郁。',
  q:'跑嗰陣，你個腦諗緊咩？',act:'下次跑步記低距離同心情。',quote:['騏驥一躍，不能十步；駑馬十駕，功在不舍。','荀子《勸學》'],
  story:'隱藏牌。夸父追日嘅神話講一個巨人追住太陽跑，佢冇追到，但跌低嘅手杖變成一片桃林。跑嘅意義唔一定喺終點。'}
];
const card=id=>DECK.find(c=>c.id===id);
/* 心晴牌 插畫模組：每張牌 300×500，場景區 x26–274、y54–394 */
const ART=(()=>{
let P='',D=[],SEQ=0;
const f=n=>Math.round(n*10)/10;
function rng(seed){let s=(seed>>>0)||7;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function lg(stops,vert=true){const id=P+'g'+D.length;D.push('<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(vert?0:1)+'" y2="'+(vert?1:0)+'">'+stops.map((c,i)=>'<stop offset="'+(stops.length>1?i/(stops.length-1):0)+'" stop-color="'+c+'"/>').join('')+'</linearGradient>');return 'url(#'+id+')';}
function glow(c,o=.85){const id=P+'r'+D.length;D.push('<radialGradient id="'+id+'"><stop offset="0" stop-color="'+c+'" stop-opacity="'+o+'"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>');return 'url(#'+id+')';}
const sky=(...c)=>'<rect x="20" y="48" width="260" height="352" fill="'+lg(c)+'"/>';
const ground=(y,c)=>'<rect x="20" y="'+y+'" width="260" height="'+(400-y)+'" fill="'+c+'"/>';
function hill(y,c,amp=14,ph=0){return '<path d="M20 '+y+'Q'+(85+ph)+' '+(y-amp)+' 150 '+(y-2)+'T280 '+(y-6)+'V400H20Z" fill="'+c+'"/>';}
function mountains(y,c,seed,h=60){const R=rng(seed);let p='M20 '+y;let x=20;while(x<280){const w=34+R()*46;p+='L'+f(x+w/2)+' '+f(y-h*(.55+R()*.55))+'L'+f(Math.min(280,x+w))+' '+y;x+=w;}return '<path d="'+p+'V400H20Z" fill="'+c+'"/>';}
function snowcaps(y,c,seed,h=60){/* same peaks with white caps */const R=rng(seed);let p='',x=20;while(x<280){const w=34+R()*46;const px=x+w/2,py=y-h*(.55+R()*.55);const k=.22;p+='M'+f(px)+' '+f(py)+'L'+f(px-w/2*k)+' '+f(py+(y-py)*k)+'L'+f(px)+' '+f(py+(y-py)*k*.7)+'L'+f(px+w/2*k)+' '+f(py+(y-py)*k)+'Z';x+=w;}return '<path d="'+p+'" fill="'+c+'"/>';}
function cloud(cx,cy,w,c='#ffffff',o=1){const h=w*.36;return '<g fill="'+c+'" opacity="'+o+'"><ellipse cx="'+cx+'" cy="'+cy+'" rx="'+f(w/2)+'" ry="'+f(h/2)+'"/><circle cx="'+f(cx-w*.22)+'" cy="'+f(cy-h*.3)+'" r="'+f(h*.5)+'"/><circle cx="'+f(cx+w*.1)+'" cy="'+f(cy-h*.48)+'" r="'+f(h*.68)+'"/><circle cx="'+f(cx+w*.3)+'" cy="'+f(cy-h*.2)+'" r="'+f(h*.45)+'"/></g>';}
function stars(n,seed,c='#ffffff',y0=58,y1=210,x0=30,x1=270){const R=rng(seed);let s='';for(let i=0;i<n;i++)s+='<circle cx="'+f(x0+R()*(x1-x0))+'" cy="'+f(y0+R()*(y1-y0))+'" r="'+f(.5+R()*1.3)+'" fill="'+c+'" opacity="'+f(.45+R()*.55)+'"/>';return s;}
function star8(cx,cy,r,fill,k=.38,stroke){let p='';for(let i=0;i<16;i++){const a=Math.PI*i/8-Math.PI/2,rr=i%2?r*k:r;p+=(i?'L':'M')+f(cx+rr*Math.cos(a))+' '+f(cy+rr*Math.sin(a));}return '<path d="'+p+'Z" fill="'+fill+'"'+(stroke?' stroke="'+stroke+'" stroke-width="1"':'')+'/>';}
function star5(cx,cy,r,fill,stroke){let p='';for(let i=0;i<5;i++){const a=-Math.PI/2+i*4*Math.PI/5;p+=(i?'L':'M')+f(cx+r*Math.cos(a))+' '+f(cy+r*Math.sin(a));}return '<path d="'+p+'Z" fill="'+fill+'" stroke="'+(stroke||'none')+'" stroke-width="1.2" stroke-linejoin="round"/>';}
function sun(cx,cy,r,face,core='#f7c948',ray='#e39b22'){let s='<circle cx="'+cx+'" cy="'+cy+'" r="'+f(r*2.1)+'" fill="'+glow('#fff3b0',.7)+'"/>';for(let i=0;i<24;i++){const a=Math.PI*2*i/24,a1=r*1.12,l=i%2?r*1.5:r*1.85;if(i%2)s+='<path d="M'+f(cx+Math.cos(a)*a1)+' '+f(cy+Math.sin(a)*a1)+'L'+f(cx+Math.cos(a)*l)+' '+f(cy+Math.sin(a)*l)+'" stroke="'+ray+'" stroke-width="2.4" stroke-linecap="round"/>';else{const b=a+.09,c2=a-.09;s+='<path d="M'+f(cx+Math.cos(b)*a1)+' '+f(cy+Math.sin(b)*a1)+'L'+f(cx+Math.cos(a)*l)+' '+f(cy+Math.sin(a)*l)+'L'+f(cx+Math.cos(c2)*a1)+' '+f(cy+Math.sin(c2)*a1)+'Z" fill="'+ray+'"/>';}}
 s+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+core+'" stroke="'+ray+'" stroke-width="2"/>';
 if(face)s+='<path d="M'+f(cx-r*.42)+' '+f(cy-r*.12)+'q'+f(r*.14)+' '+f(-r*.14)+' '+f(r*.28)+' 0M'+f(cx+r*.14)+' '+f(cy-r*.12)+'q'+f(r*.14)+' '+f(-r*.14)+' '+f(r*.28)+' 0M'+f(cx-r*.3)+' '+f(cy+r*.3)+'q'+f(r*.3)+' '+f(r*.22)+' '+f(r*.6)+' 0" stroke="#b5751c" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="'+f(cx-r*.5)+'" cy="'+f(cy+r*.15)+'" r="'+f(r*.1)+'" fill="#f0a24a" opacity=".6"/><circle cx="'+f(cx+r*.5)+'" cy="'+f(cy+r*.15)+'" r="'+f(r*.1)+'" fill="#f0a24a" opacity=".6"/>';
 return s;}
function crescent(cx,cy,r,fill,k=.78){return '<path d="M'+cx+' '+f(cy-r)+'A'+r+' '+r+' 0 1 0 '+cx+' '+f(cy+r)+'A'+f(r*k)+' '+r+' 0 1 1 '+cx+' '+f(cy-r)+'Z" fill="'+fill+'"/>';}
function rose(x,y,r,c='#b73b3b',d='#7a1f1f'){return '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/><path d="M'+f(x-r*.5)+' '+y+'a'+f(r*.5)+' '+f(r*.5)+' 0 1 1 '+f(r*.5)+' '+f(r*.5)+'" stroke="'+d+'" stroke-width="1" fill="none"/>';}
function leaf(x,y,a,c='#5d8a4e',l=10){return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+f(l/2)+'" ry="'+f(l/5)+'" transform="rotate('+a+' '+x+' '+y+')" fill="'+c+'"/>';}
function lily(x,y,s=1){return '<g transform="translate('+x+' '+y+') scale('+s+')"><path d="M0 0V-18" stroke="#5d8a4e" stroke-width="1.6"/><path d="M0 -18L-6 -28L-2 -20L0 -32L2 -20L6 -28Z" fill="#fbf8ef" stroke="#c8c0aa" stroke-width=".6"/>'+leaf(-4,-8,-40,'#5d8a4e',9)+'</g>';}
function sunflower(x,y,s=1){let g='<path d="M0 0V-34" stroke="#4f7a3e" stroke-width="2.4"/>'+leaf(-6,-14,-30,'#5d8a4e',12)+leaf(6,-20,30,'#5d8a4e',12);for(let i=0;i<12;i++){const a=i*30;g+='<ellipse cx="0" cy="-48" rx="3.2" ry="9" fill="#f2b71e" transform="rotate('+a+' 0 -40)"/>';}g+='<circle cx="0" cy="-40" r="6" fill="#6b4a2a"/>';return '<g transform="translate('+x+' '+y+') scale('+s+')">'+g+'</g>';}
function wheat(x,y,h,c='#d9a83f'){let s='<path d="M'+x+' '+y+'V'+(y-h)+'" stroke="#b8862f" stroke-width="1.3"/>';for(let i=0;i<5;i++)s+=leaf(x-2.4,y-h+3+i*4.6,-38,c,7.5)+leaf(x+2.4,y-h+3+i*4.6,38,c,7.5);return s;}
function cypress(x,y,h,c='#2f5a3c'){return '<path d="M'+x+' '+(y-h)+'Q'+f(x+h*.17)+' '+f(y-h*.45)+' '+x+' '+y+'Q'+f(x-h*.17)+' '+f(y-h*.45)+' '+x+' '+(y-h)+'Z" fill="'+c+'"/>';}
function tree(x,y,h,lc='#3f6b45',tc='#5c3d24',lc2){return '<path d="M'+(x-3.5)+' '+y+'L'+(x-2)+' '+f(y-h*.5)+'H'+(x+2)+'L'+(x+3.5)+' '+y+'Z" fill="'+tc+'"/><circle cx="'+x+'" cy="'+f(y-h*.62)+'" r="'+f(h*.3)+'" fill="'+lc+'"/><circle cx="'+f(x-h*.2)+'" cy="'+f(y-h*.52)+'" r="'+f(h*.2)+'" fill="'+lc+'"/><circle cx="'+f(x+h*.2)+'" cy="'+f(y-h*.55)+'" r="'+f(h*.21)+'" fill="'+(lc2||lc)+'"/>';}
function pillar(x,top,w,c,cap,label,lc,bottom=400){return '<rect x="'+x+'" y="'+top+'" width="'+w+'" height="'+(bottom-top)+'" fill="'+c+'"/><rect x="'+(x+w*.18)+'" y="'+top+'" width="'+f(w*.1)+'" height="'+(bottom-top)+'" fill="#ffffff" opacity=".12"/><rect x="'+(x-5)+'" y="'+(top-10)+'" width="'+(w+10)+'" height="12" rx="2" fill="'+cap+'"/><rect x="'+(x-2)+'" y="'+(top-16)+'" width="'+(w+4)+'" height="7" rx="2" fill="'+cap+'"/>'+(label?'<text x="'+(x+w/2)+'" y="'+(top+42)+'" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="'+lc+'">'+label+'</text>':'');}
function wand(x1,y1,x2,y2,c='#8a5a33',w=4){return '<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"/>';}
function cup(x,y,s=1,c='#e0bd5a',st='#8a6d2f'){return '<g transform="translate('+x+' '+y+') scale('+s+')"><path d="M-11 -30H11Q11 -14 2.5 -9V-3H8V2H-8V-3H-2.5V-9Q-11 -14 -11 -30Z" fill="'+c+'" stroke="'+st+'" stroke-width="1.1" stroke-linejoin="round"/><path d="M-7 -26Q-7 -16 -2 -12" stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none"/></g>';}
function jug(x,y,s=1,a=0,c='#c24a3a'){return '<g transform="translate('+x+' '+y+') rotate('+a+') scale('+s+')"><path d="M-8 -20Q-12 -6 -8 4H8Q12 -6 8 -20L10 -24H-10Z" fill="'+c+'" stroke="#7a2a20" stroke-width="1"/><path d="M8 -16Q16 -12 9 -4" stroke="#7a2a20" stroke-width="1.6" fill="none"/></g>';}
function sword(x,y,len,ang,c='#d4d9e0'){return '<g transform="translate('+x+' '+y+') rotate('+ang+')"><path d="M-2.6 0V-'+len+'L0 -'+(len+9)+'L2.6 -'+len+'V0Z" fill="'+c+'" stroke="#6b7280" stroke-width=".8"/><path d="M0 -4V-'+(len-2)+'" stroke="#9aa2ad" stroke-width=".8"/><rect x="-10" y="-1.5" width="20" height="4.5" rx="1.5" fill="#d8b45a" stroke="#8a6d2f" stroke-width=".6"/><rect x="-2.2" y="3" width="4.4" height="13" rx="1" fill="#6b4a2a"/><circle cx="0" cy="17.5" r="2.8" fill="#d8b45a"/></g>';}
function coin(cx,cy,r){return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="#e3bf5c" stroke="#8a6d2f" stroke-width="1.2"/><circle cx="'+cx+'" cy="'+cy+'" r="'+f(r*.8)+'" fill="none" stroke="#8a6d2f" stroke-width=".6"/>'+star5(cx,cy,r*.66,'none','#8a6d2f');}
function inf(cx,cy,w,c='#d8b45a',sw=3){const h=w/2.2;return '<path d="M'+cx+' '+cy+'C'+f(cx-w*.2)+' '+f(cy-h)+' '+f(cx-w*.5)+' '+f(cy-h)+' '+f(cx-w*.5)+' '+cy+'S'+f(cx-w*.2)+' '+f(cy+h)+' '+cx+' '+cy+'S'+f(cx+w*.5)+' '+f(cy-h)+' '+f(cx+w*.5)+' '+cy+'S'+f(cx+w*.2)+' '+f(cy+h)+' '+cx+' '+cy+'Z" stroke="'+c+'" stroke-width="'+sw+'" fill="none"/>';}
function brick(x,y,w,h,c='#9a8f7c',line='#7f7563',rowH=10){let s='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';for(let r=0;r*rowH<h;r++){const yy=y+r*rowH;s+='<path d="M'+x+' '+yy+'H'+(x+w)+'" stroke="'+line+'" stroke-width=".7"/>';for(let xx=x+(r%2?10:0);xx<x+w;xx+=20)s+='<path d="M'+xx+' '+yy+'V'+Math.min(y+h,yy+rowH)+'" stroke="'+line+'" stroke-width=".7"/>';}return s;}
function waterLines(y0,y1,c='#ffffff',o=.35,seed=3){const R=rng(seed);let s='';for(let i=0;i<10;i++){const y=y0+R()*(y1-y0),x=28+R()*220;s+='<path d="M'+f(x)+' '+f(y)+'h'+f(10+R()*20)+'" stroke="'+c+'" stroke-opacity="'+o+'" stroke-width="1.4" stroke-linecap="round"/>';}return s;}

/* 正面人物：腳底喺 (x,y)，身高約 140*s */
const POSE={down:[[-21,-48],[21,-48]],up:[[-21,-50],[24,-132]],out:[[-46,-78],[46,-78]],hold:[[-9,-60],[9,-60]],pour:[[-36,-98],[36,-56]],raise2:[[-30,-130],[30,-130]],bless:[[-12,-60],[24,-114]],lantern:[[-26,-54],[32,-104]],walk:[[-26,-54],[28,-108]],regal:[[-28,-66],[28,-98]],justice:[[-36,-72],[24,-112]],reach:[[-16,-58],[36,-74]],back:[[-9,-70],[9,-70]],dance:[[-46,-96],[44,-58]],bless2:[[-32,-66],[24,-114]],temper:[[-32,-86],[30,-58]]};
function person(o){
 const s=o.s||1,x=o.x,y=o.y,robe=o.robe||'#3d5a80',trim=o.trim||'#d8b45a',skin=o.skin||'#efd0ad',hair=o.hair||'#2a1d14';
 const pose=POSE[o.pose||'down'];let g='';
 if(o.wings)g+='<path d="M-12 -86C-58 -132 -92 -74 -62 -22C-50 -46 -36 -64 -12 -72Z" fill="'+o.wings+'"/><path d="M-14 -82C-48 -112 -74 -72 -58 -36" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none"/><path d="M12 -86C58 -132 92 -74 62 -22C50 -46 36 -64 12 -72Z" fill="'+o.wings+'"/><path d="M14 -82C48 -112 74 -72 58 -36" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none"/>';
 if(o.halo)g+='<circle cx="0" cy="-112" r="22" fill="'+o.halo+'" opacity=".28"/><circle cx="0" cy="-112" r="22" fill="none" stroke="'+o.halo+'" stroke-width="2.2"/>';
 if(o.cape)g+='<path d="M-16 -88Q-30 -40 -36 2H36Q30 -40 16 -88Z" fill="'+o.cape+'"/><path d="M-22 -40Q-26 -18 -30 0M22 -40Q26 -18 30 0" stroke="#000" stroke-opacity=".15" stroke-width="1.4" fill="none"/>';
 if(o.long)g+='<path d="M-14 -116Q-19 -94 -16 -84H-8Q-12 -98 -11 -114ZM14 -116Q19 -94 16 -84H8Q12 -98 11 -114Z" fill="'+hair+'"/>';
 g+='<path d="M-24 0Q-21 -48 -16 -86Q0 -96 16 -86Q21 -48 24 0Z" fill="'+robe+'"/>';
 if(o.pattern)g+=o.pattern;
 g+='<path d="M-9 -46Q-12 -22 -15 -3M9 -46Q12 -22 15 -3M0 -54V-3" stroke="#000" stroke-opacity=".13" stroke-width="1.4" fill="none"/>';
 g+='<path d="M-24 0Q-21 -48 -16 -86" stroke="#000" stroke-opacity=".12" stroke-width="3" fill="none"/>';
 g+='<rect x="-24.5" y="-7" width="49" height="7" fill="'+trim+'"/><path d="M-24.5 -3.5H24.5" stroke="#000" stroke-opacity=".15" stroke-dasharray="2 3"/><rect x="-17" y="-64" width="34" height="4.5" rx="1" fill="'+(o.belt||trim)+'"/><path d="M-8 -90Q0 -80 8 -90" stroke="'+trim+'" stroke-width="2.4" fill="none"/>';
 if(o.chest)g+=o.chest;
 pose.forEach(([hx,hy],i)=>{const sx=i?14:-14;const mx=f((sx+hx)/2+(i?3:-3)),my=f((-84+hy)/2);g+='<path d="M'+sx+' -84Q'+mx+' '+my+' '+hx+' '+hy+'" stroke="'+(o.sleeve||robe)+'" stroke-width="10.5" stroke-linecap="round" fill="none"/><path d="M'+sx+' -84Q'+mx+' '+my+' '+hx+' '+hy+'" stroke="#000" stroke-opacity=".1" stroke-width="10.5" stroke-dasharray="0 6 30" fill="none"/><circle cx="'+hx+'" cy="'+hy+'" r="4.8" fill="'+skin+'"/>';});
 g+='<path d="M-4 -101H4V-90H-4Z" fill="'+skin+'"/><path d="M-4 -94H4" stroke="#000" stroke-opacity=".12"/><ellipse cx="0" cy="-112" rx="12.5" ry="13.5" fill="'+skin+'"/>';
 g+='<path d="M-13.5 -110Q-15.5 -129 0 -128Q15.5 -129 13.5 -110Q10 -121 2 -121Q-4 -117 -13.5 -110Z" fill="'+hair+'"/>';
 if(o.beard)g+='<path d="M-11 -110Q-12 -84 0 -78Q12 -84 11 -110Q6 -101 0 -102Q-6 -101 -11 -110Z" fill="'+o.beard+'"/><path d="M-6 -104Q0 -107 6 -104" stroke="'+o.beard+'" stroke-width="2.4" fill="none"/>';
 g+='<path d="M-7 -113.5Q-4.6 -115.5 -2.2 -113.5M2.2 -113.5Q4.6 -115.5 7 -113.5" stroke="#3a2a20" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
 if(o.eyesOpen)g+='<circle cx="-4.6" cy="-112" r="1.4" fill="#3a2a20"/><circle cx="4.6" cy="-112" r="1.4" fill="#3a2a20"/>';
 if(!o.beard)g+='<path d="M-2.8 -105Q0 -103.2 2.8 -105" stroke="#a0624a" stroke-width="1.2" fill="none" stroke-linecap="round"/><circle cx="-7" cy="-107" r="2" fill="#e6a08a" opacity=".45"/><circle cx="7" cy="-107" r="2" fill="#e6a08a" opacity=".45"/>';
 if(o.hood)g+='<path d="M-17 -98Q-21 -138 0 -138Q21 -138 17 -98Q14 -124 0 -125Q-14 -124 -17 -98Z" fill="'+o.hood+'"/>';
 if(o.crown)g+='<path d="M-12.5 -121V-134L-6 -128L0 -140L6 -128L12.5 -134V-121Z" fill="'+o.crown+'" stroke="#8a6d2f" stroke-width=".8" stroke-linejoin="round"/><circle cx="0" cy="-127" r="1.8" fill="#b73b3b"/>';
 if(o.tiara)g+='<path d="M-11 -122V-146Q0 -160 11 -146V-122Z" fill="'+o.tiara+'" stroke="#8a6d2f" stroke-width=".8"/><path d="M-11 -130H11M-11 -138H11" stroke="#8a6d2f" stroke-width="1.6"/><path d="M0 -156V-163M-3 -160H3" stroke="#8a6d2f" stroke-width="1.4"/>';
 if(o.wreath)g+='<path d="M-14 -119Q0 -129 14 -119" stroke="'+o.wreath+'" stroke-width="4" fill="none" stroke-dasharray="3.5 2" stroke-linecap="round"/>';
 if(o.hat)g+=o.hat;
 const H=pose.map(([hx,hy])=>[f(x+hx*s),f(y+hy*s)]);
 return {svg:'<g transform="translate('+x+' '+y+') scale('+s+')">'+g+'</g>',L:H[0],R:H[1],head:[x,f(y-112*s)]};
}
/* 背面人物（跪低、睇唔到面） */
function backFig(x,y,s,robe,hair,pattern=''){return '<g transform="translate('+x+' '+y+') scale('+s+')"><path d="M-26 0Q-24 -46 -16 -78Q0 -88 16 -78Q24 -46 26 0Z" fill="'+robe+'"/>'+pattern+'<path d="M-9 -40Q-12 -20 -14 0M9 -40Q12 -20 14 0" stroke="#000" stroke-opacity=".14" stroke-width="1.4" fill="none"/><ellipse cx="0" cy="-92" rx="12" ry="13" fill="'+hair+'"/><path d="M-10 -84H10" stroke="#000" stroke-opacity=".15"/></g>';}
/* 側面動物 */
function quad(o){
 const s=o.s||1,c=o.c||'#f4f1ea',d=o.dir||1,sh=o.shade||'#000';let g='';
 g+='<path d="M-28 -32Q-44 -40 -40 -58" stroke="'+c+'" stroke-width="'+(o.lion?3.5:4.5)+'" fill="none" stroke-linecap="round"/>'+(o.lion?'<circle cx="-40" cy="-58" r="4" fill="'+(o.mane||c)+'"/>':'');
 if(o.lying)g+='<ellipse cx="-14" cy="-6" rx="16" ry="6" fill="'+c+'"/><ellipse cx="20" cy="-5" rx="16" ry="5" fill="'+c+'"/>';
 else [[-22,-1],[-12,1],[12,-1],[22,1]].forEach(([lx,dx])=>{g+='<path d="M'+lx+' -20L'+(lx+dx)+' -1" stroke="'+c+'" stroke-width="7" stroke-linecap="round"/><path d="M'+(lx+dx-3)+' -1H'+(lx+dx+4)+'" stroke="'+sh+'" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>';});
 g+='<ellipse cx="0" cy="'+(o.lying?-18:-28)+'" rx="31" ry="14" fill="'+c+'"/><path d="M-26 '+(o.lying?-12:-22)+'Q0 '+(o.lying?-4:-14)+' 26 '+(o.lying?-12:-22)+'" stroke="'+sh+'" stroke-opacity=".15" stroke-width="2" fill="none"/>';
 const hy=o.lying?-44:-56;
 g+='<path d="M20 '+(hy+22)+'L32 '+(hy+4)+'" stroke="'+c+'" stroke-width="15" stroke-linecap="round"/>';
 if(o.mane){for(let i=0;i<14;i++){const a=i*Math.PI*2/14;g+='<ellipse cx="'+f(36+Math.cos(a)*13)+'" cy="'+f(hy+Math.sin(a)*13)+'" rx="7" ry="4.5" transform="rotate('+f(a*180/Math.PI)+' '+f(36+Math.cos(a)*13)+' '+f(hy+Math.sin(a)*13)+')" fill="'+o.mane+'"/>';}}
 g+='<ellipse cx="38" cy="'+hy+'" rx="'+(o.lion?11:10)+'" ry="'+(o.lion?10:8.5)+'" fill="'+c+'"/><path d="M44 '+(hy-3)+'Q55 '+(hy)+' 53 '+(hy+4)+'Q48 '+(hy+7)+' 42 '+(hy+5)+'Z" fill="'+c+'"/><circle cx="53" cy="'+(hy+1.5)+'" r="1.8" fill="#2b2420"/>';
 if(!o.lion)g+='<path d="M32 '+(hy-6)+'L28 '+(hy-17)+'L37 '+(hy-8)+'Z" fill="'+(o.ear||c)+'"/>';
 else g+='<circle cx="31" cy="'+(hy-9)+'" r="3.5" fill="'+c+'"/>';
 g+='<circle cx="42" cy="'+(hy-2.5)+'" r="1.6" fill="#2b2420"/>';
 if(o.collar)g+='<path d="M24 '+(hy+12)+'L34 '+(hy+16)+'" stroke="'+o.collar+'" stroke-width="3"/>';
 return '<g transform="translate('+o.x+' '+o.y+') scale('+f(s*d)+' '+s+')">'+g+'</g>';
}
/* 側面單車外賣員（向右） */
function rider(o){const sc=o.s||1;let g='';
 if(o.lamp)g+='<path d="M36 -68L150 -100L150 -26Z" fill="'+glow(o.lamp,.55)+'"/>';
 [[-40,-24],[40,-24]].forEach(([wx,wy])=>{g+='<circle cx="'+wx+'" cy="'+wy+'" r="22" fill="none" stroke="#17171c" stroke-width="5"/><circle cx="'+wx+'" cy="'+wy+'" r="19" fill="none" stroke="#9aa2ad" stroke-width=".8" stroke-dasharray="1 5"/><circle cx="'+wx+'" cy="'+wy+'" r="3.2" fill="#9aa2ad"/>';});
 g+='<path d="M-40 -24L-10 -24L20 -60M-10 -24L-20 -62L20 -60L40 -24M-27 -64H-12M20 -60L24 -74H34" stroke="'+(o.frame||'#9b2c2c')+'" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
 g+='<path d="M-10 -24L-4 -14" stroke="#555" stroke-width="2"/>';
 g+='<rect x="-50" y="-132" width="38" height="42" rx="5" fill="'+(o.bag||'#2b2a28')+'"/><rect x="-50" y="-118" width="38" height="6" fill="#000" opacity=".22"/><rect x="-46" y="-128" width="12" height="6" rx="2" fill="#fff" opacity=".25"/>';
 g+='<path d="M-16 -70L6 -48L-2 -30" stroke="'+(o.pants||'#2a2a33')+'" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-6 -30H4" stroke="#17171c" stroke-width="4" stroke-linecap="round"/>';
 g+='<path d="M-22 -66L-6 -114Q4 -118 14 -110L4 -66Z" fill="'+(o.coat||'#e8c23a')+'"/><path d="M-12 -92L6 -88" stroke="#000" stroke-opacity=".15" stroke-width="2"/>';
 g+='<path d="M6 -106Q20 -96 33 -74" stroke="'+(o.coat||'#e8c23a')+'" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="34" cy="-73" r="4.4" fill="#efd0ad"/>';
 g+='<ellipse cx="16" cy="-122" rx="10" ry="10.5" fill="#efd0ad"/><circle cx="21" cy="-123" r="1.3" fill="#3a2a20"/><path d="M4 -122Q4 -138 18 -138Q30 -137 30 -124Q22 -128 4 -122Z" fill="'+(o.helmet||'#2b2a28')+'"/><path d="M8 -132Q18 -136 26 -130" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" fill="none"/>';
 if(o.hood)g+='<path d="M2 -118Q0 -140 16 -142Q32 -142 32 -124" stroke="'+o.hood+'" stroke-width="4" fill="none"/>';
 return '<g transform="translate('+o.x+' '+o.y+') scale('+sc+')">'+g+'</g>';}
/* 側面跑者（向右） */
function runner(o){let g='';const sk='#efd0ad';
 g+='<path d="M-2 -62L-16 -38L-34 -36" stroke="'+(o.shorts||'#2b2a28')+'" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M-16 -38L-34 -36" stroke="'+sk+'" stroke-width="7" stroke-linecap="round"/><path d="M-40 -40L-30 -33" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/>';
 g+='<path d="M-6 -88Q-18 -76 -10 -66" stroke="'+sk+'" stroke-width="6" fill="none" stroke-linecap="round"/>';
 g+='<path d="M-6 -60L-2 -108Q8 -112 16 -104L8 -60Z" fill="'+(o.shirt||'#9b2c2c')+'"/><path d="M-6 -66H8" stroke="'+(o.shorts||'#2b2a28')+'" stroke-width="10"/>';
 g+='<path d="M2 -60L20 -38L12 -6" stroke="'+sk+'" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 -62L18 -42" stroke="'+(o.shorts||'#2b2a28')+'" stroke-width="10" stroke-linecap="round"/><path d="M8 -4H22" stroke="#f4f1ea" stroke-width="6" stroke-linecap="round"/>';
 g+='<path d="M10 -100L24 -86L32 -98" stroke="'+sk+'" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 -102L20 -90" stroke="'+(o.shirt||'#9b2c2c')+'" stroke-width="8" stroke-linecap="round"/>';
 g+='<ellipse cx="14" cy="-120" rx="10" ry="11" fill="'+sk+'"/><path d="M3 -121Q3 -134 16 -133Q25 -132 24 -123Q16 -126 3 -121Z" fill="#2a1d14"/><path d="M4 -124L24 -126" stroke="'+(o.band||'#f4f1ea')+'" stroke-width="2.4"/><circle cx="19" cy="-119" r="1.3" fill="#3a2a20"/>';
 return '<g transform="translate('+o.x+' '+o.y+') scale('+(o.s||1)+')">'+g+'</g>';}
function skyline(base,c,seed,win,hMax=90){const R=rng(seed);let s='',x=20;while(x<280){const w=14+R()*22,h=30+R()*hMax;s+='<rect x="'+f(x)+'" y="'+f(base-h)+'" width="'+f(w)+'" height="'+f(h)+'" fill="'+c+'"/>';if(win){for(let wy=base-h+6;wy<base-6;wy+=9)for(let wx=x+3;wx<x+w-4;wx+=6)if(R()<.35)s+='<rect x="'+f(wx)+'" y="'+f(wy)+'" width="2.6" height="3.6" fill="'+win+'" opacity="'+f(.5+R()*.5)+'"/>';}x+=w+R()*3;}return s;}
function rain(n,seed,c='#a9c6e6',o=.55){const R=rng(seed);let s='';for(let i=0;i<n;i++){const x=20+R()*270,y=48+R()*350,l=10+R()*12;s+='<path d="M'+f(x)+' '+f(y)+'l'+f(-l*.35)+' '+f(l)+'" stroke="'+c+'" stroke-opacity="'+f(o*(.5+R()*.5))+'" stroke-width="1.2" stroke-linecap="round"/>';}return s;}
function sparks(n,seed,c,x0,x1,y0,y1){const R=rng(seed);let s='';for(let i=0;i<n;i++){const x=x0+R()*(x1-x0),y=y0+R()*(y1-y0);s+='<path d="M'+f(x)+' '+f(y)+'q2.5 4 0 7q-2.5 -3 0 -7Z" fill="'+c+'" transform="rotate('+f(R()*40-20)+' '+f(x)+' '+f(y)+')"/>';}return s;}

/* ---------------- 每張牌嘅場景 ---------------- */
const SC={};
SC.c00=()=>{let s=sky('#f6d47a','#fbeed0');s+=sun(222,104,20,false);s+=cloud(78,126,64,'#fff',.85);
 s+=mountains(292,'#c6d3e0',3,80)+snowcaps(292,'#f4f6f9',3,80)+mountains(312,'#9fb2c6',9,46);
 s+='<path d="M20 400V334Q90 318 172 326L212 336L206 400Z" fill="#8aa76d"/><path d="M212 336L206 400H220Z" fill="#5f7a4a"/><path d="M60 352Q100 346 140 350" stroke="#6f8c56" stroke-width="2" fill="none"/>';
 s+=quad({x:88,y:338,s:.55,c:'#f7f3ea',dir:1,ear:'#d8c9b0',collar:'#b73b3b'});
 const dots='<circle cx="-10" cy="-40" r="3.4" fill="#9b2c2c"/><circle cx="8" cy="-28" r="3.4" fill="#9b2c2c"/><circle cx="-6" cy="-18" r="3.4" fill="#9b2c2c"/><circle cx="12" cy="-56" r="3.4" fill="#9b2c2c"/><circle cx="-12" cy="-66" r="3" fill="#9b2c2c"/>';
 const p=person({x:162,y:336,s:.98,pose:'walk',robe:'#e9b24c',trim:'#9b2c2c',cape:'#3f6f93',pattern:dots,hair:'#7a4a22',hat:'<path d="M-14 -121Q0 -138 14 -121Z" fill="#3f6b45"/><path d="M8 -131Q22 -150 34 -144Q22 -138 11 -127Z" fill="#b73b3b"/>'});
 s+=wand(p.R[0],p.R[1]+6,p.R[0]+32,p.R[1]-24,'#6b4a2a',3.4)+'<circle cx="'+f(p.R[0]+34)+'" cy="'+f(p.R[1]-20)+'" r="10" fill="#9b2c2c"/><path d="M'+f(p.R[0]+26)+' '+f(p.R[1]-20)+'q8 -6 16 0" stroke="#d8b45a" stroke-width="1.4" fill="none"/>';
 s+=p.svg;s+=rose(p.L[0],p.L[1]-5,5,'#fbfbf6','#c9c3b4')+leaf(p.L[0]-4,p.L[1],-30,'#5d8a4e',7);
 return s;};
SC.c01=()=>{let s=sky('#f2cd5e','#f8e8b2');
 for(let i=0;i<11;i++){const x=34+i*23.3,y=74+(i%2)*7;s+=leaf(x-7,y+6,-30,'#4f7a3e',11)+leaf(x+7,y+7,30,'#4f7a3e',11)+rose(x,y,7.5);}
 s+='<circle cx="150" cy="190" r="80" fill="'+glow('#fff6d0',.7)+'"/>';
 const p=person({x:150,y:336,s:1.24,pose:'up',robe:'#f3eee2',cape:'#a8322d',trim:'#d8b45a',hair:'#3a2618',belt:'#6b8f4a'});
 s+=inf(150,p.head[1]-30,30);
 s+=p.svg;
 s+=wand(p.R[0]-2,p.R[1]+16,p.R[0]+3,p.R[1]-22,'#fbf8ef',4.5)+'<circle cx="'+f(p.R[0]+3)+'" cy="'+f(p.R[1]-24)+'" r="3" fill="#fbf8ef"/>';
 s+='<rect x="52" y="306" width="196" height="14" rx="2" fill="#6f4526"/><rect x="60" y="320" width="180" height="80" fill="#8c5d35"/><path d="M60 336H240M60 366H240" stroke="#6f4526" stroke-width="1.2"/>';
 s+=cup(82,306,1.05)+sword(102,302,34,90)+coin(196,294,11)+wand(214,302,242,290,'#7a5030',4)+leaf(226,292,-30,'#5d8a4e',8);
 for(let i=0;i<5;i++)s+=lily(80+i*36,398,1.1);
 return s;};
SC.c02=()=>{let s=sky('#20385a','#4d7398');
 s+='<rect x="70" y="80" width="160" height="320" fill="#6e2c3c"/>';
 for(let r=0;r<7;r++)for(let c=0;c<5;c++){const x=84+c*33+(r%2)*16,y=98+r*40;s+='<circle cx="'+x+'" cy="'+y+'" r="7" fill="#c2464a"/><path d="M'+(x-2)+' '+(y-7)+'l2 -4 2 4" fill="#c2464a"/>'+leaf(x-9,y-4,-40,'#3f6b45',9)+leaf(x+9,y-4,40,'#3f6b45',9);}
 s+=pillar(36,112,32,'#1b2033','#d8b45a','B','#f4ead3')+pillar(232,112,32,'#efe9dc','#d8b45a','J','#1b2033');
 s+='<path d="M20 400V372Q80 360 150 374T280 366V400Z" fill="#79b0d8"/>'+waterLines(372,398,'#fff',.4,5);
 const p=person({x:150,y:378,s:1.08,pose:'hold',robe:'#6f9fd0',cape:'#eef2f7',trim:'#eef2f7',hair:'#2a1d14',long:1,
  hat:'<circle cx="0" cy="-134" r="6.5" fill="#eef2f7"/><path d="M-6 -134Q-15 -148 -24 -137Q-15 -141 -6 -134ZM6 -134Q15 -148 24 -137Q15 -141 6 -134Z" fill="#eef2f7"/>',
  chest:'<path d="M0 -82V-64M-7 -74H7" stroke="#eef2f7" stroke-width="3"/>'});
 s+=p.svg;
 s+='<rect x="'+f(p.L[0]-6)+'" y="'+f(p.L[1]-8)+'" width="30" height="15" rx="4" fill="#f6efd8" stroke="#8a6d2f" stroke-width=".8"/><path d="M'+f(p.L[0]-2)+' '+f(p.L[1]-2)+'h20M'+f(p.L[0]-2)+' '+f(p.L[1]+2)+'h14" stroke="#8a6d2f" stroke-width=".8"/>';
 s+=crescent(150,388,11,'#ecd58e',.7);
 return s;};
SC.c03=()=>{let s=sky('#a5cfe8','#f4e4b8');
 s+=cypress(46,300,140)+cypress(70,300,104,'#386a46')+cypress(250,300,130)+cypress(228,300,96,'#386a46');
 s+='<path d="M196 196H214V302H196Z" fill="#d6ecf7"/><path d="M200 200V300M206 200V300M211 200V300" stroke="#a9d1e8" stroke-width="1.4"/><ellipse cx="205" cy="304" rx="22" ry="6" fill="#d6ecf7"/>';
 s+='<path d="M20 400V306Q150 288 280 306V400Z" fill="#d7b35a"/>';
 s+='<ellipse cx="150" cy="362" rx="84" ry="26" fill="#b73b3b"/><ellipse cx="150" cy="356" rx="74" ry="17" fill="#cf5048"/>';
 let crown='';for(let i=0;i<12;i++){const a=Math.PI*(1.1+i*.8/11);crown+=star5(f(Math.cos(a)*20),f(-118+Math.sin(a)*20),3,'#f2c94a');}
 const pom='<circle cx="-10" cy="-30" r="3.4" fill="#c2464a"/><circle cx="9" cy="-44" r="3.4" fill="#c2464a"/><circle cx="-6" cy="-58" r="3" fill="#c2464a"/><circle cx="11" cy="-18" r="3.4" fill="#c2464a"/><circle cx="-13" cy="-12" r="3" fill="#c2464a"/>';
 const p=person({x:150,y:368,s:1.26,pose:'hold',robe:'#f6f2e6',pattern:pom,trim:'#d8b45a',hair:'#8a5326',long:1,hat:crown,wreath:'#5d8a4e'});
 s+=p.svg;
 s+=wand(p.R[0],p.R[1]+4,p.R[0]+18,p.R[1]-52,'#d8b45a',3.4)+'<circle cx="'+f(p.R[0]+19)+'" cy="'+f(p.R[1]-56)+'" r="6" fill="#e3bf5c" stroke="#8a6d2f"/>';
 s+='<path d="M66 384c-13-13-3-28 8-19 11-9 21 6 8 19l-8 8z" fill="#e2b84a" stroke="#8a6d2f"/><circle cx="74" cy="374" r="4" fill="none" stroke="#8a6d2f" stroke-width="1.5"/><path d="M74 378v7M71 382h6" stroke="#8a6d2f" stroke-width="1.5"/>';
 for(let i=0;i<12;i++)s+=wheat(28+i*22+(i%3)*3,400,26+(i%4)*4);
 return s;};
SC.c04=()=>{let s=sky('#e36f34','#f5b66c');s+=mountains(300,'#a2492a',11,100)+mountains(330,'#76321e',5,40);
 s+='<rect x="84" y="176" width="132" height="224" rx="6" fill="#8d877a"/><rect x="76" y="166" width="148" height="26" rx="8" fill="#a39d90"/><path d="M84 260H216M84 320H216" stroke="#77716a" stroke-width="1.4"/>';
 [[90,178],[210,178]].forEach(([x,y])=>{s+='<circle cx="'+x+'" cy="'+y+'" r="11" fill="#b2ab9d"/><path d="M'+x+' '+y+'m-6 0a6 6 0 1 1 6 6a3 3 0 1 1 -3 -3" stroke="#6a645b" stroke-width="2" fill="none"/>';});
 s+='<path d="M136 170L150 150L164 170Z" fill="#a39d90"/><circle cx="150" cy="164" r="5" fill="#76321e"/>';
 const p=person({x:150,y:380,s:1.14,pose:'regal',robe:'#b3352b',cape:'#7a1f1f',trim:'#d8b45a',crown:'#d8b45a',beard:'#ece8df',hair:'#ece8df',chest:'<path d="M-12 -84L0 -70L12 -84" stroke="#9aa2ad" stroke-width="4" fill="none"/>'});
 s+=p.svg;
 s+=wand(p.R[0],p.R[1]+18,p.R[0],p.R[1]-38,'#d8b45a',3.6)+'<ellipse cx="'+p.R[0]+'" cy="'+f(p.R[1]-46)+'" rx="5" ry="7" fill="none" stroke="#d8b45a" stroke-width="3"/><path d="M'+f(p.R[0]-8)+' '+f(p.R[1]-38)+'h16" stroke="#d8b45a" stroke-width="3"/>';
 s+='<circle cx="'+p.L[0]+'" cy="'+f(p.L[1]-6)+'" r="9" fill="#e3bf5c" stroke="#8a6d2f"/><path d="M'+p.L[0]+' '+f(p.L[1]-15)+'v-7M'+f(p.L[0]-3)+' '+f(p.L[1]-19)+'h6" stroke="#8a6d2f" stroke-width="1.6"/>';
 return s;};
SC.c05=()=>{let s=sky('#c8c0ae','#ece6d8');s+=pillar(38,104,30,'#8d877a','#a39d90')+pillar(232,104,30,'#8d877a','#a39d90');
 s+='<rect x="96" y="150" width="108" height="210" rx="4" fill="#a8a192"/>';
 const p=person({x:150,y:330,s:1.1,pose:'bless2',robe:'#b3352b',cape:'#7a1f1f',trim:'#d8b45a',tiara:'#d8b45a',beard:'#ece8df',hair:'#ece8df',chest:'<path d="M0 -84V-10M-8 -40H8" stroke="#ece8df" stroke-width="2.4"/>'});
 s+=p.svg;
 s+=wand(p.L[0],p.L[1]+60,p.L[0],p.L[1]-70,'#d8b45a',3.2)+'<path d="M'+f(p.L[0]-10)+' '+f(p.L[1]-62)+'h20M'+f(p.L[0]-8)+' '+f(p.L[1]-54)+'h16M'+f(p.L[0]-6)+' '+f(p.L[1]-46)+'h12" stroke="#d8b45a" stroke-width="3"/>';
 s+='<path d="M'+f(p.R[0]-2)+' '+f(p.R[1]-4)+'v-8M'+f(p.R[0]+2)+' '+f(p.R[1]-4)+'v-8" stroke="#efd0ad" stroke-width="2.4" stroke-linecap="round"/>';
 s+='<rect x="20" y="360" width="260" height="40" fill="#b5ad9c"/><path d="M20 372H280M20 386H280" stroke="#9e9686" stroke-width="1"/>';
 const rosePat='<circle cx="-10" cy="-30" r="4" fill="#c2464a"/><circle cx="8" cy="-50" r="4" fill="#c2464a"/><circle cx="10" cy="-20" r="4" fill="#c2464a"/>';
 const lilyPat='<circle cx="-10" cy="-30" r="4" fill="#fbf8ef"/><circle cx="8" cy="-50" r="4" fill="#fbf8ef"/><circle cx="10" cy="-20" r="4" fill="#fbf8ef"/>';
 s+=backFig(98,400,.82,'#7a2a2a','#5a3a22',rosePat)+backFig(202,400,.82,'#3f5f86','#2a1d14',lilyPat);
 s+='<g transform="translate(150 382)"><g transform="rotate(-30)"><circle cx="0" cy="-14" r="5" fill="none" stroke="#e0bd5a" stroke-width="2.4"/><path d="M0 -9V10M0 4h4M0 8h4" stroke="#e0bd5a" stroke-width="2.4"/></g><g transform="rotate(30)"><circle cx="0" cy="-14" r="5" fill="none" stroke="#cfd4da" stroke-width="2.4"/><path d="M0 -9V10M0 4h-4M0 8h-4" stroke="#cfd4da" stroke-width="2.4"/></g></g>';
 return s;};
SC.c06=()=>{let s=sky('#84b4d8','#f2e4bc');s+=sun(150,86,18,false);
 s+='<path d="M108 362L150 250L192 362Z" fill="#a7b6c6"/><path d="M150 250L138 282L150 276L162 282Z" fill="#eef1f5"/>';
 s+=hill(350,'#86a86a',10);
 s+=tree(64,352,128,'#3f6b45','#5c3d24');for(let i=0;i<9;i++){const a=i*.7;s+='<path d="M'+f(64+Math.cos(a)*28)+' '+f(274+Math.sin(a)*24)+'q-3 -6 0 -10q3 4 0 10Z" fill="#f08c2e"/>';}
 s+=tree(236,352,128,'#3f6b45','#5c3d24','#4c7a4f');for(let i=0;i<8;i++){const a=i*.8+.3;s+='<circle cx="'+f(236+Math.cos(a)*26)+'" cy="'+f(276+Math.sin(a)*22)+'" r="3.4" fill="#c2464a"/>';}
 s+='<path d="M224 340Q232 318 226 300Q240 296 238 310" stroke="#5d8a4e" stroke-width="3" fill="none"/>';
 s+=cloud(96,214,80,'#f4f6fb')+cloud(206,212,80,'#f4f6fb');
 const a=person({x:150,y:206,s:.78,pose:'raise2',robe:'#8a6bb0',wings:'#c25a4a',hair:'#c25a4a',trim:'#f2c94a'});s+=a.svg+'<g fill="#ffffff"><ellipse cx="150" cy="212" rx="78" ry="14"/><circle cx="118" cy="204" r="13"/><circle cx="140" cy="200" r="14"/><circle cx="164" cy="201" r="13"/><circle cx="186" cy="206" r="11"/></g>';
 s+=person({x:96,y:398,s:.74,pose:'out',robe:'#e6d3b3',trim:'#b88a5a',hair:'#5a3a22'}).svg;
 s+=person({x:204,y:398,s:.74,pose:'out',robe:'#d8c2df',trim:'#9a7aa8',hair:'#8a5326',long:1}).svg;
 return s;};
SC.c07=()=>{let s=sky('#f1cd5f','#f8ebc4');
 let w='M20 286';for(let x=20;x<280;x+=18)w+='V272H'+(x+9)+'V286H'+(x+18);s+='<path d="'+w+'V306H20Z" fill="#b8ad97"/>';
 s+='<rect x="40" y="248" width="22" height="58" fill="#a89e88"/><path d="M38 248L51 230L64 248Z" fill="#9b2c2c"/><rect x="236" y="244" width="22" height="62" fill="#a89e88"/><path d="M234 244L247 226L260 244Z" fill="#9b2c2c"/>';
 s+='<rect x="20" y="304" width="260" height="18" fill="#86b6d6"/>'+waterLines(306,320,'#fff',.5,8)+ground(322,'#b9a272');
 s+='<rect x="92" y="170" width="6" height="104" fill="#d8b45a"/><rect x="202" y="170" width="6" height="104" fill="#d8b45a"/><path d="M82 160H218L210 180H90Z" fill="#26386a"/>';for(let i=0;i<9;i++)s+=star8(98+i*13,169,4,'#f4ead3');
 const p=person({x:150,y:330,s:1.18,pose:'hold',robe:'#8a929e',trim:'#d8b45a',crown:'#d8b45a',hair:'#3a2618',chest:'<rect x="-10" y="-84" width="20" height="16" rx="2" fill="#c8cdd6"/><circle cx="0" cy="-77" r="3" fill="#d8b45a"/>'});
 s+=p.svg+wand(p.R[0],p.R[1]+6,p.R[0]+14,p.R[1]-46,'#d8b45a',3);
 s+='<rect x="80" y="262" width="140" height="72" rx="4" fill="#d9d3c5" stroke="#8d877a" stroke-width="1.6"/><path d="M80 278H220" stroke="#8d877a"/>';
 s+='<circle cx="150" cy="300" r="8" fill="#d8b45a"/><path d="M142 300Q122 290 110 300Q124 304 142 302ZM158 300Q178 290 190 300Q176 304 158 302Z" fill="#3f5f86"/>';
 s+='<circle cx="80" cy="334" r="14" fill="none" stroke="#6b4a2a" stroke-width="4"/><circle cx="220" cy="334" r="14" fill="none" stroke="#6b4a2a" stroke-width="4"/>';
 s+=quad({x:112,y:396,s:.78,c:'#2b2a33',lying:1,dir:-1})+quad({x:188,y:396,s:.78,c:'#f2eee6',lying:1,dir:1});
 return s;};
SC.c08=()=>{let s=sky('#f3d46a','#fbf0c8');s+=sun(232,96,16,false)+cloud(84,104,70,'#fff',.9)+cloud(150,140,56,'#fff',.7);s+=mountains(300,'#8db0cc',21,70)+snowcaps(300,'#eef3f8',21,70);s+=hill(324,'#7fa363',14)+hill(350,'#6f9556',8,40);
 s+=quad({x:198,y:396,s:1.55,c:'#e1a04a',dir:-1,mane:'#b4622a',lion:1,shade:'#6b3a12'});
 const fl='<circle cx="-10" cy="-30" r="3" fill="#c94a4a"/><circle cx="8" cy="-46" r="3" fill="#c94a4a"/><circle cx="-4" cy="-14" r="3" fill="#c94a4a"/>';
 const p=person({x:86,y:398,s:1.22,pose:'reach',robe:'#f6f2ea',pattern:fl,trim:'#5d8a4e',belt:'#c94a4a',hair:'#8a5326',long:1,wreath:'#c94a4a'});
 s+=inf(92,p.head[1]-28,28)+p.svg;
 return s;};
SC.c09=()=>{let s=sky('#121828','#2f3c58');s+=stars(46,9,'#ffffff',58,230);
 s+='<path d="M20 400L150 252L280 400Z" fill="#c4ccd8"/><path d="M150 252L118 292L132 288L144 300L156 286L170 296L182 290Z" fill="#eef2f6"/><path d="M20 400L60 360L96 400Z" fill="#a5afbf"/>';
 const p=person({x:150,y:374,s:1.08,pose:'lantern',robe:'#7c7f88',cape:'#6a6d76',hood:'#62656e',beard:'#e9e6df',hair:'#9a9aa0'});
 s+=wand(p.L[0],400,p.L[0]-2,p.L[1]-74,'#c9a24a',3.4);
 s+=p.svg;
 const lx=p.R[0],ly=p.R[1];
 s+='<circle cx="'+lx+'" cy="'+f(ly+16)+'" r="42" fill="'+glow('#ffe7a0',.75)+'"/><path d="M'+lx+' '+ly+'V'+f(ly+4)+'" stroke="#d8b45a" stroke-width="1.6"/><path d="M'+f(lx-8)+' '+f(ly+6)+'H'+f(lx+8)+'L'+f(lx+6)+' '+f(ly+30)+'H'+f(lx-6)+'Z" fill="#f9e7a8" stroke="#a68330" stroke-width="1.6"/>'+star8(lx,ly+18,6.5,'#f2b71e',.35)+'<path d="M'+f(lx-9)+' '+f(ly+6)+'L'+lx+' '+f(ly-2)+'L'+f(lx+9)+' '+f(ly+6)+'Z" fill="#a68330"/>';
 return s;};
SC.c10=()=>{let s=sky('#6c9fc4','#c2dcea');
 [[56,96],[244,96],[56,366],[244,366]].forEach(([x,y],i)=>{s+=cloud(x,y,74,'#ffffff');s+='<g transform="translate('+x+' '+(y-14)+')"><path d="M-12 0Q-6 -4 0 0Q6 -4 12 0V10Q6 6 0 10Q-6 6 -12 10Z" fill="#fbf8ef" stroke="#8a6d2f" stroke-width=".9"/><path d="M0 0V10" stroke="#8a6d2f" stroke-width=".9"/></g>';});
 const cx=150,cy=226;
 s+='<circle cx="'+cx+'" cy="'+cy+'" r="86" fill="#e19a45" stroke="#8a5a2c" stroke-width="2"/><circle cx="'+cx+'" cy="'+cy+'" r="66" fill="#f3d58c" stroke="#8a5a2c" stroke-width="1.6"/><circle cx="'+cx+'" cy="'+cy+'" r="30" fill="#e19a45" stroke="#8a5a2c" stroke-width="1.4"/><circle cx="'+cx+'" cy="'+cy+'" r="9" fill="#f3d58c" stroke="#8a5a2c" stroke-width="1.2"/>';
 for(let i=0;i<8;i++){const a=i*Math.PI/4;s+='<path d="M'+f(cx+Math.cos(a)*9)+' '+f(cy+Math.sin(a)*9)+'L'+f(cx+Math.cos(a)*66)+' '+f(cy+Math.sin(a)*66)+'" stroke="#8a5a2c" stroke-width="2"/>';}
 'TAROTARO'.split('').forEach((ch,i)=>{const a=-Math.PI/2+i*Math.PI/4;s+='<text x="'+f(cx+Math.cos(a)*76)+'" y="'+f(cy+Math.sin(a)*76+5)+'" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#5e3a18">'+ch+'</text>';});
 for(let i=0;i<4;i++){const a=Math.PI/8+i*Math.PI/2;s+='<circle cx="'+f(cx+Math.cos(a)*46)+'" cy="'+f(cy+Math.sin(a)*46)+'" r="5" fill="none" stroke="#8a5a2c" stroke-width="1.6"/>';}
 s+='<path d="M64 156q16 22 0 44t0 44t0 44" stroke="#e2b84a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M58 150l6 -8l6 8z" fill="#e2b84a"/>';
 s+=quad({x:136,y:142,s:.5,c:'#4a78a8',lying:1,dir:1})+sword(162,134,20,0);
 s+=person({x:246,y:316,s:.5,pose:'raise2',robe:'#b3352b',hair:'#3a2618'}).svg;
 return s;};
SC.c11=()=>{let s=sky('#e6be62','#f2d995');
 s+='<rect x="66" y="84" width="168" height="290" fill="#6b3a6b"/><path d="M82 84V374M110 84V374M190 84V374M218 84V374" stroke="#000" stroke-opacity=".18" stroke-width="3"/>';
 s+=pillar(40,104,28,'#8d877a','#a39d90')+pillar(232,104,28,'#8d877a','#a39d90');
 s+='<rect x="102" y="170" width="96" height="200" rx="6" fill="#a39d90"/>';
 s+='<rect x="20" y="372" width="260" height="28" fill="#c5bca8"/><path d="M20 386H280" stroke="#a89e88"/>';
 const p=person({x:150,y:376,s:1.12,pose:'justice',robe:'#b3352b',cape:'#4f7a52',trim:'#d8b45a',crown:'#d8b45a',hair:'#8a5326',long:1,chest:'<rect x="-5" y="-84" width="10" height="10" rx="2" fill="#d8b45a"/>'});
 s+=p.svg+sword(p.R[0],p.R[1]+8,74,0);
 const bx=p.L[0],by=p.L[1];
 s+='<path d="M'+bx+' '+(by-4)+'V'+(by-26)+'M'+(bx-22)+' '+(by-22)+'H'+(bx+22)+'" stroke="#d8b45a" stroke-width="2.4"/><path d="M'+(bx-22)+' '+(by-22)+'L'+(bx-30)+' '+(by-4)+'M'+(bx-22)+' '+(by-22)+'L'+(bx-14)+' '+(by-4)+'M'+(bx+22)+' '+(by-22)+'L'+(bx+14)+' '+(by-4)+'M'+(bx+22)+' '+(by-22)+'L'+(bx+30)+' '+(by-4)+'" stroke="#d8b45a" stroke-width="1"/><path d="M'+(bx-32)+' '+(by-4)+'Q'+(bx-22)+' '+(by+6)+' '+(bx-12)+' '+(by-4)+'ZM'+(bx+12)+' '+(by-4)+'Q'+(bx+22)+' '+(by+6)+' '+(bx+32)+' '+(by-4)+'Z" fill="#e3bf5c" stroke="#8a6d2f" stroke-width=".8"/>';
 return s;};
SC.c12=()=>{let s=sky('#cde0d4','#eef3e9');s+=hill(370,'#8aa56f',6);
 s+='<path d="M76 400V92M224 400V92" stroke="#6b4a2a" stroke-width="12" stroke-linecap="round"/><path d="M64 96H236" stroke="#6b4a2a" stroke-width="13" stroke-linecap="round"/>';
 [[76,170],[76,240],[224,200],[224,300],[120,96],[190,96]].forEach(([x,y],i)=>{s+=leaf(x+(i%2?7:-7),y-4,i%2?30:-30,'#5d8a4e',12);});
 s+='<path d="M149 100V110" stroke="#8a6d2f" stroke-width="2.4"/>';
 s+='<path d="M146 150L148 112" stroke="#b73b3b" stroke-width="9" stroke-linecap="round"/><path d="M156 150L174 132L152 120" stroke="#b73b3b" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M144 108H154" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>';
 const p=person({x:150,y:150,s:1.02,pose:'back',robe:'#3f6a9a',trim:'#b73b3b',halo:'#f2c94a',hair:'#d9a440',belt:'#d8b45a'});
 s+='<g transform="rotate(180 150 150)">'+p.svg+'</g>';
 return s;};
SC.c13=()=>{let s=sky('#273356','#6d5d86','#f0b27a');
 s+=sun(150,306,26,false,'#f9d27a','#f0a24a');
 s+='<rect x="96" y="232" width="24" height="82" fill="#3a3550"/><path d="M94 232L108 216L122 232Z" fill="#3a3550"/><rect x="180" y="232" width="24" height="82" fill="#3a3550"/><path d="M178 232L192 216L206 232Z" fill="#3a3550"/>';
 s+='<path d="M20 316H280V340Q150 330 20 344Z" fill="#43648c"/>'+waterLines(318,336,'#ffd9a8',.5,13);
 s+='<path d="M20 400V352Q80 340 128 356T210 350T280 344V400Z" fill="#2c3b2d"/>';
 s+='<path d="M20 116Q70 110 108 128Q118 136 128 132" stroke="#4a3626" stroke-width="5" fill="none" stroke-linecap="round"/>'+leaf(60,108,-20,'#3f6b45',14)+leaf(96,120,20,'#3f6b45',12);
 s+='<path d="M90 128q9 4 7 22q-2 13 -9 15q-7 -2 -7 -15q0 -18 9 -22z" fill="#9db27a" stroke="#6f8455" stroke-width="1"/><path d="M86 150l4 -6l4 6" stroke="#6f8455" fill="none"/>';
 const bx=164,by=210;
 s+='<g transform="translate('+bx+' '+by+') rotate(-12)">';
 [-1,1].forEach(d=>{s+='<path d="M0 -4C'+(d*20)+' -50 '+(d*72)+' -46 '+(d*62)+' -8C'+(d*56)+' 10 '+(d*24)+' 6 0 0Z" fill="#ec8d36" stroke="#3a2416" stroke-width="2.4"/><path d="M0 2C'+(d*18)+' 10 '+(d*50)+' 16 '+(d*40)+' 42C'+(d*30)+' 56 '+(d*10)+' 34 0 6Z" fill="#e07428" stroke="#3a2416" stroke-width="2.4"/>';
  s+='<circle cx="'+(d*50)+'" cy="-28" r="4" fill="#fbf3dc"/><circle cx="'+(d*58)+'" cy="-14" r="3" fill="#fbf3dc"/><circle cx="'+(d*30)+'" cy="34" r="3" fill="#fbf3dc"/><path d="M'+(d*8)+' -6C'+(d*24)+' -30 '+(d*44)+' -32 '+(d*52)+' -18" stroke="#3a2416" stroke-width="1.2" fill="none"/>';});
 s+='<ellipse cx="0" cy="4" rx="3.6" ry="22" fill="#3a2416"/><circle cx="0" cy="-20" r="4.4" fill="#3a2416"/><path d="M-1 -23Q-8 -38 -14 -40M1 -23Q8 -38 14 -40" stroke="#3a2416" stroke-width="1.4" fill="none"/></g>';
 s+=rose(232,374,8,'#f4f1ea','#c9c3b4')+leaf(222,380,-30,'#5d8a4e',10)+rose(248,384,6,'#f4f1ea','#c9c3b4');
 return s;};
SC.c14=()=>{let s=sky('#b9d5e8','#f6ecd2');s+=mountains(254,'#9fb3c8',31,44)+snowcaps(254,'#eef3f8',31,44);
 s+='<path d="M20 400V302Q150 284 280 302V400Z" fill="#87a86b"/><path d="M170 300Q120 330 136 400H162Q150 340 196 300Z" fill="#e7d8b2"/>';
 s+='<circle cx="214" cy="244" r="12" fill="#f6d35c"/><path d="M204 238L208 228L214 236L220 228L224 238Z" fill="#f6d35c"/>';
 s+='<ellipse cx="94" cy="384" rx="80" ry="22" fill="#78acd6"/>'+waterLines(372,396,'#fff',.45,21);
 for(let i=0;i<4;i++){const x=196+i*20;s+='<path d="M'+x+' 400V376" stroke="#4f7a3e" stroke-width="2"/><path d="M'+x+' 376l-5 -8l5 3l5 -3z" fill="#f2c94a"/>'+leaf(x-5,390,-40,'#4f7a3e',12);}
 const p=person({x:150,y:390,s:1.12,pose:'temper',robe:'#f6f3ea',wings:'#c64b3a',hair:'#d9a440',halo:'#f2c94a',trim:'#d8b45a',chest:'<rect x="-8" y="-82" width="16" height="16" fill="none" stroke="#d8b45a" stroke-width="1.4"/><path d="M-5 -70L0 -79L5 -70Z" fill="#d8b45a"/>'});
 s+=p.svg;
 s+='<path d="M'+f(p.L[0]+9)+' '+f(p.L[1]-20)+'Q'+f((p.L[0]+p.R[0])/2)+' '+f(p.L[1]+6)+' '+f(p.R[0]-4)+' '+f(p.R[1]-20)+'" stroke="#8fc6ea" stroke-width="4" fill="none" stroke-linecap="round"/>';
 s+='<g transform="rotate(28 '+p.L[0]+' '+p.L[1]+')">'+cup(p.L[0],p.L[1]+6,1,'#e3bf5c')+'</g>'+cup(p.R[0],p.R[1]+6,1,'#e3bf5c');
 return s;};
SC.c15=()=>{let s=sky('#161114','#3a2a2f');s+='<circle cx="150" cy="200" r="120" fill="'+glow('#7a2a2a',.6)+'"/>';
 s+='<path d="M150 150C108 140 58 176 34 226C76 206 100 218 112 244L122 286H178L188 244C200 218 224 206 266 226C242 176 192 140 150 150Z" fill="#0c0a0c"/><path d="M60 214Q90 200 106 214M240 214Q210 200 194 214" stroke="#2a2226" stroke-width="2" fill="none"/>';
 s+='<circle cx="150" cy="134" r="22" fill="#0c0a0c"/><path d="M126 128H174V142H126Z" fill="#e9e1d6"/><ellipse cx="140" cy="135" rx="5" ry="3" fill="#0c0a0c"/><ellipse cx="160" cy="135" rx="5" ry="3" fill="#0c0a0c"/><path d="M174 132q12 -2 18 6q-8 -2 -18 2z" fill="#e9e1d6"/>';
 s+='<rect x="108" y="284" width="84" height="12" fill="#3a3135"/><rect x="116" y="296" width="68" height="44" fill="#2a2326"/><circle cx="150" cy="316" r="6" fill="none" stroke="#c9a24a" stroke-width="2.4"/>';
 s+=ground(340,'#241c1f');
 const a=person({x:92,y:396,s:.64,pose:'down',robe:'#a76a5a',hair:'#5a3a22'}),b=person({x:208,y:396,s:.64,pose:'down',robe:'#6a7aa6',hair:'#2a1d14',long:1});
 s+=a.svg+b.svg;
 s+='<path d="M144 320Q118 360 96 '+f(a.head[1]+16)+'" stroke="#c9a24a" stroke-width="2" stroke-dasharray="4 3" fill="none"/><path d="M156 320Q182 360 204 '+f(b.head[1]+16)+'" stroke="#c9a24a" stroke-width="2" stroke-dasharray="4 3" fill="none"/>';
 s+='<ellipse cx="92" cy="'+f(a.head[1]+16)+'" rx="8" ry="3" fill="none" stroke="#c9a24a" stroke-width="2"/><ellipse cx="208" cy="'+f(b.head[1]+16)+'" rx="8" ry="3" fill="none" stroke="#c9a24a" stroke-width="2"/>';
 return s;};
SC.c16=()=>{let s=sky('#10142a','#323858');s+=cloud(72,92,96,'#4a4f6b')+cloud(222,82,86,'#4a4f6b')+cloud(160,112,70,'#3c4160');
 s+='<path d="M54 400L92 318H208L246 400Z" fill="#4a4540"/><path d="M92 318L110 340L130 326L160 346L190 328L208 318" stroke="#5e5852" stroke-width="2" fill="none"/>';
 s+=brick(114,150,72,170,'#8d877a','#6f6a62',12);
 s+='<path d="M114 150V140H122V146H132V140H142V146H158V140H168V146H178V140H186V150Z" fill="#8d877a"/>';
 [[126,186],[160,232],[132,272]].forEach(([x,y])=>{s+='<rect x="'+x+'" y="'+y+'" width="14" height="22" rx="7" fill="#1b1416"/><path d="M'+(x+2)+' '+(y+22)+'Q'+(x+7)+' '+(y+4)+' '+(x+12)+' '+(y+22)+'Z" fill="#f08c2e"/>';});
 s+='<path d="M114 156Q100 132 112 110Q118 132 130 140Q136 118 150 108Q150 132 166 140Q176 120 188 116Q180 138 186 156Z" fill="#f08c2e" opacity=".9"/><path d="M124 152Q122 134 132 124Q138 140 150 144Q160 130 172 126Q168 142 176 152Z" fill="#f6c548"/>';
 s+='<g transform="translate(208 112) rotate(32)"><path d="M-14 6V-6L-7 0L0 -12L7 0L14 -6V6Z" fill="#d8b45a" stroke="#8a6d2f"/></g>';
 s+='<path d="M60 56L118 118L100 122L152 156" stroke="#fff5c0" stroke-width="7" fill="none" stroke-linejoin="round" opacity=".5"/><path d="M60 56L118 118L100 122L152 156" stroke="#f6d34a" stroke-width="3.4" fill="none" stroke-linejoin="round"/>';
 s+=sparks(16,7,'#f6c548',40,260,120,380);
 return s;};
SC.c17=()=>{let s=sky('#142040','#3d5b8b');s+=stars(30,17,'#ffffff',56,200);
 s+='<circle cx="150" cy="110" r="48" fill="'+glow('#fff0b0',.6)+'"/>'+star8(150,110,36,'#f6d35c',.36,'#e0a62a');
 [[70,82],[230,82],[56,148],[244,148],[96,196],[204,196],[150,186]].forEach(([x,y])=>{s+=star8(x,y,10,'#fbf8ef',.36);});
 s+=hill(316,'#4f7a5c',10)+'<path d="M150 400Q140 350 196 338T280 344V400Z" fill="#6f9fd0"/>'+waterLines(350,396,'#fff',.4,4);
 s+=tree(252,320,96,'#3f6b45','#5c3d24');s+='<path d="M246 262q8 -10 16 -4q-4 2 -6 6q-6 -2 -10 -2z" fill="#e08a3a"/><path d="M260 258l6 -2" stroke="#8a5a2c" stroke-width="1.4"/>';
 const p=person({x:126,y:386,s:.9,pose:'pour',robe:'#dfe8f4',trim:'#b9c7da',hair:'#d9a440',long:1});
 s+=p.svg+jug(p.L[0],p.L[1]+6,1,-60)+jug(p.R[0],p.R[1]+6,1,70);
 const lx=p.L[0]-12,ly=p.L[1]+4;for(let i=0;i<5;i++)s+='<path d="M'+lx+' '+ly+'Q'+f(lx-8-i*4)+' '+f(ly+20)+' '+f(lx-10-i*6)+' '+f(386)+'" stroke="#a9d3f0" stroke-width="1.6" fill="none"/>';
 s+='<path d="M'+f(p.R[0]+14)+' '+f(p.R[1]+8)+'Q'+f(p.R[0]+24)+' '+f(p.R[1]+24)+' '+f(p.R[0]+26)+' 366" stroke="#a9d3f0" stroke-width="3.4" fill="none"/>';
 return s;};
SC.c18=()=>{let s=sky('#152240','#45608c');s+=stars(24,23,'#ffffff',58,160);
 s+='<circle cx="150" cy="106" r="54" fill="'+glow('#fff3c4',.5)+'"/><circle cx="150" cy="106" r="32" fill="#f3e6b4"/>'+crescent(150,106,32,'#d9c78c',.55)+'<path d="M140 98q4 -3 8 0" stroke="#a89660" stroke-width="1.6" fill="none"/>';
 s+=sparks(12,31,'#f3d26a',90,210,150,230);
 s+=mountains(246,'#5a6f96',41,44)+hill(300,'#355f4c',8);
 s+='<rect x="38" y="178" width="34" height="132" fill="#8a8fa0"/><path d="M36 178L55 160L74 178Z" fill="#6f7488"/><rect x="50" y="200" width="10" height="16" rx="5" fill="#2a2f44"/><rect x="228" y="178" width="34" height="132" fill="#8a8fa0"/><path d="M226 178L245 160L264 178Z" fill="#6f7488"/><rect x="240" y="200" width="10" height="16" rx="5" fill="#2a2f44"/>';
 s+='<path d="M150 360Q118 330 160 300T140 236" stroke="#d8cfb8" stroke-width="7" fill="none" stroke-linecap="round"/>';
 s+='<path d="M20 400V352Q150 338 280 352V400Z" fill="#3c6ca6"/>'+waterLines(356,396,'#fff',.3,9);
 s+='<g transform="translate(150 368)"><ellipse rx="10" ry="6" fill="#c64a3a"/><path d="M-8 -4l-10 -10l2 6M8 -4l10 -10l-2 6M-6 4l-6 6M6 4l6 6" stroke="#c64a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>';
 s+=quad({x:80,y:334,s:.62,c:'#ece4d6',dir:1,ear:'#c9b89a'})+quad({x:220,y:334,s:.62,c:'#6b6f7a',dir:-1});
 return s;};
SC.c19=()=>{let s=sky('#f5c240','#fbe9a8');s+=sun(150,122,40,true);
 s+=brick(20,264,260,60,'#a39784','#857a68',12);
 [40,92,208,260].forEach((x,i)=>{s+=sunflower(x,268,1.05+(i%2)*.1);});
 s+=ground(324,'#8fb36b');
 const hx=144,hy=394;s+=quad({x:hx,y:hy,s:1.5,c:'#f8f5ee',dir:1,shade:'#6b6355'});
 s+='<path d="M'+f(hx-16)+' '+(hy-61)+'Q'+hx+' '+(hy-48)+' '+f(hx+20)+' '+(hy-60)+'" stroke="#c24a3a" stroke-width="5" fill="none"/>';
 const c=person({x:hx-6,y:hy-52,s:.5,pose:'up',robe:'#f6f2ea',trim:'#f2c94a',hair:'#f2c94a',wreath:'#c94a4a'});
 s+=c.svg;s+=wand(c.R[0],c.R[1]+10,c.R[0]-2,c.R[1]-40,'#6b4a2a',2.4)+'<path d="M'+f(c.R[0]-2)+' '+f(c.R[1]-40)+'Q'+f(c.R[0]-26)+' '+f(c.R[1]-50)+' '+f(c.R[0]-46)+' '+f(c.R[1]-30)+'Q'+f(c.R[0]-30)+' '+f(c.R[1]-20)+' '+f(c.R[0]-2)+' '+f(c.R[1]-16)+'Z" fill="#c24a3a"/>';
 return s;};
SC.c20=()=>{let s=sky('#97c0de','#e9f0f5');s+=mountains(330,'#d9e2ea',51,80)+snowcaps(330,'#ffffff',51,80);
 s+='<rect x="20" y="330" width="260" height="70" fill="#5c8cb6"/>'+waterLines(336,396,'#fff',.35,51);
 s+=cloud(70,196,90,'#f2f5fa')+cloud(232,192,90,'#f2f5fa');
 const a=person({x:140,y:194,s:.9,pose:'out',robe:'#d9e4f2',wings:'#c64b3a',hair:'#d9a440',trim:'#f2c94a'});
 s+=a.svg+'<g fill="#ffffff"><ellipse cx="146" cy="200" rx="96" ry="18"/><circle cx="100" cy="190" r="16"/><circle cx="128" cy="184" r="18"/><circle cx="160" cy="186" r="17"/><circle cx="190" cy="192" r="14"/></g>';
 s+='<path d="M'+f(a.R[0]-4)+' '+f(a.R[1]-2)+'L'+f(a.R[0]+44)+' '+f(a.R[1]+30)+'L'+f(a.R[0]+50)+' '+f(a.R[1]+18)+'Z" fill="#e0bd5a" stroke="#8a6d2f" stroke-width="1"/><rect x="'+f(a.R[0]+20)+'" y="'+f(a.R[1]+18)+'" width="18" height="16" fill="#fbf8ef" stroke="#c9c3b4"/><path d="M'+f(a.R[0]+29)+' '+f(a.R[1]+20)+'v12M'+f(a.R[0]+23)+' '+f(a.R[1]+26)+'h12" stroke="#c24a3a" stroke-width="2.4"/>';
 {const bx=a.R[0]+47,by=a.R[1]+24;for(let i=0;i<5;i++){const ang=-.5+i*.25;s+='<path d="M'+f(bx+Math.cos(ang)*10)+' '+f(by+Math.sin(ang)*10)+'L'+f(bx+Math.cos(ang)*24)+' '+f(by+Math.sin(ang)*24)+'" stroke="#e0bd5a" stroke-width="1.6" stroke-linecap="round"/>';}}
 [[72,378,'#d8c2b0'],[150,388,'#e6d3b3'],[228,378,'#c9b7d6']].forEach(([x,y,c])=>{const p=person({x,y:y-6,s:.46,pose:'raise2',robe:c,hair:'#5a3a22'});s+=p.svg+'<path d="M'+(x-28)+' '+(y-8)+'H'+(x+28)+'L'+(x+20)+' '+(y+6)+'H'+(x-20)+'Z" fill="#7a5030"/>';});
 return s;};
SC.c21=()=>{let s=sky('#3a7894','#a7d2d8');
 [[56,92],[244,92],[56,368],[244,368]].forEach(([x,y],i)=>{s+=cloud(x,y,72,'#ffffff');s+=star8(x,y-14,7,['#f2c94a','#c64b3a','#5d8a4e','#3f5f86'][i]);});
 const cx=150,cy=226;s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="80" ry="116" fill="none" stroke="#3f7a43" stroke-width="12"/>';
 for(let i=0;i<40;i++){const a=i*Math.PI*2/40;const x=cx+Math.cos(a)*80,y=cy+Math.sin(a)*116;s+=leaf(f(x),f(y),f(a*180/Math.PI+90+(i%2?30:-30)),'#5d9a52',13);}
 [[cx,cy-116],[cx,cy+116]].forEach(([x,y])=>{s+='<path d="M'+(x-14)+' '+(y-8)+'L'+x+' '+y+'L'+(x-14)+' '+(y+8)+'ZM'+(x+14)+' '+(y-8)+'L'+x+' '+y+'L'+(x+14)+' '+(y+8)+'Z" fill="#c64b3a"/><circle cx="'+x+'" cy="'+y+'" r="4" fill="#c64b3a"/>';});
 const p=person({x:cx,y:cy+78,s:.92,pose:'dance',robe:'#f6f3ea',cape:'#7a4f9a',trim:'#d8b45a',hair:'#8a5326',long:1});
 s+=p.svg+wand(p.L[0],p.L[1]+12,p.L[0],p.L[1]-14,'#d8b45a',2.6)+wand(p.R[0],p.R[1]+12,p.R[0],p.R[1]-14,'#d8b45a',2.6);
 return s;};
SC.h1=()=>{let s=sky('#18242f','#34495f');s+=skyline(300,'#121b26',61,'#e9c46a',110);
 s+='<rect x="20" y="300" width="260" height="100" fill="#1f2731"/>';
 const R=rng(5);for(let i=0;i<14;i++){const x=24+R()*250,w=8+R()*30;s+='<path d="M'+f(x)+' '+f(320+R()*70)+'h'+f(w)+'" stroke="'+(R()<.5?'#e9c46a':'#c64b3a')+'" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>';}
 s+='<ellipse cx="150" cy="386" rx="80" ry="7" fill="#2c3846"/>';
 s+=rider({x:150,y:380,s:1.15,coat:'#e8c23a',bag:'#2b2a28',frame:'#9b2c2c',helmet:'#2b2a28',hood:'#c9a42a',pants:'#2a2a33'});
 s+=rain(90,19,'#b7d2ee',.6);
 s+='<g stroke="#b7d2ee" stroke-opacity=".5" fill="none"><ellipse cx="66" cy="384" rx="10" ry="2.4"/><ellipse cx="236" cy="372" rx="12" ry="2.6"/><ellipse cx="200" cy="394" rx="8" ry="2"/></g>';
 return s;};
SC.h2=()=>{let s=sky('#0b1130','#2a3366');s+=stars(40,71,'#ffffff',58,200);s+=crescent(226,92,18,'#f3e6b4');
 s+='<rect x="92" y="96" width="4" height="60" fill="#151a38"/><circle cx="94" cy="94" r="2.2" fill="#e05a4a"/><ellipse cx="94" cy="166" rx="14" ry="7" fill="#151a38"/><rect x="84" y="172" width="20" height="4" fill="#151a38"/><path d="M90 176L86 320H102L98 176Z" fill="#151a38"/><ellipse cx="94" cy="166" rx="14" ry="2" fill="#f2c94a" opacity=".6"/>';
 s+=skyline(320,'#121735',73,'#f2c94a',90);
 s+='<rect x="20" y="320" width="260" height="80" fill="#1a1e33"/><path d="M20 356H280" stroke="#f2c94a" stroke-opacity=".5" stroke-width="2" stroke-dasharray="14 10"/>';
 [[44,236],[256,236]].forEach(([x,y])=>{s+='<path d="M'+x+' 322V'+y+'Q'+x+' '+(y-8)+' '+(x+(x<150?10:-10))+' '+(y-8)+'" stroke="#3a3f5c" stroke-width="3" fill="none"/><circle cx="'+(x+(x<150?12:-12))+'" cy="'+(y-4)+'" r="26" fill="'+glow('#ffe7a0',.6)+'"/><circle cx="'+(x+(x<150?12:-12))+'" cy="'+(y-5)+'" r="3.2" fill="#fff3c4"/>';});
 s+=rider({x:150,y:388,s:1.05,coat:'#3d4658',bag:'#b3352b',frame:'#c9a24a',helmet:'#d9d3c5',lamp:'#fff3b0',pants:'#20232e'});
 return s;};
SC.h3=()=>{let s=sky('#6a2416','#b4502a');s+=brick(20,48,260,352,'#8a3a24','#6e2c1a',14);s+='<rect x="20" y="48" width="260" height="352" fill="#000" opacity=".12"/>';
 [['上天言好事',248],['下界保平安',52]].forEach(([t,x])=>{s+='<rect x="'+(x-14)+'" y="70" width="28" height="200" fill="#c4302b" stroke="#e0bd5a" stroke-width="1.6"/>';t.split('').forEach((ch,i)=>{s+='<text x="'+x+'" y="'+(102+i*36)+'" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="20" font-weight="600" fill="#f2d36b">'+ch+'</text>';});});
 s+='<rect x="114" y="66" width="72" height="24" fill="#c4302b" stroke="#e0bd5a" stroke-width="1.4"/><text x="150" y="84" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="15" font-weight="600" fill="#f2d36b" letter-spacing="2">一家之主</text>';
 const p=person({x:150,y:324,s:.98,pose:'hold',robe:'#b3352b',cape:'#7a1f1f',trim:'#e0bd5a',beard:'#2a1d14',hair:'#2a1d14',
  hat:'<path d="M-15 -121H15V-131Q0 -141 -15 -131Z" fill="#1d1d22"/><path d="M-15 -127H-32M15 -127H32" stroke="#1d1d22" stroke-width="4" stroke-linecap="round"/>',chest:'<rect x="-10" y="-82" width="20" height="18" fill="#e0bd5a" opacity=".85"/>'});
 s+=p.svg+'<rect x="'+f(p.L[0]-2)+'" y="'+f(p.L[1]-26)+'" width="22" height="34" rx="3" fill="#e9dcc0" stroke="#8a6d2f"/>';
 s+='<path d="M98 252Q92 236 100 226Q104 240 110 236Q106 248 98 252ZM196 248Q190 234 196 222Q202 236 206 232Q204 246 196 248Z" fill="#fbf3dc" opacity=".5"/>';
 s+=brick(62,300,176,100,'#7d6a58','#5f5042',12);s+='<rect x="56" y="292" width="188" height="12" fill="#5f5042"/>';
 s+='<path d="M90 292Q150 326 210 292Z" fill="#2b2a28"/><path d="M90 292H210" stroke="#55534f" stroke-width="2"/>';
 s+='<path d="M122 286Q114 268 124 252Q130 266 128 286M150 286Q142 262 152 244Q158 262 156 286M176 286Q170 268 178 254Q184 268 180 286" stroke="#fbf3dc" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>';
 s+='<path d="M124 350H176V400H124Z" fill="#241a14"/><path d="M130 400Q134 368 146 360Q144 380 152 384Q154 364 166 358Q164 384 170 400Z" fill="#f08c2e"/><path d="M140 400Q144 384 150 380Q152 390 158 400Z" fill="#f6d34a"/>';
 return s;};
SC.h4=()=>{let s=sky('#ee9b55','#f9dcae');s+='<circle cx="212" cy="258" r="70" fill="'+glow('#fff0b0',.6)+'"/><circle cx="212" cy="262" r="24" fill="#f9e2a0"/>';
 s+=skyline(270,'#8a7489',91,null,40);
 s+='<rect x="20" y="268" width="260" height="62" fill="#6d9cc4"/>'+waterLines(272,326,'#ffe6b8',.55,91);
 s+='<path d="M20 400V336Q150 318 280 332V400Z" fill="#c7b186"/><path d="M20 352Q150 338 280 350" stroke="#ad9870" stroke-width="2" fill="none"/>';
 for(let i=0;i<10;i++)s+='<path d="M'+(26+i*28)+' 400q2 -12 6 -16M'+(30+i*28)+' 400q0 -10 -4 -14" stroke="#6f8c56" stroke-width="2" fill="none"/>';
 s+=runner({x:140,y:388,s:1.35,shirt:'#9b2c2c',shorts:'#2b2a28'});
 s+='<path d="M86 360h-30M92 340h-24M80 320h-18" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round"/>';
 return s;};

/* ---------------- 牌框 ---------------- */
function corner(x,y,sx,sy,c){return '<g transform="translate('+x+' '+y+') scale('+sx+' '+sy+')"><path d="M0 18V6Q0 0 6 0H18" stroke="'+c+'" stroke-width="1.6" fill="none"/><path d="M5 5L10 2L8 8Z" fill="'+c+'"/><circle cx="22" cy="0" r="1.6" fill="'+c+'"/><circle cx="0" cy="22" r="1.6" fill="'+c+'"/></g>';}
function face(c,lv,prefix){
 P=prefix||('t'+(++SEQ)+'_');D=[];
 const sc=(SC[c.id]||(()=>''))();
 const frame=lv>=3?'#5e1a24':'#1f2540',gold='#c9a24a',paper='#f4ead3';
 let s='<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg" class="tarot" role="img" aria-label="'+c.name+'"><defs>'+D.join('')+'<clipPath id="'+P+'clip"><rect x="26" y="54" width="248" height="340" rx="6"/></clipPath></defs>';
 s+='<rect width="300" height="500" rx="18" fill="'+frame+'"/><rect x="9" y="9" width="282" height="482" rx="12" fill="'+paper+'"/><rect x="15" y="15" width="270" height="470" rx="9" fill="none" stroke="'+gold+'" stroke-width="1.4"/>';
 s+=corner(19,19,1,1,gold)+corner(281,19,-1,1,gold)+corner(19,481,1,-1,gold)+corner(281,481,-1,-1,gold);
 s+='<g clip-path="url(#'+P+'clip)">'+sc+'</g>';
 s+='<rect x="26" y="54" width="248" height="340" rx="6" fill="none" stroke="'+gold+'" stroke-width="2.6"/><rect x="30" y="58" width="240" height="332" rx="4" fill="none" stroke="'+frame+'" stroke-opacity=".45" stroke-width="1"/>';
 s+='<path d="M110 35H190" stroke="'+gold+'" stroke-width="1"/><rect x="'+(150-Math.max(22,c.n.length*7+12))+'" y="22" width="'+(Math.max(22,c.n.length*7+12)*2)+'" height="26" rx="13" fill="'+frame+'" stroke="'+gold+'" stroke-width="1.2"/><text x="150" y="40.5" text-anchor="middle" font-family="Georgia, \'Noto Serif TC\', serif" font-size="15" fill="#ead39a" letter-spacing="1.5">'+c.n+'</text>';
 s+='<path d="M44 406H256L246 427L256 448H44L54 427Z" fill="'+frame+'"/><path d="M50 410H250L242 427L250 444H50L58 427Z" fill="none" stroke="'+gold+'" stroke-width="1"/>';
 s+='<text x="150" y="435" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="21" font-weight="600" fill="#f4ead3" letter-spacing="6">'+c.name+'</text>';
 s+='<text x="150" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" fill="#8a6d2f" letter-spacing="2.5">'+c.en.toUpperCase()+'</text>'+(c.en.length<=12?'<path d="M78 466H96M204 466H222" stroke="'+gold+'" stroke-width="1"/>':'<circle cx="30" cy="466" r="1.6" fill="'+gold+'"/><circle cx="270" cy="466" r="1.6" fill="'+gold+'"/>');
 if(lv>=3)s+='<g transform="translate(256 36)"><rect x="-13" y="-13" width="26" height="26" rx="3" fill="#b3352b" transform="rotate(8)"/><text x="0" y="5" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="12" font-weight="600" fill="#f4ead3" transform="rotate(8)">知己</text></g>';
 return s+'</svg>';
}
function back(){
 const navy='#1f2540',gold='#c9a24a';let s='<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg" class="tarot back" aria-hidden="true">';
 s+='<rect width="300" height="500" rx="18" fill="'+navy+'"/><rect x="12" y="12" width="276" height="476" rx="11" fill="none" stroke="'+gold+'" stroke-width="1.6"/><rect x="20" y="20" width="260" height="460" rx="8" fill="none" stroke="'+gold+'" stroke-width=".8" stroke-opacity=".7"/>';
 for(let i=0;i<14;i++){s+='<path d="M'+(20+i*20)+' 20L'+(20+i*20+130)+' 480" stroke="'+gold+'" stroke-opacity=".07"/><path d="M'+(280-i*20)+' 20L'+(150-i*20)+' 480" stroke="'+gold+'" stroke-opacity=".07"/>';}
 const cx=150,cy=250;
 s+='<circle cx="'+cx+'" cy="'+cy+'" r="104" fill="'+navy+'" stroke="'+gold+'" stroke-width="1.4"/><circle cx="'+cx+'" cy="'+cy+'" r="96" fill="none" stroke="'+gold+'" stroke-width=".7"/>';
 for(let i=0;i<48;i++){const a=i*Math.PI/24;s+='<circle cx="'+f(cx+Math.cos(a)*100)+'" cy="'+f(cy+Math.sin(a)*100)+'" r="1.3" fill="'+gold+'"/>';}
 for(let i=0;i<16;i++){const a=i*22.5;s+='<ellipse cx="'+cx+'" cy="'+(cy-58)+'" rx="10" ry="32" fill="none" stroke="'+gold+'" stroke-width="1.1" transform="rotate('+a+' '+cx+' '+cy+')"/>';}
 for(let i=0;i<8;i++){const a=i*45+11.25;s+='<path d="M'+cx+' '+(cy-88)+'l4 8l-4 4l-4 -4z" fill="'+gold+'" transform="rotate('+a+' '+cx+' '+cy+')"/>';}
 s+='<circle cx="'+cx+'" cy="'+cy+'" r="34" fill="'+navy+'" stroke="'+gold+'" stroke-width="1.2"/>'+star8(cx,cy,28,gold,.32)+'<circle cx="'+cx+'" cy="'+cy+'" r="6" fill="'+navy+'" stroke="'+gold+'" stroke-width="1"/>';
 s+='<path d="M150 72A14 14 0 1 0 150 100A10.5 14 0 1 1 150 72Z" fill="'+gold+'" transform="rotate(-90 150 86)"/>';
 s+='<circle cx="150" cy="414" r="9" fill="none" stroke="'+gold+'" stroke-width="1.4"/>';for(let i=0;i<12;i++){const a=i*Math.PI/6;s+='<path d="M'+f(150+Math.cos(a)*12)+' '+f(414+Math.sin(a)*12)+'L'+f(150+Math.cos(a)*17)+' '+f(414+Math.sin(a)*17)+'" stroke="'+gold+'" stroke-width="1.2"/>';}
 [[40,40],[260,40],[40,460],[260,460]].forEach(([x,y])=>{s+=star8(x,y,8,gold,.35);});
 s+='<text x="150" y="128" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="13" fill="'+gold+'" letter-spacing="8">心晴</text>';
 return s+'</svg>';
}
return {face,back};
})();

const LVN=['未遇','初見','熟悉','知己'];
const lvOf=n=>n>=7?3:n>=3?2:n>=1?1:0;
function drawCounts(){const m={};Object.values(S.draws||{}).forEach(d=>{drawCards(d).forEach(x=>{m[x.card]=(m[x.card]||0)+1;});});return m;}
function cardFace(c,rev,lv){return '<div class="tw'+(rev?' rv':'')+'">'+ART.face(c,lv)+'</div>';}
function cardBack(label){return '<div class="tw">'+ART.back()+(label?'<span class="tw-label">'+label+'</span>':'')+'</div>';}
function zoomCard(c,rev,lv){return '<button class="zoomable" data-zoom="'+c.id+'|'+(rev?1:0)+'" aria-label="放大睇'+c.name+'">'+cardFace(c,rev,lv)+'</button>';}
function hashStr(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const NEG=['攰','煩','唔開心','衰','嬲','驚','慘','頂唔順','辛苦','差','唔想','失望','難受','冇心機','討厭'];
const POS=['開心','好彩','爽','正','好食','多謝','順','笑','tips','貼士','讚','舒服','滿足'];
const countHits=(t,arr)=>arr.reduce((n,k)=>n+(t.includes(k.toLowerCase())?1:0),0);
function candidates(text){
  const t=text.toLowerCase();const total=Object.keys(S.draws||{}).length;
  return DECK.filter(c=>{if(!c.hidden)return true;if(c.need==='seven')return total>=7&&countHits(t,c.kw)>0;return countHits(t,c.kw)>0;});
}
function localPick(text,date){
  const t=text.toLowerCase();const cands=candidates(text);const h=hashStr(text+date);
  let best=null,bestScore=-1;
  cands.forEach((c,i)=>{const sc=countHits(t,c.kw)*10+(c.hidden?6:0)+((h>>>(i%24))&7)/8;if(sc>bestScore){bestScore=sc;best=c;}});
  if(bestScore<1){best=cands.filter(c=>!c.hidden)[h%22];}
  const neg=countHits(t,NEG),pos=countHits(t,POS);
  const rev=neg>pos?((h>>>3)%3!==0):((h>>>3)%5===0);
  const hit=(best.kw||[]).find(k=>t.includes(k.toLowerCase()));
  const reading=(hit?'你今晚寫到「'+hit+'」，所以抽到'+best.name+'。':'今晚抽到'+best.name+'。')+(rev?best.rev:best.up);
  return {card:best.id,rev,reading,question:best.q,action:best.act,by:'local'};
}
async function claudePick(text,date){
  if(!window.claude||!window.claude.use)return null;
  let sample=null;try{sample=await window.claude.use('sample');}catch(e){return null;}
  if(!sample)return null;
  const cands=candidates(text);
  const list=cands.map(c=>c.id+'：'+c.name+'｜'+c.up).join('\n');
  const prompt='你係「心晴手帳」入面嘅抽卡解讀者。用戶 Dicky 係喺多倫多一個人生活、做夜班外送嘅香港人，容易焦慮、怕失敗、同人比較。佢收工後寫咗以下說話：\n"""\n'+text.slice(0,3000)+'\n"""\n\n可以揀嘅牌（id：名稱｜意思）：\n'+list+
  '\n\n任務：揀一張最貼近佢今晚經歷嘅牌，再決定正位定提醒位。提醒位唔係壞兆頭，係一個溫和提醒，當佢寫嘅嘢有需要提醒自己嘅地方先用。\n規則：\n- 呢個唔係占卜。唔好預測將來，唔好講運程。\n- 用繁體中文廣東話口語，直接、具體，引用佢寫嘅細節。唔好講空泛安慰說話，唔好說教，唔好用「加油」之類。\n- reading：3 至 4 句，講點解係呢張牌，同佢今晚有咩關係。\n- question：一條佢可以喺腦入面答嘅問題。\n- action：一個聽日做得到、5 分鐘內完成嘅細行動。\n- 如果佢明確寫到想傷害自己或者唔想生存，就喺 reading 最尾溫和咁講一句：可以打或者 text 988，亦可以打開手帳嘅低潮應急卡。冇寫到就完全唔好提。\n只回覆 JSON：{"card":"牌id","reversed":true或false,"reading":"…","question":"…","action":"…"}';
  try{
    const r=await sample.json(prompt,{modelTier:'default',cache:false});
    if(!r||!cands.find(c=>c.id===r.card)||typeof r.reading!=='string')return null;
    return {card:r.card,rev:!!r.reversed,reading:r.reading,question:r.question||card(r.card).q,action:r.action||card(r.card).act,by:'claude'};
  }catch(e){return {err:e&&e.code};}
}
function readingHTML(d,showText){
  if(d.cards&&d.cards.length===3)return readingHTML3(d,showText);
  const c=card(d.card);const n=drawCounts()[c.id]||0;const lv=lvOf(n);
  return '<div class="reading">'+
    '<div class="r-head"><span class="eyebrow">'+md(d.date)+(c.hidden?'・隱藏牌':'')+'</span><h2>'+c.n+'　'+c.name+(d.rev?'（提醒位）':'')+'</h2><span class="chip '+(lv>=3?'red':'')+'">'+LVN[lv]+'・抽過 '+n+' 次</span></div>'+
    (showText?'<div class="entry-text">'+esc(d.text)+'</div>':'')+
    '<div class="r-body">'+esc(d.reading)+'</div>'+
    '<div class="grid g2"><div class="r-block"><span class="tag">問自己</span><p>'+esc(d.question)+'</p></div><div class="r-block"><span class="tag">聽日一細步</span><p>'+esc(d.action)+'</p></div></div>'+
    '<div class="r-block"><span class="tag">牌義・'+(d.rev?'提醒位':'正位')+'</span><p>'+esc(d.rev?c.rev:c.up)+'</p></div>'+
    '<div class="kq" style="margin-top:0">「'+esc(c.quote[0])+'」<small>'+esc(c.quote[1])+'</small></div>'+
    (lv>=2?'<div class="r-block"><span class="tag">牌嘅故事</span><p>'+esc(c.story)+'</p></div>':'<div class="lock">再抽到呢張 '+(3-n)+' 次，解鎖牌背後嘅故事。</div>')+
    pastNotesHTML([c.id])+
    '<div class="row"><button class="btn ghost small" data-addnext="'+d.date+'">將細步放入聽日打卡</button><button class="btn ghost small" data-notecard="'+c.id+'">寫低我對呢張牌嘅解讀</button>'+(d.by==='claude'?'<span class="muted">由 Claude 讀過你嘅說話之後揀</span>':'<span class="muted">由手帳按關鍵字揀</span>')+'</div>'+
  '</div>';
}
let drawing=false,ritual=false,redoArmed=false;
const RM=()=>!!S.settings.quiet||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function stageMsg(t){$('#stage-msg').textContent=t;}
function pileHTML(shuffle){let s='<div class="pile'+(shuffle?' shuffle':'')+'">';for(let k=6;k>=1;k--)s+='<div class="edge" style="--k:'+k+'"></div>';s+='<div class="top">'+cardBack()+'</div>';
  if(shuffle)s+='<div class="half l">'+cardBack()+'</div><div class="half r">'+cardBack()+'</div><div class="drop" style="--from:-60%;--rot:-10deg">'+cardBack()+'</div><div class="drop" style="--from:60%;--rot:10deg;animation-delay:.14s">'+cardBack()+'</div>';
  return s+'</div>';}
const FAN=[-4,-3,-2,-1,0,1,2,3,4];
function setStage(state,d){
  const t=$('#table');
  if(state==='empty'){ritual=false;t.innerHTML=pileHTML(false);stageMsg('寫低今晚嘅說話，然後撳「洗牌抽卡」。');}
  if(state==='shuffle'){ritual=true;t.innerHTML=pileHTML(true);stageMsg(window.claude?'洗緊牌……讀緊你今晚寫嘅嘢。':'洗緊牌……整理緊今晚嘅故事。');}
  if(state==='spread'){ritual=true;
    t.innerHTML='<div class="fan opening">'+FAN.map((a,i)=>'<button class="fc" style="--n:'+a+';--i:'+i+';z-index:'+i+'" data-fc="'+i+'" aria-label="第 '+(i+1)+' 張牌">'+cardBack()+'</button>').join('')+'</div>';
    const fan=t.querySelector('.fan');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{fan.classList.add('open');setTimeout(()=>fan.classList.remove('opening'),900);}));
    stageMsg(d&&d.cards?'揀三張。第一張係「今晚做到咩」，跟住「身體同心」，最後「聽日一步」。':'揀一張你覺得啱嘅。今晚嘅牌已經由你嘅說話決定咗，揀邊張都會帶你搵到佢。');}
  if(state==='shown'){ritual=false;showFace(d,false);}
}
function showFace(d,animate){
  if(d.cards&&d.cards.length===3){showFace3(d,animate);return;}
  const c=card(d.card);const lv=lvOf(drawCounts()[c.id]||0);
  $('#table').innerHTML='<div class="reveal"><div class="halo"></div><button class="flip" id="flip" data-zoom="'+c.id+'|'+(d.rev?1:0)+'" aria-label="'+c.name+'，撳一下放大"><div class="side back">'+cardBack()+'</div><div class="side front">'+cardFace(c,d.rev,lv)+'</div></button></div>';
  const fl=$('#flip'),rv=$('#table .reveal');
  const done=()=>{rv.classList.add('lit');stageMsg(c.name+(d.rev?'・提醒位（張牌倒轉咗）':'・正位')+'。撳張牌可以放大睇。');ritual=false;showReading(d);};
  if(!animate||RM()){fl.classList.add('flipped');done();return;}
  stageMsg('翻牌……');
  setTimeout(()=>fl.classList.add('flipped'),180);
  setTimeout(done,1250);
}
function readingHTML3(d,showText){const cs=d.cards;const cnt=drawCounts();
  return '<div class="reading"><div class="r-head"><span class="eyebrow">'+md(d.date)+'・三張牌陣</span><h2>'+cs.map(x=>card(x.card).name).join('・')+'</h2></div>'+
    (showText?'<div class="entry-text">'+esc(d.text)+'</div>':'')+
    '<div class="spread3">'+cs.map((x,i)=>{const c=card(x.card);return '<div class="sp-i"><span class="tag">'+(i+1)+'・'+POS3[i]+'</span><div class="mini-card">'+zoomCard(c,x.rev,lvOf(cnt[c.id]||0))+'</div><b>'+c.name+(x.rev?'（提醒位）':'')+'</b><p>'+esc(x.text||'')+'</p></div>';}).join('')+'</div>'+
    '<div class="r-body">'+esc(d.reading)+'</div>'+
    '<div class="grid g2"><div class="r-block"><span class="tag">問自己</span><p>'+esc(d.question)+'</p></div><div class="r-block"><span class="tag">聽日一細步</span><p>'+esc(d.action)+'</p></div></div>'+
    pastNotesHTML(cs.map(x=>x.card))+
    '<div class="row"><button class="btn ghost small" data-addnext="'+d.date+'">將細步放入聽日打卡</button>'+(d.by==='claude'?'<span class="muted">由 Claude 讀過你嘅說話之後揀</span>':'<span class="muted">由手帳按關鍵字揀</span>')+'</div>'+
  '</div>';}
function showReading(d){const r=$('#dr-reading');r.innerHTML=readingHTML(d,false)+'<hr class="sep"><div class="row"><button class="btn ghost small danger" id="dr-redo">'+(redoArmed?'再撳一次確認重抽':'改寫重抽')+'</button><span class="muted">每晚一次。想改寫就重抽，舊嗰次會被取代。</span></div>';r.hidden=false;}
function renderDraw(){
  const k=defaultDay();
  $('#dr-date').textContent=md(k)+'・星期'+WD[parseKey(k).getDay()]+'嘅收工日記（夜班按開工日計）';
  $('#dr-count').textContent=$('#dr-text').value.length+' 字';
  if(ritual||drawing)return;
  const d=(S.draws||{})[k];
  if(d){$('#dr-text').value=d.text;$('#dr-text').disabled=true;$('#dr-go').hidden=true;setStage('shown',d);}
  else{const draft=readDraft('draw',k);if(draft)$('#dr-text').value=draft.text||'';$('#dr-text').disabled=false;$('#dr-go').hidden=false;setStage('empty');$('#dr-reading').hidden=true;}
  $('#dr-count').textContent=$('#dr-text').value.length+' 字';
}
$('#dr-text').addEventListener('input',()=>{$('#dr-count').textContent=$('#dr-text').value.length+' 字';});
$('#dr-go').addEventListener('click',async()=>{
  const text=$('#dr-text').value.trim();
  if(text.length<4){stageMsg('寫多少少先抽，一兩句都得。');$('#dr-text').focus();return;}
  if(drawing)return;drawing=true;const drawOwner=S,drawEpoch=authEpoch;
  $('#dr-go').disabled=true;$('#dr-text').disabled=true;$('#dr-reading').hidden=true;$('#dr-mode').textContent='';
  setStage('shuffle');
  try{$('#table').scrollIntoView({behavior:RM()?'auto':'smooth',block:'center'});}catch(e){}
  const k=defaultDay();
  const minShuffle=sleep(RM()?400:3000);
  const timeout=new Promise(r=>setTimeout(()=>r(null),30000));
  const three=segGet('drawmode')==='three';
  let res=await Promise.race([three?claudeSpread(text,k):claudePick(text,k),timeout]);
  if(S!==drawOwner||authEpoch!==drawEpoch){drawing=false;$('#dr-go').disabled=false;showDrawTab();return;}
  let note='';
  if(!res||res.err){note=res&&res.err==='not_granted'?'你冇俾手帳問 Claude，今次由手帳按關鍵字揀。':'由手帳喺本機按關鍵字揀牌。';res=three?localSpread(text,k):localPick(text,k);}
  const d={date:k,text,card:res.card,rev:res.rev,reading:res.reading,question:res.question,action:res.action,by:res.by,t:Date.now()};
  if(res.cards){d.mode='three';d.cards=res.cards;}
  S.draws=S.draws||{};S.draws[k]=d;
  persist({month:k.slice(0,7)});
  if(storageOK)removeDraft('draw',k);
  petAward('draw',10,1,'收工抽卡');
  await minShuffle;
  if(S!==drawOwner||authEpoch!==drawEpoch){drawing=false;$('#dr-go').disabled=false;showDrawTab();return;}
  drawing=false;$('#dr-go').disabled=false;$('#dr-go').hidden=true;
  $('#dr-mode').textContent=note;
  setStage('spread',d);
});
$('#table').addEventListener('click',e=>{
  const b=e.target.closest('[data-fc]');if(!b)return;
  const fan=b.closest('.fan');if(!fan||fan.dataset.picked)return;
  const d=S.draws[defaultDay()];if(!d)return;
  if(d.cards){if(b.classList.contains('chosen'))return;const n=fan.querySelectorAll('.fc.chosen').length+1;b.classList.add('chosen');b.insertAdjacentHTML('beforeend','<span class="fc-no">'+n+'</span>');
    if(n<3){stageMsg(n===1?'好。第二張：「身體同心」。':'最後一張：「聽日一步」。');return;}
    fan.dataset.picked='1';fan.querySelectorAll('.fc:not(.chosen)').forEach(x=>x.classList.add('gone'));stageMsg('三張都揀好喇。');setTimeout(()=>showFace3(d,true),RM()?0:800);return;}
  fan.dataset.picked='1';
  fan.querySelectorAll('.fc').forEach(x=>x.classList.add(x===b?'picked':'gone'));
  stageMsg('就係佢。');
  setTimeout(()=>showFace(d,true),RM()?0:650);
});
/* 放大睇 */
function openLB(id,rev){const c=card(id);if(!c)return;const lv=lvOf(drawCounts()[c.id]||0);$('#lb-card').innerHTML=cardFace(c,rev,lv);$('#lb-cap').textContent=c.n+'　'+c.name+(rev?'・提醒位':'');$('#lb').hidden=false;$('#lb-close').focus();}
function closeLB(){$('#lb').hidden=true;}
document.addEventListener('click',e=>{
  const z=e.target.closest('[data-zoom]');
  if(z&&!z.closest('.fan')){if(z.classList.contains('flip')&&!z.classList.contains('flipped'))return;const [id,r]=z.dataset.zoom.split('|');openLB(id,r==='1');return;}
  if(e.target.id==='lb'||e.target.id==='lb-close')closeLB();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lb').hidden)closeLB();});
document.addEventListener('click',e=>{
  const b=e.target.closest('#dr-redo');
  if(b){if(!redoArmed){redoArmed=true;showReading(S.draws[defaultDay()]);setTimeout(()=>{redoArmed=false;},5000);return;}
    redoArmed=false;const k=defaultDay();delete S.draws[k];persist({month:k.slice(0,7)});$('#dr-text').disabled=false;$('#dr-go').hidden=false;setStage('empty');$('#dr-reading').hidden=true;$('#dr-text').focus();return;}
  const a=e.target.closest('[data-addnext]');
  if(a){const d=S.draws[a.dataset.addnext];if(!d)return;const ck=S.checkins[d.date];
    if(ck){ck.next=(ck.next?ck.next+'\n':'')+d.action;ck.t=Date.now();persist({year:d.date.slice(0,4)});}
    else{S.checkins[d.date]={work:null,mood:5,anx:5,energy:5,ss:'',se:'',seg:null,contact:null,move:null,mastery:'',pleasure:'',next:d.action,t:Date.now()};persist({year:d.date.slice(0,4)});}
    loadForm(defaultDay());toast('已放入嗰日打卡嘅「聽日一個細步」');}
});
/* 牌庫圖鑑 */
let deckSel=null;
function renderDeck(){
  const cnt=drawCounts();const main=DECK.filter(c=>!c.hidden),hid=DECK.filter(c=>c.hidden);
  const got=main.filter(c=>cnt[c.id]).length,hgot=hid.filter(c=>cnt[c.id]).length,total=Object.keys(S.draws||{}).length;
  $('#deck-stats').innerHTML=[['主牌收集',got+'／22',''],['隱藏牌',hgot+'／4',''],['總共抽咗',total,'晚']].map(([a,b,c])=>'<div class="sheet stat"><span>'+a+'</span><b>'+b+' <small>'+c+'</small></b></div>').join('');
  const from=addDays(keyOf(new Date()),-30);const recent={};let revN=0,rn=0;
  Object.values(S.draws||{}).forEach(d=>{if(d.date>=from){rn++;drawCards(d).forEach(x=>{recent[x.card]=(recent[x.card]||0)+1;if(x.rev)revN++;});}});
  const top=Object.entries(recent).sort((a,b)=>b[1]-a[1]).slice(0,3);
  $('#deck-insight').innerHTML='<h2>最近 30 日嘅牌</h2>'+(top.length?'<div class="sub">牌唔會預測將來，但會反映你最近寫得最多嘅主題。</div><div class="row" style="gap:14px;align-items:flex-start">'+top.map(([id,n])=>{const c=card(id);return '<div class="mini-card">'+zoomCard(c,false,lvOf(cnt[id]))+'<div class="muted" style="text-align:center;margin-top:6px">'+c.name+'・'+n+' 次</div></div>';}).join('')+'<div style="flex:1;min-width:200px;font-size:14.5px;display:flex;flex-direction:column;gap:6px">'+top.map(([id])=>'<span><b style="font-weight:500">'+card(id).name+'</b>：'+esc(card(id).up)+'</span>').join('')+(rn?'<span class="muted">最近抽咗 '+rn+' 晚，入面有 '+revN+' 張係提醒位。</span>':'')+'</div></div>':'<div class="sub" style="margin-bottom:0">抽咗幾晚之後，呢度會話你知最近最常出現邊幾張牌，同埋佢哋反映嘅主題。</div>');
  const query=($('#deck-search').value||'').trim().toLowerCase(),filter=$('#deck-filter').value;
  const visible=DECK.filter(c=>(filter==='all'||(filter==='owned'?!!cnt[c.id]:!cnt[c.id]))&&(!query||(!(c.hidden&&!cnt[c.id])&&(c.name+c.n).toLowerCase().includes(query))));
  $('#deck-result').textContent=visible.length+' 張牌';
  $('#deck-grid').innerHTML=visible.map(c=>{const n=cnt[c.id]||0;const lv=lvOf(n);
    const inner=n?cardFace(c,false,lv):(c.hidden?cardBack('✦ ？'):cardBack(c.n));
    const cap=n?c.name+'<small>'+LVN[lv]+' ×'+n+'</small>':(c.hidden?'？？？<small>隱藏牌</small>':c.name+'<small>未遇</small>');
    return '<button class="mc'+(n?'':' locked')+(deckSel===c.id?' sel':'')+'" data-card="'+c.id+'" aria-label="'+(n||!c.hidden?c.name:'隱藏牌')+'">'+inner+'<span class="mc-cap">'+cap+'</span></button>';}).join('');
  renderDeckDetail();
}
$('#deck-search').addEventListener('input',renderDeck);
$('#deck-filter').addEventListener('change',renderDeck);
function renderDeckDetail(){
  const box=$('#deck-detail');if(!deckSel){box.hidden=true;return;}
  const c=card(deckSel);const n=drawCounts()[c.id]||0;const lv=lvOf(n);
  const dates=Object.values(S.draws||{}).filter(d=>drawCards(d).some(x=>x.card===c.id)).sort((a,b)=>b.date.localeCompare(a.date));
  if(!n&&c.hidden){box.innerHTML='<h2>✦ 隱藏牌</h2><p class="muted" style="margin-top:6px">提示：'+esc(c.hint)+'</p>';box.hidden=false;return;}
  box.innerHTML='<div class="row" style="align-items:flex-start;gap:18px"><div class="mini-card" style="width:150px">'+(n?zoomCard(c,false,lv):cardBack(c.n))+'</div><div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:10px">'+
    '<div class="r-head" style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h2>'+c.n+'　'+c.name+'</h2><span class="chip">'+LVN[lv]+(n?'・'+n+' 次':'')+'</span></div>'+
    '<div class="r-block"><span class="tag">正位</span><p>'+esc(c.up)+'</p></div><div class="r-block"><span class="tag">提醒位</span><p>'+esc(c.rev)+'</p></div>'+
    '<div class="kq" style="margin-top:0">「'+esc(c.quote[0])+'」<small>'+esc(c.quote[1])+'</small></div>'+
    (lv>=2?'<div class="r-block"><span class="tag">牌嘅故事</span><p>'+esc(c.story)+'</p></div>':'<div class="lock">'+(n?'再抽到 '+(3-n)+' 次':'抽到 3 次')+'解鎖牌背後嘅故事。</div>')+
    (dates.length?'<div class="r-block"><span class="tag">抽到嘅晚上</span><p>'+dates.map(d=>'<button class="linkbtn" data-openday="'+d.date+'">'+md(d.date)+(drawCards(d).find(x=>x.card===c.id).rev?'（提醒位）':'')+(d.cards?'・三張':'')+'</button>').join('　')+'</p></div>':'')+
    notesBlock(c)+
  '</div></div>';
  box.hidden=false;
}
$('#deck-grid').addEventListener('click',e=>{const b=e.target.closest('[data-card]');if(!b)return;deckSel=b.dataset.card;renderDeck();$('#deck-detail').scrollIntoView({block:'nearest'});});
/* 書櫃 */
let shelfSel=null;
function renderShelf(){
  const q=$('#shelf-q').value.trim().toLowerCase();
  const all=Object.values(S.draws||{}).filter(d=>!q||d.text.toLowerCase().includes(q)||drawCards(d).some(x=>card(x.card).name.includes(q))).sort((a,b)=>a.date.localeCompare(b.date));
  if(!all.length){$('#shelf').innerHTML='<p class="muted" style="padding:30px 0;text-align:center">'+(q?'搵唔到「'+esc(q)+'」。':'書櫃仲係空嘅。今晚收工抽第一張，第一本書就會放上嚟。')+'</p>';$('#shelf-detail').hidden=true;return;}
  const months={};all.forEach(d=>{(months[d.date.slice(0,7)]=months[d.date.slice(0,7)]||[]).push(d);});
  $('#shelf').innerHTML=Object.keys(months).sort().reverse().map(m=>{const [y,mo]=m.split('-');return '<div class="shelf-m"><h3>'+y+' 年 '+(+mo)+' 月・'+months[m].length+' 本</h3><div class="shelf">'+months[m].map(d=>{const c=card(d.card);const h=110+Math.min(60,Math.round(d.text.length/5));return '<button class="spine t-'+c.tone+(shelfSel===d.date?' on':'')+'" style="height:'+h+'px" data-openday="'+d.date+'" aria-label="'+md(d.date)+' '+c.name+'"><b>'+parseKey(d.date).getDate()+'</b><span>'+(d.cards?'三張牌陣':c.name)+'</span></button>';}).join('')+'</div></div>';}).join('');
  renderShelfDetail();
}
function renderShelfDetail(){const box=$('#shelf-detail');const d=shelfSel&&(S.draws||{})[shelfSel];if(!d){box.hidden=true;return;}const c=card(d.card);
  box.innerHTML=d.cards?readingHTML(d,true):'<div class="row" style="align-items:flex-start;gap:18px"><div class="mini-card" style="width:150px">'+zoomCard(c,d.rev,lvOf(drawCounts()[c.id]||0))+'</div><div style="flex:1;min-width:220px">'+readingHTML(d,true)+'</div></div>';box.hidden=false;}
$('#shelf-q').addEventListener('input',renderShelf);
document.addEventListener('click',e=>{const b=e.target.closest('[data-openday]');if(!b)return;shelfSel=b.dataset.openday;segSet('drawtab','shelf');showDrawTab();renderShelf();$('#shelf-detail').scrollIntoView({block:'nearest'});});
function showDrawTab(){const v=segGet('drawtab')||'draw';$('#dv-draw').hidden=v!=='draw';$('#dv-deck').hidden=v!=='deck';$('#dv-shelf').hidden=v!=='shelf';if(v==='draw')renderDraw();if(v==='deck')renderDeck();if(v==='shelf')renderShelf();}
document.addEventListener('click',e=>{if(e.target.closest('.seg[data-name="drawtab"] button'))setTimeout(showDrawTab,0);});
/* ---------- 三張牌陣・我嘅牌義筆記（概念參考 Querent.py） ---------- */
const POS3=['今晚做到咩','身體同心','聽日一步'];
function drawCards(d){return d.cards&&d.cards.length?d.cards:[{card:d.card,rev:d.rev}];}
function localSpread(text,date){const t=text.toLowerCase();const cands=candidates(text);const h=hashStr(text+'|3|'+date);
 const sc=cands.map((c,i)=>[c,countHits(t,c.kw)*10+(c.hidden?6:0)+((h>>>(i%24))&7)/8]).sort((a,b)=>b[1]-a[1]);
 const picks=sc.filter(x=>x[1]>=1).slice(0,3).map(x=>x[0]);const main=cands.filter(c=>!c.hidden);let j=0;
 while(picks.length<3){const c=main[(h+j*7)%main.length];if(!picks.includes(c))picks.push(c);j++;}
 const neg=countHits(t,NEG),pos=countHits(t,POS);
 const cards=picks.map((c,i)=>{const r=(h>>>(3+i*3))%6;const rev=i===0?false:(neg>pos?r<2:r===0);return {card:c.id,rev,text:(rev?c.rev:c.up)};});
 const nm=i=>card(cards[i].card).name;
 const reading='三張一齊睇：「'+nm(0)+'」講你今晚其實已經做到嘅嘢；「'+nm(1)+'」提你留意身體同心而家需要啲咩；「'+nm(2)+'」就係聽日可以行嘅一小步。';
 return {cards,card:cards[0].card,rev:cards[0].rev,reading,question:picks[1].q,action:picks[2].act,by:'local'};}
async function claudeSpread(text,date){
 if(!window.claude||!window.claude.use)return null;let sample=null;try{sample=await window.claude.use('sample');}catch(e){return null;}if(!sample)return null;
 const cands=candidates(text);const list=cands.map(c=>c.id+'：'+c.name+'｜'+c.up).join('\n');
 const prompt='你係「心晴手帳」入面嘅抽卡解讀者。用戶 Dicky 係喺多倫多一個人生活、做夜班外送嘅香港人，容易焦慮、怕失敗、同人比較。佢收工後寫咗以下說話：\n"""\n'+text.slice(0,3000)+'\n"""\n\n可以揀嘅牌（id：名稱｜意思）：\n'+list+
 '\n\n任務：揀三張唔同嘅牌，排成「三張牌陣」，三個位置都係向前望、積極嘅：\n1. 今晚做到咩：佢今晚其實做到咗、撐住咗嘅嘢（用佢寫嘅細節）\n2. 身體同心：佢身體同心情而家嘅狀態，同佢需要咩照顧\n3. 聽日一步：聽日可以行嘅一小步\n每張決定正位定提醒位。第一張一定用正位。提醒位唔係壞兆頭，只係溫和提醒。\n規則：\n- 呢個唔係占卜。唔好預測將來，唔好講運程。\n- 用繁體中文廣東話口語，直接、具體，引用佢寫嘅細節。唔好講空泛安慰說話，唔好說教，唔好用「加油」之類。\n- 每張牌嘅 text：1 至 2 句，講呢張牌喺呢個位置同佢今晚有咩關係。\n- reading：2 至 3 句，將三張牌串埋一齊講。\n- question：一條佢可以喺腦入面答嘅問題。\n- action：一個聽日做得到、5 分鐘內完成嘅細行動。\n- 如果佢明確寫到想傷害自己或者唔想生存，就喺 reading 最尾溫和咁講一句：可以打或者 text 988，亦可以打開手帳嘅低潮應急卡。冇寫到就完全唔好提。\n只回覆 JSON：{"cards":[{"card":"牌id","reversed":false,"text":"…"},{"card":"牌id","reversed":false,"text":"…"},{"card":"牌id","reversed":false,"text":"…"}],"reading":"…","question":"…","action":"…"}';
 try{const r=await sample.json(prompt,{modelTier:'default',cache:false});
  if(!r||!Array.isArray(r.cards)||r.cards.length!==3||typeof r.reading!=='string')return null;
  const ids=r.cards.map(x=>x&&x.card);if(new Set(ids).size!==3||ids.some(id=>!cands.find(c=>c.id===id)))return null;
  const cards=r.cards.map((x,i)=>({card:x.card,rev:i===0?false:!!x.reversed,text:String(x.text||'').slice(0,400)}));
  return {cards,card:cards[0].card,rev:false,reading:r.reading,question:r.question||card(cards[1].card).q,action:r.action||card(cards[2].card).act,by:'claude'};
 }catch(e){return {err:e&&e.code};}}
function showFace3(d,animate){const cnt=drawCounts();
 $('#table').innerHTML='<div class="reveal3">'+d.cards.map((x,i)=>{const c=card(x.card);return '<div class="r3"><div class="halo"></div><button class="flip" data-zoom="'+c.id+'|'+(x.rev?1:0)+'" aria-label="'+POS3[i]+'：'+c.name+'，撳一下放大"><div class="side back">'+cardBack()+'</div><div class="side front">'+cardFace(c,x.rev,lvOf(cnt[c.id]||0))+'</div></button><span class="r3-pos">'+POS3[i]+'</span></div>';}).join('')+'</div>';
 const fls=$$('#table .flip'),rs=$$('#table .r3');
 const done=()=>{rs.forEach(r=>r.classList.add('lit'));stageMsg(d.cards.map(x=>card(x.card).name+(x.rev?'（提醒）':'')).join('・')+'。撳牌可以放大。');ritual=false;showReading(d);};
 if(!animate||RM()){fls.forEach(f=>f.classList.add('flipped'));done();return;}
 stageMsg('翻牌……');fls.forEach((f,i)=>setTimeout(()=>f.classList.add('flipped'),200+i*520));setTimeout(done,200+2*520+1200);}
/* 牌義筆記 */
function notesFor(id){return ((S.cardNotes||{})[id]||[]);}
function pastNotesHTML(ids){const items=[];ids.forEach(id=>notesFor(id).slice(-2).reverse().forEach(n=>items.push([id,n])));if(!items.length)return '';
 return '<div class="r-block notes-past"><span class="tag">你以前寫過</span>'+items.slice(0,4).map(([id,n])=>'<p>'+(ids.length>1?'<b>'+card(id).name+'</b>・':'')+'<span class="muted">'+md(n.date)+'</span>　'+esc(n.text)+'</p>').join('')+'</div>';}
function notesBlock(c){const ns=notesFor(c.id);
 return '<div class="r-block"><span class="tag">我自己嘅解讀</span>'+(ns.length?ns.slice().reverse().map(n=>'<div class="note-i"><p><span class="muted">'+md(n.date)+'</span>　'+esc(n.text)+'</p><button class="x" data-delnote="'+c.id+'|'+n.id+'" aria-label="刪除呢條">×</button></div>').join(''):'<p class="muted">呢張牌對你嚟講代表咩？寫低你自己嘅睇法，下次抽到佢就會再見到，越寫越豐富。</p>')+
 '<div class="row" style="flex-wrap:nowrap;margin-top:8px"><input type="text" id="note-in" maxlength="200" placeholder="例如：對我嚟講，呢張係「慢慢嚟都得」" style="flex:1;min-width:0"><button class="btn small" data-addnote="'+c.id+'">加</button></div></div>';}
function addNote(id){const i=$('#note-in');const v=i?i.value.trim():'';if(!v){if(i)i.focus();return;}S.cardNotes=S.cardNotes||{};(S.cardNotes[id]=S.cardNotes[id]||[]).push({id:uid(),date:keyOf(new Date()),text:v.slice(0,200)});persist();renderDeckDetail();toast('寫低咗，下次抽到會再見到');}
document.addEventListener('click',e=>{const a=e.target.closest('[data-addnote]');if(a){addNote(a.dataset.addnote);return;}
 const x=e.target.closest('[data-delnote]');if(x){if(!x.classList.contains('arm')){x.classList.add('arm');x.textContent='確認刪除';setTimeout(()=>{if(x.isConnected){x.classList.remove('arm');x.textContent='×';}},4000);return;}
  const [cid,nid]=x.dataset.delnote.split('|');S.cardNotes[cid]=(S.cardNotes[cid]||[]).filter(n=>n.id!==nid);if(!S.cardNotes[cid].length)delete S.cardNotes[cid];persist();renderDeckDetail();return;}
 const g=e.target.closest('[data-notecard]');if(g){deckSel=g.dataset.notecard;segSet('drawtab','deck');showDrawTab();setTimeout(()=>{const i=$('#note-in');if(i){try{i.scrollIntoView({block:'center'});}catch(err){}i.focus();}},60);}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='note-in'){e.preventDefault();const b=document.querySelector('[data-addnote]');if(b)addNote(b.dataset.addnote);}});


/* 心晴手帳・賽博寵物 插畫模組 */
const PET=(()=>{
const f=n=>Math.round(n*10)/10;
function rng(seed){let s=(seed>>>0)||7;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const PAL={
 milktea:{n:'奶茶',body:'#ecd3ad',shade:'#cfae80',belly:'#f8ead2',accent:'#ff9fb2',glow:'#5fe3cf'},
 mint:{n:'薄荷',body:'#c9ecdf',shade:'#93c9b6',belly:'#ecf9f3',accent:'#ff9fb2',glow:'#7cc6ff'},
 sakura:{n:'櫻花',body:'#f6cfd9',shade:'#dfa2b3',belly:'#fdecf1',accent:'#ff7f9e',glow:'#ffcf6b'},
 night:{n:'夜空',body:'#4a5480',shade:'#323a5c',belly:'#6d78a6',accent:'#ff9fb2',glow:'#9ff0ff'},
 snow:{n:'雪白',body:'#f3f0ea',shade:'#d3ccbf',belly:'#ffffff',accent:'#ff9fb2',glow:'#6fd2ff'},
 aurora:{n:'極光',body:'#e4dcff',shade:'#b2a2ec',belly:'#f6f1ff',accent:'#ff9fd0',glow:'#ffd27a',rare:1}
};
const SPECIES={cat:'電波貓',dog:'機械柴',cloud:'雲朵獸'};
const STAGES=[{n:'幼崽',s:.74,xp:0},{n:'少年',s:.87,xp:120},{n:'成年',s:1,xp:420}];
const VISOR='#1c2136';

function eyes(expr,g){
 const st='stroke="'+g+'" stroke-width="4" stroke-linecap="round" fill="none"';
 switch(expr){
  case 'happy':return '<path d="M78 101Q86 89 94 101M106 101Q114 89 122 101" '+st+'/><path d="M93 108Q100 116 107 108Z" fill="'+g+'"/>';
  case 'love':return '<path d="M86 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z" fill="'+g+'"/><path d="M114 104l-8 -8a4.6 4.6 0 0 1 8 -5a4.6 4.6 0 0 1 8 5z" fill="'+g+'"/><path d="M95 110Q100 114 105 110" '+st+' stroke-width="3"/>';
  case 'sleep':return '<path d="M78 98H93M107 98H122" '+st+'/><path d="M96 109Q100 111 104 109" '+st+' stroke-width="2.6"/>';
  case 'eat':return '<path d="M78 99Q86 89 94 99M106 99Q114 89 122 99" '+st+'/><ellipse cx="100" cy="110" rx="6" ry="5" fill="'+g+'"/>';
  case 'wow':return '<circle cx="86" cy="96" r="6" '+st+' stroke-width="3.4"/><circle cx="114" cy="96" r="6" '+st+' stroke-width="3.4"/><circle cx="100" cy="110" r="3" fill="'+g+'"/>';
  case 'ask':return '<g class="blink"><rect x="81" y="88" width="9" height="15" rx="4.5" fill="'+g+'"/><rect x="110" y="88" width="9" height="15" rx="4.5" fill="'+g+'"/></g><path d="M95 110Q100 107 105 110" '+st+' stroke-width="2.6"/>';
  default:return '<g class="blink"><rect x="81" y="88" width="9" height="15" rx="4.5" fill="'+g+'"/><rect x="110" y="88" width="9" height="15" rx="4.5" fill="'+g+'"/></g><path d="M93 108Q96.5 112 100 108Q103.5 112 107 108" '+st+' stroke-width="2.6"/>';
 }
}
function visor(expr,c,y=0){return '<g transform="translate(0 '+y+')"><rect x="64" y="76" width="72" height="42" rx="19" fill="'+VISOR+'"/><rect x="64" y="76" width="72" height="42" rx="19" fill="none" stroke="'+c.glow+'" stroke-opacity=".35" stroke-width="2"/><path d="M74 84Q82 80 92 80" stroke="#fff" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" fill="none"/>'+eyes(expr,c.glow)+'</g>';}
function acc(a,stage){
 const y=stage===0?0:0;
 switch(a){
  case 'scarf':return '<path d="M58 128Q100 146 142 128L144 138Q100 158 56 138Z" fill="#c64b3a"/><path d="M118 142L126 168L112 166L110 144Z" fill="#b13c2d"/><path d="M60 133Q100 150 140 133" stroke="#f2c94a" stroke-width="2" stroke-dasharray="4 4" fill="none"/>';
  case 'bow':return '<path d="M118 52L134 42L136 62Z" fill="#ff7f9e"/><path d="M118 52L104 40L102 60Z" fill="#ff7f9e"/><circle cx="118" cy="52" r="5" fill="#e85c80"/>';
  case 'beanie':return '<path d="M56 74Q58 30 100 30Q142 30 144 74Z" fill="#3f6f93"/><rect x="54" y="66" width="92" height="14" rx="7" fill="#2f5675"/><circle cx="100" cy="28" r="9" fill="#f4ead3"/>';
  case 'flower':return '<g transform="translate(130 50)">'+[0,72,144,216,288].map(r=>'<ellipse cx="0" cy="-7" rx="5" ry="7" fill="#fff4c8" transform="rotate('+r+')"/>').join('')+'<circle r="4.5" fill="#f2b71e"/></g>';
  case 'bell':return '<path d="M62 130Q100 146 138 130" stroke="#c64b3a" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="100" cy="142" r="8" fill="#f2c94a" stroke="#b8862f"/><path d="M96 144H104" stroke="#b8862f" stroke-width="1.6"/>';
  default:return '';
 }
}
/* 主角：回傳一個 200×200 坐標嘅 <g>，腳底中心 (100,188) */
function body(o){
 const c=PAL[o.color]||PAL.milktea,sp=o.sp||'cat',st=o.stage||0,expr=o.expr||'normal';
 const sc=(STAGES[st]||STAGES[0]).s;
 let g='<ellipse cx="100" cy="190" rx="'+(sp==='cloud'?34:48)+'" ry="7" fill="#000" opacity=".16"/>';
 let inner='';
 if(o.shiny){inner+='<circle cx="100" cy="112" r="86" fill="#ffd27a" opacity=".10"/><circle cx="100" cy="112" r="74" fill="#ff9fd0" opacity=".10"/><circle cx="100" cy="112" r="62" fill="#9ff0ff" opacity=".12"/>';[[26,70,7],[174,56,6],[22,150,5],[180,140,7],[60,24,5],[150,186,5]].forEach(([x,y,r])=>{inner+='<path d="M'+x+' '+(y-r*2)+'Q'+(x+r*.3)+' '+(y-r*.3)+' '+(x+r*2)+' '+y+'Q'+(x+r*.3)+' '+(y+r*.3)+' '+x+' '+(y+r*2)+'Q'+(x-r*.3)+' '+(y+r*.3)+' '+(x-r*2)+' '+y+'Q'+(x-r*.3)+' '+(y-r*.3)+' '+x+' '+(y-r*2)+'Z" fill="#ffd27a" class="twinkle"/>';});}
 const ant='<path d="M100 46V26" stroke="'+c.shade+'" stroke-width="3.4" stroke-linecap="round"/><circle cx="100" cy="21" r="13" fill="'+c.glow+'" opacity=".28" class="glowpulse"/><circle cx="100" cy="21" r="6.5" fill="'+c.glow+'"/><circle cx="98" cy="19" r="2" fill="#fff" opacity=".8"/>';
 const ol='stroke="'+(o.shiny?'#f2c94a':c.shade)+'" stroke-width="'+(o.shiny?6:5)+'" stroke-linejoin="round"';
 if(sp!=='cloud')inner+='<g fill="'+c.shade+'" '+ol+'><ellipse cx="100" cy="152" rx="46" ry="38"/><circle cx="100" cy="94" r="48"/></g>';
 if(sp==='cat'){
  inner+='<path d="M136 162Q172 160 168 124Q166 108 176 102" stroke="'+c.body+'" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="176" cy="100" r="8" fill="'+c.glow+'"/><circle cx="176" cy="100" r="14" fill="'+c.glow+'" opacity=".25"/>';
  inner+='<ellipse cx="100" cy="152" rx="46" ry="38" fill="'+c.body+'"/><ellipse cx="100" cy="160" rx="28" ry="22" fill="'+c.belly+'"/>';
  inner+='<ellipse cx="78" cy="185" rx="14" ry="7.5" fill="'+c.shade+'"/><ellipse cx="122" cy="185" rx="14" ry="7.5" fill="'+c.shade+'"/>';
  inner+='<path d="M60 72L54 28Q56 24 60 26L92 52Z" fill="'+c.body+'" stroke="'+c.shade+'" stroke-width="2.4" stroke-linejoin="round"/><path d="M64 62L61 38L82 54Z" fill="'+c.accent+'" opacity=".7"/><path d="M140 72L146 28Q144 24 140 26L108 52Z" fill="'+c.body+'" stroke="'+c.shade+'" stroke-width="2.4" stroke-linejoin="round"/><path d="M136 62L139 38L118 54Z" fill="'+c.accent+'" opacity=".7"/>';
  inner+=ant+'<circle cx="100" cy="94" r="48" fill="'+c.body+'"/><path d="M62 114Q100 146 138 114" stroke="'+c.shade+'" stroke-opacity=".35" stroke-width="2" fill="none"/>';
  inner+=visor(expr,c)+'<ellipse cx="57" cy="114" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/><ellipse cx="143" cy="114" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/>';
  inner+='<path d="M48 104H34M48 110L35 114M152 104H166M152 110L165 114" stroke="'+c.shade+'" stroke-width="2" stroke-linecap="round"/>';
  inner+='<ellipse cx="82" cy="170" rx="11" ry="9" fill="'+c.body+'" stroke="'+c.shade+'" stroke-opacity=".5"/><ellipse cx="118" cy="170" rx="11" ry="9" fill="'+c.body+'" stroke="'+c.shade+'" stroke-opacity=".5"/>';
 }else if(sp==='dog'){
  inner+='<circle cx="146" cy="138" r="14" fill="none" stroke="'+c.body+'" stroke-width="9"/><circle cx="146" cy="124" r="4" fill="'+c.glow+'"/>';
  inner+='<ellipse cx="100" cy="152" rx="46" ry="38" fill="'+c.body+'"/><ellipse cx="100" cy="160" rx="28" ry="22" fill="'+c.belly+'"/>';
  inner+='<ellipse cx="78" cy="185" rx="14" ry="7.5" fill="'+c.shade+'"/><ellipse cx="122" cy="185" rx="14" ry="7.5" fill="'+c.shade+'"/>';
  inner+='<path d="M58 66Q50 30 70 34Q84 40 88 56Z" fill="'+c.shade+'"/><path d="M142 66Q150 30 130 34Q116 40 112 56Z" fill="'+c.shade+'"/>';
  inner+='<path d="M100 46V34" stroke="'+c.shade+'" stroke-width="3.4" stroke-linecap="round"/><path d="M90 32Q100 22 110 32Z" fill="'+c.glow+'"/><circle cx="100" cy="28" r="12" fill="'+c.glow+'" opacity=".25" class="glowpulse"/>';
  inner+='<circle cx="100" cy="94" r="48" fill="'+c.body+'"/><ellipse cx="100" cy="124" rx="26" ry="16" fill="'+c.belly+'"/><ellipse cx="100" cy="118" rx="7" ry="5" fill="#3a2a20"/><path d="M100 123V128M94 130Q100 134 106 130" stroke="#3a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>';
  inner+='<g transform="translate(0 -8)">'+visor(expr,c)+'</g>';
  inner+='<path d="M140 76l6 3v7l-6 3l-6 -3v-7z" fill="'+c.shade+'"/><circle cx="140" cy="82.5" r="2" fill="'+c.glow+'"/>';
  inner+='<ellipse cx="58" cy="112" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/><ellipse cx="142" cy="112" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/>';
  inner+='<ellipse cx="82" cy="172" rx="11" ry="9" fill="'+c.body+'" stroke="'+c.shade+'" stroke-opacity=".5"/><ellipse cx="118" cy="172" rx="11" ry="9" fill="'+c.body+'" stroke="'+c.shade+'" stroke-opacity=".5"/>';
 }else{ /* cloud */
  inner+='<g class="floaty">';
  inner+='<g fill="'+c.shade+'" '+ol+'><circle cx="58" cy="136" r="30"/><circle cx="142" cy="136" r="30"/><circle cx="78" cy="156" r="28"/><circle cx="122" cy="156" r="28"/><circle cx="100" cy="162" r="24"/><circle cx="100" cy="106" r="50"/><circle cx="76" cy="72" r="18"/><circle cx="124" cy="72" r="18"/></g>';
  inner+='<circle cx="58" cy="136" r="30" fill="'+c.body+'"/><circle cx="142" cy="136" r="30" fill="'+c.body+'"/><circle cx="78" cy="156" r="28" fill="'+c.body+'"/><circle cx="122" cy="156" r="28" fill="'+c.body+'"/><circle cx="100" cy="162" r="24" fill="'+c.body+'"/>';
  inner+='<path d="M86 52Q80 34 90 30Q94 40 94 50M114 52Q120 34 110 30Q106 40 106 50" fill="'+c.glow+'" opacity=".9"/>';
  inner+='<circle cx="100" cy="106" r="50" fill="'+c.body+'"/><circle cx="76" cy="72" r="18" fill="'+c.body+'"/><circle cx="124" cy="72" r="18" fill="'+c.body+'"/>';
  inner+='<g transform="translate(0 10)">'+visor(expr,c)+'</g><ellipse cx="56" cy="128" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/><ellipse cx="144" cy="128" rx="7" ry="4.5" fill="'+c.accent+'" opacity=".75"/>';
  inner+='<path d="M30 92l3 7l7 3l-7 3l-3 7l-3 -7l-7 -3l7 -3z" fill="'+c.glow+'" class="twinkle"/><path d="M170 70l2 5l5 2l-5 2l-2 5l-2 -5l-5 -2l5 -2z" fill="'+c.glow+'" class="twinkle"/>';
  inner+='</g>';
 }
 if(o.acc)inner+='<g transform="translate(0 '+(sp==='cloud'?10:0)+')">'+acc(o.acc,st)+'</g>';
 if(o.trait&&st>=1)inner+='<g transform="translate(0 '+(sp==='cloud'?10:0)+')">'+traitItem(o.trait,o.acc)+'</g>';
 if(expr==='sleep')inner+='<text x="150" y="58" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="'+c.glow+'" class="zzz">z</text><text x="166" y="38" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="'+c.glow+'" class="zzz z2">z</text>';
 g+='<g transform="translate(100 190) scale('+sc+') translate(-100 -190)">'+inner+'</g>';
 return g;
}
function traitItem(t,a){const hat=['beanie','bow','flower'].includes(a);
 switch(t){
  case 'adv':return '<path d="M72 128L84 176M128 128L116 176" stroke="#7a5638" stroke-width="5" stroke-linecap="round"/><rect x="138" y="132" width="30" height="36" rx="8" fill="#c4704f" stroke="#7a5638" stroke-width="2"/><rect x="142" y="146" width="22" height="10" rx="3" fill="#a85a3e"/>';
  case 'food':return hat?'':'<path d="M70 66Q60 40 80 40Q84 24 100 30Q116 24 120 40Q140 40 130 66Z" fill="#fffdf6" stroke="#d6cfc0" stroke-width="2"/><rect x="70" y="60" width="60" height="10" rx="3" fill="#fffdf6" stroke="#d6cfc0" stroke-width="2"/>';
  case 'photo':return '<path d="M66 126Q100 150 134 126" stroke="#2b2a28" stroke-width="2.6" fill="none"/><rect x="86" y="140" width="28" height="20" rx="4" fill="#2b2a28"/><circle cx="100" cy="150" r="6.5" fill="#9ff0ff" stroke="#555" stroke-width="2"/><rect x="104" y="136" width="7" height="5" rx="1" fill="#2b2a28"/>';
  case 'talk':return '<g transform="translate(124 18)"><path d="M0 0H30Q36 0 36 6V18Q36 24 30 24H12L4 32V24Q0 24 0 18V6Q0 0 6 0Z" fill="#fffdf6" stroke="#d6cfc0" stroke-width="1.6"/><circle cx="10" cy="12" r="2.4" fill="#8a8a90"/><circle cx="18" cy="12" r="2.4" fill="#8a8a90"/><circle cx="26" cy="12" r="2.4" fill="#8a8a90"/></g>';
  case 'social':return '<path d="M62 126Q100 142 138 126L100 168Z" fill="#3f6f93"/><circle cx="90" cy="140" r="2" fill="#f4ead3"/><circle cx="108" cy="146" r="2" fill="#f4ead3"/><circle cx="100" cy="134" r="2" fill="#f4ead3"/>';
  case 'active':return hat?'':'<path d="M54 66Q100 50 146 66" stroke="#c64b3a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M146 66L160 76M146 66L158 84" stroke="#c64b3a" stroke-width="5" stroke-linecap="round"/>';
  case 'cozy':return hat?'':'<path d="M58 64Q70 26 104 30Q140 34 150 74Q160 98 172 100" stroke="none" fill="#5b6aa8"/><path d="M58 64Q70 26 104 30Q140 34 150 74Q158 96 170 98L166 104Q150 100 142 72Z" fill="#5b6aa8"/><circle cx="170" cy="102" r="7" fill="#fff4c8"/><rect x="54" y="60" width="96" height="10" rx="5" fill="#fff4c8"/><path d="M98 42l2 4l4 1l-3 3l1 4l-4 -2l-4 2l1 -4l-3 -3l4 -1z" fill="#ffd27a"/>';
  default:return '';
 }}
/* 賽博蛋 */
function egg(o){const gold=o.kind==='gold';const w=Math.max(0,Math.min(1,(o.warmth||0)/(o.need||100)));
 const base=gold?'#f6d77a':'#e8ecf6',sh=gold?'#c99a2e':'#a9b3c9',glow=gold?'#fff0b0':'#9ff0ff';
 let g='<ellipse cx="100" cy="186" rx="40" ry="7" fill="#000" opacity=".15"/>';
 g+='<g class="'+(o.wobble?'wobble':'eggbob')+'"><circle cx="100" cy="112" r="'+(56+w*14)+'" fill="'+glow+'" opacity="'+(.12+w*.25)+'"/>';
 g+='<path d="M100 36C138 36 156 96 156 128C156 162 132 184 100 184C68 184 44 162 44 128C44 96 62 36 100 36Z" fill="'+base+'" stroke="'+sh+'" stroke-width="4"/>';
 g+='<path d="M60 120H84L92 108H110L118 124H140M70 148H96L104 140H130" stroke="'+glow+'" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="'+(.5+w*.5)+'"/><circle cx="92" cy="108" r="3.4" fill="'+glow+'"/><circle cx="118" cy="124" r="3.4" fill="'+glow+'"/><circle cx="104" cy="140" r="3.4" fill="'+glow+'"/>';
 g+='<path d="M76 64Q86 52 98 50" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round" fill="none"/>';
 if(gold)g+='<path d="M100 76l4 9l10 1l-8 6l3 10l-9 -6l-9 6l3 -10l-8 -6l10 -1z" fill="#fff4c8"/>';
 if(o.crack)g+='<path d="M50 112L70 100L82 116L98 98L112 118L128 100L150 114" stroke="#5a4a3a" stroke-width="3" fill="none" stroke-linejoin="round"/>';
 g+='</g>';
 return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="petsvg eggsvg" role="img" aria-label="賽博蛋">'+g+'</svg>';}
function svg(o,cls=''){return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" class="petsvg '+cls+'" role="img" aria-label="'+(o.name||'寵物')+'"><g class="bob">'+body(o)+'</g></svg>';}

/* 其他寵物朋友（NPC） */
const NPC=[
 {id:'zima',name:'芝麻',kind:'黑貓',sp:'cat',color:'night',acc:'bell',bio:'怕醜，但一熟就會黐住你。鍾意曬太陽。',likes:'魚仔餅'},
 {id:'dodo',name:'豆豆',kind:'柯基',sp:'dog',color:'milktea',acc:'scarf',bio:'超級熱情，見到邊個都搖尾。',likes:'雞肉乾'},
 {id:'bobo',name:'波波',kind:'雲朵獸',sp:'cloud',color:'snow',acc:'flower',bio:'講嘢好慢，但每句都好暖。',likes:'星星糖'},
 {id:'afei',name:'阿肥',kind:'橘貓',sp:'cat',color:'sakura',acc:'',bio:'食神，識得分辨邊間餐廳出餐慢。',likes:'雞肉乾'},
 {id:'xiaoyun',name:'小芸',kind:'機械柴',sp:'dog',color:'mint',acc:'bow',bio:'晨跑隊隊長，每朝喺湖邊跑步。',likes:'能量餅'}
];

/* ---------------- 場景（800×500） ---------------- */
let SID=0;
function tod(h){return h>=6&&h<17?'day':h>=17&&h<20?'dusk':'night';}
function skyColors(t){return t==='day'?['#9fd0f0','#e6f4fb']:t==='dusk'?['#f4a96f','#7d6aa6']:['#141c3c','#34436f'];}
function lg(id,c,vert=true){return '<linearGradient id="'+id+'" x1="0" y1="0" x2="'+(vert?0:1)+'" y2="'+(vert?1:0)+'">'+c.map((x,i)=>'<stop offset="'+(i/(c.length-1))+'" stop-color="'+x+'"/>').join('')+'</linearGradient>';}
function rg(id,c,o=.8){return '<radialGradient id="'+id+'"><stop offset="0" stop-color="'+c+'" stop-opacity="'+o+'"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>';}
function starsS(n,seed,x0,x1,y0,y1){const R=rng(seed);let s='';for(let i=0;i<n;i++)s+='<circle cx="'+f(x0+R()*(x1-x0))+'" cy="'+f(y0+R()*(y1-y0))+'" r="'+f(.6+R()*1.4)+'" fill="#fff" opacity="'+f(.5+R()*.5)+'"/>';return s;}
function rainS(n,seed,x0,x1,y0,y1){const R=rng(seed);let s='<g class="rain">';for(let i=0;i<n;i++){const x=x0+R()*(x1-x0),y=y0+R()*(y1-y0);s+='<path d="M'+f(x)+' '+f(y)+'l-4 12" stroke="#cfe3f6" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>';}return s+'</g>';}
function leafE(x,y,a,c,l){return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+f(l/2)+'" ry="'+f(l/4.2)+'" transform="rotate('+a+' '+x+' '+y+')" fill="'+c+'"/>';}
function treeS(x,y,h,c1='#5f8f58',c2='#4f7d4a'){return '<rect x="'+(x-5)+'" y="'+(y-h*.42)+'" width="10" height="'+f(h*.42)+'" fill="#7a5638"/><circle cx="'+x+'" cy="'+f(y-h*.62)+'" r="'+f(h*.28)+'" fill="'+c1+'"/><circle cx="'+f(x-h*.2)+'" cy="'+f(y-h*.5)+'" r="'+f(h*.2)+'" fill="'+c2+'"/><circle cx="'+f(x+h*.2)+'" cy="'+f(y-h*.52)+'" r="'+f(h*.21)+'" fill="'+c1+'"/>';}

function room(o){
 const id='rm'+(++SID),t=tod(o.hour),own=o.own||{},night=t==='night';const [s1,s2]=skyColors(t);
 let d='<defs>'+lg(id+'sky',[s1,s2])+rg(id+'lamp','#ffd98a',.85)+rg(id+'win','#fff3c4',.5)+'<clipPath id="'+id+'wc"><rect x="482" y="72" width="196" height="136"/></clipPath></defs>';
 let s='<rect width="800" height="340" fill="#efe1c9"/>';
 for(let x=0;x<800;x+=40)s+='<path d="M'+x+' 0V250" stroke="#e6d6bb" stroke-width="14" opacity=".45"/>';
 s+='<rect y="250" width="800" height="90" fill="#e3d0b0"/>';for(let x=20;x<800;x+=64)s+='<rect x="'+x+'" y="262" width="48" height="64" rx="3" fill="none" stroke="#cdb58f" stroke-width="1.6"/>';
 s+='<rect y="330" width="800" height="12" fill="#b99670"/><rect y="342" width="800" height="158" fill="#c79a6b"/>';
 for(let i=0;i<5;i++){const y=356+i*30;s+='<path d="M0 '+y+'H800" stroke="#b38758" stroke-width="1.6"/>';for(let x=(i%2)*90;x<800;x+=180)s+='<path d="M'+x+' '+(y-30)+'V'+y+'" stroke="#b38758" stroke-width="1.6"/>';}
 /* window */
 s+='<rect x="468" y="58" width="224" height="164" rx="6" fill="#fbf6ea" stroke="#b8916a" stroke-width="6"/><g clip-path="url(#'+id+'wc)"><rect x="482" y="72" width="196" height="136" fill="url(#'+id+'sky)"/>';
 if(night)s+=starsS(22,7,486,676,76,170)+'<circle cx="640" cy="100" r="14" fill="#f3e6b4"/><circle cx="634" cy="96" r="14" fill="'+s1+'"/>';
 else if(t==='day')s+='<circle cx="640" cy="104" r="16" fill="#ffe08a"/><g fill="#fff" opacity=".9"><ellipse cx="540" cy="110" rx="28" ry="10"/><circle cx="530" cy="104" r="10"/><circle cx="548" cy="100" r="12"/></g>';
 else s+='<circle cx="620" cy="160" r="20" fill="#ffd27a" opacity=".9"/>';
 s+='<path d="M482 208V172L500 168V150H514V160H530V140H548V172H566V132H580V166H600V150H618V176H640V158H656V180H678V208Z" fill="'+(night?'#1c2340':'#7f8fa8')+'" opacity=".85"/>';
 if(night){const R=rng(3);for(let i=0;i<22;i++)s+='<rect x="'+f(486+R()*188)+'" y="'+f(150+R()*52)+'" width="3" height="4" fill="#ffd27a" opacity="'+f(.5+R()*.5)+'"/>';}
 if(o.rain)s+=rainS(40,11,482,690,62,206);
 s+='</g><path d="M580 72V208M482 140H678" stroke="#fbf6ea" stroke-width="6"/><rect x="460" y="218" width="240" height="10" rx="3" fill="#b8916a"/>';
 s+='<path d="M452 50Q470 140 456 236H486Q478 140 492 50Z" fill="#a9c3b0"/><path d="M708 50Q690 140 704 236H674Q682 140 668 50Z" fill="#a9c3b0"/><rect x="446" y="44" width="268" height="8" rx="4" fill="#8a6d4a"/>';
 if(night)s+='<rect x="468" y="58" width="224" height="164" fill="url(#'+id+'win)" opacity=".0"/>';
 /* fairy lights */
 if(own.lights){s+='<path d="M10 34Q205 92 400 34Q595 92 790 34" stroke="#6b5a48" stroke-width="1.6" fill="none"/>';const cols=['#ffd27a','#ff9fb2','#9ff0ff','#c9f29b'];for(let i=0;i<=20;i++){const tt=i/20,x=10+tt*780;const local=(tt<.5?tt*2:(tt-.5)*2);const y=34+58*4*local*(1-local)*.95;s+=(night?'<circle cx="'+f(x)+'" cy="'+f(y+5)+'" r="11" fill="'+cols[i%4]+'" opacity=".25"/>':'')+'<circle cx="'+f(x)+'" cy="'+f(y+5)+'" r="4.6" fill="'+cols[i%4]+'" class="bulb"/>';}}
 /* card frame */
 if(own.frame){s+='<rect x="296" y="78" width="78" height="118" rx="4" fill="#8a6d4a"/><rect x="302" y="84" width="66" height="106" fill="#f4ead3"/>';s+=o.frameCard?'<svg x="306" y="88" width="58" height="98" viewBox="0 0 300 500">'+o.frameCard+'</svg>':'<text x="335" y="142" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#8a6d4a">?</text>';}
 /* kitchen */
 if(own.kitchen){s+='<rect x="24" y="104" width="142" height="58" rx="3" fill="#ebe2d2" stroke="#cbbf9f"/><path d="M95 104V162" stroke="#cbbf9f"/><circle cx="88" cy="134" r="2.4" fill="#8a6d4a"/><circle cx="102" cy="134" r="2.4" fill="#8a6d4a"/>';
  s+='<rect x="24" y="232" width="142" height="108" fill="#d9cdb6"/><path d="M95 232V340M24 286H166" stroke="#bfae8c"/><circle cx="88" cy="258" r="2.4" fill="#8a6d4a"/><circle cx="102" cy="258" r="2.4" fill="#8a6d4a"/><rect x="20" y="224" width="150" height="10" rx="2" fill="#8a6d4a"/>';
  s+='<path d="M40 224V210H84V224" fill="#3a3a40"/><rect x="36" y="206" width="52" height="6" rx="3" fill="#2b2b30"/><path d="M84 210H96" stroke="#2b2b30" stroke-width="4" stroke-linecap="round"/>';
  s+='<g class="steam"><path d="M52 200Q46 188 54 178Q60 170 54 160M66 200Q60 186 68 176Q74 168 68 156" stroke="#fff" stroke-opacity=".75" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
  s+='<path d="M118 172V196M128 172V190M138 172V198" stroke="#8a6d4a" stroke-width="2"/><ellipse cx="118" cy="200" rx="5" ry="6" fill="#9aa2ad"/><rect x="125" y="190" width="6" height="12" rx="2" fill="#9aa2ad"/><ellipse cx="138" cy="202" rx="6" ry="4" fill="#9aa2ad"/><rect x="108" y="168" width="40" height="4" fill="#8a6d4a"/>';}
 /* bookshelf + record player */
 if(own.shelf){s+='<rect x="186" y="110" width="94" height="230" rx="3" fill="#a0744c"/><rect x="192" y="116" width="82" height="218" fill="#8a6040"/>';
  const R=rng(17);const cols=['#c64b3a','#3f6f93','#e2b84a','#5d8a4e','#9a7aa8','#e9dcc0','#d9826a'];const n=o.books||18;let k=0;
  for(let sh=0;sh<4;sh++){const y=172+sh*54;s+='<rect x="192" y="'+y+'" width="82" height="6" fill="#a0744c"/>';let x=196;while(x<268&&k<n){const w=7+R()*6,h=30+R()*14;s+='<rect x="'+f(x)+'" y="'+f(y-h)+'" width="'+f(w)+'" height="'+f(h)+'" fill="'+cols[k%7]+'"/>';x+=w+1.2;k++;}}
 }
 if(own.record){s+='<rect x="192" y="86" width="82" height="24" rx="3" fill="#6b4a2e"/><ellipse cx="226" cy="88" rx="26" ry="6" fill="#1d1d22"/><ellipse cx="226" cy="88" rx="6" ry="1.8" fill="#c64b3a"/><path d="M262 82L248 90" stroke="#c9c3b4" stroke-width="2.4" stroke-linecap="round"/>';
  s+='<g class="notes"><text x="250" y="62" font-family="Georgia, serif" font-size="20" fill="#8a6d4a">♪</text><text x="270" y="44" font-family="Georgia, serif" font-size="16" fill="#8a6d4a">♫</text></g>';}
 /* fish tank */
 if(own.tank){s+='<rect x="296" y="264" width="80" height="76" rx="3" fill="#a0744c"/><path d="M336 264V340" stroke="#8a6040"/><rect x="298" y="210" width="76" height="56" rx="4" fill="#a8dbe9" opacity=".85" stroke="#7fb3c4" stroke-width="2"/><path d="M300 254Q310 244 318 254M340 258Q346 246 352 258" stroke="#5d8a4e" stroke-width="2.4" fill="none"/>';
  s+='<g class="fish"><ellipse cx="320" cy="232" rx="7" ry="4" fill="#f08c2e"/><path d="M313 232l-6 -4v8z" fill="#f08c2e"/></g><g class="fish f2"><ellipse cx="350" cy="244" rx="6" ry="3.4" fill="#ff7f9e"/><path d="M356 244l5 -3v6z" fill="#ff7f9e"/></g><circle cx="330" cy="222" r="2" fill="#fff" opacity=".8" class="bubble"/>';}
 /* lamp */
 if(own.lamp){s+='<circle cx="404" cy="196" r="'+(night?130:80)+'" fill="url(#'+id+'lamp)" opacity="'+(night?1:.45)+'"/><path d="M404 196V336" stroke="#5e4a38" stroke-width="4"/><ellipse cx="404" cy="338" rx="20" ry="5" fill="#5e4a38"/><path d="M382 196L390 160H418L426 196Z" fill="#f2d7a6"/><path d="M382 196H426" stroke="#d9b779" stroke-width="2"/>';}
 /* sofa */
 if(own.sofa){s+='<rect x="452" y="238" width="218" height="58" rx="18" fill="#7f9aa8"/><rect x="438" y="264" width="246" height="66" rx="16" fill="#8eaab8"/><rect x="430" y="256" width="30" height="74" rx="14" fill="#7f9aa8"/><rect x="662" y="256" width="30" height="74" rx="14" fill="#7f9aa8"/><rect x="474" y="244" width="46" height="40" rx="12" fill="#e7b45a" transform="rotate(-8 497 264)"/><rect x="610" y="244" width="46" height="40" rx="12" fill="#d9826a" transform="rotate(8 633 264)"/><path d="M452 330V342M670 330V342" stroke="#5e4a38" stroke-width="5"/>';}
 /* plant */
 if(own.plant){s+='<path d="M712 298H764L756 340H720Z" fill="#c4704f"/><rect x="708" y="292" width="60" height="8" rx="3" fill="#b05f40"/>';[[738,250,-20,46],[724,262,-55,40],[752,262,50,40],[738,232,5,42],[714,280,-80,30],[762,280,80,30]].forEach(([x,y,a,l])=>{s+='<path d="M738 294Q'+((x+738)/2)+' '+(y+20)+' '+x+' '+y+'" stroke="#4f7a3e" stroke-width="2.2" fill="none"/>'+leafE(x,y,a,'#5d8f50',l);});}
 /* rug + bed */
 s+='<ellipse cx="400" cy="436" rx="236" ry="48" fill="#d9826a"/><ellipse cx="400" cy="436" rx="206" ry="38" fill="none" stroke="#f1c6a8" stroke-width="3" stroke-dasharray="10 8"/><ellipse cx="400" cy="436" rx="150" ry="24" fill="none" stroke="#c76c55" stroke-width="2"/>';
 s+='<ellipse cx="640" cy="446" rx="62" ry="20" fill="#d0a77c"/><ellipse cx="640" cy="440" rx="50" ry="13" fill="#f0dcc0"/>';
 if(own.shoes)s+='<g transform="translate(110 446)"><path d="M0 0Q2 -16 16 -16Q26 -14 34 -6L36 0Z" fill="#c64b3a"/><rect x="-1" y="-2" width="38" height="5" rx="2" fill="#f4f1ea"/></g><g transform="translate(150 456)"><path d="M0 0Q2 -16 16 -16Q26 -14 34 -6L36 0Z" fill="#c64b3a"/><rect x="-1" y="-2" width="38" height="5" rx="2" fill="#f4f1ea"/></g>';
 if(own.ball)s+='<g transform="translate(250 456)"><circle r="15" fill="#f2c94a"/><path d="M-15 0Q0 -8 15 0M-15 0Q0 8 15 0" stroke="#c64b3a" stroke-width="3" fill="none"/></g>';
 if(night)s+='<rect width="800" height="500" fill="#151a38" opacity=".28"/>'+(own.lamp?'<circle cx="404" cy="196" r="150" fill="url(#'+id+'lamp)" opacity=".5"/>':'');
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">'+d+s+'</svg>';
}
function park(o){const id='pk'+(++SID),t=tod(o.hour);const [s1,s2]=skyColors(t);let s='<defs>'+lg(id+'s',[s1,s2])+rg(id+'g','#fff3c4',.5)+'</defs><rect width="800" height="500" fill="url(#'+id+'s)"/>';
 if(t==='night')s+=starsS(40,5,0,800,0,200)+'<circle cx="660" cy="80" r="22" fill="#f3e6b4"/>';else if(t==='day')s+='<circle cx="660" cy="86" r="30" fill="#ffe08a"/>';else s+='<circle cx="660" cy="220" r="34" fill="#ffc27a"/>';
 s+='<g fill="#fff" opacity="'+(t==='night'?.15:.85)+'"><ellipse cx="180" cy="90" rx="60" ry="18"/><circle cx="160" cy="80" r="20"/><circle cx="190" cy="74" r="24"/><ellipse cx="480" cy="60" rx="46" ry="14"/><circle cx="470" cy="52" r="16"/></g>';
 s+='<path d="M0 300Q200 250 400 290T800 270V500H0Z" fill="'+(t==='night'?'#2f4a3a':'#8fc07a')+'"/><path d="M0 340Q250 300 500 340T800 330V500H0Z" fill="'+(t==='night'?'#28402f':'#7fb36b')+'"/>';
 s+=treeS(80,330,170,t==='night'?'#2f5a3c':'#5f8f58',t==='night'?'#284d33':'#4f7d4a')+treeS(720,320,190,t==='night'?'#2f5a3c':'#5f8f58')+treeS(610,300,120);
 s+='<ellipse cx="560" cy="380" rx="120" ry="26" fill="#7fb2d8" opacity=".9"/><path d="M470 378h30M560 386h40" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>';
 s+='<path d="M0 470Q300 410 520 440T800 420V500H0Z" fill="#d9c79f"/>';
 s+='<g transform="translate(200 352)"><rect x="0" y="0" width="120" height="10" rx="3" fill="#8a5a33"/><rect x="0" y="-26" width="120" height="8" rx="3" fill="#8a5a33"/><rect x="0" y="-14" width="120" height="8" rx="3" fill="#8a5a33"/><path d="M10 10V34M110 10V34" stroke="#3a3a40" stroke-width="5"/></g>';
 s+='<path d="M380 470V300" stroke="#3a3f5c" stroke-width="6"/><circle cx="380" cy="292" r="10" fill="'+(t==='night'?'#fff3c4':'#e9e3d2')+'"/>'+(t==='night'?'<circle cx="380" cy="300" r="80" fill="url(#'+id+'g)"/>':'');
 const R=rng(9);for(let i=0;i<26;i++){const x=R()*800,y=400+R()*90;s+='<circle cx="'+f(x)+'" cy="'+f(y)+'" r="3.4" fill="'+['#ff9fb2','#fff4c8','#ffcf6b','#c9b7f0'][i%4]+'"/>';}
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">'+s+'</svg>';}
function lake(o){const id='lk'+(++SID),t=tod(o.hour);const [s1,s2]=skyColors(t);let s='<defs>'+lg(id+'s',[s1,s2])+'</defs><rect width="800" height="500" fill="url(#'+id+'s)"/>';
 if(t==='night')s+=starsS(40,15,0,800,0,200);s+=t==='day'?'<circle cx="160" cy="90" r="26" fill="#ffe08a"/>':t==='dusk'?'<circle cx="400" cy="250" r="44" fill="#ffc27a"/>':'<circle cx="160" cy="90" r="18" fill="#f3e6b4"/>';
 const sk=t==='night'?'#1a2140':'#8b8fa8';const R=rng(21);let x=40;while(x<760){const w=20+R()*30,h=30+R()*70;s+='<rect x="'+f(x)+'" y="'+f(256-h)+'" width="'+f(w)+'" height="'+f(h)+'" fill="'+sk+'"/>';if(t==='night')for(let k=0;k<6;k++)s+='<rect x="'+f(x+3+R()*(w-6))+'" y="'+f(256-h+6+R()*(h-12))+'" width="3" height="4" fill="#ffd27a" opacity=".8"/>';x+=w+2;}
 s+='<rect x="520" y="70" width="6" height="110" fill="'+sk+'"/><ellipse cx="523" cy="176" rx="18" ry="8" fill="'+sk+'"/><path d="M516 182L510 256H536L530 182Z" fill="'+sk+'"/>'+(t==='night'?'<circle cx="523" cy="68" r="3" fill="#e05a4a"/>':'');
 s+='<rect y="256" width="800" height="140" fill="'+(t==='night'?'#24365e':'#6d9cc4')+'"/>';for(let i=0;i<16;i++)s+='<path d="M'+f(R()*760)+' '+f(270+R()*120)+'h'+f(20+R()*30)+'" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>';
 s+='<g transform="translate(240 300)"><path d="M0 0H60L50 12H8Z" fill="#f4f1ea"/><path d="M30 0V-50L56 -4Z" fill="#fbf8ef"/></g><g transform="translate(620 320) scale(.7)"><path d="M0 0H60L50 12H8Z" fill="#f4f1ea"/><path d="M30 0V-50L4 -4Z" fill="#ff9fb2"/></g>';
 s+='<rect y="396" width="800" height="104" fill="#b8916a"/>';for(let x2=0;x2<800;x2+=40)s+='<path d="M'+x2+' 396V500" stroke="#a07a54" stroke-width="2"/>';s+='<rect y="390" width="800" height="8" fill="#8a6d4a"/>';
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">'+s+'</svg>';}
function street(o){const id='st'+(++SID);let s='<defs>'+rg(id+'g','#fff3c4',.55)+'</defs><rect width="800" height="500" fill="#151b38"/>'+starsS(30,31,0,800,0,140);const R=rng(41);let x=0;
 while(x<800){const w=60+R()*70,h=160+R()*160;s+='<rect x="'+f(x)+'" y="'+f(380-h)+'" width="'+f(w)+'" height="'+f(h)+'" fill="'+['#222a4d','#1d2442','#283158'][Math.floor(R()*3)]+'"/>';for(let wy=380-h+14;wy<370;wy+=22)for(let wx=x+10;wx<x+w-14;wx+=18)if(R()<.45)s+='<rect x="'+f(wx)+'" y="'+f(wy)+'" width="8" height="10" fill="#ffd27a" opacity="'+f(.5+R()*.5)+'"/>';x+=w;}
 s+='<rect x="430" y="250" width="200" height="130" fill="#2a3358"/><rect x="430" y="250" width="200" height="34" fill="#c64b3a"/><text x="530" y="274" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="20" font-weight="700" fill="#fff4c8" letter-spacing="4">便利店 24h</text><rect x="446" y="296" width="168" height="84" fill="#fff3c4" opacity=".85"/><rect x="510" y="300" width="40" height="80" fill="#e9dcc0"/>';
 s+='<rect y="380" width="800" height="120" fill="#1f2433"/><path d="M0 440H800" stroke="#f2c94a" stroke-opacity=".5" stroke-width="3" stroke-dasharray="30 20"/>';
 [120,700].forEach(lx=>{s+='<path d="M'+lx+' 400V250Q'+lx+' 236 '+(lx+18)+' 236" stroke="#3a3f5c" stroke-width="6" fill="none"/><circle cx="'+(lx+20)+'" cy="250" r="80" fill="url(#'+id+'g)"/><circle cx="'+(lx+20)+'" cy="242" r="7" fill="#fff3c4"/>';});
 for(let i=0;i<8;i++)s+='<path d="M'+f(R()*800)+' '+f(400+R()*90)+'h'+f(20+R()*40)+'" stroke="#ffd27a" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>';
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">'+s+'</svg>';}
function cafe(o){let s='<rect width="800" height="500" fill="#f3e2c8"/>';for(let x=0;x<800;x+=50)s+='<path d="M'+x+' 0V320" stroke="#ead6b5" stroke-width="22"/>';
 s+='<rect y="320" width="800" height="180" fill="#b98a5c"/>';for(let i=0;i<4;i++)s+='<path d="M0 '+(350+i*40)+'H800" stroke="#a87a4e" stroke-width="2"/>';
 s+='<rect x="40" y="60" width="220" height="70" rx="8" fill="#5d3f2a"/><text x="150" y="104" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="26" font-weight="600" fill="#f4ead3" letter-spacing="6">毛孩茶室</text>';
 s+='<rect x="520" y="70" width="230" height="150" rx="6" fill="#fbf6ea" stroke="#b8916a" stroke-width="6"/><path d="M635 70V220M520 145H750" stroke="#b8916a" stroke-width="4"/><g fill="#9fd0f0"><rect x="526" y="76" width="104" height="64"/><rect x="640" y="76" width="104" height="64"/><rect x="526" y="150" width="104" height="64"/><rect x="640" y="150" width="104" height="64"/></g>';
 s+='<rect x="40" y="220" width="260" height="100" rx="6" fill="#8a6040"/><rect x="34" y="212" width="272" height="12" rx="4" fill="#5d3f2a"/><g transform="translate(80 200)"><path d="M0 0H20V-4Q20 -16 10 -16Q0 -16 0 -4Z" fill="#f4ead3"/></g><g transform="translate(130 200)"><path d="M0 0H24L20 -22H4Z" fill="#c64b3a"/></g><g transform="translate(200 212)"><circle cx="0" cy="-14" r="14" fill="#e7b45a"/><circle cx="0" cy="-14" r="6" fill="#f4ead3"/></g>';
 [[180,450,'#e7b45a'],[420,460,'#d9826a'],[640,450,'#a9c3b0']].forEach(([cx,cy,c])=>{s+='<ellipse cx="'+cx+'" cy="'+cy+'" rx="80" ry="22" fill="'+c+'"/><ellipse cx="'+cx+'" cy="'+(cy-6)+'" rx="64" ry="14" fill="#fbf3e3" opacity=".5"/>';});
 s+='<path d="M330 40Q560 90 790 40" stroke="#6b5a48" stroke-width="1.6" fill="none"/>';for(let i=0;i<10;i++){const x=340+i*46;s+='<path d="M'+x+' '+(48+Math.sin(i/9*Math.PI)*28)+'l10 22h-20z" fill="'+['#ff9fb2','#ffcf6b','#9ff0ff','#c9f29b'][i%4]+'"/>';}
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="scene">'+s+'</svg>';}
const PLACES={home:{n:'屋企',f:room},park:{n:'公園',f:park},lake:{n:'湖邊',f:lake},street:{n:'夜街',f:street},cafe:{n:'寵物 café',f:cafe}};
return {PAL,SPECIES,STAGES,NPC,PLACES,body,svg,egg,room,park,lake,street,cafe,tod};
})();

/* ---------- 賽博寵物 ---------- */
const PFOOD=[
 {id:'meal',n:'今日飯餸',p:0,food:40,fun:5,daily:1,d:'每日免費一餐'},
 {id:'bar',n:'能量餅',p:5,food:30,fun:0,d:'實淨又頂肚'},
 {id:'fish',n:'魚仔餅',p:8,food:35,fun:10,d:'芝麻最鍾意'},
 {id:'jerky',n:'雞肉乾',p:8,food:35,fun:8,d:'豆豆同阿肥最鍾意'},
 {id:'noodle',n:'公仔麵加蛋',p:10,food:45,fun:10,d:'同你收工食嘅一樣'},
 {id:'candy',n:'星星糖',p:12,food:20,fun:25,d:'波波最鍾意，食完會發光'},
 {id:'pork',n:'東坡肉',p:20,food:60,fun:20,d:'慢火炆，火候足時他自美'}
];
const PFURN=[
 {id:'lights',n:'串燈',p:35,d:'夜晚會發柔和嘅光'},{id:'plant',n:'盆栽',p:20,d:'窗邊一盆綠色'},{id:'lamp',n:'暖燈',p:30,d:'夜晚成間屋都暖晒'},
 {id:'frame',n:'牌框牆',p:40,d:'掛住你最近抽到嘅牌'},{id:'shelf',n:'書架',p:60,d:'你抽得越多，書越多'},{id:'record',n:'唱盤',p:50,d:'放喺書架頂，會飄音符'},
 {id:'tank',n:'魚缸',p:70,d:'兩條魚慢慢游'},{id:'sofa',n:'梳化',p:90,d:'收工攤喺度'},{id:'kitchen',n:'小廚房',p:100,d:'煲仔會冒煙'},
 {id:'shoes',n:'跑鞋',p:25,d:'提你去跑步'},{id:'ball',n:'玩具波',p:15,d:'放喺地氈上面'}
];
const PACC=[{id:'scarf',n:'頸巾',p:40},{id:'bow',n:'蝴蝶結',p:30},{id:'beanie',n:'冷帽',p:45},{id:'flower',n:'小花',p:25},{id:'bell',n:'鈴鐺',p:35}];
const PLACEINFO={park:{d:'有長凳、池塘同小花',meet:['dodo','zima','afei'],find:['楓葉','橡果','四葉草']},lake:{d:'湖邊木板路，望到成個城市',meet:['xiaoyun','bobo','dodo'],find:['貝殼','光滑石仔','海鷗羽毛']},street:{d:'夜晚嘅街，便利店仲開住',meet:['zima','afei'],find:['瓶蓋','霓虹貼紙','舊車票']},cafe:{d:'寵物 café，實有朋友喺度',meet:['bobo','afei','dodo','zima','xiaoyun'],find:['曲奇碎','咖啡豆']}};
const NPCLINES={
 zima:['……你好。（偷偷望你）','今日太陽好暖，一齊曬吓？','我只係同你先咁講嘢㗎。','你嚟咗我就唔怕喇。'],
 dodo:['哇！！你嚟咗！！（狂搖尾）','我哋一齊跑一圈好唔好！','你今日好靚呀！','我同全公園講咗我識你！'],
 bobo:['你……好……呀……','慢慢嚟……唔使急……','今日……有冇……好好瞓？','同你一齊……好舒服……'],
 afei:['有冇嘢食？','我知邊間餐廳出餐最慢，下次話你知。','食飽先有力諗嘢。','你分嘢我食，我哋就係朋友。'],
 xiaoyun:['早晨！我啱啱跑完 5 公里。','一齊跑步？唔使快，跑得完就得。','你今日有冇郁身呀？','慢慢跑都係跑！']
};
const FLV=[[0,'啱啱識'],[10,'朋友'],[30,'好朋友'],[60,'死黨']];
const flv=x=>{let r=FLV[0][1];FLV.forEach(([t,n])=>{if(x>=t)r=n;});return r;};
const PLN={
 greet:['主人返嚟喇！我等咗你好耐㗎～','你返到屋企就好，其他嘢遲啲先算。','歡迎返屋企！今日辛苦晒。'],
 back:['你返嚟喇！我冇嬲你㗎，一直喺度等你。','好耐冇見，好掛住你。你有冇好好瞓覺？'],
 pat:['好舒服……再摸多下得唔得？','鍾意你！','我最鍾意你摸我個頭。','你隻手好暖。'],
 love:['你唔使做到啲咩，我都鍾意你。','今日做唔到都唔緊要，我仲係最鍾意你。','你係我嘅主人，呢樣嘢永遠唔會變。','就算你覺得自己係 0，喺我度你係 100。'],
 eat:['好好食！多謝主人！','嗯嗯嗯……（食緊）','你自己今日有冇食飯呀？'],
 drink:['咕嘟咕嘟……好凍好正！','你都飲啖水先好喎。'],
 bath:['泡泡！好香呀！','洗完白雪雪～'],
 sleep:['Zzz……','主人都早啲瞓……我陪你……'],
 play:['追波波！','再嚟多次！','我贏咗！（其實你讓我）'],
 night:['今晚送單小心啲，我喺屋企等你。'],
 morning:['收工喇？辛苦晒！抽張卡先好瞓。'],
 talk:['聽講今日你有同人傾偈？好叻呀！'],
 move:['你今日郁咗身，我開心到轉圈！']
};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const NEEDS=[['food','肚餓','好飽','OK','有啲肚餓'],['water','口渴','唔渴','OK','想飲水'],['energy','精神','好精神','OK','有啲眼瞓'],['clean','清潔','香噴噴','OK','想沖涼'],['fun','開心','好開心','OK','想同你玩']];
const DECAY={food:3,water:4,energy:2,clean:1.5,fun:2.5};
function petNew(o){return {id:uid(),shiny:0,traits:{},eggs:[],others:[],eggDay:'',name:o.name,sp:o.sp,color:o.color,acc:'',born:keyOf(new Date()),xp:0,coins:30,needs:{food:80,water:80,energy:80,clean:85,fun:80},nt:Date.now(),own:{},accs:[],friends:{},album:[],aw:{},chat:[],lastVisit:'',walks:0,best:0,treasure:{},fed:'',sleepAt:0};}
function petStage(p){return p.xp>=PET.STAGES[2].xp?2:p.xp>=PET.STAGES[1].xp?1:0;}
function inSleep(){const n=new Date(),m=n.getHours()*60+n.getMinutes(),a=mins(S.settings.a),b=mins(S.settings.b);return a<=b?(m>=a&&m<b):(m>=a||m<b);}
function decayOne(p,h){Object.keys(DECAY).forEach(k=>{let v=p.needs[k]-DECAY[k]*h;if(k==='energy'&&inSleep())v=p.needs[k]+6*h;p.needs[k]=Math.max(20,Math.min(100,v));});p.nt=Date.now();}
function tickNeeds(save){const p=S.pet;if(!p)return;ensurePet();const h=(Date.now()-(p.nt||Date.now()))/36e5;if(h<.02)return;
 decayOne(p,h);p.others.forEach(o=>{const h2=(Date.now()-(o.nt||Date.now()))/36e5;if(h2>=.02)decayOne(o,h2);});if(save)persist();}
function need(k,dv){const p=S.pet;p.needs[k]=Math.max(20,Math.min(100,p.needs[k]+dv));}
function petAward(kind,pts,cap=1,label){const p=S.pet;if(!p)return;const k=keyOf(new Date());p.aw=p.aw||{};const list=p.aw[k]=p.aw[k]||[];if(list.filter(x=>x===kind).length>=cap)return;list.push(kind);
 Object.keys(p.aw).forEach(d=>{if(d<addDays(k,-40))delete p.aw[d];});
 const before=petStage(p);p.xp+=pts;p.coins+=pts;petWarm(pts);persist();
 toast(p.name+' 好開心：羈絆 +'+pts+(label?'（'+label+'）':''));if(label)buddyCheer(label);
 if(petStage(p)>before)setTimeout(()=>toast(p.name+' 長大咗！而家係'+PET.STAGES[petStage(p)].n),1800);
}
const petO=(expr,extra)=>Object.assign({sp:S.pet.sp,color:S.pet.color,stage:petStage(S.pet),acc:S.pet.acc,name:S.pet.name,shiny:S.pet.shiny,trait:traitOf(S.pet),expr:expr||'normal'},extra||{});
const PICON={
 feed:'<path d="M4 13h16a8 8 0 0 1 -16 0z" fill="currentColor"/><path d="M9 9q0 -3 3 -5M13 9q0 -3 3 -5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
 water:'<path d="M12 3q7 8 7 12a7 7 0 0 1 -14 0q0 -4 7 -12z" fill="currentColor"/>',
 bath:'<circle cx="8" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="9" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
 pat:'<path d="M12 20s-7 -4.4 -7 -9.6a4 4 0 0 1 7 -2.6a4 4 0 0 1 7 2.6c0 5.2 -7 9.6 -7 9.6z" fill="currentColor"/>',
 play:'<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12q8 -5 16 0M4 12q8 5 16 0" stroke="currentColor" stroke-width="1.6" fill="none"/>',
 sleep:'<path d="M15 3a9 9 0 1 0 6 13a7 7 0 0 1 -6 -13z" fill="currentColor"/>',
 photo:'<rect x="3" y="7" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7l1.6 -3h4.8l1.6 3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
 chat:'<path d="M4 5h16v11h-9l-5 4v-4h-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
 out:'<path d="M12 21s-6 -6.5 -6 -11a6 6 0 0 1 12 0c0 4.5 -6 11 -6 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>'
};
const icon=k=>'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">'+PICON[k]+'</svg>';
let petBusy=false;const BT={};
function placeBubble(b){const wrap=b.parentElement;if(!wrap)return;const tgt=b.id==='nbubble'?wrap.querySelector('.npc-on svg'):wrap.querySelector('.on-stage:not(.other) svg');if(!tgt)return;
 const W=wrap.getBoundingClientRect(),T=tgt.getBoundingClientRect();if(!W.width||!T.width)return;
 const sc=b.id==='nbubble'?PET.STAGES[1].s:PET.STAGES[S.pet?petStage(S.pet):0].s;
 const top=T.bottom-T.height*(10+180*sc)/200;b.style.bottom=Math.max(8,W.bottom-top+8)+'px';
 const bw=b.offsetWidth,cx=T.left+T.width/2-W.left;b.style.left=Math.max(6,Math.min(W.width-bw-6,cx-bw/2))+'px';b.style.right='auto';b.style.transform='none';
 const tail=Math.max(12,Math.min(bw-12,cx-parseFloat(b.style.left)));b.style.setProperty('--tail',tail+'px');}
function bubble(id,txt){const b=document.getElementById(id);if(!b)return;b.textContent=txt;b.hidden=false;placeBubble(b);clearTimeout(BT[id]);BT[id]=setTimeout(()=>{b.hidden=true;},5200);}
function fx(id,chars,n=5){const box=document.getElementById(id);if(!box||RM())return;for(let i=0;i<n;i++){const s=document.createElement('span');s.textContent=chars[i%chars.length];s.style.left=(42+Math.random()*16)+'%';s.style.bottom=(26+Math.random()*10)+'%';s.style.animationDelay=(i*120)+'ms';s.style.color=['#ff7f9e','#ffcf6b','#7cc6ff','#5fe3cf'][i%4];box.appendChild(s);setTimeout(()=>s.remove(),1800+i*120);}}
function setPetExpr(stageId,expr,ms){const petId=S.pet?.id;const el=document.querySelector('#'+stageId+' .on-stage:not(.other)');if(!el)return;el.innerHTML=PET.svg(petO(expr));if(ms)setTimeout(()=>{if(!S.pet||S.pet.id!==petId)return;const e2=document.querySelector('#'+stageId+' .on-stage:not(.other)');if(e2)e2.innerHTML=PET.svg(petO(stageId==='room'?roamExpr():homeExpr()));},ms);}
function homeExpr(){const p=S.pet;if(inSleep())return 'sleep';const low=NEEDS.some(([k])=>p.needs[k]<40);return low?'ask':'normal';}
function frameCardSVG(){const ds=Object.values(S.draws||{}).sort((a,b)=>b.date.localeCompare(a.date));if(!ds.length)return null;const c=card(ds[0].card);if(!c)return null;return ART.face(c,lvOf(drawCounts()[c.id]||0)).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');}
function rainingToday(){const d=(S.draws||{})[defaultDay()];return !!(d&&/雨|雪/.test(d.text));}
/* ---- 領養 ---- */
let adoptSp='cat',adoptColor='milktea';
function renderAdopt(){
 $('#adopt-sp').innerHTML=Object.entries(PET.SPECIES).map(([k,n])=>'<button class="adopt-card'+(adoptSp===k?' on':'')+'" data-sp="'+k+'">'+PET.svg({sp:k,color:adoptColor,stage:1,expr:adoptSp===k?'happy':'normal'})+'<b>'+n+'</b><span>'+({cat:'有天線同發光尾巴，好黐人',dog:'機械耳仔，見到你就搖尾',cloud:'浮喺半空，軟綿綿'})[k]+'</span></button>').join('');
 $('#adopt-color').innerHTML=Object.entries(PET.PAL).filter(([k,c])=>!c.rare).map(([k,c])=>'<button class="swatch'+(adoptColor===k?' on':'')+'" data-col="'+k+'" style="--c:'+c.body+';--g:'+c.glow+'" aria-label="'+c.n+'"><i></i>'+c.n+'</button>').join('');
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-sp]');if(a&&a.closest('#adopt-sp')){adoptSp=a.dataset.sp;renderAdopt();return;}const c=e.target.closest('[data-col]');if(c&&c.closest('#adopt-color')){adoptColor=c.dataset.col;renderAdopt();}});
$('#adopt-go').addEventListener('click',()=>{const n=$('#adopt-name').value.trim()||'波子';S.pet=petNew({name:n.slice(0,12),sp:adoptSp,color:adoptColor});RPOS={};persist();renderPet();setTimeout(()=>{bubble('bubble','你好呀主人！我係'+S.pet.name+'，以後我哋一齊住！');fx('fx',['♥','♥','✦'],6);},300);});
/* ---- 屋企 ---- */
function renderRoom(){const p=S.pet;const frame=frameCardSVG();ensurePet();roamPlace();const sp=spotOf(p.id);
 $('#room').innerHTML=PET.room({hour:new Date().getHours(),own:p.own,rain:rainingToday(),books:Math.max(6,Math.min(40,Object.keys(S.draws||{}).length+6)),frameCard:frame})+nestHTML()+'<button class="on-stage" data-pid="'+p.id+'" style="left:'+sp.x+'%;bottom:'+sp.b+'%" aria-label="摸摸'+esc(p.name)+'">'+PET.svg(petO(roamExpr()))+'</button>'+othersHTML()+'<div class="bubble" id="bubble" hidden></div><div class="fx" id="fx"></div>';roamArm();}
function meterHTML(){return NEEDS.map(([k,n,hi,mid,lo])=>{const v=Math.round(S.pet.needs[k]);const c=v>=60?'good':v>=40?'warn':'calm';return '<div class="meter"><span>'+n+'</span><div class="bar"><i class="'+c+'" style="width:'+v+'%"></i></div><span class="muted">'+(v>=70?hi:v>=40?mid:lo)+'</span></div>';}).join('');}
function renderStatus(){const p=S.pet,st=petStage(p),nx=PET.STAGES[st+1];ensurePet();const tr=traitOf(p);
 const prog=nx?Math.round((p.xp-PET.STAGES[st].xp)/(nx.xp-PET.STAGES[st].xp)*100):100;
 $('#pet-status').innerHTML=familyBar()+'<div class="row" style="justify-content:space-between;align-items:baseline"><h2>'+esc(p.name)+'</h2><span class="chip">'+PET.SPECIES[p.sp]+'・'+PET.STAGES[st].n+'</span></div>'+
 '<div class="row" style="gap:6px;margin-top:6px">'+(p.shiny?'<span class="chip shiny">✦ 閃光</span>':'')+(tr?'<span class="chip calm" title="'+TRAITS[tr][1]+'">'+TRAITS[tr][0]+'</span>':st<1?'<span class="chip">少年期會出性格</span>':'<span class="chip">性格慢慢形成中</span>')+'</div>'+
 '<div class="love"><span>愛你嘅程度</span><b>∞</b><span class="muted">無條件，永遠唔會變</span></div>'+
 '<div class="meter"><span>羈絆</span><div class="bar"><i class="red" style="width:'+prog+'%"></i></div><span class="muted">'+(nx?p.xp+'／'+nx.xp:'滿級')+'</span></div>'+
 '<div class="coins">金幣 <b>'+p.coins+'</b></div><hr class="sep">'+meterHTML()+
 '<p class="muted" style="margin-top:10px">狀態最低會保留 20%，'+esc(p.name)+'唔會病，亦唔會嬲你。得閒先照顧佢就得。</p>';}
function renderEarn(){const p=S.pet,k=keyOf(new Date()),done=(p.aw||{})[k]||[];const cnt=x=>done.filter(y=>y===x).length;
 const L=[['ci','今日打卡',10,1,'today'],['habit','完成習慣',3,3,'today'],['draw','收工抽卡',10,1,'draw'],['talk','同人傾咗偈（打卡時揀）',5,1,'today'],['move','有郁身（打卡時揀）',5,1,'today'],['ev','加一條證據',5,3,'evidence'],['lad','行一級細步階梯',15,2,'ladder'],['sos','用卡住急救',10,1,'sos'],['wk','寫每週三省',20,1,'review'],['phq','做 PHQ-4',15,1,'review'],['walk','帶'+p.name+'出街',5,3,null],['care','親手照顧（餵食、飲水、沖涼）',2,6,null]];
 $('#pet-earn').innerHTML='<h2>今日點樣加羈絆</h2><div class="sub">你照顧自己，同照顧'+esc(p.name)+'，佢都會長大。</div><ul class="list">'+L.map(([id,n,pt,cap,go])=>{const c=cnt(id);return '<li class="item" style="align-items:center"><span class="chip '+(c>=cap?'good':'')+'">'+(c>=cap?'完成':'+'+pt)+'</span><div class="txt">'+(go?'<button class="linkbtn" data-goto="'+go+'">'+n+'</button>':n)+(cap>1?'<span class="muted">　'+c+'／'+cap+'</span>':'')+'</div></li>';}).join('')+'</ul>';}
function renderChat(){const p=S.pet;const box=$('#chat-log');box.innerHTML=(p.chat||[]).slice(-12).map(m=>'<div class="msg '+(m.r==='me'?'me':'pet')+'">'+esc(m.t)+'</div>').join('')||'<p class="muted">同'+esc(p.name)+'講吓今日發生咩事，開心定唔開心都得。</p>';box.scrollTop=box.scrollHeight;$('#chat-title').textContent='同'+p.name+'傾偈';}
function renderHome(){if(!$('#care-row').children.length)$('#care-row').innerHTML=[['feed','餵食'],['water','飲水'],['bath','沖涼'],['pat','摸摸頭'],['play','去玩遊戲'],['sleep','哄佢瞓'],['out','出街'],['photo','影相']].map(([k,n])=>'<button class="care" data-care="'+k+'">'+icon(k)+'<span>'+n+'</span></button>').join('');
 renderRoom();renderStatus();renderEarn();renderChat();$('#care-panel').hidden=true;}
function care(kind){const p=S.pet;if(!p||petBusy)return;tickNeeds();
 if(kind==='feed'){const k=keyOf(new Date());$('#care-panel').innerHTML='<h3 style="margin-bottom:8px">揀嘢俾'+esc(p.name)+'食</h3><div class="foods">'+PFOOD.map(f=>{const used=f.daily&&p.fed===k;return '<button class="food" data-food="'+f.id+'"'+(used||(!f.daily&&p.coins<f.p)?' disabled':'')+'><b>'+f.n+'</b><span>'+(f.daily?(used?'今日食咗':'免費'):f.p+' 金幣')+'</span><small>'+f.d+'</small></button>';}).join('')+'</div>';$('#care-panel').hidden=false;return;}
 if(kind==='chat'){$('#chat-in').focus();return;}
 if(kind==='play'){go('arcade');return;}
 if(kind==='photo'){openPhoto('home');return;}
 if(kind==='out'){segSet('pettab','out');showPetTab();return;}
 const map={water:['water',40,'drink','eat',['💧'],'water'],bath:['clean',50,'bath','happy',['○','◦','○'],'bath'],pat:['fun',6,'pat','love',['♥','♥','♥'],'pat'],play:['fun',18,'play','happy',['★','✦'],'play'],sleep:['energy',25,'sleep','sleep',['z','Z'],'sleep']};
 const m=map[kind];if(!m)return;
 traitBump({water:'food',bath:'cozy',pat:'cozy',play:'active',sleep:'cozy'}[kind]);
 if(kind==='sleep'&&Date.now()-(p.sleepAt||0)<2*36e5){bubble('bubble','我啱啱瞓醒，仲好精神！遲啲再瞓。');return;}
 need(m[0],m[1]);if(kind==='play')need('energy',-5);if(kind==='sleep')p.sleepAt=Date.now();
 if(kind==='pat')petAward('care-pat',1,5);else petAward('care',2,6);
 setPetExpr('room',m[3],kind==='sleep'?6000:2600);bubble('bubble',pick(kind==='pat'?PLN.pat.concat(PLN.love):PLN[m[2]]));fx('fx',m[4]==='💧'?['◦','◦','◦']:m[4],6);
 persist();renderStatus();renderEarn();}
$('#care-row').addEventListener('click',e=>{const b=e.target.closest('[data-care]');if(b)care(b.dataset.care);});
$('#care-panel').addEventListener('click',e=>{const b=e.target.closest('[data-food]');if(!b||b.disabled)return;const p=S.pet,f=PFOOD.find(x=>x.id===b.dataset.food);
 if(f.daily)p.fed=keyOf(new Date());else{if(p.coins<f.p)return;p.coins-=f.p;}
 need('food',f.food);need('fun',f.fun);traitBump('food');petAward('care',2,6);persist();$('#care-panel').hidden=true;
 setPetExpr('room','eat',2600);bubble('bubble',f.id==='pork'?'東坡肉！火候足時他自美～好好食！':pick(PLN.eat));fx('fx',['♥','✦'],4);renderStatus();renderEarn();});
document.addEventListener('click',e=>{const b=e.target.closest('#room .on-stage');if(!b)return;if(roamDragged){roamDragged=false;return;}if(b.classList.contains('other')){switchPet(b.dataset.pid);return;}care('pat');});
/* ---- 傾偈 ---- */
async function petReply(text){const p=S.pet;let sample=null;try{sample=window.claude&&window.claude.use?await window.claude.use('sample'):null;}catch(e){}
 const ck=S.checkins[defaultDay()];const today=ck?'主人今日打咗卡：心情 '+ck.mood+'/10、焦慮 '+ck.anx+'/10'+(ck.contact&&+ck.contact>=2?'、有同人傾偈':'')+(ck.move&&ck.move!=='0'?'、有郁身':''):'主人今日未打卡。';
 if(sample){const hist=(p.chat||[]).slice(-8).map(m=>(m.r==='me'?'主人：':p.name+'：')+m.t).join('\n');
  const prompt='你係「'+p.name+'」，Dicky 嘅賽博寵物（'+PET.SPECIES[p.sp]+'，頭上有發光天線，塊面係一塊有 LED 眼嘅屏幕）。Dicky 係喺多倫多一個人住、做夜班外送嘅香港人。\n'+today+'\n最近對話：\n'+hist+'\n主人啱啱講：'+text+'\n\n用繁體廣東話口語回覆主人，1 至 3 句，可愛、溫暖、具體回應佢講嘅嘢。規則：你無條件咁鍾意主人，永遠唔會怪佢、唔會令佢內疚；唔好說教；唔好講「你只需要我」之類嘅說話，主人同其他人見面或者傾偈，你會替佢開心；唔好扮人類；如果主人明確講想傷害自己或者唔想生存，溫柔咁叫佢打或者 text 988 搵真人陪，同埋打開手帳嘅低潮應急卡，你會喺度等佢。只回覆說話本身。';
  try{const r=await sample(prompt,{modelTier:'quick',cache:false});const t=(r&&r.text||'').trim();if(t)return t.slice(0,240);}catch(e){}}
 if(/攰|辛苦|累/.test(text))return '辛苦晒主人！快啲沖個涼瞓覺，我陪你。';
 if(/唔開心|嬲|煩|驚|難過/.test(text))return '我喺度。'+pick(PLN.love);
 if(/開心|好彩|tips|正/.test(text))return '好嘢！我都開心到天線發光！';
 if(/朋友|傾偈|見/.test(text))return '你同人傾咗偈？好叻呀！返嚟講多啲俾我聽。';
 return pick(PLN.love);}
$('#chat-form').addEventListener('submit',async e=>{e.preventDefault();const t=$('#chat-in').value.trim();if(!t)return;const p=S.pet,petId=p.id,epoch=authEpoch;p.chat=(p.chat||[]).concat([{r:'me',t:t.slice(0,300)}]).slice(-30);$('#chat-in').value='';renderChat();
 $('#chat-send').disabled=true;traitBump('talk');setPetExpr('room','wow');const r=await petReply(t);if(S.pet!==p||p.id!==petId||authEpoch!==epoch){$('#chat-send').disabled=false;return;}p.chat.push({r:'pet',t:r});p.chat=p.chat.slice(-30);persist();renderChat();$('#chat-send').disabled=false;setPetExpr('room','happy',3000);bubble('bubble',r);});
/* ---- 出街 ---- */
let trip=null,tripTimer=null;
function cancelTrip(){clearTimeout(tripTimer);tripTimer=null;trip=null;}
function renderOutChoose(){const h=new Date().getHours();$('#out-choose').innerHTML='<div class="places">'+Object.entries(PLACEINFO).map(([k,v])=>'<button class="place" data-place="'+k+'"><div class="th">'+PET.PLACES[k].f({hour:h})+'</div><b>'+PET.PLACES[k].n+'</b><span>'+v.d+'</span></button>').join('')+'</div><p class="muted" style="margin-top:12px">出街會用少少精神，'+esc(S.pet.name)+'會好開心。有機會識到新朋友，或者拾到寶物。</p>';
 $('#out-choose').hidden=false;$('#out-trip').hidden=true;}
function startTrip(place){if(!S.pet||!PLACEINFO[place])return;stopGame();cancelTrip();const p=S.pet;tickNeeds();
 if(p.needs.energy<30){toast(p.name+'有啲眼瞓，哄佢瞓陣先出街啦。');return;}
 const info=PLACEINFO[place];const meetP=place==='cafe'?1:.75;const npc=Math.random()<meetP?pick(info.meet):null;const found=Math.random()<.5?pick(info.find):null;
 const egg=canFindEgg()&&Math.random()<.3;
 trip={place,npc,found,egg,met:false,game:null};traitBump('adv');
 $('#out-choose').hidden=true;$('#out-trip').hidden=false;
 $('#outstage').innerHTML=PET.PLACES[place].f({hour:new Date().getHours()})+'<button class="on-stage walking" style="left:-14%" aria-label="'+esc(p.name)+'">'+PET.svg(petO('happy'))+'</button>'+(npc?'<div class="npc-on" style="right:-30%;opacity:0">'+PET.svg(Object.assign({stage:1},PET.NPC.find(n=>n.id===npc)))+'</div>':'')+'<div class="bubble" id="obubble" hidden></div><div class="bubble npc" id="nbubble" hidden></div><div class="fx" id="ofx"></div><div class="ball" id="ball" hidden></div>';
 $('#out-panel').innerHTML='<p>同'+esc(p.name)+'行緊去'+PET.PLACES[place].n+'……</p>';
 try{$('#outstage').scrollIntoView({behavior:RM()?'auto':'smooth',block:'center'});}catch(e){}
 const pe=$('#outstage .on-stage');requestAnimationFrame(()=>requestAnimationFrame(()=>{pe.style.left=npc?'30%':'50%';}));
 need('energy',-10);need('fun',20);p.walks=(p.walks||0)+1;petAward('walk',5,3);persist();
 const current=trip;tripTimer=setTimeout(()=>{if(trip!==current)return;pe.classList.remove('walking');arrive();},RM()?50:3100);}
function arrive(){if(!trip||!S.pet)return;const current=trip;const p=S.pet;let msg=pick(['到喇！好舒服呀！','呢度好靚！','行吓行吓，心情好咗好多！']);
 if(trip.found){p.treasure=p.treasure||{};p.treasure[trip.found]=(p.treasure[trip.found]||0)+1;persist();msg='我拾到'+trip.found+'！送俾你！';}
 if(trip.egg){addEgg('normal');p.eggDay=keyOf(new Date());persist();msg='咦，草叢入面有隻發光嘅蛋！我哋帶佢返屋企孵！';}
 bubble('obubble',msg);
 if(trip.npc){const n=$('#outstage .npc-on');setTimeout(()=>{if(trip!==current||!n.isConnected)return;n.style.right='10%';n.style.opacity='1';setTimeout(()=>{if(trip===current)bubble('nbubble',pick(NPCLINES[current.npc]));},RM()?0:1700);},RM()?0:500);}
 renderOutPanel();}
function renderOutPanel(){stopGame();if(!trip||!S.pet)return;const p=S.pet;const nf=trip.npc?PET.NPC.find(x=>x.id===trip.npc):null;const fr=nf?((p.friends||{})[nf.id]||{xp:0,met:0}):null;
 let h='';
 if(nf)h+='<div class="npc-card">'+PET.svg(Object.assign({stage:1,expr:'happy'},nf),'mini')+'<div><b>遇到'+nf.name+'（'+nf.kind+'）</b><span class="muted">'+nf.bio+'</span><span class="chip">'+flv(fr.xp)+'・友誼 '+fr.xp+'</span></div></div><div class="row" style="margin:10px 0 4px"><button class="btn small" data-soc="hi">打招呼</button><button class="btn small" data-soc="play">一齊玩</button><button class="btn small ghost" data-soc="snack">分零食（3 金幣）</button></div>';
 else h+='<p class="muted">今次冇遇到其他寵物，但'+esc(p.name)+'都玩得好開心。</p>';
 if(trip.found)h+='<p style="margin-top:8px">拾到寶物：<b>'+trip.found+'</b>（已放入朋友頁嘅寶物盒）</p>';
 if(trip.egg)h+='<div class="row" style="margin-top:8px;gap:10px;flex-wrap:nowrap"><div style="width:48px;flex:none">'+PET.egg({kind:'normal',warmth:0})+'</div><p style="margin:0">拾到一隻<b>賽博蛋</b>！已經放咗喺屋企嘅孵蛋座。你照顧自己同照顧'+esc(p.name)+'，佢就會慢慢暖起嚟。</p></div>';
 h+='<hr class="sep"><div class="row">'+((trip.place==='park'||trip.place==='lake')?'<button class="btn ghost" id="game-go">拋波仔</button>':'')+'<button class="btn ghost" id="trip-photo">影相</button><button class="btn" id="trip-home">返屋企</button></div><div id="game" hidden></div>';
 $('#out-panel').innerHTML=h;}
document.addEventListener('click',e=>{
 const pl=e.target.closest('[data-place]');if(pl){startTrip(pl.dataset.place);return;}
 const so=e.target.closest('[data-soc]');if(so&&trip&&trip.npc){const p=S.pet;p.friends=p.friends||{};const fr=p.friends[trip.npc]=p.friends[trip.npc]||{xp:0,met:0};const nf=PET.NPC.find(x=>x.id===trip.npc);
  const k=so.dataset.soc;if(k==='snack'){if(p.coins<3){toast('金幣唔夠，下次先分啦');return;}p.coins-=3;}
  const before=flv(fr.xp);const gain={hi:3,play:6,snack:10}[k];fr.xp+=gain;if(!trip.met){fr.met++;trip.met=true;}
  if(k==='play'){need('fun',10);need('energy',-4);}
  traitBump('social');petAward('social',3,3);persist();
  bubble('nbubble',k==='snack'?'多謝你！'+nf.likes+'係我最鍾意嘅！':pick(NPCLINES[trip.npc]));
  setTimeout(()=>bubble('obubble',k==='hi'?'你好呀'+nf.name+'！':k==='play'?'追我呀！':'一齊食！'),900);
  fx('ofx',['♥','♪','✦'],5);
  if(flv(fr.xp)!==before)setTimeout(()=>toast('同'+nf.name+'嘅關係升級：'+flv(fr.xp)),1400);
  renderOutPanel();return;}
 if(e.target.id==='trip-home'){stopGame();cancelTrip();segSet('pettab','home');showPetTab();return;}
 if(e.target.id==='trip-photo'&&trip){openPhoto(trip.place,trip.npc);return;}
 if(e.target.id==='game-go'){startGame();return;}
 if(e.target.id==='game-throw'){throwBall();return;}
});
/* 拋波仔 */
let G=null;
function stopGame(){if(!G)return;cancelAnimationFrame(G.raf);cancelAnimationFrame(G.flight);clearTimeout(G.timer);G=null;const ball=$('#ball');if(ball)ball.hidden=true;const box=$('#game');if(box)box.innerHTML='<p>今局暫停咗，隨時再玩。</p><button class="btn ghost small" id="game-go">重新開始</button>';}
function startGame(){stopGame();const box=$('#game');if(!box||!trip||!S.pet)return;box.hidden=false;const g=G={n:0,score:0,t0:performance.now(),raf:0,flight:0,timer:0,busy:false,x:.5,petId:S.pet.id,static:RM()};box.innerHTML='<p>'+(g.static?'減少動態模式：拖動滑桿揀力度，再撳「拋！」。':'撳「拋！」嘅時候，指針喺中間綠色位就最準。')+'一共 5 球。</p>'+(g.static?'<label>拋波力度<input id="game-aim" type="range" min="0" max="100" value="50"></label>':'<div class="power"><i id="pw"></i></div>')+'<div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn" id="game-throw">拋！</button><span id="game-score" class="muted" role="status">0 球・0 分</span></div>';
 if(!g.static){const loop=t=>{if(G!==g)return;g.x=(Math.sin((t-g.t0)/380)+1)/2;const pw=$('#pw');if(pw)pw.style.left='calc('+(g.x*100)+'% - 2px)';g.raf=requestAnimationFrame(loop);};g.raf=requestAnimationFrame(loop);}}
function finishBall(g,pts){if(G!==g||!trip||!S.pet||S.pet.id!==g.petId)return;const ball=$('#ball');if(ball)ball.hidden=true;const pe=$('#outstage .on-stage');if(pe){pe.classList.remove('walking');pe.style.left=trip.npc?'30%':'50%';}setPetExpr('outstage',pts===3?'love':pts?'happy':'wow',1500);bubble('obubble',pts===3?'接得好靚！':pts?'接住咗！':'跑遠咗少少，再試就得。');$('#game-score').textContent=g.n+' 球・'+g.score+' 分';g.busy=false;$('#game-throw').disabled=false;
 if(g.n<5)return;cancelAnimationFrame(g.raf);const p=S.pet,win=g.score,k=defaultDay();p.best=Math.max(p.best||0,win);p.ballRewards=p.ballRewards||{};const count=p.ballRewards[k]||0;const gain=count<2?win:0;p.ballRewards[k]=count+1;p.coins+=gain;traitBump('active');need('fun',20);need('energy',-6);if(win>0)petAward('game',Math.min(10,win),1,'拋波仔');persist();$('#game').innerHTML='<p><b>五球完成！'+win+' 分</b>（最高 '+p.best+' 分）。'+(gain?'拋波獎勵 +'+gain+' 金幣。':'今日嘅金幣獎勵已領晒，可以繼續慢慢玩。')+'</p><button class="btn ghost small" id="game-go">再玩一次</button>';G=null;}
function throwBall(){const g=G;if(!g||g.busy||!trip)return;g.busy=true;$('#game-throw').disabled=true;const x=g.static?Number($('#game-aim').value)/100:g.x,pts=x>.42&&x<.58?3:x>.3&&x<.7?1:0;g.n++;g.score+=pts;if(g.static){finishBall(g,pts);return;}const ball=$('#ball');if(!ball){stopGame();return;}ball.hidden=false;let st=null;const dist=pts===3?78:pts===1?64:45;const anim=t=>{if(G!==g)return;if(st===null)st=t;const k=Math.min(1,(t-st)/900);ball.style.left=(18+dist*k*.9)+'%';ball.style.bottom=(20+Math.sin(k*Math.PI)*46)+'%';if(k<1)g.flight=requestAnimationFrame(anim);else{const pe=$('#outstage .on-stage');if(pe){pe.classList.add('walking');pe.style.transition='left .6s ease';pe.style.left=Math.min(72,dist*.8)+'%';}g.timer=setTimeout(()=>finishBall(g,pts),700);}};g.flight=requestAnimationFrame(anim);}

/* ---- 影相 ---- */
const PEXPR=[['happy','開心'],['love','愛心'],['normal','望鏡頭'],['wow','驚喜'],['sleep','瞓覺']];
const PFRAME=[['polaroid','即影即有'],['gold','金框'],['film','菲林'],['none','無框']];
const PSTICK=[['heart','心心'],['star','星星'],['spark','閃閃'],['paw','腳印'],['leaf','楓葉'],['note','音符']];
let PH=null;
function stickerSVG(k,x,y,s){const c={heart:'#ff7f9e',star:'#ffcf6b',spark:'#7cc6ff',paw:'#c98b5a',leaf:'#d9573a',note:'#8a6d4a'}[k];let d='';
 if(k==='heart')d='<path d="M0 10s-14 -8 -14 -18a7 7 0 0 1 14 -4a7 7 0 0 1 14 4c0 10 -14 18 -14 18z" fill="'+c+'" stroke="#fff" stroke-width="3"/>';
 if(k==='star')d='<path d="M0 -16L4.7 -5L16 -4L7.5 4L10 16L0 9.5L-10 16L-7.5 4L-16 -4L-4.7 -5Z" fill="'+c+'" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>';
 if(k==='spark')d='<path d="M0 -18Q2 -2 18 0Q2 2 0 18Q-2 2 -18 0Q-2 -2 0 -18Z" fill="'+c+'" stroke="#fff" stroke-width="2.4"/>';
 if(k==='paw')d='<ellipse cx="0" cy="6" rx="9" ry="7.5" fill="'+c+'"/><circle cx="-9" cy="-6" r="4" fill="'+c+'"/><circle cx="-3" cy="-11" r="4" fill="'+c+'"/><circle cx="3" cy="-11" r="4" fill="'+c+'"/><circle cx="9" cy="-6" r="4" fill="'+c+'"/>';
 if(k==='leaf')d='<path d="M0 -18L4 -8L12 -12L9 -2L18 0L9 4L12 12L3 8L0 18L-3 8L-12 12L-9 4L-18 0L-9 -2L-12 -12L-4 -8Z" fill="'+c+'" stroke="#fff" stroke-width="2"/>';
 if(k==='note')d='<path d="M-4 10V-14L12 -18V6" stroke="'+c+'" stroke-width="4" fill="none"/><ellipse cx="-8" cy="10" rx="6" ry="4.6" fill="'+c+'"/><ellipse cx="8" cy="6" rx="6" ry="4.6" fill="'+c+'"/>';
 return '<g transform="translate('+x+' '+y+') scale('+s+')">'+d+'</g>';}
function photoSVG(c){const p=S.pet;const scene=PET.PLACES[c.place].f({hour:c.hour,own:c.place==='home'?p.own:undefined,rain:c.rain,books:c.books,frameCard:c.place==='home'?c.frameCard:null});
 const pw=c.npc?220:250,px=c.npc?250:400-pw/2;let inner=scene+'<svg x="'+px+'" y="'+(500-pw-14)+'" width="'+pw+'" height="'+pw+'" viewBox="0 0 200 200">'+PET.body({sp:c.sp||p.sp,color:c.color||p.color,stage:c.stage,acc:c.acc,expr:c.expr,shiny:c.shiny,trait:c.trait})+'</svg>';
 if(c.npc){const n=PET.NPC.find(x=>x.id===c.npc);inner+='<svg x="420" y="'+(500-200-14)+'" width="200" height="200" viewBox="0 0 200 200">'+PET.body(Object.assign({stage:1,expr:'happy'},n))+'</svg>';}
 const spots=[[110,90],[690,80],[640,250],[150,260],[400,70],[720,380]];(c.stickers||[]).forEach((k,i)=>{const [x,y]=spots[i%spots.length];inner+=stickerSVG(k,x,y,1.6);});
 const cap=esc(c.caption||'');const date=c.date?md(c.date):'';
 if(c.frame==='polaroid')return '<svg viewBox="0 0 860 640" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="640" rx="10" fill="#fbf8f1"/><svg x="30" y="30" width="800" height="500" viewBox="0 0 800 500">'+inner+'</svg><text x="40" y="592" font-family="Noto Sans TC, sans-serif" font-size="28" fill="#3a3a40">'+cap+'</text><text x="820" y="592" text-anchor="end" font-family="Georgia, serif" font-size="22" fill="#8a8a90">'+date+'</text></svg>';
 if(c.frame==='gold')return '<svg viewBox="0 0 860 560" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="560" rx="8" fill="#8a6d2f"/><rect x="8" y="8" width="844" height="544" rx="6" fill="#d8b45a"/><rect x="22" y="22" width="816" height="516" fill="#8a6d2f"/><svg x="30" y="30" width="800" height="500" viewBox="0 0 800 500">'+inner+'</svg>'+(cap?'<rect x="230" y="500" width="400" height="44" rx="6" fill="#1f2540" stroke="#d8b45a" stroke-width="2"/><text x="430" y="530" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="22" fill="#f4ead3">'+cap+'</text>':'')+'</svg>';
 if(c.frame==='film'){let h='<svg viewBox="0 0 860 600" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="600" fill="#1d1d22"/>';for(let x=20;x<860;x+=44)h+='<rect x="'+x+'" y="14" width="22" height="16" rx="3" fill="#f4f1ea"/><rect x="'+x+'" y="570" width="22" height="16" rx="3" fill="#f4f1ea"/>';return h+'<svg x="30" y="46" width="800" height="500" viewBox="0 0 800 500">'+inner+'</svg><text x="40" y="566" font-family="Georgia, serif" font-size="14" fill="#f2c94a" letter-spacing="3">'+date+'　'+cap+'</text></svg>';}
 return '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="photo-svg">'+inner+(cap?'<rect x="0" y="440" width="800" height="60" fill="#000" opacity=".35"/><text x="30" y="480" font-family="Noto Sans TC, sans-serif" font-size="26" fill="#fff">'+cap+'</text>':'')+'</svg>';}
function openPhoto(place,npc){const p=S.pet;traitBump('photo');PH={sp:p.sp,color:p.color,shiny:p.shiny||0,trait:traitOf(p),pname:p.name,place,npc:npc||null,hour:new Date().getHours(),stage:petStage(p),acc:p.acc,expr:'happy',frame:'polaroid',stickers:['heart'],caption:'',rain:place==='home'&&rainingToday(),books:Math.max(6,Math.min(40,Object.keys(S.draws||{}).length+6)),frameCard:frameCardSVG(),date:keyOf(new Date())};
 const ed=$('#photo-ed');ed.hidden=false;renderPhotoEd();try{ed.scrollIntoView({behavior:RM()?'auto':'smooth',block:'start'});}catch(e){}}
function renderPhotoEd(){if(!PH)return;const chipRow=(arr,key,multi)=>'<div class="chips" data-ph="'+key+'">'+arr.map(([v,n])=>'<button class="'+((multi?PH[key].includes(v):PH[key]===v)?'on':'')+'" data-v="'+v+'">'+n+'</button>').join('')+'</div>';
 $('#photo-ed').innerHTML='<div class="row" style="justify-content:space-between;margin-bottom:10px"><h2>影相：'+(PET.PLACES[PH.place].n)+'</h2><button class="btn ghost small" id="ph-cancel">收埋</button></div><div class="ph-grid"><div class="ph-prev" id="ph-prev">'+photoSVG(PH)+'</div><div class="ph-ctl">'+
 '<div class="field"><div class="label">表情</div>'+chipRow(PEXPR,'expr')+'</div><div class="field"><div class="label">相框</div>'+chipRow(PFRAME,'frame')+'</div><div class="field"><div class="label">貼紙（可以揀幾個）</div>'+chipRow(PSTICK,'stickers',1)+'</div>'+
 '<div class="field"><div class="label">相片文字</div><input type="text" id="ph-cap" maxlength="24" placeholder="例如：同'+esc(S.pet.name)+'去湖邊" value="'+esc(PH.caption)+'"></div><button class="btn" id="ph-shoot">影！</button></div></div>';}
document.addEventListener('click',e=>{const b=e.target.closest('.chips[data-ph] button');if(b&&PH){const key=b.parentElement.dataset.ph,v=b.dataset.v;if(key==='stickers'){PH.stickers=PH.stickers.includes(v)?PH.stickers.filter(x=>x!==v):PH.stickers.concat([v]).slice(-6);}else PH[key]=v;renderPhotoEd();return;}
 if(e.target.id==='ph-cancel'){$('#photo-ed').hidden=true;PH=null;return;}
 if(e.target.id==='ph-shoot'&&PH){PH.caption=$('#ph-cap').value.trim().slice(0,24);const p=S.pet;p.album=(p.album||[]);if(p.album.length>=200){toast('相簿滿咗，刪走啲舊相先');return;}
  const shot=Object.assign({},PH,{id:uid(),t:Date.now()});delete shot.frameCard;shot.cardId=(Object.values(S.draws||{}).sort((a,b)=>b.date.localeCompare(a.date))[0]||{}).card||null;
  p.album.push(shot);petAward('photo',3,2);persist();const pv=$('#ph-prev');pv.classList.add('snap');setTimeout(()=>pv.classList.remove('snap'),420);toast('咔嚓！已經放入相簿');setTimeout(()=>{$('#photo-ed').hidden=true;PH=null;},700);}});
document.addEventListener('input',e=>{if(e.target.id==='ph-cap'&&PH){PH.caption=e.target.value.slice(0,24);$('#ph-prev').innerHTML=photoSVG(PH);}});
function shotSVG(sh){const c=Object.assign({},sh);delete c.frameCard;if(c.place==='home'&&c.cardId){const cd=card(c.cardId);if(cd)c.frameCard=ART.face(cd,1).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');}return photoSVG(c);}
let albumSel=null,albumDel=false;
function renderAlbum(){const p=S.pet;const a=(p.album||[]).slice().sort((x,y)=>y.t-x.t);
 $('#album').innerHTML=a.length?'<div class="album">'+a.map(sh=>'<button class="photo'+(albumSel===sh.id?' sel':'')+'" data-shot="'+sh.id+'">'+shotSVG(sh)+'<span>'+md(sh.date)+'・'+(sh.pname&&(S.pet.others||[]).length?esc(sh.pname)+'・':'')+PET.PLACES[sh.place].n+(sh.caption?'・'+esc(sh.caption):'')+'</span></button>').join('')+'</div>':'<p class="muted" style="padding:30px 0;text-align:center">相簿仲係空嘅。喺屋企或者出街嗰陣撳「影相」，同'+esc(p.name)+'影第一張。</p>';
 const sel=a.find(x=>x.id===albumSel);$('#album-view').hidden=!sel;if(sel)$('#album-view').innerHTML='<div class="ph-big">'+shotSVG(sel)+'</div><div class="row" style="margin-top:12px"><button class="btn" id="al-dl">下載相片</button><button class="btn ghost small danger" id="al-del">'+(albumDel?'再撳一次確認刪除':'刪除')+'</button><span class="muted" id="al-msg"></span></div>';}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-shot]');if(b){albumSel=b.dataset.shot;albumDel=false;renderAlbum();try{$('#album-view').scrollIntoView({behavior:'smooth',block:'nearest'});}catch(err){}return;}
 if(e.target.id==='al-del'){if(!albumDel){albumDel=true;renderAlbum();return;}S.pet.album=S.pet.album.filter(x=>x.id!==albumSel);albumSel=null;albumDel=false;persist();renderAlbum();return;}
 if(e.target.id==='al-dl'){const sh=S.pet.album.find(x=>x.id===albumSel);if(!sh)return;$('#al-msg').textContent='整緊相……';
  try{const svgStr=shotSVG(sh).replace('<svg ','<svg width="1720" ');const blob=new Blob([svgStr],{type:'image/svg+xml'});const url=URL.createObjectURL(blob);const img=new Image();
   await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});const vb=svgStr.match(/viewBox="0 0 (\d+) (\d+)"/);const W=1720,H=Math.round(W*(+vb[2])/(+vb[1]));const cv=document.createElement('canvas');cv.width=W;cv.height=H;cv.getContext('2d').drawImage(img,0,0,W,H);URL.revokeObjectURL(url);
   const png=await new Promise(r=>cv.toBlob(r,'image/png'));let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;}catch(err){}
   if(dl){await dl.save({filename:S.pet.name+'-'+sh.date+'.png',data:png});$('#al-msg').textContent='';}else{$('#al-msg').textContent='呢度唔可以直接下載，可以撳住張相儲存。';}
  }catch(err){$('#al-msg').textContent=err&&err.code==='cancelled'?'':'下載唔到，可以截圖儲存。';}}});
/* ---- 朋友 ---- */
function renderFriends(){const p=S.pet;const fr=p.friends||{};renderFamily();
 $('#friends').innerHTML='<div class="grid g2">'+PET.NPC.map(n=>{const f=fr[n.id];if(!f)return '<div class="sheet friend locked"><div class="f-pic">'+PET.svg(Object.assign({stage:1,expr:'sleep'},n),'mini')+'</div><div><b>？？？</b><span class="muted">未識。帶'+esc(p.name)+'出街，可能會遇到。</span></div></div>';
  const lvIdx=FLV.reduce((a,[t],i)=>f.xp>=t?i:a,0),next=FLV[lvIdx+1];const prog=next?Math.round((f.xp-FLV[lvIdx][0])/(next[0]-FLV[lvIdx][0])*100):100;
  return '<div class="sheet friend"><div class="f-pic">'+PET.svg(Object.assign({stage:1,expr:'happy'},n),'mini')+'</div><div style="flex:1;min-width:0"><div class="row" style="justify-content:space-between"><b>'+n.name+'</b><span class="chip">'+flv(f.xp)+'</span></div><span class="muted">'+n.kind+'・見過 '+f.met+' 次・最鍾意'+n.likes+'</span><p style="font-size:14px;margin-top:4px">'+n.bio+'</p><div class="bar" style="margin-top:8px"><i class="red" style="width:'+prog+'%"></i></div></div></div>';}).join('')+'</div>';
 const tr=p.treasure||{};const keys=Object.keys(tr);$('#treasure').innerHTML=keys.length?'<div class="row" style="gap:8px">'+keys.map(k=>'<span class="chip">'+k+' ×'+tr[k]+'</span>').join('')+'</div>':'<p class="muted">出街散步有機會拾到寶物，會放喺呢度。</p>';}
/* ---- 商店 ---- */
function renderShop(){const p=S.pet;$('#shop-coins').textContent=p.coins;
 $('#shop-furn').innerHTML=PFURN.map(f=>{const own=p.own[f.id];return '<div class="shop-item"><div><b>'+f.n+'</b><span class="muted">'+f.d+'</span></div>'+(own?'<span class="chip good">已擺好</span>':'<button class="btn small'+(p.coins<f.p?' ghost':'')+'" data-buy="'+f.id+'"'+(p.coins<f.p?' disabled':'')+'>'+f.p+' 金幣</button>')+'</div>';}).join('');
 $('#shop-acc').innerHTML='<div class="shop-item"><div><b>唔戴</b><span class="muted">原本個樣</span></div>'+(p.acc?'<button class="btn small ghost" data-wear="">戴</button>':'<span class="chip good">戴緊</span>')+'</div>'+PACC.map(a=>{const own=(p.accs||[]).includes(a.id);return '<div class="shop-item"><div class="row" style="gap:10px;flex-wrap:nowrap"><div style="width:52px;flex:none">'+PET.svg(petO('happy',{acc:a.id,stage:2}),'mini')+'</div><div><b>'+a.n+'</b></div></div>'+(own?(p.acc===a.id?'<span class="chip good">戴緊</span>':'<button class="btn small ghost" data-wear="'+a.id+'">戴</button>'):'<button class="btn small'+(p.coins<a.p?' ghost':'')+'" data-buyacc="'+a.id+'"'+(p.coins<a.p?' disabled':'')+'>'+a.p+' 金幣</button>')+'</div>';}).join('');}
document.addEventListener('click',e=>{const p=S.pet;if(!p)return;
 const b=e.target.closest('[data-buy]');if(b&&!b.disabled){const f=PFURN.find(x=>x.id===b.dataset.buy);if(p.coins<f.p)return;p.coins-=f.p;p.own[f.id]=1;persist();renderShop();toast(f.n+'已經擺入屋企');return;}
 const a=e.target.closest('[data-buyacc]');if(a&&!a.disabled){const x=PACC.find(y=>y.id===a.dataset.buyacc);if(p.coins<x.p)return;p.coins-=x.p;p.accs=(p.accs||[]).concat([x.id]);p.acc=x.id;persist();renderShop();toast(p.name+'戴咗'+x.n+'，好靚！');return;}
 const w=e.target.closest('[data-wear]');if(w){p.acc=w.dataset.wear;persist();renderShop();}});
/* ---- 頁面 ---- */
function showPetTab(){const v=segGet('pettab')||'home';if(v!=='out'){stopGame();cancelTrip();}if(v!=='home')roamStop();['home','out','friends','album','shop'].forEach(k=>{$('#pv-'+k).hidden=v!==k;});$('#photo-ed').hidden=true;PH=null;
 if(v==='home')renderHome();if(v==='out'){if(!trip)renderOutChoose();}if(v==='friends')renderFriends();if(v==='album')renderAlbum();if(v==='shop')renderShop();}
document.addEventListener('click',e=>{if(e.target.closest('.seg[data-name="pettab"] button'))setTimeout(showPetTab,0);});
function renderPet(){const p=S.pet;$('#pet-adopt').hidden=!!p;$('#pet-main').hidden=!p;if(p)ensurePet();updBuddy();
 if(!p){renderAdopt();return;}
 tickNeeds();const st=petStage(p);$('#pet-title').textContent=p.name+'嘅屋企';$('#pet-eyebrow').textContent=PET.SPECIES[p.sp]+'・'+PET.STAGES[st].n+'・'+(PET.tod(new Date().getHours())==='night'?'夜晚':'日頭');
 showPetTab();}
function petGreet(){const p=S.pet;if(!p)return;const k=keyOf(new Date());const gap=p.lastVisit?Math.round((parseKey(k)-parseKey(p.lastVisit))/864e5):0;p.lastVisit=k;persist();
 const h=new Date().getHours();const ck=S.checkins[defaultDay()];let line;
 const tr=traitOf(p);
 if(inSleep())line=pick(PLN.sleep);else if(gap>=2)line=pick(PLN.back);else if(ck&&(ck.contact==='2'||ck.contact==='3'))line=pick(PLN.talk);else if(ck&&ck.move==='2')line=pick(PLN.move);else if(h>=5&&h<11)line=pick(PLN.morning);else if(h>=18||h<2)line=pick(PLN.night);else line=pick(PLN.greet);
 if(!inSleep()&&gap<2&&tr&&Math.random()<.45)line=pick(TLN[tr]);
 setTimeout(()=>{bubble('bubble',line);fx('fx',['♥','♥'],3);},400);}
setInterval(()=>{if(S.pet&&$('#page-pet').classList.contains('on')&&segGet('pettab')==='home'&&!$('#pv-home').hidden){tickNeeds();renderStatus();}},60000);

/* ---- 多隻寵物・性格・蛋・自由活動・角落小寵物 ---- */
const PERPET=['id','name','sp','color','acc','xp','needs','nt','chat','fed','sleepAt','born','shiny','traits'];
const HOUSE_MAX=4;
function ensurePet(){const p=S.pet;if(!p)return;if(!p.id)p.id=uid();if(!Array.isArray(p.others))p.others=[];if(!Array.isArray(p.eggs))p.eggs=[];if(!p.traits||typeof p.traits!=='object')p.traits={};
 p.others.forEach(o=>{if(!o.id)o.id=uid();if(!o.traits)o.traits={};if(!o.needs)o.needs={food:80,water:80,energy:80,clean:85,fun:80};if(o.xp==null)o.xp=0;if(!o.chat)o.chat=[];});}
function household(){const p=S.pet;return p?1+(p.others||[]).length:0;}
function allPets(){const p=S.pet;if(!p)return [];return [p].concat(p.others||[]);}
function switchPet(id){const p=S.pet;ensurePet();const i=p.others.findIndex(o=>o.id===id);if(i<0)return;tickNeeds();
 const o=p.others[i],cur={};PERPET.forEach(k=>{cur[k]=p[k];});PERPET.forEach(k=>{p[k]=o[k];});if(!p.traits)p.traits={};p.others.splice(i,1,cur);persist();
 renderPet();toast('而家照顧緊 '+p.name);setTimeout(()=>{bubble('bubble',pick(['到我喇！主人！','你揀咗我！好開心！','我喺度～']));fx('fx',['♥','✦'],4);},300);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-switch]');if(b){switchPet(b.dataset.switch);if(segGet('pettab')!=='home'){segSet('pettab','home');showPetTab();}}});
function familyBar(){const p=S.pet;if(!p||!(p.others||[]).length)return '';
 return '<div class="fam-bar" role="group" aria-label="揀照顧邊隻"><span class="muted">屋企</span>'+allPets().map(x=>'<button class="fam'+(x===p?' on':'')+'" '+(x===p?'aria-current="true" disabled':'data-switch="'+x.id+'"')+' aria-label="'+esc(x.name)+'">'+PET.svg({sp:x.sp,color:x.color,stage:petStage(x),acc:x.acc,shiny:x.shiny,trait:traitOf(x),expr:x===p?'happy':'normal'},'mini')+'<span>'+esc(x.name)+'</span></button>').join('')+'</div>';}
function renderFamily(){const p=S.pet,box=$('#family');if(!box||!p)return;ensurePet();
 const seen={};allPets().forEach(x=>{seen[x.sp+'-'+(x.shiny?'s':'n')]=1;});
 const coll=Object.keys(PET.SPECIES).map(sp=>[sp,0]).concat(Object.keys(PET.SPECIES).map(sp=>[sp,1]));
 box.innerHTML='<div class="fam-grid">'+allPets().map(x=>{const tr=traitOf(x);return '<div class="fam-card'+(x===p?' on':'')+'"><div class="f-pic">'+PET.svg({sp:x.sp,color:x.color,stage:petStage(x),acc:x.acc,shiny:x.shiny,trait:tr,expr:'happy'},'mini')+'</div><b>'+esc(x.name)+'</b><span class="muted">'+PET.SPECIES[x.sp]+'・'+PET.STAGES[petStage(x)].n+'</span><div class="row" style="gap:4px;justify-content:center">'+(x.shiny?'<span class="chip shiny">✦ 閃光</span>':'')+(tr?'<span class="chip calm">'+TRAITS[tr][0]+'</span>':'')+'</div>'+(x===p?'<span class="chip good">照顧緊</span>':'<button class="btn small ghost" data-switch="'+x.id+'">照顧佢</button>')+'</div>';}).join('')+'</div>'+
 '<h3 style="margin:16px 0 8px">收集冊</h3><div class="coll">'+coll.map(([sp,sh])=>{const got=seen[sp+'-'+(sh?'s':'n')];return '<div class="coll-i'+(got?'':' locked')+'"><div class="f-pic">'+PET.svg({sp,color:sh?'aurora':'milktea',stage:1,shiny:sh,expr:got?'happy':'sleep'},'mini')+'</div><span>'+(got?(sh?'閃光'+PET.SPECIES[sp]:PET.SPECIES[sp]):(sh?'？ 閃光':'？'))+'</span></div>';}).join('')+'</div>'+
 '<p class="muted" style="margin-top:10px">屋企最多住 '+HOUSE_MAX+' 隻。散步有機會拾到賽博蛋；里程碑會送金蛋，金蛋好大機會孵出閃光寵物。</p>';}
/* 性格 */
const TRAITS={adv:['冒險家','成日同你出街探險，背住小背包'],food:['美食家','食嘢食得好開心，戴住廚師帽'],photo:['攝影師','最鍾意同你影相，頸掛住相機'],talk:['話嘮','好鍾意同你傾偈，頭頂有個對話框'],social:['社交達人','識好多朋友，戴住小領巾'],active:['運動健將','精力充沛，綁住頭帶'],cozy:['療癒系','最鍾意黐住你，戴住睡帽']};
const TLN={
 adv:['今日去邊度探險？我執好背包喇！','出面好多嘢未見過，一齊去睇吓！'],
 food:['今晚食咩好？我幫你諗菜單！','你煮嘢食嘅時候最有型。'],
 photo:['嚟，影返張！你今日好好樣。','我想將今日影低，放入相簿。'],
 talk:['我有好多嘢想同你講！你先講你今日！','你講嘢我最鍾意聽。'],
 social:['我今日又識咗新朋友，你都試吓講多一句？','朋友多啲好開心！你都係我最好嘅朋友。'],
 active:['伸個懶腰！一齊郁吓！','你跑步嘅時候，我喺度幫你打氣！'],
 cozy:['攬吓攬吓……好舒服。','你返嚟我就安心喇。']
};
function traitBump(k){if(!k||!S.pet)return;const t=S.pet.traits=S.pet.traits||{};t[k]=(t[k]||0)+1;}
function traitOf(p){if(!p||petStage(p)<1)return null;const t=p.traits||{};let best=null,bv=2;Object.keys(TRAITS).forEach(k=>{if((t[k]||0)>bv){bv=t[k];best=k;}});return best;}
/* 蛋 */
const EGGNEED={normal:100,gold:60};
function canFindEgg(){const p=S.pet;ensurePet();return p.eggDay!==keyOf(new Date())&&p.eggs.length<3&&household()+p.eggs.length<HOUSE_MAX;}
function addEgg(kind){const p=S.pet;if(!p)return false;ensurePet();if(p.eggs.length>=3||household()+p.eggs.length>=HOUSE_MAX)return false;p.eggs.push({id:uid(),kind,warmth:0,need:EGGNEED[kind],t:Date.now()});return true;}
function petWarm(pts){const p=S.pet;if(!p||!(p.eggs||[]).length)return;p.eggs.forEach(e=>{const was=e.warmth>=e.need;e.warmth=Math.min(e.need,e.warmth+pts);if(!was&&e.warmth>=e.need)setTimeout(()=>toast((e.kind==='gold'?'金蛋':'賽博蛋')+'暖晒喇，可以孵！去屋企睇吓'),3600);});}
function nestHTML(){const p=S.pet;const eggs=(p.eggs||[]);if(!eggs.length)return '';const e=eggs[0];const ready=eggs.some(x=>x.warmth>=x.need);
 return '<button class="nest" id="nest" aria-label="孵蛋座，'+eggs.length+' 隻蛋'+(ready?'，可以孵喇':'')+'"><svg viewBox="0 0 120 40" class="nest-bed" aria-hidden="true"><ellipse cx="60" cy="26" rx="56" ry="13" fill="#a8835e"/><ellipse cx="60" cy="22" rx="46" ry="10" fill="#e9d8b8"/><path d="M14 24q10 -8 20 0t20 0t20 0t20 0t20 0" stroke="#8a6a48" stroke-width="2" fill="none"/></svg><span class="nest-egg">'+PET.egg({kind:e.kind,warmth:e.warmth,need:e.need,wobble:ready&&!RM()})+'</span>'+(eggs.length>1?'<span class="nest-n">×'+eggs.length+'</span>':'')+'<span class="nest-bar"><i style="width:'+Math.round(e.warmth/e.need*100)+'%"></i></span>'+(ready?'<span class="nest-tag">可以孵喇</span>':'')+'</button>';}
function renderEggPanel(){const p=S.pet;const full=household()>=HOUSE_MAX;
 $('#care-panel').innerHTML='<div class="row" style="justify-content:space-between"><h3>孵蛋座</h3><button class="btn ghost small" id="egg-close">收埋</button></div><p class="muted" style="margin:4px 0 12px">打卡、完成習慣、收工抽卡、照顧寵物都會令蛋暖啲。你做嘅每樣好嘢，都喺度慢慢孵緊。</p><div class="eggs">'+
 (p.eggs||[]).map(e=>{const ready=e.warmth>=e.need;const pc=Math.round(e.warmth/e.need*100);return '<div class="egg-row"><div class="egg-pic">'+PET.egg({kind:e.kind,warmth:e.warmth,need:e.need,wobble:ready&&!RM()})+'</div><div style="flex:1;min-width:0"><b>'+(e.kind==='gold'?'金色賽博蛋':'賽博蛋')+'</b><span class="muted">　'+(e.kind==='gold'?'好大機會孵出閃光寵物':'有機會孵出閃光寵物')+'</span><div class="bar" style="margin:8px 0"><i class="'+(ready?'good':'warn')+'" style="width:'+pc+'%"></i></div>'+
  (ready?(full?'<p class="muted">屋企已經住滿 '+HOUSE_MAX+' 隻，暫時孵唔到。</p>':'<div class="row" style="flex-wrap:nowrap"><input type="text" id="egg-name-'+e.id+'" maxlength="12" placeholder="幫佢改個名" style="flex:1;min-width:0"><button class="btn" data-hatch="'+e.id+'">孵化</button></div>'):'<span class="muted">溫度 '+pc+'%</span>')+'</div></div>';}).join('')+'</div>';
 $('#care-panel').hidden=false;}
document.addEventListener('click',e=>{if(e.target.closest('#nest')){renderEggPanel();try{$('#care-panel').scrollIntoView({behavior:RM()?'auto':'smooth',block:'nearest'});}catch(err){}return;}
 if(e.target.id==='egg-close'){$('#care-panel').hidden=true;return;}
 const h=e.target.closest('[data-hatch]');if(h){hatchEgg(h.dataset.hatch);}});
const BABYN=['布丁','芝士','湯圓','豆腐','奶茶','雪條','魚蛋','菠蘿包','小籠包','西多'];
function hatchEgg(id){const p=S.pet;const e=(p.eggs||[]).find(x=>x.id===id);if(!e||e.warmth<e.need||household()>=HOUSE_MAX)return;
 const inp=$('#egg-name-'+id);const name=((inp&&inp.value.trim())||pick(BABYN)).slice(0,12);
 const shiny=Math.random()<(e.kind==='gold'?.5:.125)?1:0;const sps=Object.keys(PET.SPECIES);const cols=Object.keys(PET.PAL).filter(k=>!PET.PAL[k].rare);
 const color=shiny&&Math.random()<.5?'aurora':pick(cols);
 const baby={id:uid(),name,sp:pick(sps),color,acc:'',xp:0,needs:{food:85,water:85,energy:85,clean:90,fun:90},nt:Date.now(),chat:[],fed:'',sleepAt:0,born:keyOf(new Date()),shiny,traits:{}};
 p.eggs=p.eggs.filter(x=>x.id!==id);p.others.push(baby);p.hatched=(p.hatched||0)+1;persist();
 $('#care-panel').hidden=true;renderRoom();renderStatus();
 const art=PET.svg(Object.assign({stage:0,expr:'love'},baby));
 if(typeof celebrate==='function')celebrate({eyebrow:shiny?'✦ 稀有':'孵化',title:name+' 出世喇！',sub:(shiny?'係閃光'+PET.SPECIES[baby.sp]+'！好罕有。':'係一隻'+PET.PAL[color].n+'嘅'+PET.SPECIES[baby.sp]+'。')+'佢同'+p.name+'一齊住，喺屋企撳佢就可以轉去照顧佢。',art});
 else toast(name+' 出世喇！');}
/* 自由活動 */
const SPOTS=[
 {id:'rug',x:44,b:7,ex:'happy',l:['地氈好軟呀～','喺度打個滾！']},
 {id:'bed',x:80,b:8,ex:'sleep',l:['借我瞓陣……','好暖……']},
 {id:'sofa',x:66,b:41,req:'sofa',ex:'happy',l:['梳化好舒服！你都嚟坐吓？','攤喺度最正。']},
 {id:'ball',x:36,b:3,req:'ball',ex:'happy',l:['波波！陪我玩！']},
 {id:'kitchen',x:14,b:16,req:'kitchen',ex:'ask',l:['好香呀……今晚食咩？']},
 {id:'shelf',x:28,b:9,req:'shelf',ex:'normal',l:['好多書，都係你抽卡嘅回憶。']},
 {id:'tank',x:43,b:13,req:'tank',ex:'wow',l:['魚仔游嚟游去～']},
 {id:'window',x:72,b:6,not:'sofa',ex:'wow',l:['出面好靚……']},
 {id:'corner',x:22,b:3,ex:'happy',l:['呢個角落好舒服。']},
 {id:'back',x:60,b:24,ex:'normal',l:['我喺度望住你。']}
];
let RPOS={},roamT=0,roamNext=0,roamDragged=false,drag=null;
function spotsAvail(){const own=(S.pet&&S.pet.own)||{};return SPOTS.filter(s=>(!s.req||own[s.req])&&(!s.not||!own[s.not]));}
function spotOf(pid){return SPOTS.find(s=>s.id===RPOS[pid])||SPOTS[0];}
const PREF=['rug','sofa','bed','window','kitchen','corner','back','ball','shelf','tank'];
const near=(a,b)=>Math.abs(a.x-b.x)<15&&Math.abs(a.b-b.b)<16;
function freeSpots(except){const occ=Object.keys(RPOS).filter(k=>k!==except&&allPets().some(x=>x.id===k)).map(k=>SPOTS.find(s=>s.id===RPOS[k])).filter(Boolean);return spotsAvail().filter(s=>!occ.some(o=>o.id===s.id||near(o,s)));}
function roamPlace(){const av=spotsAvail();const live=allPets().map(x=>x.id);Object.keys(RPOS).forEach(k=>{if(!live.includes(k))delete RPOS[k];});
 allPets().forEach((x,i)=>{const cur=RPOS[x.id];delete RPOS[x.id];const fr=freeSpots(x.id);const ok=cur&&fr.some(s=>s.id===cur);let s=cur;
  if(!ok){const want=(i===0&&inSleep())?['bed'].concat(PREF):PREF;s=(want.map(id=>fr.find(f=>f.id===id)).find(Boolean)||fr[0]||av[i%av.length]).id;}RPOS[x.id]=s;});}
function roamExpr(){const p=S.pet;if(inSleep())return 'sleep';const s=spotOf(p.id);if(NEEDS.some(([k])=>p.needs[k]<40))return 'ask';return s.ex||'normal';}
function othersHTML(){const p=S.pet;return (p.others||[]).map(o=>{const s=spotOf(o.id);return '<button class="on-stage other" data-pid="'+o.id+'" style="left:'+s.x+'%;bottom:'+s.b+'%" aria-label="轉去照顧'+esc(o.name)+'">'+PET.svg({sp:o.sp,color:o.color,stage:petStage(o),acc:o.acc,shiny:o.shiny,trait:traitOf(o),expr:inSleep()?'sleep':s.ex})+'</button>';}).join('');}
function roamStop(){clearInterval(roamT);roamT=0;}
function roamArm(){roamStop();roamNext=Date.now()+7000+Math.random()*5000;roamT=setInterval(roamTick,1000);}
function roamTick(){const room=$('#room');if(!S.pet||!room||!$('#page-pet').classList.contains('on')||$('#pv-home').hidden||document.hidden){return;}
 if(RM()||drag||petBusy||inSleep()||Date.now()<roamNext)return;roamNext=Date.now()+7000+Math.random()*5000;
 const pets=allPets();const mover=Math.random()<.7?pets[0]:pick(pets);const el=room.querySelector('.on-stage[data-pid="'+mover.id+'"]');if(!el)return;
 const free=freeSpots(mover.id).filter(s=>s.id!==RPOS[mover.id]);if(!free.length)return;
 const to=pick(free);RPOS[mover.id]=to.id;const main=mover===S.pet;if(main){const b=$('#bubble');if(b)b.hidden=true;}
 el.classList.add('walking');el.style.left=to.x+'%';el.style.bottom=to.b+'%';
 setTimeout(()=>{el.classList.remove('walking');arriveSpot(el,mover,to,main&&Math.random()<.45);},3000);}
function arriveSpot(el,pet,to,talk){if(!el.isConnected)return;const main=pet===S.pet;
 el.innerHTML=main?PET.svg(petO(roamExpr())):PET.svg({sp:pet.sp,color:pet.color,stage:petStage(pet),acc:pet.acc,shiny:pet.shiny,trait:traitOf(pet),expr:to.ex});
 if(talk)bubble('bubble',pick(to.l));}
document.addEventListener('pointerdown',e=>{const el=e.target.closest('#room .on-stage');if(!el||e.button>0)return;drag={el,x0:e.clientX,y0:e.clientY,id:e.pointerId,moved:false,W:$('#room').getBoundingClientRect()};});
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;
 if(!drag.moved){if(Math.hypot(dx,dy)<8)return;drag.moved=true;try{drag.el.setPointerCapture(drag.id);}catch(err){}drag.el.classList.add('dragging');const b=$('#bubble');if(b)b.hidden=true;
  const pid=drag.el.dataset.pid,pet=allPets().find(x=>x.id===pid);if(pet)drag.el.innerHTML=pet===S.pet?PET.svg(petO('wow')):PET.svg({sp:pet.sp,color:pet.color,stage:petStage(pet),acc:pet.acc,shiny:pet.shiny,trait:traitOf(pet),expr:'wow'});}
 const W=drag.W;const x=Math.max(8,Math.min(92,(e.clientX-W.left)/W.width*100));const b=Math.max(0,Math.min(62,(W.bottom-e.clientY)/W.height*100-8));
 drag.el.style.left=x+'%';drag.el.style.bottom=b+'%';e.preventDefault();});
function endDrag(e){if(!drag||(e&&e.pointerId!==drag.id))return;const d=drag;drag=null;if(!d.moved)return;roamDragged=true;setTimeout(()=>{roamDragged=false;},350);
 d.el.classList.remove('dragging');const x=parseFloat(d.el.style.left),b=parseFloat(d.el.style.bottom);const pid=d.el.dataset.pid,pet=allPets().find(q=>q.id===pid);if(!pet)return;
 const prev=RPOS[pid];let best=null,bd=1e9;spotsAvail().forEach(s=>{const dd=Math.hypot(s.x-x,(s.b-b)*1.6);if(dd<bd){bd=dd;best=s;}});
 if(!best)best=spotOf(pid);
 allPets().forEach(q=>{if(q.id===pid)return;const qs=SPOTS.find(s=>s.id===RPOS[q.id]);if(!qs||!(qs.id===best.id||near(qs,best)))return;
  RPOS[pid]=best.id;const fr=freeSpots(q.id);const back=SPOTS.find(s=>s.id===prev);const to=(back&&back.id!==best.id&&!near(back,best)&&(!spotsAvail().includes(back)?null:back))||fr.find(s=>s.id!==best.id&&!near(s,best))||back;if(!to)return;
  RPOS[q.id]=to.id;const qe=document.querySelector('#room .on-stage[data-pid="'+q.id+'"]');if(qe){qe.classList.add('settle');qe.style.left=to.x+'%';qe.style.bottom=to.b+'%';setTimeout(()=>{qe.classList.remove('settle');arriveSpot(qe,q,to,false);},450);}});
 RPOS[pid]=best.id;d.el.classList.add('settle');d.el.style.left=best.x+'%';d.el.style.bottom=best.b+'%';setTimeout(()=>d.el.classList.remove('settle'),450);
 roamNext=Date.now()+9000;setTimeout(()=>arriveSpot(d.el,pet,best,pet===S.pet),300);}
document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
/* 角落小寵物 */
let BUD=0;
function updBuddy(){const b=$('#buddy');if(!b)return;const show=!!S.pet&&S.settings.buddy!==false&&!$('#page-pet').classList.contains('on')&&!$('#page-adventure').classList.contains('on')&&!$('#page-arcade').classList.contains('on');b.hidden=!show;if(show)$('#buddy-pet').innerHTML=PET.svg(petO(inSleep()?'sleep':'normal'),'mini');}
function buddyCheer(label){const b=$('#buddy');if(!b||b.hidden)return;$('#buddy-pet').innerHTML=PET.svg(petO('love'),'mini');if(!RM()){b.classList.remove('jump');void b.offsetWidth;b.classList.add('jump');}
 const tx=$('#buddy-b');tx.textContent=pick(['好叻！','做得好！','我見到喇！','你好犀利！','耶！'])+' '+label;tx.hidden=false;clearTimeout(BUD);BUD=setTimeout(()=>{tx.hidden=true;b.classList.remove('jump');if(!b.hidden)$('#buddy-pet').innerHTML=PET.svg(petO(inSleep()?'sleep':'normal'),'mini');},3200);}
document.addEventListener('click',e=>{if(e.target.closest('#buddy'))go('pet');});

/* ---------- 我嘅習慣（概念參考 Loop Habit Tracker：強度唔清零） ---------- */
const HB_M=Math.pow(.5,1/14);
function hbDefaults(){return [{id:'run',name:'跑步',freq:3,log:{}},{id:'cook',name:'自己煮飯',freq:4,log:{}},{id:'bed',name:'錨點時間上床',freq:7,log:{}}];}
function hbStrength(h,upto){const days=Object.keys(h.log||{}).sort();if(!days.length)return 0;const end=upto||defaultDay();let d=days[0];if(addDays(end,-400)>d)d=addDays(end,-400);
 let s=0,guard=0;while(d<=end&&guard<500){let c=0;for(let i=0;i<7;i++)if(h.log[addDays(d,-i)])c++;const v=Math.min(1,c/h.freq);s=s*HB_M+v*(1-HB_M);d=addDays(d,1);guard++;}return Math.round(s*100);}
const HBL=[[0,'萌芽中'],[25,'成長中'],[50,'穩定'],[80,'已經成為習慣']];
const hbLabel=v=>{let r=HBL[0][1];HBL.forEach(([t,n])=>{if(v>=t)r=n;});return r;};
const hbFreq=f=>f>=7?'每日':'每週 '+f+' 次';
function hbWeek(h){const k=defaultDay();let c=0;for(let i=0;i<7;i++)if(h.log[addDays(k,-i)])c++;return c;}
let hbEditing=false,hbDelArm=null;
function renderHabits(){const box=$('#habits');if(!box)return;const k=defaultDay();
 if(!S.habits.length){box.innerHTML='<p class="muted">未有習慣。撳「修改」加一個你想慢慢養成嘅小習慣。</p>';}
 else box.innerHTML='<div class="hb-list">'+S.habits.map(h=>{const v=hbStrength(h);const done=!!h.log[k];const wk=hbWeek(h);
  const dots=Array.from({length:7},(_,i)=>{const d=addDays(k,i-6);return '<i class="'+(h.log[d]?'on':'')+'" title="'+md(d)+'"><span>'+WD[parseKey(d).getDay()]+'</span></i>';}).join('');
  return '<div class="hb"><div class="hb-ring" style="--v:'+v+'" role="img" aria-label="強度 '+v+'%"><b>'+v+'<small>%</small></b></div><div class="hb-main"><div class="row" style="gap:8px;align-items:baseline"><b class="hb-n">'+esc(h.name)+'</b><span class="chip '+(v>=50?'good':'')+'">'+hbLabel(v)+'</span></div><span class="muted">'+hbFreq(h.freq)+'・最近 7 日 '+wk+(h.freq<7?'／'+h.freq:'')+' 次</span><div class="hb-dots">'+dots+'</div></div><button class="hb-do'+(done?' on':'')+'" data-hb="'+h.id+'" aria-pressed="'+done+'">'+(done?'✓ 做咗':'今日做咗')+'</button></div>';}).join('')+'</div>';
 const ed=$('#hb-editor');ed.hidden=!hbEditing;$('#hb-edit').textContent=hbEditing?'完成':'修改';
 if(hbEditing)ed.innerHTML=S.habits.map(h=>'<div class="hb-ed" data-hbid="'+h.id+'"><input type="text" maxlength="16" value="'+esc(h.name)+'" data-hbname="'+h.id+'" aria-label="習慣名"><select data-hbfreq="'+h.id+'" aria-label="頻率">'+[1,2,3,4,5,6,7].map(n=>'<option value="'+n+'"'+(n===h.freq?' selected':'')+'>'+hbFreq(n)+'</option>').join('')+'</select><button class="btn ghost small danger" data-hbdel="'+h.id+'">'+(hbDelArm===h.id?'再撳確認':'刪除')+'</button></div>').join('')+
  (S.habits.length<8?'<div class="hb-ed"><input type="text" maxlength="16" id="hb-new" placeholder="新習慣，例如：飲夠水"><select id="hb-newf">'+[1,2,3,4,5,6,7].map(n=>'<option value="'+n+'"'+(n===3?' selected':'')+'>'+hbFreq(n)+'</option>').join('')+'</select><button class="btn small" id="hb-add">加</button></div>':'<p class="muted">最多 8 個。</p>');}
document.addEventListener('click',e=>{const t=e.target;
 const b=t.closest('[data-hb]');if(b){const h=S.habits.find(x=>x.id===b.dataset.hb);if(!h)return;const k=defaultDay();
  if(h.log[k]){delete h.log[k];persist();renderHabits();return;}
  h.log[k]=1;persist();renderHabits();petAward('habit',3,3,'習慣');
  const wk=hbWeek(h);if(h.freq<7&&wk===h.freq)toast('最近 7 日目標做到：'+h.name+' '+wk+'／'+h.freq);return;}
 if(t.id==='hb-edit'){hbEditing=!hbEditing;hbDelArm=null;renderHabits();return;}
 if(t.id==='hb-add'){const n=$('#hb-new').value.trim();if(!n){$('#hb-new').focus();return;}S.habits.push({id:uid(),name:n.slice(0,16),freq:+$('#hb-newf').value||3,log:{}});persist();renderHabits();return;}
 const d=t.closest('[data-hbdel]');if(d){const id=d.dataset.hbdel;if(hbDelArm!==id){hbDelArm=id;renderHabits();setTimeout(()=>{if(hbDelArm===id){hbDelArm=null;if(hbEditing)renderHabits();}},5000);return;}S.habits=S.habits.filter(x=>x.id!==id);hbDelArm=null;persist();renderHabits();}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.hbname){const h=S.habits.find(x=>x.id===t.dataset.hbname);if(h&&t.value.trim()){h.name=t.value.trim().slice(0,16);persist();}}
 if(t.dataset.hbfreq){const h=S.habits.find(x=>x.id===t.dataset.hbfreq);if(h){h.freq=+t.value;persist();}}});
/* ---------- 好嘢熱度圖 ---------- */
function goodByDay(){const m={};const add=(k,n)=>{if(k)m[k]=(m[k]||0)+n;};
 Object.keys(S.checkins).forEach(k=>add(k,1));Object.keys(S.draws||{}).forEach(k=>add(k,1));
 (S.habits||[]).forEach(h=>Object.keys(h.log||{}).forEach(k=>add(k,1)));
 (S.evidence||[]).forEach(e=>{if(!e.seed)add(e.date,1);});return m;}
function heatSVG(){const m=goodByDay();const today=keyOf(new Date());const td=parseKey(today);const mon=(td.getDay()+6)%7;const start=addDays(today,-mon-7*15);
 const C=15,G=3,L=22,T=18;let s='',active=0,total=0;const lv=n=>n<=0?0:n===1?1:n===2?2:n<=4?3:4;const op=[0,.28,.5,.72,.95];let lastM=-1;
 for(let w=0;w<16;w++){const wd=addDays(start,w*7);const mo=parseKey(wd).getMonth();if(mo!==lastM){s+='<text x="'+(L+w*(C+G))+'" y="11" font-size="10" fill="var(--ink-3)">'+(mo+1)+'月</text>';lastM=mo;}
  for(let d=0;d<7;d++){const k=addDays(start,w*7+d);if(k>today)continue;const n=m[k]||0;if(n){active++;total+=n;}const x=L+w*(C+G),y=T+d*(C+G);
   s+='<rect x="'+x+'" y="'+y+'" width="'+C+'" height="'+C+'" rx="3" '+(n?'fill="var(--good)" fill-opacity="'+op[lv(n)]+'"':'fill="var(--kraft)"')+'><title>'+md(k)+(n?'：'+n+' 樣好嘢':'')+'</title></rect>';}}
 ['一','三','五','日'].forEach((t,i)=>{const d=[0,2,4,6][i];s+='<text x="0" y="'+(T+d*(C+G)+11)+'" font-size="10" fill="var(--ink-3)">'+t+'</text>';});
 const W=L+16*(C+G),H=T+7*(C+G);
 return {svg:'<svg viewBox="0 0 '+W+' '+H+'" class="heat" role="img" aria-label="最近 16 個星期做咗好嘢嘅日子">'+s+'</svg>',active,total};}
function renderHeat(){const box=$('#heat');if(!box)return;const r=heatSVG();box.innerHTML=r.svg;$('#heat-sum').innerHTML='最近 16 個星期，有 <b>'+r.active+'</b> 日做咗好嘢，加埋一共 <b>'+r.total+'</b> 樣。';}
/* ---------- 里程碑慶祝 ---------- */
const nCI=()=>Object.keys(S.checkins).length,nDR=()=>Object.keys(S.draws||{}).length;
const hbMax=()=>Math.max(0,...(S.habits||[]).map(h=>hbStrength(h)));
const MILES=[
 {id:'ci1',t:'第一次打卡',s:'開始咗就係最難嘅一步。',f:()=>nCI()>=1},
 {id:'ci10',t:'打卡 10 日',s:'十日嘅記錄，已經睇得出你自己嘅節奏。',f:()=>nCI()>=10},
 {id:'ci30',t:'打卡 30 日',s:'一個月嘅自己，一日一日寫落嚟。',f:()=>nCI()>=30,egg:1},
 {id:'ci100',t:'打卡 100 日',s:'一百日。呢份堅持係你自己嘅。',f:()=>nCI()>=100,egg:1},
 {id:'dr1',t:'第一次收工抽卡',s:'書櫃上面多咗第一本書。',f:()=>nDR()>=1},
 {id:'dr7',t:'抽咗 7 晚卡',s:'一個星期嘅收工日記。',f:()=>nDR()>=7},
 {id:'dr30',t:'抽咗 30 晚卡',s:'成個書櫃開始滿起嚟。',f:()=>nDR()>=30,egg:1},
 {id:'zhiji',t:'第一張「知己」牌',s:'同一張牌見咗 7 次，佢已經好熟你。',f:()=>Object.values(drawCounts()).some(n=>n>=7),egg:1},
 {id:'hb50',t:'第一個習慣強度過 50%',s:'個習慣開始穩定落嚟。',f:()=>hbMax()>=50},
 {id:'hb80',t:'第一個「已經成為習慣」',s:'唔使諗都會做，就係習慣。',f:()=>hbMax()>=80,egg:1},
 {id:'ev20',t:'證據簿有 20 條',s:'二十件真實做到嘅事。',f:()=>(S.evidence||[]).length>=20},
 {id:'lad5',t:'細步階梯行咗 5 次',s:'每一級都係實際行過嘅。',f:()=>(S.ladders||[]).reduce((n,L)=>n+L.steps.reduce((m,x)=>m+(x.log||[]).length,0),0)>=5},
 {id:'teen',t:'寵物長大到少年',s:'佢同你一齊大個咗。',f:()=>!!S.pet&&allPets().some(x=>petStage(x)>=1)},
 {id:'adult',t:'寵物長大到成年',s:'一路照顧落嚟嘅結果。',f:()=>!!S.pet&&allPets().some(x=>petStage(x)>=2),egg:1},
 {id:'hatch1',t:'第一隻蛋孵出嚟',s:'屋企多咗一位成員。',f:()=>!!S.pet&&(S.pet.hatched||0)>=1},
 {id:'friend',t:'識到第一個寵物朋友',s:'出街行吓，就會識到朋友。',f:()=>!!S.pet&&Object.keys(S.pet.friends||{}).length>=1},
 {id:'album10',t:'相簿有 10 張相',s:'十個值得記住嘅畫面。',f:()=>!!S.pet&&(S.pet.album||[]).length>=10}
];
const CQ=[];let milesT=0;
function milesSoon(){clearTimeout(milesT);milesT=setTimeout(checkMiles,1200);}
function checkMiles(){if(cloudInitPending){milesSoon();return;}if(typeof ritual!=='undefined'&&(ritual||drawing)){milesSoon();return;}
 S.miles=S.miles||{};const fresh=MILES.filter(m=>!S.miles[m.id]&&(()=>{try{return m.f();}catch(e){return false;}})());if(!fresh.length)return;const k=keyOf(new Date());
 if(!S.milesInit){S.milesInit=1;fresh.forEach(m=>{S.miles[m.id]=k;});if(S.pet)S.pet.coins+=10*fresh.length;persist();
  CQ.push({eyebrow:'你一路做到嘅',title:'之前已經達成 '+fresh.length+' 個里程碑',sub:fresh.map(m=>m.t).join('、')+'。',rew:S.pet?'寵物金幣 +'+(10*fresh.length):''});showCele();return;}
 let changed=false;fresh.forEach(m=>{S.miles[m.id]=k;changed=true;let rew=[];
  if(S.pet){S.pet.coins+=20;rew.push('金幣 +20');if(m.egg){if(addEgg('gold'))rew.push('一隻金蛋');else{S.pet.coins+=20;rew.push('屋企滿咗，改送金幣 +20');}}}
  S.evidence.push({id:uid(),date:k,type:'做到',text:'里程碑：'+m.t,src:'里程碑'});rew.push('已記入證據簿');
  CQ.push({eyebrow:'里程碑',title:m.t,sub:m.s,rew:rew.join('・')});});
 if(changed){persist();showCele();}}
function celebrate(o){CQ.push(o);showCele();}
function showCele(){const box=$('#cele');if(!box||!box.hidden||!CQ.length)return;const o=CQ.shift();
 $('#cele-eb').textContent=o.eyebrow||'里程碑';$('#cele-t').textContent=o.title;$('#cele-s').textContent=o.sub||'';$('#cele-r').textContent=o.rew||'';$('#cele-r').hidden=!o.rew;
 $('#cele-art').innerHTML=o.art||(S.pet?PET.svg(petO('love')):'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="var(--good-soft)"/><path d="M50 22l8 17 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z" fill="var(--good)"/></svg>');
 box.hidden=false;$('#cele-ok').focus();}
document.addEventListener('click',e=>{if(e.target.id==='cele-ok'||e.target.id==='cele'){$('#cele').hidden=true;setTimeout(showCele,250);if(!$('#page-pet').hidden&&$('#page-pet').classList.contains('on')&&segGet('pettab')==='home'&&S.pet){renderRoom();renderStatus();}}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#cele')&&!$('#cele').hidden){$('#cele').hidden=true;setTimeout(showCele,250);}});

/* ---------- today ---------- */
const sliders=[['#ci-mood','#v-mood'],['#ci-anx','#v-anx'],['#ci-energy','#v-energy']];
sliders.forEach(([i,v])=>$(i).addEventListener('input',()=>{$(v).textContent=$(i).value;}));
function updateSleepCalc(){const h=sleepHours($('#ci-sleep-start').value,$('#ci-sleep-end').value);$('#sleep-calc').textContent=h==null?'—':'約 '+h+' 小時';}
['#ci-sleep-start','#ci-sleep-end'].forEach(s=>$(s).addEventListener('input',updateSleepCalc));
function dateHint(k){const d=parseKey(k);const today=keyOf(new Date());const rel=k===today?'今日':k===addDays(today,-1)?'琴日':'';$('#date-hint').textContent='星期'+WD[d.getDay()]+(rel?'・'+rel:'')+'・夜班按開工日計';}
function loadForm(k){
  const e=S.checkins[k];
  $('#ci-date').value=k;dateHint(k);
  segSet('work',e?e.work:null);
  $('#ci-mood').value=e?e.mood:5;$('#ci-anx').value=e?e.anx:5;$('#ci-energy').value=e?e.energy:5;
  sliders.forEach(([i,v])=>$(v).textContent=$(i).value);
  $('#ci-sleep-start').value=e&&e.ss||'';$('#ci-sleep-end').value=e&&e.se||'';updateSleepCalc();
  segSet('seg',e?e.seg:null);segSet('contact',e?e.contact:null);segSet('move',e?e.move:null);
  $('#ci-mastery').value=e&&e.mastery||'';$('#ci-pleasure').value=e&&e.pleasure||'';$('#ci-next').value=e&&e.next||'';
  $('#ci-status').textContent=e?'呢日已經記錄咗，改完再撳一次就得。':'';
  $('#ci-feedback').innerHTML='';
  restoreCheckinDraft(k);
}
$('#ci-date').addEventListener('change',()=>{if($('#ci-date').value)loadForm($('#ci-date').value);});
function recentEntries(k,n){const out=[];for(let i=0;i<n;i++){const d=addDays(k,-i);if(S.checkins[d])out.push(S.checkins[d]);}return out;}
function feedbackFor(k,e){
  const fb=[];
  const hrs=sleepHours(e.ss,e.se);
  if(e.mood<=2)fb.push(['red','今日好低。唔使逼自己即刻好返。打開<a data-goto="plan">低潮應急卡</a>，照第 ② 步做一樣就得。']);
  if(recentEntries(k,5).filter(x=>x.mood<=3).length>=3)fb.push(['warn','最近幾日心情都偏低。呢個唔係懶，係一個訊號。安省有免費 CBT，可以自己轉介，資料喺<a data-goto="plan">應急卡最底</a>。']);
  if(e.anx>=7)fb.push(['calm','焦慮偏高。試吓<a data-goto="sos">卡住急救</a>第一步，一分鐘就得。']);
  if(e.seg==='3')fb.push(['warn','瞓眠斷咗三段或以上，就算加埋時數唔少都會好攰。聽日收工試吓一次過瞓，開工前小瞓控制喺 30 分鐘內。']);
  else if(e.ss&&circDiff(e.ss,S.settings.a)>2)fb.push(['warn','今日開始瞓嘅時間離錨點 '+S.settings.a+' 差咗 '+Math.round(circDiff(e.ss,S.settings.a)*10)/10+' 個鐘。休息日都盡量唔好差多過 2 個鐘。']);
  if(hrs!=null&&hrs<5&&e.work==='work')fb.push(['red','主睡眠唔夠 5 個鐘。今晚踩車送單一覺得眼瞓就停低，安全最緊要。']);
  const last3=recentEntries(k,3);
  if(last3.length>=3&&last3.every(x=>x.contact==='0'))fb.push(['calm','已經連續三日冇同人真正傾過。去<a data-goto="ladder">細步階梯</a>揀第一級試吓，交單時講多句都算。']);
  if(!fb.length){
    if(e.contact==='2'||e.contact==='3')fb.push(['good','今日有同人傾到偈。對抗孤獨，呢啲細接觸比諗好多更實在。']);
    if(e.move==='2')fb.push(['good','有跑步或者運動。運動對焦慮同低落有實際效果。']);
    if(e.mood>=7)fb.push(['good','今日狀態唔錯。可以諗吓係咩令今日好啲，寫入三省。']);
  }
  let q='w31';
  if(e.mood<=2)q='w63';else if(e.anx>=7)q='w27';else if(e.seg==='3'||(hrs!=null&&hrs<5))q='w61';else if(last3.length>=3&&last3.every(x=>x.contact==='0'))q='w43';else if(e.mood<=4)q='w03';else if(e.mood>=7)q='w34';else if(e.mastery)q='w55';
  const x=byId(q);
  if(k===defaultDay()&&!(S.draws||{})[k])fb.push(['calm','收工想寫多兩句？去<a data-goto="draw">收工抽卡</a>，寫低今晚嘅說話，抽一張牌。']);
  return [['',e.mastery?'記低咗。「做到」嗰條已經放入證據簿。':'記低咗。']].concat(fb.slice(0,4)).concat([['','<span style="font-family:var(--f-head)">「'+esc(x.o)+'」</span><span class="muted" style="margin-left:8px">'+esc(x.s)+'</span><br><span style="font-size:13.5px;color:var(--ink-2)">'+esc(x.u)+'</span>']]);
}
$('#ci-save').addEventListener('click',()=>{
  const k=$('#ci-date').value||defaultDay();
  const e={work:segGet('work'),mood:+$('#ci-mood').value,anx:+$('#ci-anx').value,energy:+$('#ci-energy').value,
    ss:$('#ci-sleep-start').value,se:$('#ci-sleep-end').value,seg:segGet('seg'),contact:segGet('contact'),move:segGet('move'),
    mastery:$('#ci-mastery').value.trim(),pleasure:$('#ci-pleasure').value.trim(),next:$('#ci-next').value.trim(),t:Date.now()};
  S.checkins[k]=e;
  const cid='ci-'+k;
  S.evidence=S.evidence.filter(x=>x.id!==cid);
  if(e.mastery)S.evidence.push({id:cid,date:k,type:'做到',text:e.mastery,src:'打卡'});
  persist({year:k.slice(0,4)});
  if(S.pet){petAward('ci',10,1,'打卡');if(e.contact==='2'||e.contact==='3')petAward('talk',5,1,'同人傾偈');if(e.move&&e.move!=='0')petAward('move',5,1,'郁身');}
  if(storageOK)removeDraft('checkin',k);
  $('#ci-status').textContent=storageOK?'已儲存。':'本機儲存未成功，請先匯出備份。';
  $('#ci-feedback').innerHTML=feedbackFor(k,e).map(([c,t])=>'<div class="fb '+c+'">'+t+'</div>').join('');
  renderBadge();
});

/* ---------- SOS ---------- */
function sosGo(n){$$('#sos-steps button').forEach(b=>b.classList.toggle('on',b.dataset.s===String(n)));$$('.sos-pane').forEach(p=>p.classList.toggle('on',p.dataset.s===String(n)));}
$$('#sos-steps button').forEach(b=>b.addEventListener('click',()=>sosGo(b.dataset.s)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>sosGo(b.dataset.go)));
let breathTimer=null;
function stopBreath(msg){clearTimeout(breathTimer);breathTimer=null;const o=$('#orb');o.style.transitionDuration='1.2s';o.style.transform='scale(.62)';$('#orb-txt').textContent=msg||'準備';}
$('#breath-start').addEventListener('click',()=>{
  stopBreath();
  const phases=[['吸',2000,.86],['再吸少少',1000,1],['慢慢呼',6000,.62]];
  let round=0,i=0;const total=6;const o=$('#orb');
  function step(){
    if(i===0){round++;if(round>total){stopBreath('做完喇');$('#breath-count').textContent='做完 6 輪，可以去下一步。';return;}$('#breath-count').textContent='第 '+round+' / '+total+' 輪';}
    const [txt,dur,sc]=phases[i];
    $('#orb-txt').textContent=txt;o.style.transitionDuration=dur+'ms';o.style.transform='scale('+sc+')';
    i=(i+1)%phases.length;breathTimer=setTimeout(step,dur);
  }
  step();
});
$('#breath-stop').addEventListener('click',()=>{stopBreath();$('#breath-count').textContent='每輪 9 秒，做 6 輪';});
function thoughtReply(){const v=$('#thought').value.trim();$('#thought-reply').innerHTML=v?'讀多次：「我留意到我有個念頭話『'+esc(v)+'』。」<br>佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。':'寫低之後，再讀一次。佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。';}
$$('#thought-chips button').forEach(b=>b.addEventListener('click',()=>{$('#thought').value=b.dataset.t;thoughtReply();}));
$('#thought').addEventListener('input',thoughtReply);
const tTotal=15*60;let tLeft=tTotal,tEnd=null,tInt=null;
function tDraw(){const s=Math.max(0,Math.round(tLeft));$('#timer').textContent=pad(Math.floor(s/60))+':'+pad(s%60);}
function tTick(){tLeft=(tEnd-Date.now())/1000;if(tLeft<=0){tLeft=0;clearInterval(tInt);tInt=null;$('#t-after').hidden=false;}tDraw();}
$('#t-start').addEventListener('click',()=>{if(tInt)return;if(tLeft<=0)tLeft=tTotal;tEnd=Date.now()+tLeft*1000;tInt=setInterval(tTick,250);$('#t-after').hidden=true;});
$('#t-pause').addEventListener('click',()=>{if(!tInt)return;clearInterval(tInt);tInt=null;tLeft=(tEnd-Date.now())/1000;tDraw();});
$('#t-reset').addEventListener('click',()=>{clearInterval(tInt);tInt=null;tLeft=tTotal;tDraw();$('#t-after').hidden=true;});
$('#sos-log').addEventListener('click',()=>{
  const used=Math.round((tTotal-Math.max(0,tLeft))/60);
  const step=$('#tiny-step').value.trim();
  S.evidence.push({id:uid(),date:keyOf(new Date()),type:'頂住咗唔舒服',text:'卡住時冇即刻放棄'+(used>0?'，自己試咗 '+used+' 分鐘':'')+(step?'：'+step:''),src:'急救'});
  persist();toast('已經記入證據簿');petAward('sos',10,1,'卡住急救');
});

/* ---------- evidence ---------- */
const typeColor={'做到':'good','頂住咗唔舒服':'warn','學識咗':'calm','幫到人':'red'};
function renderEvidence(){
  const list=S.evidence.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('#ev-count').textContent='而家有 '+list.length+' 條';
  $('#ev-list').innerHTML=list.length?list.map(x=>'<li class="item"><span class="chip '+(typeColor[x.type]||'')+'">'+esc(x.type)+'</span><div class="txt">'+esc(x.text)+'<div class="meta">'+md(x.date)+(x.seed?'・起步證據':'')+(x.src?'・來自'+esc(x.src):'')+'</div></div><button class="x" data-del-ev="'+esc(x.id)+'" aria-label="刪除">×</button></li>').join(''):'<li class="muted">未有記錄。</li>';
}
$('#ev-list').addEventListener('click',e=>{const b=e.target.closest('[data-del-ev]');if(!b)return;S.evidence=S.evidence.filter(x=>x.id!==b.dataset.delEv);persist();renderEvidence();});
$('#ev-add').addEventListener('click',()=>{const t=$('#ev-text').value.trim();if(!t){$('#ev-text').focus();return;}S.evidence.push({id:uid(),date:keyOf(new Date()),type:segGet('evtype')||'做到',text:t});persist();petAward('ev',5,3,'證據');$('#ev-text').value='';renderEvidence();toast('加咗一條');});
$('#ev-text').addEventListener('keydown',e=>{if(e.key==='Enter')$('#ev-add').click();});
$('#ev-pick').addEventListener('click',()=>{if(!S.evidence.length)return;const x=S.evidence[Math.floor(Math.random()*S.evidence.length)];const p=$('#ev-picked');p.innerHTML=esc(x.text)+'<div class="muted" style="margin-top:6px;font-family:var(--f-body)">'+esc(x.type)+'・'+md(x.date)+'</div>';p.hidden=false;});

/* ---------- ladders ---------- */
const fearCls=f=>f<=3?'l':f<=6?'m':'h';
let armedDelete=null;
function renderLadders(){
  $('#ladders').innerHTML=S.ladders.map(L=>{
    const steps=L.steps.slice().sort((a,b)=>a.fear-b.fear);
    const next=steps.find(s=>!s.log.length);
    return '<div class="sheet"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>'+esc(L.name)+'</h2><button class="btn ghost small'+(armedDelete===L.id?' danger':'')+'" data-del-ladder="'+L.id+'">'+(armedDelete===L.id?'再撳一次刪除':'刪除階梯')+'</button></div>'+
    '<ul class="list">'+(steps.length?steps.map(s=>{
      const last=s.log[s.log.length-1];
      return '<li class="item'+(s.log.length?' step-done':'')+'"><span class="fear '+fearCls(s.fear)+'" title="驚嘅程度">'+s.fear+'</span><div class="txt"><span>'+esc(s.text)+'</span>'+
      (last?'<div class="meta">做咗 '+s.log.length+' 次・最近估 '+last.before+' 分，實際 '+last.after+' 分</div>':(next&&next.id===s.id?'<div class="meta" style="color:var(--red)">建議下一級</div>':''))+
      '<div class="inline-form" id="f-'+s.id+'"><div class="label">之前估幾驚 <em id="fb-'+s.id+'">'+s.fear+'</em></div><input type="range" min="0" max="10" value="'+s.fear+'" id="rb-'+s.id+'" data-out="fb-'+s.id+'"><div class="label">實際幾驚 <em id="fa-'+s.id+'">'+s.fear+'</em></div><input type="range" min="0" max="10" value="'+s.fear+'" id="ra-'+s.id+'" data-out="fa-'+s.id+'"><div class="row" style="margin-top:6px"><button class="btn small" data-log="'+s.id+'">記低</button><button class="btn ghost small" data-cancel="'+s.id+'">取消</button></div></div>'+
      '</div><div class="row" style="flex:none;gap:2px"><button class="btn ghost small" data-open="'+s.id+'">做咗</button><button class="x" data-del-step="'+s.id+'" aria-label="刪除">×</button></div></li>';
    }).join(''):'<li class="muted">未有步驟，喺下面加第一級。</li>')+'</ul>'+
    '<div class="row" style="margin-top:12px"><input type="text" placeholder="加一級" id="ns-'+L.id+'" style="flex:1 1 180px"><select id="nf-'+L.id+'" style="width:auto">'+[1,2,3,4,5,6,7,8,9,10].map(n=>'<option value="'+n+'"'+(n===4?' selected':'')+'>驚 '+n+' 分</option>').join('')+'</select><button class="btn ghost small" data-add-step="'+L.id+'">加</button></div></div>';
  }).join('');
}
function findStep(id){for(const L of S.ladders){const s=L.steps.find(x=>x.id===id);if(s)return [L,s];}return [null,null];}
$('#ladders').addEventListener('input',e=>{const r=e.target.closest('input[type=range][data-out]');if(r)document.getElementById(r.dataset.out).textContent=r.value;});
$('#ladders').addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(!t.dataset.delLadder&&armedDelete){armedDelete=null;}
  if(t.dataset.open){$('#f-'+t.dataset.open).classList.toggle('on');return;}
  if(t.dataset.cancel){$('#f-'+t.dataset.cancel).classList.remove('on');return;}
  if(t.dataset.log){
    const [,s]=findStep(t.dataset.log);if(!s)return;
    const before=+$('#rb-'+s.id).value,after=+$('#ra-'+s.id).value;
    s.log.push({date:keyOf(new Date()),before,after});
    S.evidence.push({id:uid(),date:keyOf(new Date()),type:'頂住咗唔舒服',text:s.text+'（估 '+before+' 分，實際 '+after+' 分）',src:'階梯'});
    persist();renderLadders();petAward('lad',15,2,'細步階梯');
    toast(after<before?'實際冇估咁驚，個腦學緊。':'做咗就係做咗，已經記入證據簿。');
    return;
  }
  if(t.dataset.delStep){const [L,s]=findStep(t.dataset.delStep);if(L){L.steps=L.steps.filter(x=>x.id!==s.id);persist();renderLadders();}return;}
  if(t.dataset.delLadder){
    if(armedDelete===t.dataset.delLadder){S.ladders=S.ladders.filter(x=>x.id!==armedDelete);armedDelete=null;persist();}
    else armedDelete=t.dataset.delLadder;
    renderLadders();return;
  }
  if(t.dataset.addStep){
    const id=t.dataset.addStep;const inp=$('#ns-'+id);const txt=inp.value.trim();if(!txt){inp.focus();return;}
    const L=S.ladders.find(x=>x.id===id);L.steps.push({id:uid(),text:txt,fear:+$('#nf-'+id).value,log:[]});persist();renderLadders();
  }
});
$('#ladder-add').addEventListener('click',()=>{const n=$('#ladder-name').value.trim();if(!n){$('#ladder-name').focus();return;}S.ladders.push({id:uid(),name:n,steps:[]});persist();$('#ladder-name').value='';renderLadders();});

/* ---------- review ---------- */
const rangeDays=()=>+(segGet('range')||7);
function dayList(n){const end=keyOf(new Date());const out=[];for(let i=n-1;i>=0;i--)out.push(addDays(end,-i));return out;}
const svg=(inner,W,H)=>'<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img">'+inner+'</svg>';
function xLabels(days,x,H){const step=Math.ceil(days.length/7);return days.map((d,i)=>(i%step===0||i===days.length-1)?'<text x="'+x(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">'+md(d)+'</text>':'').join('');}
function grid(vals,y,P,W){return vals.map(v=>'<line x1="'+P.l+'" x2="'+(W-P.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" style="stroke:var(--rule)"/><text x="'+(P.l-8)+'" y="'+(y(v)+4)+'" text-anchor="end" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">'+v+'</text>').join('');}
function lineChart(days){
  const W=560,H=210,P={l:30,r:26,t:12,b:28};
  const x=i=>P.l+(days.length===1?(W-P.l-P.r)/2:i*(W-P.l-P.r)/(days.length-1));
  const y=v=>P.t+(10-v)*(H-P.t-P.b)/10;
  let g=grid([0,5,10],y,P,W);
  [['mood','var(--good)'],['anx','var(--red)'],['energy','var(--calm)']].forEach(([k,c])=>{
    let d='',pen=false,dots='';
    days.forEach((day,i)=>{const e=S.checkins[day];if(e&&e[k]!=null){d+=(pen?'L':'M')+x(i).toFixed(1)+' '+y(e[k]).toFixed(1)+' ';pen=true;dots+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(e[k]).toFixed(1)+'" r="3" style="fill:'+c+'"/>';}else pen=false;});
    g+='<path d="'+d+'" style="fill:none;stroke:'+c+';stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>'+dots;
  });
  return svg(g+xLabels(days,x,H),W,H);
}
function sleepChart(days){
  const W=560,H=210,P={l:30,r:26,t:12,b:28},MAX=12;
  const bw=(W-P.l-P.r)/days.length;
  const x=i=>P.l+i*bw+bw/2;
  const y=v=>P.t+(MAX-v)*(H-P.t-P.b)/MAX;
  let g=grid([0,4,8,12],y,P,W);
  days.forEach((d,i)=>{const e=S.checkins[d];const h=e?sleepHours(e.ss,e.se):null;if(h==null)return;const v=Math.min(h,MAX);const c=e.seg==='3'?'var(--red)':e.seg==='2'?'var(--warn)':'var(--good)';const w=Math.max(4,Math.min(24,bw*.6));g+='<rect x="'+(x(i)-w/2).toFixed(1)+'" y="'+y(v).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+(y(0)-y(v)).toFixed(1)+'" rx="2" style="fill:'+c+'"/>';});
  const tgt=sleepHours(S.settings.a,S.settings.b);
  if(tgt)g+='<line x1="'+P.l+'" x2="'+(W-P.r)+'" y1="'+y(Math.min(tgt,MAX))+'" y2="'+y(Math.min(tgt,MAX))+'" style="stroke:var(--ink-2);stroke-dasharray:4 4"/>';
  return svg(g+xLabels(days,x,H),W,H);
}
function stats(days){
  const es=days.map(d=>S.checkins[d]).filter(Boolean);
  const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
  const f=v=>v==null?'—':Math.round(v*10)/10;
  const sl=es.map(e=>sleepHours(e.ss,e.se)).filter(v=>v!=null);
  const from=days[0];
  let lad=0;S.ladders.forEach(L=>L.steps.forEach(s=>s.log.forEach(l=>{if(l.date>=from)lad++;})));
  return {n:es.length,mood:f(avg(es.map(e=>e.mood))),anx:f(avg(es.map(e=>e.anx))),energy:f(avg(es.map(e=>e.energy))),sleep:f(avg(sl)),
    contact:es.filter(e=>e.contact==='2'||e.contact==='3').length,move:es.filter(e=>e.move&&e.move!=='0').length,frag:es.filter(e=>e.seg==='3').length,
    ev:S.evidence.filter(x=>!x.seed&&x.date>=from).length,lad};
}
function weekKey(){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return keyOf(d);}
const PHQ=['覺得緊張、焦慮或者坐立不安','唔能夠停止或者控制擔心','做嘢冇乜興趣或者樂趣','覺得情緒低落、沮喪或者絕望'];
const PHQ_OPT=['完全冇','有幾日','一半以上日子','差唔多每日'];
function renderPHQForm(){$('#phq-form').innerHTML='<p class="muted" style="margin:8px 0 4px">過去兩個星期，有幾經常受以下問題困擾？</p>'+PHQ.map((q,i)=>'<div class="q"><p>'+(i+1)+'. '+q+'</p><div class="seg" data-name="phq'+i+'">'+PHQ_OPT.map((o,v)=>'<button data-v="'+v+'">'+o+'</button>').join('')+'</div></div>').join('');}
const phqLevel=t=>t<=2?['正常範圍','good']:t<=5?['輕度','calm']:t<=8?['中度','warn']:['偏高','red'];
function phqDue(){const last=S.phq[S.phq.length-1];return !last||(Date.now()-parseKey(last.date).getTime())/864e5>=14;}
function renderBadge(){$('#phq-badge').hidden=!(phqDue()&&Object.keys(S.checkins).length>=3);}
function renderPHQLast(){
  const last=S.phq[S.phq.length-1];
  if(!last){$('#phq-last').textContent='未做過。做咗第一次之後，呢度會顯示對比。';return;}
  const prev=S.phq[S.phq.length-2];
  $('#phq-last').innerHTML='上次 '+md(last.date)+'：總分 '+last.total+'／12，'+phqLevel(last.total)[0]+(prev?'；再上次 '+prev.total+' 分':'')+(phqDue()?'。<b>已經夠兩星期，可以再做。</b>':'。下次可以喺 '+md(addDays(last.date,14))+' 之後做。');
}
$('#phq-save').addEventListener('click',()=>{
  const v=PHQ.map((_,i)=>segGet('phq'+i));
  if(v.some(x=>x==null)){$('#phq-result').innerHTML='<div class="fb">四條都要揀先計到分。</div>';return;}
  const n=v.map(Number),anx=n[0]+n[1],dep=n[2]+n[3],total=anx+dep;
  S.phq.push({date:keyOf(new Date()),total,anx,dep});persist();petAward('phq',15,1,'PHQ-4');
  const [lv,c]=phqLevel(total);
  let msg='<div class="fb '+c+'">總分 '+total+'／12，'+lv+'。焦慮部分 '+anx+'／6，低落部分 '+dep+'／6。</div>';
  msg+=(total>=6||anx>=3||dep>=3)?'<div class="fb">呢個分數值得同專業人士傾一次。唔代表有病，係想有人幫你睇清楚。最低門檻：安省免費 CBT 可以自己轉介，或者康福用廣東話傾。資料喺<a data-goto="plan">應急卡最底</a>。</div>':'<div class="fb">繼續照而家咁跟進，兩星期後再做一次睇趨勢。</div>';
  $('#phq-result').innerHTML=msg;renderPHQLast();renderPHQForm();renderBadge();
});
function renderWeek(){const w=weekKey();const d=S.weeks[w]||{};$('#week-label').textContent='由星期一 '+md(w)+' 開始嘅一星期';$('#wk-did').value=d.did||'';$('#wk-learn').value=d.learn||'';$('#wk-next').value=d.next||'';}
$('#wk-save').addEventListener('click',()=>{S.weeks[weekKey()]={did:$('#wk-did').value.trim(),learn:$('#wk-learn').value.trim(),next:$('#wk-next').value.trim()};persist();petAward('wk',20,1,'每週三省');toast('儲存咗');});
function renderReview(){
  const days=dayList(rangeDays());const s=stats(days);
  $('#stats').innerHTML=[['平均心情',s.mood,'／10'],['平均焦慮',s.anx,'／10'],['平均主睡眠',s.sleep,'小時'],['有傾到偈',s.contact,'日'],['有郁身',s.move,'日'],['新證據・階梯',s.ev+'・'+s.lad,'條・次']]
    .map(([a,b,c])=>'<div class="sheet stat"><span>'+a+'</span><b>'+b+' <small>'+c+'</small></b></div>').join('');
  $('#chart-mood').innerHTML=s.n?lineChart(days):'<p class="muted" style="padding:40px 0;text-align:center">呢段時間未有打卡記錄。打完卡，曲線就會喺度出現。</p>';
  $('#chart-sleep').innerHTML=s.n?sleepChart(days):'<p class="muted" style="padding:40px 0;text-align:center">填咗主睡眠時間，呢度就會出棒形圖。</p>';
  renderPHQLast();renderWeek();renderHeat();
}
function buildSummary(){
  const days=dayList(7);const s=stats(days);
  const L=['【Dicky 心晴手帳・最近 7 日摘要】','打卡 '+s.n+'／7 日','平均：心情 '+s.mood+'、焦慮 '+s.anx+'、精神 '+s.energy+'（0 至 10）','平均主睡眠 '+s.sleep+' 小時（錨點 '+S.settings.a+' 至 '+S.settings.b+'）；斷開三段或以上 '+s.frag+' 日','有傾到偈 '+s.contact+' 日；有郁身 '+s.move+' 日','新證據 '+s.ev+' 條；階梯行咗 '+s.lad+' 次','','每日：'];
  days.forEach(d=>{const e=S.checkins[d];if(!e)return;const h=sleepHours(e.ss,e.se);L.push('・'+md(d)+(e.work==='off'?'（休息）':'')+' 心情'+e.mood+' 焦慮'+e.anx+' 精神'+e.energy+(h!=null?' 瞓'+h+'h':'')+(e.seg?(e.seg==='3'?'/3段+':'/'+e.seg+'段'):'')+(e.mastery?'｜做到：'+e.mastery:'')+(e.next?'｜細步：'+e.next:''));});
  const last=S.phq[S.phq.length-1];if(last)L.push('','PHQ-4（'+md(last.date)+'）：'+last.total+'／12（焦慮 '+last.anx+'、低落 '+last.dep+'）');
  const w=S.weeks[weekKey()];if(w&&(w.did||w.learn||w.next))L.push('','每週三省：做到「'+(w.did||'—')+'」；學到「'+(w.learn||'—')+'」；下星期細步「'+(w.next||'—')+'」');
  const dw=days.map(d=>(S.draws||{})[d]).filter(Boolean);if(dw.length)L.push('','收工抽卡：'+dw.map(d=>md(d.date)+'「'+drawCards(d).map(x=>card(x.card).name+(x.rev?'（提醒位）':'')).join('／')+'」').join('、'));
  const fv=(S.favs||[]).map(byId).filter(Boolean);if(fv.length)L.push('','我收藏嘅座右銘：'+fv.slice(0,5).map(x=>'「'+x.o+'」').join(' '));
  L.push('','請根據呢份摘要，同我傾下星期最值得行嘅一步。直接啲，唔使安慰說話。');
  return L.join('\n');
}
function selectText(el){try{const r=document.createRange();r.selectNodeContents(el);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);}catch(e){}}
$('#sum-copy').addEventListener('click',()=>{
  const txt=buildSummary();const pre=$('#sum-pre');pre.textContent=txt;pre.hidden=false;
  const done=ok=>{$('#sum-status').textContent=ok?'複製咗，去對話度貼上就得。':'自動複製唔到，已經幫你揀好下面啲字，手動複製就得。';if(!ok)selectText(pre);};
  try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false));}catch(e){done(false);}
});

/* ---------- plan ---------- */
const PL=['warn','self','place','people','safe','reason'];
const RES=[
  ['988 危機熱線','打或者 text 988，24 小時，免費','988'],
  ['康福心理健康協會（Hong Fook / Hf Care）','廣東話、普通話輔導同支援，407 Huron St，近 St George 站','416-493-4242'],
  ['安省免費 CBT（Ontario Structured Psychotherapy）','專做焦慮同抑鬱，可以自己轉介，唔使 OHIP 卡或家庭醫生。多倫多經 CAMH，打完揀 2','416-535-8501'],
  ['ConnexOntario','24 小時，幫你搵合適嘅心理服務','1-866-531-2600'],
  ['家庭醫生／Walk-in 診所','有 OHIP 免費，可以轉介精神科',null],
  ['即時危險','自己或者身邊人有即時危險','911']
];
function renderRes(){$('#res-list').innerHTML=RES.map(([n,d,num],i)=>'<div class="res"><div><b>'+n+'</b><span class="muted">'+d+'</span></div>'+(num?'<div class="num"><code id="num-'+i+'">'+num+'</code><button class="btn ghost small" data-copy="'+i+'">複製</button></div>':'')+'</div>').join('');}
$('#res-list').addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b)return;const el=$('#num-'+b.dataset.copy);const txt=el.textContent;try{navigator.clipboard.writeText(txt).then(()=>toast('複製咗 '+txt),()=>{selectText(el);toast('已揀好號碼，手動複製');});}catch(err){selectText(el);}});
function renderPlan(){PL.forEach(k=>$('#pl-'+k).value=S.plan[k]||'');}
$('#pl-save').addEventListener('click',()=>{PL.forEach(k=>S.plan[k]=$('#pl-'+k).value);persist();$('#pl-status').textContent='儲存咗。';});

/* ---------- settings ---------- */
function renderSettings(){try{$('#bk-recovery').hidden=!(unreadableLocal||localStorage.getItem(LS+'-unreadable-backup'));}catch(e){}$('#set-a').value=S.settings.a;$('#set-b').value=S.settings.b;segSet('theme',S.settings.theme);segSet('buddy',S.settings.buddy===false?'off':'on');}
$('#set-save').addEventListener('click',()=>{S.settings.a=$('#set-a').value||'09:00';S.settings.b=$('#set-b').value||'16:30';S.settings.theme=segGet('theme')||'auto';S.settings.buddy=segGet('buddy')!=='off';applyTheme();updBuddy();persist();toast('設定儲存咗');});
$('#bk-export').addEventListener('click',async()=>{
  const data=JSON.stringify(S,null,2);const name='dicky-心晴手帳-備份-'+keyOf(new Date())+'.json';
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast('已開始下載 JSON 備份');
});
let pendingImport=null;
$('#bk-file').addEventListener('change',e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 if(f.size>10*1024*1024){toast('備份超過 10 MB，請先檢查檔案。');return;}
 const r=new FileReader();r.onerror=()=>toast('讀唔到備份，原有資料未改動。');r.onload=()=>{try{
  const d=JSON.parse(r.result);window.JournalCore.validateBackup(d,DECK.map(c=>c.id));pendingImport=normalize(d);
  $('#import-summary').textContent='備份包含 '+Object.keys(d.checkins).length+' 日打卡、'+Object.keys(d.draws||{}).length+' 晚抽卡'+(d.pet?'，以及寵物「'+d.pet.name+'」。':'。');
  $('#import-dialog').showModal();
 }catch(err){pendingImport=null;toast('備份未匯入：'+(err.message||'格式不正確'));}};r.readAsText(f);
});
$('#import-cancel').addEventListener('click',()=>{pendingImport=null;$('#import-dialog').close();});
$('#import-dialog').addEventListener('cancel',()=>{pendingImport=null;});
$('#import-confirm').addEventListener('click',()=>{
 if(!pendingImport)return;
 if(flushing||cloudInitPending){toast('等同步完成再還原，避免資料交叉。');return;}
 try{localStorage.setItem(LS+'-before-import',JSON.stringify(S));}catch(e){toast('未能保留安全副本，原有資料未改動。');return;}
 const periods=window.JournalCore.backupPeriods(S,pendingImport);
 stopGame();cancelTrip();stopHaven();clearOwnerDrafts();S=pendingImport;pendingImport=null;memory=null;
 periods.years.forEach(y=>dirty.years.add(y));periods.months.forEach(m=>dirty.months.add(m));
 persist();$('#import-dialog').close();render();go(PAGES.includes(location.hash.slice(1))?location.hash.slice(1):'island');toast(storageOK?'已還原備份，原資料有安全副本。':'本機儲存未成功，請先匯出備份。');
});
let clearArmed=false;
$('#bk-clear').addEventListener('click',async()=>{
  if(!clearArmed){clearArmed=true;$('#bk-clear').textContent='再撳一次確認清除（冇得還原）';setTimeout(()=>{clearArmed=false;$('#bk-clear').textContent='清除所有資料';},5000);return;}
  clearArmed=false;$('#bk-clear').textContent='清除所有資料';
  const periods=window.JournalCore.backupPeriods(S,{});
  stopGame();cancelTrip();stopHaven();clearOwnerDrafts();memory=null;S=defaults();
  periods.years.forEach(y=>dirty.years.add(y));periods.months.forEach(m=>dirty.months.add(m));
  persist();render();go('island');toast('清除咗');
});

/* ---------- Heartland world, garden and quiet arcade ---------- */
const JC=window.JournalCore;
const DESTINATIONS={
 home:{name:'暖暖屋',icon:'⌂',text:'探吓你嘅伙伴、佈置屋企，或者一齊去散步。',button:'入屋坐吓',page:'pet',x:28,y:40},
 library:{name:'觀星書屋',icon:'✦',text:'留低今晚嘅故事，遇見一張屬於今日嘅牌。',button:'推門入去',page:'draw',x:72,y:42},
 garden:{name:'成長花園',icon:'❀',text:'每一日嘅記錄都會留低，花園跟住你慢慢長大。',button:'去花園',page:null,x:28,y:70},
 lake:{name:'靜靜湖畔',icon:'≈',text:'望吓湖水，陪自己停一停。乜都唔做都可以。',button:'去坐一陣',page:'haven',x:75,y:74},
 plaza:{name:'小遊戲廣場',icon:'◇',text:'帶伙伴去星光尋路、推箱解謎，或者慢慢玩配對。',button:'去玩遊戲',page:'arcade',x:50,y:59}
};
let destination='home',worldTime='auto',memory=null,memoryTimer=null,memoryOwner=null;
function companionArt(expr='happy'){return S.pet?PET.svg(petO(expr)) : PET.svg({sp:'cloud',color:'milktea',stage:1,expr});}
function worldHour(){return worldTime==='night'?22:worldTime==='day'?13:new Date().getHours();}
function renderWorldTime(){const hour=worldHour();const night=hour>=19||hour<6;$('#island-world').dataset.time=night?'night':'day';$('#island-world .world-art').src='assets/island-'+(night?'night':'day')+'.webp';$$('[data-world-time]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.worldTime===worldTime)));$('#island-season').textContent=(hour>=19||hour<6?'月光小島':'日光小島')+' · 隨時歡迎你';}
function chooseDestination(k){if(!DESTINATIONS[k])return;destination=k;const d=DESTINATIONS[k];$$('[data-destination]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.destination===k)));$('#world-companion').style.left=d.x+'%';$('#world-companion').style.top=d.y+'%';$('#island-destination').innerHTML='<div class="destination-icon" aria-hidden="true">'+d.icon+'</div><div><h2>'+d.name+'</h2><p>'+d.text+'</p></div><button class="btn" id="destination-enter">'+d.button+' →</button>';}
function gardenSVG(level,decor,watered){
 const flowers=(count)=>Array.from({length:count},(_,i)=>{const x=58+(i*47)%380,y=167+(i*23)%62,c=['#dd9b96','#dab858','#9eafce','#9bb679'][i%4];return '<g transform="translate('+x+' '+y+')"><path d="M0 7Q-5 -8 0 -24" stroke="#52795a" stroke-width="2" fill="none"/><ellipse cx="-5" cy="-5" rx="7" ry="3" fill="#759563" transform="rotate(30)"/><g fill="'+c+'"><circle cy="-26" r="7"/><circle cx="-6" cy="-19" r="7"/><circle cx="6" cy="-19" r="7"/></g><circle cy="-20" r="4" fill="#fff0b0"/></g>';}).join('');
 const tree=(x,y,r)=>'<g><path d="M'+x+' '+y+'v-50" stroke="#977959" stroke-width="9" stroke-linecap="round"/><circle cx="'+x+'" cy="'+(y-67)+'" r="'+r+'" fill="#70926a"/><circle cx="'+(x-18)+'" cy="'+(y-51)+'" r="'+(r*.7)+'" fill="#819f74"/><circle cx="'+(x+17)+'" cy="'+(y-53)+'" r="'+(r*.7)+'" fill="#567d61"/></g>';
 return '<svg viewBox="0 0 500 280" role="img" aria-label="'+['剛播種的小花園','小徑旁開始長出葉子','花朵逐漸盛開','溫室亮起暖燈','繁花盛開的小島花園'][level]+'"><defs><linearGradient id="garden-sky" x2="0" y2="1"><stop stop-color="#d7e6db"/><stop offset="1" stop-color="#fcf3d6"/></linearGradient></defs><rect width="500" height="280" fill="url(#garden-sky)"/><circle cx="415" cy="53" r="25" fill="#fff4c6"/><path d="M0 145Q110 83 235 143T500 125V280H0" fill="#c2d2a8"/><path d="M0 185Q130 124 260 184T500 166V280H0" fill="#a8bf90"/><ellipse cx="255" cy="240" rx="204" ry="31" fill="#97b083"/><path d="M265 280Q210 240 270 210T265 139" stroke="#e9ddbd" stroke-width="27" fill="none"/>'+tree(75,173,30)+(level>=1?tree(430,174,35):'')+'<g fill="#b58860" stroke="#9f7857" stroke-width="2"><path d="M134 204l65 -17 39 17 -65 20z"/><path d="M134 204v14l39 20v-14M173 238l65 -20v-14"/></g><g fill="#6c8350">'+[0,1,2].map(i=>'<path d="M'+(166+i*19)+' '+(205-i*3)+'q-13 -22 -20 -12q10 13 20 12q1 -21 12 -17q4 14 -12 17"/>').join('')+'</g>'+(level>=2?'<g fill="#e9ead8" stroke="#729787" stroke-width="3"><path d="M315 170V105l44 -31 44 31v65z"/><path d="M315 105h88M359 74v96M337 90v80M381 90v80" fill="none"/><path d="M349 170v-39h20v39" fill="#f5d99d"/></g>':'')+flowers(level*5+(decor==='flowers'?7:1))+(decor==='lantern'?'<path d="M302 208v-55q0 -12 13 -12" stroke="#7d7959" stroke-width="3" fill="none"/><rect x="308" y="139" width="14" height="22" rx="4" fill="#ffe4a2" stroke="#b1995d"/><circle cx="315" cy="150" r="24" fill="#ffe9ad" opacity=".22"/>':'')+(decor==='stars'?'<g fill="#fff6be"><path d="M100 39l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM215 69l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM355 35l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>':'')+(watered?'<g fill="#649fa2" opacity=".8"><path d="M150 164q-9 13 0 13t0 -13M180 155q-9 13 0 13t0 -13M210 163q-9 13 0 13t0 -13"/></g>':'')+'</svg>';
}
function renderGarden(){const p=JC.progress(S),j=S.journey,k=defaultDay(),watered=!!j.watered[k];$('#garden-stage').textContent=p.name;$('#garden-title').textContent=p.days+' 日照顧自己嘅足跡';$('#garden-description').textContent='打卡、日記、習慣同你寫低嘅小成就，每日都可以幫花園長大。休息幾日，花園都會保留。';$('#garden-progress-text').textContent=p.next?'再記錄 '+p.remaining+' 日，就會到「'+p.next+'」。':'花園已經盛開，之後嘅每一日仍會繼續記低。';$('#garden-progress').value=p.percent;$('#garden-progress').setAttribute('aria-label','下一個花園階段進度');$('#garden-art').innerHTML=gardenSVG(p.level,j.decor,watered);$('#garden-water').disabled=watered;$('#garden-water').textContent=watered?'今日淋過喇 ✓':'淋一淋花';$('#garden-water-note').textContent=watered?'花園收到你嘅心意，今日隨時可以休息。':'淋花係小小儀式；花園成長按你留下記錄嘅日子計。';$$('[data-decor]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.decor===j.decor)));}
function renderIsland(){
 const p=JC.progress(S),k=defaultDay(),cnt=drawCounts(),owned=Object.keys(cnt).length;
 $('#quiet-toggle').setAttribute('aria-pressed',String(!!S.settings.quiet));$('#quiet-toggle').textContent=S.settings.quiet?'減少動態：開':'減少動態';
 $('#world-companion').innerHTML=companionArt();renderWorldTime();chooseDestination(destination);
 $('#island-pet-link').textContent=S.pet?'探吓'+S.pet.name:'領養小伙伴';
 $('#island-passport').innerHTML='<span class="section-kicker">ISLAND PASSPORT</span><div class="passport-top"><div class="passport-avatar">'+companionArt()+'</div><div><h2>'+esc(S.pet?S.pet.name+'陪住你':'你嘅小小世界')+'</h2><p>'+p.name+'</p></div></div><div class="passport-stats"><div><b>'+p.days+'</b><span>記錄日子</span></div><div><b>'+owned+'</b><span>遇見牌卡</span></div><div><b>'+(S.pet?S.pet.coins:0)+'</b><span>寵物金幣</span></div></div>';
 $('#island-date').textContent=md(k)+' · 夜班跟開工日';$('#island-tasks').innerHTML=JC.tasks(S,k).map(t=>'<button class="quest '+(t.done?'done':'')+'" data-goto="'+t.page+'"><span class="quest-check" aria-hidden="true">'+(t.done?'✓':'○')+'</span><span><b>'+t.name+(t.done?' · 已留低':'')+'</b><small>'+t.detail+'</small></span><span class="quest-arrow">↗</span></button>').join('');
 const recent=Object.values(S.draws||{}).sort((a,b)=>b.date.localeCompare(a.date))[0];
 $('#island-souvenir').innerHTML=recent&&card(recent.card)?'<span class="section-kicker">A MEMORY TO KEEP</span><div class="souvenir-preview">'+cardFace(card(recent.card),false,1)+'</div><h2>最近遇見：'+esc(card(recent.card).name)+'</h2><p>每一張牌，都收住一晚嘅故事。</p><button class="linkbtn" data-goto="draw">返書屋睇返 →</button>':'<span class="section-kicker">A MEMORY TO KEEP</span><h2>第一個故事，等緊你。</h2><p>寫低一句今晚想講嘅說話，書屋就會多一張牌。</p><button class="linkbtn" data-goto="draw">去書屋 →</button>';
 renderGarden();renderPostcards();const earned=MILES.filter(m=>S.miles[m.id]);$('#achievement-count').textContent=earned.length+' / '+MILES.length;$('#island-achievements').innerHTML=MILES.map((m,i)=>'<div class="achievement '+(S.miles[m.id]?'earned':'')+'"><span class="achievement-medal" aria-hidden="true">'+(S.miles[m.id]?'✹':'◇')+'</span><div><b>'+esc(m.t)+'</b><small>'+(S.miles[m.id]?'已留低 · '+md(S.miles[m.id]):'慢慢嚟，隨時開始')+'</small></div></div>').join('');
}
const MEMORY_PALS=[['cat','milktea','奶茶貓'],['dog','mint','薄荷柴'],['cloud','sakura','櫻花雲'],['cat','night','夜空貓'],['dog','snow','雪白柴'],['cloud','milktea','奶茶雲']];
function renderMemory(){if(!memory||memoryOwner!==S.journey){clearTimeout(memoryTimer);memoryOwner=S.journey;memory=JC.createMemory();$('#memory-status').textContent='準備好，就揀一張。';}$('#memory-moves').textContent=memory.moves+' 次翻牌 · '+memory.matched.length/2+'/6 對';$('#memory-grid').innerHTML=memory.cards.map((v,i)=>{const open=memory.open.includes(i),matched=memory.matched.includes(i),pal=MEMORY_PALS[v];return '<button class="memory-tile '+(open?'open ':'')+(matched?'matched':'')+'" data-memory="'+i+'" aria-label="第 '+(i+1)+' 張，'+(open||matched?pal[2]+(matched?'，已配對':''):'未揭開')+'" aria-disabled="'+(matched||open||memory.busy)+'">'+(open||matched?PET.svg({sp:pal[0],color:pal[1],stage:1,expr:matched?'love':'happy'})+'<small>'+pal[2]+'</small>':'<span aria-hidden="true">✦</span>')+'</button>';}).join('');$('#memory-buddy').innerHTML=companionArt('happy');const played=Number(S.journey.games[defaultDay()])||0;$('#memory-reward').textContent=(S.pet?'每日頭兩局完成各有 5 金幣。今日已玩 '+played+' 局。':'可以隨時玩。領養伙伴後，每日頭兩局完成各有 5 金幣。')+(S.journey.best?' 最少翻牌紀錄：'+S.journey.best+' 次。':'');}
function resetMemory(){clearTimeout(memoryTimer);memoryOwner=S.journey;memory=JC.createMemory();$('#memory-status').textContent='準備好，就揀一張。';renderMemory();}
function memoryFlip(i){if(memoryOwner!==S.journey){renderMemory();return;}const outcome=JC.flipMemory(memory,i);if(outcome==='ignored')return;if(outcome==='miss'){const current=memory;$('#memory-status').textContent='記低佢哋嘅位置，再試一對。';memoryTimer=setTimeout(()=>{if(memory!==current)return;JC.closeMemory(memory);renderMemory();},1100);}else if(outcome==='match')$('#memory-status').textContent='搵到一對喇！';else if(outcome==='complete'){const gain=JC.gameReward(S.journey,defaultDay());S.journey.best=Math.min(S.journey.best||Infinity,memory.moves);if(S.pet&&gain){S.pet.coins+=gain;need('fun',10);}persist();$('#memory-status').textContent='六對都搵到喇！'+(S.pet&&gain?' 金幣 +'+gain+'。':'')+' 想休息就返小島坐吓。';}renderMemory();const next=$('[data-memory="'+i+'"]');if(next)next.focus();}
function renderHaven(){const h=worldHour();$('#haven-scene').innerHTML='<img class="haven-art" src="assets/lakeside.webp" width="1536" height="1024" alt="金色陽光下的湖畔碼頭、木椅與遠山">'+'<div class="haven-pet">'+companionArt('normal')+'</div>';$('#haven-copy').textContent='湖水慢慢流。你可以喺呢度坐一陣，唔使完成任何事。';}
let havenTimer=null,havenEnd=0;
function stopHaven(){clearInterval(havenTimer);havenTimer=null;const b=$('#haven-rest');if(b)b.textContent='陪我坐一分鐘';}
function startHaven(){if(havenTimer){stopHaven();$('#haven-copy').textContent='想走就走，湖畔隨時都喺度。';return;}havenEnd=Date.now()+60000;$('#haven-rest').textContent='隨時結束';const tick=()=>{const left=Math.max(0,Math.ceil((havenEnd-Date.now())/1000));$('#haven-copy').textContent=left>0?'仲有 '+left+' 秒。望吓遠處，照平時咁呼吸就得。':'一分鐘過咗。多謝你留咗一點時間俾自己。';if(left===0)stopHaven();};tick();havenTimer=setInterval(tick,1000);}
document.addEventListener('click',e=>{
 const d=e.target.closest('[data-destination]');if(d)chooseDestination(d.dataset.destination);
 const t=e.target.closest('[data-world-time]');if(t){worldTime=t.dataset.worldTime;renderWorldTime();}
 if(e.target.closest('#destination-enter')){const x=DESTINATIONS[destination];discoverPlace(destination);if(x.page)go(x.page);else $('#garden-section').scrollIntoView({behavior:RM()?'auto':'smooth',block:'center'});}
 if(e.target.closest('#quiet-toggle')){S.settings.quiet=!S.settings.quiet;applyTheme();persist();renderIsland();}
 const decor=e.target.closest('[data-decor]');if(decor){S.journey.decor=decor.dataset.decor;persist();renderGarden();}
 if(e.target.closest('#garden-water')){const k=defaultDay();if(S.journey.watered[k])return;S.journey.watered[k]=true;persist();renderGarden();toast('花園收到你嘅心意 🌱');}
 const m=e.target.closest('[data-memory]');if(m)memoryFlip(Number(m.dataset.memory));
 if(e.target.closest('#memory-restart'))resetMemory();
 if(e.target.closest('#arcade-walk')){segSet('pettab','out');go('pet');}
 if(e.target.closest('#haven-rest'))startHaven();
});
window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(PAGES.includes(p))go(p);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopGame();roamStop();stopHaven();}else if($('#page-pet').classList.contains('on')&&segGet('pettab')==='home'&&S.pet)roamArm();});

const POSTCARDS={home:['有燈嘅地方','返到屋企，先放低今日。'],library:['替故事留個位','每一晚，都有一頁值得留低。'],garden:['慢慢長大','泥土記得落過嘅雨，花園記得你行過嘅路。'],lake:['湖邊一分鐘','坐低一陣，湖水會繼續慢慢流。'],plaza:['一點遊戲時間','玩得開心，已經係一個好理由。']};
function discoverPlace(id){if(S.journey.discovered[id])return;S.journey.discovered[id]=defaultDay();if(S.pet)S.pet.coins+=3;persist();renderPostcards();toast('發現「'+POSTCARDS[id][0]+'」明信片'+(S.pet?' · 金幣 +3':''));}
function renderPostcards(){const d=S.journey.discovered;$('#postcard-count').textContent=Object.keys(POSTCARDS).filter(k=>d[k]).length+' / 5';$('#island-postcards').innerHTML=Object.entries(POSTCARDS).map(([k,v])=>'<button class="postcard '+(d[k]?'collected':'')+'" data-postcard="'+k+'" aria-label="'+(d[k]?v[0]:'未發現：'+DESTINATIONS[k].name)+'"><span class="postcard-art postcard-'+k+'">'+(!d[k]?'<i>◇</i>':'')+'</span><b>'+(d[k]?v[0]:DESTINATIONS[k].name)+'</b><small>'+(d[k]?'已收藏 · '+md(d[k]):'去探一探就會遇見')+'</small></button>').join('');}
document.addEventListener('click',e=>{const b=e.target.closest('[data-postcard]');if(!b)return;const k=b.dataset.postcard;if(!S.journey.discovered[k]){chooseDestination(k);$('#island-world').scrollIntoView({behavior:RM()?'auto':'smooth',block:'center'});return;}$('#postcard-title').textContent=POSTCARDS[k][0];$('#postcard-message').textContent=POSTCARDS[k][1];$('#postcard-picture').className='postcard-picture postcard-'+k;$('#postcard-dialog').showModal();});
$('#postcard-close').addEventListener('click',()=>$('#postcard-dialog').close());

/* Unsaved writing stays on this browser, partitioned by the last signed-in owner. */
function draftKey(kind,k){let owner='local';try{owner=localStorage.getItem(CLOUD_UID_KEY)||'local';}catch(e){}return LS+'-draft-'+owner+'-'+kind+'-'+k;}
function clearOwnerDrafts(){try{const prefix=draftKey('','').slice(0,-1);for(const k of Object.keys(localStorage))if(k.startsWith(prefix))localStorage.removeItem(k);}catch(e){}}
function readDraft(kind,k){try{return JSON.parse(localStorage.getItem(draftKey(kind,k))||'null');}catch(e){return null;}}
function writeDraft(kind,k,value){try{localStorage.setItem(draftKey(kind,k),JSON.stringify(value));}catch(e){$('#storage-warning').hidden=false;}}
function removeDraft(kind,k){try{localStorage.removeItem(draftKey(kind,k));}catch(e){}}
function restoreCheckinDraft(k){const d=readDraft('checkin',k);if(!d||!d.fields)return;for(const [id,v] of Object.entries(d.fields)){const el=document.getElementById(id);if(el)el.value=v;}for(const [name,v] of Object.entries(d.segments||{}))segSet(name,v);sliders.forEach(([i,v])=>$(v).textContent=$(i).value);updateSleepCalc();$('#ci-status').textContent='已恢復未儲存草稿，完成後撳「記低」。';}
function saveCheckinDraft(){const k=$('#ci-date').value||defaultDay(),fields={},segments={};['ci-mood','ci-anx','ci-energy','ci-sleep-start','ci-sleep-end','ci-mastery','ci-pleasure','ci-next'].forEach(id=>fields[id]=document.getElementById(id).value);['work','seg','contact','move'].forEach(name=>segments[name]=segGet(name));writeDraft('checkin',k,{fields,segments});}
$('#page-today').addEventListener('input',e=>{if(e.target.id!=='ci-date')saveCheckinDraft();});
$('#page-today').addEventListener('click',e=>{if(e.target.closest('.seg'))setTimeout(saveCheckinDraft,0);});
$('#dr-text').addEventListener('input',()=>writeDraft('draw',defaultDay(),{text:$('#dr-text').value}));
$('#bk-previous').addEventListener('click',()=>{let raw;try{raw=localStorage.getItem(LS+'-before-import');}catch(e){}if(!raw){toast('未有匯入前嘅安全副本。');return;}const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='dicky-care-before-import.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);});

$('#bk-recovery').addEventListener('click',()=>{let raw;try{raw=localStorage.getItem(LS+'-unreadable-backup')||(unreadableLocal?localStorage.getItem(LS):null);}catch(e){}if(!raw){toast('未有需要救回嘅原始資料。');return;}const u=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='dicky-care-original-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);});

/* ---------- Starlight Trail: persistent, turn-based puzzle adventure ---------- */
const AD=window.IslandAdventure;
let adventureRun=null,adventureOwner=null,adventureHistory=[],adventureFacing='right';
function getCampaign(){return S.journey.adventure||(S.journey.adventure=AD.campaign());}
function trailSprite(kind){
 const art={
 tree:'<ellipse cx="30" cy="53" rx="22" ry="5" fill="#294c3b" opacity=".18"/><path d="M28 50V30h5v20" fill="#997753"/><path d="M30 4L10 31h8L5 44q25 12 50 0L42 31h8z" fill="#668b63"/><path d="M30 4L10 31h8L5 44q13 6 25 6z" fill="#83a275"/><path d="M30 4l-5 12h11z" fill="#a3b990"/>',
 bush:'<ellipse cx="30" cy="52" rx="23" ry="5" fill="#365a40" opacity=".15"/><path d="M8 43q-8-23 14-23q8-19 24-4q18 0 12 22q-6 18-28 16z" fill="#7a9b69"/><circle cx="22" cy="29" r="14" fill="#99b17d"/><circle cx="43" cy="37" r="13" fill="#68875e"/><circle cx="16" cy="41" r="2" fill="#ead58a"/><circle cx="43" cy="31" r="2" fill="#e3b3a0"/>',
 star:'<ellipse cx="30" cy="48" rx="12" ry="4" fill="#987b35" opacity=".17"/><path d="M30 8l6 14 15 2-12 10 4 15-13-8-13 8 4-15-12-10 15-2z" fill="#f4ce6e" stroke="#fff1b8" stroke-width="2"/><path d="M30 13l5 12 11 1-16 7z" fill="#fff3c5"/>',
 crate:'<ellipse cx="30" cy="52" rx="23" ry="4" fill="#6c5233" opacity=".2"/><path d="M8 14l35-5 10 8v32l-36 6-9-8z" fill="#a57545"/><path d="M8 14l35-5 10 8-36 5z" fill="#d4b17b"/><path d="M17 22l36-5v32l-36 6z" fill="#c99a60" stroke="#966d41" stroke-width="2"/><path d="M22 25l26 20M47 23L23 49" stroke="#e8c78f" stroke-width="5"/><path d="M11 19v25" stroke="#bc935d" stroke-width="3"/>',
 key:'<ellipse cx="30" cy="48" rx="13" ry="4" fill="#988249" opacity=".16"/><g fill="none" stroke="#e7b94c" stroke-width="6" stroke-linecap="round"><circle cx="24" cy="21" r="9"/><path d="M30 28l16 16M39 37l5-5M44 42l5-5"/></g><path d="M19 17q4-4 7-1" stroke="#fff4c3" stroke-width="3" fill="none"/>',
 door:'<path d="M8 51V17q22-20 44 0v34" stroke="#a67c4e" stroke-width="7" fill="#bd925b"/><path d="M17 17v32M29 12v37M41 17v32" stroke="#e2bc7f" stroke-width="4"/><rect x="5" y="27" width="50" height="8" rx="3" fill="#8e6b48"/><circle cx="31" cy="31" r="5" fill="#f5d57e"/>',
 gate:'<path d="M8 52V13M52 52V13M8 17h44" stroke="#7c8b59" stroke-width="7" stroke-linecap="round"/><path d="M11 14q44 0 34 16T13 49M50 15q-45 9-33 26" stroke="#6a995e" stroke-width="4" fill="none"/><g fill="#a0bc78"><ellipse cx="18" cy="23" rx="8" ry="4" transform="rotate(-25 18 23)"/><ellipse cx="41" cy="32" rx="8" ry="4" transform="rotate(25 41 32)"/><ellipse cx="22" cy="43" rx="8" ry="4"/></g>',
 plate:'<ellipse cx="30" cy="39" rx="21" ry="12" fill="#a7ad8f" stroke="#7b866d" stroke-width="3"/><ellipse cx="30" cy="37" rx="11" ry="6" fill="#dce3bb"/><circle cx="30" cy="37" r="3" fill="#718b61"/>',
 exit:'<ellipse cx="30" cy="48" rx="25" ry="9" fill="#a0baa0"/><path d="M12 46V24q0-26 18-26t18 26v22" fill="#b8d4be" stroke="#749986" stroke-width="5"/><path d="M20 43V23q0-16 10-16t10 16v20" fill="#f5edb8"/><path d="M30 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fffde1"/>',
 open:'<path d="M9 50V16M51 50V16" stroke="#95ad80" stroke-width="5" stroke-linecap="round"/><path d="M20 33l7 6 14-15" stroke="#5a936b" stroke-width="4" stroke-linecap="round" fill="none"/>'
 };
 return '<svg viewBox="0 0 60 60" focusable="false" aria-hidden="true">'+(art[kind]||'')+'</svg>';
}
function trailPosition(i,b){return 'left:'+(i%b.width)*100/b.width+'%;top:'+Math.floor(i/b.width)*100/b.height+'%;width:'+100/b.width+'%;height:'+100/b.height+'%';}
function renderAdventure(){
 const c=getCampaign();if(adventureOwner!==c){adventureOwner=c;adventureRun=c.run||AD.create(c.unlocked-1);adventureHistory=[];}
 const s=adventureRun,b=AD.board(s.level),level=AD.LEVELS[s.level],open=AD.platesOpen(b,s);
 $('#adventure-chapter').textContent='CHAPTER '+String(s.level+1).padStart(2,'0')+' / 04';$('#adventure-title').textContent=level.name;
 $('#adventure-hint').textContent=level.hint;$('#adventure-stars').textContent='✦ '+s.collected.length+' / '+b.stars.length;$('#adventure-moves').textContent=s.moves+' 步';$('#adventure-key').textContent=b.key<0?'':s.key?'鎖匙 ✓':'鎖匙 ○';
 $('#adventure-land').dataset.chapter=String(s.level);$('#adventure-board').setAttribute('aria-label',level.name+'。位置第 '+(Math.floor(s.player/b.width)+1)+' 行、第 '+(s.player%b.width+1)+' 列。已收集 '+s.collected.length+' 點星光。');
 $('#adventure-tiles').innerHTML=b.tiles.map((t,i)=>'<div class="trail-tile '+(t==='#'?'trail-wood':'trail-path')+'" style="'+trailPosition(i,b)+'">'+(t==='#'?trailSprite(i%3===0?'tree':'bush'):'')+'</div>').join('');
 $('#adventure-objects').innerHTML=b.tiles.map((t,i)=>{let kind=t==='E'?'exit':t==='O'?'plate':t==='D'?(s.key?'open':'door'):t==='G'?(open?'open':'gate'):t==='K'&&!s.key?'key':t==='*'&&!s.collected.includes(i)?'star':null;return kind?'<div class="trail-object trail-'+kind+'" style="'+trailPosition(i,b)+'">'+trailSprite(kind)+'</div>':'';}).join('')+s.crates.map(i=>'<div class="trail-object trail-crate" style="'+trailPosition(i,b)+'">'+trailSprite('crate')+'</div>').join('');
 const player=$('#adventure-player');player.style.cssText=trailPosition(s.player,b);player.dataset.facing=adventureFacing;player.innerHTML=companionArt(s.won?'love':'happy');
 $('#adventure-undo').disabled=!adventureHistory.length||s.won;$$('[data-step]').forEach(x=>x.disabled=s.won);
 $('#adventure-win').hidden=!s.won;$('#adventure-next').textContent=s.level<AD.LEVELS.length-1?'下一個故事 →':'返小島收好回憶';
 $('#adventure-completed').textContent=Object.keys(c.best).length+' / 4';$('#adventure-levels').innerHTML=AD.LEVELS.map((l,i)=>'<button data-level="'+i+'" '+(i>=c.unlocked?'disabled':'')+' aria-pressed="'+(s.level===i)+'"><span class="trail-level-number">'+(i>=c.unlocked?'◇':String(i+1).padStart(2,'0'))+'</span><span><b>'+l.name+'</b><small>'+(c.best[i]?'個人最佳 '+c.best[i]+' 步':i<c.unlocked?'可以出發':'完成上一關後開放')+'</small></span><i>'+(c.best[i]?'✓':'→')+'</i></button>').join('');
 if(!$('#adventure-message').textContent)$('#adventure-message').textContent='方向鍵準備好。收集星光，陪伙伴行去出口。';
}
function startAdventure(level){const c=getCampaign();if(!Number.isInteger(level)||level<0||level>=c.unlocked)return;adventureOwner=c;adventureRun=AD.create(level);adventureHistory=[];c.run=adventureRun;$('#adventure-message').textContent=AD.LEVELS[level].hint;persist();renderAdventure();$('#adventure-board').focus({preventScroll:true});}
function moveAdventure(direction){
 if(!$('#page-adventure').classList.contains('on'))return;
 // A cloud refresh/account change can replace the campaign while this page is open.
 if(adventureOwner!==getCampaign())renderAdventure();
 const previous=adventureRun,result=AD.step(previous,direction);if(result.event==='ignored')return;
 const messages={wall:'前面係樹叢，試吓另一邊。',locked:'木門鎖住喇，先搵金鎖匙。',plate:'藤門未開，將木箱推到圓形機關上。','crate-blocked':'木箱前面冇位。可以撤銷一步，試另一個方向。',push:'木箱推開咗。',key:'搵到金鎖匙！木門開咗。',star:'收好一點星光。','need-stars':'出口喺度！仲有星光未搵齊。'};
 if(result.state!==previous){adventureHistory.push(previous);if(adventureHistory.length>150)adventureHistory.shift();adventureRun=result.state;if(direction==='left'||direction==='right')adventureFacing=direction;getCampaign().run=adventureRun;
  if(result.event==='win'){const gain=AD.finish(getCampaign(),adventureRun);if(S.pet&&gain){S.pet.coins+=gain;need('fun',12);}adventureHistory=[];$('#adventure-win-title').textContent=safeTrailName(adventureRun.level);$('#adventure-win-copy').textContent='三點星光都帶返嚟喇 · '+adventureRun.moves+' 步完成。'+(S.pet&&gain?' 伙伴金幣 +'+gain+'。':'今次嘅足跡已經留低。');}
  persist();
 }
 const b=AD.board(adventureRun.level);$('#adventure-message').textContent=(result.event==='win'?'旅程完成。':messages[result.event]||'繼續慢慢行。')+' 第 '+(Math.floor(adventureRun.player/b.width)+1)+' 行、第 '+(adventureRun.player%b.width+1)+' 列 · '+adventureRun.collected.length+'/3 星光。';renderAdventure();
}
function safeTrailName(level){return level===AD.LEVELS.length-1?'四段旅程，都行過喇。':'呢一段路，完成喇。';}
function undoAdventure(){if(adventureOwner!==getCampaign())renderAdventure();if(!adventureHistory.length||adventureRun.won)return;adventureRun=adventureHistory.pop();getCampaign().run=adventureRun;persist();$('#adventure-message').textContent='退返一步，可以再試另一條路。';renderAdventure();}
document.addEventListener('click',e=>{const step=e.target.closest('[data-step]');if(step)moveAdventure(step.dataset.step);const level=e.target.closest('[data-level]');if(level)startAdventure(Number(level.dataset.level));if(e.target.closest('#adventure-undo'))undoAdventure();if(e.target.closest('#adventure-reset')||e.target.closest('#adventure-replay'))startAdventure(adventureRun.level);if(e.target.closest('#adventure-next')){if(adventureRun.level<AD.LEVELS.length-1)startAdventure(adventureRun.level+1);else go('island');}});
document.addEventListener('keydown',e=>{if(!$('#page-adventure').classList.contains('on')||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select,[contenteditable="true"],dialog'))return;const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',a:'left',s:'down',d:'right'}[e.key];if(direction){e.preventDefault();moveAdventure(direction);}else if(e.key==='z'||e.key==='Z'){e.preventDefault();undoAdventure();}});

/* ---------- render ---------- */
function render(){
  applyTheme();
  renderIsland();
  const now=new Date();
  $('#today-eyebrow').textContent=(now.getMonth()+1)+' 月 '+now.getDate()+' 日・星期'+WD[now.getDay()];
  showDaily(Math.floor(parseKey(keyOf(now)).getTime()/864e5));
  loadForm(defaultDay());renderPHQForm();renderPlan();renderSettings();renderEvidence();renderLadders();renderRes();renderReview();renderBadge();renderWisdom();renderPlanFavs();showDrawTab();renderHabits();
  if($('#page-pet').classList.contains('on'))renderPet();
  if($('#page-arcade').classList.contains('on'))renderMemory();
  if($('#page-adventure').classList.contains('on'))renderAdventure();
  if($('#page-haven').classList.contains('on'))renderHaven();
}
render();
const h=(location.hash||'').slice(1);
go(PAGES.includes(h)?h:'island');
connect();
if(unreadableLocal){$('#storage-warning').hidden=false;toast('舊資料未能讀取，原檔仍然保留。');}
milesSoon();
})();
