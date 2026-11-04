const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = {Date, Set, Map, Number, String, encodeURIComponent};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('site/watchlist-report-links.js', 'utf8'), context);
const {entries, companyEntries, card, legend} = context.MarketWatchlistReports;
const bind=(item,index=0,scope='company')=>({index,scope,headline:item.headline,content_key:context.MarketWatchlistReports.contentKey(item),item_sha256:'a'.repeat(64)});
const reports = JSON.parse(fs.readFileSync('site/data/watchlist/report-index.json')).reports;
const editions = JSON.parse(fs.readFileSync('site/data/watchlist/index.json')).editions;
const researchIndex=JSON.parse(fs.readFileSync('site/data/watchlist/research-index.json')).editions;
const archives=Object.fromEntries(editions.map(e=>[e.id,JSON.parse(fs.readFileSync('site/'+e.path))]));
const latest = JSON.parse(fs.readFileSync('site/data/watchlist/latest.json'));
for (const row of latest.rows) {
  const result = entries(row.ticker, reports, editions, latest.as_of);
  assert.equal(result.length, reports.length);
  assert.equal(result[0].as_of, latest.as_of);
  assert(result.every(entry => entry.href.endsWith('#' + row.ticker)));
  const html = card(row.ticker, reports, editions, latest.as_of,false,archives,researchIndex);
  const meaningful=companyEntries(row.ticker,reports,editions,latest.as_of,archives,researchIndex);
  assert.equal(Boolean(html),Boolean(meaningful.length||row.ticker==='GOOGL'));
  if(html){assert(html.includes('Saved research editions'));assert(html.includes('Public · within Market Intel'));}
  assert(!html.includes('target="_blank"'));
  assert(!html.includes('chatgpt.com') && !html.includes('libfile_'));
}
const earliest = editions.at(-1);
assert.equal(entries('AAPL', reports, editions, earliest.as_of).length, 1, 'Archived views must not acquire newer reports');
assert.equal(entries('AAPL', reports, editions, 'invalid').length, 0);
assert.equal(entries('OTHER', reports, editions, latest.as_of).length, 0);
assert.equal(card('<script>', reports, editions, latest.as_of), '');
assert.equal(entries('AAPL', [...reports, reports[0]], editions, latest.as_of).length, reports.length);
for (const patch of [
  {path:'https://example.com/report'}, {path:'../../private.html'}, {path:'javascript:alert(1)'},
  {edition_id:'../secret'}, {as_of:'not a date'}, {sha256:'invalid'}
]) assert.equal(entries('AAPL', [{...reports[0], ...patch}], editions, latest.as_of).length, 0);
assert.equal(entries('AAPL', reports, [{...editions[0], as_of:'2026-01-01T00:00:00Z'}], latest.as_of).length, 0);
assert.equal(card('AAPL', [], [], latest.as_of),'');
assert.equal(card('AAPL', [], [], latest.as_of, true),'');
assert(!card('AAPL', [], [], latest.as_of, true).includes('(0)'));
assert(card('GOOGL', reports, editions, latest.as_of).includes('research/googl/'));
assert(legend().includes('External ↗'));
// These names had no approved research at this historical cutoff; future verified additions are allowed.
for(const t of ['MSFT','AVGO','MU'])assert.equal(companyEntries(t,reports,editions,'2026-11-04T08:00:00Z',archives,researchIndex).length,0);
assert(!companyEntries('NVDA',reports,editions,latest.as_of,archives,researchIndex).some(x=>x.edition_id==='watchlist-20261104T080000Z'));
// The newest overall edition need not contain new research for every company.
const amznEligible=editions.filter(ed=>Date.parse(ed.as_of)<=Date.parse(latest.as_of)&&
  (researchIndex[ed.id]?.AMZN||[]).some(approved=>approved.scope==='company'&&
    archives[ed.id]?.rows.find(row=>row.ticker==='AMZN')?.research?.[approved.index]?.headline===approved.headline))
  .sort((a,b)=>Date.parse(b.as_of)-Date.parse(a.as_of)||b.id.localeCompare(a.id));
assert(amznEligible.length,'Fixture archive must contain independently indexed AMZN research');
const amznSaved=companyEntries('AMZN',reports,editions,latest.as_of,archives,researchIndex);
assert.equal(amznSaved[0].edition_id,amznEligible[0].id,'Open the newest eligible company edition, not the newest overall edition');
const laterAsOf=new Date(Date.parse(latest.as_of)+4*60*60*1000).toISOString().replace('.000Z','Z');
const laterId='watchlist-'+laterAsOf.replace(/[-:]/g,'');
const laterReport={...reports[0],edition_id:laterId,as_of:laterAsOf,path:'data/watchlist/reports/'+laterId+'.html'};
const laterEdition={id:laterId,as_of:laterAsOf,path:'data/watchlist/archive/'+laterId+'.json'};
const laterReports=[laterReport,...reports],laterEditions=[laterEdition,...editions];
const unrelatedArchives={...archives,[laterId]:{rows:[{ticker:'AMZN',research:[]},{ticker:'META',research:[{headline:'New source-checked META item',facts:['META-only fact']}]}]}};
const unrelatedIndex={...researchIndex,[laterId]:{META:[{index:0,headline:'New source-checked META item'}]}};
const afterUnrelated=companyEntries('AMZN',laterReports,laterEditions,laterAsOf,unrelatedArchives,unrelatedIndex);
assert.equal(JSON.stringify(afterUnrelated.map(x=>x.edition_id)),JSON.stringify(amznSaved.map(x=>x.edition_id)),'A newer unrelated edition must not add an empty AMZN link or hide prior research');
const newCompanyItem={headline:'New source-checked AMZN item',date:laterAsOf.slice(0,10),facts:['A distinct AMZN fact'],analysis:'Dated analysis',risks:'Dated risk',next_watch:'Dated next check',sources:[{title:'Issuer source',url:'https://ir.aboutamazon.com/'}]};
const relatedArchives={...archives,[laterId]:{...latest,id:laterId,as_of:laterAsOf,rows:[{ticker:'AMZN',research:[newCompanyItem]}]}};
const relatedIndex={...researchIndex,[laterId]:{AMZN:[bind(newCompanyItem)]}};
assert.equal(companyEntries('AMZN',laterReports,laterEditions,laterAsOf,relatedArchives,relatedIndex)[0].edition_id,laterId,'A genuinely approved new company item must become the newest link');
assert.equal(companyEntries('AMZN',laterReports,laterEditions,latest.as_of,relatedArchives,relatedIndex)[0].edition_id,amznEligible[0].id,'An older cutoff must not acquire the new company item');
const mismatchedIndex={...relatedIndex,[laterId]:{AMZN:[{index:0,headline:'Mismatched title'}]}};
assert.equal(companyEntries('AMZN',laterReports,laterEditions,laterAsOf,relatedArchives,mismatchedIndex)[0].edition_id,amznEligible[0].id,'An unverified mapping must not expose a link');
for(const mutate of [x=>x.facts.push('Unreviewed fact'),x=>x.analysis='Different interpretation',x=>x.risks='Risk removed',x=>x.next_watch='Different catalyst',x=>x.date='2000-01-01',x=>x.sources[0].url='https://example.com/changed',x=>x.sources[0].title='Different attribution']){
 const changed=structuredClone(newCompanyItem);mutate(changed);
 const tampered={...relatedArchives,[laterId]:{...relatedArchives[laterId],rows:[{ticker:'AMZN',research:[changed]}]}};
 assert.equal(companyEntries('AMZN',laterReports,laterEditions,laterAsOf,tampered,relatedIndex)[0].edition_id,amznEligible[0].id,'Same headline cannot approve changed material content');
}
const unmapped={...relatedArchives,[laterId]:{...relatedArchives[laterId],rows:[{ticker:'AMZN',research:[{...newCompanyItem,scope:'company'}]}]}};
assert.equal(companyEntries('AMZN',laterReports,laterEditions,laterAsOf,unmapped,researchIndex)[0].edition_id,amznEligible[0].id,'Self-declared company scope cannot bypass review');
for(const t of ['GOOGL','AMZN','META'])assert(companyEntries(t,reports,editions,latest.as_of,archives,researchIndex).some(x=>x.edition_id==='watchlist-20261104T160000Z'),'The reviewed 16:00 edition is reachable for '+t);
console.log('PASS all 12 share report controls, exact company anchors, archived cutoffs, stable sorting, duplicates, invalid data/URLs, unavailable versus empty state, public/private and internal/external labels');
