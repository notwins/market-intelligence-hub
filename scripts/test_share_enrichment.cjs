const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const snapshot=JSON.parse(fs.readFileSync('site/data/beta-shares.json','utf8'));
const source=fs.readFileSync('site/share-enrichment.js','utf8');
function fixture(fail=false){
 const listeners={},events=[];let calls=0;
 const mappings=[['NVDA','USD','NVDA US'],['AAPL','USD','AAPL US'],['TSM','USD','TSM US'],['D05.SI','SGD','DBS SP'],['VOD.L','GBp','VOD LN'],['TSLA','USD','TSLA US'],['BRK-B','USD','BRK/B US']].map(([ticker,currency,instrumentId])=>({ticker,currency,instrumentId,listingId:ticker.toLowerCase(),verified:true}));
 const values=new Map([
  ['NVDA US',{currency:'USD',marketCapUsdBillions:4005.2,ytdGainPct:27}],
  ['AAPL US',{currency:'USD',marketCapUsdBillions:5157.2,ytdGainPct:31}],
  ['TSM US',{currency:'USD',marketCapUsdBillions:2103.1}],
  ['DBS SP',{currency:'SGD',marketCapUsdBillions:156.9,ytdGainPct:32}],
  ['VOD LN',{currency:'GBp',marketCapUsdBillions:36.2}],
  ['TSLA US',{currency:'USD',marketCapUsdBillions:900,ytdGainPct:15}],
  ['BRK/B US',{currency:'USD',marketCapUsdBillions:1256}],
 ]);
 const now=Date.parse('2026-11-15T00:00:00Z');class FixedDate extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
 const feed={version:'bos-v1',reportDate:'2026-11-13'};
 const context={Date:FixedDate,console,CustomEvent:class{constructor(type){this.type=type;}},document:{addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),dispatchEvent:event=>{events.push(event.type);for(const fn of listeners[event.type]||[])fn(event);}},fetch:async path=>{calls++;assert.equal(path,'data/beta-shares.json');if(fail)throw Error('offline');return {ok:true,json:async()=>structuredClone(snapshot)};},BOSEquity:{reviewedListings:mappings,version:()=>feed.version,valuationById:id=>{const row=values.get(id);return row?{row:{instrumentId:id,instrumentType:'equity',priceAsOf:'2026-11-12',price:123,...row},reportDate:feed.reportDate,sourceUrl:'https://example.com/bos.pdf',current:feed.current??id!=='DBS SP'}:null;},selectCurrent:(row,fallback,options)=>({close:row.price,date:row.priceAsOf,current:options.available,sourceLabel:'Bank of Singapore',sourceId:'bos'})},MarketPrices:{currentQuote:item=>({close:222,date:'2026-11-13',current:true,sourceId:'bos',sourceLabel:'Bank of Singapore'})}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {api:context.ShareEnrichment,context,events,values,feed,calls:()=>calls};
}
(async()=>{
 const f=fixture(),api=f.api;
 await Promise.all([api.load(),api.load()]);assert.equal(f.calls(),1);
 assert.equal(api.records().length,790);assert(f.events.includes('share-enrichment-updated'));
 assert.equal(api.find('US67066G1040').bbTicker,'NVDA US');
 assert.equal(api.find('isin:US67066G1040').bbTicker,'NVDA US');
 assert.equal(api.find('NVDA US EQUITY').bbTicker,'NVDA US');
 assert.equal(api.find('NVDA').bbTicker,'NVDA US');
 assert.equal(api.find({name:'NVIDIA Corp'}),null,'name-only matches forbidden');
 assert.equal(api.find({ticker:'TSM',currency:'TWD'}),null,'ADR cannot match Taiwan currency');
 assert.equal(api.find({ticker:'TSM',isin:'TW0002330008'}),null,'Taiwan ISIN cannot borrow ADR returns');
 assert.equal(api.find({bbTicker:'TSM US',currency:'TWD'}),null,'explicit BB ticker does not override conflicting currency');
 assert.equal(api.find({isin:'US8740391003',ticker:'NVDA',currency:'USD'}),null,'conflicting ISIN and reviewed ticker fail closed');
 assert.equal(api.find({isin:'US8740391003',currency:'TWD'}),null,'exact ISIN does not override conflicting known currency');
 assert.equal(api.find({ticker:'NVDA',asset_type:'index'}),null);
 assert.equal(api.find('TSLA'),null,'ticker-only source stub does not become data');
 const nvda=api.find('NVDA');assert(Object.isFrozen(nvda)&&Object.isFrozen(nvda.returns.calendar));
 const years=api.returnsFor(nvda);assert.equal(years.length,8);assert.equal(years[6].year,2025);assert.equal(years[6].derived,true);assert(Math.abs(years[6].value-38.91569075927448)<1e-10);assert.equal(years[7].label,'2026 YTD · BOS');assert.equal(years[7].derived,false);assert.equal(years[7].value,27);
 assert.equal(nvda.returns.ytd['2026'],19.45891,'immutable source snapshot retains its original YTD');
 assert.equal(api.returnsFor(nvda,'annualized')[6].value,34.35603);assert.equal(api.returnsFor(nvda,'holding')[6].value,65.94717);
 const ytd=api.ytdFor(nvda);assert.equal(ytd.sourceId,'bos');assert.equal(ytd.periodType,'ytd_gain');assert.equal(ytd.asOf,'2026-11-12');assert.equal(ytd.reportDate,'2026-11-13');assert.equal(ytd.endDate,ytd.asOf);assert.equal(ytd.current,true);assert.equal(ytd.cutoffInferred,false);assert.equal(ytd.basis,'BOS YTD gain; dividend/currency return methodology not specified');
 assert.equal(api.ytdFor('AAPL').value,31);assert.equal(api.ytdFor('DBS SP').value,32);assert.equal(api.ytdFor('DBS SP').current,false);assert.equal(api.ytdFor('DBS SP').dated,true);
 assert.equal(api.ytdFor('NVDA',2025).value,null,'a different requested year cannot use 2026 YTD');
 assert.equal(api.ytdFor('NVDA','2026').value,null,'year is a number, not coerced input');
 for(const item of [{ticker:'TSM',currency:'TWD'},{ticker:'NVDA',isin:'US8740391003'},{ticker:'NVDA',asset_type:'index'},{name:'NVIDIA Corp'}])assert.equal(api.ytdFor(item).value,null,'identity and currency conflicts cannot borrow BOS YTD');
 const tslaPoints=api.returnsFor('TSLA');assert.equal(tslaPoints.length,8);assert(tslaPoints.slice(0,7).every(p=>p.value===null));assert.equal(tslaPoints[7].value,15);assert.equal(api.returnsFor('TSLA','holding').length,0);
 const beforeSnapshot=JSON.stringify(api.records()),beforeCompleted=JSON.stringify(years.slice(0,7)),beforeHolding=JSON.stringify(api.returnsFor(nvda,'holding')),beforeAnnualized=JSON.stringify(api.returnsFor(nvda,'annualized'));
 const nvdaRow=f.values.get('NVDA US'),originalRow={...nvdaRow},beforeFeedVersion=api.version(),beforeRefreshEvents=f.events.filter(x=>x==='share-enrichment-updated').length;
 nvdaRow.ytdGainPct=28;nvdaRow.priceAsOf='2026-11-13';f.feed.reportDate='2026-11-14';f.feed.version='bos-v2';f.context.document.dispatchEvent(new f.context.CustomEvent('bos-equity-updated'));
 assert.equal(api.returnsFor('NVDA')[7].value,28);assert.equal(api.ytdFor('NVDA').asOf,'2026-11-13');assert.notEqual(api.version(),beforeFeedVersion);assert.equal(f.events.filter(x=>x==='share-enrichment-updated').length,beforeRefreshEvents+1);
 assert.equal(JSON.stringify(api.returnsFor(nvda).slice(0,7)),beforeCompleted);assert.equal(JSON.stringify(api.returnsFor(nvda,'holding')),beforeHolding);assert.equal(JSON.stringify(api.returnsFor(nvda,'annualized')),beforeAnnualized);assert.equal(JSON.stringify(api.records()),beforeSnapshot);
 nvdaRow.ytdGainPct=0;assert.equal(api.ytdFor('NVDA').value,0);assert.equal(api.ytdFor('NVDA').available,true);assert(api.detailHtml('NVDA').includes('0.00%'));
 for(const value of [null,undefined,NaN,Infinity,'27']){nvdaRow.ytdGainPct=value;assert.equal(api.ytdFor('NVDA').value,null);assert.equal(api.returnsFor('NVDA')[7].value,null,'missing or invalid BOS never falls back to frozen 19Sep return');}
 nvdaRow.ytdGainPct=28;
 for(const [key,value] of [['instrumentId','TSM US'],['instrumentType','index'],['currency','SGD'],['priceAsOf','2026-02-30'],['priceAsOf','2026-11-15'],['priceAsOf','2025-12-31']]){const old=nvdaRow[key];nvdaRow[key]=value;assert.equal(api.ytdFor('NVDA').value,null,key+' validation');if(old===undefined)delete nvdaRow[key];else nvdaRow[key]=old;}
 f.feed.reportDate='2026-11-16';nvdaRow.priceAsOf='2026-11-16';assert.equal(api.ytdFor('NVDA').value,null,'future report and observation rejected');
 f.feed.reportDate='2025-11-13';nvdaRow.priceAsOf='2025-11-12';assert.equal(api.ytdFor('NVDA').value,null,'a prior-year edition cannot fill 2026');
 f.feed.reportDate='2026-10-13';nvdaRow.priceAsOf='2026-10-12';f.feed.current=false;assert.equal(api.ytdFor('NVDA').value,28);assert.equal(api.ytdFor('NVDA').current,false);assert(api.detailHtml('NVDA').includes('dated reference'));
 f.values.set('NVDA US',originalRow);f.feed.reportDate='2026-11-13';delete f.feed.current;
 assert.equal(api.marketCapFor(nvda).value,4005200,'BOS billions explicitly converted to millions');
 assert.equal(api.marketCapFor('DBS SP').value,156900);assert.equal(api.marketCapFor('DBS SP').dated,true);
 assert.equal(api.marketCapFor('MSFT US'),null,'unknown CSV market-cap currency is never used');
 assert.equal(api.marketCapFor({ticker:'TSM',currency:'TWD'}),null);
 assert.equal(api.marketCapFor({ticker:'TSM',isin:'TW0002330008',currency:'USD'}),null,'reviewed ticker cannot defeat conflicting ISIN');
 assert.equal(api.marketCapFor('TSLA').value,900000,'BOS-only mapped facts need no historical CSV metrics');
 assert.equal(api.priceItemFor('VOD LN').currency,'GBp','pence unit casing preserved');
 assert.equal(api.quoteFor('NVDA').currency,'USD');assert.equal(api.quoteFor('MSFT US').close,null,'historical price never passed off as current');
 const registered={id:'nvda',ticker:'NVDA',currency:'USD',asset_type:'equity',provider:'Yahoo Finance',history_url:'https://finance.yahoo.com/quote/NVDA/history/'};
 assert.equal(api.find('BRK.B'),null,'unregistered punctuation variants are never guessed');
 const berkshire={id:'brk-b',ticker:'BRK-B',aliases:['BRK.B'],currency:'USD',asset_type:'equity',provider:'Yahoo Finance'};
 f.context.MarketPrices.resolve=t=>t==='NVDA'?registered:['BRK-B','BRK.B'].includes(t)?berkshire:null;
 assert.equal(api.find('BRK.B').bbTicker,'BRK/B US','real registry alias joins the reviewed BOS listing');
 assert.equal(api.marketCapFor('BRK.B').value,1256000);
 assert(api.detailHtml('BRK.B').includes('Historical total returns'));
 assert.equal(api.priceItemFor('BRK.B'),berkshire);
 assert.equal(api.find('BRK.A'),null,'other share class is not guessed');
 assert.equal(api.find({ticker:'BRK.B',currency:'SGD'}),null,'alias preserves reviewed currency');
 berkshire.id='unreviewed-id';assert.equal(api.find('BRK.B'),null,'alias must match reviewed listing id');berkshire.id='brk-b';
 let registryVersion='register-before';f.context.MarketPrices.version=()=>registryVersion;const oldVersion=api.version();registryVersion='register-after';assert.notEqual(api.version(),oldVersion,'asynchronous registry changes invalidate consumer rendering');
 const eventCount=f.events.filter(x=>x==='share-enrichment-updated').length;f.context.document.dispatchEvent(new f.context.CustomEvent('market-prices-updated'));assert.equal(f.events.filter(x=>x==='share-enrichment-updated').length,eventCount+1);
 assert.equal(api.priceItemFor('NVDA'),registered,'keep real quote provider and registry metadata');
 assert.deepEqual(Array.from(api.sortShares(['MSFT US','DBS SP','NVDA','AAPL'])),['AAPL','NVDA','DBS SP','MSFT US']);
 const html=api.detailHtml('NVDA');assert(html.includes('gross dividends reinvested'));assert(html.includes('inferred'));assert(html.includes('Senior unsecured debt'));assert(!html.includes('2026 verified'));
 assert(api.detailHtml('TSLA').includes('No matched historical return or credit data'),'missing historical record is explicit after load');
 const invalid=structuredClone(snapshot);invalid.records[0].returns.calendar['2025']=65.94717;assert.throws(()=>api.validate(invalid),/reconcile/);
 const duplicate=structuredClone(snapshot);duplicate.records.push(duplicate.records[0]);assert.throws(()=>api.validate(duplicate),/duplicate/);
 f.values.get('NVDA US').marketCapUsdBillions=null;assert.equal(api.marketCapFor('NVDA'),null);
 f.values.get('NVDA US').marketCapUsdBillions=0;assert.equal(api.marketCapFor('NVDA').value,0,'reported rounded zero is present, not missing');
 const no=fixture(true);await no.api.load();assert.equal(no.api.status().loaded,false);assert.equal(no.api.status().error,'offline');await no.api.load();assert.equal(no.calls(),2,'failed load settles and can retry');
 console.log('Historical shares identity, returns, scoped ratings, BOS-only cap sorting, units and failure handling passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
