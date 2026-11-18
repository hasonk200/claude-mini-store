import { esc, icon, seg } from '../ui.js';
import { fmtTime, wdOf, fmtMD, dateKey } from '../time.js';
import { status, demoMode } from '../store.js';
import { sleepWorkdayChanges } from '../logic.js';
import { syncState } from '../sync.js';
import { pageHead } from './shared.js';

const PAY = { hourly: '時薪', perOrder: '按單（整次實收）', none: '不計薪' };

function jobsCard(data, ui) {
  const editing = ui.jobEdit ? data.jobs.find((j) => j.id === ui.jobEdit) : null;
  const list = data.jobs.map((j) => {
    const used = data.sessions.some((s) => s.jobId === j.id);
    return `<li><i class="sw k-${j.color === 'deliv' ? 'deliv' : 'work'}"></i><div><strong>${esc(j.name)}</strong><span>${PAY[j.payMode] || ''}${j.payMode === 'hourly' && j.rate != null ? ` · $${j.rate}/小時` : ''}</span></div>
      <button type="button" class="btn btn-line btn-sm" data-action="job-edit" data-id="${j.id}" aria-label="修改 ${esc(j.name)}">修改</button>
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
      <label class="field" data-job-rate ${j.payMode && j.payMode!=='hourly'?'hidden':''}><span>每小時薪金（時薪工作）</span><input type="number" name="rate" step="0.01" min="0" value="${j.rate ?? ''}" inputmode="decimal"></label></div>
      <p class="fine">改時薪只影響之後的出勤；舊紀錄保留當時的計薪快照。</p>
      <div class="btn-wrap"><button class="btn btn-ink" type="submit">${editing ? '儲存修改' : '新增工作'}</button>${editing ? '<button class="btn btn-line" type="button" data-action="job-cancel">取消</button>' : ''}</div>
    </form></details></section>`;
}

function cloudCard() {
  if (demoMode) return '<section class="card"><h2 class="card-title">雲端同步</h2><p>示範模式的紀錄只存在這部裝置。</p></section>';
  const sy = syncState();
  const T = { off: '未開啟', signin: '未登入', loading: '正在連線…', cloud: '已同步', error: '同步失敗', offline: '離線中', full: '雲端空間不足' };
  const signed = !!sy.user;
  return `<section class="card" aria-label="雲端同步"><div class="card-head"><h2 class="card-title">雲端同步</h2><span class="chip ${sy.status === 'cloud' ? 'chip-real' : 'chip-plan'}">${sy.status==='cloud' && sy.pending?'待同步':T[sy.status] || ''}</span></div>
    ${signed ? `<div class="status-line"><i class="dot ${sy.status === 'cloud' ? 'k-ok' : 'is-warn'}"></i><div><strong>${esc(sy.user.name || sy.user.email)}</strong><span>${esc(sy.user.email)}${sy.lastSync ? ` · 最後同步 ${fmtTime(sy.lastSync)}` : ''}</span></div></div>` : ''}
    <p class="fine">${signed ? `待同步 ${sy.pending} 筆 · ${sy.lastSync ? '上次成功 '+dateKey(sy.lastSync)+' '+fmtTime(sy.lastSync) : '等候首次上傳'}` : `本機有 ${sy.pending} 筆紀錄或修改；登入後可核對雲端。`}</p>
    ${['offline','error','full'].includes(sy.status) ? '<button class="btn btn-line" data-action="sync-retry">檢查網絡後再試同步</button>' : ''}
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
      <label class="btn btn-line file-btn">${icon('upload', 18, 2)}匯入 JSON／完整 CSV 備份<input type="file" accept=".csv,.json,application/json,text/csv" data-action="import-json" hidden></label>
      <button type="button" class="btn btn-line" data-action="export-csv">${icon('download', 18, 2)}匯出工時報表 CSV</button>
      <button class="btn btn-line" data-action="export-full-csv">匯出完整 CSV 備份</button>
      <button class="btn btn-line" data-action="temp-open">從臨時版匯入</button>
      <button class="btn btn-line" data-action="recovery-download">下載上次取代前的備份</button>
      <button type="button" class="btn btn-line" data-action="sleep-wd-reset">重新計算睡眠歸屬${changes ? `（${changes} 筆）` : ''}</button>
    </div>
    <p class="fine">${resetLine}手動指定過的不受影響。</p>
    <fieldset class="radio-row"><legend>匯入時</legend>
      <label><input type="radio" name="importMode" value="merge" checked> 合併：只加入新的紀錄</label>
      <label><input type="radio" name="importMode" value="replace"> 取代：用備份覆蓋目前資料</label>
    </fieldset>
    <p class="fine">JSON 備份包含所有紀錄和用餐相片，可以用來搬到另一部裝置。完整 CSV 也可以還原全部資料；工時報表 CSV 供試算表查看。</p>
  </section>`;
}

function reminderCard(prefs = {}) {
  const options = [
    ['sleep', '睡眠提醒', '起身後 20 小時未記睡眠'],
    ['home', '到家提醒', '收工後 3 小時未記到家'],
    ['meal', '用餐提醒', '上一餐後 6 小時未記用餐'],
    ['income', '收入提醒', '按單班次收工後 48 小時內仍未填收入'],
  ];
  return `<section class="card" aria-label="漏記提醒">
    <h2 class="card-title">漏記提醒</h2>
    <div class="reminder-list">${options.map(([key, label, detail]) => `
      <label class="reminder-row">
        <span><strong id="reminder-${key}">${label}</strong><small id="reminder-${key}-detail">${detail}</small></span>
        <input type="checkbox" role="switch" data-action="reminder-set" data-key="${key}" aria-labelledby="reminder-${key}" aria-describedby="reminder-${key}-detail"${prefs?.[key] !== false ? ' checked' : ''}>
        <span class="reminder-state" aria-hidden="true"><span class="when-on">已開啟</span><span class="when-off">已關閉</span></span>
      </label>`).join('')}</div>
    <button class="btn btn-line" data-action="export-ics">匯出行事曆提醒</button>
    <p class="fine">手機行事曆會在排班下班後 30 分鐘及計畫起身時間提示。更改計畫後可重新匯出。</p>
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
          <p class="fine">深色模式適合夜班和睡前使用。首頁時間帶同頁頂底色會跟時段（夜晚、清晨、日間、黃昏）轉色。</p>
          <label class="reminder-row"><span><strong id="scene-label">首頁街景插畫</strong><small id="scene-detail">喺首頁最頂加一幅會跟時間變化嘅街景</small></span><input type="checkbox" role="switch" data-action="hero-toggle" aria-labelledby="scene-label" aria-describedby="scene-detail"${ui.heroCollapsed ? '' : ' checked'}><span class="reminder-state" aria-hidden="true"><span class="when-on">已開啟</span><span class="when-off">已關閉</span></span></label>
        </section>
        ${jobsCard(data, ui)}
      </div>
      <div class="stack">
        ${reminderCard(st.reminders)}
        ${cloudCard()}
        ${dataCard(data)}
        <section class="card" aria-label="安裝與示範"><div class="card-head"><h2 class="card-title">安裝與示範</h2></div>
          <p class="fine">在手機瀏覽器選「加到主畫面」，就可以像 App 一樣開啟；首次開啟後可以離線使用。</p>
          <div class="btn-wrap">${ui.canInstall ? '<button type="button" class="btn btn-ink" data-action="install">安裝 App</button>' : ''}
          <button type="button" class="btn btn-line" data-action="demo">載入示範資料</button>
          <button type="button" class="btn btn-danger" data-action="clear-all">清除所有資料</button></div>
          <p class="fine">示範模式有獨立資料，清除個人紀錄前會自動保存完整備份。</p>
          <p class="fine">目前版本：<strong>${esc(ui.appVersion || '讀取中…')}</strong></p>
        </section>
      </div>
    </div>`;
}
