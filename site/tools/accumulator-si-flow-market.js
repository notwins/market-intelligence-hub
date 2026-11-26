(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const flow = window.AccumulatorSIFlow;
  const prices = window.MarketPrices;
  const reading = window.StockCardReading;
  const filings = window.FilingComparison;
  const selector = $('share-choice');
  const companyPanel = $('company-reading');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
  const displayDate = new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeZone:'UTC' });
  const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value))
    ? displayDate.format(new Date(value)) : 'Date unavailable';
  const priceText = value => Number(value).toLocaleString('en-SG', { maximumFractionDigits:4 });
  const percent = value => Number.isFinite(value) ? value.toFixed(1)+'%' : '—';
  const safeLink = (value, label) => {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        return '<a href="'+escape(url.href)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>';
      }
    } catch { /* A source link is optional. */ }
    return '';
  };
  const local = new Map();
  let listing = null;
  let selectedQuote = null;
  let analysisRevision = 0;
  let newsRequest;
  let filingRequest;
  const quoteSource = window.AccumulatorQuotes.find(product => product.id === 'si');
  const quoteOptions = new Map();

  async function fetchJson(url) {
    const response = await fetch(url, { cache:'no-cache', signal:AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Public data is unavailable.');
    return response.json();
  }

  function getSaved(path) {
    if (!local.has(path)) {
      local.set(path, fetchJson('../'+path).catch(error => { local.delete(path); throw error; }));
    }
    return local.get(path);
  }

  function showQuoteTable() {
    const tenors = [...new Set(quoteSource.rows.filter(row => row.strikes.some(Number.isFinite)).map(row => row.months))];
    $('ocbc-quotes').innerHTML = tenors.map(months => {
      const headings = quoteSource.guarantees.map((guarantee, i) => {
        const days = quoteSource.guaranteeDays[months]?.[i];
        return '<th scope="col">'+guarantee+'M guarantee'+(days ? '<small>'+days+' days</small>' : '')+'</th>';
      }).join('');
      const rows = quoteSource.rows.filter(row => row.months === months).map(row => {
        const cells = row.strikes.map((strikePct, i) => {
          if (!Number.isFinite(strikePct)) return '<td class="quote-missing"><span aria-label="No strike supplied">—</span></td>';
          const guarantee = quoteSource.guarantees[i];
          const key = [months, row.ko, guarantee].join('-');
          quoteOptions.set(key, { key, months, ko:row.ko, guarantee, strikePct });
          const label = months+' months, '+row.ko+'% KO, '+guarantee+'-month guarantee, '+strikePct+'% strike';
          return '<td><button type="button" data-flow-quote="'+key+'" aria-label="'+label+'" aria-pressed="false" disabled>'+strikePct+'%</button></td>';
        }).join('');
        return '<tr><th scope="row">'+row.ko+'%</th>'+cells+'</tr>';
      }).join('');
      return '<table><caption>'+months+' months</caption><thead><tr><th scope="col">KO</th>'+headings+'</tr></thead><tbody>'+rows+'</tbody></table>';
    }).join('');
  }

  function updateQuotes() {
    const eligible = listing?.ticker === 'NVDA' && listing.currency === 'USD';
    $('select-nvda').hidden = eligible;
    $('select-nvda').disabled = !Array.from(selector.options).some(option => option.value === 'NVDA');
    $('clear-quote').hidden = !selectedQuote;
    for (const button of $('ocbc-quotes').querySelectorAll('button')) {
      button.disabled = !eligible;
      button.setAttribute('aria-pressed', String(button.dataset.flowQuote === selectedQuote?.key));
    }
    $('quote-status').textContent = selectedQuote
      ? 'Applied '+selectedQuote.months+' months · '+selectedQuote.ko+'% KO · '+selectedQuote.guarantee+'M guarantee · '+selectedQuote.strikePct+'% of initial price.'
      : eligible ? 'Select a strike to load its tenor, KO and guarantee.'
        : 'Choose NVIDIA to apply these terms.';
  }

  function updateCloseStatus() {
    const quote = listing && prices.rawQuote(listing);
    $('use-close').hidden = !Number.isFinite(quote?.close);
    if (quote) {
      $('share-status').textContent = listing.name+' · '+listing.currency+' '+priceText(quote.close)
        +' · close on '+day(quote.date)+' · '+prices.quoteStatus(quote).replace(/\.$/,'')+'.';
    } else {
      $('share-status').textContent = listing ? 'Closing price unavailable. Enter the initial price and strike manually.'
        : 'Choose a share to populate its latest published close and view its history.';
    }
    return quote?.close;
  }

  function showShare(applyTerms = true) {
    listing = prices.resolve(selector.value) || null;
    const close = updateCloseStatus();
    if (applyTerms) flow.useShare(listing, close);
    $('share-history').innerHTML = listing ? prices.card(listing.ticker, {
      key:'accumulator-'+listing.id, period:'1Y', showWorkspaceActions:false, showIssuerDetails:false
    }) : '';
    if (listing) prices.mount();
    updateQuotes();
    companyPanel.hidden = !listing;
    if (!listing) companyPanel.open = false;
    updateAnalysis();
  }

  async function loadShares() {
    selector.disabled = true;
    $('refresh-shares').hidden = true;
    $('share-status').textContent = 'Loading the Hub’s share list…';
    await prices.refresh(true);
    const shares = prices.instruments().filter(item => item.asset_type === 'equity' && /^[A-Z]{3}$/.test(item.currency));
    if (!shares.length) {
      $('share-status').textContent = 'The share feed is unavailable. You can still use the manual example.';
      $('refresh-shares').hidden = false;
      return;
    }
    const groups = [...new Set(shares.map(item => item.currency))].sort();
    for (const currency of ['USD', 'SGD', ...groups.filter(unit => !['USD','SGD'].includes(unit))]) {
      const listings = shares.filter(item => item.currency === currency).sort((a,b) => a.ticker.localeCompare(b.ticker));
      if (!listings.length) continue;
      const group = document.createElement('optgroup');
      group.label = currency;
      group.append(...listings.map(item => new Option(item.ticker+' · '+item.name, item.ticker)));
      selector.append(group);
    }
    selector.disabled = false;
    showShare(false);
  }

  function links(label, url) {
    return '<p><a href="'+escape(url)+'">'+escape(label)+'</a></p>';
  }

  function showBrief(brief, item, ticker) {
    const page = '../stocks-beta2.html?ticker='+encodeURIComponent(ticker || item.ticker)+'&research=1';
    const more = links('Open in Stocks Beta 2',page);
    if (!brief) return '<p class="small">No analyst brief is indexed for this listing.</p>'+more;
    const target = brief.target;
    const targetLabel = brief.provider === 'Haitong International' ? 'Target price' : 'Fair value';
    return '<p class="small">'+escape(brief.provider)+' · '+day(brief.date)+(brief.archived?' · Saved report':'')+'</p>'
      +'<p><strong>'+escape(brief.rating || '')+'</strong>'
      +(target ? ' · '+targetLabel+' '+escape(target.currency+' '+target.value) : '')+'</p>'
      +'<p>'+escape(brief.outlook)+'</p>'
      +(brief.guidance ? '<p><strong>Management guidance</strong> '+escape(brief.guidance)+'</p>' : '')
      +'<p>'+safeLink(brief.source,'Analyst source PDF')+'</p>'+more;
  }

  function showFiling(data, ticker) {
    const entry = data.listings.find(row => row.ticker === ticker);
    const company = entry && data.companies[entry.id];
    const year = company && filings.yearFor(company, 'latest');
    if (!year) return '<p class="small">No annual filing analysis is indexed for this listing.</p>';
    const metrics = [
      ['Revenue', 'revenue'], ['Net income', 'netIncome'], ['Revenue growth', 'revenueGrowth'],
      ['Net income growth', 'profitGrowth'], ['Return on equity', 'roe'],
      filings.financial(company) ? ['Return on assets', 'roa'] : ['Operating margin', 'operatingMargin']
    ];
    const values = metrics.map(([label, key], i) => {
      const value = filings.metric(company, year, key);
      const formatted = i >= 2 ? percent(value) : Number.isFinite(value)
        ? company.currency+' '+Math.round(value).toLocaleString('en-SG')+'m' : '—';
      return '<div><dt>'+label+'</dt><dd>'+escape(formatted)+'</dd></div>';
    }).join('');
    return '<p class="small">Fiscal year ended '+day(year.end)+'</p><dl>'+values+'</dl>'
      +'<p>'+safeLink(company.filingUrl, 'Issuer filing')+'</p>'
      +links('Compare peers in Shares Beta 3','../stocks-beta3.html?ticker='+encodeURIComponent(ticker));
  }

  function loadNews() {
    newsRequest ??= (async () => {
      const desk = await getSaved('data/desk-data.json').catch(() => ({}));
      const watchlist = new Map(prices.instruments().map(item => [item.ticker,item]));
      for (const item of desk.watchlist || []) watchlist.set(item.ticker,item);
      const [hourly,research] = await reading.independentSources(getSaved, [...watchlist.values()]);
      const logos = window.CompanyLogos.data
        || await getSaved('assets/company-logos/company-logos.json').catch(() => null);
      return { desk, hourly:hourly.value, research:research.value, logos };
    })();
    return newsRequest;
  }

  async function updateAnalysis() {
    const revision = ++analysisRevision;
    if (!listing || !companyPanel.open) return;
    const item = listing;
    const current = () => revision === analysisRevision;
    const loading = '<p class="small" role="status">Loading…</p>';
    for (const id of ['beta2-brief','beta3-filing','company-news']) $(id).innerHTML = loading;
    const listingKey = getSaved('data/company-fundamentals-listings.json').then(directory =>
      window.CompanyFundamentals.findListing(item, directory)?.[0]);
    filingRequest ??= filings.loadPublished().catch(error => { filingRequest = null; throw error; });

    Promise.all([listingKey, getSaved('data/stocks-beta2-research-briefs.json')]).then(([ticker, data]) => {
      if (current()) $('beta2-brief').innerHTML = showBrief(data.briefs[ticker],item,ticker);
    }).catch(() => {
      if (current()) $('beta2-brief').textContent = 'Analyst outlook could not load.';
    });
    Promise.all([listingKey, filingRequest]).then(([ticker,data]) => {
      if (current()) $('beta3-filing').innerHTML = showFiling(data,ticker);
    }).catch(() => {
      if (current()) $('beta3-filing').textContent = 'Annual filing analysis could not load.';
    });
    Promise.all([listingKey.catch(() => undefined), loadNews()]).then(([ticker, result]) => {
      if (!current()) return;
      const {desk,hourly,research,logos} = result;
      const identity = logos ? window.CompanyLogos.canonical(item.ticker,logos) : item.ticker;
      const aliases = [item.ticker,identity,ticker,...(item.aliases || [])].filter(Boolean);
      $('company-news').innerHTML = reading.reading({
        matches:reading.reportRows([...(desk.reports || []), ...(research ? reading.independentReports(research) : [])],identity,logos,aliases),
        items:reading.newsFor([...(desk.news || []), ...(hourly?.news || [])],identity,aliases),
        listing:item.ticker, newsUnavailable:!hourly || hourly.delivery_error,
        reportsUnavailable:!research || research.delivery_error
      });
    }).catch(() => {
      newsRequest = null;
      if (current()) $('company-news').textContent = 'Company news and saved research could not load.';
    });
  }

  async function loadSOFR() {
    try {
      const data = await fetchJson('https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json');
      const rate = data.refRates?.[0];
      if (rate?.type !== 'SOFR' || !Number.isFinite(rate.percentRate)
        || rate.percentRate < 0 || rate.percentRate > 30 || day(rate.effectiveDate) === 'Date unavailable'
        || rate.effectiveDate < '2026-11-20') return;
      $('sofr-value').textContent = rate.percentRate.toFixed(2)+'%';
      $('sofr-date').textContent = 'Fixing · '+day(rate.effectiveDate);
      flow.setRate(rate.percentRate);
    } catch { /* Keep the dated reference already shown in the page. */ }
  }

  showQuoteTable();
  updateQuotes();
  selector.addEventListener('change', () => showShare());
  $('refresh-shares').addEventListener('click', loadShares);
  $('use-close').addEventListener('click', () => {
    const close = updateCloseStatus();
    if (Number.isFinite(close)) flow.useClose(close);
  });
  $('select-nvda').addEventListener('click', () => { selector.value = 'NVDA'; showShare(); });
  $('clear-quote').addEventListener('click', () => flow.setQuote(null));
  $('ocbc-quotes').addEventListener('click', event => {
    const button = event.target.closest('[data-flow-quote]');
    if (button && listing?.ticker === 'NVDA') flow.setQuote(quoteOptions.get(button.dataset.flowQuote));
  });
  companyPanel.addEventListener('toggle', updateAnalysis);
  document.addEventListener('flow-quote-changed', event => { selectedQuote = event.detail; updateQuotes(); });
  document.addEventListener('flow-reset', () => { selector.value = ''; if (!selector.disabled) showShare(false); });
  document.addEventListener('market-prices-updated', () => { if (listing) updateCloseStatus(); });
  loadShares();
  loadSOFR();
})();
