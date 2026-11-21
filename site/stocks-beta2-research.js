(function (root) {
  'use strict';

  const storageKey = 'market-intel-stocks-beta2-research-library-v1';
  const maxSize = 1500000;
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

  function validPeers(peers) {
    return span(peers) && text(peers.summary, 1200)
      && (peers.analysisPage == null || page(peers.analysisPage))
      && stringList(peers.columns, 12, 80) && Array.isArray(peers.rows)
      && (peers.columns.length ? rows(peers.rows, 20, peers.columns.length + 1) : peers.rows.length === 0);
  }

  function parse(raw) {
    if (raw.length > maxSize) throw new Error('Choose a research library under 1.5 MB.');
    const data = JSON.parse(raw.replace(/^\ufeff/, ''));
    if (data?.format !== 'stocks-beta2-bos-library' || data.version !== 1 || !date(data.coverageDate)
        || !data.listings || typeof data.listings !== 'object' || Array.isArray(data.listings)) {
      throw new Error('Choose a Stocks BETA 2 BOS equity research JSON file.');
    }
    const entries = Object.entries(data.listings);
    if (!entries.length || entries.length > 250 || !entries.every(([ticker, item]) => (
      /^[A-Z0-9][A-Z0-9./-]{0,23} [A-Z]{2}$/.test(ticker) && Array.isArray(item?.notes) && item.notes.length <= 3
      && item.notes.every((note, i) => summary(note) && (i === 0 || item.notes[i - 1].date > note.date))
      && (item.outlook === null || summary(item.outlook)) && (item.notes.length > 0 || item.outlook)
      && (item.peers === null || validPeers(item.peers)) && validProjections(item.projections)
    ))) throw new Error('The research file contains an invalid listing, note, peer comparison or forecast.');
    return data;
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const link = (item, label) => '<a href="' + esc(item.source) + '#page=' + item.page
    + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  const noteSource = (item, day) => '<p class="sb2-research-note">' + esc(item.provider) + ' · '
    + '<time datetime="' + item.date + '">' + esc(day(item.date)) + '</time> · ' + link(item, 'Source PDF') + '</p>';

  function peerTable({ columns, rows: peerRows, subject }) {
    if (!columns.length) return '';
    const heads = columns.map(label => '<th scope="col">' + esc(label) + '</th>').join('');
    const data = peerRows.map(([name, ...cells]) => '<tr><th scope="row">' + esc(name)
      + (name === subject ? ' <small>(company)</small>' : '') + '</th>'
      + cells.map(value => '<td>' + esc(value ?? '–') + '</td>').join('') + '</tr>').join('');
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
    const peerReview = peers ? '<p class="sb2-research-note">Report dated ' + esc(day(peers.date)) + ' · '
      + link(peers, 'Peer comparison in PDF') + contextLink + '</p><p>' + esc(peers.summary) + '</p>' + peerTable(peers)
      : '<p class="sb2-research-note">No peer comparison was identified in the saved reports.</p>';
    return '<section class="sb2-research-archive"><h4>Latest analyst write-ups</h4>' + totals + items + context + '</section>'
      + '<details class="sb2-research-peers"><summary>Competitors and peers</summary>' + peerReview + '</details>';
  }

  if (typeof module !== 'undefined') module.exports = { parse, sections };
  const doc = root.document;
  const file = doc?.getElementById('sb2-research-file');
  if (!file) return;
  const status = doc.getElementById('sb2-research-import-status');
  const remember = doc.getElementById('sb2-research-remember');
  const clear = doc.getElementById('sb2-research-clear');
  let data = null;
  root.StocksBeta2Research = { forListing: ticker => data?.listings[ticker], sections };

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
