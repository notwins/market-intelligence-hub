'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const plays = require('../site/tools/gld-plays-model.js');
const history = require('../site/tools/gld-play-history.js');
const {next, explain, compare} = require('../site/tools/gld-leader-changes.js');

const terms = {budget: 720, acc: {dailyShares: 2}, roll: {days: 2, strike: 90, ko: 110, dailyShares: 1},
  decu: {days: 2, strike: 110, ko: 90, gear: 2}, waitDays: 2, maxRolls: 2, firstBuyPct: 50, dipPct: 10};
const quote = {months: 2, days: 4, strike: 90, ko: 110, guarantee: 1};
const prices = [100, 110, 100, 100, 100, 110, 100, 90, 100, 110, 110.001, 110];
const run = plays.runQuote(terms, quote, prices);
const all = ['hold', 'acc', 'roll', 'decu', 'wait', 'staged'];
const cents = n => Math.round(n * 100);
assert.deepEqual(next(run, 0), {status: 'change', anchorDay: 1, endDay: 11, day: 4,
  before: all, leaders: ['roll', 'decu']});
for (const [from, to, leaders] of [[3, 4, ['roll', 'decu']], [4, 5, ['hold']], [5, 6, ['decu']],
  [6, 9, ['hold', 'wait', 'staged']], [8, 9, ['hold', 'wait', 'staged']]]) {
  const move = next(run, from);
  assert.deepEqual([move.day, move.leaders], [to, leaders]);
}
assert.equal(next(run, 9).status, 'no-change');
assert.equal(next(run, 11).day, null);
assert.equal(next(run, 12).status, 'unavailable');
assert.equal(next(null, 0).status, 'unavailable');

const at = (day, extra = {}) => explain({run, terms, quote, prices, day, ...extra});
assert.equal(at(0), null);
assert.equal(at(12), null);
const anchor = at(1);
assert.deepEqual(anchor.leaders, []);
assert.equal(anchor.difference, null);
assert.ok(Object.values(anchor.policies).every(s => s.pnl === 0 && s.daily === null && s.cash === anchor.koCash && s.shares === anchor.koShares));

// Shares and cash are marked at the actual fixing, including ordinary daily
// trades not recorded as separate events between contract opening and exit.
for (let day = 2; day < prices.length; day++) {
  const evidence = at(day), prior = plays.atDay(run, day - 1, true);
  const prefix = plays.runQuote(terms, quote, prices.slice(0, day + 1));
  for (const key of all) {
    const s = evidence.policies[key], pos = prefix.postKo.strategies.find(r => r.key === key);
    assert.deepEqual([s.cash, s.shares], [pos.cash, pos.shares]);
    assert.equal(cents(s.cash) + s.shares * cents(evidence.price), cents(s.value));
    assert.ok(s.events.every(e => e.day <= day));
    assert.equal(cents(s.cash) - cents(s.freeCash), cents(s.committedCash));
    assert.equal(cents(s.daily.pnlChange), cents(s.pnl) - cents(prior.outcomes[key].pnl));
    assert.equal(cents(s.daily.marketMove) + cents(s.daily.tradeEffect), cents(s.daily.pnlChange));
  }
  for (const key of ['acc', 'roll', 'decu']) {
    const winner = evidence.leaders[0], pair = compare(evidence, winner, key);
    if (!pair) { assert.ok(winner === key || !evidence.policies[key].eligible); continue; }
    assert.equal(cents(pair.cashDifference) + cents(pair.holdingDifference), cents(pair.gap));
    assert.equal(cents(pair.gap), cents(evidence.policies[winner].pnl) - cents(evidence.policies[key].pnl));
    assert.equal(cents(pair.marketMoveDifference) + cents(pair.tradeEffectDifference), cents(pair.gapMove));
    assert.equal(cents(pair.previousGap) + cents(pair.gapMove), cents(pair.gap));
  }
}
const tied = at(4);
assert.deepEqual(tied.leaders, ['roll', 'decu']);
assert.equal(tied.difference.gap, 0);
assert.ok(tied.nextBestDifference.gap > 0);
const otherPrices = [...prices.slice(0, 5), 3, 1, 77, 90, 80, 70, 60];
const otherRun = plays.runQuote(terms, quote, otherPrices);
assert.deepEqual(at(4), at(4, {run: otherRun, prices: otherPrices}));
const short = plays.runQuote(terms, quote, prices.slice(0, 4));
assert.equal(next(short, 0).status, 'no-change');
const lastKo = plays.runQuote(terms, quote, [100, 100, 110]);
assert.equal(next(lastKo, 1).status, 'no-change');
assert.equal(next(lastKo, 1).day, null);
const stopped = plays.runQuote({...terms, budget: 90}, quote, prices);
assert.equal(next(stopped, 0).status, 'unfunded');
assert.equal(next(plays.runQuote(terms, quote, [100, 90, 90]), 0).status, 'open');
assert.equal(next(plays.runQuote(terms, quote, [100, 90, 90, 90, 90]), 0).status, 'maturity');
const blockedTerms = {...terms, maxRolls: 0, decu: {...terms.decu, days: 9}};
const blocked = plays.runQuote(blockedTerms, quote, prices);
assert.ok(!next(blocked, 0).before.includes('roll') && !next(blocked, 0).before.includes('decu'));
assert.equal(compare(at(4, {run: blocked, terms: blockedTerms}), 'acc', 'decu'), null);

// Actual GLD closes and the saved Q04 terms. First two post-KO fixings are
// unchanged six-way ties; the third changes after regular daily contract fills.
const data = path.join(__dirname, '../site/data/metals');
const csv = fs.readFileSync(path.join(data, 'gld.csv'), 'utf8').trim().split(/\r?\n/);
const columns = csv.shift().split(',');
const rows = csv.map(line => {
  const cells = line.split(',');
  return {date: cells[columns.indexOf('date')], close: cells[columns.indexOf('close')]};
});
const real = history.replay(rows, 'rebound');
const q04 = require('../site/data/metals/gld-accumulator-pricing.json').rows.filter(q => q.strike !== null)[3];
const setup = {budget: 100000, openingShares: 0, reserve: 0, waitDays: 2, firstBuyPct: 50, dipPct: 10,
  maxRolls: 3, decu: {strike: 105, ko: 90, days: 21, coveragePct: 100, minEntryPrice: 0, gear: 1}};
const historical = plays.runQuote(setup, q04, real.prices);
const jump = next(historical, 0);
assert.deepEqual([real.dates[historical.postKo.day], real.dates[jump.day], jump.leaders], ['2020-04-14', '2020-04-17', ['decu']]);
assert.deepEqual(plays.atDay(historical, historical.postKo.day + 1, true).leaders, all);
assert.deepEqual(plays.atDay(historical, historical.postKo.day + 2, true).leaders, all);
assert.equal(real.dates[next(historical, jump.day).day], '2020-04-23');
const mark = explain({run: historical, terms: setup, quote: q04, prices: real.prices, day: jump.day});
assert.deepEqual([mark.price, mark.koCash, mark.koShares, mark.policies.decu.cash, mark.policies.decu.shares],
  [158.57, 91639.27, 63, 92148.67, 60]);
assert.deepEqual([mark.policies.roll.cash, mark.policies.roll.shares, mark.policies.decu.pnl, mark.policies.roll.pnl],
  [91334.23, 65, -225.24, -246.83]);
const d = mark.difference;
assert.deepEqual([d.leader, d.comparator, d.cashDifference, d.shareDifference, d.holdingDifference, d.gap],
  ['decu', 'roll', 814.44, -5, -792.85, 21.59]);
assert.deepEqual([d.previousGap, d.marketMoveDifference, d.tradeEffectDifference, d.gapMove],
  [0, 0, 21.59, 21.59]);
console.log('Post-KO leader transitions, ties, projected ledgers, fixing-level attribution and the archived Q04 case passed.');
