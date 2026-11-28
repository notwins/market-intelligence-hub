'use strict';
const assert = require('node:assert/strict');
const {runQuote, atDay, rank, quoteTerms} = require('../site/tools/gld-plays-model.js');
const engine = require('../site/tools/gld-strategy-model.js');
const allKeys = ['hold', 'acc', 'roll', 'decu', 'wait', 'staged'];
const quote = {months: 2, days: 4, strike: 90, ko: 110, guarantee: 1};
const cfg = {budget: 720, acc: {dailyShares: 2}, roll: {days: 2, strike: 90, ko: 110, dailyShares: 1},
  decu: {days: 2, strike: 110, ko: 90, gear: 2}, waitDays: 2, maxRolls: 2, firstBuyPct: 50, dipPct: 10};
const path = [100, 110, 95, 88, 120, 112, 115];
const run = runQuote(cfg, quote, path);
const branch = run.postKo;
const find = (view, key) => view.strategies.find(s => s.key === key);
const events = (view, key, type) => find(view, key).events.filter(e => e.type === type);
assert.deepEqual(quoteTerms(quote), {days: 4, strike: 90, ko: 110, guaranteeDays: 2});
assert.deepEqual(quoteTerms({days: 4, strike: 90, ko: 110, guaranteeDays: 1}),
  {days: 4, strike: 90, ko: 110, guaranteeDays: 1});
assert.throws(() => quoteTerms({...quote, strike: null}), /quoted strike/);
assert.deepEqual(run.strategies.map(s => s.key), allKeys);
assert.deepEqual(branch.strategies.map(s => s.key), allKeys);
assert.deepEqual([run.firstExit.day, run.firstExit.type, run.firstExit.refund, run.firstExit.guaranteeTopUp], [1, 'ko', 360, 4]);
assert.deepEqual([branch.day, branch.price, branch.cash, branch.shares, branch.initialWealth, branch.remainingDays],
  [1, 110, 360, 4, 800, 5]);
assert.deepEqual(atDay(run, 0, true), {leaders: [], outcomes: {}});
assert.deepEqual(atDay(run, 1, true).leaders, []);
assert.ok(Object.values(atDay(run, 1, true).outcomes).every(s => s.pnl === 0 && s.value === 800));
assert.ok(Object.values(atDay(run, 2, true).outcomes).every(s => s.pnl === -60 && s.value === 740));
assert.deepEqual(atDay(run, 0).leaders, allKeys);
assert.deepEqual(atDay(run, 6).leaders, run.leaders);
assert.deepEqual(atDay(run, 6, true).leaders, branch.leaders);

// The same KO cash and inventory can be left alone, deployed on the earliest
// settlement day, used to start a covered sale, or held for a dip signal.
assert.deepEqual([find(branch, 'acc').cash, find(branch, 'acc').shares, find(branch, 'acc').pnl], [360, 4, 20]);
assert.deepEqual(events(branch, 'hold', 'buy').map(e => [e.day, e.price, e.quantity]), [[3, 88, 4]]);
assert.deepEqual(events(branch, 'wait', 'signal').map(e => [e.day, e.price]), [[3, 88]]);
assert.deepEqual(events(branch, 'wait', 'buy').map(e => [e.day, e.price, e.quantity]), [[4, 120, 3]]);
assert.deepEqual(events(branch, 'staged', 'buy').map(e => [e.day, e.price, e.quantity]), [[3, 88, 2], [4, 120, 1]]);
assert.deepEqual(events(branch, 'decu', 'open').map(e => [e.day, e.strike, e.quantity]), [[3, 96.8, 4]]);
assert.deepEqual(events(branch, 'decu', 'maturity').map(e => [e.day, e.cash, e.shares]), [[5, 747.2, 0]]);
for (const key of ['roll', 'decu']) {
  const complete = find(run, key);
  const fork = find(branch, key);
  assert.deepEqual(fork.series, complete.series.slice(1));
  assert.equal(fork.value, complete.value);
}
const baseOnly = engine.run({...cfg, acc: {...cfg.acc,...quoteTerms(quote)}}, path);
for (const key of ['hold','acc','roll','decu']) assert.deepEqual(find(run,key).series, find(baseOnly,key).series);
const inherited = runQuote({...cfg, roll: undefined}, quote, path);
const firstRoll = find(inherited.postKo, 'roll').events.find(e => e.type === 'open');
assert.deepEqual([firstRoll.strike, firstRoll.ko, firstRoll.guaranteeDays, firstRoll.days, firstRoll.lot], [79.2, 96.8, 2, 4, 1]);

// Before a later KO, skipped sale or fill happens it cannot affect checkpoint
// status, eligibility or ranking. Post horizons have the same prefix property.
const differentFuture = runQuote(cfg, quote, [100, 110, 95, 88, 70, 70, 70]);
for (let day = 0; day <= 3; day++) {
  assert.deepEqual(atDay(run, day), atDay(differentFuture, day));
  assert.deepEqual(atDay(run, day, true), atDay(differentFuture, day, true));
}
const lastSignal = runQuote(cfg, quote, [100, 110, 95, 88]);
assert.equal(events(lastSignal.postKo, 'wait', 'buy').length, 0);
assert.equal(find(lastSignal.postKo, 'wait').pending.earliestDay, 4);
const finalKo = runQuote(cfg, quote, [100, 98, 110]);
assert.equal(finalKo.postKo.remainingDays, 0);
assert.deepEqual(finalKo.postKo.leaders, []);
assert.ok(finalKo.postKo.strategies.every(s => s.pnl === 0));
const noKo = runQuote(cfg, quote, [100, 90, 92]);
assert.equal(noKo.firstExit, null);
assert.equal(noKo.postKo, null);
assert.ok(find(noKo,'acc').open);
const matured = runQuote(cfg, quote, [100, 89, 78, 70, 0]);
assert.deepEqual([matured.firstExit.type, matured.postKo, find(matured,'acc').value, find(matured,'wait').value],
  ['maturity', null, 0, 720]);

// Remainders, an explicit cash floor, existing holdings, unaffordable lots,
// zero prices, and exact-cent/portfolio ties all use the common starting basis.
const reserved = runQuote({...cfg,budget: 850, reserve: 130, openingShares: 3}, quote, path);
for (const view of [reserved, reserved.postKo]) {
  for (const s of view.strategies) {
    assert.ok(s.cash >= 130);
    assert.equal(s.series[0], view.initialWealth);
    assert.equal(s.value, s.series.at(-1));
    assert.ok(Math.abs(s.pnl - (s.value - view.initialWealth)) < 1e-8);
  }
}
assert.deepEqual([find(reserved, 'wait').cash, find(reserved, 'wait').shares], [850, 3]);
const noFollow = runQuote({...cfg,maxRolls: 0,decu: {...cfg.decu,days: 4,minEntryPrice: 200}}, quote, path);
assert.equal(atDay(noFollow, 0).outcomes.decu.eligible, true);
assert.equal(atDay(noFollow, 1).outcomes.decu.eligible, false);
for (const day of [1, 2, 6]) {
  const view = atDay(noFollow, day, true);
  assert.equal(view.outcomes.roll.eligible, false);
  assert.equal(view.outcomes.decu.eligible, false);
  assert.match(view.outcomes.decu.status, /Insufficient GLD/);
  assert.ok(!view.leaders.includes('roll') && !view.leaders.includes('decu'));
}
const small = runQuote({...cfg,budget: 0,openingShares: 1}, quote, [100,97,0]);
assert.equal(small.postKo, null);
assert.deepEqual(atDay(small, 1).leaders,['wait']);
const skipped = runQuote({...cfg,budget: 250}, quote, path);
for (const k of ['acc','roll','decu']) assert.equal(atDay(skipped, 1).outcomes[k].eligible, false);
const zeroFill = runQuote({...cfg,budget: 150,firstBuyPct: 0},quote,[100,90,0,0]);
assert.equal(find(zeroFill,'staged').cash, 150);
assert.equal(find(zeroFill,'staged').shares, 0);
assert.equal(events(zeroFill,'staged','skip').length, 1);
assert.deepEqual(rank([{key:'a',value:100,eligible:true},{key:'b',value:100.001,eligible:true},
  {key:'c',value:900,eligible:false}]), ['a','b']);
assert.deepEqual(rank([]),[]);
console.log('GLD five-play quote comparisons, same-account KO branches, cent ties, coverage and prefix invariance passed.');
