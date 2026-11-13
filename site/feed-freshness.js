/* Saved-source freshness. No browser-load timestamp is represented as a source update. */
(function(root){
'use strict';
const M=typeof module!=='undefined'&&module.exports?require('./search-metadata.js'):root.SearchMetadata;
const feeds=[
 {id:'headlines',label:'Reuters headlines',href:'#headlines',file:'data/news.json',field:'generated_at',basis:'Updated at',views:['overview','headlines','credit'],statusFile:'data/status.json',statusField:'status',checkedField:'last_attempt',ok:'ok'},
 {id:'hourly',label:'Hourly reports',href:'#hourly',file:'data/hourly-news.json',field:'editions.0.report_at',basis:'Report updated at',views:['overview','hourly']},
 {id:'watchlist',label:'Shares watchlist',href:'#watchlist',file:'data/watchlist/latest.json',field:'generated_at',basis:'Prepared at',views:['overview','watchlist'],statusFile:'data/watchlist/status.json',statusField:'state',checkedField:'checked_at',ok:'scheduled_publication_verified',successLabel:'Publication verified'},
 {id:'history',label:'Fed FX & yields',href:'#history',file:'data/history-fed.json',field:'retrieved_at',basis:'Retrieved at',views:['overview','history','ust'],statusFile:'data/history-fed-status.json',statusField:'status',checkedField:'last_attempt',ok:'success'},
 {id:'earnings',label:'Earnings history',href:'#earnings',file:'data/earnings-history.json',field:'verified_at',basis:'Verified at',views:['overview','earnings']}
];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=(data,path)=>path.split('.').reduce((x,k)=>x?.[k],data);
function healthInfo(feed,health){
 if(!feed.statusFile)return null;
 const raw=health?.[feed.statusField],state=typeof raw==='string'?raw.trim().toLowerCase():'';
 let result=state===feed.ok?'ok':['failed','failure','error'].includes(state)?'failed':state==='partial'?'partial':'unknown';
 // A verified publication does not establish complete research coverage.
 const partialCoverage=result==='ok'&&health?.coverage?.news_access==='partial';
 if(partialCoverage)result='partial';
 const success=feed.successLabel||'Latest check succeeded';
 return {state:result,label:partialCoverage?success+'; reporting coverage partial':{ok:success,failed:'Latest check failed',partial:'Latest check has partial coverage',unknown:'Latest check status unknown'}[result]};
}
function row(feed,data,error=false,health=null){
 const raw=value(data,feed.field),has=!error&&M.dateInfo(raw).precision!=='unknown',info=healthInfo(feed,health);
 const checked=health?.[feed.checkedField],hasCheck=M.dateInfo(checked).precision!=='unknown';
 const healthHTML=info?' · '+E(info.label)+' · Checked at: '+(hasCheck?M.dateHTML(checked):'Date not supplied'):'';
 return '<div class="feed-freshness-item" data-feed="'+feed.id+'"'+(!has?' data-unavailable="true"':'')+(info?' data-health="'+info.state+'"':'')+'><a href="'+feed.href+'">'+E(feed.label)+'</a><span>'+E(feed.basis)+': '+(error?'Unavailable':has?M.dateHTML(raw):'Date not supplied')+healthHTML+'</span></div>';
}
const api={feeds,value,row,healthInfo};if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
let saved=new Map(),current='overview',lastFetch=0,pending=null;
function paint(){const slot=document.getElementById('feed-freshness');if(!slot)return;const shown=feeds.filter(f=>current==='feeds'||f.views.includes(current));slot.hidden=!shown.length;slot.innerHTML=shown.length?'<p>Saved feed timestamps · Singapore time. Preparation, retrieval and verification are labelled separately from source publication or observation dates. Checked at describes the saved check, not a new observation.</p><div class="feed-freshness-list">'+shown.map(f=>saved.has(f.id)?row(f,...saved.get(f.id)):'<div class="feed-freshness-item"><a href="'+f.href+'">'+E(f.label)+'</a><span>Loading saved timestamp…</span></div>').join('')+'</div>':'';}
async function json(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error('Unavailable');return r.json();}
async function load(){if(pending||Date.now()-lastFetch<300000)return pending;pending=Promise.all(feeds.map(async f=>{try{const [d,h]=await Promise.all([json(f.file),f.statusFile?json(f.statusFile).catch(()=>null):null]);saved.set(f.id,[d,false,h]);}catch{saved.set(f.id,[null,true,null]);}paint();})).finally(()=>{lastFetch=Date.now();pending=null;});return pending;}
root.FeedFreshness={mount(view){current=view;paint();load();}};
})(typeof window!=='undefined'?window:globalThis);
