// 讀取舊版 ONTIME 的備份（format: "dicky-ontime-backup"）。
// 舊版把每次修改存成一個版本紀錄；這裡取每筆資料的最新版本，再轉成新版的資料格式。
import { emptyData, normalize } from './store.js';
import { HOUR } from './time.js';

export const isLegacyBackup = (obj) => !!obj && obj.format === 'dicky-ontime-backup' && Array.isArray(obj.revisions);

const cents = (v) => (v == null ? null : Math.round(v) / 100);
const PAY = { hourly: 'hourly', perOrder: 'perOrder', per_order: 'perOrder', order: 'perOrder', orders: 'perOrder', delivery: 'perOrder', none: 'none' };
const MEAL_NAME = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '小食', supper: '宵夜', lateNight: '宵夜' };

function isDeleted(p) {
  return !p || p.deleted === true || p.deletedAtMs != null || p.isDeleted === true;
}

// 每筆資料的最新版本：不是任何其他版本的上一版；有多個時取最晚建立的。
export function latestPayloads(revisions) {
  const parents = new Set(revisions.flatMap((r) => r.parentIds || []));
  const heads = new Map();
  for (const r of revisions) {
    if (parents.has(r.revisionId)) continue;
    const key = `${r.entityType}:${r.entityId}`;
    const prev = heads.get(key);
    if (!prev || (r.createdAtMs ?? 0) > (prev.createdAtMs ?? 0)) heads.set(key, r);
  }
  const out = {};
  for (const r of heads.values()) {
    if (isDeleted(r.payload)) continue;
    (out[r.entityType] = out[r.entityType] || []).push({ ...r.payload, id: r.payload.id ?? r.entityId });
  }
  return out;
}

function jobColor(job) {
  const n = `${job.name || ''} ${job.location || ''}`.toLowerCase();
  return /deliver|外送|uber|doordash|skip|food/.test(n) ? 'deliv' : 'work';
}

export function convertLegacy(obj) {
  const L = latestPayloads(obj.revisions);
  const d = emptyData();
  const jobs = L.job || []; // 已封存的工作也保留，舊紀錄仍會用到
  for (const j of jobs) {
    d.jobs.push({
      id: j.id, name: j.name || '工作', color: jobColor(j), payMode: PAY[j.payMode] || 'hourly',
      rate: cents(j.hourlyRateCents), location: j.location || ''
    });
  }
  const firstJob = jobs[0];
  if (firstJob) {
    if (firstJob.commuteOutMinutes != null) d.settings.commuteOutMin = firstJob.commuteOutMinutes;
    if (firstJob.commuteBackMinutes != null) d.settings.commuteBackMin = firstJob.commuteBackMinutes;
  }
  const jobById = new Map(d.jobs.map((j) => [j.id, j]));

  for (const sh of L.shift || []) {
    const start = sh.startMs ?? sh.plannedStartMs;
    const end = sh.endMs ?? sh.plannedEndMs;
    if (start == null || end == null) continue;
    d.shifts.push({ id: sh.id, jobId: sh.jobId, start, end });
  }

  for (const s of L.session || []) {
    if (s.startMs == null) continue;
    const job = jobById.get(s.jobId);
    d.sessions.push({
      id: s.id, jobId: s.jobId, shiftId: s.shiftId ?? null, start: s.startMs, end: s.endMs ?? null,
      breaks: (s.breaks || []).map((b) => ({ start: b.startMs ?? b.start, end: b.endMs ?? b.end ?? null })).filter((b) => b.start != null),
      payMode: PAY[s.payModeSnapshot] || job?.payMode || 'hourly',
      rate: cents(s.paySnapshotCents) ?? job?.rate ?? null,
      income: cents(s.actualIncomeCents),
      orders: s.orderCount ?? s.orders ?? s.completedOrders ?? null,
      note: s.note || ''
    });
  }

  for (const j of L.journey || []) {
    const out = j.leaveHomeMs ?? null;
    const home = j.arriveHomeMs ?? null;
    // 舊版的 sessionIds 可能是空的：用時間找回同一趟的出勤。
    let sessionId = (j.sessionIds || []).find((id) => d.sessions.some((s) => s.id === id)) || null;
    if (!sessionId) {
      const from = (out ?? j.boardOutboundMs ?? j.arriveDestinationMs) - HOUR;
      const to = (home ?? j.boardReturnMs ?? j.leaveDestinationMs ?? from + 20 * HOUR) + HOUR;
      const match = d.sessions
        .filter((s) => s.start >= from && s.start <= to && (!j.jobId || s.jobId === j.jobId))
        .filter((s) => !d.journeys.some((x) => x.sessionId === s.id))
        .sort((a, b) => a.start - b.start)[0];
      sessionId = match?.id ?? null;
    }
    d.journeys.push({
      id: j.id, sessionId, out, ride: j.boardOutboundMs ?? null, arrive: j.arriveDestinationMs ?? null,
      leave: j.leaveDestinationMs ?? null, ride2: j.boardReturnMs ?? null, home, note: j.note || ''
    });
  }

  for (const m of L.meal || []) {
    if (m.startMs == null) continue;
    const photo = typeof m.photo === 'string' ? m.photo : m.photo?.dataUrl ?? null;
    d.meals.push({
      id: m.id, start: m.startMs, end: m.endMs ?? null, confirmed: m.confirmed !== false,
      name: m.food || MEAL_NAME[m.kind] || '', kind: m.kind || '', place: m.location || '', note: m.note || '', photo
    });
  }

  for (const s of L.sleep || []) {
    if (s.actualStartMs == null && s.plannedStartMs == null) continue;
    const sl = {
      id: s.id, start: s.actualStartMs ?? null, end: s.actualEndMs ?? null,
      planStart: s.plannedStartMs ?? null, planEnd: s.plannedEndMs ?? null, note: s.note || ''
    };
    if ('workdayDate' in s) sl.workdayDate = s.workdayDate;
    d.sleeps.push(sl);
  }

  for (const m of L.dayMark || L.dayMarks || []) {
    if (m.date) d.dayMarks.push({ date: m.date, kind: m.kind || 'off' });
  }

  const st = (L.settings || [])[0];
  if (st) {
    d.settings.name = st.name || '';
    if (st.theme === 'dark' || st.theme === 'light') d.settings.theme = st.theme;
  }
  return normalize(d);
}
