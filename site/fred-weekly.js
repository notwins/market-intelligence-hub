/* One reader for the published Friday-ending FRED files. */
((root) => {
  'use strict';
  const dayMs = 86400000;
  const date = value => {
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw Error('Invalid FRED date');
    return parsed;
  };
  const requests = new Map();

  function series(data, dataset) {
    if (data?.schema_version !== 1 || data.frequency !== 'weekly' ||
        !Array.isArray(data.columns) || !Array.isArray(data.observations) || !data.observations.length) {
      throw Error('Invalid weekly FRED dataset');
    }
    const ids = new Set();
    const result = data.columns.map(column => {
      if (!column.id || ids.has(column.id)) throw Error('Invalid weekly FRED column');
      ids.add(column.id);
      return { ...column, frequency: 'weekly', family: dataset === 'fx' ? 'fx' : column.kind === 'real' ? 'tips' : 'ust',
        source: data.source, derived: !!column.formula, basis: data.basis, aggregation: data.basis,
        points: [], missing_periods: [] };
    });
    let previous = null;
    for (const row of data.observations) {
      const week = date(row.week_ending), day = date(row.date);
      if (week.getUTCDay() !== 5 || day > week || week - day > 4 * dayMs ||
          (previous !== null && +week <= previous) || !Array.isArray(row.values) || row.values.length !== result.length) {
        throw Error('Invalid FRED observation week');
      }
      if (previous !== null) {
        for (let gap = previous + 7 * dayMs; gap < +week; gap += 7 * dayMs) {
          const label = new Date(gap).toISOString().slice(0, 10);
          for (const item of result) if (item.points.length) item.missing_periods.push(label);
        }
      }
      previous = +week;
      row.values.forEach((value, i) => {
        const item = result[i];
        if (value === null) {
          if (item.points.length) item.missing_periods.push(row.date);
          return;
        }
        if (!Number.isFinite(value) || (dataset === 'fx' ? value <= 0 : value < -10 || value > 100)) {
          throw Error('Invalid weekly FRED value');
        }
        item.points.push([row.date, value]);
      });
    }
    return result.filter(item => item.points.length).map(item => ({
      ...item, latest_observation: item.points.at(-1)[0], retrieved_at: data.retrieved_at
    }));
  }

  function load(dataset, refresh = false) {
    if (refresh) requests.delete(dataset);
    if (!requests.has(dataset)) {
      const request = fetch('data/fred-weekly-' + dataset + '.json', {
        cache: 'no-cache', signal: AbortSignal.timeout(15000)
      }).then(async response => {
        if (!response.ok) throw Error('Weekly FRED history unavailable');
        const data = await response.json();
        return { data, series: series(data, dataset) };
      }).catch(error => {
        if (requests.get(dataset) === request) requests.delete(dataset);
        throw error;
      });
      requests.set(dataset, request);
    }
    return requests.get(dataset);
  }

  const api = { series, load };
  root.FredWeekly = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
