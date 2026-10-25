/* Local persistence and account synchronization; I/O and UI callbacks are injected. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./core.js'), require('./sync.js'));
  else root.JournalStorage = factory(root.JournalCore, root.JournalSync);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (JournalCore, JournalSync) {
  'use strict';
  const LS = 'dicky-care-v1';
  const CLOUD_UID_KEY = 'dicky-care-firebase-uid-v1';
  function createStore({
    storage,
    defaults,
    normalize,
    getDatabase,
    onChange = () => {},
    onStatus = () => {},
    onStorage = () => {},
    onSettled = () => {},
    onPersist = () => {},
    schedule = setTimeout,
    cancel = clearTimeout,
  }) {
    let unreadableLocal = false,
      pendingLocalRaw = null;
    function readLocalState(raw) {
      const result = JournalCore.readLocal(raw);
      unreadableLocal = result.repaired;
      pendingLocalRaw = result.repaired ? raw : null;
      if (result.repaired && result.data) delete result.data._recoveryNoticeDismissed;
      return result.data ? normalize(result.data) : defaults();
    }
    function loadLocal() {
      try {
        return readLocalState(storage.getItem(LS));
      } catch (e) {
        unreadableLocal = true;
        return normalize({ _localRecovery: true });
      }
    }

    let state = loadLocal();

    /* ---------- storage: local-first + authenticated Google Firebase ---------- */
    let sessionEpoch = 0,
      cloudInitPending = true;

    let cloud = null; // References belonging to one authenticated account.
    const dirty = { core: false, years: new Set(), months: new Set() };
    let flushTimer = null,
      flushing = false;
    let storageOK = true;
    function saveLocal() {
      try {
        if (unreadableLocal) {
          const raw = pendingLocalRaw == null ? storage.getItem(LS) : pendingLocalRaw;
          if (raw != null) storage.setItem(LS + '-unreadable-backup', raw);
          unreadableLocal = false;
          pendingLocalRaw = null;
        }
        storage.setItem(LS, JSON.stringify(state));
        storageOK = true;
      } catch (e) {
        storageOK = false;
      }
      onStorage(storageOK);
      return storageOK;
    }
    function coreBody() {
      const body = Object.fromEntries(JournalCore.CORE_FIELDS.map((key) => [key, state[key]]));
      body.years = [...new Set(Object.keys(state.checkins).map((date) => date.slice(0, 4)))];
      body.drawMonths = [...new Set(Object.keys(state.draws).map((date) => date.slice(0, 7)))];
      return body;
    }
    function monthBody(month) {
      const entries = {};
      for (const [date, entry] of Object.entries(state.draws))
        if (date.slice(0, 7) === month) entries[date] = entry;
      return { entries };
    }
    function yearBody(year) {
      const entries = {};
      for (const [date, entry] of Object.entries(state.checkins))
        if (date.slice(0, 4) === year) entries[date] = entry;
      return { entries };
    }
    function persist(opts) {
      state.t = Date.now();
      saveLocal();
      if (opts && opts.year) dirty.years.add(opts.year);
      if (opts && opts.month) dirty.months.add(opts.month);
      if (!opts || opts.core !== false) dirty.core = true;
      if (cloud) {
        cancel(flushTimer);
        flushTimer = schedule(flush, 700);
      }
      onPersist();
    }
    async function flush() {
      if (!cloud || flushing || state._localRecovery) return;
      const session = cloud,
        epoch = sessionEpoch;
      flushing = true;
      const current = () => cloud === session && epoch === sessionEpoch;
      try {
        await JournalSync.drain({
          session,
          isCurrent: current,
          dirty,
          monthBody,
          yearBody,
          coreBody,
        });
        if (current())
          onStatus(
            true,
            storageOK ? '記錄已同步。' : '雲端已儲存，呢部裝置暫時存唔到。可以先下載一份記錄。',
          );
      } catch (e) {
        if (current()) {
          onStatus(
            false,
            storageOK
              ? '暫時同步唔到。記錄已留喺呢部裝置，連線後會再試。'
              : '今次未儲存到。請先下載一份記錄，再離開頁面。',
          );
          dirty.core = true;
          Object.keys(state.checkins).forEach((k) => dirty.years.add(k.slice(0, 4)));
          Object.keys(state.draws || {}).forEach((k) => dirty.months.add(k.slice(0, 7)));
        }
      } finally {
        flushing = false;
        if (!current() && cloud && (dirty.core || dirty.years.size || dirty.months.size))
          schedule(flush, 0);
      }
    }
    async function loadCloudFor(user) {
      const loadEpoch = ++sessionEpoch;
      cloud = null;
      cloudInitPending = true;
      onStatus(false, '正在載入你嘅手帳…');
      try {
        const previous = storage.getItem(CLOUD_UID_KEY);
        const accountChanged = previous && previous !== user.uid;
        if (accountChanged) {
          // Keep previous account's data offline, never upload it to a different account.
          if (!saveLocal()) throw new Error('Cannot preserve previous account data');
          storage.setItem(LS + '-account-' + previous, JSON.stringify(state));
          const own = storage.getItem(LS + '-account-' + user.uid);
          state = readLocalState(own);
          saveLocal();
          dirty.core = false;
          dirty.years.clear();
          dirty.months.clear();
        }
        storage.setItem(CLOUD_UID_KEY, user.uid);
        // Drafts are scoped by this key. Set the new owner before any screen restores them,
        // including when the following server read fails and there is no second redraw.
        if (accountChanged) onChange(state);
        const base = 'users/' + user.uid + '/mentalHealthJournal';
        const session = {
          core: getDatabase().doc(base + '/core'),
          year: (y) => getDatabase().doc(base + '/ci-' + y),
          month: (m) => getDatabase().doc(base + '/dr-' + m),
        };
        // A cached "missing" document is not proof that the server has no data.
        // Recovery remains quarantined offline, including after a page reload.
        const coreSnapshot = await session.core.get({ source: 'server' });
        if (loadEpoch !== sessionEpoch) return;
        if (coreSnapshot.exists) {
          const remote = coreSnapshot.data() || {};
          const merged = normalize(JSON.parse(JSON.stringify(remote)));

          merged.checkins = {};
          for (const y of remote.years || []) {
            const yearSnapshot = await session.year(y).get({ source: 'server' });
            if (loadEpoch !== sessionEpoch) return;
            if (!yearSnapshot.exists) throw new Error('Missing cloud check-in partition');
            Object.assign(
              merged.checkins,
              JSON.parse(JSON.stringify(yearSnapshot.data().entries || {})),
            );
          }

          merged.draws = {};
          for (const m of remote.drawMonths || []) {
            const monthSnapshot = await session.month(m).get({ source: 'server' });
            if (loadEpoch !== sessionEpoch) return;
            if (!monthSnapshot.exists) throw new Error('Missing cloud draw partition');
            Object.assign(
              merged.draws,
              JSON.parse(JSON.stringify(monthSnapshot.data().entries || {})),
            );
          }
          const localCheckins = state.checkins || {},
            localDraws = state.draws || {};
          const newerMonths = new Set(),
            newerYears = new Set();
          Object.keys(localDraws).forEach((k) => {
            const currentEntry = merged.draws[k];
            if (!currentEntry || (localDraws[k].t || 0) > (currentEntry.t || 0)) {
              merged.draws[k] = localDraws[k];
              newerMonths.add(k.slice(0, 7));
            }
          });
          Object.keys(localCheckins).forEach((k) => {
            const currentEntry = merged.checkins[k];
            if (!currentEntry || (localCheckins[k].t || 0) > (currentEntry.t || 0)) {
              merged.checkins[k] = localCheckins[k];
              newerYears.add(k.slice(0, 4));
            }
          });
          const recovering = !!state._localRecovery;
          const localCoreNewer = JournalCore.localCoreMayReplace(state, remote);
          if (recovering) {
            // Save all offline core edits before restoring the authoritative core.
            // If preserving this copy fails, leave recovery pending and do not sync.
            if (!saveLocal()) throw new Error('Cannot preserve local recovery data');
            storage.setItem(LS + '-recovery-edits', JSON.stringify(state));
            dirty.core = false;
            dirty.years.clear();
            dirty.months.clear();
          }
          if (localCoreNewer) {
            try {
              storage.setItem(LS + '-remote-backup-' + user.uid, JSON.stringify(remote));
            } catch (e) {}
            JournalCore.CORE_FIELDS.forEach((key) => (merged[key] = state[key]));
          }
          if (state._recoveryNoticeDismissed) merged._recoveryNoticeDismissed = true;
          else delete merged._recoveryNoticeDismissed;
          delete merged._localRecovery;
          state = merged;
          saveLocal();
          onChange(state);
          newerYears.forEach((y) => dirty.years.add(y));
          newerMonths.forEach((m) => dirty.months.add(m));
          if (localCoreNewer || newerYears.size || newerMonths.size) dirty.core = true;
        } else {
          // Only a successful server read may release a new account from recovery.
          if (state._localRecovery) {
            if (!saveLocal()) throw new Error('Cannot preserve local recovery data');
            delete state._localRecovery;
            saveLocal();
          }
          Object.keys(state.checkins || {}).forEach((k) => dirty.years.add(k.slice(0, 4)));
          Object.keys(state.draws || {}).forEach((k) => dirty.months.add(k.slice(0, 7)));
          dirty.core = true;
        }
        if (loadEpoch !== sessionEpoch) return;
        cloud = session;
        if (dirty.core || dirty.months.size || dirty.years.size) {
          onStatus(false, '登入咗，正在同步記錄…');
          await flush();
        } else onStatus(true, '記錄已更新。');
        cloudInitPending = false;
        onSettled();
      } catch (e) {
        if (loadEpoch !== sessionEpoch) return;
        cloud = null;
        cloudInitPending = false;
        onSettled();
        onStatus(false, '暫時連唔到雲端。可以繼續記低，連線後再試。');
      }
    }

    function recoveryStatus() {
      const original = unreadableLocal || !!getBackup('original');
      const edits = !!getBackup('edits');
      return {
        original,
        edits,
        recovering: !!state._localRecovery,
        visible: !state._recoveryNoticeDismissed && !!(state._localRecovery || original || edits),
      };
    }
    function dismissRecoveryNotice() {
      const previous = state._recoveryNoticeDismissed;
      state._recoveryNoticeDismissed = true;
      if (saveLocal()) return true;
      if (previous === undefined) delete state._recoveryNoticeDismissed;
      else state._recoveryNoticeDismissed = previous;
      return false;
    }
    function getBackup(kind) {
      try {
        if (kind === 'original')
          return (
            pendingLocalRaw ||
            storage.getItem(LS + '-unreadable-backup') ||
            (unreadableLocal ? storage.getItem(LS) : null)
          );
        if (kind === 'edits') return storage.getItem(LS + '-recovery-edits');
        if (kind === 'previous') return storage.getItem(LS + '-before-import');
      } catch (e) {}
      return null;
    }
    function replaceState(next) {
      const periods = JournalCore.backupPeriods(state, next);
      if (state._localRecovery) next._localRecovery = true;
      if (state._recoveryNoticeDismissed) next._recoveryNoticeDismissed = true;
      else delete next._recoveryNoticeDismissed;
      state = next;
      periods.years.forEach((year) => dirty.years.add(year));
      periods.months.forEach((month) => dirty.months.add(month));
      persist();
      onChange(state);
    }
    function restoreBackup(next) {
      if (flushing || cloudInitPending) return false;
      try {
        storage.setItem(LS + '-before-import', JSON.stringify(state));
      } catch (e) {
        return false;
      }
      replaceState(next);
      return true;
    }
    function clear() {
      if (flushing || cloudInitPending) return false;
      replaceState(defaults());
      return true;
    }
    function reconnect(user) {
      if (cloud && (dirty.core || dirty.years.size || dirty.months.size)) return flush();
      if (user && !cloud) return loadCloudFor(user);
    }
    function setInitialLoadPending(pending) {
      cloudInitPending = pending;
      if (!pending) onSettled();
    }
    function disconnect() {
      sessionEpoch++;
      cloud = null;
      setInitialLoadPending(false);
    }
    return {
      get state() {
        return state;
      },
      get epoch() {
        return sessionEpoch;
      },
      get storageOK() {
        return storageOK;
      },
      get initialLoadPending() {
        return cloudInitPending;
      },
      get busy() {
        return flushing || cloudInitPending;
      },
      get unreadableLocal() {
        return unreadableLocal;
      },
      saveLocal,
      persist,
      flush,
      loadCloudFor,
      reconnect,
      disconnect,
      setInitialLoadPending,
      recoveryStatus,
      dismissRecoveryNotice,
      getBackup,
      restoreBackup,
      clear,
    };
  }
  return { STORAGE_KEY: LS, CLOUD_UID_KEY, createStore };
});
