/* Shared axes and an observation cursor for the two charts in a Desk company card. */
(function (root) {
  'use strict';

  const plot = {left: 53, right: 349, top: 12, bottom: 132, height: 158};
  const month = new Intl.DateTimeFormat('en-GB', {month: 'short', year: '2-digit', timeZone: 'UTC'});
  const date = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  const stamp = day => date.format(Date.parse(day));
  const valueLabel = (value, digits = 2) => value.toLocaleString('en-US', {maximumFractionDigits: digits});
  const money = (value, unit, digits) => ['USD', 'SGD', 'HKD', 'CAD', 'AUD'].includes(unit)
    ? '$' + valueLabel(value, digits) : valueLabel(value, digits);
  const charts = new WeakMap();

  function axis(values, price) {
    const smallest = Math.min(...values), largest = Math.max(...values);
    const raw = (largest - smallest || Math.abs(largest) * 0.08 || 1) / 4;
    // A price axis uses whole currency units, or multiples of ten at wider ranges.
    const factor = 10 ** Math.floor(Math.log10(raw));
    const step = (price && factor < 1) ? 1 : [1, 2, 2.5, 5, 10]
      .filter(n => !price || Number.isInteger(n * factor) && (factor < 10 || n * factor % 10 === 0))
      .find(n => n * factor >= raw) * factor;
    const low = price ? Math.max(0, Math.floor(smallest / step) * step) : 0;
    const high = Math.max(low + step * 4, Math.ceil(largest / step) * step);
    return Array.from({length: Math.round((high - low) / step) + 1}, (_, i) => low + i * step);
  }

  function render(host, series, title, unit = '') {
    const price = Boolean(unit);
    const samples = series.flatMap(line => line.points);
    if (!samples.length) {
      host.innerHTML = '<p class="fine">No verified observations.</p>';
      return;
    }
    const dates = [...new Set(samples.map(p => p[0]))].sort();
    const start = Date.parse(dates[0]), end = Date.parse(dates.at(-1));
    const scale = x => plot.left + (end === start ? 0.5 : (x - start) / (end - start)) * (plot.right - plot.left);
    const ticks = axis(price ? samples.map(p => p[1]) : [0, ...samples.map(p => p[1])], price);
    const low = ticks[0], high = ticks.at(-1);
    const y = y => plot.bottom - (y - low) / (high - low) * (plot.bottom - plot.top);
    const label = v => price ? money(v, unit, 0) : valueLabel(v) + '×';
    const E = root.Desk.E;
    host.innerHTML = `<figure class="stock-history-chart ${price ? 'stock-history-price' : 'stock-history-valuation'}">
      ${price ? '' : `<figcaption>${series.map(line => {
        const latest = line.points.at(-1);
        return `<span class="series-${line.key}">${line.label} <b>${latest ? valueLabel(latest[1], 1) + '×' : 'Unavailable'}</b></span>`;
      }).join('')}</figcaption>`}
      <svg viewBox="0 0 360 ${plot.height}" role="img" aria-label="${E(title)}. Use arrow keys to inspect observations." tabindex="0">
        <title>${E(title)} · ${E(dates[0])} to ${E(dates.at(-1))}</title>
        ${ticks.map(tick => `<line class="stock-gridline" x1="${plot.left}" x2="${plot.right}" y1="${y(tick)}" y2="${y(tick)}"/><text x="${plot.left - 5}" y="${y(tick) + 4}" text-anchor="end">${label(tick)}</text>`).join('')}
        ${series.map(line => {
          const vertices = line.points.map(([day, val]) => `${scale(Date.parse(day)).toFixed(2)},${y(val).toFixed(2)}`).join(' ');
          return `<g class="series-${line.key}">
            ${price && vertices ? `<polygon points="${plot.left},${plot.bottom} ${vertices} ${plot.right},${plot.bottom}"/>` : ''}
            ${line.points.length > 1 ? `<polyline points="${vertices}"/>` : ''}
            ${!price || line.points.length === 1 ? line.points.map(([day, val]) => `<circle cx="${scale(Date.parse(day))}" cy="${y(val)}" r="2.5"/>`).join('') : ''}
          </g>`;
        }).join('')}
        <text x="${plot.left}" y="151">${month.format(start)}</text>
        ${start !== end ? `<text x="${plot.right}" y="151" text-anchor="end">${month.format(end)}</text>` : ''}
        <line data-cursor hidden x1="0" x2="0" y1="${plot.top}" y2="${plot.bottom}"/>
      </svg>
      <div class="stock-chart-tooltip" aria-hidden="true" hidden></div>
      <span class="sr-only" role="status"></span>
    </figure>`;
    const svg = host.querySelector('svg');
    const card = host.closest('.instrument');
    const model = {svg, dates, start, end, scale, series, unit, current: null};
    charts.set(svg, model);

    function clear() {
      for (const chart of card.querySelectorAll('.stock-history-chart')) {
        chart.querySelector('[data-cursor]').setAttribute('hidden', '');
        chart.querySelector('.stock-chart-tooltip').hidden = true;
      }
      host.querySelector('[role="status"]').textContent = '';
      model.current = null;
    }

    function show(day, announce) {
      model.current = day;
      const time = Date.parse(day);
      const present = new Map();
      for (const other of card.querySelectorAll('.stock-history-chart svg')) {
        const graph = charts.get(other);
        if (!graph) continue;
        const cursor = other.querySelector('[data-cursor]');
        const inRange = !other.closest('[hidden]') && time >= graph.start && time <= graph.end;
        cursor.toggleAttribute('hidden', !inRange);
        other.parentElement.querySelector('.stock-chart-tooltip').hidden = true;
        if (inRange) {
          cursor.setAttribute('x1', graph.scale(time));
          cursor.setAttribute('x2', graph.scale(time));
        }
        for (const line of graph.series) {
          const point = line.points.findLast(([sample]) => sample <= day);
          if (point) present.set(line.key, {point, unit: graph.unit});
        }
      }
      const rows = [['price', 'Price'], ['pb', 'P/B'], ['pe', 'P/E']].map(([key, label]) => {
        const entry = present.get(key);
        if (!entry) return {key, label, value: '—'};
        const [observed, val] = entry.point;
        return {key, label, value: key === 'price' ? money(val, entry.unit) + ' ' + entry.unit : valueLabel(val) + '×', observed: observed === day ? '' : stamp(observed)};
      });
      const tooltip = svg.parentElement.querySelector('.stock-chart-tooltip');
      tooltip.innerHTML = `<time datetime="${day}">${stamp(day)}</time>${rows.map(r => `<span class="series-${r.key}">${r.label} <b>${E(r.value)}</b>${r.observed ? `<small>${r.observed}</small>` : ''}</span>`).join('')}`;
      tooltip.hidden = false;
      tooltip.classList.toggle('tooltip-left', time > (start + end) / 2);
      if (announce) host.querySelector('[role="status"]').textContent = [stamp(day), ...rows.map(r => [r.label, r.value, r.observed].filter(Boolean).join(' '))].join('. ');
    }

    svg.addEventListener('pointermove', event => {
      const bounds = svg.getBoundingClientRect();
      const position = (event.clientX - bounds.left) / bounds.width * 360;
      const target = start + (end - start) * (position - plot.left) / (plot.right - plot.left);
      const closest = dates.reduce((best, day) => Math.abs(Date.parse(day) - target) < Math.abs(Date.parse(best) - target) ? day : best);
      show(closest, false);
    });
    svg.addEventListener('pointerleave', clear);
    svg.addEventListener('blur', clear);
    svg.addEventListener('focus', () => { if (svg.matches(':focus-visible')) show(dates.at(-1), true); });
    svg.addEventListener('keydown', event => {
      const current = model.current ? dates.indexOf(model.current) : dates.length - 1;
      const indices = {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: dates.length - 1};
      if (event.key === 'Escape') clear();
      if (!(event.key in indices)) return;
      event.preventDefault();
      show(dates[Math.min(dates.length - 1, Math.max(0, indices[event.key]))], true);
    });
  }

  root.DeskStockCharts = {
    price: (host, points, unit, ticker) => render(host, [{key: 'price', points}], `${ticker} price history in ${unit}`, unit),
    valuation: (host, pe, pb, ticker) => render(host, [
      {key: 'pe', label: 'Forward P/E', points: pe.slice(-60).map(p => [p.date, p.value])},
      {key: 'pb', label: 'Forward P/B', points: pb.slice(-60).map(p => [p.date, p.value])}
    ], `${ticker} forward P/E and P/B in multiples`)
  };
})(window);
