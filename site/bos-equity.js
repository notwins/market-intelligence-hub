/* Dated BOS coverage observations. Separate from ACE and historical close series. */
(function(root){'use strict';
const BASE='https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/bos/';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const refValid=r=>r&&typeof r.path==='string'&&/^[-a-zA-Z0-9_/.]+$/.test(r.path)&&!r.path.includes('..')&&!r.path.startsWith('/')&&/^[a-f0-9]{64}$/.test(r.sha256);
const format=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'Unavailable';
const day=v=>date(v)?new Date(v+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date unavailable';
const fields=['price','marketCapUsdBillions','fairValueOrTargetPrice','upsidePct','dividendYieldPct','pe','pb','epsGrowthPct','roePct','riskRating','ytdGainPct'];
let manifest=null,edition=null,editionRef=null,error='',storageNotice='',pending=null,lastCheck=0;
const cache=new Map(),states=new Map();
let saved=[];try{const value=JSON.parse(root.localStorage?.getItem('market-bos-watchlist')||'[]');if(Array.isArray(value))saved=value.filter(x=>typeof x==='string').slice(0,5000);}catch{}
function validateManifest(v){
 if(v?.schemaVersion!==1||v.sourceId!=='bos-equity-coverage'||!refValid(v.latest)||!Array.isArray(v.editions)||!v.editions.length||v.editions.length>10000)throw Error('Unsupported BOS feed manifest.');
 const paths=new Set();for(const r of v.editions){if(!refValid(r)||!date(r.reportDate)||!date(r.priceAsOf)||r.priceAsOf>r.reportDate||paths.has(r.path))throw Error('Invalid BOS edition index.');paths.add(r.path);}
 const latest=v.editions.find(r=>r.path===v.latest.path&&r.sha256===v.latest.sha256);if(!latest)throw Error('Latest BOS edition is not in its archive.');if(v.editions.some(r=>r.reportDate>latest.reportDate))throw Error('Latest BOS edition is older than its archive.');
 return v;
}
function validateEdition(v){
 if(v?.schemaVersion!==1||v.sourceId!=='bos-equity-coverage'||!date(v.reportDate)||!date(v.priceAsOf)||v.priceAsOf>v.reportDate||!safeUrl(v.sourceUrl)||!/^[a-f0-9]{64}$/.test(v.sourceSha256)||!Array.isArray(v.records)||!v.records.length||v.records.length>10000||typeof v.metricBasis!=='string')throw Error('Invalid BOS coverage snapshot.');
 const ids=new Set();for(const r of v.records){
  if(typeof r.instrumentId!=='string'||!r.instrumentId||ids.has(r.instrumentId)||!['equity','index'].includes(r.instrumentType)||typeof r.name!=='string'||typeof r.ticker!=='string'||typeof r.currency!=='string'||!date(r.priceAsOf)||r.priceAsOf>v.reportDate||!r.raw||typeof r.raw!=='object'||Array.isArray(r.raw)||!Number.isInteger(r.sourcePage)||r.sourcePage<1||!Number.isInteger(r.sourceRow)||r.sourceRow<1)throw Error('Invalid or duplicate BOS listing.');
  if(fields.some(f=>r[f]!==null&&r[f]!==undefined&&!Number.isFinite(r[f]))||r.price!==null&&r.price!==undefined&&r.price<=0||Object.values(r.raw).some(x=>x!==null&&typeof x!=='string'))throw Error('Invalid BOS numeric or raw field.');
  ids.add(r.instrumentId);
 }
 return v;
}
function base(){return root.MARKET_BOS_BASE||BASE;}
async function read(ref){
 if(!refValid(ref))throw Error('Invalid BOS snapshot reference.');
 if(!cache.has(ref.sha256))cache.set(ref.sha256,(async()=>{const response=await root.fetch(base()+ref.path,{cache:'force-cache'});if(!response.ok)throw Error('BOS edition download unavailable.');const bytes=await response.arrayBuffer();const hash=[...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==ref.sha256)throw Error('BOS edition integrity check failed.');return validateEdition(JSON.parse(new TextDecoder().decode(bytes)));})().catch(e=>{cache.delete(ref.sha256);throw e;}));
 return cache.get(ref.sha256);
}
function isLocal(){return ['localhost','127.0.0.1','::1','[::1]'].includes(root.location?.hostname);}
async function refresh(force=false){
 if(pending)return pending;if(!force&&lastCheck&&Date.now()-lastCheck<300000)return;
 pending=(async()=>{try{const response=await root.fetch(base()+'manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('BOS coverage feed unavailable.');const next=validateManifest(await response.json());if(!isLocal()&&next.publicDisplayApproved!==true)throw Error('BOS coverage is awaiting publication approval.');const nextEdition=await read(next.latest);if(!isLocal()&&nextEdition.records.some(r=>Object.hasOwn(r,'esgRating')||Object.hasOwn(r.raw,'esgRating')))throw Error('Public BOS snapshot contains excluded ESG fields.');const indexed=next.editions.find(r=>r.path===next.latest.path);if(nextEdition.reportDate!==indexed.reportDate||nextEdition.priceAsOf!==indexed.priceAsOf)throw Error('BOS edition dates do not match the archive.');if(edition&&nextEdition.reportDate<edition.reportDate)throw Error('BOS latest edition moved backwards; retaining the loaded edition.');manifest=next;edition=nextEdition;editionRef=next.latest;error='';}catch(e){error=e.message;}finally{lastCheck=Date.now();pending=null;paintAll();if(root.document?.dispatchEvent&&root.CustomEvent)root.document.dispatchEvent(new root.CustomEvent('bos-equity-updated'));}})();return pending;
}
function state(key){if(!states.has(key))states.set(key,{query:'',sector:'',region:'',marketGroup:'',currency:'',group:'sector',savedOnly:false,page:1,edition:'',version:0});return states.get(key);}
function panel(context='master'){return `<section class="card section bos-equity" data-bos-panel="${esc(context)}" aria-label="Bank of Singapore equity coverage"><h2>Bank of Singapore equity coverage</h2><p role="status">Loading the latest published coverage edition…</p></section>`;}
function facts(ticker,currency){return `<div class="bos-equity-facts" data-bos-ticker="${esc(ticker)}" data-bos-currency="${esc(currency)}"></div>`;}
function matchingRecord(data,feed,ticker,currency){const matches=(feed?.verifiedMappings||[]).filter(m=>m.verified===true&&m.ticker===ticker&&m.currency===currency);if(matches.length!==1)return null;const rows=data?.records?.filter(r=>r.instrumentId===matches[0].instrumentId&&r.currency===currency&&r.instrumentType==='equity')||[];return rows.length===1?rows[0]:null;}
// Fixed maximum age is a freshness ceiling, not a claim about market calendars.
// On a tied observation date BOS wins; PDF/download dates never outrank prices.
const MAX_AGE_DAYS=7;
// Reviewed against the immutable 13-Nov-2026 BOS edition and the existing
// price register. Exact listings only: no live symbol/name inference.
const reviewedListings=Object.freeze([
 {"ticker":"AAPL","currency":"USD","listingId":"aapl","instrumentId":"AAPL US","verified":true},
 {"ticker":"NVDA","currency":"USD","listingId":"nvda","instrumentId":"NVDA US","verified":true},
 {"ticker":"MSFT","currency":"USD","listingId":"msft","instrumentId":"MSFT US","verified":true},
 {"ticker":"GOOG","currency":"USD","listingId":"goog","instrumentId":"GOOG US","verified":true},
 {"ticker":"AMZN","currency":"USD","listingId":"amzn","instrumentId":"AMZN US","verified":true},
 {"ticker":"TSM","currency":"USD","listingId":"tsm","instrumentId":"TSM US","verified":true},
 {"ticker":"SPCX","currency":"USD","listingId":"spcx","instrumentId":"SPCX US","verified":true},
 {"ticker":"META","currency":"USD","listingId":"meta","instrumentId":"META US","verified":true},
 {"ticker":"AVGO","currency":"USD","listingId":"avgo","instrumentId":"AVGO US","verified":true},
 {"ticker":"TSLA","currency":"USD","listingId":"tsla","instrumentId":"TSLA US","verified":true},
 {"ticker":"BRK-B","currency":"USD","listingId":"brk-b","instrumentId":"BRK/B US","verified":true},
 {"ticker":"LLY","currency":"USD","listingId":"lly","instrumentId":"LLY US","verified":true},
 {"ticker":"WMT","currency":"USD","listingId":"wmt","instrumentId":"WMT US","verified":true},
 {"ticker":"JPM","currency":"USD","listingId":"jpm","instrumentId":"JPM US","verified":true},
 {"ticker":"V","currency":"USD","listingId":"v","instrumentId":"V US","verified":true},
 {"ticker":"MU","currency":"USD","listingId":"mu","instrumentId":"MU US","verified":true},
 {"ticker":"XOM","currency":"USD","listingId":"xom","instrumentId":"XOM US","verified":true},
 {"ticker":"AMD","currency":"USD","listingId":"amd","instrumentId":"AMD US","verified":true},
 {"ticker":"JNJ","currency":"USD","listingId":"jnj","instrumentId":"JNJ US","verified":true},
 {"ticker":"MA","currency":"USD","listingId":"ma","instrumentId":"MA US","verified":true},
 {"ticker":"ASML","currency":"USD","listingId":"asml","instrumentId":"ASML US","verified":true},
 {"ticker":"ABBV","currency":"USD","listingId":"abbv","instrumentId":"ABBV US","verified":true},
 {"ticker":"COST","currency":"USD","listingId":"cost","instrumentId":"COST US","verified":true},
 {"ticker":"601939.SS","currency":"CNY","listingId":"601939-ss","instrumentId":"601939 CH","verified":true},
 {"ticker":"CVX","currency":"USD","listingId":"cvx","instrumentId":"CVX US","verified":true},
 {"ticker":"KO","currency":"USD","listingId":"ko","instrumentId":"KO US","verified":true},
 {"ticker":"PG","currency":"USD","listingId":"pg","instrumentId":"PG US","verified":true},
 {"ticker":"601288.SS","currency":"CNY","listingId":"601288-ss","instrumentId":"601288 CH","verified":true},
 {"ticker":"CSCO","currency":"USD","listingId":"csco","instrumentId":"CSCO US","verified":true},
 {"ticker":"PLTR","currency":"USD","listingId":"pltr","instrumentId":"PLTR US","verified":true},
 {"ticker":"MRK","currency":"USD","listingId":"mrk","instrumentId":"MRK US","verified":true},
 {"ticker":"1398.HK","currency":"HKD","listingId":"1398-hk","instrumentId":"1398 HK","verified":true},
 {"ticker":"ORCL","currency":"USD","listingId":"orcl","instrumentId":"ORCL US","verified":true},
 {"ticker":"UNH","currency":"USD","listingId":"unh","instrumentId":"UNH US","verified":true},
 {"ticker":"HD","currency":"USD","listingId":"hd","instrumentId":"HD US","verified":true},
 {"ticker":"BAC","currency":"USD","listingId":"bac","instrumentId":"BAC US","verified":true},
 {"ticker":"601988.SS","currency":"CNY","listingId":"601988-ss","instrumentId":"601988 CH","verified":true},
 {"ticker":"GE","currency":"USD","listingId":"ge","instrumentId":"GE US","verified":true},
 {"ticker":"PM","currency":"USD","listingId":"pm","instrumentId":"PM US","verified":true},
 {"ticker":"MS","currency":"USD","listingId":"ms","instrumentId":"MS US","verified":true},
 {"ticker":"RY","currency":"USD","listingId":"ry","instrumentId":"RY US","verified":true},
 {"ticker":"INTC","currency":"USD","listingId":"intc","instrumentId":"INTC US","verified":true},
 {"ticker":"NFLX","currency":"USD","listingId":"nflx","instrumentId":"NFLX US","verified":true},
 {"ticker":"OR.PA","currency":"EUR","listingId":"or-pa","instrumentId":"OR FP","verified":true},
 {"ticker":"NESN.SW","currency":"CHF","listingId":"nesn-sw","instrumentId":"NESN SW","verified":true},
 {"ticker":"600519.SS","currency":"CNY","listingId":"600519-ss","instrumentId":"600519 CH","verified":true},
 {"ticker":"BABA","currency":"USD","listingId":"baba","instrumentId":"BABA US","verified":true},
 {"ticker":"RTX","currency":"USD","listingId":"rtx","instrumentId":"RTX US","verified":true},
 {"ticker":"PANW","currency":"USD","listingId":"panw","instrumentId":"PANW US","verified":true},
 {"ticker":"WFC","currency":"USD","listingId":"wfc","instrumentId":"WFC US","verified":true},
 {"ticker":"TXN","currency":"USD","listingId":"txn","instrumentId":"TXN US","verified":true},
 {"ticker":"AMAT","currency":"USD","listingId":"amat","instrumentId":"AMAT US","verified":true},
 {"ticker":"CAT","currency":"USD","listingId":"cat","instrumentId":"CAT US","verified":true},
 {"ticker":"TMO","currency":"USD","listingId":"tmo","instrumentId":"TMO US","verified":true},
 {"ticker":"GS","currency":"USD","listingId":"gs","instrumentId":"GS US","verified":true},
 {"ticker":"AMGN","currency":"USD","listingId":"amgn","instrumentId":"AMGN US","verified":true},
 {"ticker":"0857.HK","currency":"HKD","listingId":"0857-hk","instrumentId":"857 HK","verified":true},
 {"ticker":"LIN","currency":"USD","listingId":"lin","instrumentId":"LIN US","verified":true},
 {"ticker":"SIE.DE","currency":"EUR","listingId":"sie-de","instrumentId":"SIE GY","verified":true},
 {"ticker":"IBM","currency":"USD","listingId":"ibm","instrumentId":"IBM US","verified":true},
 {"ticker":"MC.PA","currency":"EUR","listingId":"mc-pa","instrumentId":"MC FP","verified":true},
 {"ticker":"LRCX","currency":"USD","listingId":"lrcx","instrumentId":"LRCX US","verified":true},
 {"ticker":"0941.HK","currency":"HKD","listingId":"0941-hk","instrumentId":"941 HK","verified":true},
 {"ticker":"CRWD","currency":"USD","listingId":"crwd","instrumentId":"CRWD US","verified":true},
 {"ticker":"AXP","currency":"USD","listingId":"axp","instrumentId":"AXP US","verified":true},
 {"ticker":"ITX.MC","currency":"EUR","listingId":"itx-mc","instrumentId":"ITX SM","verified":true},
 {"ticker":"GILD","currency":"USD","listingId":"gild","instrumentId":"GILD US","verified":true},
 {"ticker":"GEV","currency":"USD","listingId":"gev","instrumentId":"GEV US","verified":true},
 {"ticker":"DIS","currency":"USD","listingId":"dis","instrumentId":"DIS US","verified":true},
 {"ticker":"DELL","currency":"USD","listingId":"dell","instrumentId":"DELL US","verified":true},
 {"ticker":"ANET","currency":"USD","listingId":"anet","instrumentId":"ANET US","verified":true},
 {"ticker":"ALV.DE","currency":"EUR","listingId":"alv-de","instrumentId":"ALV GY","verified":true},
 {"ticker":"ABT","currency":"USD","listingId":"abt","instrumentId":"ABT US","verified":true},
 {"ticker":"MCD","currency":"USD","listingId":"mcd","instrumentId":"MCD US","verified":true},
 {"ticker":"CBA.AX","currency":"AUD","listingId":"cba-ax","instrumentId":"CBA AU","verified":true},
 {"ticker":"C","currency":"USD","listingId":"c","instrumentId":"C US","verified":true},
 {"ticker":"PEP","currency":"USD","listingId":"pep","instrumentId":"PEP US","verified":true},
 {"ticker":"VZ","currency":"USD","listingId":"vz","instrumentId":"VZ US","verified":true},
 {"ticker":"BLK","currency":"USD","listingId":"blk","instrumentId":"BLK US","verified":true},
 {"ticker":"PRX.AS","currency":"EUR","listingId":"prx-as","instrumentId":"PRX NA","verified":true},
 {"ticker":"NEE","currency":"USD","listingId":"nee","instrumentId":"NEE US","verified":true},
 {"ticker":"SHOP","currency":"USD","listingId":"shop","instrumentId":"SHOP US","verified":true},
 {"ticker":"D05.SI","currency":"SGD","listingId":"d05-si","instrumentId":"DBS SP","verified":true},
 {"ticker":"U11.SI","currency":"SGD","listingId":"u11-si","instrumentId":"UOB SP","verified":true},
 {"ticker":"Z74.SI","currency":"SGD","listingId":"z74-si","instrumentId":"ST SP","verified":true},
 {"ticker":"S68.SI","currency":"SGD","listingId":"s68-si","instrumentId":"SGX SP","verified":true},
 {"ticker":"C38U.SI","currency":"SGD","listingId":"c38u-si","instrumentId":"CICT SP","verified":true},
 {"ticker":"S63.SI","currency":"SGD","listingId":"s63-si","instrumentId":"STE SP","verified":true},
 {"ticker":"BN4.SI","currency":"SGD","listingId":"bn4-si","instrumentId":"KEP SP","verified":true},
 {"ticker":"BS6.SI","currency":"SGD","listingId":"bs6-si","instrumentId":"YZJSGD SP","verified":true},
 {"ticker":"C6L.SI","currency":"SGD","listingId":"c6l-si","instrumentId":"SIA SP","verified":true},
 {"ticker":"A17U.SI","currency":"SGD","listingId":"a17u-si","instrumentId":"CLAR SP","verified":true},
 {"ticker":"9CI.SI","currency":"SGD","listingId":"9ci-si","instrumentId":"CLI SP","verified":true},
 {"ticker":"F34.SI","currency":"SGD","listingId":"f34-si","instrumentId":"WIL SP","verified":true},
 {"ticker":"U96.SI","currency":"SGD","listingId":"u96-si","instrumentId":"SCI SP","verified":true},
 {"ticker":"AJBU.SI","currency":"SGD","listingId":"ajbu-si","instrumentId":"KDCREIT SP","verified":true},
 {"ticker":"5E2.SI","currency":"SGD","listingId":"5e2-si","instrumentId":"STM SP","verified":true},
 {"ticker":"M44U.SI","currency":"SGD","listingId":"m44u-si","instrumentId":"MLT SP","verified":true},
 {"ticker":"U14.SI","currency":"SGD","listingId":"u14-si","instrumentId":"UOL SP","verified":true},
 {"ticker":"ME8U.SI","currency":"SGD","listingId":"me8u-si","instrumentId":"MINT SP","verified":true},
 {"ticker":"G13.SI","currency":"SGD","listingId":"g13-si","instrumentId":"GENS SP","verified":true},
 {"ticker":"C09.SI","currency":"SGD","listingId":"c09-si","instrumentId":"CIT SP","verified":true},
 {"ticker":"S58.SI","currency":"SGD","listingId":"s58-si","instrumentId":"SATS SP","verified":true},
 {"ticker":"Y92.SI","currency":"SGD","listingId":"y92-si","instrumentId":"THBEV SP","verified":true},
 {"ticker":"N2IU.SI","currency":"SGD","listingId":"n2iu-si","instrumentId":"MPACT SP","verified":true},
 {"ticker":"J69U.SI","currency":"SGD","listingId":"j69u-si","instrumentId":"FCT SP","verified":true},
 {"ticker":"BUOU.SI","currency":"SGD","listingId":"buou-si","instrumentId":"FLT SP","verified":true},
 {"ticker":"GOOGL","currency":"USD","listingId":"googl","instrumentId":"GOOGL US","verified":true},
 {"ticker":"MRVL","currency":"USD","listingId":"mrvl","instrumentId":"MRVL US","verified":true},
 {"ticker":"NOW","currency":"USD","listingId":"now","instrumentId":"NOW US","verified":true},
 {"ticker":"CRWV","currency":"USD","listingId":"crwv","instrumentId":"CRWV US","verified":true},
 {"ticker":"TPR","currency":"USD","listingId":"tpr","instrumentId":"TPR US","verified":true},
 {"ticker":"QCOM","currency":"USD","listingId":"qcom","instrumentId":"QCOM US","verified":true},
 {"ticker":"ARM","currency":"USD","listingId":"arm","instrumentId":"ARM US","verified":true},
 {"ticker":"GD","currency":"USD","listingId":"gd","instrumentId":"GD US","verified":true},
 {"ticker":"WDC","currency":"USD","listingId":"wdc","instrumentId":"WDC US","verified":true},
 {"ticker":"CRM","currency":"USD","listingId":"crm","instrumentId":"CRM US","verified":true},
 {"ticker":"STX","currency":"USD","listingId":"stx","instrumentId":"STX US","verified":true},
 {"ticker":"HPE","currency":"USD","listingId":"hpe","instrumentId":"HPE US","verified":true},
 {"ticker":"BX","currency":"USD","listingId":"bx","instrumentId":"BX US","verified":true},
 {"ticker":"GLW","currency":"USD","listingId":"glw","instrumentId":"GLW US","verified":true},
 {"ticker":"INTU","currency":"USD","listingId":"intu","instrumentId":"INTU US","verified":true},
 {"ticker":"ISRG","currency":"USD","listingId":"isrg","instrumentId":"ISRG US","verified":true},
 {"ticker":"NOC","currency":"USD","listingId":"noc","instrumentId":"NOC US","verified":true},
 {"ticker":"MRNA","currency":"USD","listingId":"mrna","instrumentId":"MRNA US","verified":true},
 {"ticker":"FTNT","currency":"USD","listingId":"ftnt","instrumentId":"FTNT US","verified":true},
 {"ticker":"COHR","currency":"USD","listingId":"cohr","instrumentId":"COHR US","verified":true},
 {"ticker":"SNOW","currency":"USD","listingId":"snow","instrumentId":"SNOW US","verified":true},
 {"ticker":"NET","currency":"USD","listingId":"net","instrumentId":"NET US","verified":true},
 {"ticker":"ELV","currency":"USD","listingId":"elv","instrumentId":"ELV US","verified":true},
 {"ticker":"CI","currency":"USD","listingId":"ci","instrumentId":"CI US","verified":true},
 {"ticker":"COIN","currency":"USD","listingId":"coin","instrumentId":"COIN US","verified":true},
 {"ticker":"JD","currency":"USD","listingId":"jd","instrumentId":"JD US","verified":true},
 {"ticker":"KR","currency":"USD","listingId":"kr","instrumentId":"KR US","verified":true},
 {"ticker":"NVO","currency":"USD","listingId":"nvo","instrumentId":"NVO US","verified":true},
 {"ticker":"OXY","currency":"USD","listingId":"oxy","instrumentId":"OXY US","verified":true}
].map(Object.freeze));
function today(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
function fresh(value,now=Date.now()){const end=today(now);return date(value)&&value<=end&&(Date.parse(end)-Date.parse(value))/86400000<=MAX_AGE_DAYS;}
function mappings(){return [...(manifest?.verifiedMappings||[]),...reviewedListings];}
function recordFor(item){
 if(!item||item.asset_type&&item.asset_type!=='equity')return null;
 const symbols=[item.ticker,...(item.aliases||[])],ids=[...new Set(mappings().filter(m=>m.verified===true&&m.currency===item.currency&&(!m.listingId||m.listingId===item.id)&&symbols.includes(m.ticker)).map(m=>m.instrumentId))];
 if(ids.length!==1)return null;
 const rows=edition?.records.filter(r=>r.instrumentType==='equity'&&r.instrumentId===ids[0]&&r.currency===item.currency)||[];
 return rows.length===1?rows[0]:null;
}
function itemFor(ticker){
 const matches=mappings().filter(m=>m.verified===true&&m.ticker===ticker),keys=[...new Set(matches.map(m=>m.instrumentId+'|'+m.currency))];
 if(keys.length!==1)return null;
 const m=matches[0],canonical=reviewedListings.find(v=>v.instrumentId===m.instrumentId&&v.currency===m.currency),item={id:canonical?.listingId,ticker,currency:m.currency,asset_type:'equity'};
 const r=recordFor(item);return r?{...item,name:r.name,unit:r.currency}:null;
}
function selectCurrent(row,fallback,options={}){
 const now=options.now??Date.now(),end=today(now),valid=(v,d)=>Number.isFinite(v)&&v>0&&date(d)&&d<=end;
 const bosValid=!!row&&valid(row.price,row.priceAsOf)&&date(options.reportDate)&&row.priceAsOf<=options.reportDate&&options.reportDate<=end;
 const otherValid=!!fallback&&valid(fallback.close,fallback.date);
 const eligible=bosValid&&fresh(row.priceAsOf,now)&&fresh(options.reportDate,now)&&options.available!==false;
 const bos={close:row?.price??null,date:row?.priceAsOf||null,sourceId:'bos',sourceLabel:'Bank of Singapore',sourceUrl:safeUrl(options.sourceUrl),current:eligible};
 if(eligible&&(!otherValid||row.priceAsOf>=fallback.date))return {...bos,reason:'BOS preferred: current observation, same date or newer than the fallback.'};
 let reason=!row?'No verified BOS listing match.':!bosValid?'BOS price unavailable or invalid.':options.available===false?'BOS feed unavailable; using the fallback.':!eligible?'BOS observation is older than the 7-day freshness limit.':`BOS price dated ${row.priceAsOf}; newer fallback close available.`;
 if(otherValid)return {...fallback,sourceId:fallback.sourceId||'yahoo',sourceLabel:fallback.sourceLabel||'Yahoo Finance',sourceUrl:safeUrl(fallback.sourceUrl),current:fresh(fallback.date,now),reason:reason+(!fresh(fallback.date,now)?' Fallback is also dated; no current quote available.':'')};
 if(bosValid)return {...bos,current:false,reason:'Retained BOS observation; no current price or fallback is available.'};
 return {close:null,date:null,sourceId:'unavailable',sourceLabel:'Unavailable',sourceUrl:'',current:false,reason};
}
function selectionFor(item,fallback){return selectCurrent(recordFor(item),fallback,{reportDate:edition?.reportDate,sourceUrl:edition?.sourceUrl,available:!error});}
function valuationFor(item){const row=recordFor(item);return row?{row,reportDate:edition.reportDate,sourceUrl:edition.sourceUrl,basis:edition.metricBasis,current:!error&&fresh(edition.reportDate)&&fresh(row.priceAsOf)}:null;}
function valuationHtml(item){
 const value=valuationFor(item);if(!value)return '<p class="mp-muted">Valuations unavailable. The Yahoo fallback feed supplies prices only.</p>';
 const r=value.row;return `<details class="mp-current-valuations" open><summary>${value.current?'BOS primary valuations':'BOS dated valuation reference'} · ${esc(r.priceAsOf)}</summary><dl class="bos-raw"><div><dt>Forward P/E</dt><dd>${format(r.pe)}</dd></div><div><dt>Forward P/B</dt><dd>${format(r.pb)}</dd></div><div><dt>Market cap · USD bn</dt><dd>${format(r.marketCapUsdBillions)}</dd></div><div><dt>Dividend yield</dt><dd>${format(r.dividendYieldPct)}${Number.isFinite(r.dividendYieldPct)?'%':''}</dd></div><div><dt>${esc(valuationLabel(r))}</dt><dd>${format(r.fairValueOrTargetPrice)} ${esc(r.currency)}</dd></div></dl><p class="mp-muted">${esc(value.basis)}. PDF ${esc(value.reportDate)}${r.analystReportMonth?' · research month '+esc(r.analystReportMonth):''}. Values retain their source price date; they are not recalculated using the selected quote. Missing values have no Yahoo valuation fallback.</p></details>`;
}
function quoteForRow(r,data){
 const matches=mappings().filter(m=>m.verified===true&&m.instrumentId===r.instrumentId&&m.currency===r.currency);
 const items=(root.MarketPrices?.instruments?.()||[]).filter(item=>item.asset_type==='equity'&&item.currency===r.currency&&matches.some(m=>(!m.listingId||m.listingId===item.id)&&[item.ticker,...(item.aliases||[])].includes(m.ticker)));
 const fallback=items.length===1?root.MarketPrices?.rawQuote?.(items[0]):null;
 return selectCurrent(r,fallback,{reportDate:data.reportDate,sourceUrl:data.sourceUrl,available:!error});
}
function valuationLabel(r){return r.researchProvider==='Morningstar'?'Morningstar fair value':r.researchProvider?`${r.researchProvider} target price`:'Fair value / target (source label)';}
function filtered(data,s){const q=s.query.trim().toLocaleLowerCase();return data.records.filter(r=>(!q||[r.name,r.ticker,r.sector,r.region,r.marketGroup,r.currency].join(' ').toLocaleLowerCase().includes(q))&&(!s.sector||r.sector===s.sector)&&(!s.region||r.region===s.region)&&(!s.marketGroup||r.marketGroup===s.marketGroup)&&(!s.currency||r.currency===s.currency)&&(!s.savedOnly||saved.includes(r.instrumentId))).sort((a,b)=>String(a[s.group]||'Ungrouped').localeCompare(String(b[s.group]||'Ungrouped'))||a.name.localeCompare(b.name)||a.instrumentId.localeCompare(b.instrumentId));}
function options(data,key,current){return '<option value="">All</option>'+[...new Set(data.records.map(r=>r[key]).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('');}
function columnLabel(data,key){const col=(data.columns||[]).find(c=>c&&typeof c==='object'&&(c.key===key||c.field===key));return col?.sourceLabel||col?.label||key.replace(/([a-z])([A-Z])/g,'$1 $2');}
function rawDetails(r,data){return `<details><summary>All source fields</summary><p>${esc(r.marketGroup||r.region)} · PDF page ${r.sourcePage}, row ${r.sourceRow}. Price date: ${esc(r.priceAsOf)}. ${esc(r.researchProvider||'Research provider not identified')}${r.analystReportMonth?' · report month '+esc(r.analystReportMonth):''}.</p><dl class="bos-raw">${Object.entries(r.raw).map(([k,v])=>`<div><dt>${esc(columnLabel(data,k))}</dt><dd>${v===null?'Unavailable':esc(v)}</dd></div>`).join('')}</dl>${safeUrl(r.researchReportUrl)?`<a href="${esc(safeUrl(r.researchReportUrl))}" target="_blank" rel="noopener noreferrer">Original company research ↗</a>`:''}</details>`;}
function rowsHtml(data,s){const rows=filtered(data,s),pages=Math.max(1,Math.ceil(rows.length/30));s.page=Math.max(1,Math.min(s.page,pages));let group=null;const body=rows.slice((s.page-1)*30,s.page*30).map(r=>{const q=s.edition?{close:r.price,date:r.priceAsOf,sourceLabel:'BOS archived',current:false}:quoteForRow(r,data),g=String(r[s.group]||'Ungrouped'),head=g!==group?`<tr class="bos-group"><th colspan="10" scope="rowgroup">${esc(g)}</th></tr>`:'';group=g;return head+`<tr><td><button class="bos-save" type="button" data-bos-save="${esc(r.instrumentId)}" aria-label="${saved.includes(r.instrumentId)?'Remove':'Save'} ${esc(r.name)} ${saved.includes(r.instrumentId)?'from':'to'} coverage watchlist" aria-pressed="${saved.includes(r.instrumentId)}">${saved.includes(r.instrumentId)?'★':'☆'}</button></td><th scope="row"><b>${esc(r.name)}</b><small>${esc(r.ticker)} · ${esc(r.currency)} · ${esc(r.marketGroup||r.region)}${r.instrumentType==='index'?' · Index':''}</small>${rawDetails(r,data)}</th><td>${esc(r.sector||'Unclassified')}</td><td title="${esc(q.reason||'Archived source observation')}">${format(q.close)}<small>${esc(q.date)}</small><small>${esc(q.sourceLabel)}${q.current===false?' · dated':''}</small></td><td>${format(r.pe)}</td><td>${format(r.pb)}</td><td>${format(r.marketCapUsdBillions)}</td><td>${format(r.dividendYieldPct)}${Number.isFinite(r.dividendYieldPct)?'%':''}</td><td>${format(r.fairValueOrTargetPrice)}<small>${esc(valuationLabel(r))}</small></td><td>${esc(r.rating||'Unavailable')}<small>${esc(r.moat||'')}</small></td></tr>`;}).join('');return `<p class="bos-count" role="status">${rows.length.toLocaleString()} matching listings · page ${s.page} of ${pages}</p><div class="bos-table-scroll" tabindex="0" role="region" aria-label="BOS equity prices and fundamentals, scroll horizontally"><table><caption>${s.edition?'Archived BOS observations':'BOS preferred when current; newer or unavailable prices use the existing fallback'} · price in listing currency · BOS ratios are consensus forward estimates</caption><thead><tr><th>Save</th><th>Listing / all fields</th><th>Sector</th><th>${s.edition?'Published price':'Preferred price / source'}</th><th>P/E</th><th>P/B</th><th>Market cap<br>USD bn</th><th>Dividend yield</th><th>Fair value / target</th><th>Rating / moat</th></tr></thead><tbody>${body||'<tr><td colspan="10">No listings match these filters.</td></tr>'}</tbody></table></div><div class="bos-pager"><button class="button ghost" type="button" data-bos-page="-1" ${s.page===1?'disabled':''}>Previous</button><span>${s.page} / ${pages}</span><button class="button ghost" type="button" data-bos-page="1" ${s.page===pages?'disabled':''}>Next</button></div>`;}
function panelHtml(data,s,ref,key){
 const copy=key==='history'?'Latest published observations appear above your existing historical charts. Each edition keeps its original price date.':key==='watchlist'?'Explore the coverage universe or save chosen listings to a watchlist on this device.':'Equity coverage and fundamentals complement the source Security Master below.';
 return `<header class="bos-heading"><div><div class="eyebrow">Bank of Singapore · dated equity coverage</div><h2>${s.edition?'Archived coverage edition':'Latest published share prices & fundamentals'}</h2></div><button class="button ghost" type="button" data-bos-refresh>Check for new edition</button></header><p>${copy}</p><div class="bos-dates"><b>PDF: ${day(data.reportDate)}</b><b>Prices: ${day(data.priceAsOf)}</b><span>${data.records.length.toLocaleString()} listings</span></div><p class="bos-basis">BOS is preferred for prices dated within 7 calendar days and at least as recent as the fallback. Each selected price shows its source and date. Valuations keep their BOS observation date. Published reference prices, not intraday quotes. ${esc(data.metricBasis)}. Market capitalisation is in USD billions; GBp prices are in pence. Fair values and analyst targets retain their provider labels.</p>${error?`<p class="bos-warning" role="status">${esc(error)} Showing the previously loaded edition with its original dates.</p>`:''}${storageNotice?`<p class="bos-warning" role="status">${esc(storageNotice)}</p>`:''}<div class="bos-actions"><a class="button ghost" href="${esc(safeUrl(data.sourceUrl))}" target="_blank" rel="noopener noreferrer">Original PDF ↗</a><a class="button ghost" href="${esc(base()+ref.path)}" target="_blank" rel="noopener noreferrer">Published data (JSON) ↗</a><button class="button ghost" type="button" data-bos-csv>Download published fields (CSV)</button><label>Edition<select data-bos-filter="edition"><option value="">Latest available</option>${manifest.editions.slice().sort((a,b)=>b.reportDate.localeCompare(a.reportDate)||b.path.localeCompare(a.path)).map(r=>`<option value="${esc(r.path)}" ${s.edition===r.path?'selected':''}>PDF ${esc(r.reportDate)} · prices ${esc(r.priceAsOf)}</option>`).join('')}</select></label></div><div class="bos-controls"><label class="bos-search">Find a share<input type="search" data-bos-filter="query" value="${esc(s.query)}" placeholder="Company, ticker or sector"></label><label>Sector<select data-bos-filter="sector">${options(data,'sector',s.sector)}</select></label><label>Region<select data-bos-filter="region">${options(data,'region',s.region)}</select></label><label>Market group<select data-bos-filter="marketGroup">${options(data,'marketGroup',s.marketGroup)}</select></label><label>Currency<select data-bos-filter="currency">${options(data,'currency',s.currency)}</select></label><label>Group by<select data-bos-filter="group">${[['sector','Sector'],['region','Region'],['marketGroup','Market group'],['currency','Currency']].map(([v,t])=>`<option value="${v}" ${s.group===v?'selected':''}>${t}</option>`).join('')}</select></label><label class="bos-saved-only"><input type="checkbox" data-bos-saved-only ${s.savedOnly?'checked':''}> My saved listings (${saved.length})</label></div><div data-bos-results>${rowsHtml(data,s)}</div><p class="bos-footnote">Missing and non-meaningful source values remain unavailable. Expand “All source fields” for the original cells and source page. Saving a listing is optional and stays in this browser. MSCI ESG fields are retained in the private extract and excluded from this public dataset.</p>`;
}
async function paintPanel(el){const key=el.dataset.bosPanel,s=state(key);if(!edition){el.innerHTML=`<h2>Bank of Singapore equity coverage</h2><p role="status">${esc(error||'Loading the latest published coverage edition…')}</p><p class="bos-basis">No validated coverage edition is loaded.</p><button class="button ghost" type="button" data-bos-refresh>Try again</button>`;return;}const version=++s.version;try{const ref=s.edition?manifest.editions.find(r=>r.path===s.edition):editionRef;if(!ref){s.edition='';return paintPanel(el);}const data=s.edition?await read(ref):edition;if(s.version!==version||!el.isConnected)return;el._bosData=data;el._bosRef=ref;el.innerHTML=panelHtml(data,s,ref,key);}catch(e){if(s.version===version)el.innerHTML=`<h2>BOS archived edition unavailable</h2><p role="status">${esc(e.message)}</p><button class="button ghost" data-bos-latest>Return to latest edition</button>`;}}
function paintFacts(el){const r=matchingRecord(edition,manifest,el.dataset.bosTicker,el.dataset.bosCurrency);el.innerHTML=r?`<details><summary>BOS published price & fundamentals · ${esc(r.priceAsOf)}</summary><dl class="bos-raw"><div><dt>Published price · ${esc(r.currency)}</dt><dd>${format(r.price)}</dd></div><div><dt>Forward P/E</dt><dd>${format(r.pe)}</dd></div><div><dt>Forward P/B</dt><dd>${format(r.pb)}</dd></div><div><dt>Market cap · USD bn</dt><dd>${format(r.marketCapUsdBillions)}</dd></div><div><dt>${esc(valuationLabel(r))}</dt><dd>${format(r.fairValueOrTargetPrice)} ${esc(r.currency)}</dd></div><div><dt>Dividend yield</dt><dd>${format(r.dividendYieldPct)}${Number.isFinite(r.dividendYieldPct)?'%':''}</dd></div></dl>${error?`<p class="bos-warning" role="status">Feed refresh unavailable. Showing the previously loaded BOS edition dated ${esc(edition.reportDate)}.</p>`:""}<p>${esc(edition.metricBasis)}. PDF ${esc(edition.reportDate)} · page ${r.sourcePage}. <a href="${esc(safeUrl(edition.sourceUrl))}" target="_blank" rel="noopener noreferrer">Original PDF ↗</a></p></details>`:'';}
function paintAll(){for(const el of root.document?.querySelectorAll('[data-bos-panel]')||[])paintPanel(el);for(const el of root.document?.querySelectorAll('[data-bos-ticker]')||[])paintFacts(el);}
function mount(){paintAll();refresh();}
function csv(data){const columns=[...new Set(data.records.flatMap(r=>Object.keys(r.raw)))],keys=['reportDate','priceAsOf','instrumentId','instrumentType','region','sector','sourcePage','sourceRow',...columns];const cell=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+[keys,...data.records.map(r=>[data.reportDate,r.priceAsOf,r.instrumentId,r.instrumentType,r.region,r.sector,r.sourcePage,r.sourceRow,...columns.map(k=>r.raw[k])])].map(row=>row.map(cell).join(',')).join('\r\n');}
if(root.document){
 root.document.addEventListener('market-prices-updated',paintAll);
 root.document.addEventListener('click',ev=>{const panelEl=ev.target.closest('[data-bos-panel]'),s=panelEl?state(panelEl.dataset.bosPanel):null;if(ev.target.closest('[data-bos-refresh]'))refresh(true);if(!s)return;const page=ev.target.closest('[data-bos-page]');if(page){s.page+=Number(page.dataset.bosPage);panelEl.querySelector('[data-bos-results]').innerHTML=rowsHtml(panelEl._bosData,s);}const save=ev.target.closest('[data-bos-save]');if(save){const id=save.dataset.bosSave;saved=saved.includes(id)?saved.filter(v=>v!==id):[...saved,id];try{root.localStorage.setItem('market-bos-watchlist',JSON.stringify(saved));}catch{storageNotice='Browser storage is unavailable; this selection will last for this page only.';}paintAll();}if(ev.target.closest('[data-bos-latest]')){s.edition='';paintPanel(panelEl);}if(ev.target.closest('[data-bos-csv]')&&panelEl._bosData){const url=URL.createObjectURL(new Blob([csv(panelEl._bosData)],{type:'text/csv;charset=utf-8'})),a=root.document.createElement('a');a.href=url;a.download='BOS-equity-coverage-'+panelEl._bosData.reportDate+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}});
 root.document.addEventListener('input',ev=>{if(ev.target.dataset.bosFilter!=='query')return;const el=ev.target.closest('[data-bos-panel]'),s=state(el.dataset.bosPanel);s.query=ev.target.value;s.page=1;el.querySelector('[data-bos-results]').innerHTML=rowsHtml(el._bosData,s);});
 root.document.addEventListener('change',ev=>{const el=ev.target.closest('[data-bos-panel]');if(!el)return;const s=state(el.dataset.bosPanel),key=ev.target.dataset.bosFilter;if(key&&key!=='query'){s[key]=ev.target.value;s.page=1;key==='edition'?paintPanel(el):el.querySelector('[data-bos-results]').innerHTML=rowsHtml(el._bosData,s);}if(ev.target.matches('[data-bos-saved-only]')){s.savedOnly=ev.target.checked;s.page=1;el.querySelector('[data-bos-results]').innerHTML=rowsHtml(el._bosData,s);}});
}
const api={panel,facts,mount,refresh,validateManifest,validateEdition,matchingRecord,valuationLabel,filtered,csv,safeUrl,refValid,recordFor,itemFor,selectCurrent,selectionFor,valuationFor,valuationHtml,quoteForRow,fresh,reviewedListings,version:()=>[editionRef?.sha256,JSON.stringify(manifest?.verifiedMappings||[]),error,today()].join('|')};root.BOSEquity=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
