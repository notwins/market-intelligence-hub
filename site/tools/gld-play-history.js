'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GldPlayHistory = factory();
})(typeof window === 'undefined' ? globalThis : window, function () {
  // FNV-1a over the ordered ISO trading dates in each fixed NYSE archive window.
  // This also detects a missing session replaced by a holiday or a weekend.
  const periods = {
    rebound: {
      name: 'The 2020 spring rebound', start: '2020-03-18', end: '2021-03-18', count: 253, dateHash: 0x1aaee9ea,
      rationale: 'GLD rose more than 12% in the first 21 trading sessions, climbed through August, then gave back part of the rally.'
    },
    recovery: {
      name: 'The 2022 selloff and recovery', start: '2022-03-08', end: '2023-12-01', count: 438, dateHash: 0x417b9990,
      rationale: 'GLD fell through September 2022. The December 2023 endpoint was its first close back above the opening price.'
    },
    bear: {
      name: 'Nearly nine years below the 2011 high', start: '2011-08-22', end: '2020-07-29', count: 2249, dateHash: 0xb081f5c9,
      rationale: 'The decline continued into December 2015. GLD first regained the opening close in July 2020, nearly nine years after entry.'
    },
    whipsaw: {
      name: 'The 2023 rally, reversal and late high', start: '2023-01-03', end: '2023-12-29', count: 250, dateHash: 0x9014c564,
      rationale: 'GLD rose into May, surrendered those gains by October, then set a new closing high for the year in December.'
    },
    sideways: {
      name: 'The 2017–18 six-month range', start: '2017-08-31', end: '2018-02-28', count: 124, dateHash: 0x3b744be0,
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

  function observations(rows, scenarioId) {
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
    const ordered = [...closes].sort(([a], [b]) => a < b ? -1 : 1);
    let hash = 2166136261;
    for (const [date] of ordered) {
      for (let i = 0; i < date.length; i++) hash = Math.imul(hash ^ date.charCodeAt(i), 16777619);
    }
    return (hash >>> 0) === period.dateHash ? ordered : null;
  }

  function summarize(rows, scenarioId) {
    const ordered = observations(rows, scenarioId);
    if (!ordered) return null;
    const period = periods[scenarioId], entry = ordered[0][1];
    const points = ordered.map(([date, price], day) => ({
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

  function checkpoints(dates) {
    const opening = new Date(dates[0] + 'T00:00:00Z');
    const lastDay = dates.length - 1;
    const marks = [{day: 0, label: 'Entry'}];
    let day = 0;
    function add(target, label) {
      const iso = target.toISOString().slice(0, 10);
      if (iso >= dates[lastDay]) return;
      while (day + 1 < lastDay && dates[day + 1] <= iso) day++;
      if (day > marks[marks.length - 1].day) marks.push({day, label});
    }
    const week = new Date(opening);
    week.setUTCDate(week.getUTCDate() + 7);
    add(week, 'Week 1');
    const monthOffsets = [1, 2, 3, 6, 9, 12, 15, 18, 21, 24];
    const years = Number(dates[lastDay].slice(0, 4)) - opening.getUTCFullYear();
    for (let y = 3; y <= years; y++) monthOffsets.push(12 * y);
    for (const month of monthOffsets) {
      // Clamp month-end entries such as Aug 31 to the following month's last day.
      const target = new Date(Date.UTC(opening.getUTCFullYear(), opening.getUTCMonth() + month + 1, 0));
      target.setUTCDate(Math.min(opening.getUTCDate(), target.getUTCDate()));
      add(target, month % 12 === 0 ? 'Year ' + month / 12 : 'Month ' + month);
    }
    marks.push({day: lastDay, label: 'End'});
    return marks;
  }

  function replay(rows, scenarioId) {
    const ordered = observations(rows, scenarioId);
    if (!ordered) return null;
    const period = periods[scenarioId];
    const dates = ordered.map(([date]) => date);
    return {
      id: scenarioId, label: period.name, description: period.rationale, dates,
      prices: ordered.map(([, price]) => price), checkpoints: checkpoints(dates)
    };
  }

  return {summarize, replay};
});
