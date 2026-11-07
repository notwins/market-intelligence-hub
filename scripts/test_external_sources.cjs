const assert=require('node:assert/strict');const fs=require('node:fs');const a=require('../site/external-sources.js');const rows=JSON.parse(fs.readFileSync('site/data/external-sources.json')).records;
let s=a.empty();assert.equal(a.filterRecords(rows,s).length,rows.length);
s.provider='MAS';let mas=a.filterRecords(rows,s);assert(mas.length>=12);assert(mas.every(r=>r.provider==='MAS'));
s.type='PDF';let pdf=a.filterRecords(rows,s);assert(pdf.length>=5);assert(pdf.every(r=>r.type==='PDF'));
s.q='financial 2025';assert(a.filterRecords(rows,s).some(r=>r.period==='2025/26'));
s=a.empty();s.groups=['Sovereign investing','Central banks'];let groups=a.filterRecords(rows,s);assert(groups.some(r=>r.provider==='GIC'));assert(groups.some(r=>r.provider==='MAS'));assert(groups.every(r=>r.groups.some(g=>s.groups.includes(g))));
s=a.empty();s.month='2026-10';let oct=a.filterRecords(rows,s);assert(oct.length>0);assert(oct.every(r=>r.references.some(x=>x.date.startsWith('2026-10'))));s.year='2026';assert(a.filterRecords(rows,s).every(r=>a.years(r).includes('2026')));
assert.deepEqual(a.years({period:'2025/26'}),['2025','2026']);
s=a.empty();s.saved=true;assert.equal(a.filterRecords(rows,s,new Set([rows[0].id])).length,1);
// Publication adds newer usage dates; verify the ordering, not a fixed live date.
const referenceFixtures=[
 {id:'undated',title:'A',usages:[{}]},
 {id:'usage',title:'Z',last_referenced:'2026-11-06',usages:[{date:'2027-01-01'},{date:'2026-12-30'}]},
 {id:'reference',title:'A',last_referenced:'2027-01-02',usages:[{date:'2026-12-31'}]},
 {id:'tie-b',title:'B',usages:[{date:'2027-01-01'}]},
 {id:'tie-a',title:'B',usages:[{date:'2027-01-01'}]},
 {id:'saved-only',title:'S',last_referenced:'2026-11-06'}
];
const referenceSnapshot=JSON.stringify(referenceFixtures);
assert.deepEqual(a.sortRecords(referenceFixtures,'referenced').map(r=>r.id),['reference','tie-a','tie-b','usage','saved-only','undated']);
assert.equal(JSON.stringify(referenceFixtures),referenceSnapshot);
const latestReference=r=>[r.last_referenced||'',...(r.usages||[]).map(x=>x.date||'')].sort().pop()||'';
let sorted=a.sortRecords(rows,'referenced');assert.deepEqual(sorted.map(latestReference),rows.map(latestReference).sort().reverse());let dates=a.sortRecords(rows,'report').map(r=>r.report_date||'');assert.deepEqual(dates,[...dates].sort().reverse());
s={...a.empty(),q:'MAS reserves',groups:['Singapore','Central banks'],type:'PDF',month:'2026-10',view:'topic',sort:'report'};assert.deepEqual(a.readState(new URLSearchParams(a.serialize(s))),s);
let g=a.groupRecords(rows.slice(0,20),s);assert.equal(g.reduce((n,[_,x])=>n+x.length,0),20);
let bad={...rows[0],title:'<script>x</script>',note:'<img src=x>',url:'javascript:alert(1)'};let html=a.card(bad,new Set());assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('href="javascript:'));assert(html.includes('&lt;script&gt;'));
assert.equal(a.safeURL('https://chatgpt.com/c/private'),'');assert.equal(a.safeURL('https://user:pass@host.org/x'),'');assert.equal(a.referenceHref({path:'../../secret.html'}),'');assert.equal(a.referenceHref({path:'data/archive/2026-10-29.json'}),'v4.html#headlines');
console.log('External source filtering, OR groups, combined filters, dates, sorting, stars, URL state, grouping and escaping passed.');

assert.equal(a.referenceHref({path:'data/watchlist/reports/watchlist-20261103T200000Z.html'}),'data/watchlist/reports/watchlist-20261103T200000Z.html');assert.equal(a.referenceHref({path:'data/hourly-archive/edition.json'}),'v4.html#hourly');

assert.equal(a.referenceHref({path:'data/credit-issues.json'}),'v4.html#credit');assert.equal(a.referenceHref({path:'data/ust-curves-daily.json'}),'v4.html#ust');assert.equal(a.referenceHref({path:'data/history-fed.json'}),'v4.html#history');
const more=JSON.parse(fs.readFileSync('site/data/supplemental-public-sources.json')).records;for(const r of more){const found=rows.find(x=>x.url===r.url);assert(found,r.url);for(const ref of r.references)assert(found.references.some(x=>x.id===ref.id&&x.date===ref.date));}

assert(rows.length>=1915);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.equal(new Set(rows.map(r=>r.url)).size,rows.length);
s={...a.empty(),provider:'GIC',layout:'table',view:'year'};assert.deepEqual(a.readState(new URLSearchParams(a.serialize(s))),s);const gic=a.filterRecords(rows,s);assert(gic.length>=10);const years=a.groupRecords(gic,s);assert.equal(years.reduce((n,[_,r])=>n+r.length,0),gic.length);let th=a.table(gic,new Set(),'GIC');for(const r of gic){assert(th.includes(a.safeURL(r.url).replace(/&/g,'&amp;')));assert(th.includes(r.status==='not_rechecked'?'Not rechecked':'Description &amp; access'));}assert(!a.table([bad],new Set(),'Test').includes('<script>'));assert(!a.table([bad],new Set(),'Test').includes('href="javascript:'));assert(a.table([{...rows[0],period:null,report_date:null}],new Set(),'Test').includes('Report date: unavailable'));

assert.equal(a.empty().layout,'table');
const actual=rows.filter(r=>r.usages?.length);assert(actual.length>2000);
const bank=rows.find(r=>r.url.endsWith('/3Q26_trading_update.pdf'));assert(bank);assert(bank.usages.some(x=>x.path==='research/sti-banks-2026-11-06/index.html'));
s={...a.empty(),q:'3Q26_trading_update.pdf'};assert(a.filterRecords(rows,s).some(r=>r.id===bank.id));
s={...a.empty(),q:'STI’s bank premium'};assert(a.filterRecords(rows,s).some(r=>r.id===bank.id));
s={...a.empty(),usage:'research/sti-banks-2026-11-06/index.html'};assert(a.filterRecords(rows,s).length>10);assert(a.filterRecords(rows,s).every(r=>r.usages.some(x=>x.path===s.usage)));
s={...a.empty(),usage:'unused'};assert(a.filterRecords(rows,s).every(r=>!r.usage_count));
s={...a.empty(),usage:'used'};assert(a.filterRecords(rows,s).every(r=>r.usage_count>0));
assert.deepEqual(a.readState(new URLSearchParams(a.serialize({...s,layout:'cards'}))),{...s,layout:'cards'});
const compact=a.table([bank],new Set(),'DBS');assert(compact.includes('aria-expanded="false"'));assert(compact.includes('class="source-detail-row" hidden'));assert(compact.includes('Used in Market Intel'));assert(compact.includes('research/sti-banks-2026-11-06/index.html'));assert(!compact.includes('Plus '));
const many={...bank,usages:Array.from({length:14},(_,i)=>({id:String(i),title:'Usage '+i,path:'research/article-'+i+'/index.html',type:'Research articles',date:''}))};assert(a.detail(many).includes('Usage 13'));
assert(a.detail({...bank,note:'<script>evil</script>',usages:[{title:'<img>',path:'javascript:alert(1)'}]}).includes('&lt;script&gt;'));assert(!a.detail({...bank,usages:[{title:'Unsafe',path:'javascript:alert(1)'}]}).includes('href="javascript:'));
console.log('Compact default, source URL / article title search, exact usage facets, expandable full descriptions and complete citation history passed.');
