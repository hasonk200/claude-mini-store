/* Drain one authenticated session. Payloads are snapshots, dirty flags may change while awaiting I/O. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JournalSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  async function drain({ session, isCurrent, dirty, monthBody, yearBody, coreBody }) {
    async function partition(set, key, ref, body) {
      set.delete(key);
      try {
        await ref.set(body);
      } catch (error) {
        if (isCurrent()) set.add(key);
        throw error;
      }
    }
    while (isCurrent() && (dirty.core || dirty.years.size || dirty.months.size)) {
      if (dirty.months.size) {
        const m = dirty.months.values().next().value;
        await partition(dirty.months, m, session.month(m), monthBody(m));
        if (!isCurrent()) return;
      }
      if (dirty.years.size) {
        const y = dirty.years.values().next().value;
        await partition(dirty.years, y, session.year(y), yearBody(y));
        if (!isCurrent()) return;
      }
      if (dirty.core) {
        const body = coreBody();
        dirty.core = false;
        try {
          await session.core.set(body);
        } catch (error) {
          if (isCurrent()) dirty.core = true;
          throw error;
        }
      }
    }
  }
  return { drain };
});
