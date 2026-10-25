import { $, esc } from './shared/dom.mjs';
import { state, persist } from './state.mjs';
import { keyOf } from './shared/dates.mjs';
import { uid } from './shared/helpers.mjs';
import { petAward } from './pet/rewards.mjs';
import { toast } from './shared/controls.mjs';

const fearCls = (f) => (f <= 3 ? 'l' : f <= 6 ? 'm' : 'h');

let armedDelete = null;

function renderLadders() {
  $('#ladders').innerHTML = state.ladders
    .map((L) => {
      const steps = L.steps.slice().sort((a, b) => a.fear - b.fear);
      const next = steps.find((s) => !s.log.length);
      return (
        '<div class="sheet"><div class="row" style="justify-content:space-between;margin-bottom:6px"><h2>' +
        esc(L.name) +
        '</h2><button class="btn ghost small' +
        (armedDelete === L.id ? ' danger' : '') +
        '" data-del-ladder="' +
        L.id +
        '">' +
        (armedDelete === L.id ? '再撳一次刪除' : '刪除階梯') +
        '</button></div>' +
        '<ul class="list">' +
        (steps.length
          ? steps
              .map((s) => {
                const last = s.log[s.log.length - 1];
                return (
                  '<li class="item' +
                  (s.log.length ? ' step-done' : '') +
                  '"><span class="fear ' +
                  fearCls(s.fear) +
                  '" title="驚嘅程度">' +
                  s.fear +
                  '</span><div class="txt"><span>' +
                  esc(s.text) +
                  '</span>' +
                  (last
                    ? '<div class="meta">做咗 ' +
                      s.log.length +
                      ' 次・最近估 ' +
                      last.before +
                      ' 分，實際 ' +
                      last.after +
                      ' 分</div>'
                    : next && next.id === s.id
                      ? '<div class="meta" style="color:var(--red)">建議下一級</div>'
                      : '') +
                  '<div class="inline-form" id="f-' +
                  s.id +
                  '"><div class="label">之前估幾驚 <em id="fb-' +
                  s.id +
                  '">' +
                  s.fear +
                  '</em></div><input type="range" min="0" max="10" value="' +
                  s.fear +
                  '" id="rb-' +
                  s.id +
                  '" data-out="fb-' +
                  s.id +
                  '"><div class="label">實際幾驚 <em id="fa-' +
                  s.id +
                  '">' +
                  s.fear +
                  '</em></div><input type="range" min="0" max="10" value="' +
                  s.fear +
                  '" id="ra-' +
                  s.id +
                  '" data-out="fa-' +
                  s.id +
                  '"><div class="row" style="margin-top:6px"><button class="btn small" data-log="' +
                  s.id +
                  '">記低</button><button class="btn ghost small" data-cancel="' +
                  s.id +
                  '">取消</button></div></div>' +
                  '</div><div class="row" style="flex:none;gap:2px"><button class="btn ghost small" data-open="' +
                  s.id +
                  '">做咗</button><button class="x" data-del-step="' +
                  s.id +
                  '" aria-label="刪除">×</button></div></li>'
                );
              })
              .join('')
          : '<li class="muted">未有步驟，喺下面加第一級。</li>') +
        '</ul>' +
        '<div class="row" style="margin-top:12px"><input type="text" placeholder="加一級" id="ns-' +
        L.id +
        '" style="flex:1 1 180px"><select id="nf-' +
        L.id +
        '" style="width:auto">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map(
            (n) =>
              '<option value="' +
              n +
              '"' +
              (n === 4 ? ' selected' : '') +
              '>驚 ' +
              n +
              ' 分</option>',
          )
          .join('') +
        '</select><button class="btn ghost small" data-add-step="' +
        L.id +
        '">加</button></div></div>'
      );
    })
    .join('');
}

function findStep(id) {
  for (const L of state.ladders) {
    const s = L.steps.find((x) => x.id === id);
    if (s) return [L, s];
  }
  return [null, null];
}

function initializeLadders() {
  $('#ladders').addEventListener('input', (e) => {
    const r = e.target.closest('input[type=range][data-out]');
    if (r) document.getElementById(r.dataset.out).textContent = r.value;
  });
  $('#ladders').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (!t.dataset.delLadder && armedDelete) {
      armedDelete = null;
    }
    if (t.dataset.open) {
      $('#f-' + t.dataset.open).classList.toggle('on');
      return;
    }
    if (t.dataset.cancel) {
      $('#f-' + t.dataset.cancel).classList.remove('on');
      return;
    }
    if (t.dataset.log) {
      const [, s] = findStep(t.dataset.log);
      if (!s) return;
      const before = +$('#rb-' + s.id).value,
        after = +$('#ra-' + s.id).value;
      s.log.push({ date: keyOf(new Date()), before, after });
      state.evidence.push({
        id: uid(),
        date: keyOf(new Date()),
        type: '頂住咗唔舒服',
        text: s.text + '（估 ' + before + ' 分，實際 ' + after + ' 分）',
        src: '階梯',
      });
      persist();
      renderLadders();
      petAward('lad', 15, 2, '細步階梯');
      toast(after < before ? '實際冇估咁驚，個腦學緊。' : '做咗就係做咗，已經記入證據簿。');
      return;
    }
    if (t.dataset.delStep) {
      const [L, s] = findStep(t.dataset.delStep);
      if (L) {
        L.steps = L.steps.filter((x) => x.id !== s.id);
        persist();
        renderLadders();
      }
      return;
    }
    if (t.dataset.delLadder) {
      if (armedDelete === t.dataset.delLadder) {
        state.ladders = state.ladders.filter((x) => x.id !== armedDelete);
        armedDelete = null;
        persist();
      } else armedDelete = t.dataset.delLadder;
      renderLadders();
      return;
    }
    if (t.dataset.addStep) {
      const id = t.dataset.addStep;
      const inp = $('#ns-' + id);
      const txt = inp.value.trim();
      if (!txt) {
        inp.focus();
        return;
      }
      const L = state.ladders.find((x) => x.id === id);
      L.steps.push({ id: uid(), text: txt, fear: +$('#nf-' + id).value, log: [] });
      persist();
      renderLadders();
    }
  });
  $('#ladder-add').addEventListener('click', () => {
    const n = $('#ladder-name').value.trim();
    if (!n) {
      $('#ladder-name').focus();
      return;
    }
    state.ladders.push({ id: uid(), name: n, steps: [] });
    persist();
    $('#ladder-name').value = '';
    renderLadders();
  });
}

export { renderLadders, initializeLadders };
