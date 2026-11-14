/* Multi-share chart and accessible expanded view; all observations come from MarketPrices. */
(function(root){'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ranges={'1M':31,'3M':93,'6M':184,'1Y':366,'5Y':1830,'20Y':7320};
const colors=['#2865a8','#b35d19','#12816d','#8755ae','#bd3653','#467584'];
const money=n=>Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}):'Unavailable';
const pct=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(2)+'%':'Unavailable';
const daysAgo=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')-days*86400000).toISOString().slice(0,10);
const states=new Map();let dialog=null,returnFocus=null;
function state(key){if(!states.has(key))states.set(key,{symbols:['AAPL'],range:'6M',mode:'price',events:true,revision:0,pending:'MSFT'});return states.get(key);}

// Compare every instrument over identical observed start AND end dates. Missing
// sessions are not filled, and no earlier date is silently used as the baseline.
function normalize(series){
 if(!series.length||series.some(s=>!s.points.length))return null;
 const sets=series.slice(1).map(s=>new Set(s.points.map(p=>p[0])));
 const common=series[0].points.map(p=>p[0]).filter(d=>sets.every(s=>s.has(d)));
 if(common.length<2)return null;
 const from=common[0],to=common.at(-1);
 return {from,to,lines:series.map(s=>{const base=s.points.find(p=>p[0]===from)[1];return {...s,base,points:s.points.filter(p=>p[0]>=from&&p[0]<=to).map(p=>[p[0],100*(p[1]/base-1)])};})};
}
function shell(key){return `<section class="mp-workbench" data-share-workbench="${esc(key)}" aria-label="Share performance comparison"><p role="status">Loading shared price history…</p></section>`;}
function panel(){return `<section class="card section mp-history" id="mp-history"><div class="section-title"><div><h2>Share prices &amp; historical charts</h2><p data-price-status>Daily closes · one shared price history</p></div><button class="button ghost" data-price-refresh>Check for price update</button></div>${shell('history')}</section>`;}
function select(symbol){const s=state('history');s.symbols=[symbol];s.mode='price';s.revision++;}
function options(items,s){return items.filter(x=>!s.symbols.includes(x.ticker)).map(x=>`<option value="${esc(x.ticker)}" ${x.ticker===s.pending?'selected':''}>${esc(x.name)} [${esc(x.ticker)}] · ${esc(x.currency||x.unit)}</option>`).join('');}
function controls(key,s,items){const multiple=s.symbols.length>1;return `<div class="mp-share-chips" aria-label="Shares in this chart">${s.symbols.map((t,i)=>`<span style="--share-color:${colors[i]}"><b>${esc(t)}</b><button type="button" data-share-remove="${esc(t)}" aria-label="Remove ${esc(t)}" ${s.symbols.length===1?'disabled':''}>×</button></span>`).join('')}</div><div class="mp-share-add"><label>Add a share to compare<select data-share-add-select ${s.symbols.length>=6?'disabled':''}>${options(items,s)}</select></label><button type="button" class="button" data-share-add ${s.symbols.length>=6?'disabled':''}>Add to chart</button></div><div class="mp-chart-controls"><div class="mp-periods" role="group" aria-label="Comparison chart period">${Object.keys(ranges).map(p=>`<button type="button" data-share-range="${p}" aria-pressed="${s.range===p}">${p}</button>`).join('')}</div><label>Chart units<select data-share-mode ${multiple?'disabled':''}><option value="price" ${!multiple&&s.mode==='price'?'selected':''}>Listing price</option><option value="percent" ${multiple||s.mode==='percent'?'selected':''}>Percentage change</option></select></label><label class="mp-events-toggle"><input type="checkbox" data-share-events ${s.events?'checked':''}> Show earnings dates</label></div><p class="mp-muted">${multiple?'Every line starts at 0% on the first common observation date and ends on the last common date.':'Add up to six shares. Comparisons automatically use percentage change.'} Listing currencies are retained; no FX conversion. Share/ETF price changes exclude dividends. Total-return indices retain their own published methodology.</p><div class="mp-workbench-result" role="status">Loading chart…</div>`;}
function eventDetails(events){return events.length?`<details class="mp-event-sources"><summary>Dotted earnings markers · ${events.length} dates</summary><p>Markers show the calendar release date, including non-trading days. Announcement times are not available; a same-day close may precede an after-market release.</p><ul>${events.map(e=>`<li><b>${esc(e.ticker)}</b> · ${esc(e.date)} · ${esc(e.label)} · <a href="${esc(root.MarketPrices.sourceUrl(e.source_url))}" target="_blank" rel="noopener noreferrer">${esc(e.source_title)}</a></li>`).join('')}</ul></details>`:'<p class="mp-muted">No verified earnings-release date falls within this chart window.</p>';}
function orderedShares(data){return root.ShareEnrichment?.sortShares(data,d=>d.item)||data;}
function currentSelection(data,api){return `<section class="mp-current-selection" aria-label="Selected share prices and valuations"><h3>Selected prices &amp; valuations</h3>${orderedShares(data).map(d=>{const q=api.currentQuote?.(d.item)||{...d.quote,sourceLabel:'Historical feed close',sourceUrl:d.item.history_url},url=api.sourceUrl(q.sourceUrl);return `<article class="mp-current-quote"><div class="mp-quote"><div><strong>${esc(d.item.ticker)}</strong> <span>${esc(q.sourceLabel)}</span></div><b>${money(q.close)} <small>${esc(api.displayUnit(d.item))}</small></b></div><p class="mp-caption">Selected price · ${esc(q.date)}${q.current===false?' · Dated reference':''}${url?` · <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Selected source ↗</a>`:''}</p>${api.currentDetails?.(d.item)||''}</article>`;}).join('')}<p class="mp-muted">The historical chart and changes below use their original closing-price series and dates.</p></section>`;}
async function render(el,force=false){
 const api=root.MarketPrices,key=el.dataset.shareWorkbench,s=state(key),version=api.version()+'|'+(root.ShareEnrichment?.version?.()||'')+'|'+s.revision;
 if(!force&&el.dataset.chartVersion===version)return;
 el.dataset.chartVersion=version;const token=String((Number(el.dataset.chartToken)||0)+1);el.dataset.chartToken=token;
 const items=api.instruments().slice().sort((a,b)=>a.name.localeCompare(b.name));
 if(!items.length){el.innerHTML='<p role="status">The closing-price feed is not available. Use “Check for price update” to retry.</p>';return;}
 el.innerHTML=controls(key,s,items);
 try{
  const data=await Promise.all(s.symbols.map(t=>api.series(t)));
  const end=data.map(d=>d.quote.date).sort().at(-1),requestedFrom=daysAgo(end,ranges[s.range]);
  let lines=data.map(d=>({name:d.item.ticker,points:api.selectPoints(d.base,d.daily,requestedFrom,end)}));
  const percentage=s.symbols.length>1||s.mode==='percent';let from,to;
  if(percentage){const normalized=normalize(lines);if(!normalized)throw Error('At least two common observation dates are needed for this comparison. Choose a longer range or different shares.');({lines,from,to}=normalized);}
  else{if(lines[0].points.length<2)throw Error('Not enough observations in this range. Choose a longer range.');from=lines[0].points[0][0];to=lines[0].points.at(-1)[0];}
  let events=[],eventError='';
  if(s.events){try{events=(await api.earnings()).filter(e=>data.some(d=>d.item.id===api.resolve(e.ticker)?.id)&&e.date>=from&&e.date<=to);}catch{eventError='Earnings dates could not load; prices remain available.';}}
  if(!el.isConnected||el.dataset.chartToken!==token)return;
  const result=el.querySelector('.mp-workbench-result');result.removeAttribute('role');
  result.innerHTML=currentSelection(data,api)+`<p class="mp-comparison-dates"><b>${esc(from)} → ${esc(to)}</b> · ${percentage?'Percentage change · common start = 0%':esc(data[0].item.unit)}${from>requestedFrom?' · available history determines the start':''}</p><div class="mp-legend">${lines.map((line,i)=>`<span style="--share-color:${colors[i]}"><i></i>${esc(line.name)} <b>${percentage?pct(line.points.at(-1)[1]):pct((line.points.at(-1)[1]/line.points[0][1]-1)*100)}</b></span>`).join('')}</div>${api.svg(lines,[],events,{percent:percentage,expanded:true,colors})}<div class="mp-table-scroll"><table class="mp-comparison-table"><caption>Historical feed closes · chart changes use the displayed window above</caption><thead><tr><th>Share</th><th>Historical feed close</th><th>Historical price date</th><th>Chart change</th></tr></thead><tbody>${orderedShares(data).map(d=>{const i=data.indexOf(d);return `<tr><th scope="row">${esc(d.item.ticker)}</th><td>${money(d.quote.close)} ${esc(api.displayUnit(d.item))}</td><td>${esc(d.quote.date)}</td><td>${percentage?pct(lines[i].points.at(-1)[1]):pct((lines[i].points.at(-1)[1]/lines[i].points[0][1]-1)*100)}</td></tr>`;}).join('')}</tbody></table></div>${data.filter(d=>api.quoteStatus(d.quote)!=='Daily closing price').map(d=>`<p class="mp-warning">${esc(d.item.ticker)} · ${esc(api.quoteStatus(d.quote))}</p>`).join('')}${eventError?`<p class="mp-warning">${eventError}</p>`:s.events?eventDetails(events):''}<details class="mp-values"><summary>Price bases and available observations</summary><p>Older weekly/monthly baseline dates are period labels. Daily dates are actual available sessions. No missing sessions or price values are filled.</p>${data.map(d=>`<p><b>${esc(d.item.ticker)}</b> · ${esc(api.priceBasis(d.item))} ${esc(d.base.period_note)} <a href="${esc(api.sourceUrl(d.item.history_url))}" target="_blank" rel="noopener noreferrer">Price source ↗</a></p>`).join('')}</details>`;
 }catch(e){if(el.isConnected&&el.dataset.chartToken===token){el.querySelector('.mp-workbench-result').innerHTML=`<p class="mp-warning">${esc(e.message)}</p>`;delete el.dataset.chartVersion;}}
}
function mount(){for(const el of root.document?.querySelectorAll('[data-share-workbench]')||[])render(el);}
function open(symbol,origin){
 if(!root.document)return;returnFocus=origin||root.document.activeElement;
 if(!dialog){dialog=root.document.createElement('dialog');dialog.className='mp-chart-dialog';dialog.setAttribute('aria-labelledby','mp-dialog-title');root.document.body.append(dialog);dialog.addEventListener('close',()=>{root.document.body.classList.remove('mp-modal-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});dialog.addEventListener('keydown',e=>e.stopPropagation());}
 const s=state('expanded');s.symbols=[symbol];s.mode='price';s.range='6M';s.events=true;s.revision++;
 dialog.innerHTML=`<div class="mp-dialog-head"><h2 id="mp-dialog-title">${esc(symbol)} · historical share chart</h2><button type="button" class="button ghost" data-share-close aria-label="Close expanded chart">Close ×</button></div>${shell('expanded')}`;
 if(!dialog.open)dialog.showModal();root.document.body.classList.add('mp-modal-open');mount();
}
if(root.document){
 root.document.addEventListener('click',e=>{
  const expand=e.target.closest('[data-price-expand]');if(expand){open(expand.dataset.priceExpand,expand);return;}
  if(e.target.closest('[data-share-close]')){dialog?.close();return;}
  const el=e.target.closest('[data-share-workbench]');if(!el)return;const s=state(el.dataset.shareWorkbench);
  const range=e.target.closest('[data-share-range]'),remove=e.target.closest('[data-share-remove]');
  if(range)s.range=range.dataset.shareRange;
  else if(remove&&s.symbols.length>1)s.symbols=s.symbols.filter(t=>t!==remove.dataset.shareRemove);
  else if(e.target.closest('[data-share-add]')){const ticker=el.querySelector('[data-share-add-select]').value;if(ticker&&!s.symbols.includes(ticker)&&s.symbols.length<6)s.symbols.push(ticker);else return;}
  else return;s.revision++;render(el,true);
 });
 root.document.addEventListener('change',e=>{const el=e.target.closest('[data-share-workbench]');if(!el)return;const s=state(el.dataset.shareWorkbench);if(e.target.matches('[data-share-add-select]')){s.pending=e.target.value;return;}if(e.target.matches('[data-share-mode]'))s.mode=e.target.value;else if(e.target.matches('[data-share-events]'))s.events=e.target.checked;else return;s.revision++;render(el,true);});
 root.document.addEventListener('market-prices-updated',mount);root.document.addEventListener('share-enrichment-updated',mount);
}
const api={normalize,panel,mount,open,select,eventDetails};root.MarketShareCharts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
