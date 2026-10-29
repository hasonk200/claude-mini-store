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
    rests: [],
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
  for (const k of ['jobs', 'shifts', 'sessions', 'journeys', 'meals', 'sleeps', 'rests', 'dayMarks', 'templates']) {
    out[k] = Array.isArray(out[k]) ? out[k] : [];
  }
  out.settings = { ...base.settings, ...(raw?.settings || {}) };
  return out;
}

export const RECORD_KEYS = ['jobs', 'shifts', 'sessions', 'journeys', 'meals', 'sleeps', 'rests', 'dayMarks', 'templates'];
export const keyOf = (x) => x.id ?? x.date;
const TOMBSTONE_DAYS = 30;

// 畫面和計算用的「可見資料」：濾走已刪除（deletedAt）的紀錄。
export function visible(full) {
  const out = { ...full };
  for (const k of RECORD_KEYS) out[k] = (full[k] || []).filter((x) => !x.deletedAt);
  return out;
}

let persisted = null;

export async function load() {
  try {
    db = await openDB();
    const saved = await idbGet(KEY);
    if (saved) setRaw(normalize(saved));
  } catch (e) {
    saveError = '這個瀏覽器不能使用本機儲存，關閉頁面後紀錄會消失';
  }
  // 申請持久化儲存，避免手機空間不足時被瀏覽器自動清除。
  try {
    if (navigator.storage?.persist) {
      persisted = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
    }
  } catch { persisted = null; }
  return view;
}

let view = visible(data);
function setRaw(next) {
  data = next;
  view = visible(data);
}

export const get = () => view;
export const getRaw = () => data;
export const status = () => ({ lastSaved, saveError, persistent: !!db, persisted });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(view);
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

// 比較修改前後：新增或改過的紀錄蓋上 updatedAt；被移除的紀錄改成刪除標記（deletedAt），方便各裝置逐筆合併。
export function stamp(prevFull, nextVisible, now = Date.now()) {
  const out = { ...nextVisible };
  for (const k of RECORD_KEYS) {
    const before = new Map((prevFull[k] || []).map((x) => [keyOf(x), x]));
    const kept = new Set();
    const list = (nextVisible[k] || []).map((x) => {
      const key = keyOf(x);
      kept.add(key);
      const old = before.get(key);
      if (old && !old.deletedAt && JSON.stringify({ ...old, updatedAt: 0 }) === JSON.stringify({ ...x, updatedAt: 0 })) return old;
      // 匯入備份時，備份裡本來就標了「已刪除」的紀錄要維持已刪除，不能被當成新增而復活。
      if (x.deletedAt) return old && old.deletedAt ? old : { ...x, photo: undefined, updatedAt: now };
      return { ...x, updatedAt: now, deletedAt: undefined };
    });
    for (const [key, old] of before) {
      if (kept.has(key)) continue;
      if (old.deletedAt) list.push(old);
      else list.push({ ...old, photo: undefined, deletedAt: now, updatedAt: now });
    }
    out[k] = list.map((x) => { const y = { ...x }; if (y.deletedAt === undefined) delete y.deletedAt; if (y.photo === undefined && 'photo' in y && y.deletedAt) delete y.photo; return y; });
  }
  if (JSON.stringify({ ...prevFull.settings, updatedAt: 0 }) !== JSON.stringify({ ...nextVisible.settings, updatedAt: 0 })) {
    out.settings = { ...nextVisible.settings, updatedAt: now };
  }
  return out;
}

// 清掉 30 天前的刪除標記。
export function purge(full, now = Date.now()) {
  const out = { ...full };
  for (const k of RECORD_KEYS) out[k] = (full[k] || []).filter((x) => !x.deletedAt || now - x.deletedAt < TOMBSTONE_DAYS * 86400000);
  return out;
}

// mutator 修改「可見資料」的草稿；完成後自動蓋時間戳、保存並通知畫面。
let previous = null;
let stampedAt = 0;

export function update(mutator) {
  previous = data;
  const draft = structuredClone(view);
  mutator(draft);
  stampedAt = Date.now();
  setRaw(stamp(data, draft, stampedAt));
  scheduleSave();
  emit();
}

// 復原上一步（只保留一步）。
// 復原本身也是一次新的修改：剛新增的紀錄得到刪除標記、被刪或被改的紀錄以新的時間戳還原，
// 這樣雲端合併時不會把已復原的東西再帶回來。時間戳一定晚於被復原的那一次修改。
export function undo(now = Date.now()) {
  if (!previous) return false;
  setRaw(stamp(data, visible(previous), Math.max(now, stampedAt + 1)));
  previous = null;
  scheduleSave();
  emit();
  return true;
}

// 取代整份資料（匯入、雲端合併後）；傳入的是包含刪除標記的完整資料。
// 整份取代。預設會替「被移除的紀錄」留下刪除標記，
// 否則雲端同步時會把它們從雲端再合併回來（取代等於沒發生）。
export function replaceAll(next, { tombstone = true } = {}) {
  previous = null;
  const clean = normalize(next);
  setRaw(tombstone ? stamp(data, clean) : clean);
  scheduleSave();
  emit();
}

export async function flush() {
  clearTimeout(saveTimer);
  if (db) await idbPut(KEY, data);
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
