'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data',f),'utf8'));
const F=require('../site/fred-feed.js'),M=require('../site/market-snapshot.js');
const daily=F.validate(read('fred-daily.json')),latest=read('fred-latest.json');
assert.equal(daily.series.length,25);
for(const s of daily.series){
 const last=s.points.at(-1),v=latest.series.find(r=>r.id===s.id);
 assert.equal(v.date,last[0]);assert.equal(v.value,last[1]);assert.equal(v.unit,s.unit);
 assert.match(s.source_url||s.source_urls[0],/^https:\/\/fred\.stlouisfed\.org\/series\/[A-Z0-9]+$/);
 if(!s.derived)continue;
 const [a,b]=s.provider_series.map(code=>daily.series.find(r=>r.provider_series===code)),ap=new Map(a.points),bp=new Map(b.points);
 for(const [d,v]of s.points)assert.equal(v,s.id==='AUD/SGD'?ap.get(d)*bp.get(d):ap.get(d)/bp.get(d));
 for(const d of s.missing_periods)assert.ok(!ap.has(d)||!bp.has(d));
}
const data={fed:read('history-fed.json'),uploaded:read('history-v3.json'),fredDaily:daily,ust:{tenors:[{label:'10Y'}]},ustRows:[{date:'2020-01-02',values:[1]}]},rows=M.buildRows(data);
for(const id of ['USD/SGD','CHF/SGD','USD/CHF','USD/JPY','SGD/JPY','AUD/SGD','SGD/MYR']){
 const r=rows.find(r=>r.id===id);assert.equal(rows.filter(r=>r.id===id).length,1);assert.equal(r.frequency,'daily');
 for(const group of ['days','weeks','months','years'])assert.ok(Number.isFinite(M.comparison(r,group,1).absolute),id+' '+group);
}
assert.equal(rows.find(r=>r.id==='UST 10Y').source,'https://fred.stlouisfed.org/series/DGS10');
const sample={id:'CHF/SGD',family:'fx',points:[['2026-01-01',1.2],['2026-01-03',1.4]],missing_periods:['2026-01-02']};
assert.equal((F.chart(sample,'2026-01-01','2026-01-03').match(/<polyline/g)||[]).length,2,'area chart must break across provider missing dates');
const csv=F.csv(sample,'2026-01-02','2026-01-03','2026-01-04T00:00:00Z');assert.ok(csv.includes('2026-01-03'));assert.ok(!csv.includes('2026-01-01'));
assert.throws(()=>F.validate({...daily,series:[daily.series[0],daily.series[0]]}));
assert.throws(()=>F.validate({...daily,series:[{...daily.series[0],points:[['2026-01-01',0]]}]}));
console.log('Verified daily FRED contract, every same-date cross, latest readback, daily/weekly/yearly market baselines, area gaps and CSV export.');
