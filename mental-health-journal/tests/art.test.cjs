const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { renderGallery } = require('./fixtures/art-cases.cjs');
const expected = require('./fixtures/art-hashes.json');

test('extracted SVG renderers preserve the existing gallery byte for byte', async () => {
  const [{ ART }, { PET }, { DECK }] = await Promise.all([
    import('../js/art/cards.mjs'),
    import('../js/art/pet.mjs'),
    import('../js/data/cards.mjs'),
  ]);
  const gallery = renderGallery({ ART, PET, DECK });
  assert.deepEqual(Object.keys(gallery), Object.keys(expected));
  for (const [name, svg] of Object.entries(gallery)) {
    assert.equal(createHash('sha256').update(svg).digest('hex'), expected[name], name);
  }
});

test('cards on the same screen use distinct SVG definition IDs', async () => {
  const [{ ART }, { DECK }] = await Promise.all([
    import('../js/art/cards.mjs'),
    import('../js/data/cards.mjs'),
  ]);
  const svg = DECK.map((card) => ART.face(card, 1)).join('') + ART.face(DECK[0], 3);
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > DECK.length);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(id), id);
});
