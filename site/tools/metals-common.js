'use strict';
const Metals = (() => {
  const format = (value, digits = 2) => value.toLocaleString('en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  });
  async function series(name) {
    const response = await fetch('../data/metals/' + name + '.csv', {cache: 'no-cache'});
    if (!response.ok) throw Error('Price history could not be loaded. Reload to try again.');
    const [header, ...lines] = (await response.text()).trim().split(/\r?\n/);
    const keys = header.split(',');
    return lines.map(line => Object.fromEntries(line.split(',').map((cell, i) =>
      [keys[i], i === 0 ? cell : cell === '' ? null : Number(cell)])));
  }
  function metrics(values) {
    return '<div class="metrics">' + values.map(([label, value]) =>
      '<div class="metric"><span>' + label + '</span><strong>' + value + '</strong></div>').join('') + '</div>';
  }
  // Each point uses a numeric x coordinate (UTC milliseconds for histories).
  function chart(points, label, {ticks, guides = [], gap = Infinity, color = '#9b7524'} = {}) {
    if (!points.length) return '<p>No observations in this period.</p>';
    const width = 500, left = 62, right = 482, top = 18, bottom = 160;
    const values = [...points.map(p => p[1]), ...guides.map(g => g.value)];
    const low = Math.min(...values), high = Math.max(...values);
    const padding = (high - low || Math.abs(high) || 1) * .1;
    const x = v => left + (v - points[0][0]) / (points.at(-1)[0] - points[0][0] || 1) * (right-left);
    const y = v => bottom - (v - low + padding) / (high - low + 2 * padding) * (bottom-top);
    let grid = '';
    for (let i = 0; i < 4; i++) {
      const value = high + padding - i / 3 * (high - low + 2 * padding);
      grid += '<path class="grid" d="M' + left + ' ' + y(value) + 'H' + right + '"/><text x="55" y="' +
        (y(value)+4) + '" text-anchor="end">' + format(value, high-low < 10 ? 2 : 0) + '</text>';
    }
    const path = points.map(([v,p], i) => (i && v-points[i-1][0] <= gap ? 'L' : 'M') + x(v).toFixed(2) + ',' + y(p).toFixed(2)).join('');
    const labels = (ticks || []).map(([v,t], i, all) => '<text x="' + x(v) + '" y="184" text-anchor="' +
      (i === 0 ? 'start' : i === all.length-1 ? 'end' : 'middle') + '">' + t + '</text>').join('');
    const references = guides.map(g => '<path d="M'+left+' '+y(g.value)+'H'+right+'" stroke="'+g.color+'" stroke-dasharray="5 4"><title>'+g.name+'</title></path>').join('');
    const end = points.at(-1);
    return '<svg class="plot" viewBox="0 0 '+width+' 194" role="img" aria-label="'+label+'"><title>'+label+'</title>'+grid+
      references+'<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2"/><circle cx="'+x(end[0])+'" cy="'+y(end[1])+'" r="3" fill="'+color+'"/>'+labels+'</svg>';
  }
  function history(rows, key, label, color) {
    const points = rows.filter(r => r[key] !== null).map(r => [Date.parse(r.date), r[key]]);
    const indices = [...new Set([0, Math.floor(points.length / 2), points.length - 1])];
    const ticks = points.length ? indices.map(i => [points[i][0], new Date(points[i][0]).toISOString().slice(0,10)]) : [];
    return chart(points, label, {ticks, color, gap: 8 * 86400000});
  }
  function showHistory(panel, rows, key, label, unit, color) {
    const range = panel.querySelector('select');
    const plot = panel.querySelector('.history-plot');
    const coverage = panel.querySelector('figcaption');
    const available = rows.filter(row => Number.isFinite(row[key]));
    if (!available.length) {
      plot.textContent = 'Price history is unavailable.';
      coverage.textContent = '';
      return;
    }
    const latest = available.at(-1);
    const cutoff = new Date(latest.date);
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number(range.value || 0));
    const shown = range.value ? available.filter(row => Date.parse(row.date) >= cutoff) : available;
    plot.innerHTML = history(shown, key, label, color);
    coverage.textContent = `${shown[0].date} to ${latest.date} · ${shown.length.toLocaleString('en-US')} closes · Latest ${format(latest[key])} ${unit}`;
  }
  return {series, metrics, chart, history, showHistory, format};
})();
