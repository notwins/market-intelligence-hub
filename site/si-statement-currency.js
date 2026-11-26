/* Exact-listing corrections for the reviewed Morningstar quarterly exports. */
(function (root) {
  'use strict';

  // Cross-listed exports can repeat consolidated figures under the trading
  // currency. These exceptions were checked against issuer filings or the
  // matching home listing. The underlying private archive is untouched.
  const reportingCurrencies = new Map(Object.entries({
    'TSM US': 'TWD', 'ASML US': 'EUR', 'RY US': 'CAD', 'SHOP CN': 'USD',
    'SMSN LI': 'KRW', 'SKHY US': 'KRW', 'BABA US': 'CNY',
    '700 HK': 'CNY', '9988 HK': 'CNY', '1288 HK': 'CNY', '1398 HK': 'CNY',
    '3988 HK': 'CNY', '857 HK': 'CNY', '939 HK': 'CNY', '941 HK': 'CNY',
    '5 HK': 'USD', 'HSBA LN': 'USD', 'SHEL LN': 'USD', 'SHELL NA': 'USD',
    'BHP LN': 'USD', 'BHP AU': 'USD', 'WIL SP': 'USD', 'YZJSGD SP': 'CNY',
    'AZN LN': 'USD', 'TTE FP': 'USD', 'NOVN SW': 'USD'
  }));
  const mixedFlowPeriods = new Set(['3988 HK', '601988 CH', '857 HK', '601857 CH', '939 HK', '601939 CH']);
  const semiannualFlowPeriods = new Set(['BHP LN', 'BHP AU', 'WIL SP', 'YZJSGD SP']);
  const reportingCurrency = (id, report) => report && (report.normalizedCurrency
    ? report.currency : reportingCurrencies.get(id) || report.currency);
  const tradingCurrency = code => /^(GBX|GBp)$/.test(code) ? 'GBP' : /^[A-Z]{3}$/.test(code || '') ? code : '';

  function translation(archive, from, to, asOf) {
    if (from === to) return null;
    if (archive?.schema_version !== 1 || archive.frequency !== 'weekly' ||
        !Array.isArray(archive.columns) || !Array.isArray(archive.observations) ||
        !/^\d{4}-\d\d-\d\d$/.test(asOf || '') || !Number.isFinite(Date.parse(asOf))) return null;
    const leg = code => {
      if (code === 'USD') return () => 1;
      const index = archive.columns.findIndex(col =>
        col.id === 'USD/' + code || col.id === code + '/USD');
      if (index < 0) return () => null;
      const inverse = archive.columns[index].id.startsWith(code + '/');
      return row => {
        const value = row.values?.[index];
        return Number.isFinite(value) && value > 0 ? (inverse ? 1 / value : value) : null;
      };
    };
    const sourceLeg = leg(from), targetLeg = leg(to);
    const earliest = new Date(Date.parse(asOf) - 35 * 86400000).toISOString().slice(0, 10);
    let latest = null;
    for (const row of archive.observations) {
      if (row.date < earliest || row.date > asOf || (latest && row.date <= latest.date)) continue;
      const source = sourceLeg(row), target = targetLeg(row);
      if (source && target) latest = { from, to, rate: target / source, date: row.date };
    }
    return latest;
  }

  let archiveRequest;
  async function forListing(info, code) {
    const target = tradingCurrency(code);
    const company = info?.company;
    const sourceCodes = [...new Set(Object.values(company?.quarterly || {})
      .map(report => reportingCurrency(info?.id, report)).filter(Boolean))];
    if (!target || !sourceCodes.some(from => from !== target)) return {};
    archiveRequest ??= root.fetch('data/fred-weekly-fx.json', { signal: AbortSignal.timeout(5000) })
      .then(response => {
        if (!response.ok) throw new Error('FX observations unavailable');
        return response.json();
      }).catch(() => { archiveRequest = null; return null; });
    const archive = await archiveRequest;
    return Object.fromEntries(sourceCodes.map(from =>
      [from, translation(archive, from, target, company.quarterlyCapturedAt)]));
  }

  const api = { forListing, reportingCurrency, tradingCurrency, translation, mixedFlowPeriods, semiannualFlowPeriods };
  root.SIStatementCurrency = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
