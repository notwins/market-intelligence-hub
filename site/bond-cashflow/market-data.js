/* Market Intel's public feeds and the existing, opt-in Bonds BETA browser archive. */
window.BondCashflowMarket = (() => {
  'use strict';
  const data = window.BondsBetaData;
  const feed = 'data/Bond%20Prices%20-%20Type%20JSON%20-%2016-Nov-03.10.json';
  const temasek = 'US87973RAW07';
  const specialTerms = {
    isin: temasek,
    currency: 'USD',
    name: 'Temasek Financial (I) 2.5% · 2070-10-06',
    coupon: 2.5,
    maturity: '2070-10-06',
    frequency: 2,
    structure: 'callable-proxy',
    minimum: 250000,
    increment: 1000,
    dayCount: '30/360'
  };
  const dateOK = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date);
  const positive = (x) => Number.isFinite(x) && x > 0;

  async function json(path) {
    const response = await fetch(path, { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw Error('Feed unavailable');
    return response.json();
  }

  function monthlyHistory(payload) {
    const fields = new Map([
      ['EXSIUS', 'fx'],
      ['GS10', 'y10'],
      ['GS20', 'y20'],
      ['GS30', 'y30']
    ]);
    const dates = new Map();
    for (const series of payload.series) {
      const key = fields.get(series.provider_series);
      if (!key) continue;
      for (const [date, value] of series.points) {
        if (!dateOK(date) || !Number.isFinite(value)) continue;
        if (!dates.has(date)) dates.set(date, { date });
        dates.get(date)[key] = value;
      }
    }
    return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function askHistory(payload) {
    const asks = new Map();
    for (const item of payload.instruments) {
      const quotes = [...(payload.history[item.id] || [])].filter(
        (q) => dateOK(q.date) && positive(q.ask)
      );
      quotes.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.observed_at.localeCompare(b.observed_at) ||
          (a.retrieved_at || '').localeCompare(b.retrieved_at || '')
      );
      asks.set(item.isin + '|' + item.currency, quotes);
    }
    return asks;
  }

  function reference(bond, settlement) {
    if (!bond || !dateOK(settlement)) return null;
    const ask = bond.asks?.findLast((q) => q.date <= settlement);
    const bid = bond.bids?.findLast((q) => q.date <= settlement);
    if (ask && (!bid || ask.date >= bid.date)) {
      return {
        price: ask.ask,
        priceDate: ask.date,
        priceSource: ask.source + ' ask',
        side: 'ask'
      };
    }
    if (bid)
      return {
        price: bid.value,
        priceDate: bid.date,
        priceSource: bid.source + ' bid',
        side: 'bid'
      };
    return null;
  }

  function studioBond(item, asks) {
    const id = item.isin + '|' + item.currency;
    const matchedTemasek =
      item.isin === temasek &&
      item.currency === 'USD' &&
      (item.coupon == null || item.coupon === specialTerms.coupon) &&
      (!item.maturity || item.maturity === specialTerms.maturity);
    const terms = matchedTemasek
      ? specialTerms
      : item.isTreasury
        ? {
            frequency: 2,
            structure: 'fixed',
            minimum: 100,
            increment: 100,
            dayCount: 'ACT/ACT'
          }
        : {};
    const bids = [...item.rows]
      .filter(([, quote]) => positive(quote.bid))
      .map(([date, quote]) => ({
        date,
        value: quote.bid,
        source: data.sources[quote.source][0]
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { ...item, ...terms, id, bids, asks: asks.get(id) || [] };
  }

  function fxReference(series, currency, settlement, capital = 'SGD') {
    if (!dateOK(settlement) || currency === capital) return null;
    const direct = series.find((s) => s.id === currency + '/' + capital);
    const inverse = series.find((s) => s.id === capital + '/' + currency);
    const source = direct || inverse;
    const point = source?.points.findLast(
      ([date, v]) => date <= settlement && positive(v)
    );
    return (
      point && {
        date: point[0],
        value: direct ? point[1] : 1 / point[1],
        source: 'Market Intel · FRED daily ' + source.id
      }
    );
  }

  async function load() {
    const tasks = [
      [
        'Bond watchlist',
        json(feed).then((payload) => ({
          observed: data.publicHistory(payload),
          asks: askHistory(payload)
        }))
      ],
      [
        'Treasury catalogue',
        json('data/treasury-catalogue.json').then(data.treasuryCatalogue)
      ],
      [
        'Saved browser history',
        data
          .historyStorage('get')
          .then((text) => (text ? data.readHistory(text) : new Map()))
      ],
      [
        'Daily FRED history',
        json('data/fred-daily.json').then((payload) => ({
          curves: data.fredCurves(payload),
          fx: payload.series.filter((s) => s.family === 'fx')
        }))
      ],
      [
        'Monthly FRED history',
        json('data/history-fed.json').then(monthlyHistory)
      ],
      ['Historical event labels', json('bond-cashflow/events.json')]
    ];
    const results = await Promise.allSettled(tasks.map(([, task]) => task));
    const missing = tasks
      .filter((_, i) => results[i].status === 'rejected')
      .map(([name]) => name);
    const [
      quotes,
      catalogue = new Map(),
      local = new Map(),
      daily,
      history = [],
      events = []
    ] = results.map((r) => r.value);
    const observed = quotes?.observed || new Map();
    const merged = data.mergeCatalogue(
      data.mergeHistory(observed, local),
      catalogue
    );
    const bonds = [...merged.values()].map((item) =>
      studioBond(item, quotes?.asks || new Map())
    );
    const byId = new Map(bonds.map((b) => [b.id, b]));
    const quick = [...observed.keys()].map((k) => byId.get(k));
    const fx = daily?.fx || [];
    return {
      quick,
      catalogue: bonds,
      history,
      events,
      curves: daily?.curves || [],
      fx,
      missing,
      historySource: 'Market Intel · FRED monthly averages',
      historyFrom: history[0]?.date || '',
      historyTo: history.at(-1)?.date || '',
      localCount: local.size,
      demoBond: byId.get(temasek + '|USD') || {
        ...specialTerms,
        id: 'temasek-example',
        bids: [],
        rows: new Map()
      },
      temasekSource:
        'https://www.temasek.com.sg/en/our-financials/temasek-bonds/temasek-financial-i-bonds',
      callSource:
        'https://www.boerse-stuttgart.de/en/products/bonds/stuttgart-fxplus/a283c6-temasek-financial-i-ltd-dl-med--t-nts-2020-20-70-reg-s',
      seriesSources: Object.fromEntries(
        [
          ['fx', 'EXSIUS'],
          ['y10', 'GS10'],
          ['y20', 'GS20'],
          ['y30', 'GS30']
        ].map(([k, s]) => [k, 'https://fred.stlouisfed.org/series/' + s])
      )
    };
  }
  return { load, reference, fxReference };
})();
