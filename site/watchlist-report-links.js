/* Links use only the public archive indexes. Never add private report metadata here. */
window.MarketWatchlistReports = (() => {
  'use strict';
  const tickers = new Set(['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'BRK.B', 'AMD', 'AVGO', 'MU', 'TSLA', 'TSM']);
  const editionId = /^watchlist-\d{8}T\d{6}Z(?:-r[1-9][0-9]*)?$/;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const date = value => new Date(value).toLocaleString('en-SG', {timeZone:'Asia/Singapore', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false}) + ' SGT';

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
      .map(row => ({...row, href: row.path + '#' + encodeURIComponent(ticker)}));
  }

  function card(ticker, reports, editions, cutoff, unavailable = false) {
    if (!tickers.has(ticker)) return '';
    const rows = entries(ticker, reports, editions, cutoff);
    const company = ticker === 'GOOGL' && Date.parse(cutoff) >= Date.parse('2026-11-03T20:00:00+08:00');
    return `<details class="watchlist-past-reports"><summary data-no-ticker-links aria-label="Past reports for ${escape(ticker)}"><span>Past reports for ${escape(ticker)}${unavailable ? '' : ` (${rows.length + (company ? 1 : 0)})`}</span><span class="watchlist-link-kind">Public · within Market Intel</span></summary><div class="watchlist-report-panel"><p class="watchlist-muted">Opens this share’s section in the saved report, in this tab. Each edition keeps its original cutoff and coverage limits.</p>${unavailable ? '<p role="status">The report list could not be loaded. Refresh saved data to try again.</p>' : rows.length ? `<ul class="watchlist-report-history">${rows.map(row => `<li><a href="${escape(row.href)}">${escape(date(row.as_of))}<span class="watchlist-link-kind">Public report · stays within Market Intel</span></a></li>`).join('')}</ul>` : '<p>No linked public report is available up to this edition’s cutoff.</p>'}${company ? '<p><a href="research/googl/">GOOGL company deep dive · 3 Nov 2026<span class="watchlist-link-kind">Public report · stays within Market Intel</span></a></p>' : ''}<p class="watchlist-muted">Publisher/source links inside saved reports are external and leave Market Intel. Some sources require a subscription.</p><p class="watchlist-private-notice"><strong>Private · not available here</strong><br>Private notes and restricted screenshots are not included in this public archive.</p></div></details>`;
  }

  function legend() {
    return '<div class="watchlist-link-guide" aria-label="Report access and link destinations"><p><strong>Know before you click</strong></p><p><span class="watchlist-link-kind">Public · within Market Intel</span> Saved reports open here in the same tab.</p><p><span class="watchlist-link-kind">External source · leaves Market Intel</span> Publisher links on this page open another website in a new tab and may require a subscription.</p><p class="watchlist-private-notice"><strong>Private · not available here</strong> Private notes and restricted screenshots are not published or linked from this public page.</p></div>';
  }
  return {entries, card, legend};
})();
