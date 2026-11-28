'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GldPlayHistory = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  // These are fixed observation windows. The count includes the opening close
  // and lets a partial download fail closed, even when both ends are present.
  const periods = {
    rebound: {
      name: 'The 2020 spring rebound', start: '2020-03-18', end: '2021-03-18', count: 253,
      rationale: 'GLD rose more than 12% in the first 21 trading sessions, climbed through August, then gave back part of the rally.'
    },
    recovery: {
      name: 'The 2022 selloff and recovery', start: '2022-03-08', end: '2023-12-01', count: 438,
      rationale: 'GLD fell through September 2022. The December 2023 endpoint was its first close back above the opening price.'
    },
    bear: {
      name: 'Nearly nine years below the 2011 high', start: '2011-08-22', end: '2020-07-29', count: 2249,
      rationale: 'The decline continued into December 2015. GLD first regained the opening close in July 2020, nearly nine years after entry.'
    },
    whipsaw: {
      name: 'The 2023 rally, reversal and late high', start: '2023-01-03', end: '2023-12-29', count: 250,
      rationale: 'GLD rose into May, surrendered those gains by October, then set a new closing high for the year in December.'
    },
    sideways: {
      name: 'The 2017–18 six-month range', start: '2017-08-31', end: '2018-02-28', count: 124,
      rationale: 'A December dip and January rebound left GLD within 1% of its opening price at the end of February.'
    }
  };

  function change(price, reference) {
    return (price / reference - 1) * 100;
  }

  function sample(points, required) {
    const limit = 80;
    if (points.length <= limit) return points;
    const days = new Set(required.map(point => point.day));
    // Keep both extremes of each time bucket along with all reported landmarks.
    const buckets = Math.floor((limit - days.size) / 2);
    for (let i = 0; i < buckets; i++) {
      const start = 1 + Math.floor((points.length - 2) * i / buckets);
      const stop = 1 + Math.floor((points.length - 2) * (i + 1) / buckets);
      let bottom = points[start], top = points[start];
      for (let j = start + 1; j < stop; j++) {
        if (points[j].price < bottom.price) bottom = points[j];
        if (points[j].price > top.price) top = points[j];
      }
      days.add(bottom.day);
      days.add(top.day);
    }
    return [...days].sort((a, b) => a - b).map(day => points[day]);
  }

  function summarize(rows, scenarioId) {
    if (!Array.isArray(rows) || !Object.hasOwn(periods, scenarioId)) return null;
    const period = periods[scenarioId];
    const closes = new Map();
    for (const row of rows) {
      const date = row?.date;
      if (typeof date !== 'string' || date < period.start || date > period.end) continue;
      const time = Date.parse(date + 'T00:00:00Z');
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) return null;
      if (typeof row.close !== 'string' && typeof row.close !== 'number') return null;
      const price = Number(row.close);
      if (!Number.isFinite(price) || price <= 0) return null;
      if (closes.has(date) && closes.get(date) !== price) return null;
      closes.set(date, price);
    }
    if (!closes.has(period.start) || !closes.has(period.end) || closes.size !== period.count) return null;
    const entry = closes.get(period.start);
    const points = [...closes].sort(([a], [b]) => a < b ? -1 : 1).map(([date, price], day) => ({
      date, price, day, returnPct: change(price, entry)
    }));
    const first = points[0], last = points[points.length - 1];
    let low = points[1], high = first, drawdownPeak = first, drawdownTrough = first;
    let maxDrawdownPct = 0;
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      if (point.price < low.price) low = point;
      if (point.price > high.price) high = point;
      const drawdown = change(point.price, high.price);
      if (drawdown < maxDrawdownPct) {
        maxDrawdownPct = drawdown;
        drawdownPeak = high;
        drawdownTrough = point;
      }
    }
    return {
      name: period.name, rationale: period.rationale, first, last, low, high,
      terminalPct: last.returnPct, lowPct: low.returnPct, maxDrawdownPct, drawdownPeak, drawdownTrough,
      observations: points.length, points: sample(points, [first, last, low, high, drawdownPeak, drawdownTrough])
    };
  }

  return {summarize};
});
