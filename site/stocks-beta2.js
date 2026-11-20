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
  const download = get('sb2-download');
  const retry = get('sb2-retry');
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
  let data, selected;
  let collection = 'global';

  function logo(security, size) {
    const api = root.CompanyLogos;
    return api?.data ? api.html([security.logo], api.data, { size }) : '';
  }

  function paintList() {
    if (!data) return;
    const terms = search.value.trim().toLowerCase().split(/\s+/);
    const results = data.securities.filter(security => {
      const label = [security.name, security.ticker, security.logo, ...security.previous.map(item => item[0])].join(' ').toLowerCase();
      return security.group === collection && terms.every(term => label.includes(term));
    });
    list.innerHTML = results.map(security => (
      '<li><button type="button" class="sb2-security" data-security="' + e(security.ticker)
      + '" aria-pressed="' + (security === selected) + '"><span aria-hidden="true" class="sb2-rank">'
      + e(security.rank) + '</span>' + logo(security, 28) + '<span class="sb2-security-name">'
      + e(security.name) + '<span class="sb2-company-ticker">' + e(security.ticker) + '</span></span></button></li>'
    )).join('');
    get('sb2-empty').hidden = results.length > 0;
  }

  function paintHeading() {
    get('sb2-company').innerHTML = logo(selected, 40) + '<div><h2>' + e(selected.name)
      + '</h2><span class="sb2-company-ticker">' + e(selected.ticker + ' · ' + selected.currency) + '</span></div>';
  }

  function paintDetail() {
    paintHeading();
    const points = selected.observations;
    const missing = data.months.length - points.length;
    get('sb2-coverage').textContent = points.length + ' of ' + data.months.length + ' monthly editions'
      + (missing ? ' · ' + missing + ' without a matching observation' : '');
    const headers = data.metrics.map(([, label, unit]) => (
      '<th scope="col">' + e(label + ' (' + (unit === 'quote' ? selected.currency : unit) + ')') + '</th>'
    )).join('');
    const values = [...points].reverse().map(point => {
      const [, reportDate, priceDate] = data.months[point[0]];
      const prior = previousSource(selected, point, data.metrics.length);
      const ticker = prior?.[0] || selected.ticker;
      const title = prior ? ' title="' + e(relationLabel[prior[1]]) + '"' : '';
      return '<tr><th scope="row"><time datetime="' + reportDate + '">' + day(reportDate) + '</time></th>'
        + '<td><time datetime="' + priceDate + '">' + day(priceDate) + '</time></td>'
        + '<td class="sb2-ticker"' + title + '>' + e(ticker) + (prior ? '<br><small>' + e(relationLabel[prior[1]]) + '</small>' : '') + '</td>'
        + point.slice(1, data.metrics.length + 1).map(value => (
          value === null ? '<td class="sb2-missing" aria-label="Unavailable">–</td>'
            : '<td>' + e(format.format(value)) + '</td>'
        )).join('') + '</tr>';
    }).join('');
    get('sb2-table').innerHTML = '<thead><tr><th scope="col">Report date</th><th scope="col">Price date</th>'
      + '<th scope="col">Source ticker</th>' + headers + '</tr></thead><tbody>' + values + '</tbody>';
    get('sb2-table').parentElement.scrollTo(0, 0);
    get('sb2-related-reading').innerHTML = root.NvdaArticle?.link(selected.ticker) || '';
  }

  function showGroup(group) {
    collection = group;
    groups.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === collection)));
    search.value = '';
    selected = data.securities.find(item => item.group === collection);
    list.scrollTop = 0;
    paintList();
    paintDetail();
  }

  async function load() {
    retry.hidden = true;
    get('sb2-status').textContent = 'Loading monthly market history…';
    try {
      const response = await fetch('data/stocks-beta2-monthly-history.json?v=20261121', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('History download failed');
      const result = await response.json();
      if (result.version !== 1 || !result.months?.length || !result.metrics?.length || !result.securities?.length) {
        throw new Error('History format is unavailable');
      }
      data = result;
      const total = data.securities.reduce((sum, security) => sum + security.observations.length, 0);
      get('sb2-status').textContent = format.format(total) + ' observations across ' + data.months.length + ' saved monthly editions.';
      get('sb2-workspace').hidden = false;
      download.disabled = false;
      showGroup('global');
    } catch {
      get('sb2-status').textContent = 'Monthly market history could not load.';
      retry.hidden = false;
    }
  }

  groups.forEach(button => button.addEventListener('click', () => showGroup(button.dataset.group)));
  search.addEventListener('input', () => {
    list.scrollTop = 0;
    paintList();
  });
  list.addEventListener('click', event => {
    const choice = event.target.closest('button[data-security]');
    if (!choice) return;
    selected = data.securities.find(security => security.ticker === choice.dataset.security);
    list.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
    choice.setAttribute('aria-pressed', 'true');
    paintDetail();
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
    paintHeading();
  });
  load();
})(typeof window !== 'undefined' ? window : globalThis);
