/* A collation of saved public material, never a private-chat or live-wire reader. */
(function (root) {
  'use strict';
  const HOUR = 3600000, PAGE_SIZE = 8;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups = {all:'All sources',research:'Research & documents',automation:'GPT / automation',reuters:'Reuters articles'};
  const dayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'});
  function dayParts(now) {return Object.fromEntries(dayFormatter.formatToParts(new Date(now)).filter(x=>['year','month','day'].includes(x.type)).map(x=>[x.type,Number(x.value)]));}
  function bounds(now=Date.now()) {
    const p=dayParts(now), start=Date.UTC(p.year,p.month-1,p.day-2)-8*HOUR;
    return {start,end:Date.UTC(p.year,p.month-1,p.day+1)-8*HOUR,now};
  }
  function inWindow(entry,now=Date.now()) {const at=Date.parse(entry.at),b=bounds(now);return Number.isFinite(at)&&at>=b.start&&at<b.end&&at<=now;}
  function select(data,{now=Date.now(),filter='all',query=''}={}) {
    const needle=query.trim().toLocaleLowerCase();
    return (data?.entries||[]).filter(x=>inWindow(x,now)&&(filter==='all'||x.category===filter)&&(!needle||[x.title,x.source,x.kind,x.format].join(' ').toLocaleLowerCase().includes(needle))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
  }
  function safeHref(value) {
    if(typeof value!=='string'||/[\x00-\x20\\]/.test(value))return '#';
    try {const u=new URL(value,'https://notwins.github.io/market-intelligence-hub/');if(u.protocol!=='https:'||u.username||u.password||['chatgpt.com','chat.openai.com'].includes(u.hostname))return '#';if(!/^[a-z][a-z0-9+.-]*:/i.test(value)&&(value.startsWith('/')||value.startsWith('//')||value.split('/').includes('..')))return '#';return escape(value);}catch{return '#';}
  }
  const stamp=value=>new Date(value).toLocaleString('en-SG',{timeZone:'Asia/Singapore',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' SGT';
  const day=value=>new Date(value).toLocaleDateString('en-SG',{timeZone:'Asia/Singapore',weekday:'short',day:'numeric',month:'short',year:'numeric'});
  let data=null,pending=null,error=false,fetchedAt=0,state={filter:'all',query:'',limit:PAGE_SIZE};
  function shell(){return `<section class="section publications card" id="publication-timeline" aria-labelledby="publication-title"><div class="publication-heading"><div><div class="eyebrow">Your publishing timeline</div><h2 id="publication-title">Published in the last 3 days</h2><p>Research, documents, scheduled reports and Reuters articles. Newest first, in Singapore time.</p></div><a class="button ghost" href="search.html">Search the full archive ↗</a></div><div data-publication-body aria-live="polite"><p class="muted">Loading the public publication catalogue…</p></div><noscript><p>Use the research archive and Reuters coverage sections to read saved publications. This timeline needs JavaScript.</p></noscript></section>`;}
  function row(entry){
    const external=/^https:/.test(entry.href), title=entry.kind==='Hourly report'?'Reuters hourly scan · '+stamp(entry.source_date):entry.title;
    const titleLink=entry.report_id?`<button type="button" class="publication-report" data-report="${escape(entry.report_id)}">${escape(title)}</button>`:`<a href="${safeHref(entry.href)}"${external?' target="_blank" rel="noopener noreferrer"':''}>${escape(title)}${external?' ↗':''}</a>`;
    const time=entry.provenance_url?`<a href="${safeHref(entry.provenance_url)}" target="_blank" rel="noopener noreferrer" aria-label="Repository addition evidence for ${escape(title)}">${escape(entry.date_basis)}</a>`:escape(entry.date_basis);
    return `<li class="publication-entry"><div class="publication-time"><time datetime="${escape(entry.at)}">${new Date(entry.at).toLocaleTimeString('en-SG',{timeZone:'Asia/Singapore',hour:'2-digit',minute:'2-digit',hour12:false})}</time><small>${time}</small></div><div class="publication-copy"><div class="publication-meta"><span class="tag">${escape(entry.source)}</span><span>${escape(entry.kind)} · ${escape(entry.format)}</span></div><h4>${titleLink}</h4>${entry.source_date&&entry.kind!=='Hourly report'?`<p class="publication-edition">Source edition: ${escape(entry.source_date.length===10?entry.source_date:stamp(entry.source_date))}</p>`:''}${entry.note?`<p class="publication-edition">${escape(entry.note)}</p>`:''}</div></li>`;
  }
  function body(){
    const node=document.querySelector('[data-publication-body]');if(!node)return;
    if(!data){node.innerHTML=`<p class="health warn">${error?'The publication catalogue could not load. Saved research and reports remain available in the sections below.':'Loading the public publication catalogue…'}</p>${error?'<button class="button ghost" data-publication-retry>Try again</button>':''}`;return;}
    const now=Date.now(),b=bounds(now),all=select(data,{now}),matches=select(data,{...state,now}),counts=Object.fromEntries(Object.keys(groups).map(k=>[k,k==='all'?all.length:all.filter(x=>x.category===k).length]));
    let lastDay='',rows='';for(const item of matches.slice(0,state.limit)){const key=day(item.at);if(key!==lastDay){rows+=`${lastDay?'</ol>':''}<h3 class="publication-day">${escape(key)}</h3><ol class="publication-list" aria-label="Publications for ${escape(key)}">`;lastDay=key;}rows+=row(item);}if(lastDay)rows+='</ol>';
    const age=now-Date.parse(data.built_at),stale=age>6*HOUR;
    const oldHourly=data.feeds?.hourly_report_at&&now-Date.parse(data.feeds.hourly_report_at)>2*HOUR;
    const feed=(label,at,hours)=>at?`${label}: ${stamp(at)}${now-Date.parse(at)>hours*HOUR?' · older saved feed':''}`:`${label}: timestamp unavailable`;
    node.innerHTML=`<p class="publication-window"><b>${escape(day(b.start))} to ${escape(day(now))}</b> · Today and the previous two Singapore calendar days</p><div class="publication-controls"><div class="publication-filters" role="group" aria-label="Filter publication source">${Object.entries(groups).map(([key,label])=>`<button type="button" data-publication-filter="${key}" aria-pressed="${state.filter===key}" class="${state.filter===key?'active':''}">${label} <span>${counts[key]}</span></button>`).join('')}</div><label class="publication-search">Find a publication<input type="search" data-publication-query value="${escape(state.query)}" placeholder="Title, source or format" autocomplete="off"></label></div><p class="publication-result" role="status">${matches.length} matching saved entries${matches.length>state.limit?' · showing '+Math.min(state.limit,matches.length):''}. ${stale?'Catalogue is over six hours old. ':''}Built ${escape(stamp(data.built_at))}.</p>${oldHourly?`<p class="publication-result">Hourly feed is older than two hours: latest saved report ${escape(stamp(data.feeds.hourly_report_at))}. Saved coverage may be incomplete.</p>`:''}<div class="publication-rows">${rows||'<p class="empty">No saved entries match this window and filter. This does not confirm that nothing was published.</p>'}</div>${matches.length>state.limit?`<button type="button" class="button ghost publication-more" data-publication-more>Show more · ${matches.length-state.limit} remaining</button>`:''}<details class="publication-coverage"><summary>Sources, dates & coverage${stale?' · older catalogue':''}</summary><p>${escape(data.coverage)}</p><p>${escape(data.date_note)}</p><p>${escape(data.authorship_note)}</p><p>${escape(feed('Reuters saved',data.feeds?.reuters_saved_at,26))}<br>${escape(feed('Latest hourly report',data.feeds?.hourly_report_at,2))}</p>${data.undated_count?`<p>${data.undated_count} saved entries lack verified introduction timestamps and are excluded from the dated window.</p>`:''}${data.invalid_watchlist_reports?`<p>${data.invalid_watchlist_reports} watchlist report records failed saved-file verification and are excluded.</p>`:''}<p>All retained saved records are searchable above. Counts refer to saved entries; slide decks and PDFs are listed separately from their articles. Nothing here fetches unpublished documents or runs a news scan.</p></details>`;
  }
  async function mount(){
    body();if(pending||(data&&Date.now()-fetchedAt<5*60000))return;
    pending=(async()=>{try{const response=await fetch('data/publication-timeline.json',{cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const value=await response.json();if(value.schema_version!==1||!Array.isArray(value.entries)||!Number.isFinite(Date.parse(value.built_at)))throw new Error('Invalid catalogue');data=value;fetchedAt=Date.now();error=false;}catch{error=true;}finally{pending=null;body();}})();await pending;
  }
  if(typeof document!=='undefined'){
    document.addEventListener('click',e=>{const filter=e.target.closest('[data-publication-filter]');if(filter){state.filter=filter.dataset.publicationFilter;state.limit=PAGE_SIZE;body();document.querySelector(`[data-publication-filter="${state.filter}"]`)?.focus({preventScroll:true});}if(e.target.closest('[data-publication-more]')){state.limit+=PAGE_SIZE;body();document.querySelector('[data-publication-more]')?.focus({preventScroll:true});}if(e.target.closest('[data-publication-retry]')){error=false;mount();}});
    document.addEventListener('input',e=>{if(e.target.matches('[data-publication-query]')){const start=e.target.selectionStart;state.query=e.target.value;state.limit=PAGE_SIZE;body();const input=document.querySelector('[data-publication-query]');input?.focus({preventScroll:true});input?.setSelectionRange(start,start);}});
  }
  root.MarketPublications={shell,mount};
  if(typeof module!=='undefined')module.exports={bounds,inWindow,select,safeHref};
})(typeof window==='undefined'?globalThis:window);
