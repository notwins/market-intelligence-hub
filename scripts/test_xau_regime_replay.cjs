'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../site/xau-regimes.js');
const source = require('../site/data/metals/xau-research.json');
const context = require('../site/data/metals/xau-regime-context.json');
const M = require('../site/tools/gld-plays-model.js');
const quotes = require('../site/data/metals/gld-accumulator-pricing.json').rows;
const gld = fs.readFileSync(path.join(__dirname, '../site/data/metals/gld.csv'), 'utf8').trim()
  .split(/\r?\n/).slice(1).map(line => line.split(',')).map(p => [p[0],Number(p[4])]);
const cfg={budget:100000, decu:{strike:105,ko:90,days:21},reserve:5000,waitDays:2,maxRolls:2};

const get = (id,phase,g=gld) => H.replay({gold:source.series.pink,gld:g,id,phase,spot:334.4,xauSpot:3643.8});
const slow = H.summarize(source.series.pink,'2011-2020');
assert.equal(slow.windows.fall.start,'2011-09-01');
assert.equal(slow.windows.fall.end,'2015-12-01');
assert.equal(slow.windows.rebound.end,'2020-07-01');
const fall=get('2011-2020','fall'),rebound=get('2011-2020','rebound');
assert.equal(fall.basis,'Actual GLD daily closes');
assert.equal(fall.dates.at(-1),rebound.dates[0]);
assert.equal(fall.prices.at(-1),rebound.prices[0]);
assert.equal(fall.dates[0],gld.findLast(([d])=>d.startsWith('2011-09'))[0]);
assert.equal(fall.prices[1],gld.find((p,i)=>gld[i-1]?.[0]===fall.dates[0])[1]);
const nominal=get('1980-1999','fall');
assert.equal(nominal.basis,'Gold-price proxy');
assert.equal(nominal.prices[0],334.4);
assert.equal(nominal.dates[1],null);
assert.equal(nominal.dates[21],'1980-02-01');
assert.ok(Math.abs(nominal.prices.at(-1)/334.4-256/675) < .00001);
assert.throws(()=>get('2011-2020','fall',gld.filter(([d])=>!d.startsWith('2011-09'))),/incomplete/);
assert.ok(context.legacyDollar[0][0]<'1980-01-01');
for(const {id} of H.periods){
  const {windows}=H.summarize(source.series.pink,id);
  for(const phase of Object.keys(windows)){
    const replay=get(id,phase);
    assert.equal(replay.prices.length,replay.dates.length);
    assert.equal(replay.checkpoints.at(-1).day,replay.prices.length-1);
    for(const quote of quotes.filter(q=>q.strike!=null)){
      const result=M.runQuote(cfg,quote,replay.prices);
      for(const s of result.strategies){
        assert.ok(Number.isFinite(s.pnl));
        assert.equal(s.series.length,replay.prices.length);
      }
    }
  }
}
console.log('All gold regimes and phases, shared GLD closing boundaries, proxy fixings and saved quote outcomes passed.');
