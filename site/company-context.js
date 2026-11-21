/* Display-only company workspace. Saved editions, source data and calculations are unchanged. */
(function(root){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=Number.isFinite;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&finite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
const normalized=t=>String(t||'').trim()==='BRK-B'?'BRK.B':String(t||'').trim();
const supported=t=>/^[A-Z]{1,5}(?:\.[A-Z])?$/.test(t);
function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['chatgpt.com','chat.openai.com'].includes(u.hostname)&&!/[\\\x00-\x20]/.test(value)?u.href:'';}catch{return '';}}
const external=(href,label)=>safeURL(href)?'<a href="'+E(safeURL(href))+'" target="_blank" rel="noopener noreferrer">'+E(label)+' ↗</a>':E(label);
const number=v=>finite(v)?v.toLocaleString('en-US',{maximumFractionDigits:4}):'Unavailable';
function dated(value){if(!value||!finite(Date.parse(value)))return 'Publication date unavailable';return /^\d{4}-\d{2}-\d{2}$/.test(value)?value+' · time not supplied':new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Singapore'})+' SGT';}
function routes(ticker){const t=normalized(ticker);if(!supported(t))return null;const q='v4.html?company='+encodeURIComponent(t);return {earnings:q+'#earnings',shares:q+'#history/shares',si:'si-beta2.html?company='+encodeURIComponent(t)+'#si-library',watchlist:q+'#watchlist'};}
function newsFor(rows,ticker,now=Date.now()){
 const t=normalized(ticker),seenIds=new Set(),seenURLs=new Set();
 return (rows||[]).filter(n=>n&&Array.isArray(n.tickers)&&n.tickers.some(x=>normalized(x)===t)&&typeof n.title==='string'&&safeURL(n.href)&&finite(Date.parse(n.published_at))&&Date.parse(n.published_at)<=now)
  .slice().sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at)||(Number(b.version)||0)-(Number(a.version)||0)||String(a.id||'').localeCompare(String(b.id||'')))
  .filter(n=>{const url=safeURL(n.href).split('#')[0],id=n.id&&String(n.id);if(seenURLs.has(url)||id&&seenIds.has(id))return false;seenURLs.add(url);if(id)seenIds.add(id);return true;}).slice(0,10);
}
function listing(records,ticker){const code=(normalized(ticker)==='BRK.B'?'BRK/B':normalized(ticker))+' US';const matches=(records||[]).filter(r=>r.bbTicker===code&&r.currency==='USD'&&r.compareEligible!==false);return matches.length===1?matches[0]:null;}
function usable(points,metric){return (points||[]).filter(p=>validDate(p.date)&&finite(p.value)&&(!['pe','pb'].includes(metric)||p.value>0)).slice().sort((a,b)=>a.date.localeCompare(b.date));}
function prior(points,date,metric){return usable(points,metric).filter(p=>p.date<=date).at(-1)||null;}
function eventsFor(earnings,news,ticker){
 const releases=(earnings||[]).filter(e=>validDate(e.date)).map(e=>({date:e.date,label:'Earnings · '+e.label,kind:'earnings',href:e.source?.url||e.source_url||'',timing:'date_only'}));
 const stories=(news||[]).filter(n=>n.tickers?.some(t=>normalized(t)===normalized(ticker))&&finite(Date.parse(n.published_at))).map(n=>({date:n.published_at.slice(0,10),label:n.title,kind:'news',href:n.href,timing:'publisher_date'}));
 const seen=new Set();return [...releases,...stories].sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label)).filter(e=>{const k=e.kind+'|'+e.date+'|'+e.label;if(seen.has(k))return false;seen.add(k);return true;});
}
function periodWindow(metrics,events,range){
 const dates=[...Object.values(metrics).flat().map(p=>p.date),...events.map(e=>e.date)].filter(validDate).sort();
 if(!dates.length)return null;const to=dates.at(-1),days={'1M':31,'3M':93,'1Y':366,'5Y':1830}[range];
 return {from:days?new Date(Date.parse(to+'T12:00:00Z')-days*86400000).toISOString().slice(0,10):dates[0],to};
}
function seriesGroups(points){
 const groups=new Map();
 for(const p of points){const key=JSON.stringify([p.sourceId||p.source,p.basis,p.unit,p.currency,p.adjustment,p.grain]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 return [...groups.values()];
}
function chart(metrics,events,window,selectedDate,currency){
 if(!window)return '<p class="cc-status">No dated observations are available for this listing.</p>';
 const start=Date.parse(window.from+'T12:00:00Z'),end=Date.parse(window.to+'T12:00:00Z'),span=end-start||86400000;
 const x=d=>110+(Date.parse(d+'T12:00:00Z')-start)/span*690;
 const inWindow=p=>p.date>=window.from&&p.date<=window.to;
 let out='<svg viewBox="0 0 840 580" role="img" aria-label="Price, P/E and P/B on one date axis; separate value scales. Event lines mark dated releases and saved news."><title>Observed price and valuation timeline</title>';
 [['price','Price · '+(currency||'listing currency')],['pe','P/E · times'],['pb','P/B · times']].forEach(([metric,label],i)=>{
  const top=25+i*170,points=usable(metrics[metric],metric).filter(inWindow),values=points.map(p=>p.value),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;
  const y=v=>max===min?top+70:top+125-(v-min)/(max-min)*100;
  out+='<text x="10" y="'+(top+16)+'">'+E(label)+'</text><text x="10" y="'+(top+39)+'">Own scale</text><line class="cc-grid" x1="108" x2="805" y1="'+(top+140)+'" y2="'+(top+140)+'"/>';
  if(!points.length)out+='<text x="130" y="'+(top+75)+'">No observations in this window</text>';
  else {
   out+='<text x="102" y="'+(top+30)+'" text-anchor="end">'+E(number(max))+'</text><text x="102" y="'+(top+128)+'" text-anchor="end">'+E(number(min))+'</text>';
   for(const group of seriesGroups(points)){
    if(metric==='price'&&group.length>1)out+='<polyline class="cc-series" points="'+group.map(p=>x(p.date).toFixed(2)+','+y(p.value).toFixed(2)).join(' ')+'"/>';
    out+=group.map(p=>'<circle class="cc-point" cx="'+x(p.date).toFixed(2)+'" cy="'+y(p.value).toFixed(2)+'" r="'+(metric==='price'?2:4)+'"><title>'+E(p.date+' · '+number(p.value)+' · '+(p.source||'')+' · '+(p.basis||''))+'</title></circle>').join('');
   }
  }
 });
 for(const date of [...new Set(events.filter(inWindow).map(e=>e.date))])out+='<line class="cc-event'+(date===selectedDate?' cc-event-selected':'')+'" x1="'+x(date)+'" x2="'+x(date)+'" y1="20" y2="510"><title>'+E(date)+'</title></line>';
 for(let i=0;i<5;i++){const d=new Date(start+(end-start)*i/4).toISOString().slice(0,10);out+='<text x="'+(110+690*i/4)+'" y="550" text-anchor="middle">'+E(d)+'</text>';}
 return out+'</svg>';
}
function eventValues(event,metrics){
 if(!event)return '<p class="cc-note">Select an event to compare it with the available observations.</p>';
 return '<h4>'+E(event.date+' · '+event.label)+'</h4><p>'+external(event.href,'Event source')+'</p><div class="cc-table-scroll"><table><caption>Latest available observation on or before the event date</caption><thead><tr><th>Measure</th><th>Value</th><th>Actual observation date</th><th>Source and basis</th></tr></thead><tbody>'+[['price','Price'],['pe','P/E'],['pb','P/B']].map(([key,label])=>{
  const p=prior(metrics[key],event.date,key);return '<tr><th scope="row">'+label+'</th><td>'+E(p?number(p.value)+(p.currency&&key==='price'?' '+p.currency:key==='price'?'':'×'):'Unavailable')+'</td><td>'+E(p?p.date:'No earlier observation')+'</td><td>'+(p?external(p.sourceUrl,p.source||'Source')+'<small>'+E(p.basis||'')+'</small>':'')+'</td></tr>';
 }).join('')+'</tbody></table></div><p class="cc-note">An earlier observation is not a valuation measured at the event. Earnings markers have date-only timing; a same-day close may precede an after-market release. The timeline shows timing, not proof of causation.</p>';
}
const cache=new Map();
async function json(path){if(!cache.has(path)){const job=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await root.fetch(path,{cache:'no-cache',signal:controller.signal});if(!r.ok)throw Error('Saved source unavailable');return await r.json();}finally{clearTimeout(timer);}})();cache.set(path,job);job.catch(()=>cache.delete(path));}return cache.get(path);}
let logos=null,logoPromise=null;
async function loadLogos(){if(logos)return logos;if(!logoPromise)logoPromise=json('assets/company-logos/company-logos.json').then(d=>{if(d.schema_version!==1||!Array.isArray(d.companies))throw Error('Invalid logos');logos=d;return d;}).catch(()=>null).finally(()=>{logoPromise=null;});return logoPromise;}
function logo(ticker){const t=logos?.aliases?.[ticker]||ticker,c=logos?.companies?.find(c=>c.ticker===t);return c&&/^[A-Za-z0-9._-]+\.(webp|png|svg)$/.test(c.file)?c:null;}
function decorateSnapshot(host){
 if(!root.document||!host)return;
 for(const detail of host.querySelectorAll('.ms-shares [data-ms-detail]')){
  const summary=detail.querySelector('summary'),company=logo(detail.dataset.msDetail);
  if(!summary||!company||summary.dataset.ccLogo===company.ticker)continue;
  summary.dataset.ccLogo=company.ticker;summary.setAttribute('title','Open or close '+company.name+' details');
  const symbol=summary.querySelector('[aria-hidden="true"]');if(!symbol)continue;
  const img=root.document.createElement('img');img.src='assets/company-logos/'+company.file;img.alt='';img.width=30;img.height=30;img.addEventListener('error',()=>{img.remove();symbol.textContent='ⓘ';},{once:true});symbol.replaceChildren(img);
 }
 if(!logos)loadLogos().then(d=>{if(d&&host.isConnected)decorateSnapshot(host);});
}
function nav(ticker){const r=routes(ticker);return r?'<nav class="cc-links" aria-label="'+E(ticker)+' company sections"><a href="'+E(r.earnings)+'">Earnings card →</a><a href="'+E(r.shares)+'">Historical · Shares →</a><a href="'+E(r.si)+'">SI Beta 2 →</a><a href="'+E(r.watchlist)+'">Latest watchlist →</a></nav>':'';}
function earningsHTML(earnings){
 const c=earnings?.company;if(!c)return '<p class="cc-status">Earnings for this company are unavailable in the saved coverage.</p>';
 return '<p class="cc-note">'+E(c.coverage||'Selected reported quarters')+' · '+E(c.eps_basis||'EPS basis unavailable')+'</p><ul>'+(c.takeaways||[]).map(t=>'<li><strong>'+E(t.label)+'</strong> '+E(t.text)+'</li>').join('')+'</ul><div class="cc-table-scroll"><table><caption>Reported company earnings</caption><thead><tr><th>Period</th><th>Revenue · USD bn</th><th>EPS</th><th>Release date / source</th></tr></thead><tbody>'+(earnings.observations||[]).map(h=>'<tr><th scope="row">'+E(h.period)+'<small>Ended '+E(h.period_end||'unavailable')+'</small></th><td>'+number(h.revenue_usd_bn)+'</td><td>'+number(h.eps)+'<small>'+E(h.eps_basis)+'</small></td><td>'+E(h.report_date||'Original release date unavailable')+'<small>'+external(h.source_details?.url,'Issuer source')+'</small></td></tr>').join('')+'</tbody></table></div>';
}
function newsHTML(news,error){
 return (error?'<p class="cc-status">'+E(error)+'</p>':'')+'<p class="cc-note">'+news.length+' of up to 10 matched saved stories · newest publisher date first. Coverage is limited to the saved feeds.</p>'+(news.length?'<ol class="cc-news">'+news.map(n=>'<li>'+external(n.href,n.title)+'<p class="cc-note"><time datetime="'+E(n.published_at)+'">'+E(dated(n.published_at))+'</time><br>'+E(n.source||'Publisher not recorded')+'</p>'+(n.writeup?.body?'<p>'+E(n.writeup.body)+'</p>':'')+'</li>').join('')+'</ol>':'<p>No matched dated stories are available. This does not mean no news occurred.</p>');
}
let active=null,generation=0,readerHost=null;
function repaintChart(){
 const a=active;if(!a)return;const window=periodWindow(a.metrics,a.events,a.range),events=window?a.events.filter(e=>e.date>=window.from&&e.date<=window.to):[];
 if(!events.includes(a.event))a.event=events.at(-1)||null;
 a.panel.querySelector('[data-cc-chart]').innerHTML=chart(a.metrics,a.events,window,a.event?.date,a.currency);
 a.panel.querySelector('[data-cc-events]').innerHTML=events.map(e=>'<button type="button" data-cc-event="'+a.events.indexOf(e)+'" aria-pressed="'+(e===a.event)+'"><small>'+E(e.date+' · '+e.kind)+'</small>'+E(e.label)+'</button>').join('');
 a.panel.querySelector('[data-cc-event-detail]').innerHTML=eventValues(a.event,a.metrics);
 a.panel.querySelectorAll('[data-cc-range]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ccRange===a.range)));
 a.panel.querySelector('[data-cc-observations]').innerHTML=['price','pe','pb'].map(metric=>'<details><summary>'+E(metric==='price'?'Price observations':metric.toUpperCase()+' observations')+' · '+(a.metrics[metric]||[]).length+'</summary><div class="cc-table-scroll"><table><thead><tr><th>Date</th><th>Value</th><th>Source / basis</th></tr></thead><tbody>'+(a.metrics[metric]||[]).map(p=>'<tr><td>'+E(p.date)+'</td><td>'+E(number(p.value))+(finite(p.value)&&['pe','pb'].includes(metric)&&p.value<=0?' · not meaningful':'')+'</td><td>'+external(p.sourceUrl,p.source||'Source')+'<small>'+E(p.basis||'')+(p.reportDate?' · report '+E(p.reportDate):'')+'</small></td></tr>').join('')+'</tbody></table></div></details>').join('');
}
async function bounded(job){let timer;try{return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source timed out')),25000);})]);}finally{clearTimeout(timer);}}
async function selectCompany(ticker){
 const t=normalized(ticker),card=[...(readerHost?.querySelectorAll('.watchlist-card[data-ticker]')||[])].find(c=>c.dataset.ticker===t);if(!card)return;
 if(active?.ticker===t&&active.panel.isConnected)return;
 const ticket=++generation;active?.panel.remove();
 const panel=root.document.createElement('section');panel.className='cc-workspace';panel.dataset.ticker=t;panel.setAttribute('aria-label',t+' latest company context');
 const company=card.querySelector('.watchlist-company span')?.textContent||t;
 panel.innerHTML='<header class="cc-head"><div><p class="cc-kicker">Latest available company context</p><h2>'+E(t)+' · '+E(company)+'</h2><p class="cc-note">This section uses the latest saved sources, separate from the archived edition below. Each source retains its own date.</p></div></header>'+nav(t)+'<section class="cc-section"><h3>Price, valuation &amp; events</h3><p>See how the share price and available valuation observations line up with company announcements.</p><p class="cc-note">Price, P/E and P/B share one date axis and use separate value scales. Valuation dots show supplied observations; source gaps are not filled. Forward and trailing bases retain their source labels.</p><div class="cc-periods" role="group" aria-label="Chart period">'+['1M','3M','1Y','5Y','All'].map(r=>'<button type="button" data-cc-range="'+r+'" aria-pressed="'+(r==='1Y')+'">'+r+'</button>').join('')+'</div><p data-cc-chart-status role="status">Loading saved observations…</p><div class="cc-chart-scroll" tabindex="0" role="region" aria-label="Price and valuation chart; scroll horizontally on small screens" data-cc-chart></div><div class="cc-event-list" aria-label="Events on chart" data-cc-events></div><div data-cc-event-detail aria-live="polite"></div><div data-cc-observations></div></section><section class="cc-section"><h3>Company earnings</h3><div data-cc-earnings role="status">Loading reported earnings…</div></section><section class="cc-section"><h3>Latest 10 company news stories</h3><div data-cc-news role="status">Loading matched saved news…</div></section>';
 card.prepend(panel);
 active={ticker:t,panel,metrics:{price:[],pe:[],pb:[]},events:[],range:'1Y',event:null,currency:'USD'};
 panel.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||active?.panel!==panel)return;if(button.dataset.ccRange){active.range=button.dataset.ccRange;repaintChart();}else if(button.dataset.ccEvent!==undefined){const index=Number(button.dataset.ccEvent);active.event=active.events[index]||null;repaintChart();panel.querySelector('[data-cc-event="'+index+'"]')?.focus({preventScroll:true});}});
 loadLogos().then(()=>{if(ticket!==generation)return;const c=logo(t);if(c){const img=root.document.createElement('img');img.src='assets/company-logos/'+c.file;img.alt=c.name+' logo';img.addEventListener('error',()=>img.remove(),{once:true});panel.querySelector('.cc-head').prepend(img);}});
 const results=await Promise.allSettled([
  root.MarketPrices?.series?.(t)||Promise.reject(Error('Price reader unavailable')),
  (async()=>{if(!root.ShareLabData)throw Error('History reader unavailable');await root.ShareLabData.load();const r=listing(root.ShareLabData.records(),t);if(!r)throw Error('No exact historical listing');return root.ShareLabData.historyFor(r);})(),
  root.EquityResearchData?.load?.()||Promise.reject(Error('Earnings reader unavailable')),
  (async()=>{const desk=await json('data/desk-data.json');let extra=[],warning='';try{const local=await json('data/hourly-news.json'),result=await root.DeskNews.load(local,desk.watchlist);extra=result.news;if(result.delivery_error)warning='Independent news refresh unavailable; retained saved stories keep their original dates.';}catch{warning='News refresh unavailable; showing matched stories from the saved desk snapshot.';}return {news:newsFor([...extra,...(desk.news||[])],t),warning};})()
 ].map(bounded));
 if(ticket!==generation||!panel.isConnected)return;
 const [price,history,earnings,news]=results,warnings=[];
 if(price.status==='fulfilled'){
  const s=price.value;active.currency=root.MarketPrices.displayUnit(s.item);
  active.metrics.price=root.MarketPrices.selectPoints(s.base,s.daily,'0000-01-01',s.quote?.date||'9999-12-31').map(([date,value])=>({date,value,currency:active.currency,source:'Shared price history',sourceId:s.item.id,sourceUrl:s.item.history_url,basis:root.MarketPrices.priceBasis(s.item)+' '+(s.base.period_note||''),grain:date<(s.daily[0]?.[0]||'9999')?'historical-period':'daily'}));
 }else warnings.push('Price history unavailable.');
 if(history.status==='fulfilled'){active.metrics.pe=history.value.metrics.pe||[];active.metrics.pb=history.value.metrics.pb||[];}else warnings.push('Historical valuation observations unavailable for this exact listing.');
 const evidence=earnings.status==='fulfilled'?root.EquityResearchData.earningsFor(t,earnings.value):null;
 panel.querySelector('[data-cc-earnings]').innerHTML=earningsHTML(evidence);
 const stories=news.status==='fulfilled'?news.value.news:[];
 panel.querySelector('[data-cc-news]').innerHTML=newsHTML(stories,news.status==='fulfilled'?news.value.warning:'Saved company news could not load.');
 active.events=eventsFor(evidence?.events,stories,t);panel.querySelector('[data-cc-chart-status]').textContent=warnings.length?warnings.join(' '):'Loaded dated source observations. Select an event below to inspect the available values.';
 repaintChart();
}
async function mountReader(host){
 readerHost=host;
 for(const card of host.querySelectorAll('.watchlist-card[data-ticker]')){
  const ticker=card.dataset.ticker,header=card.querySelector('.watchlist-card-head');if(header&&!card.querySelector('[data-cc-shortcuts]')){const div=root.document.createElement('div');div.dataset.ccShortcuts='1';div.innerHTML=nav(ticker);header.after(div);}
 }
 function select(){let t='';try{t=decodeURIComponent(root.location.hash.slice(1));}catch{}if(!supported(normalized(t)))t=host.querySelector('.watchlist-card[data-ticker]')?.dataset.ticker;if(t)selectCompany(t);}
 root.addEventListener('hashchange',select);select();
}
const api={routes,newsFor,listing,usable,prior,eventsFor,periodWindow,seriesGroups,chart,eventValues,decorateSnapshot,mountReader};
root.CompanyContext=api;if(typeof module!=='undefined')module.exports=api;
if(root.document){const boot=()=>{const host=root.document.getElementById('market-snapshot-body');if(host)decorateSnapshot(host);};if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}
})(typeof window!=='undefined'?window:globalThis);
