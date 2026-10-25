// A fixed gallery covers every card, pet species/palette/stage and location.
function renderGallery({ ART, PET, DECK }) {
  const gallery = { 'card/back': ART.back() };
  for (const card of DECK) {
    for (const level of [0, 1, 2, 3]) {
      const key = 'card/' + card.id + '/' + level;
      gallery[key] = ART.face(card, level, 'fixture_' + card.id + '_' + level + '_');
    }
  }
  const expressions = ['normal', 'happy', 'love', 'eat', 'sleep', 'ask', 'sad', 'excited'];
  const accessories = ['', 'scarf', 'bow', 'beanie', 'flower', 'bell'];
  const traits = ['', 'foodie', 'playful', 'gentle', 'curious'];
  let i = 0;
  for (const sp of Object.keys(PET.SPECIES)) {
    for (const color of Object.keys(PET.PAL)) {
      for (const stage of [0, 1, 2]) {
        gallery['pet/' + sp + '/' + color + '/' + stage] = PET.svg({
          sp,
          color,
          stage,
          name: '伙伴',
          expr: expressions[i % expressions.length],
          acc: accessories[i % accessories.length],
          trait: traits[i % traits.length],
          shiny: i++ % 2,
        });
      }
    }
  }
  for (const kind of ['normal', 'gold']) {
    for (const warmth of [0, 50, 100]) {
      gallery['egg/' + kind + '/' + warmth] = PET.egg({
        kind,
        warmth,
        need: 100,
        crack: warmth === 100,
        wobble: warmth === 50,
      });
    }
  }
  for (const place of ['room', 'park', 'lake', 'street', 'cafe']) {
    for (const hour of [8, 18, 22]) {
      gallery['scene/' + place + '/' + hour] = PET[place]({
        hour,
        rain: true,
        books: 30,
        own: Object.fromEntries(
          [
            'lights',
            'plant',
            'lamp',
            'frame',
            'shelf',
            'record',
            'tank',
            'sofa',
            'kitchen',
            'shoes',
            'ball',
          ].map((key) => [key, true]),
        ),
      });
    }
  }
  return gallery;
}
module.exports = { renderGallery };
