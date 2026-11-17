/* Shared company facts. Saved Excel fields never participate in quote/return calculations. */
(function(root){'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>typeof v==='string'&&v.trim()&&!v.startsWith('#'),finite=v=>typeof v==='number'&&Number.isFinite(v),norm=v=>String(v||'').trim().replace(/\s+Equity$/i,'').replace(/\s+/g,' ').toUpperCase();
let data=null,pending=null,error='',aliases=new Map(),byId=new Map();
function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
function validate(v){
 if(v?.schemaVersion!==1||v.sourceId!=='excel-shares-static'||!/^[a-f0-9]{64}$/.test(v.sourceSha256)||!/^\d{4}-\d{2}-\d{2}$/.test(v.importedOn)||v.asOf!==null||!Array.isArray(v.records)||v.records.length>10000||v.validation?.accepted!==v.records.length)throw Error('Invalid company profile snapshot.');
 const ids=new Set(),names=new Set();
 for(const r of v.records){if(!text(r.id)||r.id!==r.bbTicker||ids.has(r.id)||!text(r.exchangeMic)||!text(r.currency)||!Number.isInteger(r.sourceRow)||r.sourceRow<2||!Array.isArray(r.aliases)||!r.aliases.includes(r.id)||!['Stock','ETF'].includes(r.instrumentType))throw Error('Invalid company listing identity.');ids.add(r.id);
  for(const a of r.aliases){if(!text(a)||names.has(norm(a)))throw Error('Ambiguous company profile alias.');names.add(norm(a));}
  for(const k of ['employees','sharesOutstanding','yearIncorporated'])if(r[k]!==null&&(!finite(r[k])||r[k]<0||!Number.isInteger(r[k])))throw Error('Invalid company static metric.');
  for(const k of ['name','description','industry','headquarters'])if(r[k]!==null&&(!text(r[k])||r[k].length>10000))throw Error('Invalid company text.');
  if(r.cachedFinancials?.asOf!==null||r.cachedFinancials?.marketCapCurrency!==null)throw Error('Workbook financial dates and market-cap currency must remain unconfirmed.');
 }
 return v;
}
function announce(){if(root.document?.dispatchEvent&&root.CustomEvent)root.document.dispatchEvent(new root.CustomEvent('share-static-updated'));}
async function load(force=false){if(data&&!force)return data;if(pending)return pending;
 pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await root.fetch('data/share-static.json',{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('Company profile snapshot unavailable.');const next=freeze(validate(await response.json()));const a=new Map(),b=new Map();for(const r of next.records){b.set(r.id,r);for(const name of r.aliases)a.set(norm(name),r);}data=next;aliases=a;byId=b;error='';return data;}catch(e){error=e.message;return data;}finally{clearTimeout(timer);pending=null;announce();}})();return pending;}
function find(item){
 if(!data||!item)return null;
 if(typeof item==='object'&&(/conflict|unresolved/i.test(item.identityStatus||'')||item.asset_type&&item.asset_type!=='equity'||item.instrumentType&&!['equity','Stock','ETF'].includes(item.instrumentType)))return null;
 const values=typeof item==='string'?[item]:[item.bbTicker,item.instrumentId,item.ticker,item.symbol,item.id,...(Array.isArray(item.aliases)?item.aliases:[])].filter(Boolean);
 const candidates=new Map();for(const value of values){const r=aliases.get(norm(value));if(r)candidates.set(r.id,r);}
 // Reviewed mappings may bridge exchange-specific public symbols. They never
 // transfer an ADR profile to the issuer's local listing or another currency.
 for(const m of root.BOSEquity?.reviewedListings||[]){if(m.verified===true&&values.includes(m.ticker)&&(!item.currency||item.currency===m.currency)){const r=byId.get(m.instrumentId);if(r)candidates.set(r.id,r);}}
 if(candidates.size!==1)return null;const r=[...candidates.values()][0];
 if(typeof item==='object'){
  if(item.currency&&item.currency!==r.currency)return null;
  if(item.bbTicker&&norm(item.bbTicker)!==norm(r.bbTicker))return null;
  if(item.isin){const known=(root.ShareEnrichment?.records?.()||[]).filter(x=>x.isin===item.isin);if(known.length&&known.some(x=>x.bbTicker!==r.bbTicker))return null;}
 }
 return r;
}
function enrich(item){const r=find(item);if(!r||!item||typeof item!=='object')return item;const out={...item};for(const k of ['name','description','industry','employees','headquarters','sharesOutstanding','yearIncorporated','exchange'])if((out[k]===null||out[k]===undefined||out[k]==='')&&r[k]!==null)out[k]=r[k];return {...out,staticProfile:r};}
function summary(item,max=280){const r=typeof item==='object'&&item.sourceRow?item:find(item),description=r?.description||'';if(description.length<=max)return description;const sentences=description.split(/(?<=[.!?])\s+(?=[A-Z])/);let out='';for(const sentence of sentences){if((out+' '+sentence).trim().length>max)break;out=(out+' '+sentence).trim();}return out||description.slice(0,max-1).replace(/\s+\S*$/,'')+'…';}
function metadata(){if(!data)return null;const {records,...meta}=data;return meta;}
function html(item,options={}){const r=find(item);if(!r)return '';const fmt=n=>finite(n)?n.toLocaleString('en-US'):'Not supplied';
 const fields=[['Exchange',r.exchange],['Industry',r.industry],['Employees',fmt(r.employees)],['Incorporated',r.yearIncorporated===null?'Not supplied':String(r.yearIncorporated)],['Headquarters',r.headquarters],['Company shares outstanding',fmt(r.sharesOutstanding)]];
 return `<details class="share-static-profile" data-static-profile="${E(r.id)}"><summary>Company profile &amp; static data</summary>${options.description===false?'':`<p class="share-static-description">${E(r.description||'Company description not supplied.')}</p>`}<dl>${fields.map(([k,v])=>`<div><dt>${E(k)}</dt><dd>${E(v||'Not supplied')}</dd></div>`).join('')}</dl><p class="share-static-source">Excel stock-data snapshot · imported ${E(data.importedOn)} · observation dates not supplied. Matched ${E(r.bbTicker)} / ${E(r.exchangeMic)}. Company shares outstanding may differ from ADR or listed-class units.</p><details class="share-static-source"><summary>Workbook source details</summary><p>${E(data.sourceFile)} · ${E(data.sourceSheet)} · row ${r.sourceRow}. ${E(data.provider)}.</p><p>Saved workbook price: ${fmt(r.cachedFinancials.price)} ${E(r.cachedFinancials.priceCurrency)}. Saved market cap: ${fmt(r.cachedFinancials.marketCap)}; currency unconfirmed. These undated workbook figures do not replace current prices or valuations.</p></details></details>`;
}
const api={load,find,enrich,summary,html,metadata,records:()=>data?data.records.slice():[],validate,version:()=>data?.sourceSha256||error||'unloaded',status:()=>({loaded:!!data,error,count:data?.records.length||0})};root.ShareStaticData=api;if(typeof module!=='undefined')module.exports=api;
if(root.document){const start=()=>load();if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
})(typeof window!=='undefined'?window:globalThis);
