const assert=require('node:assert/strict');const fs=require('node:fs');const a=require('../site/external-sources.js');const rows=JSON.parse(fs.readFileSync('site/data/external-sources.json')).records;
let s=a.empty();assert.equal(a.filterRecords(rows,s).length,rows.length);
s.provider='MAS';let mas=a.filterRecords(rows,s);assert(mas.length>=12);assert(mas.every(r=>r.provider==='MAS'));
s.type='PDF';let pdf=a.filterRecords(rows,s);assert(pdf.length>=5);assert(pdf.every(r=>r.type==='PDF'));
s.q='financial 2025';assert(a.filterRecords(rows,s).some(r=>r.period==='2025/26'));
s=a.empty();s.groups=['Sovereign investing','Central banks'];let groups=a.filterRecords(rows,s);assert(groups.some(r=>r.provider==='GIC'));assert(groups.some(r=>r.provider==='MAS'));assert(groups.every(r=>r.groups.some(g=>s.groups.includes(g))));
s=a.empty();s.month='2026-10';let oct=a.filterRecords(rows,s);assert(oct.length>0);assert(oct.every(r=>r.references.some(x=>x.date.startsWith('2026-10'))));s.year='2026';assert(a.filterRecords(rows,s).every(r=>a.years(r).includes('2026')));
assert.deepEqual(a.years({period:'2025/26'}),['2025','2026']);
s=a.empty();s.saved=true;assert.equal(a.filterRecords(rows,s,new Set([rows[0].id])).length,1);
let sorted=a.sortRecords(rows,'referenced');assert.equal(sorted[0].last_referenced,'2026-11-04');let dates=a.sortRecords(rows,'report').map(r=>r.report_date||'');assert.deepEqual(dates,[...dates].sort().reverse());
s={...a.empty(),q:'MAS reserves',groups:['Singapore','Central banks'],type:'PDF',month:'2026-10',view:'topic',sort:'report'};assert.deepEqual(a.readState(new URLSearchParams(a.serialize(s))),s);
let g=a.groupRecords(rows.slice(0,20),s);assert.equal(g.reduce((n,[_,x])=>n+x.length,0),20);
let bad={...rows[0],title:'<script>x</script>',note:'<img src=x>',url:'javascript:alert(1)'};let html=a.card(bad,new Set());assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('href="javascript:'));assert(html.includes('&lt;script&gt;'));
assert.equal(a.safeURL('https://chatgpt.com/c/private'),'');assert.equal(a.safeURL('https://user:pass@host.org/x'),'');assert.equal(a.referenceHref({path:'../../secret.html'}),'');assert.equal(a.referenceHref({path:'data/archive/2026-10-29.json'}),'v4.html#headlines');
console.log('External source filtering, OR groups, combined filters, dates, sorting, stars, URL state, grouping and escaping passed.');

assert.equal(a.referenceHref({path:'data/watchlist/reports/watchlist-20261103T200000Z.html'}),'data/watchlist/reports/watchlist-20261103T200000Z.html');assert.equal(a.referenceHref({path:'data/hourly-archive/edition.json'}),'v4.html#hourly');

assert.equal(a.referenceHref({path:'data/credit-issues.json'}),'v4.html#credit');assert.equal(a.referenceHref({path:'data/ust-curves-daily.json'}),'v4.html#ust');assert.equal(a.referenceHref({path:'data/history-fed.json'}),'v4.html#history');
const more=JSON.parse(fs.readFileSync('site/data/supplemental-public-sources.json')).records;for(const r of more){const found=rows.find(x=>x.url===r.url);assert(found,r.url);for(const ref of r.references)assert(found.references.some(x=>x.id===ref.id&&x.date===ref.date));}

assert.equal(rows.length,1915);assert.equal(new Set(rows.map(r=>r.id)).size,1915);assert.equal(new Set(rows.map(r=>r.url)).size,1915);
s={...a.empty(),provider:'GIC',layout:'table',view:'year'};assert.deepEqual(a.readState(new URLSearchParams(a.serialize(s))),s);const gic=a.filterRecords(rows,s);assert.equal(gic.length,10);const years=a.groupRecords(gic,s);assert.equal(years.reduce((n,[_,r])=>n+r.length,0),gic.length);let th=a.table(gic,new Set(),'GIC');for(const r of gic){assert(th.includes(a.safeURL(r.url).replace(/&/g,'&amp;')));assert(th.includes(r.status==='not_rechecked'?'Not rechecked':'source-details'));}assert(!a.table([bad],new Set(),'Test').includes('<script>'));assert(!a.table([bad],new Set(),'Test').includes('href="javascript:'));assert(a.table([{...rows[0],period:null,report_date:null}],new Set(),'Test').includes('Report date: unavailable'));
