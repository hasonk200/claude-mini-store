import { state } from '../state.mjs';
import { DECK, card } from '../data/cards.mjs';

const LVN = ['未遇', '初見', '熟悉', '知己'];

const lvOf = (n) => (n >= 7 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0);

function drawCounts() {
  const m = {};
  Object.values(state.draws || {}).forEach((d) => {
    drawCards(d).forEach((x) => {
      m[x.card] = (m[x.card] || 0) + 1;
    });
  });
  return m;
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
  const total = Object.keys(state.draws || {}).length;
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

function notesFor(id) {
  return (state.cardNotes || {})[id] || [];
}

export {
  drawCounts,
  lvOf,
  LVN,
  POS3,
  notesFor,
  claudeSpread,
  claudePick,
  localSpread,
  localPick,
  drawCards,
};
