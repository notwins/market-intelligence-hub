/* Six-company dashboard. Dated observations use the existing validated readers. */
(function(root){'use strict';
const companies=[{ticker:'GOOGL',name:'Google',aliases:['Alphabet','Google'],family:'ocean'},
 {ticker:'BABA',name:'Alibaba',aliases:['Alibaba'],family:'cyan'},
 {ticker:'TSM',name:'TSMC',aliases:['TSMC','Taiwan Semiconductor'],family:'violet'},
 {ticker:'NVDA',name:'NVIDIA',aliases:['Nvidia'],family:'violet'},
 {ticker:'AAPL',name:'Apple',aliases:['Apple'],family:'ocean'},
 {ticker:'AMZN',name:'Amazon',aliases:['Amazon'],family:'ocean'}];
const homeAdditions = [
  {ticker:'JPM', name:'JPMorgan Chase', group:'Financials', aliases:['JPMorgan Chase','JPMorgan','JP Morgan'], family:'ocean'},
  {ticker:'WMT', name:'Walmart', group:'Consumer staples', aliases:['Walmart'], family:'cyan'},
  {ticker:'V', name:'Visa', group:'Payments', aliases:['Visa'], family:'violet'}
];
const homeCompanies = [...companies, ...homeAdditions];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const num=(n,d=2)=>finite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d}):'Unavailable';
const day=s=>s&&Number.isFinite(Date.parse(s))?new Date(s.length===10?s+'T12:00:00Z':s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Singapore'}):'Date unavailable';
function safe(s){try{const u=new URL(s,'https://notwins.github.io/market-intelligence-hub/');return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
const link=(u,t)=>safe(u)?`<a href="${E(u)}"${/^https:/.test(u)?' target="_blank" rel="noopener noreferrer"':''}>${E(t)}${/^https:/.test(u)?' ↗':''}</a>`:E(t);
const matches=(r,c)=>r.tickers?.includes(c.ticker)||[...c.aliases,...(c.ticker.length > 1 ? [c.ticker] : [])].some(a=>new RegExp('(^|[^a-z0-9])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z0-9]|$)','i').test([r.title,...(r.tags||[])].join(' ')));
function newsFor(rows,ticker){const unique=new Map();for(const r of rows){if(!r.tickers?.includes(ticker)||!safe(r.href))continue;if(ticker==='AMZN'&&/rainforest|deforestation|tribal|pope|amazon (?:basin|river|region)/i.test(r.title)&&!/(?:Amazon Web Services|AWS|Bezos|Jassy|Amazon\.com)/i.test(r.title))continue;const key=safe(r.href).split('#')[0],old=unique.get(key);if(!old||(Date.parse(r.published_at)||0)>(Date.parse(old.published_at)||0))unique.set(key,r);}return [...unique.values()].sort((a,b)=>(Date.parse(b.published_at)||0)-(Date.parse(a.published_at)||0)).slice(0,2);}
function valuationPoints(points,metric,current){const by=new Map();for(const p of points||[]){if(!p.date||!finite(p.value)||p.value<=0)continue;const old=by.get(p.date);if(!old||String(p.reportDate||'')>=String(old.reportDate||''))by.set(p.date,p);}const r=current?.row;if(r?.priceAsOf&&finite(r[metric])&&r[metric]>0)by.set(r.priceAsOf,{date:r.priceAsOf,value:r[metric],source:'Bank of Singapore',sourceUrl:current.sourceUrl,reportDate:current.reportDate});return [...by.values()].sort((a,b)=>a.date.localeCompare(b.date));}
function chart(points,label,ticker){const p=points.slice(-60),last=p.at(-1);if(!p.length)return `<div class="cd-chart"><h4>${E(label)}</h4><p class="cd-note">No verified observations.</p></div>`;
 const min=Math.min(...p.map(x=>x.value)),max=Math.max(...p.map(x=>x.value)),lo=min-(max-min||1)*.15,hi=max+(max-min||1)*.15,start=Date.parse(p[0].date),end=Date.parse(last.date),x=d=>34+(end===start?86:(Date.parse(d)-start)/(end-start)*172),y=v=>72-(v-lo)/(hi-lo)*52;
 return `<figure class="cd-chart"><figcaption>${E(label)} <strong>${num(last.value,1)}×</strong></figcaption><svg viewBox="0 0 230 104" role="img" aria-label="${E(ticker+' '+label+' source observations, '+p[0].date+' to '+last.date+'. Latest '+num(last.value,2)+' times.')}" focusable="false"><title>${E(label)} · multiples (×). Dots show observed dates; gaps are not filled.</title><line x1="34" x2="206" y1="76" y2="76" stroke="#d6cedd"/><text x="29" y="25" text-anchor="end">${num(max,1)}</text><text x="29" y="72" text-anchor="end">${num(min,1)}</text>${p.map(v=>`<circle cx="${x(v.date).toFixed(2)}" cy="${y(v.value).toFixed(2)}" r="2.5"><title>${E(v.date)} · ${num(v.value,2)}×</title></circle>`).join('')}<text x="34" y="96">${E(p[0].date)}</text><text x="206" y="96" text-anchor="end">${E(last.date)}</text></svg><small>${p.length} observations · to ${E(day(last.date))}</small></figure>`;
}
function combinedChart(pe, pb, ticker) {
  const series = [
    {label:'Forward P/E', key:'pe', points:pe.slice(-60)},
    {label:'Forward P/B', key:'pb', points:pb.slice(-60)}
  ];
  const points = series.flatMap(line => line.points);
  if (!points.length) return '<div class="cd-chart"><h4>Forward valuation</h4><p class="cd-note">No verified observations.</p></div>';

  const dates = points.map(p => Date.parse(p.date));
  const start = Math.min(...dates), end = Math.max(...dates);
  const max = Math.max(...points.map(p => p.value)) * 1.06;
  const x = date => 38 + (start === end ? 0.5 : (Date.parse(date) - start) / (end - start)) * 308;
  const y = value => 112 - value / max * 100;
  const firstYear = new Date(start).getUTCFullYear(), lastYear = new Date(end).getUTCFullYear();
  return `<figure class="cd-chart cd-combined">
    <figcaption>${series.map(line => {
      const last = line.points.at(-1);
      return `<span class="cd-series-${line.key}"><i aria-hidden="true"></i>${line.label} <strong>${last ? num(last.value,1)+'×' : 'Unavailable'}</strong></span>`;
    }).join('')}</figcaption>
    <svg viewBox="0 0 360 136" role="img" aria-label="${E(ticker)} forward P/E and P/B on a shared scale in multiples" focusable="false">
      ${[0, max / 2, max].map(value => `<line class="cd-chart-grid" x1="38" x2="346" y1="${y(value)}" y2="${y(value)}"/><text x="33" y="${y(value)+3}" text-anchor="end">${num(value,1)}×</text>`).join('')}
      ${series.map(line => `<g class="cd-series-${line.key}">
        ${line.points.length > 1 ? `<polyline points="${line.points.map(p => x(p.date).toFixed(2)+','+y(p.value).toFixed(2)).join(' ')}"/>` : ''}
        ${line.points.map(p => `<circle cx="${x(p.date).toFixed(2)}" cy="${y(p.value).toFixed(2)}" r="2.2"><title>${line.label} · ${E(p.date)} · ${num(p.value)}×</title></circle>`).join('')}
      </g>`).join('')}
      <text x="38" y="130">${firstYear}</text>${lastYear !== firstYear ? `<text x="346" y="130" text-anchor="end">${lastYear}</text>` : ''}
    </svg>
    <small>Lines connect observed values. Forecast horizon unspecified.</small>
  </figure>`;
}
const state={loaded:false,loading:false,warnings:[],reports:[],news:[],credit:[],resources:{},cards:new Map(),reportData:new Map(),directory:new Map()};
async function json(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!r.ok)throw Error(path+' unavailable');return await r.json();}finally{clearTimeout(timer);}}
function shell({home = false, cards} = {}) {
  const list = home ? homeCompanies : companies;
  return `<section class="company-dashboard" data-company-dashboard${home ? ' data-home-companies' : ''} aria-labelledby="company-dashboard-title"><header class="cd-heading"><div>${home ? '<h2 id="company-dashboard-title">Company prices &amp; valuations</h2>' : '<p class="cd-eyebrow">YOUR MAIN WATCHLIST</p><h2 id="company-dashboard-title">Six companies. One view.</h2><p>News, research, credit and valuation — with dates at the source.</p>'}</div><div class="cd-heading-actions">${home ? '<a href="stocks-beta.html">Stocks BETA →</a>' : ''}<button type="button" data-company-refresh>${home ? 'Refresh sources' : 'Refresh'}</button></div></header><p class="cd-status" data-company-status role="status">Loading the latest available sources…</p><div ${home ? 'id="market-rows" class="watchlist-grid"' : 'class="cd-grid"'} data-company-grid>${cards ?? list.map(c=>`<article class="cd-card" data-company="${c.ticker}"><h3>${c.name} <small>${c.ticker}</small></h3><p>Loading company sources…</p></article>`).join('')}</div></section>`;
}
function credit(c){const extra=state.reportData.get(c.ticker)?.credit;if(extra)return `<p>${E(extra.spread_description)}</p><p class="cd-note">${E(day(extra.spread_as_of))} · ${link(extra.source,'Credit report · iFAST / FSM')}</p>`;
 const rows=state.credit.filter(r=>c.aliases.some(a=>r.issuer?.toLowerCase()===a.toLowerCase())&&finite(r.issue_spread_bps)).sort((a,b)=>String(b.pricing_date).localeCompare(String(a.pricing_date))),date=rows[0]?.pricing_date,latest=rows.filter(r=>r.pricing_date===date);
 if(!latest.length)return '<p class="cd-note">No verified current issuer spread is connected.</p>';
 const groups=new Map();for(const r of latest){const key=r.currency+' · '+r.spread_basis;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}return [...groups].map(([key,group])=>{const lo=Math.min(...group.map(r=>r.issue_spread_bps)),hi=Math.max(...group.map(r=>r.issue_spread_bps));return `<p><strong>${num(lo,0)}${lo===hi?'':'–'+num(hi,0)} bp</strong> · ${E(key)} · ${group.length} tranche${group.length===1?'':'s'}</p>`;}).join('')+`<p class="cd-note">${E(day(date))} · historical issue pricing, not current OAS. Benchmark conventions stay separate.</p><details><summary>Bond maturities &amp; sources</summary><ul>${latest.map(r=>`<li>${E(r.currency)} · ${E(r.maturity_date)} · +${num(r.issue_spread_bps,1)} bp vs ${E(r.spread_basis)} · ${link(r.source_url,'Pricing terms')}</li>`).join('')}</ul></details>`;
}
function creditLinks(c){const refs=(state.directory.get(c.ticker)?.credit||[]).filter(r=>r.url!==state.reportData.get(c.ticker)?.credit?.source);return refs.slice().sort((a,b)=>String(b.published_date||'').localeCompare(String(a.published_date||''))).slice(0,2).map(r=>`<p>${link(r.url,r.title)}<small class="cd-note"> ${E(r.published_date?day(r.published_date):'Checked '+day(r.verified_at))} · ${E(r.publisher)}</small></p>`).join('');}
function valuationEvidence(ticker, d, label = 'Valuation dates, values &amp; sources') {
  const v = d.valuation || {};
  return `<details class="cd-evidence"><summary>${label}</summary><div class="cd-table" tabindex="0"><table><caption>${E(ticker)} valuation observations · multiples (×)</caption><thead><tr><th>Metric</th><th>Date</th><th>Value</th><th>Source</th></tr></thead><tbody>${['pe','pb'].flatMap(k=>(d[k]||[]).slice(-60).map(p=>`<tr><th>${k==='pe'?'P/E':'P/B'}</th><td>${E(p.date)}</td><td>${num(p.value)}</td><td>${link(p.sourceUrl||v.sourceUrl,p.source||'BOS')}</td></tr>`)).join('')||'<tr><td colspan="4">No verified observations</td></tr>'}</tbody></table></div></details>`;
}
function reading(c, home){const d=state.cards.get(c.ticker)||{},v=d.valuation||{},r=v.row||{},reports=state.reports.filter(x=>matches(x,c)).sort((a,b)=>(Date.parse(b.research_date)||0)-(Date.parse(a.research_date)||0)),creditReports=reports.filter(x=>/credit|bond|debt/i.test([x.title,x.kind].join(' '))&&!/equity/i.test(x.kind||'')),research=reports.filter(x=>!creditReports.includes(x)).slice(0,2),news=newsFor(state.news,c.ticker),resource=state.resources[c.ticker],analyst=r.researchReportUrl||resource?.url;
  return `<section class="cd-section"><h4>Latest Reuters &amp; company news</h4>${news.length?'<ul class="cd-news">'+news.map(n=>`<li>${link(n.href,n.title)}<small>${E(day(n.published_at))} · ${E(n.source||'Publisher')}</small></li>`).join('')+'</ul>':'<p class="cd-note">No company-matched headline in the loaded feed. Open all news to check broader coverage.</p>'}</section><section class="cd-section"><h4>Research</h4><ul class="cd-reading">${research.map(x=>`<li>${link(x.href,x.title)}<small>${E(day(x.research_date))}</small></li>`).join('')}${analyst?`<li>${link(analyst, home ? 'Morningstar research PDF' : 'Morningstar research · BOS-hosted PDF')}<small>${E(analyst===resource?.url?day(resource?.report_date):(r.analystReportMonth||'Date in report'))} · publisher report</small></li>`:''}</ul>${!research.length&&!analyst?'<p class="cd-note">No company research loaded.</p>':''}</section><section class="cd-section"><h4>Credit reports &amp; bond spreads</h4>${credit(c)}${creditLinks(c)}${creditReports.slice(0,1).map(x=>`<p>${link(x.href,x.title)} <small>${E(day(x.research_date))}</small></p>`).join('')}<p class="cd-note">${link('search.html?q='+encodeURIComponent(c.ticker+' AND (credit OR bond)'),'Search credit research')} · ${link('v4.html#credit','Bond desk')}</p></section>`;
}
function card(c) {
  const d = state.cards.get(c.ticker) || {}, q = d.quote || {}, r = d.valuation?.row || {};
 return `<article class="cd-card" data-company="${c.ticker}" aria-labelledby="cd-${c.ticker}">
  <header class="cd-card-head"><div><span class="cd-ticker cd-${c.family}">${c.ticker} · USD${c.ticker==='BABA'?' ADS':''}</span><h3 id="cd-${c.ticker}">${c.name}</h3></div><div class="cd-price"><strong>${finite(q.close)?'$'+num(q.close):'Unavailable'}</strong><small>${E(day(q.date))} ${q.sourceId==='bos'?'reference':'close'}</small></div></header>
  <p class="cd-note cd-source">${E(q.sourceLabel||'Quote source unavailable')}${q.current===false?' · dated reference':''} ${q.sourceUrl?link(q.sourceUrl,'Source'):''}</p>
  ${root.ShareStaticData?.html({ticker:c.ticker,currency:'USD'})||''}
  <div class="cd-charts">${chart(d.pe||[],'Forward P/E',c.ticker)}${chart(d.pb||[],'Forward P/B',c.ticker)}</div>
  <p class="cd-note">${r.priceAsOf?'BOS consensus estimates · '+E(day(r.priceAsOf))+'. Forecast horizon unspecified.':'Valuation source unavailable.'} Dots show source observations; missing dates are not filled.</p>
  ${valuationEvidence(c.ticker,d,'Chart values &amp; sources')}${root.CompanyFundamentals?.button({ticker:c.ticker,currency:'USD',name:c.name})||''}
  ${reading(c,false)}
  ${root.SIReferenceTable?.section(c.ticker)||''}
  <nav class="cd-actions" aria-label="${c.ticker} shortcuts"><a href="stocks-beta.html?companies=${c.ticker}">Price · P/E · P/B charts →</a><a href="v4.html?company=${c.ticker}#earnings">Earnings</a><a href="search.html?q=${c.ticker}">All news &amp; research</a></nav>${root.NvdaArticle?.link(c.ticker) || ''}</article>`;
}
function paintHome(host) {
  if (!state.loaded || state.loading) return;
  for (const node of host.querySelectorAll('[data-company-valuation]')) {
    const ticker = node.dataset.companyValuation;
    const d = state.cards.get(ticker) || {};
    if (root.DeskStockCharts) {
      root.DeskStockCharts.valuation(node, d.pe || [], d.pb || [], ticker);
      const source = node.closest('.instrument').querySelector('[data-valuation-source]');
      const previousEvidence = source.querySelector('details')?.open;
      source.innerHTML = valuationEvidence(ticker, d, 'Valuation sources');
      if (previousEvidence) source.querySelector('details').open = true;
      node.insertAdjacentHTML('beforeend', '<p class="fine stock-price-source">Bank of Singapore observations · Forecast horizon unspecified.</p>');
    } else {
      const previousEvidence = node.querySelector('details')?.open;
      node.innerHTML = combinedChart(d.pe || [], d.pb || [], ticker) + valuationEvidence(ticker, d);
      if (previousEvidence) node.querySelector('details').open = true;
    }
    const company = homeCompanies.find(c => c.ticker === ticker);
    if (!company) continue;
    const research = node.closest('[data-company]').querySelector('[data-company-research]');
    const wasOpen = research.querySelector('details')?.open;
    research.innerHTML = `<details class="cd-company-research" ${wasOpen ? 'open' : ''}>
      <summary>News, research &amp; credit</summary>
      ${root.ShareStaticData?.html({ticker,currency:'USD'}) || ''}
      ${reading(company,true)}
      <p class="cd-note">${link('search.html?q='+encodeURIComponent(ticker),'All news & research →')}</p>
    </details>`;
  }
}
function paint() {
  for (const host of document.querySelectorAll('[data-company-dashboard]')) {
    const home = host.hasAttribute('data-home-companies');
    if (home) paintHome(host);
    else host.querySelector('[data-company-grid]').innerHTML = companies.map(card).join('');
    host.querySelector('[data-company-status]').textContent = state.loading ? 'Refreshing available sources…' :
      (state.warnings.length ? 'Could not refresh '+[...new Set(state.warnings)].join(', ')+'. Available observations retain their original dates. ' : '') +
      (home ? '' : 'Newest saved company matches are shown. Use Refresh to check the connected feeds.');
    host.querySelector('[data-company-refresh]').disabled = state.loading;
  }
}
async function companion(record){if(!record.assets?.['index.html'])return;const url=root.ResearchFeed.destination(record,record.full_report_url),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)return;const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==record.full_report_sha256)return;const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'text/html'),node=doc.querySelector('script[type="application/json"]#company-card-data');if(!node)return;const data=JSON.parse(node.textContent);if(!homeCompanies.some(c=>c.ticker===data.ticker))return;state.reportData.set(data.ticker,data);for(const n of data.reuters||[])if(safe(n.url)&&n.scope==='company')state.news.push({id:n.url,title:n.title,href:n.url,published_at:n.published_at,tickers:[data.ticker],source:'Reuters · verified research source'});}catch{state.warnings.push('Report source references');}finally{clearTimeout(timer);}}
async function directory(record){const expected=record.assets?.['dashboard-sources.js'];if(!expected)return;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const path=record.full_report_url.replace(/index\.html$/,'dashboard-sources.js'),url=root.ResearchFeed.destination(record,path),response=await fetch(url,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('Source directory unavailable');const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('Source directory changed');const text=new TextDecoder().decode(bytes),prefix='window.MIH_DASHBOARD_SOURCES = ';if(!text.startsWith(prefix)||!text.endsWith(';\n'))throw Error('Source directory format');const data=JSON.parse(text.slice(prefix.length,-2));if(data.schema_version!==1||!Array.isArray(data.companies))throw Error('Source directory schema');for(const row of data.companies){if(!homeCompanies.some(c=>c.ticker===row.ticker))continue;state.directory.set(row.ticker,row);for(const n of row.reuters||[])if(safe(n.url)&&n.publisher==='Reuters'&&n.scope?.startsWith('company'))state.news.push({id:n.url,title:n.title,href:n.url,published_at:n.published_at,tickers:[row.ticker],source:'Reuters · '+n.scope.replaceAll('_',' ')});}}catch{state.warnings.push('Company source directory');}finally{clearTimeout(timer);}}
async function load(){if(state.loading)return;const list=document.querySelector('[data-home-companies]')?homeCompanies:companies;state.loading=true;state.warnings=[];paint();const paths=['data/desk-data.json','data/credit-catchup-20261104.json','data/watchlist/company-resources.json','data/hourly-news.json','data/research-feed.json'];const results=await Promise.allSettled([...paths.map(json),root.MarketPrices?.refresh(),root.BOSEquity?.refresh(),root.ShareLabData?.load(),root.ShareStaticData?.load()]);const got=i=>results[i].status==='fulfilled'?results[i].value:null;results.forEach((r,i)=>{if(r.status==='rejected')state.warnings.push(paths[i]||'Market data');});const desk=got(0);if(desk){state.reports=[...new Map([...state.reports,...(desk.reports||[])].map(r=>[r.href,r])).values()];state.news=[...state.news,...(desk.news||[])];}if(got(1))state.credit=got(1).rows||[];if(got(2))state.resources=got(2).companies||{};
 const more=await Promise.allSettled([got(3)&&root.DeskNews?root.DeskNews.load(got(3),list):null,got(4)&&root.ContentDelivery?root.ContentDelivery.research(root.ResearchFeed.validate(got(4))):null]);if(more[0].status==='fulfilled'&&more[0].value){state.news=[...more[0].value.news,...state.news];if(more[0].value.delivery_error)state.warnings.push('Reuters');}else state.warnings.push('Reuters');
 const feed=more[1].status==='fulfilled'?more[1].value:null;if(feed){state.reports=[...feed.records.map(r=>({id:r.id,title:r.title,href:root.ResearchFeed.destination(r,r.full_report_url),research_date:r.cutoff_sgt,kind:r.category,tags:r.tags.map(t=>feed.tags[t].label)})),...state.reports];if(feed.delivery_error)state.warnings.push('Research');await Promise.allSettled(list.map(c=>{const latest=feed.records.filter(r=>matches({...r,tags:r.tags.map(t=>feed.tags[t].label)},c)).sort((a,b)=>b.cutoff_sgt.localeCompare(a.cutoff_sgt)).find(r=>r.id.startsWith('standalone-'));return latest?Promise.allSettled([companion(latest),directory(latest)]):null;}));}else state.warnings.push('Research');
  const homeCharts = document.querySelectorAll('[data-home-companies] [data-company-valuation]');
  const tickers = homeCharts.length ? [...homeCharts].map(node => node.dataset.companyValuation) : list.map(c => c.ticker);
  const records = root.ShareLabData?.records() || [];
  await Promise.allSettled(tickers.map(async ticker => {
    const item = root.MarketPrices?.resolve(ticker) || root.BOSEquity?.itemFor(ticker);
    if (!item) return;
    const valuation = root.BOSEquity?.valuationFor(item);
    const reviewed = root.BOSEquity?.reviewedListings.find(row => row.listingId === item.id && row.currency === item.currency);
    const bbTicker = valuation?.row?.instrumentId || reviewed?.instrumentId || (item.currency === 'USD' ? item.ticker + ' US' : null);
    const rows = records.filter(r => bbTicker && r.bbTicker === bbTicker && r.currency === item.currency && r.currentEligible !== false && r.identityStatus !== 'conflict');
    let history = null;
    if (rows.length === 1) {
      try { history = await root.ShareLabData.historyFor(rows[0]); }
      catch { state.warnings.push(ticker + ' history'); }
    }
    state.cards.set(ticker, {
      quote: root.MarketPrices?.currentQuote(item), valuation,
      pe: valuationPoints(history?.metrics.pe, 'pe', valuation),
      pb: valuationPoints(history?.metrics.pb, 'pb', valuation)
    });
  }));
  state.reports = [...new Map(state.reports.map(r => [r.href, r])).values()];
  state.loaded = true;
  state.loading = false;
  paint();
}

function mount(){if(!document.querySelector('[data-company-dashboard]'))return;if(state.loaded||state.loading)paint();else load();}
const api={companies,homeAdditions,shell,mount,refresh:load,newsFor,valuationPoints,matches,chart,combinedChart,status:()=>({loaded:state.loaded,warnings:[...state.warnings]})};root.CompanyDashboard=api;if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
document.addEventListener('click',e=>{if(e.target.closest('[data-company-refresh]'))load();});document.addEventListener('DOMContentLoaded',mount);
})(typeof window!=='undefined'?window:globalThis);
