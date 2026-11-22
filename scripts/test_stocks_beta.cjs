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
assert(!svg.includes('sb-price-curve'));
const priceSvg = S.plot([{
  name: 'Price', color: '#126c66',
  points: [['2026-01-01', 10], ['2026-01-02', 24], ['2026-01-08', 25], ['2026-01-09', 8], ['2026-01-20', 8]],
}], { from: '2026-01-01', to: '2026-01-20', title: 'Price', unit: 'USD' });
const pathCommands = priceSvg.match(/class="sb-price-curve"[^>]* d="([^"]+)"/)[1].split(/ (?=[MC])/);
const priceDots = [...priceSvg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)]
  .map(([, x, y]) => [Number(x), Number(y)].map(value => Number(value.toFixed(2))));
assert.equal(pathCommands.length, priceDots.length);
for (const [index, command] of pathCommands.entries()) {
  const coordinates = command.slice(1).split(' ').map(pair => pair.split(',').map(Number));
  assert.deepEqual(coordinates.at(-1), priceDots[index]);
  if (index === 0) continue;
  assert.equal(command[0], 'C');
  const [[, firstY], [, secondY]] = coordinates;
  const startY = priceDots[index - 1][1], endY = priceDots[index][1];
  assert([firstY, secondY].every(y => y >= Math.min(startY, endY) && y <= Math.max(startY, endY)),
    'The price curve must stay between adjacent observed prices');
}
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
const logoDirectory = require('../site/assets/company-logos/company-logos.json');
const tsmLogo = logoDirectory.companies.find(company => company.ticker === 'TSM');
const searchText = S.companySearchText({ticker:'TSM',name:'TSMC',aliases:['TSM US']},tsmLogo);
for(const query of ['TSM','TSMC','TAIWAN SEMICONDUCTOR'])assert(searchText.includes(query));
assert.equal(S.companySearchText({ticker:'TEST',name:'Example listing'},null),'TEST EXAMPLE LISTING');
console.log('Stocks BETA: search includes the exact listing and its verified company-name aliases.');

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
assert.match(fs.readFileSync(path.join(__dirname, '../site/stocks-beta2.html'), 'utf8'), /href="bos-monthly\.html"/);
{
  const { marketCap, quote } = require('../site/financial-display.js');
  const { projectionRow, forecastSection } = require('../site/stocks-beta2-research.js');
  const cap = marketCap([1.12345, 1.25]);
  assert.equal(cap.unit, 'USD M');assert.equal(cap.show(1.12345), '1,123');
  assert.equal(quote(0.03456), '0.0346');
  assert.deepEqual(projectionRow('Revenue (USD Bil)', ['1.22456', '2', null]), {
    label: 'Revenue (USD M)', values: ['1,225', '2,000', null]
  });
  assert.deepEqual(projectionRow('Net profit', ['0.1234', '-0.2456'], 'SGD m'), {
    label: "Net profit (SGD '000)", values: ['123', '-246']
  });
  assert.deepEqual(projectionRow('ROE (%)', ['12.345%', 'Turns negative'], 'SGD m'), {
    label: 'ROE (%)', values: ['12.35%', 'Turns negative']
  });
  assert.match(forecastSection({ rows: [['Revenue', '+12.345%', '-1.12%']], date: '2026-11-22' }, String),
    /data-direction="increase"[^>]*>\+12.3%.*data-direction="decrease"[^>]*>−1.1%/);
}
const ace = context.AceListingMatch.open(new ArrayBuffer(0));
const lookup = (isin, unit) => context.AceListingMatch.match(ace, isin, unit);
assert.deepEqual(Array.from(lookup('SG1L01001701', 'SGD').rows, row => row.row), [2, 3]);
assert.equal(lookup('SG1L01001701', 'EUR').state, 'currency');
assert.deepEqual(Array.from(lookup('SG1L01001701', 'EUR').currencies), ['SGD', 'USD']);
assert.equal(lookup('GB0005405286', 'GBp').rows[0].currency, 'GBP');
assert.equal(lookup(null, 'SGD').state, 'unverified');
assert.equal(lookup('SG1L01001702', 'SGD').state, 'missing');
console.log('BOS ACE matching: validates ISINs, keeps source rows and checks currencies.');

const { chartHistory, fairValuesForArchive, historyPoints, priceLabel, probabilityCone, researchConeTarget, targetBand } = require('../site/stocks-beta2-charts.js');
const history = require('../site/data/stocks-beta2-monthly-history.json');
const years = S.historyYears(undefined, 2026);
assert.deepEqual(years, {from:2017,to:null});
assert.deepEqual(S.historyYears({from:2020,to:2019},2026),{from:2020,to:2020});
assert.deepEqual(S.historyBounds(years,'2026-11-19'),{from:'2017-01-01',to:'2026-11-19'});
assert.deepEqual(S.historyBounds({from:2020,to:2021},'2026-11-19'),{from:'2020-01-01',to:'2021-12-31'});
const snapshot={reportDate:'2026-11-20',row:{instrumentId:'NVDA US',currency:'USD',priceAsOf:'2026-11-19',pe:9.6,pb:7}};
const peSigma=S.valuationSigma(history,snapshot,'pe',years);
const pbSigma=S.valuationSigma(history,snapshot,'pb',years);
assert.equal(peSigma.n,113);
assert.equal(peSigma.first,'2017-06-30');
assert.equal(peSigma.last,'2026-10-30');
assert.equal(peSigma.z.toFixed(2),'-2.32');
assert.equal(peSigma.sd.toFixed(2),'10.66');
assert.equal(peSigma.band,'strong');
assert.equal(pbSigma.z.toFixed(2),'-1.54');
assert.equal(pbSigma.sd.toFixed(2),'5.14');
assert.equal(pbSigma.band,'soft');
assert.match(S.valuationSigma(history,snapshot,'pe',{from:2026,to:null}).reason,/Insufficient history/);
assert(S.valuationSigma(history,{...snapshot,row:{...snapshot.row,currency:'CAD'}},'pe',years).reason);
const narrow={
  metrics:[['forward_pe','Forward P/E','×']],
  months:[['2025-12','2026-01-02','2025-12-31'],['2026-01','2026-02-02','2026-01-30'],
    ['2026-02','2026-03-02','2026-02-27'],['2026-11','2026-11-20','2026-11-19'],
    ['2026-10','2026-11-21','2026-10-30']],
  securities:[{ticker:'NVDA US',currency:'USD',observations:[[0,10],[1,100,0],[2,20],[3,999],[4,999]]}],
};
const narrowSigma=S.valuationSigma(narrow,snapshot,'pe',years);
assert.equal(narrowSigma.n,2,'Exclude predecessor, same-day and subsequently published observations');
assert.equal(narrowSigma.mean,15);
assert.equal(narrowSigma.z,null);
console.log('Stocks BETA: exact BOS valuation sigma, prior observations, sample size and global history range passed.');

const { briefs } = require('../site/data/stocks-beta2-research-briefs.json');
assert.deepEqual(Object.keys(briefs).sort(), history.securities.map(item => item.ticker).sort());
for (const brief of Object.values(briefs)) {
  assert.equal(new URL(brief.source).origin, 'https://productgroup.bankofsingapore.com');
  assert(brief.outlook && brief.target);
  const { periods, actuals, rows, readthrough, source } = brief.financials;
  assert.equal(new URL(source).origin, 'https://productgroup.bankofsingapore.com');
  assert(Number.isInteger(actuals) && actuals > 0 && actuals < periods.length);
  assert(periods.slice(0, actuals).every(period => period.endsWith('A')));
  assert(periods.slice(actuals).every(period => period.endsWith('E')));
  assert(rows.length && rows.every(row => row.length === periods.length + 1 && row[0]));
  assert(Array.isArray(readthrough));
}
assert(Object.values(briefs).some(({ financials }) => financials.periods.length > 3 && financials.rows.length > 4));
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
const adjustments = require('../site/data/stocks-beta2-history-adjustments.json');
const targetData = require('../site/data/stocks-beta2-morningstar.json');
for (const [ticker, quote, raw, price, fairValue] of [
  ['NVDA US', '2021-06-30', 800.10, 20.0025, 13.75],
  ['NVDA US', '2024-05-31', 1096.33, 109.633, 105],
  ['AMZN US', '2022-05-31', 2404.19, 120.2095, 192.5],
  ['GOOGL US', '2022-06-30', 2179.26, 108.963, 180],
  ['GOOG US', '2022-06-30', 2187.45, 109.3725, 180],
  ['GE US', '2021-07-30', 12.95, 103.6, 127.2],
]) {
  const original = history.securities.find(item => item.ticker === ticker);
  const basis = chartHistory(history, original, adjustments);
  const points = historyPoints(basis.data, basis.company, 'price', 0, history.months.length - 1);
  const point = points.find(item => item.quote === quote);
  assert(Math.abs(point.value - price) < 1e-10);
  assert.equal(original.observations.find(row => row[0] === point.index)[1], raw);
  const [overlay] = basis.fairValues(targetData[ticker]).filter(value => value.index === point.index);
  assert.equal(overlay.value, fairValue);
  assert.equal(fairValuesForArchive({ closes: [[quote, price]] }, [overlay]).length, 1);
  assert.equal(fairValuesForArchive({ closes: [[quote, price * .9]] }, [overlay]).length, 0);
}
const nvidiaBasis = chartHistory(history, history.securities.find(item => item.ticker === 'NVDA US'), adjustments);
assert.equal(nvidiaBasis.data.months.filter((month, index) => month[2] !== history.months[index][2]).length, 19);
assert.equal(nvidiaBasis.data.months.find(month => month[1] === '2021-06-01')[2], '2021-05-28');
const nvidiaCone = probabilityCone(nvidiaBasis.data, nvidiaBasis.company, historyPoints(nvidiaBasis.data, nvidiaBasis.company, 'price', 0, 112).at(-1));
assert.deepEqual([nvidiaCone.anchor.value, nvidiaCone.count, nvidiaCone.splits], [204.64, 36, 0]);
assert.equal(coneFor('AAPL US', 0).points, undefined, 'An early range cannot use later months to fit a cone');
assert.deepEqual([8, 9.86, 10.1, 290.47].map(priceLabel), ['8.0', '9.9', '10', '290']);
assert.equal(researchConeTarget(briefs['AAPL US'], 'USD').value, 290);
assert.equal(researchConeTarget(briefs['DBS SP'], 'SGD').value, 78);
assert.equal(researchConeTarget(briefs['DBS SP'], 'USD'), null);
assert.equal(researchConeTarget({ target: { value: '1,094.50', currency: 'GBp' } }, 'GBp').value, 1094.5);
assert.equal(researchConeTarget({ target: { value: 'N/A', currency: 'USD' } }, 'USD'), null);
assert.equal(researchConeTarget(undefined, 'USD'), null);
const limits = [160, 130, 100, 80, 60];
assert.deepEqual([170, 160, 130, 80, 75, 60, 50].map(value => targetBand(value, limits)), [
  'Above +2 SD', 'Between +1 and +2 SD', 'Within ±1 SD', 'Within ±1 SD',
  'Between −1 and −2 SD', 'Between −1 and −2 SD', 'Below −2 SD',
]);
console.log('Stocks BETA 2: listing research, price precision, and dated volatility cones passed.');

const aliases = [{ticker:'BRK-B',aliases:['BRK.B']},{ticker:'AAPL',aliases:['APPLE']},{ticker:'ANOTHER',aliases:['APPLE']}];
assert.deepEqual(S.startingSelection(new URLSearchParams('company=BRK.B'),aliases),['BRK-B']);
assert.deepEqual(S.startingSelection(new URLSearchParams('companies=BRK.B,BRK-B,APPLE'),aliases),['BRK-B']);
