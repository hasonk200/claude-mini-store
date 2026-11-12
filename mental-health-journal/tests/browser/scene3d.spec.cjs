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

// Two captures of the 3D canvas some time apart. Speech bubbles, toasts and floating
// effects are DOM drawn over the canvas and come and go on timers, so they are hidden.
// Tests that let the scenes animate draw every frame on the CPU, and the cost is per pixel:
// a phone-sized stage keeps them from starving whatever else is running beside them.
const MOTION_VIEWPORT = { width: 420, height: 700 };

async function twoFrames(page, gap = 800) {
  await page.addStyleTag({
    content: '.bubble,.toast,.fx,.nest-tag{visibility:hidden!important}',
  });
  const canvas = page.locator('canvas.scene3d');
  await page.waitForTimeout(300);
  const first = await canvas.screenshot();
  await page.waitForTimeout(gap);
  return first.equals(await canvas.screenshot());
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
  // Pages without a 3D scene never fetch it, even with 3D switched on.
  await open(page, 'today');
  await go(page, 'draw');
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
  expect(await twoFrames(page, 1000)).toBe(true);
  expect((await scene(page)).pets.every((p) => !p.moving)).toBe(true);
});

test('with motion allowed the room is gently alive and a dropped pet still settles', async ({
  page,
}) => {
  // Continuous animation on a software-rendered GPU is slow; give CI room and a small stage.
  test.slow();
  await page.setViewportSize(MOTION_VIEWPORT);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const data = awakeState({ own: { sofa: 1, lamp: 1 } });
  await open(page, 'pet', data);
  await expectRoom3D(page);
  expect(await twoFrames(page)).toBe(false);
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
  // (The tab's own handler runs a moment after the click.)
  await subtab(page, 'pettab', 'shop');
  await expect.poll(() => live(page)).toBe(null);
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
  expect(await twoFrames(page)).toBe(true);

  // Friendship, the five-throw game and its reward are the same code as in 2D.
  await page.locator('[data-soc="hi"]').click();
  expect((await saved(page)).pet.friends.dodo).toMatchObject({ xp: 3, met: 1 });
  await page.locator('#game-go').click();
  for (let i = 0; i < 5; i++) await page.locator('#game-throw').click();
  await expect(page.locator('#game')).toContainText('五球完成！15 分');
  expect((await saved(page)).pet.best).toBe(15);
  expect((await scene(page)).pet.x).toBe(-2);

  // The photo shows the park as it looks here: a still picture taken of the 3D scene.
  await page.locator('#trip-photo').click();
  await expect(page.locator('#ph-prev svg').first()).toBeVisible();
  await expect(page.locator('#ph-prev svg image')).toHaveAttribute('href', /^data:image\/jpeg/);
  expect(await live(page)).toBe('park');

  // Going home swaps the park for the 3D room and frees the park.
  await page.locator('#trip-home').click();
  await expectRoom3D(page);
  expect(await live(page)).toBe('home');
  await expect(page.locator('#outstage canvas')).toHaveCount(0);
});

test('the café and the lake are 3D, and leaving releases everything', async ({ page }) => {
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

  // The lake: the boardwalk in 3D, with the ball game on offer as in 2D.
  await page.locator('#trip-home').click();
  await subtab(page, 'pettab', 'out');
  await expect.poll(() => live(page)).toBe(null);
  await page.locator('[data-place="lake"]').click();
  await expectStage3D(page, '#outstage');
  expect(await live(page)).toBe('lake');
  await expect(page.locator('#out-panel')).toContainText('返屋企');
  await expect(page.locator('#game-go')).toHaveCount(1);
  const lake = await scene(page);
  expect(lake.pet).not.toBe(null);
  expect(['egg', '貝殼', null]).toContain(lake.found);
  const lakeInfo = await page.evaluate(() => window.JournalScene3D.info());
  expect(lakeInfo.triangles).toBeLessThanOrEqual(50000);
  expect(lakeInfo.calls).toBeLessThanOrEqual(80);
  // Reduced motion: the water, the boats and the gulls all hold still.
  expect(await twoFrames(page)).toBe(true);

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

// Clicks, and reports what the scene said in the same instant (after the app handled the
// click). Movement is timed by the clock, so on a busy machine it can be over before a
// separate question reaches the page.
async function clickAndDescribe(page, selector) {
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () => {
        window.__atClick = window.JournalScene3D.describe();
      },
      { once: true },
    );
  });
  await page.locator(selector).click();
  return page.evaluate(() => window.__atClick);
}

test('photos show the 3D place, are stored as before, and fall back to the 2D artwork', async ({
  page,
}) => {
  test.slow();
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await expectRoom3D(page);
  await page.locator('[data-care="photo"]').click();
  const preview = page.locator('#ph-prev svg image');
  await expect(preview).toHaveAttribute('href', /^data:image\/jpeg/);
  const first = await preview.getAttribute('href');
  // The frame, sticker and date are still drawn over the picture.
  await expect(page.locator('#ph-prev svg.photo-svg')).toHaveAttribute('viewBox', '0 0 860 640');
  await expect(page.locator('#ph-prev svg.photo-svg path')).not.toHaveCount(0);
  // The room is still live behind the editor, at its own size.
  expect(await live(page)).toBe('home');
  expect(await twoFrames(page)).toBe(true);
  // A different expression is a different picture; typing a caption is not.
  await page.locator('[data-ph="expr"] [data-v="sleep"]').click();
  await expect.poll(() => preview.getAttribute('href')).not.toBe(first);
  const asleep = await preview.getAttribute('href');
  await page.locator('#ph-cap').fill('屋企');
  expect(await preview.getAttribute('href')).toBe(asleep);
  await page.locator('#ph-shoot').click();
  await expect(page.locator('#photo-ed')).toBeHidden();

  // What is saved is the same handful of facts as ever – no image.
  const shot = (await saved(page)).pet.album[0];
  expect(Object.keys(shot).sort()).toEqual(
    [
      'acc',
      'books',
      'caption',
      'cardId',
      'color',
      'date',
      'expr',
      'frame',
      'hour',
      'id',
      'npc',
      'place',
      'pname',
      'rain',
      'shiny',
      'sp',
      'stage',
      'stickers',
      't',
      'trait',
    ].sort(),
  );
  expect(JSON.stringify(shot)).not.toContain('data:image');

  // The album shows it the same way, small and large.
  await subtab(page, 'pettab', 'album');
  await expect(page.locator('#album .photo svg image')).toHaveAttribute(
    'href',
    /^data:image\/jpeg/,
  );
  await page.locator('[data-shot]').first().click();
  await expect(page.locator('#album-view .ph-big svg image')).toHaveAttribute(
    'href',
    /^data:image\/jpeg/,
  );
  await expect(page.locator('#album-view')).toContainText('屋企');
  // Downloading turns the same framed picture into an image (this page has nowhere to save
  // it to, which is the message that follows a successful conversion).
  await page.locator('#al-dl').click();
  await expect(page.locator('#al-msg')).toHaveText('呢度唔可以直接下載，可以撳住張相儲存。');
  // Nothing of the photo's scene stays on the GPU once it has been taken.
  await expect
    .poll(async () => (await page.evaluate(() => window.JournalScene3D.info())).textures, {
      timeout: 10000,
    })
    .toBe(0);
  expect((await page.evaluate(() => window.JournalScene3D.info())).geometries).toBeLessThanOrEqual(
    1,
  );

  // With 3D switched off the same photo is drawn from the 2D artwork.
  await page.evaluate(() => localStorage.setItem('dicky-care-scene3d', 'off'));
  await page.reload();
  await subtab(page, 'pettab', 'album');
  await expect(page.locator('#album .photo svg.photo-svg')).toHaveCount(1);
  await expect(page.locator('#album .photo svg image')).toHaveCount(0);
  await expect(page.locator('#album .photo svg.photo-svg svg.scene')).toHaveCount(1);
});

test('the night street is 3D, and is night at any hour', async ({ page }) => {
  // 16:00 UTC is 11:00 in Toronto: broad daylight everywhere else.
  await page.clock.setFixedTime(new Date('2026-10-25T16:00:00Z'));
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="street"]').click();
  await expectStage3D(page, '#outstage');
  expect(await live(page)).toBe('street');
  const street = await scene(page);
  expect(street.time).toBe('night');
  expect(street.pet).not.toBe(null);
  expect(['egg', '瓶蓋', null]).toContain(street.found);
  await expect(page.locator('#game-go')).toHaveCount(0);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);
  // Reduced motion: steady lights, no drifting steam.
  expect(await twoFrames(page)).toBe(true);
  await page.locator('#trip-photo').click();
  await expect(page.locator('#ph-prev svg image')).toHaveAttribute('href', /^data:image\/jpeg/);
  await page.locator('#trip-home').click();
  await expectRoom3D(page);
  expect(await live(page)).toBe('home');
});

test('the quiet lakeside is 3D, keeps its one-minute rest, and frees itself on leaving', async ({
  page,
}) => {
  const painted = [];
  page.on('request', (request) => {
    if (request.url().includes('lakeside.webp')) painted.push(request.url());
  });
  await open(page, 'haven', awakeState());
  await expectStage3D(page, '#haven-scene');
  expect(await live(page)).toBe('haven');
  // The painted picture is neither shown nor fetched; the box says what it shows instead.
  await expect(page.locator('#haven-scene .haven-art')).toHaveCount(0);
  await expect(page.locator('#haven-scene .haven-pet')).toHaveCount(0);
  await expect(page.locator('#haven-scene')).toHaveAttribute('role', 'img');
  await expect(page.locator('#haven-scene')).toHaveAttribute('aria-label', /湖畔碼頭/);
  await expect(page.locator('#haven-scene canvas.scene3d')).toHaveAttribute('aria-hidden', 'true');
  expect(painted).toEqual([]);
  const haven = await scene(page);
  expect(haven.pet).toMatchObject({ expr: 'normal', x: 0 });
  expect(haven.moving).toBe(false);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);
  expect(await twoFrames(page)).toBe(true);

  // The rest itself is the same code as in 2D.
  await page.locator('#haven-rest').click();
  await expect(page.locator('#haven-copy')).toContainText('60 秒');
  await expect(page.locator('#haven-rest')).toHaveText('隨時結束');
  expect(await live(page)).toBe('haven');

  await go(page, 'island');
  await expectStage3D(page, '#island-world');
  expect(await live(page)).toBe('island');
  await expect(page.locator('#haven-scene canvas')).toHaveCount(0);
  await go(page, 'today');
  expect(await live(page)).toBe(null);
  const after = await page.evaluate(() => window.JournalScene3D.info());
  expect(after.geometries).toBeLessThanOrEqual(1);
  expect(after.textures).toBe(0);
});

test('the 3D lakeside shows a companion even before one is adopted', async ({ page }) => {
  const data = awakeState();
  data.pet = null;
  await open(page, 'haven', data);
  await expectStage3D(page, '#haven-scene');
  expect((await scene(page)).pet).toMatchObject({ expr: 'normal' });
});

test('quiet mode always shows the painted lakeside', async ({ page }) => {
  const data = awakeState();
  data.settings.quiet = true;
  await open(page, 'haven', data);
  await expect(page.locator('#haven-scene .haven-art')).toBeVisible();
  await expect(page.locator('#haven-scene .haven-pet svg')).toHaveCount(1);
  await expect(page.locator('#haven-scene')).not.toHaveClass(/\bis-3d\b/);
  await expect(page.locator('#haven-scene')).not.toHaveAttribute('role', 'img');
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  expect(await live(page)).toBe(null);
});

test('with motion allowed the pet walks into the park and fetches a thrown ball', async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize(MOTION_VIEWPORT);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fixedDice(page);
  await open(page, 'pet', awakeState());
  await subtab(page, 'pettab', 'out');
  await page.locator('[data-place="park"]').click();
  await expectStage3D(page, '#outstage');
  // The walk-in is under way – or, if the scene was slow to arrive on a busy machine, the pet
  // has already joined the walk at its end and stands at its stop.
  const start = await scene(page);
  expect(start.moving || start.pet.x === -2).toBe(true);
  await expect(page.locator('#trip-home')).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => (await scene(page)).npc.visible, { timeout: 15000 }).toBe(true);
  await expect.poll(async () => (await scene(page)).pet.x, { timeout: 15000 }).toBe(-2);

  await page.locator('#game-go').click();
  expect((await clickAndDescribe(page, '#game-throw')).ball).toBe(true);
  await expect(page.locator('#game-score')).toContainText('1 球', { timeout: 15000 });
  // Pausing the game mid-throw clears the ball from the scene at once.
  expect((await clickAndDescribe(page, '#game-throw')).ball).toBe(true);
  await page.locator('#trip-photo').click();
  await page.locator('#game-go').click();
  expect((await scene(page)).ball).toBe(false);
  // Leaving mid-throw stops everything.
  await page.locator('#game-throw').click();
  await go(page, 'today');
  expect(await live(page)).toBe(null);
});

/* ---------- stage 4: island map ---------- */

const STOPS = ['home', 'library', 'garden', 'lake', 'plaza'];

test('the island map is 3D with the same five keyboard-reachable stops, and no painted map is fetched', async ({
  page,
}) => {
  const nightMap = [];
  page.on('request', (request) => {
    if (request.url().includes('assets/island-night.webp')) nightMap.push(request.url());
  });
  await open(page, 'island', awakeState());
  await expectStage3D(page, '#island-world');
  expect(await live(page)).toBe('island');
  // The painted map is not used: its <img> is hidden and never given a source.
  const art = page.locator('#island-world .world-art');
  await expect(art).toBeHidden();
  expect(await art.getAttribute('src')).toBe(null);
  await expect(page.locator('#world-companion')).toBeHidden();

  // The five stops are real buttons floating over their buildings, inside the map.
  const map = await page.locator('#island-world').boundingBox();
  for (const k of STOPS) {
    const stop = page.locator('.map-stop[data-destination="' + k + '"]');
    await expect(stop).toBeVisible();
    const box = await stop.boundingBox();
    expect(box.x + box.width / 2).toBeGreaterThan(map.x);
    expect(box.x + box.width / 2).toBeLessThan(map.x + map.width);
    expect(box.y + box.height / 2).toBeGreaterThan(map.y);
    expect(box.y + box.height / 2).toBeLessThan(map.y + map.height);
  }
  // Tab walks them in the same order as the 2D map; Enter chooses one.
  await page.locator('.map-stop[data-destination="home"]').focus();
  for (const k of STOPS.slice(1)) {
    await page.keyboard.press('Tab');
    await expect(page.locator('.map-stop[data-destination="' + k + '"]')).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-stop[data-destination="plaza"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#island-destination')).toContainText('小遊戲廣場');
  const island = await scene(page);
  expect(island.destination).toBe('plaza');
  expect(island.companion).toMatchObject({
    sp: 'cat',
    x: +(island.places.plaza.x + island.visit.plaza[0]).toFixed(2),
  });
  expect(island.moving).toBe(false);

  // Clicking a building is the same as clicking its stop.
  const library = await page.evaluate(
    ({ place, pan }) =>
      window.JournalScene3D.pointOnPage({
        x: place.x + pan.x,
        y: place.y + 1.0,
        z: place.z + pan.z,
      }),
    { place: island.places.library, pan: island.pan },
  );
  await page.mouse.click(library.x, library.y);
  await expect(page.locator('.map-stop[data-destination="library"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await scene(page)).destination).toBe('library');

  // Day and night follow the same toolbar as the 2D map.
  await page.locator('[data-world-time="night"]').click();
  expect((await scene(page)).time).toBe('night');
  await expect(page.locator('#island-season')).toContainText('月光小島');
  await page.locator('[data-world-time="day"]').click();
  expect((await scene(page)).time).toBe('day');

  // Reduced motion: a still picture.
  expect(await twoFrames(page)).toBe(true);
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);

  // Night was shown above without fetching the painted night map. (The postcards further
  // down the page are 2D keepsakes cropped from the day painting, so that one still loads.)
  expect(nightMap).toEqual([]);
  expect(await art.getAttribute('src')).toBe(null);

  // Entering a place leaves the map and frees it; coming back shows it again.
  await page.locator('#destination-enter').click();
  await expect(page.locator('#page-draw')).toHaveClass(/\bon\b/);
  expect(await live(page)).toBe(null);
  const after = await page.evaluate(() => window.JournalScene3D.info());
  expect(after.geometries).toBeLessThanOrEqual(1);
  expect(after.textures).toBe(0);
  expect((await saved(page)).journey.discovered.library).toBeTruthy();
  await go(page, 'island');
  await expectStage3D(page, '#island-world');
  expect(await art.getAttribute('src')).toBe(null);
});

test('the island at its fullest, at night, stays within the performance budget', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-26T03:00:00Z'));
  const data = awakeState();
  // Forty recorded days and the flower decoration: every garden stage and the most flowers,
  // with all the lamps lit.
  for (let i = 0; i < 40; i++) {
    const day = new Date(Date.UTC(2026, 9, 24 - i)).toISOString().slice(0, 10);
    data.draws[day] = { date: day, card: 'c00', text: '記低', mode: 'one' };
  }
  data.journey = { ...(data.journey || {}), decor: 'flowers' };
  await open(page, 'island', data);
  await expectStage3D(page, '#island-world');
  const island = await scene(page);
  expect(island.time).toBe('night');
  expect(island.garden).toEqual({ level: 4, decor: 'flowers', watered: false });
  const info = await page.evaluate(() => window.JournalScene3D.info());
  expect(info.triangles).toBeLessThanOrEqual(50000);
  expect(info.calls).toBeLessThanOrEqual(80);
});

test('the 3D garden grows with the journey and shows its decoration and watering', async ({
  page,
}) => {
  const data = awakeState();
  // Sixteen recorded days: 微光花房, the fourth of the five garden stages.
  for (let i = 0; i < 16; i++) {
    const day = new Date(Date.UTC(2026, 9, 24 - i)).toISOString().slice(0, 10);
    data.draws[day] = { date: day, card: 'c00', text: '記低', mode: 'one' };
  }
  await open(page, 'island', data);
  await expectStage3D(page, '#island-world');
  await expect(page.locator('#garden-stage')).toHaveText('微光花房');
  let island = await scene(page);
  expect(island.garden).toEqual({ level: 3, decor: 'lantern', watered: false });
  expect(island.flowers).toBe(16);
  await page.locator('[data-decor="flowers"]').click();
  island = await scene(page);
  expect(island.garden.decor).toBe('flowers');
  expect(island.flowers).toBe(22);
  await page.locator('[data-decor="stars"]').click();
  expect((await scene(page)).garden.decor).toBe('stars');
  await page.locator('#garden-water').click();
  expect((await scene(page)).garden.watered).toBe(true);
  expect((await saved(page)).journey.decor).toBe('stars');
});

test('quiet mode swaps the 3D map for the painted one and back, with the stops back in place', async ({
  page,
}) => {
  await open(page, 'island', awakeState());
  await expectStage3D(page, '#island-world');
  const stop = page.locator('.map-stop[data-destination="lake"]');
  expect(await stop.evaluate((el) => el.style.left)).not.toBe('');
  await page.locator('#quiet-toggle').click();
  await expect(page.locator('#island-world')).not.toHaveClass(/\bis-3d\b/);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  await expect(page.locator('#island-world .world-art')).toBeVisible();
  await expect(page.locator('#island-world .world-art')).toHaveAttribute(
    'src',
    /assets\/island-(day|night)\.webp/,
  );
  // The stops return to their stylesheet positions.
  expect(await stop.evaluate((el) => el.style.left + el.style.top)).toBe('');
  await stop.click();
  await expect(page.locator('#island-destination')).toContainText('靜靜湖畔');
  await page.locator('#quiet-toggle').click();
  await expectStage3D(page, '#island-world');
  expect((await scene(page)).destination).toBe('lake');
});

test('with motion allowed the companion strolls to the chosen place', async ({ page }) => {
  test.slow();
  await page.setViewportSize(MOTION_VIEWPORT);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'island', awakeState());
  await expectStage3D(page, '#island-world');
  const start = (await scene(page)).companion;
  expect((await clickAndDescribe(page, '.map-stop[data-destination="lake"]')).moving).toBe(true);
  await expect.poll(async () => (await scene(page)).moving, { timeout: 20000 }).toBe(false);
  const island = await scene(page);
  expect(island.companion.x).toBeGreaterThan(start.x);
  expect(island.companion.x).toBe(+(island.places.lake.x + island.visit.lake[0]).toFixed(2));
  // The view has leaned towards the lake.
  expect(island.pan.x).toBeLessThan(0);
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

test('review screenshots of the 3D outings, lakeside and island', async ({ page }) => {
  test.skip(!process.env.UPDATE_3D_SCREENSHOTS, 'only when refreshing docs/screenshots');
  test.slow();
  const folder = path.join(__dirname, '..', '..', 'docs', 'screenshots');
  fs.mkdirSync(folder, { recursive: true });
  await fixedDice(page);
  for (const [name, time, place] of [
    ['park-day', '2026-10-25T16:00:00Z', 'park'],
    ['cafe-dusk', '2026-10-25T22:00:00Z', 'cafe'],
    ['lake-day', '2026-10-25T16:00:00Z', 'lake'],
    ['lake-dusk', '2026-10-25T22:30:00Z', 'lake'],
    ['lake-night', '2026-10-26T03:00:00Z', 'lake'],
    ['street-night', '2026-10-26T03:00:00Z', 'street'],
    ['haven-day', '2026-10-25T16:00:00Z', 'haven'],
    ['haven-night', '2026-10-26T03:00:00Z', 'haven'],
    ['island-day', '2026-10-25T16:00:00Z', 'island'],
    ['island-dusk', '2026-10-25T22:30:00Z', 'island'],
    ['island-night', '2026-10-26T03:00:00Z', 'island'],
  ]) {
    await page.clock.setFixedTime(new Date(time));
    const data = awakeState({ acc: 'scarf' });
    // Forty recorded days and the flower decoration: the garden at its fullest.
    for (let i = 0; i < 40; i++) {
      const day = new Date(Date.UTC(2026, 9, 24 - i)).toISOString().slice(0, 10);
      data.draws[day] = { date: day, card: 'c00', text: '記低', mode: 'one' };
    }
    data.journey = { ...(data.journey || {}), decor: 'flowers' };
    await page
      .evaluate(({ LS, data }) => localStorage.setItem(LS, JSON.stringify(data)), { LS, data })
      .catch(() => {});
    const island = place === 'island',
      own = island || place === 'haven';
    await open(page, own ? place : 'pet', data);
    await page.reload();
    if (!own) {
      await subtab(page, 'pettab', 'out');
      await page.locator('[data-place="' + place + '"]').click();
      await expect(page.locator('#trip-home')).toBeVisible({ timeout: 15000 });
    }
    const stage = island ? '#island-world' : place === 'haven' ? '#haven-scene' : '#outstage';
    await expectStage3D(page, stage);
    await page.waitForTimeout(800);
    await page.locator(stage).screenshot({ path: path.join(folder, '3d-' + name + '.png') });
  }
});
