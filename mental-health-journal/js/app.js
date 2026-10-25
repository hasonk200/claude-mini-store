import { ART } from './art/cards.mjs';
import { PET } from './art/pet.mjs';
import { DECK, card } from './data/cards.mjs';

(function () {
  const LS = 'dicky-care-v1';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (k, n) => {
    const d = parseKey(k);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  };
  const uid = () => Math.random().toString(36).slice(2, 10);
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const md = (k) => {
    if (!k) return '';
    const d = parseKey(k);
    return d.getMonth() + 1 + '/' + d.getDate();
  };

  function defaults() {
    const today = keyOf(new Date());
    return {
      checkins: {},
      evidence: [
        {
          id: uid(),
          date: today,
          type: '頂住咗唔舒服',
          text: '失業嗰段日子撐咗落嚟，最後自己搵返工作',
          seed: true,
        },
        {
          id: uid(),
          date: today,
          type: '頂住咗唔舒服',
          text: '一個人喺異鄉夜班送單，遇過被騙單、無理客人、架車壞，都繼續做落去',
          seed: true,
        },
        {
          id: uid(),
          date: today,
          type: '做到',
          text: '跑步維持到每 2 至 3 日跑 5.5 公里',
          seed: true,
        },
        {
          id: uid(),
          date: today,
          type: '做到',
          text: '自己煮泰式青咖喱、白汁魚柳意粉，冇材料都識執生',
          seed: true,
        },
        {
          id: uid(),
          date: today,
          type: '學識咗',
          text: '整咗自己嘅外送日報同排班 app，一步步改到啱用',
          seed: true,
        },
        {
          id: uid(),
          date: today,
          type: '做到',
          text: '肯面對自己嘅情緒，寫咗一份十部分嘅自我整理',
          seed: true,
        },
      ],
      ladders: [
        {
          id: uid(),
          name: '同人接觸',
          steps: [
            { id: uid(), text: '交單時同店員或者客人講多一句，例如「辛苦晒」', fear: 2, log: [] },
            { id: uid(), text: '喺圖書館或者 café 坐 30 分鐘，唔使同人傾', fear: 2, log: [] },
            { id: uid(), text: '去 run club 跑一次，跑完就走都得', fear: 4, log: [] },
            { id: uid(), text: '喺 run club 問一個人：「你跑咗幾耐？」', fear: 5, log: [] },
            { id: uid(), text: '報一堂有導師帶嘅初學班（舞蹈或者煮食都得）', fear: 6, log: [] },
            { id: uid(), text: '約一個認識咗嘅人飲杯嘢', fear: 7, log: [] },
          ],
        },
        {
          id: uid(),
          name: '學嘢唔再停喺初階',
          steps: [
            { id: uid(), text: '揀一樣想學嘅嘢，寫低「學識之後會點」', fear: 1, log: [] },
            { id: uid(), text: '搵一個有人帶嘅初學班或者教學資源', fear: 3, log: [] },
            { id: uid(), text: '自己練 15 分鐘，記低卡喺邊', fear: 4, log: [] },
            { id: uid(), text: '帶住卡住嘅位去問人，講埋自己試過啲咩', fear: 4, log: [] },
            { id: uid(), text: '完成一件細作品，唔使完美，記入證據簿', fear: 6, log: [] },
          ],
        },
      ],
      plan: {
        warn: '瞓眠斷開三四段\n成日諗「我係 0」、同人比較\n唔想覆訊息、唔想出門\n連續幾日唔想煮嘢食',
        self: '煮一餐簡單嘅嘢（唔使靚）\n出去跑或者行 20 分鐘\n沖個熱水涼\n翻開證據簿，抽一條嚟睇\n做一次「卡住急救」第一步',
        place: '附近圖書館或者 café 坐吓\nrun club 練跑（跑完就走都得）',
        people: '（寫低名同電話，最好有兩三個）',
        safe: '低潮嗰陣唔飲酒\n將會令自己更差嘅嘢放遠啲\n太攰就早啲收工，唔好硬撐踩車',
        reason: '（例如：想學識嘅嘢、想去嘅地方、想見嘅人）',
      },
      journey: window.JournalCore.journey(),
      phq: [],
      weeks: {},
      favs: [],
      draws: {},
      pet: null,
      habits: hbDefaults(),
      miles: {},
      milesInit: 1,
      cardNotes: {},
      settings: { a: '09:00', b: '16:30', theme: 'auto', buddy: true },
      t: 0,
    };
  }
  function normalize(d) {
    const base = defaults();
    if (!d || typeof d !== 'object') return base;
    const out = Object.assign(base, d);
    out.settings = Object.assign(defaults().settings, d.settings || {});
    out.plan = Object.assign(defaults().plan, d.plan || {});
    out.checkins = d.checkins || {};
    out.favs = Array.isArray(d.favs) ? d.favs : [];
    out.draws = d.draws && typeof d.draws === 'object' ? d.draws : {};
    out.pet = d.pet && typeof d.pet === 'object' ? d.pet : null;
    out.habits = Array.isArray(d.habits) ? d.habits : hbDefaults();
    out.miles = d.miles && typeof d.miles === 'object' ? d.miles : {};
    out.milesInit = d.milesInit || (d.miles ? 1 : 0);
    out.cardNotes = d.cardNotes && typeof d.cardNotes === 'object' ? d.cardNotes : {};
    out.journey = window.JournalCore.journey(d.journey);
    out.journey.adventure = window.IslandAdventure.campaign(out.journey.adventure);
    return out;
  }

  /* UI adapters for local persistence and cloud synchronization. */
  const CLOUD_UID_KEY = window.JournalStorage.CLOUD_UID_KEY;
  let fbDb = null,
    fbUser = null,
    authBusy = false;
  let S;
  const journalStore = window.JournalStorage.createStore({
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    defaults,
    normalize,
    getDatabase: () => fbDb,
    onChange: (state) => {
      S = state;
      render();
    },
    onStatus: setSync,
    onStorage: (ok) => {
      $('#storage-warning').hidden = ok;
      renderRecoveryStatus();
    },
    onSettled: () => milesSoon(),
    onPersist: () => milesSoon(),
  });
  S = journalStore.state;
  function persist(options) {
    journalStore.persist(options);
  }
  function setSync(on, msg) {
    $('#sync').classList.toggle('on', !!on);
    $('#sync-txt').textContent = msg;
    const status = $('#google-status');
    if (status) status.textContent = msg;
    const btn = $('#google-login');
    if (btn) {
      btn.disabled = authBusy;
      btn.textContent = authBusy ? '請稍候…' : fbUser ? '登出 Google' : '使用 Google 登入';
    }
    const mail = $('#google-email');
    if (mail) mail.textContent = fbUser ? fbUser.email || '已登入' : '未登入';
  }
  function renderRecoveryStatus() {
    const status = journalStore.recoveryStatus();
    $('#recovery-warning').hidden = !status.visible;
    $('#recovery-message').textContent = status.recovering
      ? '有啲記錄暫時開唔到。可以先到設定下載備份，留返一份喺自己手上。'
      : '之前嘅記錄有另外留底，需要時可以到設定下載。';
    $('#bk-recovery').hidden = !status.original;
    $('#bk-recovery-edits').hidden = !status.edits;
  }
  function dismissRecoveryNotice() {
    const saved = journalStore.dismissRecoveryNotice();
    renderRecoveryStatus();
    toast(saved ? '提示已收起，備份仍然可以喺設定下載。' : '暫時記唔低呢個選擇，請稍後再試。');
  }
  const googleLogin = window.JournalAuth.createController({
    getFirebase: () => window.firebase,
    getConfig: () => window.FIREBASE_CONFIG,
    onDatabase: (database) => {
      fbDb = database;
    },
    onUser: (user) => {
      fbUser = user || null;
      if (user) journalStore.loadCloudFor(user);
      else {
        journalStore.disconnect();
        setSync(false, '未登入，記錄留喺呢個瀏覽器。');
      }
    },
    onBusy: (busy) => {
      authBusy = busy;
      const button = $('#google-login');
      button.disabled = busy;
      button.textContent = busy ? '請稍候…' : fbUser ? '登出 Google' : '使用 Google 登入';
    },
    onNotice: (message) => {
      setSync(false, message);
      toast(message);
    },
    onUnavailable: () => journalStore.setInitialLoadPending(false),
    onError: (code) => console.warn('Google sign-in:', code),
  });
  $('#google-login').addEventListener('click', () => googleLogin.toggle());
  window.addEventListener('online', () => {
    journalStore.reconnect(googleLogin.currentUser);
  });

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), 2000);
  }
  function applyTheme() {
    document.documentElement.classList.toggle('quiet', !!S.settings.quiet);
    const t = S.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  /* segmented controls */
  function segGet(name) {
    const b = document.querySelector('.seg[data-name="' + name + '"] button.on');
    return b ? b.dataset.v : null;
  }
  function segSet(name, v) {
    $$('.seg[data-name="' + name + '"] button').forEach((b) =>
      b.classList.toggle('on', v != null && b.dataset.v === String(v)),
    );
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-name] button');
    if (!b) return;
    const seg = b.parentElement;
    const wasOn = b.classList.contains('on');
    const sticky =
      ['evtype', 'range', 'theme', 'wth', 'drawtab', 'pettab', 'drawmode', 'buddy'].includes(
        seg.dataset.name,
      ) || /^phq/.test(seg.dataset.name);
    seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    if (!wasOn || sticky) b.classList.add('on');
    if (seg.dataset.name === 'range') renderReview();
  });

  /* navigation */
  const PAGES = [
    'island',
    'arcade',
    'adventure',
    'haven',
    'today',
    'pet',
    'draw',
    'sos',
    'evidence',
    'ladder',
    'wisdom',
    'review',
    'plan',
    'about',
  ];
  function go(page) {
    if (!PAGES.includes(page)) return;
    if (page !== 'pet') {
      stopGame();
      cancelTrip();
    }
    if (page !== 'haven') stopHaven();
    if (page === 'island') renderIsland();
    if (page === 'arcade') renderMemory();
    if (page === 'adventure') renderAdventure();
    if (page === 'haven') renderHaven();
    $$('.page').forEach((p) => p.classList.toggle('on', p.id === 'page-' + page));
    $$('.tab').forEach((t) =>
      t.setAttribute(
        'aria-current',
        t.dataset.page === page ||
          (t.dataset.page === 'island' && page === 'haven') ||
          (t.dataset.page === 'arcade' && page === 'adventure')
          ? 'page'
          : 'false',
      ),
    );
    if (page === 'review') renderReview();
    if (page === 'evidence') renderEvidence();
    if (page === 'ladder') renderLadders();
    if (page === 'wisdom') renderWisdom();
    if (page === 'draw') showDrawTab();
    if (page === 'pet') {
      renderPet();
      petGreet();
    } else roamStop();
    if (page === 'today') renderHabits();
    updBuddy();
    try {
      history.replaceState(null, '', '#' + page);
    } catch (e) {}
    window.scrollTo(0, 0);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.page)));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (a) {
      e.preventDefault();
      go(a.dataset.goto);
    }
  });

  /* time helpers */
  function mins(t) {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  function sleepHours(a, b) {
    const x = mins(a),
      y = mins(b);
    if (x == null || y == null) return null;
    let d = y - x;
    if (d <= 0) d += 1440;
    return Math.round(d / 6) / 10;
  }
  function circDiff(a, b) {
    const x = mins(a),
      y = mins(b);
    if (x == null || y == null) return 0;
    const d = Math.abs(x - y);
    return Math.min(d, 1440 - d) / 60;
  }
  function defaultDay() {
    const n = new Date();
    if (n.getHours() < 12) n.setDate(n.getDate() - 1);
    return keyOf(n);
  }

  /* ---------- 古今智慧 ---------- */
  const THEMES = [
    ['fail', '怕失敗'],
    ['cmp', '同人比較'],
    ['stuck', '卡住・焦慮'],
    ['grow', '進步慢'],
    ['home', '孤獨・異鄉'],
    ['rely', '搵人幫手'],
    ['body', '作息・身體'],
    ['fun', '幽默・放鬆'],
  ];
  const W = [
    /* 怕失敗 */
    {
      id: 'w01',
      th: 'fail',
      o: '世以不得第為恥，吾以不得第動心為恥。',
      s: '王陽明（會試落第之後，見《年譜》）',
      p: '人哋覺得考唔到係醜，我覺得因為考唔到而亂晒陣先係醜。',
      u: '王陽明考進士考咗兩次都唔中。失敗本身唔係問題，被失敗嚇到唔敢再試先係。',
    },
    {
      id: 'w02',
      th: 'fail',
      o: '塞翁失馬，焉知非福。',
      s: '《淮南子・人間訓》',
      p: '塞翁唔見咗匹馬，點知唔係好事？後來匹馬仲帶埋另一匹返嚟。',
      u: '推銷工做唔掂，只係證明你唔啱截陌生人，唔係證明你冇用。可能正正因為咁，你先搵到夜班送單呢條自由啲嘅路。',
    },
    {
      id: 'w03',
      th: 'fail',
      o: '失之東隅，收之桑榆。',
      s: '《後漢書・馮異傳》',
      p: '東隅係日出嘅地方，桑榆係日落嘅地方。朝早輸咗，夜晚可以贏返。',
      u: '一日唔順唔代表一世。今晚爆單唔順，聽晚可以好返。',
    },
    {
      id: 'w04',
      th: 'fail',
      o: '古之立大事者，不惟有超世之才，亦必有堅忍不拔之志。',
      s: '蘇軾《晁錯論》',
      p: '古時做成大事嘅人，唔止有過人嘅才華，更加有撐得住嘅意志。',
      u: '你成日話自己冇天份。蘇東坡講明，成事嗰條公式入面，「撐得住」佔一半。',
    },
    {
      id: 'w05',
      th: 'fail',
      o: '阻礙行動嘅嘢，會推動行動；擋喺路中間嘅，就變成條路。',
      s: '馬可・奧理略《沉思錄》（古羅馬皇帝，斯多葛派）',
      p: '障礙本身就係練習嘅材料。',
      u: '卡住嗰樣嘢，正正就係你要練嗰樣嘢。',
    },
    {
      id: 'w06',
      th: 'fail',
      o: '天行健，君子以自強不息。',
      s: '《易經・乾卦》',
      p: '天每日都照轉，君子學佢，日日自己催谷自己，唔停。',
      u: '唔係叫你日日拼命，係叫你唔好停：今日行一細步都算。',
    },
    /* 同人比較 */
    {
      id: 'w11',
      th: 'cmp',
      o: '知人者智，自知者明；勝人者有力，自勝者強。',
      s: '老子《道德經》第三十三章',
      p: '識睇人係聰明，識睇自己先係清醒；贏人只係有力，贏自己先叫強。',
      u: '唔使同人比，同琴日嘅自己比。週回顧嘅圖表就係俾你咁比。',
    },
    {
      id: 'w12',
      th: 'cmp',
      o: '人皆知有用之用，而莫知無用之用也。',
      s: '《莊子・人間世》',
      p: '人人都識得「有用」嘅用處，冇人識得「冇用」嘅用處。',
      u: '你嘅價值唔係淨係計你叻唔叻、贏唔贏人。莊子講嗰棵冇用嘅大樹，正因為冇用先冇人斬，活得最長。',
    },
    {
      id: 'w13',
      th: 'cmp',
      o: '三人行，必有我師焉。擇其善者而從之，其不善者而改之。',
      s: '《論語・述而》',
      p: '三個人一齊行，入面一定有可以教我嘅人。好嘅學，唔好嘅自己改。',
      u: '見到人叻，當佢係老師，唔係對手。比較嘅目的係學，唔係判自己死刑。',
    },
    {
      id: 'w14',
      th: 'cmp',
      o: '一樣米養百樣人。',
      s: '廣東俗語',
      p: '食同一樣米，養出一百種唔同嘅人。',
      u: '你攞人哋最叻嗰樣同成個你比，本身就唔公平。',
    },
    {
      id: 'w15',
      th: 'cmp',
      o: '天生我材必有用。',
      s: '李白《將進酒》',
      p: '天生我呢副材料，總有用得着嘅地方。',
      u: '唔係話你一定好勁，係話總有一個位啱你。要做嘅係搵，唔係比。',
    },
    /* 卡住焦慮 */
    {
      id: 'w21',
      th: 'stuck',
      o: '破山中賊易，破心中賊難。',
      s: '王陽明《與楊仕德薛尚謙書》',
      p: '打山上嘅賊容易，打心入面嘅賊難。',
      u: '卡住時最大嘅敵人係腦入面嗰句「我搞唔掂」。用卡住急救第二步，將佢叫出嚟。',
    },
    {
      id: 'w22',
      th: 'stuck',
      o: '天下難事，必作於易；天下大事，必作於細。',
      s: '老子《道德經》第六十三章',
      p: '天下難事，一定由易嘅部分開始；天下大事，一定由細嘅部分開始。',
      u: '就係卡住急救第三步：拆到最細。',
    },
    {
      id: 'w23',
      th: 'stuck',
      o: '令人困擾嘅唔係事情本身，而係我哋對事情嘅看法。',
      s: '愛比克泰德《手冊》（古羅馬，認知治療嘅思想源頭）',
      p: '困擾你嘅，係你點樣睇件事。',
      u: '現代認知行為治療（CBT）就係由呢句發展出嚟。',
    },
    {
      id: 'w24',
      th: 'stuck',
      o: '我哋喺想像入面受嘅苦，往往多過現實。',
      s: '塞涅卡《道德書簡》（古羅馬斯多葛派）',
      p: '驚嘅時候，個腦會將事情諗到好恐怖。',
      u: '細步階梯「估幾驚、實際幾驚」就係逐次驗證呢句。',
    },
    {
      id: 'w25',
      th: 'stuck',
      o: '山重水複疑無路，柳暗花明又一村。',
      s: '陸游《遊山西村》',
      p: '山一重重、水一灣灣，以為冇路；再行多段，柳樹花叢後面又見到一條村。',
      u: '卡到覺得冇路，通常係仲未行到轉角。',
    },
    {
      id: 'w26',
      th: 'stuck',
      o: '莫聽穿林打葉聲，何妨吟嘯且徐行。竹杖芒鞋輕勝馬，誰怕？一蓑煙雨任平生。',
      s: '蘇軾《定風波》（被貶黃州時，出遊遇雨而作）',
      p: '唔好理啲雨打樹葉幾大聲，照樣唱住歌慢慢行。拎住竹枝、着住草鞋，仲輕鬆過騎馬，怕咩？成世人就披住件蓑衣行喺風雨入面。',
      u: '落雨夜送單嗰晚讀呢首。同行嘅人走雨走到好狼狽，蘇東坡照行照唱。',
    },
    {
      id: 'w27',
      th: 'stuck',
      o: '天跌落嚟當被冚。',
      s: '廣東俗語',
      p: '天塌落嚟，就當棉被咁蓋住瞓。',
      u: '焦慮到頂嗰陣講一次，通常會笑。最壞嘅情況，多數都捱得過。',
    },
    {
      id: 'w28',
      th: 'stuck',
      o: '行到水窮處，坐看雲起時。',
      s: '王維《終南別業》',
      p: '行到條河嘅盡頭冇路行，就坐低睇雲慢慢升起。',
      u: '就係卡住急救第一步：停一停。冇路嗰陣，唔使硬衝。',
    },
    /* 進步慢 */
    {
      id: 'w31',
      th: 'grow',
      o: '騏驥一躍，不能十步；駑馬十駕，功在不舍。',
      s: '荀子《勸學》',
      p: '千里馬跳一下，都唔夠十步；普通嘅馬拉十日車，成功係因為唔停。',
      u: '你話自己進步慢？荀子二千幾年前就答咗你：慢唔緊要，唔停就得。',
    },
    {
      id: 'w32',
      th: 'grow',
      o: '人一能之，己百之；人十能之，己千之。果能此道矣，雖愚必明，雖柔必強。',
      s: '《中庸》',
      p: '人哋做一次識，我做一百次；人哋做十次識，我做一千次。真係咁做，笨都會變聰明，弱都會變強。',
      u: '唔係叫你自虐，係話次數夠，慢都追得上。',
    },
    {
      id: 'w33',
      th: 'grow',
      o: '鍥而舍之，朽木不折；鍥而不舍，金石可鏤。',
      s: '荀子《勸學》',
      p: '刻兩刻就放棄，爛木都刻唔斷；一直刻落去，金同石都刻得穿。',
      u: '你卡喺中階，好多時係喺「刻兩刻」嗰度停咗。',
    },
    {
      id: 'w34',
      th: 'grow',
      o: '學而時習之，不亦說乎？',
      s: '《論語・學而》',
      p: '學完之後，按時去練，唔係好開心咩？',
      u: '「學」好新鮮，「習」好悶。進步係喺悶嗰部分發生。',
    },
    {
      id: 'w35',
      th: 'grow',
      o: '苟日新，日日新，又日新。',
      s: '《大學》（商湯刻喺洗面盆上嘅字）',
      p: '如果今日可以新一啲，就日日都新一啲。',
      u: '每日新少少就夠，唔使一次過變。',
    },
    {
      id: 'w36',
      th: 'grow',
      o: '慢著火，少著水，火候足時他自美。',
      s: '蘇軾《豬肉頌》（東坡肉嘅原始食譜）',
      p: '細火、少水，時候夠，自然好食。',
      u: '你鍾意煮嘢食，應該最明：有啲嘢急唔嚟，火候夠就得。學嘢都係。',
    },
    {
      id: 'w37',
      th: 'grow',
      o: '笨鳥先飛。',
      s: '俗語',
      p: '飛得慢嘅鳥，早啲出發。',
      u: '自嘲之餘都係一個好實際嘅方法：知道自己慢，就早啲開始，唔好拖到最後。',
    },
    /* 孤獨異鄉 */
    {
      id: 'w41',
      th: 'home',
      o: '此心安處是吾鄉。',
      s: '蘇軾《定風波・南海歸贈王定國侍人寓娘》',
      p: '個心安定嘅地方，就係我嘅家鄉。',
      u: '王定國被貶去嶺南，歌女柔奴跟住佢去。蘇東坡問佢嶺南好唔好，佢就答咗呢句。你喺多倫多，唔使等「融入」先有屋企：固定嘅作息、一餐自己煮嘅飯、一條熟悉嘅跑步路線，就係開始。',
    },
    {
      id: 'w42',
      th: 'home',
      o: '人生如逆旅，我亦是行人。',
      s: '蘇軾《臨江仙・送錢穆父》',
      p: '人生好似一間旅館，我都只係路過嘅人。',
      u: '一個人喺異鄉嘅感覺，蘇東坡都有。佢一生被貶到好多地方，最遠去到海南島。',
    },
    {
      id: 'w43',
      th: 'home',
      o: '德不孤，必有鄰。',
      s: '《論語・里仁》',
      p: '有德嘅人唔會一直孤單，總會有人行埋嚟。',
      u: '慢慢嚟。你去 run club、報堂初學班，就係俾「鄰」有機會出現。',
    },
    {
      id: 'w44',
      th: 'home',
      o: '海內存知己，天涯若比鄰。',
      s: '王勃《送杜少府之任蜀州》',
      p: '世界上有知心朋友，就算遠到天邊，都好似住隔籬。',
      u: '遠方嘅朋友都算數。打個電話返香港，喺打卡都算「傾咗幾句」。',
    },
    {
      id: 'w45',
      th: 'home',
      o: '採菊東籬下，悠然見南山。',
      s: '陶淵明《飲酒・其五》',
      p: '喺東邊籬笆下摘菊花，悠悠閒閒咁抬頭見到南山。',
      u: '陶淵明辭官返鄉，一個人種田。孤獨可以係寂寞，都可以係自在，分別在於你有冇俾自己做啲鍾意嘅嘢。',
    },
    /* 搵人幫手 */
    {
      id: 'w51',
      th: 'rely',
      o: '敏而好學，不恥下問。',
      s: '《論語・公冶長》',
      p: '聰明又好學，唔覺得問比自己低嘅人係羞恥。',
      u: '問人唔係弱，孔子都讚。重點係試完先問，帶住你試過嘅嘢去問。',
    },
    {
      id: 'w52',
      th: 'rely',
      o: '君子求諸己，小人求諸人。',
      s: '《論語・衛靈公》',
      p: '君子遇到問題，先喺自己身上搵答案；小人就先靠人或者怪人。',
      u: '唔係叫你唔好搵人，係先自己試 15 分鐘。',
    },
    {
      id: 'w53',
      th: 'rely',
      o: '知之為知之，不知為不知，是知也。',
      s: '《論語・為政》',
      p: '識就話識，唔識就認唔識，咁先係真正嘅智慧。',
      u: '認唔識唔係失敗，係開始學嘅第一步。',
    },
    {
      id: 'w54',
      th: 'rely',
      o: '授人以魚，不如授人以漁。',
      s: '俗語（常被誤當係老子講）',
      p: '送條魚俾人，不如教佢點釣魚。',
      u: '搵人幫手時，叫佢教你點做，唔好淨係叫佢幫你做。下次你就識。',
    },
    {
      id: 'w55',
      th: 'rely',
      o: '人須在事上磨，方立得住。',
      s: '王陽明《傳習錄》',
      p: '人要喺實際做事入面磨練，先企得穩。',
      u: '自信唔係諗出嚟，係喺做嘢入面磨出嚟。證據簿就係記低你磨過嘅地方。',
    },
    /* 作息身體 */
    {
      id: 'w61',
      th: 'body',
      o: '食飲有節，起居有常，不妄作勞。',
      s: '《黃帝內經・素問・上古天真論》',
      p: '食嘢有節制，起居有規律，唔好亂咁操勞。',
      u: '夜班都可以「起居有常」：固定嘅睡眠錨點就係你嘅「常」。',
    },
    {
      id: 'w62',
      th: 'body',
      o: '飢來喫飯，睏來即眠。',
      s: '大珠慧海禪師（《景德傳燈錄》）',
      p: '有人問禪師點樣修行，佢話：肚餓就食飯，眼瞓就瞓覺。',
      u: '聽落好簡單，但禪師補充：普通人食飯時諗百樣嘢，瞓覺時又諗千樣嘢。瞓覺就淨係瞓覺，手機放遠啲。',
    },
    {
      id: 'w63',
      th: 'body',
      o: '留得青山在，唔怕冇柴燒。',
      s: '廣東俗語',
      p: '座山仲喺度，就唔使驚冇柴。',
      u: '身體同心情係你座青山。好攰就早啲收工，機會遲啲都有。',
    },
    {
      id: 'w64',
      th: 'body',
      o: '盛年不重來，一日難再晨。及時當勉勵，歲月不待人。',
      s: '陶淵明《雜詩・其一》',
      p: '壯年唔會再嚟，一日都冇兩個朝早。趁而家鼓勵自己，時間唔會等人。',
      u: '用嚟提自己今日行一細步，唔係用嚟鬧自己浪費咗幾多年。',
    },
    /* 幽默放鬆 */
    {
      id: 'w71',
      th: 'fun',
      o: '累累若喪家之狗。……然哉！然哉！',
      s: '《史記・孔子世家》',
      p: '孔子同學生失散，有人形容佢「好似一隻冇屋企嘅狗」。子貢轉述，孔子笑住話：「講得啱！講得啱！」',
      u: '聖人被人話似流浪狗，佢都笑住認。有時自嘲比自責好用好多。',
    },
    {
      id: 'w72',
      th: 'fun',
      o: '子非魚，安知魚之樂？',
      s: '《莊子・秋水》',
      p: '莊子同惠子喺橋上睇魚，莊子話魚好開心，惠子話：你又唔係魚，點知魚開唔開心？',
      u: '反過嚟用：你又唔係人哋，點知人哋一定覺得你差？讀心術係焦慮最鍾意玩嘅把戲。',
    },
    {
      id: 'w73',
      th: 'fun',
      o: '難得糊塗。',
      s: '鄭板橋',
      p: '聰明難，糊塗難，由聰明轉入糊塗更難。',
      u: '唔使樣樣諗到盡。今日諗唔通嘅事，先放低，瞓醒再算。',
    },
    {
      id: 'w74',
      th: 'fun',
      o: '日啖荔枝三百顆，不辭長作嶺南人。',
      s: '蘇軾《惠州一絕》',
      p: '如果日日有三百粒荔枝食，我願意一世做嶺南人。',
      u: '佢被貶去當時算係蠻荒之地，第一時間搵到荔枝就開心晒。你喺多倫多嘅「荔枝」係乜？可以寫入收工三省。',
    },
    {
      id: 'w75',
      th: 'fun',
      o: '食得鹹魚抵得渴。',
      s: '廣東俗語',
      p: '揀咗食鹹魚，就要預咗口渴。',
      u: '揀咗夜班嘅自由，就接受佢嘅辛苦，唔使再怨自己點解揀錯。',
    },
    {
      id: 'w76',
      th: 'fun',
      o: '行行出狀元。',
      s: '俗語',
      p: '每一行都可以出最叻嘅人。',
      u: '送外賣都有人做到好專業：你自己整日報、計時薪、分析邊間餐廳出餐慢，本身就係專業做法。',
    },
  ];
  const STORIES = [
    {
      n: '曾國藩',
      e: '晚清・湘軍統帥',
      p: '自己都承認資質一般。相傳有晚佢喺屋企背書，背極都背唔到，連匿埋偷嘢嘅賊都聽到背熟晒，忍唔住跳出嚟背一次俾佢聽先走。佢考秀才都考咗好多次。後來帶兵嘅方法係「結硬寨，打呆仗」：唔靠奇招，一步一步紮實咁做。佢仲日日寫日記檢討自己。',
      u: '笨方法都係方法。你嘅收工三省同證據簿，其實就係曾國藩嘅日記。',
    },
    {
      n: '王陽明',
      e: '明朝・心學宗師',
      p: '考進士落第兩次。後來得罪權臣，被打完再貶去貴州龍場，一個語言唔通、條件好差嘅地方。佢就喺嗰度悟出自己嘅學問，史稱「龍場悟道」。',
      u: '最差嘅環境，都可以係轉捩點。一個人喺陌生地方，唔一定係困局。',
    },
    {
      n: '蘇東坡',
      e: '北宋・文學家',
      p: '因為「烏台詩案」坐監，差啲冇命，出獄後被貶黃州，冇錢冇地位。佢自己開荒種田，用當時平價嘅豬肉研究出東坡肉，仲喺嗰段日子寫出《赤壁賦》同《定風波》。',
      u: '佢喺人生最低潮嗰陣煮嘢食、寫嘢，慢慢搵返自己。你都鍾意煮嘢食，呢個唔係細嘢。',
    },
    {
      n: '孔子',
      e: '春秋・思想家',
      p: '五十幾歲先帶學生周遊列國，十幾年都冇國君肯用佢，喺陳國同蔡國之間仲被困到斷糧。被人笑似喪家狗，佢笑住認。',
      u: '孔子一生都唔算「成功」，但佢冇因此停止做自己相信嘅嘢。',
    },
    {
      n: '韓信',
      e: '秦漢之際・名將',
      p: '後生時好窮，要靠人施捨先有飯食。有個屠夫當街逼佢鑽褲襠，佢諗咗一陣，鑽咗。後來成為漢朝開國名將。',
      u: '一時嘅屈辱，唔定義你係邊個。你遇過嘅無理客人同被騙單，都係咁。',
    },
    {
      n: '齊白石',
      e: '近代・畫家',
      p: '木匠出身，冇讀過幾多書。五十幾歲定居北京之後，覺得自己畫得唔夠好，決定「衰年變法」，全面改畫風，之後先成為大師。',
      u: '幾時開始都唔遲。你而家學乜都唔算晚。',
    },
    {
      n: '李小龍',
      e: '香港・武術家',
      p: '十八歲由香港一個人去美國，喺西雅圖一邊讀書，一邊喺中餐館打工，之後先慢慢開武館教功夫。',
      u: '同你一樣，都係香港人喺北美由打工開始。佢最出名嘅一句係叫人學水咁：遇到障礙就轉個形狀，繼續流。',
    },
    {
      n: '庖丁',
      e: '寓言・出自《莊子・養生主》',
      p: '庖丁幫魏王劏牛，把刀用咗十九年都好似新。佢話：「始臣之解牛之時，所見無非牛者。三年之後，未嘗見全牛也。」初學嗰陣，眼前淨係見到成隻牛；三年之後，先睇得出入面嘅紋理。',
      u: '初學時覺得好亂、無從入手，係正常階段，唔係你特別笨。進步係睇得出「紋理」嗰陣先出現。',
    },
  ];
  const PAIRS = [
    ['行為激活：行動行先，心情跟尾', '王陽明：知行合一、事上磨練'],
    ['認知治療：念頭唔等於事實', '愛比克泰德：困擾你嘅係看法；王陽明：破心中賊'],
    ['漸進式面對：由細到唔太驚開始', '荀子：不積跬步，無以至千里；老子：大事必作於細'],
    ['自我效能：親身做到先信自己', '曾國藩：日記檢討、結硬寨打呆仗'],
    ['自我慈悲：對自己好似對朋友咁', '孔子被笑喪家狗，笑住認'],
    ['正念：專注當下', '禪宗：飢來喫飯，睏來即眠'],
    ['社會節律：固定作息穩定情緒', '《黃帝內經》：起居有常'],
    ['接納與承諾：同困難共存，照行有價值嘅路', '蘇東坡：一蓑煙雨任平生'],
  ];
  const byId = (id) => W.find((x) => x.id === id);
  const isFav = (id) => (S.favs || []).includes(id);
  function toggleFav(id) {
    S.favs = S.favs || [];
    if (isFav(id)) S.favs = S.favs.filter((x) => x !== id);
    else S.favs.push(id);
    persist();
    renderWisdom();
    renderPlanFavs();
    updateDrawFav();
  }
  let drawn = null;
  function showDraw(x) {
    drawn = x;
    $('#draw-orig').textContent = '「' + x.o + '」';
    $('#draw-src').textContent = x.s;
    $('#draw-plain').textContent = '白話：' + x.p;
    $('#draw-use').innerHTML =
      '<b style="color:var(--red);font-weight:500;margin-right:6px">對你</b>' + esc(x.u);
    updateDrawFav();
  }
  function updateDrawFav() {
    if (drawn) {
      $('#draw-fav').textContent = isFav(drawn.id) ? '已收藏' : '收藏';
    }
  }
  $('#draw-btn').addEventListener('click', () => {
    let x;
    do {
      x = W[Math.floor(Math.random() * W.length)];
    } while (drawn && x.id === drawn.id && W.length > 1);
    showDraw(x);
  });
  $('#draw-fav').addEventListener('click', () => {
    if (drawn) toggleFav(drawn.id);
  });
  function wisItem(x) {
    return (
      '<div class="wis"><div class="orig">「' +
      esc(x.o) +
      '」</div><div class="src"><span>' +
      esc(x.s) +
      '</span><button class="star' +
      (isFav(x.id) ? ' on' : '') +
      '" data-fav="' +
      x.id +
      '">' +
      (isFav(x.id) ? '已收藏' : '收藏') +
      '</button></div><div class="plain">白話：' +
      esc(x.p) +
      '</div><div class="use"><b>對你</b>' +
      esc(x.u) +
      '</div></div>'
    );
  }
  function renderWisdom() {
    const segEl = document.querySelector('.seg[data-name="wth"]');
    if (!segEl.children.length) {
      segEl.innerHTML = THEMES.map(
        ([k, n], i) =>
          '<button data-v="' + k + '"' + (i === 0 ? ' class="on"' : '') + '>' + n + '</button>',
      ).join('');
    }
    const th = segGet('wth') || 'fail';
    $('#wis-list').innerHTML = W.filter((x) => x.th === th)
      .map(wisItem)
      .join('');
    $('#stories').innerHTML = STORIES.map(
      (s) =>
        '<div class="sheet story"><span class="era">' +
        esc(s.e) +
        '</span><h3>' +
        esc(s.n) +
        '</h3><p>' +
        esc(s.p) +
        '</p><div class="use"><b>對你</b>' +
        esc(s.u) +
        '</div></div>',
    ).join('');
    $('#pairs').innerHTML = PAIRS.map(
      ([a, b]) =>
        '<div class="pair"><div><span class="tag">現代心理學</span><b>' +
        esc(a) +
        '</b></div><div><span class="tag">古人</span><b>' +
        esc(b) +
        '</b></div></div>',
    ).join('');
    const favs = (S.favs || []).map(byId).filter(Boolean);
    $('#fav-list').innerHTML = favs.length
      ? favs
          .map(
            (x) =>
              '<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「' +
              esc(x.o) +
              '」</span><div class="meta">' +
              esc(x.s) +
              '</div></div><button class="x" data-fav="' +
              x.id +
              '" aria-label="取消收藏">×</button></li>',
          )
          .join('')
      : '<li class="muted">未收藏。上面揀一句啱心水嘅，撳「收藏」。</li>';
    if (!drawn) showDraw(W[Math.floor(Math.random() * W.length)]);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (b) {
      toggleFav(b.dataset.fav);
    }
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg[data-name="wth"] button');
    if (b) {
      setTimeout(renderWisdom, 0);
    }
  });
  function renderPlanFavs() {
    let favs = (S.favs || []).map(byId).filter(Boolean);
    const starter = !favs.length;
    if (starter) favs = ['w63', 'w26', 'w41', 'w27'].map(byId);
    $('#plan-favs').innerHTML = favs
      .map(
        (x) =>
          '<li class="item"><div class="txt"><span style="font-family:var(--f-head);font-size:16px">「' +
          esc(x.o) +
          '」</span><div class="meta">' +
          esc(x.s) +
          (starter ? '・起步句子' : '') +
          '</div><div style="font-size:14px;color:var(--ink-2);margin-top:4px">' +
          esc(x.u) +
          '</div></div></li>',
      )
      .join('');
  }
  /* 手帳自己嘅提醒，同古人句子一齊輪流做「今日一句」 */
  const NOTES = [
    ['行動行先，心情跟尾。唔使等有心機先做。', '心晴手帳・行為激活'],
    ['你同緊嘅，係一個集合晒全世界優點嘅人。咁比，邊個都輸。', '心晴手帳'],
    ['搵人幫唔係錯。先自己試 15 分鐘，再帶住試過嘅嘢去問。', '心晴手帳'],
    ['「我係 0」只係一個念頭，唔係一個事實。', '心晴手帳・認知脫鉤'],
    ['完成一件麻麻地嘅嘢，好過冇開始一件完美嘅嘢。', '心晴手帳'],
  ];
  const DAILY = W.map((x) => ({ o: '「' + x.o + '」', s: x.s, p: x.p, u: x.u })).concat(
    NOTES.map(([o, s]) => ({ o, s })),
  );
  let dailyIdx = 0;
  function showDaily(i) {
    dailyIdx = (i + DAILY.length) % DAILY.length;
    const d = DAILY[dailyIdx];
    $('#daily-quote').textContent = d.o;
    $('#daily-src').textContent = d.s;
    $('#daily-toggle').hidden = !d.p;
    $('#daily-more').hidden = true;
    $('#daily-toggle').textContent = '點解？';
    $('#daily-more').innerHTML = d.p
      ? '<span>白話：' + esc(d.p) + '</span><span><b>對你</b>' + esc(d.u) + '</span>'
      : '';
  }
  $('#daily-toggle').addEventListener('click', () => {
    const m = $('#daily-more');
    m.hidden = !m.hidden;
    $('#daily-toggle').textContent = m.hidden ? '點解？' : '收埋';
  });
  $('#daily-next').addEventListener('click', () => showDaily(dailyIdx + 1));
  function kq(id) {
    const x = byId(id);
    return x ? '<div class="kq">「' + esc(x.o) + '」<small>' + esc(x.s) + '</small></div>' : '';
  }

  /* ---------- 收工抽卡 ---------- */

  /* 心晴牌 插畫模組：每張牌 300×500，場景區 x26–274、y54–394 */

  const LVN = ['未遇', '初見', '熟悉', '知己'];
  const lvOf = (n) => (n >= 7 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);
  function drawCounts() {
    const m = {};
    Object.values(S.draws || {}).forEach((d) => {
      drawCards(d).forEach((x) => {
        m[x.card] = (m[x.card] || 0) + 1;
      });
    });
    return m;
  }
  function cardFace(c, rev, lv) {
    return '<div class="tw' + (rev ? ' rv' : '') + '">' + ART.face(c, lv) + '</div>';
  }
  function cardBack(label) {
    return (
      '<div class="tw">' +
      ART.back() +
      (label ? '<span class="tw-label">' + label + '</span>' : '') +
      '</div>'
    );
  }
  function zoomCard(c, rev, lv) {
    return (
      '<button class="zoomable" data-zoom="' +
      c.id +
      '|' +
      (rev ? 1 : 0) +
      '" aria-label="放大睇' +
      c.name +
      '">' +
      cardFace(c, rev, lv) +
      '</button>'
    );
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  const NEG = [
    '攰',
    '煩',
    '唔開心',
    '衰',
    '嬲',
    '驚',
    '慘',
    '頂唔順',
    '辛苦',
    '差',
    '唔想',
    '失望',
    '難受',
    '冇心機',
    '討厭',
  ];
  const POS = [
    '開心',
    '好彩',
    '爽',
    '正',
    '好食',
    '多謝',
    '順',
    '笑',
    'tips',
    '貼士',
    '讚',
    '舒服',
    '滿足',
  ];
  const countHits = (t, arr) => arr.reduce((n, k) => n + (t.includes(k.toLowerCase()) ? 1 : 0), 0);
  function candidates(text) {
    const t = text.toLowerCase();
    const total = Object.keys(S.draws || {}).length;
    return DECK.filter((c) => {
      if (!c.hidden) return true;
      if (c.need === 'seven') return total >= 7 && countHits(t, c.kw) > 0;
      return countHits(t, c.kw) > 0;
    });
  }
  function localPick(text, date) {
    const t = text.toLowerCase();
    const cands = candidates(text);
    const h = hashStr(text + date);
    let best = null,
      bestScore = -1;
    cands.forEach((c, i) => {
      const sc = countHits(t, c.kw) * 10 + (c.hidden ? 6 : 0) + ((h >>> (i % 24)) & 7) / 8;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    });
    if (bestScore < 1) {
      best = cands.filter((c) => !c.hidden)[h % 22];
    }
    const neg = countHits(t, NEG),
      pos = countHits(t, POS);
    const rev = neg > pos ? (h >>> 3) % 3 !== 0 : (h >>> 3) % 5 === 0;
    const hit = (best.kw || []).find((k) => t.includes(k.toLowerCase()));
    const reading =
      (hit
        ? '你今晚寫到「' + hit + '」，所以抽到' + best.name + '。'
        : '今晚抽到' + best.name + '。') + (rev ? best.rev : best.up);
    return { card: best.id, rev, reading, question: best.q, action: best.act, by: 'local' };
  }
  async function claudePick(text, date) {
    if (!window.claude || !window.claude.use) return null;
    let sample = null;
    try {
      sample = await window.claude.use('sample');
    } catch (e) {
      return null;
    }
    if (!sample) return null;
    const cands = candidates(text);
    const list = cands.map((c) => c.id + '：' + c.name + '｜' + c.up).join('\n');
    const prompt =
      '你係「心晴手帳」入面嘅抽卡解讀者。用戶 Dicky 係喺多倫多一個人生活、做夜班外送嘅香港人，容易焦慮、怕失敗、同人比較。佢收工後寫咗以下說話：\n"""\n' +
      text.slice(0, 3000) +
      '\n"""\n\n可以揀嘅牌（id：名稱｜意思）：\n' +
      list +
      '\n\n任務：揀一張最貼近佢今晚經歷嘅牌，再決定正位定提醒位。提醒位唔係壞兆頭，係一個溫和提醒，當佢寫嘅嘢有需要提醒自己嘅地方先用。\n規則：\n- 呢個唔係占卜。唔好預測將來，唔好講運程。\n- 用繁體中文廣東話口語，直接、具體，引用佢寫嘅細節。唔好講空泛安慰說話，唔好說教，唔好用「加油」之類。\n- reading：3 至 4 句，講點解係呢張牌，同佢今晚有咩關係。\n- question：一條佢可以喺腦入面答嘅問題。\n- action：一個聽日做得到、5 分鐘內完成嘅細行動。\n- 如果佢明確寫到想傷害自己或者唔想生存，就喺 reading 最尾溫和咁講一句：可以打或者 text 988，亦可以打開手帳嘅低潮應急卡。冇寫到就完全唔好提。\n只回覆 JSON：{"card":"牌id","reversed":true或false,"reading":"…","question":"…","action":"…"}';
    try {
      const r = await sample.json(prompt, { modelTier: 'default', cache: false });
      if (!r || !cands.find((c) => c.id === r.card) || typeof r.reading !== 'string') return null;
      return {
        card: r.card,
        rev: !!r.reversed,
        reading: r.reading,
        question: r.question || card(r.card).q,
        action: r.action || card(r.card).act,
        by: 'claude',
      };
    } catch (e) {
      return { err: e && e.code };
    }
  }
  function readingHTML(d, showText) {
    if (d.cards && d.cards.length === 3) return readingHTML3(d, showText);
    const c = card(d.card);
    const n = drawCounts()[c.id] || 0;
    const lv = lvOf(n);
    return (
      '<div class="reading">' +
      '<div class="r-head"><span class="eyebrow">' +
      md(d.date) +
      (c.hidden ? '・隱藏牌' : '') +
      '</span><h2>' +
      c.n +
      '　' +
      c.name +
      (d.rev ? '（提醒位）' : '') +
      '</h2><span class="chip ' +
      (lv >= 3 ? 'red' : '') +
      '">' +
      LVN[lv] +
      '・抽過 ' +
      n +
      ' 次</span></div>' +
      (showText ? '<div class="entry-text">' + esc(d.text) + '</div>' : '') +
      '<div class="r-body">' +
      esc(d.reading) +
      '</div>' +
      '<div class="grid g2"><div class="r-block"><span class="tag">問自己</span><p>' +
      esc(d.question) +
      '</p></div><div class="r-block"><span class="tag">聽日一細步</span><p>' +
      esc(d.action) +
      '</p></div></div>' +
      '<div class="r-block"><span class="tag">牌義・' +
      (d.rev ? '提醒位' : '正位') +
      '</span><p>' +
      esc(d.rev ? c.rev : c.up) +
      '</p></div>' +
      '<div class="kq" style="margin-top:0">「' +
      esc(c.quote[0]) +
      '」<small>' +
      esc(c.quote[1]) +
      '</small></div>' +
      (lv >= 2
        ? '<div class="r-block"><span class="tag">牌嘅故事</span><p>' + esc(c.story) + '</p></div>'
        : '<div class="lock">再抽到呢張 ' + (3 - n) + ' 次，解鎖牌背後嘅故事。</div>') +
      pastNotesHTML([c.id]) +
      '<div class="row"><button class="btn ghost small" data-addnext="' +
      d.date +
      '">將細步放入聽日打卡</button><button class="btn ghost small" data-notecard="' +
      c.id +
      '">寫低我對呢張牌嘅解讀</button>' +
      (d.by === 'claude'
        ? '<span class="muted">由 Claude 讀過你嘅說話之後揀</span>'
        : '<span class="muted">由手帳按你寫嘅內容揀</span>') +
      '</div>' +
      '</div>'
    );
  }
  let drawing = false,
    ritual = false,
    redoArmed = false;
  const RM = () =>
    !!S.settings.quiet || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function stageMsg(t) {
    $('#stage-msg').textContent = t;
  }
  function pileHTML(shuffle) {
    let s = '<div class="pile' + (shuffle ? ' shuffle' : '') + '">';
    for (let k = 6; k >= 1; k--) s += '<div class="edge" style="--k:' + k + '"></div>';
    s += '<div class="top">' + cardBack() + '</div>';
    if (shuffle)
      s +=
        '<div class="half l">' +
        cardBack() +
        '</div><div class="half r">' +
        cardBack() +
        '</div><div class="drop" style="--from:-60%;--rot:-10deg">' +
        cardBack() +
        '</div><div class="drop" style="--from:60%;--rot:10deg;animation-delay:.14s">' +
        cardBack() +
        '</div>';
    return s + '</div>';
  }
  const FAN = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  function setStage(state, d) {
    const t = $('#table');
    if (state === 'empty') {
      ritual = false;
      t.innerHTML = pileHTML(false);
      stageMsg('寫低今晚嘅說話，然後撳「洗牌抽卡」。');
    }
    if (state === 'shuffle') {
      ritual = true;
      t.innerHTML = pileHTML(true);
      stageMsg(window.claude ? '洗緊牌……讀緊你今晚寫嘅嘢。' : '洗緊牌……整理緊今晚嘅故事。');
    }
    if (state === 'spread') {
      ritual = true;
      t.innerHTML =
        '<div class="fan opening">' +
        FAN.map(
          (a, i) =>
            '<button class="fc" style="--n:' +
            a +
            ';--i:' +
            i +
            ';z-index:' +
            i +
            '" data-fc="' +
            i +
            '" aria-label="第 ' +
            (i + 1) +
            ' 張牌">' +
            cardBack() +
            '</button>',
        ).join('') +
        '</div>';
      const fan = t.querySelector('.fan');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          fan.classList.add('open');
          setTimeout(() => fan.classList.remove('opening'), 900);
        }),
      );
      stageMsg(
        d && d.cards
          ? '揀三張。第一張係「今晚做到咩」，跟住「身體同心」，最後「聽日一步」。'
          : '揀一張你覺得啱嘅。今晚嘅牌已經由你嘅說話決定咗，揀邊張都會帶你搵到佢。',
      );
    }
    if (state === 'shown') {
      ritual = false;
      showFace(d, false);
    }
  }
  function showFace(d, animate) {
    if (d.cards && d.cards.length === 3) {
      showFace3(d, animate);
      return;
    }
    const c = card(d.card);
    const lv = lvOf(drawCounts()[c.id] || 0);
    $('#table').innerHTML =
      '<div class="reveal"><div class="halo"></div><button class="flip" id="flip" data-zoom="' +
      c.id +
      '|' +
      (d.rev ? 1 : 0) +
      '" aria-label="' +
      c.name +
      '，撳一下放大"><div class="side back">' +
      cardBack() +
      '</div><div class="side front">' +
      cardFace(c, d.rev, lv) +
      '</div></button></div>';
    const fl = $('#flip'),
      rv = $('#table .reveal');
    const done = () => {
      rv.classList.add('lit');
      stageMsg(c.name + (d.rev ? '・提醒位（張牌倒轉咗）' : '・正位') + '。撳張牌可以放大睇。');
      ritual = false;
      showReading(d);
    };
    if (!animate || RM()) {
      fl.classList.add('flipped');
      done();
      return;
    }
    stageMsg('翻牌……');
    setTimeout(() => fl.classList.add('flipped'), 180);
    setTimeout(done, 1250);
  }
  function readingHTML3(d, showText) {
    const cs = d.cards;
    const cnt = drawCounts();
    return (
      '<div class="reading"><div class="r-head"><span class="eyebrow">' +
      md(d.date) +
      '・三張牌陣</span><h2>' +
      cs.map((x) => card(x.card).name).join('・') +
      '</h2></div>' +
      (showText ? '<div class="entry-text">' + esc(d.text) + '</div>' : '') +
      '<div class="spread3">' +
      cs
        .map((x, i) => {
          const c = card(x.card);
          return (
            '<div class="sp-i"><span class="tag">' +
            (i + 1) +
            '・' +
            POS3[i] +
            '</span><div class="mini-card">' +
            zoomCard(c, x.rev, lvOf(cnt[c.id] || 0)) +
            '</div><b>' +
            c.name +
            (x.rev ? '（提醒位）' : '') +
            '</b><p>' +
            esc(x.text || '') +
            '</p></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="r-body">' +
      esc(d.reading) +
      '</div>' +
      '<div class="grid g2"><div class="r-block"><span class="tag">問自己</span><p>' +
      esc(d.question) +
      '</p></div><div class="r-block"><span class="tag">聽日一細步</span><p>' +
      esc(d.action) +
      '</p></div></div>' +
      pastNotesHTML(cs.map((x) => x.card)) +
      '<div class="row"><button class="btn ghost small" data-addnext="' +
      d.date +
      '">將細步放入聽日打卡</button>' +
      (d.by === 'claude'
        ? '<span class="muted">由 Claude 讀過你嘅說話之後揀</span>'
        : '<span class="muted">由手帳按你寫嘅內容揀</span>') +
      '</div>' +
      '</div>'
    );
  }
  function showReading(d) {
    const r = $('#dr-reading');
    r.innerHTML =
      readingHTML(d, false) +
      '<hr class="sep"><div class="row"><button class="btn ghost small danger" id="dr-redo">' +
      (redoArmed ? '再撳一次確認重抽' : '改寫重抽') +
      '</button><span class="muted">每晚一次。想改寫就重抽，舊嗰次會被取代。</span></div>';
    r.hidden = false;
  }
  function renderDraw() {
    const k = defaultDay();
    $('#dr-date').textContent =
      md(k) + '・星期' + WD[parseKey(k).getDay()] + '嘅收工日記（夜班按開工日計）';
    $('#dr-count').textContent = $('#dr-text').value.length + ' 字';
    if (ritual || drawing) return;
    const d = (S.draws || {})[k];
    if (d) {
      $('#dr-text').value = d.text;
      $('#dr-text').disabled = true;
      $('#dr-go').hidden = true;
      setStage('shown', d);
    } else {
      const draft = readDraft('draw', k);
      if (draft) $('#dr-text').value = draft.text || '';
      $('#dr-text').disabled = false;
      $('#dr-go').hidden = false;
      setStage('empty');
      $('#dr-reading').hidden = true;
    }
    $('#dr-count').textContent = $('#dr-text').value.length + ' 字';
  }
  $('#dr-text').addEventListener('input', () => {
    $('#dr-count').textContent = $('#dr-text').value.length + ' 字';
  });
  $('#dr-go').addEventListener('click', async () => {
    const text = $('#dr-text').value.trim();
    if (text.length < 4) {
      stageMsg('寫多少少先抽，一兩句都得。');
      $('#dr-text').focus();
      return;
    }
    if (drawing) return;
    drawing = true;
    const drawOwner = S,
      drawEpoch = journalStore.epoch;
    $('#dr-go').disabled = true;
    $('#dr-text').disabled = true;
    $('#dr-reading').hidden = true;
    $('#dr-mode').textContent = '';
    setStage('shuffle');
    try {
      $('#table').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'center' });
    } catch (e) {}
    const k = defaultDay();
    const minShuffle = sleep(RM() ? 400 : 3000);
    const timeout = new Promise((r) => setTimeout(() => r(null), 30000));
    const three = segGet('drawmode') === 'three';
    let res = await Promise.race([three ? claudeSpread(text, k) : claudePick(text, k), timeout]);
    if (S !== drawOwner || journalStore.epoch !== drawEpoch) {
      drawing = false;
      $('#dr-go').disabled = false;
      showDrawTab();
      return;
    }
    let note = '';
    if (!res || res.err) {
      note =
        res && res.err === 'not_granted'
          ? '今次由手帳按你寫嘅內容揀牌。'
          : '呢張牌係按你寫嘅內容揀出嚟。';
      res = three ? localSpread(text, k) : localPick(text, k);
    }
    const d = {
      date: k,
      text,
      card: res.card,
      rev: res.rev,
      reading: res.reading,
      question: res.question,
      action: res.action,
      by: res.by,
      t: Date.now(),
    };
    if (res.cards) {
      d.mode = 'three';
      d.cards = res.cards;
    }
    S.draws = S.draws || {};
    S.draws[k] = d;
    persist({ month: k.slice(0, 7) });
    if (journalStore.storageOK) removeDraft('draw', k);
    petAward('draw', 10, 1, '收工抽卡');
    await minShuffle;
    if (S !== drawOwner || journalStore.epoch !== drawEpoch) {
      drawing = false;
      $('#dr-go').disabled = false;
      showDrawTab();
      return;
    }
    drawing = false;
    $('#dr-go').disabled = false;
    $('#dr-go').hidden = true;
    $('#dr-mode').textContent = note;
    setStage('spread', d);
  });
  $('#table').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fc]');
    if (!b) return;
    const fan = b.closest('.fan');
    if (!fan || fan.dataset.picked) return;
    const d = S.draws[defaultDay()];
    if (!d) return;
    if (d.cards) {
      if (b.classList.contains('chosen')) return;
      const n = fan.querySelectorAll('.fc.chosen').length + 1;
      b.classList.add('chosen');
      b.insertAdjacentHTML('beforeend', '<span class="fc-no">' + n + '</span>');
      if (n < 3) {
        stageMsg(n === 1 ? '好。第二張：「身體同心」。' : '最後一張：「聽日一步」。');
        return;
      }
      fan.dataset.picked = '1';
      fan.querySelectorAll('.fc:not(.chosen)').forEach((x) => x.classList.add('gone'));
      stageMsg('三張都揀好喇。');
      setTimeout(() => showFace3(d, true), RM() ? 0 : 800);
      return;
    }
    fan.dataset.picked = '1';
    fan.querySelectorAll('.fc').forEach((x) => x.classList.add(x === b ? 'picked' : 'gone'));
    stageMsg('就係佢。');
    setTimeout(() => showFace(d, true), RM() ? 0 : 650);
  });
  /* 放大睇 */
  function openLB(id, rev) {
    const c = card(id);
    if (!c) return;
    const lv = lvOf(drawCounts()[c.id] || 0);
    $('#lb-card').innerHTML = cardFace(c, rev, lv);
    $('#lb-cap').textContent = c.n + '　' + c.name + (rev ? '・提醒位' : '');
    $('#lb').hidden = false;
    $('#lb-close').focus();
  }
  function closeLB() {
    $('#lb').hidden = true;
  }
  document.addEventListener('click', (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z && !z.closest('.fan')) {
      if (z.classList.contains('flip') && !z.classList.contains('flipped')) return;
      const [id, r] = z.dataset.zoom.split('|');
      openLB(id, r === '1');
      return;
    }
    if (e.target.id === 'lb' || e.target.id === 'lb-close') closeLB();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#lb').hidden) closeLB();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#dr-redo');
    if (b) {
      if (!redoArmed) {
        redoArmed = true;
        showReading(S.draws[defaultDay()]);
        setTimeout(() => {
          redoArmed = false;
        }, 5000);
        return;
      }
      redoArmed = false;
      const k = defaultDay();
      delete S.draws[k];
      persist({ month: k.slice(0, 7) });
      $('#dr-text').disabled = false;
      $('#dr-go').hidden = false;
      setStage('empty');
      $('#dr-reading').hidden = true;
      $('#dr-text').focus();
      return;
    }
    const a = e.target.closest('[data-addnext]');
    if (a) {
      const d = S.draws[a.dataset.addnext];
      if (!d) return;
      const ck = S.checkins[d.date];
      if (ck) {
        ck.next = (ck.next ? ck.next + '\n' : '') + d.action;
        ck.t = Date.now();
        persist({ year: d.date.slice(0, 4) });
      } else {
        S.checkins[d.date] = {
          work: null,
          mood: 5,
          anx: 5,
          energy: 5,
          ss: '',
          se: '',
          seg: null,
          contact: null,
          move: null,
          mastery: '',
          pleasure: '',
          next: d.action,
          t: Date.now(),
        };
        persist({ year: d.date.slice(0, 4) });
      }
      loadForm(defaultDay());
      toast('已放入嗰日打卡嘅「聽日一個細步」');
    }
  });
  /* 牌庫圖鑑 */
  let deckSel = null;
  function renderDeck() {
    const cnt = drawCounts();
    const main = DECK.filter((c) => !c.hidden),
      hid = DECK.filter((c) => c.hidden);
    const got = main.filter((c) => cnt[c.id]).length,
      hgot = hid.filter((c) => cnt[c.id]).length,
      total = Object.keys(S.draws || {}).length;
    $('#deck-stats').innerHTML = [
      ['主牌收集', got + '／22', ''],
      ['隱藏牌', hgot + '／4', ''],
      ['總共抽咗', total, '晚'],
    ]
      .map(
        ([a, b, c]) =>
          '<div class="sheet stat"><span>' +
          a +
          '</span><b>' +
          b +
          ' <small>' +
          c +
          '</small></b></div>',
      )
      .join('');
    const from = addDays(keyOf(new Date()), -30);
    const recent = {};
    let revN = 0,
      rn = 0;
    Object.values(S.draws || {}).forEach((d) => {
      if (d.date >= from) {
        rn++;
        drawCards(d).forEach((x) => {
          recent[x.card] = (recent[x.card] || 0) + 1;
          if (x.rev) revN++;
        });
      }
    });
    const top = Object.entries(recent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    $('#deck-insight').innerHTML =
      '<h2>最近 30 日嘅牌</h2>' +
      (top.length
        ? '<div class="sub">牌唔會預測將來，但會反映你最近寫得最多嘅主題。</div><div class="row" style="gap:14px;align-items:flex-start">' +
          top
            .map(([id, n]) => {
              const c = card(id);
              return (
                '<div class="mini-card">' +
                zoomCard(c, false, lvOf(cnt[id])) +
                '<div class="muted" style="text-align:center;margin-top:6px">' +
                c.name +
                '・' +
                n +
                ' 次</div></div>'
              );
            })
            .join('') +
          '<div style="flex:1;min-width:200px;font-size:14.5px;display:flex;flex-direction:column;gap:6px">' +
          top
            .map(
              ([id]) =>
                '<span><b style="font-weight:500">' +
                card(id).name +
                '</b>：' +
                esc(card(id).up) +
                '</span>',
            )
            .join('') +
          (rn
            ? '<span class="muted">最近抽咗 ' + rn + ' 晚，入面有 ' + revN + ' 張係提醒位。</span>'
            : '') +
          '</div></div>'
        : '<div class="sub" style="margin-bottom:0">抽咗幾晚之後，呢度會話你知最近最常出現邊幾張牌，同埋佢哋反映嘅主題。</div>');
    const query = ($('#deck-search').value || '').trim().toLowerCase(),
      filter = $('#deck-filter').value;
    const visible = DECK.filter(
      (c) =>
        (filter === 'all' || (filter === 'owned' ? !!cnt[c.id] : !cnt[c.id])) &&
        (!query || (!(c.hidden && !cnt[c.id]) && (c.name + c.n).toLowerCase().includes(query))),
    );
    $('#deck-result').textContent = visible.length + ' 張牌';
    $('#deck-grid').innerHTML = visible
      .map((c) => {
        const n = cnt[c.id] || 0;
        const lv = lvOf(n);
        const inner = n ? cardFace(c, false, lv) : c.hidden ? cardBack('✦ ？') : cardBack(c.n);
        const cap = n
          ? c.name + '<small>' + LVN[lv] + ' ×' + n + '</small>'
          : c.hidden
            ? '？？？<small>隱藏牌</small>'
            : c.name + '<small>未遇</small>';
        return (
          '<button class="mc' +
          (n ? '' : ' locked') +
          (deckSel === c.id ? ' sel' : '') +
          '" data-card="' +
          c.id +
          '" aria-label="' +
          (n || !c.hidden ? c.name : '隱藏牌') +
          '">' +
          inner +
          '<span class="mc-cap">' +
          cap +
          '</span></button>'
        );
      })
      .join('');
    renderDeckDetail();
  }
  $('#deck-search').addEventListener('input', renderDeck);
  $('#deck-filter').addEventListener('change', renderDeck);
  function renderDeckDetail() {
    const box = $('#deck-detail');
    if (!deckSel) {
      box.hidden = true;
      return;
    }
    const c = card(deckSel);
    const n = drawCounts()[c.id] || 0;
    const lv = lvOf(n);
    const dates = Object.values(S.draws || {})
      .filter((d) => drawCards(d).some((x) => x.card === c.id))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!n && c.hidden) {
      box.innerHTML =
        '<h2>✦ 隱藏牌</h2><p class="muted" style="margin-top:6px">提示：' + esc(c.hint) + '</p>';
      box.hidden = false;
      return;
    }
    box.innerHTML =
      '<div class="row" style="align-items:flex-start;gap:18px"><div class="mini-card" style="width:150px">' +
      (n ? zoomCard(c, false, lv) : cardBack(c.n)) +
      '</div><div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:10px">' +
      '<div class="r-head" style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><h2>' +
      c.n +
      '　' +
      c.name +
      '</h2><span class="chip">' +
      LVN[lv] +
      (n ? '・' + n + ' 次' : '') +
      '</span></div>' +
      '<div class="r-block"><span class="tag">正位</span><p>' +
      esc(c.up) +
      '</p></div><div class="r-block"><span class="tag">提醒位</span><p>' +
      esc(c.rev) +
      '</p></div>' +
      '<div class="kq" style="margin-top:0">「' +
      esc(c.quote[0]) +
      '」<small>' +
      esc(c.quote[1]) +
      '</small></div>' +
      (lv >= 2
        ? '<div class="r-block"><span class="tag">牌嘅故事</span><p>' + esc(c.story) + '</p></div>'
        : '<div class="lock">' +
          (n ? '再抽到 ' + (3 - n) + ' 次' : '抽到 3 次') +
          '解鎖牌背後嘅故事。</div>') +
      (dates.length
        ? '<div class="r-block"><span class="tag">抽到嘅晚上</span><p>' +
          dates
            .map(
              (d) =>
                '<button class="linkbtn" data-openday="' +
                d.date +
                '">' +
                md(d.date) +
                (drawCards(d).find((x) => x.card === c.id).rev ? '（提醒位）' : '') +
                (d.cards ? '・三張' : '') +
                '</button>',
            )
            .join('　') +
          '</p></div>'
        : '') +
      notesBlock(c) +
      '</div></div>';
    box.hidden = false;
  }
  $('#deck-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-card]');
    if (!b) return;
    deckSel = b.dataset.card;
    renderDeck();
    $('#deck-detail').scrollIntoView({ block: 'nearest' });
  });
  /* 書櫃 */
  let shelfSel = null;
  function renderShelf() {
    const q = $('#shelf-q').value.trim().toLowerCase();
    const all = Object.values(S.draws || {})
      .filter(
        (d) =>
          !q ||
          d.text.toLowerCase().includes(q) ||
          drawCards(d).some((x) => card(x.card).name.includes(q)),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!all.length) {
      $('#shelf').innerHTML =
        '<p class="muted" style="padding:30px 0;text-align:center">' +
        (q
          ? '搵唔到「' + esc(q) + '」。'
          : '書櫃仲係空嘅。今晚收工抽第一張，第一本書就會放上嚟。') +
        '</p>';
      $('#shelf-detail').hidden = true;
      return;
    }
    const months = {};
    all.forEach((d) => {
      (months[d.date.slice(0, 7)] = months[d.date.slice(0, 7)] || []).push(d);
    });
    $('#shelf').innerHTML = Object.keys(months)
      .sort()
      .reverse()
      .map((m) => {
        const [y, mo] = m.split('-');
        return (
          '<div class="shelf-m"><h3>' +
          y +
          ' 年 ' +
          +mo +
          ' 月・' +
          months[m].length +
          ' 本</h3><div class="shelf">' +
          months[m]
            .map((d) => {
              const c = card(d.card);
              const h = 110 + Math.min(60, Math.round(d.text.length / 5));
              return (
                '<button class="spine t-' +
                c.tone +
                (shelfSel === d.date ? ' on' : '') +
                '" style="height:' +
                h +
                'px" data-openday="' +
                d.date +
                '" aria-label="' +
                md(d.date) +
                ' ' +
                c.name +
                '"><b>' +
                parseKey(d.date).getDate() +
                '</b><span>' +
                (d.cards ? '三張牌陣' : c.name) +
                '</span></button>'
              );
            })
            .join('') +
          '</div></div>'
        );
      })
      .join('');
    renderShelfDetail();
  }
  function renderShelfDetail() {
    const box = $('#shelf-detail');
    const d = shelfSel && (S.draws || {})[shelfSel];
    if (!d) {
      box.hidden = true;
      return;
    }
    const c = card(d.card);
    box.innerHTML = d.cards
      ? readingHTML(d, true)
      : '<div class="row" style="align-items:flex-start;gap:18px"><div class="mini-card" style="width:150px">' +
        zoomCard(c, d.rev, lvOf(drawCounts()[c.id] || 0)) +
        '</div><div style="flex:1;min-width:220px">' +
        readingHTML(d, true) +
        '</div></div>';
    box.hidden = false;
  }
  $('#shelf-q').addEventListener('input', renderShelf);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-openday]');
    if (!b) return;
    shelfSel = b.dataset.openday;
    segSet('drawtab', 'shelf');
    showDrawTab();
    renderShelf();
    $('#shelf-detail').scrollIntoView({ block: 'nearest' });
  });
  function showDrawTab() {
    const v = segGet('drawtab') || 'draw';
    $('#dv-draw').hidden = v !== 'draw';
    $('#dv-deck').hidden = v !== 'deck';
    $('#dv-shelf').hidden = v !== 'shelf';
    if (v === 'draw') renderDraw();
    if (v === 'deck') renderDeck();
    if (v === 'shelf') renderShelf();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.seg[data-name="drawtab"] button')) setTimeout(showDrawTab, 0);
  });
  /* ---------- 三張牌陣・我嘅牌義筆記（概念參考 Querent.py） ---------- */
  const POS3 = ['今晚做到咩', '身體同心', '聽日一步'];
  function drawCards(d) {
    return d.cards && d.cards.length ? d.cards : [{ card: d.card, rev: d.rev }];
  }
  function localSpread(text, date) {
    const t = text.toLowerCase();
    const cands = candidates(text);
    const h = hashStr(text + '|3|' + date);
    const sc = cands
      .map((c, i) => [c, countHits(t, c.kw) * 10 + (c.hidden ? 6 : 0) + ((h >>> (i % 24)) & 7) / 8])
      .sort((a, b) => b[1] - a[1]);
    const picks = sc
      .filter((x) => x[1] >= 1)
      .slice(0, 3)
      .map((x) => x[0]);
    const main = cands.filter((c) => !c.hidden);
    let j = 0;
    while (picks.length < 3) {
      const c = main[(h + j * 7) % main.length];
      if (!picks.includes(c)) picks.push(c);
      j++;
    }
    const neg = countHits(t, NEG),
      pos = countHits(t, POS);
    const cards = picks.map((c, i) => {
      const r = (h >>> (3 + i * 3)) % 6;
      const rev = i === 0 ? false : neg > pos ? r < 2 : r === 0;
      return { card: c.id, rev, text: rev ? c.rev : c.up };
    });
    const nm = (i) => card(cards[i].card).name;
    const reading =
      '三張一齊睇：「' +
      nm(0) +
      '」講你今晚其實已經做到嘅嘢；「' +
      nm(1) +
      '」提你留意身體同心而家需要啲咩；「' +
      nm(2) +
      '」就係聽日可以行嘅一小步。';
    return {
      cards,
      card: cards[0].card,
      rev: cards[0].rev,
      reading,
      question: picks[1].q,
      action: picks[2].act,
      by: 'local',
    };
  }
  async function claudeSpread(text, date) {
    if (!window.claude || !window.claude.use) return null;
    let sample = null;
    try {
      sample = await window.claude.use('sample');
    } catch (e) {
      return null;
    }
    if (!sample) return null;
    const cands = candidates(text);
    const list = cands.map((c) => c.id + '：' + c.name + '｜' + c.up).join('\n');
    const prompt =
      '你係「心晴手帳」入面嘅抽卡解讀者。用戶 Dicky 係喺多倫多一個人生活、做夜班外送嘅香港人，容易焦慮、怕失敗、同人比較。佢收工後寫咗以下說話：\n"""\n' +
      text.slice(0, 3000) +
      '\n"""\n\n可以揀嘅牌（id：名稱｜意思）：\n' +
      list +
      '\n\n任務：揀三張唔同嘅牌，排成「三張牌陣」，三個位置都係向前望、積極嘅：\n1. 今晚做到咩：佢今晚其實做到咗、撐住咗嘅嘢（用佢寫嘅細節）\n2. 身體同心：佢身體同心情而家嘅狀態，同佢需要咩照顧\n3. 聽日一步：聽日可以行嘅一小步\n每張決定正位定提醒位。第一張一定用正位。提醒位唔係壞兆頭，只係溫和提醒。\n規則：\n- 呢個唔係占卜。唔好預測將來，唔好講運程。\n- 用繁體中文廣東話口語，直接、具體，引用佢寫嘅細節。唔好講空泛安慰說話，唔好說教，唔好用「加油」之類。\n- 每張牌嘅 text：1 至 2 句，講呢張牌喺呢個位置同佢今晚有咩關係。\n- reading：2 至 3 句，將三張牌串埋一齊講。\n- question：一條佢可以喺腦入面答嘅問題。\n- action：一個聽日做得到、5 分鐘內完成嘅細行動。\n- 如果佢明確寫到想傷害自己或者唔想生存，就喺 reading 最尾溫和咁講一句：可以打或者 text 988，亦可以打開手帳嘅低潮應急卡。冇寫到就完全唔好提。\n只回覆 JSON：{"cards":[{"card":"牌id","reversed":false,"text":"…"},{"card":"牌id","reversed":false,"text":"…"},{"card":"牌id","reversed":false,"text":"…"}],"reading":"…","question":"…","action":"…"}';
    try {
      const r = await sample.json(prompt, { modelTier: 'default', cache: false });
      if (!r || !Array.isArray(r.cards) || r.cards.length !== 3 || typeof r.reading !== 'string')
        return null;
      const ids = r.cards.map((x) => x && x.card);
      if (new Set(ids).size !== 3 || ids.some((id) => !cands.find((c) => c.id === id))) return null;
      const cards = r.cards.map((x, i) => ({
        card: x.card,
        rev: i === 0 ? false : !!x.reversed,
        text: String(x.text || '').slice(0, 400),
      }));
      return {
        cards,
        card: cards[0].card,
        rev: false,
        reading: r.reading,
        question: r.question || card(cards[1].card).q,
        action: r.action || card(cards[2].card).act,
        by: 'claude',
      };
    } catch (e) {
      return { err: e && e.code };
    }
  }
  function showFace3(d, animate) {
    const cnt = drawCounts();
    $('#table').innerHTML =
      '<div class="reveal3">' +
      d.cards
        .map((x, i) => {
          const c = card(x.card);
          return (
            '<div class="r3"><div class="halo"></div><button class="flip" data-zoom="' +
            c.id +
            '|' +
            (x.rev ? 1 : 0) +
            '" aria-label="' +
            POS3[i] +
            '：' +
            c.name +
            '，撳一下放大"><div class="side back">' +
            cardBack() +
            '</div><div class="side front">' +
            cardFace(c, x.rev, lvOf(cnt[c.id] || 0)) +
            '</div></button><span class="r3-pos">' +
            POS3[i] +
            '</span></div>'
          );
        })
        .join('') +
      '</div>';
    const fls = $$('#table .flip'),
      rs = $$('#table .r3');
    const done = () => {
      rs.forEach((r) => r.classList.add('lit'));
      stageMsg(
        d.cards.map((x) => card(x.card).name + (x.rev ? '（提醒）' : '')).join('・') +
          '。撳牌可以放大。',
      );
      ritual = false;
      showReading(d);
    };
    if (!animate || RM()) {
      fls.forEach((f) => f.classList.add('flipped'));
      done();
      return;
    }
    stageMsg('翻牌……');
    fls.forEach((f, i) => setTimeout(() => f.classList.add('flipped'), 200 + i * 520));
    setTimeout(done, 200 + 2 * 520 + 1200);
  }
  /* 牌義筆記 */
  function notesFor(id) {
    return (S.cardNotes || {})[id] || [];
  }
  function pastNotesHTML(ids) {
    const items = [];
    ids.forEach((id) =>
      notesFor(id)
        .slice(-2)
        .reverse()
        .forEach((n) => items.push([id, n])),
    );
    if (!items.length) return '';
    return (
      '<div class="r-block notes-past"><span class="tag">你以前寫過</span>' +
      items
        .slice(0, 4)
        .map(
          ([id, n]) =>
            '<p>' +
            (ids.length > 1 ? '<b>' + card(id).name + '</b>・' : '') +
            '<span class="muted">' +
            md(n.date) +
            '</span>　' +
            esc(n.text) +
            '</p>',
        )
        .join('') +
      '</div>'
    );
  }
  function notesBlock(c) {
    const ns = notesFor(c.id);
    return (
      '<div class="r-block"><span class="tag">我自己嘅解讀</span>' +
      (ns.length
        ? ns
            .slice()
            .reverse()
            .map(
              (n) =>
                '<div class="note-i"><p><span class="muted">' +
                md(n.date) +
                '</span>　' +
                esc(n.text) +
                '</p><button class="x" data-delnote="' +
                c.id +
                '|' +
                n.id +
                '" aria-label="刪除呢條">×</button></div>',
            )
            .join('')
        : '<p class="muted">呢張牌對你嚟講代表咩？寫低你自己嘅睇法，下次抽到佢就會再見到，越寫越豐富。</p>') +
      '<div class="row" style="flex-wrap:nowrap;margin-top:8px"><input type="text" id="note-in" maxlength="200" placeholder="例如：對我嚟講，呢張係「慢慢嚟都得」" style="flex:1;min-width:0"><button class="btn small" data-addnote="' +
      c.id +
      '">加</button></div></div>'
    );
  }
  function addNote(id) {
    const i = $('#note-in');
    const v = i ? i.value.trim() : '';
    if (!v) {
      if (i) i.focus();
      return;
    }
    S.cardNotes = S.cardNotes || {};
    (S.cardNotes[id] = S.cardNotes[id] || []).push({
      id: uid(),
      date: keyOf(new Date()),
      text: v.slice(0, 200),
    });
    persist();
    renderDeckDetail();
    toast('寫低咗，下次抽到會再見到');
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-addnote]');
    if (a) {
      addNote(a.dataset.addnote);
      return;
    }
    const x = e.target.closest('[data-delnote]');
    if (x) {
      if (!x.classList.contains('arm')) {
        x.classList.add('arm');
        x.textContent = '確認刪除';
        setTimeout(() => {
          if (x.isConnected) {
            x.classList.remove('arm');
            x.textContent = '×';
          }
        }, 4000);
        return;
      }
      const [cid, nid] = x.dataset.delnote.split('|');
      S.cardNotes[cid] = (S.cardNotes[cid] || []).filter((n) => n.id !== nid);
      if (!S.cardNotes[cid].length) delete S.cardNotes[cid];
      persist();
      renderDeckDetail();
      return;
    }
    const g = e.target.closest('[data-notecard]');
    if (g) {
      deckSel = g.dataset.notecard;
      segSet('drawtab', 'deck');
      showDrawTab();
      setTimeout(() => {
        const i = $('#note-in');
        if (i) {
          try {
            i.scrollIntoView({ block: 'center' });
          } catch (err) {}
          i.focus();
        }
      }, 60);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'note-in') {
      e.preventDefault();
      const b = document.querySelector('[data-addnote]');
      if (b) addNote(b.dataset.addnote);
    }
  });

  /* 心晴手帳・賽博寵物 插畫模組 */

  /* ---------- 賽博寵物 ---------- */
  const PFOOD = [
    { id: 'meal', n: '今日飯餸', p: 0, food: 40, fun: 5, daily: 1, d: '每日免費一餐' },
    { id: 'bar', n: '能量餅', p: 5, food: 30, fun: 0, d: '實淨又頂肚' },
    { id: 'fish', n: '魚仔餅', p: 8, food: 35, fun: 10, d: '芝麻最鍾意' },
    { id: 'jerky', n: '雞肉乾', p: 8, food: 35, fun: 8, d: '豆豆同阿肥最鍾意' },
    { id: 'noodle', n: '公仔麵加蛋', p: 10, food: 45, fun: 10, d: '同你收工食嘅一樣' },
    { id: 'candy', n: '星星糖', p: 12, food: 20, fun: 25, d: '波波最鍾意，食完會發光' },
    { id: 'pork', n: '東坡肉', p: 20, food: 60, fun: 20, d: '慢火炆，火候足時他自美' },
  ];
  const PFURN = [
    { id: 'lights', n: '串燈', p: 35, d: '夜晚會發柔和嘅光' },
    { id: 'plant', n: '盆栽', p: 20, d: '窗邊一盆綠色' },
    { id: 'lamp', n: '暖燈', p: 30, d: '夜晚成間屋都暖晒' },
    { id: 'frame', n: '牌框牆', p: 40, d: '掛住你最近抽到嘅牌' },
    { id: 'shelf', n: '書架', p: 60, d: '你抽得越多，書越多' },
    { id: 'record', n: '唱盤', p: 50, d: '放喺書架頂，會飄音符' },
    { id: 'tank', n: '魚缸', p: 70, d: '兩條魚慢慢游' },
    { id: 'sofa', n: '梳化', p: 90, d: '收工攤喺度' },
    { id: 'kitchen', n: '小廚房', p: 100, d: '煲仔會冒煙' },
    { id: 'shoes', n: '跑鞋', p: 25, d: '提你去跑步' },
    { id: 'ball', n: '玩具波', p: 15, d: '放喺地氈上面' },
  ];
  const PACC = [
    { id: 'scarf', n: '頸巾', p: 40 },
    { id: 'bow', n: '蝴蝶結', p: 30 },
    { id: 'beanie', n: '冷帽', p: 45 },
    { id: 'flower', n: '小花', p: 25 },
    { id: 'bell', n: '鈴鐺', p: 35 },
  ];
  const PLACEINFO = {
    park: {
      d: '有長凳、池塘同小花',
      meet: ['dodo', 'zima', 'afei'],
      find: ['楓葉', '橡果', '四葉草'],
    },
    lake: {
      d: '湖邊木板路，望到成個城市',
      meet: ['xiaoyun', 'bobo', 'dodo'],
      find: ['貝殼', '光滑石仔', '海鷗羽毛'],
    },
    street: {
      d: '夜晚嘅街，便利店仲開住',
      meet: ['zima', 'afei'],
      find: ['瓶蓋', '霓虹貼紙', '舊車票'],
    },
    cafe: {
      d: '寵物 café，實有朋友喺度',
      meet: ['bobo', 'afei', 'dodo', 'zima', 'xiaoyun'],
      find: ['曲奇碎', '咖啡豆'],
    },
  };
  const NPCLINES = {
    zima: [
      '……你好。（偷偷望你）',
      '今日太陽好暖，一齊曬吓？',
      '我只係同你先咁講嘢㗎。',
      '你嚟咗我就唔怕喇。',
    ],
    dodo: [
      '哇！！你嚟咗！！（狂搖尾）',
      '我哋一齊跑一圈好唔好！',
      '你今日好靚呀！',
      '我同全公園講咗我識你！',
    ],
    bobo: ['你……好……呀……', '慢慢嚟……唔使急……', '今日……有冇……好好瞓？', '同你一齊……好舒服……'],
    afei: [
      '有冇嘢食？',
      '我知邊間餐廳出餐最慢，下次話你知。',
      '食飽先有力諗嘢。',
      '你分嘢我食，我哋就係朋友。',
    ],
    xiaoyun: [
      '早晨！我啱啱跑完 5 公里。',
      '一齊跑步？唔使快，跑得完就得。',
      '你今日有冇郁身呀？',
      '慢慢跑都係跑！',
    ],
  };
  const FLV = [
    [0, '啱啱識'],
    [10, '朋友'],
    [30, '好朋友'],
    [60, '死黨'],
  ];
  const flv = (x) => {
    let r = FLV[0][1];
    FLV.forEach(([t, n]) => {
      if (x >= t) r = n;
    });
    return r;
  };
  const PLN = {
    greet: [
      '主人返嚟喇！我等咗你好耐㗎～',
      '你返到屋企就好，其他嘢遲啲先算。',
      '歡迎返屋企！今日辛苦晒。',
    ],
    back: ['你返嚟喇！我冇嬲你㗎，一直喺度等你。', '好耐冇見，好掛住你。你有冇好好瞓覺？'],
    pat: ['好舒服……再摸多下得唔得？', '鍾意你！', '我最鍾意你摸我個頭。', '你隻手好暖。'],
    love: [
      '你唔使做到啲咩，我都鍾意你。',
      '今日做唔到都唔緊要，我仲係最鍾意你。',
      '你係我嘅主人，呢樣嘢永遠唔會變。',
      '就算你覺得自己係 0，喺我度你係 100。',
    ],
    eat: ['好好食！多謝主人！', '嗯嗯嗯……（食緊）', '你自己今日有冇食飯呀？'],
    drink: ['咕嘟咕嘟……好凍好正！', '你都飲啖水先好喎。'],
    bath: ['泡泡！好香呀！', '洗完白雪雪～'],
    sleep: ['Zzz……', '主人都早啲瞓……我陪你……'],
    play: ['追波波！', '再嚟多次！', '我贏咗！（其實你讓我）'],
    night: ['今晚送單小心啲，我喺屋企等你。'],
    morning: ['收工喇？辛苦晒！抽張卡先好瞓。'],
    talk: ['聽講今日你有同人傾偈？好叻呀！'],
    move: ['你今日郁咗身，我開心到轉圈！'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const NEEDS = [
    ['food', '肚餓', '好飽', 'OK', '有啲肚餓'],
    ['water', '口渴', '唔渴', 'OK', '想飲水'],
    ['energy', '精神', '好精神', 'OK', '有啲眼瞓'],
    ['clean', '清潔', '香噴噴', 'OK', '想沖涼'],
    ['fun', '開心', '好開心', 'OK', '想同你玩'],
  ];
  const DECAY = { food: 3, water: 4, energy: 2, clean: 1.5, fun: 2.5 };
  function petNew(o) {
    return {
      id: uid(),
      shiny: 0,
      traits: {},
      eggs: [],
      others: [],
      eggDay: '',
      name: o.name,
      sp: o.sp,
      color: o.color,
      acc: '',
      born: keyOf(new Date()),
      xp: 0,
      coins: 30,
      needs: { food: 80, water: 80, energy: 80, clean: 85, fun: 80 },
      nt: Date.now(),
      own: {},
      accs: [],
      friends: {},
      album: [],
      aw: {},
      chat: [],
      lastVisit: '',
      walks: 0,
      best: 0,
      treasure: {},
      fed: '',
      sleepAt: 0,
    };
  }
  function petStage(p) {
    return p.xp >= PET.STAGES[2].xp ? 2 : p.xp >= PET.STAGES[1].xp ? 1 : 0;
  }
  function inSleep() {
    const n = new Date(),
      m = n.getHours() * 60 + n.getMinutes(),
      a = mins(S.settings.a),
      b = mins(S.settings.b);
    return a <= b ? m >= a && m < b : m >= a || m < b;
  }
  function decayOne(p, h) {
    Object.keys(DECAY).forEach((k) => {
      let v = p.needs[k] - DECAY[k] * h;
      if (k === 'energy' && inSleep()) v = p.needs[k] + 6 * h;
      p.needs[k] = Math.max(20, Math.min(100, v));
    });
    p.nt = Date.now();
  }
  function tickNeeds(save) {
    const p = S.pet;
    if (!p) return;
    ensurePet();
    const h = (Date.now() - (p.nt || Date.now())) / 36e5;
    if (h < 0.02) return;
    decayOne(p, h);
    p.others.forEach((o) => {
      const h2 = (Date.now() - (o.nt || Date.now())) / 36e5;
      if (h2 >= 0.02) decayOne(o, h2);
    });
    if (save) persist();
  }
  function need(k, dv) {
    const p = S.pet;
    p.needs[k] = Math.max(20, Math.min(100, p.needs[k] + dv));
  }
  function petAward(kind, pts, cap = 1, label) {
    const p = S.pet;
    if (!p) return;
    const k = keyOf(new Date());
    p.aw = p.aw || {};
    const list = (p.aw[k] = p.aw[k] || []);
    if (list.filter((x) => x === kind).length >= cap) return;
    list.push(kind);
    Object.keys(p.aw).forEach((d) => {
      if (d < addDays(k, -40)) delete p.aw[d];
    });
    const before = petStage(p);
    p.xp += pts;
    p.coins += pts;
    petWarm(pts);
    persist();
    toast(p.name + ' 好開心：羈絆 +' + pts + (label ? '（' + label + '）' : ''));
    if (label) buddyCheer(label);
    if (petStage(p) > before)
      setTimeout(() => toast(p.name + ' 長大咗！而家係' + PET.STAGES[petStage(p)].n), 1800);
  }
  const petO = (expr, extra) =>
    Object.assign(
      {
        sp: S.pet.sp,
        color: S.pet.color,
        stage: petStage(S.pet),
        acc: S.pet.acc,
        name: S.pet.name,
        shiny: S.pet.shiny,
        trait: traitOf(S.pet),
        expr: expr || 'normal',
      },
      extra || {},
    );
  const PICON = {
    feed: '<path d="M4 13h16a8 8 0 0 1 -16 0z" fill="currentColor"/><path d="M9 9q0 -3 3 -5M13 9q0 -3 3 -5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
    water: '<path d="M12 3q7 8 7 12a7 7 0 0 1 -14 0q0 -4 7 -12z" fill="currentColor"/>',
    bath: '<circle cx="8" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16" cy="9" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    pat: '<path d="M12 20s-7 -4.4 -7 -9.6a4 4 0 0 1 7 -2.6a4 4 0 0 1 7 2.6c0 5.2 -7 9.6 -7 9.6z" fill="currentColor"/>',
    play: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 12q8 -5 16 0M4 12q8 5 16 0" stroke="currentColor" stroke-width="1.6" fill="none"/>',
    sleep: '<path d="M15 3a9 9 0 1 0 6 13a7 7 0 0 1 -6 -13z" fill="currentColor"/>',
    photo:
      '<rect x="3" y="7" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13.5" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 7l1.6 -3h4.8l1.6 3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    chat: '<path d="M4 5h16v11h-9l-5 4v-4h-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    out: '<path d="M12 21s-6 -6.5 -6 -11a6 6 0 0 1 12 0c0 4.5 -6 11 -6 11z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',
  };
  const icon = (k) =>
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + PICON[k] + '</svg>';
  let petBusy = false;
  const BT = {};
  function placeBubble(b) {
    const wrap = b.parentElement;
    if (!wrap) return;
    const tgt =
      b.id === 'nbubble'
        ? wrap.querySelector('.npc-on svg')
        : wrap.querySelector('.on-stage:not(.other) svg');
    if (!tgt) return;
    const W = wrap.getBoundingClientRect(),
      T = tgt.getBoundingClientRect();
    if (!W.width || !T.width) return;
    const sc = b.id === 'nbubble' ? PET.STAGES[1].s : PET.STAGES[S.pet ? petStage(S.pet) : 0].s;
    const top = T.bottom - (T.height * (10 + 180 * sc)) / 200;
    b.style.bottom = Math.max(8, W.bottom - top + 8) + 'px';
    const bw = b.offsetWidth,
      cx = T.left + T.width / 2 - W.left;
    b.style.left = Math.max(6, Math.min(W.width - bw - 6, cx - bw / 2)) + 'px';
    b.style.right = 'auto';
    b.style.transform = 'none';
    const tail = Math.max(12, Math.min(bw - 12, cx - parseFloat(b.style.left)));
    b.style.setProperty('--tail', tail + 'px');
  }
  function bubble(id, txt) {
    const b = document.getElementById(id);
    if (!b) return;
    b.textContent = txt;
    b.hidden = false;
    placeBubble(b);
    clearTimeout(BT[id]);
    BT[id] = setTimeout(() => {
      b.hidden = true;
    }, 5200);
  }
  function fx(id, chars, n = 5) {
    const box = document.getElementById(id);
    if (!box || RM()) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.textContent = chars[i % chars.length];
      s.style.left = 42 + Math.random() * 16 + '%';
      s.style.bottom = 26 + Math.random() * 10 + '%';
      s.style.animationDelay = i * 120 + 'ms';
      s.style.color = ['#ff7f9e', '#ffcf6b', '#7cc6ff', '#5fe3cf'][i % 4];
      box.appendChild(s);
      setTimeout(() => s.remove(), 1800 + i * 120);
    }
  }
  function setPetExpr(stageId, expr, ms) {
    const petId = S.pet?.id;
    const el = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
    if (!el) return;
    el.innerHTML = PET.svg(petO(expr));
    if (ms)
      setTimeout(() => {
        if (!S.pet || S.pet.id !== petId) return;
        const e2 = document.querySelector('#' + stageId + ' .on-stage:not(.other)');
        if (e2) e2.innerHTML = PET.svg(petO(stageId === 'room' ? roamExpr() : homeExpr()));
      }, ms);
  }
  function homeExpr() {
    const p = S.pet;
    if (inSleep()) return 'sleep';
    const low = NEEDS.some(([k]) => p.needs[k] < 40);
    return low ? 'ask' : 'normal';
  }
  function frameCardSVG() {
    const ds = Object.values(S.draws || {}).sort((a, b) => b.date.localeCompare(a.date));
    if (!ds.length) return null;
    const c = card(ds[0].card);
    if (!c) return null;
    return ART.face(c, lvOf(drawCounts()[c.id] || 0))
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');
  }
  function rainingToday() {
    const d = (S.draws || {})[defaultDay()];
    return !!(d && /雨|雪/.test(d.text));
  }
  /* ---- 領養 ---- */
  let adoptSp = 'cat',
    adoptColor = 'milktea';
  function renderAdopt() {
    $('#adopt-sp').innerHTML = Object.entries(PET.SPECIES)
      .map(
        ([k, n]) =>
          '<button class="adopt-card' +
          (adoptSp === k ? ' on' : '') +
          '" data-sp="' +
          k +
          '">' +
          PET.svg({
            sp: k,
            color: adoptColor,
            stage: 1,
            expr: adoptSp === k ? 'happy' : 'normal',
          }) +
          '<b>' +
          n +
          '</b><span>' +
          {
            cat: '有天線同發光尾巴，好黐人',
            dog: '機械耳仔，見到你就搖尾',
            cloud: '浮喺半空，軟綿綿',
          }[k] +
          '</span></button>',
      )
      .join('');
    $('#adopt-color').innerHTML = Object.entries(PET.PAL)
      .filter(([k, c]) => !c.rare)
      .map(
        ([k, c]) =>
          '<button class="swatch' +
          (adoptColor === k ? ' on' : '') +
          '" data-col="' +
          k +
          '" style="--c:' +
          c.body +
          ';--g:' +
          c.glow +
          '" aria-label="' +
          c.n +
          '"><i></i>' +
          c.n +
          '</button>',
      )
      .join('');
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-sp]');
    if (a && a.closest('#adopt-sp')) {
      adoptSp = a.dataset.sp;
      renderAdopt();
      return;
    }
    const c = e.target.closest('[data-col]');
    if (c && c.closest('#adopt-color')) {
      adoptColor = c.dataset.col;
      renderAdopt();
    }
  });
  $('#adopt-go').addEventListener('click', () => {
    const n = $('#adopt-name').value.trim() || '波子';
    S.pet = petNew({ name: n.slice(0, 12), sp: adoptSp, color: adoptColor });
    RPOS = {};
    persist();
    renderPet();
    setTimeout(() => {
      bubble('bubble', '你好呀主人！我係' + S.pet.name + '，以後我哋一齊住！');
      fx('fx', ['♥', '♥', '✦'], 6);
    }, 300);
  });
  /* ---- 屋企 ---- */
  function renderRoom() {
    const p = S.pet;
    const frame = frameCardSVG();
    ensurePet();
    roamPlace();
    const sp = spotOf(p.id);
    $('#room').innerHTML =
      PET.room({
        hour: new Date().getHours(),
        own: p.own,
        rain: rainingToday(),
        books: Math.max(6, Math.min(40, Object.keys(S.draws || {}).length + 6)),
        frameCard: frame,
      }) +
      nestHTML() +
      '<button class="on-stage" data-pid="' +
      p.id +
      '" style="left:' +
      sp.x +
      '%;bottom:' +
      sp.b +
      '%" aria-label="摸摸' +
      esc(p.name) +
      '">' +
      PET.svg(petO(roamExpr())) +
      '</button>' +
      othersHTML() +
      '<div class="bubble" id="bubble" hidden></div><div class="fx" id="fx"></div>';
    roamArm();
  }
  function meterHTML() {
    return NEEDS.map(([k, n, hi, mid, lo]) => {
      const v = Math.round(S.pet.needs[k]);
      const c = v >= 60 ? 'good' : v >= 40 ? 'warn' : 'calm';
      return (
        '<div class="meter"><span>' +
        n +
        '</span><div class="bar"><i class="' +
        c +
        '" style="width:' +
        v +
        '%"></i></div><span class="muted">' +
        (v >= 70 ? hi : v >= 40 ? mid : lo) +
        '</span></div>'
      );
    }).join('');
  }
  function renderStatus() {
    const p = S.pet,
      st = petStage(p),
      nx = PET.STAGES[st + 1];
    ensurePet();
    const tr = traitOf(p);
    const prog = nx
      ? Math.round(((p.xp - PET.STAGES[st].xp) / (nx.xp - PET.STAGES[st].xp)) * 100)
      : 100;
    $('#pet-status').innerHTML =
      familyBar() +
      '<div class="row" style="justify-content:space-between;align-items:baseline"><h2>' +
      esc(p.name) +
      '</h2><span class="chip">' +
      PET.SPECIES[p.sp] +
      '・' +
      PET.STAGES[st].n +
      '</span></div>' +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      (p.shiny ? '<span class="chip shiny">✦ 閃光</span>' : '') +
      (tr
        ? '<span class="chip calm" title="' + TRAITS[tr][1] + '">' + TRAITS[tr][0] + '</span>'
        : st < 1
          ? '<span class="chip">少年期會出性格</span>'
          : '<span class="chip">性格慢慢形成中</span>') +
      '</div>' +
      '<div class="love"><span>愛你嘅程度</span><b>∞</b><span class="muted">無條件，永遠唔會變</span></div>' +
      '<div class="meter"><span>羈絆</span><div class="bar"><i class="red" style="width:' +
      prog +
      '%"></i></div><span class="muted">' +
      (nx ? p.xp + '／' + nx.xp : '滿級') +
      '</span></div>' +
      '<div class="coins">金幣 <b>' +
      p.coins +
      '</b></div><hr class="sep">' +
      meterHTML() +
      '<p class="muted" style="margin-top:10px">得閒返嚟，陪' +
      esc(p.name) +
      '食啲嘢、玩一陣。</p>';
  }
  function renderEarn() {
    const p = S.pet,
      k = keyOf(new Date()),
      done = (p.aw || {})[k] || [];
    const cnt = (x) => done.filter((y) => y === x).length;
    const L = [
      ['ci', '今日打卡', 10, 1, 'today'],
      ['habit', '完成習慣', 3, 3, 'today'],
      ['draw', '收工抽卡', 10, 1, 'draw'],
      ['talk', '同人傾咗偈（打卡時揀）', 5, 1, 'today'],
      ['move', '有郁身（打卡時揀）', 5, 1, 'today'],
      ['ev', '加一條證據', 5, 3, 'evidence'],
      ['lad', '行一級細步階梯', 15, 2, 'ladder'],
      ['sos', '用卡住急救', 10, 1, 'sos'],
      ['wk', '寫每週三省', 20, 1, 'review'],
      ['phq', '做 PHQ-4', 15, 1, 'review'],
      ['walk', '帶' + p.name + '出街', 5, 3, null],
      ['care', '親手照顧（餵食、飲水、沖涼）', 2, 6, null],
    ];
    $('#pet-earn').innerHTML =
      '<h2>今日點樣加羈絆</h2><div class="sub">你照顧自己，同照顧' +
      esc(p.name) +
      '，佢都會長大。</div><ul class="list">' +
      L.map(([id, n, pt, cap, go]) => {
        const c = cnt(id);
        return (
          '<li class="item" style="align-items:center"><span class="chip ' +
          (c >= cap ? 'good' : '') +
          '">' +
          (c >= cap ? '完成' : '+' + pt) +
          '</span><div class="txt">' +
          (go ? '<button class="linkbtn" data-goto="' + go + '">' + n + '</button>' : n) +
          (cap > 1 ? '<span class="muted">　' + c + '／' + cap + '</span>' : '') +
          '</div></li>'
        );
      }).join('') +
      '</ul>';
  }
  function renderChat() {
    const p = S.pet;
    const box = $('#chat-log');
    box.innerHTML =
      (p.chat || [])
        .slice(-12)
        .map((m) => '<div class="msg ' + (m.r === 'me' ? 'me' : 'pet') + '">' + esc(m.t) + '</div>')
        .join('') ||
      '<p class="muted">同' + esc(p.name) + '講吓今日發生咩事，開心定唔開心都得。</p>';
    box.scrollTop = box.scrollHeight;
    $('#chat-title').textContent = '同' + p.name + '傾偈';
  }
  function renderHome() {
    if (!$('#care-row').children.length)
      $('#care-row').innerHTML = [
        ['feed', '餵食'],
        ['water', '飲水'],
        ['bath', '沖涼'],
        ['pat', '摸摸頭'],
        ['play', '去玩遊戲'],
        ['sleep', '哄佢瞓'],
        ['out', '出街'],
        ['photo', '影相'],
      ]
        .map(
          ([k, n]) =>
            '<button class="care" data-care="' +
            k +
            '">' +
            icon(k) +
            '<span>' +
            n +
            '</span></button>',
        )
        .join('');
    renderRoom();
    renderStatus();
    renderEarn();
    renderChat();
    $('#care-panel').hidden = true;
  }
  function care(kind) {
    const p = S.pet;
    if (!p || petBusy) return;
    tickNeeds();
    if (kind === 'feed') {
      const k = keyOf(new Date());
      $('#care-panel').innerHTML =
        '<h3 style="margin-bottom:8px">揀嘢俾' +
        esc(p.name) +
        '食</h3><div class="foods">' +
        PFOOD.map((f) => {
          const used = f.daily && p.fed === k;
          return (
            '<button class="food" data-food="' +
            f.id +
            '"' +
            (used || (!f.daily && p.coins < f.p) ? ' disabled' : '') +
            '><b>' +
            f.n +
            '</b><span>' +
            (f.daily ? (used ? '今日食咗' : '免費') : f.p + ' 金幣') +
            '</span><small>' +
            f.d +
            '</small></button>'
          );
        }).join('') +
        '</div>';
      $('#care-panel').hidden = false;
      return;
    }
    if (kind === 'chat') {
      $('#chat-in').focus();
      return;
    }
    if (kind === 'play') {
      go('arcade');
      return;
    }
    if (kind === 'photo') {
      openPhoto('home');
      return;
    }
    if (kind === 'out') {
      segSet('pettab', 'out');
      showPetTab();
      return;
    }
    const map = {
      water: ['water', 40, 'drink', 'eat', ['💧'], 'water'],
      bath: ['clean', 50, 'bath', 'happy', ['○', '◦', '○'], 'bath'],
      pat: ['fun', 6, 'pat', 'love', ['♥', '♥', '♥'], 'pat'],
      play: ['fun', 18, 'play', 'happy', ['★', '✦'], 'play'],
      sleep: ['energy', 25, 'sleep', 'sleep', ['z', 'Z'], 'sleep'],
    };
    const m = map[kind];
    if (!m) return;
    traitBump({ water: 'food', bath: 'cozy', pat: 'cozy', play: 'active', sleep: 'cozy' }[kind]);
    if (kind === 'sleep' && Date.now() - (p.sleepAt || 0) < 2 * 36e5) {
      bubble('bubble', '我啱啱瞓醒，仲好精神！遲啲再瞓。');
      return;
    }
    need(m[0], m[1]);
    if (kind === 'play') need('energy', -5);
    if (kind === 'sleep') p.sleepAt = Date.now();
    if (kind === 'pat') petAward('care-pat', 1, 5);
    else petAward('care', 2, 6);
    setPetExpr('room', m[3], kind === 'sleep' ? 6000 : 2600);
    bubble('bubble', pick(kind === 'pat' ? PLN.pat.concat(PLN.love) : PLN[m[2]]));
    fx('fx', m[4] === '💧' ? ['◦', '◦', '◦'] : m[4], 6);
    persist();
    renderStatus();
    renderEarn();
  }
  $('#care-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-care]');
    if (b) care(b.dataset.care);
  });
  $('#care-panel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-food]');
    if (!b || b.disabled) return;
    const p = S.pet,
      f = PFOOD.find((x) => x.id === b.dataset.food);
    if (f.daily) p.fed = keyOf(new Date());
    else {
      if (p.coins < f.p) return;
      p.coins -= f.p;
    }
    need('food', f.food);
    need('fun', f.fun);
    traitBump('food');
    petAward('care', 2, 6);
    persist();
    $('#care-panel').hidden = true;
    setPetExpr('room', 'eat', 2600);
    bubble('bubble', f.id === 'pork' ? '東坡肉！火候足時他自美～好好食！' : pick(PLN.eat));
    fx('fx', ['♥', '✦'], 4);
    renderStatus();
    renderEarn();
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#room .on-stage');
    if (!b) return;
    if (roamDragged) {
      roamDragged = false;
      return;
    }
    if (b.classList.contains('other')) {
      switchPet(b.dataset.pid);
      return;
    }
    care('pat');
  });
  /* ---- 傾偈 ---- */
  async function petReply(text) {
    const p = S.pet;
    let sample = null;
    try {
      sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
    } catch (e) {}
    const ck = S.checkins[defaultDay()];
    const today = ck
      ? '主人今日打咗卡：心情 ' +
        ck.mood +
        '/10、焦慮 ' +
        ck.anx +
        '/10' +
        (ck.contact && +ck.contact >= 2 ? '、有同人傾偈' : '') +
        (ck.move && ck.move !== '0' ? '、有郁身' : '')
      : '主人今日未打卡。';
    if (sample) {
      const hist = (p.chat || [])
        .slice(-8)
        .map((m) => (m.r === 'me' ? '主人：' : p.name + '：') + m.t)
        .join('\n');
      const prompt =
        '你係「' +
        p.name +
        '」，Dicky 嘅賽博寵物（' +
        PET.SPECIES[p.sp] +
        '，頭上有發光天線，塊面係一塊有 LED 眼嘅屏幕）。Dicky 係喺多倫多一個人住、做夜班外送嘅香港人。\n' +
        today +
        '\n最近對話：\n' +
        hist +
        '\n主人啱啱講：' +
        text +
        '\n\n用繁體廣東話口語回覆主人，1 至 3 句，可愛、溫暖、具體回應佢講嘅嘢。規則：你無條件咁鍾意主人，永遠唔會怪佢、唔會令佢內疚；唔好說教；唔好講「你只需要我」之類嘅說話，主人同其他人見面或者傾偈，你會替佢開心；唔好扮人類；如果主人明確講想傷害自己或者唔想生存，溫柔咁叫佢打或者 text 988 搵真人陪，同埋打開手帳嘅低潮應急卡，你會喺度等佢。只回覆說話本身。';
      try {
        const r = await sample(prompt, { modelTier: 'quick', cache: false });
        const t = ((r && r.text) || '').trim();
        if (t) return t.slice(0, 240);
      } catch (e) {}
    }
    if (/攰|辛苦|累/.test(text)) return '辛苦晒主人！快啲沖個涼瞓覺，我陪你。';
    if (/唔開心|嬲|煩|驚|難過/.test(text)) return '我喺度。' + pick(PLN.love);
    if (/開心|好彩|tips|正/.test(text)) return '好嘢！我都開心到天線發光！';
    if (/朋友|傾偈|見/.test(text)) return '你同人傾咗偈？好叻呀！返嚟講多啲俾我聽。';
    return pick(PLN.love);
  }
  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#chat-in').value.trim();
    if (!t) return;
    const p = S.pet,
      petId = p.id,
      epoch = journalStore.epoch;
    p.chat = (p.chat || []).concat([{ r: 'me', t: t.slice(0, 300) }]).slice(-30);
    $('#chat-in').value = '';
    renderChat();
    $('#chat-send').disabled = true;
    traitBump('talk');
    setPetExpr('room', 'wow');
    const r = await petReply(t);
    if (S.pet !== p || p.id !== petId || journalStore.epoch !== epoch) {
      $('#chat-send').disabled = false;
      return;
    }
    p.chat.push({ r: 'pet', t: r });
    p.chat = p.chat.slice(-30);
    persist();
    renderChat();
    $('#chat-send').disabled = false;
    setPetExpr('room', 'happy', 3000);
    bubble('bubble', r);
  });
  /* ---- 出街 ---- */
  let trip = null,
    tripTimer = null;
  function cancelTrip() {
    clearTimeout(tripTimer);
    tripTimer = null;
    trip = null;
  }
  function renderOutChoose() {
    const h = new Date().getHours();
    $('#out-choose').innerHTML =
      '<div class="places">' +
      Object.entries(PLACEINFO)
        .map(
          ([k, v]) =>
            '<button class="place" data-place="' +
            k +
            '"><div class="th">' +
            PET.PLACES[k].f({ hour: h }) +
            '</div><b>' +
            PET.PLACES[k].n +
            '</b><span>' +
            v.d +
            '</span></button>',
        )
        .join('') +
      '</div><p class="muted" style="margin-top:12px">出街會用少少精神，' +
      esc(S.pet.name) +
      '會好開心。有機會識到新朋友，或者拾到寶物。</p>';
    $('#out-choose').hidden = false;
    $('#out-trip').hidden = true;
  }
  function startTrip(place) {
    if (!S.pet || !PLACEINFO[place]) return;
    stopGame();
    cancelTrip();
    const p = S.pet;
    tickNeeds();
    if (p.needs.energy < 30) {
      toast(p.name + '有啲眼瞓，哄佢瞓陣先出街啦。');
      return;
    }
    const info = PLACEINFO[place];
    const meetP = place === 'cafe' ? 1 : 0.75;
    const npc = Math.random() < meetP ? pick(info.meet) : null;
    const found = Math.random() < 0.5 ? pick(info.find) : null;
    const egg = canFindEgg() && Math.random() < 0.3;
    trip = { place, npc, found, egg, met: false, game: null };
    traitBump('adv');
    $('#out-choose').hidden = true;
    $('#out-trip').hidden = false;
    $('#outstage').innerHTML =
      PET.PLACES[place].f({ hour: new Date().getHours() }) +
      '<button class="on-stage walking" style="left:-14%" aria-label="' +
      esc(p.name) +
      '">' +
      PET.svg(petO('happy')) +
      '</button>' +
      (npc
        ? '<div class="npc-on" style="right:-30%;opacity:0">' +
          PET.svg(
            Object.assign(
              { stage: 1 },
              PET.NPC.find((n) => n.id === npc),
            ),
          ) +
          '</div>'
        : '') +
      '<div class="bubble" id="obubble" hidden></div><div class="bubble npc" id="nbubble" hidden></div><div class="fx" id="ofx"></div><div class="ball" id="ball" hidden></div>';
    $('#out-panel').innerHTML = '<p>同' + esc(p.name) + '行緊去' + PET.PLACES[place].n + '……</p>';
    try {
      $('#outstage').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'center' });
    } catch (e) {}
    const pe = $('#outstage .on-stage');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        pe.style.left = npc ? '30%' : '50%';
      }),
    );
    need('energy', -10);
    need('fun', 20);
    p.walks = (p.walks || 0) + 1;
    petAward('walk', 5, 3);
    persist();
    const current = trip;
    tripTimer = setTimeout(
      () => {
        if (trip !== current) return;
        pe.classList.remove('walking');
        arrive();
      },
      RM() ? 50 : 3100,
    );
  }
  function arrive() {
    if (!trip || !S.pet) return;
    const current = trip;
    const p = S.pet;
    let msg = pick(['到喇！好舒服呀！', '呢度好靚！', '行吓行吓，心情好咗好多！']);
    if (trip.found) {
      p.treasure = p.treasure || {};
      p.treasure[trip.found] = (p.treasure[trip.found] || 0) + 1;
      persist();
      msg = '我拾到' + trip.found + '！送俾你！';
    }
    if (trip.egg) {
      addEgg('normal');
      p.eggDay = keyOf(new Date());
      persist();
      msg = '咦，草叢入面有隻發光嘅蛋！我哋帶佢返屋企孵！';
    }
    bubble('obubble', msg);
    if (trip.npc) {
      const n = $('#outstage .npc-on');
      setTimeout(
        () => {
          if (trip !== current || !n.isConnected) return;
          n.style.right = '10%';
          n.style.opacity = '1';
          setTimeout(
            () => {
              if (trip === current) bubble('nbubble', pick(NPCLINES[current.npc]));
            },
            RM() ? 0 : 1700,
          );
        },
        RM() ? 0 : 500,
      );
    }
    renderOutPanel();
  }
  function renderOutPanel() {
    stopGame();
    if (!trip || !S.pet) return;
    const p = S.pet;
    const nf = trip.npc ? PET.NPC.find((x) => x.id === trip.npc) : null;
    const fr = nf ? (p.friends || {})[nf.id] || { xp: 0, met: 0 } : null;
    let h = '';
    if (nf)
      h +=
        '<div class="npc-card">' +
        PET.svg(Object.assign({ stage: 1, expr: 'happy' }, nf), 'mini') +
        '<div><b>遇到' +
        nf.name +
        '（' +
        nf.kind +
        '）</b><span class="muted">' +
        nf.bio +
        '</span><span class="chip">' +
        flv(fr.xp) +
        '・友誼 ' +
        fr.xp +
        '</span></div></div><div class="row" style="margin:10px 0 4px"><button class="btn small" data-soc="hi">打招呼</button><button class="btn small" data-soc="play">一齊玩</button><button class="btn small ghost" data-soc="snack">分零食（3 金幣）</button></div>';
    else h += '<p class="muted">今次冇遇到其他寵物，但' + esc(p.name) + '都玩得好開心。</p>';
    if (trip.found)
      h +=
        '<p style="margin-top:8px">拾到寶物：<b>' + trip.found + '</b>（已放入朋友頁嘅寶物盒）</p>';
    if (trip.egg)
      h +=
        '<div class="row" style="margin-top:8px;gap:10px;flex-wrap:nowrap"><div style="width:48px;flex:none">' +
        PET.egg({ kind: 'normal', warmth: 0 }) +
        '</div><p style="margin:0">拾到一隻<b>賽博蛋</b>！已經放咗喺屋企嘅孵蛋座。你照顧自己同照顧' +
        esc(p.name) +
        '，佢就會慢慢暖起嚟。</p></div>';
    h +=
      '<hr class="sep"><div class="row">' +
      (trip.place === 'park' || trip.place === 'lake'
        ? '<button class="btn ghost" id="game-go">拋波仔</button>'
        : '') +
      '<button class="btn ghost" id="trip-photo">影相</button><button class="btn" id="trip-home">返屋企</button></div><div id="game" hidden></div>';
    $('#out-panel').innerHTML = h;
  }
  document.addEventListener('click', (e) => {
    const pl = e.target.closest('[data-place]');
    if (pl) {
      startTrip(pl.dataset.place);
      return;
    }
    const so = e.target.closest('[data-soc]');
    if (so && trip && trip.npc) {
      const p = S.pet;
      p.friends = p.friends || {};
      const fr = (p.friends[trip.npc] = p.friends[trip.npc] || { xp: 0, met: 0 });
      const nf = PET.NPC.find((x) => x.id === trip.npc);
      const k = so.dataset.soc;
      if (k === 'snack') {
        if (p.coins < 3) {
          toast('金幣唔夠，下次先分啦');
          return;
        }
        p.coins -= 3;
      }
      const before = flv(fr.xp);
      const gain = { hi: 3, play: 6, snack: 10 }[k];
      fr.xp += gain;
      if (!trip.met) {
        fr.met++;
        trip.met = true;
      }
      if (k === 'play') {
        need('fun', 10);
        need('energy', -4);
      }
      traitBump('social');
      petAward('social', 3, 3);
      persist();
      bubble(
        'nbubble',
        k === 'snack' ? '多謝你！' + nf.likes + '係我最鍾意嘅！' : pick(NPCLINES[trip.npc]),
      );
      setTimeout(
        () =>
          bubble(
            'obubble',
            k === 'hi' ? '你好呀' + nf.name + '！' : k === 'play' ? '追我呀！' : '一齊食！',
          ),
        900,
      );
      fx('ofx', ['♥', '♪', '✦'], 5);
      if (flv(fr.xp) !== before)
        setTimeout(() => toast('同' + nf.name + '嘅關係升級：' + flv(fr.xp)), 1400);
      renderOutPanel();
      return;
    }
    if (e.target.id === 'trip-home') {
      stopGame();
      cancelTrip();
      segSet('pettab', 'home');
      showPetTab();
      return;
    }
    if (e.target.id === 'trip-photo' && trip) {
      openPhoto(trip.place, trip.npc);
      return;
    }
    if (e.target.id === 'game-go') {
      startGame();
      return;
    }
    if (e.target.id === 'game-throw') {
      throwBall();
      return;
    }
  });
  /* 拋波仔 */
  let G = null;
  function stopGame() {
    if (!G) return;
    cancelAnimationFrame(G.raf);
    cancelAnimationFrame(G.flight);
    clearTimeout(G.timer);
    G = null;
    const ball = $('#ball');
    if (ball) ball.hidden = true;
    const box = $('#game');
    if (box)
      box.innerHTML =
        '<p>今局暫停咗，隨時再玩。</p><button class="btn ghost small" id="game-go">重新開始</button>';
  }
  function startGame() {
    stopGame();
    const box = $('#game');
    if (!box || !trip || !S.pet) return;
    box.hidden = false;
    const g = (G = {
      n: 0,
      score: 0,
      t0: performance.now(),
      raf: 0,
      flight: 0,
      timer: 0,
      busy: false,
      x: 0.5,
      petId: S.pet.id,
      static: RM(),
    });
    box.innerHTML =
      '<p>' +
      (g.static
        ? '減少動態模式：拖動滑桿揀力度，再撳「拋！」。'
        : '撳「拋！」嘅時候，指針喺中間綠色位就最準。') +
      '一共 5 球。</p>' +
      (g.static
        ? '<label>拋波力度<input id="game-aim" type="range" min="0" max="100" value="50"></label>'
        : '<div class="power"><i id="pw"></i></div>') +
      '<div class="row" style="margin-top:10px;justify-content:space-between"><button class="btn" id="game-throw">拋！</button><span id="game-score" class="muted" role="status">0 球・0 分</span></div>';
    if (!g.static) {
      const loop = (t) => {
        if (G !== g) return;
        g.x = (Math.sin((t - g.t0) / 380) + 1) / 2;
        const pw = $('#pw');
        if (pw) pw.style.left = 'calc(' + g.x * 100 + '% - 2px)';
        g.raf = requestAnimationFrame(loop);
      };
      g.raf = requestAnimationFrame(loop);
    }
  }
  function finishBall(g, pts) {
    if (G !== g || !trip || !S.pet || S.pet.id !== g.petId) return;
    const ball = $('#ball');
    if (ball) ball.hidden = true;
    const pe = $('#outstage .on-stage');
    if (pe) {
      pe.classList.remove('walking');
      pe.style.left = trip.npc ? '30%' : '50%';
    }
    setPetExpr('outstage', pts === 3 ? 'love' : pts ? 'happy' : 'wow', 1500);
    bubble('obubble', pts === 3 ? '接得好靚！' : pts ? '接住咗！' : '跑遠咗少少，再試就得。');
    $('#game-score').textContent = g.n + ' 球・' + g.score + ' 分';
    g.busy = false;
    $('#game-throw').disabled = false;
    if (g.n < 5) return;
    cancelAnimationFrame(g.raf);
    const p = S.pet,
      win = g.score,
      k = defaultDay();
    p.best = Math.max(p.best || 0, win);
    p.ballRewards = p.ballRewards || {};
    const count = p.ballRewards[k] || 0;
    const gain = count < 2 ? win : 0;
    p.ballRewards[k] = count + 1;
    p.coins += gain;
    traitBump('active');
    need('fun', 20);
    need('energy', -6);
    if (win > 0) petAward('game', Math.min(10, win), 1, '拋波仔');
    persist();
    $('#game').innerHTML =
      '<p><b>五球完成！' +
      win +
      ' 分</b>（最高 ' +
      p.best +
      ' 分）。' +
      (gain ? '拋波獎勵 +' + gain + ' 金幣。' : '今日嘅金幣獎勵已領晒，可以繼續慢慢玩。') +
      '</p><button class="btn ghost small" id="game-go">再玩一次</button>';
    G = null;
  }
  function throwBall() {
    const g = G;
    if (!g || g.busy || !trip) return;
    g.busy = true;
    $('#game-throw').disabled = true;
    const x = g.static ? Number($('#game-aim').value) / 100 : g.x,
      pts = x > 0.42 && x < 0.58 ? 3 : x > 0.3 && x < 0.7 ? 1 : 0;
    g.n++;
    g.score += pts;
    if (g.static) {
      finishBall(g, pts);
      return;
    }
    const ball = $('#ball');
    if (!ball) {
      stopGame();
      return;
    }
    ball.hidden = false;
    let st = null;
    const dist = pts === 3 ? 78 : pts === 1 ? 64 : 45;
    const anim = (t) => {
      if (G !== g) return;
      if (st === null) st = t;
      const k = Math.min(1, (t - st) / 900);
      ball.style.left = 18 + dist * k * 0.9 + '%';
      ball.style.bottom = 20 + Math.sin(k * Math.PI) * 46 + '%';
      if (k < 1) g.flight = requestAnimationFrame(anim);
      else {
        const pe = $('#outstage .on-stage');
        if (pe) {
          pe.classList.add('walking');
          pe.style.transition = 'left .6s ease';
          pe.style.left = Math.min(72, dist * 0.8) + '%';
        }
        g.timer = setTimeout(() => finishBall(g, pts), 700);
      }
    };
    g.flight = requestAnimationFrame(anim);
  }

  /* ---- 影相 ---- */
  const PEXPR = [
    ['happy', '開心'],
    ['love', '愛心'],
    ['normal', '望鏡頭'],
    ['wow', '驚喜'],
    ['sleep', '瞓覺'],
  ];
  const PFRAME = [
    ['polaroid', '即影即有'],
    ['gold', '金框'],
    ['film', '菲林'],
    ['none', '無框'],
  ];
  const PSTICK = [
    ['heart', '心心'],
    ['star', '星星'],
    ['spark', '閃閃'],
    ['paw', '腳印'],
    ['leaf', '楓葉'],
    ['note', '音符'],
  ];
  let PH = null;
  function stickerSVG(k, x, y, s) {
    const c = {
      heart: '#ff7f9e',
      star: '#ffcf6b',
      spark: '#7cc6ff',
      paw: '#c98b5a',
      leaf: '#d9573a',
      note: '#8a6d4a',
    }[k];
    let d = '';
    if (k === 'heart')
      d =
        '<path d="M0 10s-14 -8 -14 -18a7 7 0 0 1 14 -4a7 7 0 0 1 14 4c0 10 -14 18 -14 18z" fill="' +
        c +
        '" stroke="#fff" stroke-width="3"/>';
    if (k === 'star')
      d =
        '<path d="M0 -16L4.7 -5L16 -4L7.5 4L10 16L0 9.5L-10 16L-7.5 4L-16 -4L-4.7 -5Z" fill="' +
        c +
        '" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>';
    if (k === 'spark')
      d =
        '<path d="M0 -18Q2 -2 18 0Q2 2 0 18Q-2 2 -18 0Q-2 -2 0 -18Z" fill="' +
        c +
        '" stroke="#fff" stroke-width="2.4"/>';
    if (k === 'paw')
      d =
        '<ellipse cx="0" cy="6" rx="9" ry="7.5" fill="' +
        c +
        '"/><circle cx="-9" cy="-6" r="4" fill="' +
        c +
        '"/><circle cx="-3" cy="-11" r="4" fill="' +
        c +
        '"/><circle cx="3" cy="-11" r="4" fill="' +
        c +
        '"/><circle cx="9" cy="-6" r="4" fill="' +
        c +
        '"/>';
    if (k === 'leaf')
      d =
        '<path d="M0 -18L4 -8L12 -12L9 -2L18 0L9 4L12 12L3 8L0 18L-3 8L-12 12L-9 4L-18 0L-9 -2L-12 -12L-4 -8Z" fill="' +
        c +
        '" stroke="#fff" stroke-width="2"/>';
    if (k === 'note')
      d =
        '<path d="M-4 10V-14L12 -18V6" stroke="' +
        c +
        '" stroke-width="4" fill="none"/><ellipse cx="-8" cy="10" rx="6" ry="4.6" fill="' +
        c +
        '"/><ellipse cx="8" cy="6" rx="6" ry="4.6" fill="' +
        c +
        '"/>';
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + d + '</g>';
  }
  function photoSVG(c) {
    const p = S.pet;
    const scene = PET.PLACES[c.place].f({
      hour: c.hour,
      own: c.place === 'home' ? p.own : undefined,
      rain: c.rain,
      books: c.books,
      frameCard: c.place === 'home' ? c.frameCard : null,
    });
    const pw = c.npc ? 220 : 250,
      px = c.npc ? 250 : 400 - pw / 2;
    let inner =
      scene +
      '<svg x="' +
      px +
      '" y="' +
      (500 - pw - 14) +
      '" width="' +
      pw +
      '" height="' +
      pw +
      '" viewBox="0 0 200 200">' +
      PET.body({
        sp: c.sp || p.sp,
        color: c.color || p.color,
        stage: c.stage,
        acc: c.acc,
        expr: c.expr,
        shiny: c.shiny,
        trait: c.trait,
      }) +
      '</svg>';
    if (c.npc) {
      const n = PET.NPC.find((x) => x.id === c.npc);
      inner +=
        '<svg x="420" y="' +
        (500 - 200 - 14) +
        '" width="200" height="200" viewBox="0 0 200 200">' +
        PET.body(Object.assign({ stage: 1, expr: 'happy' }, n)) +
        '</svg>';
    }
    const spots = [
      [110, 90],
      [690, 80],
      [640, 250],
      [150, 260],
      [400, 70],
      [720, 380],
    ];
    (c.stickers || []).forEach((k, i) => {
      const [x, y] = spots[i % spots.length];
      inner += stickerSVG(k, x, y, 1.6);
    });
    const cap = esc(c.caption || '');
    const date = c.date ? md(c.date) : '';
    if (c.frame === 'polaroid')
      return (
        '<svg viewBox="0 0 860 640" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="640" rx="10" fill="#fbf8f1"/><svg x="30" y="30" width="800" height="500" viewBox="0 0 800 500">' +
        inner +
        '</svg><text x="40" y="592" font-family="Noto Sans TC, sans-serif" font-size="28" fill="#3a3a40">' +
        cap +
        '</text><text x="820" y="592" text-anchor="end" font-family="Georgia, serif" font-size="22" fill="#8a8a90">' +
        date +
        '</text></svg>'
      );
    if (c.frame === 'gold')
      return (
        '<svg viewBox="0 0 860 560" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="560" rx="8" fill="#8a6d2f"/><rect x="8" y="8" width="844" height="544" rx="6" fill="#d8b45a"/><rect x="22" y="22" width="816" height="516" fill="#8a6d2f"/><svg x="30" y="30" width="800" height="500" viewBox="0 0 800 500">' +
        inner +
        '</svg>' +
        (cap
          ? '<rect x="230" y="500" width="400" height="44" rx="6" fill="#1f2540" stroke="#d8b45a" stroke-width="2"/><text x="430" y="530" text-anchor="middle" font-family="Noto Serif TC, serif" font-size="22" fill="#f4ead3">' +
            cap +
            '</text>'
          : '') +
        '</svg>'
      );
    if (c.frame === 'film') {
      let h =
        '<svg viewBox="0 0 860 600" xmlns="http://www.w3.org/2000/svg" class="photo-svg"><rect width="860" height="600" fill="#1d1d22"/>';
      for (let x = 20; x < 860; x += 44)
        h +=
          '<rect x="' +
          x +
          '" y="14" width="22" height="16" rx="3" fill="#f4f1ea"/><rect x="' +
          x +
          '" y="570" width="22" height="16" rx="3" fill="#f4f1ea"/>';
      return (
        h +
        '<svg x="30" y="46" width="800" height="500" viewBox="0 0 800 500">' +
        inner +
        '</svg><text x="40" y="566" font-family="Georgia, serif" font-size="14" fill="#f2c94a" letter-spacing="3">' +
        date +
        '　' +
        cap +
        '</text></svg>'
      );
    }
    return (
      '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" class="photo-svg">' +
      inner +
      (cap
        ? '<rect x="0" y="440" width="800" height="60" fill="#000" opacity=".35"/><text x="30" y="480" font-family="Noto Sans TC, sans-serif" font-size="26" fill="#fff">' +
          cap +
          '</text>'
        : '') +
      '</svg>'
    );
  }
  function openPhoto(place, npc) {
    const p = S.pet;
    traitBump('photo');
    PH = {
      sp: p.sp,
      color: p.color,
      shiny: p.shiny || 0,
      trait: traitOf(p),
      pname: p.name,
      place,
      npc: npc || null,
      hour: new Date().getHours(),
      stage: petStage(p),
      acc: p.acc,
      expr: 'happy',
      frame: 'polaroid',
      stickers: ['heart'],
      caption: '',
      rain: place === 'home' && rainingToday(),
      books: Math.max(6, Math.min(40, Object.keys(S.draws || {}).length + 6)),
      frameCard: frameCardSVG(),
      date: keyOf(new Date()),
    };
    const ed = $('#photo-ed');
    ed.hidden = false;
    renderPhotoEd();
    try {
      ed.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {}
  }
  function renderPhotoEd() {
    if (!PH) return;
    const chipRow = (arr, key, multi) =>
      '<div class="chips" data-ph="' +
      key +
      '">' +
      arr
        .map(
          ([v, n]) =>
            '<button class="' +
            ((multi ? PH[key].includes(v) : PH[key] === v) ? 'on' : '') +
            '" data-v="' +
            v +
            '">' +
            n +
            '</button>',
        )
        .join('') +
      '</div>';
    $('#photo-ed').innerHTML =
      '<div class="row" style="justify-content:space-between;margin-bottom:10px"><h2>影相：' +
      PET.PLACES[PH.place].n +
      '</h2><button class="btn ghost small" id="ph-cancel">收埋</button></div><div class="ph-grid"><div class="ph-prev" id="ph-prev">' +
      photoSVG(PH) +
      '</div><div class="ph-ctl">' +
      '<div class="field"><div class="label">表情</div>' +
      chipRow(PEXPR, 'expr') +
      '</div><div class="field"><div class="label">相框</div>' +
      chipRow(PFRAME, 'frame') +
      '</div><div class="field"><div class="label">貼紙（可以揀幾個）</div>' +
      chipRow(PSTICK, 'stickers', 1) +
      '</div>' +
      '<div class="field"><div class="label">相片文字</div><input type="text" id="ph-cap" maxlength="24" placeholder="例如：同' +
      esc(S.pet.name) +
      '去湖邊" value="' +
      esc(PH.caption) +
      '"></div><button class="btn" id="ph-shoot">影！</button></div></div>';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.chips[data-ph] button');
    if (b && PH) {
      const key = b.parentElement.dataset.ph,
        v = b.dataset.v;
      if (key === 'stickers') {
        PH.stickers = PH.stickers.includes(v)
          ? PH.stickers.filter((x) => x !== v)
          : PH.stickers.concat([v]).slice(-6);
      } else PH[key] = v;
      renderPhotoEd();
      return;
    }
    if (e.target.id === 'ph-cancel') {
      $('#photo-ed').hidden = true;
      PH = null;
      return;
    }
    if (e.target.id === 'ph-shoot' && PH) {
      PH.caption = $('#ph-cap').value.trim().slice(0, 24);
      const p = S.pet;
      p.album = p.album || [];
      if (p.album.length >= 200) {
        toast('相簿滿咗，刪走啲舊相先');
        return;
      }
      const shot = Object.assign({}, PH, { id: uid(), t: Date.now() });
      delete shot.frameCard;
      shot.cardId =
        (Object.values(S.draws || {}).sort((a, b) => b.date.localeCompare(a.date))[0] || {}).card ||
        null;
      p.album.push(shot);
      petAward('photo', 3, 2);
      persist();
      const pv = $('#ph-prev');
      pv.classList.add('snap');
      setTimeout(() => pv.classList.remove('snap'), 420);
      toast('咔嚓！已經放入相簿');
      setTimeout(() => {
        $('#photo-ed').hidden = true;
        PH = null;
      }, 700);
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'ph-cap' && PH) {
      PH.caption = e.target.value.slice(0, 24);
      $('#ph-prev').innerHTML = photoSVG(PH);
    }
  });
  function shotSVG(sh) {
    const c = Object.assign({}, sh);
    delete c.frameCard;
    if (c.place === 'home' && c.cardId) {
      const cd = card(c.cardId);
      if (cd)
        c.frameCard = ART.face(cd, 1)
          .replace(/^<svg[^>]*>/, '')
          .replace(/<\/svg>$/, '');
    }
    return photoSVG(c);
  }
  let albumSel = null,
    albumDel = false;
  function renderAlbum() {
    const p = S.pet;
    const a = (p.album || []).slice().sort((x, y) => y.t - x.t);
    $('#album').innerHTML = a.length
      ? '<div class="album">' +
        a
          .map(
            (sh) =>
              '<button class="photo' +
              (albumSel === sh.id ? ' sel' : '') +
              '" data-shot="' +
              sh.id +
              '">' +
              shotSVG(sh) +
              '<span>' +
              md(sh.date) +
              '・' +
              (sh.pname && (S.pet.others || []).length ? esc(sh.pname) + '・' : '') +
              PET.PLACES[sh.place].n +
              (sh.caption ? '・' + esc(sh.caption) : '') +
              '</span></button>',
          )
          .join('') +
        '</div>'
      : '<p class="muted" style="padding:30px 0;text-align:center">相簿仲係空嘅。喺屋企或者出街嗰陣撳「影相」，同' +
        esc(p.name) +
        '影第一張。</p>';
    const sel = a.find((x) => x.id === albumSel);
    $('#album-view').hidden = !sel;
    if (sel)
      $('#album-view').innerHTML =
        '<div class="ph-big">' +
        shotSVG(sel) +
        '</div><div class="row" style="margin-top:12px"><button class="btn" id="al-dl">下載相片</button><button class="btn ghost small danger" id="al-del">' +
        (albumDel ? '再撳一次確認刪除' : '刪除') +
        '</button><span class="muted" id="al-msg"></span></div>';
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-shot]');
    if (b) {
      albumSel = b.dataset.shot;
      albumDel = false;
      renderAlbum();
      try {
        $('#album-view').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (err) {}
      return;
    }
    if (e.target.id === 'al-del') {
      if (!albumDel) {
        albumDel = true;
        renderAlbum();
        return;
      }
      S.pet.album = S.pet.album.filter((x) => x.id !== albumSel);
      albumSel = null;
      albumDel = false;
      persist();
      renderAlbum();
      return;
    }
    if (e.target.id === 'al-dl') {
      const sh = S.pet.album.find((x) => x.id === albumSel);
      if (!sh) return;
      $('#al-msg').textContent = '整緊相……';
      try {
        const svgStr = shotSVG(sh).replace('<svg ', '<svg width="1720" ');
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = url;
        });
        const vb = svgStr.match(/viewBox="0 0 (\d+) (\d+)"/);
        const W = 1720,
          H = Math.round((W * +vb[2]) / +vb[1]);
        const cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        cv.getContext('2d').drawImage(img, 0, 0, W, H);
        URL.revokeObjectURL(url);
        const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
        let dl = null;
        try {
          dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
        } catch (err) {}
        if (dl) {
          await dl.save({ filename: S.pet.name + '-' + sh.date + '.png', data: png });
          $('#al-msg').textContent = '';
        } else {
          $('#al-msg').textContent = '呢度唔可以直接下載，可以撳住張相儲存。';
        }
      } catch (err) {
        $('#al-msg').textContent =
          err && err.code === 'cancelled' ? '' : '下載唔到，可以截圖儲存。';
      }
    }
  });
  /* ---- 朋友 ---- */
  function renderFriends() {
    const p = S.pet;
    const fr = p.friends || {};
    renderFamily();
    $('#friends').innerHTML =
      '<div class="grid g2">' +
      PET.NPC.map((n) => {
        const f = fr[n.id];
        if (!f)
          return (
            '<div class="sheet friend locked"><div class="f-pic">' +
            PET.svg(Object.assign({ stage: 1, expr: 'sleep' }, n), 'mini') +
            '</div><div><b>？？？</b><span class="muted">未識。帶' +
            esc(p.name) +
            '出街，可能會遇到。</span></div></div>'
          );
        const lvIdx = FLV.reduce((a, [t], i) => (f.xp >= t ? i : a), 0),
          next = FLV[lvIdx + 1];
        const prog = next
          ? Math.round(((f.xp - FLV[lvIdx][0]) / (next[0] - FLV[lvIdx][0])) * 100)
          : 100;
        return (
          '<div class="sheet friend"><div class="f-pic">' +
          PET.svg(Object.assign({ stage: 1, expr: 'happy' }, n), 'mini') +
          '</div><div style="flex:1;min-width:0"><div class="row" style="justify-content:space-between"><b>' +
          n.name +
          '</b><span class="chip">' +
          flv(f.xp) +
          '</span></div><span class="muted">' +
          n.kind +
          '・見過 ' +
          f.met +
          ' 次・最鍾意' +
          n.likes +
          '</span><p style="font-size:14px;margin-top:4px">' +
          n.bio +
          '</p><div class="bar" style="margin-top:8px"><i class="red" style="width:' +
          prog +
          '%"></i></div></div></div>'
        );
      }).join('') +
      '</div>';
    const tr = p.treasure || {};
    const keys = Object.keys(tr);
    $('#treasure').innerHTML = keys.length
      ? '<div class="row" style="gap:8px">' +
        keys.map((k) => '<span class="chip">' + k + ' ×' + tr[k] + '</span>').join('') +
        '</div>'
      : '<p class="muted">出街散步有機會拾到寶物，會放喺呢度。</p>';
  }
  /* ---- 商店 ---- */
  function renderShop() {
    const p = S.pet;
    $('#shop-coins').textContent = p.coins;
    $('#shop-furn').innerHTML = PFURN.map((f) => {
      const own = p.own[f.id];
      return (
        '<div class="shop-item"><div><b>' +
        f.n +
        '</b><span class="muted">' +
        f.d +
        '</span></div>' +
        (own
          ? '<span class="chip good">已擺好</span>'
          : '<button class="btn small' +
            (p.coins < f.p ? ' ghost' : '') +
            '" data-buy="' +
            f.id +
            '"' +
            (p.coins < f.p ? ' disabled' : '') +
            '>' +
            f.p +
            ' 金幣</button>') +
        '</div>'
      );
    }).join('');
    $('#shop-acc').innerHTML =
      '<div class="shop-item"><div><b>唔戴</b><span class="muted">原本個樣</span></div>' +
      (p.acc
        ? '<button class="btn small ghost" data-wear="">戴</button>'
        : '<span class="chip good">戴緊</span>') +
      '</div>' +
      PACC.map((a) => {
        const own = (p.accs || []).includes(a.id);
        return (
          '<div class="shop-item"><div class="row" style="gap:10px;flex-wrap:nowrap"><div style="width:52px;flex:none">' +
          PET.svg(petO('happy', { acc: a.id, stage: 2 }), 'mini') +
          '</div><div><b>' +
          a.n +
          '</b></div></div>' +
          (own
            ? p.acc === a.id
              ? '<span class="chip good">戴緊</span>'
              : '<button class="btn small ghost" data-wear="' + a.id + '">戴</button>'
            : '<button class="btn small' +
              (p.coins < a.p ? ' ghost' : '') +
              '" data-buyacc="' +
              a.id +
              '"' +
              (p.coins < a.p ? ' disabled' : '') +
              '>' +
              a.p +
              ' 金幣</button>') +
          '</div>'
        );
      }).join('');
  }
  document.addEventListener('click', (e) => {
    const p = S.pet;
    if (!p) return;
    const b = e.target.closest('[data-buy]');
    if (b && !b.disabled) {
      const f = PFURN.find((x) => x.id === b.dataset.buy);
      if (p.coins < f.p) return;
      p.coins -= f.p;
      p.own[f.id] = 1;
      persist();
      renderShop();
      toast(f.n + '已經擺入屋企');
      return;
    }
    const a = e.target.closest('[data-buyacc]');
    if (a && !a.disabled) {
      const x = PACC.find((y) => y.id === a.dataset.buyacc);
      if (p.coins < x.p) return;
      p.coins -= x.p;
      p.accs = (p.accs || []).concat([x.id]);
      p.acc = x.id;
      persist();
      renderShop();
      toast(p.name + '戴咗' + x.n + '，好靚！');
      return;
    }
    const w = e.target.closest('[data-wear]');
    if (w) {
      p.acc = w.dataset.wear;
      persist();
      renderShop();
    }
  });
  /* ---- 頁面 ---- */
  function showPetTab() {
    const v = segGet('pettab') || 'home';
    if (v !== 'out') {
      stopGame();
      cancelTrip();
    }
    if (v !== 'home') roamStop();
    ['home', 'out', 'friends', 'album', 'shop'].forEach((k) => {
      $('#pv-' + k).hidden = v !== k;
    });
    $('#photo-ed').hidden = true;
    PH = null;
    if (v === 'home') renderHome();
    if (v === 'out') {
      if (!trip) renderOutChoose();
    }
    if (v === 'friends') renderFriends();
    if (v === 'album') renderAlbum();
    if (v === 'shop') renderShop();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.seg[data-name="pettab"] button')) setTimeout(showPetTab, 0);
  });
  function renderPet() {
    const p = S.pet;
    $('#pet-adopt').hidden = !!p;
    $('#pet-main').hidden = !p;
    if (p) ensurePet();
    updBuddy();
    if (!p) {
      renderAdopt();
      return;
    }
    tickNeeds();
    const st = petStage(p);
    $('#pet-title').textContent = p.name + '嘅屋企';
    $('#pet-eyebrow').textContent =
      PET.SPECIES[p.sp] +
      '・' +
      PET.STAGES[st].n +
      '・' +
      (PET.tod(new Date().getHours()) === 'night' ? '夜晚' : '日頭');
    showPetTab();
  }
  function petGreet() {
    const p = S.pet;
    if (!p) return;
    const k = keyOf(new Date());
    const gap = p.lastVisit ? Math.round((parseKey(k) - parseKey(p.lastVisit)) / 864e5) : 0;
    p.lastVisit = k;
    persist();
    const h = new Date().getHours();
    const ck = S.checkins[defaultDay()];
    let line;
    const tr = traitOf(p);
    if (inSleep()) line = pick(PLN.sleep);
    else if (gap >= 2) line = pick(PLN.back);
    else if (ck && (ck.contact === '2' || ck.contact === '3')) line = pick(PLN.talk);
    else if (ck && ck.move === '2') line = pick(PLN.move);
    else if (h >= 5 && h < 11) line = pick(PLN.morning);
    else if (h >= 18 || h < 2) line = pick(PLN.night);
    else line = pick(PLN.greet);
    if (!inSleep() && gap < 2 && tr && Math.random() < 0.45) line = pick(TLN[tr]);
    setTimeout(() => {
      bubble('bubble', line);
      fx('fx', ['♥', '♥'], 3);
    }, 400);
  }
  setInterval(() => {
    if (
      S.pet &&
      $('#page-pet').classList.contains('on') &&
      segGet('pettab') === 'home' &&
      !$('#pv-home').hidden
    ) {
      tickNeeds();
      renderStatus();
    }
  }, 60000);

  /* ---- 多隻寵物・性格・蛋・自由活動・角落小寵物 ---- */
  const PERPET = [
    'id',
    'name',
    'sp',
    'color',
    'acc',
    'xp',
    'needs',
    'nt',
    'chat',
    'fed',
    'sleepAt',
    'born',
    'shiny',
    'traits',
  ];
  const HOUSE_MAX = 4;
  function ensurePet() {
    const p = S.pet;
    if (!p) return;
    if (!p.id) p.id = uid();
    if (!Array.isArray(p.others)) p.others = [];
    if (!Array.isArray(p.eggs)) p.eggs = [];
    if (!p.traits || typeof p.traits !== 'object') p.traits = {};
    p.others.forEach((o) => {
      if (!o.id) o.id = uid();
      if (!o.traits) o.traits = {};
      if (!o.needs) o.needs = { food: 80, water: 80, energy: 80, clean: 85, fun: 80 };
      if (o.xp == null) o.xp = 0;
      if (!o.chat) o.chat = [];
    });
  }
  function household() {
    const p = S.pet;
    return p ? 1 + (p.others || []).length : 0;
  }
  function allPets() {
    const p = S.pet;
    if (!p) return [];
    return [p].concat(p.others || []);
  }
  function switchPet(id) {
    const p = S.pet;
    ensurePet();
    const i = p.others.findIndex((o) => o.id === id);
    if (i < 0) return;
    tickNeeds();
    const o = p.others[i],
      cur = {};
    PERPET.forEach((k) => {
      cur[k] = p[k];
    });
    PERPET.forEach((k) => {
      p[k] = o[k];
    });
    if (!p.traits) p.traits = {};
    p.others.splice(i, 1, cur);
    persist();
    renderPet();
    toast('而家照顧緊 ' + p.name);
    setTimeout(() => {
      bubble('bubble', pick(['到我喇！主人！', '你揀咗我！好開心！', '我喺度～']));
      fx('fx', ['♥', '✦'], 4);
    }, 300);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-switch]');
    if (b) {
      switchPet(b.dataset.switch);
      if (segGet('pettab') !== 'home') {
        segSet('pettab', 'home');
        showPetTab();
      }
    }
  });
  function familyBar() {
    const p = S.pet;
    if (!p || !(p.others || []).length) return '';
    return (
      '<div class="fam-bar" role="group" aria-label="揀照顧邊隻"><span class="muted">屋企</span>' +
      allPets()
        .map(
          (x) =>
            '<button class="fam' +
            (x === p ? ' on' : '') +
            '" ' +
            (x === p ? 'aria-current="true" disabled' : 'data-switch="' + x.id + '"') +
            ' aria-label="' +
            esc(x.name) +
            '">' +
            PET.svg(
              {
                sp: x.sp,
                color: x.color,
                stage: petStage(x),
                acc: x.acc,
                shiny: x.shiny,
                trait: traitOf(x),
                expr: x === p ? 'happy' : 'normal',
              },
              'mini',
            ) +
            '<span>' +
            esc(x.name) +
            '</span></button>',
        )
        .join('') +
      '</div>'
    );
  }
  function renderFamily() {
    const p = S.pet,
      box = $('#family');
    if (!box || !p) return;
    ensurePet();
    const seen = {};
    allPets().forEach((x) => {
      seen[x.sp + '-' + (x.shiny ? 's' : 'n')] = 1;
    });
    const coll = Object.keys(PET.SPECIES)
      .map((sp) => [sp, 0])
      .concat(Object.keys(PET.SPECIES).map((sp) => [sp, 1]));
    box.innerHTML =
      '<div class="fam-grid">' +
      allPets()
        .map((x) => {
          const tr = traitOf(x);
          return (
            '<div class="fam-card' +
            (x === p ? ' on' : '') +
            '"><div class="f-pic">' +
            PET.svg(
              {
                sp: x.sp,
                color: x.color,
                stage: petStage(x),
                acc: x.acc,
                shiny: x.shiny,
                trait: tr,
                expr: 'happy',
              },
              'mini',
            ) +
            '</div><b>' +
            esc(x.name) +
            '</b><span class="muted">' +
            PET.SPECIES[x.sp] +
            '・' +
            PET.STAGES[petStage(x)].n +
            '</span><div class="row" style="gap:4px;justify-content:center">' +
            (x.shiny ? '<span class="chip shiny">✦ 閃光</span>' : '') +
            (tr ? '<span class="chip calm">' + TRAITS[tr][0] + '</span>' : '') +
            '</div>' +
            (x === p
              ? '<span class="chip good">照顧緊</span>'
              : '<button class="btn small ghost" data-switch="' + x.id + '">照顧佢</button>') +
            '</div>'
          );
        })
        .join('') +
      '</div>' +
      '<h3 style="margin:16px 0 8px">收集冊</h3><div class="coll">' +
      coll
        .map(([sp, sh]) => {
          const got = seen[sp + '-' + (sh ? 's' : 'n')];
          return (
            '<div class="coll-i' +
            (got ? '' : ' locked') +
            '"><div class="f-pic">' +
            PET.svg(
              {
                sp,
                color: sh ? 'aurora' : 'milktea',
                stage: 1,
                shiny: sh,
                expr: got ? 'happy' : 'sleep',
              },
              'mini',
            ) +
            '</div><span>' +
            (got ? (sh ? '閃光' + PET.SPECIES[sp] : PET.SPECIES[sp]) : sh ? '？ 閃光' : '？') +
            '</span></div>'
          );
        })
        .join('') +
      '</div>' +
      '<p class="muted" style="margin-top:10px">屋企最多住 ' +
      HOUSE_MAX +
      ' 隻。散步有機會拾到賽博蛋；里程碑會送金蛋，金蛋好大機會孵出閃光寵物。</p>';
  }
  /* 性格 */
  const TRAITS = {
    adv: ['冒險家', '成日同你出街探險，背住小背包'],
    food: ['美食家', '食嘢食得好開心，戴住廚師帽'],
    photo: ['攝影師', '最鍾意同你影相，頸掛住相機'],
    talk: ['話嘮', '好鍾意同你傾偈，頭頂有個對話框'],
    social: ['社交達人', '識好多朋友，戴住小領巾'],
    active: ['運動健將', '精力充沛，綁住頭帶'],
    cozy: ['療癒系', '最鍾意黐住你，戴住睡帽'],
  };
  const TLN = {
    adv: ['今日去邊度探險？我執好背包喇！', '出面好多嘢未見過，一齊去睇吓！'],
    food: ['今晚食咩好？我幫你諗菜單！', '你煮嘢食嘅時候最有型。'],
    photo: ['嚟，影返張！你今日好好樣。', '我想將今日影低，放入相簿。'],
    talk: ['我有好多嘢想同你講！你先講你今日！', '你講嘢我最鍾意聽。'],
    social: ['我今日又識咗新朋友，你都試吓講多一句？', '朋友多啲好開心！你都係我最好嘅朋友。'],
    active: ['伸個懶腰！一齊郁吓！', '你跑步嘅時候，我喺度幫你打氣！'],
    cozy: ['攬吓攬吓……好舒服。', '你返嚟我就安心喇。'],
  };
  function traitBump(k) {
    if (!k || !S.pet) return;
    const t = (S.pet.traits = S.pet.traits || {});
    t[k] = (t[k] || 0) + 1;
  }
  function traitOf(p) {
    if (!p || petStage(p) < 1) return null;
    const t = p.traits || {};
    let best = null,
      bv = 2;
    Object.keys(TRAITS).forEach((k) => {
      if ((t[k] || 0) > bv) {
        bv = t[k];
        best = k;
      }
    });
    return best;
  }
  /* 蛋 */
  const EGGNEED = { normal: 100, gold: 60 };
  function canFindEgg() {
    const p = S.pet;
    ensurePet();
    return (
      p.eggDay !== keyOf(new Date()) && p.eggs.length < 3 && household() + p.eggs.length < HOUSE_MAX
    );
  }
  function addEgg(kind) {
    const p = S.pet;
    if (!p) return false;
    ensurePet();
    if (p.eggs.length >= 3 || household() + p.eggs.length >= HOUSE_MAX) return false;
    p.eggs.push({ id: uid(), kind, warmth: 0, need: EGGNEED[kind], t: Date.now() });
    return true;
  }
  function petWarm(pts) {
    const p = S.pet;
    if (!p || !(p.eggs || []).length) return;
    p.eggs.forEach((e) => {
      const was = e.warmth >= e.need;
      e.warmth = Math.min(e.need, e.warmth + pts);
      if (!was && e.warmth >= e.need)
        setTimeout(
          () => toast((e.kind === 'gold' ? '金蛋' : '賽博蛋') + '暖晒喇，可以孵！去屋企睇吓'),
          3600,
        );
    });
  }
  function nestHTML() {
    const p = S.pet;
    const eggs = p.eggs || [];
    if (!eggs.length) return '';
    const e = eggs[0];
    const ready = eggs.some((x) => x.warmth >= x.need);
    return (
      '<button class="nest" id="nest" aria-label="孵蛋座，' +
      eggs.length +
      ' 隻蛋' +
      (ready ? '，可以孵喇' : '') +
      '"><svg viewBox="0 0 120 40" class="nest-bed" aria-hidden="true"><ellipse cx="60" cy="26" rx="56" ry="13" fill="#a8835e"/><ellipse cx="60" cy="22" rx="46" ry="10" fill="#e9d8b8"/><path d="M14 24q10 -8 20 0t20 0t20 0t20 0t20 0" stroke="#8a6a48" stroke-width="2" fill="none"/></svg><span class="nest-egg">' +
      PET.egg({ kind: e.kind, warmth: e.warmth, need: e.need, wobble: ready && !RM() }) +
      '</span>' +
      (eggs.length > 1 ? '<span class="nest-n">×' + eggs.length + '</span>' : '') +
      '<span class="nest-bar"><i style="width:' +
      Math.round((e.warmth / e.need) * 100) +
      '%"></i></span>' +
      (ready ? '<span class="nest-tag">可以孵喇</span>' : '') +
      '</button>'
    );
  }
  function renderEggPanel() {
    const p = S.pet;
    const full = household() >= HOUSE_MAX;
    $('#care-panel').innerHTML =
      '<div class="row" style="justify-content:space-between"><h3>孵蛋座</h3><button class="btn ghost small" id="egg-close">收埋</button></div><p class="muted" style="margin:4px 0 12px">打卡、完成習慣、收工抽卡、照顧寵物都會令蛋暖啲。你做嘅每樣好嘢，都喺度慢慢孵緊。</p><div class="eggs">' +
      (p.eggs || [])
        .map((e) => {
          const ready = e.warmth >= e.need;
          const pc = Math.round((e.warmth / e.need) * 100);
          return (
            '<div class="egg-row"><div class="egg-pic">' +
            PET.egg({ kind: e.kind, warmth: e.warmth, need: e.need, wobble: ready && !RM() }) +
            '</div><div style="flex:1;min-width:0"><b>' +
            (e.kind === 'gold' ? '金色賽博蛋' : '賽博蛋') +
            '</b><span class="muted">　' +
            (e.kind === 'gold' ? '好大機會孵出閃光寵物' : '有機會孵出閃光寵物') +
            '</span><div class="bar" style="margin:8px 0"><i class="' +
            (ready ? 'good' : 'warn') +
            '" style="width:' +
            pc +
            '%"></i></div>' +
            (ready
              ? full
                ? '<p class="muted">屋企已經住滿 ' + HOUSE_MAX + ' 隻，暫時孵唔到。</p>'
                : '<div class="row" style="flex-wrap:nowrap"><input type="text" id="egg-name-' +
                  e.id +
                  '" maxlength="12" placeholder="幫佢改個名" style="flex:1;min-width:0"><button class="btn" data-hatch="' +
                  e.id +
                  '">孵化</button></div>'
              : '<span class="muted">溫度 ' + pc + '%</span>') +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    $('#care-panel').hidden = false;
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#nest')) {
      renderEggPanel();
      try {
        $('#care-panel').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' });
      } catch (err) {}
      return;
    }
    if (e.target.id === 'egg-close') {
      $('#care-panel').hidden = true;
      return;
    }
    const h = e.target.closest('[data-hatch]');
    if (h) {
      hatchEgg(h.dataset.hatch);
    }
  });
  const BABYN = [
    '布丁',
    '芝士',
    '湯圓',
    '豆腐',
    '奶茶',
    '雪條',
    '魚蛋',
    '菠蘿包',
    '小籠包',
    '西多',
  ];
  function hatchEgg(id) {
    const p = S.pet;
    const e = (p.eggs || []).find((x) => x.id === id);
    if (!e || e.warmth < e.need || household() >= HOUSE_MAX) return;
    const inp = $('#egg-name-' + id);
    const name = ((inp && inp.value.trim()) || pick(BABYN)).slice(0, 12);
    const shiny = Math.random() < (e.kind === 'gold' ? 0.5 : 0.125) ? 1 : 0;
    const sps = Object.keys(PET.SPECIES);
    const cols = Object.keys(PET.PAL).filter((k) => !PET.PAL[k].rare);
    const color = shiny && Math.random() < 0.5 ? 'aurora' : pick(cols);
    const baby = {
      id: uid(),
      name,
      sp: pick(sps),
      color,
      acc: '',
      xp: 0,
      needs: { food: 85, water: 85, energy: 85, clean: 90, fun: 90 },
      nt: Date.now(),
      chat: [],
      fed: '',
      sleepAt: 0,
      born: keyOf(new Date()),
      shiny,
      traits: {},
    };
    p.eggs = p.eggs.filter((x) => x.id !== id);
    p.others.push(baby);
    p.hatched = (p.hatched || 0) + 1;
    persist();
    $('#care-panel').hidden = true;
    renderRoom();
    renderStatus();
    const art = PET.svg(Object.assign({ stage: 0, expr: 'love' }, baby));
    if (typeof celebrate === 'function')
      celebrate({
        eyebrow: shiny ? '✦ 稀有' : '孵化',
        title: name + ' 出世喇！',
        sub:
          (shiny
            ? '係閃光' + PET.SPECIES[baby.sp] + '！好罕有。'
            : '係一隻' + PET.PAL[color].n + '嘅' + PET.SPECIES[baby.sp] + '。') +
          '佢同' +
          p.name +
          '一齊住，喺屋企撳佢就可以轉去照顧佢。',
        art,
      });
    else toast(name + ' 出世喇！');
  }
  /* 自由活動 */
  const SPOTS = [
    { id: 'rug', x: 44, b: 7, ex: 'happy', l: ['地氈好軟呀～', '喺度打個滾！'] },
    { id: 'bed', x: 80, b: 8, ex: 'sleep', l: ['借我瞓陣……', '好暖……'] },
    {
      id: 'sofa',
      x: 66,
      b: 41,
      req: 'sofa',
      ex: 'happy',
      l: ['梳化好舒服！你都嚟坐吓？', '攤喺度最正。'],
    },
    { id: 'ball', x: 36, b: 3, req: 'ball', ex: 'happy', l: ['波波！陪我玩！'] },
    { id: 'kitchen', x: 14, b: 16, req: 'kitchen', ex: 'ask', l: ['好香呀……今晚食咩？'] },
    { id: 'shelf', x: 28, b: 9, req: 'shelf', ex: 'normal', l: ['好多書，都係你抽卡嘅回憶。'] },
    { id: 'tank', x: 43, b: 13, req: 'tank', ex: 'wow', l: ['魚仔游嚟游去～'] },
    { id: 'window', x: 72, b: 6, not: 'sofa', ex: 'wow', l: ['出面好靚……'] },
    { id: 'corner', x: 22, b: 3, ex: 'happy', l: ['呢個角落好舒服。'] },
    { id: 'back', x: 60, b: 24, ex: 'normal', l: ['我喺度望住你。'] },
  ];
  let RPOS = {},
    roamT = 0,
    roamNext = 0,
    roamDragged = false,
    drag = null;
  function spotsAvail() {
    const own = (S.pet && S.pet.own) || {};
    return SPOTS.filter((s) => (!s.req || own[s.req]) && (!s.not || !own[s.not]));
  }
  function spotOf(pid) {
    return SPOTS.find((s) => s.id === RPOS[pid]) || SPOTS[0];
  }
  const PREF = [
    'rug',
    'sofa',
    'bed',
    'window',
    'kitchen',
    'corner',
    'back',
    'ball',
    'shelf',
    'tank',
  ];
  const near = (a, b) => Math.abs(a.x - b.x) < 15 && Math.abs(a.b - b.b) < 16;
  function freeSpots(except) {
    const occ = Object.keys(RPOS)
      .filter((k) => k !== except && allPets().some((x) => x.id === k))
      .map((k) => SPOTS.find((s) => s.id === RPOS[k]))
      .filter(Boolean);
    return spotsAvail().filter((s) => !occ.some((o) => o.id === s.id || near(o, s)));
  }
  function roamPlace() {
    const av = spotsAvail();
    const live = allPets().map((x) => x.id);
    Object.keys(RPOS).forEach((k) => {
      if (!live.includes(k)) delete RPOS[k];
    });
    allPets().forEach((x, i) => {
      const cur = RPOS[x.id];
      delete RPOS[x.id];
      const fr = freeSpots(x.id);
      const ok = cur && fr.some((s) => s.id === cur);
      let s = cur;
      if (!ok) {
        const want = i === 0 && inSleep() ? ['bed'].concat(PREF) : PREF;
        s = (
          want.map((id) => fr.find((f) => f.id === id)).find(Boolean) ||
          fr[0] ||
          av[i % av.length]
        ).id;
      }
      RPOS[x.id] = s;
    });
  }
  function roamExpr() {
    const p = S.pet;
    if (inSleep()) return 'sleep';
    const s = spotOf(p.id);
    if (NEEDS.some(([k]) => p.needs[k] < 40)) return 'ask';
    return s.ex || 'normal';
  }
  function othersHTML() {
    const p = S.pet;
    return (p.others || [])
      .map((o) => {
        const s = spotOf(o.id);
        return (
          '<button class="on-stage other" data-pid="' +
          o.id +
          '" style="left:' +
          s.x +
          '%;bottom:' +
          s.b +
          '%" aria-label="轉去照顧' +
          esc(o.name) +
          '">' +
          PET.svg({
            sp: o.sp,
            color: o.color,
            stage: petStage(o),
            acc: o.acc,
            shiny: o.shiny,
            trait: traitOf(o),
            expr: inSleep() ? 'sleep' : s.ex,
          }) +
          '</button>'
        );
      })
      .join('');
  }
  function roamStop() {
    clearInterval(roamT);
    roamT = 0;
  }
  function roamArm() {
    roamStop();
    roamNext = Date.now() + 7000 + Math.random() * 5000;
    roamT = setInterval(roamTick, 1000);
  }
  function roamTick() {
    const room = $('#room');
    if (
      !S.pet ||
      !room ||
      !$('#page-pet').classList.contains('on') ||
      $('#pv-home').hidden ||
      document.hidden
    ) {
      return;
    }
    if (RM() || drag || petBusy || inSleep() || Date.now() < roamNext) return;
    roamNext = Date.now() + 7000 + Math.random() * 5000;
    const pets = allPets();
    const mover = Math.random() < 0.7 ? pets[0] : pick(pets);
    const el = room.querySelector('.on-stage[data-pid="' + mover.id + '"]');
    if (!el) return;
    const free = freeSpots(mover.id).filter((s) => s.id !== RPOS[mover.id]);
    if (!free.length) return;
    const to = pick(free);
    RPOS[mover.id] = to.id;
    const main = mover === S.pet;
    if (main) {
      const b = $('#bubble');
      if (b) b.hidden = true;
    }
    el.classList.add('walking');
    el.style.left = to.x + '%';
    el.style.bottom = to.b + '%';
    setTimeout(() => {
      el.classList.remove('walking');
      arriveSpot(el, mover, to, main && Math.random() < 0.45);
    }, 3000);
  }
  function arriveSpot(el, pet, to, talk) {
    if (!el.isConnected) return;
    const main = pet === S.pet;
    el.innerHTML = main
      ? PET.svg(petO(roamExpr()))
      : PET.svg({
          sp: pet.sp,
          color: pet.color,
          stage: petStage(pet),
          acc: pet.acc,
          shiny: pet.shiny,
          trait: traitOf(pet),
          expr: to.ex,
        });
    if (talk) bubble('bubble', pick(to.l));
  }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('#room .on-stage');
    if (!el || e.button > 0) return;
    drag = {
      el,
      x0: e.clientX,
      y0: e.clientY,
      id: e.pointerId,
      moved: false,
      W: $('#room').getBoundingClientRect(),
    };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0,
      dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      try {
        drag.el.setPointerCapture(drag.id);
      } catch (err) {}
      drag.el.classList.add('dragging');
      const b = $('#bubble');
      if (b) b.hidden = true;
      const pid = drag.el.dataset.pid,
        pet = allPets().find((x) => x.id === pid);
      if (pet)
        drag.el.innerHTML =
          pet === S.pet
            ? PET.svg(petO('wow'))
            : PET.svg({
                sp: pet.sp,
                color: pet.color,
                stage: petStage(pet),
                acc: pet.acc,
                shiny: pet.shiny,
                trait: traitOf(pet),
                expr: 'wow',
              });
    }
    const W = drag.W;
    const x = Math.max(8, Math.min(92, ((e.clientX - W.left) / W.width) * 100));
    const b = Math.max(0, Math.min(62, ((W.bottom - e.clientY) / W.height) * 100 - 8));
    drag.el.style.left = x + '%';
    drag.el.style.bottom = b + '%';
    e.preventDefault();
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    roamDragged = true;
    setTimeout(() => {
      roamDragged = false;
    }, 350);
    d.el.classList.remove('dragging');
    const x = parseFloat(d.el.style.left),
      b = parseFloat(d.el.style.bottom);
    const pid = d.el.dataset.pid,
      pet = allPets().find((q) => q.id === pid);
    if (!pet) return;
    const prev = RPOS[pid];
    let best = null,
      bd = 1e9;
    spotsAvail().forEach((s) => {
      const dd = Math.hypot(s.x - x, (s.b - b) * 1.6);
      if (dd < bd) {
        bd = dd;
        best = s;
      }
    });
    if (!best) best = spotOf(pid);
    allPets().forEach((q) => {
      if (q.id === pid) return;
      const qs = SPOTS.find((s) => s.id === RPOS[q.id]);
      if (!qs || !(qs.id === best.id || near(qs, best))) return;
      RPOS[pid] = best.id;
      const fr = freeSpots(q.id);
      const back = SPOTS.find((s) => s.id === prev);
      const to =
        (back &&
          back.id !== best.id &&
          !near(back, best) &&
          (!spotsAvail().includes(back) ? null : back)) ||
        fr.find((s) => s.id !== best.id && !near(s, best)) ||
        back;
      if (!to) return;
      RPOS[q.id] = to.id;
      const qe = document.querySelector('#room .on-stage[data-pid="' + q.id + '"]');
      if (qe) {
        qe.classList.add('settle');
        qe.style.left = to.x + '%';
        qe.style.bottom = to.b + '%';
        setTimeout(() => {
          qe.classList.remove('settle');
          arriveSpot(qe, q, to, false);
        }, 450);
      }
    });
    RPOS[pid] = best.id;
    d.el.classList.add('settle');
    d.el.style.left = best.x + '%';
    d.el.style.bottom = best.b + '%';
    setTimeout(() => d.el.classList.remove('settle'), 450);
    roamNext = Date.now() + 9000;
    setTimeout(() => arriveSpot(d.el, pet, best, pet === S.pet), 300);
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  /* 角落小寵物 */
  let BUD = 0;
  function updBuddy() {
    const b = $('#buddy');
    if (!b) return;
    const show =
      !!S.pet &&
      S.settings.buddy !== false &&
      !$('#page-pet').classList.contains('on') &&
      !$('#page-adventure').classList.contains('on') &&
      !$('#page-arcade').classList.contains('on');
    b.hidden = !show;
    if (show) $('#buddy-pet').innerHTML = PET.svg(petO(inSleep() ? 'sleep' : 'normal'), 'mini');
  }
  function buddyCheer(label) {
    const b = $('#buddy');
    if (!b || b.hidden) return;
    $('#buddy-pet').innerHTML = PET.svg(petO('love'), 'mini');
    if (!RM()) {
      b.classList.remove('jump');
      void b.offsetWidth;
      b.classList.add('jump');
    }
    const tx = $('#buddy-b');
    tx.textContent = pick(['好叻！', '做得好！', '我見到喇！', '你好犀利！', '耶！']) + ' ' + label;
    tx.hidden = false;
    clearTimeout(BUD);
    BUD = setTimeout(() => {
      tx.hidden = true;
      b.classList.remove('jump');
      if (!b.hidden)
        $('#buddy-pet').innerHTML = PET.svg(petO(inSleep() ? 'sleep' : 'normal'), 'mini');
    }, 3200);
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#buddy')) go('pet');
  });

  /* ---------- 我嘅習慣（概念參考 Loop Habit Tracker：強度唔清零） ---------- */
  const HB_M = Math.pow(0.5, 1 / 14);
  function hbDefaults() {
    return [
      { id: 'run', name: '跑步', freq: 3, log: {} },
      { id: 'cook', name: '自己煮飯', freq: 4, log: {} },
      { id: 'bed', name: '錨點時間上床', freq: 7, log: {} },
    ];
  }
  function hbStrength(h, upto) {
    const days = Object.keys(h.log || {}).sort();
    if (!days.length) return 0;
    const end = upto || defaultDay();
    let d = days[0];
    if (addDays(end, -400) > d) d = addDays(end, -400);
    let s = 0,
      guard = 0;
    while (d <= end && guard < 500) {
      let c = 0;
      for (let i = 0; i < 7; i++) if (h.log[addDays(d, -i)]) c++;
      const v = Math.min(1, c / h.freq);
      s = s * HB_M + v * (1 - HB_M);
      d = addDays(d, 1);
      guard++;
    }
    return Math.round(s * 100);
  }
  const HBL = [
    [0, '萌芽中'],
    [25, '成長中'],
    [50, '穩定'],
    [80, '已經成為習慣'],
  ];
  const hbLabel = (v) => {
    let r = HBL[0][1];
    HBL.forEach(([t, n]) => {
      if (v >= t) r = n;
    });
    return r;
  };
  const hbFreq = (f) => (f >= 7 ? '每日' : '每週 ' + f + ' 次');
  function hbWeek(h) {
    const k = defaultDay();
    let c = 0;
    for (let i = 0; i < 7; i++) if (h.log[addDays(k, -i)]) c++;
    return c;
  }
  let hbEditing = false,
    hbDelArm = null;
  function renderHabits() {
    const box = $('#habits');
    if (!box) return;
    const k = defaultDay();
    if (!S.habits.length) {
      box.innerHTML = '<p class="muted">未有習慣。撳「修改」加一個你想慢慢養成嘅小習慣。</p>';
    } else
      box.innerHTML =
        '<div class="hb-list">' +
        S.habits
          .map((h) => {
            const v = hbStrength(h);
            const done = !!h.log[k];
            const wk = hbWeek(h);
            const dots = Array.from({ length: 7 }, (_, i) => {
              const d = addDays(k, i - 6);
              return (
                '<i class="' +
                (h.log[d] ? 'on' : '') +
                '" title="' +
                md(d) +
                '"><span>' +
                WD[parseKey(d).getDay()] +
                '</span></i>'
              );
            }).join('');
            return (
              '<div class="hb"><div class="hb-ring" style="--v:' +
              v +
              '" role="img" aria-label="強度 ' +
              v +
              '%"><b>' +
              v +
              '<small>%</small></b></div><div class="hb-main"><div class="row" style="gap:8px;align-items:baseline"><b class="hb-n">' +
              esc(h.name) +
              '</b><span class="chip ' +
              (v >= 50 ? 'good' : '') +
              '">' +
              hbLabel(v) +
              '</span></div><span class="muted">' +
              hbFreq(h.freq) +
              '・最近 7 日 ' +
              wk +
              (h.freq < 7 ? '／' + h.freq : '') +
              ' 次</span><div class="hb-dots">' +
              dots +
              '</div></div><button class="hb-do' +
              (done ? ' on' : '') +
              '" data-hb="' +
              h.id +
              '" aria-pressed="' +
              done +
              '">' +
              (done ? '✓ 做咗' : '今日做咗') +
              '</button></div>'
            );
          })
          .join('') +
        '</div>';
    const ed = $('#hb-editor');
    ed.hidden = !hbEditing;
    $('#hb-edit').textContent = hbEditing ? '完成' : '修改';
    if (hbEditing)
      ed.innerHTML =
        S.habits
          .map(
            (h) =>
              '<div class="hb-ed" data-hbid="' +
              h.id +
              '"><input type="text" maxlength="16" value="' +
              esc(h.name) +
              '" data-hbname="' +
              h.id +
              '" aria-label="習慣名"><select data-hbfreq="' +
              h.id +
              '" aria-label="頻率">' +
              [1, 2, 3, 4, 5, 6, 7]
                .map(
                  (n) =>
                    '<option value="' +
                    n +
                    '"' +
                    (n === h.freq ? ' selected' : '') +
                    '>' +
                    hbFreq(n) +
                    '</option>',
                )
                .join('') +
              '</select><button class="btn ghost small danger" data-hbdel="' +
              h.id +
              '">' +
              (hbDelArm === h.id ? '再撳確認' : '刪除') +
              '</button></div>',
          )
          .join('') +
        (S.habits.length < 8
          ? '<div class="hb-ed"><input type="text" maxlength="16" id="hb-new" placeholder="新習慣，例如：飲夠水"><select id="hb-newf">' +
            [1, 2, 3, 4, 5, 6, 7]
              .map(
                (n) =>
                  '<option value="' +
                  n +
                  '"' +
                  (n === 3 ? ' selected' : '') +
                  '>' +
                  hbFreq(n) +
                  '</option>',
              )
              .join('') +
            '</select><button class="btn small" id="hb-add">加</button></div>'
          : '<p class="muted">最多 8 個。</p>');
  }
  document.addEventListener('click', (e) => {
    const t = e.target;
    const b = t.closest('[data-hb]');
    if (b) {
      const h = S.habits.find((x) => x.id === b.dataset.hb);
      if (!h) return;
      const k = defaultDay();
      if (h.log[k]) {
        delete h.log[k];
        persist();
        renderHabits();
        return;
      }
      h.log[k] = 1;
      persist();
      renderHabits();
      petAward('habit', 3, 3, '習慣');
      const wk = hbWeek(h);
      if (h.freq < 7 && wk === h.freq)
        toast('最近 7 日目標做到：' + h.name + ' ' + wk + '／' + h.freq);
      return;
    }
    if (t.id === 'hb-edit') {
      hbEditing = !hbEditing;
      hbDelArm = null;
      renderHabits();
      return;
    }
    if (t.id === 'hb-add') {
      const n = $('#hb-new').value.trim();
      if (!n) {
        $('#hb-new').focus();
        return;
      }
      S.habits.push({ id: uid(), name: n.slice(0, 16), freq: +$('#hb-newf').value || 3, log: {} });
      persist();
      renderHabits();
      return;
    }
    const d = t.closest('[data-hbdel]');
    if (d) {
      const id = d.dataset.hbdel;
      if (hbDelArm !== id) {
        hbDelArm = id;
        renderHabits();
        setTimeout(() => {
          if (hbDelArm === id) {
            hbDelArm = null;
            if (hbEditing) renderHabits();
          }
        }, 5000);
        return;
      }
      S.habits = S.habits.filter((x) => x.id !== id);
      hbDelArm = null;
      persist();
      renderHabits();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.hbname) {
      const h = S.habits.find((x) => x.id === t.dataset.hbname);
      if (h && t.value.trim()) {
        h.name = t.value.trim().slice(0, 16);
        persist();
      }
    }
    if (t.dataset.hbfreq) {
      const h = S.habits.find((x) => x.id === t.dataset.hbfreq);
      if (h) {
        h.freq = +t.value;
        persist();
      }
    }
  });
  /* ---------- 好嘢熱度圖 ---------- */
  function goodByDay() {
    const m = {};
    const add = (k, n) => {
      if (k) m[k] = (m[k] || 0) + n;
    };
    Object.keys(S.checkins).forEach((k) => add(k, 1));
    Object.keys(S.draws || {}).forEach((k) => add(k, 1));
    (S.habits || []).forEach((h) => Object.keys(h.log || {}).forEach((k) => add(k, 1)));
    (S.evidence || []).forEach((e) => {
      if (!e.seed) add(e.date, 1);
    });
    return m;
  }
  function heatSVG() {
    const m = goodByDay();
    const today = keyOf(new Date());
    const td = parseKey(today);
    const mon = (td.getDay() + 6) % 7;
    const start = addDays(today, -mon - 7 * 15);
    const C = 15,
      G = 3,
      L = 22,
      T = 18;
    let s = '',
      active = 0,
      total = 0;
    const lv = (n) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
    const op = [0, 0.28, 0.5, 0.72, 0.95];
    let lastM = -1;
    for (let w = 0; w < 16; w++) {
      const wd = addDays(start, w * 7);
      const mo = parseKey(wd).getMonth();
      if (mo !== lastM) {
        s +=
          '<text x="' +
          (L + w * (C + G)) +
          '" y="11" font-size="10" fill="var(--ink-3)">' +
          (mo + 1) +
          '月</text>';
        lastM = mo;
      }
      for (let d = 0; d < 7; d++) {
        const k = addDays(start, w * 7 + d);
        if (k > today) continue;
        const n = m[k] || 0;
        if (n) {
          active++;
          total += n;
        }
        const x = L + w * (C + G),
          y = T + d * (C + G);
        s +=
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          C +
          '" height="' +
          C +
          '" rx="3" ' +
          (n ? 'fill="var(--good)" fill-opacity="' + op[lv(n)] + '"' : 'fill="var(--kraft)"') +
          '><title>' +
          md(k) +
          (n ? '：' + n + ' 樣好嘢' : '') +
          '</title></rect>';
      }
    }
    ['一', '三', '五', '日'].forEach((t, i) => {
      const d = [0, 2, 4, 6][i];
      s +=
        '<text x="0" y="' +
        (T + d * (C + G) + 11) +
        '" font-size="10" fill="var(--ink-3)">' +
        t +
        '</text>';
    });
    const W = L + 16 * (C + G),
      H = T + 7 * (C + G);
    return {
      svg:
        '<svg viewBox="0 0 ' +
        W +
        ' ' +
        H +
        '" class="heat" role="img" aria-label="最近 16 個星期做咗好嘢嘅日子">' +
        s +
        '</svg>',
      active,
      total,
    };
  }
  function renderHeat() {
    const box = $('#heat');
    if (!box) return;
    const r = heatSVG();
    box.innerHTML = r.svg;
    $('#heat-sum').innerHTML =
      '最近 16 個星期，有 <b>' + r.active + '</b> 日做咗好嘢，加埋一共 <b>' + r.total + '</b> 樣。';
  }
  /* ---------- 里程碑慶祝 ---------- */
  const nCI = () => Object.keys(S.checkins).length,
    nDR = () => Object.keys(S.draws || {}).length;
  const hbMax = () => Math.max(0, ...(S.habits || []).map((h) => hbStrength(h)));
  const MILES = [
    { id: 'ci1', t: '第一次打卡', s: '開始咗就係最難嘅一步。', f: () => nCI() >= 1 },
    {
      id: 'ci10',
      t: '打卡 10 日',
      s: '十日嘅記錄，已經睇得出你自己嘅節奏。',
      f: () => nCI() >= 10,
    },
    {
      id: 'ci30',
      t: '打卡 30 日',
      s: '一個月嘅自己，一日一日寫落嚟。',
      f: () => nCI() >= 30,
      egg: 1,
    },
    {
      id: 'ci100',
      t: '打卡 100 日',
      s: '一百日。呢份堅持係你自己嘅。',
      f: () => nCI() >= 100,
      egg: 1,
    },
    { id: 'dr1', t: '第一次收工抽卡', s: '書櫃上面多咗第一本書。', f: () => nDR() >= 1 },
    { id: 'dr7', t: '抽咗 7 晚卡', s: '一個星期嘅收工日記。', f: () => nDR() >= 7 },
    { id: 'dr30', t: '抽咗 30 晚卡', s: '成個書櫃開始滿起嚟。', f: () => nDR() >= 30, egg: 1 },
    {
      id: 'zhiji',
      t: '第一張「知己」牌',
      s: '同一張牌見咗 7 次，佢已經好熟你。',
      f: () => Object.values(drawCounts()).some((n) => n >= 7),
      egg: 1,
    },
    { id: 'hb50', t: '第一個習慣強度過 50%', s: '個習慣開始穩定落嚟。', f: () => hbMax() >= 50 },
    {
      id: 'hb80',
      t: '第一個「已經成為習慣」',
      s: '唔使諗都會做，就係習慣。',
      f: () => hbMax() >= 80,
      egg: 1,
    },
    {
      id: 'ev20',
      t: '證據簿有 20 條',
      s: '二十件真實做到嘅事。',
      f: () => (S.evidence || []).length >= 20,
    },
    {
      id: 'lad5',
      t: '細步階梯行咗 5 次',
      s: '每一級都係實際行過嘅。',
      f: () =>
        (S.ladders || []).reduce(
          (n, L) => n + L.steps.reduce((m, x) => m + (x.log || []).length, 0),
          0,
        ) >= 5,
    },
    {
      id: 'teen',
      t: '寵物長大到少年',
      s: '佢同你一齊大個咗。',
      f: () => !!S.pet && allPets().some((x) => petStage(x) >= 1),
    },
    {
      id: 'adult',
      t: '寵物長大到成年',
      s: '一路照顧落嚟嘅結果。',
      f: () => !!S.pet && allPets().some((x) => petStage(x) >= 2),
      egg: 1,
    },
    {
      id: 'hatch1',
      t: '第一隻蛋孵出嚟',
      s: '屋企多咗一位成員。',
      f: () => !!S.pet && (S.pet.hatched || 0) >= 1,
    },
    {
      id: 'friend',
      t: '識到第一個寵物朋友',
      s: '出街行吓，就會識到朋友。',
      f: () => !!S.pet && Object.keys(S.pet.friends || {}).length >= 1,
    },
    {
      id: 'album10',
      t: '相簿有 10 張相',
      s: '十個值得記住嘅畫面。',
      f: () => !!S.pet && (S.pet.album || []).length >= 10,
    },
  ];
  const CQ = [];
  let milesT = 0;
  function milesSoon() {
    clearTimeout(milesT);
    milesT = setTimeout(checkMiles, 1200);
  }
  function checkMiles() {
    if (journalStore.initialLoadPending) {
      milesSoon();
      return;
    }
    if (typeof ritual !== 'undefined' && (ritual || drawing)) {
      milesSoon();
      return;
    }
    S.miles = S.miles || {};
    const fresh = MILES.filter(
      (m) =>
        !S.miles[m.id] &&
        (() => {
          try {
            return m.f();
          } catch (e) {
            return false;
          }
        })(),
    );
    if (!fresh.length) return;
    const k = keyOf(new Date());
    if (!S.milesInit) {
      S.milesInit = 1;
      fresh.forEach((m) => {
        S.miles[m.id] = k;
      });
      if (S.pet) S.pet.coins += 10 * fresh.length;
      persist();
      CQ.push({
        eyebrow: '你一路做到嘅',
        title: '之前已經達成 ' + fresh.length + ' 個里程碑',
        sub: fresh.map((m) => m.t).join('、') + '。',
        rew: S.pet ? '寵物金幣 +' + 10 * fresh.length : '',
      });
      showCele();
      return;
    }
    let changed = false;
    fresh.forEach((m) => {
      S.miles[m.id] = k;
      changed = true;
      let rew = [];
      if (S.pet) {
        S.pet.coins += 20;
        rew.push('金幣 +20');
        if (m.egg) {
          if (addEgg('gold')) rew.push('一隻金蛋');
          else {
            S.pet.coins += 20;
            rew.push('屋企滿咗，改送金幣 +20');
          }
        }
      }
      S.evidence.push({ id: uid(), date: k, type: '做到', text: '里程碑：' + m.t, src: '里程碑' });
      rew.push('已記入證據簿');
      CQ.push({ eyebrow: '里程碑', title: m.t, sub: m.s, rew: rew.join('・') });
    });
    if (changed) {
      persist();
      showCele();
    }
  }
  function celebrate(o) {
    CQ.push(o);
    showCele();
  }
  function showCele() {
    const box = $('#cele');
    if (!box || !box.hidden || !CQ.length) return;
    const o = CQ.shift();
    $('#cele-eb').textContent = o.eyebrow || '里程碑';
    $('#cele-t').textContent = o.title;
    $('#cele-s').textContent = o.sub || '';
    $('#cele-r').textContent = o.rew || '';
    $('#cele-r').hidden = !o.rew;
    $('#cele-art').innerHTML =
      o.art ||
      (S.pet
        ? PET.svg(petO('love'))
        : '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="var(--good-soft)"/><path d="M50 22l8 17 19 2-14 13 4 19-17-10-17 10 4-19-14-13 19-2z" fill="var(--good)"/></svg>');
    box.hidden = false;
    $('#cele-ok').focus();
  }
  document.addEventListener('click', (e) => {
    if (e.target.id === 'cele-ok' || e.target.id === 'cele') {
      $('#cele').hidden = true;
      setTimeout(showCele, 250);
      if (
        !$('#page-pet').hidden &&
        $('#page-pet').classList.contains('on') &&
        segGet('pettab') === 'home' &&
        S.pet
      ) {
        renderRoom();
        renderStatus();
      }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#cele') && !$('#cele').hidden) {
      $('#cele').hidden = true;
      setTimeout(showCele, 250);
    }
  });

  /* ---------- today ---------- */
  const sliders = [
    ['#ci-mood', '#v-mood'],
    ['#ci-anx', '#v-anx'],
    ['#ci-energy', '#v-energy'],
  ];
  sliders.forEach(([i, v]) =>
    $(i).addEventListener('input', () => {
      $(v).textContent = $(i).value;
    }),
  );
  function updateSleepCalc() {
    const h = sleepHours($('#ci-sleep-start').value, $('#ci-sleep-end').value);
    $('#sleep-calc').textContent = h == null ? '—' : '約 ' + h + ' 小時';
  }
  ['#ci-sleep-start', '#ci-sleep-end'].forEach((s) =>
    $(s).addEventListener('input', updateSleepCalc),
  );
  function dateHint(k) {
    const d = parseKey(k);
    const today = keyOf(new Date());
    const rel = k === today ? '今日' : k === addDays(today, -1) ? '琴日' : '';
    $('#date-hint').textContent =
      '星期' + WD[d.getDay()] + (rel ? '・' + rel : '') + '・夜班按開工日計';
  }
  function loadForm(k) {
    const e = S.checkins[k];
    $('#ci-date').value = k;
    dateHint(k);
    segSet('work', e ? e.work : null);
    $('#ci-mood').value = e ? e.mood : 5;
    $('#ci-anx').value = e ? e.anx : 5;
    $('#ci-energy').value = e ? e.energy : 5;
    sliders.forEach(([i, v]) => ($(v).textContent = $(i).value));
    $('#ci-sleep-start').value = (e && e.ss) || '';
    $('#ci-sleep-end').value = (e && e.se) || '';
    updateSleepCalc();
    segSet('seg', e ? e.seg : null);
    segSet('contact', e ? e.contact : null);
    segSet('move', e ? e.move : null);
    $('#ci-mastery').value = (e && e.mastery) || '';
    $('#ci-pleasure').value = (e && e.pleasure) || '';
    $('#ci-next').value = (e && e.next) || '';
    $('#ci-status').textContent = e ? '呢日已經記錄咗，改完再撳一次就得。' : '';
    $('#ci-feedback').innerHTML = '';
    restoreCheckinDraft(k);
  }
  $('#ci-date').addEventListener('change', () => {
    if ($('#ci-date').value) loadForm($('#ci-date').value);
  });
  function recentEntries(k, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const d = addDays(k, -i);
      if (S.checkins[d]) out.push(S.checkins[d]);
    }
    return out;
  }
  function feedbackFor(k, e) {
    const fb = [];
    const hrs = sleepHours(e.ss, e.se);
    if (e.mood <= 2)
      fb.push([
        'red',
        '今日好低。唔使逼自己即刻好返。打開<a data-goto="plan">低潮應急卡</a>，照第 ② 步做一樣就得。',
      ]);
    if (recentEntries(k, 5).filter((x) => x.mood <= 3).length >= 3)
      fb.push([
        'warn',
        '最近幾日心情都偏低。如果想搵人一齊諗吓，安省有免費 CBT 可以自己轉介，資料喺<a data-goto="plan">應急卡最底</a>。',
      ]);
    if (e.anx >= 7)
      fb.push(['calm', '焦慮偏高。試吓<a data-goto="sos">卡住急救</a>第一步，一分鐘就得。']);
    if (e.seg === '3')
      fb.push([
        'warn',
        '瞓眠斷咗三段或以上，就算加埋時數唔少都會好攰。聽日收工試吓一次過瞓，開工前小瞓控制喺 30 分鐘內。',
      ]);
    else if (e.ss && circDiff(e.ss, S.settings.a) > 2)
      fb.push([
        'warn',
        '今日開始瞓嘅時間離錨點 ' +
          S.settings.a +
          ' 差咗 ' +
          Math.round(circDiff(e.ss, S.settings.a) * 10) / 10 +
          ' 個鐘。休息日都盡量唔好差多過 2 個鐘。',
      ]);
    if (hrs != null && hrs < 5 && e.work === 'work')
      fb.push(['red', '主睡眠唔夠 5 個鐘。今晚踩車送單一覺得眼瞓就停低，安全最緊要。']);
    const last3 = recentEntries(k, 3);
    if (last3.length >= 3 && last3.every((x) => x.contact === '0'))
      fb.push([
        'calm',
        '已經連續三日冇同人真正傾過。去<a data-goto="ladder">細步階梯</a>揀第一級試吓，交單時講多句都算。',
      ]);
    if (!fb.length) {
      if (e.contact === '2' || e.contact === '3')
        fb.push(['good', '今日有同人傾到偈。對抗孤獨，呢啲細接觸比諗好多更實在。']);
      if (e.move === '2') fb.push(['good', '有跑步或者運動。運動對焦慮同低落有實際效果。']);
      if (e.mood >= 7) fb.push(['good', '今日狀態唔錯。可以諗吓係咩令今日好啲，寫入三省。']);
    }
    let q = 'w31';
    if (e.mood <= 2) q = 'w63';
    else if (e.anx >= 7) q = 'w27';
    else if (e.seg === '3' || (hrs != null && hrs < 5)) q = 'w61';
    else if (last3.length >= 3 && last3.every((x) => x.contact === '0')) q = 'w43';
    else if (e.mood <= 4) q = 'w03';
    else if (e.mood >= 7) q = 'w34';
    else if (e.mastery) q = 'w55';
    const x = byId(q);
    if (k === defaultDay() && !(S.draws || {})[k])
      fb.push([
        'calm',
        '收工想寫多兩句？去<a data-goto="draw">收工抽卡</a>，寫低今晚嘅說話，抽一張牌。',
      ]);
    return [['', e.mastery ? '記低咗。「做到」嗰條已經放入證據簿。' : '記低咗。']]
      .concat(fb.slice(0, 4))
      .concat([
        [
          '',
          '<span style="font-family:var(--f-head)">「' +
            esc(x.o) +
            '」</span><span class="muted" style="margin-left:8px">' +
            esc(x.s) +
            '</span><br><span style="font-size:13.5px;color:var(--ink-2)">' +
            esc(x.u) +
            '</span>',
        ],
      ]);
  }
  $('#ci-save').addEventListener('click', () => {
    const k = $('#ci-date').value || defaultDay();
    const e = {
      work: segGet('work'),
      mood: +$('#ci-mood').value,
      anx: +$('#ci-anx').value,
      energy: +$('#ci-energy').value,
      ss: $('#ci-sleep-start').value,
      se: $('#ci-sleep-end').value,
      seg: segGet('seg'),
      contact: segGet('contact'),
      move: segGet('move'),
      mastery: $('#ci-mastery').value.trim(),
      pleasure: $('#ci-pleasure').value.trim(),
      next: $('#ci-next').value.trim(),
      t: Date.now(),
    };
    S.checkins[k] = e;
    const cid = 'ci-' + k;
    S.evidence = S.evidence.filter((x) => x.id !== cid);
    if (e.mastery)
      S.evidence.push({ id: cid, date: k, type: '做到', text: e.mastery, src: '打卡' });
    persist({ year: k.slice(0, 4) });
    if (S.pet) {
      petAward('ci', 10, 1, '打卡');
      if (e.contact === '2' || e.contact === '3') petAward('talk', 5, 1, '同人傾偈');
      if (e.move && e.move !== '0') petAward('move', 5, 1, '郁身');
    }
    if (journalStore.storageOK) removeDraft('checkin', k);
    $('#ci-status').textContent = journalStore.storageOK
      ? '已儲存。'
      : '今次未儲存到，請先下載一份記錄。';
    $('#ci-feedback').innerHTML = feedbackFor(k, e)
      .map(([c, t]) => '<div class="fb ' + c + '">' + t + '</div>')
      .join('');
    renderBadge();
  });

  /* ---------- SOS ---------- */
  function sosGo(n) {
    $$('#sos-steps button').forEach((b) => b.classList.toggle('on', b.dataset.s === String(n)));
    $$('.sos-pane').forEach((p) => p.classList.toggle('on', p.dataset.s === String(n)));
  }
  $$('#sos-steps button').forEach((b) => b.addEventListener('click', () => sosGo(b.dataset.s)));
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => sosGo(b.dataset.go)));
  let breathTimer = null;
  function stopBreath(msg) {
    clearTimeout(breathTimer);
    breathTimer = null;
    const o = $('#orb');
    o.style.transitionDuration = '1.2s';
    o.style.transform = 'scale(.62)';
    $('#orb-txt').textContent = msg || '準備';
  }
  $('#breath-start').addEventListener('click', () => {
    stopBreath();
    const phases = [
      ['吸', 2000, 0.86],
      ['再吸少少', 1000, 1],
      ['慢慢呼', 6000, 0.62],
    ];
    let round = 0,
      i = 0;
    const total = 6;
    const o = $('#orb');
    function step() {
      if (i === 0) {
        round++;
        if (round > total) {
          stopBreath('做完喇');
          $('#breath-count').textContent = '做完 6 輪，可以去下一步。';
          return;
        }
        $('#breath-count').textContent = '第 ' + round + ' / ' + total + ' 輪';
      }
      const [txt, dur, sc] = phases[i];
      $('#orb-txt').textContent = txt;
      o.style.transitionDuration = dur + 'ms';
      o.style.transform = 'scale(' + sc + ')';
      i = (i + 1) % phases.length;
      breathTimer = setTimeout(step, dur);
    }
    step();
  });
  $('#breath-stop').addEventListener('click', () => {
    stopBreath();
    $('#breath-count').textContent = '每輪 9 秒，做 6 輪';
  });
  function thoughtReply() {
    const v = $('#thought').value.trim();
    $('#thought-reply').innerHTML = v
      ? '讀多次：「我留意到我有個念頭話『' +
        esc(v) +
        '』。」<br>佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。'
      : '寫低之後，再讀一次。佢係一個念頭，唔係一個事實。佢可以喺度，你照樣行下一步。';
  }
  $$('#thought-chips button').forEach((b) =>
    b.addEventListener('click', () => {
      $('#thought').value = b.dataset.t;
      thoughtReply();
    }),
  );
  $('#thought').addEventListener('input', thoughtReply);
  const tTotal = 15 * 60;
  let tLeft = tTotal,
    tEnd = null,
    tInt = null;
  function tDraw() {
    const s = Math.max(0, Math.round(tLeft));
    $('#timer').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }
  function tTick() {
    tLeft = (tEnd - Date.now()) / 1000;
    if (tLeft <= 0) {
      tLeft = 0;
      clearInterval(tInt);
      tInt = null;
      $('#t-after').hidden = false;
    }
    tDraw();
  }
  $('#t-start').addEventListener('click', () => {
    if (tInt) return;
    if (tLeft <= 0) tLeft = tTotal;
    tEnd = Date.now() + tLeft * 1000;
    tInt = setInterval(tTick, 250);
    $('#t-after').hidden = true;
  });
  $('#t-pause').addEventListener('click', () => {
    if (!tInt) return;
    clearInterval(tInt);
    tInt = null;
    tLeft = (tEnd - Date.now()) / 1000;
    tDraw();
  });
  $('#t-reset').addEventListener('click', () => {
    clearInterval(tInt);
    tInt = null;
    tLeft = tTotal;
    tDraw();
    $('#t-after').hidden = true;
  });
  $('#sos-log').addEventListener('click', () => {
    const used = Math.round((tTotal - Math.max(0, tLeft)) / 60);
    const step = $('#tiny-step').value.trim();
    S.evidence.push({
      id: uid(),
      date: keyOf(new Date()),
      type: '頂住咗唔舒服',
      text:
        '卡住時冇即刻放棄' +
        (used > 0 ? '，自己試咗 ' + used + ' 分鐘' : '') +
        (step ? '：' + step : ''),
      src: '急救',
    });
    persist();
    toast('已經記入證據簿');
    petAward('sos', 10, 1, '卡住急救');
  });

  /* ---------- evidence ---------- */
  const typeColor = { 做到: 'good', 頂住咗唔舒服: 'warn', 學識咗: 'calm', 幫到人: 'red' };
  function renderEvidence() {
    const list = S.evidence.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#ev-count').textContent = '而家有 ' + list.length + ' 條';
    $('#ev-list').innerHTML = list.length
      ? list
          .map(
            (x) =>
              '<li class="item"><span class="chip ' +
              (typeColor[x.type] || '') +
              '">' +
              esc(x.type) +
              '</span><div class="txt">' +
              esc(x.text) +
              '<div class="meta">' +
              md(x.date) +
              (x.seed ? '・起步證據' : '') +
              (x.src ? '・來自' + esc(x.src) : '') +
              '</div></div><button class="x" data-del-ev="' +
              esc(x.id) +
              '" aria-label="刪除">×</button></li>',
          )
          .join('')
      : '<li class="muted">未有記錄。</li>';
  }
  $('#ev-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-ev]');
    if (!b) return;
    S.evidence = S.evidence.filter((x) => x.id !== b.dataset.delEv);
    persist();
    renderEvidence();
  });
  $('#ev-add').addEventListener('click', () => {
    const t = $('#ev-text').value.trim();
    if (!t) {
      $('#ev-text').focus();
      return;
    }
    S.evidence.push({
      id: uid(),
      date: keyOf(new Date()),
      type: segGet('evtype') || '做到',
      text: t,
    });
    persist();
    petAward('ev', 5, 3, '證據');
    $('#ev-text').value = '';
    renderEvidence();
    toast('加咗一條');
  });
  $('#ev-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#ev-add').click();
  });
  $('#ev-pick').addEventListener('click', () => {
    if (!S.evidence.length) return;
    const x = S.evidence[Math.floor(Math.random() * S.evidence.length)];
    const p = $('#ev-picked');
    p.innerHTML =
      esc(x.text) +
      '<div class="muted" style="margin-top:6px;font-family:var(--f-body)">' +
      esc(x.type) +
      '・' +
      md(x.date) +
      '</div>';
    p.hidden = false;
  });

  /* ---------- ladders ---------- */
  const fearCls = (f) => (f <= 3 ? 'l' : f <= 6 ? 'm' : 'h');
  let armedDelete = null;
  function renderLadders() {
    $('#ladders').innerHTML = S.ladders
      .map((L) => {
        const steps = L.steps.slice().sort((a, b) => a.fear - b.fear);
        const next = steps.find((s) => !s.log.length);
        return (
          '<div class="sheet"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>' +
          esc(L.name) +
          '</h2><button class="btn ghost small' +
          (armedDelete === L.id ? ' danger' : '') +
          '" data-del-ladder="' +
          L.id +
          '">' +
          (armedDelete === L.id ? '再撳一次刪除' : '刪除階梯') +
          '</button></div>' +
          '<ul class="list">' +
          (steps.length
            ? steps
                .map((s) => {
                  const last = s.log[s.log.length - 1];
                  return (
                    '<li class="item' +
                    (s.log.length ? ' step-done' : '') +
                    '"><span class="fear ' +
                    fearCls(s.fear) +
                    '" title="驚嘅程度">' +
                    s.fear +
                    '</span><div class="txt"><span>' +
                    esc(s.text) +
                    '</span>' +
                    (last
                      ? '<div class="meta">做咗 ' +
                        s.log.length +
                        ' 次・最近估 ' +
                        last.before +
                        ' 分，實際 ' +
                        last.after +
                        ' 分</div>'
                      : next && next.id === s.id
                        ? '<div class="meta" style="color:var(--red)">建議下一級</div>'
                        : '') +
                    '<div class="inline-form" id="f-' +
                    s.id +
                    '"><div class="label">之前估幾驚 <em id="fb-' +
                    s.id +
                    '">' +
                    s.fear +
                    '</em></div><input type="range" min="0" max="10" value="' +
                    s.fear +
                    '" id="rb-' +
                    s.id +
                    '" data-out="fb-' +
                    s.id +
                    '"><div class="label">實際幾驚 <em id="fa-' +
                    s.id +
                    '">' +
                    s.fear +
                    '</em></div><input type="range" min="0" max="10" value="' +
                    s.fear +
                    '" id="ra-' +
                    s.id +
                    '" data-out="fa-' +
                    s.id +
                    '"><div class="row" style="margin-top:6px"><button class="btn small" data-log="' +
                    s.id +
                    '">記低</button><button class="btn ghost small" data-cancel="' +
                    s.id +
                    '">取消</button></div></div>' +
                    '</div><div class="row" style="flex:none;gap:2px"><button class="btn ghost small" data-open="' +
                    s.id +
                    '">做咗</button><button class="x" data-del-step="' +
                    s.id +
                    '" aria-label="刪除">×</button></div></li>'
                  );
                })
                .join('')
            : '<li class="muted">未有步驟，喺下面加第一級。</li>') +
          '</ul>' +
          '<div class="row" style="margin-top:12px"><input type="text" placeholder="加一級" id="ns-' +
          L.id +
          '" style="flex:1 1 180px"><select id="nf-' +
          L.id +
          '" style="width:auto">' +
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .map(
              (n) =>
                '<option value="' +
                n +
                '"' +
                (n === 4 ? ' selected' : '') +
                '>驚 ' +
                n +
                ' 分</option>',
            )
            .join('') +
          '</select><button class="btn ghost small" data-add-step="' +
          L.id +
          '">加</button></div></div>'
        );
      })
      .join('');
  }
  function findStep(id) {
    for (const L of S.ladders) {
      const s = L.steps.find((x) => x.id === id);
      if (s) return [L, s];
    }
    return [null, null];
  }
  $('#ladders').addEventListener('input', (e) => {
    const r = e.target.closest('input[type=range][data-out]');
    if (r) document.getElementById(r.dataset.out).textContent = r.value;
  });
  $('#ladders').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (!t.dataset.delLadder && armedDelete) {
      armedDelete = null;
    }
    if (t.dataset.open) {
      $('#f-' + t.dataset.open).classList.toggle('on');
      return;
    }
    if (t.dataset.cancel) {
      $('#f-' + t.dataset.cancel).classList.remove('on');
      return;
    }
    if (t.dataset.log) {
      const [, s] = findStep(t.dataset.log);
      if (!s) return;
      const before = +$('#rb-' + s.id).value,
        after = +$('#ra-' + s.id).value;
      s.log.push({ date: keyOf(new Date()), before, after });
      S.evidence.push({
        id: uid(),
        date: keyOf(new Date()),
        type: '頂住咗唔舒服',
        text: s.text + '（估 ' + before + ' 分，實際 ' + after + ' 分）',
        src: '階梯',
      });
      persist();
      renderLadders();
      petAward('lad', 15, 2, '細步階梯');
      toast(after < before ? '實際冇估咁驚，個腦學緊。' : '做咗就係做咗，已經記入證據簿。');
      return;
    }
    if (t.dataset.delStep) {
      const [L, s] = findStep(t.dataset.delStep);
      if (L) {
        L.steps = L.steps.filter((x) => x.id !== s.id);
        persist();
        renderLadders();
      }
      return;
    }
    if (t.dataset.delLadder) {
      if (armedDelete === t.dataset.delLadder) {
        S.ladders = S.ladders.filter((x) => x.id !== armedDelete);
        armedDelete = null;
        persist();
      } else armedDelete = t.dataset.delLadder;
      renderLadders();
      return;
    }
    if (t.dataset.addStep) {
      const id = t.dataset.addStep;
      const inp = $('#ns-' + id);
      const txt = inp.value.trim();
      if (!txt) {
        inp.focus();
        return;
      }
      const L = S.ladders.find((x) => x.id === id);
      L.steps.push({ id: uid(), text: txt, fear: +$('#nf-' + id).value, log: [] });
      persist();
      renderLadders();
    }
  });
  $('#ladder-add').addEventListener('click', () => {
    const n = $('#ladder-name').value.trim();
    if (!n) {
      $('#ladder-name').focus();
      return;
    }
    S.ladders.push({ id: uid(), name: n, steps: [] });
    persist();
    $('#ladder-name').value = '';
    renderLadders();
  });

  /* ---------- review ---------- */
  const rangeDays = () => +(segGet('range') || 7);
  function dayList(n) {
    const end = keyOf(new Date());
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
    return out;
  }
  const svg = (inner, W, H) =>
    '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + inner + '</svg>';
  function xLabels(days, x, H) {
    const step = Math.ceil(days.length / 7);
    return days
      .map((d, i) =>
        i % step === 0 || i === days.length - 1
          ? '<text x="' +
            x(i).toFixed(1) +
            '" y="' +
            (H - 6) +
            '" text-anchor="middle" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">' +
            md(d) +
            '</text>'
          : '',
      )
      .join('');
  }
  function grid(vals, y, P, W) {
    return vals
      .map(
        (v) =>
          '<line x1="' +
          P.l +
          '" x2="' +
          (W - P.r) +
          '" y1="' +
          y(v) +
          '" y2="' +
          y(v) +
          '" style="stroke:var(--rule)"/><text x="' +
          (P.l - 8) +
          '" y="' +
          (y(v) + 4) +
          '" text-anchor="end" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">' +
          v +
          '</text>',
      )
      .join('');
  }
  function lineChart(days) {
    const W = 560,
      H = 210,
      P = { l: 30, r: 26, t: 12, b: 28 };
    const x = (i) =>
      P.l + (days.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (days.length - 1));
    const y = (v) => P.t + ((10 - v) * (H - P.t - P.b)) / 10;
    let g = grid([0, 5, 10], y, P, W);
    [
      ['mood', 'var(--good)'],
      ['anx', 'var(--red)'],
      ['energy', 'var(--calm)'],
    ].forEach(([k, c]) => {
      let d = '',
        pen = false,
        dots = '';
      days.forEach((day, i) => {
        const e = S.checkins[day];
        if (e && e[k] != null) {
          d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(e[k]).toFixed(1) + ' ';
          pen = true;
          dots +=
            '<circle cx="' +
            x(i).toFixed(1) +
            '" cy="' +
            y(e[k]).toFixed(1) +
            '" r="3" style="fill:' +
            c +
            '"/>';
        } else pen = false;
      });
      g +=
        '<path d="' +
        d +
        '" style="fill:none;stroke:' +
        c +
        ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>' +
        dots;
    });
    return svg(g + xLabels(days, x, H), W, H);
  }
  function sleepChart(days) {
    const W = 560,
      H = 210,
      P = { l: 30, r: 26, t: 12, b: 28 },
      MAX = 12;
    const bw = (W - P.l - P.r) / days.length;
    const x = (i) => P.l + i * bw + bw / 2;
    const y = (v) => P.t + ((MAX - v) * (H - P.t - P.b)) / MAX;
    let g = grid([0, 4, 8, 12], y, P, W);
    days.forEach((d, i) => {
      const e = S.checkins[d];
      const h = e ? sleepHours(e.ss, e.se) : null;
      if (h == null) return;
      const v = Math.min(h, MAX);
      const c = e.seg === '3' ? 'var(--red)' : e.seg === '2' ? 'var(--warn)' : 'var(--good)';
      const w = Math.max(4, Math.min(24, bw * 0.6));
      g +=
        '<rect x="' +
        (x(i) - w / 2).toFixed(1) +
        '" y="' +
        y(v).toFixed(1) +
        '" width="' +
        w.toFixed(1) +
        '" height="' +
        (y(0) - y(v)).toFixed(1) +
        '" rx="2" style="fill:' +
        c +
        '"/>';
    });
    const tgt = sleepHours(S.settings.a, S.settings.b);
    if (tgt)
      g +=
        '<line x1="' +
        P.l +
        '" x2="' +
        (W - P.r) +
        '" y1="' +
        y(Math.min(tgt, MAX)) +
        '" y2="' +
        y(Math.min(tgt, MAX)) +
        '" style="stroke:var(--ink-2);stroke-dasharray:4 4"/>';
    return svg(g + xLabels(days, x, H), W, H);
  }
  function stats(days) {
    const es = days.map((d) => S.checkins[d]).filter(Boolean);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    const f = (v) => (v == null ? '—' : Math.round(v * 10) / 10);
    const sl = es.map((e) => sleepHours(e.ss, e.se)).filter((v) => v != null);
    const from = days[0];
    let lad = 0;
    S.ladders.forEach((L) =>
      L.steps.forEach((s) =>
        s.log.forEach((l) => {
          if (l.date >= from) lad++;
        }),
      ),
    );
    return {
      n: es.length,
      mood: f(avg(es.map((e) => e.mood))),
      anx: f(avg(es.map((e) => e.anx))),
      energy: f(avg(es.map((e) => e.energy))),
      sleep: f(avg(sl)),
      contact: es.filter((e) => e.contact === '2' || e.contact === '3').length,
      move: es.filter((e) => e.move && e.move !== '0').length,
      frag: es.filter((e) => e.seg === '3').length,
      ev: S.evidence.filter((x) => !x.seed && x.date >= from).length,
      lad,
    };
  }
  function weekKey() {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return keyOf(d);
  }
  const PHQ = [
    '覺得緊張、焦慮或者坐立不安',
    '唔能夠停止或者控制擔心',
    '做嘢冇乜興趣或者樂趣',
    '覺得情緒低落、沮喪或者絕望',
  ];
  const PHQ_OPT = ['完全冇', '有幾日', '一半以上日子', '差唔多每日'];
  function renderPHQForm() {
    $('#phq-form').innerHTML =
      '<p class="muted" style="margin:8px 0 4px">過去兩個星期，有幾經常受以下問題困擾？</p>' +
      PHQ.map(
        (q, i) =>
          '<div class="q"><p>' +
          (i + 1) +
          '. ' +
          q +
          '</p><div class="seg" data-name="phq' +
          i +
          '">' +
          PHQ_OPT.map((o, v) => '<button data-v="' + v + '">' + o + '</button>').join('') +
          '</div></div>',
      ).join('');
  }
  const phqLevel = (t) =>
    t <= 2
      ? ['正常範圍', 'good']
      : t <= 5
        ? ['輕度', 'calm']
        : t <= 8
          ? ['中度', 'warn']
          : ['偏高', 'red'];
  function phqDue() {
    const last = S.phq[S.phq.length - 1];
    return !last || (Date.now() - parseKey(last.date).getTime()) / 864e5 >= 14;
  }
  function renderBadge() {
    $('#phq-badge').hidden = !(phqDue() && Object.keys(S.checkins).length >= 3);
  }
  function renderPHQLast() {
    const last = S.phq[S.phq.length - 1];
    if (!last) {
      $('#phq-last').textContent = '未做過。做咗第一次之後，呢度會顯示對比。';
      return;
    }
    const prev = S.phq[S.phq.length - 2];
    $('#phq-last').innerHTML =
      '上次 ' +
      md(last.date) +
      '：總分 ' +
      last.total +
      '／12，' +
      phqLevel(last.total)[0] +
      (prev ? '；再上次 ' + prev.total + ' 分' : '') +
      (phqDue()
        ? '。<b>已經夠兩星期，可以再做。</b>'
        : '。下次可以喺 ' + md(addDays(last.date, 14)) + ' 之後做。');
  }
  $('#phq-save').addEventListener('click', () => {
    const v = PHQ.map((_, i) => segGet('phq' + i));
    if (v.some((x) => x == null)) {
      $('#phq-result').innerHTML = '<div class="fb">四條都要揀先計到分。</div>';
      return;
    }
    const n = v.map(Number),
      anx = n[0] + n[1],
      dep = n[2] + n[3],
      total = anx + dep;
    S.phq.push({ date: keyOf(new Date()), total, anx, dep });
    persist();
    petAward('phq', 15, 1, 'PHQ-4');
    const [lv, c] = phqLevel(total);
    let msg =
      '<div class="fb ' +
      c +
      '">總分 ' +
      total +
      '／12，' +
      lv +
      '。焦慮部分 ' +
      anx +
      '／6，低落部分 ' +
      dep +
      '／6。</div>';
    msg +=
      total >= 6 || anx >= 3 || dep >= 3
        ? '<div class="fb">可以帶住今次嘅記錄，同專業人士傾吓最近點樣。安省免費 CBT 可以自己轉介，康福亦有廣東話服務。資料喺<a data-goto="plan">應急卡最底</a>。</div>'
        : '<div class="fb">繼續照而家咁跟進，兩星期後再做一次睇趨勢。</div>';
    $('#phq-result').innerHTML = msg;
    renderPHQLast();
    renderPHQForm();
    renderBadge();
  });
  function renderWeek() {
    const w = weekKey();
    const d = S.weeks[w] || {};
    $('#week-label').textContent = '由星期一 ' + md(w) + ' 開始嘅一星期';
    $('#wk-did').value = d.did || '';
    $('#wk-learn').value = d.learn || '';
    $('#wk-next').value = d.next || '';
  }
  $('#wk-save').addEventListener('click', () => {
    S.weeks[weekKey()] = {
      did: $('#wk-did').value.trim(),
      learn: $('#wk-learn').value.trim(),
      next: $('#wk-next').value.trim(),
    };
    persist();
    petAward('wk', 20, 1, '每週三省');
    toast('儲存咗');
  });
  function renderReview() {
    const days = dayList(rangeDays());
    const s = stats(days);
    $('#stats').innerHTML = [
      ['平均心情', s.mood, '／10'],
      ['平均焦慮', s.anx, '／10'],
      ['平均主睡眠', s.sleep, '小時'],
      ['有傾到偈', s.contact, '日'],
      ['有郁身', s.move, '日'],
      ['新證據・階梯', s.ev + '・' + s.lad, '條・次'],
    ]
      .map(
        ([a, b, c]) =>
          '<div class="sheet stat"><span>' +
          a +
          '</span><b>' +
          b +
          ' <small>' +
          c +
          '</small></b></div>',
      )
      .join('');
    $('#chart-mood').innerHTML = s.n
      ? lineChart(days)
      : '<p class="muted" style="padding:40px 0;text-align:center">呢段時間未有打卡記錄。打完卡，曲線就會喺度出現。</p>';
    $('#chart-sleep').innerHTML = s.n
      ? sleepChart(days)
      : '<p class="muted" style="padding:40px 0;text-align:center">填咗主睡眠時間，呢度就會出棒形圖。</p>';
    renderPHQLast();
    renderWeek();
    renderHeat();
  }
  function buildSummary() {
    const days = dayList(7);
    const s = stats(days);
    const L = [
      '【Dicky 心晴手帳・最近 7 日摘要】',
      '打卡 ' + s.n + '／7 日',
      '平均：心情 ' + s.mood + '、焦慮 ' + s.anx + '、精神 ' + s.energy + '（0 至 10）',
      '平均主睡眠 ' +
        s.sleep +
        ' 小時（錨點 ' +
        S.settings.a +
        ' 至 ' +
        S.settings.b +
        '）；斷開三段或以上 ' +
        s.frag +
        ' 日',
      '有傾到偈 ' + s.contact + ' 日；有郁身 ' + s.move + ' 日',
      '新證據 ' + s.ev + ' 條；階梯行咗 ' + s.lad + ' 次',
      '',
      '每日：',
    ];
    days.forEach((d) => {
      const e = S.checkins[d];
      if (!e) return;
      const h = sleepHours(e.ss, e.se);
      L.push(
        '・' +
          md(d) +
          (e.work === 'off' ? '（休息）' : '') +
          ' 心情' +
          e.mood +
          ' 焦慮' +
          e.anx +
          ' 精神' +
          e.energy +
          (h != null ? ' 瞓' + h + 'h' : '') +
          (e.seg ? (e.seg === '3' ? '/3段+' : '/' + e.seg + '段') : '') +
          (e.mastery ? '｜做到：' + e.mastery : '') +
          (e.next ? '｜細步：' + e.next : ''),
      );
    });
    const last = S.phq[S.phq.length - 1];
    if (last)
      L.push(
        '',
        'PHQ-4（' +
          md(last.date) +
          '）：' +
          last.total +
          '／12（焦慮 ' +
          last.anx +
          '、低落 ' +
          last.dep +
          '）',
      );
    const w = S.weeks[weekKey()];
    if (w && (w.did || w.learn || w.next))
      L.push(
        '',
        '每週三省：做到「' +
          (w.did || '—') +
          '」；學到「' +
          (w.learn || '—') +
          '」；下星期細步「' +
          (w.next || '—') +
          '」',
      );
    const dw = days.map((d) => (S.draws || {})[d]).filter(Boolean);
    if (dw.length)
      L.push(
        '',
        '收工抽卡：' +
          dw
            .map(
              (d) =>
                md(d.date) +
                '「' +
                drawCards(d)
                  .map((x) => card(x.card).name + (x.rev ? '（提醒位）' : ''))
                  .join('／') +
                '」',
            )
            .join('、'),
      );
    const fv = (S.favs || []).map(byId).filter(Boolean);
    if (fv.length)
      L.push(
        '',
        '我收藏嘅座右銘：' +
          fv
            .slice(0, 5)
            .map((x) => '「' + x.o + '」')
            .join(' '),
      );
    L.push('', '請根據呢份摘要，同我傾下星期最值得行嘅一步。直接啲，唔使安慰說話。');
    return L.join('\n');
  }
  function selectText(el) {
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    } catch (e) {}
  }
  $('#sum-copy').addEventListener('click', () => {
    const txt = buildSummary();
    const pre = $('#sum-pre');
    pre.textContent = txt;
    pre.hidden = false;
    const done = (ok) => {
      $('#sum-status').textContent = ok
        ? '複製咗，去對話度貼上就得。'
        : '自動複製唔到，已經幫你揀好下面啲字，手動複製就得。';
      if (!ok) selectText(pre);
    };
    try {
      navigator.clipboard.writeText(txt).then(
        () => done(true),
        () => done(false),
      );
    } catch (e) {
      done(false);
    }
  });

  /* ---------- plan ---------- */
  const PL = ['warn', 'self', 'place', 'people', 'safe', 'reason'];
  const RES = [
    ['988 危機熱線', '打或者 text 988，24 小時，免費', '988'],
    [
      '康福心理健康協會（Hong Fook / Hf Care）',
      '廣東話、普通話輔導同支援，407 Huron St，近 St George 站',
      '416-493-4242',
    ],
    [
      '安省免費 CBT（Ontario Structured Psychotherapy）',
      '專做焦慮同抑鬱，可以自己轉介，唔使 OHIP 卡或家庭醫生。多倫多經 CAMH，打完揀 2',
      '416-535-8501',
    ],
    ['ConnexOntario', '24 小時，幫你搵合適嘅心理服務', '1-866-531-2600'],
    ['家庭醫生／Walk-in 診所', '有 OHIP 免費，可以轉介精神科', null],
    ['即時危險', '自己或者身邊人有即時危險', '911'],
  ];
  function renderRes() {
    $('#res-list').innerHTML = RES.map(
      ([n, d, num], i) =>
        '<div class="res"><div><b>' +
        n +
        '</b><span class="muted">' +
        d +
        '</span></div>' +
        (num
          ? '<div class="num"><code id="num-' +
            i +
            '">' +
            num +
            '</code><button class="btn ghost small" data-copy="' +
            i +
            '">複製</button></div>'
          : '') +
        '</div>',
    ).join('');
  }
  $('#res-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const el = $('#num-' + b.dataset.copy);
    const txt = el.textContent;
    try {
      navigator.clipboard.writeText(txt).then(
        () => toast('複製咗 ' + txt),
        () => {
          selectText(el);
          toast('已揀好號碼，手動複製');
        },
      );
    } catch (err) {
      selectText(el);
    }
  });
  function renderPlan() {
    PL.forEach((k) => ($('#pl-' + k).value = S.plan[k] || ''));
  }
  $('#pl-save').addEventListener('click', () => {
    PL.forEach((k) => (S.plan[k] = $('#pl-' + k).value));
    persist();
    $('#pl-status').textContent = '儲存咗。';
  });

  /* ---------- settings ---------- */
  function renderSettings() {
    renderRecoveryStatus();
    $('#set-a').value = S.settings.a;
    $('#set-b').value = S.settings.b;
    segSet('theme', S.settings.theme);
    segSet('buddy', S.settings.buddy === false ? 'off' : 'on');
  }
  $('#set-save').addEventListener('click', () => {
    S.settings.a = $('#set-a').value || '09:00';
    S.settings.b = $('#set-b').value || '16:30';
    S.settings.theme = segGet('theme') || 'auto';
    S.settings.buddy = segGet('buddy') !== 'off';
    applyTheme();
    updBuddy();
    persist();
    toast('設定儲存咗');
  });
  $('#bk-export').addEventListener('click', async () => {
    const data = JSON.stringify(S, null, 2);
    const name = 'dicky-心晴手帳-備份-' + keyOf(new Date()) + '.json';
    downloadJSON(data, name);
    toast('備份開始下載喇。');
  });
  let pendingImport = null;
  $('#bk-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast('呢個檔案太大，暫時只可以開 10 MB 以內嘅備份。');
      return;
    }
    const r = new FileReader();
    r.onerror = () => toast('讀唔到呢份備份，請再揀一次檔案。');
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        window.JournalCore.validateBackup(
          d,
          DECK.map((c) => c.id),
        );
        pendingImport = normalize(d);
        $('#import-summary').textContent =
          '備份包含 ' +
          Object.keys(d.checkins).length +
          ' 日打卡、' +
          Object.keys(d.draws || {}).length +
          ' 晚抽卡' +
          (d.pet ? '，以及寵物「' + d.pet.name + '」。' : '。');
        $('#import-dialog').showModal();
      } catch (err) {
        pendingImport = null;
        toast('讀唔到呢份備份。請揀返由手帳下載嘅備份檔案。');
      }
    };
    r.readAsText(f);
  });
  $('#import-cancel').addEventListener('click', () => {
    pendingImport = null;
    $('#import-dialog').close();
  });
  $('#import-dialog').addEventListener('cancel', () => {
    pendingImport = null;
  });
  $('#import-confirm').addEventListener('click', () => {
    if (!pendingImport) return;
    if (journalStore.busy) {
      toast('記錄仲同步緊，完成後就可以還原。');
      return;
    }
    if (!journalStore.restoreBackup(pendingImport)) {
      toast('暫時存唔到現有記錄，今次先唔還原。請下載一份備份，再試一次。');
      return;
    }
    stopGame();
    cancelTrip();
    stopHaven();
    clearOwnerDrafts();
    pendingImport = null;
    memory = null;
    $('#import-dialog').close();
    render();
    go(PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'island');
    toast(
      journalStore.storageOK
        ? '備份已還原。之前嘅記錄亦有留底。'
        : '今次未儲存到，請先下載一份記錄。',
    );
  });
  let clearArmed = false;
  $('#bk-clear').addEventListener('click', () => {
    if (journalStore.busy) {
      toast('記錄仲同步緊，完成後就可以清除。');
      return;
    }
    if (!clearArmed) {
      clearArmed = true;
      $('#bk-clear').textContent = '再撳一次清除全部記錄';
      setTimeout(() => {
        clearArmed = false;
        $('#bk-clear').textContent = '清除所有資料';
      }, 5000);
      return;
    }
    clearArmed = false;
    $('#bk-clear').textContent = '清除所有資料';
    stopGame();
    cancelTrip();
    stopHaven();
    clearOwnerDrafts();
    memory = null;
    journalStore.clear();
    render();
    go('island');
    toast('清除咗');
  });

  /* ---------- Heartland world, garden and quiet arcade ---------- */
  const JC = window.JournalCore;
  const DESTINATIONS = {
    home: {
      name: '暖暖屋',
      icon: '⌂',
      text: '探吓你嘅伙伴、佈置屋企，或者一齊去散步。',
      button: '入屋坐吓',
      page: 'pet',
      x: 28,
      y: 40,
    },
    library: {
      name: '觀星書屋',
      icon: '✦',
      text: '留低今晚嘅故事，遇見一張屬於今日嘅牌。',
      button: '推門入去',
      page: 'draw',
      x: 72,
      y: 42,
    },
    garden: {
      name: '成長花園',
      icon: '❀',
      text: '每一日嘅記錄都會留低，花園跟住你慢慢長大。',
      button: '去花園',
      page: null,
      x: 28,
      y: 70,
    },
    lake: {
      name: '靜靜湖畔',
      icon: '≈',
      text: '望吓湖水，陪自己停一停。乜都唔做都可以。',
      button: '去坐一陣',
      page: 'haven',
      x: 75,
      y: 74,
    },
    plaza: {
      name: '小遊戲廣場',
      icon: '◇',
      text: '帶伙伴去星光尋路、推箱解謎，或者慢慢玩配對。',
      button: '去玩遊戲',
      page: 'arcade',
      x: 50,
      y: 59,
    },
  };
  let destination = 'home',
    worldTime = 'auto',
    memory = null,
    memoryTimer = null,
    memoryOwner = null;
  function companionArt(expr = 'happy') {
    return S.pet ? PET.svg(petO(expr)) : PET.svg({ sp: 'cloud', color: 'milktea', stage: 1, expr });
  }
  function worldHour() {
    return worldTime === 'night' ? 22 : worldTime === 'day' ? 13 : new Date().getHours();
  }
  function renderWorldTime() {
    const hour = worldHour();
    const night = hour >= 19 || hour < 6;
    $('#island-world').dataset.time = night ? 'night' : 'day';
    $('#island-world .world-art').src = 'assets/island-' + (night ? 'night' : 'day') + '.webp';
    $$('[data-world-time]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.worldTime === worldTime)),
    );
    $('#island-season').textContent =
      (hour >= 19 || hour < 6 ? '月光小島' : '日光小島') + ' · 隨時歡迎你';
  }
  function chooseDestination(k) {
    if (!DESTINATIONS[k]) return;
    destination = k;
    const d = DESTINATIONS[k];
    $$('[data-destination]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.destination === k)),
    );
    $('#world-companion').style.left = d.x + '%';
    $('#world-companion').style.top = d.y + '%';
    $('#island-destination').innerHTML =
      '<div class="destination-icon" aria-hidden="true">' +
      d.icon +
      '</div><div><h2>' +
      d.name +
      '</h2><p>' +
      d.text +
      '</p></div><button class="btn" id="destination-enter">' +
      d.button +
      ' →</button>';
  }
  function gardenSVG(level, decor, watered) {
    const flowers = (count) =>
      Array.from({ length: count }, (_, i) => {
        const x = 58 + ((i * 47) % 380),
          y = 167 + ((i * 23) % 62),
          c = ['#dd9b96', '#dab858', '#9eafce', '#9bb679'][i % 4];
        return (
          '<g transform="translate(' +
          x +
          ' ' +
          y +
          ')"><path d="M0 7Q-5 -8 0 -24" stroke="#52795a" stroke-width="2" fill="none"/><ellipse cx="-5" cy="-5" rx="7" ry="3" fill="#759563" transform="rotate(30)"/><g fill="' +
          c +
          '"><circle cy="-26" r="7"/><circle cx="-6" cy="-19" r="7"/><circle cx="6" cy="-19" r="7"/></g><circle cy="-20" r="4" fill="#fff0b0"/></g>'
        );
      }).join('');
    const tree = (x, y, r) =>
      '<g><path d="M' +
      x +
      ' ' +
      y +
      'v-50" stroke="#977959" stroke-width="9" stroke-linecap="round"/><circle cx="' +
      x +
      '" cy="' +
      (y - 67) +
      '" r="' +
      r +
      '" fill="#70926a"/><circle cx="' +
      (x - 18) +
      '" cy="' +
      (y - 51) +
      '" r="' +
      r * 0.7 +
      '" fill="#819f74"/><circle cx="' +
      (x + 17) +
      '" cy="' +
      (y - 53) +
      '" r="' +
      r * 0.7 +
      '" fill="#567d61"/></g>';
    return (
      '<svg viewBox="0 0 500 280" role="img" aria-label="' +
      [
        '剛播種的小花園',
        '小徑旁開始長出葉子',
        '花朵逐漸盛開',
        '溫室亮起暖燈',
        '繁花盛開的小島花園',
      ][level] +
      '"><defs><linearGradient id="garden-sky" x2="0" y2="1"><stop stop-color="#d7e6db"/><stop offset="1" stop-color="#fcf3d6"/></linearGradient></defs><rect width="500" height="280" fill="url(#garden-sky)"/><circle cx="415" cy="53" r="25" fill="#fff4c6"/><path d="M0 145Q110 83 235 143T500 125V280H0" fill="#c2d2a8"/><path d="M0 185Q130 124 260 184T500 166V280H0" fill="#a8bf90"/><ellipse cx="255" cy="240" rx="204" ry="31" fill="#97b083"/><path d="M265 280Q210 240 270 210T265 139" stroke="#e9ddbd" stroke-width="27" fill="none"/>' +
      tree(75, 173, 30) +
      (level >= 1 ? tree(430, 174, 35) : '') +
      '<g fill="#b58860" stroke="#9f7857" stroke-width="2"><path d="M134 204l65 -17 39 17 -65 20z"/><path d="M134 204v14l39 20v-14M173 238l65 -20v-14"/></g><g fill="#6c8350">' +
      [0, 1, 2]
        .map(
          (i) =>
            '<path d="M' +
            (166 + i * 19) +
            ' ' +
            (205 - i * 3) +
            'q-13 -22 -20 -12q10 13 20 12q1 -21 12 -17q4 14 -12 17"/>',
        )
        .join('') +
      '</g>' +
      (level >= 2
        ? '<g fill="#e9ead8" stroke="#729787" stroke-width="3"><path d="M315 170V105l44 -31 44 31v65z"/><path d="M315 105h88M359 74v96M337 90v80M381 90v80" fill="none"/><path d="M349 170v-39h20v39" fill="#f5d99d"/></g>'
        : '') +
      flowers(level * 5 + (decor === 'flowers' ? 7 : 1)) +
      (decor === 'lantern'
        ? '<path d="M302 208v-55q0 -12 13 -12" stroke="#7d7959" stroke-width="3" fill="none"/><rect x="308" y="139" width="14" height="22" rx="4" fill="#ffe4a2" stroke="#b1995d"/><circle cx="315" cy="150" r="24" fill="#ffe9ad" opacity=".22"/>'
        : '') +
      (decor === 'stars'
        ? '<g fill="#fff6be"><path d="M100 39l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM215 69l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM355 35l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>'
        : '') +
      (watered
        ? '<g fill="#649fa2" opacity=".8"><path d="M150 164q-9 13 0 13t0 -13M180 155q-9 13 0 13t0 -13M210 163q-9 13 0 13t0 -13"/></g>'
        : '') +
      '</svg>'
    );
  }
  function renderGarden() {
    const p = JC.progress(S),
      j = S.journey,
      k = defaultDay(),
      watered = !!j.watered[k];
    $('#garden-stage').textContent = p.name;
    $('#garden-title').textContent = p.days + ' 日照顧自己嘅足跡';
    $('#garden-description').textContent = '每記錄一日心情、日記、習慣或小成就，花園就會長大一點。';
    $('#garden-progress-text').textContent = p.next
      ? '再記錄 ' + p.remaining + ' 日，就會到「' + p.next + '」。'
      : '花園已經盛開，之後嘅每一日仍會繼續記低。';
    $('#garden-progress').value = p.percent;
    $('#garden-progress').setAttribute('aria-label', '下一個花園階段進度');
    $('#garden-art').innerHTML = gardenSVG(p.level, j.decor, watered);
    $('#garden-water').disabled = watered;
    $('#garden-water').textContent = watered ? '今日淋過喇 ✓' : '淋一淋花';
    $('#garden-water-note').textContent = watered
      ? '今日淋過水喇。'
      : '淋一淋花，留低今日到訪嘅足跡。';
    $$('[data-decor]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.decor === j.decor)),
    );
  }
  function renderIsland() {
    const p = JC.progress(S),
      k = defaultDay(),
      cnt = drawCounts(),
      owned = Object.keys(cnt).length;
    $('#quiet-toggle').setAttribute('aria-pressed', String(!!S.settings.quiet));
    $('#quiet-toggle').textContent = S.settings.quiet ? '減少動態：開' : '減少動態';
    $('#world-companion').innerHTML = companionArt();
    renderWorldTime();
    chooseDestination(destination);
    $('#island-pet-link').textContent = S.pet ? '探吓' + S.pet.name : '領養小伙伴';
    $('#island-passport').innerHTML =
      '<span class="section-kicker">ISLAND PASSPORT</span><div class="passport-top"><div class="passport-avatar">' +
      companionArt() +
      '</div><div><h2>' +
      esc(S.pet ? S.pet.name + '陪住你' : '你嘅小小世界') +
      '</h2><p>' +
      p.name +
      '</p></div></div><div class="passport-stats"><div><b>' +
      p.days +
      '</b><span>記錄日子</span></div><div><b>' +
      owned +
      '</b><span>遇見牌卡</span></div><div><b>' +
      (S.pet ? S.pet.coins : 0) +
      '</b><span>寵物金幣</span></div></div>';
    $('#island-date').textContent = md(k) + ' · 夜班跟開工日';
    $('#island-tasks').innerHTML = JC.tasks(S, k)
      .map(
        (t) =>
          '<button class="quest ' +
          (t.done ? 'done' : '') +
          '" data-goto="' +
          t.page +
          '"><span class="quest-check" aria-hidden="true">' +
          (t.done ? '✓' : '○') +
          '</span><span><b>' +
          t.name +
          (t.done ? ' · 已留低' : '') +
          '</b><small>' +
          t.detail +
          '</small></span><span class="quest-arrow">↗</span></button>',
      )
      .join('');
    const recent = Object.values(S.draws || {}).sort((a, b) => b.date.localeCompare(a.date))[0];
    $('#island-souvenir').innerHTML =
      recent && card(recent.card)
        ? '<span class="section-kicker">A MEMORY TO KEEP</span><div class="souvenir-preview">' +
          cardFace(card(recent.card), false, 1) +
          '</div><h2>最近遇見：' +
          esc(card(recent.card).name) +
          '</h2><p>每一張牌，都收住一晚嘅故事。</p><button class="linkbtn" data-goto="draw">返書屋睇返 →</button>'
        : '<span class="section-kicker">A MEMORY TO KEEP</span><h2>第一個故事，等緊你。</h2><p>寫低一句今晚想講嘅說話，書屋就會多一張牌。</p><button class="linkbtn" data-goto="draw">去書屋 →</button>';
    renderGarden();
    renderPostcards();
    const earned = MILES.filter((m) => S.miles[m.id]);
    $('#achievement-count').textContent = earned.length + ' / ' + MILES.length;
    $('#island-achievements').innerHTML = MILES.map(
      (m, i) =>
        '<div class="achievement ' +
        (S.miles[m.id] ? 'earned' : '') +
        '"><span class="achievement-medal" aria-hidden="true">' +
        (S.miles[m.id] ? '✹' : '◇') +
        '</span><div><b>' +
        esc(m.t) +
        '</b><small>' +
        (S.miles[m.id] ? '已留低 · ' + md(S.miles[m.id]) : '慢慢嚟，隨時開始') +
        '</small></div></div>',
    ).join('');
  }
  const MEMORY_PALS = [
    ['cat', 'milktea', '奶茶貓'],
    ['dog', 'mint', '薄荷柴'],
    ['cloud', 'sakura', '櫻花雲'],
    ['cat', 'night', '夜空貓'],
    ['dog', 'snow', '雪白柴'],
    ['cloud', 'milktea', '奶茶雲'],
  ];
  function renderMemory() {
    if (!memory || memoryOwner !== S.journey) {
      clearTimeout(memoryTimer);
      memoryOwner = S.journey;
      memory = JC.createMemory();
      $('#memory-status').textContent = '準備好，就揀一張。';
    }
    $('#memory-moves').textContent =
      memory.moves + ' 次翻牌 · ' + memory.matched.length / 2 + '/6 對';
    $('#memory-grid').innerHTML = memory.cards
      .map((v, i) => {
        const open = memory.open.includes(i),
          matched = memory.matched.includes(i),
          pal = MEMORY_PALS[v];
        return (
          '<button class="memory-tile ' +
          (open ? 'open ' : '') +
          (matched ? 'matched' : '') +
          '" data-memory="' +
          i +
          '" aria-label="第 ' +
          (i + 1) +
          ' 張，' +
          (open || matched ? pal[2] + (matched ? '，已配對' : '') : '未揭開') +
          '" aria-disabled="' +
          (matched || open || memory.busy) +
          '">' +
          (open || matched
            ? PET.svg({ sp: pal[0], color: pal[1], stage: 1, expr: matched ? 'love' : 'happy' }) +
              '<small>' +
              pal[2] +
              '</small>'
            : '<span aria-hidden="true">✦</span>') +
          '</button>'
        );
      })
      .join('');
    $('#memory-buddy').innerHTML = companionArt('happy');
    const played = Number(S.journey.games[defaultDay()]) || 0;
    $('#memory-reward').textContent =
      (S.pet
        ? '每日頭兩局完成各有 5 金幣。今日已玩 ' + played + ' 局。'
        : '可以隨時玩。領養伙伴後，每日頭兩局完成各有 5 金幣。') +
      (S.journey.best ? ' 最少翻牌紀錄：' + S.journey.best + ' 次。' : '');
  }
  function resetMemory() {
    clearTimeout(memoryTimer);
    memoryOwner = S.journey;
    memory = JC.createMemory();
    $('#memory-status').textContent = '準備好，就揀一張。';
    renderMemory();
  }
  function memoryFlip(i) {
    if (memoryOwner !== S.journey) {
      renderMemory();
      return;
    }
    const outcome = JC.flipMemory(memory, i);
    if (outcome === 'ignored') return;
    if (outcome === 'miss') {
      const current = memory;
      $('#memory-status').textContent = '記低佢哋嘅位置，再試一對。';
      memoryTimer = setTimeout(() => {
        if (memory !== current) return;
        JC.closeMemory(memory);
        renderMemory();
      }, 1100);
    } else if (outcome === 'match') $('#memory-status').textContent = '搵到一對喇！';
    else if (outcome === 'complete') {
      const gain = JC.gameReward(S.journey, defaultDay());
      S.journey.best = Math.min(S.journey.best || Infinity, memory.moves);
      if (S.pet && gain) {
        S.pet.coins += gain;
        need('fun', 10);
      }
      persist();
      $('#memory-status').textContent =
        '六對都搵到喇！' + (S.pet && gain ? ' 金幣 +' + gain + '。' : '') + ' 想休息就返小島坐吓。';
    }
    renderMemory();
    const next = $('[data-memory="' + i + '"]');
    if (next) next.focus();
  }
  function renderHaven() {
    const h = worldHour();
    $('#haven-scene').innerHTML =
      '<img class="haven-art" src="assets/lakeside.webp" width="1536" height="1024" alt="金色陽光下的湖畔碼頭、木椅與遠山">' +
      '<div class="haven-pet">' +
      companionArt('normal') +
      '</div>';
    $('#haven-copy').textContent = '坐低一陣，望吓湖水同遠山。';
  }
  let havenTimer = null,
    havenEnd = 0;
  function stopHaven() {
    clearInterval(havenTimer);
    havenTimer = null;
    const b = $('#haven-rest');
    if (b) b.textContent = '陪我坐一分鐘';
  }
  function startHaven() {
    if (havenTimer) {
      stopHaven();
      $('#haven-copy').textContent = '下次再嚟坐吓。';
      return;
    }
    havenEnd = Date.now() + 60000;
    $('#haven-rest').textContent = '隨時結束';
    const tick = () => {
      const left = Math.max(0, Math.ceil((havenEnd - Date.now()) / 1000));
      $('#haven-copy').textContent =
        left > 0
          ? '仲有 ' + left + ' 秒。望吓遠處，照平時咁呼吸就得。'
          : '一分鐘過咗。想繼續坐吓，定返小島行吓？';
      if (left === 0) stopHaven();
    };
    tick();
    havenTimer = setInterval(tick, 1000);
  }
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-destination]');
    if (d) chooseDestination(d.dataset.destination);
    const t = e.target.closest('[data-world-time]');
    if (t) {
      worldTime = t.dataset.worldTime;
      renderWorldTime();
    }
    if (e.target.closest('#destination-enter')) {
      const x = DESTINATIONS[destination];
      discoverPlace(destination);
      if (x.page) go(x.page);
      else
        $('#garden-section').scrollIntoView({
          behavior: RM() ? 'auto' : 'smooth',
          block: 'center',
        });
    }
    if (e.target.closest('#quiet-toggle')) {
      S.settings.quiet = !S.settings.quiet;
      applyTheme();
      persist();
      renderIsland();
    }
    const decor = e.target.closest('[data-decor]');
    if (decor) {
      S.journey.decor = decor.dataset.decor;
      persist();
      renderGarden();
    }
    if (e.target.closest('#garden-water')) {
      const k = defaultDay();
      if (S.journey.watered[k]) return;
      S.journey.watered[k] = true;
      persist();
      renderGarden();
      toast('花園收到你嘅心意 🌱');
    }
    const m = e.target.closest('[data-memory]');
    if (m) memoryFlip(Number(m.dataset.memory));
    if (e.target.closest('#memory-restart')) resetMemory();
    if (e.target.closest('#arcade-walk')) {
      segSet('pettab', 'out');
      go('pet');
    }
    if (e.target.closest('#haven-rest')) startHaven();
  });
  window.addEventListener('hashchange', () => {
    const p = location.hash.slice(1);
    if (PAGES.includes(p)) go(p);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGame();
      roamStop();
      stopHaven();
    } else if ($('#page-pet').classList.contains('on') && segGet('pettab') === 'home' && S.pet)
      roamArm();
  });

  const POSTCARDS = {
    home: ['有燈嘅地方', '返到屋企，先放低今日。'],
    library: ['替故事留個位', '每一晚，都有一頁值得留低。'],
    garden: ['慢慢長大', '泥土記得落過嘅雨，花園記得你行過嘅路。'],
    lake: ['湖邊一分鐘', '坐低一陣，湖水會繼續慢慢流。'],
    plaza: ['一點遊戲時間', '玩得開心，已經係一個好理由。'],
  };
  function discoverPlace(id) {
    if (S.journey.discovered[id]) return;
    S.journey.discovered[id] = defaultDay();
    if (S.pet) S.pet.coins += 3;
    persist();
    renderPostcards();
    toast('發現「' + POSTCARDS[id][0] + '」明信片' + (S.pet ? ' · 金幣 +3' : ''));
  }
  function renderPostcards() {
    const d = S.journey.discovered;
    $('#postcard-count').textContent = Object.keys(POSTCARDS).filter((k) => d[k]).length + ' / 5';
    $('#island-postcards').innerHTML = Object.entries(POSTCARDS)
      .map(
        ([k, v]) =>
          '<button class="postcard ' +
          (d[k] ? 'collected' : '') +
          '" data-postcard="' +
          k +
          '" aria-label="' +
          (d[k] ? v[0] : '未發現：' + DESTINATIONS[k].name) +
          '"><span class="postcard-art postcard-' +
          k +
          '">' +
          (!d[k] ? '<i>◇</i>' : '') +
          '</span><b>' +
          (d[k] ? v[0] : DESTINATIONS[k].name) +
          '</b><small>' +
          (d[k] ? '已收藏 · ' + md(d[k]) : '去探一探就會遇見') +
          '</small></button>',
      )
      .join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-postcard]');
    if (!b) return;
    const k = b.dataset.postcard;
    if (!S.journey.discovered[k]) {
      chooseDestination(k);
      $('#island-world').scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    $('#postcard-title').textContent = POSTCARDS[k][0];
    $('#postcard-message').textContent = POSTCARDS[k][1];
    $('#postcard-picture').className = 'postcard-picture postcard-' + k;
    $('#postcard-dialog').showModal();
  });
  $('#postcard-close').addEventListener('click', () => $('#postcard-dialog').close());

  /* Unsaved writing stays on this browser, partitioned by the last signed-in owner. */
  function draftKey(kind, k) {
    let owner = 'local';
    try {
      owner = localStorage.getItem(CLOUD_UID_KEY) || 'local';
    } catch (e) {}
    return LS + '-draft-' + owner + '-' + kind + '-' + k;
  }
  function clearOwnerDrafts() {
    try {
      const prefix = draftKey('', '').slice(0, -1);
      for (const k of Object.keys(localStorage))
        if (k.startsWith(prefix)) localStorage.removeItem(k);
    } catch (e) {}
  }
  function readDraft(kind, k) {
    try {
      return JSON.parse(localStorage.getItem(draftKey(kind, k)) || 'null');
    } catch (e) {
      return null;
    }
  }
  function writeDraft(kind, k, value) {
    try {
      localStorage.setItem(draftKey(kind, k), JSON.stringify(value));
    } catch (e) {
      $('#storage-warning').hidden = false;
    }
  }
  function removeDraft(kind, k) {
    try {
      localStorage.removeItem(draftKey(kind, k));
    } catch (e) {}
  }
  function restoreCheckinDraft(k) {
    const d = readDraft('checkin', k);
    if (!d || !d.fields) return;
    for (const [id, v] of Object.entries(d.fields)) {
      const el = document.getElementById(id);
      if (el) el.value = v;
    }
    for (const [name, v] of Object.entries(d.segments || {})) segSet(name, v);
    sliders.forEach(([i, v]) => ($(v).textContent = $(i).value));
    updateSleepCalc();
    $('#ci-status').textContent = '已恢復未儲存草稿，完成後撳「記低」。';
  }
  function saveCheckinDraft() {
    const k = $('#ci-date').value || defaultDay(),
      fields = {},
      segments = {};
    [
      'ci-mood',
      'ci-anx',
      'ci-energy',
      'ci-sleep-start',
      'ci-sleep-end',
      'ci-mastery',
      'ci-pleasure',
      'ci-next',
    ].forEach((id) => (fields[id] = document.getElementById(id).value));
    ['work', 'seg', 'contact', 'move'].forEach((name) => (segments[name] = segGet(name)));
    writeDraft('checkin', k, { fields, segments });
  }
  $('#page-today').addEventListener('input', (e) => {
    if (e.target.id !== 'ci-date') saveCheckinDraft();
  });
  $('#page-today').addEventListener('click', (e) => {
    if (e.target.closest('.seg')) setTimeout(saveCheckinDraft, 0);
  });
  $('#dr-text').addEventListener('input', () =>
    writeDraft('draw', defaultDay(), { text: $('#dr-text').value }),
  );
  function downloadJSON(content, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    try {
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }
  $('#bk-previous').addEventListener('click', () => {
    const raw = journalStore.getBackup('previous');
    if (!raw) {
      toast('仲未有還原前嘅記錄可以下載。');
      return;
    }
    downloadJSON(raw, 'dicky-care-before-import.json');
  });
  $('#bk-recovery').addEventListener('click', () => {
    const raw = journalStore.getBackup('original');
    if (!raw) {
      toast('暫時冇另外留底嘅記錄。');
      return;
    }
    downloadJSON(raw, 'dicky-care-original-recovery.json');
  });
  $('#bk-recovery-edits').addEventListener('click', () => {
    const raw = journalStore.getBackup('edits');
    if (!raw) {
      toast('暫時冇未同步嘅修改可以下載。');
      return;
    }
    downloadJSON(raw, 'dicky-care-offline-edits-recovery.json');
  });
  $('#recovery-dismiss').addEventListener('click', dismissRecoveryNotice);

  /* ---------- Starlight Trail: persistent, turn-based puzzle adventure ---------- */
  const AD = window.IslandAdventure;
  let adventureRun = null,
    adventureOwner = null,
    adventureHistory = [],
    adventureFacing = 'right';
  function getCampaign() {
    return S.journey.adventure || (S.journey.adventure = AD.campaign());
  }
  function trailSprite(kind) {
    const art = {
      tree: '<ellipse cx="30" cy="53" rx="22" ry="5" fill="#294c3b" opacity=".18"/><path d="M28 50V30h5v20" fill="#997753"/><path d="M30 4L10 31h8L5 44q25 12 50 0L42 31h8z" fill="#668b63"/><path d="M30 4L10 31h8L5 44q13 6 25 6z" fill="#83a275"/><path d="M30 4l-5 12h11z" fill="#a3b990"/>',
      bush: '<ellipse cx="30" cy="52" rx="23" ry="5" fill="#365a40" opacity=".15"/><path d="M8 43q-8-23 14-23q8-19 24-4q18 0 12 22q-6 18-28 16z" fill="#7a9b69"/><circle cx="22" cy="29" r="14" fill="#99b17d"/><circle cx="43" cy="37" r="13" fill="#68875e"/><circle cx="16" cy="41" r="2" fill="#ead58a"/><circle cx="43" cy="31" r="2" fill="#e3b3a0"/>',
      star: '<ellipse cx="30" cy="48" rx="12" ry="4" fill="#987b35" opacity=".17"/><path d="M30 8l6 14 15 2-12 10 4 15-13-8-13 8 4-15-12-10 15-2z" fill="#f4ce6e" stroke="#fff1b8" stroke-width="2"/><path d="M30 13l5 12 11 1-16 7z" fill="#fff3c5"/>',
      crate:
        '<ellipse cx="30" cy="52" rx="23" ry="4" fill="#6c5233" opacity=".2"/><path d="M8 14l35-5 10 8v32l-36 6-9-8z" fill="#a57545"/><path d="M8 14l35-5 10 8-36 5z" fill="#d4b17b"/><path d="M17 22l36-5v32l-36 6z" fill="#c99a60" stroke="#966d41" stroke-width="2"/><path d="M22 25l26 20M47 23L23 49" stroke="#e8c78f" stroke-width="5"/><path d="M11 19v25" stroke="#bc935d" stroke-width="3"/>',
      key: '<ellipse cx="30" cy="48" rx="13" ry="4" fill="#988249" opacity=".16"/><g fill="none" stroke="#e7b94c" stroke-width="6" stroke-linecap="round"><circle cx="24" cy="21" r="9"/><path d="M30 28l16 16M39 37l5-5M44 42l5-5"/></g><path d="M19 17q4-4 7-1" stroke="#fff4c3" stroke-width="3" fill="none"/>',
      door: '<path d="M8 51V17q22-20 44 0v34" stroke="#a67c4e" stroke-width="7" fill="#bd925b"/><path d="M17 17v32M29 12v37M41 17v32" stroke="#e2bc7f" stroke-width="4"/><rect x="5" y="27" width="50" height="8" rx="3" fill="#8e6b48"/><circle cx="31" cy="31" r="5" fill="#f5d57e"/>',
      gate: '<path d="M8 52V13M52 52V13M8 17h44" stroke="#7c8b59" stroke-width="7" stroke-linecap="round"/><path d="M11 14q44 0 34 16T13 49M50 15q-45 9-33 26" stroke="#6a995e" stroke-width="4" fill="none"/><g fill="#a0bc78"><ellipse cx="18" cy="23" rx="8" ry="4" transform="rotate(-25 18 23)"/><ellipse cx="41" cy="32" rx="8" ry="4" transform="rotate(25 41 32)"/><ellipse cx="22" cy="43" rx="8" ry="4"/></g>',
      plate:
        '<ellipse cx="30" cy="39" rx="21" ry="12" fill="#a7ad8f" stroke="#7b866d" stroke-width="3"/><ellipse cx="30" cy="37" rx="11" ry="6" fill="#dce3bb"/><circle cx="30" cy="37" r="3" fill="#718b61"/>',
      exit: '<ellipse cx="30" cy="48" rx="25" ry="9" fill="#a0baa0"/><path d="M12 46V24q0-26 18-26t18 26v22" fill="#b8d4be" stroke="#749986" stroke-width="5"/><path d="M20 43V23q0-16 10-16t10 16v20" fill="#f5edb8"/><path d="M30 14l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fffde1"/>',
      open: '<path d="M9 50V16M51 50V16" stroke="#95ad80" stroke-width="5" stroke-linecap="round"/><path d="M20 33l7 6 14-15" stroke="#5a936b" stroke-width="4" stroke-linecap="round" fill="none"/>',
    };
    return (
      '<svg viewBox="0 0 60 60" focusable="false" aria-hidden="true">' +
      (art[kind] || '') +
      '</svg>'
    );
  }
  function trailPosition(i, b) {
    return (
      'left:' +
      ((i % b.width) * 100) / b.width +
      '%;top:' +
      (Math.floor(i / b.width) * 100) / b.height +
      '%;width:' +
      100 / b.width +
      '%;height:' +
      100 / b.height +
      '%'
    );
  }
  function renderAdventure() {
    const c = getCampaign();
    if (adventureOwner !== c) {
      adventureOwner = c;
      adventureRun = c.run || AD.create(c.unlocked - 1);
      adventureHistory = [];
    }
    const s = adventureRun,
      b = AD.board(s.level),
      level = AD.LEVELS[s.level],
      open = AD.platesOpen(b, s);
    $('#adventure-chapter').textContent =
      'CHAPTER ' + String(s.level + 1).padStart(2, '0') + ' / 04';
    $('#adventure-title').textContent = level.name;
    $('#adventure-hint').textContent = level.hint;
    $('#adventure-stars').textContent = '✦ ' + s.collected.length + ' / ' + b.stars.length;
    $('#adventure-moves').textContent = s.moves + ' 步';
    $('#adventure-key').textContent = b.key < 0 ? '' : s.key ? '鎖匙 ✓' : '鎖匙 ○';
    $('#adventure-land').dataset.chapter = String(s.level);
    $('#adventure-board').setAttribute(
      'aria-label',
      level.name +
        '。位置第 ' +
        (Math.floor(s.player / b.width) + 1) +
        ' 行、第 ' +
        ((s.player % b.width) + 1) +
        ' 列。已收集 ' +
        s.collected.length +
        ' 點星光。',
    );
    $('#adventure-tiles').innerHTML = b.tiles
      .map(
        (t, i) =>
          '<div class="trail-tile ' +
          (t === '#' ? 'trail-wood' : 'trail-path') +
          '" style="' +
          trailPosition(i, b) +
          '">' +
          (t === '#' ? trailSprite(i % 3 === 0 ? 'tree' : 'bush') : '') +
          '</div>',
      )
      .join('');
    $('#adventure-objects').innerHTML =
      b.tiles
        .map((t, i) => {
          let kind =
            t === 'E'
              ? 'exit'
              : t === 'O'
                ? 'plate'
                : t === 'D'
                  ? s.key
                    ? 'open'
                    : 'door'
                  : t === 'G'
                    ? open
                      ? 'open'
                      : 'gate'
                    : t === 'K' && !s.key
                      ? 'key'
                      : t === '*' && !s.collected.includes(i)
                        ? 'star'
                        : null;
          return kind
            ? '<div class="trail-object trail-' +
                kind +
                '" style="' +
                trailPosition(i, b) +
                '">' +
                trailSprite(kind) +
                '</div>'
            : '';
        })
        .join('') +
      s.crates
        .map(
          (i) =>
            '<div class="trail-object trail-crate" style="' +
            trailPosition(i, b) +
            '">' +
            trailSprite('crate') +
            '</div>',
        )
        .join('');
    const player = $('#adventure-player');
    player.style.cssText = trailPosition(s.player, b);
    player.dataset.facing = adventureFacing;
    player.innerHTML = companionArt(s.won ? 'love' : 'happy');
    $('#adventure-undo').disabled = !adventureHistory.length || s.won;
    $$('[data-step]').forEach((x) => (x.disabled = s.won));
    $('#adventure-win').hidden = !s.won;
    $('#adventure-next').textContent =
      s.level < AD.LEVELS.length - 1 ? '下一個故事 →' : '返小島收好回憶';
    $('#adventure-completed').textContent = Object.keys(c.best).length + ' / 4';
    $('#adventure-levels').innerHTML = AD.LEVELS.map(
      (l, i) =>
        '<button data-level="' +
        i +
        '" ' +
        (i >= c.unlocked ? 'disabled' : '') +
        ' aria-pressed="' +
        (s.level === i) +
        '"><span class="trail-level-number">' +
        (i >= c.unlocked ? '◇' : String(i + 1).padStart(2, '0')) +
        '</span><span><b>' +
        l.name +
        '</b><small>' +
        (c.best[i]
          ? '個人最佳 ' + c.best[i] + ' 步'
          : i < c.unlocked
            ? '可以出發'
            : '完成上一關後開放') +
        '</small></span><i>' +
        (c.best[i] ? '✓' : '→') +
        '</i></button>',
    ).join('');
    if (!$('#adventure-message').textContent)
      $('#adventure-message').textContent = '收齊三點星光，再帶伙伴行去出口。';
  }
  function startAdventure(level) {
    const c = getCampaign();
    if (!Number.isInteger(level) || level < 0 || level >= c.unlocked) return;
    adventureOwner = c;
    adventureRun = AD.create(level);
    adventureHistory = [];
    c.run = adventureRun;
    $('#adventure-message').textContent = AD.LEVELS[level].hint;
    persist();
    renderAdventure();
    $('#adventure-board').focus({ preventScroll: true });
  }
  function moveAdventure(direction) {
    if (!$('#page-adventure').classList.contains('on')) return;
    // A cloud refresh/account change can replace the campaign while this page is open.
    if (adventureOwner !== getCampaign()) renderAdventure();
    const previous = adventureRun,
      result = AD.step(previous, direction);
    if (result.event === 'ignored') return;
    const messages = {
      wall: '前面係樹叢，試吓另一邊。',
      locked: '木門鎖住喇，先搵金鎖匙。',
      plate: '藤門未開，將木箱推到圓形機關上。',
      'crate-blocked': '木箱前面冇位。退返一步，試吓另一邊。',
      push: '木箱推開咗。',
      key: '搵到金鎖匙！木門開咗。',
      star: '收好一點星光。',
      'need-stars': '出口喺度！仲有星光未搵齊。',
    };
    if (result.state !== previous) {
      adventureHistory.push(previous);
      if (adventureHistory.length > 150) adventureHistory.shift();
      adventureRun = result.state;
      if (direction === 'left' || direction === 'right') adventureFacing = direction;
      getCampaign().run = adventureRun;
      if (result.event === 'win') {
        const gain = AD.finish(getCampaign(), adventureRun);
        if (S.pet && gain) {
          S.pet.coins += gain;
          need('fun', 12);
        }
        adventureHistory = [];
        $('#adventure-win-title').textContent = safeTrailName(adventureRun.level);
        $('#adventure-win-copy').textContent =
          '三點星光都帶返嚟喇 · ' +
          adventureRun.moves +
          ' 步完成。' +
          (S.pet && gain ? ' 伙伴金幣 +' + gain + '。' : '今次嘅足跡已經留低。');
      }
      persist();
    }
    const b = AD.board(adventureRun.level);
    $('#adventure-message').textContent =
      (result.event === 'win' ? '旅程完成。' : messages[result.event] || '繼續慢慢行。') +
      ' 第 ' +
      (Math.floor(adventureRun.player / b.width) + 1) +
      ' 行、第 ' +
      ((adventureRun.player % b.width) + 1) +
      ' 列 · ' +
      adventureRun.collected.length +
      '/3 星光。';
    renderAdventure();
  }
  function safeTrailName(level) {
    return level === AD.LEVELS.length - 1 ? '四段旅程，都行過喇。' : '呢一段路，完成喇。';
  }
  function undoAdventure() {
    if (adventureOwner !== getCampaign()) renderAdventure();
    if (!adventureHistory.length || adventureRun.won) return;
    adventureRun = adventureHistory.pop();
    getCampaign().run = adventureRun;
    persist();
    $('#adventure-message').textContent = '退返一步，可以再試另一條路。';
    renderAdventure();
  }
  document.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) moveAdventure(step.dataset.step);
    const level = e.target.closest('[data-level]');
    if (level) startAdventure(Number(level.dataset.level));
    if (e.target.closest('#adventure-undo')) undoAdventure();
    if (e.target.closest('#adventure-reset') || e.target.closest('#adventure-replay'))
      startAdventure(adventureRun.level);
    if (e.target.closest('#adventure-next')) {
      if (adventureRun.level < AD.LEVELS.length - 1) startAdventure(adventureRun.level + 1);
      else go('island');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (
      !$('#page-adventure').classList.contains('on') ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      e.target.closest('input,textarea,select,[contenteditable="true"],dialog')
    )
      return;
    const direction = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      a: 'left',
      s: 'down',
      d: 'right',
    }[e.key];
    if (direction) {
      e.preventDefault();
      moveAdventure(direction);
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      undoAdventure();
    }
  });

  /* ---------- render ---------- */
  function render() {
    applyTheme();
    renderIsland();
    const now = new Date();
    $('#today-eyebrow').textContent =
      now.getMonth() + 1 + ' 月 ' + now.getDate() + ' 日・星期' + WD[now.getDay()];
    showDaily(Math.floor(parseKey(keyOf(now)).getTime() / 864e5));
    loadForm(defaultDay());
    renderPHQForm();
    renderPlan();
    renderSettings();
    renderEvidence();
    renderLadders();
    renderRes();
    renderReview();
    renderBadge();
    renderWisdom();
    renderPlanFavs();
    showDrawTab();
    renderHabits();
    if ($('#page-pet').classList.contains('on')) renderPet();
    if ($('#page-arcade').classList.contains('on')) renderMemory();
    if ($('#page-adventure').classList.contains('on')) renderAdventure();
    if ($('#page-haven').classList.contains('on')) renderHaven();
  }
  render();
  const h = (location.hash || '').slice(1);
  go(PAGES.includes(h) ? h : 'island');
  googleLogin.start();
  if (journalStore.unreadableLocal) toast('有啲記錄暫時開唔到，可以到設定查看備份。');
  milesSoon();
})();
