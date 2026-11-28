'use strict';
const assert = require('node:assert/strict');
const {run} = require('../site/tools/gld-strategy-model.js');
const accumulator = require('../site/tools/accumulator-model.js');
const benchmark = require('../site/tools/accumulator-benchmark.js');

const first = {days: 4, strike: 90, ko: 110, dailyShares: 2, guaranteeDays: 2};
const sale = {days: 2, strike: 110, ko: 90, gear: 2};
const roll = {days: 2, strike: 90, ko: 110, dailyShares: 1};
const base = {budget: 720, acc: first, decu: sale, roll, maxRolls: 2, waitDays: 1};
function result(prices, overrides = {}) {
  const r = run({...base, ...overrides}, prices);
  assert.deepEqual(r.strategies.map(s => s.key), ['hold', 'acc', 'decu', 'roll']);
  for (const s of r.strategies) {
    assert.equal(s.series[0], r.initialWealth);
    assert.equal(s.series.length, prices.length);
    assert.equal(s.series.at(-1), s.value);
    assert.ok(Math.abs(s.cash + s.shares * prices.at(-1) - s.value) < 0.00001);
    assert.ok(s.shares >= 0 && s.reservedShares <= s.shares && s.deployableCash >= 0);
    assert.ok(s.maxDrawdownPct >= 0 && s.maxDrawdownPct <= 100);
  }
  return Object.fromEntries(r.strategies.map(s => [s.key, s]));
}
function event(strategy, leg, type) {
  return strategy.events.find(e => e.leg === leg && e.type === type);
}

// KO equality, minimum delivery, whole-share residual cash, and a later mark.
for (const [prices, day] of [[[100, 110, 100, 100, 80], 1], [[100, 99, 98, 110, 80], 3]]) {
  const {acc, hold} = result(prices);
  const ko = event(acc, 'acc', 'ko');
  assert.deepEqual([ko.day, ko.quantity, ko.refund, acc.cash, acc.shares, acc.value, hold.value], [day, 4, 360, 360, 4, 680, 580]);
  assert.equal(acc.series[day], 800);
  assert.equal(acc.open, null);
}
const crash = result([100, 80, 60, 40, 0]);
assert.deepEqual([crash.acc.shares, crash.acc.cash, crash.acc.value, crash.hold.value], [8, 0, 0, 20]);
assert.equal(crash.acc.maxDrawdownPct, 100);
assert.equal(event(crash.acc, 'acc', 'maturity').day, 4);
assert.equal(crash.roll.rolls, 0);

// A 2× decumulator sized with four shares of cover sells 1 at strike equality,
// 2 above strike. An exact lower KO cancels the ordinary daily sale.
const covered = result([100, 110, 100, 110, 112]).decu;
assert.deepEqual([covered.cash, covered.shares, covered.value], [690, 1, 802]);
const saleOpen = event(covered, 'decu', 'open');
assert.deepEqual([saleOpen.day, saleOpen.lot, saleOpen.quantity, saleOpen.strike], [2, 1, 4, 110]);
const downKo = result([100, 110, 100, 90, 80]).decu;
assert.deepEqual([event(downKo, 'decu', 'ko').quantity, downKo.shares, downKo.cash], [0, 4, 360]);
const guaranteeSale = result([100, 100, 112, 90], {
  startAfterKo: true, budget: 0, openingShares: 6, decu: {...sale, days: 3, guaranteeDays: 3}
}).decu;
assert.deepEqual([event(guaranteeSale, 'decu', 'ko').guaranteeTopUp, guaranteeSale.shares, guaranteeSale.cash], [2, 2, 440]);

// Each roll resets its strike to the fresh reference, draws from available
// cash and has its first observation strictly after entry. No roll on maturity.
const rolling = result([100, 110, 90, 99, 80, 70, 88, 100, 120]).roll;
assert.deepEqual(rolling.events.filter(e => e.type === 'open').map(e => [e.day, e.strike]), [[0, 90], [2, 81], [4, 72]]);
assert.deepEqual([rolling.cash, rolling.shares, rolling.value, rolling.rolls], [288, 5, 888, 2]);
assert.equal(rolling.pending, null);
assert.equal(result([100, 110, 90, 99], {maxRolls: 0}).roll.rolls, 0);
const maturityFollow = result([100, 99, 98, 97, 96, 100, 105]).decu;
assert.equal(event(maturityFollow, 'decu', 'open').day, 5);
assert.equal(maturityFollow.open.remainingDays, 1);
assert.equal(maturityFollow.reservedShares, 4);

// Starting after KO carries the entered account, retains the cash floor in
// every strategy and waits through the recovery threshold before covered sale.
const after = result([100, 90, 94, 95, 110], {
  startAfterKo: true, budget: 520, openingShares: 6, reserve: 200,
  decu: {...sale, minEntryPrice: 95}, maxRolls: 1
});
assert.deepEqual([after.hold.shares, after.hold.cash, after.acc.shares, after.acc.cash], [9, 220, 6, 520]);
assert.deepEqual([event(after.decu, 'decu', 'wait').day, event(after.decu, 'decu', 'open').day], [1, 3]);
assert.equal(event(after.decu, 'decu', 'open').strike, 104.5);
assert.equal(after.roll.rolls, 1);
assert.equal(after.roll.cash >= 200, true);
const waiting = result([100, 85, 89], {startAfterKo: true, openingShares: 8, decu: {...sale, minEntryPrice: 100}}).decu;
assert.equal(waiting.pending.minEntryPrice, 100);
assert.equal(waiting.events.filter(e => e.type === 'wait').length, 1);
assert.equal(result([100, 100, 99], {startAfterKo: true, maxRolls: 0}).roll.events.length, 1);

// Open contract obligations, cent precision and incapable lots.
const unfinished = result([100, 80]).acc;
assert.deepEqual([unfinished.shares, unfinished.cash, unfinished.freeCash, unfinished.open.committedCash,
  unfinished.open.remainingDays, unfinished.open.maxRemainingShares], [2, 540, 0, 540, 3, 6]);
const insufficient = result([100, 80], {budget: 700, acc: {...first, dailyShares: 2}}).acc;
assert.deepEqual([event(insufficient, 'acc', 'skip').maxLot, insufficient.cash, insufficient.shares], [1, 700, 0]);
const automatic = result([100, 80], {budget: 800, reserve: 100, acc: {...first, dailyShares: 0}}).acc;
assert.deepEqual([event(automatic, 'acc', 'open').maxPurchaseCost, automatic.deployableCash], [360, 340]);
const insufficientStock = result([100, 99, 100], {startAfterKo: true, openingShares: 3}).decu;
assert.equal(event(insufficientStock, 'decu', 'skip').maxLot, 0);
const fraction = {days: 3, strike: 98.15, ko: 110, guaranteeDays: 0};
assert.equal(result([9.97, 9.66], {acc: fraction, budget: 29.99}).acc.open, null);
const rounding = result([9.97, 9.66, 9.79, 9.84], {acc: fraction, budget: 30}).acc;
assert.deepEqual([event(rounding, 'acc', 'open').payment, rounding.cash, rounding.value], [30, .63, 30.15]);

// Verify a range of daily paths against the Hub's single-contract gold engine.
let seed = 28;
for (let i = 0; i < 100; i++) {
  const daily = Array.from({length: 8}, () => {
    seed = (seed * 48271) % 2147483647;
    return 70 + seed % 50 + .23;
  });
  const underlying = 100.17;
  const template = {months: 2, days: 8, strike: 91.73, ko: 108.23, minimum: i % 3, sizing: 'daily', dailyShares: 3};
  const expected = accumulator.simulateDaily(template, underlying, 3000, daily);
  const obtained = result([underlying, ...daily], {
    budget: expected.payment,
    acc: {...template, guaranteeDays: expected.guaranteeDay}
  });
  assert.deepEqual([obtained.acc.cash, obtained.acc.shares, obtained.acc.value, obtained.acc.pnl],
    [expected.end.refunded, expected.end.shares, expected.end.value, expected.profit]);
  assert.equal(obtained.hold.value, benchmark.buyAndHold(expected.payment, underlying, daily.at(-1)).value);
}
assert.throws(() => run({...base, waitDays: 0}, [100, 110]), /waiting/);
assert.throws(() => run({...base, reserve: 721}, [100, 110]), /reserve/);
assert.throws(() => run({...base, budget: 0}, [100, 110]), /starting portfolio/);
assert.throws(() => run(base, [100, NaN]), /daily GLD/);
assert.throws(() => run({...base, decu: {...sale, ko: 100}}, [100, 110]), /knock-out/);
const paths = require('../site/tools/gld-strategy-paths.js');
for (const years of [1, 3, 5, 10]) {
  for (const {id} of paths.scenarios) {
    const {prices} = paths.scenario({id, spot: 128, years, yearOnePct: -25, finalPct: 50});
    assert.equal(prices.length, 252 * years + 1);
    assert.equal(prices[0], 128);
    assert.ok(prices.every(price => Number.isFinite(price) && price >= 0));
    if (id === 'custom') {
      assert.equal(prices[252], years === 1 ? 192 : 96);
      assert.equal(prices.at(-1), 192);
    }
    if (id === 'zero') {
      assert.ok(prices[62] > 0);
      assert.ok(prices.slice(63).every(price => price === 0));
    }
  }
}

// Both paths finish flat. Only the volatile route encounters the upper KO.
const range = paths.scenario({id: 'range', spot: 100, years: 1}).prices;
const whipsaw = paths.scenario({id: 'whipsaw', spot: 100, years: 1}).prices;
assert.equal(range.at(-1), whipsaw.at(-1));
const pathTerms = {budget: 10000, acc: {...first, days: 63, dailyShares: 1, guaranteeDays: 0}};
const rangeBook = result(range, pathTerms), whipsawBook = result(whipsaw, pathTerms);
assert.ok(event(rangeBook.acc, 'acc', 'maturity'));
assert.ok(event(whipsawBook.acc, 'acc', 'ko'));
assert.equal(rangeBook.hold.value, whipsawBook.hold.value);
assert.ok(whipsawBook.acc.shares < rangeBook.acc.shares);

// Advance a weekend start to the next recorded close and stop at the last available mark.
const gldRows = [
  {date: '2024-08-28', close: 350}, {date: '2025-08-22', close: 128},
  {date: '2025-08-25', close: 112}, {date: '2025-08-29', close: 96},
  {date: '2025-09-02', close: 140}
];
const shortReplay = paths.replay(gldRows, '2025-08-23', 3);
assert.deepEqual(shortReplay.prices, [112, 96, 140]);
assert.deepEqual(shortReplay.dates, ['2025-08-25', '2025-08-29', '2025-09-02']);
assert.deepEqual([shortReplay.startDate, shortReplay.endDate, shortReplay.targetDate, shortReplay.truncated],
  ['2025-08-25', '2025-09-02', '2028-08-25', true]);
assert.throws(() => paths.replay(gldRows, '2025-09-02', 1), /subsequent/);

// Ignore later single-market records and peaks older than the one-year window.
const xauRows = [
  {date: '2024-08-28', usd_per_oz: 4096}, {date: '2025-08-24', usd_per_oz: 2048},
  {date: '2025-08-29', usd_per_oz: 1024}, {date: '2025-08-31', usd_per_oz: 2304}
];
assert.deepEqual(paths.marketContext(gldRows, xauRows), {
  date: '2025-08-29',
  gld: {price: 96, peak: 128, peakDate: '2025-08-22', drawdownPct: -25, unit: 'USD/share'},
  xau: {price: 1024, peak: 2048, peakDate: '2025-08-24', drawdownPct: -50, unit: 'USD/troy oz'}
});
assert.equal(paths.marketContext(gldRows, [{date: '2025-09-03', usd_per_oz: 1500}]), null);
console.log('GLD strategy fixtures, 100 daily cross-model comparisons and price path regressions passed.');
