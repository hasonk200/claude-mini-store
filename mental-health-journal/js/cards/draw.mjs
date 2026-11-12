import { $, $$ } from '../shared/dom.mjs';
import { cardBack, cardFace, readingHTML } from './markup.mjs';
import { card } from '../data/cards.mjs';
import {
  lvOf,
  drawCounts,
  POS3,
  claudeSpread,
  claudePick,
  localSpread,
  localPick,
} from './model.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { defaultDay, md, WD, parseKey } from '../shared/dates.mjs';
import { state, journalStore, persist } from '../state.mjs';
import { readDraft, removeDraft, writeDraft } from '../shared/drafts.mjs';
import { segGet, toast } from '../shared/controls.mjs';
import { showDrawTab } from './tabs.mjs';
import { petAward } from '../pet/rewards.mjs';
import { loadForm } from '../checkin.mjs';

let drawing = false;

let ritual = false;

let redoArmed = false;

let drawGeneration = 0;
const drawTimers = new Set();

function resetDrawSession() {
  drawGeneration++;
  for (const timer of drawTimers) clearTimeout(timer);
  drawTimers.clear();
  drawing = false;
  ritual = false;
  redoArmed = false;
  $('#dr-text').value = '';
  $('#dr-text').disabled = false;
  $('#dr-go').disabled = false;
  $('#dr-go').hidden = false;
  $('#dr-reading').hidden = true;
}

// Animation callbacks belong to the same journal session as the reading they display.
function afterDrawDelay(callback, delay) {
  const owner = state,
    epoch = journalStore.epoch,
    generation = drawGeneration;
  const timer = setTimeout(() => {
    drawTimers.delete(timer);
    if (owner === state && epoch === journalStore.epoch && generation === drawGeneration)
      callback();
  }, delay);
  drawTimers.add(timer);
}

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
        afterDrawDelay(() => fan.classList.remove('opening'), 900);
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
  if (!animate || prefersReducedMotion()) {
    fl.classList.add('flipped');
    done();
    return;
  }
  stageMsg('翻牌……');
  afterDrawDelay(() => fl.classList.add('flipped'), 180);
  afterDrawDelay(done, 1250);
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
  const d = (state.draws || {})[k];
  if (d) {
    $('#dr-text').value = d.text;
    $('#dr-text').disabled = true;
    $('#dr-go').hidden = true;
    setStage('shown', d);
  } else {
    const draft = readDraft('draw', k);
    $('#dr-text').value = draft?.text || '';
    $('#dr-text').disabled = false;
    $('#dr-go').hidden = false;
    setStage('empty');
    $('#dr-reading').hidden = true;
  }
  $('#dr-count').textContent = $('#dr-text').value.length + ' 字';
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
  if (!animate || prefersReducedMotion()) {
    fls.forEach((f) => f.classList.add('flipped'));
    done();
    return;
  }
  stageMsg('翻牌……');
  fls.forEach((f, i) => afterDrawDelay(() => f.classList.add('flipped'), 200 + i * 520));
  afterDrawDelay(done, 200 + 2 * 520 + 1200);
}

function isDrawBusy() {
  return ritual || drawing;
}

function initializeDraw() {
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
    const drawOwner = state,
      drawEpoch = journalStore.epoch,
      generation = drawGeneration;
    const isCurrent = () =>
      state === drawOwner && journalStore.epoch === drawEpoch && generation === drawGeneration;
    const discardStaleDraw = () => {
      if (generation !== drawGeneration) return;
      resetDrawSession();
      showDrawTab();
    };
    $('#dr-go').disabled = true;
    $('#dr-text').disabled = true;
    $('#dr-reading').hidden = true;
    $('#dr-mode').textContent = '';
    setStage('shuffle');
    try {
      $('#table').scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    } catch (e) {}
    const k = defaultDay();
    const minShuffle = sleep(prefersReducedMotion() ? 400 : 3000);
    let timeoutHandle;
    const timeout = new Promise((r) => {
      timeoutHandle = setTimeout(() => r(null), 30000);
    });
    const three = segGet('drawmode') === 'three';
    let res = await Promise.race([three ? claudeSpread(text, k) : claudePick(text, k), timeout]);
    clearTimeout(timeoutHandle);
    if (!isCurrent()) {
      discardStaleDraw();
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
    state.draws = state.draws || {};
    state.draws[k] = d;
    persist({ month: k.slice(0, 7) });
    if (journalStore.storageOK) removeDraft('draw', k);
    petAward('draw', 10, 1, '收工抽卡');
    await minShuffle;
    if (!isCurrent()) {
      discardStaleDraw();
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
    const d = state.draws[defaultDay()];
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
      afterDrawDelay(() => showFace3(d, true), prefersReducedMotion() ? 0 : 800);
      return;
    }
    fan.dataset.picked = '1';
    fan.querySelectorAll('.fc').forEach((x) => x.classList.add(x === b ? 'picked' : 'gone'));
    stageMsg('就係佢。');
    afterDrawDelay(() => showFace(d, true), prefersReducedMotion() ? 0 : 650);
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#dr-redo');
    if (b) {
      if (!redoArmed) {
        redoArmed = true;
        showReading(state.draws[defaultDay()]);
        afterDrawDelay(() => {
          redoArmed = false;
        }, 5000);
        return;
      }
      redoArmed = false;
      const k = defaultDay();
      delete state.draws[k];
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
      const d = state.draws[a.dataset.addnext];
      if (!d) return;
      const ck = state.checkins[d.date];
      if (ck) {
        ck.next = (ck.next ? ck.next + '\n' : '') + d.action;
        ck.t = Date.now();
        persist({ year: d.date.slice(0, 4) });
      } else {
        state.checkins[d.date] = {
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
  $('#dr-text').addEventListener('input', () =>
    writeDraft('draw', defaultDay(), { text: $('#dr-text').value }),
  );
}

export { isDrawBusy, renderDraw, resetDrawSession, initializeDraw };
