/* Open dashboard market data and last accepted quotes. */
(function(root){'use strict';
let D=root.Desk||(typeof require==='function'?require('./desk.js'):null);
const $=s=>document.querySelector(s),E=value=>D.E(value),link=(url,label)=>D.safeHref(url)?`<a href="${E(url)}">${E(label)}</a>`:'';
const number=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'Unavailable';
const date=s=>s?new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Date unavailable';
function curve(labels,values,title,maturityYears,{referenceOnly=false,pointLabels=labels}={}){
 if(!Array.isArray(labels)||!Array.isArray(values)||labels.length!==values.length||values.filter(Number.isFinite).length<2)return '<p class="empty">Saved curve unavailable. No replacement yields inferred.</p>';
 const years=maturityYears||labels.map(s=>Number.parseFloat(s)*(/M$/i.test(s)?1/12:1));if(years.some(x=>!Number.isFinite(x)||x<=0))return '<p class="empty">Maturities need review.</p>';
 const valid=values.filter(Number.isFinite),low=Math.min(...valid),high=Math.max(...valid),pad=(high-low||.5)*.18,min=low-pad,max=high+pad;
 const x=i=>48+years[i]/Math.max(...years)*470,y=v=>194-(v-min)/(max-min)*160;
 let segments=[],part=[];values.forEach((v,i)=>{if(referenceOnly&&!labels[i])return;if(Number.isFinite(v))part.push(`${x(i)},${y(v)}`);else{if(part.length)segments.push(part);part=[];}});if(part.length)segments.push(part);
 return `<svg class="chart yield-curve" viewBox="0 0 550 240" role="img" aria-label="${E(title)}; yields percent per annum"><title>${E(title)}. Maturity spacing is proportional to years.</title>${[min,(min+max)/2,max].map(v=>`<line x1="48" x2="518" y1="${y(v)}" y2="${y(v)}"/><text x="3" y="${y(v)+4}">${number(v)}%</text>`).join('')}${segments.map(p=>p.length>1?`<polyline points="${p.join(' ')}"/>`:'').join('')}${values.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="${labels[i]?4:3}" fill="currentColor"><title>${E(pointLabels[i])}: ${v}%</title></circle>`:'').join('')}${labels.map((v,i)=>v?`<text x="${x(i)}" y="${maturityYears&&years[i]<2?(years[i]<.75?206:222):226}" text-anchor="middle">${E(v)}</text>`:'').join('')}</svg>`;
}
function curveCard(title,labels,values,asof,basis,url,notice,extra=''){
 return `<article class="dashboard-card"><div class="eyebrow">YIELD CURVE · % P.A.</div><h3>${E(title)}</h3><p class="observation-date">${E(date(asof))} · saved observation</p>${curve(labels,values,title)}<p class="fine">${E(basis)}</p><p class="warning">${E(notice)}</p>${link(url,'Original source ↗')}${extra}<details><summary>Exact yields</summary><div class="curve-values">${labels.map((l,i)=>`<span>${E(l)} <b>${number(values[i])}%</b></span>`).join('')}</div></details></article>`;
}
async function loadJSON(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!r.ok)throw Error('Unavailable');return await r.json();}finally{clearTimeout(timer);}}
const wsjURL='https://www.wsj.com/market-data/bonds/treasuries';
const isoDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s));
function wsjObservations(samples,watch){
 const rows=new Map();
 for(const q of samples?.quotes||[]){
  const quoteDate=q.quote_date||samples.as_of;
  if(!isoDay(quoteDate)||!isoDay(q.maturity)||!Number.isFinite(q.asked_yield_percent))continue;
  rows.set(`${q.maturity}/${q.coupon_percent}`,{...q,quoteDate,yield:q.asked_yield_percent,bid:q.bid_price,ask:q.ask_price});
 }
 for(const r of watch?.instruments||[]){
  if(r.source!=='WSJ'||!isoDay(r.maturity))continue;
  const saved=watch.latest?.[r.id],key=`${r.maturity}/${r.coupon}`,sample=rows.get(key);
  const q=saved?.source==='WSJ'&&saved.yield_basis==='Asked yield'&&isoDay(saved.date)&&Number.isFinite(saved.yield_pct)?saved:null;
  const row={maturity:r.maturity,coupon_percent:r.coupon,quoteDate:q?.date,yield:q?.yield_pct,bid:q?.bid,ask:q?.ask};
  rows.set(key,{...(sample&&(!q||sample.quoteDate>q.date)?sample:{...row,term:sample?.term}),
   isin:r.isin,retained:watch.checks?.[r.id]?.status==='unavailable'});
 }
 const quotes=[...rows.values()].sort((a,b)=>a.maturity.localeCompare(b.maturity)||a.coupon_percent-b.coupon_percent);
 const latest=quotes.reduce((d,q)=>q.quoteDate>d?q.quoteDate:d,'');
 return {quotes,latest,plotted:quotes.filter(q=>q.quoteDate===latest&&q.maturity>latest)};
}
function wsjCurveCard(samples,watch){
 const {quotes,latest,plotted}=wsjObservations(samples,watch);
 const name=q=>q.isin||q.term||'Treasury';
 const years=plotted.map(q=>(Date.parse(q.maturity)-Date.parse(latest))/86400000/365.2425);
 const chart=curve(plotted.map(q=>q.term||''),plotted.map(q=>q.yield),'WSJ Treasury asked yields',years,
  {referenceOnly:true,pointLabels:plotted.map(q=>`${name(q)} · ${q.coupon_percent??0}% · ${q.maturity}`)});
 const older=latest&&Math.floor((Date.now()-Date.parse(latest+'T23:59:59-05:00'))/86400000)>=4;
 const checks=(watch?.instruments||[]).filter(r=>r.source==='WSJ').map(r=>watch.checks?.[r.id]?.status);
 const retained=checks.length>0&&checks.every(status=>status==='unavailable');
 const table=quotes.map(q=>`<tr><th scope="row">${E(name(q))}</th><td>${E(date(q.maturity))}</td><td>${q.coupon_percent===null?'Bill':number(q.coupon_percent,3)+'%'}</td><td>${number(q.bid,4)}</td><td>${number(q.ask,4)}</td><td>${Number.isFinite(q.yield)?number(q.yield,3)+'%':'Unavailable'}</td><td>${E(date(q.quoteDate))}${q.quoteDate&&(q.retained||q.quoteDate<latest)?' · retained':''}</td></tr>`).join('');
 return `<article class="dashboard-card"><div class="eyebrow">WSJ · ASKED YIELDS · % P.A.</div><h3>US Treasury yield curve</h3><p class="observation-date">${latest?`${E(date(latest))} · ${older?'older saved':'latest saved'} WSJ quotes`:'WSJ quotes unavailable'}</p>${retained?'<p class="warning">The last WSJ refresh was unavailable. Saved quotes are retained.</p>':''}${chart}<p class="fine">The curve uses quotes from one WSJ source date. Bid and ask prices are per 100 face value. Older quotes retain their dates below. Check your broker for an executable price.</p>${link(wsjURL,'Open WSJ Treasury quotes')}${quotes.length?`<details><summary>WSJ bond prices and asked yields</summary><div class="table-wrap" role="region" aria-label="WSJ bond prices and asked yields" tabindex="0"><table><thead><tr><th scope="col">Treasury</th><th scope="col">Maturity</th><th scope="col">Coupon</th><th scope="col">Bid price</th><th scope="col">Ask price</th><th scope="col">Asked yield</th><th scope="col">WSJ quote date</th></tr></thead><tbody>${table}</tbody></table></div></details>`:''}</article>`;
}
async function loadCurves(){
 const [wsj,sgs,watch]=await Promise.allSettled([
  loadJSON('data/wsj-treasury-dashboard.json'),loadJSON('data/sgs-daily-snapshot.json'),
  loadJSON('data/Bond%20Prices%20-%20Type%20JSON%20-%2016-Nov-03.10.json'),
 ]);
 const d=sgs.value;
 const bills=wsj.value?.quotes?.filter(q=>q.kind==='bill')||[];
 bills.slice(0,2).forEach((q,j)=>{
  if(!isoDay(q.maturity)||!Number.isFinite(q.asked_yield_percent))return;
  $('#pulse-yields').children[j].innerHTML=`<a href="${wsjURL}">US T-bill · ${j?'about 1 year':'6 months'}</a><strong>${number(q.asked_yield_percent,3)}%</strong><small>WSJ asked yield · ${E(date(q.quote_date||wsj.value.as_of))}</small><small>Matures ${E(date(q.maturity))}</small>`;
 });
 const sgsCard=()=>{
  if(!d)return '<article class="dashboard-card"><h3>SGS yield curve</h3><p class="empty">Saved source unavailable.</p></article>';
  const obs=d.observations?.at(-1);if(!obs)return '<p class="empty">SGS observations unavailable.</p>';
  ['6M','1Y'].forEach((term,j)=>{const i=d.tenors.findIndex(t=>t.label===term),v=obs.values[i];$('#pulse-yields').children[2+j].innerHTML=`<a href="#markets">Singapore T-bill · ${term==='6M'?'6 months':'1 year'}</a><strong>${number(v)}${Number.isFinite(v)?'%':''}</strong><small>${E(date(obs.date))} · dated MAS closing yield</small><small>MAS daily refresh · 7:00 pm Singapore</small>`;});
  if(root.SGSDaily)return `<article class="dashboard-card sgs-daily" data-sgs-daily="dashboard">${root.SGSDaily.render('dashboard')}</article>`;
  return curveCard('Singapore SGS yield curve',d.tenors.map(t=>t.label),obs.values,obs.date,d.basis,d.source_url,'MAS closing levels refresh daily at 7:00 pm Singapore time. The observation date is the date published by MAS.',`<p class="fine">${E(d.attribution)} ${link(d.license_url,'Dataset terms')}</p>`);
 };
 $('#dashboard-curves').innerHTML=wsjCurveCard(wsj.value,watch.value)+sgsCard();
}
async function loadFX(){try{
 const d=await loadJSON('data/fred-weekly-fx.json').catch(()=>loadJSON('data/fred-daily.json')).catch(()=>loadJSON('data/history-fed.json'));$('#dashboard-fx').innerHTML=['USD/SGD','CHF/SGD'].map(id=>{
  if(d.frequency==='weekly'){
   const i=d.columns.findIndex(column=>column.id===id),s=d.columns[i];
   const rows=d.observations.slice(-260).filter(row=>Number.isFinite(row.values[i]));
   const last=rows.at(-1);
   if(!last)return `<article class="dashboard-card"><h3>${id}</h3><p class="empty">Weekly FX unavailable.</p></article>`;
   const points=rows.map(row=>[row.week_ending,row.values[i]]);
   return `<article class="dashboard-card"><div class="eyebrow">FX · WEEK ENDING FRIDAY</div><h3>${id}</h3><p class="dashboard-value">${number(last.values[i],4)} <small>${E(s.unit)}</small></p><p class="observation-date">Observation date ${E(date(last.date))}</p>${D.spark(points,s.unit)}<p class="fine">${s.formula?`Same-date cross from ${E(s.formula)}.`:'New York noon reference rate.'}</p>${link(s.source_url||s.source_urls?.[0],'FRED source')}</article>`;
  }
  const s=d.series.find(s=>s.id===id),p=s?.points?.slice(s.frequency==='daily'?-260:-60)||[],last=p.at(-1);if(!last)return `<article class="dashboard-card"><h3>${id}</h3><p class="empty">Saved FX observations unavailable.</p></article>`;
  return `<article class="dashboard-card"><div class="eyebrow">FX · ${s.frequency==='daily'?'DAILY REFERENCE':'MONTHLY HISTORY'}</div><h3>${id}</h3><p class="dashboard-value">${number(last[1],4)} <small>${E(s.unit)}</small></p><p class="observation-date">${s.frequency==='daily'?'Observation date: '+E(date(last[0])):'Observation month: '+E(last[0].slice(0,7))}</p>${D.spark(p,s.unit)}<p class="fine">${E(s.frequency==='daily'?(s.formula||s.basis):s.aggregation||'Ratio of monthly averages.')} ${s.frequency==='daily'?'Daily reference observations published weekly; not a live quote. Retrieved '+E(d.retrieved_at):'Monthly averages, not live spot rates.'}</p>${link('fred-feed.html','Daily FX history & CSV →')} · ${link(s.source_url||s.source_urls?.[0]||'v4.html#history/fx','Source ↗')}</article>`;
 }).join('');
 }catch{$('#dashboard-fx').innerHTML='<p class="empty">Saved FX file unavailable. No spot rates inferred.</p>';}}
async function loadIndices(){await root.MarketPrices.refresh();for(const [ticker,title] of [['SPY','SPY · S&P 500 ETF'],['QQQ','QQQ · Nasdaq-100 ETF'],['^STI','STI · Straits Times Index']]){
 const id='dashboard-index-'+ticker.replace(/\W/g,''),el=document.getElementById(id);try{
 const s=await root.MarketPrices.series(ticker),start=new Date(Date.parse(s.quote.date+'T12:00:00Z')-366*86400000).toISOString().slice(0,10),points=root.MarketPrices.selectPoints(s.base,s.daily,start,s.quote.date),unit=root.MarketPrices.displayUnit(s.item);
 el.innerHTML=`<div class="eyebrow">ETF / INDEX · PRICE HISTORY</div><h3>${E(title)}</h3><p class="dashboard-value">${number(s.quote.close)} <small>${E(unit)}</small></p><p class="observation-date">${E(date(s.quote.date))} · ${E(root.MarketPrices.quoteStatus(s.quote))}</p>${D.spark(points,unit)}<p class="fine">${E(root.MarketPrices.priceBasis(s.item))}</p>${link(s.item.history_url,'Original price source ↗')} · ${link('v4.html#history/shares','Open full share history →')}`;
 }catch{el.innerHTML=`<h3>${E(title)}</h3><p class="empty">This exact listing is unavailable in the saved feed. No ETF or index is substituted.</p>`;}
 }}
async function mount(){D??=root.Desk;if(!D||!$('#dashboard-curves'))return;await Promise.allSettled([loadCurves(),loadFX(),loadIndices()]);}
root.DeskDashboard={mount,curve};if(typeof module!=='undefined')module.exports={curve,wsjObservations,wsjCurveCard};
})(typeof window!=='undefined'?window:globalThis);
