const { test } = require('node:test');
const assert = require('node:assert/strict');
const { digest, documentWrite } = require('../scripts/migrate-firebase.cjs');
const name =
  'projects/dicky-heartland-journal-2026/databases/(default)/documents/users/alice/mentalHealthJournal/core';
const oldFields = { t: { integerValue: '1' }, evidence: { arrayValue: { values: [] } } };
const nextFields = { ...oldFields, t: { integerValue: '2' } };
test('migration hashing ignores object ordering but preserves nested array order', () => {
  assert.equal(digest(oldFields), digest({ evidence: oldFields.evidence, t: oldFields.t }));
  assert.notEqual(digest({ values: [1, 2] }), digest({ values: [2, 1] }));
});
test('new destination writes require the document to still be absent', () => {
  assert.deepEqual(documentWrite(name, nextFields, null), {
    update: { name, fields: nextFields },
    currentDocument: { exists: false },
  });
});
test('repeat migration only replaces the previously copied content at its read version', () => {
  const target = { fields: oldFields, updateTime: '2026-10-24T20:00:00Z' };
  assert.deepEqual(documentWrite(name, nextFields, target, digest(oldFields)), {
    update: { name, fields: nextFields },
    currentDocument: { updateTime: target.updateTime },
  });
});
test('missing receipt or new-project edits stop migration before writing', () => {
  const target = { fields: nextFields, updateTime: '2026-10-24T21:00:00Z' };
  assert.throws(() => documentWrite(name, oldFields, target), /changed since migration/);
  assert.throws(
    () => documentWrite(name, oldFields, target, digest(oldFields)),
    /changed since migration/,
  );
});
