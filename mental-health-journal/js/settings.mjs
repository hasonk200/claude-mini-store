import { renderRecoveryStatus, dismissRecoveryNotice } from './account.mjs';
import { $ } from './shared/dom.mjs';
import { state, persist, journalStore } from './state.mjs';
import { segSet, segGet, toast } from './shared/controls.mjs';
import { applyTheme } from './shared/preferences.mjs';
import { updBuddy } from './pet/buddy.mjs';
import { keyOf } from './shared/dates.mjs';
import { downloadJSON } from './shared/downloads.mjs';
import { DECK } from './data/cards.mjs';
import { normalize } from './defaults.mjs';
import { stopGame, cancelTrip } from './pet/outings.mjs';
import { stopHaven } from './games/haven.mjs';
import { clearOwnerDrafts } from './shared/drafts.mjs';
import { clearMemorySession } from './games/memory.mjs';
import { go, PAGES } from './navigation.mjs';

function renderSettings() {
  renderRecoveryStatus();
  $('#set-a').value = state.settings.a;
  $('#set-b').value = state.settings.b;
  segSet('theme', state.settings.theme);
  segSet('buddy', state.settings.buddy === false ? 'off' : 'on');
}

let pendingImport = null;

let clearArmed = false;

function initializeSettings({ renderAll }) {
  $('#set-save').addEventListener('click', () => {
    state.settings.a = $('#set-a').value || '09:00';
    state.settings.b = $('#set-b').value || '16:30';
    state.settings.theme = segGet('theme') || 'auto';
    state.settings.buddy = segGet('buddy') !== 'off';
    applyTheme();
    updBuddy();
    persist();
    toast('設定儲存咗');
  });
  $('#bk-export').addEventListener('click', async () => {
    const data = JSON.stringify(state, null, 2);
    const name = 'dicky-心晴手帳-備份-' + keyOf(new Date()) + '.json';
    downloadJSON(data, name);
    toast('備份開始下載喇。');
  });
  $('#bk-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast('呢個檔案太大，暫時只可以開 10 MB 以內嘅備份。');
      return;
    }
    const r = new FileReader();
    r.onerror = () => toast('讀唔到呢份備份，請再揀一次檔案。');
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        window.JournalCore.validateBackup(
          d,
          DECK.map((c) => c.id),
        );
        pendingImport = normalize(d);
        $('#import-summary').textContent =
          '備份包含 ' +
          Object.keys(d.checkins).length +
          ' 日打卡、' +
          Object.keys(d.draws || {}).length +
          ' 晚抽卡' +
          (d.pet ? '，以及寵物「' + d.pet.name + '」。' : '。');
        $('#import-dialog').showModal();
      } catch (err) {
        pendingImport = null;
        toast('讀唔到呢份備份。請揀返由手帳下載嘅備份檔案。');
      }
    };
    r.readAsText(f);
  });
  $('#import-cancel').addEventListener('click', () => {
    pendingImport = null;
    $('#import-dialog').close();
  });
  $('#import-dialog').addEventListener('cancel', () => {
    pendingImport = null;
  });
  $('#import-confirm').addEventListener('click', () => {
    if (!pendingImport) return;
    if (journalStore.busy) {
      toast('記錄仲同步緊，完成後就可以還原。');
      return;
    }
    if (!journalStore.restoreBackup(pendingImport)) {
      toast('暫時存唔到現有記錄，今次先唔還原。請下載一份備份，再試一次。');
      return;
    }
    stopGame();
    cancelTrip();
    stopHaven();
    clearOwnerDrafts();
    pendingImport = null;
    clearMemorySession();
    $('#import-dialog').close();
    renderAll();
    go(PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'island');
    toast(
      journalStore.storageOK
        ? '備份已還原。之前嘅記錄亦有留底。'
        : '今次未儲存到，請先下載一份記錄。',
    );
  });
  $('#bk-clear').addEventListener('click', () => {
    if (journalStore.busy) {
      toast('記錄仲同步緊，完成後就可以清除。');
      return;
    }
    if (!clearArmed) {
      clearArmed = true;
      $('#bk-clear').textContent = '再撳一次清除全部記錄';
      setTimeout(() => {
        clearArmed = false;
        $('#bk-clear').textContent = '清除所有資料';
      }, 5000);
      return;
    }
    clearArmed = false;
    $('#bk-clear').textContent = '清除所有資料';
    stopGame();
    cancelTrip();
    stopHaven();
    clearOwnerDrafts();
    clearMemorySession();
    journalStore.clear();
    renderAll();
    go('island');
    toast('清除咗');
  });
  $('#bk-previous').addEventListener('click', () => {
    const raw = journalStore.getBackup('previous');
    if (!raw) {
      toast('仲未有還原前嘅記錄可以下載。');
      return;
    }
    downloadJSON(raw, 'dicky-care-before-import.json');
  });
  $('#bk-recovery').addEventListener('click', () => {
    const raw = journalStore.getBackup('original');
    if (!raw) {
      toast('暫時冇另外留底嘅記錄。');
      return;
    }
    downloadJSON(raw, 'dicky-care-original-recovery.json');
  });
  $('#bk-recovery-edits').addEventListener('click', () => {
    const raw = journalStore.getBackup('edits');
    if (!raw) {
      toast('暫時冇未同步嘅修改可以下載。');
      return;
    }
    downloadJSON(raw, 'dicky-care-offline-edits-recovery.json');
  });
  $('#recovery-dismiss').addEventListener('click', dismissRecoveryNotice);
}

export { renderSettings, initializeSettings };
