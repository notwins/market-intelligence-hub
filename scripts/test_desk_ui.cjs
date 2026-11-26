'use strict';
const assert=require('node:assert/strict');
const Desk=require('../site/desk.js');
const DeskNews=require('../site/desk-news.js');
const tests=[];function test(name,fn){tests.push([name,fn]);}
test('links reject active schemes, traversal, private chats and embedded credentials',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,bad','//evil.test/x','../secret','%2e%2e/secret','https://a:b@example.org','https://chatgpt.com/c/private','https://chat.openai.com/c/private','https://x.test/white space','x\\y'])assert.equal(Desk.safeHref(url),'',url);
 for(const url of ['research/a/','search.html?q=AAPL','#markets','https://www.reuters.com/world/story'])assert.equal(Desk.safeHref(url),url);
});
test('canonical directory and index destinations deduplicate while editions remain distinct',()=>{
 assert.equal(Desk.canonical('research/a/'),Desk.canonical('research/a/index.html#title'));
 assert.notEqual(Desk.canonical('research/a/'),Desk.canonical('research/a-r2/'));
 const result=Desk.mergeReports([{id:'a',title:'A',href:'research/a/',added_at:'2026-11-10T00:00:00Z'}],[{id:'a',title:'Updated metadata',href:'research/a/index.html',added_at:null},{id:'r2',href:'research/a-r2/'}]);
 assert.equal(result.length,2);assert.equal(result.find(r=>r.id==='a').added_at,'2026-11-10T00:00:00Z');
});
test('archive uses real publication chronology across timezones and leaves undated research last',()=>{
 const rows=[{id:'undated',research_date:'2099-01-01'},{id:'sgt',added_at:'2026-11-14T08:00:00+08:00'},{id:'utc',added_at:'2026-11-14T01:00:00Z'},{id:'old',added_at:'2026-11-01T00:00:00Z',research_date:'2099-01-02'}].sort(Desk.archiveSort);
 assert.deepEqual(rows.map(r=>r.id),['utc','sgt','old','undated']);
});
test('research cutoff and verification time are not substituted for upload time',()=>{
 const rows=[{id:'new-source',research_date:'2026-11-14',verified_at:'2026-11-14T20:00:00Z'},{id:'old-paper-new-upload',uploaded_at:'2026-11-14T02:00:00Z',research_date:'2004-03-01'}].sort(Desk.archiveSort);
 assert.equal(rows[0].id,'old-paper-new-upload');
});
test('company matching is exact and source destinations deduplicate',()=>{
 const news=[{id:'a',href:'https://example.org/story',tickers:['GOOGL']},{id:'alias',href:'https://example.org/story#top',tickers:['GOOGL']},{id:'class-c',href:'https://example.org/goog',tickers:['GOOG']},{id:'evil',href:'javascript:evil()',tickers:['GOOGL']}];
 assert.deepEqual(Desk.matchNews(news,'GOOGL').map(n=>n.id),['a']);
 assert.equal(Desk.matchNews(news,'AAPL').length,0);
});
test('merged news remains newest-first and follows the selected company into research',()=>{
 const rows=Desk.matchNews([{id:'old',href:'https://example.org/old',published_at:'2026-11-05',tickers:['NVDA']},{id:'multi',href:'https://example.org/new',published_at:'2026-11-14',tickers:['MSFT','NVDA']},{id:'undated',href:'https://example.org/unknown',tickers:['NVDA']}],'NVDA');
 assert.deepEqual(rows.map(r=>r.id),['multi','old','undated']);
 assert.equal(Desk.newsResearchHref(rows[0],'NVDA'),'search.html?q=NVDA');
 assert.equal(Desk.newsResearchHref(rows[0],'all'),'search.html?q=MSFT');
});
test('charts retain zero values, escape labels and expose accessible meaning',()=>{
 const svg=Desk.spark([['2026-01-01',0],['2026-01-02',1]],'<USD>');
 assert(svg.includes('<svg'));assert(svg.includes('role="img"'));assert(svg.includes('&lt;USD&gt;'));assert(!svg.includes('NaN'));
 assert(!Desk.spark([['2026-01-01',1]],'USD').includes('<svg'));
});
test('charts fail closed for impossible and nonchronological dates',()=>{
 for(const points of [[['2026-99-01',1],['2026-99-02',2]],[['2026-01-01',1],['2026-01-03',2],['2026-01-02',3]],[['2026-01-01',1],['2026-01-01',2]]]){
  const result=Desk.spark(points,'USD');assert(!result.includes('NaN'));assert(!result.includes('<svg'));
 }
});
test('hourly company reading uses exact topic tokens and preserves unknown publisher times',()=>{
 const story={story_id:'tesla',headline:'Tesla invites customers',topic:'US / Tesla / Vehicles',source_urls:['https://www.reuters.com/tesla'],version:1};
 const edition={cutoff:'2026-11-14T16:00:00+08:00',coverage:'partial',stories:[story,{...story,story_id:'incidental',topic:'US / Apple pie / Food'}],sources:[]};
 const rows=DeskNews.fromHourly({editions:[edition]},[{ticker:'TSLA',name:'Tesla'},{ticker:'AAPL',name:'Apple'}]);
 assert.equal(rows.length,1);assert.deepEqual(rows[0].tickers,['TSLA']);assert.equal(rows[0].published_at,null);assert.equal(rows[0].edition_cutoff,edition.cutoff);
});
test('hourly revisions retain latest version and unsafe/private source URLs are excluded',()=>{
 const base={story_id:'a',headline:'Nvidia update',topic:'US / Nvidia',source_urls:['https://www.reuters.com/nvidia'],version:1};
 const rows=DeskNews.fromHourly({editions:[{stories:[base,{...base,version:2,headline:'Corrected Nvidia update'},{...base,story_id:'private',source_urls:['https://chatgpt.com/c/private']}],sources:[{url:'https://www.reuters.com/nvidia',published_date:'2026-11-14'}]}]},[{ticker:'NVDA',name:'Nvidia'}]);
 assert.equal(rows.length,1);assert.equal(rows[0].version,2);assert.equal(rows[0].published_at,'2026-11-14');
});
test('current desk quotes follow shared BOS/Yahoo selection without loading chart history',()=>{
 let q={close:250,date:'2026-11-12',sourceLabel:'Bank of Singapore',current:true};
 const market={resolve:()=>({currency:'USD'}),currentQuote:()=>q,displayUnit:i=>i.currency,series:()=>{throw Error('History must be lazy');}};
 assert.equal(Desk.selectedPrice('AAPL',market).value,250);assert.equal(Desk.selectedPrice('AAPL',market).status_label,'Bank of Singapore');
 q={close:240,date:'2026-11-13',sourceLabel:'Yahoo Finance',current:true};assert.equal(Desk.selectedPrice('AAPL',market).status_label,'Yahoo Finance');assert.equal(Desk.selectedPrice('AAPL',market).as_of,'2026-11-13');
 q={...q,current:false};assert(Desk.selectedPrice('AAPL',market).status_label.includes('dated observation'));
 q={...q,close:null};assert.equal(Desk.selectedPrice('AAPL',market),null);
});
test('stock moves use a daily close before the calendar cutoff and reject coverage gaps',()=>{
 const daily=[['2025-10-22',25],['2026-03-30',50],['2026-04-23',80],['2026-04-30',100]];
 assert.equal(Desk.priceMove(daily,'2026-04-30',{days:7}),25);
 assert.equal(Desk.priceMove(daily,'2026-04-30',{months:1}),100);
 assert.equal(Desk.priceMove(daily,'2026-04-30',{months:6}),null);
 assert.equal(Desk.priceMove([...daily.slice(0,-1),['2026-05-31',100]],'2026-05-31',{months:1}),25);
 assert.equal(Desk.priceMove(daily,'2026-05-01',{days:7}),null);
});
test('1D compares consecutive trading closes and rejects a stale previous close',()=>{
 const daily=[['2026-11-12',80],['2026-11-20',100],['2026-11-23',125]];
 assert.equal(Desk.priceMove(daily,'2026-11-23',{sessions:1}),25);
 assert.equal(Desk.priceMove(daily,'2026-11-20',{sessions:1}),null);
 assert.equal(Desk.priceMove(daily,'2026-11-22',{sessions:1}),null);
});
test('multiple trading sessions skip weekends and leave gaps unavailable',()=>{
 const sessions=[['2026-11-12',25],['2026-11-13',30],['2026-11-16',40],['2026-11-17',45],['2026-11-18',50],['2026-11-19',60],['2026-11-20',75]];
 assert.equal(Desk.priceMove(sessions,'2026-11-20',{sessions:6}),200);
 assert.equal(Desk.priceMove(sessions,'2026-11-20',{sessions:2}),50);
 assert.equal(Desk.priceMove(sessions,'2026-11-20',{sessions:7}),null);
 assert.equal(Desk.priceMove([['2026-11-02',80],...sessions],'2026-11-13',{sessions:2}),null);
});
test('long lookbacks use older period dates without filling a gap in the daily series',()=>{
 const daily=[['2025-12-01',80],['2026-09-30',80],['2026-11-20',100]];
 const archive={weekly:[['2025-11-16',50],['2025-11-23',80]],monthly:[['2024-09-30',10],['2024-10-31',40],['2024-11-30',80]]};
 assert.deepEqual(Desk.moveObservation(daily,'2026-11-20',{months:12},archive),
  {value:100,from:'2025-11-16',to:'2026-11-20',grain:'saved weekly period'});
 assert.deepEqual(Desk.moveObservation(daily,'2026-11-20',{months:24},archive),
  {value:150,from:'2024-10-31',to:'2026-11-20',grain:'saved monthly period'});
 assert.equal(Desk.moveObservation(daily,'2026-11-20',{months:1},archive),null);
 assert.equal(Desk.moveObservation(daily,'2026-11-20',{months:25}, {weekly:[],monthly:[['2024-09-01',50]]}),null);
});
test('Yearly compares a verified 20-year close and leaves shorter listings empty',()=>{
 const long={closes:[['2006-11-20',10],['2026-11-20',100]],prior:null};
 const short={closes:[['2007-11-20',10],['2026-11-20',100]],prior:null};
 assert.deepEqual(Desk.archiveYearlyMove(long,{months:240}),
  {value:900,from:'2006-11-20',to:'2026-11-20',grain:'imported daily close'});
 assert.equal(Desk.archiveYearlyMove(short,{months:240}),null);
 assert.equal(Desk.archiveYearlyMove({...long,prior:{before:'2022-01-01',label:'Predecessor'}},{months:240}).grain,
  'imported close · Predecessor');
 const base={weekly:[],monthly:[['2006-11-30',10],['2007-10-31',20]]};
 assert.equal(Desk.moveObservation([['2026-11-19',100]],'2026-11-19',{months:240},base),null);
 assert.equal(Desk.moveObservation([['2026-11-30',100]],'2026-11-30',{months:240},base).value,900);
});
test('price archive matches exact listing and currency and rejects duplicate or invalid closes',()=>{
 const {parseArchive}=require('../site/stock-price-archive.js');
 const record={listing:'GOOGL US',symbol:'GOOGL',currency:'USD',prior:null,closes:[['2006-11-20',10],['2026-11-20',100]]};
 const archive={format:'mih-stock-price-archive',version:1,source:'Yahoo Finance Close',asOf:'2026-11-20',listings:[record]};
 const parsed=parseArchive(archive);
 assert.equal(parsed.listings.get('GOOGL US|USD'),record);
 assert.equal(parsed.symbols.get('GOOGL|CAD'),undefined);
 assert.equal(parsed.symbols.get('GOOG|USD'),undefined);
 assert.throws(()=>parseArchive({...archive,listings:[record,record]}),/duplicate listing/);
 assert.throws(()=>parseArchive({...archive,listings:[{...record,closes:[['2006-02-30',10]]}]}),/invalid close or date/);
 assert.throws(()=>parseArchive({...archive,listings:[{...record,closes:[['2026-11-21',10]]}]}),/invalid close or date/);
});
test('stock move colours use fixed bands with matching gain and loss boundaries',()=>{
 for(const [move,band] of [[0.1,1],[4.9,1],[5,2],[9.9,2],[10,3],[15,3],[15.1,4],[100,4]]){
  assert.equal(Desk.moveHeat(move),'gain-'+band);
  assert.equal(Desk.moveHeat(-move),'loss-'+band);
 }
 assert.equal(Desk.moveHeat(0),'flat');
 assert.equal(Desk.moveHeat(null),'missing');
});
test('Stocks BETA 2 offers exact additional equity listings without duplicating the BOS archive',()=>{
 const {sharedPriceCompanies}=require('../site/stocks-beta2.js');
 const securities=[{ticker:'BRK/B US',currency:'USD'},{ticker:'BABA US',currency:'USD'}];
 const mappings=[
  {instrumentId:'BRK/B US',listingId:'brk-b',currency:'USD',verified:true},
  {instrumentId:'BABA US',listingId:'baba',currency:'USD',verified:true},
  {instrumentId:'BABA US',listingId:'9988-hk',currency:'HKD',verified:false}
 ];
 const instruments=[
  {id:'brk-b',ticker:'BRK-B',name:'Berkshire',currency:'USD',asset_type:'equity'},
  {id:'baba',ticker:'BABA',name:'Alibaba ADS',currency:'USD',asset_type:'equity'},
  {id:'9988-hk',ticker:'9988.HK',name:'Alibaba Hong Kong',currency:'HKD',asset_type:'equity'},
  {id:'spy',ticker:'SPY',name:'SPY',currency:'USD',asset_type:'equity_etf'}
 ];
 assert.deepEqual(sharedPriceCompanies(securities,instruments,mappings).map(c=>[c.key,c.ticker,c.currency]),
  [['price:9988-hk','9988.HK','HKD']]);
 const MarketPrices=require('../site/share-prices.js');
 assert(MarketPrices.card('DIS',{showWorkspaceActions:false}).includes('data-price-hide-workspace-actions'));
 assert(!MarketPrices.card('DIS').includes('data-price-hide-workspace-actions'));
});
test('financial statement outlines keep core totals visible and nest detailed rows from the source',()=>{
 const {statementHierarchy,table}=require('../site/company-fundamentals.js');
 const rows=[[0,'Section',[null]],[1,'Total Assets',[100]],[2,'Current Assets',[60]],[3,'Cash',[20]],
  [2,'Fixed Assets',[40]],[1,'Total Equity',[40]],[0,'Supplemental section',[null]],[1,'Additional point',[5]]];
 const outline=statementHierarchy(rows);
 assert.deepEqual(outline.map(row=>row.parent),[undefined,undefined,1,2,1,undefined,undefined,6]);
 assert.deepEqual(outline.map(row=>row.expandable),[false,true,true,false,false,false,true,false]);
 const report={rows,periods:['2025'],currency:'USD'};
 const grouped=table(report,'balance',true);
 assert(grouped.includes('data-fund-parent="2" hidden'));
 assert(grouped.includes('aria-expanded="false" aria-label="Details for Total Assets"'));
 assert(grouped.includes('data-fund-height')&&grouped.includes('data-fund-fit'));
 assert(!table(report,'balance').includes('data-fund-parent'));
 assert(!table({ ...report,rows:[[0,'Revenue',[100]]]},'income',true).includes('data-fund-all'));
});
test('financial statements switch fiscal periods for the chart and table together',()=>{
 const {unpack,reportContent}=require('../site/company-fundamentals.js');
 const annual={currency:'USD',fiscalEnd:'Dec 31',periods:['2025','2026'],rows:[[0,'Total Assets',[10e6,11e6]]]};
 const quarter={...annual,periods:['Q4 2025','Q1 2026','TTM'],rows:[[0,'Total Assets',[11e6,13e6,45e6]]]};
 const company={capturedAt:'2026-11-21T07:00:00+08:00',statements:{balance:annual,cash:annual,income:annual},
  quarterlyCapturedAt:'2026-11-22',quarterly:{balance:quarter,cash:null,income:quarter}};
 const catalogue=[['DEMO US','XNAS','DEMO','USD']];
 const companies={'DEMO US':company};
 assert.doesNotThrow(()=>unpack({version:1,source:'Morningstar',companies},catalogue));
 assert.doesNotThrow(()=>unpack({version:2,source:'Morningstar',companies},catalogue));
 const year=reportContent(company,'balance','DEMO US',true,true).html;
 assert.match(year,/Annual · As Originally Reported/);
 assert.match(year,/5-year change/);
 const quarterly=reportContent(company,'balance','DEMO US',true,true,true).html;
 assert.match(quarterly,/Quarterly · As Originally Reported/);
 assert.match(quarterly,/<option value="1" selected>Q1 2026<\/option><option value="0">Q4 2025<\/option>/);
 assert.match(quarterly,/5-quarter change/);
 assert.match(quarterly,/title="Q1 2026 minus Q4 2025">\+2/);
 assert.match(quarterly,/fund-quarter-plot/);
 const missing=reportContent(company,'cash','DEMO US',true,true,true).html;
 assert.match(missing,/no quarterly figures/);
 assert.doesNotMatch(missing,/fund-table/);
});
test('Stocks BETA 2 rounds financial rows and calculates QoQ on adjacent unrounded quarters',()=>{
 const {table}=require('../site/company-fundamentals.js');
 const report={compact:true,currency:'USD',periods:['TTM','Q1 2026','Q4 2025','Q2 2025','Q1 2025'],rows:[
  [0,'Total Revenue',[200e6,125040000,100000000,98e6,96e6]],
  [1,'Net Income',[5000,50000,-100000,100,0]],
  [1,'Diluted EPS',[1,0.01,null,0.02,0]],
 ]};
 const html=table(report,'income',true,true);
 assert.match(html,/USD M/);assert.match(html,/USD &#39;000/);assert.match(html,/per share/);
 assert.match(html,/data-tc-value="125040000">125/);
 assert.match(html,/Revenue QoQ/);assert.match(html,/Net income QoQ/);
 assert.match(html,/data-fund-index="qoq-1" data-fund-parent="0" hidden/);
 assert.match(html,/data-direction="increase" data-tc-value="150">\+150%/);
 assert.match(html,/fund-missing fund-ttm/);
 assert.doesNotMatch(table(report,'income',true,false),/QoQ/);
 assert.doesNotMatch(table(report,'balance',true,true),/QoQ/);
});
test('company cards group exact tickers, open saved reading and keep source links inside the popup',()=>{
 const cards=require('../site/company-news-cards.js');
 const story={story_id:'nvda',headline:'Nvidia update',topic:'US / Nvidia',source_urls:['https://www.reuters.com/nvidia'],version:1,body:'Saved facts',analysis:'Saved analysis',watch_next:'Next disclosure',earlier:''};
 const rows=DeskNews.fromHourly({editions:[{cutoff:'2026-11-14T16:00:00+08:00',coverage:'partial',stories:[story],sources:[]}]},[{ticker:'NVDA',name:'Nvidia'}]);
 assert.deepEqual(cards.reading(rows[0]).map(p=>p[1]),['Saved facts','Saved analysis','Next disclosure']);
 assert.equal(cards.reading({title:'Metadata only'}).length,0,'no invented write-up for a headline');
 const html=cards.render(rows,[{ticker:'NVDA',name:'Nvidia'},{ticker:'AAPL',name:'Apple'}],'all');
 assert.equal((html.match(/class="company-news-card"/g)||[]).length,2);
 assert(html.includes('data-company-news="0"'));assert(!html.includes('href="https://www.reuters.com/nvidia"'));
 assert(html.includes('v4.html?company=NVDA#earnings'));
 const unsafe=cards.render([{...rows[0],title:'<img src=x onerror=evil()>'}],[{ticker:'NVDA',name:'Nvidia'}],'all');assert(!unsafe.includes('<img'));
});
test('home chart shortcuts preserve all real historical destinations and accessible icons',()=>{
 const nav=require('../site/history-navigation.js'),html=nav.html();
 assert.equal(nav.items.length,8);for(const route of ['historical-fred.html','fred-1.html','fred-2.html','fred-3.html'])assert(html.includes(route));assert(html.includes('v4.html#history/beta4-shares'));assert(html.includes('aria-hidden="true"'));assert(!html.includes('javascript:'));
});
test('history directory shares four groups and the same destinations across rail, toolbar and home',()=>{
 const fs=require('node:fs'),nav=require('../site/history-navigation.js');assert.deepEqual(nav.groups.map(g=>g.id),['bonds','shares','gold','fred']);
 const all=nav.groups.flatMap(g=>g.items);assert.equal(new Set(all.map(i=>i[0])).size,all.length);
 const [bonds,shares,gold,fred]=nav.groups;
 assert.deepEqual(gold.items.map(i=>i[3]),['tools/gold-charts.html']);
 assert.deepEqual(shares.items.map(i=>i[0]),['stocks-beta','stocks-beta2','stocks-beta3','shares','si','beta2-shares','beta4-shares','spx','si-beta2']);
 assert.deepEqual(bonds.items.slice(0,3).map(item=>item[3]),['bonds-beta.html','v4.html#credit','v4.html#ust']);
 assert(!bonds.items.some(i=>['si','si-beta2'].includes(i[0])));
 assert.deepEqual(fred.items.slice(0,6).map(i=>i[3]),['fred/','fred/market-desk.html','fred/risk-observatory.html','fred/signal-review.html','fred/cross-market-replay.html','fred/data.html']);
 const rail=nav.sidebar(),menu=nav.toolbar('yield'),home=nav.html();
 for(const rendered of [rail,menu,home]){
  assert.match(rendered,/<(?:a|button)[^>]+(?:data-history-id|data-tab)="fx"[^>]+data-nav-tone="blue"/);
 }
 for(const rendered of [rail,menu,home])assert.doesNotMatch(rendered,/beta-shares|beta3-shares/);
 for(const rendered of [rail,menu,home])assert(rendered.indexOf('href="cross-market-history.html"') < rendered.indexOf('data-history-group=') && rendered.includes('href="cross-market-history.html"'));
 for(const item of all){assert(rail.includes('data-history-id="'+item[0]+'"'));assert(menu.includes(item[3]?'href="'+item[3]+'"':'data-tab="'+item[0]+'"'));assert(home.includes(item[3]||'v4.html#history/'+item[0]));}
 assert(menu.includes('data-active-group="true"'));assert(menu.includes('data-tab="yield" aria-pressed="true"'));assert(menu.includes('focusable="false"'));assert(rail.includes('id="rail-group-history"><a href="#history" data-view="history">History</a>'));
 const html=fs.readFileSync('site/v4.html','utf8');assert(html.includes(rail));assert(!html.includes('class="rail-subsection"><span>Fred-'));
 for(const p of ['v4.html','desk.html'])assert(fs.readFileSync('site/'+p,'utf8').includes('menu=20261116.groups1'));
});
test('main news leads the sidebar and contains Calls and My Blog once',()=>{
 const fs=require('node:fs'),html=fs.readFileSync('site/v4.html','utf8'),rail=html.slice(html.indexOf('<nav aria-label="Desktop navigation">'),html.indexOf('</nav><div class="rail-foot">'));
 assert(rail.startsWith('<nav aria-label="Desktop navigation"><div class="rail-group" role="group" aria-labelledby="rail-group-1">'));
 const main=rail.slice(0,rail.indexOf('<div class="rail-group rail-history"'));
 for(const view of ['overview','earnings','credit','policy','calls'])assert(main.includes('data-view="'+view+'"'));
 assert(main.includes('href="market-understanding/"'));assert(main.includes('My Blog'));
 assert.equal((rail.match(/data-view="calls"/g)||[]).length,1);assert.equal((rail.match(/href="market-understanding\/"/g)||[]).length,1);
 assert(!rail.includes('Research Explained'));
});
test('Shares Beta 3 compares like periods, splits ties and scores only common fundamentals',()=>{
 const M=require('../site/stocks-beta3-model.js');
 const annual=(end,values)=>({end,values});
 const group=[1,2].map(scale=>({model:'operating',years:[
  annual('2025-12-31',{revenue:120*scale,operatingIncome:24*scale,netIncome:12*scale,equity:70*scale,assets:120*scale,operatingCashFlow:8*scale,capex:8*scale}),
  annual('2024-12-31',{revenue:100*scale,netIncome:10*scale,equity:50*scale,assets:100*scale})
 ]}));
 const [issuer]=group, latest=M.yearFor(issuer,'latest');
 assert.equal(M.metric(issuer,latest,'roe'),20);
 assert.equal(M.metric(issuer,latest,'freeCashFlow'),0);
 assert.equal(M.yearFor(issuer,'2023'),undefined);
 assert.deepEqual(M.initialPeers({companies:{A:{peers:['A','B','B','missing']},B:{}}},'A'),['B']);
 let scores=M.checklist(group,group.map(c=>c.years[0]));
 assert.equal(scores.counted,6);assert.deepEqual(scores.winners,[0,1]);assert.deepEqual(scores.scores,[3,3]);
 delete group[1].years[0].values.capex;
 scores=M.checklist(group,group.map(c=>c.years[0]));
 assert.equal(scores.counted,5);assert.deepEqual(scores.rows.at(-1).winners,[]);
 assert.deepEqual(M.leaders([2.01,2.04,-1]),[0,1]);assert.deepEqual(M.leaders([null,2]),[]);
 const bank={...issuer,model:'bank'};
 assert.equal(M.metric(bank,latest,'freeCashFlow'),null);
 assert.deepEqual(M.criteria([bank]),['revenueGrowth','profitGrowth','roe','roa']);
 const gaps={years:[latest,annual('2023-12-31',{revenue:100})]};
 assert.equal(M.metric(gaps,latest,'revenueGrowth'),null);
 issuer.years[1].values.netIncome=-10;
 assert.equal(M.metric(issuer,latest,'profitGrowth'),null);
 assert.equal(M.checklist([issuer],[latest]).counted,0);
});
test('Shares Beta 3 gives BOS matches priority, resolves listing aliases and compares up to ten distinct competitors',()=>{
 const E=require('../site/stocks-beta3-comparison.js'),companies={};
 for(let i=0;i<13;i++)companies['C'+i]={name:'Company '+i,ticker:'T'+i+' US',peers:[],years:[],currency:'USD'};
 companies.C0.peers=['C2','C3'];
 const names=Object.keys(companies),data=E.prepare({companies,listings:[{ticker:'T0 US',id:'C0',name:'Class A'}]},{
  aliases:{names:{'Foreign Co':'FOREIGN','Company one':'C1'},symbols:{},ambiguousSymbols:['DUAL']},
  peerGroups:{groups:{bank:{members:names,related:[]}},companies:{C0:{groups:['bank']}}}
 });
 const report={subject:'Company 0',columns:['Ticker','P/E'],rows:[['Company 0','T0','16'],['Company one','T1','10'],['Foreign Co','T2','9']]};
 const members=E.reportMembers(data,report,'C0');
 assert.equal(members[0].subject,true);assert.equal(members[1].id,'C1');assert.equal(members[2].id,null);
 const selected=E.select(data,'C0',10,['C1','C1','C0']);
 assert.deepEqual(selected.slice(0,3),['C1','C2','C3']);assert.equal(selected.length,10);assert.equal(new Set(selected).size,10);
 assert.equal(E.select(data,'C0',5).length,5);assert.equal(E.count('99'),5);
});
test('Shares Beta 3 calculates dated equity and enterprise multiples without assuming missing inputs',()=>{
 const E=require('../site/stocks-beta3-comparison.js');
 const y={end:'2025-12-31',values:{netCommon:20,revenue:80,operatingIncome:25,ebitda:50,totalDebt:30,cash:20,preferredEquity:2,noncontrollingInterest:3,equity:102}};
 const company={ticker:'T US',currency:'USD',filed:'2026-02-02',period:y.end,model:'operating',years:[y]};
 const market={date:'2026-11-25',currency:'USD',cap:200,forwardPE:8};
 const quarter={period:'Q3 2026',values:{revenue:100,netIncome:15}};
 const data={companies:{T:company},expansion:{market:{'T US':{latest:market,history:{[y.end]:{...market,date:'2025-12-31'}}}},quarters:{'T US':{currency:'USD',asOf:'2026-11-22',quarters:[{period:'Q3 2025',values:{revenue:80}},quarter],ttm:{netCommon:25}}}}};
 const view=()=>E.valueView(data,'T','T US',y,'latest');
 let v=view().values;
 assert.equal(v.peTTM,8);assert.equal(v.peFY,10);assert.equal(v.ev,215);assert.equal(v.evEbitda,4.3);assert.equal(v.proxyEvEbitda,4.2);assert.equal(v.priceBook,2);assert.equal(v.qGrowth,25);
 assert.equal(E.valueView(data,'T','T US',y,'2025').values.peFY,undefined);
 delete y.values.noncontrollingInterest;v=view().values;assert.equal(v.evEbitda,undefined);assert.equal(v.proxyEvEbitda,4.2);
 market.date='2026-11-10';assert.equal(view().values.peTTM,undefined);assert.equal(view().values.peFY,10);
 y.values.netCommon=-1;assert(view().nm.has('peFY'));
 market.currency='GBP';assert.equal(view().values.peFY,undefined);
 market.currency='USD';company.model='bank';assert.equal(view().values.proxyEvEbitda,undefined);
 delete y.values.netCommon;market.priceBasisOK=true;market.quoteCurrency='USD';market.quotePrice=72;market.epsEnd=y.end;market.priceEps=9;y.values.dilutedEps=72;
 assert.equal(view().values.peFY,8);market.priceBasisOK=false;assert.equal(view().values.peFY,undefined);
 delete data.expansion.quarters['T US'];company.model='operating';market.date='2026-11-25';
 data.expansion.interim={T:{ended:'2026-09-30',filed:'2026-11-12',source:'https://www.sec.gov/example.htm',currency:'USD',values:{netCommon:10,revenue:85}}};
 assert.equal(view().values.peTTM,20);assert.equal(view().values.ttmRevenue,85);
 market.date='2026-11-11';assert.equal(view().values.peTTM,undefined);
 market.date='2026-11-25';market.includesPreferred=true;y.values.noncontrollingInterest=3;
 assert.equal(view().values.peTTM,undefined);assert.equal(view().values.ev,213);
});
test('Shares Beta 3 keeps signed revenue components, stated geographic boundaries and source-denominated shares',()=>{
 const D=require('../site/stocks-beta3-disclosures.js');
 const d={kind:'geography',total:100,items:[{label:'U.S.',type:'country',value:60},{label:'Asia Pacific',type:'region',value:41},{label:'Hedge',type:'other',value:-1}]};
 const second={kind:'geography',total:200,items:[{label:'United States',type:'country',value:80},{label:'Asia Pacific excluding China',type:'region',value:120}]};
 const rows=D.mixRows([{geo:{geography:d}},{geo:{geography:second}}],'geography');
 assert.deepEqual(rows[0].cells.map(x=>x.p),[60,40]);
 assert.equal(rows.find(x=>x.name==='Hedge').cells[0].p,-1);
 assert.equal(rows.find(x=>x.name==='Asia Pacific').cells[1],null);
 assert.equal(rows.length,4);
});
test('Shares Beta 3 separates grouped maturities, audited balances, confirmed zeroes and recent cash',()=>{
 const D=require('../site/stocks-beta3-disclosures.js'),co={model:'operating'},y={end:'2025-12-31',values:{cash:20,assets:200,liabilities:100,currentLiabilities:50,currentAssets:80,totalDebt:40,operatingCashFlow:12,operatingIncome:16,equity:90}};
 const s={kind:'debt',total:80,items:[{label:'Years 1–3',bucket:null,value:50},{label:'After year 3',bucket:null,value:30}]};
 const req={issuers:{T:{years:{[y.end]:{facts:{treasuries:{value:0},opLeaseTotal:{value:4},interestExpense:{value:2}},schedules:[s]}},latestBalance:{end:'2026-09-30',fields:{cash:300}}}}};
 const v=D.yearView(req,'T',co,y);assert.equal(v.v.cashAssets,10);assert.equal(v.v.treasuryAssets,0);assert.equal(v.v.interestCover,8);assert.equal(v.v.cashShort,null);assert.equal(v.v.leasesTotal,null);assert.equal(v.v.dueCash,null);assert.equal(v.current.fields.cash,300);
 assert.deepEqual(D.maturityRows([v],'debt').map(r=>r.key),['Years 1–3','After year 3']);
 s.firstYear=10;assert.equal(D.yearView(req,'T',co,y).v.dueCash,2);
 assert.equal(D.yearView(req,'T',{model:'bank'},y).v.interestCover,null);
 assert.deepEqual(D.yearView(req,'T',co,{end:'2024-12-31',values:{}}).sch,{});
});
test('Solvency ranks use shared evidence, matched business models, fair ties and lower leverage direction',()=>{
 const D=require('../site/stocks-beta3-disclosures.js');
 const comp=(model,v)=>({company:{model},v});
 const a=[comp('operating',{equityAssets:20,cashFlowAssets:11,debtAssets:40}),comp('operating',{equityAssets:20,cashFlowAssets:11,debtAssets:20}),comp('bank',{equityAssets:50,cet1:16.5})];
 const s=D.ranking(a);
 assert.deepEqual(s.common,['equityAssets','cashFlowAssets','debtAssets']);
 assert.deepEqual(s.ranks.map(x=>x?.rank),[2,1,undefined]);assert.equal(s.scores[2],null);
 assert.deepEqual(D.ranking(a,'equityAssets').ranks.map(x=>x?.rank),[1,1,undefined]);
 assert.deepEqual(D.ranking(a,'debtAssets').ranks.map(x=>x?.rank),[2,1,undefined]);
 assert.equal(D.ranking([comp('bank',{equityAssets:9}),comp('bank',{equityAssets:7,cet1:12})]).scores[0],null);
 const sparse=[comp('operating',{equityAssets:20,netAssetsRatio:28,cashFlowAssets:9}),comp('operating',{netAssetsRatio:30,cashFlowAssets:10})];
 assert.deepEqual(D.ranking(sparse).common,['netAssetsRatio','cashFlowAssets']);
 assert.deepEqual(D.ranking(sparse).scores,[0,100]);
});


test('Quarterly comparisons preserve periods and calculate from aligned filing scopes',()=>{
  const Q=require('../site/shares-quarterly-core.js');
  const source='https://www.sec.gov/company-report';
  const prior={period:'Q3 2025',source,balance:{assets:80,equity:40},values:{revenue:60,netIncome:5}};
  const latest={period:'Q3 2026',kind:'10-Q',source,end:'2026-09-30',filed:'2026-11-05',priorBalanceEnd:'2025-12-31',
    balance:{assets:100,equity:50,cash:20,currentAssets:25,currentLiabilities:10,totalDebt:40},priorBalance:{assets:120,equity:90},
    values:{revenue:75,netIncome:15,operatingIncome:30,operatingCashFlow:20,capex:5},
    ytd:{operatingCashFlow:60}};
  const record={currency:'USD',observations:[prior,latest],ttm:{end:latest.end,values:{netIncome:30,revenue:275,operatingCashFlow:50}}};
  const q=Q.view(record,{currency:'USD',model:'operating'}); const v=q.values;
  assert.equal(v.revenueGrowth,25);assert.equal(v.operatingMargin,40);assert.equal(v.fcfMargin,20);
  assert.equal(v.currentRatio,2.5);assert.equal(v.cashDebt,50);assert.equal(v.debtCoverage,125);
  assert.equal(v.roe,100*30/45);assert.equal(v.ttmNetCommon,undefined);
  assert.equal(q.ytd.operatingCashFlow,60);assert.equal(v.operatingCashFlow,20);
  assert.equal(Q.view(record,{currency:'JPY'}),null);
  assert.equal(Q.view(record,{model:'bank'}).values.currentRatio,null);
  assert.equal(Q.view(record,{observation:prior}).values.ttmRevenue,undefined);
  assert.equal(Q.view({...record,ttm:{end:'2026-06-30',values:{netCommon:100}}}).values.ttmNetCommon,undefined);
});
test('Morningstar trailing figures must match four consecutive quarterly observations',()=>{
  const Q=require('../site/shares-quarterly-core.js');
  const series=[1,2,3,4].map(n=>({period:'Q'+n+' 2026',source:'https://www.morningstar.com/',values:{revenue:n,netCommon:2}}));
  const record={currency:'SGD',observations:series,ttm:{kind:'Morningstar',period:'Q4 2026',values:{revenue:500,netCommon:8}}};
  const current=Q.view(record);
  assert.equal(current.values.ttmRevenue,undefined);
  assert.equal(current.values.ttmNetCommon,8);
  assert.equal(Q.view({...record,observations:series.slice(1)}).ttm,null);
});

test('Calendar quarters align different fiscal labels and keep the newest Form 10-Q as the default',()=>{
  const Q=require('../site/shares-quarterly-core.js');
  const source='https://www.sec.gov/company-report';
  const obs=(period,end,kind='10-Q')=>({period,end,kind,source,values:{}});
  const alphabet={observations:[obs('Q2 2026',null,'Morningstar'),obs('Q3 2026','2026-09-30'),obs('Q4 2026','2026-12-31','Issuer quarterly results')]};
  const apple={observations:[obs('Q3 2026','2026-06-27'),obs('Q4 2026','2026-09-26','10-K bridge')]};
  const microsoft={observations:[obs('Q1 2027','2026-09-30'),obs('Q2 2027','2026-12-31','Issuer quarterly results')]};
  const indexes=[alphabet,apple,microsoft].map(record=>Q.quarterIndex(record,null,'2027-01-31'));
  assert.equal(indexes[0].get('2026-Q2').period,'Q2 2026');
  assert.equal(indexes[1].get('2026-Q3').period,'Q4 2026');
  assert.equal(indexes[2].get('2026-Q3').period,'Q1 2027');
  const result=Q.comparisonQuarters(indexes);
  assert.deepEqual(result.latest,{quarter:'2026-Q3',coverage:3,has10Q:true});
  assert.equal(result.quarters[0].quarter,'2026-Q4');
  assert.equal(Q.comparisonQuarters([new Map()]).latest,undefined);
});
test('QoQ uses adjacent standalone quarters and YoY uses the comparable year-ago period',()=>{
  const Q=require('../site/shares-quarterly-core.js');
  const source='https://www.sec.gov/company-report';
  const obs=(period,end,revenue)=>({period,end,kind:'10-Q',source,values:{revenue,netIncome:revenue}});
  const a=obs('Q3 2025','2025-09-30',80),b=obs('Q2 2026','2026-06-30',100),c=obs('Q3 2026','2026-09-30',120);
  const record={currency:'USD',observations:[a,b,c]};
  assert.equal(Q.view(record,{growthBasis:'yoy'}).values.revenueGrowth,50);
  assert.equal(Q.view(record,{growthBasis:'qoq'}).values.revenueGrowth,20);
  assert.equal(Q.view({...record,observations:[a,c]},{growthBasis:'qoq'}).values.revenueGrowth,null);
  assert.equal(Q.view({...record,observations:[a,{...b,values:{revenue:-1}},c]},{growthBasis:'qoq'}).values.revenueGrowth,null);
});

let failures=0;for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+'\n'+e.message);}}
process.exitCode=failures?1:0;
