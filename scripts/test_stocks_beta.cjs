/* Financial boundary checks: exact identities, source-consistent previous price and honest overlays. */
const assert=require('node:assert/strict');
const S=require('../site/stocks-beta.js');
assert.equal(S.previousQuote({sourceId:'bos',date:'2026-11-13',close:162.85},{daily:[['2026-11-12',999]]},{points:[['2026-11-12',166.19],['2026-11-13',162.85]]}).value,166.19);
assert.equal(S.previousQuote({sourceId:'bos',date:'2026-11-13',close:162.85},{daily:[['2026-11-12',999]]},null),null,'Never compare a BOS quote with an unrelated prior source');
assert.equal(S.previousQuote({sourceId:'yahoo',date:'2026-11-13',close:110},{daily:[['2026-11-12',100],['2026-11-13',110]]},null).pct,10.000000000000009);
const records=[{id:'US',ticker:'TEST',bbTicker:'TEST US',currency:'USD'},{id:'SG',ticker:'TEST',bbTicker:'TEST SP',currency:'SGD'}];
assert.equal(S.findRecord(records,{ticker:'TEST',currency:'USD'},null,null).id,'US');
assert.equal(S.findRecord([...records,records[0]],{ticker:'TEST',currency:'USD'},null,null),null,'Ambiguous identity must not silently match');
assert.equal(S.findRecord(records,{ticker:'TEST',currency:'HKD'},null,null),null);
const vals=S.valuationPoints([{date:'2026-01-01',value:20,reportDate:'2026-01-02'},{date:'2026-01-01',value:21,reportDate:'2026-01-03'},{date:'2026-02-01',value:0},{date:'2026-03-01',value:-1}], 'pe',{row:{priceAsOf:'2026-11-13',pe:11.2},reportDate:'2026-11-16'});
assert.deepEqual(vals.map(p=>p.value),[21,11.2]);
let r=S.rebase([{name:'price',points:[['2026-01-01',50],['2026-02-01',100],['2026-03-01',150]]},{name:'pe',points:[['2026-02-01',10],['2026-03-01',15]],dots:true}]);
assert.equal(r.date,'2026-02-01');assert.deepEqual(r.series.map(s=>s.points),[[['2026-02-01',100],['2026-03-01',150]],[['2026-02-01',100],['2026-03-01',150]]]);
assert.equal(S.rebase([{points:[['2026-01-01',2]]},{points:[['2026-02-01',3]]}]).series.length,0,'No interpolation to manufacture a common base');
const news=Array.from({length:14},(_,i)=>({id:String(i),tickers:['NVDA'],href:'https://example.com/'+i,published_at:'2026-11-'+String(i+1).padStart(2,'0')}));
news.push({...news[13],writeup:{body:'Saved explanation'}});news.push({id:'bad',tickers:['NVDA'],href:'javascript:alert(1)'});news.push({id:'other',tickers:['NVDA2'],href:'https://example.com/other'});
const latest=S.newsFor(news,'NVDA');assert.equal(latest.length,10);assert.equal(latest[0].id,'13');assert.equal(latest[0].writeup.body,'Saved explanation');assert(!latest.some(n=>['bad','other'].includes(n.id)));
const svg=S.plot([{name:'P/E',points:[['2026-01-01',20],['2026-03-01',30]],dots:true,color:'#123456'}],{from:'2026-01-01',to:'2026-03-01',title:'P/E',unit:'times'});
assert(!svg.includes('<polyline'),'Sparse valuations must stay dots, without filling missing editions');assert(!svg.includes('NaN'));
console.log('Stocks BETA: source, identity, news, sparse valuation and overlay boundary checks passed.');

const watchlist = ['NVDA','TSM','BABA','GOOGL','AAPL','MSFT','AMZN','META','D05.SI','U11.SI'];
const listings = ['JPM', ...watchlist.slice().reverse(), 'WMT'].map(ticker => ({ticker}));
const select = query => S.startingSelection(new URLSearchParams(query), listings);
assert.deepEqual(select(''), watchlist);
assert.deepEqual(select('columns=2'), watchlist);
assert.deepEqual(select('companies=U11.SI,NVDA,U11.SI,DBA,D05.SI'), ['U11.SI','NVDA','D05.SI']);
assert.deepEqual(select('company=MSFT'), ['MSFT']);
assert.deepEqual(select('companies='), []);
assert.deepEqual(select('companies='+[...watchlist,'JPM','WMT'].join(',')), watchlist);
console.log('Stocks BETA: ten-card default, SGD listings last, explicit selections and card limit passed.');

// The archive joins by the verified ISIN and currency, and retains duplicate source rows.
require('../site/v3-source-engine.js');
const aceRows = [
  ['ISIN', 'Security Currency', 'Security Name'],
  ['SG1L01001701', 'SGD', 'Synthetic primary'],
  ['SG1L01001701', 'SGD', 'Synthetic duplicate'],
  ['SG1L01001701', 'USD', 'Synthetic different currency'],
  ['GB0005405286', 'GBP', 'Synthetic UK listing'],
  ['SG1L01001702', 'SGD', 'Invalid check digit'],
];
aceRows.forEach((row, index) => { row.sourceRow = index + 1; });
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = {
  USTDecisionImport: {
    canonicalIsin: globalThis.USTDecisionImport.canonicalIsin,
    openWorkbook: () => ({
      sheets: ['Notes', 'ACE'],
      readSheet(name) { assert.equal(name, 'ACE'); return aceRows; },
    }),
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site/ace-listing-match.js'), 'utf8'), context);
const ace = context.AceListingMatch.open(new ArrayBuffer(0));
const lookup = (isin, unit) => context.AceListingMatch.match(ace, isin, unit);
assert.deepEqual(Array.from(lookup('SG1L01001701', 'SGD').rows, row => row.row), [2, 3]);
assert.equal(lookup('SG1L01001701', 'EUR').state, 'currency');
assert.deepEqual(Array.from(lookup('SG1L01001701', 'EUR').currencies), ['SGD', 'USD']);
assert.equal(lookup('GB0005405286', 'GBp').rows[0].currency, 'GBP');
assert.equal(lookup(null, 'SGD').state, 'unverified');
assert.equal(lookup('SG1L01001702', 'SGD').state, 'missing');
console.log('BOS ACE matching: validates ISINs, keeps source rows and checks currencies.');

const { historyPoints, priceLabel, probabilityCone } = require('../site/stocks-beta2-charts.js');
const history = require('../site/data/stocks-beta2-monthly-history.json');
const { briefs } = require('../site/data/stocks-beta2-research-briefs.json');
assert.deepEqual(Object.keys(briefs).sort(), history.securities.map(item => item.ticker).sort());
for (const brief of Object.values(briefs)) {
  assert.equal(new URL(brief.source).origin, 'https://productgroup.bankofsingapore.com');
  assert(brief.outlook && brief.target && brief.financials.periods.length >= 2);
  assert(brief.financials.periods[0].endsWith('A'));
  assert(brief.financials.periods.slice(1).every(period => period.endsWith('E')));
}
const coneFor = (ticker, end = history.months.length - 1) => {
  const company = history.securities.find(item => item.ticker === ticker);
  const anchor = historyPoints(history, company, 'price', 0, end).at(-1);
  return probabilityCone(history, company, anchor);
};
const apple = coneFor('AAPL US');
assert.equal(apple.count, 36);
assert.equal(apple.points.length, 13);
assert(apple.points[0].every(price => price === apple.anchor.value));
assert.equal(apple.points[12][2], apple.anchor.value);
assert(apple.points[12][0] > apple.points[6][0]);
assert(apple.points[12][4] < apple.points[6][4]);
assert(Math.abs(Math.log(apple.points[12][1] / apple.anchor.value) - apple.sigma * Math.sqrt(12)) < 1e-12);
assert.equal(coneFor('NVDA US').splits, 1);
assert.equal(coneFor('INTC US').splits, 0, 'Genuine moves with matching market-cap changes stay in the sample');
assert.equal(coneFor('AAPL US', 0).points, undefined, 'An early range cannot use later months to fit a cone');
assert.deepEqual([8, 9.86, 10.1, 290.47].map(priceLabel), ['8.0', '9.9', '10', '290']);
console.log('Stocks BETA 2: listing research, price precision, and dated volatility cones passed.');
