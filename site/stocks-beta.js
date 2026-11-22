/* Additive company workspace. Uses the existing validated readers; no stored portfolio state. */
(function(root){'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>typeof n==='number'&&Number.isFinite(n),num=(n,d=2)=>finite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d===2?2:0}):'Unavailable';
const sigma=root.FredSigma||(typeof module!=='undefined'?require('./fred/sigma.js'):null);
const DEFAULT_YEARS=Object.freeze({from:2017,to:null});
const MIN_YEAR=2000;
const yearsKey='mih:stocks-beta:history-years';
const presetDays={'1M':31,'3M':93,'1Y':366,'5Y':1830};
const ratioLabels={pe:'Forward P/E',pb:'Forward P/B'};
const minimumSigmaSample=12;
const isoDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

function historyYears(value, year) {
  const valid=number=>Number.isInteger(number)&&number>=MIN_YEAR&&number<=year;
  const from=valid(value?.from)?value.from:DEFAULT_YEARS.from;
  const to=valid(value?.to)?Math.max(from,value.to):null;
  return {from,to};
}

function historyBounds(years, latest, period='Global') {
  if(period==='All')return {from:MIN_YEAR+'-01-01',to:latest};
  if(Object.hasOwn(presetDays,period))return {
    from:new Date(Date.parse(latest)-presetDays[period]*86400000).toISOString().slice(0,10),to:latest
  };
  const limit=years.to?years.to+'-12-31':latest;
  return {from:years.from+'-01-01',to:limit<latest?limit:latest};
}

function valuationSigma(archive, valuation, metric, years) {
  const row=valuation?.row;
  if(!finite(row?.[metric])||row[metric]<=0||!isoDate(row.priceAsOf)||!isoDate(valuation.reportDate)
    ||row.priceAsOf>valuation.reportDate)return {reason:'A dated positive BOS forward multiple is needed.'};
  if(!archive||!sigma)return {reason:'The BOS monthly archive is unavailable.'};
  const matches=archive.securities.filter(company=>company.ticker===row.instrumentId&&company.currency===row.currency);
  const offset=archive.metrics.findIndex(([key,,unit])=>key==='forward_'+metric&&unit==='×');
  if(matches.length!==1||offset<0)return {reason:'No matching forward-valuation history for this exact listing.'};
  const {from,to}=historyBounds(years,row.priceAsOf),byDate=new Map();
  for(const observation of matches[0].observations){
    const [,reportDate,date]=archive.months[observation[0]]||[],value=observation[offset+1];
    // The optional final index identifies a different historical listing or source ticker.
    if(observation[archive.metrics.length+1]!=null||!isoDate(date)||!isoDate(reportDate)
      ||date<from||date>to||date>=row.priceAsOf||reportDate>valuation.reportDate||date>reportDate
      ||!finite(value)||value<=0)continue;
    const prior=byDate.get(date);
    if(!prior||reportDate>prior.reportDate)byDate.set(date,{value,reportDate});
  }
  const points=[...byDate].map(([date,{value}])=>[date,value]).sort((a,b)=>a[0].localeCompare(b[0]));
  const calendarYears=Math.max(1,Number(row.priceAsOf.slice(0,4))-years.from+1);
  const result=sigma.analyze([...points,[row.priceAsOf,row[metric]]],{years:calendarYears,minN:minimumSigmaSample}).at(-1);
  return {...result,first:points[0]?.[0],last:points.at(-1)?.[0]};
}
const pct=n=>finite(n)?(n>0?'+':'')+num(n)+'%':'Unavailable';
const day=s=>s&&Number.isFinite(Date.parse(s))?new Date(s.length===10?s+'T12:00:00Z':s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Singapore'}):'Date not supplied';
const url=s=>{try{const u=new URL(s,'https://notwins.github.io/market-intelligence-hub/');return u.protocol==='https:'&&!u.username&&!u.password&&!['chatgpt.com','chat.openai.com'].includes(u.hostname)?u.href:'';}catch{return '';}};
const link=(u,t)=>url(u)?`<a href="${E(url(u))}" target="_blank" rel="noopener noreferrer">${E(t)} ↗</a>`:'';
const sharedReading = typeof module !== 'undefined' ? require('./stock-card-reading.js') : root.StockCardReading;
const { newsFor } = sharedReading;
function previousQuote(quote,price,bos){const points=quote?.sourceId==='bos'?bos?.points:price?.daily;const prior=(points||[]).filter(p=>p[0]<quote?.date&&finite(p[1])&&p[1]>0).at(-1);return prior?{date:prior[0],value:prior[1],source:quote.sourceLabel,change:finite(quote.close)?quote.close-prior[1]:null,pct:finite(quote.close)?(quote.close/prior[1]-1)*100:null}:null;}
function findRecord(records,item,valuation,enrichment){const bb=valuation?.row?.instrumentId||enrichment?.bbTicker;const rows=records.filter(r=>r.currentEligible!==false&&r.identityStatus!=='conflict'&&r.currency===item.currency&&(bb?r.bbTicker===bb:item.isin?r.isin===item.isin:r.ticker===item.ticker));return rows.length===1?rows[0]:null;}
function valuationPoints(points,metric,current){const map=new Map();for(const p of points||[]){if(!p.date||!finite(p.value)||p.value<=0)continue;const old=map.get(p.date);if(!old||String(p.reportDate||'')>=String(old.reportDate||''))map.set(p.date,p);}const row=current?.row;if(row?.priceAsOf&&finite(row[metric])&&row[metric]>0)map.set(row.priceAsOf,{date:row.priceAsOf,value:row[metric],source:'Bank of Singapore',sourceUrl:current.sourceUrl,reportDate:current.reportDate,basis:current.basis});return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function rebase(series){if(!series.length||series.some(s=>!s.points.length))return {series:[],reason:'At least one selected series has no observations in this window.'};const date=series[0].points.map(p=>p[0]).find(d=>series.every(s=>s.points.some(p=>p[0]===d&&finite(p[1])&&p[1]>0)));if(!date)return {series:[],reason:'No common observed date across these series. Choose a longer window or remove a series.'};return {date,series:series.map(s=>{const base=s.points.find(p=>p[0]===date)[1];return {...s,base,points:s.points.filter(p=>p[0]>=date).map(p=>[p[0],p[1]/base*100])};})};}
function priceCurve(points) {
  if (!points.length) return '';
  const intervals = points.slice(1).map(([x, y], i) => {
    const [previousX, previousY] = points[i];
    const width = x - previousX;
    return { width, slope: width > 0 ? (y - previousY) / width : 0 };
  });
  // Use a local, shape-preserving tangent. A price reversal gets a flat tangent.
  const tangents = points.map((_, i) => {
    const before = intervals[i - 1], after = intervals[i];
    if (!before || !after) return (before ?? after)?.slope ?? 0;
    if (!before.slope || !after.slope || Math.sign(before.slope) !== Math.sign(after.slope)) return 0;
    const w1 = 2 * after.width + before.width, w2 = after.width + 2 * before.width;
    return (w1 + w2) / (w1 / before.slope + w2 / after.slope);
  });
  const pair = (x, y) => x.toFixed(2) + ',' + y.toFixed(2);
  const segments = ['M' + pair(...points[0])];
  intervals.forEach(({ width }, i) => {
    const [x1, y1] = points[i], [x2, y2] = points[i + 1];
    if (width <= 0 || points.length === 2) {
      segments.push('L' + pair(x2, y2));
      return;
    }
    const third = width / 3;
    const lower = Math.min(y1, y2), upper = Math.max(y1, y2);
    const bound = y => Math.max(lower, Math.min(upper, y));
    segments.push('C' + pair(x1 + third, bound(y1 + third * tangents[i])) + ' '
      + pair(x2 - third, bound(y2 - third * tangents[i + 1])) + ' ' + pair(x2, y2));
  });
  return segments.join(' ');
}
function plot(series,{from,to,title,unit,events=[],width=840}){const all=series.flatMap(s=>s.points);if(!all.length)return `<div class="sb-empty">${E(title)} · no observations in this window.</div>`;let lo=Math.min(...all.map(p=>p[1])),hi=Math.max(...all.map(p=>p[1]));const pad=(hi-lo||Math.abs(hi)*.05||1)*.1;lo-=pad;hi+=pad;const a=Date.parse(from),b=Date.parse(to),w=Math.max(250,Math.min(1100,width)),left=w<480?44:62,right=w-24,x=d=>left+(Date.parse(d)-a)/(b-a||1)*(right-left),y=v=>210-(v-lo)/(hi-lo)*175;
const drawings = series.map(s => {
  const crowded = !s.dots && s.points.length * 7 > right - left;
  const line = s.dots ? '' : `<path class="sb-price-curve" stroke="${s.color}" fill="none" stroke-width="2.2" vector-effect="non-scaling-stroke" d="${priceCurve(s.points.map(([date, value]) => [x(date), y(value)]))}"/>`;
  const markers = s.points.map(([date, value]) =>
    `<circle cx="${x(date)}" cy="${y(value)}" r="${s.dots ? 3.4 : 1.9}" fill="${s.color}" tabindex="-1"${crowded ? ' opacity="0" pointer-events="all"' : ''}><title>${E(s.name + ' · ' + date + ' · ' + num(value, 4) + ' ' + unit)}</title></circle>`
  ).join('');
  return line + markers;
}).join('');
return `<div class="sb-plot"><h4>${E(title)} <small>· ${E(unit)}</small></h4><svg class="sb-chart" viewBox="0 0 ${w} 252" role="img" aria-label="${E(title+' · '+unit+' · '+from+' to '+to)}"><title>${E(title)}. Exact dated values are in the evidence table. Valuation dots do not fill missing dates.</title>${[0,.5,1].map(t=>{const v=lo+t*(hi-lo);return `<line class="grid" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${E(num(v,1))}</text>`;}).join('')}${events.filter(e=>e.date>=from&&e.date<=to).map(e=>`<g><title>${E(e.label+' · '+e.date)}</title><line x1="${x(e.date)}" x2="${x(e.date)}" y1="25" y2="210" stroke="#8d7c9d" stroke-dasharray="3 5"/><text x="${x(e.date)}" y="18" text-anchor="middle">E</text></g>`).join('')}${drawings}<text x="${left}" y="240">${E(from)}</text><text x="${right}" y="240" text-anchor="end">${E(to)}</text></svg><div class="sb-legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${E(s.name)}${s.dots?' · source observations':''}</span>`).join('')}</div></div>`;}
const MAX_CARDS = 10;
const DEFAULT_WATCHLIST = (typeof module !== 'undefined' ? require('./share-card-watchlist.js') : root.ShareCardWatchlist).tickers;

function startingSelection(params, listings) {
  const requested = params.get('companies') ?? params.get('company');
  const tickers = new Set(listings.map(item => item.ticker));
  function exactTicker(symbol) {
    if (tickers.has(symbol)) return symbol;
    const matches = listings.filter(item => item.aliases?.includes(symbol));
    return matches.length === 1 ? matches[0].ticker : null;
  }
  const candidates = requested === null ? DEFAULT_WATCHLIST : requested.split(',').map(ticker => ticker.trim());
  return [...new Set(candidates.map(exactTicker).filter(Boolean))].slice(0, MAX_CARDS);
}

function companySearchText(item,logo) {
  return [item.ticker,item.name,...(item.aliases||[]),logo?.name,...(logo?.names||[])].filter(Boolean).join(' ').toUpperCase();
}
const api={newsFor,previousQuote,findRecord,valuationPoints,rebase,plot,startingSelection,historyYears,historyBounds,valuationSigma,companySearchText};root.StocksBeta=api;if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
const $=s=>document.querySelector(s),state={selected:[],initialized:false,columns:1,loading:false},cards=new Map(),settings=new Map();let bundle={},desk={watchlist:[],reports:[],news:[]},resources={},identities=[],logos=null,reports=[],news=[],warnings=[],instruments=[],monthlyHistory=null;
const currentYear=new Date(Date.now()+8*3600000).getUTCFullYear();
let savedYears;
try{savedYears=JSON.parse(root.localStorage.getItem(yearsKey));}catch{}
state.years=historyYears(savedYears,currentYear);
const config=t=>{if(!settings.has(t))settings.set(t,{period:'Global',mode:'stacked',pb:false,benchmark:'',events:true});return settings.get(t);};
async function get(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!r.ok)throw Error(path+' unavailable');return await r.json();}finally{clearTimeout(timer);}}
function publicTicker(item){return desk.watchlist.find(r=>[item.ticker,...(item.aliases||[])].includes(r.ticker))?.ticker||item.ticker;}
async function hydrate(ticker){const item=root.MarketPrices.resolve(ticker)||root.BOSEquity.itemFor(ticker);if(!item)throw Error('Exact listing is unavailable.');const val=root.BOSEquity.valuationFor(item),enrichment=root.ShareEnrichment.find(item),record=findRecord(root.ShareLabData.records(),item,val,enrichment);
const settled=await Promise.allSettled([root.MarketPrices.series(ticker),root.BOSEquity.priceHistoryFor(item),record?root.ShareLabData.historyFor(record):Promise.resolve(null)]);const value=i=>settled[i].status==='fulfilled'?settled[i].value:null;const price=value(0),bos=value(1),history=value(2),q=root.MarketPrices.currentQuote(item),symbol=publicTicker(item);const c={ticker,symbol,item,record,val,price,bos,history,q,previous:previousQuote(q,price,bos),earnings:root.EquityResearchData.earningsFor(item,bundle),returns:root.ShareEnrichment.returnsFor(item),enrichment,errors:settled.filter(r=>r.status==='rejected').map(r=>r.reason.message)};
c.pe=valuationPoints(history?.metrics.pe,'pe',val);c.pb=valuationPoints(history?.metrics.pb,'pb',val);cards.set(ticker,c);return c;}
function metric(label,value,unit=''){return `<div><dt>${E(label)}</dt><dd>${E(finite(value)?num(value)+(unit||''):value||'Unavailable')}</dd></div>`;}
function sigmaMarkup(c,metric,open=false) {
  const result=valuationSigma(monthlyHistory,c.val,metric,state.years);
  const direction=result.z>0?'above':result.z<0?'below':'at';
  const sign=result.z<0?'−':result.z>0?'+':'';
  const display=finite(result.z)?sign+Math.abs(result.z).toFixed(2)+'σ':'σ unavailable';
  const meaning=finite(result.z)?(direction==='at'?'At the historical mean.':(direction==='above'?'Above':'Below')+' the historical mean.'):result.reason+'.';
  const sample=result.n?'Sample '+result.n+' · '+day(result.first)+' to '+day(result.last)+'.':'';
  const summary='Historical mean '+(finite(result.mean)?num(result.mean)+'×':'unavailable')+' · Sample SD '+(finite(result.sd)?num(result.sd)+'×':'unavailable')+'.';
  return `<details class="sb-sigma"${open?' open':''}><summary aria-label="${E(ratioLabels[metric]+' historical sigma '+display)}"><span class="sb-sigma-badge" data-band="${E(result.band||'unavailable')}" data-direction="${direction}">${display}</span></summary>
    <div class="sb-sigma-detail"><p>${E(meaning)} ${E(summary)}</p>${sample?`<p>${E(sample)}</p>`:''}
    <p><a href="bos-monthly.html">BOS monthly archive</a></p></div></details>`;
}
function valuationTile(c,metric){
  const value=c.val?.row?.[metric];
  return `<div class="sb-valuation-tile"><dt>${ratioLabels[metric]}</dt><dd><span>${finite(value)?num(value)+'×':'Unavailable'}</span><div data-sb-sigma="${metric}">${sigmaMarkup(c,metric)}</div></dd></div>`;
}
function returns(c){const by=new Map(c.returns.map(p=>[String(p.year),p]));return `<section class="sb-return-section"><h3>▥ Year-by-year returns</h3><div class="sb-return-grid">${Array.from({length:8},(_,i)=>{const year=String(2019+i),p=by.get(year);return `<div class="${!finite(p?.value)?'missing':p.value<0?'negative':'positive'}"><small>${year}${year==='2026'?' YTD · BOS':''}</small><b>${pct(p?.value)}</b></div>`;}).join('')}</div><p class="sb-note">2019–2025: local-currency total returns, gross dividends reinvested, derived from the supplied snapshot. 2026 BOS YTD is incomplete; dividend reinvestment is a site assumption. ${by.get('2026')?.asOf?'YTD as of '+day(by.get('2026').asOf)+'.':'YTD date unavailable.'}</p></section>`;}
function sources(c){const r=c.val?.row,m=root.MorningstarLinks.resolve(c.symbol),saved=resources[c.symbol],current=r?.researchReportUrl;return `<nav class="sb-links" aria-label="${E(c.ticker)} research and sources">${current?link(current,'BOS-hosted '+(r.researchProvider||'research')+' report · '+(r.analystReportMonth||'date in PDF')):''}${link(m?.url,'Morningstar')}${link(c.earnings.observations[0]?.source_details?.url,'Issuer earnings release')}${link(c.val?.sourceUrl,'BOS coverage · '+day(c.val?.reportDate))}${!current&&saved?link(saved.url,'Saved BOS-hosted report · '+day(saved.report_date)):''}<a href="search.html?q=${encodeURIComponent(c.symbol)}">All research mentions →</a></nav>${current&&saved&&current!==saved.url?`<details class="sb-note"><summary>Earlier saved research link</summary>${link(saved.url,'BOS-hosted Morningstar · '+day(saved.report_date))}<p>The earnings directory has an older link. The current coverage link above retains its own research month; the precise report date is inside the PDF.</p></details>`:''}`;}
function quote(c){const p=c.previous,q=c.q;return `<div class="sb-price"><strong>${num(q.close)} <small>${E(c.item.currency)}</small></strong><span class="sb-change ${p?.change<0?'negative':'positive'}">${p?`${pct(p.pct)} · ${num(p.change)} ${E(c.item.currency)}`:'Previous comparable price unavailable'}</span><small>${E(q.sourceLabel)} · ${day(q.date)}${q.current===false?' · dated reference':''}</small><small>${p?'Previous available '+E(p.source)+' price: '+num(p.value)+' · '+day(p.date):'No same-source prior observation loaded.'}</small>${q.sourceUrl?link(q.sourceUrl,'Price source'):''}</div>`;}
function fundamentals(c){const r=c.val?.row||{},identity=identities.find(i=>i.ticker===c.symbol),cf=c.earnings.cashflows||[];return `<details class="sb-details" id="fundamentals-${E(c.ticker)}"><summary>Company fundamentals · all available fields</summary><div><p class="sb-note">BOS observations: ${day(r.priceAsOf)} · coverage publication: ${day(c.val?.reportDate)} · page ${E(r.sourcePage||'not supplied')}. ${E(c.val?.basis||'No matched valuation source.')} Forward estimates have no specified forecast horizon.</p><dl class="sb-fundamentals">${metric('Forward P/E',r.pe,'×')}${metric('Forward P/B',r.pb,'×')}${metric('Market cap · USD bn',r.marketCapUsdBillions)}${metric('Forward dividend yield',r.dividendYieldPct,'%')}${metric('Forward EPS growth',r.epsGrowthPct,'%')}${metric('Forward return on equity',r.roePct,'%')}${metric((r.researchProvider||'Analyst')+' '+(r.fairValueOrTargetKind==='fair_value'?'fair value':'target / fair value'),finite(r.fairValueOrTargetPrice)?num(r.fairValueOrTargetPrice)+' '+c.item.currency:null)}${metric('Publisher upside estimate',r.upsidePct,'%')}${metric('Publisher rating · opinion',r.rating)}${metric('Economic moat · opinion',r.moat)}${metric('Uncertainty · opinion',r.uncertaintyRating)}${metric('BOS risk rating',r.riskRating)}${metric('Sector',r.sector||c.record?.sector)}${metric('Industry',c.record?.industry)}${metric('Listing exchange',identity?.us_listing_exchange||c.record?.exchange)}${metric('Listing currency',c.item.currency)}${metric('ISIN',identity?.isin||c.record?.isin)}${metric('Research month',r.analystReportMonth)}${metric('Research provider',r.researchProvider)}${metric('Latest indexed announcement',c.record?.latestAnnouncementDate?day(c.record.latestAnnouncementDate):null)}${metric('Expected report · snapshot',c.record?.expectedReportDate?day(c.record.expectedReportDate):null)}</dl><p class="sb-note">Analyst fair values, targets, ratings and upside are publisher opinions, not assured returns. Expected report dates are saved snapshot estimates; verify with the issuer.</p><h4>Cash generation · selected reported quarters</h4>${cf.length?cf.map(f=>`<p>${E(f.period)} · ended ${day(f.period_end)}</p><dl class="sb-fundamentals">${metric('Operating cash flow · US$bn',f.operating_cash_flow_usd_bn)}${metric('Capital expenditure · US$bn',f.capex_usd_bn)}${metric('Other adjustment · US$bn',f.other_adjustment_usd_bn)}${metric('Free cash flow · US$bn',f.fcf_usd_bn)}</dl><p class="sb-note">${E(f.definition)} ${E(f.note)} ${link(f.source_details?.url,'Source')}</p>`).join(''):`<p class="sb-empty">No indexed cash-flow figures. ${E(c.earnings.cashflow_note)}</p>`}<h4>Credit ratings · historical snapshot</h4><p class="sb-note">Rating observation dates were not supplied. Ratings below are not labelled current.</p>${(c.enrichment?.credit||[]).filter(r=>r.raw).map(r=>`<p class="sb-note"><b>${E(r.agency+' · '+r.raw)}</b> · ${E(r.scope)} · ${E(r.status)}</p>`).join('')||'<p class="sb-empty">No matched rating snapshot.</p>'}<p class="sb-warning">Not supplied: complete financial statements, cash and debt balances, shares outstanding, trailing P/E and a complete consensus history. These fields remain unavailable.</p>${r.raw?`<details><summary>Original source cells</summary><div class="sb-table-wrap" tabindex="0"><table><caption>Unrounded source text · BOS coverage page ${E(r.sourcePage)}</caption><tbody>${Object.entries(r.raw).map(([k,v])=>`<tr><th>${E(k)}</th><td>${E(v)}</td></tr>`).join('')}</tbody></table></div></details>`:''}</div></details>`;}

function reading(c) {
  return sharedReading.reading({
    matches: sharedReading.reportRows(reports, c.symbol, logos),
    items: newsFor(news, c.symbol),
    listing: c.item?.ticker || c.symbol,
    afterSi: `<details class="sb-details" data-archive><summary>All reviewed watchlist write-ups &amp; saved returns</summary><div data-archive-body><p class="sb-note">Open to load the dated research archive.</p></div></details><p class="sb-note"><a href="v4.html#watchlist">Open dated watchlist research editions →</a></p>`
  });
}
function chartSection(c){const s=config(c.ticker);return `<section class="sb-section"><h3>Explore price &amp; valuation</h3><div class="sb-chart-controls"><div class="sb-periods" role="group" aria-label="${E(c.ticker)} chart period">${['Global','1M','3M','1Y','5Y','All'].map(p=>`<button type="button" data-period="${p}" aria-pressed="${p===s.period}">${p==='Global'?'Global range':p}</button>`).join('')}</div><label>Chart mode<select data-setting="mode" aria-label="${E(c.ticker)} chart mode"><option value="stacked" ${s.mode==='stacked'?'selected':''}>Price above P/E</option><option value="overlay" ${s.mode==='overlay'?'selected':''}>Overlay · indexed to 100</option></select></label><label>Price comparison<select data-setting="benchmark" aria-label="${E(c.ticker)} price comparison"><option value="">No comparison</option>${['SPY','QQQ',...state.selected.filter(t=>t!==c.ticker&&!['SPY','QQQ'].includes(t))].map(t=>`<option value="${E(t)}" ${s.benchmark===t?'selected':''}>${E(t)}</option>`).join('')}</select></label><label><input type="checkbox" data-setting="pb" ${s.pb?'checked':''}> Include P/B</label><label><input type="checkbox" data-setting="events" ${s.events?'checked':''}> Earnings dates</label></div><div data-charts><p class="sb-note">Loading chart observations…</p></div></section>`;}
function listingLogo(item, ticker) {
  if(!logos||!root.CompanyLogos)return null;
  for(const key of [ticker,item?.ticker,...(item?.aliases||[])]){
    const logo=root.CompanyLogos.resolve(key,logos);
    if(logo)return logo;
  }
  return null;
}
function stockBadge(card,size) {
  const logo=listingLogo(card.item,card.symbol);
  return logo?root.CompanyLogos.html([logo.ticker],logos,{size}):'';
}
function chipBadge(ticker) {
  const card=cards.get(ticker);
  const logo=listingLogo(card?.item||instruments.find(item=>item.ticker===ticker),card?.symbol||ticker);
  return logo?root.CompanyLogos.html([logo.ticker],logos,{size:24}):
    '<span class="sb-chip-mark" aria-hidden="true">'+E(ticker.slice(0,2))+'</span>';
}
function stockColor(sector) {
  if (/tech|software|semi|communication/i.test(sector)) return 'technology';
  if (/financ|bank|insurance/i.test(sector)) return 'finance';
  if (/care|health|pharma/i.test(sector)) return 'health';
  if (/energy|material|utility|industrial/i.test(sector)) return 'industry';
  if (/consumer|retail|staple/i.test(sector)) return 'consumer';
  return 'other';
}
function renderCard(c) {
  const r=c.val?.row||{},logo=stockBadge(c,40),name=c.record?.name||c.item.name;
  const compactName=listingLogo(c.item,c.symbol)?.name||c.item.name||name;
  const sector=r.sector||c.record?.sector||'',id=encodeURIComponent(c.ticker),expanded=Boolean(config(c.ticker).expanded);
  const description=c.record?.description
    ? `<p class="sb-description">${E(c.record.description)} ${link(c.record.descriptionSourceUrl,'Company profile')}</p>`
    : '';
  const warnings=c.errors.length
    ? `<p class="sb-warning">Some data could not load: ${E(c.errors.join(' · '))}. Available sections remain visible.</p>`
    : '';
  return `<article class="sb-card" data-stock="${E(c.ticker)}" data-sector-tone="${stockColor(sector)}" ${expanded?'data-expanded-card ':''}data-company-logo-manual aria-label="${E(c.ticker)} all-in-one stock card">
    <header class="sb-card-head"><div class="sb-company-overview"><div class="sb-identity">
      ${logo||'<span class="sb-stock-mark" aria-hidden="true">'+E(c.symbol.slice(0,4))+'</span>'}
      <div><span class="sb-ticker">${E(c.ticker)}</span> <span class="sb-currency">${E(c.item.currency)}</span>
      <h2><span class="sb-title-full">${E(name)}</span><span class="sb-title-compact">${E(compactName)}</span></h2>
      <p>${E(sector||'Sector not supplied')}${c.record?.exchange?' · '+E(c.record.exchange):''}</p></div>
    </div></div>${quote(c)}</header>
    <div class="sb-card-body">
      <div class="sb-card-profile" id="sb-profile-${id}">
        ${description}${root.ShareStaticData?.html(c.record||c.item,{description:!c.record?.description})||''}
        ${sources(c)}
      </div>
      <dl class="sb-metrics">${valuationTile(c,'pe')}${valuationTile(c,'pb')}
        ${metric('Market cap · USD bn',r.marketCapUsdBillions)}${metric('Forward dividend yield',r.dividendYieldPct,'%')}
        ${metric('Latest indexed revenue · US$bn',c.earnings.observations[0]?.revenue_usd_bn)}${metric('Latest indexed EPS',c.earnings.observations[0]?.eps)}
      </dl>
      <p class="sb-compact-date">${r.priceAsOf?'BOS ratios · '+E(day(r.priceAsOf)):'BOS ratio date unavailable'}</p>
      <button class="sb-card-expand" type="button" data-expand-stock aria-expanded="${expanded}"
        aria-controls="sb-profile-${id} sb-extra-${id}"><span>${expanded?'Compact card':'Full card'}</span><span class="sb-sr-only"> for ${E(c.ticker)}</span></button>
      <div class="sb-card-extra" id="sb-extra-${id}">
        <p class="sb-note">Valuations: ${day(r.priceAsOf)} · consensus forward estimates, forecast horizon unspecified. Revenue / EPS: ${E(c.earnings.observations[0]?.period||'not indexed')} · ${E(c.earnings.company?.eps_basis||'basis unavailable')}. These are separate reporting dates.</p>
        ${returns(c)}${chartSection(c)}${fundamentals(c)}${root.CompanyFundamentals?.button(c.record||c.item)||''}<div data-credit-listing="${E(c.ticker)}"></div>
        ${sharedReading.earnings(c.ticker, c.earnings, bundle)}${reading(c)}${warnings}${root.NvdaArticle?.link(c.ticker)||''}
      </div>
    </div>
  </article>`;
}
const benchmarks=new Map();
let archivePromise=null;
async function archives(){if(!archivePromise)archivePromise=(async()=>{const [index,review,latest]=await Promise.all([get('data/watchlist/index.json'),get('data/watchlist/research-index.json'),get('data/watchlist/latest.json')]);const valid=(index.editions||[]).filter(e=>/^watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?$/.test(e.id)&&e.path==='data/watchlist/archive/'+e.id+'.json');const result=await Promise.allSettled(valid.map(async e=>{const d=await get(e.path);if(d.id!==e.id||d.as_of!==e.as_of)throw Error('Archive identity mismatch');return d;}));return {review:review.editions||{},latest,editions:result.filter(r=>r.status==='fulfilled').map(r=>r.value),missing:result.filter(r=>r.status==='rejected').length};})().catch(e=>{archivePromise=null;throw e;});return archivePromise;}
async function archivedReading(details){const ticker=details.closest('[data-stock]').dataset.stock,c=cards.get(ticker),host=details.querySelector('[data-archive-body]');if(!host||host.dataset.loaded)return;host.innerHTML='<p class="sb-note">Loading reviewed research editions…</p>';try{const a=await archives(),items=new Map();for(const d of a.editions.sort((x,y)=>y.as_of.localeCompare(x.as_of)))for(const r of root.MarketWatchlistReports.reviewedItems(d,c.symbol,a.review,'company')){const k=root.MarketWatchlistReports.contentKey(r);if(!items.has(k))items.set(k,r);}const saved=a.latest.rows?.find(r=>r.ticker===c.symbol);host.innerHTML=(a.missing?`<p class="sb-warning">${a.missing} archive files could not load. This list is incomplete.</p>`:'')+[...items.values()].map(r=>`<article class="sb-report"><div class="sb-meta">${day(r.date)}</div><h4>${E(r.headline)}</h4><h4>Reported facts</h4><ul>${r.facts.map(f=>`<li>${E(f)}</li>`).join('')}</ul>${[['Analysis',r.analysis],['Risks',r.risks],['Next to watch',r.next_watch]].map(([label,text])=>`<h4>${E(label)}</h4><p>${E(text)}</p>`).join('')}<p>${r.sources.map(s=>link(s.url,s.title)).join(' · ')}</p></article>`).join('')+(!items.size?'<p class="sb-empty">No reviewed company-specific narrative in the available editions.</p>':'')+(saved?`<h4>Saved research-edition returns · ${day(saved.price.as_of)}</h4><p class="sb-note">Historical snapshot. These are cumulative adjusted-close returns, separate from current prices and annual tiles.</p><div class="sb-table-wrap" tabindex="0"><table data-tc-layout="stock-saved-returns"><caption>Historical adjusted-close endpoints · saved edition ${day(a.latest.as_of)}</caption><thead><tr><th>Horizon</th><th>Base date</th><th>Base adjusted close</th><th>End adjusted close</th><th>Return</th></tr></thead><tbody>${saved.returns.map(r=>`<tr><th>${r.months} months</th><td>${E(r.base_date)}</td><td>${num(r.base_adjusted_close)}</td><td>${num(saved.price.adjusted_close)}</td><td>${pct(r.pct)}</td></tr>`).join('')}</tbody></table></div>`:'');host.dataset.loaded='true';}catch{host.innerHTML='<p class="sb-warning">Reviewed watchlist archive unavailable. Close and reopen to retry.</p>';}}
async function draw(c){const host=$(`[data-stock="${CSS.escape(c.ticker)}"] [data-charts]`);if(!host?.clientWidth)return;const s={...config(c.ticker)},signature=JSON.stringify([s,state.years,host.clientWidth]);host.dataset.request=signature;
const latest=[c.price?.quote?.date,c.q.date,c.val?.row?.priceAsOf].filter(isoDate).sort().at(-1)||new Date().toISOString().slice(0,10);
const {from,to}=historyBounds(state.years,latest,s.period);
const price=c.price?root.MarketPrices.selectPoints(c.price.base,c.price.daily,from,to):[],pe=c.pe.filter(p=>p.date>=from&&p.date<=to),pb=c.pb.filter(p=>p.date>=from&&p.date<=to);let series=[{name:c.ticker+' price',points:price,color:'#126c66'}],failure='';
if(s.benchmark)try{if(!benchmarks.has(s.benchmark))benchmarks.set(s.benchmark,root.MarketPrices.series(s.benchmark));const v=await benchmarks.get(s.benchmark);series.push({name:s.benchmark+' price',points:root.MarketPrices.selectPoints(v.base,v.daily,from,to),color:'#b06f2d',unit:v.item.currency,source:v.item.provider,sourceUrl:v.item.history_url});}catch{benchmarks.delete(s.benchmark);failure='Comparison price unavailable.';}
const start=s.period==='All'?[...price.map(p=>p[0]),...pe.map(p=>p.date),...(s.pb?pb.map(p=>p.date):[])].sort()[0]||from:from,events=s.events?c.earnings.events:[],opts={from:start,to,events,width:host.clientWidth-22},peLine={name:c.ticker+' forward P/E',points:pe.map(p=>[p.date,p.value]),color:'#746390',dots:true},pbLine={name:c.ticker+' forward P/B',points:pb.map(p=>[p.date,p.value]),color:'#b25570',dots:true};let charts='',note='';
if(s.mode==='overlay'){const rebased=rebase([...series,peLine,...(s.pb?[pbLine]:[])]);charts=rebased.series.length?plot(rebased.series,{...opts,from:rebased.date,title:'Price and valuation · relative change',unit:'common observed date = 100'}):`<p class="sb-empty">${E(rebased.reason)}</p>`;note=rebased.date?'Rebased on '+day(rebased.date)+'. Each series starts at 100. Values show relative change, not dollars or valuation multiples.':rebased.reason;}
else{if(series.length>1){const rebased=rebase(series);charts=rebased.series.length?plot(rebased.series,{...opts,title:'Price comparison',unit:'common observed date = 100'}):`<p class="sb-empty">${E(rebased.reason)}</p>`;note='Comparison prices are indexed to 100 on a shared observed date. Local currency, no FX conversion.';}else charts=plot(series,{...opts,title:c.ticker+' price',unit:c.item.currency});charts+=plot([peLine],{...opts,title:'Forward P/E',unit:'times earnings'});if(s.pb)charts+=plot([pbLine],{...opts,title:'Forward P/B',unit:'times book value'});}
const evidence=[...price.map(p=>({date:p[0],metric:'Price',value:p[1],unit:c.item.currency,source:c.price?.item.provider||'Historical feed',sourceUrl:c.price?.item.history_url,reportDate:null})),...series.slice(1).flatMap(s=>s.points.map(p=>({date:p[0],metric:s.name,value:p[1],unit:s.unit,source:s.source,sourceUrl:s.sourceUrl}))),...pe.map(p=>({...p,metric:'Forward P/E',unit:'×'})),...(s.pb?pb.map(p=>({...p,metric:'Forward P/B',unit:'×'})):[])].sort((a,b)=>b.date.localeCompare(a.date)||a.metric.localeCompare(b.metric));
if(!host.isConnected||host.dataset.request!==signature)return;host.innerHTML=charts+`<p class="sb-note">${E(note)} Price changes exclude dividends. P/E and P/B dots are dated source observations; missing periods are not filled. E marks an indexed issuer release date. ${E(failure)}</p><details class="sb-details"><summary>Chart values &amp; source dates · ${evidence.length} observations</summary><div><p class="sb-note">The selected quote at the top may come from BOS. The price line uses the unchanged historical close feed. Older weekly/monthly prices retain source period labels. Valuation observation dates and report publication dates stay separate.</p><div class="sb-table-wrap" tabindex="0" role="region" aria-label="${E(c.ticker)} chart evidence"><table data-tc-layout="stock-chart-evidence"><caption>Original values before overlay indexing</caption><thead><tr><th>Observation</th><th>Metric</th><th>Value</th><th>Source / report date</th></tr></thead><tbody>${evidence.map(p=>`<tr><td>${E(p.date)}</td><td>${E(p.metric)}</td><td>${num(p.value,4)} ${E(p.unit)}</td><td>${link(p.sourceUrl,p.source)||E(p.source||'Saved history')}<small>${p.reportDate?'Report '+day(p.reportDate):'Report date not applicable / supplied'}</small></td></tr>`).join('')}</tbody></table></div></div></details>`;
}
function picker() {
  if(!instruments.some(item=>item.ticker===companyInput.value))companyInput.value=state.selected[0]||instruments[0]?.ticker||'';
  companyInput.disabled=!instruments.length;
  $('#sb-company-menu').disabled=!instruments.length;
  companyPicker?.update([{label:'Exact stock listings',entries:instruments.map(item=>{
    const logo=listingLogo(item);
    return {ticker:item.ticker,name:item.name+' · '+item.currency,search:companySearchText(item,logo),logo:logo?.file};
  })}]);
  updateAddButton();
}
const companyInput=$('#sb-company');
const companyPicker=root.SISharePicker?.mount($('#sb-toolbar'),{
  escape:E,logoBase:'assets/company-logos/',allowCustom:false
});
function updateAddButton(){
  $('#sb-add').disabled=state.loading||!instruments.some(item=>item.ticker===companyInput.value);
}
const startYear=$('#sb-history-from'),endYear=$('#sb-history-to');
const yearOptions=Array.from({length:currentYear-MIN_YEAR+1},(_,index)=>MIN_YEAR+index);
startYear.replaceChildren(...yearOptions.map(year=>new Option(year,year)));
function paintYearControls(){
  startYear.value=String(state.years.from);
  endYear.replaceChildren(new Option('Latest',''),...yearOptions.filter(year=>year>=state.years.from).map(year=>new Option(year,year)));
  endYear.value=state.years.to===null?'':String(state.years.to);
}
function applyYears(value){
  state.years=historyYears(value,currentYear);
  try{root.localStorage.setItem(yearsKey,JSON.stringify(state.years));}catch{}
  paintYearControls();
  for(const card of document.querySelectorAll('[data-stock]')){
    const current=cards.get(card.dataset.stock);
    if(!current)continue;
    for(const tile of card.querySelectorAll('[data-sb-sigma]')){
      tile.innerHTML=sigmaMarkup(current,tile.dataset.sbSigma,tile.querySelector('details')?.open);
    }
    config(current.ticker).period='Global';
    card.querySelectorAll('[data-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period==='Global')));
    draw(current);
  }
}
paintYearControls();
startYear.addEventListener('change',()=>applyYears({from:Number(startYear.value),to:state.years.to}));
endYear.addEventListener('change',()=>applyYears({from:state.years.from,to:endYear.value?Number(endYear.value):null}));
$('#sb-history-reset').addEventListener('click',()=>applyYears(DEFAULT_YEARS));
function paintWatchlist() {
  const host = $('#sb-watchlist-table'), snapshot = root.ShareSnapshotColumns;
  const rows = state.selected.map(ticker => cards.get(ticker)).filter(Boolean);
  if (!host || !snapshot) return;
  if (!rows.length) { host.innerHTML = ''; return; }
  const columns = snapshot.selection('stocks');
  host.innerHTML = `<section class="sb-watchlist-table" aria-labelledby="sb-watchlist-title">
    <header><h2 id="sb-watchlist-title">Share comparison</h2>${snapshot.button('stocks')}</header>
    ${snapshot.note(columns)}
    <div class="sb-table-wrap" tabindex="0" role="region" aria-label="Share comparison columns">
      <table data-tc-layout="stock-comparison"><thead><tr><th scope="col">Share</th><th scope="col">Selected quote</th>${snapshot.headers(columns)}</tr></thead><tbody>
      ${rows.map(c => `<tr>
        <th scope="row"><span class="sb-comparison-identity">${stockBadge(c,24)}<span><a href="#stock-${encodeURIComponent(c.ticker)}">${E(c.ticker)}</a><small>${E(c.item.name)}</small></span></span></th>
        <td>${finite(c.q.close) ? E(num(c.q.close) + ' ' + c.item.currency) : '—'}<small>${E(c.q.sourceLabel)} · ${E(day(c.q.date))}</small></td>
        ${snapshot.cells(c.item, columns)}
      </tr>`).join('')}
      </tbody></table>
    </div>
  </section>`;
}
function paint(){paintWatchlist();if(!state.loading)$('#sb-status').textContent=`${instruments.length} exact stock listings available · ${state.selected.length} cards open · dates shown per source. ${warnings.join(' · ')}`;const opened=new Set([...document.querySelectorAll('[data-stock] details[open]')].map(d=>d.closest('[data-stock]').dataset.stock+'|'+d.querySelector('summary')?.textContent));$('#sb-cards').dataset.columns=state.columns;$('#sb-selected').innerHTML=state.selected.map(t=>`<span class="sb-chip"><a href="#stock-${encodeURIComponent(t)}">${chipBadge(t)}<span>${E(t)}</span></a><button type="button" data-remove="${E(t)}" aria-label="Remove ${E(t)}">×</button></span>`).join('');$('#sb-cards').innerHTML=state.selected.map(t=>cards.has(t)?renderCard(cards.get(t)):`<article class="sb-card" data-stock="${E(t)}"><p class="sb-empty">Loading ${E(t)}…</p></article>`).join('')||'<p class="sb-empty">Choose a company above and add its card.</p>';root.CompanyCredit?.paintCards($('#sb-cards'));for(const el of document.querySelectorAll('[data-stock]')){el.id='stock-'+encodeURIComponent(el.dataset.stock);for(const d of el.querySelectorAll('details'))if(opened.has(el.dataset.stock+'|'+d.querySelector('summary')?.textContent))d.open=true;}for(const t of state.selected)if(cards.has(t))draw(cards.get(t));}
function address(){const params=new URLSearchParams(location.search);params.set('companies',state.selected.join(','));if(state.columns===2)params.set('columns','2');else params.delete('columns');history.replaceState(null,'','?'+params+location.hash);}
async function add(t){if(!t||state.selected.includes(t))return;if(state.selected.length>=MAX_CARDS){$('#sb-status').textContent=`${MAX_CARDS} company cards are open. Remove one before adding another.`;return;}state.selected.push(t);paint();try{await hydrate(t);}catch(e){cards.delete(t);state.selected=state.selected.filter(v=>v!==t);$('#sb-status').textContent=e.message;}paint();address();}
async function load(force=false){if(state.loading)return;state.loading=true;$('#sb-refresh').disabled=true;$('#sb-add').disabled=true;$('#sb-status').textContent='Loading shared saved sources…';warnings=[];
const results=await Promise.allSettled([get('data/desk-data.json'),root.EquityResearchData.load({force}),root.MarketPrices.refresh(force),root.BOSEquity.refresh(force),root.ShareEnrichment.load(),root.ShareLabData.load(force),get('data/watchlist/company-resources.json'),get('data/watchlist/identities.json'),get('assets/company-logos/company-logos.json'),root.ShareStaticData?.load(),get('data/stocks-beta2-monthly-history.json?v=20261121')]);
const val=(i,f)=>results[i].status==='fulfilled'?results[i].value:f;desk=val(0,desk);bundle=val(1,bundle);resources=val(6,{companies:resources}).companies;identities=val(7,{identities}).identities;logos=val(8,logos);const archive=val(10,null);if(archive?.version===1&&Array.isArray(archive.months)&&Array.isArray(archive.metrics)&&Array.isArray(archive.securities))monthlyHistory=archive;results.forEach((r,i)=>{if(r.status==='rejected')warnings.push(['Research catalogue','Earnings','Prices','BOS','Returns','History','Research links','Identity','Logos','Company profiles','Monthly BOS valuations'][i]+' unavailable');});if(!root.ShareLabData.status().loaded)warnings.push('Historical valuation archive unavailable');if(!root.ShareEnrichment.status().loaded)warnings.push('Annual return snapshot unavailable');
instruments=root.MarketPrices.instruments().filter(i=>i.asset_type==='equity').sort((a,b)=>a.ticker.localeCompare(b.ticker));reports=[...(desk.reports||[])];news=[...(desk.news||[])];
const remote=await sharedReading.independentSources(get,desk.watchlist);
if(remote[0].status==='fulfilled'){news=[...news,...remote[0].value.news];if(remote[0].value.delivery_error)warnings.push('Independent news unavailable; saved baseline shown');}else warnings.push('Independent news unavailable; saved baseline shown');
if(remote[1].status==='fulfilled')reports.push(...sharedReading.independentReports(remote[1].value));else warnings.push('Independent research unavailable; saved catalogue shown');
if (!state.initialized) {
  const params = new URLSearchParams(location.search);
  state.columns = params.get('columns') === '2' ? 2 : 1;
  if (instruments.length) {
    state.selected = startingSelection(params, instruments);
    state.initialized = true;
  }
}
benchmarks.clear();await Promise.all(state.selected.map(async t=>{try{await hydrate(t);}catch(e){warnings.push(t+': '+e.message);}}));state.loading=false;$('#sb-refresh').disabled=false;picker();paint();document.querySelectorAll('[data-columns]').forEach(el=>{if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(Number(el.dataset.columns)===state.columns));});$('#sb-status').textContent=`${instruments.length} exact stock listings available · ${state.selected.length} cards open · dates shown per source. ${warnings.join(' · ')}`;}
document.addEventListener('share-snapshot-columns-updated', event => { if (event.detail === 'stocks') paintWatchlist(); });
companyInput.addEventListener('change',updateAddButton);
$('#sb-cards').addEventListener('click',event=>{
  const button=event.target.closest('[data-expand-stock]');
  if(!button)return;
  const card=button.closest('[data-stock]'),ticker=card.dataset.stock;
  const option=config(ticker);
  option.expanded=!option.expanded;
  card.toggleAttribute('data-expanded-card',option.expanded);
  button.setAttribute('aria-expanded',String(option.expanded));
  button.firstElementChild.textContent=option.expanded?'Compact card':'Full card';
  if(option.expanded)draw(cards.get(ticker));
  card.scrollIntoView({block:'start'});
});
$('#sb-add').addEventListener('click',()=>add(companyInput.value));$('#sb-refresh').addEventListener('click',()=>load(true));
document.addEventListener('click',e=>{const remove=e.target.closest('[data-remove]'),columns=e.target.closest('button[data-columns]'),period=e.target.closest('[data-period]');if(remove){state.selected=state.selected.filter(t=>t!==remove.dataset.remove);paint();address();}if(columns){state.columns=Number(columns.dataset.columns);$('#sb-cards').dataset.columns=state.columns;document.querySelectorAll('button[data-columns]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.columns)===state.columns)));for(const t of state.selected)if(cards.has(t))draw(cards.get(t));address();}if(period){const card=period.closest('[data-stock]');config(card.dataset.stock).period=period.dataset.period;card.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===period.dataset.period)));draw(cards.get(card.dataset.stock));}});
document.addEventListener('change',e=>{if(!e.target.matches('[data-setting]'))return;const ticker=e.target.closest('[data-stock]').dataset.stock;config(ticker)[e.target.dataset.setting]=e.target.type==='checkbox'?e.target.checked:e.target.value;draw(cards.get(ticker));});
document.addEventListener('toggle',e=>{if(e.target.matches?.('[data-archive]')&&e.target.open)archivedReading(e.target);},true);
let resizeTimer;root.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{for(const t of state.selected)if(cards.has(t))draw(cards.get(t));},150);});
load().catch(e=>{$('#sb-status').textContent='The workspace could not finish loading: '+e.message;state.loading=false;$('#sb-refresh').disabled=false;});
})(typeof window!=='undefined'?window:globalThis);
