import { esc, icon, verifyToggle } from '../ui.js';
import { dateKey, fmtTime, wdOf, fmtMD, wdOfKey, toDateInput, toTimeInput, MIN } from '../time.js';
import { mealWorkday, sessionsOfWorkday, frequentMealValues } from '../logic.js';
import { lastMealLine } from './today.js';
import { pageHead, dayNav } from './shared.js';

function chips(values, field) {
  if (!values.length) return '';
  return `<div class="chips" role="group" aria-label="最近常${field === 'name' ? '吃' : '去'}">${values.map((v) => `<button type="button" class="chip-btn" data-action="meal-fill" data-field="${field}" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
}

function mealForm(ui, now, editing, data) {
  const favNames = frequentMealValues(data, 'name');
  const favPlaces = frequentMealValues(data, 'place');
  const m = editing || {};
  const start = m.start ?? now;
  const end = m.end ?? null;
  const photo = ui.mealPhoto !== undefined ? ui.mealPhoto : m.photo ?? null;
  return `<section class="card" aria-label="${editing ? '修改這一餐' : '記一餐'}"><div class="card-head"><h2 class="card-title">${editing ? '修改這一餐' : '記一餐'}</h2>${editing ? '<button type="button" class="btn btn-line btn-sm" data-action="meal-cancel">取消</button>' : ''}</div>
    <form class="form" data-form="meal">
      <input type="hidden" name="id" value="${esc(m.id || '')}">
      <div class="field-pair"><label class="field"><span>日期</span><input type="date" name="date" value="${toDateInput(start)}" required></label>
      <label class="field"><span>開始</span><input type="time" name="start" value="${toTimeInput(start)}" required></label></div>
      ${verifyToggle(!!m.verified?.start)}
      <div class="field-pair"><label class="field"><span>結束（可空白）</span><input type="time" name="end" value="${end ? toTimeInput(end) : ''}"></label>
      <label class="field"><span>狀態</span><select name="confirmed"><option value="1"${m.confirmed !== false ? ' selected' : ''}>已經吃了</option><option value="0"${m.confirmed === false ? ' selected' : ''}>只是安排</option></select></label></div>
      <details class="more"${m.name || m.place || m.note || photo || favNames.length || favPlaces.length ? ' open' : ''}><summary>餐點、地點、備註、相片（選填）</summary>
        <div class="field-pair"><div class="stack-tight"><label class="field"><span>餐點</span><input name="name" value="${esc(m.name || '')}" placeholder="例如：便當"></label>${chips(favNames, 'name')}</div>
        <div class="stack-tight"><label class="field"><span>地點</span><input name="place" value="${esc(m.place || '')}" placeholder="例如：公司休息室"></label>${chips(favPlaces, 'place')}</div></div>
        <label class="field"><span>備註</span><textarea name="note" rows="2">${esc(m.note || '')}</textarea></label>
        <div class="photo-field">
          ${photo ? `<img class="photo-preview" src="${esc(photo)}" alt="這一餐的相片">` : `<span class="photo-empty">${icon('camera', 22)}</span>`}
          <div class="btn-wrap"><label class="btn btn-line btn-sm file-btn">${photo ? '更換相片' : '加入相片'}<input type="file" accept="image/*" data-action="meal-photo" hidden></label>${photo ? '<button type="button" class="btn btn-line btn-sm" data-action="meal-photo-remove">移除</button>' : ''}</div>
          <span class="fine">相片會先在裝置上縮小，跟這一餐一起保存。</span>
        </div>
      </details>
      <button class="btn btn-meal btn-block" type="submit">${editing ? '儲存修改' : '儲存這一餐'}</button>
      <p class="fine center">工作中用餐也可以儲存，不會改動出勤、休息或薪資。</p>
    </form></section>`;
}

export function mealsView(ctx) {
  const { data, now, ui } = ctx;
  const wd = ctx.wd;
  const meals = data.meals.filter((m) => mealWorkday(m, data, now) === wd).sort((a, b) => a.start - b.start);
  const pending = data.meals.filter((m) => !m.confirmed && m.start >= now - 3 * 60 * MIN).sort((a, b) => a.start - b.start);
  const sessions = sessionsOfWorkday(data, wd);
  const editing = ui.mealEdit ? data.meals.find((m) => m.id === ui.mealEdit) : null;
  const pendingHTML = pending.map((m) => `<section class="card card-suggest"><div class="card-head"><span class="eyebrow c-meal">安排 · 尚未確認</span><span class="muted small">${wdOf(m.start)} ${fmtMD(dateKey(m.start))}</span></div>
    <strong class="suggest-title">${fmtTime(m.start)} ${esc(m.name || '用餐')}</strong>
    <div class="btn-pair"><button type="button" class="btn btn-ink" data-action="meal-confirm" data-id="${m.id}">確認已吃</button><button type="button" class="btn btn-line" data-action="meal-delete" data-id="${m.id}">沒有吃</button></div></section>`).join('');
  const list = meals.map((m) => {
    const during = sessions.some((s) => m.start >= s.start && m.start <= (s.end ?? now));
    return `<li class="card meal-item">
      ${m.photo ? `<img class="meal-photo" src="${esc(m.photo)}" alt="${esc(m.name || '用餐')}的相片">` : `<span class="meal-photo is-empty">${icon('meal', 22)}</span>`}
      <div class="meal-text"><div class="meal-title"><strong>${esc(m.name || '用餐')}</strong>${during ? '<span class="chip chip-work">工作中</span>' : ''}${m.confirmed ? '' : '<span class="chip chip-plan">安排</span>'}</div>
      <span class="meal-time">${fmtTime(m.start)}${m.end ? '–' + fmtTime(m.end) : ''} · ${wdOf(m.start)}</span>
      ${m.place || m.note ? `<span class="muted small">${esc([m.place, m.note].filter(Boolean).join(' · '))}</span>` : ''}</div>
      <div class="meal-actions"><button type="button" class="icon-btn icon-btn-sm" data-action="meal-edit" data-id="${m.id}" aria-label="修改">${icon('edit', 16)}</button><button type="button" class="icon-btn icon-btn-sm" data-action="meal-delete" data-id="${m.id}" aria-label="刪除">${icon('trash', 16)}</button></div>
    </li>`;
  }).join('');
  const listHTML = `${dayNav('wd-shift', `${wdOfKey(wd)}工作日 · ${fmtMD(wd)}`, `${meals.length} 餐`)}<ul class="meal-list">${list || '<li class="card muted">這個工作日還沒有用餐紀錄。</li>'}</ul>`;
  const form = mealForm(ui, now, editing, data);
  const body = ctx.isDesktop
    ? `<div class="grid-2-1"><div class="stack">${pendingHTML}${listHTML}</div><div class="stack">${form}</div></div>`
    : `${pendingHTML}${form}${listHTML}`;
  return `${pageHead('用餐', '先記時間，其他選填')}<section class="card">${lastMealLine(data, now)}</section>${body}`;
}
