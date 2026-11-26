(function (root) {
  'use strict';

  const tenors = [2, 5, 10];
  const sectorDefinitions = [
    ['technology', 'Technology basket', ['AAPL', 'MSFT', 'NVDA']],
    ['communication', 'Communication Services basket', ['META', 'GOOG', 'NFLX']],
    ['discretionary', 'Consumer Discretionary basket', ['AMZN', 'TSLA', 'HD']],
    ['staples', 'Consumer Staples basket', ['WMT', 'COST', 'KO']],
    ['energy', 'Energy basket', ['XOM', 'CVX']],
    ['financials', 'Financials basket', ['JPM', 'BAC', 'WFC']],
    ['healthcare', 'Health Care basket', ['LLY', 'JNJ', 'ABBV']],
    ['industrials', 'Industrials basket', ['GE', 'CAT', 'RTX']],
    ['materials', 'Materials · LIN proxy', ['LIN']],
    ['utilities', 'Utilities · NEE proxy', ['NEE']],
    ['realestate', 'Real Estate', []],
    ['semiconductors', 'Semiconductors · SMH ETF', ['SMH']]
  ];

  const sectorMethod = 'The named sector baskets use a fixed group of listed USD shares and average their price changes between common observation dates, resetting to equal weight at each observation. Daily, weekly and monthly baskets are calculated separately. LIN and NEE are single-share proxies, and SMH is a traded semiconductor ETF. The broad Real Estate series is unavailable.';

  function points(raw, scale = 1, dateFor = date => date) {
    const dated = new Map();
    for (const [date, value] of raw || []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value)) {
        dated.set(dateFor(date), value * scale);
      }
    }
    return [...dated].sort(([a], [b]) => a.localeCompare(b));
  }

  function monthEnd(date) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }

  async function read(path, format = 'json') {
    try {
      const response = await root.fetch(path, {cache: 'no-cache'});
      return response.ok ? await response[format]() : null;
    } catch {
      return null;
    }
  }

  function positiveCsvPoints(text, field) {
    if (!text) return [];
    const [header, ...rows] = text.trim().split(/\r?\n/);
    const column = header.split(',').indexOf(field);
    if (column < 1) return [];
    return points(rows.map(row => {
      const columns = row.split(',');
      return [columns[0], Number(columns[column])];
    })).filter(([, close]) => close > 0);
  }

  async function marketData() {
    const [gold, spx, fred, sgsDaily, sgsMonthly, usdsgd, fredWeekly] = await Promise.all([
      read('data/metals/xau-spot.csv', 'text'),
      read('data/spx/history.json'),
      read('data/fred-daily.json'),
      read('data/sgs-daily-snapshot.json'),
      read('data/cross-market-sgs-month-end.json'),
      read('data/metals/dexsius.csv', 'text'),
      read('data/fred-weekly-yields.json')
    ]);
    function fredSeries(id, lookup, unit, group, currency) {
      const series = fred?.series?.find(row => row.id === lookup);
      return {
        id, label: lookup, unit, frequency: 'Daily', group, currency,
        points: points(series?.points, unit === 'bp' ? 100 : 1),
        source: series?.source_url, sourceLabel: 'Federal Reserve via FRED'
      };
    }
    const treasuries = tenors.map(tenor => {
      const label = `UST ${tenor}Y`;
      const series = fredSeries('UST' + tenor, label, 'bp', 'US Treasury yields');
      const column = fredWeekly?.columns?.findIndex(row => row.id === label) ?? -1;
      if (column >= 0) {
        series.alternates = [{
          frequency: 'Weekly',
          points: points(fredWeekly.observations?.map(row => [row.date, row.values?.[column]]), 100),
          source: fredWeekly.columns[column].source_url,
          sourceLabel: 'Federal Reserve via FRED'
        }];
      }
      return series;
    });
    const fx = fredSeries('USDSGD', 'USD/SGD', 'percent', 'Foreign exchange', 'SGD');
    const fxPoints = positiveCsvPoints(usdsgd, 'sgd_per_usd');
    if (fxPoints.length) fx.points = points([...fx.points, ...fxPoints]);
    fx.source ||= 'https://fred.stlouisfed.org/series/DEXSIUS';
    const singapore = tenors.map(tenor => {
      const key = tenor + 'Y';
      const index = sgsDaily?.tenors?.findIndex(row => row.label === key) ?? -1;
      return {
        id: 'SGS' + tenor, label: 'SGS ' + key, unit: 'bp', frequency: 'Daily',
        group: 'Singapore government bond yields',
        points: index < 0 ? [] : points(sgsDaily.observations?.map(row => [row.date, row.values?.[index]]), 100),
        alternates: [{points: points(sgsMonthly?.series?.[key], 100, monthEnd), frequency: 'Monthly'}],
        source: sgsDaily?.source_url || sgsMonthly?.source_url,
        sourceLabel: 'Monetary Authority of Singapore / SingStat',
        description: 'Daily MAS benchmark observations and separately sourced SingStat end-of-month benchmark yields.'
      };
    });
    return [
      {
        id: 'SPX', label: 'S&P 500', points: points(spx?.points), unit: 'percent',
        currency: 'USD', frequency: 'Daily', group: 'Equities',
        source: spx?.source_url, sourceLabel: spx?.source
      },
      {
        id: 'XAU', label: 'XAU spot gold', points: positiveCsvPoints(gold, 'usd_per_oz'), unit: 'percent',
        currency: 'USD', frequency: 'Daily', group: 'Commodities',
        source: 'tools/gold-charts.html', sourceLabel: 'Hub Gold Charts',
        description: 'Spot gold in US dollars per troy ounce.'
      },
      fx,
      ...treasuries,
      ...singapore
    ];
  }

  async function priceHistory(ticker, currency) {
    try {
      const series = await root.MarketPrices.series(ticker);
      if (series.item.currency !== currency ||
        (series.item.ticker !== ticker && !series.item.aliases?.includes(ticker))) return null;
      const positive = raw => points(raw).filter(([, close]) => close > 0);
      return {
        points: positive(series.daily),
        alternates: [
          {points: positive(series.base.weekly), frequency: 'Weekly'},
          {points: positive(series.base.monthly), frequency: 'Monthly'}
        ],
        source: root.MarketPrices.sourceUrl(series.item.history_url),
        sourceLabel: series.item.provider
      };
    } catch {
      return null;
    }
  }

  function basketPoints(series) {
    const [first, ...others] = series;
    if (!first?.length || others.some(history => !history?.length)) return [];
    const byDate = others.map(history => new Map(history));
    const result = [];
    let previous;
    let value = 100;
    for (const [date, close] of first) {
      const prices = [close, ...byDate.map(history => history.get(date))];
      if (prices.some(price => !Number.isFinite(price) || price <= 0)) continue;
      if (previous) {
        const factor = prices.reduce((sum, price, i) => sum + price / previous[i], 0) / prices.length;
        value *= factor;
      }
      result.push([date, value]);
      previous = prices;
    }
    return result;
  }

  function sectorSeries(prices) {
    return sectorDefinitions.map(([id, label, tickers]) => {
      const histories = tickers.map(ticker => prices.get(ticker));
      const base = {id, label, points: [], frequency: 'Daily', unit: 'percent', currency: 'USD'};
      if (tickers.length === 0) {
        return {...base, description: 'Real Estate has no eligible series in the Hub price feed.'};
      }
      if (tickers.length === 1) {
        return {...base, ...histories[0], description: tickers[0] === 'SMH'
          ? 'VanEck Semiconductor ETF, market price.'
          : `${tickers[0]} is the sole share in this proxy.`};
      }
      return {
        ...base,
        points: basketPoints(histories.map(history => history?.points)),
        alternates: ['Weekly', 'Monthly'].map(frequency => ({
          frequency, points: basketPoints(histories.map(history =>
            history?.alternates.find(alternate => alternate.frequency === frequency)?.points))
        })),
        description: 'Equal-weight basket of ' + tickers.join(', ') + '.',
        sourceLabel: 'Hub shared closing-price feed'
      };
    });
  }

  async function equityData() {
    const publicMembers = root.WatchlistMembership?.members;
    const watchlist = Array.isArray(publicMembers) ? publicMembers
      : (await read('data/watchlist/membership.json'))?.members || [];
    const symbols = new Map(sectorDefinitions.flatMap(([, , tickers]) => tickers.map(ticker => [ticker, 'USD'])));
    for (const member of watchlist) symbols.set(member.ticker, member.currency || 'USD');
    const prices = new Map(await Promise.all([...symbols].map(async ([ticker, currency]) =>
      [ticker, await priceHistory(ticker, currency)])));
    const shares = watchlist.map(member => ({
      id: member.ticker, label: member.ticker, description: member.name,
      points: [], frequency: 'Daily', unit: 'percent', currency: member.currency || 'USD',
      group: member.group, ...prices.get(member.ticker)
    }));
    return {shares, sectors: sectorSeries(prices)};
  }

  let result;
  function load() {
    if (!result) {
      result = Promise.all([marketData(), equityData()])
        .then(([market, equities]) => ({market, ...equities, sectorMethod}));
    }
    return result;
  }
  root.CrossMarketBeta2Data = {load};
})(typeof window !== 'undefined' ? window : globalThis);
