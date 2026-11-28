'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {replay, summarize} = require('../site/tools/gld-play-history.js');
const {runQuote, atDay} = require('../site/tools/gld-plays-model.js');

const csv = fs.readFileSync(path.join(__dirname, '../site/data/metals/gld.csv'), 'utf8');
const [header, ...lines] = csv.trim().split(/\r?\n/);
const columns = header.split(','), dateColumn = columns.indexOf('date'), priceColumn = columns.indexOf('close');
const rows = lines.map(line => {
  const cells = line.split(',');
  return {date: cells[dateColumn], close: cells[priceColumn]};
});
// Anchors and first 110% barrier observations independently checked against
// the issuer's NYSE archive at https://www.spdrgoldshares.com/usa/gld/.
const cases = [
  ['rebound', 253, '2020-03-18', 140.70, '2021-03-18', 162.56, ['ko', 13, '2020-04-06', 156.88]],
  ['recovery', 438, '2022-03-08', 191.51, '2023-12-01', 192.01, ['maturity', 252, '2023-03-09', 170.20]],
  ['bear', 2249, '2011-08-22', 184.59, '2020-07-29', 185.13, ['maturity', 252, '2012-08-21', 158.83]],
  ['whipsaw', 250, '2023-01-03', 171.06, '2023-12-29', 191.17, ['ko', 69, '2023-04-13', 189.72]],
  ['sideways', 124, '2017-08-31', 125.82, '2018-02-28', 125.00, null]
];
const quote = {months: 12, days: 252, strike: 90, ko: 110, guaranteeDays: 0};
const cfg = {
  budget: 100000, reserve: 1000, acc: {dailyShares: 1}, decu: {days: 21, strike: 105, ko: 90},
  waitDays: 1, maxRolls: 2, firstBuyPct: 50, dipPct: 10
};

for (const [id, count, start, entry, end, terminal, expectedExit] of cases) {
  const historical = replay(rows, id), summary = summarize(rows, id);
  assert.equal(historical.id, id);
  assert.equal(historical.label, summary.name);
  assert.equal(historical.prices.length, count);
  assert.deepEqual([historical.dates[0], historical.prices[0], historical.dates.at(-1), historical.prices.at(-1)],
    [start, entry, end, terminal]);
  const source = rows.filter(row => row.date >= start && row.date <= end);
  assert.deepEqual(historical.prices, source.map(row => Number(row.close)));
  assert.deepEqual(historical.dates, source.map(row => row.date));
  assert.ok(historical.prices.length > summary.points.length);
  assert.deepEqual(historical.checkpoints[0], {day: 0, label: 'Entry'});
  assert.deepEqual(historical.checkpoints.at(-1), {day: count - 1, label: 'End'});
  assert.ok(historical.checkpoints.every((point, i, a) => !i || point.day > a[i - 1].day));
  assert.equal(replay(source.slice(0, -1), id), null);
  assert.equal(replay(source.slice(1), id), null);
  assert.equal(replay(source.filter((_, i) => i !== 7), id), null);

  const run = runQuote(cfg, quote, historical.prices);
  if (expectedExit) {
    const event = run.firstExit;
    assert.deepEqual([event.type, event.day, historical.dates[event.day], event.price], expectedExit);
    if (event.type === 'ko') {
      assert.equal(run.postKo.price, historical.prices[event.day]);
      assert.deepEqual(atDay(run, event.day - 1, true), {leaders: [], outcomes: {}});
    } else assert.equal(run.postKo, null);
  } else {
    assert.equal(run.firstExit, null);
    assert.equal(run.postKo, null);
    assert.equal(run.strategies.find(s => s.key === 'acc').open.remainingDays, 129);
  }
  assert.deepEqual(atDay(run, count), {leaders: [], outcomes: {}});
}

const rebound = replay(rows, 'rebound');
const entireRun = runQuote(cfg, quote, rebound.prices);
for (const day of [5, 12, 13, 14, 64]) {
  const prefix = runQuote(cfg, quote, rebound.prices.slice(0, day + 1));
  assert.deepEqual(atDay(prefix, day), atDay(entireRun, day));
  assert.deepEqual(atDay(prefix, day, true).leaders, atDay(entireRun, day, true).leaders);
  // When the last observation itself is the KO, the post-KO ledger explicitly
  // says the horizon has ended. Compare states on equal-length divergent futures.
  const changedFuture = rebound.prices.map((price, i) => i <= day ? price : 1);
  const different = runQuote(cfg, quote, changedFuture);
  assert.deepEqual(atDay(different, day), atDay(entireRun, day));
  assert.deepEqual(atDay(different, day, true), atDay(entireRun, day, true));
}
const sideways = replay(rows, 'sideways');
const monthOne = sideways.checkpoints.find(p => p.label === 'Month 1');
// September 30, 2017 fell on a Saturday.
assert.equal(sideways.dates[monthOne.day], '2017-09-29');
const corrupt = rows.map(row => row.date === '2017-09-29' ? {date: '2017-09-30', close: row.close} : row);
assert.equal(replay(corrupt, 'sideways'), null);
assert.equal(replay(rows, 'unknown'), null);
console.log('Complete GLD calendars, archived fixings, real-date KO and maturity, unfinished tenors and prefix rankings passed.');
