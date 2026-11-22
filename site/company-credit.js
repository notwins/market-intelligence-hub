(function (root) {
  'use strict';

  const columns = [
    'report_id', 'issuer', 'issuer_type', 'listing_keys', 'report_date', 'publisher', 'coverage',
    'ratings_as_reported', 'credit_view', 'summary', 'key_metrics', 'risks', 'source_pdf', 'source_pages'
  ];
  const required = columns.filter(key => !['listing_keys', 'ratings_as_reported', 'credit_view', 'key_metrics', 'risks'].includes(key));
  const listingKey = value => value.trim().toUpperCase();
  const maxBytes = 1024 * 1024;
  const storageKey = 'market-intel-company-credit-v1';
  const defaultUrl = 'https://notwins.github.io/market-intelligence-content/data/company-credit-summaries-2026-11-22.csv';

  function readCsv(text) {
    text = text.replace(/^\ufeff/, '');
    const field = /"((?:[^"]|"")*)"|([^",\r\n]*)/y;
    const records = [];
    let position = 0;
    let row = [];
    while (position < text.length) {
      field.lastIndex = position;
      const match = field.exec(text);
      row.push(match[1] === undefined ? match[2] : match[1].replaceAll('""', '"'));
      position = field.lastIndex;
      if (text[position] === ',') {
        position++;
        if (position === text.length) row.push('');
        else continue;
      } else if (text[position] === '\r' || text[position] === '\n') {
        position += text.startsWith('\r\n', position) ? 2 : 1;
      } else if (position < text.length) {
        throw new Error('The CSV has an invalid quoted field.');
      }
      if (row.some(cell => cell.trim())) records.push(row);
      row = [];
    }
    return records;
  }

  function parse(text) {
    if (text.length > maxBytes) throw new Error('Choose a credit report CSV under 1 MB.');
    const [header, ...rows] = readCsv(text);
    if (!header || new Set(header).size !== header.length || columns.some(key => !header.includes(key))) {
      throw new Error('Choose a CSV with the credit report export columns.');
    }
    if (!rows.length) throw new Error('The CSV has no credit reports.');
    const ids = new Set();
    return rows.map((cells, index) => {
      const error = message => new Error(`Report ${index + 1}: ${message}`);
      if (cells.length !== header.length) throw error('the column count differs from the header.');
      const row = Object.fromEntries(columns.map(key => [key, cells[header.indexOf(key)].trim()]));
      if (required.some(key => !row[key])) throw error('an issuer, date, summary or other required source field is missing.');
      if (ids.has(row.report_id)) throw error('the report ID is already in the CSV.');
      ids.add(row.report_id);
      const parsedDate = new Date(row.report_date + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.report_date) || !Number.isFinite(+parsedDate)
        || parsedDate.toISOString().slice(0, 10) !== row.report_date) throw error('enter a valid report date in YYYY-MM-DD format.');
      try {
        const source = new URL(row.source_pdf);
        if (source.protocol !== 'https:' || source.username || source.password) throw Error();
      } catch {
        throw error('enter an HTTPS source PDF URL.');
      }
      if (!/^[1-9]\d*(?:(?:\s*[-–]\s*|,\s*)[1-9]\d*)*$/.test(row.source_pages)) throw error('enter the PDF page numbers.');
      if (!['Company', 'Unlisted issuer', 'Sovereign'].includes(row.issuer_type)) throw error('choose a valid issuer type.');
      row.listingKeys = row.listing_keys.split('|').map(listingKey).filter(Boolean);
      if (row.issuer_type === 'Company' ? !row.listingKeys.length : row.listingKeys.length) {
        throw error('listing keys are required for company rows and blank for other issuers.');
      }
      return row;
    }).sort((a, b) => b.report_date.localeCompare(a.report_date));
  }

  let dataRequest;
  async function loadData() {
    return dataRequest ??= (async () => {
      try {
        const saved = root.localStorage?.getItem(storageKey);
        if (saved) return parse(saved);
      } catch { /* Fall back to the preloaded reports. */ }
      const response = await root.fetch(defaultUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Credit reports are unavailable.');
      return parse(await response.text());
    })().catch(error => { dataRequest = null; throw error; });
  }
  const dataApi = { parse, load: loadData, forListing: (rows, ticker) =>
    (rows || []).filter(row => row.listingKeys.includes(listingKey(ticker || ''))) };
  root.CompanyCreditData = dataApi;
  if (typeof module !== 'undefined') module.exports = dataApi;
  const doc = root.document;
  const library = doc?.querySelector('[data-credit-library]');
  if (!library) return;
  library.innerHTML = `<details class="credit-panel">
    <summary>Credit reports</summary>
    <p>Browse dated credit summaries here and on matching stock cards. You can also load your own CSV.</p>
    <div class="credit-actions">
      <label>Load credit report CSV <input type="file" accept=".csv,text/csv" data-credit-file></label>
      <label><input type="checkbox" data-credit-remember disabled> Remember imported CSV in this browser</label>
      <button type="button" data-credit-download hidden>Download CSV</button>
      <button type="button" data-credit-clear hidden>Use preloaded reports</button>
      <button type="button" data-credit-retry hidden>Retry loading reports</button>
    </div>
    <p role="status" data-credit-status></p>
    <div data-credit-reports></div>
  </details>`;

  const file = library.querySelector('[data-credit-file]');
  const remember = library.querySelector('[data-credit-remember]');
  const download = library.querySelector('[data-credit-download]');
  const clear = library.querySelector('[data-credit-clear]');
  const retry = library.querySelector('[data-credit-retry]');
  const status = library.querySelector('[data-credit-status]');
  const reportList = library.querySelector('[data-credit-reports]');
  let csv = '';
  let reports = [];
  let byListing = new Map();
  let imported = false;
  let defaultRequest;
  const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });

  function make(tag, text, className) {
    const element = doc.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function report(row, displayIssuer) {
    const date = dateFormat.format(new Date(row.report_date + 'T00:00:00Z'));
    const title = [displayIssuer && row.issuer, row.publisher, date].filter(Boolean).join(' · ');
    const detail = make('details', '', 'credit-report');
    detail.append(make('summary', title), make('p', row.coverage, 'credit-context'), make('p', row.summary));
    const facts = make('dl', '', 'credit-facts');
    for (const [label, value] of [['Ratings at report date', row.ratings_as_reported], ['Publisher’s view', row.credit_view],
      ['Key metrics', row.key_metrics], ['Risks to watch', row.risks]]) {
      if (value) facts.append(make('dt', label), make('dd', value));
    }
    const link = make('a', 'Source PDF · ' + (/^\d+$/.test(row.source_pages) ? 'p. ' : 'pp. ') + row.source_pages);
    const url = new URL(row.source_pdf);
    url.hash = 'page=' + row.source_pages.match(/^\d+/)[0];
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    detail.append(facts, link);
    return detail;
  }

  function paintCard(slot) {
    const matches = byListing.get(listingKey(slot.dataset.creditListing)) || [];
    slot.replaceChildren();
    if (matches.length) {
      const detail = make('details', '', 'credit-card');
      detail.append(make('summary', `Credit reports (${matches.length})`), ...matches.map(row => report(row, false)));
      slot.append(detail);
    }
  }

  function paintCards(container) {
    container.querySelectorAll('[data-credit-listing]').forEach(paintCard);
  }

  function show(text, rows) {
    csv = text;
    reports = rows;
    byListing = new Map();
    reportList.replaceChildren();
    for (const row of rows) {
      for (const key of new Set(row.listingKeys)) {
        if (!byListing.has(key)) byListing.set(key, []);
        byListing.get(key).push(row);
      }
      reportList.append(report(row, true));
    }
    paintCards(doc);
    download.hidden = !rows.length;
    clear.hidden = remember.disabled = !imported;
    retry.hidden = true;
  }

  async function loadDefaults() {
    status.textContent = 'Loading credit reports…';
    retry.hidden = true;
    defaultRequest ??= (async () => {
      const response = await fetch(defaultUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Credit reports are unavailable.');
      const text = await response.text();
      return { text, rows: parse(text) };
    })().catch(error => { defaultRequest = undefined; throw error; });
    try {
      const { text, rows } = await defaultRequest;
      if (imported) return;
      show(text, rows);
      status.textContent = `${rows.length} credit summaries loaded.`;
    } catch {
      if (imported) return;
      status.textContent = 'Credit summaries could not load. Retry or load a CSV.';
      retry.hidden = false;
    }
  }

  function updateStorage() {
    try {
      if (imported && remember.checked && csv) root.localStorage.setItem(storageKey, csv);
      else root.localStorage.removeItem(storageKey);
      return remember.checked && csv ? ' Saved in this browser.' : '';
    } catch {
      remember.checked = false;
      return ' Browser storage is unavailable.';
    }
  }

  function announce() {
    status.textContent = `${reports.length} ${reports.length === 1 ? 'report' : 'reports'} loaded.` + updateStorage();
  }

  file.addEventListener('change', async () => {
    const [selected] = file.files;
    if (!selected) return;
    try {
      if (selected.size > maxBytes) throw new Error('Choose a credit report CSV under 1 MB.');
      const text = await selected.text();
      if (file.files[0] !== selected) return;
      const rows = parse(text);
      imported = true;
      show(text, rows);
      announce();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      if (file.files[0] === selected) file.value = '';
    }
  });
  remember.addEventListener('change', () => { if (csv) announce(); });
  clear.addEventListener('click', () => {
    file.value = '';
    remember.checked = false;
    imported = false;
    show('', []);
    updateStorage();
    file.focus();
    loadDefaults();
  });
  retry.addEventListener('click', loadDefaults);
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv.replace(/^\ufeff/, '')], { type: 'text/csv;charset=utf-8' }));
    const link = make('a');
    link.href = url;
    link.download = 'credit-report-summaries.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  root.CompanyCredit = { paintCard, paintCards };
  try {
    const saved = root.localStorage.getItem(storageKey);
    if (saved) {
      const rows = parse(saved);
      imported = true;
      show(saved, rows);
      remember.checked = true;
      status.textContent = `${reports.length} saved ${reports.length === 1 ? 'report' : 'reports'} loaded.`;
    }
  } catch { /* Browser storage is optional. */ }
  if (!imported) loadDefaults();
}(globalThis));
