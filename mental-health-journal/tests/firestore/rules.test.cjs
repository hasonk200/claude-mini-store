const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  setLogLevel,
} = require('firebase/firestore');
const { createStore } = require('../../js/storage.js');
const { journey } = require('../../js/core.js');
let env;
const base = 'users/alice/mentalHealthJournal/';
const core = () => ({
  journey: journey(),
  evidence: [],
  ladders: [],
  plan: { warn: '', self: '', place: '', people: '', safe: '', reason: '' },
  phq: [],
  weeks: {},
  settings: { a: '09:00', b: '16:30', theme: 'auto', buddy: true },
  favs: [],
  pet: null,
  habits: [],
  miles: {},
  milesInit: 1,
  cardNotes: {},
  t: 1,
  years: [],
  drawMonths: [],
});
function database(uid) {
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
}
before(async () => {
  assert(
    process.env.FIRESTORE_EMULATOR_HOST,
    'Run via npm run test:rules; real projects must never be used',
  );
  setLogLevel('silent');
  env = await initializeTestEnvironment({
    projectId: 'demo-heartland-journal',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
beforeEach(() => env.clearFirestore());
after(async () => {
  if (env) await env.cleanup();
});
test('owner can create, read and update every document written by the app', async () => {
  const db = database('alice');
  for (const [name, body] of Object.entries({
    core: core(),
    'ci-2026': { entries: { '2026-10-24': { mood: 5, anx: 3, energy: 6, t: 1 } } },
    'dr-2026-10': {
      entries: { '2026-10-24': { date: '2026-10-24', card: 'sun', text: 'A note', t: 1 } },
    },
  })) {
    const ref = doc(db, base + name);
    await assertSucceeds(setDoc(ref, body));
    assert((await assertSucceeds(getDoc(ref))).exists());
    await assertSucceeds(setDoc(ref, body));
  }
  await assertSucceeds(setDoc(doc(db, base + 'ci-2026'), { entries: {} }));
  await assertSucceeds(setDoc(doc(db, base + 'dr-2026-10'), { entries: {} }));
});
test('anonymous and other accounts cannot get, list, create, update or delete journal data', async () => {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), base + 'core'), core()));
  for (const uid of [null, 'bob']) {
    const db = database(uid),
      ref = doc(db, base + 'core');
    await assertFails(getDoc(ref));
    await assertFails(getDocs(collection(db, base.slice(0, -1))));
    await assertFails(getDocs(collectionGroup(db, 'mentalHealthJournal')));
    await assertFails(setDoc(doc(db, base + 'ci-2026'), { entries: {} }));
    await assertFails(updateDoc(ref, { t: 2 }));
    await assertFails(deleteDoc(ref));
  }
});
test('unrelated paths, migration receipts and nested collections remain closed', async () => {
  const db = database('alice');
  for (const key of [
    'users/alice',
    'users/alice/supplements/core',
    base + 'notes',
    base + 'core/private/note',
    'journalMigrations/cutover',
  ]) {
    await assertFails(setDoc(doc(db, key), { admin: true }));
  }
  await assertFails(getDoc(doc(db, 'journalMigrations/cutover')));
  await assertFails(getDocs(collection(db, 'users')));
  await assertSucceeds(setDoc(doc(db, base + 'core'), core()));
  await assertFails(deleteDoc(doc(db, base + 'core')));
});
test('core schema applies equally to creation and update', async () => {
  const db = database('alice'),
    ref = doc(db, base + 'core');
  const invalid = [
    { ...core(), admin: true },
    { ...core(), ownerId: 'bob' },
    { ...core(), t: 'yesterday' },
    { ...core(), t: -1 },
    { ...core(), habits: {} },
    { ...core(), evidence: Array(10001).fill({}) },
    { ...core(), plan: { ...core().plan, warn: 'x'.repeat(10001) } },
    { ...core(), settings: { ...core().settings, theme: 'unknown' } },
    { ...core(), years: Array(301).fill('2026') },
  ];
  const missing = core();
  delete missing.pet;
  invalid.push(missing);
  for (const body of invalid) {
    await assertFails(setDoc(ref, body));
    await assertSucceeds(setDoc(ref, core()));
    await assertFails(setDoc(ref, body));
    await env.clearFirestore();
  }
  await assertSucceeds(setDoc(ref, core()));
  await assertFails(updateDoc(ref, { settings: deleteField() }));
});
test('partition envelope, sizes and names are checked on create and update', async () => {
  const db = database('alice');
  for (const [name, maximum] of [
    ['ci-2026', 366],
    ['dr-2026-10', 31],
  ]) {
    const ref = doc(db, base + name);
    for (const body of [
      {},
      { entries: [] },
      { entries: {}, extra: true },
      {
        entries: Object.fromEntries(Array.from({ length: maximum + 1 }, (_, i) => [String(i), {}])),
      },
    ]) {
      await assertFails(setDoc(ref, body));
      await assertSucceeds(setDoc(ref, { entries: {} }));
      await assertFails(setDoc(ref, body));
      await env.clearFirestore();
    }
  }
  for (const name of ['dr-2026-13', 'ci-26', 'settings'])
    await assertFails(setDoc(doc(db, base + name), { entries: {} }));
});
test('two independent clients can load the actual store payload and continue sequentially', async () => {
  const state = () => ({ ...core(), checkins: {}, draws: {} });
  function store(db) {
    const values = new Map();
    return createStore({
      storage: { getItem: (k) => values.get(k) || null, setItem: (k, v) => values.set(k, v) },
      defaults: state,
      normalize: (raw) => ({ ...state(), ...raw }),
      getDatabase: () => db,
      schedule: () => 1,
      cancel() {},
    });
  }
  const first = store(database('alice')),
    second = store(database('alice'));
  await first.loadCloudFor({ uid: 'alice' });
  first.state.checkins['2026-10-24'] = { mood: 5, anx: 3, energy: 6, t: 2 };
  first.persist({ year: '2026' });
  await first.flush();
  await second.loadCloudFor({ uid: 'alice' });
  assert.equal(second.state.checkins['2026-10-24'].mood, 5);
  second.state.checkins['2026-10-25'] = { mood: 6, anx: 3, energy: 6, t: 3 };
  second.persist({ year: '2026' });
  await second.flush();
  await first.loadCloudFor({ uid: 'alice' });
  assert.equal(Object.keys(first.state.checkins).length, 2);
  assert.equal(first.state.checkins['2026-10-25'].mood, 6);
});
