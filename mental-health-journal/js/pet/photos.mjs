import { state, persist } from '../state.mjs';
import { PET } from '../art/pet.mjs';
import { esc, $ } from '../shared/dom.mjs';
import { md, keyOf } from '../shared/dates.mjs';
import { traitBump, traitOf, petStage } from './model.mjs';
import { rainingToday, frameCardSVG } from './presentation.mjs';
import { prefersReducedMotion } from '../shared/preferences.mjs';
import { card } from '../data/cards.mjs';
import { ART } from '../art/cards.mjs';
import { toast } from '../shared/controls.mjs';
import { uid } from '../shared/helpers.mjs';
import { petAward } from './rewards.mjs';
import { picture3D, use3D } from '../scene3d/mount.mjs';
import { palette } from '../scene3d/palette.mjs';

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

let photoEditor = null;

/* ---- the place in the photo ----
   A photo is stored as a few facts (where, when, who, which expression), never as an image.
   With 3D on, the place and the companion are shown as a still picture taken of the 3D
   scene, so a photo looks like the place it was taken in; the frame, stickers and caption
   are drawn over it as before. Without 3D the 2D artwork is drawn, exactly as before.
   Pictures are taken a moment after they are first needed and kept only in memory. */
const PICTURE_SIZE = { small: [480, 300], large: [1280, 800] };
const PICTURE_LIMIT = { small: 150, large: 8 };
const pictures = { small: new Map(), large: new Map() };
const developing = new Map();
let refreshQueued = false,
  lastPreview = null;

const hashOf = (text) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return h;
};

// Everything that changes what the picture shows.
function pictureKey(c) {
  const p = state.pet,
    home = c.place === 'home';
  return JSON.stringify([
    c.place,
    c.place === 'street' ? 'night' : palette(c.hour).time,
    c.sp || p.sp,
    c.color || p.color,
    c.stage,
    c.acc || '',
    c.expr,
    c.shiny ? 1 : 0,
    c.trait || '',
    c.npc || '',
    home ? JSON.stringify(p.own || null) : '',
    home && c.rain ? 1 : 0,
    home ? c.books : 0,
    home && c.frameCard ? hashOf(c.frameCard) : 0,
  ]);
}

// What the 3D scene needs to know to show this photo.
function pictureScene(c) {
  const p = state.pet;
  const look = {
    id: 'photo',
    sp: c.sp || p.sp,
    color: c.color || p.color,
    stage: c.stage,
    acc: c.acc,
    shiny: c.shiny,
    trait: c.trait,
    expr: c.expr,
  };
  if (c.place === 'home')
    return {
      hour: c.hour,
      own: p.own,
      rain: c.rain,
      books: c.books,
      frameCard: c.frameCard,
      pets: [{ ...look, spot: 'rug' }],
      eggs: [],
    };
  const friend = c.npc && PET.NPC.find((n) => n.id === c.npc);
  return {
    hour: c.hour,
    pet: look,
    npc: friend ? { ...friend, stage: 1, expr: 'happy' } : null,
    // The friend has already arrived and stands beside the companion.
    npcIn: friend ? { start: 0, ms: 0 } : null,
  };
}

function keepPicture(size, key, picture) {
  const kept = pictures[size];
  kept.set(key, picture);
  while (kept.size > PICTURE_LIMIT[size]) kept.delete(kept.keys().next().value);
}

// Resolves with the picture's address, or null when the 2D artwork should be drawn.
function developPicture(c, size) {
  const key = pictureKey(c),
    kept = pictures[size];
  if (kept.has(key)) return Promise.resolve(kept.get(key));
  const ticket = size + key;
  if (!developing.has(ticket))
    developing.set(
      ticket,
      picture3D(
        c.place,
        pictureScene(c),
        ...PICTURE_SIZE[size],
        // A step closer than the live view, so the companion is not lost in the room.
        c.place === 'home' ? 0.74 : 0.86,
      ).then((picture) => {
        developing.delete(ticket);
        keepPicture(size, key, picture);
        queueRefresh();
        return picture;
      }),
    );
  return developing.get(ticket);
}

// The picture if it is ready; undefined while it is being taken; null for the 2D artwork.
function pictureOf(c, size) {
  if (!use3D()) return null;
  const kept = pictures[size],
    key = pictureKey(c);
  if (kept.has(key)) return kept.get(key);
  developPicture(c, size);
  return undefined;
}

// Puts pictures that have just been taken into whatever is on screen, without rebuilding
// the editor or the album around them (so typing and keyboard focus are left alone).
function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  setTimeout(() => {
    refreshQueued = false;
    if (!state.pet) return;
    const preview = $('#ph-prev');
    if (photoEditor && preview) preview.innerHTML = photoSVG(photoEditor, 'large', true);
    const album = state.pet.album || [];
    for (const button of document.querySelectorAll('#album .photo[data-shot]')) {
      const shot = album.find((x) => x.id === button.dataset.shot),
        drawn = button.querySelector('svg.photo-svg');
      if (shot && drawn) drawn.outerHTML = shotSVG(shot, 'small');
    }
    const big = document.querySelector('#album-view .ph-big'),
      chosen = album.find((x) => x.id === albumSel);
    if (big && chosen) big.innerHTML = shotSVG(chosen, 'large');
  }, 0);
}

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

// `size` picks how sharp a 3D picture to take; `editing` keeps the last picture on show in
// the editor while a changed one (a new expression, say) is being taken.
function photoSVG(c, size = 'large', editing = false) {
  const p = state.pet;
  const picture = pictureOf(c, size);
  if (editing && picture) lastPreview = picture;
  const shown = picture || (editing && picture === undefined ? lastPreview : null);
  // The 2D artwork: the place, then the companion (and a friend) standing in it.
  const flat = () => {
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
    return inner;
  };
  // A picture of the 3D scene when there is one; a plain card while it is being taken.
  let inner = shown
    ? '<image href="' + shown + '" width="800" height="500" preserveAspectRatio="xMidYMid slice"/>'
    : picture === undefined
      ? '<rect width="800" height="500" fill="#efe9dc"/><text x="400" y="260" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="24" fill="#a59d8c">顯影中…</text>'
      : flat();
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
  const p = state.pet;
  traitBump('photo');
  photoEditor = {
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
    books: Math.max(6, Math.min(40, Object.keys(state.draws || {}).length + 6)),
    frameCard: frameCardSVG(),
    date: keyOf(new Date()),
  };
  const ed = $('#photo-ed');
  ed.hidden = false;
  lastPreview = null;
  renderPhotoEd();
  try {
    ed.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } catch (e) {}
}

function renderPhotoEd() {
  if (!photoEditor) return;
  const chipRow = (arr, key, multi) =>
    '<div class="chips" data-ph="' +
    key +
    '">' +
    arr
      .map(
        ([v, n]) =>
          '<button class="' +
          ((multi ? photoEditor[key].includes(v) : photoEditor[key] === v) ? 'on' : '') +
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
    PET.PLACES[photoEditor.place].n +
    '</h2><button class="btn ghost small" id="ph-cancel">收埋</button></div><div class="ph-grid"><div class="ph-prev" id="ph-prev">' +
    photoSVG(photoEditor, 'large', true) +
    '</div><div class="ph-ctl">' +
    '<div class="field"><div class="label">表情</div>' +
    chipRow(PEXPR, 'expr') +
    '</div><div class="field"><div class="label">相框</div>' +
    chipRow(PFRAME, 'frame') +
    '</div><div class="field"><div class="label">貼紙（可以揀幾個）</div>' +
    chipRow(PSTICK, 'stickers', 1) +
    '</div>' +
    '<div class="field"><div class="label">相片文字</div><input type="text" id="ph-cap" maxlength="24" placeholder="例如：同' +
    esc(state.pet.name) +
    '去湖邊" value="' +
    esc(photoEditor.caption) +
    '"></div><button class="btn" id="ph-shoot">影！</button></div></div>';
}

function shotFacts(sh) {
  const c = Object.assign({}, sh);
  delete c.frameCard;
  if (c.place === 'home' && c.cardId) {
    const cd = card(c.cardId);
    if (cd)
      c.frameCard = ART.face(cd, 1)
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '');
  }
  return c;
}

const shotSVG = (sh, size = 'large') => photoSVG(shotFacts(sh), size);

let albumSel = null;

let albumDel = false;

function renderAlbum() {
  const p = state.pet;
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
            shotSVG(sh, 'small') +
            '<span>' +
            md(sh.date) +
            '・' +
            (sh.pname && (state.pet.others || []).length ? esc(sh.pname) + '・' : '') +
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

function closePhotoEditor() {
  $('#photo-ed').hidden = true;
  photoEditor = null;
}

function initializePetPhotos() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.chips[data-ph] button');
    if (b && photoEditor) {
      const key = b.parentElement.dataset.ph,
        v = b.dataset.v;
      if (key === 'stickers') {
        photoEditor.stickers = photoEditor.stickers.includes(v)
          ? photoEditor.stickers.filter((x) => x !== v)
          : photoEditor.stickers.concat([v]).slice(-6);
      } else photoEditor[key] = v;
      renderPhotoEd();
      return;
    }
    if (e.target.id === 'ph-cancel') {
      $('#photo-ed').hidden = true;
      photoEditor = null;
      return;
    }
    if (e.target.id === 'ph-shoot' && photoEditor) {
      photoEditor.caption = $('#ph-cap').value.trim().slice(0, 24);
      const p = state.pet;
      p.album = p.album || [];
      if (p.album.length >= 200) {
        toast('相簿滿咗，刪走啲舊相先');
        return;
      }
      const shot = Object.assign({}, photoEditor, { id: uid(), t: Date.now() });
      delete shot.frameCard;
      shot.cardId =
        (Object.values(state.draws || {}).sort((a, b) => b.date.localeCompare(a.date))[0] || {})
          .card || null;
      p.album.push(shot);
      petAward('photo', 3, 2);
      persist();
      const pv = $('#ph-prev');
      pv.classList.add('snap');
      setTimeout(() => pv.classList.remove('snap'), 420);
      toast('咔嚓！已經放入相簿');
      setTimeout(() => {
        $('#photo-ed').hidden = true;
        photoEditor = null;
      }, 700);
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'ph-cap' && photoEditor) {
      photoEditor.caption = e.target.value.slice(0, 24);
      $('#ph-prev').innerHTML = photoSVG(photoEditor, 'large', true);
    }
  });
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
      state.pet.album = state.pet.album.filter((x) => x.id !== albumSel);
      albumSel = null;
      albumDel = false;
      persist();
      renderAlbum();
      return;
    }
    if (e.target.id === 'al-dl') {
      const sh = state.pet.album.find((x) => x.id === albumSel);
      if (!sh) return;
      $('#al-msg').textContent = '整緊相……';
      try {
        // The download shows what the album shows: wait for the 3D picture if there is one.
        if (use3D()) await developPicture(shotFacts(sh), 'large');
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
          await dl.save({ filename: state.pet.name + '-' + sh.date + '.png', data: png });
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
}

export { openPhoto, closePhotoEditor, renderAlbum, initializePetPhotos };
