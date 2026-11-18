import { RECORD_KEYS } from './store.js';

// The spreadsheet report remains separate. Each backup row contains one JSON value.
// JSON escapes embedded line breaks, leaving exactly one physical line per record.
const HEADER = 'OnTime CSV 1,JSON';
const cell = value => '"' + JSON.stringify(value).replace(/"/g, '""') + '"';
export function backupCSV(data) {
  const meta = Object.fromEntries(Object.entries(data).filter(([key]) => !RECORD_KEYS.includes(key)));
  const lines = [HEADER, 'meta,' + cell(meta)];
  for (const key of RECORD_KEYS) for (const record of data[key]) lines.push(key + ',' + cell(record));
  lines.push('total,' + cell(lines.length-2));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
export function decodeCSV(text) {
  const [header, ...rows] = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  if (header !== HEADER) throw Error('請選 OnTime 完整 CSV 備份；工時報表不能還原。');
  const data = Object.fromEntries(RECORD_KEYS.map(k => [k, []]));
  const footer=rows.pop();
  if(footer !== 'total,'+cell(rows.length-1)) throw Error('ONTIME CSV 筆數不符或匯出不完整');
  let meta = false;
  for (const row of rows) {
    const match = /^([A-Za-z]+),"((?:[^"]|"")*)"$/.exec(row);
    if (!match) throw Error('ONTIME CSV 格式錯誤');
    const value = JSON.parse(match[2].replace(/""/g, '"'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('ONTIME CSV 資料不完整');
    if (match[1] === 'meta' && !meta && value.version === 1 && value.settings) {
      for (const [k,v] of Object.entries(value)) if (!RECORD_KEYS.includes(k) && k !== '__proto__') data[k] = v;
      meta = true;
    } else if (RECORD_KEYS.includes(match[1]) && (value.id || value.date)) data[match[1]].push(value);
    else throw Error('ONTIME CSV 資料類別錯誤');
  }
  if (!meta) throw Error('ONTIME CSV 缺少設定');
  return data;
}
