import { esc, icon, seg } from '../ui.js';
import { fmtTime, wdOf, fmtMD, dateKey } from '../time.js';
import { status } from '../store.js';
import { sleepWorkdayChanges } from '../logic.js';
import { syncState } from '../sync.js';
import { pageHead } from './shared.js';

const PAY = { hourly: '時薪', perOrder: '按單（整次實收）', none: '不計薪' };

function jobsCard(data, ui) {
  const editing = ui.jobEdit ? data.jobs.find((j) => j.id === ui.jobEdit) : null;
  const list = data.jobs.map((j) => {
    const used = data.sessions.some((s) => s.jobId === j.id);
    return `<li><i class="sw k-${j.color === 'deliv' ? 'deliv' : 'work'}"></i><div><strong>${esc(j.name)}</strong><span>${PAY[j.payMode] || ''}${j.payMode === 'hourly' && j.rate != null ? ` · $${j.rate}/小時` : ''}</span></div>
      <button type="button" class="icon-btn icon-btn-sm" data-action="job-edit" data-id="${j.id}" aria-label="修改 ${esc(j.name)}">${icon('edit', 16)}</button>
      ${used ? '' : `<button type="button" class="icon-btn icon-btn-sm" data-action="job-delete" data-id="${j.id}" aria-label="刪除 ${esc(j.name)}">${icon('trash', 16)}</button>`}</li>`;
  }).join('');
  const j = editing || {};
  return `<section class="card" aria-label="工作設定"><div class="card-head"><h2 class="card-title">工作設定</h2></div>
    ${list ? `<ul class="plain-list job-list">${list}</ul>` : '<p class="muted">還沒有工作。第一次按「上班」時會自動建立「我的工作」。</p>'}
    <details class="more"${editing ? ' open' : ''}><summary>${editing ? `修改「${esc(j.name)}」` : '新增工作'}</summary>
    <form class="form" data-form="job"><input type="hidden" name="id" value="${esc(j.id || '')}">
      <div class="field-pair"><label class="field"><span>名稱</span><input name="name" value="${esc(j.name || '')}" placeholder="例如：倉庫夜班" required></label>
      <label class="field"><span>顏色</span><select name="color"><option value="work"${j.color !== 'deliv' ? ' selected' : ''}>橙色（主要工作）</option><option value="deliv"${j.color === 'deliv' ? ' selected' : ''}>綠色（外送／第二份）</option></select></label></div>
      <div class="field-pair"><label class="field"><span>計算方式</span><select name="payMode">${Object.entries(PAY).map(([k, v]) => `<option value="${k}"${(j.payMode || 'hourly') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>時薪（選填）</span><input type="number" name="rate" step="0.01" min="0" value="${j.rate ?? ''}" inputmode="decimal"></label></div>
      <p class="fine">改時薪只影響之後的出勤；舊紀錄保留當時的計薪快照。</p>
      <div class="btn-wrap"><button class="btn btn-ink" type="submit">${editing ? '儲存修改' : '新增工作'}</button>${editing ? '<button class="btn btn-line" type="button" data-action="job-cancel">取消</button>' : ''}</div>
    </form></details></section>`;
}

function cloudCard() {
  const sy = syncState();
  const T = { off: '未開啟', signin: '未登入', loading: '正在連線…', cloud: '已同步', error: '同步失敗', offline: '離線中', full: '雲端空間不足' };
  const signed = !!sy.user;
  return `<section class="card" aria-label="雲端同步"><div class="card-head"><h2 class="card-title">雲端同步</h2><span class="chip ${sy.status === 'cloud' ? 'chip-real' : 'chip-plan'}">${T[sy.status] || ''}</span></div>
    ${signed ? `<div class="status-line"><i class="dot ${sy.status === 'cloud' ? 'k-ok' : 'is-warn'}"></i><div><strong>${esc(sy.user.name || sy.user.email)}</strong><span>${esc(sy.user.email)}${sy.lastSync ? ` · 最後同步 ${fmtTime(sy.lastSync)}` : ''}</span></div></div>` : ''}
    ${sy.message ? `<p class="fine">${esc(sy.message)}</p>` : ''}
    <p class="fine">用 Google 帳戶登入後，紀錄會同步到雲端；換手機或電腦登入同一個帳戶就能看到。沒有網絡時照樣記錄，連線後自動上傳。</p>
    <div class="btn-wrap">${signed
      ? '<button type="button" class="btn btn-line" data-action="sync-out">登出同步</button>'
      : `<button type="button" class="btn btn-ink" data-action="sync-in"${sy.status === 'loading' ? ' disabled' : ''}>${icon('user', 18, 2)}用 Google 登入同步</button>`}</div>
    <p class="fine">第一次登入時，雲端已有的紀錄為準，再加入這部裝置上獨有的紀錄。兩部裝置同時修改同一筆紀錄時，以最後儲存的為準。</p>
  </section>`;
}

function dataCard(data) {
  const st = status();
  const counts = `${data.sessions.length} 次出勤 · ${data.sleeps.length} 筆睡眠 · ${data.meals.length} 餐`;
  const changes = sleepWorkdayChanges(data).length;
  const resetLine = changes
    ? `有 ${changes} 筆睡眠的所屬工作日是舊版寫死的，重新計算會依入睡時間歸屬。`
    : '全部睡眠的所屬工作日都已是最新。';
  return `<section class="card" aria-label="資料與備份"><div class="card-head"><h2 class="card-title">資料與備份</h2></div>
    <div class="status-line"><i class="dot ${st.saveError ? 'is-warn' : 'k-ok'}"></i><div><strong>${st.saveError ? esc(st.saveError) : '已儲存在這部裝置'}</strong><span>${counts}${st.lastSaved ? ` · 最後儲存 ${fmtTime(st.lastSaved)}` : ''}</span></div></div>
    <p class="fine">${st.persisted === true ? '已受保護：瀏覽器不會在空間不足時自動清除這些紀錄。' : '瀏覽器可能在空間不足時清除本機紀錄，請定期匯出備份或登入雲端同步。'}</p>
    <p class="fine">紀錄先存在這個瀏覽器，沒有網絡也能用。清除網站資料或換裝置前，請先匯出備份。</p>
    <div class="data-actions">
      <button type="button" class="btn btn-ink" data-action="export-json">${icon('download', 18, 2)}匯出 JSON 備份</button>
      <label class="btn btn-line file-btn">${icon('upload', 18, 2)}匯入 JSON 備份<input type="file" accept="application/json,.json" data-action="import-json" hidden></label>
      <button type="button" class="btn btn-line" data-action="export-csv">${icon('download', 18, 2)}匯出 CSV（試算表）</button>
      <button type="button" class="btn btn-line" data-action="sleep-wd-reset">重新計算睡眠歸屬${changes ? `（${changes} 筆）` : ''}</button>
    </div>
    <p class="fine">${resetLine}手動指定過的不受影響。</p>
    <fieldset class="radio-row"><legend>匯入時</legend>
      <label><input type="radio" name="importMode" value="merge" checked> 合併：只加入新的紀錄</label>
      <label><input type="radio" name="importMode" value="replace"> 取代：用備份覆蓋目前資料</label>
    </fieldset>
    <p class="fine">JSON 備份包含所有紀錄和用餐相片，可以用來搬到另一部裝置。CSV 只包含出勤、通勤和收入，方便用試算表查看。</p>
  </section>`;
}

export function settingsView(ctx) {
  const { data, ui } = ctx;
  const st = data.settings;
  return `${pageHead('我的', '個人設定、工作與資料')}
    <div class="grid-2">
      <div class="stack">
        <section class="card" aria-label="個人設定"><form class="form" data-form="settings">
          <div class="card-head"><h2 class="card-title">個人設定</h2></div>
          <label class="field"><span>稱呼（選填）</span><input name="name" value="${esc(st.name || '')}"></label>
          <div class="field-pair"><label class="field"><span>預估去程（分鐘）</span><input type="number" name="commuteOutMin" min="0" max="300" value="${st.commuteOutMin ?? 45}"></label>
          <label class="field"><span>預估回程（分鐘）</span><input type="number" name="commuteBackMin" min="0" max="300" value="${st.commuteBackMin ?? 45}"></label></div>
          <p class="fine">只用來估算睡前未安排時間；實際通勤以你的打卡為準。</p>
          <button class="btn btn-ink" type="submit">儲存</button>
        </form></section>
        <section class="card" aria-label="外觀"><div class="card-head"><h2 class="card-title">外觀</h2></div>
          ${seg('theme', '顏色模式', [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']], st.theme || 'auto')}
          <p class="fine">深色模式適合夜班和睡前使用；頂部場景仍然跟著當地時間變化。</p>
        </section>
        ${jobsCard(data, ui)}
      </div>
      <div class="stack">
        ${cloudCard()}
        ${dataCard(data)}
        <section class="card" aria-label="安裝與示範"><div class="card-head"><h2 class="card-title">安裝與示範</h2></div>
          <p class="fine">在手機瀏覽器選「加到主畫面」，就可以像 App 一樣開啟；首次開啟後可以離線使用。</p>
          <div class="btn-wrap">${ui.canInstall ? '<button type="button" class="btn btn-ink" data-action="install">安裝 App</button>' : ''}
          <button type="button" class="btn btn-line" data-action="demo">載入示範資料</button>
          <button type="button" class="btn btn-danger" data-action="clear-all">清除所有資料</button></div>
          <p class="fine">載入示範資料和清除資料都會取代目前的紀錄，執行前會再問一次。</p>
          <p class="fine">目前版本：<strong>${esc(ui.appVersion || '讀取中…')}</strong></p>
        </section>
      </div>
    </div>`;
}
