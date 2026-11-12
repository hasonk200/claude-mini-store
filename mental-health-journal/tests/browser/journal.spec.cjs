const fs = require('node:fs/promises');
const {
  test,
  expect,
  DAY,
  LS,
  sampleState,
  open,
  go,
  saved,
  subtab,
  installAccounts,
} = require('./helpers.cjs');

test('all screens and pet subtabs render at desktop and 320px widths', async ({ page }) => {
  await open(page);
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      'island',
      'arcade',
      'adventure',
      'haven',
      'today',
      'pet',
      'draw',
      'sos',
      'evidence',
      'ladder',
      'wisdom',
      'review',
      'plan',
      'about',
    ]) {
      await go(page, route);
      await expect(page.locator('.page.on')).toHaveCount(1);
      expect(await page.locator('.page.on').innerText()).not.toBe('');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        route + ' overflows at ' + width,
      ).toBe(true);
    }
    await go(page, 'pet');
    for (const tab of ['out', 'friends', 'album', 'shop', 'home']) {
      await subtab(page, 'pettab', tab);
      await expect(page.locator('#pv-' + tab)).toBeVisible();
    }
  }
});

test('new user can adopt a pet, buy furniture and keep it after reload', async ({ page }) => {
  await open(page, 'pet', null);
  await page.locator('#adopt-name').fill('新伙伴');
  await page.locator('#adopt-go').click();
  await expect(page.locator('#pet-title')).toContainText('新伙伴');
  await subtab(page, 'pettab', 'shop');
  const buy = page.locator('[data-buy]:not([disabled])').first();
  const id = await buy.getAttribute('data-buy');
  const coins = (await saved(page)).pet.coins;
  await buy.click();
  expect((await saved(page)).pet.own[id]).toBeTruthy();
  expect((await saved(page)).pet.coins).toBeLessThan(coins);
  await page.reload();
  await expect(page.locator('#pet-title')).toContainText('新伙伴');
  expect((await saved(page)).pet.own[id]).toBeTruthy();
});

test('check-in drafts reload and saving updates evidence without duplicate entries', async ({
  page,
}) => {
  await open(page, 'today');
  await page.locator('#ci-mastery').fill('完成一次測試散步');
  await page.locator('#ci-pleasure').fill('飲杯茶');
  await subtab(page, 'work', 'off');
  await page.reload();
  await expect(page.locator('#ci-mastery')).toHaveValue('完成一次測試散步');
  await expect(page.locator('[data-name="work"] [data-v="off"]')).toHaveClass(/\bon\b/);
  await page.locator('#ci-save').click();
  await expect(page.locator('#ci-status')).toHaveText('已儲存。');
  expect((await saved(page)).checkins[DAY].mastery).toBe('完成一次測試散步');
  await page.locator('#ci-save').click();
  expect((await saved(page)).evidence.filter((item) => item.id === 'ci-' + DAY)).toHaveLength(1);
  await go(page, 'evidence');
  await expect(page.locator('#ev-list')).toContainText('完成一次測試散步');
  await page.reload();
  await go(page, 'today');
  await expect(page.locator('#ci-status')).not.toContainText('草稿');
});

for (const mode of ['one', 'three']) {
  test(
    mode + '-card draw keeps its draft and saved reading across navigation and reload',
    async ({ page }) => {
      await open(page, 'draw');
      await page.locator('#dr-text').fill('今晚散步之後，飲杯茶休息一陣。');
      await page.reload();
      await expect(page.locator('#dr-text')).toHaveValue('今晚散步之後，飲杯茶休息一陣。');
      await subtab(page, 'drawmode', mode);
      await page.locator('#dr-go').click();
      await expect(page.locator('[data-fc]')).toHaveCount(9);
      await page.locator('[data-fc="8"]').click();
      if (mode === 'three') {
        // Fanned cards overlap by design; also exercise keyboard selection.
        await page.locator('[data-fc="7"]').focus();
        await page.keyboard.press('Enter');
        await page.locator('[data-fc="6"]').focus();
        await page.keyboard.press('Enter');
      }
      await expect(page.locator('#dr-reading')).toBeVisible();
      const draw = (await saved(page)).draws[DAY];
      expect(draw.text).toContain('今晚散步');
      if (mode === 'three') expect(draw.cards).toHaveLength(3);
      await go(page, 'island');
      await go(page, 'draw');
      await expect(page.locator('#dr-reading')).toBeVisible();
      await page.reload();
      await expect(page.locator('#dr-text')).toBeDisabled();
      expect((await saved(page)).draws[DAY]).toEqual(draw);
      await subtab(page, 'drawtab', 'shelf');
      await page.locator('#shelf [data-openday]').first().click();
      await expect(page.locator('#shelf-detail')).toContainText('今晚散步');
      await subtab(page, 'drawtab', 'deck');
      await expect(page.locator('#deck-grid button').first()).toBeVisible();
    },
  );
}

test('four adventure chapters work with keyboard, touch buttons, undo and reload', async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page, 'adventure');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#adventure-moves')).toHaveText('1 步');
  await page.locator('#adventure-undo').click();
  await expect(page.locator('#adventure-moves')).toHaveText('0 步');
  const solutions = [
    'rrrldddddlldrrrruuurrddr',
    'rrddrruurrrrddllddddllllllrruurrrrrrdd',
    'ddrrddrrrrrluuuurr',
    'rrdldddrrddrrrrruuluuruu',
  ];
  const directions = { r: 'right', l: 'left', u: 'up', d: 'down' };
  for (let level = 0; level < solutions.length; level++) {
    for (let i = 0; i < solutions[level].length; i++) {
      const direction = directions[solutions[level][i]];
      if (level % 2) await page.locator('[data-step="' + direction + '"]').click();
      else await page.keyboard.press('Arrow' + direction[0].toUpperCase() + direction.slice(1));
      if (i === 4) {
        await page.reload();
        await expect(page.locator('#adventure-moves')).toHaveText('5 步');
      }
    }
    await expect(page.locator('#adventure-win')).toBeVisible();
    await expect(page.locator('#adventure-stars')).toHaveText('✦ 3 / 3');
    expect((await saved(page)).journey.adventure.best[level]).toBe(solutions[level].length);
    if (level < 3) await page.locator('#adventure-next').click();
  }
  expect((await saved(page)).pet.coins).toBe(248);
  await page.locator('#adventure-replay').click();
  expect((await saved(page)).pet.coins).toBe(248);
  await page.reload();
  await expect(page.locator('#adventure-completed')).toHaveText('4 / 4');
});

test('memory pairs can be solved through visible cards and award once', async ({ page }) => {
  await open(page, 'arcade');
  const known = new Map();
  const matched = new Set();
  for (let i = 0; i < 12; i += 2) {
    await page.locator('[data-memory="' + i + '"]').click();
    known.set(i, await page.locator('[data-memory="' + i + '"] small').innerText());
    await page.locator('[data-memory="' + (i + 1) + '"]').click();
    known.set(i + 1, await page.locator('[data-memory="' + (i + 1) + '"] small').innerText());
    if (known.get(i) === known.get(i + 1)) {
      matched.add(i);
      matched.add(i + 1);
    } else await expect(page.locator('.memory-tile.open')).toHaveCount(0);
  }
  for (let i = 0; i < 12; i++) {
    if (matched.has(i)) continue;
    const partner = [...known].find(
      ([j, name]) => j !== i && !matched.has(j) && name === known.get(i),
    )[0];
    await page.locator('[data-memory="' + i + '"]').click();
    await page.locator('[data-memory="' + partner + '"]').click();
    matched.add(i);
    matched.add(partner);
  }
  await expect(page.locator('.memory-tile.matched')).toHaveCount(12);
  expect((await saved(page)).pet.coins).toBe(205);
  await page.locator('[data-memory="0"]').focus();
  await page.keyboard.press('Enter');
  expect((await saved(page)).pet.coins).toBe(205);
  await page.reload();
  expect((await saved(page)).journey.games[DAY]).toBe(1);
});

test('pet ball game completes five throws and leaving stops an in-flight ball', async ({
  page,
}) => {
  await open(page, 'pet');
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="park"]').click();
  await page.locator('#game-go').click();
  for (let i = 0; i < 5; i++) await page.locator('#game-throw').click();
  await expect(page.locator('#game')).toContainText('五球完成！15 分');
  expect((await saved(page)).pet.best).toBe(15);
  // Also cover animation cancellation, with reduced-motion disabled.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    (await import('/js/state.mjs')).state.settings.quiet = false;
  });
  await page.locator('#game [data-start-ball]').click();
  await page.locator('#game-throw').click();
  await expect(page.locator('#ball')).toBeVisible();
  const rewards = (await saved(page)).pet.ballRewards;
  await go(page, 'island');
  await expect(page.locator('#ball')).toBeHidden();
  await page.waitForTimeout(1800); // Beyond the flight + catch timers, to detect a late settlement.
  expect((await saved(page)).pet.ballRewards).toEqual(rewards);
  await go(page, 'pet');
  await expect(page.locator('#out-choose')).toBeVisible();
});

test('leaving the lake cancels its countdown', async ({ page }) => {
  await open(page, 'haven');
  await page.locator('#haven-rest').click();
  await expect(page.locator('#haven-copy')).toContainText('60 秒');
  await go(page, 'island');
  await expect(page.locator('#haven-rest')).toHaveText('陪我坐一分鐘');
  await go(page, 'haven');
  await expect(page.locator('#haven-copy')).toHaveText('坐低一陣，望吓湖水同遠山。');
});

test('backup roundtrip refreshes all screens and preserves the previous state', async ({
  page,
}) => {
  await open(page, 'about');
  const downloadWait = page.waitForEvent('download');
  await page.locator('#bk-export').click();
  const backup = JSON.parse(await fs.readFile(await (await downloadWait).path(), 'utf8'));
  backup.pet.name = '還原伙伴';
  backup.plan.reason = '還原後嘅目標';
  backup.settings.theme = 'dark';
  await page.locator('#bk-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator('#import-dialog')).toBeVisible();
  await page.locator('#import-confirm').click();
  await expect(page.locator('#import-dialog')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await go(page, 'pet');
  await expect(page.locator('#pet-title')).toContainText('還原伙伴');
  await go(page, 'plan');
  await expect(page.locator('#pl-reason')).toHaveValue('還原後嘅目標');
  expect(
    await page.evaluate(
      (LS) => JSON.parse(localStorage.getItem(LS + '-before-import')).pet.name,
      LS,
    ),
  ).toBe('測試伙伴');
  await page.reload();
  await expect(page.locator('#pl-reason')).toHaveValue('還原後嘅目標');
  await go(page, 'about');
  await page.locator('#bk-clear').click();
  await page.locator('#bk-clear').click();
  await go(page, 'pet');
  await expect(page.locator('#pet-adopt')).toBeVisible();
});

test('recovery notice dismissal survives reload without removing backup protection', async ({
  page,
}) => {
  await open(page, 'about', '{bad json');
  await expect(page.locator('#recovery-warning')).toBeVisible();
  const downloadWait = page.waitForEvent('download');
  await page.locator('#bk-recovery').click();
  expect(await fs.readFile(await (await downloadWait).path(), 'utf8')).toBe('{bad json');
  await page.locator('#recovery-dismiss').click();
  await expect(page.locator('#recovery-warning')).toBeHidden();
  await page.reload();
  await expect(page.locator('#recovery-warning')).toBeHidden();
  expect((await saved(page))._localRecovery).toBe(true);
  await expect(page.locator('#bk-recovery')).toBeVisible();
});

test('account replacement refreshes views and subsequent edits use the new state', async ({
  page,
}) => {
  await installAccounts(page);
  await open(page, 'adventure');
  await page.keyboard.press('ArrowRight');
  await page.evaluate(
    (next) => window.testAccounts.switchTo('second', next),
    sampleState('第二個伙伴'),
  );
  await expect(page.locator('#google-email')).toHaveText('second@example.test');
  await expect(page.locator('#adventure-moves')).toHaveText('0 步');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#adventure-moves')).toHaveText('1 步');
  await go(page, 'pet');
  await expect(page.locator('#pet-title')).toContainText('第二個伙伴');
  await go(page, 'today');
  await page.locator('#ci-mastery').fill('第二個帳戶嘅記錄');
  await page.locator('#ci-save').click();
  await page.evaluate(async () => (await import('/js/state.mjs')).journalStore.flush());
  const writes = await page.evaluate(() => window.testAccounts.writes);
  expect(
    writes.some(
      (write) =>
        write.path === 'users/second/mentalHealthJournal/ci-2026' &&
        write.data.entries[DAY]?.mastery === '第二個帳戶嘅記錄',
    ),
  ).toBe(true);
  expect((await saved(page)).pet.name).toBe('第二個伙伴');
});

test('switching accounts during a pending draw drops the old reading and permits another draw', async ({
  page,
}) => {
  await installAccounts(page);
  await page.addInitScript(() => {
    window.pendingDraws = [];
    window.claude = {
      use: () =>
        new Promise((resolve) => {
          window.pendingDraws.push(resolve);
        }),
    };
  });
  await open(page, 'draw');
  await page.locator('#dr-text').fill('舊帳戶未完成嘅抽卡');
  await page.locator('#dr-go').click();
  await expect.poll(() => page.evaluate(() => window.pendingDraws.length)).toBe(1);
  await page.evaluate(
    (next) => window.testAccounts.switchTo('second', next),
    sampleState('第二個伙伴'),
  );
  await expect(page.locator('#google-email')).toHaveText('second@example.test');
  await expect(page.locator('#dr-text')).toBeEnabled();
  expect((await saved(page)).draws[DAY]).toBeUndefined();
  await expect(page.locator('#dr-text')).toHaveValue('');
  await page.locator('#dr-text').fill('第二個帳戶嘅新抽卡');
  await page.locator('#dr-go').click();
  await expect.poll(() => page.evaluate(() => window.pendingDraws.length)).toBe(2);
  await page.evaluate(() => window.pendingDraws[0](null));
  await expect(page.locator('#dr-text')).toBeDisabled();
  expect((await saved(page)).draws[DAY]).toBeUndefined();
  await page.evaluate(() => window.pendingDraws[1](null));
  await expect(page.locator('[data-fc]')).toHaveCount(9);
  expect((await saved(page)).draws[DAY].text).toBe('第二個帳戶嘅新抽卡');
});

test('failed cloud loading after an account switch does not restore the previous account drafts', async ({
  page,
}) => {
  await installAccounts(page);
  await open(page, 'today');
  await page.evaluate(() => localStorage.setItem('dicky-care-firebase-uid-v1', 'first'));
  await page.locator('#ci-mastery').fill('第一個帳戶嘅打卡草稿');
  await go(page, 'draw');
  await page.locator('#dr-text').fill('第一個帳戶嘅抽卡草稿');
  await page.evaluate(
    (next) => window.testAccounts.switchTo('second', next, true),
    sampleState('第二個伙伴'),
  );
  await expect(page.locator('#sync-txt')).toContainText('暫時連唔到雲端');
  await expect(page.locator('#dr-text')).toHaveValue('');
  await go(page, 'today');
  await expect(page.locator('#ci-mastery')).toHaveValue('');
  await page.locator('#ci-mastery').fill('第二個帳戶嘅草稿');
  expect(
    await page.evaluate(
      (LS) =>
        JSON.parse(localStorage.getItem(LS + '-draft-first-checkin-2026-10-25')).fields[
          'ci-mastery'
        ],
      LS,
    ),
  ).toBe('第一個帳戶嘅打卡草稿');
});

test('a delayed card reveal cannot display the previous account reading', async ({ page }) => {
  await installAccounts(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const data = sampleState();
  data.settings.quiet = false;
  await open(page, 'draw', data);
  await page.locator('#dr-text').fill('舊帳戶嘅晚間記錄');
  await page.locator('#dr-go').click();
  await page.locator('[data-fc="8"]').click();
  await page.evaluate(
    (next) => window.testAccounts.switchTo('second', next),
    sampleState('第二個伙伴'),
  );
  await expect(page.locator('#google-email')).toHaveText('second@example.test');
  await page.waitForTimeout(2100); // Beyond the pick and reveal animation callbacks.
  await expect(page.locator('#dr-reading')).toBeHidden();
  await expect(page.locator('#dr-text')).toHaveValue('');
  expect((await saved(page)).draws[DAY]).toBeUndefined();
});

test('switching accounts cancels an outing and ball animation before they can reward the new pet', async ({
  page,
}) => {
  await installAccounts(page);
  await open(page, 'pet');
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="park"]').click();
  await expect(page.locator('#game-go')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(async () => {
    (await import('/js/state.mjs')).state.settings.quiet = false;
  });
  await page.locator('#game-go').click();
  await page.locator('#game-throw').click();
  const next = sampleState('第二個伙伴');
  await page.evaluate((next) => window.testAccounts.switchTo('second', next), next);
  await expect(page.locator('#pet-title')).toContainText('第二個伙伴');
  await expect(page.locator('#out-choose')).toBeVisible();
  await page.waitForTimeout(1800);
  expect((await saved(page)).pet.coins).toBe(next.pet.coins);
  expect((await saved(page)).pet.ballRewards).toBeUndefined();
});

test('pet photo editor saves caption and album metadata across reload', async ({ page }) => {
  await open(page, 'pet');
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="park"]').click();
  await page.locator('#trip-photo').click();
  await page.locator('#ph-cap').fill('公園散步');
  await page.locator('#ph-shoot').click();
  await expect(page.locator('#photo-ed')).toBeHidden();
  await subtab(page, 'pettab', 'album');
  await page.locator('[data-shot]').first().click();
  await expect(page.locator('#album-view')).toContainText('公園散步');
  expect((await saved(page)).pet.album).toHaveLength(1);
  await page.reload();
  await subtab(page, 'pettab', 'album');
  await page.locator('[data-shot]').first().click();
  await expect(page.locator('#album-view')).toContainText('公園散步');
});

test('habits, evidence, ladder and plan editors persist through their extracted handlers', async ({
  page,
}) => {
  await open(page, 'today');
  await page.locator('[data-hb="run"]').click();
  expect((await saved(page)).habits.find((habit) => habit.id === 'run').log[DAY]).toBeTruthy();
  await go(page, 'evidence');
  await page.locator('#ev-text').fill('寫低一項測試成果');
  await page.locator('#ev-add').click();
  await expect(page.locator('#ev-list')).toContainText('寫低一項測試成果');
  await go(page, 'ladder');
  await page.locator('#ladder-name').fill('測試階梯');
  await page.locator('#ladder-add').click();
  await expect(page.locator('#ladders')).toContainText('測試階梯');
  await go(page, 'plan');
  await page.locator('#pl-reason').fill('測試新目標');
  await page.locator('#pl-save').click();
  await page.reload();
  await expect(page.locator('#pl-reason')).toHaveValue('測試新目標');
  const data = await saved(page);
  expect(data.ladders.some((ladder) => ladder.name === '測試階梯')).toBe(true);
  expect(data.evidence.some((item) => item.text === '寫低一項測試成果')).toBe(true);
});
