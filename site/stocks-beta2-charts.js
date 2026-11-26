/* Chart the same dated observations used by the Stocks BETA 2 table. */
(function (root) {
  'use strict';

  const e = value => String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const time = date => Date.parse(date + 'T00:00:00Z');
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const tickFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const numbers = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
  const figures = root.FinancialDisplay;
  const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 });
  const signedPercent = new Intl.NumberFormat('en-GB', {
    style: 'percent', signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 1
  });
  const axisNumber = value => Math.abs(value) >= 1000 ? compact.format(value) : numbers.format(value);
  const wholePrice = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
  const smallPrice = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const priceLabel = value => (Math.abs(value) < 10 ? smallPrice : wholePrice).format(value);
  const monthLabel = month => monthFormat.format(time(month + '-01'));
  // NYSE or Nasdaq listings identified on the reports in the November 2026 coverage snapshot.
  const usaListings = new Set((
    'AAPL NVDA MSFT GOOG GOOGL AMZN TSM SPCX TSLA META AVGO LLY BRK/B BRK/A SKHY WMT MU JPM V AMD XOM JNJ ASML MA ABBV COST CVX PLTR KO CSCO PG MRK ORCL UNH BAC HD GE PM INTC AMAT MS PANW LRCX RY CAT TXN RTX GS WFC NFLX TMO BABA AMGN DELL CRWD IBM LIN GEV AXP GILD ARM ANET C SHOP'
  ).split(' ').map(symbol => symbol + ' US'));

  function chartHistory(data, company, adjustments) {
    const splits = adjustments?.splits?.[company.ticker] ?? [];
    const source = point => company.previous?.[point[data.metrics.length + 1]];
    const priceColumn = data.metrics.findIndex(([key]) => key === 'price') + 1;
    const factor = quote => splits.reduce((divisor, [day, ratio]) => quote < day ? ratio * divisor : divisor, 1);
    const direct = new Set(company.observations.filter(point => !source(point)).map(point => point[0]));
    const months = data.months.map((month, index) => {
      const [edition, report, declared] = month;
      const [expected, choices] = adjustments?.tradingDates?.[report] ?? [];
      if (expected !== declared || !direct.has(index)) return month;
      const verified = Object.keys(choices).find(day => choices[day].includes(company.ticker));
      return verified ? [edition, report, verified] : month;
    });
    const observations = company.observations.map(point => {
      const divisor = direct.has(point[0]) ? factor(months[point[0]][2]) : 1;
      if (divisor === 1 || !Number.isFinite(point[priceColumn])) return point;
      const adjusted = point.slice();
      adjusted[priceColumn] /= divisor;
      return adjusted;
    });
    const prices = new Map(observations.map(point => [point[0], point[priceColumn]]));
    const valueDates = adjustments?.fairValueBasisDates?.[company.ticker];
    function fairValues(rows) {
      return rows?.flatMap(([index, value, rating]) => {
        if (!direct.has(index) || !Number.isFinite(value)) return [];
        const [, report, quote] = months[index];
        const adjusted = value / factor(valueDates?.[report] ?? quote);
        return [{ index, quote, value: adjusted, rating, price: prices.get(index), divisor: factor(quote) }];
      });
    }
    return { data: { ...data, months }, company: { ...company, observations }, splits, fairValues };
  }

  function historyPoints(data, company, metric, from, to) {
    const column = data.metrics.findIndex(item => item[0] === metric) + 1;
    return company.observations
      .filter(point => point[0] >= from && point[0] <= to && Number.isFinite(point[column]))
      .map(point => {
        const [, report, quote] = data.months[point[0]];
        return { index: point[0], report, quote, value: point[column] };
      });
  }

  function splitLike(previous, current, price, cap) {
    if (!(previous[cap] > 0 && current[cap] > 0)) return false;
    const priceRatio = current[price] / previous[price];
    const capRatio = current[cap] / previous[cap];
    if (Math.abs(Math.log(priceRatio)) < Math.log(1.6)) return false;
    const shares = capRatio / priceRatio;
    const change = Math.max(shares, 1 / shares);
    return [2, 3, 4, 5, 8, 10, 20, 25, 50, 100].some(ratio => Math.abs(change / ratio - 1) <= .04);
  }

  function probabilityCone(data, company, anchor) {
    const price = data.metrics.findIndex(([key]) => key === 'price') + 1;
    const cap = data.metrics.findIndex(([key]) => key === 'market_cap_usd_bn') + 1;
    const monthIndex = i => {
      const [year, month] = data.months[i][0].split('-').map(Number);
      return year * 12 + month;
    };
    const source = point => company.previous[point[data.metrics.length + 1]];
    const earliest = monthIndex(anchor.index) - 36;
    const observations = company.observations.filter(point => point[0] <= anchor.index && monthIndex(point[0]) >= earliest);
    const changes = [];
    let splits = 0;
    for (let i = 1; i < observations.length; i++) {
      const previous = observations[i - 1], current = observations[i];
      if (monthIndex(current[0]) - monthIndex(previous[0]) !== 1 || !(previous[price] > 0 && current[price] > 0)) continue;
      if (source(previous)?.[0] !== source(current)?.[0] &&
          [source(previous)?.[1], source(current)?.[1]].includes('predecessor_security')) continue;
      if (splitLike(previous, current, price, cap)) { splits++; continue; }
      changes.push(Math.log(current[price] / previous[price]));
    }
    const count = changes.length;
    if (count < 12) return { count, splits };
    const mean = changes.reduce((sum, value) => sum + value, 0) / count;
    const sigma = Math.sqrt(changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1));
    const points = Array.from({length:13}, (_, month) => [2, 1, 0, -1, -2].map(
      sd => anchor.value * Math.exp(sd * sigma * Math.sqrt(month))
    ));
    return { count, splits, sigma, points, anchor };
  }

  function peRankings(data, month, market) {
    const pe = data.metrics.findIndex(item => item[0] === 'forward_pe') + 1;
    const cap = data.metrics.findIndex(item => item[0] === 'market_cap_usd_bn') + 1;
    const issuers = new Map();
    for (const company of data.securities) {
      if (usaListings.has(company.ticker) !== (market === 'usa')) continue;
      const point = company.observations.find(item => item[0] === month);
      if (!point || !Number.isFinite(point[pe]) || point[pe] <= 0) continue;
      const marketCap = point[cap] ?? -Infinity;
      const issuer = company.logo || company.ticker;
      const previous = issuers.get(issuer);
      if (!previous || marketCap > previous.marketCap) {
        issuers.set(issuer, { company, value: point[pe], marketCap });
      }
    }
    const ranked = [...issuers.values()];
    const byTicker = (a, b) => a.company.ticker.localeCompare(b.company.ticker);
    return {
      count: ranked.length,
      high: ranked.slice().sort((a, b) => b.value - a.value || byTicker(a, b)).slice(0, 10),
      low: ranked.slice().sort((a, b) => a.value - b.value || byTicker(a, b)).slice(0, 10)
    };
  }

  function niceStep(range, parts) {
    const target = range / parts;
    const order = 10 ** Math.floor(Math.log10(target));
    return order * ([1, 2, 2.5, 5, 10].find(step => step >= target / order) ?? 10);
  }

  const priceColor = '#126c66';
  const targetColors = { Buy: '#2766bf', Hold: '#b38a00', Sell: '#d87882' };
  const ratioColors = ['#326d9f', '#8554a1'];

  const coneLabels = ['+2 SD', '+1 SD', '0 SD', '−1 SD', '−2 SD'];
  const allBands = [1, 2];

  function coneLevels(cone, bands) {
    return cone?.points.at(-1).flatMap((value, i) => {
      const band = Math.abs(2 - i);
      return band === 0 || bands.includes(band) ? [{ value, label: coneLabels[i] }] : [];
    }) ?? [];
  }
  const researchTargetColor = '#914913';

  function researchConeTarget(brief, currency) {
    const target = brief?.target;
    if (!target || target.currency !== currency) return null;
    const value = Number(String(target.value).replaceAll(',', ''));
    if (!Number.isFinite(value) || value <= 0) return null;
    let source = '';
    try {
      const url = new URL(brief.source);
      if (url.protocol === 'https:' && !url.username && !url.password && url.pathname.toLowerCase().endsWith('.pdf')) {
        source = url.href;
      }
    } catch {
      // An unavailable PDF still allows the report date to be shown.
    }
    return { value, provider: brief.provider, date: brief.date, source };
  }

  function targetGapLabel(price, target, atTarget = 'At fair value') {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(target) || target <= 0) return '';
    const gap = (target - price) / price;
    if (!Number.isFinite(gap)) return '';
    if (gap === 0) return atTarget;
    const amount = Math.abs(gap) < .0005 ? 'Less than 0.1%' : signedPercent.format(gap);
    const direction = gap > 0 ? ' upside' : ' downside';
    return amount + direction;
  }

  function targetBand(value, [upper2, upper1, , lower1, lower2]) {
    if (value > upper2) return 'Above +2 SD';
    if (value >= lower1 && value <= upper1) return 'Within ±1 SD';
    if (value < lower2) return 'Below −2 SD';
    return value > upper1 ? 'Between +1 and +2 SD' : 'Between −1 and −2 SD';
  }

  function drawPlot(canvas, series, dates, { from, to, cursor, axis }, { cone, bands, researchTarget, isPrice, formatAxis, axisGutter = 0, scenario } = {}) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return null;
    const narrow = width < 500 && axis !== 'days';
    const scale = Math.min(root.devicePixelRatio || 1, 2);
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    const levels = coneLevels(cone, bands);
    const values = series.flatMap(line => line.points.map(point => point.value));
    values.push(...levels.map(level => level.value));
    if (researchTarget) values.push(researchTarget.value);
    if (series.some(line => line.area)) values.push(0);
    if (scenario) {
      values.push(0, ...scenario.lines.flatMap(line => line.points.map(point => point.value)));
      for (const line of scenario.lines) if (line.test) values.push(line.test.value);
    }
    const low = Math.min(...values), high = Math.max(...values);
    const pad = low === high ? Math.max(Math.abs(low) / 10, .1) : 0;
    const step = niceStep(high - low + 2 * pad, 4);
    const min = Math.floor((low - pad) / step) * step;
    const max = Math.ceil((high + pad) / step) * step;
    const labels = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + step * i);
    const first = time(dates[from][2]), last = time(cone?.anchor.quote || dates[to][2]);
    const labelValue = formatAxis || (value => isPrice && (!narrow || Math.abs(value) < 1000) ? priceLabel(value) : axisNumber(value));
    const labelWidth = Math.ceil(Math.max(32, ...labels.map(value => ctx.measureText(labelValue(value)).width)));
    const left = Math.max(axisGutter, labelWidth + 10);
    const endpoints = levels.map(({ value, label }) => ({
      value, label: narrow ? label : label + '  ' + priceLabel(value), color: '#284867', stroke: '#688bb5'
    }));
    if (researchTarget) {
      const { value } = researchTarget;
      endpoints.push({ value, label: narrow ? 'Target' : 'Research target  ' + priceLabel(value),
        color: researchTargetColor, stroke: researchTargetColor });
      endpoints.sort((a, b) => b.value - a.value);
    }
    const labelRoom = endpoints.length ? Math.max(...endpoints.map(item => ctx.measureText(item.label).width)) + 13 : 0;
    const right = width - 12 - labelRoom, top = 11, bottom = height - 28;
    const historicalRight = cone || scenario ? (first === last ? left : right - (right - left) * .38) : right;
    const scenarioX = month => historicalRight + month / scenario.months * (right - historicalRight);
    const x = instant => first === last ? (left + historicalRight) / 2 : left + (instant - first) / (last - first) * (historicalRight - left);
    const y = value => bottom - (value - min) / (max - min) * (bottom - top);
    const tick = (x1, y1, x2, y2, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    if (scenario) {
      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(historicalRight, top, right - historicalRight, bottom - top);
      tick(historicalRight, top, historicalRight, bottom, '#a5b5ca');
    }
    ctx.fillStyle = '#4e6569';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    let previousLabel;
    labels.forEach(value => {
      const text = labelValue(value);
      if (text === previousLabel) return;
      tick(left, y(value), right, y(value), '#e1e9e8');
      ctx.fillText(text, left - 7, y(value));
      previousLabel = text;
    });
    const start = new Date(first), spacing = axis === 'quarter' ? 3 : 12;
    let month = Math.floor(start.getUTCMonth() / spacing) * spacing;
    const datesOnAxis = [];
    for (let instant = Date.UTC(start.getUTCFullYear(), month, 1); instant <= last;
      instant = Date.UTC(start.getUTCFullYear(), month += spacing, 1)) {
      if (instant >= first) datesOnAxis.push(instant);
    }
    if (axis === 'days') {
      datesOnAxis.length = 0;
      for (let instant = first; instant <= last; instant += Math.max(1, Math.ceil((last-first)/86400000/5))*86400000) {
        datesOnAxis.push(instant);
      }
    }
    if (!datesOnAxis.length) datesOnAxis.push(first);
    ctx.textAlign = 'center';
    const formatTick = instant => {
      if (axis === 'days') return dateFormat.format(instant).replace(/ \d{4}$/, '');
      return axis === 'year' && last - first > 365 * 86400000
        ? String(new Date(instant).getUTCFullYear()) : tickFormat.format(instant);
    };
    const ticks = narrow && last > first
      ? [first, ...datesOnAxis.filter(instant => instant > first && instant < last), last] : datesOnAxis;
    const lastLabelLeft = historicalRight - ctx.measureText(formatTick(last)).width;
    let endLabel = -Infinity;
    ticks.forEach((instant, i) => {
      const at = x(instant);
      if (!narrow) tick(at, bottom, at, bottom + 5, '#a6b8b5');
      const text = formatTick(instant);
      const half = ctx.measureText(text).width / 2;
      const center = Math.max(left + half, Math.min(historicalRight - half, at));
      if (narrow && i > 0 && instant !== last && center + half + 7 > lastLabelLeft) return;
      if (center - half < endLabel + 7) return;
      if (narrow) tick(at, bottom, at, bottom + 5, '#a6b8b5');
      ctx.fillText(text, center, height - 10);
      endLabel = center + half;
    });
    if (cursor >= from && cursor <= to && (!cone || cursor <= cone.anchor.index)) {
      tick(x(time(dates[cursor][2])), top, x(time(dates[cursor][2])), bottom, '#9aafad');
    }
    if (cone) {
      const futureX = month => historicalRight + month / 12 * (right - historicalRight);
      ctx.fillStyle = '#edf3fc';
      ctx.fillRect(historicalRight, top, right - historicalRight, bottom - top);
      tick(historicalRight, top, historicalRight, bottom, '#9fb7cf');
      function band(upper, lower, fill, stroke) {
        ctx.beginPath();
        for (let month = 0; month <= 12; month++) ctx.lineTo(futureX(month), y(cone.points[month][upper]));
        for (let month = 12; month >= 0; month--) ctx.lineTo(futureX(month), y(cone.points[month][lower]));
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (bands.includes(2)) band(0, 4, '#d9e5f7', '#688bb5');
      if (bands.includes(1)) band(1, 3, '#b8d0ed', '#446f9f');
      ctx.setLineDash([3, 3]);
      tick(historicalRight, y(cone.anchor.value), right, y(cone.anchor.value), '#2c597d');
      ctx.setLineDash([]);
      ctx.fillStyle = '#284867';
      ctx.textAlign = 'center';
      ctx.fillText('12 mo', right - 6, height - 10);
      if (right - historicalRight > 86) ctx.fillText('6 mo', futureX(6), height - 10);
    }
    for (const line of series) {
      const runs = [];
      for (const point of line.points) {
        const previous = runs.at(-1)?.at(-1);
        const adjacent = previous && (line.maxGapDays
          ? time(point.quote) - time(previous.quote) <= line.maxGapDays * 86400000
          : previous.index === point.index - 1);
        if (!adjacent) runs.push([]);
        runs.at(-1).push(point);
      }
      ctx.strokeStyle = ctx.fillStyle = line.color;
      ctx.lineWidth = 2.25;
      ctx.lineJoin = 'round';
      if (line.dash) ctx.setLineDash(line.dash);
      for (const run of runs) {
        const drawPath = () => run.forEach((point, i) => {
          const xy = [x(time(point.quote)), y(point.value)];
          if (i) ctx.lineTo(...xy); else ctx.moveTo(...xy);
        });
        if (line.area && run.length > 1) {
          ctx.beginPath();
          drawPath();
          ctx.lineTo(x(time(run.at(-1).quote)), y(0));
          ctx.lineTo(x(time(run[0].quote)), y(0));
          ctx.closePath();
          ctx.globalAlpha = 0.15;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        drawPath();
        ctx.stroke();
        for (const point of run) {
          if (line.connector || (run.length > 1 && point.index !== cursor)) continue;
          ctx.beginPath();
          ctx.arc(x(time(point.quote)), y(point.value), point.index === cursor ? 4 : 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (line.dash) ctx.setLineDash([]);
    }
    if (scenario) {
      for (const {color, points, test} of scenario.lines) {
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineWidth = 2.25;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        points.forEach(({month, value}, i) => {
          if (i) ctx.lineTo(scenarioX(month), y(value));
          else ctx.moveTo(scenarioX(month), y(value));
        });
        ctx.stroke();
        ctx.setLineDash([]);
        for (const point of [points[0], points.at(-1)]) {
          if (!point) continue;
          ctx.beginPath();
          ctx.arc(scenarioX(point.month), y(point.value), 3, 0, 2 * Math.PI);
          ctx.fill();
        }
        if (test) {
          ctx.beginPath();
          ctx.arc(scenarioX(test.month), y(test.value), 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#435b78';
      ctx.textAlign = 'right';
      if (right - historicalRight >= 68) ctx.fillText('Simulated', right - 8, top + 12);
      ctx.fillText('M' + scenario.months, right, height - 10);
      const midway = Math.floor(scenario.months / 2);
      if (midway && right - historicalRight >= 94) {
        ctx.textAlign = 'center';
        ctx.fillText('M' + midway, scenarioX(midway), height - 10);
      }
    }
    if (researchTarget) {
      ctx.setLineDash([6, 3]);
      tick(left, y(researchTarget.value), right, y(researchTarget.value), researchTargetColor);
      ctx.setLineDash([]);
    }
    ctx.textAlign = 'left';
    let labelY = top - 14;
    endpoints.forEach(({ value, label, color, stroke }, i) => {
      const spaced = Math.max(labelY + 14, Math.min(bottom - 14 * (endpoints.length - 1 - i), y(value)));
      tick(right, y(value), right + 7, spaced, stroke);
      ctx.fillStyle = color;
      ctx.fillText(label, right + 9, spaced);
      labelY = spaced;
    });
    return { forIndex: index => x(time(dates[index][2])), forValue: y, top, bottom, coneStart: cone || scenario ? historicalRight : Infinity };
  }

  function mountHistory(data, { saved, previousChart, changeRange, save, adjustments }) {
    const doc = root.document;
    const from = doc.getElementById('sb2-from'), to = doc.getElementById('sb2-to');
    const maximum = data.months.length - 1;
    let start = data.months.findIndex(([month]) => month === saved?.from);
    let end = data.months.findIndex(([month]) => month === saved?.to);
    if (start < 0) start = 0;
    if (end < 0) end = maximum;
    if (start > end) [start, end] = [0, maximum];
    const state = { from: start, to: end, cursor: end, axis: saved?.axis === 'quarter' ? 'quarter' : 'year' };
    const savedChart = saved?.chart ?? previousChart;
    const bands = allBands.filter(band => Array.isArray(savedChart?.bands) && savedChart.bands.includes(band));
    const chart = {
      metric: ['price', 'market_cap_usd_bn', 'dividend_yield_pct'].includes(savedChart?.metric) ? savedChart.metric : 'price',
      target: savedChart?.target === true,
      cone: savedChart?.cone === true,
      bands: bands.length ? bands : allBands,
      bosTarget: (savedChart?.bosTarget ?? savedChart?.cone) === true
    };
    const savedIndex = data.months.findIndex(([month]) => month === saved?.month);
    let selectedIndex;
    if (savedIndex >= 0) {
      selectedIndex = clampMonth(savedIndex);
      state.cursor = selectedIndex;
    }
    const cards = new Map();
    const choices = data.months.map(([month], i) => '<option value="' + i + '">' + monthLabel(month) + '</option>').join('');
    from.innerHTML = to.innerHTML = choices;
    syncRange();
    let frame, targets, targetRequest, targetError;
    function getTargets() {
      targetRequest ??= (async () => {
        const embedded = doc.getElementById('sb2-embedded-targets');
        if (embedded) return JSON.parse(embedded.textContent);
        const response = await fetch('data/stocks-beta2-morningstar.json?v=20261121.2', { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('Morningstar data unavailable');
        return response.json();
      })().catch(error => { targetRequest = undefined; throw error; });
      return targetRequest;
    }
    async function loadTargets() {
      targetError = '';
      try { targets = await getTargets(); }
      catch { targetError = 'Fair values could not load. Toggle off and on to retry.'; }
      repaint();
    }
    if (chart.target) loadTargets();

    const toolbar = doc.getElementById('sb2-shared-controls');
    function syncChartControls() {
      for (const button of toolbar.querySelectorAll('[data-metric]')) {
        button.setAttribute('aria-pressed', String(button.dataset.metric === chart.metric));
      }
      const price = chart.metric === 'price';
      for (const [selector, enabled] of [['[data-target]', chart.target], ['[data-cone]', chart.cone], ['[data-bos-target]', chart.bosTarget]]) {
        toolbar.querySelector(selector).setAttribute('aria-pressed', String(price && enabled));
      }
      toolbar.querySelector('[data-cone-bands]').hidden = !(price && chart.cone);
      for (const button of toolbar.querySelectorAll('[data-cone-band]')) {
        button.setAttribute('aria-pressed', String(chart.bands.includes(Number(button.dataset.coneBand))));
      }
    }
    function updateChart() {
      syncChartControls();
      repaint();
      save();
    }

    toolbar.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
      chart.metric = button.dataset.metric;
      updateChart();
    }));
    const coneButton = toolbar.querySelector('[data-cone]');
    coneButton.addEventListener('click', () => {
      chart.cone = chart.metric !== 'price' || !chart.cone;
      if (chart.cone) chart.metric = 'price';
      updateChart();
    });
    toolbar.querySelectorAll('[data-cone-band]').forEach(button => button.addEventListener('click', () => {
      const band = Number(button.dataset.coneBand);
      chart.bands = chart.bands.includes(band) ? chart.bands.filter(value => value !== band) : [...chart.bands, band];
      if (!chart.bands.length) {
        chart.cone = false;
        chart.bands = allBands;
        coneButton.focus();
      }
      updateChart();
    }));
    toolbar.querySelector('[data-bos-target]').addEventListener('click', () => {
      chart.bosTarget = chart.metric !== 'price' || !chart.bosTarget;
      if (chart.bosTarget) chart.metric = 'price';
      updateChart();
    });
    toolbar.querySelector('[data-target]').addEventListener('click', () => {
      chart.target = chart.metric !== 'price' || !chart.target;
      if (chart.target) {
        chart.metric = 'price';
        if (!targets) loadTargets();
      }
      updateChart();
    });
    syncChartControls();

    function repaint() {
      if (frame !== undefined) return;
      frame = root.requestAnimationFrame(() => { frame = undefined; cards.forEach(drawCard); });
    }
    function clampMonth(index) {
      return Math.min(state.to, Math.max(state.from, index));
    }
    function setCursor(value, remember = false) {
      const next = clampMonth(value);
      // Chart hover previews a month without replacing the last selection.
      if (remember && next !== selectedIndex) {
        selectedIndex = next;
        save();
      }
      if (next === state.cursor) return;
      state.cursor = next;
      repaint();
    }
    function drawCard(card) {
      const { element, history } = card;
      const { company } = history;
      const { data: chartData } = history;
      const { metric } = chart;
      const get = selector => element.querySelector(selector);
      const metricIndex = data.metrics.findIndex(item => item[0] === metric);
      const [, label, rawUnit] = data.metrics[metricIndex];
      const marketCap = metric === 'market_cap_usd_bn' && figures
        ? (card.marketCap ??= figures.marketCap(company.observations.map(point => point[metricIndex + 1]))) : null;
      const unit = marketCap?.unit || (rawUnit === 'quote' ? company.currency : rawUnit);
      const showValue = marketCap?.show || (rawUnit === 'quote' ? figures?.quote : figures?.number) || (value => numbers.format(value));
      const { from, to, cursor } = state;
      const prior = historyPoints(chartData, company, metric, from, to);
      const anchor = prior.findLast(point => point.value > 0);
      const activeCone = metric === 'price' && chart.cone;
      if (activeCone && anchor && card.coneAnchor !== anchor.index) {
        card.coneAnchor = anchor.index;
        card.projection = probabilityCone(chartData, company, anchor);
      }
      const projection = activeCone && anchor ? card.projection : null;
      const cone = projection?.points ? projection : null;
      const targetEnabled = metric === 'price' && chart.bosTarget;
      const researchTarget = targetEnabled ? card.researchTarget : null;
      const availableTargets = chart.target ? targets?.[company.ticker] : undefined;
      if (availableTargets !== card.availableTargets) {
        card.availableTargets = availableTargets;
        card.fairValues = history.fairValues(availableTargets);
        card.archiveChart.setFairValues(card.fairValues);
      }
      const targetRows = metric === 'price' ? card.fairValues ?? [] : [];
      const targetLines = Object.entries(targetColors).map(([rating, color]) => ({
        name: rating, color, points: targetRows.filter(row => row.index >= from && row.index <= (cone?.anchor.index ?? to) && row.rating === rating)
      }));
      const ratios = ['forward_pe', 'forward_pb'].map((key, i) => ({
        name: ['P/E', 'P/B'][i], color: ratioColors[i], points: historyPoints(chartData, company, key, from, to)
      }));
      const primary = [{name: label, color: priceColor, points: cone ? prior.filter(point => point.index <= anchor.index) : prior,
        area: Boolean(metric === 'price' && chart.target && !cone)}, ...targetLines];
      get('.sb2-chart-window').textContent = label + ' (' + unit + ') · ' + monthLabel(data.months[from][0]) + ' to '
        + monthLabel(data.months[to][0]) + ' · ' + prior.length + ' of ' + (to - from + 1) + ' editions'
        + (metric === 'price' ? (history.splits.length ? ' · Split-adjusted BOS prices' : ' · BOS prices') : '');
      const priceDate = chartData.months[cursor][2];
      const bosDate = data.months[cursor][2];
      const quote = dateFormat.format(time(priceDate));
      const setText = (selector, text) => {
        const field = get(selector);
        if (field.textContent !== text) field.textContent = text;
      };
      function show(kind, lines, description, options) {
        const canvas = get('[data-' + kind + '-chart]');
        const available = Boolean(options?.researchTarget) || lines.some(line => line.points.length);
        canvas.closest('figure').hidden = !available;
        get('[data-' + kind + '-empty]').hidden = available;
        canvas.setAttribute('aria-label', company.name + ' ' + description);
        card.positions[kind] = available ? drawPlot(canvas, lines, chartData.months, state, options) : null;
      }
      show('price', primary, label + ' by price date'
        + (targetRows.length ? ' with Morningstar fair value' : '')
        + (cone ? ' and a 12-month cone with ' + chart.bands.map(band => '±' + band + ' SD').join(' and ') : '')
        + (researchTarget ? ' and a research target at ' + numbers.format(researchTarget.value) + ' ' + unit : ''),
      { cone, bands: chart.bands, researchTarget, isPrice: metric === 'price', formatAxis: marketCap?.show });
      show('valuation', ratios, 'forward P/E and P/B by price date');
      const dateField = get('[data-price-date]');
      if (dateField.dateTime !== priceDate) dateField.dateTime = priceDate;
      dateField.title = priceDate === bosDate ? 'BOS price date' : 'Verified trading date. BOS price date was ' + dateFormat.format(time(bosDate)) + '.';
      setText('[data-price-date]', quote);
      const point = prior.find(item => item.index === cursor);
      setText('[data-price-reading]', point ? label + ' ' + showValue(point.value) + ' ' + unit : 'No observation');
      const analyst = targetRows.find(row => row.index === cursor && cursor <= (cone?.anchor.index ?? to));
      const call = get('[data-analyst-reading]');
      call.hidden = !analyst;
      if (analyst) {
        call.dataset.rating = analyst.rating;
        setText('[data-analyst-call]', analyst.rating);
        setText('[data-analyst-value]', numbers.format(analyst.value) + ' ' + company.currency);
        const analystGap = targetGapLabel(point?.value, analyst.value);
        const analystGapField = get('[data-analyst-gap]');
        analystGapField.hidden = !analystGap;
        analystGapField.classList.toggle('positive', !!analystGap && analyst.value > point.value);
        analystGapField.classList.toggle('negative', !!analystGap && analyst.value < point.value);
        setText('[data-analyst-gap]', analystGap);
      }
      const latestTarget = metric === 'price' ? card.researchTarget : null;
      const gapField = get('[data-bos-target-gap]');
      gapField.hidden = !latestTarget;
      if (latestTarget) {
        const targetPrice = numbers.format(latestTarget.value) + ' ' + company.currency;
        const gap = targetGapLabel(point?.value, latestTarget.value, 'At target');
        setText('[data-bos-target-text]', 'Latest BOS target ' + targetPrice + (gap ? ' · ' + gap : ''));
        gapField.title = latestTarget.provider || '';
        const targetDate = time(latestTarget.date);
        const report = get('[data-bos-target-report]');
        report.hidden = !Number.isFinite(targetDate);
        if (!report.hidden) {
          const reportLabel = dateFormat.format(targetDate);
          const reportTime = get('[data-bos-target-date]');
          if (reportTime.dateTime !== latestTarget.date) reportTime.dateTime = latestTarget.date;
          setText('[data-bos-target-date]', reportLabel);
          const reportLink = get('[data-bos-target-source]');
          if (latestTarget.source) {
            if (reportLink.href !== latestTarget.source) reportLink.href = latestTarget.source;
            reportLink.setAttribute('aria-label', reportLabel + ' · ' + company.name + ' research report (PDF, new tab)');
          } else {
            reportLink.removeAttribute('href');
            reportLink.removeAttribute('aria-label');
          }
        }
      }
      const valuations = ratios.flatMap(line => {
        const ratio = line.points.find(item => item.index === cursor);
        return ratio ? [line.name + ' ' + (figures?.number(ratio.value) || numbers.format(ratio.value)) + ' ×'] : [];
      });
      setText('[data-valuation-value]', quote + ' · ' + (valuations.join(' · ') || 'No observation'));
      const slider = get('[data-sb2-month]');
      slider.min = String(from);
      slider.max = String(to);
      slider.value = String(cursor);
      slider.setAttribute('aria-valuetext', monthLabel(data.months[cursor][0]));
      get('.sb2-target-legend').hidden = !(metric === 'price' && chart.target);
      get('[data-target-status]').textContent = chart.target && metric === 'price'
        ? targetError || (!targets ? 'Loading Morningstar fair values…'
          : targetLines.some(line => line.points.length) ? '' : 'No identified Morningstar fair values in this range.') : '';
      get('.sb2-cone-info').hidden = !activeCone;
      get('[data-cone-method]').hidden = !activeCone;
      const summary = !activeCone ? '' : cone
        ? '12 months from ' + dateFormat.format(time(anchor.quote)) + ' · ' + unit + ' · '
          + cone.count + ' monthly returns' + (cone.splits ? ' · ' + cone.splits + ' split-like move' + (cone.splits === 1 ? '' : 's') + ' skipped' : '')
        : 'Cone unavailable · ' + (anchor ? projection.count + ' usable monthly returns. At least 12 are needed.' : 'No positive price in this range.');
      if (get('[data-cone-summary]').textContent !== summary) get('[data-cone-summary]').textContent = summary;
      get('[data-cone-levels]').textContent = coneLevels(cone, chart.bands)
        .map(({ value, label }) => label + ' ' + priceLabel(value)).join(' · ');
      const note = get('[data-bos-target-note]');
      note.toggleAttribute('data-line', Boolean(researchTarget));
      let targetNote = '';
      if (researchTarget) {
        const bandNote = cone && chart.bands.length === allBands.length
          ? ' · ' + targetBand(researchTarget.value, cone.points.at(-1)) + ' at 12 months' : '';
        targetNote = 'Research target ' + numbers.format(researchTarget.value) + ' ' + unit
          + ' · BOS coverage · ' + researchTarget.provider + ' · ' + dateFormat.format(time(researchTarget.date))
          + (researchTarget.date > (anchor?.quote ?? data.months[to][2]) ? ' (after last price date)' : '') + bandNote;
      } else if (targetEnabled) {
        targetNote = card.researchTargetFailed ? 'Research target could not load. Retry in Quick data.'
          : card.researchTarget === undefined
          ? 'Loading research target…' : 'No research target in the listing currency.';
      }
      if (note.textContent !== targetNote) note.textContent = targetNote;
    }
    function syncRange() {
      from.value = String(state.from);
      to.value = String(state.to);
      [...from.options].forEach(option => { option.disabled = Number(option.value) > state.to; });
      [...to.options].forEach(option => { option.disabled = Number(option.value) < state.from; });
    }
    function updateRange() {
      state.from = Number(from.value);
      state.to = Number(to.value);
      if (selectedIndex !== undefined) selectedIndex = clampMonth(selectedIndex);
      state.cursor = selectedIndex ?? clampMonth(state.cursor);
      syncRange();
      changeRange(state);
      save();
      repaint();
    }
    from.addEventListener('change', updateRange);
    to.addEventListener('change', updateRange);
    doc.getElementById('sb2-all-dates').addEventListener('click', () => {
      from.value = '0';
      to.value = String(maximum);
      selectedIndex = undefined;
      state.cursor = maximum;
      updateRange();
    });
    const axisButtons = [...doc.querySelectorAll('[data-axis]')];
    function syncAxis() {
      axisButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.axis === state.axis)));
    }
    syncAxis();
    axisButtons.forEach(button => button.addEventListener('click', () => {
      state.axis = button.dataset.axis;
      syncAxis();
      save();
      repaint();
    }));
    const resize = new ResizeObserver(repaint);
    function add(element, company) {
      const archiveChart = mountPriceArchive(element, company);
      const card = { element, company, archiveChart, history: chartHistory(data, company, adjustments), positions: {} };
      cards.set(element, card);
      const slider = element.querySelector('[data-sb2-month]');
      slider.addEventListener('input', () => setCursor(Number(slider.value), true));
      for (const kind of ['price', 'valuation']) {
        const canvas = element.querySelector('[data-' + kind + '-chart]');
        const inspect = event => {
          const position = card.positions[kind];
          if (!position) return;
          const x = event.clientX - canvas.getBoundingClientRect().left;
          if (x > position.coneStart) return;
          let nearest = state.from;
          for (let index = state.from + 1; index <= state.to; index++) {
            if (Math.abs(position.forIndex(index) - x) < Math.abs(position.forIndex(nearest) - x)) nearest = index;
          }
          setCursor(nearest, event.type === 'click');
        };
        resize.observe(canvas);
        canvas.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') inspect(event); });
        canvas.addEventListener('click', inspect);
        canvas.addEventListener('keydown', event => {
          const value = {ArrowLeft: state.cursor - 1, ArrowRight: state.cursor + 1, Home: state.from, End: state.to}[event.key];
          if (value === undefined) return;
          event.preventDefault();
          setCursor(value, true);
        });
      }
      resize.observe(element);
      return archiveChart;
    }
    function settings() {
      const { from, to, axis } = state;
      const result = { axis, chart: { ...chart } };
      if (from !== 0 || to !== maximum) {
        result.from = data.months[from][0];
        result.to = data.months[to][0];
      }
      if (selectedIndex !== undefined) result.month = data.months[selectedIndex][0];
      return result;
    }
    function setResearchTarget(element, brief) {
      const card = cards.get(element);
      if (!card) return;
      card.researchTarget = researchConeTarget(brief, card.company.currency);
      card.researchTargetFailed = brief === null;
      if (chart.metric === 'price') repaint();
    }
    return { add, settings, chartSettings: () => chart, setResearchTarget, range: () => state,
      remove(element) {
        element.querySelectorAll('canvas').forEach(canvas => resize.unobserve(canvas));
        resize.unobserve(element);
        cards.delete(element);
      } };
  }

  function mountRankings(data, { logo, chooseCompany, saved, save }) {
    const doc = root.document;
    const get = id => doc.getElementById(id);
    const peerMonth = get('sb2-peer-month');
    const peerYear = get('sb2-peer-year');
    const peerMarket = get('sb2-peer-market');
    const direction = get('sb2-peer-direction');
    const play = get('sb2-play');
    const previous = get('sb2-prev');
    const next = get('sb2-next');
    const bars = get('sb2-pe-bars');
    const last = data.months.length - 1;
    let timer;

    peerMonth.max = String(last);
    const savedIndex = data.months.findIndex(([month]) => month === saved?.month);
    peerMonth.value = String(savedIndex < 0 ? last : savedIndex);
    peerMarket.value = ['all', 'usa', 'world'].includes(saved?.market)
      ? saved.market : root.matchMedia('(max-width:760px)').matches ? 'usa' : 'all';
    direction.value = saved?.direction === 'high' ? 'high' : 'low';
    const years = data.months.flatMap(([month], index) => (
      !index || month.slice(0, 4) !== data.months[index - 1][0].slice(0, 4) ? [[month.slice(0, 4), index]] : []
    ));
    peerYear.innerHTML = years.map(([year, index]) => '<option value="' + index + '">' + year + '</option>').join('');
    const tickStyle = index => ' style="--tick:' + 100 * index / Math.max(1, last) + '%"';
    const quarters = data.months.flatMap(([month], index) => (
      index && ['04', '07', '10'].includes(month.slice(5)) ? ['<i' + tickStyle(index) + '></i>'] : []
    ));
    get('sb2-year-axis').innerHTML = years.map(([year, index]) =>
      '<span' + tickStyle(index) + '>' + year + '</span>'
    ).concat(quarters).join('');
    get('sb2-pe-rankings').hidden = false;

    function renderBars() {
      const index = Number(peerMonth.value);
      const [month, report] = data.months[index];
      const markets = [['usa', 'USA (NYSE and Nasdaq)'], ['world', 'Rest of world']]
        .filter(([id]) => peerMarket.value === 'all' || id === peerMarket.value)
        .map(([id, label]) => ({
        label, results: peRankings(data, index, id),
        prior: index ? peRankings(data, index - 1, id) : { high: [], low: [] }
      }));
      get('sb2-peer-label').textContent = monthLabel(month);
      peerMonth.setAttribute('aria-valuetext', monthLabel(month));
      peerYear.value = String(years.find(([year]) => year === month.slice(0, 4))[1]);
      previous.disabled = index === 0;
      next.disabled = index === last;
      get('sb2-peer-status').textContent = dateFormat.format(time(report))
        + ' edition · Eligible companies by listing market';
      function panel({label, results, prior}, type) {
        const rows = results[type], before = prior[type];
        const direction = type === 'low' ? 'lowest' : 'highest';
        const heading = '<section class="sb2-bar-panel sb2-bar-' + type + '"><h3>'
          + label + ' · ' + rows.length + ' ' + direction + ' forward P/E</h3>';
        if (!rows.length) return heading + '<p>No eligible listings in this edition.</p></section>';
        const beforeIds = new Set(before.map(row => row.company.logo));
        const currentIds = new Set(rows.map(row => row.company.logo));
        const entered = index ? rows.filter(row => !beforeIds.has(row.company.logo)) : [];
        const left = before.filter(row => !currentIds.has(row.company.logo));
        const enteredIds = new Set(entered.map(row => row.company.logo));
        const names = items => items.map(row => e(row.company.name)).join(', ') || 'None';
        const max = Math.max(...rows.map(row => row.value));
        const step = niceStep(max, 2);
        const ceiling = Math.ceil(max / step) * step;
        return heading
          + (index ? '<p class="sb2-rank-changes"><b>Entered</b> ' + names(entered)
            + '<br><b>Left</b> ' + names(left) + '</p>'
            : '<p class="sb2-rank-changes">First saved edition</p>')
          + '<div class="sb2-bar-axis"><span>0×</span><span>' + compact.format(ceiling / 2)
          + '×</span><span>' + compact.format(ceiling) + '×</span></div>'
          + '<ol class="sb2-pe-bars-list">' + rows.map(({ company, value }, i) => (
            '<li><button class="sb2-pe-bar" type="button" data-pe-company="' + e(company.ticker) + '"'
            + ' aria-label="View ' + e(company.name + ', ' + company.ticker + ', ' + numbers.format(value) + ' times forward P/E')
            + '" style="--bar-width:' + (100 * value / ceiling).toFixed(3) + '%">'
            + '<span class="sb2-rank" aria-hidden="true">' + (i + 1) + '</span>'
            + '<span class="sb2-bar-icon" aria-hidden="true">' + logo(company, 24) + '</span>'
            + '<span class="sb2-bar-name">' + e(company.name)
            + (enteredIds.has(company.logo) ? ' <small class="sb2-entry-label">Entered</small>' : '') + '</span>'
            + '<span class="sb2-bar-value">' + numbers.format(value) + '×</span>'
            + '<span class="sb2-bar-track" aria-hidden="true"><i></i></span></button></li>'
          )).join('') + '</ol></section>';
      }
      const rendered = markets.map(market => panel(market, direction.value)).join('');
      bars.innerHTML = markets.length > 1 ? '<div class="sb2-market-pair">' + rendered + '</div>' : rendered;
    }

    function stop() {
      clearInterval(timer);
      timer = undefined;
      play.textContent = 'Play months';
    }

    function showMonth(index) {
      peerMonth.value = String(index);
      updateRankings();
    }

    function updateRankings() {
      renderBars();
      save();
    }

    peerMonth.addEventListener('input', () => { stop(); updateRankings(); });
    peerYear.addEventListener('change', () => { stop(); showMonth(Number(peerYear.value)); });
    peerMarket.addEventListener('change', updateRankings);
    direction.addEventListener('change', updateRankings);
    previous.addEventListener('click', () => { stop(); showMonth(Number(peerMonth.value) - 1); });
    next.addEventListener('click', () => { stop(); showMonth(Number(peerMonth.value) + 1); });
    play.addEventListener('click', () => {
      if (timer !== undefined) { stop(); return; }
      if (Number(peerMonth.value) === last) showMonth(0);
      play.textContent = 'Pause';
      timer = setInterval(() => {
        showMonth(Number(peerMonth.value) + 1);
        if (Number(peerMonth.value) === last) stop();
      }, 1400);
    });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });
    bars.addEventListener('click', event => {
      const target = event.target.closest('[data-pe-company]');
      if (target) { stop(); chooseCompany(target.dataset.peCompany, target); }
    });
    renderBars();
    return { renderBars, settings: () => ({ month: data.months[Number(peerMonth.value)][0], market: peerMarket.value, direction: direction.value }) };
  }

  function fairValuesForArchive(record, values) {
    if (!record || !values?.length) return [];
    const sessions = new Map(record.closes.map(([day, price], index) => [day, { price, index }]));
    return values.flatMap(point => {
      const close = sessions.get(point.quote);
      // Some providers also adjust for distributions. Compare only on a verified common basis.
      if (!close || Math.abs((close.price - point.price) * point.divisor) >= .005 || !Number.isFinite(point.price)) return [];
      return [{ ...point, index: close.index }];
    });
  }

  function mountPriceArchive(element, company) {
    const panel = element.querySelector('[data-sb2-price-archive]');
    const canvas = panel.querySelector('canvas'), slider = panel.querySelector('input');
    const rangeLabel = panel.querySelector('[data-archive-range]');
    const closeLabel = panel.querySelector('[data-archive-close]');
    const priorLabel = panel.querySelector('[data-archive-prior]');
    const fairValueLegend = panel.querySelector('[data-archive-fair-values]');
    const buttons = [...panel.querySelectorAll('[data-archive-years]')];
    let record, dates, lines, from, to, fairValues, matched = [], years = 20;

    function paint() {
      if (!record || !panel.open || !dates) return;
      const cursor = Number(slider.value);
      const [day, value] = record.closes[cursor];
      const source = record.prior && day < record.prior.before ? ` · ${record.prior.label}` : '';
      const reading = `${dateFormat.format(time(day))} · ${numbers.format(value)} ${record.currency}${source}`;
      closeLabel.value = reading;
      slider.setAttribute('aria-valuetext', reading);
      const visible = matched.filter(point => point.index >= from && point.index <= to);
      fairValueLegend.hidden = !visible.length;
      const overlays = Object.entries(targetColors).map(([rating, color]) => ({
        color, points: visible.filter(point => point.rating === rating), maxGapDays: 45
      }));
      drawPlot(canvas, [...lines, ...overlays], dates, { from, to, cursor, axis: 'year' }, { isPrice: true });
    }

    function buildRange() {
      if (!record || !panel.open) return;
      const { closes, currency, prior } = record;
      to = closes.length - 1;
      const end = new Date(time(closes[to][0]));
      const year = end.getUTCFullYear() - years, month = end.getUTCMonth();
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const cutoff = new Date(Date.UTC(year, month, Math.min(end.getUTCDate(), lastDay))).toISOString().slice(0, 10);
      from = Math.max(0, closes.findLastIndex(([day]) => day <= cutoff));
      dates = closes.map(([day]) => [null, null, day]);
      const earlier = [], current = [];
      for (let index = from; index <= to; index++) {
        const [quote, value] = closes[index];
        (prior && quote < prior.before ? earlier : current).push({ index, quote, value });
      }
      lines = [{ color: '#6a8396', points: earlier, maxGapDays: 14 },
        { color: priceColor, points: current, maxGapDays: 14 }].filter(line => line.points.length);
      slider.max = String(to);
      slider.min = String(from);
      slider.value = String(to);
      slider.disabled = from === to;
      const span = `${dateFormat.format(time(closes[from][0]))} to ${dateFormat.format(time(closes[to][0]))}`;
      rangeLabel.textContent = `${currency} · Yahoo Finance Close (same source as the 20-year workbook) · ${span}`;
      canvas.setAttribute('aria-label', `${company.name} daily closing prices in ${currency} from ${span}`);
      priorLabel.hidden = !earlier.length;
      priorLabel.textContent = earlier.length ? `Earlier series in grey · ${prior.label}` : '';
      paint();
    }

    function refresh() {
      const next = root.StockPriceArchive?.byListing(company.ticker, company.currency);
      if (next === record) return;
      const opening = !record && next;
      record = next;
      panel.hidden = !record;
      if (opening) panel.open = true;
      dates = lines = undefined;
      matched = fairValuesForArchive(record, fairValues);
      buildRange();
    }

    const resize = new ResizeObserver(paint);
    resize.observe(canvas);
    panel.addEventListener('toggle', buildRange);
    slider.addEventListener('input', paint);
    for (const button of buttons) button.addEventListener('click', () => {
      years = Number(button.dataset.archiveYears);
      for (const option of buttons) option.setAttribute('aria-pressed', String(option === button));
      buildRange();
    });
    refresh();
    return {
      refresh,
      setFairValues(next) {
        fairValues = next;
        matched = fairValuesForArchive(record, fairValues);
        paint();
      },
      remove: () => resize.disconnect()
    };
  }

  const api = { chartHistory, fairValuesForArchive, historyPoints, peRankings, mountRankings, mountHistory, mountPriceArchive, priceLabel, probabilityCone, researchConeTarget, targetBand, drawPlot };
  if (typeof module !== 'undefined') module.exports = api;
  root.StocksBeta2Charts = api;
})(typeof window !== 'undefined' ? window : globalThis);
