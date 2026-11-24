// Regression checks for exact monthly commitments and the two daily sizing conventions.
const assert = require('node:assert/strict');
const {calculate, example} = require('../site/tools/accumulator-capital.js');

function run(issuer, changes = {}) {
  return calculate(issuer, {...example(issuer), ...changes});
}
function row(result, label) {
  return Object.fromEntries(result.rows)[label];
}
const monthly = {months:'3', monthlyShares:'7', strike:'10.1234'};
for (const issuer of ['si','sn']) {
  const r = run(issuer, monthly);
  assert.equal(r.amount, 'USD 212.5914');
  assert.equal(row(r,'Full-tenor shares'),'21');
  assert.equal(row(r,'Capital per month'),'USD 70.8638');
  for (const value of ['0', '-1', '1.5', '', '1e2']) {
    assert.throws(() => run(issuer,{monthlyShares:value}), error => error.field === 'quantity');
    assert.throws(() => run(issuer,{months:value}), error => error.field === 'term');
  }
  assert.throws(() => run(issuer,{strike:'0'}), error => error.field === 'strike');
}
const daily = {basis:'daily', months:'3', days:'61', dailyShares:'7', strike:'10.1234'};
const si = run('si',daily);
assert.equal(si.amount,'USD 4,889.6022');
assert.equal(row(si,'Sizing shares per month'),'161');
const sn = run('sn',daily);
assert.equal(row(sn,'Exact share cost'),'USD 4,322.6918');
assert.equal(sn.amount,'USD 4,323.00');
assert.equal(run('sn',{...daily, strike:'10'}).amount,'USD 4,270.00');
const half = {method:'derived',spot:'10.12345',level:'100',months:'1',monthlyShares:'1'};
assert.equal(run('si',half).amount,'USD 10.12345');
assert.equal(run('sn',half).amount,'USD 10.1235');
assert.equal(run('sn',{...half,spot:'10.123449'}).amount,'USD 10.1234');
assert.throws(() => run('sn',{strike:'0.12345'}), error => error.field === 'strike');
assert.throws(() => run('sn',{...half,spot:'0.00001'}), error => error.field === 'level');
assert.equal(run('si',{...monthly,currency:'SGD'}).amount,'SGD 212.5914');
assert.equal(run('sn',{...monthly,strike:'10.1234000'}).amount,'USD 212.5914');
console.log('PASS monthly and daily normal sizing, exact fractional capital, strike and notional rounding, validation and currencies');
