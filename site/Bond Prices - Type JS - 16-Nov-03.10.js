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

function treasuryTable(rows, feed) {
  const levels = rows.map(r => displayedYield(feed.latest[r.id])).filter(Number.isFinite);
  const low = Math.min(...levels), high = Math.max(...levels);
  return `<div class="daily-bonds-scroll daily-ust-scroll" role="region" aria-label="US Treasury quotes" tabindex="0">
    <table class="daily-ust-table" role="table">
      <caption>Ask price per 100 · Asked yield % p.a. · Darker = higher yield.</caption>
      <thead role="rowgroup"><tr role="row">
        <th role="columnheader" scope="col">Maturity</th>
        <th role="columnheader" scope="col">Coupon</th>
        <th role="columnheader" scope="col">Price</th>
        <th role="columnheader" scope="col">Yield</th>
        <th role="columnheader" scope="col" class="daily-ust-bond-heading">ISIN &amp; bond</th>
      </tr></thead>
      <tbody role="rowgroup">${rows.map(r => {
        const q = feed.latest[r.id];
        const yieldLevel = displayedYield(q);
        const band = yieldLevel === null ? '' : high === low ? '0' : String(Math.round((yieldLevel - low) / (high - low) * 4));
        const maturity = Date.parse(r.maturity + 'T12:00:00Z');
        const maturityLabel = Number.isFinite(maturity) ? monthYear.format(maturity).replace(' ', '-') : '—';
        const coupon = Number.isFinite(r.coupon) ? couponRate.format(r.coupon) + '%' : '—';
        const stale = q && (feed.checks[r.id]?.status !== 'ok' || Date.now() - Date.parse(q.date + 'T23:59:59+08:00') > 4 * 86400000);
        const status = !q ? 'No quote' : stale ? 'Saved quote' : '';
        const maturitySuffix = ' · ' + r.maturity;
        const bondName = r.name.endsWith(maturitySuffix) ? r.name.slice(0,-maturitySuffix.length) : r.name;
        return `<tr role="row">
          <th role="rowheader" scope="row" class="daily-ust-maturity">${E(maturityLabel)}</th>
          <td role="cell" class="daily-ust-coupon" data-coupon-band="${couponBand(r.coupon)}">${E(coupon)}</td>
          <td role="cell" class="daily-ust-price">${num(q?.ask,1)}</td>
          <td role="cell" class="daily-ust-yield"><span data-yield-band="${band}">${yieldLevel === null ? '—' : num(q.yield_pct,1) + '%'}</span></td>
          <td role="cell" class="daily-ust-bond"><span class="daily-ust-isin">${E(r.isin || r.id)}</span>
            <a href="${E(safe(r.source_url))}" target="_blank" rel="noopener noreferrer" title="${E(r.name)} · WSJ Treasury quotes">${E(bondName)} <span aria-hidden="true">↗</span></a>
            ${status ? `<span class="daily-ust-quote-status">${status}</span>` : ''}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function compactWatchlist(feed, checked) {
  const treasuries = feed.instruments.filter(r => r.source === 'WSJ');
  const otherBonds = feed.instruments.filter(r => r.source !== 'WSJ');
  return `<h3 class="daily-ust-title">US Treasuries (UST)</h3>
    ${treasuryTable(treasuries,feed)}
    <details class="daily-bonds-history daily-ust-evidence">
      <summary>Full-precision Treasury quotes &amp; dates</summary>
      <p class="fine">Last check: ${E(checked)} SGT. The quote date is shown for each bond.</p>
      ${table(treasuries,feed,false,'Latest saved Treasury prices per 100 face value and yields % per year')}
    </details>
    <h3 class="daily-ust-title daily-ust-other">Other watched bonds</h3>
    ${table(otherBonds,feed,false,'Prices per 100 face value · yields % per year')}`;
}
function render(feed,{compactTreasuries=false}={}){
 if(feed?.schema_version!==1||!Array.isArray(feed.instruments)||feed.instruments.length!==34||!feed.latest||!feed.history||!feed.checks)return '<p class="fine">Bond price feed unavailable. Open the original source links in the full watchlist.</p>';
 const count=feed.instruments.filter(r=>feed.latest[r.id]).length,checked=feed.checked_at?new Date(feed.checked_at).toLocaleString('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'Unavailable';
 return `<div class="section-head"><div>${compactTreasuries ? '' : '<p class="eyebrow">DAILY BOND WATCHLIST</p>'}<h2>Bond prices &amp; yields</h2></div><a href="v4.html#watchlist">Full watchlist →</a></div>${compactTreasuries ? `<p class="fine daily-ust-summary">${count}/34 have saved quotes · Daily check at 7:00 am Singapore time.</p>` : `<p class="fine">29 watched US Treasuries + five Bondsupermart bonds. Daily check scheduled for 7:00 am Singapore time; publication follows processing. ${count}/34 have saved quotes. Last check: ${E(checked)} SGT.</p>`}${compactTreasuries ? compactWatchlist(feed,checked) : table(feed.instruments,feed)}<details class="daily-bonds-history"><summary>Last few daily prices &amp; yields</summary><p class="fine">Only source-dated prices are saved. Repeated checks add no duplicate quote dates; weekends and holidays are not filled. Earlier undated UST shortlist values remain in the full watchlist and are excluded from daily history.</p>${table(feed.instruments,feed,true)}</details><p class="fine daily-bonds-basis">WSJ: Treasury prices converted from points and 32nds; yield is the asked yield. Bondsupermart: indicative full-lot bid/ask prices with bid yield to maturity (YTM) or worst (YTW), as labelled. Each row retains its own source date. <a href="${encodeURI(path)}" download>Download prices and full saved history (JSON)</a>.</p>`;
}
let cached=null,pending=null,loadedAt=0;
async function load(){if(cached&&Date.now()-loadedAt<300000)return cached;if(pending)return pending;pending=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(path,{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error('Unavailable');cached=await response.json();loadedAt=Date.now();return cached;}finally{clearTimeout(timer);pending=null;}})();return pending;}
async function mount(){const hosts=[...document.querySelectorAll('[data-daily-bonds]')];if(!hosts.length)return;try{const feed=await load();for(const h of hosts)if(h.isConnected)h.innerHTML=render(feed,{compactTreasuries:h.dataset.dailyBonds==='compact-ust'});}catch{for(const h of hosts)if(h.isConnected)h.innerHTML='<h2>Bond prices &amp; yields</h2><p class="fine">Saved bond prices could not be loaded. <a href="v4.html#watchlist">Open the full bond watchlist →</a></p>';}}
root.DailyBondPrices={mount,render,lastDays,yieldText};
if(typeof module!=='undefined')module.exports=root.DailyBondPrices;
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();document.addEventListener('visibilitychange',()=>{if(!document.hidden)mount();});setInterval(()=>{if(!document.hidden)mount();},300000);}
})(typeof window!=='undefined'?window:globalThis);
