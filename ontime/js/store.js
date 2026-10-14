// 資料層：先寫入本機 IndexedDB；所有修改都經過 update()，畫面再按最新資料重畫。
const DB_NAME = 'ontime';
const STORE = 'kv';
const KEY = 'data-v1';

export function emptyData() {
  return {
    version: 1,
    jobs: [],
    shifts: [],
    sessions: [],
    journeys: [],
    meals: [],
    sleeps: [],
    dayMarks: [],
    templates: [],
    settings: { name: '', commuteOutMin: 45, commuteBackMin: 45, theme: 'auto' }
  };
}

let data = emptyData();
const listeners = new Set();
let db = null;
let saveTimer = null;
let lastSaved = null;
let saveError = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('no-idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function idbPut(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function normalize(raw) {
  const base = emptyData();
  const out = { ...base, ...(raw || {}) };
  for (const k of ['jobs', 'shifts', 'sessions', 'journeys', 'meals', 'sleeps', 'dayMarks', 'templates']) {
    out[k] = Array.isArray(out[k]) ? out[k] : [];
  }
  out.settings = { ...base.settings, ...(raw?.settings || {}) };
  return out;
}

export async function load() {
  try {
    db = await openDB();
    const saved = await idbGet(KEY);
    if (saved) data = normalize(saved);
  } catch (e) {
    saveError = '這個瀏覽器不能使用本機儲存，關閉頁面後紀錄會消失';
  }
  return data;
}

export const get = () => data;
export const status = () => ({ lastSaved, saveError, persistent: !!db });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(data);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!db) return;
    try {
      await idbPut(KEY, data);
      lastSaved = Date.now();
      saveError = null;
    } catch (e) {
      saveError = '儲存失敗：裝置空間可能不足';
    }
    emit();
  }, 150);
}

// mutator 直接修改傳入的草稿；完成後保存並通知畫面。
export function update(mutator) {
  const draft = structuredClone(data);
  mutator(draft);
  data = draft;
  scheduleSave();
  emit();
}

export function replaceAll(next) {
  data = normalize(next);
  scheduleSave();
  emit();
}

export async function flush() {
  clearTimeout(saveTimer);
  if (db) await idbPut(KEY, data);
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
