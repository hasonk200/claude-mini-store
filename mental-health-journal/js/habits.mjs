import { defaultDay, addDays, md, WD, parseKey } from './shared/dates.mjs';
import { $, esc } from './shared/dom.mjs';
import { state, persist } from './state.mjs';
import { hbStrength } from './model/habits.mjs';
import { petAward } from './pet/rewards.mjs';
import { toast } from './shared/controls.mjs';
import { uid } from './shared/helpers.mjs';

const HBL = [
  [0, '萌芽中'],
  [25, '成長中'],
  [50, '穩定'],
  [80, '已經成為習慣'],
];

const hbLabel = (v) => {
  let r = HBL[0][1];
  HBL.forEach(([t, n]) => {
    if (v >= t) r = n;
  });
  return r;
};

const hbFreq = (f) => (f >= 7 ? '每日' : '每週 ' + f + ' 次');

function hbWeek(h) {
  const k = defaultDay();
  let c = 0;
  for (let i = 0; i < 7; i++) if (h.log[addDays(k, -i)]) c++;
  return c;
}

let hbEditing = false;

let hbDelArm = null;

function renderHabits() {
  const box = $('#habits');
  if (!box) return;
  const k = defaultDay();
  if (!state.habits.length) {
    box.innerHTML = '<p class="muted">未有習慣。撳「修改」加一個你想慢慢養成嘅小習慣。</p>';
  } else
    box.innerHTML =
      '<div class="hb-list">' +
      state.habits
        .map((h) => {
          const v = hbStrength(h);
          const done = !!h.log[k];
          const wk = hbWeek(h);
          const dots = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(k, i - 6);
            return (
              '<i class="' +
              (h.log[d] ? 'on' : '') +
              '" title="' +
              md(d) +
              '"><span>' +
              WD[parseKey(d).getDay()] +
              '</span></i>'
            );
          }).join('');
          return (
            '<div class="hb"><div class="hb-ring" style="--v:' +
            v +
            '" role="img" aria-label="強度 ' +
            v +
            '%"><b>' +
            v +
            '<small>%</small></b></div><div class="hb-main"><div class="row" style="gap:8px;align-items:baseline"><b class="hb-n">' +
            esc(h.name) +
            '</b><span class="chip ' +
            (v >= 50 ? 'good' : '') +
            '">' +
            hbLabel(v) +
            '</span></div><span class="muted">' +
            hbFreq(h.freq) +
            '・最近 7 日 ' +
            wk +
            (h.freq < 7 ? '／' + h.freq : '') +
            ' 次</span><div class="hb-dots">' +
            dots +
            '</div></div><button class="hb-do' +
            (done ? ' on' : '') +
            '" data-hb="' +
            h.id +
            '" aria-pressed="' +
            done +
            '">' +
            (done ? '✓ 做咗' : '今日做咗') +
            '</button></div>'
          );
        })
        .join('') +
      '</div>';
  const ed = $('#hb-editor');
  ed.hidden = !hbEditing;
  $('#hb-edit').textContent = hbEditing ? '完成' : '修改';
  if (hbEditing)
    ed.innerHTML =
      state.habits
        .map(
          (h) =>
            '<div class="hb-ed" data-hbid="' +
            h.id +
            '"><input type="text" maxlength="16" value="' +
            esc(h.name) +
            '" data-hbname="' +
            h.id +
            '" aria-label="習慣名"><select data-hbfreq="' +
            h.id +
            '" aria-label="頻率">' +
            [1, 2, 3, 4, 5, 6, 7]
              .map(
                (n) =>
                  '<option value="' +
                  n +
                  '"' +
                  (n === h.freq ? ' selected' : '') +
                  '>' +
                  hbFreq(n) +
                  '</option>',
              )
              .join('') +
            '</select><button class="btn ghost small danger" data-hbdel="' +
            h.id +
            '">' +
            (hbDelArm === h.id ? '再撳確認' : '刪除') +
            '</button></div>',
        )
        .join('') +
      (state.habits.length < 8
        ? '<div class="hb-ed"><input type="text" maxlength="16" id="hb-new" placeholder="新習慣，例如：飲夠水"><select id="hb-newf">' +
          [1, 2, 3, 4, 5, 6, 7]
            .map(
              (n) =>
                '<option value="' +
                n +
                '"' +
                (n === 3 ? ' selected' : '') +
                '>' +
                hbFreq(n) +
                '</option>',
            )
            .join('') +
          '</select><button class="btn small" id="hb-add">加</button></div>'
        : '<p class="muted">最多 8 個。</p>');
}

function initializeHabits() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    const b = t.closest('[data-hb]');
    if (b) {
      const h = state.habits.find((x) => x.id === b.dataset.hb);
      if (!h) return;
      const k = defaultDay();
      if (h.log[k]) {
        delete h.log[k];
        persist();
        renderHabits();
        return;
      }
      h.log[k] = 1;
      persist();
      renderHabits();
      petAward('habit', 3, 3, '習慣');
      const wk = hbWeek(h);
      if (h.freq < 7 && wk === h.freq)
        toast('最近 7 日目標做到：' + h.name + ' ' + wk + '／' + h.freq);
      return;
    }
    if (t.id === 'hb-edit') {
      hbEditing = !hbEditing;
      hbDelArm = null;
      renderHabits();
      return;
    }
    if (t.id === 'hb-add') {
      const n = $('#hb-new').value.trim();
      if (!n) {
        $('#hb-new').focus();
        return;
      }
      state.habits.push({
        id: uid(),
        name: n.slice(0, 16),
        freq: +$('#hb-newf').value || 3,
        log: {},
      });
      persist();
      renderHabits();
      return;
    }
    const d = t.closest('[data-hbdel]');
    if (d) {
      const id = d.dataset.hbdel;
      if (hbDelArm !== id) {
        hbDelArm = id;
        renderHabits();
        setTimeout(() => {
          if (hbDelArm === id) {
            hbDelArm = null;
            if (hbEditing) renderHabits();
          }
        }, 5000);
        return;
      }
      state.habits = state.habits.filter((x) => x.id !== id);
      hbDelArm = null;
      persist();
      renderHabits();
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.hbname) {
      const h = state.habits.find((x) => x.id === t.dataset.hbname);
      if (h && t.value.trim()) {
        h.name = t.value.trim().slice(0, 16);
        persist();
      }
    }
    if (t.dataset.hbfreq) {
      const h = state.habits.find((x) => x.id === t.dataset.hbfreq);
      if (h) {
        h.freq = +t.value;
        persist();
      }
    }
  });
}

export { renderHabits, initializeHabits };
