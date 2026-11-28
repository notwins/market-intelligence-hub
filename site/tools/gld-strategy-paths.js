'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GldPaths = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  const sessionsPerYear = 252;
  const horizons = [1, 3, 5, 10];
  const scenarios = [
    {id: 'rebound', label: 'Fast rebound', description: 'GLD rises through the initial accumulator KO level within one model month, then advances more slowly.'},
    {id: 'whipsaw', label: 'Rally, fall, repeat', description: 'GLD alternates above and below its entry price in recurring six-month swings.'},
    {id: 'range', label: 'Sideways range', description: 'GLD fluctuates in a narrow range and finishes each model year at its entry price.'},
    {id: 'decline', label: 'Sustained decline', description: 'GLD loses 18% in year one and continues to fall, reaching a 50% decline by year ten.'},
    {id: 'recovery', label: 'Selloff and recovery', description: 'GLD falls 30% in six months, returns to its entry price by year three, then continues higher.'},
    {id: 'severe', label: 'Persistent severe loss', description: 'GLD falls 60% in year one and reaches an 85% decline by year ten.'},
    {id: 'zero', label: 'Fall to zero', description: 'GLD falls to zero over 63 model sessions and stays there for the rest of the horizon.'},
    {id: 'custom', label: 'Custom path', description: 'Connect the entry price, year-one return and final return by straight lines. Both returns are measured from entry.'}
  ];

  function validNumber(value, name) {
    if (value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw Error('Enter a finite number for ' + name + '.');
    }
    return Number(value);
  }

  function readHorizon(value) {
    const years = Number(value);
    if (!horizons.includes(years)) throw Error('Choose a horizon of 1, 3, 5 or 10 years.');
    return years;
  }

  function returnFactor(value) {
    const pct = validNumber(value, 'the return');
    if (pct < -100) throw Error('A GLD return must be at least −100%.');
    return 1 + pct / 100;
  }

  // Anchor x coordinates are years since inception. Interpolate price levels, including zero.
  function interpolate(year, knots) {
    const next = knots.findIndex(knot => knot[0] >= year);
    if (next <= 0) return next === 0 ? knots[0][1] : knots[knots.length - 1][1];
    const [fromYear, fromPrice] = knots[next - 1];
    const [toYear, toPrice] = knots[next];
    if (year === toYear) return toPrice;
    return fromPrice + (toPrice - fromPrice) * (year - fromYear) / (toYear - fromYear);
  }

  function scenario({id, spot, years, koPct = 105, yearOnePct = 0, finalPct = 0}) {
    const start = validNumber(spot, 'the initial GLD share price');
    const horizon = readHorizon(years);
    if (start <= 0) throw Error('The initial GLD share price must be positive.');
    let knots;
    switch (id) {
      case 'rebound': {
        const ko = validNumber(koPct, 'the accumulator KO percentage') / 100;
        if (ko <= 1) throw Error('The accumulator KO must exceed 100% of the initial GLD price.');
        const firstRally = Math.max(1.15, ko * 1.025);
        knots = [[0, 1], [1 / 12, firstRally], [1, firstRally * 1.08], [3, firstRally * 1.21],
          [5, firstRally * 1.35], [10, firstRally * 1.7]];
        break;
      }
      case 'decline':
        knots = [[0, 1], [1, 0.82], [3, 0.7], [5, 0.62], [10, 0.5]];
        break;
      case 'recovery':
        knots = [[0, 1], [0.5, 0.7], [1, 0.77], [3, 1], [5, 1.13], [10, 1.38]];
        break;
      case 'severe':
        knots = [[0, 1], [0.25, 0.6], [1, 0.4], [3, 0.28], [5, 0.22], [10, 0.15]];
        break;
      case 'zero':
        knots = [[0, 1], [0.25, 0], [10, 0]];
        break;
      case 'custom':
        knots = [[0, 1]];
        if (horizon > 1) knots.push([1, returnFactor(yearOnePct)]);
        knots.push([horizon, returnFactor(finalPct)]);
        if (horizon > 1 && knots[1][1] === 0 && knots[2][1] > 0) {
          throw Error('A path that reaches zero cannot later recover. Choose a year-one return above −100% to model a rebound.');
        }
        break;
      case 'range':
      case 'whipsaw':
        break;
      default:
        throw Error('Choose an available GLD scenario.');
    }
    const prices = Array.from({length: horizon * sessionsPerYear + 1}, (_, day) => {
      const year = day / sessionsPerYear;
      if (knots) return start * interpolate(year, knots);
      if (day % 126 === 0) return start;
      const swing = Math.sin(4 * Math.PI * year);
      return id === 'whipsaw' ? start * (1 + 0.21 * swing) :
        start * (1 + 0.035 * swing + 0.015 * Math.sin(16 * Math.PI * year));
    });
    if (prices.some(price => !Number.isFinite(price))) throw Error('The price path exceeds the numeric range.');
    return {prices, dates: null, startDate: null, endDate: null, truncated: false};
  }

  function isDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const time = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
  }

  function shiftYears(date, count) {
    const target = new Date(date + 'T00:00:00Z');
    const month = target.getUTCMonth();
    target.setUTCFullYear(target.getUTCFullYear() + count);
    if (target.getUTCMonth() !== month) target.setUTCDate(0);
    return target.toISOString().slice(0, 10);
  }

  function history(rows, field) {
    const byDate = new Map();
    for (const row of rows || []) {
      const price = Number(row[field]);
      if (Number.isFinite(price) && price > 0 && isDate(row.date)) byDate.set(row.date, price);
    }
    return [...byDate].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  }

  function replay(gldRows, startDate, years) {
    const horizon = readHorizon(years);
    if (!isDate(startDate)) throw Error('Choose a valid replay start date.');
    const rows = history(gldRows, 'close');
    if (!rows.length) throw Error('GLD close history is unavailable.');
    if (startDate < rows[0][0] || startDate > rows[rows.length - 1][0]) {
      throw Error('Choose a replay date between ' + rows[0][0] + ' and ' + rows[rows.length - 1][0] + '.');
    }
    const first = rows.find(([date]) => date >= startDate)[0];
    const targetDate = shiftYears(first, horizon);
    const selected = rows.filter(([date]) => date >= first && date <= targetDate);
    if (selected.length < 2) throw Error('The replay needs a subsequent GLD close. Choose an earlier start.');
    const cutoff = new Date(targetDate + 'T00:00:00Z');
    if (cutoff.getUTCDay() === 6) cutoff.setUTCDate(cutoff.getUTCDate() - 1);
    if (cutoff.getUTCDay() === 0) cutoff.setUTCDate(cutoff.getUTCDate() - 2);
    return {
      prices: selected.map(([, price]) => price), dates: selected.map(([date]) => date),
      startDate: first, endDate: selected[selected.length - 1][0], targetDate,
      truncated: rows[rows.length - 1][0] < cutoff.toISOString().slice(0, 10)
    };
  }

  function marketContext(gldRows, xauRows) {
    const gld = history(gldRows, 'close'), xau = history(xauRows, 'usd_per_oz');
    const goldDates = new Set(xau.map(([date]) => date));
    let date;
    for (let i = gld.length - 1; i >= 0; i--) {
      if (goldDates.has(gld[i][0])) { date = gld[i][0]; break; }
    }
    if (!date) return null;
    const start = shiftYears(date, -1);
    function drawdown(rows, unit) {
      const recent = rows.filter(([d]) => d >= start && d <= date);
      const [peakDate, peak] = recent.reduce((best, row) => row[1] >= best[1] ? row : best);
      const price = recent[recent.length - 1][1];
      return {price, peak, peakDate, drawdownPct: (price / peak - 1) * 100, unit};
    }
    return {date, gld: drawdown(gld, 'USD/share'), xau: drawdown(xau, 'USD/troy oz')};
  }

  return {scenarios, scenario, replay, marketContext};
});
