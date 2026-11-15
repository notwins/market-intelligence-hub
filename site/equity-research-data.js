/* Selected valuation evidence and existing earnings actuals; no new price service. */
(function(root){'use strict';
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const METRICS=['price','fair_value_or_target','pe','pb','dividend_yield_pct','roe_pct','eps_growth_pct','market_cap_usd_bn'];
const PATHS={valuation:'data/equity-valuation-history.json',earnings:'data/earnings-history.json'};
const retained={valuation:null,earnings:null},failures={valuation:'',earnings:''};
let pending=null;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function validDate(value){return typeof value==='string'&&DATE.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
function valuationData(data){return data?.valuation??(data?.kind==='selected_equity_valuation_history'?data:null);}
function earningsData(data){return data?.earnings??(Array.isArray(data?.companies)?data:null);}
function matchesContext(input,expected,ticker){
 if(typeof input==='string')return true;
 if(!input||typeof input!=='object')return false;
 const registered=root.MarketPrices?.resolve?.(ticker),currency=expected?.currency||registered?.currency;
 if(input.currency&&input.currency!==currency)return false;
 if(input.asset_type&&input.asset_type!=='equity')return false;
 if(input.id&&(!registered?.id||input.id!==registered.id))return false;
 if(input.isin&&(!registered?.isin||input.isin!==registered.isin))return false;
 return true;
}
function listingFor(symbol,data){const value=valuationData(data),ticker=typeof symbol==='string'?symbol:symbol?.ticker||symbol?.symbol,item=value?.listings?.find(item=>item.symbol===ticker);return item&&matchesContext(symbol,item,ticker)?item:null;}
function sourceNumber(text){if(typeof text!=='string'||text.length>64)throw Error('Valuation source precision is missing.');const value=text.trim();if(['','NA','N/A','N.M.','NM','-','—'].includes(value.toUpperCase()))return null;const normalized=(/^\(.*\)$/.test(value)?'-'+value.slice(1,-1):value).replace(/,/g,'');if(!/^-?\d+(?:\.\d+)?$/.test(normalized))throw Error('Valuation source number is invalid.');return Number(normalized);}
function safeSource(source){try{const url=new URL(source?.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
function validateValuation(data){
 if(data?.schema_version!==1||data.kind!=='selected_equity_valuation_history'||!Array.isArray(data.listings)||!Array.isArray(data.observations)||!data.sources||data.coverage?.complete!==false||data.methodology?.percentiles_available!==false)throw Error('Unsupported valuation evidence format.');
 const listings=new Map(),seen=new Set();
 for(const item of data.listings){if(!item.symbol||!item.source_ticker||!item.currency||listings.has(item.symbol))throw Error('Valuation listing identities need review.');listings.set(item.symbol,item);}
 for(const row of data.observations){const item=listings.get(row.symbol),source=data.sources[row.source_id],key=row.symbol+'|'+row.report_date;
  if(!item||row.currency!==item.currency||row.source_ticker!==item.source_ticker||!source||source.report_date!==row.report_date||!validDate(row.report_date)||!validDate(row.price_date)||row.price_date>row.report_date||seen.has(key))throw Error('Valuation dates or exact listings failed validation.');
  if(row.metric_basis!=='consensus_forward_estimates'||row.forecast_horizon!=='unspecified'||row.price_basis!=='source_snapshot_unadjusted'||!Number.isInteger(row.source_page)||row.source_page<1||!Number.isInteger(row.source_row)||row.source_row<1)throw Error('Valuation source basis is missing.');
  for(const metric of METRICS){if(row[metric]!==null&&!finite(row[metric]))throw Error('Valuation has an invalid numeric observation.');if(sourceNumber(row.source_values?.[metric])!==row[metric])throw Error('Valuation source value does not reconcile.');}
  if(row.price!==null&&row.price<=0)throw Error('Valuation has a nonpositive source price.');
  seen.add(key);
 }
 if(data.coverage.observation_count!==data.observations.length||data.coverage.listing_count!==data.listings.length||data.coverage.edition_count!==Object.keys(data.sources).length)throw Error('Valuation coverage counts do not reconcile.');
 for(const item of data.listings)if(item.observation_count!==data.observations.filter(row=>row.symbol===item.symbol).length)throw Error('Listing coverage count does not reconcile.');
 return data;
}
function validateEarnings(data){
 if(data?.schema_version!==1||!Array.isArray(data.companies)||!data.sources)throw Error('Unsupported earnings history format.');
 const seen=new Set();
 for(const company of data.companies){if(!company.ticker||seen.has(company.ticker)||!Array.isArray(company.history))throw Error('Earnings identities need review.');seen.add(company.ticker);
  for(const row of company.history){if(!row.period||!data.sources[row.source]||!safeSource(data.sources[row.source]))throw Error('Earnings source is missing.');
   for(const field of ['report_date','period_end'])if(row[field]!=null&&!validDate(row[field]))throw Error('Earnings date failed validation.');
   if(row.report_date&&row.period_end&&row.report_date<row.period_end)throw Error('Earnings publication precedes the fiscal period end.');
   for(const field of ['revenue_usd_bn','eps','net_income_usd_bn','ordinary_eps_ntd'])if(row[field]!=null&&!finite(row[field]))throw Error('Earnings has an invalid numeric observation.');
  }
 }
 if(data.fcf){if(!Array.isArray(data.fcf.rows)||data.fcf.unit!=='US$bn'||typeof data.fcf.method!=='string')throw Error('Cash-flow observations failed validation.');
  const cashSeen=new Set();
  for(const row of data.fcf.rows){const key=row.ticker+'|'+row.period;
   if(!seen.has(row.ticker)||!row.period||!validDate(row.period_end)||!safeSource(data.sources[row.source])||!row.definition||!row.basis||cashSeen.has(key))throw Error('Cash-flow period, definition or source is missing.');
   if(!['operating_cash_flow_usd_bn','capex_usd_bn','other_adjustment_usd_bn','fcf_usd_bn'].every(field=>finite(row[field])))throw Error('Cash-flow numeric observation is invalid.');
   if(Math.abs(row.operating_cash_flow_usd_bn-row.capex_usd_bn+row.other_adjustment_usd_bn-row.fcf_usd_bn)>=1e-8)throw Error('Cash-flow reconciliation failed.');
   cashSeen.add(key);
  }
 }
 return data;
}
function statusFor(kind){const data=retained[kind],error=failures[kind];return {state:data?'partial':'unavailable',refresh_failed:!!error,message:error?(data?'Refresh failed; previously loaded dated observations are retained.':'Data could not be loaded. Retry is available.'):(kind==='valuation'?data?.coverage.label:data?.coverage)||'Data has not loaded.',error};}
function snapshot(){return {valuation:retained.valuation,earnings:retained.earnings,status:{valuation:statusFor('valuation'),earnings:statusFor('earnings')},errors:Object.entries(failures).filter(([,error])=>error).map(([dataset,error])=>({dataset,error}))};}
async function read(kind){
 const controller=root.AbortController?new root.AbortController():null;
 const timer=controller&&root.setTimeout?root.setTimeout(()=>controller.abort(),12000):null;
 try{if(typeof root.fetch!=='function')throw Error('Data loading is unavailable.');const response=await root.fetch(PATHS[kind],{cache:'no-cache',...(controller?{signal:controller.signal}:{})});if(!response.ok)throw Error('The '+kind+' file is unavailable.');const data=await response.json();(kind==='valuation'?validateValuation:validateEarnings)(data);retained[kind]=freeze(data);failures[kind]='';}
 catch(error){failures[kind]=error?.name==='AbortError'?'The data request timed out.':String(error?.message||'The data request failed.');}
 finally{if(timer!==null&&root.clearTimeout)root.clearTimeout(timer);}
}
async function load(options={}){
 if(pending)return pending;
 const force=options===true||options?.force===true;
 if(!force&&retained.valuation&&retained.earnings&&!failures.valuation&&!failures.earnings)return snapshot();
 pending=(async()=>{try{await Promise.all([read('valuation'),read('earnings')]);return snapshot();}finally{pending=null;}})();
 return pending;
}
function valuationSeries(symbol,data,options={}){
 const dataset=valuationData(data),listing=listingFor(symbol,data),name=typeof symbol==='string'?symbol:symbol?.ticker||symbol?.symbol||'';
 if(!dataset||!listing)return {symbol:name,listing:null,observations:[],coverage:dataset?.coverage||null,status:'unavailable',percentile:null,reason:dataset?'This exact listing is outside the six-share evidence sample.':'Valuation observations are unavailable.'};
 const from=validDate(options.from)?options.from:'0000-01-01',to=validDate(options.to)?options.to:'9999-12-31';
 const observations=dataset.observations.filter(row=>row.symbol===listing.symbol&&row.currency===listing.currency&&row.report_date>=from&&row.report_date<=to).slice().sort((a,b)=>a.report_date.localeCompare(b.report_date)).map(row=>({...row,source:dataset.sources[row.source_id]}));
 return {symbol:listing.symbol,listing,observations,coverage:dataset.coverage,status:observations.length?'partial':'unavailable',percentile:null,reason:observations.length?dataset.coverage.label:'No supplied edition falls within this report-date range.'};
}
function observedRange(symbol,data,metric,options={}){
 const series=valuationSeries(symbol,data,options),supported=['pe','pb','dividend_yield_pct','roe_pct','eps_growth_pct'].includes(metric);
 const values=supported?series.observations.filter(row=>finite(row[metric])&&(!['pe','pb'].includes(metric)||row[metric]>0)):[];
 const latest=series.observations[series.observations.length-1],latestValid=values.includes(latest);
 return {metric,count:values.length,excluded_count:series.observations.length-values.length,min:values.length?Math.min(...values.map(row=>row[metric])):null,max:values.length?Math.max(...values.map(row=>row[metric])):null,latest:latestValid?latest[metric]:null,latest_date:latest?.report_date??null,percentile:null,reason:!supported?'This metric is not supported for valuation ranges.':values.length?'Only the supplied observations are compared; no percentile or trading signal is calculated.':'No meaningful supplied observations for this metric.',basis:'Selected supplied editions; not a continuous historical valuation range'};
}
function earningsCompany(ticker,dataset){
 const direct=dataset?.companies?.find(item=>item.ticker===ticker);if(direct)return direct;
 const registered=root.MarketPrices?.resolve?.(ticker);
 if(!registered?.id||registered.asset_type!=='equity'||!Array.isArray(registered.aliases))return null;
 const matches=(dataset?.companies||[]).filter(item=>registered.aliases.includes(item.ticker)&&root.MarketPrices.resolve(item.ticker)?.id===registered.id);
 return matches.length===1?matches[0]:null;
}
function earningsFor(symbol,data){
 const dataset=earningsData(data),ticker=typeof symbol==='string'?symbol:symbol?.ticker||symbol?.symbol||'',expected=valuationData(data)?.listings?.find(item=>item.symbol===ticker),company=matchesContext(symbol,expected,ticker)?earningsCompany(ticker,dataset):null;
 if(!company)return {symbol:ticker,company:null,observations:[],events:[],cashflows:[],cashflow_note:'No cash-flow observation for this exact listing.',coverage:dataset?.coverage||'',status:'unavailable',reason:dataset?'Reported earnings for this exact listing have not been indexed here.':'Earnings data is unavailable.'};
 const observations=company.history.map(row=>({...row,eps_basis:row.eps_basis||company.eps_basis||'EPS basis not supplied',source_details:dataset.sources[row.source]||null}));
 // A later release's publication date never becomes an earlier comparative's event date.
 const events=observations.filter(row=>validDate(row.report_date)).map(row=>({ticker,date:row.report_date,label:row.period,period_end:row.period_end??null,source:row.source_details,timing:'date_only'})).sort((a,b)=>a.date.localeCompare(b.date));
 const cashflows=(dataset.fcf?.rows||[]).filter(row=>row.ticker===company.ticker).map(row=>({...row,source_details:dataset.sources[row.source]||null,unit:dataset.fcf.unit||'Unit not supplied',method:dataset.fcf.method||''}));
 const cashflow_note=dataset.fcf?.gaps?.find(row=>row.ticker===company.ticker)?.reason||(!cashflows.length?'Cash-flow observations have not been indexed for this listing.':'Selected cash-flow observations; definitions and periods are retained.');
 return {symbol:ticker,company,observations,events,cashflows,cashflow_note,coverage:company.coverage||dataset.coverage,status:'partial',reason:'Selected reported observations and later-release comparatives. Missing publication dates remain unavailable.'};
}
const api={load,status:()=>snapshot().status,listingFor,valuationSeries,observedRange,earningsFor,validateValuation,validateEarnings,validDate};
root.EquityResearchData=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
