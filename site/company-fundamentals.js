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

  function section(item, { label = '', research = true, compareYears = false } = {}) {
    if (!item) return '';
    const source = typeof item === 'string' ? { ticker: item } : item;
    const pick = [...fields, 'aliases', 'currency', 'exchangeMic', 'mic', 'asset_type',
      'instrumentType', 'identityStatus', 'currentEligible', 'name'];
    const identity = Object.fromEntries(pick.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
    return '<market-fundamentals data-identity="' + esc(JSON.stringify(identity)) + '" data-label="'
      + esc(label) + '"' + (research ? ' data-bos-research' : '')
      + (compareYears ? ' data-compare-years' : '') + '></market-fundamentals>';
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

  function statementHierarchy(rows) {
    const parents = [];
    return rows.map(([depth, label, values], index) => {
      while (parents.length && parents.at(-1).depth >= depth) parents.pop();
      const parent = parents.at(-1)?.index;
      const heading = /^(?:section|income statement|balance sheet|cash flow)$/i.test(label) && !values.some(Number.isFinite);
      const expandable = rows[index + 1]?.[0] > depth && !heading;
      if (expandable) parents.push({depth, index});
      return {parent, expandable};
    });
  }

  function tableControls(hasGroups) {
    return '<div class="fund-table-controls">'
      + (hasGroups ? '<button type="button" data-fund-all>Expand all details</button>' : '')
      + '<label>Table height <input type="range" min="260" max="1200" step="20" value="560" data-fund-height>'
      + '<output>560 px</output></label>'
      + '<button type="button" data-fund-fit aria-pressed="false">Fit height</button></div>';
  }

  function table(report, layout, grouped = false) {
    const columns = periods(report);
    const outline = grouped ? statementHierarchy(report.rows) : [];
    const controls = grouped ? tableControls(outline.some(row => row.expandable)) : '';
    return controls + '<div class="fund-table-wrap" role="region" aria-label="Financial statement table" tabindex="0"'
      + (grouped ? ' data-fund-resizable' : '') + '><table class="fund-table"'
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
        const entry = outline[index];
        const toggle = entry?.expandable ? '<button type="button" class="fund-row-toggle" data-fund-toggle aria-expanded="false" aria-label="Details for '
          + esc(label) + '"></button>' : '';
        const labelHtml = available
          ? '<button type="button" data-fund-row="' + index + '" title="Chart ' + esc(label) + '">' + esc(label) + '</button>'
          : esc(label);
        const treeAttrs = entry ? ' data-fund-index="' + index + '"'
          + (entry.parent == null ? '' : ' data-fund-parent="' + entry.parent + '" hidden') : '';
        return '<tr class="' + rowClass + '" style="--fund-depth:' + Math.min(depth, 5) + '"' + treeAttrs + '>'
          + '<th scope="row">' + (toggle ? '<div class="fund-line-label">' + toggle + '<span>' + labelHtml + '</span></div>' : labelHtml)
          + '</th>' + columns.map(({ index: column, label: period }) => {
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

  const bar = (label, amount, colour, start = 0) => ({ label, amount, colour, start });
  const lane = (label, amount, colour) => ({ label, amount, bars: [bar(label, amount, colour)] });

  function reconciles(total, ...parts) {
    return [total, ...parts].every(Number.isFinite)
      && Math.abs(total - parts.reduce((sum, part) => sum + part, 0)) <= Math.max(1, Math.abs(total) * 1e-10);
  }

  function breakdown(report, key, index, { stack = true, splitAssets = true, waterfall = true, fixedColour = false } = {}) {
    const get = (...labels) => {
      for (const label of labels) {
        const row = report.rows.find(([, name, values]) => name === label && Number.isFinite(values[index]));
        if (row) return row[2][index];
      }
      return null;
    };
    if (key === 'balance') {
      const assets = get('Total Assets');
      const liabilities = get('Total Liabilities');
      const equity = get('Total Equity');
      const current = get('Total Current Assets');
      const nonCurrent = get('Total Non-Current Assets', 'Total Noncurrent Assets');
      const assetLane = lane('Total assets', assets, 'blue');
      if (splitAssets && current >= 0 && nonCurrent >= 0 && reconciles(assets, current, nonCurrent)) {
        assetLane.bars = [bar('Current assets', current, 'blue'), bar('Non-current assets', nonCurrent, 'purple', current)];
      }
      if (stack && liabilities >= 0 && equity >= 0 && reconciles(assets, liabilities, equity)) {
        return { kind: 'stacked', title: 'Assets and how they are funded', lanes: [assetLane, {
          label: 'Liabilities + equity', amount: liabilities + equity,
          bars: [bar('Liabilities', liabilities, 'amber'), bar('Equity', equity, 'teal', liabilities)]
        }] };
      }
      return {
        title: 'Reported balance sheet totals',
        note: 'Separate bars show the reported totals when a funding stack would hide a negative balance or require an unverified amount.',
        lanes: [assetLane, lane('Liabilities', liabilities, 'amber'), lane('Equity', equity, 'teal')]
      };
    }
    if (key === 'cash') {
      return {
        title: 'Cash inflows and outflows by activity',
        lanes: [
          lane('Operating', get('Cash Flow from Operating Activities, Indirect', 'Cash Flow from/Used in Operating Activities, Direct'), 'teal'),
          lane('Investing', get('Cash Flow from Investing Activities'), 'purple'),
          lane('Financing', get('Cash Flow from Financing Activities'), 'amber')
        ]
      };
    }
    const pretax = get('Pretax Income');
    const tax = get('Provision for Income Tax');
    const net = get('Net Income from Continuing Operations');
    const afterTaxEquity = get('Earnings from Equity Interest, Post-Tax');
    const totalNet = get('Net Income after Non-Controlling/Minority Interests');
    const taxRow = lane('Income tax', tax, !fixedColour && tax > 0 ? 'teal' : 'rose');
    const netRow = lane('Net income from continuing operations', net, 'blue');
    const lanes = [lane('Pretax income', pretax, 'blue'), taxRow];
    const equityBridge = !reconciles(net, pretax, tax) && reconciles(net, pretax, tax, afterTaxEquity);
    if (waterfall && (reconciles(net, pretax, tax) || equityBridge)) {
      taxRow.bars[0].start = pretax;
      if (equityBridge) lanes.push({
        label: 'Post-tax equity income', amount: afterTaxEquity,
        bars: [bar('Post-tax equity income', afterTaxEquity, 'purple', pretax + tax)]
      });
      return { kind: 'waterfall', title: 'From pretax income to continuing net income', lanes: [...lanes, netRow] };
    }
    return {
      title: 'Reported income and tax',
      note: 'A waterfall needs reported steps that add up to the reported total. These bars show each available amount separately.',
      lanes: [...lanes, netRow, lane('Net income attributable to parent', totalNet, 'teal')]
    };
  }

  function barScale(bars) {
    const bounds = bars.flatMap(segment => [segment.start, segment.start + segment.amount]);
    const low = Math.min(0, ...bounds);
    const high = Math.max(0, ...bounds);
    const range = high - low || 1;
    const position = value => ((value - low) / range * 100).toFixed(4) + '%';
    const percent = value => (value / range * 100).toFixed(4) + '%';
    return { low, high, position, percent, zero: -low / range };
  }

  function barTrack(bars, { position, percent }) {
    return '<div class="fund-track" aria-hidden="true">' + bars.filter(segment => Number.isFinite(segment.amount)).map(segment =>
      '<i data-colour="' + segment.colour + '" style="--fund-start:'
      + position(segment.start + Math.min(0, segment.amount)) + ';--fund-extent:' + percent(Math.abs(segment.amount)) + '"></i>'
    ).join('') + '</div>';
  }

  function breakdownPlot(report, view) {
    const bars = view.lanes.flatMap(row => row.bars).filter(segment => Number.isFinite(segment.amount));
    if (!bars.length) return '<p class="fund-note">No reported values for the summary chart this year.</p>';
    const scale = barScale(bars);
    const { low, high, position, zero } = scale;
    const label = value => valueText(value, 1e6);
    const ticks = low === high ? [0] : [low, ...(zero >= .15 && zero <= .85 ? [0] : []), high];
    const units = report.currency ? report.currency + ' millions' : 'Millions of reported units';
    return '<figure class="fund-breakdown-figure" style="--fund-baseline:' + position(0) + '">'
      + '<figcaption><strong>' + esc(view.title) + '</strong><span>' + esc(units) + '</span></figcaption>'
      + view.lanes.map(row => '<div class="fund-bar-row"><div class="fund-bar-label"><span>' + esc(row.label)
        + '</span><b>' + (Number.isFinite(row.amount) ? esc(label(row.amount)) : 'Unavailable') + '</b></div>'
        + barTrack(row.bars, scale)
        + (row.bars.length > 1 ? '<ul class="fund-bar-key">' + row.bars.map(segment =>
          '<li><i data-colour="' + segment.colour + '" aria-hidden="true"></i>' + esc(segment.label)
          + ' <b>' + esc(label(segment.amount)) + '</b></li>'
        ).join('') + '</ul>' : '') + '</div>').join('')
      + '<div class="fund-bar-axis" aria-hidden="true">' + ticks.map(value =>
        '<span style="--fund-tick:' + position(value) + '">' + esc(label(value)) + '</span>'
      ).join('') + '</div>'
      + (view.note ? '<p class="fund-note">' + esc(view.note) + '</p>' : '') + '</figure>';
  }

  const signedChange = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, signDisplay: 'exceptZero' });

  function changeLabel(series) {
    const reported = series.filter(({ amount }) => Number.isFinite(amount));
    if (reported.length < 2) return '<span class="fund-missing" aria-label="Two reported years needed">—</span>';
    const oldest = reported[0], latest = reported.at(-1);
    const change = (latest.amount - oldest.amount) / 1e6;
    const direction = change > 0 ? 'increase' : change < 0 ? 'decrease' : 'flat';
    const label = change && Math.abs(change) < .005 ? (change > 0 ? '+' : '−') + '<0.01' : signedChange.format(change);
    return '<span class="fund-change-value" data-direction="' + direction + '" title="FY '
      + esc(latest.year) + ' minus FY ' + esc(oldest.year) + '">' + esc(label) + '</span>';
  }

  function comparisonPlot(report, key, views) {
    const years = views.slice(0, 5).reverse();
    if (!years.length) return '';
    const available = years.filter(({ view }) => view.lanes.some(row => Number.isFinite(row.amount)));
    const options = {
      stack: available.every(({ view }) => view.kind === 'stacked'),
      splitAssets: available.every(({ view }) => view.lanes[0].bars.length > 1),
      waterfall: available.every(({ view }) => view.kind === 'waterfall'),
      fixedColour: true
    };
    const panels = years.map(({ label, index, view }) => ({
      label,
      view: breakdown(report, key, index, options),
      available: view.lanes.some(row => Number.isFinite(row.amount))
    }));
    const reference = panels.find(panel => panel.available)?.view;
    if (!reference) return '<div class="fund-comparison"><p class="fund-note">No reported values in these fiscal years.</p></div>';
    const rows = new Set(panels.filter(panel => panel.available).flatMap(({ view }) => view.lanes.map(row => row.label)));
    // The optional post-tax step belongs before the continuing-income total in every waterfall.
    if (options.waterfall && rows.has('Post-tax equity income')) {
      rows.delete('Net income from continuing operations');
      rows.add('Net income from continuing operations');
    }
    const bars = panels.filter(panel => panel.available).flatMap(({ view }) =>
      view.lanes.flatMap(row => row.bars).filter(segment => Number.isFinite(segment.amount)));
    const scale = barScale(bars);
    const units = report.currency ? report.currency + ' millions' : 'Millions of reported units';
    const numberLabel = amount => esc(valueText(amount, 1e6));
    const legend = [...new Map(bars.map(segment => [segment.label, segment.colour]))];
    return '<figure class="fund-breakdown fund-comparison" style="--fund-baseline:' + scale.position(0) + '">'
      + '<figcaption><strong>' + esc(reference.title) + '</strong>'
      + '<span>' + esc(units) + ' · Shared scale ' + numberLabel(scale.low) + ' to ' + numberLabel(scale.high) + '</span></figcaption>'
      + '<ul class="fund-bar-key">' + legend.map(([label, colour]) => '<li><i data-colour="' + colour
        + '" aria-hidden="true"></i>' + esc(label) + '</li>').join('') + '</ul>'
      + '<div class="fund-compare-scroll" role="region" aria-label="Fiscal-year comparison" tabindex="0">'
      + '<table class="fund-compare-table" data-table-controls="off" style="--fund-year-count:' + panels.length + '">'
      + '<thead><tr><th scope="col">Reported line item</th>'
      + panels.map(panel => '<th scope="col">FY ' + esc(panel.label) + '</th>').join('')
      + '<th scope="col" class="fund-change">5-year change</th></tr></thead><tbody>'
      + [...rows].map(label => {
        const series = panels.map(({ label: year, view, available }) => ({
          year, row: available ? view.lanes.find(candidate => candidate.label === label) : undefined
        }));
        const cells = series.map(({ row }) => {
          if (!Number.isFinite(row?.amount)) return '<td class="fund-missing" aria-label="Unavailable">—</td>';
          return '<td><b>' + numberLabel(row.amount) + '</b>' + barTrack(row.bars, scale)
            + (row.bars.length > 1 ? '<small>' + row.bars.map(segment =>
              '<span title="' + esc(segment.label) + '"><i data-colour="' + segment.colour + '" aria-hidden="true"></i>'
              + '<span class="fund-visually-hidden">' + esc(segment.label) + ' </span>' + numberLabel(segment.amount) + '</span>'
            ).join('') + '</small>' : '') + '</td>';
        }).join('');
        const total = changeLabel(series.map(({ year, row }) => ({ year, amount: row?.amount })));
        const parts = series.find(({ row }) => row?.bars.length > 1)?.row.bars;
        const components = parts ? '<small>' + parts.map(part => (
          '<span><i data-colour="' + part.colour + '" aria-hidden="true"></i>'
          + '<span class="fund-visually-hidden">' + esc(part.label) + ' </span>'
          + changeLabel(series.map(({ year, row }) => ({
            year, amount: row?.bars.find(segment => segment.label === part.label)?.amount
          }))) + '</span>'
        )).join('') + '</small>' : '';
        return '<tr><th scope="row">' + esc(label) + '</th>' + cells
          + '<td class="fund-change"><b>' + total + '</b>' + components + '</td></tr>';
      }).join('')
      + '</tbody></table></div>'
      + '<p class="fund-note">Change is the latest minus the oldest reported value in these fiscal years.</p>'
      + (reference.note ? '<p class="fund-note">' + esc(reference.note) + '</p>' : '') + '</figure>';
  }

  function reportContent(company, key, id, compareYears = false, grouped = false) {
    const original = company.statements[key];
    // TSMC's audited FY2025 filings reconcile to the export totals in Taiwan dollars.
    // The provider's field mirrors the listing currency for several other cross-listings.
    const report = { ...original, currency: id === 'TSM US' ? 'TWD' : '' };
    const options = report.rows.map((row, index) => ({ row, index })).filter(({ row }) => row[2].some(Number.isFinite));
    const selected = options.find(({ row }) => initialSeries[key].test(row[1])) || options[0];
    const title = key === 'income' ? 'Income statement · ' : '';
    const scale = report.currency ? report.currency + ' millions' : 'millions of reported units';
    const years = periods(report).filter(period => period.label !== 'TTM');
    const views = years.map(period => ({ ...period, view: breakdown(report, key, period.index) }));
    const latest = views.find(period => period.view.lanes.some(row => Number.isFinite(row.amount))) || views[0];
    const summary = latest ? '<div class="fund-breakdown fund-single-year"><label>Fiscal year <select data-fund-year>'
      + views.map(period => '<option value="' + period.index + '"' + (period === latest ? ' selected' : '')
        + '>' + esc(period.label) + '</option>').join('')
      + '</select></label><div data-fund-breakdown>' + breakdownPlot(report, latest.view) + '</div></div>' : '';
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
        + summary + (compareYears ? comparisonPlot(report, key, views) : '') + chartPanel
        + table(report, key, grouped) + '<p class="fund-note">Captured ' + esc(company.capturedAt.slice(0, 10))
        + ' (SGT). Dashes mark unavailable values.</p>'
    };
  }

  function bindTableControls(body) {
    const area = body.querySelector('[data-fund-resizable]');
    if (!area) return;
    const rows = [...area.querySelectorAll('[data-fund-index]')];
    const toggles = [...area.querySelectorAll('[data-fund-toggle]')];
    const all = body.querySelector('[data-fund-all]');
    const height = body.querySelector('[data-fund-height]');
    const fit = body.querySelector('[data-fund-fit]');
    const sizeLabel = body.querySelector('.fund-table-controls output');
    const expanded = button => button.getAttribute('aria-expanded') === 'true';

    function syncRows() {
      const open = new Set();
      for (const row of rows) {
        const {fundParent, fundIndex} = row.dataset;
        const hidden = fundParent != null && !open.has(fundParent);
        if (row.hidden !== hidden) row.hidden = hidden;
        const toggle = row.querySelector('[data-fund-toggle]');
        if (!hidden && toggle && expanded(toggle)) open.add(fundIndex);
      }
      if (all) all.textContent = toggles.every(expanded) ? 'Collapse all details' : 'Expand all details';
    }
    area.addEventListener('click', event => {
      const button = event.target.closest('[data-fund-toggle]');
      if (!button) return;
      button.setAttribute('aria-expanded', String(!expanded(button)));
      syncRows();
    });
    all?.addEventListener('click', () => {
      const show = !toggles.every(expanded);
      toggles.forEach(toggle => toggle.setAttribute('aria-expanded', String(show)));
      syncRows();
    });

    function syncHeight(fitted) {
      area.style.setProperty('--fund-table-height', height.value + 'px');
      area.toggleAttribute('data-fund-fit-height', fitted);
      fit.setAttribute('aria-pressed', String(fitted));
      sizeLabel.textContent = fitted ? 'Fitted' : height.value + ' px';
    }
    height.addEventListener('input', () => syncHeight(false));
    fit.addEventListener('click', () => syncHeight(fit.getAttribute('aria-pressed') !== 'true'));
  }

  function paintStatement(disclosure, id) {
    const body = disclosure.querySelector('[data-fund-body]');
    const company = memory?.companies[id];
    if (!company) {
      body.innerHTML = '<p class="fund-note">Load your saved statements under '
        + '<a href="stocks-beta2.html#sb2-fundamentals-import">Stocks BETA 2 import settings</a>.</p>';
      return;
    }
    const key = disclosure.dataset.fundStatement;
    const { html, report } = reportContent(company, key, id,
      !!disclosure.closest('[data-compare-years]'), !!disclosure.closest('[data-fund-grouped]'));
    body.innerHTML = html;
    bindTableControls(body);
    const year = body.querySelector('[data-fund-year]');
    year?.addEventListener('change', () => {
      const result = breakdown(report, key, Number(year.value));
      body.querySelector('[data-fund-breakdown]').innerHTML = breakdownPlot(report, result);
    });
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

  const api = { button: section, findListing, unpack, unit, table, chart, researchLink, reportContent, rowsFor, breakdown, statementHierarchy };
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
