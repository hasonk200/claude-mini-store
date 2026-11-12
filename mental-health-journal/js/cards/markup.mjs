import { ART } from '../art/cards.mjs';
import { card } from '../data/cards.mjs';
import { drawCounts, lvOf, LVN, POS3, notesFor } from './model.mjs';
import { md } from '../shared/dates.mjs';
import { esc } from '../shared/dom.mjs';

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

export { cardBack, cardFace, readingHTML, zoomCard, notesBlock };
