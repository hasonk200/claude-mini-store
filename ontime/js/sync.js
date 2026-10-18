// 雲端同步：用 Google 登入 Firebase，把資料存到 Firestore 的 users/{uid}/apps/ontime。
// 本機 IndexedDB 仍然是主要儲存；雲端是同一帳戶在不同裝置之間的副本。
// 相片另外存成 users/{uid}/apps/ontime-photo-{mealId}，避免主文件超過 Firestore 1 MB 上限。
import * as store from './store.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyC5oYfE0rMpPkibjV4Rcmh6qQbO4cUfw10',
  authDomain: 'dicky-quota-tracker-2026.firebaseapp.com',
  projectId: 'dicky-quota-tracker-2026',
  storageBucket: 'dicky-quota-tracker-2026.firebasestorage.app',
  messagingSenderId: '842127145324',
  appId: '1:842127145324:web:9fa42fb22d04a9d9c59b49'
};
const SDK = '12.19.0';
const FLAG = 'ontime-sync-on';

let fb = null;
let auth = null;
let db = null;
let user = null;
let unsub = null;
let pushTimer = null;
let applyingRemote = false;
let lastPushed = '';
let pushing = false;
let pushAgain = false;
const uploadedPhotos = new Map();
const listeners = new Set();
const state = { status: 'off', user: null, lastSync: null, message: '' };

export const syncState = () => state;
export function onSync(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(patch) { Object.assign(state, patch); for (const fn of listeners) fn(state); }

// 逐筆合併兩份資料：同一筆紀錄取 updatedAt 較新的一份（一樣新時以 primary 為準）；
// 只在一邊有的紀錄都保留；刪除標記也會合併，所以刪除在各裝置都生效。
export function mergeData(primary, secondary) {
  const out = structuredClone(primary);
  for (const k of store.RECORD_KEYS) {
    const map = new Map((out[k] || []).map((x) => [store.keyOf(x), x]));
    for (const x of secondary[k] || []) {
      const key = store.keyOf(x);
      const cur = map.get(key);
      if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) {
        // 保留本機已有的相片，避免雲端版本（沒有相片）把它清走
        const keep = cur && cur.photo && !x.photo && !x.deletedAt ? { ...x, photo: cur.photo } : x;
        map.set(key, structuredClone(keep));
      }
    }
    out[k] = [...map.values()];
  }
  if ((secondary.settings?.updatedAt || 0) > (out.settings?.updatedAt || 0)) out.settings = { ...secondary.settings };
  return store.purge(out);
}

// 上傳前移除相片，只留下「有相片」的標記。
export function stripPhotos(data) {
  const out = structuredClone(data);
  for (const m of out.meals) {
    if (m.photo) { m.hasPhoto = true; m.photo = null; } else m.hasPhoto = false;
  }
  return out;
}

// 套用雲端資料時，把本機已有的相片放回去。
function withLocalPhotos(remote, local) {
  const photos = new Map(local.meals.filter((m) => m.photo).map((m) => [m.id, m.photo]));
  for (const m of remote.meals) if (!m.photo && photos.has(m.id)) m.photo = photos.get(m.id);
  return remote;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('load'));
    document.head.appendChild(s);
  });
}

async function ensureFirebase() {
  if (fb) return;
  const base = `https://www.gstatic.com/firebasejs/${SDK}`;
  await loadScript(`${base}/firebase-app-compat.js`);
  await loadScript(`${base}/firebase-auth-compat.js`);
  await loadScript(`${base}/firebase-firestore-compat.js`);
  fb = window.firebase;
  const app = fb.apps.find((a) => a.name === 'ontime') || fb.initializeApp(FIREBASE_CONFIG, 'ontime');
  auth = app.auth();
  db = app.firestore();
  await auth.setPersistence(fb.auth.Auth.Persistence.LOCAL);
  auth.onAuthStateChanged(onUser);
}

const mainDoc = () => db.collection('users').doc(user.uid).collection('apps').doc('ontime');
const photoDoc = (id) => db.collection('users').doc(user.uid).collection('apps').doc(`ontime-photo-${id}`);

function parseRemote(snap) {
  const body = snap.data() || {};
  try { return store.normalize(JSON.parse(body.json)); } catch { return null; }
}

function applyRemote(remote) {
  const local = store.getRaw();
  const next = withLocalPhotos(mergeData(local, remote), local);
  if (JSON.stringify(stripPhotos(next)) === JSON.stringify(stripPhotos(local))) return;
  applyingRemote = true;
  store.replaceAll(next, { tombstone: false });
  applyingRemote = false;
  fetchMissingPhotos(next);
}

async function fetchMissingPhotos(data) {
  for (const m of data.meals) {
    if (!m.hasPhoto || m.photo || !user) continue;
    try {
      const snap = await photoDoc(m.id).get();
      const photo = snap.exists ? snap.data().data : null;
      if (!photo) continue;
      uploadedPhotos.set(m.id, photo.length);
      applyingRemote = true;
      store.replaceAll({ ...store.getRaw(), meals: store.getRaw().meals.map((y) => (y.id === m.id && !y.photo ? { ...y, photo } : y)) }, { tombstone: false });
      applyingRemote = false;
    } catch { /* 相片讀不到時，保留其他資料 */ }
  }
}

async function onUser(u) {
  user = u || null;
  if (unsub) { unsub(); unsub = null; }
  if (!user) {
    set({ status: 'signin', user: null });
    return;
  }
  set({ status: 'loading', user: { name: user.displayName || '', email: user.email || '' } });
  try {
    const ref = mainDoc();
    const snap = await ref.get();
    if (snap.exists) {
      const remote = parseRemote(snap);
      if (remote) {
        // 第一次在這部裝置登入：雲端為準，再加入只存在本機的紀錄。
        applyRemote(remote);
      }
    }
    await push(true);
    unsub = ref.onSnapshot((s) => {
      if (!s.exists || s.metadata.hasPendingWrites) return;
      const body = s.data() || {};
      if (body.json === lastPushed) return;
      const remote = parseRemote(s);
      if (remote) {
        applyRemote(remote);
        set({ status: 'cloud', lastSync: Date.now() });
        // 雲端少了本機較新的紀錄時，把合併結果寫回去
        if (JSON.stringify(stripPhotos(store.getRaw())) !== JSON.stringify(stripPhotos(remote))) push();
      }
    }, () => set({ status: 'error', message: '暫時連不上雲端' }));
  } catch (e) {
    set({ status: 'error', message: e?.code === 'permission-denied' ? '雲端拒絕存取，請確認 Firestore 規則' : '暫時連不上雲端' });
  }
}

async function uploadPhotos(data) {
  for (const m of data.meals) {
    if (!m.photo) continue;
    if (uploadedPhotos.get(m.id) === m.photo.length) continue;
    try {
      await photoDoc(m.id).set({ data: m.photo, updatedAt: fb.firestore.FieldValue.serverTimestamp() });
      uploadedPhotos.set(m.id, m.photo.length);
    } catch { /* 相片上傳失敗不影響主要資料 */ }
  }
}

async function push(force = false) {
  if (!user || !db) return;
  if (pushing) { pushAgain = true; return; }
  const data = store.getRaw();
  if (!force && JSON.stringify(stripPhotos(data)) === lastPushed) return;
  pushing = true;
  try {
    // 交易：先讀雲端最新版本，逐筆合併後才寫回，另一部裝置剛寫入的紀錄不會被蓋掉。
    const ref = mainDoc();
    let merged = data;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const remote = snap.exists ? parseRemote(snap) : null;
      merged = remote ? mergeData(store.getRaw(), remote) : store.purge(store.getRaw());
      const json = JSON.stringify(stripPhotos(merged));
      if (json.length > 950000) throw Object.assign(new Error('full'), { code: 'full' });
      lastPushed = json;
      tx.set(ref, { json, app: 'ONTIME', updatedAt: fb.firestore.FieldValue.serverTimestamp() });
    });
    if (JSON.stringify(stripPhotos(merged)) !== JSON.stringify(stripPhotos(store.getRaw()))) applyRemote(merged);
    set({ status: 'cloud', lastSync: Date.now(), message: '' });
    uploadPhotos(data);
  } catch (e) {
    lastPushed = '';
    if (e?.code === 'full') { set({ status: 'full', message: '雲端空間不足：請匯出備份，再刪除舊紀錄' }); return; }
    set({ status: navigator.onLine ? 'error' : 'offline', message: navigator.onLine ? '同步失敗，稍後會再試' : '離線中，連線後會自動上傳' });
  } finally {
    pushing = false;
    if (pushAgain) { pushAgain = false; push(); }
  }
}

export async function signIn() {
  try {
    set({ status: 'loading' });
    await ensureFirebase();
    localStorage.setItem(FLAG, '1');
    const provider = new fb.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-environment'].includes(e?.code)) {
        await auth.signInWithRedirect(provider);
      } else if (e?.code === 'auth/popup-closed-by-user') {
        set({ status: user ? 'cloud' : 'signin' });
      } else throw e;
    }
  } catch (e) {
    set({ status: 'error', message: e?.message === 'load' ? '連不上 Google 伺服器，請檢查網絡後再試' : e?.code === 'auth/unauthorized-domain' ? '這個網址還沒加入 Firebase 的授權網域' : '登入失敗，請再試' });
  }
}

export async function signOut() {
  try { await auth?.signOut(); } catch { /* 忽略 */ }
  try { localStorage.removeItem(FLAG); } catch { /* 忽略 */ }
  lastPushed = '';
  set({ status: 'off', user: null });
}

export function initSync() {
  store.subscribe(() => {
    if (applyingRemote || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(), 800);
  });
  let on = false;
  window.addEventListener('online', () => {
    if (user) push(true);
    else if (on && !fb) ensureFirebase().catch(() => {});
  });
  try { on = localStorage.getItem(FLAG) === '1'; } catch { /* 忽略 */ }
  if (on && navigator.onLine !== false) ensureFirebase().catch(() => set({ status: 'offline', message: '離線中，連線後會自動同步' }));
}
