// 2.48.1 動畫打磨：街景定時更新唔會跳返起點、減少動態時街景停喺合理位置、面板之間切換唔閃。
// 執行：TZ=America/Toronto node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heroHTML } from '../js/views/hero.js';
import { at, MIN } from '../js/time.js';

const appSrc = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

// 結構骨架：每個元素嘅標籤名，加上 style（動畫參數）。就地更新只會改文字同其他屬性。
const skeleton = (html) => [...html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)].map(([, tag, attrs]) => `${tag}${(attrs.match(/style="[^"]*"/) || [''])[0]}`);

test('街景：同一個狀態過咗一分鐘，結構同動畫參數完全一樣（可以就地更新，唔使重畫）', () => {
  for (const [state, t] of [['work', at('2026-10-13', '03:18')], ['out', at('2026-10-12', '20:15')], ['ride', at('2026-10-12', '20:25')], ['free', at('2026-10-13', '10:30')]]) {
    for (const compact of [true, false]) {
      const a = heroHTML({ state, now: t, headline: '工作中，還有 5 小時 42 分。', line: '睡前還有 2h 00m 未安排', eyebrow: 'ONTIME · 週二工作日', compact });
      const b = heroHTML({ state, now: t + MIN, headline: '工作中，還有 5 小時 41 分。', line: '睡前還有 1h 59m 未安排', eyebrow: 'ONTIME · 週二工作日', compact });
      assert.notEqual(a, b, '一分鐘後內容應該有少少唔同（太陽位置、倒數）');
      assert.deepEqual(skeleton(a), skeleton(b), `${state}${compact ? '（手機）' : '（桌面）'}結構唔應該變`);
    }
  }
});

test('街景：重畫時用就地更新，唔再成幅換 innerHTML', () => {
  assert.match(appSrc, /patchHero\(heroHost, heroHTML\)/);
  assert.doesNotMatch(appSrc, /heroHost\.innerHTML = heroHTML/);
  // style 變咗（動畫參數變）就換嗰個元素，等佢由頭播；其餘只改屬性同文字。
  assert.match(appSrc, /getAttribute\('style'\)[\s\S]{0,80}replaceWith\(to\)/);
});

test('減少動態：車、雲、小人唔會停喺動畫起點（車浮喺天上、雲貼邊）', () => {
  const rm = cssSrc.slice(cssSrc.indexOf('@media (prefers-reduced-motion: reduce) {\n  *, *::before'));
  const block = rm.slice(0, rm.indexOf('\n}\n'));
  assert.match(block, /\.hero \.cloud, \.hero \.car, \.hero \.walker \{ animation: none; \}/);
  assert.match(block, /\.hero \.car-a \{ transform: translate\(calc\(var\(--sw\) \* [.\d]+\), var\(--y\)\); \}/);
  assert.match(block, /\.hero \.car-b, \.hero \.car-oncoming \{ transform: translate\(calc\(var\(--sw\) \* [.\d]+\), var\(--y\)\); \}/);
  assert.match(block, /\.hero \.walker \{ transform: translateX\(var\(--to\)\); \}/);
  assert.match(block, /\.hero \.birds \{ display: none; \}/);
});

test('面板：開住時換另一種面板，暗底唔重新淡入，面板唔會跌出去再升上嚟', () => {
  assert.match(appSrc, /if \(wasOpen\) switchSheet\(host, oldHeight\);\s*else host\.querySelectorAll\('\.sheet, \.sheet-backdrop'\)\.forEach\(\(el\) => el\.classList\.add\('is-enter'\)\)/);
  // 尊重「減少動態」；只用短過渡。
  const fn = appSrc.slice(appSrc.indexOf('function switchSheet'), appSrc.indexOf('function scrollSheetToForm'));
  assert.match(fn, /reduceMotion\(\)/);
  for (const [, ms] of fn.matchAll(/duration: (\d+)/g)) assert.ok(+ms <= 300, `過渡 ${ms}ms 太長`);
});
