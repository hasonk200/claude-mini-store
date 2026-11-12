const { test: base, expect } = require('@playwright/test');
const Core = require('../../js/core.js');

const DAY = '2026-10-25';
const NOW = Date.parse(DAY + 'T20:00:00Z');
const LS = 'dicky-care-v1';
const OWNER = 'dicky-care-firebase-uid-v1';

function sampleState(name = '測試伙伴') {
  return {
    checkins: {},
    draws: {},
    evidence: [],
    settings: { a: '09:00', b: '16:30', theme: 'auto', quiet: true, buddy: true },
    journey: Core.journey(),
    pet: {
      id: 'pet-' + Buffer.from(name).toString('hex'),
      name,
      sp: 'cat',
      color: 'milktea',
      acc: '',
      born: DAY,
      xp: 180,
      coins: 200,
      needs: { food: 80, water: 80, energy: 80, clean: 85, fun: 80 },
      nt: NOW,
      own: {},
      accs: [],
      friends: {},
      album: [],
      aw: {},
      chat: [],
      lastVisit: DAY,
      walks: 0,
      best: 0,
      treasure: {},
      fed: '',
      sleepAt: 0,
      traits: {},
      eggs: [],
      others: [],
      eggDay: '',
    },
    miles: Object.fromEntries(
      'ci1 ci10 ci30 ci100 dr1 dr7 dr30 zhiji hb50 hb80 ev20 lad5 teen adult hatch1 friend album10'
        .split(' ')
        .map((id) => [id, DAY]),
    ),
    milesInit: 1,
    t: NOW,
  };
}

// Each test owns its browser storage. No test can contact the production Firebase project.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400)
        errors.push(response.status() + ' ' + response.url());
    });
    await page.route('**/*', (route) =>
      route.request().url().startsWith('http://127.0.0.1:4173/') ? route.continue() : route.abort(),
    );
    await page.clock.setFixedTime(new Date(NOW));
    await use(page);
    expect(errors, 'uncaught browser errors or missing application files').toEqual([]);
  },
});

async function open(page, route = 'island', data = sampleState()) {
  await page.addInitScript(
    ({ data, LS }) => {
      if (!sessionStorage.getItem('test-seeded')) {
        if (data !== null)
          localStorage.setItem(LS, typeof data === 'string' ? data : JSON.stringify(data));
        sessionStorage.setItem('test-seeded', 'yes');
      }
    },
    { data, LS },
  );
  await page.goto('/#' + route);
  await expect(page.locator('#page-' + route)).toHaveClass(/\bon\b/);
  await expect(page.locator('#google-login')).toBeEnabled();
}

async function go(page, route) {
  await page.evaluate((route) => {
    location.hash = route;
  }, route);
  await expect(page.locator('#page-' + route)).toHaveClass(/\bon\b/);
}

async function saved(page) {
  return page.evaluate((LS) => JSON.parse(localStorage.getItem(LS)), LS);
}

async function subtab(page, name, value) {
  await page.locator('.seg[data-name="' + name + '"] [data-v="' + value + '"]').click();
  await expect(page.locator('.seg[data-name="' + name + '"] [data-v="' + value + '"]')).toHaveClass(
    /\bon\b/,
  );
}

// The compat SDK boundary is synthetic; the actual auth, storage and UI modules still run.
async function installAccounts(page) {
  await page.addInitScript(
    ({ OWNER }) => {
      const docs = {};
      const reads = [];
      const writes = [];
      let failingUid = null;
      let observer;
      const auth = {
        currentUser: null,
        setPersistence: async () => {},
        onAuthStateChanged(next) {
          observer = next;
          queueMicrotask(() => next(null));
        },
        async signOut() {
          auth.currentUser = null;
          observer(null);
        },
      };
      const db = {
        doc(path) {
          return {
            async get() {
              reads.push(path);
              if (failingUid && path.startsWith('users/' + failingUid + '/'))
                throw new Error('offline');
              const data = docs[path];
              return { exists: !!data, data: () => structuredClone(data) };
            },
            async set(data) {
              writes.push({ path, data: structuredClone(data) });
              docs[path] = structuredClone(data);
            },
          };
        },
      };
      const app = { auth: () => auth, firestore: () => db };
      window.firebase = {
        apps: [app],
        app: () => app,
        auth: { Auth: { Persistence: { LOCAL: 'local', NONE: 'none' } } },
      };
      window.testAccounts = {
        reads,
        writes,
        async switchTo(uid, state, failReads = false) {
          failingUid = failReads ? uid : null;
          localStorage.setItem('dicky-care-v1-account-' + uid, JSON.stringify(state));
          // First login uses local data; establish a different owner for the switch path.
          if (!localStorage.getItem(OWNER)) localStorage.setItem(OWNER, 'previous-test-owner');
          docs['users/' + uid + '/mentalHealthJournal/core'] = {
            ...state,
            years: [],
            drawMonths: [],
          };
          auth.currentUser = { uid, email: uid + '@example.test' };
          observer(auth.currentUser);
        },
      };
    },
    { OWNER },
  );
}

module.exports = {
  test,
  expect,
  DAY,
  LS,
  OWNER,
  sampleState,
  open,
  go,
  saved,
  subtab,
  installAccounts,
};
