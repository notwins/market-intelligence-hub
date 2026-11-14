const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const api=require('../site/bos-equity.js');
const row={instrumentId:'AAPL US',instrumentType:'equity',name:'Apple Inc.',ticker:'AAPL US',region:'North America',marketGroup:'North America',sector:'Technology',currency:'USD',price:250,priceAsOf:'2026-11-12',marketCapUsdBillions:3700,rating:'Hold',moat:'Wide',fairValueOrTargetPrice:220,upsidePct:-12,dividendYieldPct:.4,pe:30,pb:40,epsGrowthPct:8,roePct:100,riskRating:3,ytdGainPct:5,analystReportMonth:'2026-10',analystOrUncertainty:'Medium',researchProvider:'Morningstar',researchReportUrl:'https://productgroup.bankofsingapore.com/report.pdf',sourcePage:3,sourceRow:1,raw:{name:'Apple Inc.',price:'250.00',pe:'30.0',pb:'40.0',ytdGainPct:'5.0'}};
const data={schemaVersion:1,sourceId:'bos-equity-coverage',reportDate:'2026-11-13',priceAsOf:'2026-11-12',sourceUrl:'https://productgroup.bankofsingapore.com/equities_research/2026-11-13_equity_coverage_universe.pdf',sourceSha256:'a'.repeat(64),metricBasis:'Consensus forward estimates; period not specified',columns:[{key:'price',sourceLabel:'Price (12-Nov-2026)'}],records:[row]};
const bytes=Buffer.from(JSON.stringify(data)),sha=crypto.createHash('sha256').update(bytes).digest('hex');
const ref={path:'snapshots/2026/2026-11-13-test.json',sha256:sha,bytes:bytes.length};
const manifest={schemaVersion:1,sourceId:'bos-equity-coverage',latest:ref,editions:[{...ref,reportDate:data.reportDate,priceAsOf:data.priceAsOf}],publicDisplayApproved:true,verifiedMappings:[{ticker:'AAPL',currency:'USD',instrumentId:'AAPL US',verified:true}]};
assert.equal(api.validateEdition(data),data);
assert.equal(api.validateManifest(manifest),manifest);
assert.throws(()=>api.validateEdition({...data,records:[row,row]}),/duplicate/);
assert.throws(()=>api.validateEdition({...data,priceAsOf:'2026-11-14'}),/snapshot/);
assert.throws(()=>api.validateEdition({...data,records:[{...row,price:Infinity}]}),/numeric/);
assert.throws(()=>api.validateEdition({...data,records:[{...row,raw:{price:250}}]}),/raw/);
assert.throws(()=>api.validateManifest({...manifest,latest:{...ref,path:'../secret.json'}}),/manifest/);
assert.throws(()=>api.validateManifest({...manifest,editions:[...manifest.editions,{...ref,path:'snapshots/new.json',reportDate:'2026-11-14',priceAsOf:'2026-11-13'}]}),/older/);
assert.equal(api.matchingRecord(data,manifest,'AAPL','USD'),row);
assert.equal(api.matchingRecord(data,manifest,'AAPL','SGD'),null);
assert.equal(api.matchingRecord(data,{...manifest,verifiedMappings:[]},'AAPL','USD'),null);
assert.equal(api.matchingRecord(data,{...manifest,verifiedMappings:[...manifest.verifiedMappings,...manifest.verifiedMappings]},'AAPL','USD'),null);
assert.equal(api.valuationLabel(row),'Morningstar fair value');
assert.equal(api.valuationLabel({...row,researchProvider:'OCBC'}),'OCBC target price');
assert.equal(api.safeUrl('javascript:alert(1)'),'');
assert.equal(api.safeUrl('https://user:pass@example.com'),'');
assert.equal(api.filtered(data,{query:'apple',group:'sector'}).length,1);
assert.equal(api.filtered(data,{query:'zzzz',group:'sector'}).length,0);
assert.equal(api.filtered(data,{query:'',currency:'HKD',group:'sector'}).length,0);
assert(api.csv({...data,records:[{...row,raw:{price:'=HYPERLINK("bad")'}}]}).includes("'=HYPERLINK"));
assert(api.panel('master').includes('data-bos-panel="master"'));
const now=Date.parse('2026-11-15T03:00:00Z'),policy={now,reportDate:'2026-11-13',sourceUrl:data.sourceUrl},fallback={close:255,date:'2026-11-12',sourceLabel:'Yahoo Finance',sourceUrl:'https://finance.yahoo.com/quote/AAPL/history/'};
assert.equal(api.selectCurrent(row,fallback,policy).sourceId,'bos','BOS wins identical observation dates');
assert.equal(api.selectCurrent(row,{...fallback,date:'2026-11-13'},policy).sourceId,'yahoo','newer Yahoo close wins');
assert.equal(api.selectCurrent({...row,priceAsOf:'2026-11-14'},fallback,{...policy,reportDate:'2026-11-14'}).sourceId,'bos');
for(const price of [null,undefined,0,-1,Infinity,NaN])assert.equal(api.selectCurrent({...row,price},fallback,policy).sourceId,'yahoo');
for(const priceAsOf of ['2026-11-16','2026-02-30','bad','2026-11-07'])assert.equal(api.selectCurrent({...row,priceAsOf},fallback,{...policy,reportDate:'2026-11-16'}).sourceId,'yahoo');
assert.equal(api.selectCurrent(row,fallback,{...policy,available:false}).sourceId,'yahoo','feed failure selects valid fallback');
assert.equal(api.selectCurrent(row,null,policy).sourceId,'bos','BOS-only listing stays available');
assert.equal(api.selectCurrent(row,{...fallback,date:'2026-11-16'},policy).sourceId,'bos','future fallback cannot win');
assert.equal(api.selectCurrent(null,{...fallback,date:'2026-11-01'},policy).current,false,'retained old quote is not current');
assert.equal(api.selectCurrent(null,null,policy).close,null);
assert.equal(api.fresh('2026-11-08',now),true);assert.equal(api.fresh('2026-11-07',now),false);
assert.equal(api.reviewedListings.length,136);assert.equal(api.reviewedListings.find(m=>m.ticker==='D05.SI').instrumentId,'DBS SP');
assert.equal(api.reviewedListings.find(m=>m.ticker==='GOOG').instrumentId,'GOOG US');
assert.equal(api.reviewedListings.find(m=>m.ticker==='GOOGL').instrumentId,'GOOGL US');
assert(!api.reviewedListings.some(m=>['005930.KS','000660.KS','TCEHY','RO.SW','^GSPC'].includes(m.ticker)),'no proxy listings or index substitution');
const source=fs.readFileSync('site/bos-equity.js','utf8');
function browser(options={}){
 const panel={dataset:{bosPanel:'history'},innerHTML:'',isConnected:true},fact={dataset:{bosTicker:'AAPL',bosCurrency:'USD'},innerHTML:''};
 let fail=false,clock=now;const requests=[],events=[],listeners={},intervals=[];
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const buffer=v=>v instanceof ArrayBuffer?v:v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength);
 const context={URL,Date:ClockDate,Number,JSON,TextDecoder,Uint8Array,Intl,Set,Map,Promise,console,setTimeout,setInterval:fn=>intervals.push(fn),addEventListener:(name,fn)=>listeners[name]=fn,CustomEvent:class{constructor(type){this.type=type;}},crypto:crypto.webcrypto,location:{hostname:options.hostname||'notwins.github.io'},localStorage:{getItem:()=>null,setItem:()=>{throw Error('unexpected save');}},document:{hidden:false,addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:e=>events.push(e.type),querySelectorAll:selector=>selector==='[data-bos-panel]'?[panel]:selector==='[data-bos-ticker]'?[fact]:[]},fetch:async url=>{requests.push(url);if(fail)throw Error('offline');if(url.endsWith('manifest.json'))return{ok:true,json:async()=>typeof options.manifest==='function'?options.manifest():options.manifest||manifest};const path=url.split('/bos/')[1],value=options.files?options.files.get(path):options.bytes||bytes;if(!value)return{ok:false};return{ok:true,arrayBuffer:async()=>buffer(value)};}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);return{api:context.BOSEquity,panel,fact,context,events,listeners,intervals,urls:requests,advance:ms=>clock+=ms,fail:()=>fail=true,requests:()=>requests.length};
}
(async()=>{
 const b=browser();await b.api.refresh(true);assert(b.panel.innerHTML.includes('Prices: 12 Nov 2026'));assert(b.panel.innerHTML.includes('PDF: 13 Nov 2026'));assert(b.panel.innerHTML.includes('Price (12-Nov-2026)'));assert(b.panel.innerHTML.includes('Morningstar fair value'));assert(b.panel.innerHTML.includes('Published data (JSON)'));assert(b.panel.innerHTML.includes('MSCI ESG fields'));assert(b.fact.innerHTML.includes('250'));assert(!b.panel.innerHTML.includes('real-time'));assert(!b.panel.innerHTML.includes('Complete raw JSON'));
 b.fail();await b.api.refresh(true);assert(b.panel.innerHTML.includes('previously loaded edition'));assert(b.panel.innerHTML.includes('Prices: 12 Nov 2026'));assert(b.fact.innerHTML.includes('Feed refresh unavailable'));
 const denied=browser({manifest:{...manifest,publicDisplayApproved:false}});await denied.api.refresh(true);assert(denied.panel.innerHTML.includes('awaiting publication approval'));assert.equal(denied.requests(),1);assert.equal(denied.fact.innerHTML,'');
 const local=browser({hostname:'127.0.0.1',manifest:{...manifest,publicDisplayApproved:false}});await local.api.refresh(true);assert(local.panel.innerHTML.includes('Prices: 12 Nov 2026'));
 const restrictedData={...data,records:[{...row,esgRating:'BBB',raw:{...row.raw,esgRating:'BBB'}}]},restrictedBytes=Buffer.from(JSON.stringify(restrictedData)),restrictedHash=crypto.createHash('sha256').update(restrictedBytes).digest('hex'),restrictedRef={...ref,sha256:restrictedHash,bytes:restrictedBytes.length};const restricted=browser({manifest:{...manifest,latest:restrictedRef,editions:[{...manifest.editions[0],sha256:restrictedHash,bytes:restrictedBytes.length}]},bytes:restrictedBytes.buffer.slice(restrictedBytes.byteOffset,restrictedBytes.byteOffset+restrictedBytes.byteLength)});await restricted.api.refresh(true);assert(restricted.panel.innerHTML.includes('excluded ESG fields'));assert.equal(restricted.fact.innerHTML,'');
 const broken=browser({bytes:new TextEncoder().encode('corrupt').buffer});await broken.api.refresh(true);assert(broken.panel.innerHTML.includes('integrity check failed'));assert.equal(broken.fact.innerHTML,'');
 for(const file of ['watchlist.js','v4-tools.js'])assert(fs.readFileSync('site/'+file,'utf8').includes('BOSEquity'),file+' includes BOS overlay');
 const html=fs.readFileSync('site/v4.html','utf8');assert(html.includes('bos-equity.js'));assert(html.includes('bos-equity.css'));assert(html.includes('window.BOSEquity?.mount()'));
 assert(!/MarketPrices\s*=|\.records\s*=|\.raw\[.*\]\s*=/.test(source),'overlay does not overwrite price service or master records');
 console.log('PASS BOS dates, forward labels, explicit mapping, source integrity, public gate, stale retention, raw download and route integration');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Failure recovery and compact history exercise the network boundary, not a
// second copy of the implementation's selection algorithm.
(async()=>{
 function packed(value,path){const body=Buffer.from(JSON.stringify(value));return {body,ref:{path,sha256:crypto.createHash('sha256').update(body).digest('hex'),bytes:body.length,reportDate:value.reportDate,priceAsOf:value.priceAsOf}};}
 function edition(reportDate,priceAsOf,price,suffix=''){return packed({...data,reportDate,priceAsOf,records:[{...row,price,priceAsOf,raw:{...row.raw,price:String(price)}}]},'editions/'+reportDate+suffix+'.json');}
 const latest=edition('2026-11-14','2026-11-13',260),prior=edition('2026-11-13','2026-11-12',250),older=edition('2026-11-12','2026-11-11',240);
 const feed=refs=>({...manifest,latest:refs[0],editions:refs});
 const files=new Map([[latest.ref.path,Buffer.from('corrupt')],[prior.ref.path,prior.body],[older.ref.path,older.body]]);
 const cold=browser({manifest:feed([latest.ref,prior.ref,older.ref]),files});await cold.api.refresh(true);
 assert(cold.panel.innerHTML.includes('Showing validated fallback PDF 2026-11-13'));
 assert(cold.panel.innerHTML.includes('Prices: 12 Nov 2026'),'fallback retains its observation date');
 assert(cold.panel.innerHTML.includes('Last 5 successful coverage editions'));
 assert.equal(cold.api.valuationById('AAPL US').row.price,250);
 assert.equal(cold.api.valuationById('AAPL US').current,false,'failed latest is an explicitly dated valuation reference');
 const events=cold.events.length;await cold.api.refresh(true);assert.equal(cold.events.length,events,'unchanged failure/data/index does not dispatch a repaint event');
 const denied=browser({manifest:{...feed([latest.ref,prior.ref]),publicDisplayApproved:false},files});await denied.api.refresh(true);assert.equal(denied.requests(),1,'public gate precedes every fallback read');
 const restricted=packed({...data,reportDate:'2026-11-14',priceAsOf:'2026-11-13',records:[{...row,priceAsOf:'2026-11-13',raw:{...row.raw,esgRating:'BBB'}}]},'editions/restricted.json');
 const excluded=browser({manifest:feed([restricted.ref,prior.ref]),files:new Map([[restricted.ref.path,restricted.body],[prior.ref.path,prior.body]])});await excluded.api.refresh(true);assert(excluded.panel.innerHTML.includes('excluded ESG fields'));assert.equal(excluded.api.valuationById('AAPL US').row.price,250);
 const mismatched={...prior.ref,path:'editions/mismatched.json',reportDate:'2026-11-14',priceAsOf:'2026-11-13'};
 const dates=browser({manifest:feed([mismatched,prior.ref]),files:new Map([[mismatched.path,prior.body],[prior.ref.path,prior.body]])});await dates.api.refresh(true);assert(dates.panel.innerHTML.includes('dates do not match'));assert.equal(dates.api.valuationById('AAPL US').row.priceAsOf,'2026-11-12');
 let active=feed([latest.ref,prior.ref]);const warm=browser({manifest:()=>active,files:new Map([[latest.ref.path,latest.body],[prior.ref.path,prior.body],[older.ref.path,older.body]])});await warm.api.refresh(true);
 active=feed([prior.ref,older.ref]);await warm.api.refresh(true);assert.equal(warm.api.valuationById('AAPL US').row.price,260,'older server reference cannot replace a newer last-good session');
 assert(warm.panel.innerHTML.includes('retaining the previously loaded edition dated 2026-11-14'));
 const backfill=edition('2026-11-15','2026-11-10',230,'-backfill');assert.doesNotThrow(()=>api.validateManifest(feed([latest.ref,backfill.ref])),'price date outranks a later report backfill date');
 const six=Array.from({length:6},(_,i)=>edition('2026-11-'+String(14-i).padStart(2,'0'),'2026-11-'+String(13-i).padStart(2,'0'),200+i));
 const bounded=browser({manifest:feed(six.map(x=>x.ref)),files:new Map([[six[5].ref.path,six[5].body]])});await bounded.api.refresh(true);assert.equal(bounded.urls.filter(u=>!u.endsWith('manifest.json')).length,5,'a cold failure attempts at most five full snapshots');assert.equal(bounded.api.valuationById('AAPL US'),null);
 const ordered=six.slice().reverse();let current=feed([ordered[0].ref]);const cacheClient=browser({manifest:()=>current,files:new Map(ordered.map(x=>[x.ref.path,x.body]))});for(const value of ordered){current=feed([value.ref]);await cacheClient.api.refresh(true);}current=feed([ordered[0].ref]);await cacheClient.api.refresh(true);assert.equal(cacheClient.urls.filter(u=>u.endsWith(ordered[0].ref.path)).length,2,'sixth full snapshot evicts the oldest memory entry');
 const auto=browser();await auto.api.refresh(true);const before=auto.requests();auto.advance(300001);auto.context.document.hidden=true;auto.intervals[0]();assert.equal(auto.requests(),before,'hidden pages do not poll');auto.context.document.hidden=false;auto.listeners.visibilitychange();await auto.api.refresh();assert.equal(auto.requests(),before+1,'visibility resumes lightweight manifest checking');const unchanged=auto.events.length;auto.advance(300001);auto.listeners.focus();await auto.api.refresh();assert.equal(auto.events.length,unchanged,'same successful edition stays quiet on focus refresh');

 const timed=browser(),timers=[];timed.context.AbortController=AbortController;timed.context.setTimeout=fn=>{timers.push(fn);return timers.length;};timed.context.clearTimeout=()=>{};timed.context.fetch=async(url,options)=>url.endsWith('manifest.json')?{ok:true,json:async()=>manifest}:{ok:true,arrayBuffer:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('body stalled'))))};const pendingTimeout=timed.api.refresh(true);await new Promise(resolve=>setImmediate(resolve));timers.at(-1)();await pendingTimeout;assert(timed.panel.innerHTML.includes('BOS request timed out'),'request timeout covers response body, not only headers');

 const src=(reportDate,priceAsOf,n)=>({reportDate,priceAsOf,sourceSha256:String(n).repeat(64),sourceUrl:'https://example.com/'+reportDate+'.pdf'});
 const month={schemaVersion:1,sourceId:'bos-equity-prices',month:'2026-11',priceKind:'published_reference_price',sources:[src('2026-11-12','2026-11-11',1),src('2026-11-13','2026-11-12',2),src('2026-11-14','2026-11-11',3),src('2026-11-14','2026-11-11',4)],series:{'AAPL US':{currency:'USD',instrumentType:'equity',ticker:'AAPL US',points:[['2026-11-11',249,0,'249.00',3,1],['2026-11-12',250,1,'250.00',3,1],['2026-11-11',251,2,'251.00',3,1],['2026-11-11',252,3,'252.00',3,1]]}}};
 const october={...month,month:'2026-10',sources:[src('2026-11-01','2026-10-31',5)],series:{'AAPL US':{...month.series['AAPL US'],points:[['2026-10-31',245,0,'245.00',3,1]]}}};
 const nov=packed(month,'prices/2026-11-test.json'),oct=packed(october,'prices/2026-10-test.json'),historyFeed={...feed([prior.ref]),priceHistory:{schemaVersion:1,sourceId:'bos-equity-prices',months:{'2026-10':oct.ref,'2026-11':nov.ref}}};
 const history=browser({manifest:historyFeed,files:new Map([[prior.ref.path,prior.body],[nov.ref.path,nov.body],[oct.ref.path,oct.body]])});await history.api.refresh(true);
 assert(history.panel.innerHTML.includes('data-bos-history-id="AAPL US"'));
 assert(history.fact.innerHTML.includes('BOS published-price history'));
 assert.equal(history.urls.filter(u=>u.includes('/prices/')).length,0,'full coverage rendering never loads price history');
 const inputBefore=JSON.stringify(month),result=await history.api.priceHistoryFor({instrumentId:'AAPL US',currency:'USD',asset_type:'equity'},'2026-11-01');
 assert.deepEqual(JSON.parse(JSON.stringify(result.points)),[['2026-11-11',252],['2026-11-12',250]],'revision report date then source index resolves only BOS duplicate dates');
 assert.equal(result.observations[0].rawPrice,'252.00');assert.equal(result.observations[0].sourceSha256,'4'.repeat(64));assert.equal(JSON.stringify(month),inputBefore,'source observations remain untouched');assert(!history.urls.some(u=>u.endsWith(oct.ref.path)),'from date limits downloaded months');
 assert.equal((await history.api.priceHistoryFor({instrumentId:'AAPL US',currency:'SGD',asset_type:'equity'})).points.length,0);
 assert.equal((await history.api.priceHistoryFor({instrumentId:'AAPL US',currency:'USD',asset_type:'index'})).points.length,0);
 assert.equal((await history.api.priceHistoryFor({ticker:'AAPL',id:'aapl',currency:'USD',asset_type:'equity'},'2026-11-01')).points.length,2,'reviewed listing mapping works');
 assert.equal((await history.api.priceHistoryFor({instrumentId:'AAPL US',currency:'USD',asset_type:'equity'},'2026-11-12')).points.length,1);
 assert.throws(()=>api.validatePriceChunk({...month,pe:30},'2026-11'),/Unexpected/,'valuation data is rejected in price-only archive');
 assert.throws(()=>api.validatePriceChunk({...month,series:{'AAPL US':{...month.series['AAPL US'],points:[['2026-10-31',250,0,'250',3,1]]}}},'2026-11'),/observation/);
 assert.throws(()=>api.validatePriceChunk({...month,sources:[src('2099-01-01','2026-11-11',1)]},'2026-11'),/source/);
 const mismatch=packed({...month,series:{'AAPL US':{...month.series['AAPL US'],currency:'HKD'}}},'prices/mismatch.json');const badHistory=browser({manifest:{...historyFeed,priceHistory:{...historyFeed.priceHistory,months:{'2026-11':mismatch.ref}}},files:new Map([[prior.ref.path,prior.body],[mismatch.ref.path,mismatch.body]])});await badHistory.api.refresh(true);await assert.rejects(()=>badHistory.api.priceHistoryFor({instrumentId:'AAPL US',currency:'USD'},'2026-11-01'),/currency/);
 const target={innerHTML:''},disclosure={open:false,isConnected:true,dataset:{bosHistoryId:'AAPL US',bosHistoryCurrency:'USD'},matches:()=>true,querySelector:()=>target};history.listeners.toggle({target:disclosure});assert.equal(target.innerHTML,'','closed disclosures do not load');disclosure.open=true;history.listeners.toggle({target:disclosure});await history.api.priceHistoryFor({instrumentId:'AAPL US',currency:'USD'});await new Promise(resolve=>setImmediate(resolve));assert(target.innerHTML.includes('price-only, excludes dividend reinvestment'));assert(target.innerHTML.includes('2026-11-11'));assert(target.innerHTML.includes('252'));
 console.log('PASS bounded five-edition recovery/cache, exact guards, quiet visible polling, observation-date ordering and lazy independent BOS monthly price history.');
})().catch(e=>{console.error(e);process.exitCode=1;});
