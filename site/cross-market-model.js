/* Calculations for the cross-market history view. No source files are mutated. */
(function (root) {
  'use strict';
  const D = root.HistoricalFredData || (typeof require === 'function' && require('./historical-fred-data.js'));
  const DAY = 86400000;
  const tenors = ['2Y', '5Y', '10Y'];
  const days = (from, to) => (Date.parse(to) - Date.parse(from)) / DAY;
  const pct = (start, end) => (end / start - 1) * 100;
  const sorted = (a, b) => a.date.localeCompare(b.date);
  const windowPoints = (points, from, to) => points.filter(p => p.date >= from && p.date <= to);

  function groupEvents(events, today) {
    const groups = [];
    for (const event of [...events].sort(sorted)) {
      if (event.date > today) continue;
      const group = groups.at(-1);
      if (group && event.date < D.addMonths(group.at(-1).date, 12)) group.push(event);
      else groups.push([event]);
    }
    const cards = groups.reverse().map(group => ({
      id: group[0].id,
      start: D.addMonths(group[0].date, -12),
      end: D.addMonths(group.at(-1).date, 12),
      events: group
    }));
    return [{id: 'current', start: D.addMonths(today, -12), end: today, events: [], current: true}, ...cards];
  }

  function monthly(points) {
    const byMonth = new Map();
    for (const p of points) {
      byMonth.set(p.date.slice(0, 7), {...p, observationDate: p.observationDate || p.date, date: D.periodEnd(p.date, 'monthly')});
    }
    return [...byMonth.values()];
  }

  function monthlyYields(fed, sgs) {
    return Object.fromEntries(tenors.map(tenor => {
      const ust = fed.series.find(s => s.id === 'UST ' + tenor);
      return [tenor, {
        us: monthly(D.points(ust?.points, 'daily')).filter(p => days(p.observationDate, p.date) <= 5),
        sg: D.points(sgs.series[tenor], 'monthly')
      }];
    }));
  }

  function matched(a, b) {
    const other = new Map(b.map(p => [p.date, p]));
    return a.filter(p => other.has(p.date)).map(p => ({date: p.date, us: p.value, sg: other.get(p.date).value}));
  }

  function eventYieldRows(event, pairs) {
    return tenors.map(tenor => {
      const points = matched(pairs[tenor].us, pairs[tenor].sg);
      const from = points.filter(p => p.date < event.date).at(-1);
      const to = points.filter(p => p.date <= D.addMonths(event.date, 12)).at(-1);
      if (!from || !to || days(from.date, event.date) > 32 || days(to.date, D.addMonths(event.date, 12)) > 32) return {tenor};
      return {tenor, from, to, us: (to.us - from.us) * 100, sg: (to.sg - from.sg) * 100,
        spread: ((to.us - to.sg) - (from.us - from.sg)) * 100};
    });
  }

  function uniquePoints(points) {
    const dates = new Map();
    for (const p of points) {
      if (!p.date || !Number.isFinite(p.value)) continue;
      if (dates.has(p.date) && dates.get(p.date)?.value !== p.value) dates.set(p.date, null);
      else dates.set(p.date, p);
    }
    return [...dates.values()].filter(Boolean).sort(sorted);
  }

  function yoy(points) {
    const values = new Map(points.map(p => [p.date.slice(0, 7), p.value]));
    return points.flatMap(p => {
      const base = values.get(D.addMonths(p.date, -12).slice(0, 7));
      return base > 0 ? [{...p, value: pct(base, p.value)}] : [];
    });
  }

  function stockUniverse(records) {
    return records.filter(r => r.compareEligible === true && r.currency === 'USD' && / US$/.test(r.bbTicker || '') &&
      ['exact_ticker_currency', 'exact_provider_ticker_currency'].includes(r.identityStatus));
  }

  function rankStocks(card, spx, candidates, basis) {
    const indexDates = new Set(spx.map(p => p.date));
    const cohorts = new Map();
    let jumps = 0;
    for (const entry of candidates) {
      const p = windowPoints(entry.points, card.start, card.end).filter(p => indexDates.has(p.date) && p.value > 0);
      if (p.length < 4) continue;
      const from = p[0], to = p.at(-1);
      if (days(from.date, to.date) < 90) continue;
      // Unadjusted listings can jump at splits. Flag likely discontinuities for review.
      if (p.some((v, i) => i && (v.value / p[i - 1].value < 0.6 || v.value / p[i - 1].value > 1 / 0.6))) { jumps++; continue; }
      const key = from.date + '/' + to.date;
      if (!cohorts.has(key)) cohorts.set(key, []);
      cohorts.get(key).push({...entry, points: p, from, to, change: pct(from.value, to.value)});
    }
    const eligible = [...cohorts.values()].filter(c => c.length >= 6)
      .sort((a, b) => days(b[0].from.date, b[0].to.date) - days(a[0].from.date, a[0].to.date) || b.length - a.length);
    const picked = eligible[0];
    if (!picked) return null;
    picked.sort((a, b) => b.change - a.change || a.record.id.localeCompare(b.record.id));
    return {basis, jumps, count: picked.length, from: picked[0].from.date, to: picked[0].to.date,
      winners: picked.slice(0, 3), losers: picked.slice(-3).reverse()};
  }

  function chooseStockRanking(card, spx, weekly, bos) {
    const a = rankStocks(card, spx, weekly, 'Saved weekly provider closes');
    const b = rankStocks(card, spx, bos, 'BOS monthly reference prices');
    if (!a) return b;
    if (!b) return a;
    // Prefer the higher-frequency series when it covers essentially the same window.
    return days(card.start, a.from) <= days(card.start, b.from) + 35 &&
      days(a.to, card.end) <= days(b.to, card.end) + 35 ? a : b;
  }

  function anomalySeries(series, card) {
    const cutoff = card.events[0]?.date || card.start;
    return series.flatMap(s => {
      const source = s.grain === 'quarterly' ? s.points : monthly(s.points);
      const back = source.filter(p => p.date < cutoff).slice(s.grain === 'quarterly' ? -20 : -60);
      if (back.length < (s.grain === 'quarterly' ? 8 : 24)) return [];
      const mean = back.reduce((sum, p) => sum + p.value, 0) / back.length;
      const sd = Math.sqrt(back.reduce((sum, p) => sum + (p.value - mean) ** 2, 0) / (back.length - 1));
      if (!sd) return [];
      const points = windowPoints(source, card.start, card.end).map(p => ({...p, raw: p.value, value: (p.value - mean) / sd}));
      const peak = points.filter(p => p.date >= cutoff).reduce((a, p) => !a || Math.abs(p.value) > Math.abs(a.value) ? p : a, null);
      return peak ? [{...s, points, peak, mean, sd, n: back.length, first: back[0].date, last: back.at(-1).date}] : [];
    }).sort((a, b) => Math.abs(b.peak.value) - Math.abs(a.peak.value)).slice(0, 2);
  }

  const api = {tenors, days, pct, windowPoints, groupEvents, monthly, monthlyYields, matched, eventYieldRows,
    uniquePoints, yoy, stockUniverse, chooseStockRanking, anomalySeries};
  root.CrossMarketModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
