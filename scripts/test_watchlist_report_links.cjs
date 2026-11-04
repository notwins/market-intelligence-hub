const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = {Date, Set, Map, Number, String, encodeURIComponent};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('site/watchlist-report-links.js', 'utf8'), context);
const {entries, companyEntries, card, legend} = context.MarketWatchlistReports;
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
for(const t of ['MSFT','AVGO','MU'])assert.equal(companyEntries(t,reports,editions,latest.as_of,archives,researchIndex).length,0);
assert(!companyEntries('NVDA',reports,editions,latest.as_of,archives,researchIndex).some(x=>x.edition_id==='watchlist-20261104T080000Z'));
assert.equal(companyEntries('AMZN',reports,editions,latest.as_of,archives,researchIndex)[0].edition_id,latest.id);
console.log('PASS all 12 share report controls, exact company anchors, archived cutoffs, stable sorting, duplicates, invalid data/URLs, unavailable versus empty state, public/private and internal/external labels');
