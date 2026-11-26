(function () {
  'use strict';

  const horizons = [1, 5, 20, 60];
  const ageLimits = { Daily: 4, Weekly: 8, Monthly: 35 };
  const minimumHorizon = { Daily: 1, Weekly: 5, Monthly: 60 };
  const colors = ['#17715f', '#af681b', '#305cb6', '#a24973', '#5950a1', '#45654e'];
  const oneDay = 86400000;
  const timestamp = value => Date.parse(value + 'T00:00:00Z');
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fullDateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const day = (value, full = false) => (full ? fullDateFormat : dateFormat).format(timestamp(value));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function indexAt(points, date, strict = false) {
    let low = 0;
    let high = points.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid][0] < date || (!strict && points[mid][0] === date)) low = mid + 1;
      else high = mid;
    }
    return low - 1;
  }

  function computeMove(series, baseline, horizon) {
    return series.unit === 'bp' ? horizon - baseline : (horizon / baseline - 1) * 100;
  }

  function closest(points, date, frequency, strict = false) {
    const row = points[indexAt(points, date, strict)];
    const valid = row && (timestamp(date) - timestamp(row[0])) / oneDay <= ageLimits[frequency];
    return valid ? row : null;
  }

  function comparison(series, reaction, cutoff, horizon) {
    if (!cutoff) return null;
    for (const candidate of [series, ...(series.alternates || [])]) {
      const { frequency, points } = candidate;
      if (horizon < minimumHorizon[frequency]) continue;
      const from = closest(points, reaction, frequency, true);
      const to = closest(points, cutoff, frequency);
      if (!from || !to || to[0] < reaction || (series.unit !== 'bp' && from[1] <= 0)) continue;
      const value = computeMove(series, from[1], to[1]);
      if (Number.isFinite(value)) return { from, to, frequency, points, value };
    }
    return null;
  }

  function number(value, unit) {
    const digits = unit === 'bp' ? 0 : 2;
    const rounded = Math.abs(value).toFixed(digits);
    const sign = Number(rounded) === 0 ? '' : value > 0 ? '+' : '−';
    return sign + rounded + (unit === 'bp' ? ' bp' : '%');
  }

  if (typeof module !== 'undefined') module.exports = { comparison, indexAt, number };
  if (typeof document === 'undefined') return;

  const nodes = {
    event: document.getElementById('event-select'),
    older: document.getElementById('older-event'),
    newer: document.getElementById('newer-event'),
    chartTitle: document.getElementById('chart-title'),
    chartDates: document.getElementById('chart-dates'),
    figure: document.getElementById('reaction-figure'),
    legend: document.getElementById('chart-legend'),
    clear: document.getElementById('clear-focus'),
    status: document.getElementById('load-status'),
    replay: document.getElementById('replay')
  };
  const events = window.CrossMarketBeta2Events || [];
  const state = {
    event: events[0], horizon: 5, group: 'prices', focus: null,
    sort: { market: { horizon: 0, descending: false }, sectors: { horizon: 5, descending: true }, shares: { horizon: 5, descending: true } }
  };
  let data;
  let sessions = [];
  let after = [];

  function reactionDate() {
    return state.event.reactionDate || state.event.date;
  }

  function selectEvent(event, updateUrl = true) {
    state.event = event;
    const index = events.indexOf(event);
    const reaction = reactionDate();
    nodes.event.value = event.date;
    nodes.older.disabled = index === events.length - 1;
    nodes.newer.disabled = index === 0;
    document.getElementById('event-meta').innerHTML = '<span>' + day(event.date, true) +
      '</span><span>' + escape(event.category) + '</span>' +
      (reaction === event.date ? '' : '<span>Reaction from ' + day(reaction, true) + '</span>');
    document.getElementById('event-title').textContent = event.title;
    document.getElementById('event-summary').textContent = event.summary;
    const source = document.createElement('a');
    source.href = event.source;
    source.textContent = event.sourceLabel;
    document.getElementById('event-source').replaceChildren('Selected event source · ', source);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('event', event.date);
      history.replaceState(null, '', url);
    }
    render();
  }

  function tableSeries(kind) {
    if (kind === 'sectors') return data.sectors;
    if (kind === 'shares') return data.shares;
    return data.market;
  }

  const tableConfig = {
    market: { id: 'market-table', label: 'Market', title: 'Market moves' },
    sectors: { id: 'sector-table', label: 'Sector', title: 'US sector proxies' },
    shares: { id: 'share-table', label: 'Share', title: 'Watchlist shares' }
  };

  function renderTable(kind) {
    const config = tableConfig[kind];
    const destination = document.getElementById(config.id);
    const sort = state.sort[kind];
    const rows = tableSeries(kind).map(series => ({
      series,
      matches: horizons.map(horizon => comparison(series, reactionDate(), after[horizon - 1], horizon))
    }));
    if (!rows.length) {
      destination.innerHTML = '<p class="empty">Price data unavailable.</p>';
      return;
    }
    if (sort.horizon) {
      const index = horizons.indexOf(sort.horizon);
      rows.sort((a, b) => {
        const av = a.matches[index]?.value;
        const bv = b.matches[index]?.value;
        if (av == null || bv == null) return av == null ? Number(bv != null) : -1;
        return (av - bv) * (sort.descending ? -1 : 1);
      });
    }
    const columns = horizons.map(horizon => {
      const active = sort.horizon === horizon;
      const label = horizon + (horizon === 1 ? ' session' : ' sessions');
      const ariaSort = active ? ' aria-sort="' + (sort.descending ? 'descending' : 'ascending') + '"' : '';
      const title = after[horizon - 1] ? ' title="Through ' + day(after[horizon - 1], true) + '"' : '';
      const icon = active ? '<span class="sort-indicator" aria-hidden="true">' + (sort.descending ? '↓' : '↑') + '</span>' : '';
      return kind === 'market' ? '<th scope="col"' + title + '>' + label + '</th>' :
        '<th scope="col"' + ariaSort + '><button type="button" data-sort="' + horizon + '"' + title + '>' + label + icon + '</button></th>';
    }).join('');
    const body = rows.map(({ series, matches }) => {
      const hasData = series.points.length || series.alternates?.some(entry => entry.points.length);
      const unit = series.currency || (series.unit === 'bp' ? 'bp' : '');
      const title = series.description ? ' title="' + escape(series.description) + '"' : '';
      const label = hasData
        ? '<button class="series-pick" type="button" data-series="' + escape(series.id) + '" aria-label="Chart ' + escape(series.label) + '">' + escape(series.label) + '</button>'
        : escape(series.label);
      const tag = unit ? '<span class="symbol">' + escape(unit) + '</span>' : '';
      const cells = matches.map((match, index) => {
        if (!match) {
          const pending = hasData && sessions.length && !after[horizons[index] - 1];
          return pending ? '<td class="unavailable">Pending</td>' : '<td class="unavailable" aria-label="No comparable observation">—</td>';
        }
        const value = number(match.value, series.unit);
        const description = value + ', ' + match.frequency.toLowerCase() + ', ' + day(match.from[0], true) + ' to ' + day(match.to[0], true);
        const basis = match.frequency === 'Daily' ? '' : '<span class="basis" aria-hidden="true">' + match.frequency[0] + '</span>';
        return '<td class="numeric ' + (match.value > 0 ? 'up' : match.value < 0 ? 'down' : '') +
          '" title="' + description + '" aria-label="' + description + '">' + value + basis + '</td>';
      }).join('');
      return '<tr><th scope="row"' + title + '>' + label + tag + '</th>' + cells + '</tr>';
    }).join('');
    destination.innerHTML = '<div class="table-scroll" tabindex="0" role="region" aria-label="' + config.title +
      '"><table class="return-table"><thead><tr><th scope="col">' + config.label + '</th>' +
      columns + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function chartSeries(cutoff) {
    if (state.focus) return [state.focus];
    if (state.group === 'prices') return data.market.filter(series => series.unit === 'percent');
    if (state.group === 'yields') return data.market.filter(series => series.unit === 'bp');
    return tableSeries(state.group)
      .map(series => ({ series, move: comparison(series, reactionDate(), cutoff, state.horizon) }))
      .filter(entry => entry.move)
      .sort((a, b) => Math.abs(b.move.value) - Math.abs(a.move.value))
      .slice(0, 5)
      .map(entry => entry.series);
  }

  function steps(min, max, unit) {
    const spacing = Math.max((max - min) / 4, unit === 'bp' ? 1 : 0.1);
    const base = 10 ** Math.floor(Math.log10(spacing));
    const step = base * [1, 2, 2.5, 5, 10].find(value => value >= spacing / base);
    return Array.from({ length: Math.round((Math.ceil(max / step) - Math.floor(min / step))) + 1 },
      (_, index) => (Math.floor(min / step) + index) * step);
  }

  function drawPlot(lines, cutoff, reaction) {
    const width = Math.max(nodes.figure.clientWidth, 280);
    const height = nodes.figure.querySelector('svg')?.clientHeight || (width < 690 ? 225 : 260);
    const bound = { left: 64, right: width - 25, top: 25, bottom: height - 35 };
    const start = Math.min(...lines.map(line => timestamp(line.match.from[0])));
    const end = timestamp(cutoff);
    const unit = lines[0].series.unit;
    const values = lines.flatMap(line => line.points.map(point => point[1]));
    const labels = steps(Math.min(0, ...values), Math.max(0, ...values), unit);
    if (labels.length === 1) labels.push(unit === 'bp' ? 1 : 0.1);
    const floor = labels[0];
    const ceiling = labels.at(-1);
    const x = time => bound.left + (time - start) / (end - start) * (bound.right - bound.left);
    const y = value => bound.bottom - (value - floor) / (ceiling - floor) * (bound.bottom - bound.top);
    const grid = labels.map(value => {
      const coord = y(value).toFixed(1);
      const label = unit === 'bp' ? Math.round(value) + ' bp' : value.toFixed(Math.abs(value % 1) > 1e-9 ? 1 : 0) + '%';
      return '<line class="' + (value === 0 ? 'plot-zero' : 'plot-grid') + '" x1="' + bound.left + '" x2="' +
        bound.right + '" y1="' + coord + '" y2="' + coord + '"/><text class="plot-label" x="' +
        (bound.left - 9) + '" y="' + coord + '" dominant-baseline="middle" text-anchor="end">' + label + '</text>';
    }).join('');
    const dates = [[start, 'start'], [end, 'end']].map(([date, align]) => {
      const iso = new Date(date).toISOString().slice(0, 10);
      return '<text class="plot-label" text-anchor="' + align + '" x="' + x(date) + '" y="' + (height - 10) + '">' + day(iso) + '</text>';
    }).join('');
    const marker = x(timestamp(reaction)).toFixed(1);
    const paths = lines.map(({ series, points, color, match }) => {
      const positions = points.map(([date, value]) => [x(timestamp(date)).toFixed(1), y(value).toFixed(1)]);
      const path = positions.map(([px, py], index) => (index ? 'L' : 'M') + px + ' ' + py).join(' ');
      const [lastX, lastY] = positions.at(-1);
      return '<path class="plot-line ' + match.frequency.toLowerCase() + '" stroke="' + color + '" d="' + path +
        '"/><circle cx="' + lastX + '" cy="' + lastY + '" r="3.5" fill="' + color + '"><title>' +
        escape(series.label) + ' ' + number(match.value, series.unit) + ' · ' + day(match.to[0], true) + '</title></circle>';
    }).join('');
    nodes.figure.innerHTML = '<svg role="img" aria-label="Cumulative change from the pre-event close through ' + day(cutoff, true) +
      '" viewBox="0 0 ' + width + ' ' + height + '">' + grid + '<line class="plot-event" x1="' + marker +
      '" x2="' + marker + '" y1="' + bound.top + '" y2="' + bound.bottom + '"><title>Reaction date ' + day(reaction, true) +
      '</title></line>' + paths + dates + '</svg>';
  }

  function renderChart() {
    const cutoff = after[state.horizon - 1] || after.at(-1);
    const reaction = reactionDate();
    const lines = (cutoff ? chartSeries(cutoff) : []).flatMap((series, index) => {
      const match = comparison(series, reaction, cutoff, state.horizon);
      if (!match) return [];
      const points = match.points.filter(point => point[0] >= match.from[0] && point[0] <= match.to[0])
        .map(([date, value]) => [date, computeMove(series, match.from[1], value)]);
      return [{ series, match, points, color: colors[index % colors.length] }];
    });
    const title = state.focus ? state.focus.label : 'Market reaction';
    const elapsed = Math.min(state.horizon, after.length);
    nodes.chartTitle.textContent = title;
    nodes.chartDates.textContent = cutoff
      ? 'Through ' + day(cutoff, true) + ' · ' + elapsed + (elapsed === 1 ? ' session' : ' sessions') +
        (elapsed < state.horizon ? ' available' : '')
      : (sessions.length ? 'Awaiting a completed trading session' : 'S&P 500 session history unavailable');
    nodes.clear.hidden = !state.focus;
    nodes.legend.innerHTML = lines.map(({ series, color, match }) => '<li><span class="legend-swatch" style="--series:' + color +
      '"></span>' + escape(series.label) + (match.frequency === 'Daily' ? '' : ' · ' + match.frequency) + '</li>').join('');
    if (lines.length) drawPlot(lines, cutoff, reaction);
    else nodes.figure.innerHTML = '<p class="empty">No comparable observations for this window.</p>';
  }

  function render() {
    if (!data) return;
    after = sessions.filter(date => date >= reactionDate());
    Object.keys(tableConfig).forEach(renderTable);
    renderChart();
  }

  function setGroup(group) {
    state.group = group;
    document.querySelectorAll('#chart-group [data-group]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.group === group)));
  }

  async function start() {
    if (!events.length) throw new Error('Event register unavailable');
    for (const event of events) {
      const option = new Option(day(event.date, true) + ' · ' + event.title, event.date);
      nodes.event.add(option);
    }
    const query = new URLSearchParams(location.search).get('event');
    selectEvent(events.find(event => event.date === query) || state.event, false);
    nodes.event.addEventListener('change', () => selectEvent(events.find(event => event.date === nodes.event.value)));
    nodes.older.addEventListener('click', () => selectEvent(events[events.indexOf(state.event) + 1]));
    nodes.newer.addEventListener('click', () => selectEvent(events[events.indexOf(state.event) - 1]));
    document.getElementById('chart-group').addEventListener('click', event => {
      const group = event.target.closest('[data-group]')?.dataset.group;
      if (!group) return;
      state.focus = null;
      setGroup(group);
      renderChart();
    });
    document.getElementById('chart-window').addEventListener('click', event => {
      const button = event.target.closest('[data-window]');
      if (!button) return;
      state.horizon = Number(button.dataset.window);
      document.querySelectorAll('#chart-window [data-window]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      renderChart();
    });
    nodes.clear.addEventListener('click', () => {
      state.focus = null;
      renderChart();
      document.querySelector('#chart-group [aria-pressed="true"]').focus();
    });
    Object.entries(tableConfig).forEach(([kind, config]) => {
      const destination = document.getElementById(config.id);
      destination.addEventListener('click', event => {
        const sort = event.target.closest('[data-sort]');
        if (sort) {
          const horizon = Number(sort.dataset.sort);
          state.sort[kind] = { horizon, descending: state.sort[kind].horizon !== horizon || !state.sort[kind].descending };
          renderTable(kind);
          destination.querySelector('[data-sort="' + horizon + '"]').focus();
        }
        const picked = event.target.closest('[data-series]');
        if (!picked) return;
        state.focus = tableSeries(kind).find(series => series.id === picked.dataset.series);
        setGroup(kind === 'market' ? (state.focus.unit === 'bp' ? 'yields' : 'prices') : kind);
        renderChart();
        nodes.chartTitle.focus({ preventScroll: true });
        document.getElementById('price-path').scrollIntoView({ block: 'start' });
      });
    });
    data = await window.CrossMarketBeta2Data.load();
    sessions = (data.market.find(series => series.id === 'SPX')?.points || []).map(([date]) => date);
    document.getElementById('sector-method').textContent = data.sectorMethod || window.CrossMarketBeta2Data.sectorMethod || '';
    nodes.status.hidden = true;
    nodes.replay.hidden = false;
    render();
    if (typeof ResizeObserver !== 'undefined') {
      let previousWidth = nodes.figure.clientWidth;
      new ResizeObserver(() => {
        const width = nodes.figure.clientWidth;
        if (width === previousWidth) return;
        previousWidth = width;
        renderChart();
      }).observe(nodes.figure);
    }
  }

  start().catch(error => {
    nodes.status.textContent = 'The event replay could not load. Reload this page to try again.';
    console.error(error);
  });
})();
