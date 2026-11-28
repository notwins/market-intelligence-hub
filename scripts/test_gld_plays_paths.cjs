'use strict';
const assert = require('node:assert/strict');
const {plays, waypoints, build} = require('../site/tools/gld-plays-paths.js');
const strategy = require('../site/tools/gld-strategy-model.js');

const setup = {id: 'rebound', spot: 100, xauSpot: 1200, years: 1};
const ids = ['rebound', 'recovery', 'bear', 'whipsaw', 'sideways'];
assert.deepEqual(plays.map(play => play.id), ids);
for (const years of [1, 3, 5, 10]) {
  const sample = build({...setup, years});
  for (const id of ids) {
    const path = build({...setup, years, id});
    assert.equal(path.prices.length, 252 * years + 1);
    assert.equal(path.prices[0], setup.spot);
    assert.ok(path.prices.every(price => Number.isFinite(price) && price >= 0));
    assert.deepEqual(path.checkpoints.map(p => p.day), sample.checkpoints.map(p => p.day));
    assert.deepEqual(path.checkpoints.slice(1).map(({day, label, returnPct}) => ({day, label, returnPct})), waypoints(id, years));
    for (const point of path.checkpoints) {
      assert.equal(path.prices[point.day], point.price);
      assert.ok(Math.abs(point.xau / setup.xauSpot - point.price / setup.spot) < 1e-12);
    }
    const tenYears = build({...setup, years: 10, id});
    assert.deepEqual(path.prices, tenYears.prices.slice(0, 252 * years + 1));
  }
}

// Every quote sees the same daily closes, including the rally between checkpoints.
function firstExit(prices, ko, days) {
  const run = strategy.run({
    budget: 25000, acc: {strike: 90, ko, days, dailyShares: 1},
    decu: {strike: 105, ko: 90, days: 5}
  }, prices);
  return run.strategies.find(s => s.key === 'acc').events.find(e => e.type === 'ko' || e.type === 'maturity');
}
const rebound = build(setup).prices;
const lowBarrier = firstExit(rebound, 105, 63), highBarrier = firstExit(rebound, 120, 63);
assert.equal(lowBarrier.type, 'ko');
assert.equal(highBarrier.type, 'ko');
assert.ok(lowBarrier.day < highBarrier.day && highBarrier.day <= 21);
assert.equal(firstExit(build({...setup, id: 'bear'}).prices, 105, 252).type, 'maturity');
const whipsaw = build({...setup, id: 'whipsaw'}).prices;
assert.equal(firstExit(whipsaw, 110, 126).type, 'maturity');
const later = firstExit(whipsaw, 110, 252);
assert.ok(later.type === 'ko' && later.day > 126 && later.day < 189);

// Edits affect adjacent daily segments, do not compound and never change a preset.
const custom = build({...setup, overrides: {21: -20, 63: 5}});
assert.equal(custom.prices[21], 80);
assert.equal(custom.prices[42], 92.5);
assert.equal(custom.prices[63], 105);
assert.equal(custom.checkpoints.find(p => p.day === 21).xau, 960);
assert.equal(rebound[21], 122);
assert.deepEqual(custom.prices.slice(126), rebound.slice(126));
assert.ok(build({...setup, xauSpot: null}).checkpoints.every(p => p.xau === null));
const zero = build({...setup, overrides: {126: -100, 189: -100, 252: -100}});
assert.ok(zero.prices[125] > 0 && zero.prices.slice(126).every(p => p === 0));
assert.equal(zero.checkpoints.at(-1).xau, 0);
assert.throws(() => build({...setup, overrides: {126: -100}}), /reaches zero/);
assert.throws(() => build({...setup, overrides: {21: -100.01}}), /below/);
assert.throws(() => build({...setup, overrides: {21: ''}}), /finite/);
assert.throws(() => build({...setup, overrides: {17: 2}}), /Unknown/);
assert.throws(() => build({...setup, spot: 0}), /starting GLD/);
assert.throws(() => build({...setup, xauSpot: -3}), /XAU/);
assert.throws(() => build({...setup, years: 2}), /horizon/);
console.log('Five shared GLD paths passed all horizon, override, XAU and cross-quote KO checks.');
