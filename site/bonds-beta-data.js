/* Dated quotes and the wide Bonds BETA history CSV. No storage or network writes. */
((root) => {
  'use strict';

  const sources = Object.freeze({
    BOS_YTM: ['BOS', 'Yield to maturity'], OCBC_YTM: ['BOS–OCBC', 'Yield to maturity'],
    WSJ_ASK: ['WSJ', 'Asked yield'], BSM_YTM: ['Bondsupermart', 'Bid yield to maturity'],
    BSM_YTW: ['Bondsupermart', 'Bid yield to worst'],
  });
  const fields = new Map([['Bid Price', 'bid'], ['Yield (%)', 'yield'], ['Quote Source', 'source'], ['ACE Fixed AR Snapshot (%)', 'ar']]);
  const dateOk = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const number = value => /^[-+]?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : null;
  const identity = (isin, currency) => `${isin}|${currency}`;
  const validId = (isin, currency) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) && /^[A-Z]{3}$/.test(currency);

  function publicHistory(data) {
    if (data.schema_version !== 1 || !Array.isArray(data.instruments) || !data.history) throw Error('Unexpected watchlist format.');
    return new Map(data.instruments.filter(item => validId(item.isin, item.currency)).map(item => {
      const rows = new Map();
      const history = [...(data.history[item.id] || [])].sort((a, b) => a.observed_at.localeCompare(b.observed_at)
        || (a.retrieved_at || '').localeCompare(b.retrieved_at || ''));
      for (const entry of history) {
        const source = { 'Asked yield': 'WSJ_ASK', 'Bid yield to maturity': 'BSM_YTM', 'Bid yield to worst': 'BSM_YTW' }[entry.yield_basis];
        if (!dateOk(entry.date) || !source) continue;
        const bid = Number.isFinite(entry.bid) && entry.bid > 0 ? entry.bid : null;
        const yieldValue = Number.isFinite(entry.yield_pct) ? entry.yield_pct : null;
        if (bid != null || yieldValue != null) rows.set(entry.date, { bid, yield: yieldValue, source });
      }
      return [identity(item.isin, item.currency), { ...item, rows, ar: null, isTreasury: item.source === 'WSJ' }];
    }));
  }

  function historyStorage(action, content) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('market-intel-bonds-beta', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('history');
      let blocked = false;
      request.onblocked = () => { blocked = true; reject(Error('Browser history storage is busy.')); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        try {
          const tx = db.transaction('history', action === 'get' ? 'readonly' : 'readwrite');
          const store = tx.objectStore('history');
          const key = 'bond-history-csv';
          const operation = action === 'get' ? store.get(key) : action === 'save' ? store.put(content, key) : store.delete(key);
          tx.oncomplete = () => { db.close(); resolve(operation.result); };
          tx.onabort = () => { db.close(); reject(tx.error || Error('Browser history storage was interrupted.')); };
        } catch (error) { db.close(); reject(error); }
      };
    });
  }

  function* splitCsv(content) {
    let row = [], cell = '', quoted = false, ended = false;
    for (let index = content.charCodeAt(0) === 0xFEFF ? 1 : 0; index < content.length; index++) {
      const ch = content[index];
      if (quoted) {
        if (ch !== '"') cell += ch;
        else if (content[index + 1] === '"') { cell += ch; index++; }
        else { quoted = false; ended = true; }
      } else if (ch === ',' || ch === '\r' || ch === '\n') {
        row.push(cell); cell = ''; ended = false;
        if (ch !== ',') {
          if (ch === '\r' && content[index + 1] === '\n') index++;
          if (row.length > 1 || row[0]) yield row;
          row = [];
        }
      } else if (ch === '"' && !cell && !ended) quoted = true;
      else {
        if (ch === '"' || ended) throw Error('A CSV field contains stray quotation marks.');
        cell += ch;
      }
    }
    if (quoted) throw Error('A CSV field has a missing closing quote.');
    if (cell || row.length) yield [...row, cell];
  }

  function readHistory(content) {
    const rows = splitCsv(content);
    const header = rows.next().value;
    if (header?.[0] !== 'Date' || header.length > 16384 || header.length < 5) throw Error('Choose the wide Bonds BETA history CSV.');
    const instruments = new Map();
    header.slice(1).forEach((item, i) => {
      const [isin, currency, name, label, extra] = item.split(' | ');
      const field = fields.get(label);
      if (!field || !validId(isin, currency) || extra !== undefined) throw Error('The CSV column headings do not match Bonds BETA.');
      const key = identity(isin, currency);
      if (!instruments.has(key)) instruments.set(key, { isin, currency, name, rows: new Map(), columns: {}, ar: null });
      const instrument = instruments.get(key);
      if (instrument.columns[field] !== undefined) throw Error('Duplicate bond field in the CSV.');
      instrument.columns[field] = i + 1;
    });
    if ([...instruments.values()].some(item => Object.keys(item.columns).length !== fields.size)) throw Error('A bond is missing a CSV column.');
    let previous = '';
    let observations = 0;
    for (const row of rows) {
      const date = row[0];
      if (row.length !== header.length || !dateOk(date) || date <= previous) throw Error('The CSV dates must be unique, valid and in ascending order.');
      previous = date;
      for (const item of instruments.values()) {
        const { bid, yield: y, source, ar } = item.columns;
        if (row[ar]) {
          const rate = number(row[ar]);
          if (rate === null || rate < 0 || rate > 100 || item.ar !== null) throw Error('Invalid or repeated ACE snapshot rate.');
          item.ar = rate;
        }
        if (!row[bid] && !row[y] && !row[source]) continue;
        const price = number(row[bid]), yieldValue = number(row[y]);
        if (!Object.hasOwn(sources, row[source]) || (row[bid] && !(price > 0)) || (row[y] && yieldValue === null)) {
          throw Error('A saved quote contains an invalid price, yield or source.');
        }
        if (price !== null || yieldValue !== null) {
          item.rows.set(date, { bid: price, yield: yieldValue, source: row[source] });
          observations++;
        }
      }
    }
    if (!observations) throw Error('The CSV has no usable dated bond quotes.');
    return instruments;
  }

  function mergeHistory(builtIn, imported) {
    const combined = new Map(imported);
    for (const [key, saved] of builtIn) {
      const local = imported.get(key);
      combined.set(key, { ...saved, rows: new Map([...(local?.rows || []), ...saved.rows]), ar: local?.ar ?? null });
    }
    return combined;
  }

  function treasuryCatalogue(data) {
    if (data?.schema_version !== 1 || !dateOk(data.latest_auction_date) ||
        !Array.isArray(data.instruments) || !data.instruments.length) throw Error('Unexpected Treasury catalogue format.');
    const catalogue = new Map();
    for (const [isin, type, coupon, issueDate, maturity, termMonths] of data.instruments) {
      const key = identity(isin, 'USD');
      if (!/^US912[A-Z0-9]{6}\d$/.test(isin) || !['Note', 'Bond'].includes(type) || !Number.isFinite(coupon) ||
          coupon <= 0 || !dateOk(issueDate) || !dateOk(maturity) || issueDate >= maturity || catalogue.has(key) ||
          (termMonths != null && (!Number.isSafeInteger(termMonths) || termMonths < 12))) {
        throw Error('Invalid Treasury catalogue terms.');
      }
      catalogue.set(key, { isin, type, coupon, issueDate, maturity, termMonths: termMonths ?? null, currency: 'USD', isTreasury: true,
        name: `US Treasury ${type} ${coupon}% · ${maturity}` });
    }
    return catalogue;
  }

  function mergeCatalogue(observed, catalogue) {
    const combined = new Map(observed);
    for (const [key, terms] of catalogue) {
      const saved = combined.get(key);
      // Do not attach a different coupon or maturity to quotes for a conflicting public identity.
      if (saved?.maturity && (saved.maturity !== terms.maturity || saved.coupon !== terms.coupon)) continue;
      combined.set(key, { ...saved, ...terms, name: saved?.name ?? terms.name,
        rows: saved?.rows ?? new Map(), ar: saved?.ar ?? null });
    }
    return combined;
  }

  const dayMs = 86400000;
  const utcDate = date => new Date(date + 'T00:00:00Z');
  const tenors = new Map([['DGS1MO', 1 / 12], ['DGS3MO', .25], ['DGS6MO', .5], ['DGS1', 1],
    ['DGS2', 2], ['DGS3', 3], ['DGS5', 5], ['DGS7', 7], ['DGS10', 10], ['DGS20', 20], ['DGS30', 30]]);

  function fredCurves(data) {
    if (data?.schemaVersion !== 1 || !Array.isArray(data.series)) throw Error('Unexpected FRED history format.');
    const curves = new Map();
    for (const series of data.series) {
      const tenor = tenors.get(series.provider_series);
      if (!tenor || series.family !== 'ust' || !Array.isArray(series.points)) continue;
      for (const [date, rate] of series.points) {
        if (!dateOk(date) || !Number.isFinite(rate) || rate <= -200) continue;
        // Treasury suspended the published 30-year constant maturity rate during this interval.
        if (tenor === 30 && date >= '2002-02-18' && date < '2006-02-09') continue;
        if (!curves.has(date)) curves.set(date, new Map());
        curves.get(date).set(tenor, rate);
      }
    }
    return [...curves].filter(([, rates]) => rates.size >= 2).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rates]) => ({ date, settlement: utcDate(date), rates: [...rates].sort(([a], [b]) => a - b) }));
  }

  async function loadFredCurves() {
    const response = await fetch('data/fred-daily.json', { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('FRED history unavailable');
    return fredCurves(await response.json());
  }

  function yieldAt(rates, years) {
    const [lower, low] = rates.findLast(([tenor]) => tenor <= years) ?? rates[0];
    const [upper, high] = rates.find(([tenor]) => tenor >= years) ?? rates.at(-1);
    return { lower, upper, rate: lower === upper ? low : low + (high - low) * (years - lower) / (upper - lower) };
  }

  function sampleCurves(curves, start, cutoff) {
    const eligible = curves.filter(curve => curve.date >= start && curve.date < cutoff);
    if (!eligible.length) return [];
    // Use the first available date and the last published observation in each month.
    const months = new Map(eligible.map(curve => [curve.date.slice(0, 7), curve]));
    return [...new Set([eligible[0], ...months.values()])];
  }

  function reconstructedPrices(instrument, curves, { cleanPrice, offsetMonth }) {
    const { isTreasury, currency, maturity, coupon, rows } = instrument;
    if (!isTreasury || currency !== 'USD' || !dateOk(maturity) || !Number.isFinite(coupon) || coupon <= 0) return null;
    const end = utcDate(maturity);
    const start = offsetMonth(end, -360).toISOString().slice(0, 10);
    const observed = [...rows].sort(([a], [b]) => a.localeCompare(b));
    const firstBid = observed.find(([, quote]) => quote.bid > 0)?.[0];
    const firstYield = observed.find(([, quote]) => Number.isFinite(quote.yield))?.[0];
    const cutoff = first => first && first < maturity ? first : maturity;
    const priceSamples = sampleCurves(curves, start, cutoff(firstBid));
    const yieldSamples = cutoff(firstYield) === cutoff(firstBid) ? priceSamples : sampleCurves(curves, start, cutoff(firstYield));
    const estimate = ({ settlement, rates }) => {
      const years = Math.min(30, (end - settlement) / (365.2425 * dayMs));
      return { years, ...yieldAt(rates, years) };
    };
    const yields = new Map(yieldSamples.map(curve => [curve.date, estimate(curve)]));
    const points = new Map();
    for (const curve of priceSamples) {
      const benchmark = yields.get(curve.date) ?? estimate(curve);
      const price = cleanPrice(end, curve.settlement, coupon, benchmark.rate);
      if (Number.isFinite(price) && price > 0) points.set(curve.date, { price, ...benchmark });
    }
    return points.size || yields.size ? { start, points, yields, firstBid, firstYield } : null;
  }

  function annualPriceChanges(instrument, from, to) {
    const years = new Map();
    for (const [date, { bid }] of [...instrument.rows].sort(([a], [b]) => a.localeCompare(b))) {
      if (date < from || date > to || !(bid > 0)) continue;
      const year = date.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push({ date, bid });
    }
    return [...years].reverse().filter(([, bids]) => bids.length >= 2).map(([year, bids]) => {
      const first = bids[0], last = bids.at(-1);
      return { year, first, last, change: (last.bid / first.bid - 1) * 100 };
    });
  }

  const api = { sources, historyStorage, publicHistory, readHistory, mergeHistory, treasuryCatalogue, mergeCatalogue,
    annualPriceChanges, fredCurves, loadFredCurves, reconstructedPrices };
  if (typeof module !== 'undefined') module.exports = api;
  root.BondsBetaData = api;
})(globalThis);
