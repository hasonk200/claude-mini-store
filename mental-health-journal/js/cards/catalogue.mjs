import { drawCounts, drawCards, lvOf, LVN } from './model.mjs';
import { DECK, card } from '../data/cards.mjs';
import { state, persist } from '../state.mjs';
import { $, esc } from '../shared/dom.mjs';
import { addDays, keyOf, md } from '../shared/dates.mjs';
import { zoomCard, cardFace, cardBack, notesBlock } from './markup.mjs';
import { uid } from '../shared/helpers.mjs';
import { toast, segSet } from '../shared/controls.mjs';
import { showDrawTab } from './tabs.mjs';

let deckSel = null;

function renderDeck() {
  const cnt = drawCounts();
  const main = DECK.filter((c) => !c.hidden),
    hid = DECK.filter((c) => c.hidden);
  const got = main.filter((c) => cnt[c.id]).length,
    hgot = hid.filter((c) => cnt[c.id]).length,
    total = Object.keys(state.draws || {}).length;
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
  Object.values(state.draws || {}).forEach((d) => {
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

function renderDeckDetail() {
  const box = $('#deck-detail');
  if (!deckSel) {
    box.hidden = true;
    return;
  }
  const c = card(deckSel);
  const n = drawCounts()[c.id] || 0;
  const lv = lvOf(n);
  const dates = Object.values(state.draws || {})
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

function addNote(id) {
  const i = $('#note-in');
  const v = i ? i.value.trim() : '';
  if (!v) {
    if (i) i.focus();
    return;
  }
  state.cardNotes = state.cardNotes || {};
  (state.cardNotes[id] = state.cardNotes[id] || []).push({
    id: uid(),
    date: keyOf(new Date()),
    text: v.slice(0, 200),
  });
  persist();
  renderDeckDetail();
  toast('寫低咗，下次抽到會再見到');
}

function initializeCatalogue() {
  $('#deck-search').addEventListener('input', renderDeck);
  $('#deck-filter').addEventListener('change', renderDeck);
  $('#deck-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-card]');
    if (!b) return;
    deckSel = b.dataset.card;
    renderDeck();
    $('#deck-detail').scrollIntoView({ block: 'nearest' });
  });
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
      state.cardNotes[cid] = (state.cardNotes[cid] || []).filter((n) => n.id !== nid);
      if (!state.cardNotes[cid].length) delete state.cardNotes[cid];
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
}

export { renderDeck, initializeCatalogue };
