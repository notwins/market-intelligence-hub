/* Shared issuer earnings and saved reading sections for Stocks BETA and Stocks BETA 2. */
(function (root) {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
  const num = (value, digits = 2) => Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits === 2 ? 2 : 0 })
    : 'Unavailable';
  const calendar = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore'
  });
  const clock = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore'
  });
  const day = date => date && Number.isFinite(Date.parse(date))
    ? calendar.format(new Date(date.length === 10 ? date + 'T12:00:00Z' : date)) : 'Date not supplied';

  function url(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const location = new URL(value, 'https://notwins.github.io/market-intelligence-hub/');
      if (location.protocol === 'https:' && !location.username && !location.password
        && !['chatgpt.com', 'chat.openai.com'].includes(location.hostname)) return location.href;
    } catch {
      // Only link to valid public URLs.
    }
    return '';
  }

  function link(value, title) {
    const href = url(value);
    return href ? `<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(title)} ↗</a>` : '';
  }

  const canonical = href => href.replace(/\/index\.html(?=[?#]|$)/, '/').split('#')[0];

  function newsFor(rows, ticker, aliases = [ticker]) {
    const seen = new Map();
    for (const row of rows) {
      const href = url(row.href);
      if (!href || !row.tickers?.some(value => aliases.includes(value))) continue;
      const key = canonical(href), previous = seen.get(key);
      seen.set(key, previous ? {
        ...previous, ...row,
        writeup: {
          ...previous.writeup,
          ...Object.fromEntries(Object.entries(row.writeup || {}).filter(([, value]) => value))
        },
        published_at: row.published_at || previous.published_at
      } : row);
    }
    return [...seen.values()].sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0)
      || String(a.id).localeCompare(String(b.id))).slice(0, 10);
  }

  function reportRows(reports, ticker, logos, aliases = [ticker]) {
    const found = new Map();
    const Logo = root.CompanyLogos;
    const identity = logos && Logo?.canonical(ticker, logos);
    for (const report of reports) {
      const href = url(report.href);
      if (!href) continue;
      const matched = (report.tickers || []).some(value => aliases.includes(value))
        || (identity && Logo.infer({ tags: report.tags, tickers: report.tickers, title: report.title }, logos).includes(identity));
      if (matched) found.set(canonical(href), report);
    }
    return [...found.values()].sort((a, b) => (Date.parse(b.research_date) || 0) - (Date.parse(a.research_date) || 0));
  }

  function independentSources(get, watchlist) {
    return Promise.allSettled([
      get('data/hourly-news.json').then(local => root.DeskNews.load(local, watchlist)),
      get('data/research-feed.json').then(local => root.ContentDelivery.research(local))
    ]);
  }

  function independentReports(feed) {
    return feed.records.map(report => ({
      id: report.id,
      title: report.title,
      href: root.ResearchFeed.destination(report, report.full_report_url),
      summary: report.summary,
      kind: 'Independent research',
      tags: report.tags || [],
      research_date: report.cutoff_sgt
    }));
  }

  function takeaways(items) {
    return `<ul class="sb-takeaways">${items.map(item => `
      <li><strong>${escape(item.label)}</strong> ${escape(item.text)}
        ${item.kind === 'outlook' ? '<small>Management outlook · forecast</small>' : ''}
      </li>`).join('')}</ul>`;
  }

  function earnings(ticker, result, bundle, { includeSource = false } = {}) {
    const { company, observations } = result;
    const latest = observations[0];
    const heading = '<h3>Earnings &amp; company explanation</h3>';
    if (!company) return `<section class="sb-section">${heading}
      <p class="sb-empty">${bundle.earnings ? 'Issuer earnings and takeaways have not been indexed for this exact listing.'
        : 'Issuer earnings could not load.'}</p></section>`;
    return `<section class="sb-section">${heading}
      <p class="sb-meta">${escape(latest?.period)} · issuer release ${day(latest?.report_date)} · ${escape(company.eps_basis)}</p>
      ${takeaways(company.takeaways)}
      ${includeSource ? link(latest?.source_details?.url, 'Issuer earnings release') : ''}
      <details class="sb-details">
        <summary>Quarterly actuals &amp; earlier write-ups · ${observations.length} selected periods</summary>
        <div><p class="sb-note">${escape(company.coverage)} Period ends and source publication dates are separate. Missing dates remain unavailable.</p>
          <div class="sb-table-wrap" tabindex="0" role="region" aria-label="${escape(ticker)} earnings actuals">
            <table data-tc-layout="stock-earnings">
              <caption>Revenue in US$bn · EPS basis: ${escape(company.eps_basis)}</caption>
              <thead><tr><th>Fiscal period / end</th><th>Revenue</th><th>EPS</th><th>Release / evidence</th></tr></thead>
              <tbody>${observations.map(row => `<tr><th>${escape(row.period)}<small>${day(row.period_end)}</small></th>
                <td>${num(row.revenue_usd_bn, 3)}</td><td>${num(row.eps)}</td>
                <td>${day(row.report_date)}<small>${escape(row.evidence_basis)}</small>
                  ${link(row.source_details?.url, row.source_details?.title || 'Source')}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${(company.additional_reports || []).map(report => `<h4>${escape(report.period)}</h4>${takeaways(report.takeaways)}
            ${link(bundle.earnings?.sources[report.source]?.url, 'Earlier issuer source')}`).join('')}
        </div>
      </details>
    </section>`;
  }

  function siReferences(rows, showEmpty) {
    const pricingLink = '<a href="si-beta2.html#si-library">Open SI pricing and one-pagers →</a>';
    const logos = root.CompanyLogos;
    const terms = root.SIBetaCore;
    const percent = value => Number.isFinite(value) ? num(value) + '%' : 'Unavailable';
    const barrier = (type, value) => '<span class="si-term-value" data-si-barrier-band="'
      + (terms?.barrierBand(type, value) || '') + '">' + num(value) + '</span>';
    if (!rows?.length) return showEmpty ? `<h4>SI pricing &amp; saved references</h4>
      <p class="sb-note">No saved SI references for this exact listing.</p>${pricingLink}` : '';
    return `<details class="sb-details">
      <summary>SI references · ${rows.length} saved references</summary>
      <div><p class="sb-note">Historical and indicative references · rounded source values. Tenors are shown in months.
        Coupons default to p.a. where the source basis is unconfirmed. Barrier colours favour lower percentages.</p>
        ${pricingLink}
        <div class="sb-table-wrap" tabindex="0" role="region" aria-label="Saved SI references">
          <table data-tc-layout="stock-si-references">
            <caption>Source dates and product conventions remain separate from the current share quote.</caption>
            <thead><tr><th>Reference / date</th><th>Underlying basket</th><th>Coupon</th>
              <th>Strike / KO / KI %</th><th>Currency / tenor</th><th>Source / review</th></tr></thead>
            <tbody>${rows.map(row => `<tr>
              <th><a href="si-beta2.html?reference=${encodeURIComponent(row.reference)}" aria-label="Open ${escape(row.reference)} one-pager">${escape(row.reference)}</a><small>${day(row.source_date)}</small></th>
              <td data-tc-value="${escape((row.shares || []).join(' / '))}"><span class="si-reference-basket">
                ${(row.shares || []).map(code => `<span>${logos?.data ? logos.html([code], logos.data, { size: 20 }) : ''}${escape(code)}</span>`).join('')}
              </span></td>
              <td data-tc-value="${Number.isFinite(row.coupon_pct) ? row.coupon_pct : ''}"><span class="si-term-value" data-si-coupon-band="${terms?.couponBand(row.coupon_pct) || ''}">${percent(row.coupon_pct)}</span><small>${row.coupon_basis === 'per_annum' ? 'p.a.' : 'p.a. (assumed)'}</small></td>
              <td data-tc-value="${Number.isFinite(row.strike_pct) ? row.strike_pct : ''}"><span class="si-reference-barriers">${barrier('strike', row.strike_pct)} / ${barrier('ko', row.ko_pct)} / ${barrier('ki', row.ki_pct)}</span></td>
              <td>${escape(row.currency)}<small>${num(row.tenor_source_value, 0)} months</small></td>
              <td>${row.source_kind === 'indicative_pricing' ? 'Indicative pricing' : 'Historical reference'}
                ${row.additional_review ? '<small>Additional review required</small>' : ''}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </details>`;
  }

  function reportMarkup(report) {
    return `<article class="sb-report">
      <div class="sb-meta">${day(report.research_date)} · ${escape(report.kind || 'Research')}</div>
      <h4>${link(report.href, report.title)}</h4>
      <p>${escape(report.summary || 'Open the full report for the original analysis and sources.')}</p>
      ${(report.briefs || []).map(brief => link(brief.href, brief.title || 'Matching brief')).join(' · ')}
    </article>`;
  }

  function newsMarkup(row) {
    const [body, earlier, analysis, next] = [row.writeup?.body, row.writeup?.earlier, row.writeup?.analysis, row.writeup?.watch_next];
    const parts = [['What happened', body], ['Earlier context', earlier], ['Why it matters · analysis', analysis], ['Watch next', next]]
      .filter(([, value]) => value);
    const hasTime = row.published_at?.includes('T') && Number.isFinite(Date.parse(row.published_at));
    return `<article class="sb-news">
      <div class="sb-meta">${escape(row.source || 'Publisher not recorded')} · ${day(row.published_at)}
        ${hasTime ? ' · ' + clock.format(new Date(row.published_at)) + ' SGT' : ''}</div>
      <h4>${link(row.href, row.title)}</h4>
      ${parts.length ? `<details><summary>Read saved explanation</summary>
        ${parts.map(([label, text]) => `<h4>${escape(label)}</h4><p>${escape(text).replace(/\n/g, '<br>')}</p>`).join('')}
        <p class="sb-meta">Edition cutoff: ${escape(row.edition_cutoff || 'Not supplied')} · ${escape(row.coverage || '')}</p>
      </details>` : '<p class="sb-meta">Headline only · article body not saved</p>'}
    </article>`;
  }

  function reading({ matches, items, si, afterSi = '', showEmptySi = false, reportsUnavailable, newsUnavailable }) {
    return `<section class="sb-section sb-reading-grid">
      <div>
        <h3>Research &amp; saved write-ups <small>(${matches.length})</small></h3>
        <p class="sb-note">${reportsUnavailable ? 'Independent research is unavailable. Saved matches are shown.'
          : 'Company-tagged or titled reports from the connected catalogue. Links open the original reports.'}</p>
        ${matches.map(reportMarkup).join('') || '<p class="sb-empty">No company-matched report is indexed.</p>'}
        ${siReferences(si, showEmptySi)}
        ${afterSi}
      </div>
      <div>
        <h3>Latest 10 company news <small>(${items.length}/10)</small></h3>
        <p class="sb-note">${newsUnavailable ? 'Independent news is unavailable. Saved matches are shown.'
          : 'Newest saved matches, deduplicated by source URL.'} Publisher time is shown separately from the research cutoff.</p>
        ${items.map(newsMarkup).join('') || '<p class="sb-empty">No matched saved news.</p>'}
      </div>
    </section>`;
  }

  const api = { newsFor, reportRows, earnings, reading, independentSources, independentReports };
  root.StockCardReading = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
