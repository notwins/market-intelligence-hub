/* Annual statements imported by the reader. Storage is scoped to this browser origin. */
(function (root) {
  'use strict';

  const types = { balance: 'Balance Sheet', cash: 'Cash Flow', income: 'Net Income' };
  const initialSeries = {
    income: /^Net Income(?:\/Loss)?(?:, Total| Attributable to Parent)?$/i,
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
  let directoryRequest, databaseRequest, loadRequest, researchRequest, memory;
  let temporary = false, writing = false;
  const importPanels = new Set();

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
    return loadRequest ??= stored('get').then(value => { memory = value; }).catch(() => {});
  }

  function importMessage() {
    const companies = Object.values(memory?.companies || {});
    const captured = [...new Set(companies.map(item => item.capturedAt.slice(0, 10)))].sort().at(-1);
    return captured ? companies.length + ' listings loaded ' + (temporary ? 'for this page' : 'in this browser')
      + '. Latest capture ' + new Date(captured + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore'
      }) + ' SGT.' : 'Choose your Fundamentals JSON to load annual statements.';
  }

  function updateImportPanels() {
    for (const panel of importPanels) {
      panel.querySelector('.fund-state').textContent = importMessage();
      const clear = panel.querySelector('[data-fund-clear]');
      if (clear) clear.hidden = !memory;
    }
    doc.dispatchEvent(new Event('fundamentals-updated'));
  }

  function bindImport(panel) {
    if (!panel) return;
    importPanels.add(panel);
    load().then(updateImportPanels);
    panel.addEventListener('click', async event => {
      if (!event.target.closest('[data-fund-clear]') || writing) return;
      writing = true;
      try {
        if (!temporary) await stored('delete');
        memory = null;
        temporary = false;
        updateImportPanels();
      } catch { panel.querySelector('.fund-state').textContent = 'The browser copy could not be cleared.'; }
      finally { writing = false; }
    });
    panel.addEventListener('change', async event => {
      const input = event.target;
      const file = input.matches('[data-fund-file]') && input.files[0];
      if (!file || writing) return;
      const status = panel.querySelector('.fund-state');
      writing = true;
      input.disabled = true;
      status.textContent = 'Reading the local file…';
      try {
        if (file.size > 12e6) throw new Error('The file exceeds the 12 MB import limit.');
        const next = unpack(JSON.parse(await file.text()), await directory());
        await load();
        try { await stored('put', next); temporary = false; } catch { temporary = true; }
        memory = next;
        updateImportPanels();
      } catch (error) {
        status.textContent = error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message;
      } finally {
        writing = false;
        input.value = '';
        input.disabled = false;
      }
    });
  }

  function directory() {
    return directoryRequest ??= root.fetch('data/company-fundamentals-listings.json?v=1')
      .then(response => {
        if (!response.ok) throw new Error('The listing index is unavailable.');
        return response.json();
      })
      .catch(error => { directoryRequest = null; throw error; });
  }

  function section(item, { label = '', research = true } = {}) {
    if (!item) return '';
    const source = typeof item === 'string' ? { ticker: item } : item;
    const pick = [...fields, 'aliases', 'currency', 'exchangeMic', 'mic', 'asset_type',
      'instrumentType', 'identityStatus', 'currentEligible', 'name'];
    const identity = Object.fromEntries(pick.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
    return '<market-fundamentals data-identity="' + esc(JSON.stringify(identity)) + '" data-label="'
      + esc(label) + '"' + (research ? ' data-bos-research' : '') + '></market-fundamentals>';
  }

  function more(item) {
    return '<details class="fund-more"><summary>More data</summary>'
      + section(item, { research: false }) + '</details>';
  }

  function unit(label, report) {
    if (/per share|\b(?:EPS|DPS)\b/i.test(label)) return { scale: 1, text: 'per share' };
    if (/shares outstanding|weighted average shares/i.test(label)) return { scale: 1e6, text: 'million shares' };
    return { scale: 1e6, text: report.currency ? report.currency + ' millions' : 'Millions of reported units' };
  }

  const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const valueText = (value, scale) => value === null ? '—' : number.format(value / scale);

  function periods(report) {
    return report.periods.map((label, index) => ({ label, index }))
      .sort((left, right) => Number(right.label === 'TTM') - Number(left.label === 'TTM') || right.label.localeCompare(left.label));
  }

  function table(report, layout) {
    const columns = periods(report);
    return '<div class="fund-table-wrap" role="region" aria-label="Financial statement table" tabindex="0"><table class="fund-table"'
      + (layout ? ' data-tc-layout="annual-statement-' + esc(layout) + '" data-tc-fixed-rows' : '')
      + ' style="--fund-periods:' + columns.length + '">'
      + '<thead><tr><th scope="col">Reported line item</th>' + columns.map(({ label }) => (
        '<th scope="col" data-table-kind="mixed"' + (label === 'TTM' ? ' class="fund-ttm"' : '') + '>' + esc(label) + '</th>'
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

  function readResearch() {
    return researchRequest ??= root.fetch('data/stocks-beta2-research-briefs.json?v=20261121.3', {
      signal: AbortSignal.timeout(10000)
    }).then(async response => {
      if (!response.ok) throw new Error('The BOS research index is unavailable.');
      const data = await response.json();
      if (data.version !== 1 || !data.briefs) throw new Error('The BOS research index is invalid.');
      return data.briefs;
    }).catch(error => { researchRequest = null; throw error; });
  }

  function researchLink(brief) {
    if (!brief?.source) return '';
    try {
      const url = new URL(brief.source);
      if (url.origin !== 'https://productgroup.bankofsingapore.com' || url.username || url.password
          || !/^\/(?:apollo\/assets\/reports|equities_research)\/.*\.pdf$/i.test(url.pathname)) return '';
      return url.href;
    } catch { return ''; }
  }

  function reportContent(company, key, id) {
    const original = company.statements[key];
    // TSMC's audited FY2025 filings reconcile to the export totals in Taiwan dollars.
    // The provider's field mirrors the listing currency for several other cross-listings.
    const report = { ...original, currency: id === 'TSM US' ? 'TWD' : '' };
    const options = report.rows.map((row, index) => ({ row, index })).filter(({ row }) => row[2].some(Number.isFinite));
    const selected = options.find(({ row }) => initialSeries[key].test(row[1])) || options[0];
    const title = key === 'income' ? 'Income statement · ' : '';
    const scale = report.currency ? report.currency + ' millions' : 'millions of reported units';
    const chartPanel = selected ? '<details class="fund-line-chart"><summary>Chart a line item</summary>'
      + '<label class="fund-chart-select">Line item <select data-fund-series>' + options.map(({ row, index }) => (
        '<option value="' + index + '"' + (index === selected.index ? ' selected' : '') + '>' + esc(row[1]) + '</option>'
      )).join('') + '</select></label><div data-fund-chart>' + chart(report, selected.index) + '</div></details>' : '';
    return {
      report,
      html: '<p class="fund-note">' + title + 'Annual · As Originally Reported · Fiscal year ends ' + esc(report.fiscalEnd)
        + '. Amounts in ' + esc(scale) + ', with shares in millions and per-share figures as reported. '
        + 'Export currency field: ' + esc(original.currency) + '.'
        + (report.periods.includes('TTM') ? ' TTM is trailing 12 months.' : '') + '</p>'
        + chartPanel + table(report, key) + '<p class="fund-note">Captured ' + esc(company.capturedAt.slice(0, 10))
        + ' (SGT). Dashes mark unavailable values.</p>'
    };
  }

  function paintStatement(disclosure, id) {
    const body = disclosure.querySelector('[data-fund-body]');
    const company = memory?.companies[id];
    if (!company) {
      body.innerHTML = '<p class="fund-note">Load your saved statements under '
        + '<a href="stocks-beta2.html#sb2-fundamentals-import">Stocks BETA 2 import settings</a>.</p>';
      return;
    }
    const { html, report } = reportContent(company, disclosure.dataset.fundStatement, id);
    body.innerHTML = html;
    const select = body.querySelector('[data-fund-series]');
    if (!select) return;
    const plot = body.querySelector('[data-fund-chart]');
    const draw = () => { plot.innerHTML = chart(report, Number(select.value)); };
    select.addEventListener('change', draw);
    body.querySelector('.fund-table').addEventListener('click', event => {
      const button = event.target.closest('[data-fund-row]');
      if (!button) return;
      select.value = button.dataset.fundRow;
      select.closest('details').open = true;
      draw();
      select.focus();
    });
  }

  function rowsFor([id, mic, symbol], research, label) {
    const source = 'https://www.morningstar.com/stocks/' + mic.toLowerCase() + '/'
      + encodeURIComponent(symbol.toLowerCase()) + '/financials';
    return '<section class="fund-inline" data-no-ticker-links>'
      + (label ? '<h4 class="fund-card-heading">' + esc(label) + '</h4>' : '')
      + (research ? '<details class="fund-research"><summary>BOS Equity Research</summary>'
        + '<p class="fund-note" data-fund-research>Loading the listing’s equity research…</p></details>' : '')
      + Object.entries(types).map(([key, title]) => '<details class="fund-statement" data-fund-statement="' + key
        + '"><summary>' + title + '</summary><div class="fund-statement-body" data-fund-body></div></details>').join('')
      + '<p class="fund-source"><a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Morningstar Financials</a></p></section>';
  }

  const api = { button: section, more, findListing, unpack, unit, table, chart, researchLink, reportContent, rowsFor };
  root.CompanyFundamentals = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (!doc || !root.customElements) return;
  const importPanel = doc.querySelector('[data-fund-import-panel]');
  if (importPanel) {
    const revealImport = () => {
      if (root.location.hash !== '#sb2-fundamentals-import') return;
      const options = importPanel.parentElement.closest('details');
      if (options) options.open = true;
      importPanel.open = true;
    };
    revealImport();
    root.addEventListener('hashchange', revealImport);
    bindImport(importPanel);
  }

  root.customElements.define('market-fundamentals', class extends root.HTMLElement {
    connectedCallback() {
      if (this.refresh) {
        doc.addEventListener('fundamentals-updated', this.refresh);
        this.refresh();
        return;
      }
      if (this.hasAttribute('data-fund-pending')) return;
      this.setAttribute('data-fund-pending', '');
      const item = JSON.parse(this.dataset.identity);
      directory().then(rows => {
        const match = findListing(item, rows);
        if (!match || !this.isConnected) return;
        this.innerHTML = rowsFor(match, this.hasAttribute('data-bos-research'), this.dataset.label);
        const refresh = () => {
          for (const detail of this.querySelectorAll('[data-fund-statement][open]')) paintStatement(detail, match[0]);
          for (const detail of this.querySelectorAll('[data-fund-statement]:not([open])')) {
            detail.querySelector('[data-fund-body]').replaceChildren();
          }
        };
        this.addEventListener('toggle', event => {
          const detail = event.target;
          if (!detail.matches('[data-fund-statement]') || !detail.open || detail.querySelector('[data-fund-body]').childElementCount) return;
          load().then(() => { if (detail.open && detail.isConnected) paintStatement(detail, match[0]); });
        }, true);
        this.refresh = refresh;
        doc.addEventListener('fundamentals-updated', refresh);
        const link = this.querySelector('[data-fund-research]');
        if (link) {
          const loadLink = async () => {
            try {
              const brief = (await readResearch())[match[0]];
              const url = researchLink(brief);
              if (!url) { link.textContent = 'No linked BOS equity research for this listing.'; return; }
              const summary = link.previousElementSibling;
              summary.textContent = 'BOS Equity Research · ' + brief.provider;
              link.innerHTML = esc(brief.date) + ' · <a href="' + esc(url)
                + '" target="_blank" rel="noopener noreferrer">Open research PDF</a>';
              link.parentElement.removeEventListener('toggle', retryLink);
            } catch { link.textContent = 'BOS equity research could not load. Reopen to retry.'; }
          };
          const retryLink = () => { if (link.parentElement.open) loadLink(); };
          link.parentElement.addEventListener('toggle', retryLink);
          loadLink();
        }
      }).catch(() => {}).finally(() => { this.removeAttribute('data-fund-pending'); });
    }

    disconnectedCallback() {
      if (this.refresh) doc.removeEventListener('fundamentals-updated', this.refresh);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
