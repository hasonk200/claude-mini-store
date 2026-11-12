const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createController, errorMessage } = require('../js/auth.js');
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function harness() {
  const events = [],
    notices = [],
    errors = [];
  let observer,
    persistenceError,
    popup = deferred();
  const auth = {
    currentUser: null,
    async setPersistence(mode) {
      events.push(['persistence', mode]);
      if (persistenceError) {
        const error = persistenceError;
        persistenceError = null;
        throw error;
      }
    },
    onAuthStateChanged(callback) {
      observer = callback;
      events.push(['observer']);
    },
    signInWithPopup(provider) {
      events.push(['popup', provider.parameters]);
      return popup.promise;
    },
    async signOut() {
      auth.currentUser = null;
      observer(null);
      events.push(['signOut']);
    },
  };
  const app = { auth: () => auth, firestore: () => ({ name: 'database' }) };
  const firebase = {
    apps: [],
    initializeApp() {
      events.push(['init']);
      this.apps.push(app);
      return app;
    },
    app: () => app,
    auth: {
      Auth: { Persistence: { LOCAL: 'local', NONE: 'none' } },
      GoogleAuthProvider: class {
        setCustomParameters(parameters) {
          this.parameters = parameters;
        }
      },
    },
  };
  const controller = createController({
    getFirebase: () => firebase,
    getConfig: () => ({}),
    onDatabase: (db) => events.push(['database', db.name]),
    onUser: (user) => events.push(['user', user && user.uid]),
    onBusy: (value) => events.push(['busy', value]),
    onNotice: (message) => notices.push(message),
    onUnavailable: () => events.push(['unavailable']),
    onError: (code) => errors.push(code),
  });
  return {
    controller,
    auth,
    events,
    notices,
    errors,
    popup,
    failPersistence(code) {
      persistenceError = { code };
    },
    signedIn(user) {
      auth.currentUser = user;
      observer(user);
    },
  };
}
test('startup is shared and registers one observer before accepting clicks', async () => {
  const h = harness();
  const first = h.controller.start();
  assert.equal(h.controller.start(), first);
  await h.controller.toggle();
  assert.equal(h.events.filter((e) => e[0] === 'popup').length, 0);
  await first;
  assert.equal(h.events.filter((e) => e[0] === 'observer').length, 1);
  const pending = h.controller.toggle();
  // Popup starts synchronously in the click, before any await.
  assert.deepEqual(h.events.at(-1), ['popup', { prompt: 'select_account' }]);
  await h.controller.toggle();
  assert.equal(h.events.filter((e) => e[0] === 'popup').length, 1);
  h.popup.resolve();
  await pending;
});
test('blocked or cancelled popups show an explanation without redirecting', async () => {
  for (const code of [
    'auth/popup-blocked',
    'auth/cancelled-popup-request',
    'auth/popup-closed-by-user',
    'auth/network-request-failed',
    'auth/unauthorized-domain',
  ]) {
    const h = harness();
    await h.controller.start();
    const pending = h.controller.toggle();
    h.popup.reject({ code });
    await pending;
    assert.equal(h.notices.at(-1), errorMessage({ code }));
    assert.deepEqual(h.events.at(-1), ['busy', false]);
    assert.deepEqual(h.errors, [code]);
  }
});
test('unsupported local persistence still installs the auth observer using memory', async () => {
  const h = harness();
  h.failPersistence('auth/web-storage-unsupported');
  await h.controller.start();
  assert.deepEqual(
    h.events.filter((e) => e[0] === 'persistence'),
    [
      ['persistence', 'local'],
      ['persistence', 'none'],
    ],
  );
  h.signedIn({ uid: 'alice' });
  assert.equal(h.controller.currentUser.uid, 'alice');
  assert(h.notices.some((message) => message.includes('下次需要再登入')));
});
test('failed startup can retry without a half-initialized auth session', async () => {
  const h = harness();
  h.failPersistence('auth/network-request-failed');
  await h.controller.start();
  assert.equal(h.controller.currentUser, null);
  assert.equal(h.events.filter((e) => e[0] === 'observer').length, 0);
  await h.controller.start();
  assert.equal(h.events.filter((e) => e[0] === 'observer').length, 1);
});
test('sign-in and sign-out changes reach the journal adapter', async () => {
  const h = harness();
  await h.controller.start();
  h.signedIn({ uid: 'alice' });
  await h.controller.toggle();
  assert.equal(h.controller.currentUser, null);
  assert(h.events.some((e) => e[0] === 'user' && e[1] === null));
  assert(h.notices.at(-1).includes('記錄仍然留'));
});
test('missing SDK releases initial journal loading and leaves offline use available', async () => {
  let unavailable = 0;
  const controller = createController({
    getFirebase: () => null,
    getConfig: () => ({}),
    onUnavailable: () => unavailable++,
    onUser() {},
    onDatabase() {},
  });
  await controller.start();
  assert.equal(unavailable, 1);
  assert.equal(controller.currentUser, null);
});
