'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync('site/'+name,'utf8');
const sortByCap=(rows,identity=x=>x)=>rows.slice().sort((a,b)=>{
  const x=identity(a),y=identity(b),av=caps[x.ticker||x.id],bv=caps[y.ticker||y.id];
  return (av===undefined?1:0)-(bv===undefined?1:0)||(av===undefined?0:bv-av)||String(x.name||x.ticker||x.id).localeCompare(String(y.name||y.ticker||y.id));
});
let caps={};
const enrichment={sortShares:sortByCap,load:async()=>{},version:()=>JSON.stringify(caps),detailHtml:item=>`<details class="test-trr"><summary>Returns &amp; credit ${item.ticker}</summary></details>`};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function context(extra={}){const listeners={},nodes={},ctx={URL,Date,Number,console,setInterval:()=>{},setTimeout,localStorage:{getItem:()=>null,setItem:()=>{}},document:{hidden:false,addEventListener:(n,f)=>(listeners[n]??=[]).push(f),getElementById:k=>nodes[k],querySelector:()=>null,querySelectorAll:()=>[]},fetch:async path=>({ok:true,json:async()=>JSON.parse(read(path))}),ShareEnrichment:enrichment,...extra};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);return {ctx,listeners,nodes};}
function cut(file,first,next){const text=read(file);return text.slice(text.indexOf(first),text.indexOf(next,text.indexOf(first)));}

(async()=>{
  const bos=require('../site/bos-equity.js');
  const row=(id,name,cap,sector='Technology')=>({instrumentId:id,ticker:id,name,marketCapUsdBillions:cap,sector,region:'US',marketGroup:'US',currency:'USD'});
  const records=[row('A','A small',1),row('Z','Z largest',10),row('M','M missing',null),row('B','B zero',0)];
  const source=JSON.stringify(records),state={query:'',group:'none',sort:'cap'};
  assert.deepEqual(bos.filtered({records},state).map(x=>x.instrumentId),['Z','A','B','M']);
  assert.deepEqual(bos.filtered({records},{...state,sort:'name'}).map(x=>x.instrumentId),['A','B','M','Z']);
  assert.equal(JSON.stringify(records),source);
  assert.equal(bos.valuationById('UNLOADED US'),null);
  console.log('PASS BOS cap default, missing-last, zero, explicit name order and immutable rows');

  const master=[{id:'bond',name:'A bond',category:'Bonds',isin:'B'},{id:'small',name:'B share',category:'Shares',lastPrice:3},{id:'fund',name:'C fund',category:'Funds'},{id:'large',name:'D share',category:'Shares',lastPrice:1},{id:'missing',name:'E share',category:'Shares',lastPrice:2}];
  caps={small:1,large:10};
  const m={C:{filterMaster:rows=>rows.slice()},X:{master:{records:master},sort:'cap'},masterFilter:()=>({}),ShareEnrichment:enrichment,window:{ShareEnrichment:enrichment}};
  vm.createContext(m);vm.runInContext(cut('v4-tools.js','function masterRows()','function rawNum'),m);
  assert.deepEqual(Array.from(m.masterRows(),x=>x.id),['bond','large','fund','small','missing']);
  m.X.sort='price';assert.deepEqual(Array.from(m.masterRows(),x=>x.id),['small','missing','large','bond','fund']);
  assert.equal(master[0].id,'bond');
  console.log('PASS master share slots rank by cap while non-shares and explicit price order remain independent');

  const w=context();w.nodes['watchlist-results']={innerHTML:''};
  vm.runInContext(read('watchlist-report-links.js'),w.ctx);vm.runInContext(read('watchlist.js'),w.ctx);
  w.ctx.MarketWatchlist.connect(()=>{});await tick();await tick();
  caps={AAPL:1,NVDA:10};
  let html=w.ctx.MarketWatchlist.view();assert.ok(html.indexOf('id="NVDA"')<html.indexOf('id="AAPL"'));assert.match(html,/test-trr/);
  caps={AAPL:100,NVDA:1};for(const f of w.listeners['share-enrichment-updated']||[])f();
  html=w.nodes['watchlist-results'].innerHTML;assert.ok(html.indexOf('id="AAPL"')<html.indexOf('id="NVDA"'));
  for(const f of w.listeners.change)await f({target:{id:'watchlist-sort',value:'watchlist'}});
  const explicit=w.nodes['watchlist-results'].innerHTML;caps={TSM:999};for(const f of w.listeners['share-enrichment-updated']||[])f();assert.equal(w.nodes['watchlist-results'].innerHTML,explicit);
  for(const f of w.listeners.change)await f({target:{id:'watchlist-edition',value:'watchlist-20261103T120000Z'}});
  assert.doesNotMatch(w.ctx.MarketWatchlist.view(),/test-trr/);
  console.log('PASS current watchlist TRR, async cap reorder, explicit order retention and archived-edition isolation');

  caps={NVDA:10,AAPL:1};const e=context();e.nodes['earnings-desk']={innerHTML:''};vm.runInContext(read('earnings-desk.js'),e.ctx);await e.ctx.EarningsDesk.mount();
  html=e.nodes['earnings-desk'].innerHTML;assert.ok(html.indexOf('id="earnings-NVDA"')<html.indexOf('id="earnings-AAPL"'));assert.match(html,/test-trr/);
  caps={AAPL:100,NVDA:1};for(const f of e.listeners['share-enrichment-updated']||[])f();html=e.nodes['earnings-desk'].innerHTML;assert.ok(html.indexOf('id="earnings-AAPL"')<html.indexOf('id="earnings-NVDA"'));
  for(const f of e.listeners.change)f({target:{matches:()=>true,value:'NVDA'}});assert.doesNotMatch(e.nodes['earnings-desk'].innerHTML,/id="earnings-AAPL"/);
  for(const f of e.listeners['share-enrichment-updated']||[])f();assert.doesNotMatch(e.nodes['earnings-desk'].innerHTML,/id="earnings-AAPL"/);
  console.log('PASS earnings TRR and asynchronous cap ordering preserve selected-company filter');

  const r={X:{historyTab:'yield',masterTab:'explore'}};vm.createContext(r);vm.runInContext(cut('v4-tools.js','function routeSuffix(','return{routeSuffix'),r);r.applyRoute('history','beta-shares');assert.equal(r.routeSuffix('history'),'/beta-shares');r.applyRoute('history','bogus');assert.equal(r.routeSuffix('history'),'/beta-shares');
  let mounted=0,cleaned=0,host={};const life={$:()=>host,window:{BetaShares:{mount:()=>{mounted++;return()=>cleaned++;}}}};life.BetaShares=life.window.BetaShares;vm.createContext(life);vm.runInContext(cut('v4-tools.js','let betaSharesHost=','function afterRender('),life);life.mountBetaShares();life.mountBetaShares();assert.equal(mounted,1);host=null;life.mountBetaShares();assert.equal(cleaned,1);
  console.log('PASS Beta shares routing and one mount/cleanup per host without history-data dependence');

  // Exercise actual historical fields and identifiers, not only the sorting stub.
  const actual=context({ShareEnrichment:undefined,CustomEvent:class{constructor(type){this.type=type;}}});
  actual.ctx.document.dispatchEvent=event=>{for(const fn of actual.listeners[event.type]||[])fn(event);};
  const reviewed=require('../site/bos-equity.js').reviewedListings;
  const bosValues={'AAPL US':5157.2,'NVDA US':4005.2,'MSFT US':3000,'BRK/B US':900,'TSLA US':800};
  // Source YTD Gains from the 13 November BOS PDF, prices as of 12 November.
  const bosYtd={'AAPL US':31,'NVDA US':-11,'MSFT US':9,'BRK/B US':17,'TSLA US':-12};
  actual.ctx.BOSEquity={reviewedListings:reviewed,version:()=> 'fixture',panel:()=>'',facts:()=>'',mount:()=>{},valuationById:id=>id in bosValues?{row:{instrumentId:id,instrumentType:'equity',currency:'USD',marketCapUsdBillions:bosValues[id],ytdGainPct:bosYtd[id],priceAsOf:'2026-11-12'},reportDate:'2026-11-13',current:true}:null};
  vm.runInContext(read('share-enrichment.js'),actual.ctx);await actual.ctx.ShareEnrichment.load();
  vm.runInContext(read('watchlist-report-links.js'),actual.ctx);vm.runInContext(read('watchlist.js'),actual.ctx);
  actual.ctx.MarketWatchlist.connect(()=>{});await tick();await tick();
  const realHtml=actual.ctx.MarketWatchlist.view();
  assert.equal((realHtml.match(/class="share-enrichment-details"/g)||[]).length,12);
  assert.equal((realHtml.match(/No matched historical return or credit data/g)||[]).length,1,'TSLA prior-year history remains explicitly unmatched');
  function detailFor(html,id){const card=html.indexOf('id="'+id+'"');assert(card>=0,'card exists: '+id);const start=html.indexOf('<details class="share-enrichment-details">',card);assert(start>=0,'return detail exists: '+id);return html.slice(start,html.indexOf('</details>',start)+10);}
  for(const [ticker,value]of [['AAPL','+31.00%'],['NVDA','-11.00%'],['TSLA','-12.00%']]){
    const detail=detailFor(realHtml,ticker);assert(detail.includes('2026 YTD · BOS: '+value+' as of 12 Nov 2026; PDF 13 Nov 2026'));
    assert(detail.includes('dividend and currency return methodology are not specified'));
  }
  assert.match(realHtml,/\+38\.92%/,'derived NVDA calendar return reaches the current card');
  assert.ok(realHtml.indexOf('id="AAPL"')<realHtml.indexOf('id="NVDA"'));
  assert.ok(realHtml.indexOf('id="NVDA"')<realHtml.indexOf('id="MSFT"'));
  let registryReady=false;
  const brk={id:'brk-b',ticker:'BRK-B',aliases:['BRK.B'],currency:'USD',asset_type:'equity'};
  actual.ctx.MarketPrices={card:()=>'',version:()=>registryReady?'ready':'unloaded',resolve:s=>registryReady&&[brk.ticker,...brk.aliases].includes(s)?brk:null};
  actual.nodes['earnings-desk']={innerHTML:''};vm.runInContext(read('earnings-desk.js'),actual.ctx);await actual.ctx.EarningsDesk.mount();
  assert.equal((actual.nodes['earnings-desk'].innerHTML.match(/No matched historical return or credit data/g)||[]).length,2,'unavailable registry must not guess BRK.B alias');
  registryReady=true;actual.ctx.document.dispatchEvent(new actual.ctx.CustomEvent('market-prices-updated'));
  assert.equal(actual.ctx.ShareEnrichment.marketCapFor({ticker:'BRK.B',currency:'USD'}).value,900000,'validated registry alias inherits the exact BOS listing cap');
  assert.equal((actual.nodes['earnings-desk'].innerHTML.match(/class="share-enrichment-details"/g)||[]).length,12);
  assert.equal((actual.nodes['earnings-desk'].innerHTML.match(/No matched historical return or credit data/g)||[]).length,1);
  assert.match(actual.nodes['earnings-desk'].innerHTML,/gross dividends reinvested/);
  for(const [ticker,value]of [['AAPL','+31.00%'],['NVDA','-11.00%'],['TSLA','-12.00%'],['BRK.B','+17.00%']])assert(detailFor(actual.nodes['earnings-desk'].innerHTML,'earnings-'+ticker).includes('2026 YTD · BOS: '+value));
  actual.nodes['watchlist-results']={innerHTML:''};bosYtd['AAPL US']=null;
  actual.ctx.document.dispatchEvent(new actual.ctx.CustomEvent('bos-equity-updated'));
  for(const [html,id]of [[actual.nodes['watchlist-results'].innerHTML,'AAPL'],[actual.nodes['earnings-desk'].innerHTML,'earnings-AAPL']]){
    const detail=detailFor(html,id);assert(detail.includes('2026 YTD · BOS is unavailable'));assert(detail.includes('No frozen snapshot value is substituted.'));assert(!detail.includes('2026 YTD · BOS: +31.00%'));
    assert.match(detail,/<td class="return-missing"[^>]*>Unavailable<\/td><\/tr>/,'2026 cell stays missing without BOS');
  }
  console.log('PASS actual current cards keep derived prior years, exact BOS YTD values/dates, BOS-only TSLA, alias guards and no frozen 2026 fallback');
})().catch(error=>{console.error(error);process.exitCode=1;});
