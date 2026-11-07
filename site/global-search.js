/* Typeahead over the existing public catalogue. No queries or local saved lists leave the browser. */
(function(root){
'use strict';
const Q=typeof module!=='undefined'&&module.exports?require('./search-query.js'):root.MarketSearchQuery;
const M=typeof module!=='undefined'&&module.exports?require('./search-metadata.js'):root.SearchMetadata;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[‐‑–−]/g,'-').replace(/\s+/g,' ').trim();
const tokens=s=>norm(s).match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu)||[];
function safe(href){
 try{
  if(typeof href!=='string'||!href||/[\\\x00-\x20]/.test(href))return null;
  if(/^https:\/\//.test(href)){const u=new URL(href);if(u.username||u.password||(['chatgpt.com','chat.openai.com'].includes(u.hostname)&&/^\/(?:c|g)(?:\/|$)/.test(decodeURIComponent(u.pathname))))return null;return href;}
  const path=href.split(/[?#]/)[0];
  if(!path||path.split('/').some(p=>p==='.'||p==='..'))return null;
  return /^(?:[a-zA-Z0-9_-]+\/)*(?:[a-zA-Z0-9_.-]+\.html)?(?:[?#].*)?$/.test(href)?href:null;
 }catch{return null;}
}
const types={Section:['▦','Main section'],Subsection:['↳','Subsection'],Headline:['⌁','News headline'],'Hourly story':['◷','Hourly story'],'Hourly edition':['◷','Hourly edition'],Report:['▤','Saved report'],'Research edition':['▤','Research edition'],'Research library':['▧','Research paper'],'White Papers & Research Papers':['▧','Research paper'],'Watchlist research':['▤','Company report'],'Public diary':['✎','Historical review'],'External research PDF':['▧','External research PDF'],'Learning chapter':['◇','Learning chapter'],'Security master':['▦','Security record'],'Stock directory':['◈','Share reference'],'Bond directory':['◒','Bond reference'],'UST reference':['◒','Treasury reference'],'Historical series':['↗','Historical series'],'Tag catalogue':['#','Tag reference'],Page:['▱','Saved page']};
function type(entry){return types[entry.kind]||['▱',entry.kind||'Saved content'];}
function prepare(entries){return entries.filter(e=>e&&safe(e.href)).map(e=>{const title=norm(e.title),kind=norm(type(e)[1]),tags=(e.tags||[]).map(norm).join(' ');return{entry:e,title,words:tokens(title+' '+kind+' '+tags),body:tokens(e.text)};});}
function suggest(prepared,query,limit=14){
 const words=tokens(query).slice(0,12),canonical=Q?.canonical(String(query).trim()),terms=canonical&&norm(canonical)!==norm(query)?tokens(canonical):words;
 const prefix=(hay,needles)=>needles.every(w=>hay.some(t=>t.startsWith(w)));
 const scored=[];
 for(const row of prepared){
  const top=prefix(row.words,words)||prefix(row.words,terms),body=top||prefix(row.body,words)||prefix(row.body,terms);
  if(!body)continue;
  const entry=row.entry,level=entry.kind==='Section'?0:entry.kind==='Subsection'?1:2;
  const score=(norm(query)&&row.title.startsWith(norm(query))?30:0)+(top?10:0);
  scored.push({entry,level,score});
 }
 scored.sort((a,b)=>a.level-b.level||b.score-a.score||String(b.entry.date||'').localeCompare(String(a.entry.date||''))||String(a.entry.title).localeCompare(String(b.entry.title)));
 // Reserve room for saved papers/pages even when many navigation rows match.
 const chosen=[],counts=[0,0,0];for(const x of scored){const max=words.length?[4,3,10][x.level]:[12,2,0][x.level];if(counts[x.level]>=max)continue;chosen.push(x.entry);counts[x.level]++;if(chosen.length>=limit)break;}
 return {entries:chosen,total:scored.length};
}
const hex=s=>typeof s==='string'&&/^#[0-9a-f]{6}$/i.test(s);
function validStandard(data){return data?.version==='V1.2 Merged'&&Array.isArray(data.tags)&&data.tags.every(t=>t&&typeof t.label==='string'&&typeof t.id==='string'&&Array.isArray(t.aliases)&&t.aliases.every(a=>typeof a==='string')&&[t.text,t.background,t.dark_text,t.dark_background].every(hex));}
function mappedTag(entry,standard){
 if(!validStandard(standard))return null;
 const explicit=(entry.tags||[]).map(norm),title=String(entry.title||''),titleWords=' '+norm(title).replace(/[^\p{L}\p{N}$:./-]+/gu,' ')+' ';
 const matches=[];
 for(const t of standard.tags){
  for(const alias of t.aliases){
   if(typeof alias!=='string'||!alias.trim())continue;const key=norm(alias);
   const exact=explicit.includes(key);
   // Status is never inferred. Short aliases and tickers need explicit tags or qualification.
   const short=key.length<4||/^[A-Z0-9.-]{1,6}$/.test(alias),qualified=/[$:]/.test(alias);
   const present=!String(t.id).startsWith('status.')&&(!short||qualified)&&titleWords.includes(' '+key.replace(/[^\p{L}\p{N}$:./-]+/gu,' ')+' ');
   if(exact||present)matches.push({tag:t,span:key.length,priority:Number(t.priority)||0});
  }
 }
 matches.sort((a,b)=>b.span-a.span||b.priority-a.priority||a.tag.id.localeCompare(b.tag.id));return matches[0]?.tag||null;
}
function rowHTML(entry,index,standard){
 const [icon,label]=type(entry),tag=mappedTag(entry,standard),section=entry.kind==='Section',subsection=entry.kind==='Subsection',href=safe(entry.href),external=href?.startsWith('https:');
 if(!href)return '';
 const style=tag&&!section?' style="--gs-row-bg:'+tag.background+';--gs-row-ink:'+tag.text+';--gs-row-edge:'+tag.text+'"':'';
 const location=entry.location?.label,description=[label,external?'External ↗':'',tag?'Colour tag: '+tag.label:''].filter(Boolean).join(' · ');
 return '<li id="global-search-option-'+index+'" role="option" aria-selected="false" class="gs-result'+(section?' gs-section':subsection?' gs-subsection':' gs-content')+'"'+style+'><a tabindex="-1" href="'+E(href)+'"'+(external?' target="_blank" rel="noopener noreferrer"':'')+'><span class="gs-icon" aria-hidden="true">'+icon+'</span><span class="gs-copy"><strong>'+E(entry.title)+'</strong><span class="gs-meta">'+E(description)+'</span>'+(!section&&!subsection?'<span class="gs-date">'+E(M.dateLabel(entry))+': '+M.sourceDate(entry)+'</span>':'')+((Q.record(entry).tags||[]).length?'<span class="search-tags" aria-label="Tags">'+M.tagsHTML(Q.record(entry).tags,standard)+'</span>':'')+(location&&location!==entry.title?'<span class="gs-location">'+E(location)+'</span>':'')+'</span><span class="gs-arrow" aria-hidden="true">'+(external?'↗':'→')+'</span></a></li>';
}
const api={safe,norm,tokens,type,prepare,suggest,validStandard,mappedTag,rowHTML};if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
function init(){
 const button=document.getElementById('global-search-button');if(!button)return;
 const panel=document.createElement('dialog');panel.id='global-search-panel';panel.className='gs-panel';panel.setAttribute('aria-labelledby','global-search-title');panel.setAttribute('data-no-ticker-links','');
 panel.innerHTML='<div class="gs-heading"><h2 id="global-search-title">Search Market Intel</h2><button type="button" class="gs-close" aria-label="Close search">×</button></div><label class="sr-only" for="global-search-input">Search sections, research papers and saved content</label><input id="global-search-input" type="search" placeholder="Search sections, papers, companies…" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="global-search-list" aria-describedby="global-search-help"><p id="global-search-help" class="gs-help">Dark rows: main sections · ↳: subsections · light rows: saved content. Use ↑ ↓ and Enter.</p><p id="global-search-status" class="gs-status" role="status" aria-live="polite"></p><ul id="global-search-list" class="gs-list" role="listbox" aria-label="Search suggestions"></ul><footer class="gs-footer"><a id="global-search-all" href="search.html">Open full search &amp; filters →</a><small>Icons identify content types. Unmapped rows stay neutral.</small></footer>';
 document.body.append(panel);

 const input=panel.querySelector('input'),list=panel.querySelector('.gs-list'),status=panel.querySelector('.gs-status'),all=panel.querySelector('#global-search-all');
 let prepared=null,standard=null,loading=null,active=-1,timer;
 function resetActive(){active=-1;input.removeAttribute('aria-activedescendant');for(const option of list.children)option.setAttribute('aria-selected','false');}
 function select(index){const options=[...list.children];if(!options.length)return;active=(index+options.length)%options.length;for(const [i,option] of options.entries())option.setAttribute('aria-selected',String(i===active));input.setAttribute('aria-activedescendant',options[active].id);options[active].scrollIntoView({block:'nearest'});}
 function render(){
  resetActive();all.href='search.html'+(input.value.trim()?'?q='+encodeURIComponent(input.value.trim()):'');
  if(!prepared)return;
  const found=suggest(prepared,input.value);list.innerHTML=found.entries.map((e,i)=>rowHTML(e,i,standard)).join('');
  status.textContent=found.total?(input.value.trim()?found.total+' matches · '+found.entries.length+' suggestions.':'Choose a section or start typing.')+(standard?'':' Tag colours unavailable; labels and destinations remain usable.'):'No matching saved content. Try another word or open the full search.';
 }
 function navigation(){
  const seen=new Set();return [...document.querySelectorAll('.rail [data-view],#more [data-view],#more a[href],.research-shortcuts a[href]')].flatMap((node,i)=>{const labelNode=node.cloneNode(true);labelNode.querySelectorAll('.nav-level,.nav-icon').forEach(n=>n.remove());const route=node.dataset.view,href=route?'v4.html#'+route:node.getAttribute('href'),title=(labelNode.querySelector('strong')?.textContent||labelNode.textContent).replace(/[◫◈▤◷⌁▣◉✎◎↗⇄◒▦▥☆☷✓◇▱↻→]/gu,'').replace(/\s+/g,' ').trim();if(!safe(href)||seen.has(href)||!title)return[];seen.add(href);return [{id:'nav-'+i,kind:route?.includes('/')?'Subsection':'Section',title,href,text:title,tags:[],status:'Navigation',location:{label:route?.startsWith('history/')?'V4 → History':route?.startsWith('master/')?'V4 → Security master':'V4 navigation',href,exact:true}}];});
 }
 async function load(){
  if(prepared){render();return;}if(loading)return loading;
  status.textContent='Loading the public search catalogue…';list.innerHTML='';
  loading=(async()=>{try{
   const [catalogue,colours]=await Promise.all([fetch('data/site-search.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Catalogue unavailable');const d=await r.json();if(!Array.isArray(d.entries))throw Error('Invalid catalogue');return d.entries;}),fetch('data/search-colour-standard.json').then(r=>r.ok?r.json():null).catch(()=>null)]);
   standard=validStandard(colours)?colours:null;
   const entries=[...catalogue],targets=new Set(entries.filter(e=>['Section','Subsection'].includes(e.kind)).map(e=>e.href));for(const entry of navigation())if(!targets.has(entry.href)){entries.push(entry);targets.add(entry.href);}
   prepared=prepare(entries);render();
  }catch{status.textContent='The search catalogue could not load. Open full search or close and reopen to try again.';}finally{loading=null;}})();return loading;
 }
 function open(){if(panel.open){input.focus();return;}panel.showModal();button.setAttribute('aria-expanded','true');input.focus();load();}
 button.addEventListener('click',open);panel.querySelector('.gs-close').addEventListener('click',()=>panel.close());
 panel.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');resetActive();button.focus({preventScroll:true});});
 panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();}else if(event.target.closest('a'))panel.close();});
 input.addEventListener('input',()=>{clearTimeout(timer);resetActive();timer=setTimeout(()=>{timer=null;render();},90);});
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();panel.close();}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();clearTimeout(timer);if(timer){render();timer=null;}select(active<0?(event.key==='ArrowDown'?0:list.children.length-1):active+(event.key==='ArrowDown'?1:-1));}
  else if(event.key==='Enter'){event.preventDefault();if(timer){clearTimeout(timer);timer=null;render();}if(active>=0)list.children[active]?.querySelector('a').click();else all.click();}
 });
 document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&!document.querySelector('dialog[open]')&&!event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();open();}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
