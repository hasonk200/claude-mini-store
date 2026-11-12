import { segGet, toast } from './shared/controls.mjs';
import { keyOf, addDays, md, sleepHours, parseKey } from './shared/dates.mjs';
import { state, persist } from './state.mjs';
import { $ } from './shared/dom.mjs';
import { renderHeat } from './heatmap.mjs';
import { drawCards } from './cards/model.mjs';
import { card } from './data/cards.mjs';
import { byId } from './wisdom.mjs';
import { petAward } from './pet/rewards.mjs';

const rangeDays = () => +(segGet('range') || 7);

function dayList(n) {
  const end = keyOf(new Date());
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

const svg = (inner, W, H) =>
  '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + inner + '</svg>';

function xLabels(days, x, H) {
  const step = Math.ceil(days.length / 7);
  return days
    .map((d, i) =>
      i % step === 0 || i === days.length - 1
        ? '<text x="' +
          x(i).toFixed(1) +
          '" y="' +
          (H - 6) +
          '" text-anchor="middle" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">' +
          md(d) +
          '</text>'
        : '',
    )
    .join('');
}

function grid(vals, y, P, W) {
  return vals
    .map(
      (v) =>
        '<line x1="' +
        P.l +
        '" x2="' +
        (W - P.r) +
        '" y1="' +
        y(v) +
        '" y2="' +
        y(v) +
        '" style="stroke:var(--rule)"/><text x="' +
        (P.l - 8) +
        '" y="' +
        (y(v) + 4) +
        '" text-anchor="end" style="fill:var(--ink-3);font-size:12.5px;font-family:var(--f-num)">' +
        v +
        '</text>',
    )
    .join('');
}

function lineChart(days) {
  const W = 560,
    H = 210,
    P = { l: 30, r: 26, t: 12, b: 28 };
  const x = (i) =>
    P.l + (days.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (days.length - 1));
  const y = (v) => P.t + ((10 - v) * (H - P.t - P.b)) / 10;
  let g = grid([0, 5, 10], y, P, W);
  [
    ['mood', 'var(--good)'],
    ['anx', 'var(--red)'],
    ['energy', 'var(--calm)'],
  ].forEach(([k, c]) => {
    let d = '',
      pen = false,
      dots = '';
    days.forEach((day, i) => {
      const e = state.checkins[day];
      if (e && e[k] != null) {
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(e[k]).toFixed(1) + ' ';
        pen = true;
        dots +=
          '<circle cx="' +
          x(i).toFixed(1) +
          '" cy="' +
          y(e[k]).toFixed(1) +
          '" r="3" style="fill:' +
          c +
          '"/>';
      } else pen = false;
    });
    g +=
      '<path d="' +
      d +
      '" style="fill:none;stroke:' +
      c +
      ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>' +
      dots;
  });
  return svg(g + xLabels(days, x, H), W, H);
}

function sleepChart(days) {
  const W = 560,
    H = 210,
    P = { l: 30, r: 26, t: 12, b: 28 },
    MAX = 12;
  const bw = (W - P.l - P.r) / days.length;
  const x = (i) => P.l + i * bw + bw / 2;
  const y = (v) => P.t + ((MAX - v) * (H - P.t - P.b)) / MAX;
  let g = grid([0, 4, 8, 12], y, P, W);
  days.forEach((d, i) => {
    const e = state.checkins[d];
    const h = e ? sleepHours(e.ss, e.se) : null;
    if (h == null) return;
    const v = Math.min(h, MAX);
    const c = e.seg === '3' ? 'var(--red)' : e.seg === '2' ? 'var(--warn)' : 'var(--good)';
    const w = Math.max(4, Math.min(24, bw * 0.6));
    g +=
      '<rect x="' +
      (x(i) - w / 2).toFixed(1) +
      '" y="' +
      y(v).toFixed(1) +
      '" width="' +
      w.toFixed(1) +
      '" height="' +
      (y(0) - y(v)).toFixed(1) +
      '" rx="2" style="fill:' +
      c +
      '"/>';
  });
  const tgt = sleepHours(state.settings.a, state.settings.b);
  if (tgt)
    g +=
      '<line x1="' +
      P.l +
      '" x2="' +
      (W - P.r) +
      '" y1="' +
      y(Math.min(tgt, MAX)) +
      '" y2="' +
      y(Math.min(tgt, MAX)) +
      '" style="stroke:var(--ink-2);stroke-dasharray:4 4"/>';
  return svg(g + xLabels(days, x, H), W, H);
}

function stats(days) {
  const es = days.map((d) => state.checkins[d]).filter(Boolean);
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  const f = (v) => (v == null ? '—' : Math.round(v * 10) / 10);
  const sl = es.map((e) => sleepHours(e.ss, e.se)).filter((v) => v != null);
  const from = days[0];
  let lad = 0;
  state.ladders.forEach((L) =>
    L.steps.forEach((s) =>
      s.log.forEach((l) => {
        if (l.date >= from) lad++;
      }),
    ),
  );
  return {
    n: es.length,
    mood: f(avg(es.map((e) => e.mood))),
    anx: f(avg(es.map((e) => e.anx))),
    energy: f(avg(es.map((e) => e.energy))),
    sleep: f(avg(sl)),
    contact: es.filter((e) => e.contact === '2' || e.contact === '3').length,
    move: es.filter((e) => e.move && e.move !== '0').length,
    frag: es.filter((e) => e.seg === '3').length,
    ev: state.evidence.filter((x) => !x.seed && x.date >= from).length,
    lad,
  };
}

function weekKey() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return keyOf(d);
}

const PHQ = [
  '覺得緊張、焦慮或者坐立不安',
  '唔能夠停止或者控制擔心',
  '做嘢冇乜興趣或者樂趣',
  '覺得情緒低落、沮喪或者絕望',
];

const PHQ_OPT = ['完全冇', '有幾日', '一半以上日子', '差唔多每日'];

function renderPHQForm() {
  $('#phq-form').innerHTML =
    '<p class="muted" style="margin:8px 0 4px">過去兩個星期，有幾經常受以下問題困擾？</p>' +
    PHQ.map(
      (q, i) =>
        '<div class="q"><p>' +
        (i + 1) +
        '. ' +
        q +
        '</p><div class="seg" data-name="phq' +
        i +
        '">' +
        PHQ_OPT.map((o, v) => '<button data-v="' + v + '">' + o + '</button>').join('') +
        '</div></div>',
    ).join('');
}

const phqLevel = (t) =>
  t <= 2
    ? ['正常範圍', 'good']
    : t <= 5
      ? ['輕度', 'calm']
      : t <= 8
        ? ['中度', 'warn']
        : ['偏高', 'red'];

function phqDue() {
  const last = state.phq[state.phq.length - 1];
  return !last || (Date.now() - parseKey(last.date).getTime()) / 864e5 >= 14;
}

function renderBadge() {
  $('#phq-badge').hidden = !(phqDue() && Object.keys(state.checkins).length >= 3);
}

function renderPHQLast() {
  const last = state.phq[state.phq.length - 1];
  if (!last) {
    $('#phq-last').textContent = '未做過。做咗第一次之後，呢度會顯示對比。';
    return;
  }
  const prev = state.phq[state.phq.length - 2];
  $('#phq-last').innerHTML =
    '上次 ' +
    md(last.date) +
    '：總分 ' +
    last.total +
    '／12，' +
    phqLevel(last.total)[0] +
    (prev ? '；再上次 ' + prev.total + ' 分' : '') +
    (phqDue()
      ? '。<b>已經夠兩星期，可以再做。</b>'
      : '。下次可以喺 ' + md(addDays(last.date, 14)) + ' 之後做。');
}

function renderWeek() {
  const w = weekKey();
  const d = state.weeks[w] || {};
  $('#week-label').textContent = '由星期一 ' + md(w) + ' 開始嘅一星期';
  $('#wk-did').value = d.did || '';
  $('#wk-learn').value = d.learn || '';
  $('#wk-next').value = d.next || '';
}

function renderReview() {
  const days = dayList(rangeDays());
  const s = stats(days);
  $('#stats').innerHTML = [
    ['平均心情', s.mood, '／10'],
    ['平均焦慮', s.anx, '／10'],
    ['平均主睡眠', s.sleep, '小時'],
    ['有傾到偈', s.contact, '日'],
    ['有郁身', s.move, '日'],
    ['新證據・階梯', s.ev + '・' + s.lad, '條・次'],
  ]
    .map(
      ([a, b, c]) =>
        '<div class="sheet stat"><span>' +
        a +
        '</span><b>' +
        b +
        ' <small>' +
        c +
        '</small></b></div>',
    )
    .join('');
  $('#chart-mood').innerHTML = s.n
    ? lineChart(days)
    : '<p class="muted" style="padding:40px 0;text-align:center">呢段時間未有打卡記錄。打完卡，曲線就會喺度出現。</p>';
  $('#chart-sleep').innerHTML = s.n
    ? sleepChart(days)
    : '<p class="muted" style="padding:40px 0;text-align:center">填咗主睡眠時間，呢度就會出棒形圖。</p>';
  renderPHQLast();
  renderWeek();
  renderHeat();
}

function buildSummary() {
  const days = dayList(7);
  const s = stats(days);
  const L = [
    '【Dicky 心晴手帳・最近 7 日摘要】',
    '打卡 ' + s.n + '／7 日',
    '平均：心情 ' + s.mood + '、焦慮 ' + s.anx + '、精神 ' + s.energy + '（0 至 10）',
    '平均主睡眠 ' +
      s.sleep +
      ' 小時（錨點 ' +
      state.settings.a +
      ' 至 ' +
      state.settings.b +
      '）；斷開三段或以上 ' +
      s.frag +
      ' 日',
    '有傾到偈 ' + s.contact + ' 日；有郁身 ' + s.move + ' 日',
    '新證據 ' + s.ev + ' 條；階梯行咗 ' + s.lad + ' 次',
    '',
    '每日：',
  ];
  days.forEach((d) => {
    const e = state.checkins[d];
    if (!e) return;
    const h = sleepHours(e.ss, e.se);
    L.push(
      '・' +
        md(d) +
        (e.work === 'off' ? '（休息）' : '') +
        ' 心情' +
        e.mood +
        ' 焦慮' +
        e.anx +
        ' 精神' +
        e.energy +
        (h != null ? ' 瞓' + h + 'h' : '') +
        (e.seg ? (e.seg === '3' ? '/3段+' : '/' + e.seg + '段') : '') +
        (e.mastery ? '｜做到：' + e.mastery : '') +
        (e.next ? '｜細步：' + e.next : ''),
    );
  });
  const last = state.phq[state.phq.length - 1];
  if (last)
    L.push(
      '',
      'PHQ-4（' +
        md(last.date) +
        '）：' +
        last.total +
        '／12（焦慮 ' +
        last.anx +
        '、低落 ' +
        last.dep +
        '）',
    );
  const w = state.weeks[weekKey()];
  if (w && (w.did || w.learn || w.next))
    L.push(
      '',
      '每週三省：做到「' +
        (w.did || '—') +
        '」；學到「' +
        (w.learn || '—') +
        '」；下星期細步「' +
        (w.next || '—') +
        '」',
    );
  const dw = days.map((d) => (state.draws || {})[d]).filter(Boolean);
  if (dw.length)
    L.push(
      '',
      '收工抽卡：' +
        dw
          .map(
            (d) =>
              md(d.date) +
              '「' +
              drawCards(d)
                .map((x) => card(x.card).name + (x.rev ? '（提醒位）' : ''))
                .join('／') +
              '」',
          )
          .join('、'),
    );
  const fv = (state.favs || []).map(byId).filter(Boolean);
  if (fv.length)
    L.push(
      '',
      '我收藏嘅座右銘：' +
        fv
          .slice(0, 5)
          .map((x) => '「' + x.o + '」')
          .join(' '),
    );
  L.push('', '請根據呢份摘要，同我傾下星期最值得行嘅一步。直接啲，唔使安慰說話。');
  return L.join('\n');
}

function selectText(el) {
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  } catch (e) {}
}

function initializeReview() {
  $('#phq-save').addEventListener('click', () => {
    const v = PHQ.map((_, i) => segGet('phq' + i));
    if (v.some((x) => x == null)) {
      $('#phq-result').innerHTML = '<div class="fb">四條都要揀先計到分。</div>';
      return;
    }
    const n = v.map(Number),
      anx = n[0] + n[1],
      dep = n[2] + n[3],
      total = anx + dep;
    state.phq.push({ date: keyOf(new Date()), total, anx, dep });
    persist();
    petAward('phq', 15, 1, 'PHQ-4');
    const [lv, c] = phqLevel(total);
    let msg =
      '<div class="fb ' +
      c +
      '">總分 ' +
      total +
      '／12，' +
      lv +
      '。焦慮部分 ' +
      anx +
      '／6，低落部分 ' +
      dep +
      '／6。</div>';
    msg +=
      total >= 6 || anx >= 3 || dep >= 3
        ? '<div class="fb">可以帶住今次嘅記錄，同專業人士傾吓最近點樣。安省免費 CBT 可以自己轉介，康福亦有廣東話服務。資料喺<a data-goto="plan">應急卡最底</a>。</div>'
        : '<div class="fb">繼續照而家咁跟進，兩星期後再做一次睇趨勢。</div>';
    $('#phq-result').innerHTML = msg;
    renderPHQLast();
    renderPHQForm();
    renderBadge();
  });
  $('#wk-save').addEventListener('click', () => {
    state.weeks[weekKey()] = {
      did: $('#wk-did').value.trim(),
      learn: $('#wk-learn').value.trim(),
      next: $('#wk-next').value.trim(),
    };
    persist();
    petAward('wk', 20, 1, '每週三省');
    toast('儲存咗');
  });
  $('#sum-copy').addEventListener('click', () => {
    const txt = buildSummary();
    const pre = $('#sum-pre');
    pre.textContent = txt;
    pre.hidden = false;
    const done = (ok) => {
      $('#sum-status').textContent = ok
        ? '複製咗，去對話度貼上就得。'
        : '自動複製唔到，已經幫你揀好下面啲字，手動複製就得。';
      if (!ok) selectText(pre);
    };
    try {
      navigator.clipboard.writeText(txt).then(
        () => done(true),
        () => done(false),
      );
    } catch (e) {
      done(false);
    }
  });
}

export { renderBadge, selectText, renderPHQForm, renderReview, initializeReview };
