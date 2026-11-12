import { state, persist } from '../state.mjs';
import { $, $$ } from '../shared/dom.mjs';
import { companionArt } from '../pet/presentation.mjs';
import { need } from '../pet/model.mjs';
import { go } from '../navigation.mjs';

const AD = window.IslandAdventure;

let adventureRun = null;

let adventureOwner = null;

let adventureHistory = [];

let adventureFacing = 'right';

function getCampaign() {
  return state.journey.adventure || (state.journey.adventure = AD.campaign());
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
    '<svg viewBox="0 0 60 60" focusable="false" aria-hidden="true">' + (art[kind] || '') + '</svg>'
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
  $('#adventure-chapter').textContent = 'CHAPTER ' + String(s.level + 1).padStart(2, '0') + ' / 04';
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
      if (state.pet && gain) {
        state.pet.coins += gain;
        need('fun', 12);
      }
      adventureHistory = [];
      $('#adventure-win-title').textContent = safeTrailName(adventureRun.level);
      $('#adventure-win-copy').textContent =
        '三點星光都帶返嚟喇 · ' +
        adventureRun.moves +
        ' 步完成。' +
        (state.pet && gain ? ' 伙伴金幣 +' + gain + '。' : '今次嘅足跡已經留低。');
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

function initializeAdventure() {
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
}

export { renderAdventure, initializeAdventure };
