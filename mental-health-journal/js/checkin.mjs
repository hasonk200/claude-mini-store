import { sleepHours, parseKey, keyOf, addDays, WD, circDiff, defaultDay } from './shared/dates.mjs';
import { $, esc } from './shared/dom.mjs';
import { state, persist, journalStore } from './state.mjs';
import { segSet, segGet } from './shared/controls.mjs';
import { recentEntries } from './model/checkins.mjs';
import { byId } from './wisdom.mjs';
import { readDraft, writeDraft, removeDraft } from './shared/drafts.mjs';
import { petAward } from './pet/rewards.mjs';
import { renderBadge } from './review.mjs';

const sliders = [
  ['#ci-mood', '#v-mood'],
  ['#ci-anx', '#v-anx'],
  ['#ci-energy', '#v-energy'],
];

function updateSleepCalc() {
  const h = sleepHours($('#ci-sleep-start').value, $('#ci-sleep-end').value);
  $('#sleep-calc').textContent = h == null ? '—' : '約 ' + h + ' 小時';
}

function dateHint(k) {
  const d = parseKey(k);
  const today = keyOf(new Date());
  const rel = k === today ? '今日' : k === addDays(today, -1) ? '琴日' : '';
  $('#date-hint').textContent =
    '星期' + WD[d.getDay()] + (rel ? '・' + rel : '') + '・夜班按開工日計';
}

function loadForm(k) {
  const e = state.checkins[k];
  $('#ci-date').value = k;
  dateHint(k);
  segSet('work', e ? e.work : null);
  $('#ci-mood').value = e ? e.mood : 5;
  $('#ci-anx').value = e ? e.anx : 5;
  $('#ci-energy').value = e ? e.energy : 5;
  sliders.forEach(([i, v]) => ($(v).textContent = $(i).value));
  $('#ci-sleep-start').value = (e && e.ss) || '';
  $('#ci-sleep-end').value = (e && e.se) || '';
  updateSleepCalc();
  segSet('seg', e ? e.seg : null);
  segSet('contact', e ? e.contact : null);
  segSet('move', e ? e.move : null);
  $('#ci-mastery').value = (e && e.mastery) || '';
  $('#ci-pleasure').value = (e && e.pleasure) || '';
  $('#ci-next').value = (e && e.next) || '';
  $('#ci-status').textContent = e ? '呢日已經記錄咗，改完再撳一次就得。' : '';
  $('#ci-feedback').innerHTML = '';
  restoreCheckinDraft(k);
}

function feedbackFor(k, e) {
  const fb = [];
  const hrs = sleepHours(e.ss, e.se);
  if (e.mood <= 2)
    fb.push([
      'red',
      '今日好低。唔使逼自己即刻好返。打開<a data-goto="plan">低潮應急卡</a>，照第 ② 步做一樣就得。',
    ]);
  if (recentEntries(k, 5).filter((x) => x.mood <= 3).length >= 3)
    fb.push([
      'warn',
      '最近幾日心情都偏低。如果想搵人一齊諗吓，安省有免費 CBT 可以自己轉介，資料喺<a data-goto="plan">應急卡最底</a>。',
    ]);
  if (e.anx >= 7)
    fb.push(['calm', '焦慮偏高。試吓<a data-goto="sos">卡住急救</a>第一步，一分鐘就得。']);
  if (e.seg === '3')
    fb.push([
      'warn',
      '瞓眠斷咗三段或以上，就算加埋時數唔少都會好攰。聽日收工試吓一次過瞓，開工前小瞓控制喺 30 分鐘內。',
    ]);
  else if (e.ss && circDiff(e.ss, state.settings.a) > 2)
    fb.push([
      'warn',
      '今日開始瞓嘅時間離錨點 ' +
        state.settings.a +
        ' 差咗 ' +
        Math.round(circDiff(e.ss, state.settings.a) * 10) / 10 +
        ' 個鐘。休息日都盡量唔好差多過 2 個鐘。',
    ]);
  if (hrs != null && hrs < 5 && e.work === 'work')
    fb.push(['red', '主睡眠唔夠 5 個鐘。今晚踩車送單一覺得眼瞓就停低，安全最緊要。']);
  const last3 = recentEntries(k, 3);
  if (last3.length >= 3 && last3.every((x) => x.contact === '0'))
    fb.push([
      'calm',
      '已經連續三日冇同人真正傾過。去<a data-goto="ladder">細步階梯</a>揀第一級試吓，交單時講多句都算。',
    ]);
  if (!fb.length) {
    if (e.contact === '2' || e.contact === '3')
      fb.push(['good', '今日有同人傾到偈。對抗孤獨，呢啲細接觸比諗好多更實在。']);
    if (e.move === '2') fb.push(['good', '有跑步或者運動。運動對焦慮同低落有實際效果。']);
    if (e.mood >= 7) fb.push(['good', '今日狀態唔錯。可以諗吓係咩令今日好啲，寫入三省。']);
  }
  let q = 'w31';
  if (e.mood <= 2) q = 'w63';
  else if (e.anx >= 7) q = 'w27';
  else if (e.seg === '3' || (hrs != null && hrs < 5)) q = 'w61';
  else if (last3.length >= 3 && last3.every((x) => x.contact === '0')) q = 'w43';
  else if (e.mood <= 4) q = 'w03';
  else if (e.mood >= 7) q = 'w34';
  else if (e.mastery) q = 'w55';
  const x = byId(q);
  if (k === defaultDay() && !(state.draws || {})[k])
    fb.push([
      'calm',
      '收工想寫多兩句？去<a data-goto="draw">收工抽卡</a>，寫低今晚嘅說話，抽一張牌。',
    ]);
  return [['', e.mastery ? '記低咗。「做到」嗰條已經放入證據簿。' : '記低咗。']]
    .concat(fb.slice(0, 4))
    .concat([
      [
        '',
        '<span style="font-family:var(--f-head)">「' +
          esc(x.o) +
          '」</span><span class="muted" style="margin-left:8px">' +
          esc(x.s) +
          '</span><br><span style="font-size:13.5px;color:var(--ink-2)">' +
          esc(x.u) +
          '</span>',
      ],
    ]);
}

function restoreCheckinDraft(k) {
  const d = readDraft('checkin', k);
  if (!d || !d.fields) return;
  for (const [id, v] of Object.entries(d.fields)) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }
  for (const [name, v] of Object.entries(d.segments || {})) segSet(name, v);
  sliders.forEach(([i, v]) => ($(v).textContent = $(i).value));
  updateSleepCalc();
  $('#ci-status').textContent = '已恢復未儲存草稿，完成後撳「記低」。';
}

function saveCheckinDraft() {
  const k = $('#ci-date').value || defaultDay(),
    fields = {},
    segments = {};
  [
    'ci-mood',
    'ci-anx',
    'ci-energy',
    'ci-sleep-start',
    'ci-sleep-end',
    'ci-mastery',
    'ci-pleasure',
    'ci-next',
  ].forEach((id) => (fields[id] = document.getElementById(id).value));
  ['work', 'seg', 'contact', 'move'].forEach((name) => (segments[name] = segGet(name)));
  writeDraft('checkin', k, { fields, segments });
}

function initializeCheckin() {
  sliders.forEach(([i, v]) =>
    $(i).addEventListener('input', () => {
      $(v).textContent = $(i).value;
    }),
  );
  ['#ci-sleep-start', '#ci-sleep-end'].forEach((s) =>
    $(s).addEventListener('input', updateSleepCalc),
  );
  $('#ci-date').addEventListener('change', () => {
    if ($('#ci-date').value) loadForm($('#ci-date').value);
  });
  $('#ci-save').addEventListener('click', () => {
    const k = $('#ci-date').value || defaultDay();
    const e = {
      work: segGet('work'),
      mood: +$('#ci-mood').value,
      anx: +$('#ci-anx').value,
      energy: +$('#ci-energy').value,
      ss: $('#ci-sleep-start').value,
      se: $('#ci-sleep-end').value,
      seg: segGet('seg'),
      contact: segGet('contact'),
      move: segGet('move'),
      mastery: $('#ci-mastery').value.trim(),
      pleasure: $('#ci-pleasure').value.trim(),
      next: $('#ci-next').value.trim(),
      t: Date.now(),
    };
    state.checkins[k] = e;
    const cid = 'ci-' + k;
    state.evidence = state.evidence.filter((x) => x.id !== cid);
    if (e.mastery)
      state.evidence.push({ id: cid, date: k, type: '做到', text: e.mastery, src: '打卡' });
    persist({ year: k.slice(0, 4) });
    if (state.pet) {
      petAward('ci', 10, 1, '打卡');
      if (e.contact === '2' || e.contact === '3') petAward('talk', 5, 1, '同人傾偈');
      if (e.move && e.move !== '0') petAward('move', 5, 1, '郁身');
    }
    if (journalStore.storageOK) removeDraft('checkin', k);
    $('#ci-status').textContent = journalStore.storageOK
      ? '已儲存。'
      : '今次未儲存到，請先下載一份記錄。';
    $('#ci-feedback').innerHTML = feedbackFor(k, e)
      .map(([c, t]) => '<div class="fb ' + c + '">' + t + '</div>')
      .join('');
    renderBadge();
  });
  $('#page-today').addEventListener('input', (e) => {
    if (e.target.id !== 'ci-date') saveCheckinDraft();
  });
  $('#page-today').addEventListener('click', (e) => {
    if (e.target.closest('.seg')) setTimeout(saveCheckinDraft, 0);
  });
}

export { loadForm, initializeCheckin };
