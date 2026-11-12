// 3D scene coverage. These only run in the "3d" project (SwiftShader WebGL, 3D switched on);
// the regular journal flows in journal.spec.cjs run in both the 2D and the 3D project.
const fs = require('node:fs');
const path = require('node:path');
const {
  test,
  expect,
  LS,
  SCENE3D,
  sampleState,
  open,
  go,
  saved,
  subtab,
} = require('./helpers.cjs');

const ALL_FURNITURE = Object.fromEntries(
  'lights plant lamp frame shelf record tank sofa kitchen shoes ball'
    .split(' ')
    .map((id) => [id, 1]),
);

// An awake pet (the default fixture's bedtime window covers the fixed test clock).
function awakeState(extra = {}) {
  const data = sampleState();
  data.settings.a = '23:30';
  data.settings.b = '07:00';
  Object.assign(data.pet, extra);
  return data;
}

function housemate(data, id, name) {
  return {
    ...structuredClone(data.pet),
    id,
    name,
    sp: 'dog',
    color: 'mint',
    acc: 'bow',
    others: [],
    eggs: [],
  };
}

const scene = (page) => page.evaluate(() => window.JournalScene3D.describe());
const mainPet = async (page) => (await scene(page)).pets[0];
const live = (page) => page.evaluate(() => window.JournalScene3D.live());

async function expectRoom3D(page) {
  await expect(page.locator('#room')).toHaveClass(/\bis-3d\b/);
  await expect(page.locator('#room > canvas.scene3d')).toHaveCount(1);
  await expect(page.locator('#room > svg.scene')).toHaveCount(0);
}

async function dragPetTo(page, pid, spotId) {
  const box = await page.locator('#room .on-stage[data-pid="' + pid + '"]').boundingBox();
  const to = await page.evaluate((id) => window.JournalScene3D.spotOnPage(id), spotId);
  const from = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y - 12, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test('the scene choice is saved on this device only and never enters the synced state', async ({
  page,
}) => {
  await open(page, 'about');
  await expect(page.locator('.seg[data-name="scene3d"] [data-v="on"]')).toHaveClass(/\bon\b/);
  await subtab(page, 'scene3d', 'off');
  await page.locator('#set-save').click();
  expect(await page.evaluate((key) => localStorage.getItem(key), SCENE3D)).toBe('off');
  // The Firestore rules only accept these five settings; a sixth would break cloud sync.
  expect(Object.keys((await saved(page)).settings).sort()).toEqual([
    'a',
    'b',
    'buddy',
    'quiet',
    'theme',
  ]);
  expect(JSON.stringify(await saved(page))).not.toContain('scene3d');
  await page.reload();
  await expect(page.locator('.seg[data-name="scene3d"] [data-v="off"]')).toHaveClass(/\bon\b/);
  await go(page, 'pet');
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  expect(await live(page)).toBe(null);
  // Switching back on takes effect without a reload.
  await go(page, 'about');
  await subtab(page, 'scene3d', 'on');
  await page.locator('#set-save').click();
  await go(page, 'pet');
  await expectRoom3D(page);
});

test('three.js is only downloaded when a 3D scene is actually shown', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => {
    if (request.url().includes('/vendor/three/')) requested.push(request.url());
  });
  await open(page, 'island');
  await go(page, 'today');
  await go(page, 'about');
  expect(requested).toEqual([]);
  await go(page, 'pet');
  await expectRoom3D(page);
  expect(requested.some((url) => url.endsWith('/vendor/three/three.module.min.js'))).toBe(true);
});

test('the 3D room keeps real buttons for the pet, housemates and the egg nest', async ({
  page,
}) => {
  const data = awakeState({
    own: ALL_FURNITURE,
    eggs: [{ id: 'egg-1', kind: 'gold', warmth: 100, need: 100 }],
  });
  data.pet.others = [housemate(data, 'pet-two', '二號')];
  await open(page, 'pet', data);
  await expectRoom3D(page);
  await expect(page.locator('canvas.scene3d')).toHaveAttribute('aria-hidden', 'true');
  const pet = page.locator('#room .on-stage:not(.other)');
  await expect(pet).toHaveAttribute('aria-label', '摸摸測試伙伴');
  await expect(page.locator('#room .on-stage.other')).toHaveAttribute('aria-label', '轉去照顧二號');
  await expect(page.locator('#nest')).toHaveAttribute('aria-label', /孵蛋座，1 隻蛋，可以孵喇/);
  // Every button sits inside the stage, over its 3D counterpart.
  const stage = await page.locator('#room').boundingBox();
  for (const selector of ['#room .on-stage:not(.other)', '#room .on-stage.other', '#nest']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.width).toBeGreaterThan(30);
    expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 12);
  }
  expect((await scene(page)).pets.map((p) => p.id)).toEqual([data.pet.id, 'pet-two']);

  // Keyboard: the pet is reachable and Enter pats it, exactly as in 2D.
  await pet.focus();
  await page.keyboard.press('Enter');
  expect((await mainPet(page)).expr).toBe('love');
  await expect(page.locator('#bubble')).toBeVisible();
  expect((await saved(page)).pet.traits.cozy).toBe(1);
  // Pointer: a click does the same.
  await pet.click();
  expect((await saved(page)).pet.traits.cozy).toBe(2);

  // The nest opens the egg panel; a housemate button switches who is being cared for.
  await page.locator('#nest').click();
  await expect(page.locator('#care-panel')).toBeVisible();
  await page.locator('#room .on-stage.other').click();
  await expect(page.locator('#pet-title')).toContainText('二號');
  await expectRoom3D(page);
  expect((await scene(page)).pets[0].id).toBe('pet-two');
});

test('dragging a pet settles it on the nearest spot with the right expression and line', async ({
  page,
}) => {
  const data = awakeState({ own: ALL_FURNITURE });
  data.pet.others = [housemate(data, 'pet-two', '二號')];
  await open(page, 'pet', data);
  await expectRoom3D(page);
  const id = data.pet.id;
  expect((await mainPet(page)).spot).toBe('rug');

  await dragPetTo(page, id, 'bed');
  await expect.poll(async () => (await mainPet(page)).spot).toBe('bed');
  await expect.poll(async () => (await mainPet(page)).expr).toBe('sleep');
  await expect(page.locator('#bubble')).toHaveText(/借我瞓陣……|好暖……/);
  expect((await mainPet(page)).held).toBe(false);

  await dragPetTo(page, id, 'sofa');
  await expect.poll(async () => (await mainPet(page)).spot).toBe('sofa');
  await expect.poll(async () => (await mainPet(page)).expr).toBe('happy');
  await expect(page.locator('#bubble')).toHaveText(/梳化好舒服！你都嚟坐吓？|攤喺度最正。/);

  // Dropping onto an occupied spot swaps the two pets, as in the 2D room.
  const other = (await scene(page)).pets.find((p) => p.id === 'pet-two').spot;
  await dragPetTo(page, id, other);
  await expect.poll(async () => (await mainPet(page)).spot).toBe(other);
  await expect
    .poll(async () => (await scene(page)).pets.find((p) => p.id === 'pet-two').spot)
    .toBe('sofa');
  // A drag is not a pat.
  expect((await saved(page)).pet.traits.cozy || 0).toBe(0);

  // Spots are not saved: after a reload the pets take their default places again.
  await page.reload();
  await expectRoom3D(page);
  expect((await mainPet(page)).spot).toBe('rug');
});

test('a 390px phone shows the 3D room without sideways scrolling and the pet can be tapped and dragged', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'pet', awakeState({ own: ALL_FURNITURE }));
  await expectRoom3D(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const pet = page.locator('#room .on-stage:not(.other)');
  const box = await pet.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await pet.click();
  expect((await mainPet(page)).expr).toBe('love');
  const id = (await mainPet(page)).id;
  await dragPetTo(page, id, 'bed');
  await expect.poll(async () => (await mainPet(page)).spot).toBe('bed');
});

test('a lost WebGL context falls back to the 2D room for the rest of the visit', async ({
  page,
}) => {
  await open(page, 'pet', awakeState({ own: ALL_FURNITURE }));
  await expectRoom3D(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.scene3d');
    canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
  });
  await expect(page.locator('.toast')).toContainText('3D 暫時載入唔到，已轉返平面版。');
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  await expect(page.locator('#room')).not.toHaveClass(/\bis-3d\b/);
  expect(await live(page)).toBe(null);
  // The flat room is fully usable and 3D is not attempted again this visit.
  await page.locator('#room .on-stage:not(.other)').click();
  expect((await saved(page)).pet.traits.cozy).toBe(1);
  await go(page, 'today');
  await go(page, 'pet');
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  expect(await page.evaluate(() => window.JournalScene3D.use3D())).toBe(false);
});

test('quiet mode always shows the flat room', async ({ page }) => {
  const data = awakeState();
  data.settings.quiet = true;
  await open(page, 'pet', data);
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  expect(await live(page)).toBe(null);
});

test('with reduced motion the night room is a still picture: no flicker, no idle animation', async ({
  page,
}) => {
  // 03:00 UTC is 23:00 in Toronto: lamp and fairy lights are lit.
  await page.clock.setFixedTime(new Date('2026-10-26T03:00:00Z'));
  await open(page, 'pet', awakeState({ own: ALL_FURNITURE, shiny: true }));
  await expectRoom3D(page);
  expect((await scene(page)).time).toBe('night');
  const canvas = page.locator('canvas.scene3d');
  await page.waitForTimeout(400);
  const first = await canvas.screenshot();
  await page.waitForTimeout(1000);
  const second = await canvas.screenshot();
  expect(first.equals(second)).toBe(true);
  expect((await scene(page)).pets.every((p) => !p.moving)).toBe(true);
});

test('with motion allowed the room is gently alive and a dropped pet still settles', async ({
  page,
}) => {
  // Continuous animation on a software-rendered GPU is slow; give CI room and a small stage.
  test.slow();
  await page.setViewportSize({ width: 700, height: 700 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const data = awakeState({ own: { sofa: 1, lamp: 1 } });
  await open(page, 'pet', data);
  await expectRoom3D(page);
  const canvas = page.locator('canvas.scene3d');
  const first = await canvas.screenshot();
  await page.waitForTimeout(700);
  expect(first.equals(await canvas.screenshot())).toBe(false);
  await dragPetTo(page, data.pet.id, 'sofa');
  await expect.poll(async () => (await mainPet(page)).spot).toBe('sofa');
  await expect.poll(async () => (await mainPet(page)).moving).toBe(false);
  expect((await mainPet(page)).held).toBe(false);
  // Leaving mid-animation stops the loop and frees the scene.
  await go(page, 'today');
  expect(await live(page)).toBe(null);
});

test('leaving the pet page releases every 3D geometry and texture', async ({ page }) => {
  const data = awakeState({
    own: ALL_FURNITURE,
    eggs: [{ id: 'egg-1', kind: 'std', warmth: 10, need: 100 }],
  });
  data.pet.others = [housemate(data, 'pet-two', '二號')];
  await open(page, 'pet', data);
  await expectRoom3D(page);
  const info = () => page.evaluate(() => window.JournalScene3D.info());
  const inside = await info();
  expect(inside.geometries).toBeGreaterThan(10);
  expect(inside.textures).toBeGreaterThan(5);
  for (let visit = 0; visit < 5; visit++) {
    await go(page, 'today');
    expect(await live(page)).toBe(null);
    const outside = await info();
    // three.js keeps one internal quad for the sky backdrop; nothing of the scene remains.
    expect(outside.geometries, 'geometries left after visit ' + visit).toBeLessThanOrEqual(1);
    expect(outside.textures, 'textures left after visit ' + visit).toBe(0);
    await go(page, 'pet');
    await expectRoom3D(page);
    const again = await info();
    expect(again.geometries).toBe(inside.geometries);
    expect(again.textures).toBe(inside.textures);
  }
  // Switching pet tabs releases the room too.
  await subtab(page, 'pettab', 'shop');
  expect(await live(page)).toBe(null);
  expect((await info()).geometries).toBeLessThanOrEqual(1);
  await subtab(page, 'pettab', 'home');
  await expectRoom3D(page);
});

test('the 3D room stays within its performance budget with everything owned', async ({ page }) => {
  const data = awakeState({
    own: ALL_FURNITURE,
    eggs: [{ id: 'egg-1', kind: 'gold', warmth: 60, need: 100 }],
  });
  data.pet.others = [
    housemate(data, 'pet-two', '二號'),
    { ...housemate(data, 'pet-three', '三號'), sp: 'cloud', shiny: true },
  ];
  await open(page, 'pet', data);
  await expectRoom3D(page);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);
  expect(
    await page.evaluate(
      () =>
        document.querySelector('canvas.scene3d').width /
        document.querySelector('canvas.scene3d').clientWidth,
    ),
  ).toBeLessThanOrEqual(1.75);
});

/* ---------- stage 3: park and café outings ---------- */

async function expectStage3D(page, selector) {
  await expect(page.locator(selector)).toHaveClass(/\bis-3d\b/);
  await expect(page.locator(selector + ' > canvas.scene3d')).toHaveCount(1);
  await expect(page.locator(selector + ' > svg.scene')).toHaveCount(0);
}

// Outings roll dice for who is met and what is found; pin them so the test is repeatable.
const fixedDice = (page) =>
  page.addInitScript(() => {
    Math.random = () => 0.1;
  });

test('a park outing plays out in 3D with the same friend, treasure, game and photo', async ({
  page,
}) => {
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await subtab(page, 'pettab', 'out');
  // The destination picker keeps its 2D thumbnails.
  await expect(page.locator('#out-choose .place .th svg.scene')).toHaveCount(4);
  await page.locator('[data-place="park"]').click();
  await expectStage3D(page, '#outstage');
  expect(await live(page)).toBe('park');
  await expect(page.locator('#out-panel')).toContainText('遇到豆豆');
  await expect(page.locator('#outstage .on-stage')).toHaveAttribute('aria-label', '測試伙伴');
  await expect(page.locator('#obubble')).toBeVisible();
  const stage = await scene(page);
  expect(stage.pet.x).toBe(-2);
  expect(stage.npc).toMatchObject({ id: 'dodo', visible: true, x: 2.9 });
  expect(['egg', '楓葉']).toContain(stage.found);
  expect(stage.moving).toBe(false);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);
  // Reduced motion: a still picture.
  const canvas = page.locator('canvas.scene3d');
  const first = await canvas.screenshot();
  await page.waitForTimeout(700);
  expect(first.equals(await canvas.screenshot())).toBe(true);

  // Friendship, the five-throw game and its reward are the same code as in 2D.
  await page.locator('[data-soc="hi"]').click();
  expect((await saved(page)).pet.friends.dodo).toMatchObject({ xp: 3, met: 1 });
  await page.locator('#game-go').click();
  for (let i = 0; i < 5; i++) await page.locator('#game-throw').click();
  await expect(page.locator('#game')).toContainText('五球完成！15 分');
  expect((await saved(page)).pet.best).toBe(15);
  expect((await scene(page)).pet.x).toBe(-2);

  // Photos are still composed from the 2D artwork.
  await page.locator('#trip-photo').click();
  await expect(page.locator('#ph-prev svg').first()).toBeVisible();

  // Going home swaps the park for the 3D room and frees the park.
  await page.locator('#trip-home').click();
  await expectRoom3D(page);
  expect(await live(page)).toBe('home');
  await expect(page.locator('#outstage canvas')).toHaveCount(0);
});

test('the café is 3D, the lake stays 2D, and leaving releases everything', async ({ page }) => {
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="cafe"]').click();
  await expectStage3D(page, '#outstage');
  expect(await live(page)).toBe('cafe');
  const stage = await scene(page);
  expect(stage.npc).toMatchObject({ id: 'bobo', visible: true });
  await expect(page.locator('#nbubble')).toBeVisible();
  await expect(page.locator('#game-go')).toHaveCount(0);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);

  // A place without a 3D scene shows its 2D artwork even with 3D switched on.
  await page.locator('#trip-home').click();
  await subtab(page, 'pettab', 'out');
  expect(await live(page)).toBe(null);
  await page.locator('[data-place="lake"]').click();
  await expect(page.locator('#outstage > svg.scene')).toHaveCount(1);
  await expect(page.locator('#outstage')).not.toHaveClass(/\bis-3d\b/);
  expect(await live(page)).toBe(null);
  await expect(page.locator('#out-panel')).toContainText('返屋企');

  // Back to the café, then away from the pet page altogether: nothing stays on the GPU.
  await page.locator('#trip-home').click();
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="cafe"]').click();
  await expectStage3D(page, '#outstage');
  await go(page, 'today');
  expect(await live(page)).toBe(null);
  const after = await page.evaluate(() => window.JournalScene3D.info());
  expect(after.geometries).toBeLessThanOrEqual(1);
  expect(after.textures).toBe(0);
});

test('with motion allowed the pet walks into the park and fetches a thrown ball', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 700, height: 700 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="park"]').click();
  await expectStage3D(page, '#outstage');
  // The walk-in is under way: the pet has not reached its stop yet.
  expect((await scene(page)).moving).toBe(true);
  await expect(page.locator('#trip-home')).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => (await scene(page)).npc.visible, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await scene(page)).pet.x, { timeout: 15000 }).toBe(-2);

  await page.locator('#game-go').click();
  await page.locator('#game-throw').click();
  expect((await scene(page)).ball).toBe(true);
  await expect(page.locator('#game-score')).toContainText('1 球', { timeout: 15000 });
  // Pausing the game mid-throw clears the ball from the scene at once.
  await page.locator('#game-throw').click();
  expect((await scene(page)).ball).toBe(true);
  await page.locator('#trip-photo').click();
  await page.locator('#game-go').click();
  expect((await scene(page)).ball).toBe(false);
  // Leaving mid-throw stops everything.
  await page.locator('#game-throw').click();
  await go(page, 'today');
  expect(await live(page)).toBe(null);
});

// Refreshes the review screenshots in docs/screenshots. Not a pixel comparison: software
// and hardware GPUs differ slightly. Run with UPDATE_3D_SCREENSHOTS=1.
test('review screenshots of the 3D room', async ({ page }) => {
  test.skip(!process.env.UPDATE_3D_SCREENSHOTS, 'only when refreshing docs/screenshots');
  const folder = path.join(__dirname, '..', '..', 'docs', 'screenshots');
  fs.mkdirSync(folder, { recursive: true });
  for (const [name, time] of [
    ['day', '2026-10-25T16:00:00Z'],
    ['dusk', '2026-10-25T22:00:00Z'],
    ['night', '2026-10-26T03:00:00Z'],
  ]) {
    await page.clock.setFixedTime(new Date(time));
    const data = awakeState({
      own: ALL_FURNITURE,
      acc: 'scarf',
      eggs: [{ id: 'egg-1', kind: 'gold', warmth: 60, need: 100 }],
    });
    data.pet.others = [
      housemate(data, 'pet-two', '二號'),
      {
        ...housemate(data, 'pet-three', '三號'),
        sp: 'cloud',
        color: 'aurora',
        acc: 'flower',
        shiny: true,
      },
    ];
    await page
      .evaluate(({ LS, data }) => localStorage.setItem(LS, JSON.stringify(data)), { LS, data })
      .catch(() => {});
    await open(page, 'pet', data);
    await page.reload();
    await expectRoom3D(page);
    await page.waitForTimeout(500);
    await page.locator('#room').screenshot({ path: path.join(folder, '3d-home-' + name + '.png') });
  }
});
