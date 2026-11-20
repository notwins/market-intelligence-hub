/* Annual statements imported by the reader. Storage is scoped to this browser origin. */
(function (root) {
  'use strict';

  const types = { income: 'Income statement', balance: 'Balance sheet', cash: 'Cash flow' };
  const initialSeries = {
    income: /^Total Revenue$/,
    balance: /^Total Assets$/,
    cash: /^Cash Flow from(?:\/Used in)? Operating Activities/
  };
  const suffixes = {
    XHKG: 'HK', XSHG: 'SS', XSES: 'SI', XLON: 'L', XTSE: 'TO', XSWX: 'SW',
    XETR: 'DE', XTKS: 'T', XPAR: 'PA', XAMS: 'AS', XMAD: 'MC', XASX: 'AX'
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const norm = value => String(value ?? '').trim().replace(/\s+Equity$/i, '').replace(/\s+/g, ' ').toUpperCase();
  const currency = value => /^(GBX|GBp)$/.test(value) ? 'GBP' : value;
  const fields = ['bbTicker', 'instrumentId', 'ticker', 'publicTicker', 'symbol', 'id'];
  const doc = root.document;
  let directoryRequest, databaseRequest, memory, dialog, active;
  let statement = 'income';
  let temporary = false;

  function aliases([id, mic, symbol]) {
    const names = [id, mic + ':' + symbol];
    if (id.endsWith(' US')) names.push(symbol, symbol.replace('.', '-'));
    const suffix = suffixes[mic];
    if (suffix) {
      names.push(symbol + '.' + suffix);
      if (mic === 'XHKG') names.push(String(Number(symbol)).padStart(4, '0') + '.HK');
    }
    return names.map(norm);
  }

  function findListing(item, directory) {
    if (!item) return null;
    const source = typeof item === 'string' ? { ticker: item } : item;
    if (/conflict|unresolved/i.test(source.identityStatus || '') || source.currentEligible === false
        || (source.asset_type && source.asset_type !== 'equity')
        || (source.instrumentType && !/^(stock|equity)$/i.test(source.instrumentType))) return null;
    const explicit = [source.bbTicker, source.instrumentId, source.ticker].map(norm).filter(v => /^[^ ]+ [A-Z]{2}$/.test(v));
    const names = fields.map(key => norm(source[key])).filter(Boolean);
    const listed = names.concat((source.aliases || []).map(norm));
    const refs = explicit.length ? explicit : listed;
    const matches = directory.filter(row => {
      const [, mic, symbol, unit] = row;
      if (source.currency && currency(source.currency) !== currency(unit)) return false;
      const exchange = norm(source.exchangeMic || source.mic);
      if (exchange && exchange !== mic) return false;
      if (exchange && names.includes(norm(symbol))) return true;
      return aliases(row).some(name => refs.includes(name));
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function unpack(value, directory) {
    if (value?.version !== 1 || value.source !== 'Morningstar' || !value.companies
        || typeof value.companies !== 'object' || Array.isArray(value.companies)) {
      throw new Error('Choose a Stocks BETA 2 Fundamentals JSON file.');
    }
    const ids = new Set(directory.map(row => row[0]));
    const entries = Object.entries(value.companies);
    const valid = entries.length > 0 && entries.every(([id, company]) => ids.has(id)
      && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(company?.capturedAt)
      && Object.keys(types).every(key => {
        const report = company.statements?.[key];
        return /^[A-Z]{3}$/.test(report?.currency) && typeof report.fiscalEnd === 'string'
          && report.fiscalEnd.length < 35 && Array.isArray(report.periods)
          && report.periods.length > 0 && report.periods.length <= 30
          && report.periods.every(period => /^\d{4}$|^TTM$/.test(period))
          && new Set(report.periods).size === report.periods.length
          && Array.isArray(report.rows) && report.rows.length > 0 && report.rows.length <= 400
          && report.rows.every(row => Array.isArray(row) && row.length === 3 && Number.isInteger(row[0])
            && row[0] >= 0 && row[0] <= 16 && typeof row[1] === 'string' && row[1].trim() && row[1].length <= 400
            && Array.isArray(row[2]) && row[2].length === report.periods.length
            && row[2].every(amount => amount === null || Number.isFinite(amount)));
      }));
    if (!valid) throw new Error('The file contains an unknown listing or an invalid statement.');
    return value;
  }

  function database() {
    return databaseRequest ??= new Promise((resolve, reject) => {
      const request = root.indexedDB.open('market-intel-fundamentals', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('imports');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function stored(action, value) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('imports', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('imports');
      const request = action === 'put' ? store.put(value, 'annual') : store[action]('annual');
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function load() {
    if (temporary) return memory;
    try { memory = await stored('get'); } catch { /* Imports still work for this page. */ }
    return memory;
  }

  function directory() {
    return directoryRequest ??= root.fetch('data/company-fundamentals-listings.json?v=1')
      .then(response => {
        if (!response.ok) throw new Error('The listing index is unavailable.');
        return response.json();
      })
      .catch(error => { directoryRequest = null; throw error; });
  }

  function button(item, { label = 'Fundamentals', exact = false } = {}) {
    if (!item) return '';
    const source = typeof item === 'string' ? { ticker: item } : item;
    const pick = [...fields, 'aliases', 'currency', 'exchangeMic', 'mic', 'asset_type',
      'instrumentType', 'identityStatus', 'currentEligible', 'name'];
    const identity = Object.fromEntries(pick.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
    return '<market-fundamentals data-identity="' + esc(JSON.stringify(identity)) + '" data-label="'
      + esc(label) + '"' + (exact ? ' data-exact' : '') + '></market-fundamentals>';
  }

  function more(item) {
    return '<details class="fund-more"><summary>More data</summary><h3>Fundamentals</h3>'
      + '<p>Annual income statement, balance sheet and cash flow.</p>'
      + button(item, { label: 'Open financial statements', exact: true }) + '</details>';
  }

  function unit(label, report) {
    if (/per share|\b(?:EPS|DPS)\b/i.test(label)) return { scale: 1, text: report.currency + ' per share' };
    if (/shares outstanding|weighted average shares/i.test(label)) return { scale: 1e6, text: 'million shares' };
    return { scale: 1e6, text: report.currency + ' millions' };
  }

  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const valueText = (value, scale) => value === null ? '—' : number.format(value / scale);

  function periods(report) {
    return report.periods.map((label, index) => ({ label, index }))
      .sort((left, right) => Number(right.label === 'TTM') - Number(left.label === 'TTM') || right.label.localeCompare(left.label));
  }

  function table(report) {
    const columns = periods(report);
    return '<div class="fund-table-wrap" role="region" aria-label="Financial statement table" tabindex="0"><table class="fund-table" style="--fund-periods:' + columns.length + '">'
      + '<colgroup><col class="fund-line-col"><col span="' + columns.length + '"></colgroup>'
      + '<thead><tr><th scope="col">Reported line item</th>' + columns.map(({ label }) => (
        '<th scope="col"' + (label === 'TTM' ? ' class="fund-ttm"' : '') + '>' + esc(label) + '</th>'
      )).join('') + '</tr></thead><tbody>'
      + report.rows.map(([depth, label, values], index) => {
        const parent = report.rows[index + 1]?.[0] > depth;
        const rowClass = depth === 0 ? 'fund-group' : parent || /^(?:Total|Net)\b/.test(label) ? 'fund-subtotal' : '';
        const { scale } = unit(label, report);
        const available = values.some(Number.isFinite);
        return '<tr class="' + rowClass + '" style="--fund-depth:' + Math.min(depth, 5) + '">'
          + '<th scope="row">' + (available
            ? '<button type="button" data-fund-row="' + index + '" title="Chart ' + esc(label) + '">' + esc(label) + '</button>'
            : esc(label)) + '</th>' + columns.map(({ index: column, label: period }) => {
            const value = values[column];
            const classes = [period === 'TTM' ? 'fund-ttm' : '', value === null ? 'fund-missing' : value < 0 ? 'fund-negative' : ''];
            return '<td class="' + classes.join(' ') + '"' + (value === null ? ' aria-label="Unavailable"' : ' title="' + esc(value) + '"')
              + '>' + esc(valueText(value, scale)) + '</td>';
          }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function chart(report, index) {
    const [, label, values] = report.rows[index];
    const { scale, text } = unit(label, report);
    const series = periods(report).filter(p => p.label !== 'TTM').reverse();
    const available = series.map(p => values[p.index]).filter(Number.isFinite);
    if (!available.length) return '<p class="fund-note">No annual observations for this line.</p>';
    const min = Math.min(0, ...available);
    const max = Math.max(0, ...available);
    const range = max - min || 1;
    const baseline = -min / range * 100;
    return '<figure class="fund-chart"><figcaption><strong>' + esc(label) + '</strong><span>' + esc(text) + '</span></figcaption>'
      + '<div class="fund-plot" style="--fund-zero:' + baseline.toFixed(4) + '%">'
      + series.map(({ index: column, label: year }) => {
        const value = values[column];
        const height = Math.abs(value ?? 0) / range * 100;
        const offset = value < 0 ? baseline - height : baseline;
        const full = year + ' · ' + (value === null ? 'Unavailable' : valueText(value, scale) + ' ' + text);
        return '<div class="fund-year" title="' + esc(full) + '" aria-label="' + esc(full) + '" role="img"><div>'
          + (value === null ? '<i class="fund-gap"></i>'
            : '<i class="' + (value < 0 ? 'fund-down' : '') + '" style="--fund-offset:' + offset.toFixed(4)
              + '%;--fund-size:' + height.toFixed(4) + '%"></i>') + '</div><span>' + esc(year) + '</span></div>';
      }).join('') + '</div></figure>';
  }

  function paint() {
    const title = dialog.querySelector('h2');
    const content = dialog.querySelector('.fund-content');
    const report = memory?.companies[active.id]?.statements[statement];
    title.textContent = active.name + ' · Fundamentals';
    const count = Object.keys(memory?.companies || {}).length;
    const listing = active.id + ' · ' + active.mic;
    dialog.querySelector('.fund-listing').textContent = listing;
    dialog.querySelector('.fund-state').textContent = count
      ? count + ' listings loaded ' + (temporary ? 'for this page' : 'in this browser') + '.'
      : 'Load your Fundamentals JSON to view statements and charts in this browser.';
    dialog.querySelector('[data-fund-clear]').hidden = !count;
    if (!report) {
      content.innerHTML = '<p class="fund-note">' + (count ? 'The saved import has no statements for this listing.'
        : 'Income statement, balance sheet and cash flow will appear here after import.') + '</p>';
      return;
    }
    const filtered = report.rows.map((row, i) => ({ row, i })).filter(({ row }) => row[2].some(Number.isFinite));
    const defaultRow = filtered.find(({ row }) => initialSeries[statement].test(row[1]) && row[2].some(
      (value, i) => Number.isFinite(value) && report.periods[i] !== 'TTM')) || filtered[0];
    const captured = memory.companies[active.id].capturedAt.slice(0, 10);
    content.innerHTML = '<div class="fund-tabs" role="group" aria-label="Financial statement">' + Object.entries(types).map(([key, label]) => (
      '<button type="button" data-fund-statement="' + key + '" aria-pressed="' + String(key === statement) + '">' + label + '</button>'
    )).join('') + '</div><p class="fund-note">Annual · As Originally Reported · Fiscal year ends ' + esc(report.fiscalEnd)
      + '. Amounts in ' + esc(report.currency) + ' millions, except per-share amounts and shares in millions. TTM is trailing 12 months.</p>'
      + (defaultRow ? '<label class="fund-chart-select">Chart line item<select data-fund-series>' + filtered.map(({ row, i }) => (
        '<option value="' + i + '"' + (i === defaultRow.i ? ' selected' : '') + '>' + esc(row[1]) + '</option>'
      )).join('') + '</select></label><div data-fund-chart>' + chart(report, defaultRow.i) + '</div>' : '')
      + '<p class="fund-note fund-table-hint">Select a line item to chart it. Scroll across for earlier periods.</p>'
      + table(report) + '<p class="fund-note">Morningstar export captured ' + esc(captured)
      + ' (SGT). Blank cells indicate no reported value.</p>';
  }

  function open(row, name) {
    const [id, mic, symbol] = row;
    active = { id, mic, name: name || id };
    statement = 'income';
    if (!dialog) {
      dialog = doc.createElement('dialog');
      dialog.className = 'fund-dialog';
      dialog.setAttribute('aria-labelledby', 'fund-dialog-title');
      dialog.innerHTML = '<header class="fund-heading"><div><p class="fund-listing"></p><h2 id="fund-dialog-title"></h2></div>'
        + '<form method="dialog"><button type="submit" autofocus>Close</button></form></header>'
        + '<div class="fund-content"></div><footer class="fund-import">'
        + '<p class="fund-state" role="status"></p><div><label>Load fundamentals JSON<input type="file" accept=".json,application/json" data-fund-file></label>'
        + '<button type="button" data-fund-clear hidden>Clear browser copy</button>'
        + '<a target="_blank" rel="noopener noreferrer" data-fund-source>Morningstar Financials</a></div></footer>';
      doc.body.append(dialog);
      dialog.addEventListener('click', async event => {
        const tab = event.target.closest('[data-fund-statement]');
        const metric = event.target.closest('[data-fund-row]');
        if (tab) {
          statement = tab.dataset.fundStatement;
          paint();
          dialog.querySelector('[data-fund-statement="' + statement + '"]').focus();
        } else if (metric) {
          const field = dialog.querySelector('[data-fund-series]');
          field.value = metric.dataset.fundRow;
          draw(field.value);
          field.focus();
        } else if (event.target.closest('[data-fund-clear]')) {
          try {
            if (!temporary) await stored('delete');
            memory = null;
            temporary = false;
            paint();
          } catch { dialog.querySelector('.fund-state').textContent = 'The browser copy could not be cleared.'; }
        }
      });
      dialog.addEventListener('change', async event => {
        const input = event.target;
        if (input.matches('[data-fund-series]')) { draw(input.value); return; }
        const file = input.matches('[data-fund-file]') && input.files[0];
        if (!file) return;
        const status = dialog.querySelector('.fund-state');
        input.disabled = true;
        status.textContent = 'Reading the local file…';
        try {
          if (file.size > 12e6) throw new Error('The file exceeds the 12 MB import limit.');
          const next = unpack(JSON.parse(await file.text()), await directory());
          try { await stored('put', next); temporary = false; } catch { temporary = true; }
          memory = next;
          paint();
        } catch (error) {
          status.textContent = error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message;
        } finally { input.value = ''; input.disabled = false; }
      });
    }
    dialog.querySelector('[data-fund-source]').href = 'https://www.morningstar.com/stocks/'
      + mic.toLowerCase() + '/' + encodeURIComponent(symbol.toLowerCase()) + '/financials';
    paint();
    dialog.showModal();
    dialog.scrollTop = 0;
    load().then(() => { if (dialog.open && active.id === id) paint(); });
  }

  function draw(index) {
    const report = memory.companies[active.id].statements[statement];
    dialog.querySelector('[data-fund-chart]').innerHTML = chart(report, Number(index));
  }

  const api = { button, more, findListing, unpack, unit, table, chart };
  root.CompanyFundamentals = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (!doc || !root.customElements) return;

  root.customElements.define('market-fundamentals', class extends root.HTMLElement {
    connectedCallback() {
      if (this.childElementCount) return;
      const item = JSON.parse(this.dataset.identity);
      directory().then(rows => {
        const match = findListing(item, rows);
        if (!match || !this.isConnected || this.childElementCount) return;
        const control = doc.createElement('button');
        control.type = 'button';
        control.className = 'fund-button';
        control.textContent = this.dataset.label;
        control.setAttribute('aria-haspopup', 'dialog');
        control.addEventListener('click', () => open(match, item.name));
        this.append(control);
      }).catch(() => {
        if (this.hasAttribute('data-exact')) this.textContent = 'The Fundamentals listing index could not load.';
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
