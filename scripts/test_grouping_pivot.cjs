/* Pure-model and real-source coverage: no browser/network dependency. */
const assert=require('node:assert/strict'),fs=require('node:fs'),P=require('../site/grouping-pivot.js');
assert(!P.eligible(50,6));assert(!P.eligible(51,5));assert(P.eligible(51,6));
const rows=Array.from({length:90},(_,i)=>({id:i,currency:i%3===0?'SGD':i%3===1?'AUD':'USD',type:i%2?'Shares':'Bonds',n:i===0?null:i-50}));
const y=P.dimension({key:'type',label:'Type'},rows),x=P.dimension({key:'currency',label:'Currency'},rows);
assert.deepEqual(x.groups.map(g=>g.label),['SGD','AUD','USD']);
const matrix=P.countMatrix(rows,y,x);assert.equal(matrix.total,90);assert.equal([...matrix.counts.values()].reduce((a,b)=>a+b,0),90);assert.equal([...matrix.rowTotals.values()].reduce((a,b)=>a+b,0),90);assert.equal([...matrix.columnTotals.values()].reduce((a,b)=>a+b,0),90);
const numeric=P.dimension({key:'n',type:'number'},rows);assert.equal(numeric.classify(rows[0]),'missing');assert.notEqual(numeric.classify(rows[50]),'missing');
assert(numeric.groups.every(g=>g.key==='missing'||g.high>=g.low));
assert.equal(rows.filter(r=>numeric.classify(r)==='missing').length,1);
const buckets=numeric.groups.filter(g=>g.key!=='missing');for(const r of rows.filter(r=>r.n!==null)){assert.equal(buckets.filter(g=>r.n>=g.low&&(g.last?r.n<=g.high:r.n<g.high)).length,1);}
assert.equal(numeric.classify({n:Math.max(...rows.map(r=>r.n).filter(Number.isFinite))}),buckets.at(-1).key);
assert(P.matches(rows[1],[{field:'currency',group:x.classify(rows[1])}],new Map([['currency',x]])));
const missing=P.dimension({key:'n',type:'number'},[{n:null},{n:undefined},{n:''}]);assert.deepEqual(missing.groups,[{key:'missing',label:'Not supplied'}]);
for(const values of [[1e12,1e12+1],[-1e12,-1e12+1],[-1e308,1e308],[0,1e-14]]){const rr=values.map(n=>({n})),dd=P.dimension({key:'n',type:'number'},rr);for(const row of rr)assert.notEqual(dd.classify(row),'missing',JSON.stringify(values));}
const constant=P.dimension({key:'n',type:'number'},[{n:0},{n:0}]);assert.equal(constant.groups.length,1);assert.equal(constant.groups[0].label,'0');
const many=Array.from({length:100},(_,i)=>({a:'Category '+i})),capped=P.dimension({key:'a'},many,14);assert.equal(capped.groups.length,14);assert(capped.groups.some(g=>g.key==='__other__'));assert.equal([...P.countMatrix(many,capped).rowTotals.values()].reduce((a,b)=>a+b,0),100);
const literal=P.dimension({key:'a'},[{a:null},{a:'Not supplied'}]);assert.notEqual(literal.classify({a:null}),literal.classify({a:'Not supplied'}));assert.equal(literal.groups.length,2);
const tiny=P.ranges([0,1e-14]);assert(tiny.some(g=>g.label.includes('e-')));
const dates=P.dimension({key:'date',type:'year'},[{date:'2025-11-01'},{date:'2026-01-01'},{date:null}]);assert.deepEqual(dates.groups.map(g=>g.label),['2025','2026','Not supplied']);
for(const [file,key,columns]of[['master-v3.json','records',20],['ust-v3.json','rows',6],['si-pricing-reference.json','rows',10]]){const data=JSON.parse(fs.readFileSync('site/data/'+file)),source=data[key];assert(P.eligible(source.length,columns));const before=JSON.stringify(source),currency=P.dimension({key:'currency'},source),m=P.countMatrix(source,currency);assert.equal(m.total,source.length);assert.equal([...m.rowTotals.values()].reduce((a,b)=>a+b,0),source.length);assert.equal(JSON.stringify(source),before);}
const html=fs.readFileSync('site/v4.html','utf8'),tools=fs.readFileSync('site/v4-tools.js','utf8'),si=fs.readFileSync('site/si-pricing.js','utf8');assert(html.includes('grouping-pivot.js'));assert(tools.includes('sourceRows:X.master.records'));assert(tools.includes('rows:ustRows()'));assert(si.includes('sourceRows:data.rows,rows:filtered()'));assert(si.includes('tenor units')||si.includes('Tenor units'));assert(tools.includes('mountGroupingPivots();translateDOM();'));
console.log('Grouping pivot: strict thresholds, stable ranges, totals, missing/zero, complete-source adapters and non-mutation checks passed.');
