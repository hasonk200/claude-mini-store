const f = (n) => Math.round(n * 10) / 10;
function rng(seed) {
  let s = seed >>> 0 || 7;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export { f, rng };
