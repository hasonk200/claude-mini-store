// Runs in the "no-webgl" project, where Chromium is started with WebGL disabled.
const { test, expect, sampleState, open, saved } = require('./helpers.cjs');

test('without WebGL the flat room is used automatically, with no errors', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => {
    if (request.url().includes('/vendor/three/')) requested.push(request.url());
  });
  const consoleErrors = [];
  page.on('console', (message) => {
    // Requests to anything but the local test server are blocked on purpose (see helpers).
    if (message.type() === 'error' && !/net::ERR_FAILED|Google sign-in/.test(message.text()))
      consoleErrors.push(message.text());
  });
  const data = sampleState();
  data.settings.quiet = false;
  await open(page, 'pet', data, 'on');
  expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))).toBe(
    false,
  );
  await expect(page.locator('#room > svg.scene')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  await expect(page.locator('#room')).not.toHaveClass(/\bis-3d\b/);
  expect(await page.evaluate(() => window.JournalScene3D.use3D())).toBe(false);
  await page.locator('#room .on-stage:not(.other)').click();
  expect((await saved(page)).pet.traits.cozy).toBe(1);
  expect(requested).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('without WebGL the island shows the painted map and its stops', async ({ page }) => {
  const data = sampleState();
  data.settings.quiet = false;
  await open(page, 'island', data, 'on');
  await expect(page.locator('#island-world .world-art')).toBeVisible();
  await expect(page.locator('#island-world .world-art')).toHaveAttribute(
    'src',
    /assets\/island-(day|night)\.webp/,
  );
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  await expect(page.locator('#world-companion')).toBeVisible();
  await page.locator('.map-stop[data-destination="garden"]').click();
  await expect(page.locator('#island-destination')).toContainText('成長花園');
});

test('without WebGL the quiet lakeside shows its painted picture', async ({ page }) => {
  const data = sampleState();
  data.settings.quiet = false;
  await open(page, 'haven', data, 'on');
  await expect(page.locator('#haven-scene .haven-art')).toBeVisible();
  await expect(page.locator('#haven-scene .haven-pet svg')).toHaveCount(1);
  await expect(page.locator('canvas.scene3d')).toHaveCount(0);
  await expect(page.locator('#haven-scene')).not.toHaveClass(/\bis-3d\b/);
  await page.locator('#haven-rest').click();
  await expect(page.locator('#haven-copy')).toContainText('60 秒');
});
