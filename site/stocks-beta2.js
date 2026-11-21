/* Monthly market history uses one calendar shared by all listings. */
(function (root) {
  'use strict';

  const e = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const csvCell = value => {
    const text = String(value ?? '');
    return /[,"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };

  function previousSource(security, point, metricCount) {
    return security.previous[point[1 + metricCount]];
  }

  function compactCsv(data) {
    const entries = data.securities.map(security => ({
      security,
      points: new Map(security.observations.map(point => [point[0], point]))
    }));
    const metrics = data.metrics.length;
    const columns = data.securities.flatMap(({ ticker, currency }) => [
      ticker + ' prior_source_ticker', ticker + ' prior_listing_relationship',
      ...data.metrics.map(([key, , unit]) => ticker + ' ' + key + (unit === 'quote' ? ' (' + currency + ')' : ''))
    ]);
    const lines = [['archive_month', 'coverage_report_date', 'price_as_of', ...columns].map(csvCell).join(',')];
    data.months.forEach((dates, index) => {
      const cells = entries.flatMap(({ security, points }) => {
        const point = points.get(index);
        if (!point) return Array(metrics + 2).fill('');
        const prior = previousSource(security, point, metrics);
        return [prior?.[0], prior?.[1], ...point.slice(1, metrics + 1)];
      });
      lines.push([...dates, ...cells].map(csvCell).join(','));
    });
    return '\ufeff' + lines.join('\r\n') + '\r\n';
  }

  if (typeof module !== 'undefined') module.exports = { compactCsv, previousSource };
  const doc = root.document;
  if (!doc) return;

  const get = id => doc.getElementById(id);
  const list = get('sb2-securities');
  const search = get('sb2-search');
  const browse = get('sb2-browse'), pickerResults = get('sb2-picker-results');
  const download = get('sb2-download');
  const retry = get('sb2-retry');
  const embedded = get('sb2-embedded-data');
  const groups = [...doc.querySelectorAll('[data-group]')];
  const format = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
  const calendar = new Intl.DateTimeFormat('en-GB', {
    month: 'short', year: 'numeric', day: 'numeric', timeZone: 'UTC'
  });
  const day = date => calendar.format(new Date(date + 'T00:00:00Z'));
  const relationLabel = {
    prior_ticker: 'Prior ticker',
    vendor_ticker_alias: 'Earlier vendor code',
    predecessor_security: 'Predecessor security'
  };
  let data, history, rankings, pending, origin, researchRequest;
  const deck = get('sb2-detail'), dialog = get('sb2-card-picker');
  const cards = new Map();
  const fundamentalsBounds = { min: 30, max: 52, initial: 32 };
  let fundamentalsWidth = fundamentalsBounds.initial;
  let savedReadingRequest;
  let earningsRequest;
  const listingSymbols = new Map((root.BOSEquity?.reviewedListings || []).filter(row => row.verified)
    .map(row => [row.instrumentId + '|' + row.currency, row.ticker]));
  const exactSymbol = ({ ticker, currency }) => {
    const symbol = listingSymbols.get(ticker + '|' + currency);
    // Beta 1's saved issuer data uses the dotted symbol for Berkshire's Class B shares.
    return symbol === 'BRK-B' ? 'BRK.B' : symbol;
  };
  const comparisonKey = 'market-hub-stocks-beta2-comparison-v1';
  const columnChoice = get('sb2-card-columns');
  const fiscalToggle = get('sb2-fiscal-compare');
  const desktop = root.matchMedia('(any-pointer:fine)');
  let compareFiscalYears = false;
  const touch = root.matchMedia('(pointer:coarse)');
  const portrait = root.matchMedia('(orientation:portrait)');
  const smallScreen = root.matchMedia('(max-width:760px)');
  const mast = get('sb2-mast');
  const relatedLinks = mast.querySelector('.sb2-related-links');

  function placeRelatedLinks() {
    (smallScreen.matches ? get('sb2-options-content') : mast).append(relatedLinks);
  }
  smallScreen.addEventListener('change', placeRelatedLinks);
  placeRelatedLinks();

  function saveComparison() {
    try {
      root.localStorage.setItem(comparisonKey, JSON.stringify({
        columns: columnChoice.value,
        compareFiscalYears,
        fundamentalsWidth,
        history: history.settings(),
        cards: [...cards.values()].map(({ slot, company }) => ({ slot, ticker: company.ticker }))
      }));
    } catch {
      // The comparison still works when browser storage is unavailable.
    }
  }

  function readComparison() {
    try {
      return JSON.parse(root.localStorage.getItem(comparisonKey));
    } catch {
      return null;
    }
  }

  function restoreComparison(saved) {
    if ([...columnChoice.options].some(option => option.value === saved?.columns)) {
      columnChoice.value = saved.columns;
    }
    if (Number.isFinite(saved?.fundamentalsWidth)) setFundamentalsWidth(saved.fundamentalsWidth);
    compareFiscalYears = saved?.compareFiscalYears === true;
    applyFiscalComparison();
    if (!Array.isArray(saved?.cards)) return;

    const companies = new Map(data.securities.map(company => [company.ticker, company]));
    for (const card of saved.cards) {
      const slot = card?.slot;
      const company = companies.get(card?.ticker);
      if (company && Number.isSafeInteger(slot) && slot > 0 && !cards.has(slot)) {
        placeCard(slot, company);
      }
    }
  }

  function fitCards() {
    if (!cards.size || !deck.clientWidth) return;
    const style = root.getComputedStyle(deck);
    const gap = parseFloat(style.columnGap);
    const chart = history.chartSettings();
    const hasCone = chart.metric === 'price' && chart.cone;
    const minimum = parseFloat(style.getPropertyValue(hasCone ? '--sb2-cone-card-min-width' : '--sb2-card-min-width'));
    const preferred = columnChoice.value === 'auto' ? 5 : Number(columnChoice.value);
    const deviceLimit = touch.matches ? (portrait.matches ? 1 : 2) : 5;
    const capacity = Math.max(1, Math.floor((deck.clientWidth + gap) / (minimum + gap)));
    const columns = deck.hasAttribute('data-financial-compare') ? 1 : Math.min(preferred, deviceLimit, capacity, cards.size);
    const status = get('sb2-card-fit');
    const label = columns + (columns === 1 ? ' card per row' : ' cards per row');
    const expanded = deck.querySelector('[data-expanded]');
    if (expanded && (columns === 1 || touch.matches)) setExpanded(expanded, false);
    if (status.textContent === label) return;
    deck.style.setProperty('--sb2-card-columns', String(columns));
    deck.toggleAttribute('data-multiple', columns > 1);
    status.textContent = label;
  }

  new ResizeObserver(fitCards).observe(deck);
  function applyFiscalComparison() {
    const active = compareFiscalYears && desktop.matches;
    fiscalToggle.hidden = !desktop.matches;
    fiscalToggle.setAttribute('aria-pressed', String(active));
    columnChoice.disabled = active;
    deck.toggleAttribute('data-financial-compare', active);
    fitCards();
  }
  desktop.addEventListener('change', applyFiscalComparison);
  fiscalToggle.addEventListener('click', () => {
    compareFiscalYears = !compareFiscalYears;
    applyFiscalComparison();
    saveComparison();
  });
  columnChoice.addEventListener('change', () => {
    fitCards();
    saveComparison();
  });
  touch.addEventListener('change', fitCards);
  portrait.addEventListener('change', fitCards);
  let collection = 'global';

  function fitPickerRows() {
    if (pickerResults.hidden || !list.clientWidth || !list.lastElementChild) return;
    const style = root.getComputedStyle(list);
    const columns = style.gridTemplateColumns.split(/\s+/).length;
    const last = list.children[columns * 5 - 1] ?? list.lastElementChild;
    const height = Math.ceil(last.getBoundingClientRect().bottom - list.getBoundingClientRect().top
      + list.scrollTop + parseFloat(style.paddingBottom)) + 'px';
    if (list.style.getPropertyValue('--sb2-browse-height') !== height) {
      list.style.setProperty('--sb2-browse-height', height);
    }
  }

  new ResizeObserver(fitPickerRows).observe(list);

  function showPicker(open) {
    pickerResults.hidden = !open;
    browse.setAttribute('aria-expanded', String(open));
    browse.textContent = open ? 'Close list' : 'Browse';
    if (open) fitPickerRows();
  }

  function setExpanded(element, expanded) {
    const button = element.querySelector('.sb2-expand');
    element.toggleAttribute('data-expanded', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Collapse chart' : 'Expand chart';
  }

  function logo(security, size) {
    const api = root.CompanyLogos;
    return api?.data ? api.html([security.logo], api.data, { size, base: embedded ? '' : undefined }) : '';
  }

  function paintList() {
    if (!data) return;
    const query = search.value.trim().toLowerCase();
    const terms = query.split(/\s+/);
    const results = data.securities.filter(security => {
      const label = [security.name, security.ticker, security.logo, ...security.previous.map(item => item[0])].join(' ').toLowerCase();
      return (query || security.group === collection) && terms.every(term => label.includes(term));
    });
    list.innerHTML = results.map(security => (
      '<li><button type="button" class="sb2-security" data-security="' + e(security.ticker)
      + '" aria-haspopup="dialog"><span aria-hidden="true" class="sb2-rank">'
      + e(security.rank) + '</span>' + logo(security, 28) + '<span class="sb2-security-name">'
      + e(security.name) + '<span class="sb2-company-ticker">' + e(security.ticker) + '</span></span></button></li>'
    )).join('');
    fitPickerRows();
    get('sb2-empty').hidden = results.length > 0;
    get('sb2-result-count').textContent = results.length + (results.length === 1 ? ' listing' : ' listings')
      + (query ? ' across both lists' : '');
  }

  function paintHeading({ element, company, slot }) {
    element.querySelector('.sb2-company-heading').innerHTML = logo(company, 40) + '<div><h2>' + e(company.name)
      + '</h2><span class="sb2-company-ticker">Card ' + slot + ' · ' + e(company.ticker + ' · ' + company.currency) + '</span></div>';
  }

  function paintMonthlyTable({ element, company }, { from, to }) {
    const points = company.observations.filter(point => point[0] >= from && point[0] <= to);
    const headers = data.metrics.map(([, label, unit]) => (
      '<th scope="col" data-tc-key="' + e(label) + '" data-table-unit="' + e(unit === 'quote' ? company.currency : unit)
      + '">' + e(label + ' (' + (unit === 'quote' ? company.currency : unit) + ')') + '</th>'
    )).join('');
    const values = [...points].reverse().map(point => {
      const [, reportDate, priceDate] = data.months[point[0]];
      const prior = previousSource(company, point, data.metrics.length);
      const ticker = prior?.[0] || company.ticker;
      const title = prior ? ' title="' + e(relationLabel[prior[1]]) + '"' : '';
      return '<tr><th scope="row"><time datetime="' + reportDate + '">' + day(reportDate) + '</time></th>'
        + '<td><time datetime="' + priceDate + '">' + day(priceDate) + '</time></td>'
        + '<td class="sb2-ticker"' + title + '>' + e(ticker) + (prior ? '<br><small>' + e(relationLabel[prior[1]]) + '</small>' : '') + '</td>'
        + point.slice(1, data.metrics.length + 1).map(value => (
          value === null ? '<td class="sb2-missing" aria-label="Unavailable">–</td>'
            : '<td data-tc-value="' + e(value) + '">' + e(format.format(value)) + '</td>'
        )).join('') + '</tr>';
    }).join('');
    const table = element.querySelector('.sb2-history-table table');
    table.dataset.tcLayout = 'beta2-monthly-history';
    table.dataset.tcPinFirst = '';
    table.innerHTML = '<thead><tr><th scope="col">Report date</th><th scope="col">Price date</th>'
      + '<th scope="col">Source ticker</th>' + headers + '</tr></thead><tbody>' + values + '</tbody>';
    table.parentElement.scrollTo(0, 0);
  }

  function getResearch() {
    researchRequest ??= (async () => {
      const local = get('sb2-embedded-research');
      let result;
      if (local) {
        result = JSON.parse(local.textContent);
      } else {
        const response = await fetch('data/stocks-beta2-research-briefs.json?v=20261121.full1', { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('Research download failed');
        result = await response.json();
      }
      if (result.version !== 1 || !result.briefs) throw new Error('Research format is unavailable');
      return result;
    })().catch(error => { researchRequest = undefined; throw error; });
    return researchRequest;
  }

  async function paintResearch({ element, company }) {
    const status = element.querySelector('.sb2-research-status');
    const body = element.querySelector('.sb2-research-body');
    status.textContent = 'Loading company research…';
    try {
      const { briefs, coverageDate } = await getResearch();
      if (!element.isConnected) return;
      const brief = briefs[company.ticker];
      history.setResearchTarget(element, brief);
      if (!brief) {
        status.textContent = 'No research brief for this listing.';
        return;
      }
      const { financials, close, target } = brief;
      const targetLabel = brief.provider === 'Haitong International' ? 'Target price' : 'Fair value';
      const amount = metric => metric ? metric.currency + ' ' + root.StocksBeta2Charts.priceLabel(
        Number(metric.value.replaceAll(',', ''))
      ) : 'Unavailable';
      const gap = Number.isFinite(brief.gap) ? (brief.gap > 0 ? '+' : '') + brief.gap.toFixed(1) + '%' : 'Unavailable';
      const values = [
        ['Research rating', brief.rating || 'Unavailable'], [targetLabel, amount(target)],
        ['Reported close', amount(close)], [targetLabel + ' vs close', gap]
      ].map(([label, value]) => '<div><dt>' + e(label) + '</dt><dd>' + e(value) + '</dd></div>').join('');
      const estimate = i => i >= (financials.actuals ?? 1) ? ' data-estimate' : '';
      const columns = financials.periods.map((period, i) => '<th scope="col"' + estimate(i) + '>' + e(period) + '</th>').join('');
      const rows = financials.rows.map(([label, ...cells]) => '<tr><th scope="row">' + e(label) + '</th>'
        + cells.map((value, i) => '<td' + estimate(i) + '>' + e(value ?? '–') + '</td>').join('') + '</tr>').join('');
      const readthrough = financials.readthrough?.length ? '<h4>Next estimate vs latest actual</h4><ul class="sb2-research-readthrough">'
        + financials.readthrough.map(item => '<li>' + e(item) + '</li>').join('') + '</ul>' : '';
      const sourceLink = (url, label) => '<a href="' + e(url) + '" target="_blank" rel="noopener">' + e(label) + '</a>';
      const dateLabel = brief.archived ? ' · Saved report' : '';
      const modelSuffix = financials.source !== brief.source ? ' · Previous report model' : '';
      body.innerHTML = '<p class="sb2-research-note sb2-research-dates">' + e(brief.provider + ' · ' + day(brief.date) + dateLabel) + '</p>'
        + '<dl class="sb2-quick-values">' + values + '</dl>'
        + (close?.date ? '<p class="sb2-research-note">Reported close · ' + e(day(close.date)) + '</p>' : '')
        + '<p>' + sourceLink(brief.source, 'Source PDF') + '</p>'
        + '<details class="sb2-brief-details"><summary>Outlook &amp; financials</summary>'
        + (brief.archived ? '<p class="sb2-research-note">The ' + e(day(coverageDate)) + ' coverage list had no report link for this listing.</p>' : '')
        + '<h4>Research outlook</h4><p>' + e(brief.outlook) + '</p><p class="sb2-research-note">'
        + e(day(brief.outlookDate)) + ' · ' + sourceLink(brief.source + '#page=' + brief.outlookPage, 'Read analyst write-up') + '</p>'
        + '<h4>Management guidance</h4><p>' + e(brief.guidance || 'The reviewed write-up did not identify specific management guidance.') + '</p>'
        + '<h4>Financials and analyst estimates</h4><p class="sb2-research-note">'
        + e(day(financials.date) + modelSuffix + (financials.units ? ' · ' + financials.units + ' unless marked' : ''))
        + '. A = actual, E = analyst estimate.</p><div class="sb2-table" role="region" aria-label="Research financials. Scroll horizontally for more years." tabindex="0"><table>'
        + '<thead><tr><th scope="col">Metric</th>' + columns + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<p>' + sourceLink(financials.source + '#page=' + financials.page, 'Financial table in PDF') + '</p>'
        + readthrough + '</details>';
      status.textContent = '';
      body.hidden = false;
    } catch {
      if (!element.isConnected) return;
      history.setResearchTarget(element, null);
      const retryResearch = doc.createElement('button');
      retryResearch.type = 'button';
      retryResearch.textContent = 'Retry research';
      retryResearch.addEventListener('click', () => paintResearch({ element, company }));
      status.replaceChildren('Company research could not load. ', retryResearch);
    }
  }

  function showGroup(group) {
    collection = group;
    groups.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === collection)));
    search.value = '';
    list.scrollTop = 0;
    paintList();
  }

  function setFundamentalsWidth(width) {
    fundamentalsWidth = Math.max(fundamentalsBounds.min, Math.min(fundamentalsBounds.max, Math.round(width)));
    deck.style.setProperty('--sb2-fundamentals-width', fundamentalsWidth + '%');
    cards.forEach(({ element }) => syncDivider(element.querySelector('.sb2-research-divider')));
  }

  function syncDivider(divider) {
    divider.setAttribute('aria-valuenow', String(fundamentalsWidth));
    divider.setAttribute('aria-valuetext', 'Fundamentals ' + fundamentalsWidth + '% wide');
  }

  function mountDivider(element, slot) {
    const divider = element.querySelector('.sb2-research-divider');
    const panel = element.querySelector('.sb2-research');
    panel.id = 'sb2-fundamentals-' + slot;
    divider.setAttribute('aria-controls', panel.id);
    divider.setAttribute('aria-valuemin', String(fundamentalsBounds.min));
    divider.setAttribute('aria-valuemax', String(fundamentalsBounds.max));
    syncDivider(divider);

    let drag;
    divider.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
      divider.focus({ preventScroll: true });
      divider.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, width: fundamentalsWidth, total: divider.parentElement.clientWidth };
      divider.setAttribute('data-dragging', '');
    });
    divider.addEventListener('pointermove', event => {
      if (drag?.id === event.pointerId) setFundamentalsWidth(drag.width + 100 * (drag.x - event.clientX) / drag.total);
    });
    divider.addEventListener('lostpointercapture', () => {
      drag = undefined;
      divider.removeAttribute('data-dragging');
      saveComparison();
    });
    divider.addEventListener('keydown', event => {
      const width = {
        ArrowLeft: fundamentalsWidth + 2, ArrowRight: fundamentalsWidth - 2,
        Home: fundamentalsBounds.min, End: fundamentalsBounds.max
      }[event.key];
      if (width === undefined) return;
      event.preventDefault();
      setFundamentalsWidth(width);
      saveComparison();
    });
  }

  async function getSavedJson(path) {
    const response = await root.fetch(path, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Saved source unavailable');
    return response.json();
  }

  function loadSavedReading() {
    savedReadingRequest ??= (async () => {
      const desk = await getSavedJson('data/desk-data.json').catch(() => ({}));
      const watchlist = desk.watchlist || [];
      const hourlyListings = new Map(data.securities.map(company => {
        const ticker = exactSymbol(company) || company.ticker;
        return [ticker, { ticker, name: company.name }];
      }));
      watchlist.forEach(row => hourlyListings.set(row.ticker, row));
      const shared = root.StockCardReading;
      const [hourly, research] = await shared.independentSources(getSavedJson, [...hourlyListings.values()]);
      const logos = root.CompanyLogos?.data
        || await getSavedJson('assets/company-logos/company-logos.json').catch(() => null);
      return {
        watchlist, logos,
        news: [...(desk.news || []), ...(hourly.value?.news || [])],
        reports: [...(desk.reports || []), ...(research.value ? shared.independentReports(research.value) : [])],
        newsUnavailable: hourly.status === 'rejected' || hourly.value.delivery_error,
        reportsUnavailable: research.status === 'rejected' || research.value.delivery_error
      };
    })();
    return savedReadingRequest;
  }

  function paintSavedReading({ element, company }) {
    const shared = root.StockCardReading;
    if (!shared) return;
    const symbol = exactSymbol(company);
    const earnings = element.querySelector('[data-sb2-earnings]');
    const reading = element.querySelector('[data-sb2-reading]');
    earningsRequest ??= root.EquityResearchData.load();
    earningsRequest.then(bundle => {
      const result = root.EquityResearchData.earningsFor({ ticker: symbol || company.ticker, currency: company.currency }, bundle);
      earnings.innerHTML = shared.earnings(company.ticker, result, bundle, { includeSource: true });
    }).catch(() => {
      earnings.innerHTML = shared.earnings(company.ticker, { observations: [] }, {});
    });
    loadSavedReading().then(({ watchlist, logos, news, reports, newsUnavailable, reportsUnavailable }) => {
      const companySymbol = company.logo || symbol || company.ticker;
      const aliases = [company.ticker, symbol, companySymbol].filter(Boolean);
      reading.innerHTML = shared.reading({
        matches: shared.reportRows(reports, companySymbol, logos, aliases),
        items: shared.newsFor(news, companySymbol, aliases),
        si: watchlist.find(row => row.ticker === symbol)?.si,
        showEmptySi: true, newsUnavailable, reportsUnavailable
      });
    }).catch(() => {
      reading.innerHTML = '<p class="sb-note" role="status">Saved research, SI references and news could not load.</p>';
    });
  }

  function refreshRemoveButtons() {
    cards.forEach(({ element, slot }) => {
      const remove = element.querySelector('.sb2-remove-card');
      remove.disabled = cards.size <= 1;
      remove.setAttribute('aria-label', 'Remove card ' + slot);
    });
  }

  function placeCard(slot, company, { focus = false } = {}) {
    const existing = cards.get(slot);
    const element = get('sb2-card-template').content.firstElementChild.cloneNode(true);
    const entry = { element, company, slot };
    element.dataset.slot = String(slot);
    paintHeading(entry);
    element.querySelector('[data-sb2-fundamentals]').innerHTML = root.CompanyFundamentals?.button(company, {
      research: false, compareYears: true
    }) || '';
    const credit = element.querySelector('[data-credit-listing]');
    if (credit) {
      credit.dataset.creditListing = company.ticker;
      root.CompanyCredit?.paintCard(credit);
    }
    const observed = company.observations.length;
    element.querySelector('.sb2-coverage').textContent = observed + ' of ' + data.months.length + ' monthly editions';
    if (existing) {
      history.remove(existing.element);
      existing.element.replaceWith(element);
    } else {
      const next = [...cards.values()].filter(card => card.slot > slot).sort((a, b) => a.slot - b.slot)[0];
      deck.insertBefore(element, next?.element ?? null);
    }
    cards.set(slot, entry);
    history.add(element, company);
    mountDivider(element, slot);
    fitCards();
    paintMonthlyTable(entry, history.range());
    paintResearch(entry);
    paintSavedReading(entry);
    element.querySelector('.sb2-expand').addEventListener('click', () => {
      const previous = deck.querySelector('[data-expanded]');
      if (previous) setExpanded(previous, false);
      if (previous !== element) setExpanded(element, true);
      element.scrollIntoView({ block: 'start' });
    });
    element.querySelector('.sb2-remove-card').addEventListener('click', () => {
      if (cards.size <= 1) return;
      history.remove(element);
      cards.delete(slot);
      element.remove();
      fitCards();
      refreshRemoveButtons();
      saveComparison();
      deck.querySelector('.sb2-company-heading').focus({preventScroll:true});
    });
    refreshRemoveButtons();
    if (focus) element.querySelector('.sb2-company-heading').focus();
  }

  function chooseCompany(ticker, trigger) {
    pending = data.securities.find(item => item.ticker === ticker);
    if (!pending) return;
    origin = trigger;
    get('sb2-card-prompt').textContent = 'Show ' + pending.name + ' on';
    const slots = [...new Set([1, 2, 3, ...cards.keys()])].sort((a, b) => a - b);
    get('sb2-card-options').innerHTML = slots.map(slot => {
      const current = cards.get(slot)?.company;
      const label = current ? current.name + ' (' + current.ticker + ')' : 'Empty';
      return '<button type="button" data-card-target="' + slot + '"><strong>Card ' + slot + '</strong><span>' + e(label) + '</span></button>';
    }).join('') + '<button type="button" data-card-target="new"><strong>New card</strong></button>';
    dialog.showModal();
  }

  dialog.addEventListener('click', event => {
    const choice = event.target.closest('[data-card-target]');
    if (!choice || !pending) return;
    let slot = Number(choice.dataset.cardTarget);
    if (choice.dataset.cardTarget === 'new') {
      slot = 1;
      while (cards.has(slot)) slot++;
    }
    const company = pending;
    origin = null;
    dialog.close();
    showPicker(false);
    placeCard(slot, company, { focus: true });
    saveComparison();
  });
  dialog.addEventListener('close', () => {
    if (origin?.isConnected) origin.focus({preventScroll:true});
    origin = pending = null;
  });

  async function getData() {
    if (embedded) return JSON.parse(embedded.textContent);
    const response = await fetch('data/stocks-beta2-monthly-history.json?v=20261121', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('History download failed');
    return response.json();
  }

  async function load() {
    const status = get('sb2-status');
    retry.hidden = true;
    retry.before(status);
    status.textContent = 'Loading monthly market history…';
    try {
      const result = await getData();
      if (result.version !== 1 || !result.months?.length || !result.metrics?.length || !result.securities?.length) {
        throw new Error('History format is unavailable');
      }
      data = result;
      const total = data.securities.reduce((sum, security) => sum + security.observations.length, 0);
      status.textContent = format.format(total) + ' observations across ' + data.months.length + ' saved monthly editions.';
      get('sb2-workspace').hidden = false;
      download.disabled = false;
      get('sb2-shared-controls').hidden = false;
      const saved = readComparison();
      const oldCards = Array.isArray(saved?.cards) ? saved.cards : [];
      const previousChart = oldCards.filter(card => card?.chart && Number.isSafeInteger(card.slot) && card.slot > 0
        && data.securities.some(company => company.ticker === card.ticker)).sort((a, b) => a.slot - b.slot)[0]?.chart;
      history ??= root.StocksBeta2Charts.mountHistory(data, {
        saved: saved?.history,
        previousChart,
        changeRange: range => cards.forEach(card => paintMonthlyTable(card, range)),
        save: () => { fitCards(); saveComparison(); }
      });
      rankings ??= root.StocksBeta2Charts.mountRankings(data, { logo, chooseCompany });
      showGroup('global');
      if (!cards.size) restoreComparison(saved);
      if (!cards.size) placeCard(1, data.securities.find(item => item.group === 'global') ?? data.securities[0]);
      get('sb2-options-content').prepend(status);
    } catch {
      status.textContent = 'Monthly market history could not load.';
      retry.hidden = false;
    }
  }

  groups.forEach(button => button.addEventListener('click', () => showGroup(button.dataset.group)));
  browse.addEventListener('click', () => showPicker(pickerResults.hidden));
  search.addEventListener('input', () => {
    showPicker(true);
    list.scrollTop = 0;
    paintList();
  });
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pickerResults.hidden) {
      event.preventDefault();
      showPicker(false);
      return;
    }
    const only = list.children.length === 1 && list.querySelector('[data-security]');
    if (event.key !== 'Enter' || !only) return;
    event.preventDefault();
    chooseCompany(only.dataset.security, search);
  });
  list.addEventListener('click', event => {
    const choice = event.target.closest('button[data-security]');
    if (!choice) return;
    chooseCompany(choice.dataset.security, choice);
  });
  download.addEventListener('click', () => {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([compactCsv(data)], { type: 'text/csv;charset=utf-8' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = 'stocks-beta2-monthly-market-data.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  retry.addEventListener('click', load);
  doc.addEventListener('mih-logo-catalogue', () => {
    if (!data) return;
    paintList();
    cards.forEach(paintHeading);
    rankings?.renderBars();
  });
  load();
})(typeof window !== 'undefined' ? window : globalThis);
