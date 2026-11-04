(function(root){
'use strict';
const Q=typeof module!=='undefined'&&module.exports?require('./search-query.js'):root.MarketSearchQuery;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safe(s){try{if(typeof s!=='string'||/[\\\x00-\x20]/.test(s))return null;if(/^https:\/\//.test(s)){const u=new URL(s);if(['chatgpt.com','chat.openai.com'].includes(u.hostname)&&/^\/(?:c|g)(?:\/|$)/.test(decodeURIComponent(u.pathname)))return null;return !u.username&&!u.password?s:null;}const path=s.split(/[?#]/)[0];if(path.split('/').some(p=>p==='.'||p==='..'))return null;return /^(?:[a-zA-Z0-9_-]+\/)*(?:[a-zA-Z0-9_.-]+\.html)?(?:[?#].*)?$/.test(s)&&path?s:null;}catch{return null;}}
const api={search:Q.search,safe,E};if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
let data=null,offset=0,results=[],size=40,timer;const $=id=>document.getElementById(id);
function link(href,label){const u=safe(href);return u?'<a href="'+E(u)+'"'+(u.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':'')+'>'+E(label)+'</a>':E(label);}
function snippet(entry){const text=String(entry.text||'');let at=-1;for(const term of Q.parse($('q').value).terms){const pos=text.toLowerCase().indexOf(term.value.toLowerCase());if(pos>=0&&(at<0||pos<at))at=pos;}const start=Math.max(0,at-80);return (start?'…':'')+text.slice(start,start+300)+(text.length>start+300?'…':'');}
function companyHub(){
 const tree=Q.parse($('q').value).tree, names={Google:'GOOGL',Microsoft:'MSFT',Amazon:'AMZN',Nvidia:'NVDA',Apple:'AAPL',Meta:'META',Tesla:'TSLA','Berkshire Hathaway':'BRK.B',AMD:'AMD',Broadcom:'AVGO',Micron:'MU',TSMC:'TSM'};
 const name=tree?.type==='term'&&tree.field!=='text'?Q.canonical(tree.value):null,ticker=names[name],slot=$('company-hub');
 if(!slot)return;
 if($('search-intro'))$('search-intro').hidden=!!ticker;
 if(!ticker){slot.innerHTML='';return;}
 const source=data.entries.find(e=>e.kind==='Stock directory'&&e.title.startsWith(ticker+' · '));
 const all=Q.search(data.entries,name),news=all.filter(e=>['Headline','Hourly story'].includes(e.kind)).length,reports=all.filter(e=>Q.isArticle(e)&&!['Headline','Hourly story'].includes(e.kind)).length;
 const bos=root.BOSResources?.sources?.find(x=>x.kind==='equities');
 slot.innerHTML='<div class="hub-header"><span class="hub-monogram">'+E(name.slice(0,1))+'</span><div><span class="eyebrow">Company research hub · saved records</span><h1>'+E(name==='Google'?'Google / Alphabet':name)+'</h1><p>'+E(ticker)+' · News, research and past editions in one place.</p></div></div><div class="hub-stats"><span><b>'+all.length+'</b> saved records</span><span><b>'+news+'</b> news items</span><span><b>'+reports+'</b> reports &amp; references</span></div><div class="hub-links">'+(bos?'<a class="resource-button" href="'+E(safe(bos.url))+'" target="_blank" rel="noopener noreferrer">BOS equity research PDF <span>External ↗ · '+E(bos.edition)+'</span></a>':'')+(source?'<a class="resource-button secondary" href="'+E(safe(source.source))+'" target="_blank" rel="noopener noreferrer">Morningstar quote / chart <span>External ↗ · '+E(ticker)+'</span></a>':'')+'</div><p class="hub-note">BOS is a dated coverage-universe PDF, not a company-specific report. External access may be required.</p>';
}
function error(message){$('query-error').textContent=message;$('q').setAttribute('aria-invalid','true');$('results').innerHTML='';$('status').textContent='Fix the rule above to search. No results are being shown.';$('prev').disabled=$('next').disabled=true;}
function render(){
 try{results=Q.search(data.entries,$('q').value,$('kind').value,$('scope').value);}catch(e){error(e.message);return;}
 if($('sort').value==='newest')results.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
 $('query-error').textContent='';$('q').removeAttribute('aria-invalid');companyHub();offset=Math.min(offset,Math.max(0,Math.floor((results.length-1)/size)*size));
 const page=results.slice(offset,offset+size);
 $('status').textContent=results.length+' matches from '+data.entries.length+' indexed records. Showing '+(results.length?offset+1:0)+'–'+Math.min(offset+size,results.length)+'.'+(results.length>size?' Use Next to see every match.':'');
 $('results').innerHTML=page.map(e=>{const tags=Q.record(e).tags,location=e.location||{label:e.kind,href:e.href};return '<article class="result"><span class="badge">'+E(e.kind)+'</span><h2>'+link(e.href,e.title)+(safe(e.href)?.startsWith('https:')?'<span class="external-label">External ↗</span>':'')+'</h2><p class="result-location"><strong>Located in:</strong> '+E(location.label)+(safe(location.href)?' · '+link(location.href,'Open '+(location.exact?'saved page':'section')):'')+'</p>'+(tags.length?'<div class="result-tags" aria-label="Add a tag to your rule">'+tags.slice(0,16).map(t=>'<button class="tag-button" type="button" data-tag="'+E(t)+'" title="Add '+E(t)+' using the selected AND / OR rule">'+E(t)+'</button>').join('')+(tags.length>16?'<span class="meta">+'+(tags.length-16)+' more indexed tags</span>':'')+'</div>':'')+'<p>'+E(snippet(e))+'</p>'+(e.text.length>300?'<details class="saved-text"><summary>Read the full saved text</summary><p>'+E(e.text)+'</p></details>':'')+'<p class="meta"><strong>Observation / edition date:</strong> '+E(e.date||'Not supplied')+'<br>'+E(e.status)+'</p>'+(e.source_access==='restricted'?'<p class="meta">Source access restricted · not linked</p>':safe(e.source)&&e.source!==e.href?link(e.source,'External source reference ↗'):'')+'</article>';}).join('')||'<p class="note">No matching saved text or tags. Try OR, fewer terms, or All content. Private reports and external article bodies are not indexed. This is not evidence that an event did not occur.</p>';
 $('prev').disabled=offset===0;$('next').disabled=offset+size>=results.length;
 const u=new URL(location.href);for(const id of ['q','kind','scope','sort']){const value=$(id).value;if(value&&!((id==='scope'&&value==='all')||(id==='sort'&&value==='newest')))u.searchParams.set(id,value);else u.searchParams.delete(id);}history.replaceState({},'',u);
}
function addTag(tag){try{Q.parse($('q').value);}catch(e){error('Fix the current rule before adding a tag. '+e.message);$('q').focus();return;}$('q').value=Q.appendTag($('q').value,tag,$('join').value);offset=0;render();}
function fromURL(){const q=new URLSearchParams(location.search);$('q').value=q.get('q')||'';$('kind').value=q.get('kind')||'';$('scope').value=q.get('scope')==='articles'?'articles':'all';$('sort').value=q.get('sort')==='relevance'?'relevance':'newest';}
async function init(){try{
 const r=await fetch('data/site-search.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();if(!Array.isArray(data.entries))throw Error('Invalid catalogue');
 $('kind').innerHTML='<option value="">All groups</option>'+Object.keys(data.counts).map(k=>'<option value="'+E(k)+'">'+E(k)+' ('+data.counts[k]+')</option>').join('');
 const tags=[...new Set(data.entries.flatMap(e=>Q.record(e).tags))].sort((a,b)=>a.localeCompare(b));$('tag-options').innerHTML=tags.map(t=>'<option value="'+E(t)+'"></option>').join('');
 fromURL();$('limits').textContent=data.limits;$('built').textContent='Catalogue built: '+data.built_at+'. This is an indexing timestamp, not a market-data cutoff.';$('counts').innerHTML=Object.entries(data.counts).map(([k,v])=>'<span class="badge">'+E(k)+': '+v+'</span>').join('');
 $('q').addEventListener('input',()=>{offset=0;clearTimeout(timer);timer=setTimeout(render,120);});for(const id of ['kind','scope','sort'])$(id).addEventListener('change',()=>{offset=0;render();});
 $('search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);offset=0;render();});
 $('add-tag').onclick=()=>{const tag=$('tag-value').value.trim();if(!tag)return;if(!tags.some(t=>t.toLowerCase()===Q.canonical(tag).toLowerCase())){$('tag-help').textContent='Choose one of the saved tags, or enter this as a text rule above.';return;}$('tag-help').textContent='';addTag(tag);$('tag-value').value='';};
 $('tag-value').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('add-tag').onclick();}});
 $('clear').onclick=()=>{$('q').value='';$('kind').value='';$('scope').value='all';$('sort').value='newest';offset=0;render();$('q').focus();};
 document.addEventListener('click',e=>{const tag=e.target.closest('[data-tag]'),example=e.target.closest('[data-query]');if(tag)addTag(tag.dataset.tag);if(example){$('q').value=example.dataset.query;offset=0;render();}});
 $('prev').onclick=()=>{offset=Math.max(0,offset-size);render();$('status').scrollIntoView({block:'nearest'});};$('next').onclick=()=>{offset+=size;render();$('status').scrollIntoView({block:'nearest'});};
 root.addEventListener('popstate',()=>{fromURL();offset=0;render();});render();
}catch(e){$('status').textContent='Search catalogue unavailable. Open V4 or the tag map using the links above. '+e.message;}}
init();
})(typeof window!=='undefined'?window:globalThis);
