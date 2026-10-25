const $ = (s) => document.querySelector(s);

const $$ = (s) => Array.from(document.querySelectorAll(s));

const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export { $, $$, esc };
