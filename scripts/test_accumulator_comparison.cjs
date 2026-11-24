const assert = require('node:assert/strict');
const model = require('../site/tools/accumulator-model.js');
const format = require('../site/tools/accumulator-format.js');

assert.equal(format.money(-0.49), '$0', 'Rounding pennies avoids showing negative zero');
assert.equal(format.signedMoney(0.49), '$0');
assert.equal(format.money(-1.50), '-$2', 'Half-dollar losses round away from zero');
assert.equal(format.signedMoney(1.50), '+$2');
assert.equal(format.shares(1020), '1,020');
assert.equal(format.price(100), '$100.00');
assert.equal(format.quote(98.05), '98.05%');
assert.equal(format.quote(98.83), '98.83%');
assert.equal(format.quote(96.70), '96.7%');
assert.equal(format.rate(4.6757), '5%');
assert.equal(format.signedRate(0.007), '0%');
assert.equal(format.signedRate(-0.0002), '-1%');

for (const [raw, money, rate] of [
  [4.99,'+$4','+4%'], [-4.01,'-$5','-5%'], [-0.01,'-$1','-1%'],
  [0.99,'$0','0%'], [0,'$0','0%'], [-0,'$0','0%'], [-3,'-$3','-3%'],
  [NaN,'—','—'], [Infinity,'—','—'], [null,'—','—']
]) {
  assert.equal(format.returnMoney(raw), money);
  assert.equal(format.signedRate(raw), rate);
}

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
const catalog = vm.runInNewContext(fs.readFileSync(require.resolve('../site/tools/accumulator-quotes.js'),'utf8')+'\n'+catalogScript+'; Accumulator', {window:{AccumulatorModel:model}});
assert(catalog.quotes.every(q => q.label === 'Normal' && q.multiple === 1));
assert.deepEqual([...new Set(catalog.quotes.filter(q => q.product === 'JPM SN').map(q => q.months))].sort((a,b)=>a-b), [6,9]);
assert.equal(model.terms(catalog.quotes.find(q=>q.product==='OCBC SI' && q.minimum===3), 100, budget).guaranteeDay,61);

// The five-note comparison values a later shareholding separately from maturity.
const noteA = {months:9,days:186,strike:87.97,ko:120,minimum:1};
const maturityA = model.simulateDaily(noteA, 125.53, budget, Array(noteA.days).fill(93.87));
const laterValueA = maturityA.exit.shares * 138.08 + maturityA.exit.refunded;
assert.equal(maturityA.exit.shares, 2718);
close(maturityA.exit.value, 255138.92, 'Note A value at maturity');
close(laterValueA - maturityA.exit.value, 120162.78, 'Change after maturity');
close(laterValueA - maturityA.payment, 75152.70, 'P&L since payment');

const noteE = {months:12,days:251,strike:90.86,ko:120,minimum:3};
const decline = catalog.scenarios.find(s => s.id === 'fall');
const stressE = model.simulate(noteE, 125.53, budget, catalog.scale(decline.prices, 125.53));
assert.equal(stressE.koDay, 0);
assert.equal(stressE.exit.price, 69.04);
assert.equal(stressE.exit.shares, 2628);
close(stressE.exit.refunded, 0.32, 'Cent-level refund in the decline example');
close(stressE.exit.profit, -118312.56, 'Conditional P&L at $69.04');
close(2628 * 69 + stressE.exit.refunded - stressE.payment, -118417.68, 'Conditional P&L at exactly $69');
// Transcribe the working quotes independently of the page's matrix layout. Blank
// strike cells in an indication must never become a selectable zero or duplicate.
const quotedStrikes = {
  'JPM SN': {
    '9-130-1':93.14, '9-130-2':93.85, '9-130-3':94.94,
    '9-120-1':90.56, '9-120-2':92.09, '9-120-3':94.02, '9-105-1':95.31, '9-105-2':98.91,
    '6-130-1':96.76, '6-130-2':97.79, '6-130-3':99.59,
    '6-120-1':94.39, '6-120-2':96.33, '6-120-3':99.09
  },
  'OCBC SI': {
    '9-120-1':95.89, '9-120-2':96.89, '9-120-3':98.25,
    '9-110-1':96.08, '9-110-2':97.98, '6-120-1':98.30, '6-110-1':98.13
  }
};
const counts = {6:123, 9:186};
for (const [product, expected] of Object.entries(quotedStrikes)) {
  const actual = {};
  for (const q of catalog.quotes.filter(q => q.product === product)) {
    const key = [q.months, q.ko, q.minimum].join('-');
    assert(!(key in actual), product + ' has a duplicate quote ' + key);
    actual[key] = q.strike;
    const {guaranteeDay, days} = model.terms(q, initialSpot, budget);
    assert.equal(days, counts[q.months], product + ' total trading days');
    if (product === 'OCBC SI') assert.equal(guaranteeDay, [0,21,40,61][q.minimum],
      'SI uses the quoted guaranteed days for ' + key);
  }
  assert.deepEqual(actual, expected, product + ' working indicative strike grid');
}

// Same $115 daily path: both 115% SI variations knock out on day 1; the
// 120% JPM note continues to accrue all six months. USD costs include cents.
const mixedCases = [
  ['si-9-115-2', 351, 300137, 1, 702, 233439.98, 80730, 314169.98],
  ['si-6-115-2', 510, 300033, 1, 1020, 200022, 117300, 317322],
  ['sn-6-120-1', 542, 300193, 0, 3252, 0.88, 373980, 373980.88]
];
for (const [id, quantity, payment, koDay, acquired, refund, proceeds, nav] of mixedCases) {
  const [,tenor,barrier,minimum] = id.split('-');
  const q = {months:Number(tenor), days:tenor==='6'?124:186, ko:Number(barrier), minimum:Number(minimum),
    strike:{'si-9-115-2':95.01,'si-6-115-2':98.05,'sn-6-120-1':92.31}[id]};
  const outcome = model.simulateDaily(q, initialSpot, budget, Array(186).fill(115));
  assert.equal(outcome.maximum, quantity);
  assert.equal(outcome.payment, payment);
  assert.equal(outcome.koDay, koDay);
  assert.equal(outcome.exit.shares, acquired);
  close(outcome.exit.shareValue, proceeds, 'Sale at observed daily spot');
  close(outcome.exit.refunded, refund, 'Separate cash refund');
  close(outcome.exit.value, nav, 'Total cash including sale');
  close(outcome.exit.profit, nav-payment, 'Profit over actual payment');
  checkReconciliation(outcome);
}
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

const {buyAndHold} = require('../site/tools/accumulator-benchmark.js');
const {analyze} = require('../site/tools/accumulator-history-risk.js');
const flatInvestment = buyAndHold(stressE.payment, 125.53, 125.53);
assert.equal(flatInvestment.shares, 2387);
close(flatInvestment.remainingCash, 109.89, 'Cash left after buying whole NVDA shares');
close(flatInvestment.pnl, 0, 'Flat direct stock position');
close(buyAndHold(stressE.payment, 125.53, 69).pnl, -134937.11, 'Same-funded outright stock at $69');
close(buyAndHold(stressE.payment, 125.53, 150.64).pnl, 59937.57, 'Same-funded outright stock at KO');

const monthlyPrices = [
  ['2026-01-31',100], ['2026-02-28',55], ['2026-03-31',101],
  ['2026-04-30',80], ['2026-05-31',97], ['2026-06-30',50],
  ['2026-07-15',1]
];
const risk = analyze(monthlyPrices, '2026-07-15', 100, 55).rows[0];
assert.deepEqual([risk.months,risk.total,risk.endHits,risk.touchHits], [3,3,1,2],
  'Endpoint, early decline then recovery, exact threshold and incomplete last month');
const missingMonth = monthlyPrices.filter(([date]) => date !== '2026-02-28');
assert.equal(analyze(missingMonth,'2026-07-15',100,55).rows[0].total,1,
  'A missing month invalidates every window that spans it');
assert.equal(analyze(monthlyPrices, '2026-07-15', 100, 105), null, 'A rise is outside the downside analysis');

require('./test_accumulator_scenario_paths.cjs');

console.log('PASS Normal accumulator whole-share sizing, rounding cash, daily knock-out, timing, maturity and NAV reconciliation');
