/* Quarterly small multiples. Compare only like units and show each company's reported date. */
(function (root) {
  'use strict';

  const finite = Number.isFinite;
  const layouts = [
    ['growth', 'Revenue & earnings growth', ['revenueGrowth', 'profitGrowth', 'revenue']],
    ['profit', 'Profit margins', ['operatingMargin', 'netMargin', 'grossMargin']],
    ['cashflow', 'Cash generation', ['fcfMargin', 'cashFlowMargin', 'fcf']],
    ['liquidity', 'Liquidity', ['currentRatio', 'cashAssets', 'cashCurrent']],
    ['funding', 'Leverage & funding', ['debtAssets', 'cashDebt', 'interestCover']],
    ['returns', 'Returns on capital', ['roe', 'roa', 'equityAssets']],
    ['valuation', 'Market valuation', ['peTTM', 'evEbitda', 'priceBook']],
    ['position', 'Balance sheet structure', ['balanceMix', 'assets', 'liabilities']],
    ['profile', 'Growth vs profitability', ['growthOperating', 'growthNet', 'growthGross']]
  ];
  const sizeLayouts = [
    ['size-assets', 'Total assets', ['assets']],
    ['size-liabilities', 'Total liabilities', ['liabilities']],
    ['size-revenue', 'Revenue', ['revenue']],
    ['size-cash', 'Cash and equivalents', ['cash']],
    ['size-income', 'Net income', ['netIncome']],
    ['sales-share', 'Share of direct peer revenue', ['revenueShare']]
  ];
  const metric = {
    revenueGrowth: ['Revenue growth', '%'], profitGrowth: ['Earnings growth', '%'],
    revenue: ['Reported revenue', 'amount'], operatingMargin: ['Operating margin', '%'],
    netMargin: ['Net margin', '%'], grossMargin: ['Gross margin', '%'],
    fcfMargin: ['Free cash flow margin', '%'], cashFlowMargin: ['Operating cash flow margin', '%'],
    fcf: ['Free cash flow', 'amount'], currentRatio: ['Current ratio', '×'],
    cashAssets: ['Cash / assets', '%'], cashCurrent: ['Cash / current liabilities', '%'],
    debtAssets: ['Debt / assets', '%', 'lower'], cashDebt: ['Cash / debt', '%'],
    interestCover: ['Interest coverage', '×'], roe: ['Return on equity', '%'],
    roa: ['Return on assets', '%'], equityAssets: ['Equity / assets', '%'],
    peTTM: ['Trailing P/E', '×', 'lower'], evEbitda: ['EV / EBITDA', '×', 'lower'],
    priceBook: ['Price / book', '×', 'lower'], assets: ['Total assets', 'amount'],
    liabilities: ['Total liabilities', 'amount'], cash: ['Cash and equivalents', 'amount'],
    netIncome: ['Net income', 'amount'], revenueShare: ['Revenue share', 'donut'],
    balanceMix: ['Liabilities & net assets', 'mix'], growthOperating: ['Operating margin', 'profile', 'operatingMargin'],
    growthNet: ['Net margin', 'profile', 'netMargin'], growthGross: ['Gross margin', 'profile', 'grossMargin'],
    cet1: ['Common equity Tier 1', '%'], totalCapitalRatio: ['Total regulatory capital', '%'],
    liabAssets: ['Liabilities / assets', '%', 'lower'],
    trendGrowth: ['Revenue growth', 'trend', 'revenueGrowth'],
    trendOperating: ['Operating margin', 'trend', 'operatingMargin'],
    trendNet: ['Net margin', 'trend', 'netMargin']
  };
  const trendLayout = ['trend', 'Quarterly trends', ['trendGrowth', 'trendOperating', 'trendNet']];
  const areaMeasures = {revenue:'Revenue', assets:'Total assets', liabilities:'Total liabilities', cash:'Cash', netIncome:'Net income'};
  const areaId = 'revenue-area';
  const amounts = {
    revenue: 'Revenue', netIncome: 'Net income', operatingIncome: 'Operating income', grossProfit: 'Gross profit',
    fcf: 'Free cash flow', operatingCashFlow: 'Operating cash flow', currentAssets: 'Current assets',
    currentLiabilities: 'Current liabilities', cash: 'Cash and equivalents', assets: 'Total assets',
    totalDebt: 'Total debt', equity: 'Equity', liabilities: 'Total liabilities', ttmNetCommon: 'Trailing common earnings'
  };
  const breakdowns = {
    revenueGrowth: ['revenue'], profitGrowth: ['netIncome'],
    operatingMargin: ['operatingIncome', 'revenue'], netMargin: ['netIncome', 'revenue'], grossMargin: ['grossProfit', 'revenue'],
    fcfMargin: ['fcf', 'revenue'], cashFlowMargin: ['operatingCashFlow', 'revenue'], currentRatio: ['currentAssets', 'currentLiabilities'],
    cashAssets: ['cash', 'assets'], cashCurrent: ['cash', 'currentLiabilities'], debtAssets: ['totalDebt', 'assets'],
    cashDebt: ['cash', 'totalDebt'], equityAssets: ['equity', 'assets'], liabAssets: ['liabilities', 'assets'], peTTM: ['ttmNetCommon']
  };
  const aliases = {profitGrowth: 'earningsGrowth', fcfMargin: 'freeCashFlowMargin',
    cashFlowMargin: 'operatingCashFlowMargin', fcf: 'freeCashFlow'};
  const comparableModel = new Set(['returns', 'funding', 'valuation']);
  const seriesColors = ['#096657', '#5a77a1', '#a05c36', '#805782', '#617a35',
    '#555798', '#a74149', '#287c86', '#885b32', '#656586', '#596853',
    '#c66837', '#245289', '#914477', '#847324', '#137b4c', '#89564d'];
  const fmt = new Intl.NumberFormat('en-SG', {maximumFractionDigits: 1});
  const whole = new Intl.NumberFormat('en-SG', {maximumFractionDigits: 0});
  const day = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  const settings = new WeakMap();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const textNumber = (value, numberFormat) => numberFormat.format(value).replace(/^-/, '−');
  const pick = (value, fallback) => finite(value) ? value : fallback;
  const percent = (value, base) => finite(value) && finite(base) && base > 0 ? 100 * value / base : null;

  function value(company, key) {
    const v = company.values || {};
    const direct = pick(v[key], aliases[key] ? v[aliases[key]] : null);
    if (finite(direct)) return direct;
    if (key === 'cashAssets') return percent(v.cash, v.assets);
    if (key === 'cashCurrent') return percent(v.cash, v.currentLiabilities);
    if (key === 'liabAssets') return percent(v.liabilities, v.assets);
    if (key === 'equityAssets') return percent(v.equity, v.assets);
    return null;
  }

  function options(card, first, defaultOptions) {
    const model = first?.model;
    if (model === 'bank' && card === 'funding') return ['cet1', 'totalCapitalRatio', 'equityAssets'];
    if (model === 'bank' && card === 'liquidity') return ['cashAssets', 'cash', 'liabAssets'];
    if (['bank', 'insurer', 'broker', 'asset-manager'].includes(model) && card === 'profit') {
      return ['netMargin', 'operatingMargin', 'grossMargin'];
    }
    return defaultOptions;
  }

  function shortTicker(company) {
    const raw = company.ticker || company.id || company.name;
    return String(raw || '').split(' ')[0] || '—';
  }

  function dateLabel(date) {
    if (typeof date !== 'string') return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date + 'T00:00:00Z');
    return finite(+parsed) ? day.format(parsed) : date;
  }

  function logo(company) {
    const file = String(company.logo || '').replace(/^assets\//, '');
    const valid = /^(?:company-logos|shares-beta3-logos)\/[a-zA-Z0-9._() +!-]+\.webp$/.test(file);
    return valid ? '<img src="assets/' + file.split('/').map(encodeURIComponent).join('/') + '" width="24" height="24" alt="" loading="lazy">' :
      '<span class="sq-initials" aria-hidden="true">' + esc(shortTicker(company).slice(0, 2)) + '</span>';
  }

  function printed(n, unit, currency, detail = false) {
    if (!finite(n)) return '—';
    if (unit === 'amount') {
      const bn = !detail && Math.abs(n) >= 1000;
      const amount = n / (bn ? 1000 : 1);
      const number = detail && amount && Math.abs(amount) < .5 ? (amount < 0 ? '−<1' : '<1') : textNumber(amount, detail ? whole : fmt);
      return (currency ? currency + ' ' : '') + number + (bn ? 'bn' : 'm');
    }
    if (unit === 'share') return textNumber(Math.abs(n) < .5 ? 0 : n, whole) + '%';
    const numberFormat = detail ? whole : fmt;
    if (n && Math.abs(n) < (detail ? .5 : .05)) return (n < 0 ? '−' : '') + '<' + (detail ? '1' : '0.1') + unit;
    return textNumber(n, numberFormat) + unit;
  }

  function domain(nums, tick = 3) {
    const min = Math.min(0, ...nums);
    const max = Math.max(0, ...nums);
    const size = max - min || 1;
    const power = Math.pow(10, Math.floor(Math.log10(size / tick)));
    const step = [1, 2, 2.5, 5, 10].find(multiplier => multiplier * power + power * 1e-9 >= size / tick) * power;
    const round = number => Number(number.toPrecision(12));
    return {min: round(Math.floor(min / step) * step), max: round(Math.ceil(max / step) * step || (!min ? step : 0)), step: round(step)};
  }

  function position(n, bounds) {
    return Math.max(0, Math.min(100, (n - bounds.min) * 100 / (bounds.max - bounds.min)));
  }

  function ticks(bounds) {
    const total = Math.round((bounds.max - bounds.min) / bounds.step);
    return Array.from({length: total + 1}, (_, i) => Number((bounds.min + i * bounds.step).toPrecision(12)));
  }

  function axis(bounds, unit, currency) {
    const marks = ticks(bounds);
    const lines = marks.map(n => '<i class="' + (n === 0 ? 'sq-zero' : '') + '" style="--tick:' + position(n, bounds) + '%"></i>').join('');
    const labels = marks.map((n, i) => '<span class="' + (i === 0 ? 'sq-start' : i === marks.length - 1 ? 'sq-end' : '') + '" style="--tick:' +
      position(n, bounds) + '%">' + esc(printed(n, unit, currency)) + '</span>').join('');
    return {lines, labels};
  }

  function companyRows(companies, focus) {
    return companies.map((company, i) => ({company, i, active: focus ? company.id === focus || company.ticker === focus : i === 0,
      ticker: shortTicker(company), color: seriesColors[i % seriesColors.length]}));
  }

  function unavailable(company, key) {
    return company.missing?.[key] || 'No comparable figure for the selected period.';
  }

  function figureCell(output) {
    const cell = typeof output === 'string' ? {text:output} : output;
    return '<td>' + esc(cell.text) + (cell.note ? '<small class="sq-figure-note">' + esc(cell.note) + '</small>' : '') + '</td>';
  }

  function reportingNotes(rows) {
    const foreign = rows.filter(({company}) => company.reportingCurrency &&
      company.reportingCurrency !== company.currency);
    if (!foreign.length) return '';
    const group = new Map();
    for (const {company,ticker} of foreign) {
      const codes = group.get(company.reportingCurrency) || [];
      codes.push(ticker);
      group.set(company.reportingCurrency,codes);
    }
    return '<p class="sq-reporting-currencies">Original reporting currencies · ' +
      esc([...group].map(([code,tickers])=>code+' ('+tickers.join(', ')+')').join(' · ')) + '</p>';
  }

  function details(rows, title, columns, figureRow, showCurrencies = false) {
    return '<details class="sq-figures"><summary>Figures <span>' + rows.length + ' companies</span></summary>' +
      '<div class="sq-table-wrap" tabindex="0" role="region" aria-label="' + esc(title + ' figures') + '"><table><caption class="sr-only">' + esc(title) + '</caption><thead><tr><th scope="col">Company</th><th scope="col">Period</th>' +
      columns.map(label => '<th scope="col">' + esc(label) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(row => {
        const co = row.company;
        const period = dateLabel(co.periodLabel);
        return '<tr' + (row.active ? ' class="sq-active"' : '') + '><th scope="row"><span>' + esc(co.name || row.ticker) +
          '</span><small>' + esc(co.ticker || co.id) + '</small></th><td>' + esc(period || '—') +
          (co.basisLabel ? '<small>' + esc(co.basisLabel) + '</small>' : '') + '</td>' +
          figureRow(row).map(figureCell).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + (showCurrencies ? reportingNotes(rows) : '') + '</details>';
  }

  function portrayBars(rows, key, card) {
    const [label, unit, order] = metric[key];
    const rowsWithValues = rows.map(row => ({...row, n: value(row.company, key)}));
    const present = rowsWithValues.filter(row => finite(row.n));
    const currencies = new Set(present.map(row => row.company.currency || ''));
    const valueLabel = row => printed(row.n, unit, row.company.currency, true);
    const components = (breakdowns[key] || []).filter(field => rowsWithValues.some(row => finite(value(row.company, field))));
    const table = details(rowsWithValues, label, [label, ...components.map(field => amounts[field])], row => [
      {text:valueLabel(row),note:finite(row.n)?null:unavailable(row.company,key)},
      ...components.map(field => printed(value(row.company, field), 'amount', row.company.currency, true))
    ],unit==='amount'||components.length>0);
    if (!present.length) return '<p class="sq-empty">No comparable figures for this period. Expand Figures for the reasons.</p>' + table;
    if (unit === 'amount' && (currencies.size !== 1 || currencies.has(''))) {
      const byCurrency = new Map();
      for (const row of present) {
        const currency = row.company.currency || 'Currency unavailable';
        byCurrency.set(currency, (byCurrency.get(currency) || 0) + 1);
      }
      const list = [...byCurrency].map(([currency, count]) => '<span>' + esc(currency) + ' <b>' + count + '</b></span>').join('');
      return '<div class="sq-natives"><p>Figures are in each company’s reporting currency.</p><div>' + list + '</div></div>' + table.replace('<details ', '<details open ');
    }

    const model = rows[0]?.company.model;
    const sameModel = company => !comparableModel.has(card) || !model || company.model === model;
    const sortedPresent = present.slice().sort((a, b) => {
      const aIn = sameModel(a.company), bIn = sameModel(b.company);
      return Number(bIn) - Number(aIn) || (order === 'lower' ? a.n - b.n : b.n - a.n) || a.i - b.i;
    });
    const marked = new Set(sortedPresent.filter(row => sameModel(row.company) &&
      (!(order === 'lower' && card === 'valuation') || row.n > 0)).slice(0, 3).map(row => row.i));
    const ordered = [...sortedPresent, ...rowsWithValues.filter(row => !finite(row.n))];
    const bounds = domain(present.map(row => row.n));
    const currency = unit === 'amount' ? present[0].company.currency : '';
    const grid = axis(bounds, unit, '');
    const zero = position(0, bounds);
    const strips = ordered.map(row => {
      const x = finite(row.n) ? position(row.n, bounds) : zero;
      const datum = printed(row.n, unit, '', false);
      const leading = marked.has(row.i);
      const within = sameModel(row.company);
      const hint = [row.company.name, finite(row.n)?valueLabel(row):unavailable(row.company,key), dateLabel(row.company.periodLabel)].filter(Boolean).join(' · ');
      const color = row.active ? '#0e6255' : leading ? 'var(--sq-strong)' : 'var(--sq-mid)';
      const flag = row.active ? ' sq-active' : (!within ? ' sq-other-model' : '');
      return '<li class="sq-strip' + flag + (leading ? ' sq-top' : '') + '" title="' + esc(hint) + '">' +
        '<span class="sq-symbol">' + (leading ? logo(row.company) : '<i aria-hidden="true"></i>') +
        '<span>' + esc(row.ticker) + '</span></span>' +
        '<span class="sq-track" aria-hidden="true">' + grid.lines +
        (finite(row.n) ? '<i class="sq-bar' + (row.n < 0 ? ' sq-negative' : '') + '" style="--left:' + Math.min(zero, x) +
          '%;--size:' + Math.abs(x - zero) + '%;--fill:' + color + '"></i>' : '') + '</span>' +
        (finite(row.n) ? '<data value="' + row.n + '">' + esc(datum) + '</data>' :
          '<span class="sq-missing" role="img" aria-label="'+esc(unavailable(row.company,key))+'">—</span>') + '</li>';
    }).join('');
    const comparable = comparableModel.has(card) && present.some(row => !sameModel(row.company));
    const scope = comparable ? ' · focus business model first' : '';
    const units = currency ? ' · ' + currency : '';
    const note = order === 'lower' ? 'Lowest first' : 'Highest first';
    const coverage = present.length + '/' + rows.length + ' figures';
    return '<div class="sq-chart-meta"><span>' + esc(coverage + units) + '</span><span>' + esc(note + scope) + '</span></div>' +
      '<ol class="sq-microbars" aria-label="' + esc(label + ' by company') + '">' + strips + '</ol>' +
      '<div class="sq-axis" aria-hidden="true"><div>' + grid.labels + '</div></div>' + table;
  }

  function portrayBalance(rows) {
    const withData = rows.map(row => {
      const assets = value(row.company, 'assets');
      const liabilities = value(row.company, 'liabilities');
      return {...row, assets, liabilities, ratio: percent(liabilities, assets)};
    });
    const valid = withData.filter(row => finite(row.ratio) && row.ratio >= 0);
    const ordered = [...withData].sort((a, b) => (a.ratio ?? Infinity) - (b.ratio ?? Infinity) || a.i - b.i);
    const top = new Set(valid.slice().sort((a, b) => a.ratio - b.ratio || a.i - b.i).slice(0, 3).map(row => row.i));
    const table = details(ordered, 'Assets and liabilities', ['Total assets', 'Liabilities', 'Net assets / assets'], row => [
      {text:printed(row.assets,'amount',row.company.currency,true),note:finite(row.assets)?null:unavailable(row.company,'assets')},
      {text:printed(row.liabilities,'amount',row.company.currency,true),note:finite(row.liabilities)?null:unavailable(row.company,'liabilities')},
      printed(finite(row.ratio) ? 100 - row.ratio : null, '%', '', true)
    ],true);
    if (!valid.length) return '<p class="sq-empty">No comparable asset and liability figures for this period.</p>' + table;
    return '<div class="sq-chart-meta"><span>' + valid.length + '/' + rows.length + ' figures</span><span>Lowest liability share first</span></div>' +
      '<ol class="sq-microbars" aria-label="Liabilities as a percentage of total assets by company">' + ordered.map(row => {
        const n = finite(row.ratio) && row.ratio >= 0 ? row.ratio : null;
        const over = n > 100;
        return '<li class="sq-strip' + (row.active ? ' sq-active' : '') + (top.has(row.i) ? ' sq-top' : '') + '" title="' + esc(row.company.name) +
          '"><span class="sq-symbol">' + (top.has(row.i) ? logo(row.company) : '<i aria-hidden="true"></i>') + '<span>' + esc(row.ticker) +
          '</span></span><span class="sq-track sq-stack" aria-hidden="true">' +
          (finite(n) ? '<i class="sq-lia' + (over ? ' sq-over' : '') + '" style="--size:' + Math.min(100, n) +
            '%"></i><i class="sq-net" style="--size:' + Math.max(0, 100 - n) + '%"></i>' : '') +
          '</span><data' + (finite(n) ? ' value="' + n + '"' : '') + '>' + esc(printed(n, '%', '')) + '</data></li>';
      }).join('') + '</ol><div class="sq-stack-legend"><span><i></i> Liabilities</span><span><i></i> Net assets</span></div>' + table;
  }

  function portrayProfile(rows, key) {
    const [label, , yKey] = metric[key];
    const withData = rows.map(row => ({...row, x: value(row.company, 'revenueGrowth'), y: value(row.company, yKey)}));
    const present = withData.filter(row => finite(row.x) && finite(row.y));
    const table = details(withData, 'Revenue growth and ' + label.toLowerCase(), ['Revenue growth', label], row =>
      [{text:printed(row.x,'%', '',true),note:finite(row.x)?null:unavailable(row.company,'revenueGrowth')},
        {text:printed(row.y,'%', '',true),note:finite(row.y)?null:unavailable(row.company,yKey)}]);
    if (!present.length) return '<p class="sq-empty">No companies have both measures for this period.</p>' + table;
    const xb = domain(present.map(row => row.x)), yb = domain(present.map(row => row.y));
    const xGrid = axis(xb, '%', '');
    const yLines = ticks(yb).map(n => '<i class="sq-yline' + (n === 0 ? ' sq-zero' : '') + '" style="--tick:' +
      position(n, yb) + '%"><span>' + esc(printed(n, '%', '')) + '</span></i>').join('');
    const legend = present.map(row => '<span' + (row.active ? ' class="sq-active"' : '') + '><i style="--mark:' +
      row.color + '"></i>' + esc(row.ticker) + '</span>').join('');
    const points = present.slice().sort((a, b) => Number(a.active) - Number(b.active)).map(row => {
      const hint = (row.company.name || row.ticker) + ' · growth ' + printed(row.x, '%', '') + ' · ' + label.toLowerCase() + ' ' + printed(row.y, '%', '');
      return '<span tabindex="0" class="sq-point' + (row.active ? ' sq-active' : '') + '" aria-label="' + esc(hint) + '" style="--x:' +
        position(row.x, xb) + '%;--y:' + position(row.y, yb) + '%;--mark:' + row.color + '">' +
        '<span class="sq-tooltip" aria-hidden="true">' + esc(hint) + '</span></span>';
    }).join('');
    return '<div class="sq-chart-meta"><span>' + present.length + '/' + rows.length + ' figures</span><span>' + esc(label) + ' ↑</span></div>' +
      '<div class="sq-scatter" role="group" aria-label="' + esc(label + ' against revenue growth') + '">' +
      '<div class="sq-scatter-plot">' + xGrid.lines + yLines + points + '<div class="sq-scatter-x" aria-hidden="true">' + xGrid.labels + '</div></div>' +
      '<div class="sq-scatter-label">Revenue growth →</div></div><div class="sq-legend">' + legend + '</div>' + table;
  }


  function historyPoint(observation) {
    const parsed = /^Q([1-4])\s+(\d{4})\b/i.exec(observation?.period || observation?.label || observation?.periodLabel || '');
    return parsed ? {ordinal: +parsed[2] * 4 + +parsed[1] - 1, observation} : null;
  }

  function normalizedHistory(company) {
    const points = Array.isArray(company.history) ? company.history.map(historyPoint).filter(Boolean) : [];
    return new Map(points.map(({ordinal, observation}) => [ordinal, observation]));
  }

  function quarterSlots(rows, through) {
    const ordinals = rows.flatMap(row => [...row.history.keys()]);
    if (!ordinals.length) return [];

    const end = historyPoint({label:through})?.ordinal ?? Math.max(...ordinals);
    const length = Math.max(0, Math.min(8, end - Math.min(...ordinals) + 1));
    const start = end - length + 1;
    return Array.from({length}, (_, pos) => {
      const ordinal = start + pos;
      const year = Math.floor(ordinal / 4);
      const quarter = 'Q' + (ordinal % 4 + 1);
      return {ordinal, label: quarter + ' ' + year, abbreviated: quarter + ' ’' + String(year).slice(-2)};
    });
  }

  function portrayTrends(rows, key) {
    const [label, , source] = metric[key];
    const slots = quarterSlots(rows);
    if (!slots.length) return '<p class="sq-empty">Quarterly trends are unavailable.</p>';
    const length = slots.length;
    const series = rows.map(row => ({
      ...row, points: slots.map(slot => row.history.get(slot.ordinal) || null),
      nums: slots.map(slot => value(row.history.get(slot.ordinal) || {}, source))
    }));
    const usable = series.filter(row => row.nums.some(finite));
    const table = '<details class="sq-figures"><summary>Figures <span>' + rows.length + ' companies</span></summary>' +
      '<div class="sq-table-wrap" tabindex="0" role="region" aria-label="' + esc(label + ' by calendar quarter') + '"><table><caption class="sr-only">' + esc(label + ' by calendar quarter') + '</caption>' +
      '<thead><tr><th scope="col">Company</th>' + slots.map(slot => '<th scope="col">' + slot.label + '</th>').join('') + '</tr></thead><tbody>' +
      series.map(row => '<tr' + (row.active ? ' class="sq-active"' : '') + '><th scope="row">' + esc(row.company.name) +
        '<small>' + esc(row.company.ticker) + '</small></th>' + row.nums.map((n, j) => {
          const point = row.points[j];
          const date = dateLabel(point?.end || point?.ended);
          return '<td>' + esc(printed(n, '%', '', true)) + (finite(n) && date ? '<small>' + esc(date) + '</small>' : '') + '</td>';
        }).join('') + '</tr>').join('') + '</tbody></table></div></details>';
    if (!usable.length) return '<p class="sq-empty">No trend figures for this measure.</p>' + table;
    const limits = domain(usable.flatMap(row => row.nums.filter(finite)), 3);
    const yLines = ticks(limits).map(n => '<i class="sq-yline' + (n === 0 ? ' sq-zero' : '') + '" style="--tick:' +
      position(n, limits) + '%"><span>' + esc(printed(n, '%', '')) + '</span></i>').join('');
    const x = i => i / Math.max(1, length - 1) * 100;
    const legend = usable.map(row => '<span' + (row.active ? ' class="sq-active"' : '') + '><i style="--mark:' +
      row.color + '"></i>' + esc(row.ticker) + '</span>').join('');
    const dashed = ['none', 'none', '5 3', '4 2', '3 2', '7 2', '4 4', '7 3 2 3', '5 2', '2 2', '3 5'];
    const lines = usable.slice().sort((a, b) => Number(a.active) - Number(b.active)).map(row => {
      const elements = row.nums.map((n, i) => {
        if (!finite(n)) return '';
        const y = 100 - position(n, limits), next = row.nums[i + 1];
        return finite(next) ? '<path d="M' + x(i) + ' ' + y + 'L' + x(i + 1) + ' ' + (100 - position(next, limits)) + '"></path>' : '';
      }).join('');
      return '<g stroke="' + row.color + '" stroke-dasharray="' + dashed[row.i % dashed.length] +
        '" stroke-width="' + (row.active ? 2.65 : 1.55) + '">' + elements + '</g>';
    }).join('');
    const points = usable.slice().sort((a, b) => Number(a.active) - Number(b.active)).flatMap(row => row.nums.map((n, i) => {
      if (!finite(n)) return '';
      const hint = row.company.name + ' · ' + slots[i].label + ' · ' + printed(n, '%', '');
      return '<i class="sq-trend-point' + (row.active ? ' sq-active' : '') + '" title="' + esc(hint) + '" style="--x:' +
        x(i) + '%;--y:' + position(n, limits) + '%;--mark:' + row.color + '"></i>';
    })).join('');
    const labels = slots.map((slot, i) => '<span title="' + slot.label + '" class="' + (i === 0 ? 'sq-start' :
      i === length - 1 ? 'sq-end' : i % 2 === 1 ? 'sq-minor' : '') + '" style="--tick:' + x(i) + '%">' + slot.abbreviated + '</span>').join('');
    const vertical = slots.map((_, i) => '<i style="--tick:' + x(i) + '%"></i>').join('');
    return '<div class="sq-chart-meta"><span>' + usable.length + '/' + rows.length + ' companies</span><span>Calendar quarters</span></div>' +
      '<div class="sq-trend-inner" role="img" aria-label="' + esc(label + ' by calendar quarter') + '">' +
      '<div class="sq-scatter-plot sq-trend-plot" aria-hidden="true">' + yLines + vertical +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">' + lines +
      '</svg>' + points + '<div class="sq-scatter-x">' + labels + '</div></div></div>' +
      '<div class="sq-legend">' + legend + '</div>' + table;
  }

  function directPeers(rows) {
    return rows.filter(row => !row.company.isBonus);
  }

  function portrayRevenueShare(allRows) {
    const rows = directPeers(allRows).map(row => ({...row,n:value(row.company,'revenue')}));
    const present = rows.filter(row=>finite(row.n)&&row.n>=0).sort((a,b)=>b.n-a.n||a.i-b.i);
    const total = present.reduce((sum,row)=>sum+row.n,0);
    const share = row=>present.includes(row)&&total>0?100*row.n/total:null;
    const table = details([...present,...rows.filter(row=>!present.includes(row))], 'Direct peer revenue share',
      ['Revenue','Share of reported peer revenue'],row=>[
        {text:printed(row.n,'amount','USD',true),note:!finite(row.n)?unavailable(row.company,'revenue'):row.n<0?'Negative revenue excluded from the share calculation.':null},
        printed(share(row),'share','')
      ],true);
    if (total<=0) return '<p class="sq-empty">No positive comparable revenue to show a share.</p>'+table;
    let before=0;
    const stops=present.filter(row=>row.n>0).map(row=>{
      const end=before+share(row);
      const stop=row.color+' '+before+'% '+end+'%';
      before=end;
      return stop;
    }).join(',');
    const labels=present.map((row,i)=>'<li class="'+(row.active?'sq-active':'')+'"><span class="sq-pie-mark" style="--mark:'+row.color+'"></span>'+
      (i<3?logo(row.company):'')+'<span>'+esc(row.ticker)+'</span><strong>'+esc(printed(share(row),'share',''))+'</strong></li>').join('');
    const basis='<div class="sq-chart-meta"><span>'+present.length+'/'+rows.length+' direct peers reporting</span><span>Selected peer group</span></div>';
    return basis+'<div class="sq-share-view"><div class="sq-donut" role="img" aria-label="Share of reported revenue among selected direct peers" style="--sq-stops:'+stops+'">'+
      '<div><strong>'+esc(printed(total,'amount','USD'))+'</strong><small>Peer revenue</small></div></div><ol>'+labels+'</ol></div>'+table;
  }

  function shareOfMagnitude(values){
    const total=values.reduce((sum,n)=>sum+Math.abs(n),0);
    return total>0?values.map(n=>100*n/total):null;
  }

  function peerStack(allRows, measure, mode, through) {
    const rows = directPeers(allRows);
    const slots = quarterSlots(rows, through);
    const series = rows.map(row => ({...row, amounts:slots.map(slot=>value(row.history.get(slot.ordinal)||{},measure))}));
    // Start with the most recent comparable quarter. Prefer including the
    // focus company when its filings overlap at least one direct peer.
    const focus=series.find(row=>row.active);
    function matchedGroup(required){
      for(let end=slots.length-1;end>0;end--){
        let best=[];
        for(let prior=end-1;prior>=0;prior--){
          const group=series.filter(row=>finite(row.amounts[end])&&finite(row.amounts[prior]));
          if(group.length>best.length&&(!required||group.includes(required)))best=group;
        }
        if(best.length>=2)return best;
      }
      return [];
    }
    const preferred=focus?matchedGroup(focus):[];
    const cohort=preferred.length?preferred:matchedGroup();
    const quarters=slots.map((slot,i)=>{
      const {amounts,shares,total}=peerQuarter(cohort,i);
      if (total===null) return {reason:'Missing comparable figure'};
      const values=mode==='share'?shares:amounts;
      return values?{total,values}:{total,reason:'Peer total is zero'};
    });
    return {rows,slots,cohort,quarters};
  }

  function peerQuarter(cohort,index) {
    const amounts=cohort.map(row=>row.amounts[index]);
    const complete=amounts.length>=2&&amounts.every(finite);
    const total=complete?amounts.reduce((sum,n)=>sum+n,0):null;
    return {amounts,total,shares:complete?shareOfMagnitude(amounts):null};
  }

  function quarterReadout(stack,index) {
    const {cohort,slots}=stack;
    const {amounts,shares,total}=peerQuarter(cohort,index);
    const completeness=amounts.filter(finite).length;
    const amount=n=>printed(n,'amount','USD',true);
    const percent=n=>printed(n,'share','');
    const rows=cohort.map((row,i)=>{
      const name=row.company.name||row.ticker;
      return '<tr'+(row.active?' class="sq-active"':'')+'><th scope="row" title="'+esc(name)+'"><span class="sq-quarter-key" style="--mark:'+row.color+'"></span>'+esc(row.ticker)+
        '</th><td>'+esc(amount(amounts[i]))+'</td><td>'+esc(percent(shares?.[i]))+'</td></tr>';
    }).join('');
    const signed=amounts.some(n=>finite(n)&&n<0);
    const note=total===null?completeness+'/'+cohort.length+' matched peers reporting. The group total and shares require a figure from each peer.':
      !shares?'Shares are unavailable when every peer reports zero.':
      signed?'Shares use the sum of absolute amounts. The total includes losses.':'';
    const netShare=shares?.reduce((sum,n)=>sum+n,0);
    return '<h4>'+esc(slots[index].label)+'</h4>'+
      '<table><caption class="sr-only">'+esc(slots[index].label)+' direct peer figures</caption>'+
      '<thead><tr><th scope="col">Company</th><th scope="col">USD amount</th><th scope="col">% share</th></tr></thead>'+
      '<tbody>'+rows+'</tbody><tfoot><tr><th scope="row">'+(signed?'Net total':'Quarter total')+'</th><td>'+esc(amount(total))+
      '</td><td>'+esc(percent(netShare))+'</td></tr></tfoot></table>'+
      (note?'<p class="sq-quarter-note">'+esc(note)+'</p>':'');
  }

  function selectPeerQuarter(button,state) {
    const ordinal=Number(button.dataset.sqQuarter);
    if (state.areaQuarter===ordinal&&button.getAttribute('aria-pressed')==='true') return;
    const group=button.parentElement;
    const area=group.closest('#direct-peer-area');
    const {slots}=state.areaStack;
    const index=slots.findIndex(slot=>slot.ordinal===ordinal);
    if (index<0) return;
    state.areaQuarter=ordinal;
    for(const item of group.children)item.setAttribute('aria-pressed',item===button);
    area.querySelector('.sq-quarter-guide').style.setProperty('--tick',index/(slots.length-1)*100+'%');
    area.querySelector('.sq-quarter-readout').innerHTML=quarterReadout(state.areaStack,index);
  }

  function stackSamples(quarters, share=false) {
    const samples=[];
    quarters.forEach(({values},i)=>{
      samples.push(values?{x:i,values}:null);
      const next=quarters[i+1]?.values;
      if (!values||!next) return;
      const crossings=new Set();
      values.forEach((n,j)=>{
        if ((n<0&&next[j]>0)||(n>0&&next[j]<0)) crossings.add(n/(n-next[j]));
      });
      // Break at zero crossings so a loss turning into a profit changes
      // sides at one point. Leave gaps between missing quarters.
      for (const t of [...crossings].sort((a,b)=>a-b)) {
        const interpolated=values.map((n,j)=>{
          const m=next[j];
          return n!==m&&n/(n-m)===t?0:n+t*(m-n);
        });
        const stack=share?shareOfMagnitude(interpolated):interpolated;
        samples.push(stack?{x:i+t,values:stack}:null);
      }
    });
    return samples;
  }

  function areaSegments(points,edge) {
    const runs=[];
    let run=[];
    for (const point of [...points,null]){
      if (point){run.push(point);continue;}
      if (run.some(point=>point.top!==point.bottom)) runs.push(run);
      run=[];
    }
    return runs.map(segment=>{
      if (segment.length===1){
        const {x,top,bottom}=segment[0];
        return '<line x1="'+x+'" x2="'+x+'" y1="'+top+'" y2="'+bottom+'" stroke-width="7" vector-effect="non-scaling-stroke"></line>';
      }
      return '<polygon stroke="none" points="'+segment.map(pt=>edge(pt,'top')).concat(segment.slice().reverse().map(pt=>edge(pt,'bottom'))).join(' ')+'"></polygon>';
    }).join('');
  }

  function portrayPeerArea(state) {
    const {areaMeasure:measure,areaMode:mode}=state;
    const stack=peerStack(state.rows,measure,mode,state.through);
    state.areaStack=stack;
    const {rows,slots,cohort,quarters}=stack;
    const label=areaMeasures[measure], share=mode==='share';
    const unit=share?'%':'amount';
    const format=n=>share?printed(n,'share',''):printed(n,'amount','USD',true);
    if (cohort.length<2) return '<p class="sq-empty">At least two direct peers need comparable '+esc(label.toLowerCase())+' in the same two quarters.</p>';
    const signed=cohort.some(row=>row.amounts.some(n=>finite(n)&&n<0));
    const skipped=rows.filter(row=>!cohort.some(peer=>peer.i===row.i)).map(row=>row.ticker);
    const axisLabel=share?'Share of matched peers':'USD';
    const table='<details class="sq-figures"><summary>Figures <span>'+cohort.length+' matched companies</span></summary>'+
      '<div class="sq-table-wrap" tabindex="0" role="region" aria-label="'+esc(label+' · '+axisLabel+' by calendar quarter')+'"><table><caption class="sr-only">'+esc(label+' · '+axisLabel)+'</caption>'+
      '<thead><tr><th scope="col">Company</th>'+slots.map(slot=>'<th scope="col">'+esc(slot.label)+'</th>').join('')+'</tr></thead><tbody>'+
      cohort.map((row,j)=>'<tr'+(row.active?' class="sq-active"':'')+'><th scope="row">'+esc(row.company.name)+'<small>'+esc(row.ticker)+'</small></th>'+
        row.amounts.map((n,i)=>{
          const value=share?quarters[i].values?.[j]:n;
          const note=!finite(n)?'Comparable USD figure unavailable.':!finite(value)?quarters[i].reason+'.':null;
          return figureCell({text:format(value),note});
        }).join('')+'</tr>').join('')+
      '<tr><th scope="row">'+(share&&signed?'Net share':'Matched total')+'</th>'+
      quarters.map(q=>figureCell(format(share?q.values?.reduce((sum,n)=>sum+n,0):q.total))).join('')+'</tr>'+
      '</tbody></table></div>'+reportingNotes(cohort)+'</details>';
    const extents=quarters.flatMap(q=>q.values?[q.values.reduce((sum,n)=>sum+Math.max(n,0),0),q.values.reduce((sum,n)=>sum+Math.min(n,0),0)]:[]);
    const limits=share?{min:extents.some(n=>n<0)?-100:0,max:!extents.length||extents.some(n=>n>0)?100:0,step:25}:domain(extents);
    const x=i=>i/(slots.length-1)*100, y=n=>100-position(n,limits);
    const previous=slots.findIndex(slot=>slot.ordinal===state.areaQuarter);
    const recent=quarters.findLastIndex(q=>finite(q.total));
    const selected=previous>=0?previous:Math.max(0,recent);
    state.areaQuarter=slots[selected].ordinal;
    const columns=slots.map((_,i)=>i===0||i===slots.length-1?'1fr':'2fr').join(' ');
    const buttons=slots.map((slot,i)=>'<button type="button" data-sq-quarter="'+slot.ordinal+'" aria-label="'+esc(slot.label)+
      '" aria-controls="sq-quarter-readout" aria-pressed="'+(i===selected)+'"></button>').join('');
    const xLabels=slots.map((slot,i)=>'<span class="'+(i===0?'sq-start':i===slots.length-1?'sq-end':i%2?'sq-minor':'')+'" style="--tick:'+x(i)+'%">'+esc(slot.abbreviated)+'</span>').join('');
    const guide=ticks(limits).map(n=>'<i class="sq-yline'+(n===0?' sq-zero':'')+'" style="--tick:'+position(n,limits)+'%"><span>'+esc(printed(n,unit,''))+'</span></i>').join('');
    const gaps=quarters.map((q,i)=>q.values?'':'<i class="sq-area-gap" style="--tick:'+x(i)+'%" title="'+esc(slots[i].label+' · '+q.reason)+'"><span>Gap</span></i>').join('');
    const samples=stackSamples(quarters,share).map(point=>point?{...point,positive:0,negative:0}:null);
    const edge=(pt,field)=>pt.x+','+pt[field];
    const shapes=cohort.map((row,j)=>{
      const layers=[true,false].map(positive=>areaSegments(samples.map(point=>{
        if (!point) return null;
        const n=point.values[j];
        const outer=positive?'positive':'negative';
        if ((positive&&n<0)||(!positive&&n>0)) return null;
        const bottom=point[outer];
        point[outer]+=n;
        return {x:x(point.x),top:y(point[outer]),bottom:y(bottom)};
      }),edge));
      return '<g fill="'+row.color+'" stroke="'+row.color+'">'+layers.join('')+'</g>';
    }).join('');
    const legend=cohort.map(row=>'<span'+(row.active?' class="sq-active"':'')+'><i style="--mark:'+row.color+'"></i>'+esc(row.ticker)+'</span>').join('');
    const scoreNote=share&&signed?'<p class="sq-reporting-currencies">Share divides each value by the sum of the peers’ absolute values. Negative values appear below zero.</p>':'';
    return '<div class="sq-chart-meta"><span>'+cohort.length+'/'+rows.length+' in matched peer group</span><span>'+axisLabel+' · Calendar quarters</span></div>'+
      '<div class="sq-area-inspection"><div class="sq-area-main"><div class="sq-trend-inner sq-area-inner">'+
      '<div class="sq-scatter-plot sq-trend-plot">'+guide+'<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="'+esc(label+' by calendar quarter · '+axisLabel)+'">'+shapes+
      '</svg>'+gaps+'<span class="sq-quarter-guide" aria-hidden="true" style="--tick:'+x(selected)+'%"></span>'+
      '<div class="sq-quarter-targets" role="group" aria-label="Inspect a quarter" style="grid-template-columns:'+columns+'">'+buttons+'</div>'+
      '<div class="sq-scatter-x" aria-hidden="true">'+xLabels+'</div></div></div><div class="sq-legend">'+legend+'</div>'+scoreNote+
      '<p class="sq-quarter-note">Hover or tap a quarter for USD amounts and shares.</p>'+
      '</div><section class="sq-quarter-readout" id="sq-quarter-readout" aria-label="Selected quarter figures">'+quarterReadout(stack,selected)+'</section></div>'+
      (skipped.length?'<p class="sq-reporting-currencies">Outside the matched group · '+esc(skipped.join(', '))+'</p>':'')+table;
  }

  function peerAreaCard(state) {
    const options=Object.entries(areaMeasures).map(([key,label])=>'<button type="button" data-sq-area-measure="'+key+'" aria-pressed="'+(state.areaMeasure===key)+'">'+label+'</button>').join('');
    const modes=[['usd','USD'],['share','% share']].map(([key,label])=>'<button type="button" data-sq-area-mode="'+key+'" aria-pressed="'+(state.areaMode===key)+'">'+label+'</button>').join('');
    return '<article id="direct-peer-area" class="sq-card sq-revenue-area" data-sq-card="'+areaId+'"><header><h3>Direct peer financials over time</h3>'+
      '<div class="sq-area-controls"><div class="sq-switches" role="group" aria-label="Stacked area metric">'+options+'</div>'+
      '<div class="sq-switches sq-area-units" role="group" aria-label="Stacked area units">'+modes+'</div></div></header>'+
      '<div class="sq-card-body">'+portrayPeerArea(state)+'</div></article>';
  }

  function cardHtml(id, title, group, active, rows) {
    const controls = group.map(key => '<button type="button" data-sq-metric="' + key + '" aria-pressed="' + (key === active) + '">' +
      esc(metric[key][0]) + '</button>').join('');
    return '<article class="sq-card sq-' + id + '" data-sq-card="' + id + '"><header><h3>' + esc(title) +
      '</h3>' + (group.length>1?'<div class="sq-switches" role="group" aria-label="' + esc(title + ' measures') + '">' + controls + '</div>':'') + '</header>' +
      '<div class="sq-card-body">' + chart(active, rows, id) + '</div></article>';
  }

  function chart(key, rows, id) {
    const kind = metric[key][1];
    if (kind === 'mix') return portrayBalance(rows);
    if (kind === 'profile') return portrayProfile(rows, key);
    if (kind === 'trend') return portrayTrends(rows, key);
    if (kind === 'donut') return portrayRevenueShare(rows);
    return portrayBars(rows, key, id);
  }

  function render(container, data = {}) {
    if (!container) return;
    const companies = Array.isArray(data?.companies) ? data.companies : [];
    const rows = companyRows(companies, data.focus).map(row => ({...row, history: normalizedHistory(row.company)}));
    let state = settings.get(container);
    if (!state) {
      state = {selected: new Map(), rows, areaMeasure:'revenue', areaMode:'usd'};
      settings.set(container, state);
      function onQuarter(event) {
        const button=event.target.closest('[data-sq-quarter]');
        if (button) selectPeerQuarter(button,state);
      }
      container.addEventListener('pointerover',event=>{
        if (event.pointerType==='mouse') onQuarter(event);
      });
      container.addEventListener('focusin',onQuarter);
      container.addEventListener('keydown',event=>{
        const button=event.target.closest('[data-sq-quarter]');
        if (!button||!['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const next=event.key==='ArrowLeft'?button.previousElementSibling:button.nextElementSibling;
        next?.focus();
      });
      container.addEventListener('click', event => {
        onQuarter(event);
        const button = event.target.closest('[data-sq-metric],[data-sq-area-measure],[data-sq-area-mode]');
        const card = button?.closest('[data-sq-card]');
        if (!card || !container.contains(card)) return;
        if (button.getAttribute('aria-pressed') === 'true') return;
        const id = card.dataset.sqCard;
        let plot;
        let group;
        if (id===areaId){
          if (button.dataset.sqAreaMeasure) state.areaMeasure=button.dataset.sqAreaMeasure;
          else state.areaMode=button.dataset.sqAreaMode;
          group=button.parentElement;
          plot=portrayPeerArea(state);
        } else {
          const key=button.dataset.sqMetric;
          state.selected.set(id,key);
          group=button.parentElement;
          plot=chart(key,state.rows,id);
        }
        for (const item of group.querySelectorAll('button')) item.setAttribute('aria-pressed',item===button);
        const body=card.querySelector('.sq-card-body');
        const preserve=body.querySelector('.sq-figures')?.open;
        const scroll=body.querySelector('.sq-table-wrap')?.scrollLeft;
        body.innerHTML=plot;
        const detail=body.querySelector('.sq-figures');
        if (preserve&&detail){
          detail.open=true;
          const table=detail.querySelector('.sq-table-wrap');
          if (table) table.scrollLeft=scroll;
        }
      });
    }
    const open = new Set([...container.querySelectorAll('.sq-figures[open]')].map(item => item.closest('[data-sq-card]').dataset.sqCard));
    state.rows = rows;
    state.through = data.selectedQuarter;
    const period = data.periodLabel || (data.period === 'latest' || !data.period ? 'Latest reported periods' : 'Fiscal year ' + data.period);
    const standalone = !container.closest('section[aria-labelledby]');
    const head = '<header class="sq-head"><div>' + (standalone ? '<h2>Fundamentals at a glance</h2>' : '') + '<p>' + esc(period+(data.growthBasis==='qoq'?' · Growth QoQ':data.growthBasis==='yoy'?' · Growth YoY':'')) + '</p></div>' +
      '<span class="sq-count">' + rows.length + (rows.length === 1 ? ' company' : ' companies') + '</span></header>';
    container.classList.add('shares-quarterly-charts');
    const cards = [...sizeLayouts,...layouts];
    if (quarterSlots(directPeers(rows),state.through).length>=2) cards.push([areaId]);
    if (rows.some(row=>row.history.size>=2)) cards.push(trendLayout);
    container.innerHTML = head + '<div class="sq-grid">' + cards.map(([id, title, base]) => {
      if (id===areaId) return peerAreaCard(state);
      const group = options(id, companies[0], base);
      const current = state.selected.get(id);
      const active = group.includes(current) ? current : group[0];
      return cardHtml(id, title, group, active, rows);
    }).join('') + '</div>';
    for (const item of container.querySelectorAll('.sq-figures')) {
      if (open.has(item.closest('[data-sq-card]').dataset.sqCard)) item.open = true;
    }
  }

  const api = {render,peerStack,stackSamples,peerQuarter};
  root.SharesQuarterlyCharts = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
