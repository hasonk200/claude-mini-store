// 3D scene coverage. These only run in the "3d" project (SwiftShader WebGL, 3D switched on);
// the regular journal flows in journal.spec.cjs run in both the 2D and the 3D project.
const { test, expect, SCENE3D, open, go, saved, subtab } = require('./helpers.cjs');

const live = (page) => page.evaluate(() => window.JournalScene3D.live());

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
  await subtab(page, 'scene3d', 'auto');
  await page.locator('#set-save').click();
  expect(await page.evaluate((key) => localStorage.getItem(key), SCENE3D)).toBe('auto');
});

test('switching 3D on changes nothing until a scene exists, and three.js is not downloaded', async ({
  page,
}) => {
  const requested = [];
  page.on('request', (request) => {
    if (request.url().includes('/vendor/three/')) requested.push(request.url());
  });
  await open(page, 'island');
  expect(await page.evaluate(() => window.JournalScene3D.use3D())).toBe(true);
  for (const route of ['today', 'pet', 'about', 'island']) await go(page, route);
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  expect(await live(page)).toBe(null);
  expect(requested).toEqual([]);
});
