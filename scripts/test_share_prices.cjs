const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../site/share-prices.js');
assert(api.validatePoints([['2026-11-05',100],['2026-11-06',95]]));
assert(!api.validatePoints([['2026-11-05',100],['2026-11-05',100]]));
assert(!api.validatePoints([['2026-11-05',null]]));
assert(!api.validatePoints([['2026-11-05',Infinity]]));
const movement=api.movement([['2026-11-05',100]],'2026-11-05',95,105);
assert.equal(movement.level,95);assert.equal(movement.change,-5);assert.equal(movement.koDistance,-10);
assert.equal(api.movement([['2026-11-04',100]],'2026-11-05',95,105),null,'do not snap missing reference dates');
assert.equal(api.movement([], '2026-11-05',100,100,125).change,-20,'verified fixing replaces reference close');
const base={daily:[['2026-11-05',100]],weekly:[['2026-11-01',98]],monthly:[['2026-10-31',97]]};
const daily=api.mergeDaily(base,[{series:{test:[['2026-11-06',95]]}}],'test');
assert.deepEqual(daily,[['2026-11-05',100],['2026-11-06',95]]);
assert.deepEqual(api.selectPoints(base,daily,'2026-10-01','2026-11-06'),[['2026-10-31',97],['2026-11-01',98],['2026-11-05',100],['2026-11-06',95]]);
assert(api.card('<bad>').includes('&lt;bad&gt;'));
assert.equal(api.sourceUrl('javascript:alert(1)'), '');
assert.equal(api.sourceUrl('https://user:password@example.com'), '');
assert.equal(api.sourceUrl('https://finance.yahoo.com/quote/NVDA/history/'), 'https://finance.yahoo.com/quote/NVDA/history/');
assert(api.priceBasis({ticker:'^SP500TR'}).includes('total-return index'));
for(const file of ['v4.html','earnings-desk.js','watchlist.js','si-pricing.js','v4-tools.js'])assert(fs.readFileSync('site/'+file,'utf8').includes('MarketPrices'),file+' shares common service');
const workflow=fs.readFileSync('.github/workflows/share-prices.yml','utf8');
assert(workflow.includes('HEAD:market-prices'));assert(!/deploy-pages|upload-pages-artifact|build_pages_artifact/.test(workflow));
console.log('Shared price mathematics, missing-baseline handling and integration contract passed.');

// Exercise both real readers together: refresh ordering, source selection and
// an unavailable history endpoint must never change the source arrays.
const vm=require('node:vm'),crypto=require('node:crypto');
function preferenceFixture(){
 const now=Date.parse('2026-11-15T03:00:00Z');
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const files={},listeners={};let bosFail=false,yahooFail=false,bosDate='2026-11-12',bosPrice=250,historyFail=false;
 function file(path,value){const bytes=Buffer.from(JSON.stringify(value)),sha256=crypto.createHash('sha256').update(bytes).digest('hex');files[path]=bytes;return {path,sha256};}
 const history={schema_version:1,id:'aapl',basis:'source_close_not_total_return',daily:[['2026-11-11',200],['2026-11-12',240]],weekly:[],monthly:[],period_note:'Actual daily sessions.'};
 const item={id:'aapl',ticker:'AAPL',aliases:[],currency:'USD',unit:'USD per share',asset_type:'equity',provider:'Yahoo Finance',history_url:'https://finance.yahoo.com/quote/AAPL/history/',basis:history.basis,history:file('history/aapl.json',history)};
 const priceManifest={schema_version:1,mode:'daily_close',public_display_approved:true,public_display_basis:'existing approved source',count:1,generated_at:'2026-11-15T00:00:00Z',months:{},register:file('register.json',{instruments:[item]}),latest:file('latest.json',{quotes:{aapl:{close:240,date:'2026-11-12',status:'provider_checked'}}})};
 function bosManifest(){const row={instrumentId:'AAPL US',instrumentType:'equity',name:'Apple',ticker:'AAPL US',currency:'USD',price:bosPrice,priceAsOf:bosDate,pe:30,pb:null,marketCapUsdBillions:3700,dividendYieldPct:0,fairValueOrTargetPrice:220,researchProvider:'Morningstar',sourcePage:3,sourceRow:1,raw:{price:String(bosPrice)}};
  const data={schemaVersion:1,sourceId:'bos-equity-coverage',reportDate:bosDate,priceAsOf:bosDate,sourceUrl:'https://productgroup.bankofsingapore.com/coverage.pdf',sourceSha256:'a'.repeat(64),metricBasis:'Consensus forward estimates; period not specified',records:[row]};
  const latest=file('bos/edition-'+bosDate+'.json',data);return {schemaVersion:1,sourceId:data.sourceId,publicDisplayApproved:true,verifiedMappings:[{ticker:'AAPL',currency:'USD',instrumentId:'AAPL US',verified:true}],latest:{...latest,path:latest.path.replace('bos/','')},editions:[{...latest,path:latest.path.replace('bos/',''),reportDate:bosDate,priceAsOf:bosDate}]};}
 const context={Date:FixedDate,URL,TextDecoder,Uint8Array,console,setTimeout,crypto:crypto.webcrypto,CustomEvent:class{constructor(type){this.type=type;}},setInterval:()=>{},location:{hostname:'notwins.github.io'},localStorage:{getItem:()=>null},document:{readyState:'loading',hidden:false,querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null,addEventListener:(key,fn)=>(listeners[key]??=[]).push(fn),dispatchEvent:event=>(listeners[event.type]||[]).forEach(fn=>fn(event))},fetch:async url=>{
  const path=url.split('/market-prices/')[1];if(path.startsWith('bos/')&&bosFail)throw Error('BOS offline');if(!path.startsWith('bos/')&&yahooFail)throw Error('Yahoo offline');if(path==='manifest.json')return {ok:true,json:async()=>priceManifest};if(path==='bos/manifest.json')return {ok:true,json:async()=>bosManifest()};if(path.startsWith('history/')&&historyFail)throw Error('history offline');const bytes=files[path];if(!bytes)throw Error('Unexpected fixture path '+path);return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
 }};context.window=context;vm.createContext(context);for(const name of ['bos-equity.js','share-prices.js'])vm.runInContext(fs.readFileSync('site/'+name,'utf8'),context);
 return {context,item,history,failBos:()=>bosFail=true,failYahoo:()=>yahooFail=true,failHistory:()=>historyFail=true,advanceBos:()=>{bosDate='2026-11-13';bosPrice=260;},recoverBos:()=>bosFail=false};
}
(async()=>{
 const f=preferenceFixture(),price=f.context.MarketPrices,bos=f.context.BOSEquity;
 await price.refresh(true);await bos.refresh();
 assert.equal(price.currentQuote('AAPL').sourceId,'bos');assert.equal(price.currentQuote('AAPL').close,250);
 assert.equal(price.rawQuote('AAPL').close,240);
 const serialized=JSON.stringify(await price.series('AAPL'));
 assert(price.currentDetails('AAPL').includes('BOS primary valuations'));assert(price.currentDetails('AAPL').includes('Morningstar fair value'));
 assert(price.currentDetails('AAPL').includes('Unavailable'),'missing P/B stays unavailable');assert(price.currentDetails('AAPL').includes('0%'),'reported zero retained');
 const comparison=await price.comparisonRows(['AAPL']);assert.equal(comparison.AAPL.value,240);assert.equal(comparison.AAPL.preferredQuote.close,250);
 assert.equal(bos.recordFor({...f.item,currency:'SGD'}),null);assert.equal(bos.recordFor({...f.item,asset_type:'index'}),null);
 f.advanceBos();await bos.refresh(true);assert.equal(price.currentQuote('AAPL').close,260);assert.equal(JSON.stringify(await price.series('AAPL')),serialized,'BOS refresh preserves every historical field');
 f.failBos();await bos.refresh(true);assert.equal(price.currentQuote('AAPL').sourceId,'yahoo');assert.equal(price.currentQuote('AAPL').close,240);assert(price.currentDetails('AAPL').includes('dated valuation reference'));
 f.recoverBos();await bos.refresh(true);f.failYahoo();await price.refresh(true);assert.equal(price.currentQuote('AAPL').sourceId,'bos','retained Yahoo failure cannot block BOS');
 assert.equal(JSON.stringify(await price.series('AAPL')),serialized);
 const cold=preferenceFixture();cold.failYahoo();await cold.context.MarketPrices.refresh(true);await cold.context.BOSEquity.refresh();assert.equal(cold.context.MarketPrices.currentQuote('AAPL').sourceId,'bos','cold Yahoo outage does not prevent independently validated BOS pricing');
 assert.equal(cold.context.MarketPrices.currentQuote('AAPL').close,250);assert(cold.context.MarketPrices.currentDetails('AAPL').includes('Forward P/E'));
 console.log('PASS BOS primary/fallback reader integration, exact currencies, retained values, valuation basis and unchanged history.');
})().catch(error=>{console.error(error);process.exitCode=1;});
