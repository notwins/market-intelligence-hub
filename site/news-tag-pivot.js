/* Display-only, unique-story tag intersections. No story expansion or source mutation. */
(function(root){
 'use strict';
 const MISSING='\u0000untagged',ALL='\u0000all',groups={country:'Country / region',person:'Political figures',bank:'Central banks / institutions',asset:'Asset classes / instruments',sector:'Sectors / themes',ticker:'Companies / tickers',macro:'Macro data / indicators',event:'Events / catalysts',status:'Editorial status'};
 const categories=new Map(Object.entries(groups).map(([k,v])=>[v,k]));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let vocabulary=[],byId=new Map(),tagCache=new WeakMap(),identityCache=new Map(),loaded=false,loadError='';
 const normal=s=>String(s??'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/[–—]/g,'-').replace(/\s+/g,' ').replace(/\b([A-Z]{3})[-/]([A-Z]{3})\b/g,'$1/$2').trim();
 const label=v=>v===MISSING?'Not tagged':byId.get(v)?.keyword_group||v;
 const literal=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function setStandard(data){
  if(!Array.isArray(data?.keyword_groups))throw Error('Canonical tag reference unavailable');
  vocabulary=data.keyword_groups.filter(t=>categories.has(t.category)&&typeof t.id==='string'&&/^[a-z0-9_.-]+$/i.test(t.id)&&Array.isArray(t.aliases)&&['text_light','text_dark','chip_bg_light','chip_bg_dark'].every(k=>/^#[0-9a-f]{6}$/i.test(t[k]||''))).map(t=>({...t,group:categories.get(t.category)}));
  if(!vocabulary.length)throw Error('Canonical tag reference has no valid mappings');byId=new Map(vocabulary.map(t=>[t.id,t]));tagCache=new WeakMap();identityCache=new Map();loaded=true;loadError='';
 }
 function canonicalTags(item){
  if(tagCache.has(item))return tagCache.get(item);if(!loaded)return[];const signature=JSON.stringify([identity(item),item.title||item.headline,item.category||item.topic,item.tickers,item.status,item.freshness,item.version]);if(identityCache.has(signature)){const cached=identityCache.get(signature);tagCache.set(item,cached);return cached;}
  const title=normal(item.title||item.headline||''),context=title+' '+normal(item.category||item.topic||''),finance=/^(?:Markets|Earnings|Fixed income|Elections)$/i.test(String(item.category||''))||/\b(?:markets?|stocks?|shares?|equities|bonds?|treasur(?:y|ies)|yield|rates?|earnings|bank|economy|economic|inflation|policy|finance|credit|dollar|currency|trade|invest|revenue|profit|elections?|government|tech|chips?|AI|company|companies|gold|silver|oil|forex|FX|commodities|GDP|PMI|CPI|PPI|payrolls|employment|unemployment|exports|imports|manufacturing|spending)\b/i.test(context);
  const politics=/\b(?:president|minister|election|congress|policy|administration|government|tariffs?|parliament|politic|senate|chancellor|white house)\b/i.test(context);
  const saved=(Array.isArray(item.tickers)?item.tickers:[]).flatMap(t=>[normal(t).replace(/^(?:NASDAQ|NYSE|XNAS|XNYS):\s*/,'').replace(/^\$/,''),root.MorningstarLinks?.resolve(t)?.ticker]).filter(Boolean),explicit=(root.MorningstarLinks?.matches(title)||[]).map(m=>m.record.ticker),resolved=new Set([...saved,...explicit]);
  const hits=[],metadata=[];
  for(const t of vocabulary){
   if(t.matching_rule==='status'){
    const status={new:'status.new','follow-up':'status.follow_up',correction:'status.correction','catch-up':'status.catch_up',breaking:'status.breaking'};
    if([status[item.status],status[item.freshness]].includes(t.id))metadata.push(t);continue;
   }
   const aliases=t._aliases||(t._aliases=t.aliases.map(normal).filter(Boolean));
   if(t.matching_rule==='ticker'&&aliases.some(a=>resolved.has(a.replace(/^\$/,''))))metadata.push(t);
   for(const alias of aliases){
    const short=/^[A-Za-z.]{1,6}$/.test(alias)&&alias.replace(/\./g,'').length<=3,capital=/^[A-Z0-9.-]{1,6}$/.test(alias),explicitTicker=/^(?:\$|(?:NASDAQ|NYSE|XNAS|XNYS):)/.test(alias);
    if(t.matching_rule==='ticker'&&capital&&!resolved.has(alias)&&!(/^(?:UOB|DBS|OCBC|HSBC|PIMCO|TSMC|IBM)$/.test(alias)&&finance)&&!(/^(?:SPY|QQQ)$/.test(alias)&&/\b(?:ETF|fund|shares?|stocks?|S&P|Nasdaq)\b/i.test(title)))continue;
    if(t.matching_rule==='ticker'&&!explicitTicker&&!capital&&(!finance||alias.length<4))continue;
    if(t.matching_rule==='ticker'&&/^(?:Apple|Amazon|Alphabet|Meta|Shell|Visa|Target|Oracle|Sea)$/i.test(alias)&&!metadata.some(m=>m.id===t.id)&&!/(?:\b(?:shares?|stocks?|earnings|revenue|profits?|tech|AI|cloud|CEO|company|antitrust|lawsuit|iPhone|search|ads)\b)/i.test(title))continue;
    if(['geo','institution','sector','macro','asset','event'].includes(t.matching_rule)&&short&&!finance)continue;
    if(t.matching_rule==='geo'&&/^[A-Z]{2}$/.test(alias)&&!['US','UK','EU'].includes(alias))continue;
    if(t.matching_rule==='geo'&&/^latam$/i.test(alias)&&!/\bLATAM (?:economies|region|markets|currencies|inflation|bonds|growth)\b/.test(title))continue;
    if(alias.toLowerCase()==='default'&&!/\b(?:default(?:s|ed|ing)? (?:on|of|by|risk|rate|notice|event|loom|threat|wave)|(?:bond|debt|loan|sovereign|issuer|credit|payment) defaults?)\b/i.test(title))continue;
    if(alias.toLowerCase()==='cloud'&&!/\b(?:cloud (?:computing|services?|business|infrastructure|revenue|unit|platform|providers?|sales|growth|demand|storage)|(?:Google|Amazon|Microsoft|Oracle) Cloud|AWS|Azure|data cent(?:er|re))\b/i.test(title))continue;
    if(t.matching_rule==='institution'&&short&&!/\b(?:central bank|rates?|monetary|inflation|policy|economy|economic|currenc(?:y|ies)|dollar|bonds?|yields?|bank)\b/i.test(context))continue;
    if(t.matching_rule==='person'&&!alias.includes(' ')&&!politics)continue;
    const sensitive=capital||t.matching_rule==='institution'&&short||short&&alias!==alias.toLowerCase()&&alias===alias.toUpperCase()||t.matching_rule==='person'&&!alias.includes(' ');
    const patterns=t._patterns||(t._patterns=new Map());let re=patterns.get(alias);if(!re){re=new RegExp('(?<![\\p{L}\\p{N}_])'+literal(alias)+'(?![\\p{L}\\p{N}_])',sensitive?'gu':'giu');patterns.set(alias,re);}
    for(const match of title.matchAll(re)){
     const before=title.slice(Math.max(0,match.index-12),match.index),after=title.slice(match.index+match[0].length);
     if(t.matching_rule==='geo'&&/^(?:US|U\.S\.?|USA)$/.test(alias)&&(/^[\s]*\$|^\s+dollars?\b/i.test(after)||/\$$/.test(before)))continue;
     if(t.id==='geo.south_korea'&&alias.toLowerCase()==='korea'&&/North\s+$/i.test(before))continue;
     if(t.matching_rule==='person'&&alias.toLowerCase()==='trump'&&/^ (?:Media|Organization)\b/i.test(after))continue;
     hits.push({start:match.index,end:match.index+match[0].length,tag:t});
    }
   }
  }
  hits.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||(b.tag.priority||0)-(a.tag.priority||0)||a.start-b.start);const accepted=[];
  for(const hit of hits){if(hit.tag.matching_rule==='geo'&&hits.some(a=>a.tag.matching_rule==='ticker'&&a.start<=hit.start&&a.end>=hit.end&&(a.end-a.start)>(hit.end-hit.start)))continue;if(!accepted.some(a=>a.tag.group===hit.tag.group&&hit.start<a.end&&hit.end>a.start))accepted.push(hit);}
  const result=[...new Map([...metadata,...accepted.map(h=>h.tag)].map(t=>[t.id,t])).values()];tagCache.set(item,result);identityCache.set(signature,result);if(identityCache.size>3000)identityCache.delete(identityCache.keys().next().value);return result;
 }
 function identity(item){return item.story_id?'story:'+item.story_id:item.id?'id:'+item.id:item.url?'url:'+item.url:'record:'+String(item.published_at||'')+'|'+String(item.title||item.headline||'');}
 function unique(items){const seen=new Set();return(items||[]).filter(item=>{const id=identity(item);if(seen.has(id))return false;seen.add(id);return true;});}
 function members(item,group){const values=[...new Set(canonicalTags(item).filter(t=>t.group===group).map(t=>t.id))];return values.length?values:[MISSING];}
 function matches(item,filters){return Object.entries(filters).every(([g,v])=>!v||members(item,g).includes(v));}
 function model(items,y,x,filters={}){
  const rows=unique(items).filter(item=>matches(item,filters)),ys=new Set(),xs=new Set(),cells=new Map(),yt=new Map(),xt=new Map();
  for(const item of rows){const a=members(item,y),b=x?members(item,x):[ALL];a.forEach(v=>{ys.add(v);yt.set(v,(yt.get(v)||0)+1);});b.forEach(v=>{xs.add(v);xt.set(v,(xt.get(v)||0)+1);});for(const v of a)for(const w of b){const key=JSON.stringify([v,w]);cells.set(key,(cells.get(key)||0)+1);}}
  const order=(a,b)=>a===MISSING?1:b===MISSING?-1:a.localeCompare(b,undefined,{numeric:true});
  return{rows,y:[...ys].sort(order),x:[...xs].sort(order),cells,yt,xt,total:rows.length};
 }
 const states=new Map();let onChange=()=>{};
 function state(key){if(!states.has(key))states.set(key,{filters:{},undo:[],y:'country',x:'asset',open:!!root.matchMedia?.('(min-width:900px)').matches});return states.get(key);}
 function current(key){return state(key).filters;}
 function capture(key,filters=current(key)){const s=state(key);s.undo.push({filters:{...filters},y:s.y,x:s.x});if(s.undo.length>30)s.undo.shift();}
 function apply(key,filters,{record=true}={}){if(record)capture(key);state(key).filters={...filters};onChange(key);}
 function filtered(items,key){return unique(items).filter(item=>matches(item,current(key)));}
 function chip(value,group){const t=byId.get(value),style=t?' style="--ntp-text:'+t.text_light+';--ntp-dark:'+t.text_dark+';--ntp-bg:'+t.chip_bg_light+';--ntp-bg-dark:'+t.chip_bg_dark+'"':'';return '<span class="ntp-tag"'+style+'>'+esc(value===ALL?'Articles':label(value))+'</span>';}
 function cell(key,value,yValue,xValue,y,x,original){return value?'<button type="button" data-ntp-cell data-ntp-context="'+esc(key)+'" data-y="'+esc(yValue===MISSING?'__untagged__':yValue??'')+'" data-x="'+esc(xValue===MISSING?'__untagged__':xValue??'')+'" data-y-group="'+y+'" data-x-group="'+(x||'')+'" data-original="'+original+'" aria-label="'+esc((yValue===undefined?'All '+groups[y]:label(yValue))+', '+(xValue===undefined?'all columns':x?label(xValue):'records')+': '+value+' unique articles')+'">'+value+'</button>':'';}
 function table(key,items,y,x,filters={},original=false){
  const m=model(items,y,x,filters);return'<div class="ntp-scroll" tabindex="0" role="region" aria-label="News tag grouping table; scroll horizontally"><table data-table-controls="off"><caption>'+esc(groups[y])+' × '+esc(x?groups[x]:'Unique articles')+'</caption><thead><tr><th scope="col">'+esc(groups[y])+'</th>'+m.x.map(v=>'<th scope="col">'+chip(v,x)+'</th>').join('')+'<th scope="col">Unique total</th></tr></thead><tbody>'+m.y.map(a=>'<tr><th scope="row">'+chip(a,y)+'</th>'+m.x.map(b=>'<td>'+cell(key,m.cells.get(JSON.stringify([a,b]))||0,a,b===ALL?undefined:b,y,x,original)+'</td>').join('')+'<td class="ntp-total">'+cell(key,m.yt.get(a),a,undefined,y,x,original)+'</td></tr>').join('')+'</tbody><tfoot><tr><th scope="row">Unique total</th>'+m.x.map(b=>'<td>'+cell(key,m.xt.get(b),undefined,b===ALL?undefined:b,y,x,original)+'</td>').join('')+'<td>'+cell(key,m.total,undefined,undefined,y,x,original)+'</td></tr></tfoot></table></div>';
 }
 function view(key,items){
  if(!loaded)return '<section class="ntp-root" aria-label="News tag pivot"><p role="status">'+esc(loadError||'Loading canonical news tags…')+'</p></section>';
  const s=state(key),filters=current(key),active=Object.entries(filters).filter(([,v])=>v),source=unique(items);s.items=source;
  const opts=value=>Object.entries(groups).map(([g,l])=>'<option value="'+g+'" '+(g===value?'selected':'')+'>'+l+'</option>').join('');
  return'<section class="ntp-root" data-ntp-root="'+esc(key)+'" aria-label="News tag pivot"><details '+(s.open?'open':'')+'><summary>▦ Explore news by tags <span>'+filtered(source,key).length+' / '+source.length+' unique articles'+(active.length?' · '+active.length+' tag filters':'')+'</span></summary><div class="ntp-body"><p class="ntp-note">Pick a count to filter the articles below. Articles can have several tags; totals count unique articles, not the sum of cells.</p><div class="ntp-groups"><label>Rows (Y)<select data-ntp-y>'+opts(s.y)+'</select></label><label>Columns (X)<select data-ntp-x><option value="" '+(!s.x?'selected':'')+'>Article count</option>'+opts(s.x)+'</select></label><button type="button" data-ntp-swap>Swap</button><button type="button" data-ntp-apply>Apply groups</button><button type="button" data-ntp-undo '+(!s.undo.length?'disabled':'')+'>Undo</button><button type="button" data-ntp-reset>Reset tags</button></div><nav class="ntp-crumbs" aria-label="Selected article tags"><span>All articles</span>'+active.map(([g,v])=>'<button type="button" data-ntp-remove="'+g+'">'+esc(groups[g]+': ')+chip(v,g)+' <span aria-hidden="true">×</span></button>').join('')+'</nav>'+table(key,source,s.y,s.x,filters)+'<p class="ntp-note" role="status">'+model(source,s.y,s.x,filters).total+' unique articles match these tags. Text search, topic and status filters remain in effect. “Not tagged” means no matching saved/headline tag was identified.</p></div></details></section>';
 }
 function connect(callback){onChange=callback;if(!root.document)return;
  root.fetch?.('data/keyword-colour-standard.json').then(r=>{if(!r.ok)throw Error('Canonical tag reference could not load');return r.json();}).then(data=>{setStandard(data);onChange();}).catch(()=>{loadError='News tag reference is unavailable. Existing search and headline filters still work.';onChange();});
  root.document.addEventListener('toggle',event=>{const panel=event.target.closest?.('[data-ntp-root]');if(panel&&event.target.parentElement===panel&&panel.isConnected)state(panel.dataset.ntpRoot).open=event.target.open;},true);
  root.document.addEventListener('click',event=>{const panel=event.target.closest('[data-ntp-root]');if(!panel)return;const key=panel.dataset.ntpRoot,s=state(key),button=event.target.closest('button');if(!button)return;
   if(button.hasAttribute('data-ntp-cell')){const next={...current(key)};if(button.dataset.y)next[button.dataset.yGroup]=button.dataset.y==='__untagged__'?MISSING:button.dataset.y;if(button.dataset.x&&button.dataset.xGroup)next[button.dataset.xGroup]=button.dataset.x==='__untagged__'?MISSING:button.dataset.x;apply(key,next);}
   else if(button.hasAttribute('data-ntp-remove')){const next={...current(key)};delete next[button.dataset.ntpRemove];apply(key,next);}
   else if(button.hasAttribute('data-ntp-reset')){apply(key,{});}
   else if(button.hasAttribute('data-ntp-undo')){const previous=s.undo.pop();if(previous){s.y=previous.y;s.x=previous.x;apply(key,previous.filters,{record:false});}}
   else if(button.hasAttribute('data-ntp-swap')){const y=panel.querySelector('[data-ntp-y]'),x=panel.querySelector('[data-ntp-x]');if(x.value){const old=y.value;y.value=x.value;x.value=old;}return;}
   else if(button.hasAttribute('data-ntp-apply')){capture(key);s.y=panel.querySelector('[data-ntp-y]').value;s.x=panel.querySelector('[data-ntp-x]').value;if(s.y===s.x)s.x='';onChange(key);}
   else return;
   const scope=root.document.querySelector('[data-ntp-root="'+key+'"]');const target=scope?.querySelector('[data-ntp-undo]:not(:disabled)')||scope?.querySelector('[data-ntp-reset]')||scope?.querySelector('summary');target?.focus({preventScroll:true});
  });
 }
 const api={MISSING,groups,identity,unique,canonicalTags,members,matches,model,filtered,view,connect,capture,setStandard};root.NewsTagPivot=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
