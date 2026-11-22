(function (root) {
  'use strict';

  const storageKey = 'market-intel-stocks-beta2-research-library-v1';
  const maxSize = 1500000;
  const publishedPath = 'data/bos-equity-writeups-2026-11-22.json';
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const text = (value, limit) => typeof value === 'string' && value.length <= limit && Boolean(value.trim());
  const page = value => Number.isInteger(value) && value > 0 && value <= 300;
  const sourceUrl = value => {
    if (!text(value, 1200)) return false;
    try {
      const url = new URL(value);
      return url.origin === 'https://productgroup.bankofsingapore.com' && !url.username && !url.password && !url.hash;
    } catch { return false; }
  };
  const span = item => item && date(item.date) && sourceUrl(item.source) && page(item.page);
  const summary = item => span(item) && text(item.provider, 80) && text(item.summary, 1200);
  const stringList = (items, max, limit) => Array.isArray(items) && items.length <= max && items.every(item => text(item, limit));
  const rows = (items, max, width) => Array.isArray(items) && items.length > 0 && items.length <= max
    && items.every(row => Array.isArray(row) && row.length === width && text(row[0], 180)
      && row.slice(1).every(value => value === null || text(value, 110)));

  function validProjections(model) {
    return span(model) && stringList(model.periods, 12, 20) && Number.isInteger(model.actuals)
      && model.actuals > 0 && model.actuals < model.periods.length && new Set(model.periods).size === model.periods.length
      && model.periods.every((period, index) => period.endsWith(index < model.actuals ? 'A' : 'E'))
      && (model.units === '' || text(model.units, 90)) && rows(model.rows, 30, model.periods.length + 1)
      && stringList(model.readthrough, 8, 240);
  }

  function validPeers(peers, published) {
    return span(peers) && text(peers.summary, 1200)
      && (peers.analysisPage == null || page(peers.analysisPage))
      && (published ? peers.columns === undefined && peers.rows === undefined && stringList(peers.names, 20, 180) : (
        peers.names === undefined && stringList(peers.columns, 12, 80) && Array.isArray(peers.rows)
        && (peers.columns.length ? rows(peers.rows, 20, peers.columns.length + 1) : peers.rows.length === 0)
      ));
  }

  function validForecast(forecast) {
    return span(forecast) && text(forecast.actual, 20) && forecast.actual.endsWith('A')
      && [forecast.first, forecast.last].every(period => text(period, 20) && period.endsWith('E'))
      && rows(forecast.rows, 15, 3);
  }

  function parse(raw, published = false) {
    if (raw.length > maxSize) throw new Error('Choose a research library under 1.5 MB.');
    const data = JSON.parse(raw.replace(/^\ufeff/, ''));
    const format = published ? 'stocks-beta2-bos-writeups' : 'stocks-beta2-bos-library';
    if (data?.format !== format || data.version !== 1 || !date(data.coverageDate)
        || !data.listings || typeof data.listings !== 'object' || Array.isArray(data.listings)) {
      throw new Error('Choose a Stocks BETA 2 BOS equity research JSON file.');
    }
    const entries = Object.entries(data.listings);
    if (!entries.length || entries.length > 250 || !entries.every(([ticker, item]) => (
      /^[A-Z0-9][A-Z0-9./-]{0,23} [A-Z]{2}$/.test(ticker) && Array.isArray(item?.notes) && item.notes.length <= 3
      && item.notes.every((note, i) => summary(note) && (i === 0 || item.notes[i - 1].date > note.date))
      && (item.outlook === null || summary(item.outlook)) && (item.notes.length > 0 || item.outlook)
      && (item.peers === null || validPeers(item.peers, published))
      && (published ? item.projections === undefined && validForecast(item.forecast)
        : item.forecast === undefined && validProjections(item.projections))
    ))) throw new Error('The research file contains an invalid listing, note, peer comparison or forecast.');
    return data;
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const figures = root.FinancialDisplay || (typeof module !== 'undefined' ? require('./financial-display.js') : null);

  function sourceNumber(value) {
    const match = /^([+\-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(%|[×x])?$/i.exec(String(value ?? '').trim());
    if (!match) return null;
    const number = Number(match[1].replaceAll(',', '').replace('−', '-'));
    return Number.isFinite(number) ? { number, suffix: match[2] || '', hasPlus: match[1].startsWith('+') } : null;
  }

  function roundedSource(value) {
    const parsed = sourceNumber(value);
    if (!parsed) return value;
    const { number, suffix, hasPlus } = parsed;
    return (hasPlus ? '+' : '') + figures.quote(number) + suffix;
  }

  function amountUnit(label) {
    const match = /^([A-Za-z]{3})\s*(bn|bil(?:lion)?|b|mn|mil(?:lion)?|m|thousand|k|'000)\.?$/i.exec(label?.trim() || '');
    if (!match) return null;
    const [, currency, unit] = match;
    const size = unit.toLowerCase();
    return { currency, multiplier: size.startsWith('b') ? 1e9 : size.startsWith('m') ? 1e6 : 1e3 };
  }

  function projectionRow(label, cells, fallbackUnit) {
    const explicit = /\s*\(([^()]*)\)$/.exec(label);
    const financialTotal = /revenue|turnover|sales|income|profit|cash flow|\bebit(?:da)?\b|assets|liabilities|debt|market cap/i.test(label)
      && !/per share|growth|margin|yield|%|\b(?:eps|dps)\b/i.test(label);
    const sourceUnit = financialTotal ? amountUnit(explicit ? explicit[1] : fallbackUnit) : null;
    if (!sourceUnit) return { label, values: cells.map(roundedSource) };
    const amounts = cells.map(cell => {
      const parsed = sourceNumber(cell);
      return parsed && !parsed.suffix ? parsed.number * sourceUnit.multiplier : null;
    });
    if (!amounts.some(Number.isFinite)) return { label, values: cells };
    const scale = figures.scaleFor(amounts);
    return {
      label: (explicit ? label.slice(0, explicit.index) : label) + ' (' + sourceUnit.currency + ' ' + figures.unit(scale) + ')',
      values: cells.map((cell, i) => amounts[i] === null ? cell : figures.amount(amounts[i], scale))
    };
  }

  const link = (item, label) => '<a href="' + esc(item.source) + '#page=' + item.page
    + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  const noteSource = (item, day) => '<p class="sb2-research-note">' + esc(item.provider) + ' · '
    + '<time datetime="' + item.date + '">' + esc(day(item.date)) + '</time> · ' + link(item, 'Source PDF') + '</p>';

  function peerTable({ columns, rows: peerRows, subject }) {
    if (!columns?.length) return '';
    const display = columns.map((label, i) => projectionRow(label, peerRows.map(row => row[i + 1])));
    const heads = display.map(({ label }) => '<th scope="col">' + esc(label) + '</th>').join('');
    const data = peerRows.map(([name, ...cells], row) => '<tr><th scope="row">' + esc(name)
      + (name === subject ? ' <small>(company)</small>' : '') + '</th>'
      + cells.map((value, i) => '<td' + (value == null ? '' : ' title="' + esc(value) + '"')
        + '>' + esc(display[i].values[row] ?? '–') + '</td>').join('') + '</tr>').join('');
    return '<div class="sb2-table" role="region" aria-label="Report peers. Scroll horizontally for additional columns." tabindex="0">'
      + '<table><thead><tr><th scope="col">Company</th>' + heads + '</tr></thead><tbody>' + data + '</tbody></table></div>';
  }

  function sections({ notes, outlook, peers }, day) {
    const totals = notes.length === 3 ? '' : '<p class="sb2-research-note">' + (notes.length
      ? notes.length + ' distinct dated ' + (notes.length === 1 ? 'update' : 'updates') + ' in the saved reports.'
      : 'The saved reports contain a strategy outlook for this listing.') + '</p>';
    const items = notes.length ? '<ol class="sb2-research-notes">' + notes.map(note => '<li>'
      + noteSource(note, day) + '<p>' + esc(note.summary) + '</p></li>').join('') + '</ol>' : '';
    const context = outlook ? '<h4>Strategy outlook</h4>' + noteSource(outlook, day) + '<p>' + esc(outlook.summary) + '</p>' : '';
    const contextLink = peers?.analysisPage && peers.analysisPage !== peers.page
      ? ' · ' + link({ ...peers, page: peers.analysisPage }, 'Competitive discussion in PDF') : '';
    const names = peers?.names?.length ? '<p>Report peers include ' + esc(peers.names.join(', ')) + '.</p>' : '';
    const peerReview = peers ? '<p class="sb2-research-note">Report dated ' + esc(day(peers.date)) + ' · '
      + link(peers, 'Peer comparison in PDF') + contextLink + '</p><p>' + esc(peers.summary) + '</p>' + names + peerTable(peers)
      : '<p class="sb2-research-note">No peer comparison was identified in the saved reports.</p>';
    return '<section class="sb2-research-archive"><h4>Latest analyst write-ups</h4>' + totals + items + context + '</section>'
      + '<details class="sb2-research-peers"><summary>Competitors and peers</summary>' + peerReview + '</details>';
  }

  function forecastSection(model, day) {
    if (!model) return '';
    const percent = value => {
      const parsed = sourceNumber(value);
      if (parsed?.suffix !== '%') return '<td>' + esc(roundedSource(value) ?? '–') + '</td>';
      return '<td class="fund-change-value" data-direction="' + figures.direction(parsed.number) + '" title="' + esc(value)
        + '">' + esc(figures.changeText(parsed.number)) + '</td>';
    };
    const body = model.rows.map(([name, next, final]) => '<tr><th scope="row">' + esc(name) + '</th>'
      + percent(next) + percent(final) + '</tr>').join('');
    return '<h4>Forecast change from ' + esc(model.actual) + '</h4><p class="sb2-research-note">'
      + 'Change from the latest actual fiscal year, calculated from the ' + esc(day(model.date)) + ' analyst model. '
      + link(model, 'Model in PDF') + '</p><div class="sb2-table" role="region" aria-label="Forecast changes" tabindex="0">'
      + '<table><thead><tr><th scope="col">Metric</th><th scope="col" data-estimate>' + esc(model.first) + '</th>'
      + '<th scope="col" data-estimate>' + esc(model.last) + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  if (typeof module !== 'undefined') module.exports = { parse, sections, forecastSection, projectionRow };
  const doc = root.document;
  const file = doc?.getElementById('sb2-research-file');
  if (!file) return;
  const status = doc.getElementById('sb2-research-import-status');
  const remember = doc.getElementById('sb2-research-remember');
  const clear = doc.getElementById('sb2-research-clear');
  let data = null, publishedRequest;

  async function forListing(ticker) {
    if (data?.listings[ticker]) return data.listings[ticker];
    const base = root.ContentDelivery?.CONTENT;
    if (!base || doc.getElementById('sb2-embedded-data')) return undefined;
    publishedRequest ??= root.fetch(base + publishedPath, { signal: AbortSignal.timeout(6500) })
      .then(response => {
        if (!response.ok) throw new Error('Published equity research is unavailable.');
        return response.text();
      })
      .then(raw => parse(raw, true))
      .catch(() => null);
    const published = await publishedRequest;
    return data?.listings[ticker] || published?.listings[ticker];
  }

  root.StocksBeta2Research = { forListing, sections, forecastSection, projectionRow };

  function update(saved) {
    status.textContent = data ? Object.keys(data.listings).length + ' listings loaded '
      + (saved ? 'in this browser.' : 'for this visit.') : '';
    clear.hidden = !data;
    remember.checked = saved;
    doc.dispatchEvent(new Event('sb2-research-updated'));
  }

  try {
    const saved = root.localStorage.getItem(storageKey);
    if (saved) { data = parse(saved); update(true); }
  } catch { status.textContent = 'Choose the research JSON to reload the library.'; }

  file.addEventListener('change', async () => {
    const selected = file.files[0];
    if (!selected) return;
    file.disabled = clear.disabled = remember.disabled = true;
    try {
      if (selected.size > maxSize) throw new Error('Choose a research library under 1.5 MB.');
      const raw = await selected.text();
      data = parse(raw);
      let saved = false;
      try {
        if (remember.checked) { root.localStorage.setItem(storageKey, raw); saved = true; }
        else root.localStorage.removeItem(storageKey);
      } catch { /* The current visit works even if browser storage is unavailable. */ }
      update(saved);
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'The selected file is not valid JSON.' : error.message;
    } finally {
      file.value = '';
      file.disabled = clear.disabled = remember.disabled = false;
    }
  });

  clear.addEventListener('click', () => {
    try { root.localStorage.removeItem(storageKey); }
    catch { status.textContent = 'The remembered copy could not be cleared.'; return; }
    data = null;
    update(false);
  });
})(typeof window !== 'undefined' ? window : globalThis);
