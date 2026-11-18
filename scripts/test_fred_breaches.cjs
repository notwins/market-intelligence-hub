'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const model = require('../site/fred/breach-model.js');
const sigma = require('../site/fred/sigma.js');
const overview = require('../site/fred/overview-model.js');

const rows = [
  {date:'2026-01-01',z:.1}, {date:'2026-01-02',z:1.2},
  {date:'2026-01-03',z:null}, {date:'2026-01-04',z:2.2},
  {date:'2026-01-05',z:2.5}, {date:'2026-01-06',z:-2.2}
];
const result = model.crossings(rows, 'Daily', 'test');
assert.deepEqual(result.events.map(e=>[e.date,e.threshold,e.skipped]),
  [['2026-01-02',1,0],['2026-01-04',2,1],['2026-01-06',1,0],['2026-01-06',2,0]]);
assert.equal(result.active.get(2).z,-2.2);
assert.equal(model.crossings(rows.slice(1), 'Daily', 'test').events[0].observed,false);
assert.equal(model.crossings([...rows,{date:'2026-01-07',z:null}], 'Daily', 'test').active.size,0);
assert.equal(model.period('2026-07-01','Quarterly').end,'2026-09-30');
assert.equal(model.period('2024-02-01','Monthly').end,'2024-02-29');
assert.equal(model.period('2026-08-31','Quarterly publications, mixed month-end observation dates').end,'2026-08-31');
const series={kind:'yield',points:[['2026-10-01',4],['2026-10-15',4.2],['2026-10-30',4.4],['2026-11-01',99]]};
const month=model.marketWindow(series,model.period('2026-10-01','Monthly'),'period','2026-11-17');
assert.equal(month.after[0],'2026-10-30');
assert.ok(Math.abs(month.change-40)<1e-9);
const daily=model.marketWindow(series,model.period('2026-10-15','Daily'),'20','2026-10-15');
assert.equal(daily.truncated,true);
assert.ok(daily.eligible.every(([date])=>date<='2026-10-15'));
assert.equal(model.marketWindow({...series,points:[['2026-10-01',4]]},model.period('2026-10-01','Monthly'),'period','2026-11-17').change,null);

const root='site/data/fred/';
const catalog=JSON.parse(fs.readFileSync(root+'catalog.json','utf8'));
const index=JSON.parse(fs.readFileSync(root+catalog.analytics_url,'utf8'));
assert.equal(index.archive_version,catalog.archive_version);
assert.equal(index.datasets.length,catalog.dataset_count);
const counts = [0,0,0,0];
const groups = new Map();
for (const entry of index.datasets) {
  const metric=entry.metrics.find(m=>m.field===entry.default_field);
  const values=sigma.analyze(entry.default_series.points,{years:5,frequency:entry.frequency,transform:metric.transform,excludeDates:entry.quality_dates});
  const latest=values.at(-1);
  const tier=model.tier(latest?.z);
  counts[tier+1]++;
  if(tier>0) {
    const event=model.crossings(values,entry.frequency,entry.id).active.get(tier);
    assert.ok(event,entry.id+' missing breach entry');
    assert.ok(event.date<=latest.date);
    assert.equal(Math.sign(event.z),Math.sign(latest.z));
    groups.set(tier+' '+overview.mainGroup(entry),true);
  }
}
if(index.archive_version==='2026-11-16T231319543507') {
  assert.deepEqual(counts,[7,95,45,8]);
  assert.equal(groups.size,10);
}
console.log('PASS FRED threshold entries, sign reversals, period bounds, market gaps, and archive signal reconciliation');
