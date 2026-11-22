/* Historical desk: immutable adapters and full-precision retrospective analysis. */
(function(root){'use strict';
const DAY=86400000, iso=d=>d.toISOString().slice(0,10), utc=s=>new Date(s+'T00:00:00Z');
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function latestPoint(s,date){const p=s?.points.filter(p=>p.date<=date).at(-1);return p?{...p,ageDays:Math.floor((utc(date)-utc(p.date))/DAY)}:null;}
function trailing(s,date,months){const end=latestPoint(s,date),target=end?addMonths(end.date,-months):null,base=target&&!(s.grain==='quarterly'&&months<3)?at(s,target):null;return {base,end,target,value:delta(s,base,end),unit:s.responseUnit||s.unit};}
function before(s,event,months){const target=addMonths(event,-months),base=at(s,target),end=at(s,event,true);return {base,end,target,value:delta(s,base,end),unit:s.responseUnit||s.unit};}
const watchlistPriority = new Map(['NVDA', 'TSM', 'BABA', 'GOOGL', 'AAPL', 'MSFT', 'AMZN'].map((ticker, index) => [ticker, index]));
const comparisonBanks = [
  {id: 'bb:DBS SP|SGD', ticker: 'DBS', marketTicker: 'D05.SI', bbTicker: 'DBS SP', isin: 'SG1L01001701', currency: 'SGD', name: 'DBS Group Holdings'},
  {id: 'sgx:O39|SGD', ticker: 'OCBC', marketTicker: 'O39.SI', exchange: 'SGX O39', isin: 'SG1S04926220', currency: 'SGD', name: 'OCBC'}
];
function comparisonListings(records) {
  const bankIds = new Set(comparisonBanks.map(bank => bank.id));
  return [...records.filter(record => !bankIds.has(record.id)), ...comparisonBanks];
}
function defaultShareSet(watchlist, records, size) {
  const priority = [...watchlistPriority.keys(), 'META'];
  const preferred = priority.map(ticker =>
    watchlist.find(row => row.ticker === ticker)?.record.id ||
    records.find(record => record.bbTicker === ticker + ' US' && record.currency === 'USD')?.id
  ).filter(Boolean);
  const banks = comparisonBanks.map(bank => bank.id).filter(id => records.some(record => record.id === id));
  return [...new Set([...preferred, ...banks, ...watchlist.map(row => row.record.id), ...records.map(record => record.id)])].slice(0, size);
}
function watchlistRecords(rows, identities, records) {
  const watchlist = rows.flatMap(row => {
    const identity = identities.find(entry => entry.ticker === row.ticker);
    if (!identity) return [];
    const matches = records.filter(record => record.currency === 'USD' && / US$/.test(record.bbTicker || '') &&
      (record.isin ? record.isin === identity.isin : record.bbTicker === row.ticker + ' US'));
    const record = matches.find(entry => entry.id.startsWith('bb:')) || matches[0];
    return record ? [{ticker: row.ticker, record}] : [];
  });
  const priority = entry => watchlistPriority.get(entry.ticker) ?? watchlistPriority.size;
  return watchlist.sort((a, b) => priority(a) - priority(b));
}
function addMonths(s,n){const d=utc(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return iso(d);}
function grain(f=''){return /quarter/i.test(f)?'quarterly':/month/i.test(f)?'monthly':/week/i.test(f)?'weekly':/auction/i.test(f)?'auction':'daily';}
function periodEnd(s,g){const d=utc(s);if(g==='monthly')return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)));if(g==='quarterly')return iso(new Date(Date.UTC(d.getUTCFullYear(),Math.floor(d.getUTCMonth()/3)*3+3,0)));return s;}
function points(raw,g){const map=new Map();for(const p of raw||[]){const o=Array.isArray(p)?{date:p[0],value:p[1]}:{...p};if(!o.date||!finite(o.value))continue;const date=periodEnd(o.date,g);map.set(date,{...o,observationDate:o.observationDate||o.date,date});}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function age(g){return {daily:7,weekly:14,monthly:45,quarterly:120,auction:45,sparse:45}[g]||7;}
function at(series,date,strict=false){const p=series.points.filter(p=>strict?p.date<date:p.date<=date).at(-1);return p&&(utc(date)-utc(p.date))/DAY<=age(series.grain)?p:null;}
function delta(s,a,b){if(!a||!b)return null;if(s.kind==='price')return a.value>0?(b.value/a.value-1)*100:null;return (b.value-a.value)*(s.responseUnit==='bp'?100:1);}
function response(s,event,months){const target=addMonths(event,months),base=at(s,event,true),latest=s.points.at(-1)?.date,weekend=[0,6].includes(utc(target).getUTCDay()),covered=latest&&(target<=latest||(s.grain==='daily'&&weekend&&(utc(target)-utc(latest))/DAY<=2)),end=covered?at(s,target):null;return {value:delta(s,base,end),base,end,target,unit:s.responseUnit||s.unit,grain:s.grain};}
function rebase(s,event){const base=at(s,event,true);return !base||base.value<=0?[]:s.points.map(p=>({...p,value:p.value/base.value*100,originalValue:p.value,baselineDate:base.date}));}
function monthly(s,before='9999-12-31'){if(s.grain==='quarterly'||s.grain==='sparse')return [];const map=new Map();for(const p of s.points){const date=periodEnd(p.date,'monthly');if(date>=before)continue;map.set(date,{...p,date});}return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function baseline(s,event){if(s.grain==='sparse'||s.kind==='pe')return null;const q=s.grain==='quarterly',p=(q?s.points.filter(p=>p.date<event):monthly(s,event)).slice(q?-20:-60);if(p.length<(q?12:24))return null;const mean=p.reduce((n,p)=>n+p.value,0)/p.length,sd=Math.sqrt(p.reduce((n,p)=>n+(p.value-mean)**2,0)/(p.length-1));return sd>0?{mean,sd,n:p.length,first:p[0].date,last:p.at(-1).date}:null;}
function zscore(s,event,cursor){const b=baseline(s,event),p=at(s,cursor);return b&&p?{value:(p.value-b.mean)/b.sd,baseline:b,point:p}:null;}
function heat(z){if(!finite(z))return {className:'neutral',badge:'N/A'};const a=Math.abs(z);return {className:a<1?'neutral':(z>0?'warm':'cool')+(a>=2?' strong':''),badge:a<1?'<1σ':a<2?'1σ':'2σ'};}
function yoy(s){const lookup=new Map(s.points.map(p=>[p.observationDate,p]));return {...s,unit:'% year over year',responseUnit:'bp',transform:'12-month change; exact matching observation month',points:s.points.flatMap(p=>{const a=lookup.get(addMonths(p.observationDate,-12));return a&&a.value>0?[{...p,value:(p.value/a.value-1)*100}]:[];})};}
function changes(s){const p=monthly(s),map=new Map(p.map(p=>[p.date,p]));return p.flatMap(b=>{const a=map.get(periodEnd(addMonths(b.date,-1),'monthly'));return a?[{date:b.date,value:delta(s,a,b),base:a,end:b}].filter(p=>finite(p.value)):[];});}
function relationship(a,b,start,end){const x=changes(a).filter(p=>p.date>=start&&p.date<=end),ym=new Map(changes(b).map(p=>[p.date,p]));const pairs=x.filter(p=>ym.has(p.date)).map(p=>({date:p.date,x:p.value,y:ym.get(p.date).value}));const n=pairs.length;if(n<24)return {n,pairs,r:null,reason:'At least 24 matched monthly changes required; no gaps are filled.'};const mx=pairs.reduce((n,p)=>n+p.x,0)/n,my=pairs.reduce((n,p)=>n+p.y,0)/n,xx=pairs.reduce((n,p)=>n+(p.x-mx)**2,0),yy=pairs.reduce((n,p)=>n+(p.y-my)**2,0);return {n,pairs,r:xx&&yy?pairs.reduce((n,p)=>n+(p.x-mx)*(p.y-my),0)/Math.sqrt(xx*yy):null};}
const infl=new Set(['CPIAUCSL','CPILFESL','CPIAUCNS','CPILFENS','PCEPILFE']);
function adapt(s,meta={}){const g=grain(s.frequency),unit=s.unit||meta.unit||'',id=s.id;return {...meta,...s,grain:g,source:s.source||meta.source_url||'',unit,responseUnit:/^(Percent|Percentage Points|% p.a.)$/i.test(unit)?'bp':unit,transform:'native level',points:points(s.points,g),inflation:infl.has(id)};}
const benchmarkNames = {
  SPX: 'S&P 500 (SPX)',
  NASDAQ100: 'Nasdaq-100 (QQQ benchmark)',
  DJIA: 'Dow Jones Industrial Average (DJIA)'
};
function benchmarkPaths(series, anchor, unit) {
  return Object.entries(benchmarkNames).map(([id, name]) => {
    const source = series[id];
    return {...source, id, name, unit, points: source ? rebase(source, anchor) : []};
  });
}
let pending;const native=new Map(),shares=new Map();
async function json(url){const r=await fetch(url,{cache:'no-cache'});if(!r.ok)throw Error('Data HTTP '+r.status+' · '+url);return r.json();}
async function loadWeekly(){
  if(!root.FredWeekly)return [];
  const parts=await Promise.all(['yields','fx'].map(family=>root.FredWeekly.load(family).then(result=>result.series).catch(()=>[])));
  return parts.flat().map(s=>adapt({...s,id:'WEEKLY:'+s.id,name:s.id+' · weekly',
    source:s.source_url||s.source_urls?.[0],group:'Weekly FX / Treasury',adjustment:s.basis}));
}
async function load(){if(!pending)pending=(async()=>{const [catalog,events,fed,sgs,shareStatus,extra,weekly]=await Promise.all([root.FredArchive.catalog(),json('data/historical-fred-events.json'),json('data/history-fed.json'),json('data/history-v3.json'),root.ShareLabData.load(),Promise.allSettled([json('data/watchlist/latest.json'),json('data/watchlist/identities.json'),json('data/spx/history.json'),root.MarketPrices?.refresh(),root.BOSEquity?.refresh()]),loadWeekly()]);const mon=await json(root.FredArchive.resolve(catalog.monitor_url)),series={};for(const [id,s] of Object.entries(mon.series)) {
  series[id]=adapt(s,catalog.datasets.find(x=>x.id===id));
  if (id in benchmarkNames) Object.assign(series[id], {
    kind: 'price', responseUnit: '%', transform: 'Price index close via FRED'
  });
}for(const s of fed.series)series['MONTHLY:'+s.id]=adapt({...s,id:'MONTHLY:'+s.id,name:s.id+' · monthly average',source:s.source_url,group:'FX / monthly UST',retrieved:fed.retrieved_at,adjustment:s.aggregation||fed.period_label});for(const s of sgs.series.filter(x=>x.id.startsWith('SGD ')))series['SGS:'+s.id]=adapt({...s,id:'SGS:'+s.id,name:s.id+' · supplied snapshot',group:'SGS monthly',sourceFile:sgs.source_file,adjustment:sgs.period_label,sourceStatus:sgs.status});const records=comparisonListings(root.ShareLabData.records().filter(r=>r.compareEligible===true&&['exact_ticker_currency','exact_provider_ticker_currency'].includes(r.identityStatus)&&r.currency));const watch=extra[0].value,identities=extra[1].value,spx=extra[2].value;if(spx?.id==='SPX'&&spx.symbol==='^GSPC')series.SPX={...adapt({...spx,frequency:'Daily',source:spx.source_url,retrieved:spx.retrieved_at}),kind:'price',responseUnit:'%',transform:spx.basis};for(const s of weekly)series[s.id]=s;const weeklyByCode=new Map(weekly.filter(s=>s.provider_series).map(s=>[s.provider_series,s]));return {catalog,events:events.events,series,records,weeklyByCode,shareStatus:!!shareStatus,watchlist:watch&&identities?watchlistRecords(root.WatchlistMembership?root.WatchlistMembership.merge(watch.rows):watch.rows,identities.identities,records):[],watchlistAsOf:watch?.as_of,spxStatus:spx?'ok':'S&P 500 history unavailable'};})().catch(e=>{pending=null;throw e;});return pending;}
function exactMarketListing(item, record) {
  return item && item.currency === record.currency && (!item.isin || !record.isin || item.isin === record.isin);
}
function current(record) {
  const ticker = record.marketTicker || record.ticker;
  const item = root.MarketPrices?.resolve(ticker) || root.BOSEquity?.itemFor(ticker);
  if (!exactMarketListing(item, record)) return null;
  const quote = root.MarketPrices?.currentQuote(item);
  const pe = root.BOSEquity?.valuationFor(item, 'pe');
  return {quote, pe};
}
async function sharedClose(record) {
  const ticker = record.marketTicker || record.ticker;
  const item = root.MarketPrices?.resolve(ticker);
  if (!exactMarketListing(item, record) || item.ticker !== ticker || item.basis !== 'source_close_not_total_return') return null;
  try {
    return await root.MarketPrices.series(ticker);
  } catch {
    return null;
  }
}
async function share(id) {
  if (!shares.has(id)) shares.set(id, (async () => {
    const history = await root.ShareLabData.historyFor(id);
    const record = comparisonBanks.find(bank => bank.id === id) || history.record;
    if (!record) return null;
    const make = (metric, kind, unit, grain, values, transform, source) => ({
      id: id + ':' + metric, name: record.name, record, unit, grain, kind,
      responseUnit: kind === 'price' ? '%' : unit, transform, source, points: points(values, grain)
    });
    const daily = history.metrics.globalPrice.filter(point => point.currency === record.currency);
    const shared = await sharedClose(record);
    const sharedPrice = shared?.daily.length ? make('marketClose', 'price', record.currency, 'daily', shared.daily,
      'Shared daily Close · local currency', shared.item.history_url) : null;
    const price = daily.length || !sharedPrice ? make('globalPrice', 'price', record.currency, 'daily', daily,
      'Saved daily Close · local currency') : sharedPrice;
    const periodPrice = shared?.base.monthly.length ? make('monthlyClose', 'price', record.currency, 'monthly', shared.base.monthly,
      'Provider monthly Close · period end · local currency', shared.item.history_url) : null;
    const pe = make('pe', 'pe', 'turns', 'sparse', history.metrics.pe, 'BOS dated consensus-forward P/E');
    return {price, sharedPrice, periodPrice, pe};
  })());
  return shares.get(id);
}
async function raw(id){if(!native.has(id))native.set(id,root.FredArchive.load(id));return native.get(id);}
function nativeSeries(data,field='bidToCoverRatio',country='All Other'){const m=data.metadata;if(m.id==='TIC')return adapt({...m,unit:'USD billions',name:country+' Treasury holdings',points:data.rows.filter(r=>r.country_or_aggregate===country).map(r=>[r.observation_date,number(r.holdings_usd_billions)])});if(m.id==='AUCTION')return adapt({...m,unit:field==='highYield'||field==='interestRate'?'Percent':field==='offeringAmount'?'USD':field==='bidToCoverRatio'?'Times':'Native field units',name:'10Y auction · '+field,points:data.rows.map(r=>[r.competitiveAuctionCloseDate.slice(0,10),number(r[field])])});if(data.series)return adapt(data.series,m);return adapt({...m,points:data.rows.map(r=>[r.observation_date,number(r[m.id]??r.value)])});}
function number(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;}
const api={addMonths,grain,periodEnd,points,at,delta,response,rebase,monthly,baseline,zscore,heat,yoy,changes,relationship,adapt,benchmarkPaths,load,share,raw,nativeSeries,finite,latestPoint,trailing,before,watchlistRecords,comparisonListings,defaultShareSet,current};root.HistoricalFredData=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
