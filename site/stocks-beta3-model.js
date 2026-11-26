/* Filing amounts are in millions of the issuer's reporting currency. */
(function (root) {
  'use strict';
  const fields = {
    revenue: 'Revenue / total income', grossProfit: 'Gross profit', operatingIncome: 'Operating profit',
    netIncome: 'Net income to owners', cash: 'Cash and cash equivalents', currentAssets: 'Current assets',
    assets: 'Total assets', currentLiabilities: 'Current liabilities', liabilities: 'Total liabilities',
    equity: 'Equity attributable to owners', operatingCashFlow: 'Operating cash flow',
    investingCashFlow: 'Net investing cash flow', financingCashFlow: 'Net financing cash flow',
    capex: 'Cash purchases of PP&E', freeCashFlow: 'Free cash flow', netCommon:'Net income to common shareholders',
    ebitda:'EBITDA', depreciationAmortization:'Depreciation and amortisation', totalDebt:'Interest-bearing debt'
  };
  const labels = {
    revenueGrowth: 'Revenue growth', profitGrowth: 'Net income growth', grossMargin: 'Gross margin',
    operatingMargin: 'Operating margin', netMargin: 'Net margin', roe: 'Return on equity',
    roa: 'Return on assets', fcfMargin: 'Free cash flow margin', currentRatio: 'Current ratio',
    cashMargin:'Operating cash flow margin', debtEquity:'Debt / equity', assetTurnover:'Asset turnover',
    equityRatio:'Equity / assets', cashConversion:'Operating cash flow / net income'
  };
  const groups = [
    ['Income statement', ['revenue','grossProfit','operatingIncome','depreciationAmortization','ebitda','netIncome','netCommon']],
    ['Balance sheet', ['cash','currentAssets','assets','currentLiabilities','liabilities','totalDebt','equity']],
    ['Cash flow statement', ['operatingCashFlow','investingCashFlow','financingCashFlow','capex','freeCashFlow']]
  ];
  function yearFor(company, period) {
    return period === 'latest' ? company.years[0] : company.years.find(year => year.end.slice(0,4) === period);
  }
  function priorYear(company, year) {
    if (!year) return;
    return company.years.find(previous => {
      const days = (Date.parse(year.end) - Date.parse(previous.end)) / 86400000;
      return days >= 325 && days <= 385;
    });
  }
  const financial = c => ['bank','broker','insurer','reit','asset-manager'].includes(c.model);
  function metric(company, year, key) {
    if (!year) return null;
    const current = year.values;
    const prev = priorYear(company, year)?.values || {};
    const valid = Number.isFinite;
    const ratio = (a,b) => valid(a) && valid(b) && b > 0 ? 100 * a / b : null;
    function growth(k) {
      return valid(current[k]) && valid(prev[k]) ? ratio(current[k] - prev[k],prev[k]) : null;
    }
    function returns(balance) {
      return valid(current[balance]) && current[balance] > 0 && valid(prev[balance]) && prev[balance] > 0
        ? ratio(current.netIncome, (current[balance] + prev[balance]) / 2) : null;
    }
    if (Object.hasOwn(fields,key) && key !== 'freeCashFlow') return valid(current[key]) ? current[key] : null;
    switch (key) {
      case 'revenueGrowth': return growth('revenue');
      case 'profitGrowth': return growth('netIncome');
      case 'roe': return returns('equity');
      case 'roa': return returns('assets');
      case 'cashMargin': return financial(company) ? null : ratio(current.operatingCashFlow,current.revenue);
      case 'debtEquity': return !financial(company) && valid(current.totalDebt) && current.equity>0 ? current.totalDebt/current.equity : null;
      case 'equityRatio': return ratio(current.equity,current.assets);
      case 'cashConversion': return !financial(company) && valid(current.operatingCashFlow) && current.netIncome>0 ? current.operatingCashFlow/current.netIncome : null;
      case 'assetTurnover': return !financial(company) && valid(current.revenue) && current.assets>0 && prev.assets>0 ? current.revenue/((current.assets+prev.assets)/2) : null;
      case 'freeCashFlow': return !financial(company) && valid(current.operatingCashFlow) && valid(current.capex)
        ? current.operatingCashFlow - current.capex : null;
      case 'grossMargin': return financial(company) ? null : ratio(current.grossProfit,current.revenue);
      case 'operatingMargin': return financial(company) ? null : ratio(current.operatingIncome,current.revenue);
      case 'netMargin': return financial(company) ? null : ratio(current.netIncome,current.revenue);
      case 'fcfMargin': return ratio(metric(company,year,'freeCashFlow'),current.revenue);
      case 'currentRatio': return !financial(company) && valid(current.currentAssets) && valid(current.currentLiabilities) &&
        current.currentLiabilities > 0 ? current.currentAssets / current.currentLiabilities : null;
      default: return null;
    }
  }
  function criteria(companies) {
    return companies.some(financial) ? ['revenueGrowth','profitGrowth','roe','roa']
      : ['revenueGrowth','profitGrowth','operatingMargin','netMargin','roe','fcfMargin'];
  }
  function leaders(values) {
    if (values.length < 2 || !values.every(Number.isFinite)) return [];
    const rounded = values.map(n => Number(n.toFixed(1)));
    const best = Math.max(...rounded);
    return rounded.flatMap((v,i) => v === best ? [i] : []);
  }
  function checklist(companies, years, measure=(c,i,key)=>metric(c,years[i],key)) {
    const scores = companies.map(() => 0);
    let counted = 0;
    const rows = criteria(companies).map(key => {
      const values = companies.map((c,i) => measure(c,i,key));
      const winners = leaders(values);
      if (winners.length) {
        counted++;
        for (const i of winners) scores[i] += 1 / winners.length;
      }
      return {key,values,winners};
    });
    const best = Math.max(...scores);
    const winners = counted ? scores.flatMap((s,i) => Math.abs(s-best) < 1e-8 ? [i] : []) : [];
    return {rows,scores,counted,winners};
  }
  function initialPeers(data,id,size,reportPeers) {
    const comparison=root.SharesComparison || (typeof module!=='undefined' ? require('./stocks-beta3-comparison.js') : null);
    return comparison.select(data,id,size,reportPeers);
  }
  function periods(companies) {
    return [...new Set(companies.flatMap(c => c.years.map(y => y.end.slice(0,4))))].sort().reverse();
  }
  async function loadPublished() {
    const path = 'data/shares-beta3-annual-filings-2026-11-26.json';
    const response = await root.fetch(root.ContentDelivery.CONTENT + path, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('Annual filing data is unavailable.');
    const data = await response.json();
    if (!Array.isArray(data.listings) || data.listings.length !== 110 || !data.companies) {
      throw Error('Invalid annual filing coverage.');
    }
    return data;
  }
  const api = {fields,labels,groups,metric,yearFor,priorYear,financial,criteria,leaders,checklist,initialPeers,periods,loadPublished};
  root.FilingComparison = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

