import { keyOf } from './shared/dates.mjs';
import { uid } from './shared/helpers.mjs';

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

function hbDefaults() {
  return [
    { id: 'run', name: '跑步', freq: 3, log: {} },
    { id: 'cook', name: '自己煮飯', freq: 4, log: {} },
    { id: 'bed', name: '錨點時間上床', freq: 7, log: {} },
  ];
}

export { normalize, defaults };
