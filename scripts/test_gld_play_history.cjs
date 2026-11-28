'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {summarize} = require('../site/tools/gld-play-history.js');

const csv = fs.readFileSync(path.join(__dirname, '../site/data/metals/gld.csv'), 'utf8');
const [header, ...lines] = csv.trim().split(/\r?\n/);
const keys = header.split(',');
const rows = lines.map(line => {
  const cells = line.split(',');
  return {date: cells[keys.indexOf('date')], close: cells[keys.indexOf('close')]};
});
const expected = [
  ['rebound', 253, '2020-03-18', '2021-03-18', '2020-03-19', 138.04, 15.54, -1.89, -18.77],
  ['recovery', 438, '2022-03-08', '2023-12-01', '2022-09-26', 151.23, 0.26, -21.03, -21.03],
  ['bear', 2249, '2011-08-22', '2020-07-29', '2015-12-17', 100.5, 0.29, -45.56, -45.56],
  ['whipsaw', 250, '2023-01-03', '2023-12-29', '2023-02-24', 168.35, 11.76, -1.58, -11.35],
  ['sideways', 124, '2017-08-31', '2018-02-28', '2017-12-11', 118.01, -0.65, -6.21, -7.90]
];
const rounded = n => Number(n.toFixed(2));
for (const [id, count, start, end, lowDate, lowPrice, terminalPct, lowPct, maxDrawdownPct] of expected) {
  const h = summarize(rows, id);
  assert.deepEqual([h.observations, h.first.date, h.last.date, h.low.date, h.low.price], [count, start, end, lowDate, lowPrice]);
  assert.deepEqual([rounded(h.terminalPct), rounded(h.lowPct), rounded(h.maxDrawdownPct)], [terminalPct, lowPct, maxDrawdownPct]);
  assert.equal(h.first.day, 0);
  assert.equal(h.last.day, h.observations - 1);
  assert.ok(h.points.length <= 80 && h.points.length > 2);
  for (const p of [h.first, h.last, h.high, h.low, h.drawdownPeak, h.drawdownTrough]) assert.ok(h.points.includes(p));
  for (let i = 1; i < h.points.length; i++) {
    assert.ok(h.points[i].day > h.points[i - 1].day && h.points[i].date > h.points[i - 1].date);
  }
  assert.equal(h.maxDrawdownPct, (h.drawdownTrough.price / h.drawdownPeak.price - 1) * 100);
  const observed = rows.filter(r => r.date >= start && r.date <= end);
  assert.equal(summarize(observed.slice(1), id), null);
  assert.equal(summarize(observed.slice(0, -1), id), null);
  assert.equal(summarize(observed.filter(r => r.date !== lowDate), id), null);
  assert.equal(summarize([...observed, {date: start, close: 0}], id), null);
  assert.equal(summarize([...observed, {date: start, close: Number(observed[0].close) + 1}], id), null);
  assert.deepEqual(summarize([observed[0], ...observed].reverse(), id), h);
  if (id === 'bear' || id === 'recovery') {
    assert.ok(observed.slice(1, -1).every(r => Number(r.close) < h.first.price));
    assert.ok(h.last.price > h.first.price);
  }
}

// An always-rising series has a positive post-entry low and zero drawdown.
const rising = rows.filter(r => r.date >= '2017-08-31' && r.date <= '2018-02-28')
  .map((r, index) => ({date: r.date, close: 100 + index}));
const steady = summarize(rising, 'sideways');
assert.equal(steady.low.day, 1);
assert.ok(steady.lowPct > 0);
assert.equal(steady.maxDrawdownPct, 0);
assert.deepEqual(steady.drawdownPeak, steady.drawdownTrough);
assert.equal(summarize([], 'rebound'), null);
assert.equal(summarize(rows, 'unknown'), null);
assert.equal(summarize(null, 'bear'), null);
console.log('Five historical GLD windows, drawdown landmarks, chart sampling and coverage checks passed.');
