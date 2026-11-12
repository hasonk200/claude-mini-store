const { defineConfig } = require('@playwright/test');

const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
// Chromium renders WebGL in software (SwiftShader) so the 3D scenes run on CI without a GPU.
const launch = (...args) => ({
  ...(executable ? { executablePath: executable } : {}),
  args: [...(executable ? ['--no-sandbox'] : []), ...args],
});

module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.cjs',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
    timezoneId: 'America/Toronto',
    // `reducedMotion` is a browser-context option; set at the top level it is ignored.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Every journal flow runs twice: with the flat scenes and with the 3D scenes switched on.
  projects: [
    {
      name: '2d',
      testIgnore: '**/scene3d*.spec.cjs',
      use: { launchOptions: launch() },
    },
    {
      name: '3d',
      testIgnore: '**/scene3d-no-webgl.spec.cjs',
      use: { launchOptions: launch('--use-angle=swiftshader', '--enable-unsafe-swiftshader') },
    },
    {
      name: 'no-webgl',
      testMatch: '**/scene3d-no-webgl.spec.cjs',
      use: { launchOptions: launch('--disable-webgl', '--disable-webgl2') },
    },
  ],
  webServer: {
    command: 'node tests/browser/server.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
