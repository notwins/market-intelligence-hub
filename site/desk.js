/* Additive reading desk. Publication/price contracts remain owned by existing readers. */
(function(root){'use strict';
const HUB='https://notwins.github.io/market-intelligence-hub/';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeHref(value){try{if(typeof value!=='string'||!value||/[\\\x00-\x20]/.test(value))return '';const decoded=decodeURIComponent(value);if(/[\\\x00-\x20]/.test(decoded)||decoded.split(/[/?#]/).includes('..'))return '';const u=new URL(value,HUB);if(u.protocol!=='https:'||u.username||u.password||['chatgpt.com','chat.openai.com'].includes(u.hostname))return '';if(!/^https:\/\//.test(value)&&(/^[a-z]+:/i.test(value)||value.startsWith('//')||value.startsWith('/')))return '';return value;}catch{return '';}}
const canonical=s=>{const h=safeHref(s);return h?new URL(h,HUB).href.replace(/\/index\.html(?=[?#]|$)/,'/').split('#')[0]:'';};
const archiveTime=r=>r.uploaded_at||r.added_at||r.recorded_publication_date||'';
const sortTime=r=>Number.isFinite(Date.parse(archiveTime(r)))?Date.parse(archiveTime(r)):-Infinity;
const archiveSort=(a,b)=>(sortTime(b)-sortTime(a)||0)||String(a.id).localeCompare(String(b.id));
function mergeReports(local,remote){const map=new Map();for(const r of [...local,...remote]){const key=canonical(r.href);if(!key)continue;const old=map.get(key);map.set(key,old?{...old,...r,added_at:old.added_at||r.added_at}:r);}return [...map.values()].sort(archiveSort);}
const newsTime=n=>Number.isFinite(Date.parse(n.published_at))?Date.parse(n.published_at):-Infinity;
const matchNews=(news,ticker)=>news.filter(n=>safeHref(n.href)&&(ticker==='all'||n.tickers?.includes(ticker))).filter((n,i,a)=>a.findIndex(x=>canonical(x.href)===canonical(n.href))===i).sort((a,b)=>(newsTime(b)-newsTime(a)||0)||String(a.id).localeCompare(String(b.id)));
const newsResearchHref=(item,ticker)=>'search.html?q='+encodeURIComponent(ticker!=='all'&&item.tickers.includes(ticker)?ticker:item.tickers[0]);
const date=s=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Singapore'}):'Date not recorded';
const num=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0}):'Unavailable';
const link=(href,label,cls='')=>safeHref(href)?`<a class="${E(cls)}" href="${E(href)}">${E(label)}</a>`:`<span>${E(label)} · unavailable</span>`;
function spark(points,unit,compact=false){if(!Array.isArray(points)||points.some((p,i)=>!Array.isArray(p)||!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||!Number.isFinite(Date.parse(p[0]))||new Date(p[0]).toISOString().slice(0,10)!==p[0]||!Number.isFinite(p[1])||(i&&p[0]<=points[i-1][0])))return '<p class="empty">Chart observations need review.</p>';const p=points.filter(p=>Array.isArray(p)&&/^\d{4}-\d{2}-\d{2}$/.test(p[0])&&Number.isFinite(p[1]));if(p.length<2)return '<p class="empty">Not enough observations for a chart.</p>';const lo=Math.min(...p.map(x=>x[1])),hi=Math.max(...p.map(x=>x[1])),min=lo-(hi-lo||1)*.1,max=hi+(hi-lo||1)*.1,t0=Date.parse(p[0][0]),t1=Date.parse(p.at(-1)[0]);if(t1<=t0)return '<p class="empty">Chart dates need review.</p>';const width=compact?360:650,height=compact?168:250,left=compact?48:56,right=width-(compact?10:30),bottom=height-(compact?30:40),top=compact?12:30;
const x=v=>left+(Date.parse(v)-t0)/(t1-t0)*(right-left),y=v=>bottom-(v-min)/(max-min)*(bottom-top);
const color=p.at(-1)[1]>=p[0][1]?'#16704c':'#a63d46';
const line=p.map(v=>x(v[0]).toFixed(2)+','+y(v[1]).toFixed(2)).join(' ');
const axisDate=d=>compact?new Date(d).toLocaleDateString('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'}):d;
return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${E(unit)} observations from ${E(p[0][0])} to ${E(p.at(-1)[0])}">
  <title>Dated ${E(unit)} observations. Exact values follow in the table.</title>
  ${[min,(min+max)/2,max].map(v=>`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text x="4" y="${y(v)+4}">${num(v,compact?1:2)}</text>`).join('')}
  <polygon fill="${color}" opacity=".15" points="${left},${bottom} ${line} ${right},${bottom}"/>
  <polyline style="stroke:${color}" points="${line}"/>
  <text x="${left}" y="${height-9}">${E(axisDate(p[0][0]))}</text><text x="${right}" y="${height-9}" text-anchor="end">${E(axisDate(p.at(-1)[0]))}</text>
</svg>`;}
const valuesTable=(points,unit,notes='')=>`<details><summary>Dates, values &amp; source basis</summary>${notes}<div class="table-wrap" tabindex="0" role="region" aria-label="Historical observations"><table><caption>Saved observations · ${E(unit)}</caption><thead><tr><th>Date</th><th>Value</th></tr></thead><tbody>${points.map(p=>`<tr><td>${E(p[0])}</td><td>${num(p[1],4)}</td></tr>`).join('')}</tbody></table></div></details>`;
const canEdit=location=>location?.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const movePeriods = [['1W', {days: 7}], ['1M', {months: 1}], ['6M', {months: 6}]];
function priceMove(daily, endDate, {days, months}) {
  const last = daily.findLast(p => p[0] <= endDate);
  if (!last || last[0] !== endDate) return null;

  const target = new Date(endDate + 'T12:00:00Z');
  if (days) {
    target.setUTCDate(target.getUTCDate() - days);
  } else {
    const day = target.getUTCDate();
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() - months);
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
  }
  const base = daily.findLast(p => p[0] <= target.toISOString().slice(0, 10));
  if (!base || target - Date.parse(base[0] + 'T12:00:00Z') > 7 * 86400000) return null;
  return (last[1] / base[1] - 1) * 100;
}
function selectedPrice(ticker,market=root.MarketPrices){const item=market?.resolve(ticker)||root.BOSEquity?.itemFor(ticker),q=market?.currentQuote(item||ticker);if(!item||!Number.isFinite(q?.close)||q.close<=0||!q.date)return null;const label=(q.sourceLabel||'Shared price feed')+(q.current===false?' · dated observation':'');return {value:q.close,currency:market.displayUnit(item),as_of:q.date,basis:q.reason||label,status_label:label,source_url:q.sourceUrl};}
const api={canEdit,E,safeHref,canonical,archiveSort,mergeReports,matchNews,newsResearchHref,spark,selectedPrice,priceMove};root.Desk=api;if(typeof module!=='undefined')module.exports=api;if(!root.document)return;
let data=null,feed=null,reports=[],featured=[],limit=12,opener=null,refreshing=false;const editing=canEdit(root.location);const seriesCache=new Map();
const priceSections = ['markets', 'stock-moves', 'stock-prices', 'main-company-cards', 'market-rates', 'market-bonds', 'yields'];
let priceWatchlist = [], pricesStarted = false;
const $=s=>document.querySelector(s);
function card(r,kind=''){return `<article class="report-card" data-report-id="${E(r.id)}" data-mih-tags="${E(JSON.stringify(r.tags||[]))}"><p class="meta">${E(kind||r.edition||r.kind)} · ${E(date(r.research_date))}</p><h3>${E(r.title)}</h3><p>${E(r.summary||'Open the complete dated report and its original evidence.')}</p>${link(r.href,r.full_edition?.completeness_verified?'Read full edition →':'Read report →','report-link')}${kind==='Featured research'?`<div class="brief-links">${(r.briefs||[]).map(b=>`<a class="brief-link" href="${E(safeHref(b.href)||r.href)}"><span class="brief-icon" aria-hidden="true">▤</span><span><b>${E(b.title)}</b><small>${E(b.summary||b.format||'Matching published companion')}</small></span></a>`).join('')}</div>`:''}</article>`;}
function renderReports(){const latest=new Map();for(const r of reports){const f=r.full_edition;if(f?.completeness_verified&&(!latest.has(f.channel)||f.cutoff>latest.get(f.channel).full_edition.cutoff))latest.set(f.channel,r);}$('#daily-cards').innerHTML=[...latest.values()].slice(0,2).map(r=>card(r,'Verified full edition')).join('')||'<p class="empty">No complete daily editions available. Use the publication archive.</p>';$('#featured-cards').innerHTML=featured.map(id=>reports.find(r=>r.id===id)).filter(r=>r&&![...latest.values()].some(d=>d.id===r.id)).map(r=>card(r,'Featured research')).join('')||'<p class="empty">Choose reports for the featured shelf.</p>';renderArchive();}
function renderArchive(){const terms=$('#archive-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean);const rows=reports.filter(r=>terms.every(t=>[r.title,r.summary,r.research_date,archiveTime(r),...(r.tags||[])].join(' ').toLowerCase().includes(t))).sort(archiveSort);$('#archive-count').textContent=`${rows.length} articles · showing ${Math.min(limit,rows.length)} · publication chronology, not research recency`;$('#archive-cards').innerHTML=rows.slice(0,limit).map(r=>`<article class="archive-card" data-mih-tags="${E(JSON.stringify(r.tags||[]))}"><span class="date">${r.uploaded_at?'Published':r.added_at?'Added to repository':r.recorded_publication_date?'Recorded publication':'Publication date unknown'}${archiveTime(r)?' · '+E(date(archiveTime(r))):''}</span><h3>${link(r.href,r.title)}</h3><small>Research date · ${E(date(r.research_date))}</small><small>${E(r.edition||r.kind)}</small></article>`).join('')||'<p class="empty">No matching articles. Try another title or topic.</p>';$('#archive-more').hidden=rows.length<=limit;}
function renderNews(){const ticker=$('#news-company').value;$('#news-cards').innerHTML=root.CompanyNewsCards.render(data.news,data.watchlist,ticker);}
function quote(r) {
  if (!Number.isFinite(r.price?.value)) return '<small>Price unavailable</small>';
  return `<b>${num(r.price.value)} <small>${E(r.price.currency)}</small></b>`;
}

function moveStats(values = []) {
  return `<dl class="watch-moves">${movePeriods.map(([label], i) => {
    const move = values[i];
    const rounded = Number.isFinite(move) ? Number(move.toFixed(1)) : null;
    const change = rounded === null ? '—' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
    return `<div><dt>${label}</dt><dd>${change}</dd></div>`;
  }).join('')}</dl>`;
}

function paintStockMoves(ticker, values) {
  const tile = document.querySelector(`.watch-mini[data-ticker="${CSS.escape(ticker)}"]`);
  tile.querySelector('.watch-moves').outerHTML = moveStats(values);
  const month = values[1];
  const magnitude = Math.abs(month ?? 0);
  tile.dataset.heat = magnitude < 0.05 ? 'neutral' : month > 0 ? 'gain' : 'loss';
  tile.style.setProperty('--heat-lightness', `${97 - Math.min(magnitude, 25) / 25 * 12}%`);
}

function quoteDetails(r) {
  const p = r.price;
  if (!p?.as_of) return '';
  return `<p class="fine">Displayed quote for ${E(date(p.as_of.slice(0, 10)))} · ${p.source_url ? link(p.source_url, p.status_label) : E(p.status_label || 'Saved research-edition close')}</p>`;
}

function stockCard(r) {
  const ticker = encodeURIComponent(r.ticker);
  const destination = r.earnings ? 'v4.html?company=' + ticker + '#earnings' : 'stocks-beta.html?companies=' + ticker;
  return `<article class="instrument" id="company-${E(r.ticker)}" data-company="${E(r.ticker)}">
    <header class="instrument-head">
      <span><strong>${link(destination, r.ticker)}</strong><small>${E(r.name)} · ${E(r.group)}</small></span>
      <span class="quote" data-quote="${E(r.ticker)}">${quote(r)}</span>
    </header>
    <div class="detail-body">
      <div class="detail-tabs" role="group" aria-label="${E(r.ticker)} details">
        <button data-detail="history" data-ticker="${E(r.ticker)}" aria-pressed="true">Price history</button>
        <button data-detail="earnings" data-ticker="${E(r.ticker)}" aria-pressed="false">Earnings</button>
        ${r.si ? `<button data-detail="si" data-ticker="${E(r.ticker)}" aria-pressed="false">SI references (${r.si.length})</button>` : ''}
      </div>
      <div class="detail-content" aria-live="polite"></div>
      <details class="stock-card-info">
        <summary>Quote source &amp; links</summary>
        <div data-quote-info="${E(r.ticker)}">${quoteDetails(r)}</div>
        <p class="fine">${link(destination, 'Company workspace →')} · ${link(r.research_href, 'Search research →')}</p>
      </details>
    </div>
  </article>`;
}

function buildMarkets(){
  $('#pulse-yields').innerHTML = [['US T-bill','6 months'],['US T-bill','about 1 year'],['Singapore T-bill','6 months'],['Singapore T-bill','1 year']].map(([name,term]) => `<div class="pulse-cell"><a href="#markets">${name} · ${term}</a><strong>Unavailable</strong><small>Loading the dated source; no substitute rate</small></div>`).join('');
  const newStocks = root.CompanyDashboard.homeAdditions.map(({ticker, name, group}) => ({
    ticker, name, group, research_href: 'search.html?q=' + encodeURIComponent(ticker)
  }));
  priceWatchlist = [...data.watchlist, ...newStocks.filter(stock => !data.watchlist.some(r => r.ticker === stock.ticker))];
  $('#watch-strip').innerHTML = priceWatchlist.map(r => `<div class="watch-mini" data-ticker="${E(r.ticker)}">
    <header>${link('#company-' + encodeURIComponent(r.ticker), r.ticker)}</header>
    <span data-quote="${E(r.ticker)}">${quote(r)}</span>${moveStats()}
  </div>`).join('');
  $('#market-rows').innerHTML = priceWatchlist.map(stockCard).join('');
  $('#yield-rows').innerHTML=data.yields.map(y=>{const points=(y.history||[]).map(p=>[p.date,p.value]);return `<details class="instrument" open><summary><span><strong>${E(y.label)}</strong><small>${E(y.basis)}</small></span><span class="quote"><b>${num(y.value)}%</b><small>${E(date(y.as_of))}</small></span></summary><div class="detail-body"><p class="fine">${E(y.basis)}</p>${y.status==='error'?`<p class="warning">${E(y.message||'Refresh failed; retaining the dated saved observation.')}</p>`:''}${spark(points,'% p.a.')}${valuesTable(points,'% p.a.')}${link(y.source_url,'Open original source ↗')}${y.attribution?'<p class="fine">'+E(y.attribution)+' '+link(y.license_url,'Dataset terms')+'</p>':''}</div></details>`;}).join('');}
async function series(ticker){if(!seriesCache.has(ticker))seriesCache.set(ticker,root.MarketPrices.series(ticker).catch(e=>{seriesCache.delete(ticker);throw e;}));return seriesCache.get(ticker);}
async function detail(ticker,kind='history',days=93){const row=priceWatchlist.find(r=>r.ticker===ticker),host=document.getElementById('company-'+ticker),target=host?.querySelector('.detail-content');if(!row||!target)return;target.dataset.kind=kind;if(kind==='history')target.dataset.days=String(days);const ticket=String(Number(target.dataset.ticket||0)+1);target.dataset.ticket=ticket;for(const b of host.querySelectorAll('[data-detail]'))b.setAttribute('aria-pressed',String(b.dataset.detail===kind));
if(kind==='history'){target.innerHTML='<p class="fine">Loading verified shared price history…</p>';try{const s=await series(ticker);if(target.dataset.ticket!==ticket)return;const cutoff=new Date(Date.parse(s.quote.date+'T12:00:00Z')-days*86400000).toISOString().slice(0,10);const points=root.MarketPrices.selectPoints(s.base,s.daily,cutoff,s.quote.date);const unit=root.MarketPrices.displayUnit(s.item);target.innerHTML=`<div class="chart-controls">${[[31,'1M'],[93,'3M'],[366,'1Y'],[1830,'5Y']].map(([n,t])=>`<button class="outline" data-period="${n}" data-ticker="${E(ticker)}" aria-pressed="${n===days}">${t}</button>`).join('')}</div><p class="fine">${E(ticker)} · ${E(unit)} · ${E(root.MarketPrices.quoteStatus(s.quote))}</p>${spark(points,unit,true)}${valuesTable(points,unit,`<p class="fine">${E(root.MarketPrices.priceBasis(s.item))} ${E(s.base.period_note||'')} ${link(s.item.history_url,'Original price source ↗')}</p>`)}`;}catch{if(target.dataset.ticket===ticket)target.innerHTML='<p class="empty">Shared history unavailable. See quote details for the available close.</p>';}}
else if(kind==='earnings'){const c=row.earnings;target.innerHTML=c?`<h3>${E(c.name)} earnings</h3><p class="fine">${E(c.coverage)} · EPS: ${E(c.eps_basis)}</p><ul>${c.takeaways.map(t=>`<li><b>${E(t.label)}</b> ${E(t.text)}</li>`).join('')}</ul><div class="table-wrap" tabindex="0" role="region" aria-label="${E(ticker)} earnings history"><table><caption>Selected reported quarters, not forecasts</caption><thead><tr><th>Period</th><th>Revenue US$bn</th><th>EPS</th><th>Source</th></tr></thead><tbody>${c.history.map(h=>`<tr><td>${E(h.period)}<small>Ended ${E(date(h.period_end))}</small></td><td>${num(h.revenue_usd_bn,3)}</td><td>${num(h.eps,3)}</td><td>${link(data.earnings_sources[h.source]?.url,'Issuer release')}<small>${E(date(h.report_date))}</small></td></tr>`).join('')}</tbody></table></div>`:`<p class="empty">Verified issuer history is unavailable here.</p>${link('stocks-beta.html?companies='+encodeURIComponent(ticker),'Open the company workspace →')}`;}
else if(kind==='si'){target.innerHTML=`<h3>${E(ticker)} · matching SI references</h3><p class="warning">Rounded historical references, not live quotes. Screen labels are shown where supplied; earlier coupon bases and tenor units remain unconfirmed.</p>${row.si.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="${E(ticker)} matching SI records"><table><thead><tr><th>Reference / date</th><th>Underlyings</th><th>Strike / KO / KI</th><th>Coupon</th></tr></thead><tbody>${row.si.map(s=>`<tr><td>${E(s.reference)}<small>${E(s.source_date||"Date not shown")}</small>${s.additional_review?'<small>Additional review required</small>':''}</td><td>${E((s.shares||[]).join(' / '))}</td><td>${num(s.strike_pct)} / ${num(s.ko_pct)} / ${num(s.ki_pct)}%</td><td>${num(s.coupon_pct)}%${s.coupon_basis==='per_annum'?'<small>p.a. (screen)</small>':'<small>Basis unconfirmed</small>'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No exact matching underlying in the saved SI references.</p>'}${link('v4.html#history/si','Open the complete SI reference desk →')}`;}}
async function refreshPrices(force = false) {
  if (refreshing || !data) return;
  refreshing = true;
  pricesStarted = true;
  $('#refresh-prices').disabled = true;
  $('#price-status').textContent = 'Checking saved closes and price history…';
  try {
    if (force) seriesCache.clear();
    await Promise.allSettled([root.MarketPrices.refresh(force), root.BOSEquity?.refresh(force)]);
    for (const row of priceWatchlist) {
      const price = selectedPrice(row.ticker);
      if (!price) continue;
      row.price = price;
      const ticker = CSS.escape(row.ticker);
      for (const node of document.querySelectorAll(`[data-quote="${ticker}"]`)) node.innerHTML = quote(row);
      document.querySelector(`[data-quote-info="${ticker}"]`).innerHTML = quoteDetails(row);
    }
    const covered = await warmCharts();
    $('#price-status').textContent = `${covered} of ${priceWatchlist.length} stocks have all three price changes.`;
  } finally {
    refreshing = false;
    $('#refresh-prices').disabled = false;
  }
}

async function warmCharts() {
  let next = 0, covered = 0;
  const workers = Array.from({length: 3}, async () => {
    while (next < priceWatchlist.length) {
      const {ticker} = priceWatchlist[next++];
      let moves = [];
      try {
        const s = await series(ticker);
        moves = movePeriods.map(([, period]) => priceMove(s.daily, s.quote.date, period));
        if (moves.every(Number.isFinite)) covered++;
      } catch {}
      paintStockMoves(ticker, moves);
      const target = document.getElementById('company-' + ticker).querySelector('.detail-content');
      if (!target.dataset.kind || target.dataset.kind === 'history') {
        await detail(ticker, 'history', Number(target.dataset.days) || 93);
      }
    }
  });
  await Promise.all(workers);
  return covered;
}

function openPrices() {
  const host = $('#main-company-cards');
  if (!host.hasChildNodes()) {
    host.innerHTML = root.CompanyDashboard.shell({home: true});
    root.CompanyDashboard.mount();
  }
  if (!pricesStarted) refreshPrices();
}
const deskTabs = [...document.querySelectorAll('.modebar [role="tab"][data-mode]')];
function mode(selected) {
  for (const tab of deskTabs) {
    const active = tab.dataset.mode === selected;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  $('#load-status').hidden = selected !== 'briefing';
  if (selected === 'markets' && data) openPrices();
  if (selected === 'full-history') {
    const frame = $('#full-history-frame');
    if (!frame.hasAttribute('src')) frame.src = frame.dataset.src;
  }
}
function route() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch {}
  const company = id.startsWith('company-');
  const market = priceSections.includes(id) || company;
  mode(id === 'full-history' ? id : market ? 'markets' : 'briefing');
  const target = document.getElementById(id);
  if (target?.tagName === 'DETAILS') target.open = true;
  document.querySelectorAll('[data-desk-nav]').forEach(a => {
    if (a.hash === '#' + (id || 'briefing')) a.setAttribute('aria-current','location');
    else a.removeAttribute('aria-current');
  });
  target?.scrollIntoView({block:'start'});
}
function setupDeskTabs() {
  for (const tab of deskTabs) tab.addEventListener('click', () => { location.hash = tab.dataset.mode; });
  $('.modebar [role="tablist"]').addEventListener('keydown', e => {
    const index = deskTabs.indexOf(e.target);
    if (index < 0) return;
    const last = deskTabs.length - 1;
    let next;
    switch (e.key) {
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      case 'ArrowLeft': next = index === 0 ? last : index - 1; break;
      case 'ArrowRight': next = index === last ? 0 : index + 1; break;
      default: return;
    }
    e.preventDefault();
    const tab = deskTabs[next];
    mode(tab.dataset.mode);
    tab.focus();
    history.replaceState(null, '', '#' + tab.dataset.mode);
  });
  root.addEventListener('hashchange', route);
  route();
}
function renderCalls(){const shares=reports.filter(r=>['research-googl','research-tsm-2026-11-05','research-nvda-2026-11-05'].includes(r.id));const table=(rows,label)=>`<div class="table-wrap" tabindex="0" role="region" aria-label="${E(label)}"><table><caption>${E(label)}</caption><thead><tr><th>Date</th><th>Company / instrument</th><th>Research / call</th><th>Status</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${E(date(c.date))}</td><td><b>${E(c.ticker)}</b></td><td>${link(c.href,c.title)}</td><td>${E(c.type)}</td></tr>`).join('')}</tbody></table></div>`;const shareRows=shares.map(r=>({date:r.research_date,ticker:r.href.includes('googl')?'GOOGL':r.href.includes('nvda')?'NVDA':'TSM',title:r.title,href:r.href,type:'Published company research · not a confirmed trade or personal call'}));$('#calls-table').innerHTML='<h3>Share calls &amp; research</h3><p class="fine">Available public company write-ups. No buy/sell call or executed trade is inferred.</p>'+table(shareRows,'Shares · public company research')+'<h3 class="options-table-title">Options calls &amp; trade reviews</h3>'+table(data.calls,'Options · historical calls and reviews');}

async function json(path){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(path,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Unavailable');return await r.json();}finally{clearTimeout(timer);}}
async function remoteResearch(){try{const local=await json('data/research-feed.json');const next=await root.ContentDelivery.research(root.ResearchFeed.validate(local));feed=root.ResearchFeed.retain(feed,next);const extra=feed.records.map(r=>({id:r.id,title:r.title,summary:r.summary,href:root.ResearchFeed.destination(r,r.full_report_url),research_date:r.cutoff_sgt,uploaded_at:null,added_at:null,recorded_publication_date:null,kind:r.category,independent:!!r.delivery_base,tags:r.tags.map(t=>feed.tags[t].label),briefs:r.quick_read?[{title:'Matching brief',href:root.ResearchFeed.destination(r,r.quick_read.url),summary:'Verified companion for this exact report edition',format:r.quick_read.url.endsWith('.pdf')?'PDF':'HTML'}]:[],full_edition:/^(us-earnings-full|bond-credit-full)-/.test(r.id)?{completeness_verified:true,channel:r.id.startsWith('us-earnings')?'earnings':'credit',cutoff:r.cutoff_sgt}:null}));reports=mergeReports(reports,extra);renderReports();renderCalls();$('#load-status').textContent=`${reports.length} reports and articles · dates shown on each item`; }catch{$('#load-status').textContent='Independent content refresh unavailable. Showing the dated local library; use Research Explained to retry.';}}
function picker(){if(!editing)return;opener=document.activeElement;const dailyIds=[...document.querySelectorAll('#daily-cards [data-report-id]')].map(x=>x.dataset.reportId);$('#picker-options').innerHTML=reports.filter(r=>!dailyIds.includes(r.id)).map(r=>`<label><input type="checkbox" name="featured" value="${E(r.id)}" ${featured.includes(r.id)?'checked':''}>${E(r.title)}</label>`).join('');$('#picker-status').textContent='';$('#report-picker').showModal();$('#report-picker [data-close-picker]').focus();}
function chosen(){return [...document.querySelectorAll('#picker-options input:checked')].map(x=>x.value);}
function validSelection(ids){if(ids.length>12||ids.length<1){$('#picker-status').textContent='Choose between one and twelve reports.';return false;}return true;}
async function refreshNews(){try{const local=await json('data/hourly-news.json'),result=await root.DeskNews.load(local,data.watchlist);data.news=[...result.news,...data.news];renderNews();$('#news-status').textContent=result.delivery_error?'Independent news refresh unavailable; showing saved matched headlines with original dates.':'Matched to explicit company/topic metadata. Publisher dates stay separate from edition cutoffs.';}catch{$('#news-status').textContent='Independent news unavailable; showing the dated saved headline matches.';}}
async function init(){try{if(matchMedia('(max-width:760px)').matches)document.querySelectorAll('.rail details').forEach(d=>d.open=false);data=await json('data/desk-data.json');if(data.schema_version!==1||!['reports','watchlist','yields','news','calls'].every(k=>Array.isArray(data[k])))throw Error('Invalid desk data');reports=mergeReports(data.reports,[]);featured=[...data.featured_ids];$('#choose-reports').hidden=!editing;buildMarkets();root.DeskDashboard?.mount();renderReports();renderCalls();$('#news-company').innerHTML='<option value="all">All watchlist companies</option>'+data.watchlist.map(r=>`<option value="${E(r.ticker)}">${E(r.ticker)} · ${E(r.name)}</option>`).join('');renderNews();$('#load-status').textContent=`${reports.length} reports and articles · checking for newer editions…`;
document.addEventListener('click',e=>{const anchor=e.target.closest('a[href="#archive"]');if(anchor)$('#archive').open=true;const d=e.target.closest('[data-detail]');if(d)detail(d.dataset.ticker,d.dataset.detail);const p=e.target.closest('[data-period]');if(p)detail(p.dataset.ticker,'history',Number(p.dataset.period));});
document.addEventListener('market-prices-updated',()=>{seriesCache.clear();if(pricesStarted)refreshPrices();});
$('#archive-query').addEventListener('input',()=>{limit=12;renderArchive();});$('#archive-more').addEventListener('click',()=>{limit+=12;renderArchive();});$('#news-company').addEventListener('change',renderNews);$('#refresh-prices').addEventListener('click',()=>refreshPrices(true));$('#choose-reports').addEventListener('click',picker);$('[data-close-picker]').addEventListener('click',()=>$('#report-picker').close());$('#report-picker').addEventListener('close',()=>opener?.focus());$('#picker-form').addEventListener('submit',e=>{e.preventDefault();const ids=chosen();if(!validSelection(ids))return;featured=ids;renderReports();$('#report-picker').close();});$('#export-selection').addEventListener('click',()=>{const ids=chosen();if(!validSelection(ids))return;const blob=new Blob([JSON.stringify({schema_version:1,featured_ids:ids,independent_featured_ids:ids.filter(id=>reports.find(r=>r.id===id)?.independent)},null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='desk-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#picker-status').textContent='Selection exported for the publishing handoff. Shared site settings are unchanged until published.';});if(!$('#markets').hidden)route();remoteResearch();refreshNews();}catch{$('#load-status').textContent='The desk data could not be loaded. Open the full workspace or Research Explained using the navigation links.';}}
function boot(){setupDeskTabs();void init();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(typeof window!=='undefined'?window:globalThis);
