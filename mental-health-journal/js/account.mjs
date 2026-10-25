import { $ } from './shared/dom.mjs';
import { journalStore } from './state.mjs';
import { toast } from './shared/controls.mjs';

let fbDb = null;

let fbUser = null;

let authBusy = false;

function setSync(on, msg) {
  $('#sync').classList.toggle('on', !!on);
  $('#sync-txt').textContent = msg;
  const status = $('#google-status');
  if (status) status.textContent = msg;
  const btn = $('#google-login');
  if (btn) {
    btn.disabled = authBusy;
    btn.textContent = authBusy ? '請稍候…' : fbUser ? '登出 Google' : '使用 Google 登入';
  }
  const mail = $('#google-email');
  if (mail) mail.textContent = fbUser ? fbUser.email || '已登入' : '未登入';
}

function renderRecoveryStatus() {
  const status = journalStore.recoveryStatus();
  $('#recovery-warning').hidden = !status.visible;
  $('#recovery-message').textContent = status.recovering
    ? '有啲記錄暫時開唔到。可以先到設定下載備份，留返一份喺自己手上。'
    : '之前嘅記錄有另外留底，需要時可以到設定下載。';
  $('#bk-recovery').hidden = !status.original;
  $('#bk-recovery-edits').hidden = !status.edits;
}

function dismissRecoveryNotice() {
  const saved = journalStore.dismissRecoveryNotice();
  renderRecoveryStatus();
  toast(saved ? '提示已收起，備份仍然可以喺設定下載。' : '暫時記唔低呢個選擇，請稍後再試。');
}

let googleLogin;

function storageStatus(ok) {
  $('#storage-warning').hidden = ok;
  renderRecoveryStatus();
}

function initializeAccount() {
  googleLogin = window.JournalAuth.createController({
    getFirebase: () => window.firebase,
    getConfig: () => window.FIREBASE_CONFIG,
    onDatabase: (database) => {
      fbDb = database;
    },
    onUser: (user) => {
      fbUser = user || null;
      if (user) journalStore.loadCloudFor(user);
      else {
        journalStore.disconnect();
        setSync(false, '未登入，記錄留喺呢個瀏覽器。');
      }
    },
    onBusy: (busy) => {
      authBusy = busy;
      const button = $('#google-login');
      button.disabled = busy;
      button.textContent = busy ? '請稍候…' : fbUser ? '登出 Google' : '使用 Google 登入';
    },
    onNotice: (message) => {
      setSync(false, message);
      toast(message);
    },
    onUnavailable: () => journalStore.setInitialLoadPending(false),
    onError: (code) => console.warn('Google sign-in:', code),
  });
  $('#google-login').addEventListener('click', () => googleLogin.toggle());
  window.addEventListener('online', () => {
    journalStore.reconnect(googleLogin.currentUser);
  });
}

export {
  renderRecoveryStatus,
  dismissRecoveryNotice,
  fbDb,
  setSync,
  storageStatus,
  initializeAccount,
  googleLogin,
};
