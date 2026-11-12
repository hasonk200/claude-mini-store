import { state, journalStore, persist } from '../state.mjs';
import { defaultDay } from '../shared/dates.mjs';
import { PET } from '../art/pet.mjs';
import { pick } from '../shared/helpers.mjs';
import { PLN } from '../data/pet.mjs';
import { $ } from '../shared/dom.mjs';
import { renderChat } from './home.mjs';
import { traitBump } from './model.mjs';
import { setPetExpr, bubble } from './effects.mjs';

async function petReply(text) {
  const p = state.pet;
  let sample = null;
  try {
    sample = window.claude && window.claude.use ? await window.claude.use('sample') : null;
  } catch (e) {}
  const ck = state.checkins[defaultDay()];
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

function initializePetChat() {
  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = $('#chat-in').value.trim();
    if (!t) return;
    const p = state.pet,
      petId = p.id,
      epoch = journalStore.epoch;
    p.chat = (p.chat || []).concat([{ r: 'me', t: t.slice(0, 300) }]).slice(-30);
    $('#chat-in').value = '';
    renderChat();
    $('#chat-send').disabled = true;
    traitBump('talk');
    setPetExpr('room', 'wow');
    const r = await petReply(t);
    if (state.pet !== p || p.id !== petId || journalStore.epoch !== epoch) {
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
}

export { initializePetChat };
