import { esc, icon, verifyToggle, stateTag } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, toDateInput, toTimeInput, MIN, fromInputs, normTime } from '../time.js';
import { mealWorkday, sessionsOfWorkday, frequentMealValues, timeOnWorkday } from '../logic.js';
import { lastMealLine } from './today.js';
import { pageHead, dayNav } from './shared.js';

function chips(values, field) {
  if (!values.length) return '';
  return `<div class="chips" role="group" aria-label="最近常${field === 'name' ? '吃' : '去'}">${values.map((v) => `<button type="button" class="chip-btn" data-action="meal-fill" data-field="${field}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
}

// 用餐表單：新增（頁面上、補登面板裡）和修改（面板）共用。
// 所有欄位先看草稿（ui.drafts[key]）：加相片、同步、重畫、切換分頁都不會清空未儲存的輸入。
export function mealForm({ data, now, ui, meal = null, key, defaultStart, inSheet = false }) {
  const favNames = frequentMealValues(data, 'name');
  const favPlaces = frequentMealValues(data, 'place');
  const dr = ui.drafts?.[key] || {};
  const m = meal || {};
  const v = (k, fallback) => (k in dr ? dr[k] : fallback);
  const start = m.start ?? defaultStart ?? now;
  const date = v('date', toDateInput(start));
  const startT = v('start', toTimeInput(start));
  const endT = v('end', m.end ? toTimeInput(m.end) : '');
  const confirmed = v('confirmed', m.confirmed === false ? '0' : '1');
  const name = v('name', m.name || '');
  const place = v('place', m.place || '');
  const note = v('note', m.note || '');
  const verified = v('verified', !!m.verified?.start);
  const photo = 'photo' in dr ? dr.photo : m.photo ?? null;
  const t = fromInputs(date, normTime(startT) || '');
  const openMore = name || place || note || photo || favNames.length || favPlaces.length;
  const hasDraft = Object.keys(dr).length > 0;
  const foot = meal
    ? `<div class="sheet-foot"><button class="btn btn-meal btn-block btn-lg" type="submit" name="after" value="close">儲存修改</button></div>
      <button type="button" class="btn btn-text-danger btn-block" data-action="meal-delete" data-id="${esc(m.id)}">刪除這一餐</button>`
    : inSheet
      ? `<div class="sheet-foot btn-pair"><button class="btn btn-line btn-lg" type="submit" name="after" value="stay">儲存並繼續</button><button class="btn btn-ink btn-lg" type="submit" name="after" value="close">儲存並關閉</button></div>`
      : `<button class="btn btn-meal btn-block" type="submit">儲存這一餐</button>`;
  return `<form class="form" data-form="meal" data-draft="${esc(key)}">
      <input type="hidden" name="id" value="${esc(m.id || '')}">
      <div class="field-pair"><label class="field"><span>日期</span><input type="date" name="date" value="${esc(date)}" required></label>
      <label class="field"><span>開始</span><input type="time" name="start" value="${esc(startT)}" required></label></div>
      <div class="cross-note" data-meal-preview aria-live="polite">${mealPreview(data, t, now)}</div>
      ${verifyToggle(verified)}
      <div class="field-pair"><label class="field"><span>結束（可空白）</span><input type="time" name="end" value="${esc(endT)}"></label>
      <label class="field"><span>狀態</span><select name="confirmed"><option value="1"${confirmed !== '0' ? ' selected' : ''}>已經吃了</option><option value="0"${confirmed === '0' ? ' selected' : ''}>只是計畫</option></select></label></div>
      <details class="more"${openMore ? ' open' : ''}><summary>餐點、地點、備註、相片（選填）</summary>
        <div class="field-pair"><div class="stack-tight"><label class="field"><span>餐點</span><input name="name" value="${esc(name)}" placeholder="例如：便當"></label>${chips(favNames, 'name')}</div>
        <div class="stack-tight"><label class="field"><span>地點</span><input name="place" value="${esc(place)}" placeholder="例如：公司休息室"></label>${chips(favPlaces, 'place')}</div></div>
        <label class="field"><span>備註</span><textarea name="note" rows="2">${esc(note)}</textarea></label>
        <div class="photo-field">
          ${photo ? `<img class="photo-preview" src="${esc(photo)}" alt="這一餐的相片">` : `<span class="photo-empty">${icon('camera', 22)}</span>`}
          <div class="btn-wrap"><label class="btn btn-line btn-sm file-btn">${photo ? '更換相片' : '加入相片'}<input type="file" accept="image/*" data-action="meal-photo" hidden></label>${photo ? '<button type="button" class="btn btn-line btn-sm" data-action="meal-photo-remove">移除</button>' : ''}</div>
          <span class="fine">相片會先在裝置上縮小，跟這一餐一起保存。</span>
        </div>
      </details>
      ${foot}
      ${!meal && hasDraft ? `<button type="button" class="btn btn-text btn-block" data-action="draft-clear" data-key="${esc(key)}">清除未儲存的內容</button>` : ''}
      <p class="fine center">工作中用餐也可以儲存，不會改動出勤、休息或薪資。</p>
    </form>`;
}

// 「會存成 週六 10/24 12:30 · 歸屬 週六 10/24 工作日」：補舊日的餐時一眼看到日期和歸屬。
export function mealPreview(data, t, now) {
  if (t == null || Number.isNaN(t)) return '';
  const wk = mealWorkday({ start: t }, data, now);
  return `會存成 <strong>${wdOf(t)} ${fmtMD(dateKey(t))} ${fmtTime(t)}</strong> · 歸屬 ${wdOfKey(wk)} ${fmtMD(wk)} 工作日`;
}

export function mealsView(ctx) {
  const { data, now, ui } = ctx;
  const wd = ctx.wd;
  const meals = data.meals.filter((m) => mealWorkday(m, data, now) === wd).sort((a, b) => a.start - b.start);
  const pending = data.meals.filter((m) => !m.confirmed && m.start >= now - 3 * 60 * MIN).sort((a, b) => a.start - b.start);
  const sessions = sessionsOfWorkday(data, wd);
  const pendingHTML = pending.map((m) => `<section class="card card-suggest"><div class="card-head"><span class="eyebrow c-meal">計畫 · 未確認</span><span class="muted small">${wdOf(m.start)} ${fmtMD(dateKey(m.start))}</span></div>
    <strong class="suggest-title">${fmtTime(m.start)} ${esc(m.name || '用餐')}</strong>
    <div class="btn-pair"><button type="button" class="btn btn-ink" data-action="meal-confirm" data-id="${m.id}">確認已吃</button><button type="button" class="btn btn-line" data-action="meal-delete" data-id="${m.id}">沒有吃</button></div></section>`).join('');
  // 點整筆就打開修改；刪除放在修改面板裡（次要動作）。時間、內容、相片固定在同一位置。
  const list = meals.map((m) => {
    const during = sessions.some((s) => m.start >= s.start && m.start <= (s.end ?? now));
    const fresh = ui.flash === `meal:${m.id}`;
    return `<li class="${fresh ? 'is-flash' : ''}"><button type="button" class="rec-row meal-row" data-action="meal-open" data-id="${m.id}" aria-label="修改這一餐：${esc(m.name || '用餐')} ${wdOf(m.start)} ${fmtTime(m.start)}">
      <span class="rec-date"><strong>${fmtTime(m.start)}</strong><small>${m.end ? `至 ${fmtTime(m.end)}` : wdOf(m.start)}</small></span>
      <span class="rec-span"><strong>${esc(m.name || '用餐')}</strong><small>${[m.place, m.note].filter(Boolean).map(esc).join(' · ') || `${wdOf(m.start)} ${fmtMD(dateKey(m.start))}`}</small>
        <span class="rec-tags">${m.confirmed ? '' : stateTag('plan')}${during ? '<span class="chip chip-work">工作中</span>' : ''}${fresh ? '<span class="saved-tag" role="status">已更新</span>' : ''}</span></span>
      ${m.photo ? `<img class="rec-photo" src="${esc(m.photo)}" alt="">` : `<span class="rec-photo is-empty" aria-hidden="true">${icon('meal', 18)}</span>`}
    </button></li>`;
  }).join('');
  const listHTML = `${dayNav('wd-shift', `${wdOfKey(wd)}工作日 · ${fmtMD(wd)}`, `${meals.length} 餐 · 點一餐可以修改`)}${list ? `<section class="card card-flush"><ul class="rec-list">${list}</ul></section>` : '<p class="card muted">這個工作日還沒有用餐紀錄。</p>'}`;
  const form = `<section class="card" aria-label="記一餐"><div class="card-head"><h2 class="card-title">記一餐</h2></div>
    ${mealForm({ data, now, ui, key: 'meal:new', defaultStart: timeOnWorkday(data, wd, now) })}</section>`;
  const body = ctx.isDesktop
    ? `<div class="grid-2-1"><div class="stack">${pendingHTML}${listHTML}</div><div class="stack">${form}</div></div>`
    : `${pendingHTML}${form}${listHTML}`;
  return `${pageHead('用餐', '先記時間，其他選填')}<section class="card">${lastMealLine(data, now)}</section>${body}`;
}
