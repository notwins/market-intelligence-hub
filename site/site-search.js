(function(root){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safe(s){try{if(/^https:\/\//.test(s)){const u=new URL(s);return !u.username&&!u.password?s:null;}return /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.html(?:[?#].*)?$/.test(s)?s:null;}catch{return null;}}
function search(entries,q,kind){const terms=String(q).toLowerCase().trim().split(/\s+/).filter(Boolean);return entries.filter(e=>(!kind||e.kind===kind)&&terms.every(t=>(e.title+' '+e.text).toLowerCase().includes(t))).map(e=>({e,score:terms.reduce((s,t)=>s+(e.title.toLowerCase().includes(t)?5:1),0)})).sort((a,b)=>b.score-a.score||a.e.title.localeCompare(b.e.title)).map(x=>x.e);}
const api={search,safe,E};if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document)return;
let data=null,offset=0;const size=40,$=id=>document.getElementById(id);
function render(){
 const results=search(data.entries,$('q').value,$('kind').value),page=results.slice(offset,offset+size);
 $('status').textContent=results.length+' matches from '+data.entries.length+' indexed records. Showing '+(results.length?offset+1:0)+'–'+Math.min(offset+size,results.length)+'.';
 $('results').innerHTML=page.map(e=>{const href=safe(e.href),source=safe(e.source||'');return '<article class="result"><span class="badge">'+E(e.kind)+'</span><h2>'+(href?'<a href="'+E(href)+'"'+(href.startsWith('https:')?' target="_blank" rel="noopener noreferrer"':'')+'>'+E(e.title)+'</a>':E(e.title))+'</h2><p>'+E(e.text.slice(0,260))+(e.text.length>260?'…':'')+'</p><p class="meta"><strong>Observation / edition date:</strong> '+E(e.date||'Not supplied')+'<br>'+E(e.status)+'</p>'+(source&&source!==href?'<a href="'+E(source)+'" target="_blank" rel="noopener noreferrer">Source reference ↗</a>':'')+'</article>';}).join('')||'<p class="note">No matching saved text. Try fewer words or another content group. This is not evidence that the event did not occur.</p>';
 $('prev').disabled=offset===0;$('next').disabled=offset+size>=results.length;
 const u=new URL(location.href);$('q').value?u.searchParams.set('q',$('q').value):u.searchParams.delete('q');$('kind').value?u.searchParams.set('kind',$('kind').value):u.searchParams.delete('kind');history.replaceState({},'',u);
}
async function init(){try{const r=await fetch('data/site-search.json',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();if(!Array.isArray(data.entries))throw Error('Invalid catalogue');$('kind').innerHTML='<option value="">All groups</option>'+Object.keys(data.counts).map(k=>'<option value="'+E(k)+'">'+E(k)+' ('+data.counts[k]+')</option>').join('');const q=new URLSearchParams(location.search);$('q').value=q.get('q')||'';$('kind').value=q.get('kind')||'';$('limits').textContent=data.limits;$('built').textContent='Catalogue built: '+data.built_at+'. This is an indexing timestamp, not a market-data cutoff.';$('counts').innerHTML=Object.entries(data.counts).map(([k,v])=>'<span class="badge">'+E(k)+': '+v+'</span>').join('');for(const id of ['q','kind'])$(id).addEventListener(id==='q'?'input':'change',()=>{offset=0;render();});$('prev').onclick=()=>{offset=Math.max(0,offset-size);render();$('status').scrollIntoView({block:'nearest'});};$('next').onclick=()=>{offset+=size;render();$('status').scrollIntoView({block:'nearest'});};render();}catch(e){$('status').textContent='Search catalogue unavailable. Open V4 or the tag map using the links above. '+e.message;}}
init();
})(typeof window!=='undefined'?window:globalThis);
