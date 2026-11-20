(function () {
  'use strict';

  const byId = id => document.getElementById(id);
  const status = byId('sb2-status');
  const retry = byId('bos-retry');
  const workspace = byId('bos-history');
  const search = byId('bos-search');
  const menu = byId('sb2-securities');
  const body = byId('bos-observations');
  const details = byId('bos-links');
  const equity = window.BOSEquity;
  const aceEndpoint = 'https://market-intel-ace-lookup.vercel.app/api/match';
  const aceFile = byId('ace-file');
  const aceStatus = byId('ace-status');
  const aceClear = byId('ace-clear');
  const aceFilter = byId('ace-matches-only');
  let ace, aceResults = new Map(), aceRequest = 0;
  const savedAce = new Map();
  let aceLookup;

  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 10 });
  const percent = new Intl.NumberFormat('en-GB', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  let data, selected, dailyChecked = false;

  function validate(archive) {
    if (archive?.kind !== 'mih-bos-monthly-public' || archive.version !== 1
        || !Array.isArray(archive.months) || !archive.months.length
        || !Array.isArray(archive.listings) || !archive.listings.length) {
      throw Error('Invalid BOS monthly archive.');
    }

    let previousMonth = '';
    for (const [month, report, quote] of archive.months) {
      if (!/^\d{4}-\d{2}$/.test(month) || month <= previousMonth || !date(report) || !date(quote) || quote > report) {
        throw Error('Invalid BOS report calendar.');
      }
      previousMonth = month;
    }

    let count = 0;
    const keys = new Set();
    for (const listing of archive.listings) {
      const [ticker, unit, observations, isin] = listing;
      const key = ticker + '|' + unit;
      if (listing.length !== 4 || typeof ticker !== 'string' || !ticker
          || !/^[A-Za-z]{3}$/.test(unit) || keys.has(key)
          || !Array.isArray(observations) || !observations.length
          || (isin !== null && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin))) {
        throw Error('Invalid BOS listing.');
      }
      keys.add(key);
      let previous = -1;
      for (const point of observations) {
        const [index, price, eps, call, target, gap, pct] = point;
        if (point.length !== 7 || !Number.isInteger(index) || index <= previous || index >= archive.months.length
            || !finite(price) || price <= 0 || !finite(eps) || eps <= 0 || typeof call !== 'string'
            || (finite(target) ? target < 0 || !finite(gap) || !finite(pct)
              : typeof target !== 'string' || gap !== null || pct !== null)) {
          throw Error('Invalid BOS monthly observation.');
        }
        previous = index;
      }
      count += observations.length;
    }
    if (count !== archive.observationCount) throw Error('BOS observation count does not match.');
    return archive;
  }

  function item(tag, message) {
    const element = document.createElement(tag);
    element.textContent = message;
    return element;
  }

  function display(value, formatter = number) {
    return finite(value) ? formatter.format(value) : value ?? '—';
  }

  function paintList() {
    const q = search.value.trim().toUpperCase();
    const visible = data.listings.filter(listing => {
      const [ticker, unit] = listing;
      return (ticker + ' ' + unit).toUpperCase().includes(q)
        && (!aceFilter.checked || aceResults.get(listing)?.state === 'matched');
    });
    byId('bos-empty').hidden = visible.length > 0;
    menu.replaceChildren(...visible.map(listing => {
      const node = item('li', '');
      const button = item('button', listing[0] + ' · ' + listing[1]);
      if (aceResults.get(listing)?.state === 'matched') {
        const badge = item('small', 'ACE match');
        badge.setAttribute('aria-hidden', 'true');
        button.append(badge);
      }
      button.type = 'button';
      button.className = 'sb2-security';
      button.setAttribute('aria-pressed', String(listing === selected));
      button.addEventListener('click', () => {
        selected = listing;
        menu.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        paintTable();
        loadSavedAce();
      });
      node.append(button);
      return node;
    }));
  }

  function validateSavedAce(result, isin, currency) {
    const valid = result?.isin === isin && result.currency === currency && date(result.workbookDate)
      && typeof result.sheet === 'string' && result.sheet.length <= 64;
    if (!valid) throw Error('ACE identity could not be verified.');
    if (result.state === 'missing') return result;
    if (result.state === 'currency' && Array.isArray(result.currencies)
        && result.currencies.every(unit => /^[A-Z]{3}$/.test(unit))) return result;
    if (result.state === 'matched' && Array.isArray(result.rows) && result.rows.length
        && result.rows.every(row => typeof row.name === 'string' && typeof row.type === 'string'
        && typeof row.currency === 'string' && Number.isInteger(row.row) && row.row > 0)) return result;
    throw Error('Invalid saved ACE match.');
  }

  async function loadSavedAce() {
    aceLookup?.abort();
    if (ace || !selected) return;
    const listing = selected;
    const [, unit, , isin] = listing;
    const previous = savedAce.get(listing);
    if (!isin || previous && previous.state !== 'error') {
      paintSources();
      return;
    }
    savedAce.delete(listing);
    const currency = unit.toUpperCase() === 'GBX' ? 'GBP' : unit.toUpperCase();
    const url = new URL(aceEndpoint);
    url.searchParams.set('isin', isin);
    url.searchParams.set('currency', currency);
    const request = new AbortController();
    aceLookup = request;
    const timer = setTimeout(() => request.abort('timeout'), 10000);
    paintSources();
    try {
      const response = await fetch(url, { signal: request.signal, credentials: 'omit' });
      if (!response.ok) throw Error('ACE match is unavailable.');
      const match = validateSavedAce(await response.json(), isin, currency);
      savedAce.set(listing, match);
    } catch {
      if (aceLookup === request && (!request.signal.aborted || request.signal.reason === 'timeout')) {
        savedAce.set(listing, { state: 'error' });
      }
    } finally {
      clearTimeout(timer);
      if (aceLookup === request && !ace && selected === listing) paintSources();
    }
  }

  function aceDetail() {
    const [,,, isin] = selected;
    const result = ace ? aceResults.get(selected) : !isin ? { state: 'unverified' } : savedAce.get(selected);
    if (!result) return [item('li', 'ACE · Looking up saved match…')];
    if (result.state === 'error') {
      return [item('li', 'ACE · Saved lookup unavailable. Select the listing again to retry.')];
    }
    if (result.state === 'unverified') return [item('li', 'ACE · No verified ISIN for this listing')];
    if (result.state === 'missing') return [item('li', 'ACE · ISIN absent from this workbook')];
    if (result.state === 'currency') {
      return [item('li', 'ACE · ISIN found in ' + result.currencies.join(', ') + ' · currency differs')];
    }
    const sheet = ace?.sheet ?? result.sheet;
    const heading = item('li', 'ACE · Matched ' + isin + ' · '
      + result.rows.length + (result.rows.length === 1 ? ' workbook row' : ' workbook rows')
      + (result.workbookDate ? ' · saved ' + result.workbookDate : ''));
    const records = item('ul', '');
    for (const row of result.rows) {
      const description = [row.name, row.type, row.currency, sheet + ' row ' + row.row].filter(Boolean);
      records.append(item('li', description.join(' · ')));
    }
    heading.append(records);
    return [heading];
  }

  function repaintAce() {
    paintList();
    paintSources();
  }

  async function loadAce(file) {
    if (!file) return;
    const request = ++aceRequest;
    aceClear.hidden = false;
    aceStatus.textContent = 'Reading ACE workbook…';
    try {
      if (!/\.xlsx$/i.test(file.name)) throw Error('Choose an .xlsx workbook.');
      if (file.size > window.USTDecisionImport.limits.file) throw Error('Choose a workbook no larger than 20 MiB.');
      const bytes = await file.arrayBuffer();
      if (request !== aceRequest) return;
      const workbook = window.AceListingMatch.open(bytes);
      const results = new Map(data.listings.map(listing => {
        const [, unit, , isin] = listing;
        return [listing, window.AceListingMatch.match(workbook, isin, unit)];
      }));
      const total = [...results.values()].filter(result => result.state === 'matched').length;
      aceLookup?.abort();
      ace = workbook;
      aceResults = results;
      aceFilter.checked = false;
      byId('ace-filter').hidden = total === 0;
      aceStatus.textContent = number.format(total) + ' of ' + number.format(data.listings.length)
        + ' listings matched · ' + workbook.sheet + ' worksheet.';
      repaintAce();
    } catch (error) {
      if (request === aceRequest) {
        aceClear.hidden = !ace;
        aceStatus.textContent = 'ACE workbook could not be loaded. ' + error.message
          + (ace ? ' The previous workbook is still shown.' : '');
      }
    }
  }

  function paintSources() {
    if (!selected) return;
    const [ticker, unit, , isin] = selected;
    const daily = equity?.valuationById(ticker);
    let message = dailyChecked ? 'No verified quote for this ticker and quote unit' : 'Checking published edition…';
    if (daily?.row.currency === unit) {
      const row = daily.row;
      message = daily.reportDate + ' edition, ' + row.priceAsOf + ' quote · '
        + display(row.price) + ' ' + unit + ' · ' + display(row.rating) + ' · '
        + equity.valuationLabel(row) + ' ' + display(row.fairValueOrTargetPrice);
    }
    details.replaceChildren(
      item('li', 'Bloomberg · ' + (isin ? isin + ' · snapshot quote date unverified' : 'No verified listing match')),
      item('li', 'BOS Daily · ' + message),
      ...aceDetail()
    );
  }

  function paintTable() {
    const [ticker, unit, observations] = selected;
    byId('bos-listing').textContent = ticker + ' · ' + unit;
    byId('bos-month-count').textContent = observations.length + ' monthly observations';
    paintSources();
    body.replaceChildren(...[...observations].reverse().map(([index, price, eps, call, target, gap, pct]) => {
      const [month, report, quote] = data.months[index];
      const row = document.createElement('tr');
      const key = item('th', month);
      key.scope = 'row';
      key.title = 'Report date ' + report;
      row.append(key, ...[quote, display(price), display(eps), call, display(target), display(gap),
        display(pct, percent)].map(value => item('td', value)));
      return row;
    }));
    body.closest('.sb2-table').scrollTo(0, 0);
  }

  async function load() {
    retry.hidden = true;
    status.textContent = 'Loading BOS monthly history…';
    try {
      const response = await fetch('data/bos-monthly-history.json?v=20261121', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error('BOS monthly archive could not load.');
      data = validate(await response.json());
      selected = data.listings[0];
      search.value = '';
      const count = number.format(data.observationCount);
      status.textContent = count + ' monthly observations · ' + number.format(data.listings.length)
        + ' ticker and quote-unit combinations.';
      workspace.hidden = false;
      byId('ace-import').hidden = false;
      paintList();
      paintTable();
      loadSavedAce();
    } catch {
      status.textContent = 'BOS monthly archive could not load.';
      retry.hidden = false;
    }
  }

  aceFile.addEventListener('change', () => {
    const [file] = aceFile.files;
    loadAce(file);
  });
  aceClear.addEventListener('click', () => {
    aceRequest += 1;
    aceFile.value = '';
    ace = null;
    aceResults.clear();
    aceFilter.checked = false;
    byId('ace-filter').hidden = true;
    aceClear.hidden = true;
    aceStatus.textContent = 'Local workbook cleared. Showing saved matches.';
    repaintAce();
    loadSavedAce();
  });
  aceFilter.addEventListener('change', () => {
    if (aceFilter.checked && aceResults.get(selected)?.state !== 'matched') {
      selected = data.listings.find(listing => aceResults.get(listing)?.state === 'matched');
      paintTable();
    }
    paintList();
  });
  retry.addEventListener('click', load);
  search.addEventListener('input', paintList);
  Promise.resolve(equity?.refresh()).finally(() => {
    dailyChecked = true;
    paintSources();
  });
  load();
})();
