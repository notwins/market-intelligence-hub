/* Independently deployed public content. Fixed same-origin path; no browser storage. */
(function(root){
'use strict';
const CONTENT='https://notwins.github.io/market-intelligence-content/',HUB='https://notwins.github.io/market-intelligence-hub/';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function researchAPI(){return root.ResearchFeed||(typeof module!=='undefined'?require('./research-feed.js'):null);}
function research(local,remote,previous){
 const R=researchAPI();R.validate(local);R.validate(remote);
 if(remote.records.some(r=>r.delivery_base))throw Error('Unexpected delivery origin');
 const ids=new Set(local.records.map(r=>r.id)),hashes=new Set(local.records.map(r=>r.full_report_sha256));
 if(remote.records.some(r=>ids.has(r.id)||hashes.has(r.full_report_sha256)))throw Error('Legacy report reissued');
 for(const [k,t] of Object.entries(remote.tags))if(local.tags[k]&&!equal(t,local.tags[k]))throw Error('Tag standard changed');
 const records=[...local.records,...remote.records.map(r=>({...r,delivery_base:CONTENT}))].sort((a,b)=>b.cutoff_sgt.localeCompare(a.cutoff_sgt)||b.id.localeCompare(a.id));
 return R.retain(previous,{schema_version:1,generation:records.length,revision:remote.revision,verified_at_sgt:records.map(r=>r.verified_at_sgt).sort().at(-1)||null,records,tags:{...local.tags,...remote.tags}});
}
function hourly(baseline,remote,previous){
 if(!remote||remote.schema_version!==1||!Array.isArray(remote.editions)||!remote.editions.length)throw Error('Invalid news feed');
 const rows=new Map();
 for(const e of remote.editions){
  if(!e||typeof e.id!=='string'||rows.has(e.id)||!Array.isArray(e.stories)||!Array.isArray(e.limitations)||!['partial','complete','unavailable'].includes(e.coverage)||![e.cutoff,e.report_at,e.window_start].every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))))throw Error('Invalid news edition');
  rows.set(e.id,e);
 }
 for(const prior of [baseline,previous])for(const e of prior?.editions||[])if(!equal(rows.get(e.id),e))throw Error('Verified news removed or changed');
 const ordered=[...remote.editions].sort((a,b)=>Date.parse(b.report_at)-Date.parse(a.report_at)||b.id.localeCompare(a.id));
 if(!equal(ordered,remote.editions))throw Error('Invalid news order');
 const complete=remote.editions.filter(e=>e.coverage==='complete').map(e=>e.cutoff).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)||null;
 if(remote.last_complete_cutoff!==complete)throw Error('False complete cutoff');
 return remote;
}
function search(local,remote){
 if(!remote||remote.schema_version!==1||!Array.isArray(remote.entries)||remote.entries.length>50000)throw Error('Invalid content catalogue');
 const key=e=>[e.kind,e.title,new URL(e.href,HUB).href,String(e.date).slice(0,10)].join('|'),known=new Set(local.map(key)),rows=[...local];
 for(const e of remote.entries){
  if(!e||!['Research edition','Hourly story'].includes(e.kind)||typeof e.title!=='string'||typeof e.text!=='string'||!Array.isArray(e.tags)||!e.tags.every(x=>typeof x==='string')||typeof e.href!=='string')throw Error('Invalid content search entry');
  const u=new URL(e.href);
  if(!((u.href.startsWith(CONTENT+'research/')&&/^https:\/\/notwins\.github\.io\/market-intelligence-content\/research\/[a-z0-9-]+\/index\.html$/.test(u.href))||u.href===HUB+'v4.html#hourly'))throw Error('Unexpected content destination');
  if(e.location?.href!==e.href)throw Error('Search destination mismatch');
  if(!known.has(key(e))){rows.push(e);known.add(key(e));}
 }
 return rows;
}
function registry(data,feed){
 const additions=researchAPI().validate(feed).records.map(r=>{
  const channel=r.id.startsWith('us-earnings-full-')?'earnings':r.id.startsWith('bond-credit-full-')?'credit':null;
  if(!channel)return null;
  const document=researchAPI().destination(r,r.full_report_url);
  return {id:r.id,title:r.title,href:document.replace(/index\.html$/,''),date:r.cutoff_sgt.slice(0,10),state:'published',edition:'Verified full report',full_edition:{channel,kind:'complete-source-edition',completeness_verified:true,cutoff:r.cutoff_sgt,document,sha256:r.full_report_sha256,verification:'original-document-completeness-reviewed'}};
 }).filter(Boolean);
 const entries=data?.entries||[];return {entries:[...entries,...additions.filter(r=>!entries.some(e=>e.id===r.id))]};
}
function client(fetcher=root.fetch?.bind(root)){
 let lastResearch=null,lastHourly=null,lastSearch=null;
 async function get(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const r=await fetcher(CONTENT+path,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Content unavailable');return await r.json();}finally{clearTimeout(timer);}}
 return {
  async research(local){lastResearch=research(local,await get('data/research-feed.json'),lastResearch);return lastResearch;},
  async hourly(local){try{lastHourly=hourly(local,await get('data/hourly-news.json'),lastHourly);return lastHourly;}catch{return {...(lastHourly||local),delivery_error:true};}},
  async search(local){try{const r=await get('data/site-search.json');const merged=search(local,r);lastSearch=r;return merged;}catch{return lastSearch?search(local,lastSearch):local;}}
 };
}
const api={CONTENT,HUB,mergeResearch:research,mergeHourly:hourly,mergeSearch:search,registry,client,...client()};root.ContentDelivery=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

