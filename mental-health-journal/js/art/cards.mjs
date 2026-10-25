import { createCardPrimitives } from './card-primitives.mjs';
import { createEarlyScenes } from './card-scenes-early.mjs';
import { createLateScenes } from './card-scenes-late.mjs';
import { createHiddenScenes } from './card-scenes-hidden.mjs';
const primitives = createCardPrimitives();
const { f, star8 } = primitives;
const SC = {
  ...createEarlyScenes(primitives),
  ...createLateScenes(primitives),
  ...createHiddenScenes(primitives),
};
let SEQ = 0;
function corner(x, y, sx, sy, c) {
  return (
    '<g transform="translate(' +
    x +
    ' ' +
    y +
    ') scale(' +
    sx +
    ' ' +
    sy +
    ')"><path d="M0 18V6Q0 0 6 0H18" stroke="' +
    c +
    '" stroke-width="1.6" fill="none"/><path d="M5 5L10 2L8 8Z" fill="' +
    c +
    '"/><circle cx="22" cy="0" r="1.6" fill="' +
    c +
    '"/><circle cx="0" cy="22" r="1.6" fill="' +
    c +
    '"/></g>'
  );
}
function face(c, lv, prefix) {
  const P = prefix || 't' + ++SEQ + '_';
  primitives.begin(P);
  const sc = (SC[c.id] || (() => ''))();
  const frame = lv >= 3 ? '#5e1a24' : '#1f2540',
    gold = '#c9a24a',
    paper = '#f4ead3';
  let s =
    '<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg" class="tarot" role="img" aria-label="' +
    c.name +
    '"><defs>' +
    primitives.definitions() +
    '<clipPath id="' +
    P +
    'clip"><rect x="26" y="54" width="248" height="340" rx="6"/></clipPath></defs>';
  s +=
    '<rect width="300" height="500" rx="18" fill="' +
    frame +
    '"/><rect x="9" y="9" width="282" height="482" rx="12" fill="' +
    paper +
    '"/><rect x="15" y="15" width="270" height="470" rx="9" fill="none" stroke="' +
    gold +
    '" stroke-width="1.4"/>';
  s +=
    corner(19, 19, 1, 1, gold) +
    corner(281, 19, -1, 1, gold) +
    corner(19, 481, 1, -1, gold) +
    corner(281, 481, -1, -1, gold);
  s += '<g clip-path="url(#' + P + 'clip)">' + sc + '</g>';
  s +=
    '<rect x="26" y="54" width="248" height="340" rx="6" fill="none" stroke="' +
    gold +
    '" stroke-width="2.6"/><rect x="30" y="58" width="240" height="332" rx="4" fill="none" stroke="' +
    frame +
    '" stroke-opacity=".45" stroke-width="1"/>';
  s +=
    '<path d="M110 35H190" stroke="' +
    gold +
    '" stroke-width="1"/><rect x="' +
    (150 - Math.max(22, c.n.length * 7 + 12)) +
    '" y="22" width="' +
    Math.max(22, c.n.length * 7 + 12) * 2 +
    '" height="26" rx="13" fill="' +
    frame +
    '" stroke="' +
    gold +
    '" stroke-width="1.2"/><text x="150" y="40.5" text-anchor="middle" font-family="Georgia, \'Noto Serif TC\', serif" font-size="15" fill="#ead39a" letter-spacing="1.5">' +
    c.n +
    '</text>';
  s +=
    '<path d="M44 406H256L246 427L256 448H44L54 427Z" fill="' +
    frame +
    '"/><path d="M50 410H250L242 427L250 444H50L58 427Z" fill="none" stroke="' +
    gold +
    '" stroke-width="1"/>';
  s +=
    '<text x="150" y="435" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="21" font-weight="600" fill="#f4ead3" letter-spacing="6">' +
    c.name +
    '</text>';
  s +=
    '<text x="150" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" fill="#8a6d2f" letter-spacing="2.5">' +
    c.en.toUpperCase() +
    '</text>' +
    (c.en.length <= 12
      ? '<path d="M78 466H96M204 466H222" stroke="' + gold + '" stroke-width="1"/>'
      : '<circle cx="30" cy="466" r="1.6" fill="' +
        gold +
        '"/><circle cx="270" cy="466" r="1.6" fill="' +
        gold +
        '"/>');
  if (lv >= 3)
    s +=
      '<g transform="translate(256 36)"><rect x="-13" y="-13" width="26" height="26" rx="3" fill="#b3352b" transform="rotate(8)"/><text x="0" y="5" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="12" font-weight="600" fill="#f4ead3" transform="rotate(8)">知己</text></g>';
  return s + '</svg>';
}
function back() {
  const navy = '#1f2540',
    gold = '#c9a24a';
  let s =
    '<svg viewBox="0 0 300 500" xmlns="http://www.w3.org/2000/svg" class="tarot back" aria-hidden="true">';
  s +=
    '<rect width="300" height="500" rx="18" fill="' +
    navy +
    '"/><rect x="12" y="12" width="276" height="476" rx="11" fill="none" stroke="' +
    gold +
    '" stroke-width="1.6"/><rect x="20" y="20" width="260" height="460" rx="8" fill="none" stroke="' +
    gold +
    '" stroke-width=".8" stroke-opacity=".7"/>';
  for (let i = 0; i < 14; i++) {
    s +=
      '<path d="M' +
      (20 + i * 20) +
      ' 20L' +
      (20 + i * 20 + 130) +
      ' 480" stroke="' +
      gold +
      '" stroke-opacity=".07"/><path d="M' +
      (280 - i * 20) +
      ' 20L' +
      (150 - i * 20) +
      ' 480" stroke="' +
      gold +
      '" stroke-opacity=".07"/>';
  }
  const cx = 150,
    cy = 250;
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="104" fill="' +
    navy +
    '" stroke="' +
    gold +
    '" stroke-width="1.4"/><circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="96" fill="none" stroke="' +
    gold +
    '" stroke-width=".7"/>';
  for (let i = 0; i < 48; i++) {
    const a = (i * Math.PI) / 24;
    s +=
      '<circle cx="' +
      f(cx + Math.cos(a) * 100) +
      '" cy="' +
      f(cy + Math.sin(a) * 100) +
      '" r="1.3" fill="' +
      gold +
      '"/>';
  }
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5;
    s +=
      '<ellipse cx="' +
      cx +
      '" cy="' +
      (cy - 58) +
      '" rx="10" ry="32" fill="none" stroke="' +
      gold +
      '" stroke-width="1.1" transform="rotate(' +
      a +
      ' ' +
      cx +
      ' ' +
      cy +
      ')"/>';
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 11.25;
    s +=
      '<path d="M' +
      cx +
      ' ' +
      (cy - 88) +
      'l4 8l-4 4l-4 -4z" fill="' +
      gold +
      '" transform="rotate(' +
      a +
      ' ' +
      cx +
      ' ' +
      cy +
      ')"/>';
  }
  s +=
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="34" fill="' +
    navy +
    '" stroke="' +
    gold +
    '" stroke-width="1.2"/>' +
    star8(cx, cy, 28, gold, 0.32) +
    '<circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="6" fill="' +
    navy +
    '" stroke="' +
    gold +
    '" stroke-width="1"/>';
  s +=
    '<path d="M150 72A14 14 0 1 0 150 100A10.5 14 0 1 1 150 72Z" fill="' +
    gold +
    '" transform="rotate(-90 150 86)"/>';
  s += '<circle cx="150" cy="414" r="9" fill="none" stroke="' + gold + '" stroke-width="1.4"/>';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    s +=
      '<path d="M' +
      f(150 + Math.cos(a) * 12) +
      ' ' +
      f(414 + Math.sin(a) * 12) +
      'L' +
      f(150 + Math.cos(a) * 17) +
      ' ' +
      f(414 + Math.sin(a) * 17) +
      '" stroke="' +
      gold +
      '" stroke-width="1.2"/>';
  }
  [
    [40, 40],
    [260, 40],
    [40, 460],
    [260, 460],
  ].forEach(([x, y]) => {
    s += star8(x, y, 8, gold, 0.35);
  });
  s +=
    '<text x="150" y="128" text-anchor="middle" font-family="\'Noto Serif TC\', serif" font-size="13" fill="' +
    gold +
    '" letter-spacing="8">心晴</text>';
  return s + '</svg>';
}
export const ART = { face, back };
