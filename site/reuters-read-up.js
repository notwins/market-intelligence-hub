/* Public reader only. Owner state and research execution stay outside the site. */
(function(root){'use strict';
const BASE='https://notwins.github.io/market-intelligence-content/',keys=['id','revision','kind','published_at','title','takeaway','happened','matters','watch','sources','primary','word_count'];
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
function fail(ok){if(!ok)throw Error('Invalid Reuters Read-Up content');}
function text(v,n){fail(typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[<>\x00-\x08]/.test(v));}
function link(v,reuters=false){fail(typeof v==='string'&&v.length<=3000&&!/[\s\\]/.test(v));const u=new URL(v);fail(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443'));if(reuters)fail(['www.reuters.com','reuters.com'].includes(u.hostname)&&u.pathname.split('/').filter(Boolean).length>=2);return u.href;}
function validate(index){
 fail(exact(index,['schema_version','entries'])&&index.schema_version===1&&Array.isArray(index.entries)&&index.entries.length<=10000);
 const ids=new Set();let previous=null;
 for(const r of index.entries){
  fail(exact(r,keys)&&/^read-up-[a-f0-9]{24}$/.test(r.id)&&!ids.has(r.id)&&r.kind==='reuters-read-up'&&Number.isInteger(r.revision)&&r.revision>0&&r.revision<=10000);ids.add(r.id);
  fail(typeof r.published_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/.test(r.published_at)&&Number.isFinite(Date.parse(r.published_at))&&Date.parse(r.published_at)<=Date.now());
  if(previous)fail(previous.published_at>r.published_at||(previous.published_at===r.published_at&&previous.id>r.id));previous=r;
  for(const [k,n] of [['title',180],['takeaway',500],['happened',10000],['matters',10000],['watch',10000]])text(r[k],n);
  fail(!/fictional|invented example|demo fixture/i.test(r.title+' '+r.takeaway));
  fail(Array.isArray(r.sources)&&r.sources.length>0&&r.sources.length<=12&&Array.isArray(r.primary)&&r.primary.length<=10);
  const refs=new Set(),urls=new Set(),used=new Set();
  for(const [list,prefix] of [[r.sources,'S'],[r.primary,'P']])list.forEach((s,i)=>{fail(exact(s,prefix==='S'?['id','title','original_url','accessed_url']:['id','title','url'])&&s.id===prefix+(i+1));text(s.title,500);refs.add(s.id);if(prefix==='S'){const u=link(s.original_url,true);fail(!urls.has(u));urls.add(u);link(s.accessed_url);}else link(s.url);});
  for(const k of ['happened','matters','watch'])for(const p of r[k].split('\n\n').filter(p=>p.trim())){const found=[...p.matchAll(/\[([SP]\d+)\]/g)].map(m=>m[1]);fail(found.length>0&&found.every(id=>refs.has(id)));found.forEach(id=>used.add(id));}
  fail(r.sources.every(s=>used.has(s.id))&&r.matters.startsWith('Our interpretation:')&&r.watch.startsWith('Our watch points:'));
  const words=keys.filter(k=>['title','takeaway','happened','matters','watch'].includes(k)).map(k=>r[k]).join(' ').match(/[\p{L}\p{N}_’'-]+/gu)?.length||0;
  fail(Number.isInteger(r.word_count)&&r.word_count===words&&words<=(r.sources.length===1?350:600));
 }
 return index;
}
function href(r){return BASE+'read-ups/'+r.id+'/r'+r.revision+'.html';}
function client(fetcher){let last=null,sequence=0;return {last:()=>last,async refresh(){const mine=++sequence,c=new AbortController(),timer=setTimeout(()=>c.abort(),10000);try{const response=await fetcher(BASE+'data/reuters-read-ups.json',{cache:'no-store',signal:c.signal});if(!response.ok)throw Error('Read-ups unavailable');const candidate=validate(await response.json());if(mine!==sequence)return {index:last,stale:true};if(last)for(const old of last.entries){const next=candidate.entries.find(r=>r.id===old.id);fail(next&&next.revision>=old.revision&&(next.revision!==old.revision||JSON.stringify(next)===JSON.stringify(old)));}last=candidate;return {index:last,stale:false};}finally{clearTimeout(timer);}}};}
function init(){const section=document.getElementById('reuters-read-up');if(!section)return;const cards=section.querySelector('[data-read-up-cards]'),status=section.querySelector('[data-read-up-status]'),button=section.querySelector('[data-read-up-refresh]'),service=client(root.fetch.bind(root));let serial=0;
 function draw(index){const nodes=index.entries.map(r=>{const card=document.createElement('article');card.className='mu-writeup';const date=document.createElement('p');date.className='mu-eyebrow';const time=document.createElement('time');time.dateTime=r.published_at;time.textContent=new Intl.DateTimeFormat('en-SG',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Singapore'}).format(new Date(r.published_at))+' SGT';date.append(time);const title=document.createElement('h3');title.textContent=r.title;const takeaway=document.createElement('p');takeaway.textContent=r.takeaway;const actions=document.createElement('div');actions.className='mu-card-actions';const a=document.createElement('a');a.href=href(r);a.textContent='Read full brief →';actions.append(a);card.append(date,title,takeaway,actions);return card;});cards.replaceChildren(...nodes);}
 async function refresh(){const mine=++serial;button.disabled=true;status.textContent='Loading published briefs…';try{const result=await service.refresh();if(mine!==serial||result.stale)return;draw(result.index);status.textContent=result.index.entries.length?`${result.index.entries.length} published brief${result.index.entries.length===1?'':'s'} · newest first.`:'No briefs have been published yet. Each finished brief will appear here after review.';}catch{if(mine===serial)status.textContent=service.last()?'Refresh unavailable. Previously verified briefs remain below.':'Published briefs are temporarily unavailable. Please try Refresh briefs.';}finally{if(mine===serial)button.disabled=false;}}
 button.addEventListener('click',refresh);refresh();
}
const api={validate,href,client};root.ReutersReadUp=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();}
})(typeof window!=='undefined'?window:globalThis);
