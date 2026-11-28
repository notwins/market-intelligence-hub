'use strict';
const assert = require('node:assert/strict');
const model = require('../site/xau-monthly-lab.js');
const raw = require('../site/data/metals/xau-monthly-lab.json');
const data = model.dataset(raw);
const rows = driver => data.dates.map((month, i) => [
  month, gold[i], driver[i]
]);
const gold = data.values('gold_usd_mom_pct');
const band = key => {
  const driver = data.values(key);
  return rows(driver).filter(row => row[0] >= '2006-02' && row.slice(1).every(Number.isFinite));
};
assert.equal(data.dates.length, 802);
assert.equal(data.dates.at(-1), '2026-10');
assert.equal(band('usd_broad_mom_pct').length, 249);
assert.ok(Math.abs(model.pearson(band('usd_broad_mom_pct')) + .41312700) < .00001);
assert.ok(Math.abs(model.pearson(band('spx_price_monthly_avg_mom_pct')) + .01502576) < .00001);
assert.equal(data.values('us_cpi_yoy_pct').at(-1), null);
assert.ok(data.values('world_mine_gold_usgs_annual_tonnes').filter(Number.isFinite).length >= 65);
const sample = rows(data.values('us_10y_real_yield_mom_bps')).filter(row => row[0] >= '2006-02');
const missing = sample.map(row => row.slice());
missing.at(-12)[2] = null;
assert.equal(model.rolling(missing).at(-1)[1], null);
assert.ok(Number.isFinite(model.rolling(sample).at(-1)[1]));
assert.equal(model.rolling(sample.filter((_, i) => i !== sample.length - 12)).at(-1)[1], null);
console.log('XAU Driver Lab projection, sample counts, published statistics and missing-month rules passed.');
