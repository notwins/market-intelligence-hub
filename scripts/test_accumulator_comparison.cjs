const assert = require('node:assert/strict');
const model = require('../site/tools/accumulator-model.js');

function close(actual, expected, label) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) < 0.000001,
    `${label}: expected ${expected}, got ${actual}`);
}

const quote = {strike:102.25, ko:120, minimum:2, months:6, days:120, multiple:1};
const budget = 300000;
const initialSpot = 100;
const size = model.terms(quote, initialSpot, budget);
assert.equal(size.maximum, 489, 'Nearest whole number of monthly shares');
close(size.strike, 102.25, 'Purchase price is in cents');
close(size.committed, 300001.50, 'Shares × strike × tenor');
close(size.payment, 300002, 'Funding rounds upward once');
close(size.roundingCash, 0.50, 'Funding cushion');
assert.equal(model.terms({...quote,strike:100},initialSpot,900).maximum,2,'Half-share tie rounds up');
assert.equal(model.terms({...quote,strike:100},initialSpot,899).maximum,1);
assert.throws(() => model.terms(quote, initialSpot, 1), 'Subminimum budget');
assert.equal(model.terms({...quote,strike:92.31}, 123.45, budget).strike,113.96,
  'Quote strike retains its source precision before rounding USD cents');

function checkReconciliation(sim) {
  for (const row of [sim.exit, ...sim.rows]) {
    for (const n of [row.bought, row.shares]) assert(Number.isInteger(n) && n >= 0);
    close(row.spent + row.refunded + row.remaining, sim.payment, 'Capital conservation');
    close(row.spent, row.shares * sim.strike, 'Cost of all acquired shares');
    close(row.value, row.shares * row.price + row.refunded + row.remaining, 'Holdings NAV');
  }
  close(sim.end.remaining, 0, 'All unused capital ultimately refunded');
}

function singleBarrierDay(day, hitPrice, latestPrice = 80) {
  return Array.from({length:120}, (_,i) => i+1 < day ? 100 : i+1 === day ? hitPrice : latestPrice);
}

const early = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(1,120));
assert.equal(early.koDay, 1, 'Barrier equality on first trading day');
assert.equal(early.exit.shares, 978, 'Two guaranteed months even for a first-day knock-out');
close(early.exit.spent, 100000.50, 'Cost of guaranteed shares');
close(early.exit.refunded, 200001.50, 'Four unused allocations plus funding cushion');
close(early.exit.value, 317361.50, 'Early sale proceeds plus refunded cash');
close(early.exit.profit, 17359.50, 'Sale P&L versus actual whole-dollar payment');
close(early.end.value, 978*80+200001.50, 'Separate value if the shares were held');
checkReconciliation(early);

const gap = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(4,125));
close(gap.exit.value, 978*125+200001.50, 'A gap sells at observed spot');
const roundedHit = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(1,119.995));
assert.equal(roundedHit.koDay, 1, 'Round simulated observations to trading cents before testing the barrier');
const guaranteeEnd = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(40,120));
const dayAfter = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(41,120));
assert.equal(guaranteeEnd.exit.shares, 978);
assert.equal(dayAfter.exit.shares, 978, 'No extra purchase on the KO observation');
const late = model.simulateDaily(quote, initialSpot, budget, singleBarrierDay(49,120));
assert.equal(late.exit.shares, 978 + Math.floor(489*8/20), 'Only completed sessions accrue after the guarantee');
checkReconciliation(late);

for (const finalSpot of [0, 90, 100, 102.25, 119.99]) {
  const maturity = model.simulateDaily(quote, initialSpot, budget, Array(120).fill(finalSpot));
  assert.equal(maturity.koDay,0);
  assert.equal(maturity.end.shares,2934,'Full Normal allocation across all six months');
  close(maturity.end.refunded,0.50,'Only the funding cushion remains');
  close(maturity.end.value,2934*finalSpot+0.50,'No-KO maturity value');
  checkReconciliation(maturity);
}

// Exercise the quotes users can select, including the shorter SN terms and SI's
// quoted guaranteed-day counts. Monthly anchor prices feed a daily KO model.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require.resolve('../site/tools/accumulator.html'), 'utf8');
const catalogScript = html.match(/<script id="accumulator-model">([\s\S]*?)<\/script>/)[1];
const catalog = vm.runInNewContext(catalogScript+'; Accumulator', {window:{AccumulatorModel:model}});
assert(catalog.quotes.every(q => q.label === 'Normal' && q.multiple === 1));
assert.deepEqual([...new Set(catalog.quotes.filter(q => q.product === 'JPM SN').map(q => q.months))].sort((a,b)=>a-b), [3,6,9,12]);
assert.equal(model.terms(catalog.quotes.find(q=>q.product==='OCBC SI' && q.minimum===3), 100, budget).guaranteeDay,61);
for (const q of catalog.quotes) {
  const pricePath = Array(q.months).fill(initialSpot);
  const result = model.simulate(q, initialSpot, budget, pricePath);
  assert.equal(result.end.shares, result.maximum*q.months);
  checkReconciliation(result);
}
const monthlyHit = model.simulate(quote, initialSpot, budget, [140,80,80,80,80,80]);
assert.equal(monthlyHit.koDay,10, 'Interpolated barrier crossing precedes the first month end');
close(monthlyHit.exit.price,120,'First daily closing price at KO');
close(monthlyHit.rows[0].price,140,'User-entered month-end price remains available');
assert.throws(()=>model.simulateDaily(quote,initialSpot,budget,[]));

console.log('PASS Normal accumulator whole-share sizing, rounding cash, daily knock-out, timing, maturity and NAV reconciliation');
