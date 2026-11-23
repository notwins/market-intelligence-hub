// Historical NVDA declines from each window's starting monthly close.
(function (root) {
  'use strict';

  const tenors = [3, 6, 9, 12];

  function parseDate(label) {
    if (typeof label !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(label)) return null;
    const date = new Date(label + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== label) return null;
    return date;
  }

  function monthNumber(date) {
    return date.getUTCFullYear() * 12 + date.getUTCMonth();
  }

  function completedCloses(points, asOf, years) {
    const lastMonth = monthNumber(asOf) - 1;
    const firstMonth = lastMonth - years * 12;
    const monthly = new Map();
    for (const point of points) {
      if (!Array.isArray(point)) continue;
      const [label, price] = point;
      const date = parseDate(label);
      if (!date || !Number.isFinite(price) || price <= 0) continue;
      const month = monthNumber(date);
      if (month < firstMonth || month > lastMonth) continue;
      // A historical feed may contain a mid-month snapshot. The baseline uses
      // calendar month-end labels. Daily observations must cover the last weekday.
      // Conservatively skip an unconfirmed holiday-shortened month.
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
      const weekday = lastDay.getUTCDay();
      const lastWeekday = lastDay.getUTCDate() - (weekday === 0 ? 2 : weekday === 6 ? 1 : 0);
      if (date.getUTCDate() < lastWeekday) continue;
      const previous = monthly.get(month);
      if (!previous || label > previous.label) monthly.set(month, {label, price});
    }
    return monthly;
  }

  function countWindows(monthly, months, thresholdRatio) {
    let total = 0, endHits = 0, touchHits = 0;
    for (const [start, observation] of monthly) {
      const boundary = observation.price * thresholdRatio;
      const tolerance = 4 * Number.EPSILON * boundary;
      let touched = false;
      for (let offset = 1; offset <= months; offset++) {
        const next = monthly.get(start + offset);
        if (!next) break;
        const hit = next.price <= boundary + tolerance;
        if (hit) touched = true;
        if (offset === months) {
          total++;
          if (hit) endHits++;
          if (touched) touchHits++;
        }
      }
    }
    return {months, total, endHits, touchHits,
      endPct: total ? 100 * endHits / total : null,
      touchPct: total ? 100 * touchHits / total : null};
  }

  function analyze(points, asOfDate, referencePrice, testPrice, historyYears = 10) {
    const asOf = parseDate(asOfDate);
    if (!asOf || !Array.isArray(points) || !Number.isInteger(historyYears) || historyYears < 1 ||
        !Number.isFinite(referencePrice) || !Number.isFinite(testPrice)) return null;
    // Use the same tradeable-cent reference the pricing screen displays; retain
    // full data precision on historical closes adjusted for past stock splits.
    referencePrice = Math.round((referencePrice + Number.EPSILON * referencePrice) * 100) / 100;
    if (referencePrice <= 0 || testPrice < 0 || testPrice >= referencePrice) return null;
    const thresholdRatio = testPrice / referencePrice;
    const monthly = completedCloses(points, asOf, historyYears);
    const rows = tenors.map(months => countWindows(monthly, months, thresholdRatio));
    if (!rows.some(row => row.total)) return null;
    const first = monthly.get(Math.min(...monthly.keys()));
    const last = monthly.get(Math.max(...monthly.keys()));
    return {referencePrice, testPrice, declinePct: 100 * (1 - thresholdRatio),
      startMonth: first.label.slice(0, 7), endMonth: last.label.slice(0, 7),
      moreRecentThrough: asOfDate, rows};
  }

  const api = {analyze};
  root.AccumulatorHistoryRisk = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
