const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../site'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const redirect=require('../site/legacy-redirect.js'),archive=require('../site/archive-reader.js'),saved=require('../site/saved-securities.js');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function target(url){return redirect.destination(new URL(url,'https://example.test/hub/'));}
test('all retired entries preserve supported V4 routes and query filters without loops',()=>{
 for(const page of ['index.html','v1.html','v3.html','v3-backup.html','v3-settings-preview.html']){
  for(const route of ['overview','watchlist','calls','policy','tools','master/explore','master/pivot','master/watchlists','master/screens','master/review','history/yield','history/fx','history/curves','ust','earnings','credit','reports','hourly','headlines','research','feeds']){
   assert.equal(target(page+'?v=20261103.mobile&security=00001#'+route),'v4.html?security=00001#'+route);
  }
  const html=read(page);assert.ok(html.length<2000);assert.ok(html.includes('src="legacy-redirect.js"'));assert.ok(html.includes('<noscript>'));
  for(const destination of ['v4.html','v2.html','archive.html','saved-securities.html'])assert.ok(html.includes('href="'+destination+'"'));
  assert.ok(!html.includes('data-view='));
 }
 assert.equal(target('v3-settings-preview.html'),'v4.html#feeds');
 assert.equal(target('v3.html#unknown'),'v4.html#overview');
 assert.equal(target('v3.html#history/unknown'),'v4.html#overview');
 assert.equal(target('v3.html#//evil.test'),'v4.html#overview');
});
test('old query and hash bookmarks retain archives, shortlists and equivalent current sections',()=>{
 for(const page of ['index.html','v1.html']){
  for(const [old,route] of [['overview','overview'],['stocks','watchlist'],['bonds','watchlist'],['news','headlines'],['directory','watchlist']])assert.equal(target(page+'?view='+old+'&q=Amazon'),'v4.html?q=Amazon#'+route);
  assert.equal(target(page+'?view=archive&report=2026-10-29-us-earnings'),'archive.html?report=2026-10-29-us-earnings');
  assert.equal(target(page+'?view=archive&day=2026-10-29'),'archive.html?day=2026-10-29');
  assert.equal(target(page+'?view=saved'),'saved-securities.html');
  assert.equal(target(page+'#archive'),'archive.html');assert.equal(target(page+'#saved'),'saved-securities.html');
 }
});
test('preference migration changes only the retired dashboard preference and tolerates blocked storage',()=>{
 for(const preference of [null,'v1','v2','v3','v4']){
  const values=new Map([['market-hub-version',preference],['market-hub-v3-workspace','preserved'],['market-intelligence-shortlist-v1','["stock:AMZN"]']]),writes=[];
  const storage={getItem:k=>values.get(k),setItem:(k,v)=>{values.set(k,v);writes.push(k)}};
  redirect.migrate(storage);
  assert.equal(values.get('market-hub-version'),['v1','v3'].includes(preference)?'v4':preference);
  assert.ok(writes.every(k=>k==='market-hub-version'));
  assert.equal(values.get('market-hub-v3-workspace'),'preserved');assert.equal(values.get('market-intelligence-shortlist-v1'),'["stock:AMZN"]');
  vm.runInNewContext(read('version-switch.js'),{localStorage:storage});
 }
 redirect.migrate({getItem(){throw Error('blocked')}});
 vm.runInNewContext(read('version-switch.js'),{localStorage:{getItem(){throw Error('blocked')}}});
 assert.ok(!read('version-switch.js').includes('option'));
});
test('full report text, dates, company briefs, metrics and every evidence URL remain readable',()=>{
 const reports=JSON.parse(read('data/reports.json')).reports;
 assert.ok(reports.some(r=>r.date==='2026-10-29'));assert.ok(reports.some(r=>r.date==='2026-10-30'));
 for(const r of reports){
  const html=archive.reportHTML(r);
  for(const text of [r.date,r.title,r.subtitle,r.takeaway,r.period_note,r.status,r.verified_at,...r.items.flatMap(x=>[x.company,x.ticker,x.headline,x.detail,...x.metrics.flat()]),...r.sections.flatMap(x=>[x.label,x.text])].filter(Boolean))assert.ok(html.includes(String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))),text);
  for(const url of [...r.sources,...r.items.flatMap(x=>[x.url,x.evidence_url])])assert.ok(html.includes(archive.safeURL(url)),url);
 }
 assert.equal(archive.safeURL('javascript:alert(1)'),'');
 assert.ok(archive.reportHTML({id:'x',title:'<img onerror=bad>'}).includes('&lt;img'));
});
test('every indexed daily snapshot renders every headline without the dashboard row limit',()=>{
 const index=JSON.parse(read('data/archive-index.json'));
 for(const day of index.days){
  const d=JSON.parse(read('data/archive/'+day.date+'.json')),html=archive.snapshotHTML(d,day.date);
  assert.equal((html.match(/class="headline"/g)||[]).length,d.items.length);
  for(const x of d.items)assert.ok(html.includes(archive.safeURL(x.url)),x.url);
 }
});
test('saved reader preserves unknown keys and supports complete CSV and JSON exports without storage writes',()=>{
 const data=JSON.parse(read('data/securities.json')),keys=['stock:AMZN','bond:'+data.bonds[0].id,'bond:missing-id','custom:unknown'];
 const before=JSON.stringify(keys),rows=saved.rows(keys,data),csv=saved.csv(rows);
 assert.equal(JSON.stringify(keys),before);assert.equal(rows.length,keys.length);assert.ok(rows[0].url.includes('morningstar'));assert.equal(rows[1].url,data.bonds[0].url);
 for(const key of keys)assert.ok(csv.includes(key));
 assert.ok(saved.csv([{identifier:'=HYPERLINK("bad")'}]).includes("'=HYPERLINK"));
 assert.ok(!/localStorage\.(setItem|removeItem|clear)/.test(read('saved-securities.js')));
 assert.ok(read('saved-securities.js').includes('JSON.stringify(keys,null,2)'));
});
test('current navigation offers archive and saved access without retired dashboard choices',()=>{
 for(const file of ['v4.html','v2.html','site-map.html']){
  const html=read(file);assert.ok(!/href="v[13](?:-backup|-settings-preview)?\.html/.test(html));assert.ok(!html.includes('Version 1'));
  assert.ok(html.includes('archive.html'));assert.ok(html.includes('saved-securities.html'));
 }
 assert.ok(read('site-map.html').includes('href="v2.html"'));
});
test('search opens exact report editions and snapshot dates and excludes retired dashboard pages',()=>{
 const entries=JSON.parse(read('data/site-search.json')).entries;
 for(const report of JSON.parse(read('data/reports.json')).reports){
  const entry=entries.find(e=>e.kind==='Report'&&e.date===report.date&&e.title===report.title);
  assert.ok(entry);assert.equal(entry.href,'archive.html?report='+report.id+'#report-'+report.id);assert.equal(entry.location.exact,true);
 }
 assert.ok(!entries.some(e=>/^v[13](?:-backup|-settings-preview)?\.html/.test(e.href||'')));
 assert.ok(entries.some(e=>e.location.href==='archive.html?day=2026-10-29#archive-snapshot'));
 assert.ok(entries.some(e=>e.kind==='Page'&&e.href==='v2.html'));
});
console.log(`${checks} retirement regression groups passed.`);
