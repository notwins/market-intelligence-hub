/* Future complete reports: one renderer, immutable editions, no browser storage. */
(function(root){
'use strict';
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID=/^[a-z][a-z0-9-]*-\d{4}-\d{2}-\d{2}(?:-r[1-9][0-9]*)?$/;
const HASH=/^[a-f0-9]{64}$/;
const CONTENT='https://notwins.github.io/market-intelligence-content/';
const destination=(r,path,prefix='')=>(r.delivery_base||prefix)+path;
function validate(f){
 if(!f||f.schema_version!==1||!Array.isArray(f.records)||f.generation!==f.records.length||!HASH.test(f.revision)||!f.tags)throw Error('Invalid research feed');
 const ids=new Set(),hashes=new Set();
 for(const r of f.records){
  if(!ID.test(r.id)||ids.has(r.id)||hashes.has(r.full_report_sha256)||r.kind!=='complete-report'||r.full_report_url!==`research/${r.id}/index.html`||!HASH.test(r.full_report_sha256))throw Error('Invalid report identity');
  if(r.delivery_base&&r.delivery_base!==CONTENT)throw Error('Unexpected delivery base');
  ids.add(r.id);hashes.add(r.full_report_sha256);
  for(const t of [r.cutoff_sgt,r.verified_at_sgt])if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+08:00$/.test(t)||!Number.isFinite(Date.parse(t)))throw Error('Missing exact date');
  for(const t of [r.title,r.summary,r.category])if(typeof t!=='string'||!t.trim()||t.length>1200)throw Error('Invalid metadata');
  if(!Array.isArray(r.tags)||!r.tags.length||!r.assets||r.assets['index.html']!==r.full_report_sha256)throw Error('Invalid manifest');
  for(const id of r.tags){const t=f.tags[id];if(!t||typeof t.label!=='string'||!['text','background','dark_text','dark_background'].every(k=>/^#[a-f0-9]{6}$/i.test(t[k])))throw Error('Unknown tag');}
  const b=r.quick_read;
  if(b&&(b.edition_id!==r.id||b.full_report_sha256!==r.full_report_sha256||!new RegExp('^research/'+r.id+'/[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*\\.(html|pdf)$').test(b.url)||b.url===r.full_report_url||r.assets[b.url.split('/').pop()]!==b.sha256||!HASH.test(b.sha256)))throw Error('Unmatched brief');
 }
 if(f.records.length&&f.verified_at_sgt!==f.records.map(r=>r.verified_at_sgt).sort().at(-1))throw Error('Incorrect verification date');
 return f;
}
function retain(previous,candidate){
 validate(candidate);
 if(previous)for(const old of previous.records){const now=candidate.records.find(r=>r.id===old.id);if(!now||JSON.stringify(now)!==JSON.stringify(old))throw Error('Existing edition removed or changed');}
 return candidate;
}
function selected(records,query,tags){const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);return records.filter(r=>terms.every(t=>[r.title,r.summary,r.category,r.cutoff_sgt,...r.tags.map(id=>tags[id].label)].join(' ').toLowerCase().includes(t)));}
function cards(records,tags,prefix=''){
 const colours=root.PublicationColour||(typeof module!=='undefined'?require('./publication-colour-core.js'):null);
 return records.map(r=>`<article class="mu-writeup" data-feed-report="${E(r.id)}"><p class="mu-eyebrow">Cutoff <time datetime="${E(r.cutoff_sgt)}">${E(r.cutoff_sgt.replace('T',' ').replace('+08:00',' SGT'))}</time> · ${E(r.category)}</p><h3>${E(r.title)}</h3><p>${E(r.summary)}</p><div class="mu-card-tags">${colours?colours.chips(r.tags,tags):r.tags.map(id=>E(tags[id].label)).join(' · ')}</div><div class="mu-card-actions"><a href="${E(destination(r,r.full_report_url,prefix))}">Read full report →</a>${r.quick_read?`<button type="button" class="mu-quick-read" data-feed-brief="${E(r.id)}" hidden>Quick read</button><a href="${E(destination(r,r.quick_read.url,prefix))}" target="_blank" rel="noopener">Open brief ↗</a>`:''}</div></article>`).join('');
}
function libraryEntries(f){return validate(f).records.map(r=>({id:r.id,title:r.title,href:destination(r,r.full_report_url),date:r.cutoff_sgt.slice(0,10),date_label:'Research cutoff (SGT)',state:'published',edition:'Verified full report',section:'Research',tags:r.tags,summary:r.summary,assets:Object.keys(r.assets).filter(x=>x!=='index.html').map(x=>destination(r,'research/'+r.id+'/'+x)),published_date:r.verified_at_sgt.slice(0,10),sha256:r.full_report_sha256}));}
const api={validate,retain,selected,cards,libraryEntries,destination};root.ResearchFeed=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
const host=document.getElementById('automated-research');if(!host)return;
const grid=host.querySelector('[data-feed-cards]'),status=host.querySelector('[data-feed-status]'),query=host.querySelector('input'),refresh=host.querySelector('[data-feed-refresh]');
const base=new URL('../',location.href);let current=null,failed=false,attempt=0,opener=null,preview=0;
const dialog=document.getElementById('feed-quick-read'),content=dialog.querySelector('[data-feed-content]'),direct=dialog.querySelector('[data-feed-direct]');
try{current=validate(root.MIH_RESEARCH_FEED);}catch{}
function render(){
 host.hidden=!current?.records.length&&!failed;
 if(!current){status.textContent='New editions could not be loaded. Existing reports remain below.';return;}
 grid.innerHTML=cards(selected(current.records,query.value,current.tags),current.tags,'../');
 status.textContent=(failed?'Refresh failed — retaining verified editions. ':'')+(current.records.length?`Verified ${current.verified_at_sgt.replace('T',' ').replace('+08:00',' SGT')}. ${grid.children.length} of ${current.records.length} new editions shown.`:'No new editions in this feed. Existing research remains below.');
 if(typeof dialog.showModal==='function')grid.querySelectorAll('[data-feed-brief]').forEach(b=>b.hidden=false);
}
async function reload(){const seq=++attempt;refresh.disabled=true;try{
 const response=await fetch(new URL('data/research-feed.json',base),{cache:'no-store'});if(!response.ok)throw Error('Feed unavailable');
 const local=validate(await response.json());
 const candidate=root.ContentDelivery?retain(current,await root.ContentDelivery.research(local)):retain(current,local);if(seq!==attempt)return;
 current=candidate;root.MIH_RESEARCH_FEED=current;failed=false;render();root.dispatchEvent(new CustomEvent('mih-research-feed-updated',{detail:current}));
}catch{if(seq===attempt){failed=true;render();}}finally{if(seq===attempt)refresh.disabled=false;}}
query.addEventListener('input',render);refresh.addEventListener('click',reload);
grid.addEventListener('click',async e=>{
 const button=e.target.closest('[data-feed-brief]');if(!button)return;const r=current.records.find(x=>x.id===button.dataset.feedBrief);if(!r?.quick_read)return;
 opener=button;const ticket=++preview;dialog.querySelector('h2').textContent=r.title+' · Quick read';direct.href=new URL(destination(r,r.quick_read.url),base).href;content.replaceChildren();content.textContent='Loading verified matching brief…';dialog.showModal();dialog.querySelector('button').focus();
 try{
  const response=await fetch(direct.href,{cache:'no-store'});if(!response.ok)throw Error('Brief unavailable');const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==r.quick_read.sha256)throw Error('Brief changed');
  if(ticket!==preview||!dialog.open)return;content.replaceChildren();
  if(r.quick_read.url.endsWith('.pdf')&&matchMedia('(max-width:620px)').matches){content.textContent='The matching PDF brief is verified. Open brief above to read it.';return;}
  const frame=document.createElement('iframe');frame.title=r.title+' matching brief';frame.setAttribute('sandbox','allow-same-origin');
  if(r.quick_read.url.endsWith('.html'))frame.srcdoc=new TextDecoder().decode(bytes);else frame.src=direct.href;
  frame.addEventListener('load',()=>{try{frame.contentDocument.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();dialog.close();}});}catch{}});content.append(frame);
 }catch{if(ticket===preview&&dialog.open)content.textContent='Preview unavailable. Open the matching brief directly using the link above.';}
});
dialog.querySelector('button').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(dialog.open)return;++preview;content.replaceChildren();opener?.focus();});
render();reload();
})(typeof window!=='undefined'?window:globalThis);
