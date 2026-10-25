import { state, persist } from '../state.mjs';
import { $ } from '../shared/dom.mjs';
import { PET } from '../art/pet.mjs';
import { companionArt } from '../pet/presentation.mjs';
import { defaultDay } from '../shared/dates.mjs';
import { need } from '../pet/model.mjs';
import { segSet } from '../shared/controls.mjs';
import { go } from '../navigation.mjs';

const JC = window.JournalCore;
let memory = null;

let memoryTimer = null;

let memoryOwner = null;

const MEMORY_PALS = [
  ['cat', 'milktea', '奶茶貓'],
  ['dog', 'mint', '薄荷柴'],
  ['cloud', 'sakura', '櫻花雲'],
  ['cat', 'night', '夜空貓'],
  ['dog', 'snow', '雪白柴'],
  ['cloud', 'milktea', '奶茶雲'],
];

function renderMemory() {
  if (!memory || memoryOwner !== state.journey) {
    clearTimeout(memoryTimer);
    memoryOwner = state.journey;
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
  const played = Number(state.journey.games[defaultDay()]) || 0;
  $('#memory-reward').textContent =
    (state.pet
      ? '每日頭兩局完成各有 5 金幣。今日已玩 ' + played + ' 局。'
      : '可以隨時玩。領養伙伴後，每日頭兩局完成各有 5 金幣。') +
    (state.journey.best ? ' 最少翻牌紀錄：' + state.journey.best + ' 次。' : '');
}

function resetMemory() {
  clearTimeout(memoryTimer);
  memoryOwner = state.journey;
  memory = JC.createMemory();
  $('#memory-status').textContent = '準備好，就揀一張。';
  renderMemory();
}

function memoryFlip(i) {
  if (memoryOwner !== state.journey) {
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
    const gain = JC.gameReward(state.journey, defaultDay());
    state.journey.best = Math.min(state.journey.best || Infinity, memory.moves);
    if (state.pet && gain) {
      state.pet.coins += gain;
      need('fun', 10);
    }
    persist();
    $('#memory-status').textContent =
      '六對都搵到喇！' +
      (state.pet && gain ? ' 金幣 +' + gain + '。' : '') +
      ' 想休息就返小島坐吓。';
  }
  renderMemory();
  const next = $('[data-memory="' + i + '"]');
  if (next) next.focus();
}

function clearMemorySession() {
  clearTimeout(memoryTimer);
  memory = null;
  memoryOwner = null;
}

function initializeMemory() {
  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-memory]');
    if (m) memoryFlip(Number(m.dataset.memory));
    if (e.target.closest('#memory-restart')) resetMemory();
    if (e.target.closest('#arcade-walk')) {
      segSet('pettab', 'out');
      go('pet');
    }
  });
}

export { clearMemorySession, renderMemory, initializeMemory };
