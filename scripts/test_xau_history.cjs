'use strict';
const assert = require('node:assert/strict');
const model = require('../site/xau-history-model.js');
const snapshot = require('../site/data/metals/xau-research.json');

assert.deepEqual(model.monthly([['2020-02-15', 5], ['2020-01-31', 2], ['2020-02-28', null], ['2020-01-04', 1]]),
  [['2020-01-01', 2, '2020-01-31'], ['2020-02-01', 5, '2020-02-15']]);
assert.deepEqual(model.multiply([['2020-01-01',1500], ['2020-01-03',1520]], [['2020-01-01',2], ['2020-01-02',3]]), [['2020-01-01',3000]]);
assert.deepEqual(model.multiply([['2020-01-01',1500]], [['2020-01-01',2]], true), [['2020-01-01',750]]);
assert.deepEqual(model.yearOnYear([['2020-01-01',100], ['2021-01-01',110], ['2021-02-01',112]]).map(row => [row[0],Math.round(row[1])]),
  [['2021-01-01',10]]);
assert.deepEqual(model.realGold([['2020-01-01',1000],['2020-02-01',1100]], [['2020-01-01',100],['2020-02-01',120]]),
  [['2020-01-01',1200],['2020-02-01',1100]]);
assert.deepEqual(model.pairs(model.monthly([['2022-12-28',1800], ['2023-11-28',1950]]),
  [['2022-12-31',3],['2023-12-31',2]],'2022-01-01','2023-12-31',true), [['2022-12-31',1800,3,'2022-12-28','2022-12-31']]);
const rows = Array.from({length: 16}, (_, i) => {
  const date = new Date(Date.UTC(2020,i,1)).toISOString().slice(0,10);
  return [date, 1+i*i, 1+i*i];
});
assert.ok(model.correlation(rows,'level').value > .999);
assert.equal(model.correlation(rows.slice(0,8),'level').value,null);
assert.equal(model.correlation(rows.filter((_,i)=>i!==6),'level').count,13);
const cycle = model.drawdown(model.within(snapshot.series.pink,'2011-01-01','2020-12-31'));
assert.equal(cycle.peak[0], '2011-09-01');
assert.equal(cycle.trough[0], '2015-12-01');
assert.equal(cycle.recovered[0], '2020-07-01');
assert.ok(Math.abs(cycle.value + 39.28) < .01);
const latest = model.ranked(snapshot.reserves.countries, snapshot.asOf, '2025-11-29');
assert.equal(latest.length,30);
assert.equal(latest[0].name,'United States');
assert.ok(latest[0].last[1] > 8133 && latest[0].last[1] < 8134);
assert.equal(snapshot.series.safeGold.at(-1)[1],2435.402);
assert.equal(snapshot.mining.world.at(-1),3331.141);
assert.ok(snapshot.fred.CPIAUCSL[0][0] < '1960-01-01');
const library = require('../site/data/metals/xau-library.json');
const available = id => library.series[id].points;
const base = model.monthly(snapshot.series.pink);
const start = '1996-11-01', end = '2026-10-31';
for (const id of ['NBUSBIS','pink_silver','pink_platinum','pink_copper','DGS10']) {
  assert.equal(model.pairs(base,available(id),start,end,'Monthly').length,360,id);
}
assert.equal(model.pairs(base,available('USGS_WORLD_GOLD'),start,end,'Annual').length,30);
assert.equal(available('DFII10')[0][0],'2003-01-01');
assert.deepEqual(model.quarterly(model.monthly([
  ['2025-01-31',2700],['2025-02-28',2900],['2025-03-31',3100],['2025-06-30',3300]
]),true),[['2025-03-31',2900,'2025-03-31']]);
assert.deepEqual(model.pairs(model.monthly([['2024-03-27',2172]]),
  [['2024-03-31',300]],'2024-03-01','2024-03-31','Quarterly'),[['2024-03-31',2172,300,'2024-03-27','2024-03-31']]);
assert.equal(model.change(-10,5,'difference'),15);
for (const id of ['SP500','BAA10Y','wgc_World tonnes','wgc_China gold share']) {
  assert.equal(available(id).length,0);
  assert.ok(library.series[id].local);
}
assert.equal(library.papers.length,30);
assert.ok(library.papers.every(p => p.url.startsWith('https://') && p.note && !p.note.includes('[PDF')));
for (const s of Object.values(library.series)) {
  assert.ok(s.points.every(([d,v],i) => Number.isFinite(v) && (!i || d > s.points[i-1][0])));
  assert.ok(s.points.length ? s.points.length === s.length : s.local?.[0] in library.tables);
}
console.log('Gold research, 360-month benchmark spans, annual and quarterly matching, source permissions and bibliography passed.');
