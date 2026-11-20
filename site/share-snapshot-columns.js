/* Optional columns from the existing validated Bloomberg equity snapshot. */
(function(root) {
  'use strict';

  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amounts = 'Source units';
  const groups = [
    ['Valuation & dividends', [
      ['dividendYieldPct', 'Indicated dividend yield', '%'],
      ['pe', 'P/E', '×', 'Period not supplied.'],
      ['pb', 'P/B', '×'],
      ['fiveYearAveragePe', '5-year average P/E', '×'],
      ['dividendGrowth1yPct', 'Dividend growth (1 year)', '%'],
      ['dividendCoverage', 'Cash dividend coverage', amounts],
      ['bestEps', 'Bloomberg BEST EPS', amounts, 'Estimate. Currency and forecast period not supplied.'],
      ['price', 'Exported close', amounts],
      ['marketCap', 'Exported market cap', amounts]
    ]],
    ['Cash flow & earnings', [
      ['freeCashFlow', 'Free cash flow', amounts],
      ['freeCashFlowYieldPct', 'Free cash flow yield', '%'],
      ['revenue', 'Revenue', amounts],
      ['revenueGrowthPct', 'Revenue growth', '%'],
      ['grossProfit', 'Gross profit', amounts],
      ['grossMarginPct', 'Gross margin', '%'],
      ['netIncome', 'Earnings for common shareholders', amounts],
      ['netIncomeMarginAdjustedPct', 'Adjusted net income margin', '%']
    ]],
    ['Balance sheet & banks', [
      ['currentAssets', 'Current assets', amounts],
      ['totalLiabilities', 'Total liabilities', amounts],
      ['interestCoverage', 'EBITDA / interest expense', '×'],
      ['netDebtToEbitda', 'Net debt / EBITDA', '×'],
      ['netDebtToEquity', 'Net debt / shareholder equity', amounts],
      ['totalDebtToAssets', 'Debt / assets', amounts],
      ['netDebtPerShare', 'Net debt per share', amounts],
      ['totalDebtToEquity', 'Debt / common equity', amounts],
      ['commonEquityTier1Ratio', 'CET1 ratio', '%'],
      ['netInterestMargin', 'Net interest margin', '%'],
      ['nonPerformingLoansPct', 'Nonperforming loans / total loans', '%']
    ]],
    ['Company & credit', [
      ['sector', 'GICS sector', ''],
      ['industry', 'GICS industry', ''],
      ['spIssuer', 'S&P local-currency issuer rating', '', '', 'RTG_SP_LT_LC_ISSUER_CREDIT'],
      ['moodysIssuer', 'Moody’s issuer rating', '', '', 'RTG_MDY_ISSUER'],
      ['fitchIssuer', 'Fitch issuer default rating', '', '', 'RTG_FITCH_LT_ISSUER_DEFAULT']
    ]]
  ];
  const fields = new Map(groups.flatMap(([, entries]) => entries.map(([key, label, unit, detail, credit]) =>
    [key, {key, label, unit, detail, credit}])));
  const defaults = new Map([
    ['stocks', ['dividendYieldPct', 'pe', 'pb']], ['returns', []],
    ['explorer', []], ['pivot', []], ['history', []]
  ]);
  const preferences = new Map();
  const numeric = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const provenance = 'Bloomberg snapshot. Observation dates were not supplied.';
  const sourceUnits = 'Source-unit fields have no confirmed currency, scale or reporting period.';

  function selection(scope) {
    if (!defaults.has(scope)) return [];
    if (!preferences.has(scope)) {
      let saved;
      try { saved = JSON.parse(root.localStorage.getItem('mih-bloomberg-columns:' + scope)); } catch {}
      preferences.set(scope, Array.isArray(saved) ? [...new Set(saved)].filter(key => fields.has(key)) : defaults.get(scope));
    }
    return preferences.get(scope).map(key => fields.get(key));
  }

  function recordFor(item, enrichment = root.ShareEnrichment) {
    if (!item || item.compareEligible === false || item.currentEligible === false || /conflict|unresolved/i.test(item.identityStatus || '')) return null;
    return enrichment?.find(item) || null;
  }

  function value(record, field) {
    if (!record) return null;
    if (field.credit) {
      const rating = record.credit?.find(entry => entry.field === field.credit);
      return rating?.raw ? rating.raw + (rating.status === 'withdrawn' ? ' · withdrawn' : rating.status === 'not_rated' ? ' · not rated' : '') : null;
    }
    const raw = field.key === 'sector' || field.key === 'industry' ? record[field.key] : record.snapshot?.[field.key];
    return Number.isFinite(raw) || (typeof raw === 'string' && raw.trim()) ? raw : null;
  }

  function format(raw, field) {
    return raw === null ? '—' : typeof raw === 'number' ? numeric.format(raw) + (field.unit === amounts ? '' : field.unit) : raw;
  }

  function headers(columns, controls = () => '') {
    return columns.map(field => `<th scope="col" class="ssc-header" data-snapshot-column="${field.key}">${E(field.label)}<small>BBG${field.unit ? ' · ' + E(field.unit) : ''}</small>${controls(field)}</th>`).join('');
  }

  function cells(item, columns) {
    if (!columns.length) return '';
    const record = recordFor(item);
    return columns.map(field => {
      const raw = value(record, field);
      const description = raw === null ? record ? 'Field unavailable in the Bloomberg snapshot' : 'No exact listing match in the Bloomberg snapshot' :
        [String(raw) + (field.unit && field.unit !== amounts ? field.unit : ''), provenance, field.unit === amounts ? sourceUnits : '', field.detail].filter(Boolean).join(' · ');
      return `<td class="ssc-cell" data-snapshot-value="${field.key}" title="${E(description)}">${E(format(raw, field))}</td>`;
    }).join('');
  }

  function note(columns) {
    return columns.length ? `<p class="ssc-note">${E(provenance)}${columns.some(field => field.unit === amounts) ? ' ' + E(sourceUnits) : ''}</p>` : '';
  }

  function button(scope) {
    const count = selection(scope).length;
    return `<button type="button" class="ssc-button" aria-haspopup="dialog" data-snapshot-scope="${E(scope)}">Bloomberg columns${count ? ' (' + count + ')' : ''}</button>`;
  }

  const api = {selection, recordFor, value, format, headers, cells, note, button};
  root.ShareSnapshotColumns = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (!root.document) return;

  const doc = root.document;
  let dialog, activeScope, opener;

  function finish() {
    const scope = activeScope;
    if (dialog.returnValue === 'apply') {
      const keys = [...dialog.querySelectorAll('input:checked')].map(input => input.value);
      preferences.set(scope, keys);
      try { root.localStorage.setItem('mih-bloomberg-columns:' + scope, JSON.stringify(keys)); } catch {}
      doc.dispatchEvent(new root.CustomEvent('share-snapshot-columns-updated', {detail: scope}));
    }
    const next = opener?.isConnected ? opener : doc.querySelector('[data-snapshot-scope="' + scope + '"]');
    next?.focus({preventScroll: true});
  }

  function open(trigger) {
    const scope = trigger.dataset.snapshotScope;
    if (!defaults.has(scope)) return;
    activeScope = scope;
    opener = trigger;
    if (!dialog) {
      dialog = doc.createElement('dialog');
      dialog.className = 'ssc-dialog';
      dialog.setAttribute('aria-labelledby', 'ssc-title');
      dialog.addEventListener('close', finish);
      doc.body.append(dialog);
    }
    const shown = new Set(selection(scope).map(field => field.key));
    const options = groups.map(([group, items]) => `<fieldset><legend>${E(group)}</legend>${items.map(([key, label, unit]) =>
      `<label><input type="checkbox" value="${key}"${shown.has(key) ? ' checked' : ''}> <span>${E(label)}${unit ? ` <small>${E(unit)}</small>` : ''}</span></label>`
    ).join('')}</fieldset>`).join('');
    dialog.innerHTML = `<form method="dialog"><header><h2 id="ssc-title">Bloomberg snapshot columns</h2><p>${E(provenance)} ${E(sourceUnits)}</p></header><div class="ssc-options">${options}</div>
      <div class="ssc-actions"><button type="submit" value="cancel">Cancel</button><button type="submit" value="apply">Apply columns</button></div></form>`;
    dialog.returnValue = '';
    dialog.showModal();
  }

  doc.addEventListener('click', event => {
    const trigger = event.target.closest?.('[data-snapshot-scope]');
    if (trigger) open(trigger);
  });
})(typeof window !== 'undefined' ? window : globalThis);
