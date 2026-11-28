/* Calendar alignment and return calculations for the gold research workspace. */
(function (root) {
  'use strict';
  const valid = ([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value);
  const months = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const within = (points, start, end) => points.filter(([date]) => date >= start && date <= end);

  function monthly(points) {
    const last = new Map();
    for (const p of points) {
      if (!valid(p)) continue;
      const key = p[0].slice(0, 7);
      if (!last.has(key) || p[0] >= last.get(key)[0]) last.set(key, p);
    }
    return [...last].sort(([a], [b]) => a.localeCompare(b)).map(([m, p]) => [m + '-01', p[1], p[0]]);
  }
  function yearly(points) {
    // Use December for the price comparison, preserving years without a December value as gaps.
    return points.filter(([day]) => day.slice(5, 7) === '12').map(([day, value, observed]) => [day.slice(0, 4) + '-12-31', value, observed ?? day]);
  }
  function quarterly(points, average) {
    const byMonth = new Map(points.map(p => [months(p[0]), p]));
    return points.filter(([date]) => Number(date.slice(5, 7)) % 3 === 0).flatMap(([date, value, observed]) => {
      const preceding = [2, 1].map(offset => byMonth.get(months(date) - offset)?.[1]);
      if (average && !preceding.every(Number.isFinite)) return [];
      const end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
      return [[end, average ? (preceding[0] + preceding[1] + value) / 3 : value, observed ?? date]];
    });
  }
  function multiply(gold, fx, inverse = false) {
    const rates = new Map(fx.filter(valid));
    return gold.filter(p => valid(p) && rates.get(p[0]) > 0)
      .map(([date, value]) => [date, inverse ? value / rates.get(date) : value * rates.get(date)]);
  }
  function yearOnYear(points) {
    const lookup = new Map(points.filter(valid).map(([d, value]) => [months(d), value]));
    return points.filter(p => valid(p) && lookup.get(months(p[0]) - 12) > 0)
      .map(([d, v]) => [d, 100 * (v / lookup.get(months(d) - 12) - 1)]);
  }
  function realGold(gold, cpi) {
    const base = cpi.filter(valid).at(-1)?.[1];
    const lookup = new Map(cpi.filter(valid).map(([d, value]) => [months(d), value]));
    return gold.filter(p => valid(p) && lookup.get(months(p[0])) > 0)
      .map(([d, v]) => [d, v * base / lookup.get(months(d))]);
  }
  function pairs(gold, driver, start, end, frequency, average = false) {
    const price = frequency === true || frequency === 'Annual' ? yearly(gold) :
      frequency === 'Quarterly' ? quarterly(gold, average) : gold;
    const comparison = new Map(driver.map(p => [p[0], p]));
    return within(price, start, end).filter(p => comparison.has(p[0]))
      .map(([date, value, observed]) => [date, value, comparison.get(date)[1], observed ?? date, comparison.get(date)[2] ?? date]);
  }
  function change(first, last, kind) {
    return kind === 'rate' || kind === 'difference' ? last - first : first > 0 ? 100 * (last / first - 1) : null;
  }
  function correlation(rows, driverKind) {
    const xy = [];
    for (let i = 1; i < rows.length; i++) {
      if (months(rows[i][0]) - months(rows[i - 1][0]) !== 1) continue;
      const x = change(rows[i - 1][1], rows[i][1], 'level');
      const y = change(rows[i - 1][2], rows[i][2], driverKind);
      if (Number.isFinite(x) && Number.isFinite(y)) xy.push([x, y]);
    }
    if (xy.length < 12) return {value: null, count: xy.length};
    const avg = [0, 1].map(j => xy.reduce((sum, p) => sum + p[j], 0) / xy.length);
    let xx = 0, yy = 0, product = 0;
    for (const p of xy) {
      const x = p[0] - avg[0], y = p[1] - avg[1];
      xx += x * x;
      yy += y * y;
      product += x * y;
    }
    return {value: xx && yy ? Math.max(-1, Math.min(1, product / Math.sqrt(xx * yy))) : null, count: xy.length};
  }
  function drawdown(points) {
    if (points.length < 2) return null;
    let peak = points[0], from = peak, bottom = peak, biggest = 0;
    for (const row of points) {
      if (row[1] > peak[1]) peak = row;
      const move = change(peak[1], row[1], 'level');
      if (move < biggest) {
        from = peak;
        bottom = row;
        biggest = move;
      }
    }
    const recovered = biggest < 0 ? points.find(([date, value]) => date > bottom[0] && value >= from[1]) : undefined;
    return {value: biggest, peak: from, trough: bottom, recovered};
  }
  function ranked(countries, end, floor) {
    return Object.entries(countries).map(([name, points]) => ({name, last: points.findLast(p => p[0] <= end)}))
      .filter(row => row.last && row.last[0] >= floor)
      .sort((a, b) => b.last[1] - a.last[1] || a.name.localeCompare(b.name));
  }

  const model = {monthly, quarterly, within, multiply, yearOnYear, realGold, pairs, change, correlation, drawdown, ranked};
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.XauHistory = model;
})(globalThis);
