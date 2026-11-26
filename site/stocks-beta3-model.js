/* Filing amounts are in millions of the issuer's reporting currency. */
(function (root) {
  'use strict';
  const fields = {
    revenue: 'Revenue / total income', grossProfit: 'Gross profit', operatingIncome: 'Operating profit',
    netIncome: 'Net income to owners', cash: 'Cash and cash equivalents', currentAssets: 'Current assets',
    assets: 'Total assets', currentLiabilities: 'Current liabilities', liabilities: 'Total liabilities',
    equity: 'Equity attributable to owners', operatingCashFlow: 'Operating cash flow',
    investingCashFlow: 'Net investing cash flow', financingCashFlow: 'Net financing cash flow',
    capex: 'Cash purchases of PP&E', freeCashFlow: 'Free cash flow'
  };
  const labels = {
    revenueGrowth: 'Revenue growth', profitGrowth: 'Net income growth', grossMargin: 'Gross margin',
    operatingMargin: 'Operating margin', netMargin: 'Net margin', roe: 'Return on equity',
    roa: 'Return on assets', fcfMargin: 'Free cash flow margin', currentRatio: 'Current ratio'
  };
  const groups = [
    ['Income statement', ['revenue','grossProfit','operatingIncome','netIncome']],
    ['Balance sheet', ['cash','currentAssets','assets','currentLiabilities','liabilities','equity']],
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
  function checklist(companies, years) {
    const scores = companies.map(() => 0);
    let counted = 0;
    const rows = criteria(companies).map(key => {
      const values = companies.map((c,i) => metric(c,years[i],key));
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
  function initialPeers(data,id) {
    const peerIds = data.companies[id]?.peers || [];
    return [...new Set(peerIds)].filter(key => key !== id && data.companies[key]).slice(0,3);
  }
  function periods(companies) {
    return [...new Set(companies.flatMap(c => c.years.map(y => y.end.slice(0,4))))].sort().reverse();
  }
  const api = {fields,labels,groups,metric,yearFor,priorYear,financial,criteria,leaders,checklist,initialPeers,periods};
  root.FilingComparison = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

