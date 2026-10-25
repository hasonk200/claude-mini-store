import { defaults, normalize } from './defaults.mjs';

// Imports keep a live binding when cloud loading or backup restore replaces the state.
let state, journalStore;
function initializeState({ getDatabase, onChange, onReplace, onStatus, onStorage, onSettled }) {
  journalStore = window.JournalStorage.createStore({
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    defaults,
    normalize,
    getDatabase,
    onChange(next) {
      if (state !== next) onReplace();
      state = next;
      onChange();
    },
    onStatus,
    onStorage,
    onSettled,
    onPersist: onSettled,
  });
  state = journalStore.state;
}
function persist(options) {
  journalStore.persist(options);
}

export { journalStore, state, persist, initializeState };
