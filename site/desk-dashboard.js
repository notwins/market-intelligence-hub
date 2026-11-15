/* Open dashboard: existing saved sources only; no new quote feed or schedule. */
(function(root){'use strict';
const D=root.Desk||(typeof require==='function'?require('./desk.js'):null),$=s=>document.querySelector(s),E=D.E,link=(url,label)=>D.safeHref(url)?`<a href="${E(url)}">${E(label)}</a>`:'';
const number=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'Unavailable';
const date=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date unavailable';
function curve(labels,values,title,maturityYears){
 if(!Array.isArray(labels)||!Array.isArray(values)||labels.length!==values.length||values.filter(Number.isFinite).length<2)return '<p class="empty">Saved curve unavailable. No replacement yields inferred.</p>';
 const years=maturityYears||labels.map(s=>Number.parseFloat(s)*(/M$/i.test(s)?1/12:1));if(years.some(x=>!Number.isFinite(x)||x<=0))return '<p class="empty">Maturities need review.</p>';
 const valid=values.filter(Number.isFinite),low=Math.min(...valid),high=Math.max(...valid),pad=(high-low||.5)*.18,min=low-pad,max=high+pad;
 const x=i=>48+years[i]/Math.max(...years)*470,y=v=>194-(v-min)/(max-min)*160;
 let segments=[],part=[];values.forEach((v,i)=>{if(Number.isFinite(v))part.push(`${x(i)},${y(v)}`);else{if(part.length)segments.push(part);part=[];}});if(part.length)segments.push(part);
 return `<svg class="chart yield-curve" viewBox="0 0 550 240" role="img" aria-label="${E(title)}; yields percent per annum"><title>${E(title)}. Missing tenors remain gaps. Maturity spacing is proportional to years.</title>${[min,(min+max)/2,max].map(v=>`<line x1="48" x2="518" y1="${y(v)}" y2="${y(v)}"/><text x="3" y="${y(v)+4}">${number(v)}%</text>`).join('')}${segments.map(p=>p.length>1?`<polyline points="${p.join(' ')}"/>`:'').join('')}${values.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="currentColor"><title>${E(labels[i])}: ${v}%</title></circle>`:'').join('')}${labels.map((v,i)=>`<text x="${x(i)}" y="${maturityYears&&i<3?206+i*16:226}" text-anchor="middle">${E(v)}</text>`).join('')}</svg>`;
}
function curveCard(title,labels,values,asof,basis,url,notice,extra=''){
 return `<article class="dashboard-card"><div class="eyebrow">YIELD CURVE · % P.A.</div><h3>${E(title)}</h3><p class="observation-date">${E(date(asof))} · saved observation</p>${curve(labels,values,title)}<p class="fine">${E(basis)}</p><p class="warning">${E(notice)}</p>${link(url,'Original source ↗')}${extra}<details><summary>Exact yields</summary><div class="curve-values">${labels.map((l,i)=>`<span>${E(l)} <b>${number(values[i])}%</b></span>`).join('')}</div></details></article>`;
}
async function loadJSON(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!r.ok)throw Error('Unavailable');return await r.json();}finally{clearTimeout(timer);}}
async function loadCurves(){
 const result=await Promise.allSettled([loadJSON('data/wsj-treasury-dashboard.json'),loadJSON('data/sgs-daily-snapshot.json')]);
 $('#dashboard-curves').innerHTML=result.map((r,i)=>{
  if(r.status!=='fulfilled')return `<article class="dashboard-card"><h3>${i?'SGS yield curve':'US Treasury / WSJ reference'}</h3><p class="empty">Saved source unavailable. No new yields inferred.</p></article>`;
  const d=r.value;if(!i){
   const bills=d.quotes.filter(q=>q.kind==='bill');bills.slice(0,2).forEach((q,j)=>{const tile=$('#pulse-yields').children[j];tile.innerHTML=`<a href="${E(d.source_url)}">US T-bill · ${j?'about 1 year':'6 months'}</a><strong>${number(q.asked_yield_percent,3)}%</strong><small>WSJ asked yield · ${E(date(d.as_of))}</small><small>Matures ${E(date(q.maturity))} · not an auction rate</small>`;});
   const q=d.quotes,years=q.map(v=>(Date.parse(v.maturity)-Date.parse(d.as_of))/86400000/365.25);
   return `<article class="dashboard-card"><div class="eyebrow">WSJ · ASKED YIELDS · % P.A.</div><h3>US Treasury yield curve</h3><p class="observation-date">${E(date(d.as_of))} · saved WSJ quotes</p>${curve(q.map(v=>v.term),q.map(v=>v.asked_yield_percent),'Selected WSJ Treasury asked yields',years)}<p class="fine">${E(d.basis)}</p><p class="fine">${E(d.selection_note)}</p>${link(d.source_url,'Open original WSJ quote table ↗')}<details><summary>Quoted securities and exact yields</summary><div class="table-wrap"><table><thead><tr><th>Term</th><th>Maturity</th><th>Coupon</th><th>Asked yield</th></tr></thead><tbody>${q.map(v=>`<tr><td>${E(v.term)}</td><td>${E(v.maturity)}</td><td>${v.coupon_percent===null?'Bill':number(v.coupon_percent,3)+'%'}</td><td>${number(v.asked_yield_percent,3)}%</td></tr>`).join('')}</tbody></table></div></details></article>`;
  }
  const obs=d.observations?.at(-1);if(!obs)return '<p class="empty">SGS observations unavailable.</p>';
  ['6M','1Y'].forEach((term,j)=>{const i=d.tenors.findIndex(t=>t.label===term),v=obs.values[i];$('#pulse-yields').children[2+j].innerHTML=`<a href="#markets">Singapore T-bill · ${term==='6M'?'6 months':'1 year'}</a><strong>${number(v)}${Number.isFinite(v)?'%':''}</strong><small>${E(date(obs.date))} · dated MAS closing yield</small><small>MAS daily refresh · 7:00 pm Singapore</small>`;});
  if(root.SGSDaily)return `<article class="dashboard-card sgs-daily" data-sgs-daily="dashboard">${root.SGSDaily.render('dashboard')}</article>`;
  return curveCard('Singapore SGS yield curve',d.tenors.map(t=>t.label),obs.values,obs.date,d.basis,d.source_url,'MAS closing levels refresh daily at 7:00 pm Singapore time. The observation date is the date published by MAS.',`<p class="fine">${E(d.attribution)} ${link(d.license_url,'Dataset terms')}</p>`);
 }).join('');
}
async function loadFX(){try{
 const d=await loadJSON('data/history-fed.json');$('#dashboard-fx').innerHTML=['USD/SGD','CHF/SGD'].map(id=>{
  const s=d.series.find(s=>s.id===id),p=s?.points?.slice(-60)||[],last=p.at(-1);if(!last)return `<article class="dashboard-card"><h3>${id}</h3><p class="empty">Saved FX observations unavailable.</p></article>`;
  return `<article class="dashboard-card"><div class="eyebrow">FX · MONTHLY HISTORY</div><h3>${id}</h3><p class="dashboard-value">${number(last[1],4)} <small>${E(s.unit)}</small></p><p class="observation-date">Observation month: ${E(last[0].slice(0,7))}</p>${D.spark(p,s.unit)}<p class="fine">${E(s.aggregation||'Derived cross-rate from same-month USD/SGD and USD/CHF averages.')} Monthly averages, not live spot rates. ${s.derived?'This is a cross-rate of monthly averages, not an average of daily cross-rates.':''}</p>${link(s.source_url||'v4.html#history/fx','Source and full FX history →')}</article>`;
 }).join('');
 }catch{$('#dashboard-fx').innerHTML='<p class="empty">Saved FX file unavailable. No spot rates inferred.</p>';}}
async function loadIndices(){await root.MarketPrices.refresh();for(const [ticker,title] of [['SPY','SPY · S&P 500 ETF'],['QQQ','QQQ · Nasdaq-100 ETF'],['^STI','STI · Straits Times Index']]){
 const id='dashboard-index-'+ticker.replace(/\W/g,''),el=document.getElementById(id);try{
 const s=await root.MarketPrices.series(ticker),start=new Date(Date.parse(s.quote.date+'T12:00:00Z')-366*86400000).toISOString().slice(0,10),points=root.MarketPrices.selectPoints(s.base,s.daily,start,s.quote.date),unit=root.MarketPrices.displayUnit(s.item);
 el.innerHTML=`<div class="eyebrow">ETF / INDEX · PRICE HISTORY</div><h3>${E(title)}</h3><p class="dashboard-value">${number(s.quote.close)} <small>${E(unit)}</small></p><p class="observation-date">${E(date(s.quote.date))} · ${E(root.MarketPrices.quoteStatus(s.quote))}</p>${D.spark(points,unit)}<p class="fine">${E(root.MarketPrices.priceBasis(s.item))}</p>${link(s.item.history_url,'Original price source ↗')} · ${link('v4.html#history/shares','Open full share history →')}`;
 }catch{el.innerHTML=`<h3>${E(title)}</h3><p class="empty">This exact listing is unavailable in the saved feed. No ETF or index is substituted.</p>`;}
 }}
async function mount(){if(!$('#dashboard-curves'))return;await Promise.allSettled([loadCurves(),loadFX(),loadIndices()]);}
root.DeskDashboard={mount,curve};if(typeof module!=='undefined')module.exports={curve};
})(typeof window!=='undefined'?window:globalThis);
