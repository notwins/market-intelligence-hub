// NVIDIA's unaudited consolidated figures, in USD millions, millions of shares, or USD per share.
// Income and cash flow use the three-month column. Cash outflows retain the negative sign.
(function (root) {
  'use strict';

  const supplementalUrl = 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/supplementalfinancialinfor.htm';
  const commentaryUrl = 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/q3fy27cfocommentary.htm';
  const priorFilingUrl = 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000075/nvda-20260726.htm';
  const firstQuarterUrl = 'https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-First-Quarter-Fiscal-2027/';
  const fourthQuarterUrl = 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026/';

  root.AccumulatorNvdaFinancialData = {
    quarter: 'Q3 FY2027',
    periodStart: '2026-07-27',
    periodEnd: '2026-10-25',
    published: '2026-11-17',
    verifiedThrough: '2026-11-23',
    sources: [
      {label: 'Full income statement, balance sheet and cash flows · Q3 FY2027, SEC Exhibit 99.3', url: supplementalUrl},
      {label: 'NVIDIA CFO commentary · Q3 earnings and filing status', url: commentaryUrl},
      {label: 'Q2 FY2027 Form 10-Q · dated shares outstanding and intangible amortization', url: priorFilingUrl},
      {label: 'Q1 FY2027 earnings · diluted EPS', url: firstQuarterUrl},
      {label: 'Q4 FY2026 earnings · diluted EPS', url: fourthQuarterUrl}
    ],
    balance: {
      cash: 29089,
      marketableDebtSecurities: 24423,
      marketableEquitySecurities: 44219,
      receivables: 81033,
      inventories: 39724,
      prepaidAndOtherCurrentAssets: 3506,
      currentAssets: 221994,
      propertyAndEquipment: 19227,
      operatingLeaseAssets: 6383,
      goodwill: 26451,
      intangibleAssets: 4056,
      deferredTaxAssets: 11383,
      nonmarketableSecurities: 65528,
      otherAssets: 17166,
      assets: 372188,
      payables: 21074,
      accruedAndOtherCurrentLiabilities: 33287,
      shortTermDebt: 0,
      currentLiabilities: 54361,
      longTermDebt: 32371,
      longTermOperatingLeaseLiabilities: 5777,
      otherLongTermLiabilities: 13013,
      liabilities: 105522,
      equity: 266666,
      sharesOutstanding: 24100,
      sharesOutstandingDate: '2026-08-21',
      sharesOutstandingNote: 'NVIDIA reported 24.1 billion common shares outstanding on August 21. Per-share balance-sheet and enterprise-value figures use that rounded count as an estimate for October.'
    },
    income: {
      revenue: 115844,
      costOfRevenue: 29168,
      grossProfit: 86676,
      researchAndDevelopment: 7454,
      sellingGeneralAndAdministrative: 1702,
      operatingExpenses: 9156,
      operatingIncome: 77520,
      otherIncomeNet: 1497,
      pretaxIncome: 79017,
      incomeTax: 13730,
      netIncome: 65287,
      basicEps: 2.71,
      dilutedEps: 2.70,
      basicShares: 24106,
      dilutedShares: 24186,
      intangibleAmortization: null,
      intangibleAmortizationNote: 'The Q3 release groups intangible amortization with transaction and compensation costs. The cash flow statement reports depreciation and amortization together.',
      trailingDilutedEps: 9.31
    },
    cashFlow: {
      netIncome: 65287,
      stockCompensation: 2088,
      depreciationAndAmortization: 1254,
      deferredTaxes: 676,
      derivativeLosses: 492,
      equitySecurityGains: -1767,
      otherAdjustments: -183,
      receivableChange: -18052,
      inventoryChange: -8148,
      prepaidAndOtherAssetChange: -1366,
      payableChange: 4424,
      accruedLiabilityChange: 1651,
      otherLongTermLiabilityChange: 1897,
      operating: 48253,
      debtSecurityProceeds: 21258,
      equitySecurityProceeds: 2253,
      equitySecurityPurchases: -15696,
      debtSecurityPurchases: -11414,
      capitalPurchases: -4422,
      acquisitionsAndOther: -2718,
      investing: -10739,
      debtIssuance: 0,
      employeeStockPlanProceeds: 279,
      shareRepurchases: -22122,
      dividends: -6026,
      employeeStockPlanTaxPayments: -1707,
      groqPayments: 0,
      debtRepayment: -1000,
      capitalPrincipalPayments: -54,
      otherFinancing: -238,
      financing: -30868,
      netChangeInCash: 6646,
      beginningCash: 22443,
      endingCash: 29089
    },
    earningsQuarters: [
      {end: '2026-01-25', published: '2026-02-25', quarter: 'Q4 FY2026', eps: 1.76, url: fourthQuarterUrl},
      {end: '2026-04-26', published: '2026-05-20', quarter: 'Q1 FY2027', eps: 2.39, url: firstQuarterUrl},
      {end: '2026-07-26', published: '2026-08-26', quarter: 'Q2 FY2027', eps: 2.46, url: priorFilingUrl,
        releaseUrl: 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027'},
      {end: '2026-10-25', published: '2026-11-17', quarter: 'Q3 FY2027', eps: 2.70, url: supplementalUrl,
        releaseUrl: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000088/nvda-20261117.htm'}
    ],
    lastReportedEbita: {
      periodEnd: '2026-07-26',
      quarter: 'Q2 FY2027',
      operatingIncome: 63734,
      intangibleAmortization: 237,
      dilutedShares: 24285,
      url: priorFilingUrl
    }
  };
})(globalThis);
