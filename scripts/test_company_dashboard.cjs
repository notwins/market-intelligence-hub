const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dashboard=require('../site/company-dashboard.js'),membership=require('../site/watchlist-membership.js');
const read=p=>JSON.parse(fs.readFileSync('site/'+p,'utf8'));
const old=read('data/watchlist/latest.json'),snapshot=JSON.stringify(old),rows=membership.merge(old.rows);
a.deepEqual(dashboard.companies.map(c=>c.ticker),['GOOGL','BABA','TSM','NVDA','AAPL','AMZN']);
a.equal(rows.length,15);a.equal(JSON.stringify(old),snapshot);a.equal(old.rows.length,12);
const baba=rows.find(r=>r.ticker==='BABA');a.equal(baba.currency,'USD');a.equal(baba.bbTicker,'BABA US');a.deepEqual(baba.returns,[]);a.equal(baba.price.close,undefined);a.equal(membership.merge(rows).length,15);
for(const [ticker,bbTicker] of [['D05.SI','DBS SP'],['U11.SI','UOB SP']]){
  const bank=rows.find(r=>r.ticker===ticker);a.equal(bank.price.currency,'SGD');a.equal(bank.bbTicker,bbTicker);a.deepEqual(bank.returns,[]);
}
a.equal(dashboard.matches({title:'Alibaba funding',tags:[]},dashboard.companies[1]),true);
a.equal(dashboard.matches({title:'Babaco market',tags:[]},dashboard.companies[1]),false);
const news=dashboard.newsFor([{title:'Old',href:'https://www.reuters.com/x',tickers:['BABA'],published_at:'2026-11-10'},{title:'New',href:'https://www.reuters.com/x',tickers:['BABA'],published_at:'2026-11-16'},{title:'Wrong company',href:'https://www.reuters.com/y',tickers:['GOOGL'],published_at:'2026-11-17'},{title:'Unsafe',href:'javascript:alert(1)',tickers:['BABA'],published_at:'2026-11-17'}],'BABA');
a.equal(dashboard.newsFor([{title:'Pope visits the Amazon rainforest',href:'https://www.reuters.com/rainforest',tickers:['AMZN'],published_at:'2026-11-17'}],'AMZN').length,0);
a.equal(news.length,1);a.equal(news[0].title,'New');
const points=dashboard.valuationPoints([{date:'2026-11-01',value:null},{date:'2026-11-02',value:0},{date:'2026-11-03',value:12,reportDate:'2026-11-04'}],'pe',{row:{priceAsOf:'2026-11-16',pe:11},sourceUrl:'https://example.com',reportDate:'2026-11-17'});
a.deepEqual(points.map(p=>[p.date,p.value]),[['2026-11-03',12],['2026-11-16',11]]);a.match(dashboard.chart(points,'Forward P/E','BABA'),/Dots show observed dates/);a.doesNotMatch(dashboard.chart(points,'Forward P/E','BABA'),/<polyline/);
for(const page of ['desk.html','v4.html']){const html=fs.readFileSync('site/'+page,'utf8');a.match(html,/company-dashboard.js/);a.match(page==='desk.html'?fs.readFileSync('site/desk.js','utf8'):html,/CompanyDashboard.shell/);}
for(const page of ['historical-fred.html','fred-1.html','fred-2.html','fred-3.html','v4.html'])a.match(fs.readFileSync('site/'+page,'utf8'),/watchlist-membership.js/);
const home=dashboard.shell({home:true});
for(const ticker of ['JPM','WMT','V'])a.match(home,new RegExp('data-company="'+ticker+'"'));
a.equal(dashboard.matches({title:'Plan V still applies',tags:[]},dashboard.homeAdditions[2]),false);
const combined=dashboard.combinedChart(points,points,'BABA');
a.equal((combined.match(/<svg/g)||[]).length,1);
a.equal((combined.match(/<polyline/g)||[]).length,2);
a.match(dashboard.combinedChart([],points,'BABA'),/Forward P\/E <strong>Unavailable/);
const earnings=read('data/earnings-history.json').companies.find(c=>c.ticker==='BABA');a.equal(earnings.history[0].eps,.55);a.equal(earnings.history[0].revenue_usd_bn,39.639);a.match(earnings.eps_basis,/ADS/);a.equal(earnings.next_earnings.date,'2026-11-19');
console.log('PASS six-card order, current BABA membership with immutable 12-name archives, exact ADS identity, earnings units, safe newest news and source-only valuation dots');
