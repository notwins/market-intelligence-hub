/* Links use only the public archive indexes. Never add private report metadata here. */
window.MarketWatchlistReports = (() => {
  'use strict';
  const tickers = new Set(['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK.B', 'AMD', 'AVGO', 'MU', 'TSLA', 'TSM']);
  const editionId = /^watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?$/;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const date = value => {const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return `${p.day} ${p.month.slice(0,3)} ${p.year} · ${Number(p.hour)}:${p.minute} ${p.dayPeriod.toUpperCase()} SGT`;};

  function entries(ticker, reports, editions, cutoff) {
    if (!tickers.has(ticker) || !Array.isArray(reports) || !Array.isArray(editions) || !Number.isFinite(Date.parse(cutoff))) return [];
    const archive = new Map(editions.map(row => [row?.id, row]));
    const seen = new Set();
    return reports.filter(row => {
      const id = row?.edition_id, saved = archive.get(id), asOf = Date.parse(row?.as_of);
      if (!editionId.test(id || '') || seen.has(id) || !saved ||
          saved.path !== 'data/watchlist/archive/' + id + '.json' ||
          saved.as_of !== row.as_of || !Number.isFinite(asOf) || asOf > Date.parse(cutoff) ||
          row.path !== 'data/watchlist/reports/' + id + '.html' || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) return false;
      seen.add(id);
      return true;
    }).sort((a, b) => Date.parse(b.as_of) - Date.parse(a.as_of) || b.edition_id.localeCompare(a.edition_id))
      .map(row => ({...row, href: 'watchlist-report.html?edition=' + encodeURIComponent(row.edition_id) + '#' + encodeURIComponent(ticker)}));
  }

  function companyEntries(ticker, reports, editions, cutoff, archives, researchIndex) {
    const seen=new Set();
    return entries(ticker,reports,editions,cutoff).flatMap(row=>{
      const company=archives?.[row.edition_id]?.rows?.find(x=>x.ticker===ticker);
      const approved=researchIndex?.[row.edition_id]?.[ticker]||[];
      const items=approved.filter(x=>company?.research?.[x.index]?.headline===x.headline).map(x=>company.research[x.index]);
      // New editions may explicitly mark source-checked company research. No keyword guessing.
      if(!approved.length)items.push(...(company?.research||[]).filter(x=>x.scope==='company'&&x.facts?.length&&x.sources?.length));
      const key=JSON.stringify(items.map(x=>[x.date,x.facts,x.analysis,x.risks,x.next_watch]));
      if(!items.length||seen.has(key))return [];seen.add(key);
      return [{...row,headlines:items.map(x=>x.headline)}];
    });
  }
  function card(ticker, reports, editions, cutoff, unavailable = false, archives = {}, researchIndex = {}) {
    if (!tickers.has(ticker)||unavailable) return '';
    const rows=companyEntries(ticker,reports,editions,cutoff,archives,researchIndex);
    const company=ticker==='GOOGL'&&Date.parse(cutoff)>=Date.parse('2026-11-03T20:00:00+08:00');
    if(!rows.length&&!company)return '';
    return `<details class="watchlist-past-reports"><summary data-no-ticker-links>Saved research editions (${rows.length+(company?1:0)})</summary><div class="watchlist-report-panel"><span class="watchlist-label">Public · within Market Intel</span>${rows.length?`<ul class="watchlist-report-history">${rows.map(row=>`<li><a href="${escape(row.href)}"><time>${escape(date(row.as_of))}</time><span>${escape(row.headlines[0])}${row.headlines.length>1?' · +'+(row.headlines.length-1)+' more':''}</span></a></li>`).join('')}</ul>`:''}${company?'<p><a href="research/googl/">Alphabet company deep dive · 03 Nov 2026</a></p>':''}</div></details>`;
  }
  function legend(){return '<p class="watchlist-destination-key">Company names and saved research stay in Market Intel. <b>External ↗</b> opens another website.</p>';}
  return {entries, companyEntries, card, legend};
})();
