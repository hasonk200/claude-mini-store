// 自己打時間：各種寫法都整理成 HH:MM。
import test from 'node:test';
import assert from 'node:assert/strict';
import { normTime } from '../js/time.js';

test('打數字就能變成時間', () => {
  const ok = { '1830': '18:30', '930': '09:30', '0930': '09:30', '18': '18:00', '6': '06:00', '18:30': '18:30', '8:5': '08:05', '１８：３０': '18:30', '18.30': '18:30', ' 0700 ': '07:00', '0': '00:00', '2359': '23:59' };
  for (const [k, v] of Object.entries(ok)) assert.equal(normTime(k), v, k);
});

test('空白可以（可空白的欄位）', () => assert.equal(normTime(''), ''));

test('看不懂或不合理的時間回傳 null', () => {
  for (const k of ['2460', '25', '1890', 'abc', '18:3a', '12345']) assert.equal(normTime(k), null, k);
});
