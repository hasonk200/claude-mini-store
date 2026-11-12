/* Google authentication lifecycle, independent of the page and journal state. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JournalAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function errorMessage(error) {
    switch (error && error.code) {
      case 'auth/popup-blocked':
        return '瀏覽器擋住咗登入視窗。請允許呢個網站開啟彈出式視窗，再按登入。';
      case 'auth/popup-closed-by-user':
        return '登入視窗已關閉。想繼續時，再按登入就得。';
      case 'auth/cancelled-popup-request':
        return '登入視窗已經開咗，請喺嗰個視窗繼續。';
      case 'auth/network-request-failed':
        return '暫時連唔到 Google。連線恢復後，可以再試。';
      case 'auth/unauthorized-domain':
      case 'auth/operation-not-allowed':
      case 'auth/configuration-not-found':
        return '呢個網站嘅 Google 登入設定未完成。記錄仍然可以留喺呢部裝置。';
      case 'auth/user-disabled':
        return '呢個帳戶暫時用唔到。可以試另一個 Google 帳戶。';
      default:
        return '今次未登入到。請再試一次；如果一直唔得，可以先下載記錄。';
    }
  }
  function createController({
    getFirebase,
    getConfig,
    onUser,
    onDatabase,
    onBusy = () => {},
    onNotice = () => {},
    onUnavailable = () => {},
    onError = () => {},
  }) {
    let auth = null;
    let firebase = null;
    let starting = null;
    let ready = false;
    let busy = false;

    function report(error) {
      onError(error && error.code ? error.code : 'auth/unavailable');
      onNotice(errorMessage(error));
    }
    function setBusy(value) {
      busy = value;
      onBusy(value);
    }
    function start() {
      if (starting) return starting;
      setBusy(true);
      starting = (async () => {
        try {
          firebase = getFirebase();
          const config = getConfig();
          if (!firebase || !config) throw new Error('Firebase scripts unavailable');
          const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
          const candidate = app.auth();
          // A rejected persistence setup must not leave a half-connected login button.
          try {
            await candidate.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
          } catch (error) {
            if (
              !['auth/web-storage-unsupported', 'auth/unsupported-persistence-type'].includes(
                error.code,
              )
            )
              throw error;
            await candidate.setPersistence(firebase.auth.Auth.Persistence.NONE);
            onNotice('呢個瀏覽器暫時記唔住登入。關閉頁面後，下次需要再登入。');
          }
          onDatabase(app.firestore());
          candidate.onAuthStateChanged(onUser, (error) => {
            onUnavailable();
            report(error);
          });
          auth = candidate;
          ready = true;
        } catch (error) {
          auth = null;
          onUnavailable();
          report(error);
        } finally {
          setBusy(false);
        }
      })();
      starting.then(() => {
        if (!ready) starting = null;
      });
      return starting;
    }
    // Keep signInWithPopup in the original click; awaiting initialization can lose user activation.
    function toggle() {
      if (busy) return Promise.resolve();
      if (!ready) {
        start();
        onNotice('正在準備 Google 登入，稍後再按一次就得。');
        return Promise.resolve();
      }
      setBusy(true);
      const signingOut = !!auth.currentUser;
      let operation;
      try {
        if (signingOut) operation = auth.signOut();
        else {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          operation = auth.signInWithPopup(provider);
        }
      } catch (error) {
        operation = Promise.reject(error);
      }
      return Promise.resolve(operation)
        .then(() => {
          if (signingOut) onNotice('已登出，記錄仍然留喺呢個瀏覽器。');
        })
        .catch((error) => {
          if (signingOut) onNotice('未登出到，請再試一次。');
          else report(error);
        })
        .finally(() => setBusy(false));
    }
    return {
      start,
      toggle,
      get currentUser() {
        return auth && auth.currentUser;
      },
    };
  }
  return { createController, errorMessage };
});
