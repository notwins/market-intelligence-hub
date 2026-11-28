'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const study = require('../site/xau-analogs.js');
const regimes = require('../site/xau-regimes.js');
const snapshot = require('../site/data/metals/xau-research.json');
const labor = require('../site/data/metals/xau-open-macro.json').series;
const records = study.study({snapshot,labor});
const macro = study.ranked(records.episodes,'macro');
const beta = study.ranked(records.episodes,'beta');
assert.deepEqual([records.recent.start,records.recent.end],['2026-02','2026-10']);
assert.equal(records.elapsed,8);
assert.equal(records.recent.changes.length,7);
assert.equal(records.recent.fits.length,7);
assert.equal(macro[0].end,'2015-09');
assert.equal(beta[0].end,'2022-10');
assert.deepEqual(study.ranked(records.episodes,'macro').map(r=>r.end),macro.map(r=>r.end));
assert.equal(macro[0].aftermath.returns.length,4);
assert.ok(Math.abs(macro[0].aftermath.returns[3] - 17.96)<.01);
assert.ok(Math.abs(beta[0].aftermath.returns[3] - 15.14)<.01);
assert.ok(records.episodes.every(r=>r.end<records.recent.start));
assert.ok(macro.every((r,i)=>macro.slice(i+1).every(s=>s.start>r.end||s.end<r.start)));
assert.ok(records.episodes.every(r=>r.length>=7&&r.length<=9));
assert.equal(study.next(records.gold,records.recent.end,5020).returns.at(-1),null);
assert.equal(regimes.dateWindow('dates:2015-00:2016-09'),null);
assert.equal(regimes.dateWindow('dates:2015-10:2015-01'),null);
assert.equal(regimes.dateWindow('dates:2015-01:2020-09'),null);
const gld = fs.readFileSync(path.join(__dirname,'../site/data/metals/gld.csv'),'utf8').trim().split(/\r?\n/).slice(1)
  .map(line=>{const c=line.split(',');return [c[0],Number(c[4])];});
for (const r of [...macro,...beta,records.recent]) {
  for (const [start,end] of [[r.start,r.end],...(r.aftermath?[[r.end,study.shift(r.end,12)]]:[])]) {
    const id='dates:'+start+':'+end;
    const path=regimes.replay({gold:snapshot.series.pink,gld,id,phase:'cycle',spot:334.4});
    assert.equal(path.basis,'Actual GLD daily closes');
    assert.equal(path.dates[0],gld.findLast(([d])=>d.startsWith(start))[0]);
    assert.equal(path.dates.at(-1),gld.findLast(([d])=>d.startsWith(end))[0]);
  }
}
assert.throws(()=>regimes.replay({gold:snapshot.series.pink,gld,id:'dates:1980-01:1980-08',phase:'cycle',spot:334.4}),/GLD daily closes/);
console.log('Matched macro and beta ranks, independent windows, forward returns, and precise GLD replay boundaries passed.');
