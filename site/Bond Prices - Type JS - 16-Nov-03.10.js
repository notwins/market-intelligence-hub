/* One dated daily feed, shared by the homepage and full bond watchlist. */
(function(root){'use strict';
const path='data/Bond Prices - Type JSON - 16-Nov-03.10.json';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=3)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-SG',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?new Date(s+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'Unavailable';
const safe=s=>/^https:\/\/(www\.wsj\.com\/market-data\/bonds\/treasuries|www\.bondsupermart\.com\/bsm\/bond-factsheet\/[A-Z0-9]+)$/.test(s||'')?s:'#';
function yieldText(q){return q?`${q.yield_basis==='Asked yield'?'Ask':q.yield_basis==='Bid yield to worst'?'Bid YTW':'Bid YTM'} ${num(q.yield_pct)}%`:'Unavailable';}
function lastDays(points){const days=new Map();for(const p of points||[])days.set(p.date,p);return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);}
function table(rows,feed,history=false,caption='34 watched bonds · prices per 100 face value · yields % per year'){return `<div class="daily-bonds-scroll" role="region" aria-label="${history?'Recent daily bond prices':'Bond prices and yields'}" tabindex="0"><table><caption>${history?'Up to five saved source dates per bond; latest accepted revision shown for each day.':E(caption)}</caption><thead><tr><th scope="col">Bond</th><th scope="col">CCY</th><th scope="col">Bid / Ask price</th><th scope="col">Yield</th><th scope="col">Quote date</th></tr></thead><tbody>${rows.map(r=>{
 const points=history?lastDays(feed.history[r.id]):[feed.latest[r.id]||null];
 if(!points.length)return '';
 return points.map(q=>{const check=feed.checks[r.id],stale=q&&Date.now()-Date.parse(q.date+'T23:59:59+08:00')>4*86400000;
 return `<tr><th scope="row"><a href="${E(safe(r.source_url))}" target="_blank" rel="noopener noreferrer">${E(r.name)}</a><small>${E(r.id)} · ${E(r.source)}</small>${!history&&check?.status!=='ok'?`<small class="daily-bond-notice">${E(q?'Last saved quote retained. ':'')}${E(check?.message||'Source unavailable')}</small>`:''}</th><td data-label="CCY">${E(r.currency)}</td><td data-label="Bid / Ask" class="daily-bond-number">${q?num(q.bid,r.source==='WSJ'?4:3)+' / '+num(q.ask,r.source==='WSJ'?4:3):'Unavailable'}</td><td data-label="Yield" class="daily-bond-number">${E(yieldText(q))}</td><td data-label="Quote date">${date(q?.date)}${stale?'<small class="daily-bond-notice">Older observation</small>':''}</td></tr>`;}).join('');
 }).join('')}</tbody></table></div>`;}
const monthYear = new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const couponRate = new Intl.NumberFormat('en-SG',{maximumFractionDigits:3});
const couponBand = coupon => !Number.isFinite(coupon) ? '' : coupon < 2 ? 'under-2' : coupon < 3 ? '2-to-3' : coupon <= 4 ? '3-to-4' : 'above-4';
const displayedYield = q => q?.yield_basis === 'Asked yield' && Number.isFinite(q.yield_pct) ? Number(num(q.yield_pct,1).replaceAll(',','')) : null;
const shortDate = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const shortMonthYear = new Intl.DateTimeFormat('en-GB',{month:'short',year:'2-digit',timeZone:'UTC'});
const shortDateWithYear = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'});
const lookbackMonths = [1,2,3,4,5,6,12];
const dayMs = 86400000;
const curveTenors = [1/12,.25,.5,1,2,3,5,7,10,20,30];
const treasuryRates = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve';
const fedRates = 'https://www.federalreserve.gov/releases/h15/';
// Only the May 2046 bond was first issued within 12 months of this table's launch.
const firstIssue = {US912810UV88:'2026-06-01'}; // TreasuryDirect auction result R_20260520_2.
const isoDate = d => d.toISOString().slice(0,10);
const utcDate = s => new Date(s + 'T00:00:00Z');

function offsetMonth(d, months, endOfMonth = false) {
  const year = d.getUTCFullYear(), month = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, endOfMonth ? lastDay : Math.min(lastDay, d.getUTCDate())));
}

function cleanPrice(maturity, settlement, coupon, yieldPct) {
  if (!Number.isFinite(maturity - settlement) || maturity <= settlement ||
      !Number.isFinite(coupon) || !Number.isFinite(yieldPct) || yieldPct <= -200) return null;
  const endOfMonth = offsetMonth(maturity,0,true).getTime() === maturity.getTime();
  const payment = coupon / 2, rate = yieldPct / 200;
  const months = (maturity.getUTCFullYear() - settlement.getUTCFullYear()) * 12 +
    maturity.getUTCMonth() - settlement.getUTCMonth();
  let periods = Math.floor(months / 6);
  let next = offsetMonth(maturity,-6 * periods,endOfMonth);
  if (next <= settlement) {
    periods -= 1;
    next = offsetMonth(maturity,-6 * periods,endOfMonth);
  }
  const previous = offsetMonth(maturity,-6 * (periods + 1),endOfMonth);
  const exponent = -periods * Math.log1p(rate);
  const annuity = rate === 0 ? periods : -Math.expm1(exponent) / rate;
  const value = payment * (1 + annuity) + 100 * Math.exp(exponent);
  // Treasury coupon-date convention, using actual days in the partial half-year.
  const remaining = (next - settlement) / (next - previous);
  return value / (1 + remaining * rate) - payment * (1 - remaining);
}

function priceEstimate(bond, curve) {
  if (!curve) return {note:'Historical curve unavailable'};
  const {date: observed, source, points} = curve;
  const issued = firstIssue[bond.id];
  if (issued && observed < issued) return {note:`First issued ${date(issued)}`};
  const settlement = utcDate(observed), maturity = utcDate(bond.maturity);
  const years = (maturity - settlement) / (365.25 * dayMs);
  const lower = points.findLast(p => p.years <= years);
  const upper = points.find(p => p.years >= years);
  if (!lower || !upper) return {note:'Remaining maturity falls outside the available curve'};
  const yieldPct = lower === upper ? lower.yieldPct :
    lower.yieldPct + (upper.yieldPct - lower.yieldPct) * (years - lower.years) / (upper.years - lower.years);
  return {price:cleanPrice(maturity,settlement,bond.coupon,yieldPct),note:`Estimated clean price · ${source} · ${date(observed)} · ${num(yieldPct,3)}% benchmark yield`};
}

function wsjDates(rows, feed) {
  return lastDays(rows.flatMap(row => feed.history[row.id] || [])).map(q => q.date);
}

function dateLabel(s, showYear = false) {
  const format = showYear ? shortDateWithYear : shortDate;
  return s ? `<time datetime="${E(s)}" title="${E(date(s))}">${E(format.format(utcDate(s)))}</time>` : '—';
}

function treasuryTable(rows, feed, showIdentifiers, curves) {
  const identifierCell = showIdentifiers ? 'data-ust-identifier' : 'data-ust-identifier hidden';
  const levels = rows.map(r => displayedYield(feed.latest[r.id])).filter(Number.isFinite);
  const low = Math.min(...levels), high = Math.max(...levels);
  const days = wsjDates(rows,feed);
  if (!days.length) days.push(null);
  return `<div class="daily-bonds-scroll daily-ust-scroll" role="region" aria-label="US Treasury quotes" tabindex="0">
    <table class="daily-ust-table" role="table">
      <caption>U.S. Treasury quotes and historical prices per 100 face value</caption>
      <colgroup span="5"></colgroup><colgroup span="${days.length}"></colgroup><colgroup span="${lookbackMonths.length}"></colgroup>
      <thead role="rowgroup"><tr role="row">
        <th role="columnheader" scope="col" rowspan="2" class="daily-ust-maturity">Maturity</th>
        <th role="columnheader" scope="col" rowspan="2" class="daily-ust-coupon">Coupon</th>
        <th role="columnheader" scope="col" rowspan="2" class="daily-ust-price">Price</th>
        <th role="columnheader" scope="col" rowspan="2" class="daily-ust-yield">Yield</th>
        <th role="columnheader" scope="col" rowspan="2" class="daily-ust-bond-heading" ${identifierCell}>ISIN &amp; source</th>
        <th role="columnheader" scope="colgroup" colspan="${days.length}" class="daily-ust-observed"><span>${days.length === 5 ? 'Last 5 saved WSJ asks' : 'Saved WSJ asks'}</span></th>
        <th role="columnheader" scope="colgroup" colspan="${lookbackMonths.length}" class="daily-ust-estimated"><span>Estimated clean prices</span></th>
      </tr><tr role="row">
        ${days.map(d => `<th role="columnheader" scope="col" class="daily-ust-observed">${dateLabel(d)}</th>`).join('')}
        ${lookbackMonths.map(m => `<th role="columnheader" scope="col" class="daily-ust-estimated">${m}M<small>${dateLabel(curves[m]?.date,m === 12)}</small></th>`).join('')}
      </tr></thead>
      <tbody role="rowgroup">${rows.map(r => {
        const q = feed.latest[r.id];
        const asks = new Map(lastDays(feed.history[r.id]).map(point => [point.date,point.ask]));
        const yieldLevel = displayedYield(q);
        const band = yieldLevel === null ? '' : high === low ? '0' : String(Math.round((yieldLevel - low) / (high - low) * 4));
        const maturity = Date.parse(r.maturity + 'T12:00:00Z');
        const maturityLabel = Number.isFinite(maturity) ? monthYear.format(maturity).replace(' ', '-') : '—';
        const coupon = Number.isFinite(r.coupon) ? couponRate.format(r.coupon) + '%' : '—';
        const stale = q && (feed.checks[r.id]?.status !== 'ok' || Date.now() - Date.parse(q.date + 'T23:59:59+08:00') > 4 * 86400000);
        const status = !q ? 'No quote' : stale ? 'Saved quote' : '';
        const source = E(safe(r.source_url));
        return `<tr role="row">
          <th role="rowheader" scope="row" class="daily-ust-maturity">${E(maturityLabel)}</th>
          <td role="cell" class="daily-ust-coupon" data-coupon-band="${couponBand(r.coupon)}"><a href="${source}" target="_blank" rel="noopener noreferrer" title="${E(r.name)} · WSJ Treasury quotes">UST ${E(coupon)}</a></td>
          <td role="cell" class="daily-ust-price">${num(q?.ask,1)}</td>
          <td role="cell" class="daily-ust-yield"${status ? ` title="${status}"` : ''}><span data-yield-band="${band}">${yieldLevel === null ? '—' : num(q.yield_pct,1) + '%'}</span></td>
          <td role="cell" class="daily-ust-bond" ${identifierCell}><span class="daily-ust-isin">${E(r.isin || r.id)}</span>
            <a href="${source}" target="_blank" rel="noopener noreferrer" aria-label="WSJ quotes for ${E(r.isin || r.id)}">WSJ <span aria-hidden="true">↗</span></a>
            ${status ? `<span class="daily-ust-quote-status">${status}</span>` : ''}
          </td>
          ${days.map(d => `<td role="cell" class="daily-ust-observed">${num(asks.get(d),1)}</td>`).join('')}
          ${lookbackMonths.map(m => {
            const estimate = priceEstimate(r,curves[m]);
            return `<td role="cell" class="daily-ust-estimated" title="${E(estimate.note)}">${num(estimate.price,1)}</td>`;
          }).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function compactWatchlist(feed, checked, showIdentifiers, curves) {
  const treasuries = feed.instruments.filter(r => r.source === 'WSJ');
  const otherBonds = feed.instruments.filter(r => r.source !== 'WSJ');
  return `<div class="daily-ust-watch">
      <div class="daily-ust-heading">
        <h3 class="daily-ust-title">US Treasuries (UST)</h3>
        <button type="button" class="outline" data-ust-identifiers aria-pressed="${showIdentifiers}">ISIN &amp; source</button>
      </div>
      <p class="fine daily-ust-summary">Ask price per 100 · Asked yield % p.a. · Darker = higher yield. Scroll right for price history.</p>
      ${treasuryTable(treasuries,feed,showIdentifiers,curves)}
      <details class="daily-bonds-history daily-ust-evidence">
        <summary>How historical prices are estimated</summary>
        <p class="fine">Lookbacks count back from the newest saved WSJ quote date. The dates shown under 1M–12M are the closest available observations on or before each target, within seven calendar days. Each estimate uses a yield interpolated from the curve at the bond’s remaining maturity. Semiannual coupons and redemption are discounted at that yield, and accrued interest is removed. A dash can indicate that the bond had yet to be issued or that a curve is unavailable.</p>
        <p class="fine">Yield sources · <a href="${treasuryRates}">U.S. Treasury daily par yield curve</a>${Object.values(curves).some(c => c?.source === 'Weekly FRED H.15') ? ` · <a href="${fedRates}">Weekly Federal Reserve H.15</a>` : ''}</p>
      </details>
    </div>
    <details class="daily-bonds-history daily-ust-evidence">
      <summary>Detailed Treasury quotes &amp; dates</summary>
      <p class="fine">Last check: ${E(checked)} SGT. The quote date is shown for each bond.</p>
      ${table(treasuries,feed,false,'Latest saved Treasury prices per 100 face value and yields % per year')}
    </details>
    <h3 class="daily-ust-title daily-ust-other">Other watched bonds</h3>
    ${table(otherBonds,feed,false,'Prices per 100 face value · yields % per year')}`;
}
// Read charts use actual source-dated asks, with the last accepted revision for each day.
const readHeading = '<div class="section-head"><h2>Bond watchlist</h2><a href="#market-bonds">Full bond tables →</a></div>';

function readBondCard(bond, feed) {
  const byDate = new Map();
  for (const point of [...(feed.history[bond.id] || []), feed.latest[bond.id]]) {
    if (Number.isFinite(point?.ask) && Number.isFinite(Date.parse(point.date))) byDate.set(point.date, point);
  }
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const first = points[0], latest = points.at(-1);
  const title = `<h3><a href="${E(safe(bond.source_url))}">${E(bond.name)}</a></h3>`;
  if (!latest) return `<article class="read-bond-card">${title}<p class="fine">Saved ask unavailable</p></article>`;
  const low = points.reduce((a, p) => p.ask < a.ask ? p : a);
  const high = points.reduce((a, p) => p.ask > a.ask ? p : a);
  const span = Date.parse(latest.date) - Date.parse(first.date);
  const x = point => span ? 5 + 230 * (Date.parse(point.date) - Date.parse(first.date)) / span : 120;
  const y = point => high.ask === low.ask ? 26 : 46 - 40 * (point.ask - low.ask) / (high.ask - low.ask);
  const amount = point => '$' + num(point.ask, 2);
  return `<article class="read-bond-card">${title}
    <svg class="read-bond-spark" viewBox="0 0 240 52" role="img" aria-label="${E(bond.currency)} saved asks from ${E(first.date)} to ${E(latest.date)}">
      ${points.length > 1 ? `<polyline points="${points.map(point => `${x(point)},${y(point)}`).join(' ')}"/>` : ''}
      ${[...new Set([low, high, latest])].map(point => `<circle cx="${x(point)}" cy="${y(point)}" r="3"><title>${E(point.date)} · ${E(amount(point))}</title></circle>`).join('')}
    </svg>
    <dl class="read-bond-values">
      <div><dt>Low</dt><dd>${amount(low)}</dd></div>
      <div><dt>High</dt><dd>${amount(high)}</dd></div>
      <div><dt>Latest</dt><dd>${amount(latest)}</dd></div>
    </dl>
    <p class="fine">From ${E(shortMonthYear.format(utcDate(first.date)).replace(' ', '-'))} · Latest ${dateLabel(latest.date, true)} · ${E(bond.currency)}</p>
  </article>`;
}

function readSnapshot(feed, expanded) {
  const latest = feed.instruments.map(b => feed.latest[b.id]?.date).filter(Boolean).sort().at(-1);
  const cards = feed.instruments.map(bond => readBondCard(bond, feed));
  return `${readHeading}
    <p class="fine">Latest saved ask ${dateLabel(latest, true)} · WSJ &amp; Bondsupermart asks per 100 face value.</p>
    <div class="read-bond-grid">${cards.slice(0, 3).join('')}</div>
    <details ${expanded ? 'open' : ''}><summary>More watched bonds (${cards.length - 3})</summary>
      <div class="read-bond-grid">${cards.slice(3).join('')}</div>
    </details>
    <p class="fine"><a href="v4.html#watchlist">Full watchlist →</a> · <a href="${encodeURI(path)}" download>Download saved quotes</a></p>`;
}

function render(feed,{compactTreasuries=false,showIdentifiers=false,curves={},snapshot=false,expanded=false}={}){
 if(feed?.schema_version!==1||!Array.isArray(feed.instruments)||feed.instruments.length!==34||!feed.latest||!feed.history||!feed.checks)return '<p class="fine">Bond price feed unavailable. Open the original source links in the full watchlist.</p>';
 if (snapshot) return readSnapshot(feed, expanded);
 const count=feed.instruments.filter(r=>feed.latest[r.id]).length,checked=feed.checked_at?new Date(feed.checked_at).toLocaleString('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Unavailable';
 return `<div class="section-head"><div>${compactTreasuries ? '' : '<p class="eyebrow">DAILY BOND WATCHLIST</p>'}<h2>Bond prices &amp; yields</h2></div><a href="v4.html#watchlist">Full watchlist →</a></div>${compactTreasuries ? `<p class="fine daily-ust-summary">${count}/34 have saved quotes · Daily check at 7:00 am Singapore time.</p>` : `<p class="fine">29 watched US Treasuries + five Bondsupermart bonds. Daily check scheduled for 7:00 am Singapore time; publication follows processing. ${count}/34 have saved quotes. Last check: ${E(checked)} SGT.</p>`}${compactTreasuries ? compactWatchlist(feed,checked,showIdentifiers,curves) : table(feed.instruments,feed)}<details class="daily-bonds-history"><summary>Last few daily prices &amp; yields</summary><p class="fine">Only source-dated prices are saved. Repeated checks add no duplicate quote dates; weekends and holidays are not filled. Earlier undated UST shortlist values remain in the full watchlist and are excluded from daily history.</p>${table(feed.instruments,feed,true)}</details><p class="fine daily-bonds-basis">WSJ: Treasury prices converted from points and 32nds; yield is the asked yield. Bondsupermart: indicative full-lot bid/ask prices with bid yield to maturity (YTM) or worst (YTW), as labelled. Each row retains its own source date. <a href="${encodeURI(path)}" download>Download prices and full saved history (JSON)</a>.</p>`;
}
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),15000);
  try {
    const response = await fetch(url,{cache:'no-cache',signal:controller.signal});
    if (!response.ok) throw Error('Unavailable');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

let cached=null,pending=null,loadedAt=0;
async function load(){if(cached&&Date.now()-loadedAt<300000)return cached;if(pending)return pending;pending=fetchJson(path).then(feed=>{cached=feed;loadedAt=Date.now();return feed;}).finally(()=>{pending=null;});return pending;}

function curveOnOrBefore(curves, target) {
  const end = utcDate(target).getTime(), start = end - 7 * dayMs;
  return curves.findLast(c => c.date <= target && utcDate(c.date) >= start && c.points.length >= 2);
}

async function treasuryCurves(years) {
  const [index,...shards] = await Promise.all([
    fetchJson('data/ust-curves-daily.json'),
    ...years.map(y => fetchJson(`data/ust-curves-history/${y}.json`).catch(() => null)),
  ]);
  const indices = curveTenors.map(years => index.tenors.findIndex(t => t.years === years));
  return shards.flatMap(shard => (shard?.observations ?? []).map(o => ({
    date:o.date, source:'U.S. Treasury',
    points:curveTenors.map((years,i) => ({years,yieldPct:o.values[indices[i]]})).filter(p => Number.isFinite(p.yieldPct)),
  }))).sort((a,b) => a.date.localeCompare(b.date));
}

async function fedCurves(start, end) {
  const data = await fetchJson('data/fred-weekly-yields.json');
  if (data.schema_version !== 1 || data.frequency !== 'weekly') return [];
  const indices = curveTenors.map(years => data.columns.findIndex(c =>
    c.id === (years < 1 ? `UST ${Math.round(years * 12)}M` : `UST ${years}Y`)));
  return data.observations.filter(row => row.date >= start && row.date <= end).map(row => ({
    date: row.date, source: 'Weekly FRED H.15',
    points: curveTenors.map((years, i) => ({ years, yieldPct: row.values[indices[i]] }))
      .filter(point => Number.isFinite(point.yieldPct))
  }));
}

async function historicalCurves(asOf) {
  if (!asOf) return {};
  const targets = lookbackMonths.map(months => isoDate(offsetMonth(utcDate(asOf),-months)));
  const earliest = target => isoDate(new Date(utcDate(target).getTime() - 7 * dayMs));
  const years = [...new Set(targets.flatMap(target => [earliest(target).slice(0,4),target.slice(0,4)]))];
  const weekly = await fedCurves(earliest(targets.at(-1)),targets[0]).catch(() => []);
  const observed = targets.map(target => curveOnOrBefore(weekly,target));
  const fallback = observed.some(curve => !curve) ? await treasuryCurves(years).catch(() => []) : [];
  return Object.fromEntries(lookbackMonths.map((months,i) =>
    [months, observed[i] || curveOnOrBefore(fallback,targets[i])]));
}

let curveRequest;
function loadHistoricalCurves(feed) {
  const asOf = wsjDates(feed.instruments.filter(r => r.source === 'WSJ'),feed)[0];
  if (curveRequest?.asOf === asOf && curveRequest.expires > Date.now()) return curveRequest.promise;
  const promise = historicalCurves(asOf);
  curveRequest = {asOf,expires:Date.now() + 300000,promise};
  return promise;
}

const rendered = new WeakMap();
async function mount() {
  const hosts = [...document.querySelectorAll('[data-daily-bonds]')];
  if (!hosts.length) return;
  try {
    const feed = await load();
    const compact = hosts.some(host => host.dataset.dailyBonds === 'compact-ust');
    const curves = compact && Array.isArray(feed?.instruments) && feed.history
      ? await loadHistoricalCurves(feed).catch(() => ({})) : undefined;
    for (const host of hosts) {
      if (!host.isConnected) continue;
      const compactTreasuries = host.dataset.dailyBonds === 'compact-ust';
      const snapshot = host.dataset.dailyBonds === 'read-snapshot';
      const hostCurves = compactTreasuries ? curves : undefined;
      const previous = rendered.get(host);
      if (previous?.feed === feed && previous.curves === hostCurves && host.querySelector(snapshot ? '.read-bond-grid' : '.daily-bonds-scroll')) continue;
      const showIdentifiers = host.querySelector('[data-ust-identifiers]')?.getAttribute('aria-pressed') === 'true';
      const scrollLeft = host.querySelector('.daily-ust-scroll')?.scrollLeft ?? 0;
      const expanded = snapshot && host.querySelector('details')?.open;
      host.innerHTML = render(feed,{compactTreasuries,showIdentifiers,curves:hostCurves,snapshot,expanded});
      const scroll = host.querySelector('.daily-ust-scroll');
      if (scroll) scroll.scrollLeft = scrollLeft;
      rendered.set(host,{feed,curves:hostCurves});
    }
  } catch {
    for (const host of hosts) {
      if (!host.isConnected) continue;
      if (host.dataset.dailyBonds === 'read-snapshot') {
        if (!rendered.has(host)) host.innerHTML = readHeading + '<p class="fine">Saved quotes could not be loaded.</p>';
      } else host.innerHTML = '<h2>Bond prices &amp; yields</h2><p class="fine">Saved bond prices could not be loaded. <a href="v4.html#watchlist">Open the full bond watchlist →</a></p>';
    }
  }
}

function toggleIdentifiers(event) {
  const button = event.target.closest('[data-ust-identifiers]');
  if (!button) return;
  const show = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed',String(show));
  for (const cell of button.closest('.daily-ust-watch').querySelectorAll('[data-ust-identifier]')) cell.hidden = !show;
}
root.DailyBondPrices={mount,render,lastDays,yieldText,cleanPrice,offsetMonth};
if(typeof module!=='undefined')module.exports=root.DailyBondPrices;
if(typeof document!=='undefined'&&!document.currentScript?.hasAttribute('data-price-model-only')){document.addEventListener('click',toggleIdentifiers);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});setInterval(()=>{if(!document.hidden)mount();},300000);}
})(typeof window!=='undefined'?window:globalThis);
