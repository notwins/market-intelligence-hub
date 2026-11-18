/* Research conventions shared by Signal Review and Cross-Market Replay. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FredBreaches = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
  'use strict';
  const finite = Number.isFinite;
  const DAY = 86400000;
  const iso = date => new Date(date).toISOString().slice(0, 10);
  const offset = (date, days) => iso(Date.parse(date + 'T00:00:00Z') + days * DAY);
  const tier = z => !finite(z) ? -1 : Math.abs(z) >= 2 ? 2 : Math.abs(z) >= 1 ? 1 : 0;

  function period(date, frequency) {
    const [year, month] = date.split('-').map(Number);
    if (/^Monthly/i.test(frequency)) {
      return {start: iso(Date.UTC(year, month - 1, 1)), end: iso(Date.UTC(year, month, 0)), label: date.slice(0, 7), days: 30};
    }
    if (/^Quarterly/i.test(frequency) && !/mixed/i.test(frequency)) {
      const quarter = Math.floor((month - 1) / 3);
      return {start: iso(Date.UTC(year, quarter * 3, 1)), end: iso(Date.UTC(year, (quarter + 1) * 3, 0)), label: year + ' Q' + (quarter + 1), days: 90};
    }
    if (/^Annual.*Fiscal Year/i.test(frequency)) {
      const end = Date.parse(date + 'T00:00:00Z');
      const prior = new Date(end);
      prior.setUTCFullYear(prior.getUTCFullYear() - 1);
      return {start: offset(iso(prior), 1), end: date, label: 'Fiscal year ending ' + date, days: 365};
    }
    return {start: date, end: date, label: date, days: 1};
  }

  function crossings(rows, frequency, id) {
    let previous = null;
    let previousIndex = null;
    const events = [];
    const active = new Map();
    rows.forEach((row, index) => {
      if (!finite(row.z)) return;
      const band = tier(row.z);
      const sign = Math.sign(row.z);
      for (const threshold of [1, 2]) {
        if (band < threshold) {
          active.delete(threshold);
          continue;
        }
        if (previous && Math.sign(previous.z) === sign && tier(previous.z) >= threshold) continue;
        const event = {
          key: id + ':' + row.date + ':' + threshold,
          id, date: row.date, period: period(row.date, frequency), threshold, z: row.z,
          previous, index, skipped: previousIndex === null ? 0 : index - previousIndex - 1,
          observed: previous !== null
        };
        active.set(threshold, event);
        events.push(event);
      }
      previous = row;
      previousIndex = index;
    });
    const latest = rows.at(-1);
    if (!latest || tier(latest.z) < 1) active.clear();
    return {events, active};
  }

  function sortedEvents(events) {
    return events.slice().sort((a, b) =>
      b.period.end.localeCompare(a.period.end) || b.threshold - a.threshold ||
      Math.abs(b.z) - Math.abs(a.z) || a.id.localeCompare(b.id));
  }

  function points(input) {
    const byDate = new Map();
    for (const [date, value] of input || []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && finite(value)) byDate.set(date, value);
    }
    return Array.from(byDate).sort(([a], [b]) => a.localeCompare(b));
  }

  function marketWindow(series, period, window, cutoff) {
    const wholePeriod = window === 'period' && period.days > 1;
    const start = wholePeriod ? period.start : offset(period.end, -Number(window === 'period' ? 10 : window));
    const target = wholePeriod ? period.end : offset(period.end, Number(window === 'period' ? 10 : window));
    const end = target < cutoff ? target : cutoff;
    const eligible = series.points.filter(([date]) => date >= start && date <= end);
    const before = eligible.find(([date]) => date < period.end) || null;
    const after = (wholePeriod ? eligible.at(-1) : eligible.findLast(([date]) => date >= period.end)) || null;
    const age = (a, b) => (Date.parse(a) - Date.parse(b)) / DAY;
    const tolerance = Math.max(7, Math.ceil((series.cadenceDays || 1) * 1.5));
    const comparable = before && after && before[0] < after[0] && age(before[0], start) <= tolerance && age(end, after[0]) <= tolerance;
    let change = null;
    if (comparable) {
      if (series.kind === 'yield') change = (after[1] - before[1]) * 100;
      else if (before[1] > 0) change = (after[1] / before[1] - 1) * 100;
    }
    return {start, end, target, eligible, before, after, change, truncated: target > cutoff, comparable: !!comparable};
  }

  return Object.freeze({offset, tier, period, crossings, sortedEvents, points, marketWindow});
});
