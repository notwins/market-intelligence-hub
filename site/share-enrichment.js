/* Immutable historical enrichment plus dated BOS YTD gains. Never changes quote/history services. */
(function(root){'use strict';
const YEARS=Object.freeze([2019,2020,2021,2022,2023,2024,2025,2026]);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const pct=v=>finite(v)?`${v>0?'+':''}${v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'Unavailable';
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const isoToday=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const label=v=>validDate(v)?new Date(v+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date unavailable';
let data=null,pending=null,error='';
let byIsin=new Map(),byTicker=new Map();
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function derived(older,newer){return finite(older)&&finite(newer)&&older>-100&&newer>-100?((1+older/100)/(1+newer/100)-1)*100:null;}
function validate(v){
 if(v?.schemaVersion!==1||v.sourceId!=='bloomberg-equity-snapshot'||typeof v.snapshotId!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceSha256)||!validDate(v.returnCutoff)||v.returnBasis?.currency!=='local'||v.returnBasis?.dividends!=='gross_reinvested'||v.returnBasis?.confirmedBy!=='user'||!Array.isArray(v.records)||!v.records.length||v.records.length>10000)throw Error('Unsupported historical shares snapshot.');
 const ids=new Set(),tickers=new Set();
 for(const r of v.records){
  if(!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(r.isin)||r.id!=='isin:'+r.isin||ids.has(r.isin)||tickers.has(r.bbTicker)||!/^.+ [A-Z]{2}$/.test(r.bbTicker)||typeof r.name!=='string'||!r.name||!Number.isInteger(r.sourceRow)||r.sourceRow<4||!r.snapshot||!Array.isArray(r.credit)||!r.returns)throw Error('Invalid or duplicate historical listing.');
  ids.add(r.isin);tickers.add(r.bbTicker);
  for(const y of YEARS){const a=r.returns.annualized?.[y],h=r.returns.holding?.[y];if((a!==null&&!finite(a))||(h!==null&&!finite(h))||(a===null)!==(h===null)||(finite(h)&&h<=-100)||(finite(a)&&a<=-100))throw Error('Invalid historical return.');}
  for(const y of YEARS.slice(0,-1)){const expected=derived(r.returns.holding[y],r.returns.holding[y+1]),actual=r.returns.calendar?.[y];if(expected===null?actual!==null:!finite(actual)||Math.abs(expected-actual)>1e-8)throw Error('Calendar return does not reconcile.');}
  if(r.returns.ytd?.['2026']!==r.returns.holding['2026'])throw Error('Partial-year return does not reconcile.');
  if(r.credit.some(c=>!['rated','not_rated','withdrawn','missing'].includes(c.status)||typeof c.agency!=='string'||typeof c.scope!=='string'||!Array.isArray(c.qualifiers)))throw Error('Invalid scoped credit rating.');
 }
 if(v.validation?.records!==v.records.length)throw Error('Historical snapshot record count differs.');
 return v;
}
function announce(){if(root.document?.dispatchEvent&&root.CustomEvent)root.document.dispatchEvent(new root.CustomEvent('share-enrichment-updated'));}
async function load(){
 if(data)return data;if(pending)return pending;
 pending=(async()=>{try{const response=await root.fetch('data/beta-shares.json',{cache:'no-cache'});if(!response.ok)throw Error('Historical shares snapshot unavailable.');const next=freeze(validate(await response.json()));byIsin=new Map(next.records.map(r=>[r.isin,r]));byTicker=new Map(next.records.map(r=>[r.bbTicker,r]));data=next;error='';return data;}catch(e){error=e.message;return null;}finally{pending=null;announce();}})();return pending;
}
function metadata(){if(!data)return null;const {records,...meta}=data;return meta;}
function records(){return data?data.records.slice():[];}
function acceptedType(item){return !(item&&typeof item==='object'&&((item.asset_type&&item.asset_type!=='equity')||(item.instrumentType&&item.instrumentType!=='equity')));}
function isinOf(item){const value=typeof item==='string'?item:item?.isin||item?.ISIN||(String(item?.id||'').startsWith('isin:')?item.id:'');return String(value||'').replace(/^isin:/i,'').trim().toUpperCase();}
function exactTicker(value){const v=String(value||'').trim().replace(/\s+EQUITY$/i,'').replace(/\s+/g,' ');return /^.+ [A-Z]{2}$/.test(v)?v:null;}
function directTicker(item){if(typeof item==='string')return exactTicker(item);return exactTicker(item?.bbTicker||item?.instrumentId||item?.ticker);}
function reviewed(item){
 const text=typeof item==='string'?item:null;
 const symbols=text?[text]:[item?.ticker,item?.symbol,...(Array.isArray(item?.aliases)?item.aliases:[])].filter(Boolean);
 const approved=root.BOSEquity?.reviewedListings||[],currency=typeof item==='object'?item?.currency:null;
 const mappings=approved.filter(m=>m.verified===true&&symbols.includes(m.ticker)&&(!currency||m.currency===currency));
 // Resolve aliases only through the existing validated price registry. In
 // particular BRK.B is its explicit alias for BRK-B; punctuation is never guessed.
 for(const symbol of symbols){
  const registered=root.MarketPrices?.resolve?.(symbol);
  if(!registered||registered.asset_type!=='equity'||!registered.id||!registered.currency||(currency&&registered.currency!==currency))continue;
  const registeredSymbols=[registered.ticker,registered.id,...(registered.aliases||[])];
  if(!registeredSymbols.includes(symbol))continue;
  mappings.push(...approved.filter(m=>m.verified===true&&m.listingId===registered.id&&m.currency===registered.currency&&registeredSymbols.includes(m.ticker)));
 }
 const identities=[...new Set(mappings.map(m=>m.instrumentId+'|'+m.currency))];
 return identities.length===1?mappings[0]:null;
}
function coherent(record,item){
 if(!record)return null;
 const direct=directTicker(item),mapping=reviewed(item),provided=direct||mapping?.instrumentId;
 if(provided&&provided!==record.bbTicker)return null;
 if(item&&typeof item==='object'&&item.currency){
  const row=root.BOSEquity?.valuationById?.(record.bbTicker)?.row;
  const currencies=[...new Set((root.BOSEquity?.reviewedListings||[]).filter(m=>m.verified===true&&m.instrumentId===record.bbTicker).map(m=>m.currency))];
  const currency=row?.currency||(currencies.length===1?currencies[0]:null);
  if(currency&&currency!==item.currency)return null;
 }
 return record;
}
function find(item){
 if(!data||!item||!acceptedType(item))return null;
 const isin=isinOf(item);if(/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin))return coherent(byIsin.get(isin),item);
 const ticker=directTicker(item);if(ticker)return coherent(byTicker.get(ticker),item);
 const mapping=reviewed(item);return mapping?coherent(byTicker.get(mapping.instrumentId),item):null;
}
function identityFor(item){
 if(!item||!acceptedType(item))return null;
 const record=find(item);if(record)return record.bbTicker;
 const isin=isinOf(item),direct=directTicker(item),mapping=reviewed(item);
 // A supplied but unmatched ISIN cannot borrow another listing's CSV history.
 // An independently reviewed quote mapping may still supply BOS-only facts.
 const proposed=direct||mapping?.instrumentId;
 if(/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)&&data&&proposed&&byTicker.has(proposed)&&byTicker.get(proposed).isin!==isin)return null;
 if(data&&proposed&&byTicker.has(proposed)&&!coherent(byTicker.get(proposed),item))return null;
 return proposed||null;
}
function priceItemFor(item){
 const identity=identityFor(item);if(!identity)return null;
 const choices=(root.BOSEquity?.reviewedListings||[]).filter(m=>m.verified===true&&m.instrumentId===identity&&(!item?.currency||typeof item==='string'||m.currency===item.currency));
 if(!choices.length)return null;
 const currencies=[...new Set(choices.map(m=>m.currency))];if(currencies.length!==1)return null;
 const match=choices.find(m=>m.ticker===item?.ticker)||choices[0];
 const registered=root.MarketPrices?.resolve?.(match.ticker);
 if(registered&&registered.currency===match.currency&&registered.asset_type==='equity'&&(!match.listingId||registered.id===match.listingId))return registered;
 return {id:match.listingId,ticker:match.ticker,currency:match.currency,asset_type:'equity',name:find(item)?.name||item?.name||identity};
}
function valuation(item){
 const identity=identityFor(item);if(!identity)return null;
 const mapped=priceItemFor(item);
 const value=root.BOSEquity?.valuationById?.(identity)||(mapped?root.BOSEquity?.valuationFor?.(mapped):null);
 const row=value?.row;
 if(!row||row.instrumentType!=='equity'||row.instrumentId!==identity||!validDate(row.priceAsOf)||!validDate(value.reportDate)||row.priceAsOf>value.reportDate||value.reportDate>isoToday())return null;
 if(mapped&&mapped.currency!==row.currency)return null;
 if(item&&typeof item==='object'&&item.currency&&item.currency!==row.currency)return null;
 return value;
}
function marketCapFor(item){
 const value=valuation(item),billions=value?.row?.marketCapUsdBillions;
 if(!finite(billions)||billions<0||!finite(billions*1000))return null;
 return {value:billions*1000,marketCapUsdMillions:billions*1000,unit:'USD millions',asOf:value.row.priceAsOf,reportDate:value.reportDate,source:'Bank of Singapore',sourceId:'bos',sourceUrl:value.sourceUrl,current:value.current===true,dated:value.current!==true};
}
function ytdFor(item,year=2026){
 const point={year,label:`${year} YTD · BOS`,value:null,source:'Bank of Singapore',sourceId:'bos',sourceUrl:null,asOf:null,endDate:null,reportDate:null,basis:'BOS YTD gain; dividend/currency return methodology not specified',periodType:'ytd_gain',derived:false,startDate:`${year}-01-01`,endExclusive:false,current:false,dated:true,available:false,cutoffInferred:false};
 if(!Number.isInteger(year)||year<1900||year>9999)return point;
 const value=valuation(item),row=value?.row;
 // The source says "YTD Gains", not total return. A prior year's edition
 // cannot fill the requested year; report and observation dates stay distinct.
 if(!row||row.priceAsOf.slice(0,4)!==String(year)||value.reportDate.slice(0,4)!==String(year))return point;
 const available=finite(row.ytdGainPct);
 return {...point,value:available?row.ytdGainPct:null,sourceUrl:value.sourceUrl||null,asOf:row.priceAsOf,endDate:row.priceAsOf,reportDate:value.reportDate,current:available&&value.current===true,dated:!available||value.current!==true,available};
}
function quoteFor(item){
 const mapped=priceItemFor(item),value=valuation(item);
 if(mapped&&root.MarketPrices?.currentQuote){const quote=root.MarketPrices.currentQuote(mapped);if(finite(quote?.close)&&quote.close>0)return {...quote,currency:mapped.currency};}
 if(value&&root.BOSEquity?.selectCurrent){const quote=root.BOSEquity.selectCurrent(value.row,null,{reportDate:value.reportDate,sourceUrl:value.sourceUrl,available:value.current===true});return {...quote,currency:value.row.currency};}
 return {close:null,date:null,currency:null,current:false,sourceId:'unavailable',sourceLabel:'Unavailable'};
}
function stableName(item){const r=find(item);return String(r?.name||item?.name||item?.securityName||item?.ticker||item?.id||item||'');}
function compareMarketCap(a,b){const av=marketCapFor(a)?.value,bv=marketCapFor(b)?.value;if(finite(av)&&finite(bv)&&av!==bv)return bv-av;if(finite(av)!==finite(bv))return finite(av)?-1:1;return stableName(a).localeCompare(stableName(b),'en',{sensitivity:'base'})||String(identityFor(a)||isinOf(a)).localeCompare(String(identityFor(b)||isinOf(b)));}
function sortShares(rows,identityFn=x=>x){return rows.map((row,index)=>({row,index,identity:identityFn(row)})).sort((a,b)=>compareMarketCap(a.identity,b.identity)||a.index-b.index).map(x=>x.row);}
function returnsFor(item,mode='calendar'){
 if(!['calendar','holding','annualized'].includes(mode))throw Error('Unsupported return display mode.');
 const r=find(item),ytd=mode==='calendar'?ytdFor(item):null;if(!r&&!ytd?.available)return [];
 return YEARS.map(year=>{
  if(mode==='calendar'&&year===2026)return ytd;
  return {year,label:mode==='calendar'?String(year):`Since Jan ${year}`,value:r?(mode==='calendar'?r.returns.calendar[year]:r.returns[mode][year]):null,derived:mode==='calendar',periodType:mode==='calendar'?'calendar_year':mode,startDate:`${year}-01-01`,endDate:mode==='calendar'?`${year+1}-01-01`:data.returnCutoff,endExclusive:mode==='calendar',basis:'Local currency · gross dividends reinvested',returnCutoff:data?.returnCutoff||null,cutoffInferred:true};
 });
}
function detailHtml(item){
 const r=find(item),ytd=ytdFor(item);
 if(!r&&!ytd.available)return data?'<details class="share-enrichment-details"><summary>Returns &amp; credit</summary><p class="mp-muted">No matched historical return or credit data is available in this snapshot. The 2026 BOS YTD gain is unavailable. Daily prices and BOS valuations remain separate.</p></details>':error?'<details class="share-enrichment-details"><summary>Returns &amp; credit</summary><p class="mp-muted">The historical shares snapshot could not be loaded. Return and credit data are unavailable. The 2026 BOS YTD gain is unavailable.</p></details>':'';
 const points=returnsFor(item),grades=r?.credit.filter(c=>c.raw)||[],outlook=r?.creditOutlook?.value;
 const historyNote=r?`2019–2025: local-currency total returns with gross dividends reinvested. Completed calendar years are derived from the historical snapshot; its common endpoint ${E(label(data.returnCutoff))} is inferred from the supplied return pairs.`:'No matched historical return or credit data is available in this snapshot. Earlier calendar years remain unavailable.';
 const ytdNote=ytd.available?`2026 YTD · BOS: ${E(pct(ytd.value))} as of ${E(label(ytd.asOf))}; PDF ${E(label(ytd.reportDate))}${ytd.current?'':' · dated reference'}.`:'2026 YTD · BOS is unavailable for this listing. No frozen snapshot value is substituted.';
 return `<details class="share-enrichment-details"><summary>Returns &amp; credit</summary><p class="mp-muted">${historyNote}</p><p class="mp-muted">${ytdNote} BOS labels this figure “YTD Gains”; dividend and currency return methodology are not specified. It is not a verified total-return figure.</p><div class="share-enrichment-scroll" tabindex="0" role="region" aria-label="Historical total returns and BOS YTD gain"><table class="share-enrichment-returns"><caption>Historical total returns (2019–2025) &amp; BOS YTD gain (2026) · %</caption><thead><tr>${points.map(p=>`<th scope="col">${E(p.label)}</th>`).join('')}</tr></thead><tbody><tr>${points.map(p=>`<td class="${finite(p.value)?p.value>0?'return-positive':p.value<0?'return-negative':'return-flat':'return-missing'}" title="${E(p.periodType==='ytd_gain'?`${p.basis}${p.asOf?' · '+p.asOf:''}`:'Derived calendar-year total return')}">${E(pct(p.value))}</td>`).join('')}</tr></tbody></table></div><p class="mp-muted">Credit ratings below retain the source agency and scope. Rating observation dates were not supplied.</p>${grades.length?`<dl class="share-enrichment-credit">${grades.map(c=>`<div><dt>${E(c.agency)} · ${E(c.scope)}</dt><dd>${E(c.raw)}${c.status==='withdrawn'?' · withdrawn':c.status==='not_rated'?' · not rated':''}</dd></div>`).join('')}</dl>`:'<p>No credit rating is available in this historical snapshot.</p>'}${outlook?`<p class="mp-muted">S&amp;P outlook: ${E(outlook)}. Outlook is separate from the credit grade.</p>`:''}<p class="mp-muted">${r?`2019–2025 and credit source: supplied Bloomberg historical snapshot, row ${r.sourceRow}. `:''}2026 YTD gain source: Bank of Singapore. Daily prices and BOS valuations remain separate.</p></details>`;
}
function version(){return [data?.snapshotId||'unloaded',data?.sourceSha256||'',error,root.BOSEquity?.version?.()||'',root.MarketPrices?.version?.()||''].join('|');}
if(root.document?.addEventListener)for(const event of ['bos-equity-updated','market-prices-updated'])root.document.addEventListener(event,announce);
const api={load,records,metadata,find,returnsFor,ytdFor,detailHtml,marketCapFor,compareMarketCap,sortShares,priceItemFor,quoteFor,version,validate,status:()=>({loaded:!!data,error})};
root.ShareEnrichment=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
