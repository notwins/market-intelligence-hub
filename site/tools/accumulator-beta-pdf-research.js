(() => {
  'use strict';
  const formats = window.AccumulatorFormat;
  const {history, date, riskText} = window.AccumulatorPdfEditions;
  const finite = Number.isFinite;
  const feed = 'https://notwins.github.io/market-intelligence-content/data/shares-quarterly-core-2026-11-26.json';
  const archivePage = 'https://notwins.github.io/market-intelligence-hub/stocks-beta2.html';
  const annual = 'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm';
  const release = 'https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/';
  const releases = 'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-';
  const amdRelease = 'https://ir.amd.com/news-events/press-releases/detail/1303/amd-reports-third-quarter-2026-financial-results';
  const broadcomRelease = 'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-third-quarter-fiscal-year-2026-financial';
  const intelRelease = 'https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results';
  const tpu = 'https://docs.cloud.google.com/docs/compute-area/tpus';
  const trainium = 'https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html';
  const names = {NVDA:'NVIDIA', AMD:'AMD', AVGO:'Broadcom', INTC:'Intel'};
  const tickers = Object.keys(names);
  const tones = ['accent','secondary','tertiary','ko'];
  const number = (value, digits = 1) => finite(value) ? new Intl.NumberFormat('en-US', {maximumFractionDigits:digits}).format(value) : 'n/a';
  const bn = value => finite(value) ? number(value / 1000, 2) : 'n/a';
  const price = value => finite(value) ? formats.price(value) : 'n/a';
  const pct = value => finite(value) ? number(value, 1) + '%' : 'n/a';
  const multiple = value => finite(value) && value >= 0 ? number(value, 1) + 'x' : 'n/a';
  const ratio = (a,b) => finite(a) && finite(b) && b > 0 ? a / b : null;
  const margin = (a,b) => { const value = ratio(a,b); return value === null ? null : value * 100; };
  const columns = (labels, widths) => labels.map((label,i) => ({label,width:widths[i],align:i === 0 ? 'left' : 'right'}));
  const f = () => window.AccumulatorNvdaFinancialData;
  const link = (w, label, url, y) => w.source(label, url, y);
  // Earlier stand-alone GAAP quarters from NVIDIA's releases. Use a dated filing when the shared feed has one.
  const nvdaHistory = [
    ['Q4 FY2025','2025-01-26','fourth-quarter-and-fiscal-2025',39331,28723,24034,22091,.89],
    ['Q1 FY2026','2025-04-27','first-quarter-fiscal-2026',44062,26668,21638,18775,.76],
    ['Q2 FY2026','2025-07-27','second-quarter-fiscal-2026',46743,33853,28440,26422,1.08],
    ['Q3 FY2026','2025-10-26','third-quarter-fiscal-2026',57006,41849,36010,31910,1.30],
    ['Q4 FY2026','2026-01-25','fourth-quarter-and-fiscal-2026',68127,51093,44299,42960,1.76],
    ['Q1 FY2027','2026-04-26','first-quarter-fiscal-2027',81615,61157,53536,58321,2.39],
    ['Q2 FY2027','2026-07-26','second-quarter-fiscal-2027',96221,72142,63734,59688,2.46]
  ].map(([period,ended,slug,revenue,grossProfit,operatingIncome,netIncome,dilutedEps]) => ({
    period,ended,source:releases+slug,kind:'Earnings release',
    values:{revenue,grossProfit,operatingIncome,netIncome,dilutedEps}
  }));

  function finSnapshot() {
    const {periodEnd:ended,quarter:period,income:i,cashFlow:c,sources} = f();
    return {ended,period,source:sources[0].url,kind:'Earnings exhibit',values:{
      revenue:i.revenue,grossProfit:i.grossProfit,operatingIncome:i.operatingIncome,netIncome:i.netIncome,
      dilutedEps:i.dilutedEps,operatingCashFlow:c.operating,freeCashFlow:c.operating + c.capitalPurchases,
      operatingMargin:margin(i.operatingIncome,i.revenue),grossMargin:margin(i.grossProfit,i.revenue)
    }};
  }

  async function load() {
    const core = window.SharesQuarterlyCore;
    const getAdjustments = fetch('../data/stocks-beta2-history-adjustments.json', {signal:AbortSignal.timeout(12000)})
      .then(response => {
        if (!response.ok) throw Error('Price history adjustments unavailable');
        return response.json();
      });
    const [quarterly, archive, adjustments] = await Promise.allSettled([
      core.load(), window.AccumulatorMarket.getBosArchive(), getAdjustments
    ]);
    const companies = {};
    const market = {};
    for (const symbol of tickers) {
      const entry = quarterly.status === 'fulfilled' && core.listing(quarterly.value, symbol + ' US');
      const filings = entry?.observations.filter(row => /^10-[QK]/.test(row.kind))
        .map(observation => core.view(entry, {observation})).filter(row => row?.ended) || [];
      if (symbol === 'NVDA') {
        for (const snapshot of [...nvdaHistory,finSnapshot()]) {
          if (!filings.some(row => row.ended === snapshot.ended)) filings.push(snapshot);
        }
      }
      filings.sort((a,b) => a.ended.localeCompare(b.ended));
      const latest = filings.at(-1);
      const fiscalQuarter = String(latest?.period || '').slice(0,2);
      const prior = latest && filings.find(row => row.period.startsWith(fiscalQuarter) && row.ended.slice(0,4) === String(Number(latest.ended.slice(0,4)) - 1));
      const growth = latest?.values.revenueGrowth ?? (prior && latest ? margin(latest.values.revenue - prior.values.revenue, prior.values.revenue) : null);
      companies[symbol] = {filings, latest, growth};
      const data = archive.status === 'fulfilled' && archive.value?.data;
      const listing = data && data.securities.find(row => row.ticker === symbol + ' US' && row.currency === 'USD');
      if (!listing || adjustments.status !== 'fulfilled') continue;
      const api = window.StocksBeta2Charts;
      const adjusted = api.chartHistory(data, listing, adjustments.value);
      const points = metric => api.historyPoints(adjusted.data, adjusted.company, metric, 0, adjusted.data.months.length - 1)
        .filter(row => row.value > 0);
      market[symbol] = {prices:points('price'), pe:points('forward_pe'), pb:points('forward_pb')};
    }
    return {companies, market, partial:quarterly.status !== 'fulfilled' || tickers.some(ticker => !market[ticker] || !companies[ticker].latest)};
  }

  function sections(w, items, y, step = 31) {
    items.forEach(([title,copy],i) => {
      w.write(title, w.left, y + i * step, {size:11.4,tone:'secondary',weight:'bold'});
      w.paragraph(copy, y + i * step + 6, {size:10.2,tone:'ink'});
    });
  }
  function filteredPairs(rows) {
    return rows.map(row => [row.quote, row.value]);
  }
  function matchedValuations(market) {
    const maps = Object.fromEntries(tickers.map(symbol => [symbol, {
      pe:new Map(filteredPairs(market[symbol]?.pe || [])),
      pb:new Map(filteredPairs(market[symbol]?.pb || []))
    }]));
    const common = [...maps.NVDA.pe.keys()].filter(day => tickers.every(symbol => maps[symbol].pe.has(day) && maps[symbol].pb.has(day))).sort().at(-1);
    return {common,maps};
  }

  function equity(w, data, market, live, stressPrice) {
    const {income:i,balance:b,cashFlow:c,periodEnd,quarter,sources} = f();
    const {filings, growth, latest} = data.companies.NVDA;
    const marketDate = market.latest?.[0];
    const close = market.latest?.[1];
    const prices = history(market);
    const reported = quarter + '  /  Ended ' + date(periodEnd) + '  /  USD';
    const kicker = 'NVIDIA EQUITY REPORT';
    const trailingEps = i.trailingDilutedEps;
    const book = ratio(b.equity,b.sharesOutstanding);
    const netCash = b.cash + b.marketableDebtSecurities - b.shortTermDebt - b.longTermDebt;

    w.page(kicker, 'NVIDIA at a glance', reported);
    w.cards([
      {label:'QUARTERLY REVENUE',value:'$' + bn(i.revenue) + 'bn',note:finite(growth)?pct(growth) + ' year on year':undefined},
      {label:'GAAP OPERATING MARGIN',value:pct(margin(i.operatingIncome,i.revenue)),note:'Operating income / revenue'},
      {label:'OPERATING CASH FLOW',value:'$' + bn(c.operating) + 'bn',note:'For the quarter'}
    ], 48, {height:29});
    w.heading('The business', 92);
    w.paragraph('NVIDIA sells accelerated computing platforms spanning GPUs, interconnect, networking and the CUDA software ecosystem. Platform adoption and customer buildouts matter alongside unit demand.', 100, {size:10.8,tone:'ink'});
    if (periodEnd === '2026-10-25') w.paragraph('Data Center accounted for $107.6bn, about 93% of reported quarterly revenue. The concentration makes accelerator demand especially important to earnings.', 117, {size:10.8,tone:'ink'});
    w.heading('NVDA price history  /  3 years', 142);
    w.chart([{tone:'accent',values:prices}], 148, 68);
    w.paragraph('Split-adjusted USD closes through ' + date(marketDate) + '  /  ' + (market.source || 'Hub price history'), 222, {size:8.4});
    w.note('What matters to an accumulator holder', 'A lower strike helps at entry. Falling earnings or valuation multiples can still leave the shares below strike at delivery.', 233, 23, 'secondary');
    link(w,'NVIDIA quarterly results and business mix',release,267);

    w.page(kicker, 'Operating trajectory', 'GAAP quarters  /  Each period is shown on its fiscal reporting basis');
    const recent = filings.filter(row => row.ended <= periodEnd).slice(-8);
    w.heading('Reported revenue  /  USD bn', 52);
    w.chart([{tone:'accent',values:recent.map(row => [row.ended,row.values.revenue / 1000])}], 57, 58, {axis:value=>number(value,0),zero:true});
    w.heading('Eight-quarter operating scorecard', 127);
    const financialCols = columns(['Quarter end','Revenue bn','Gross margin','Operating margin','Net income bn','Diluted EPS'],[36,28,28,33,30,25]);
    const financialRows = recent.map(({ended,values,source}) => [{text:date(ended),url:source},bn(values.revenue),pct(margin(values.grossProfit,values.revenue)),
      pct(margin(values.operatingIncome,values.revenue)),bn(values.netIncome),price(values.dilutedEps)]);
    w.table(132,financialCols,financialRows,{rowHeight:9});
    w.paragraph('Select a quarter end to open its filing or earnings release. The table uses the stand-alone quarter in each source.', 222, {size:9});
    w.note('Watch the quality of growth', 'Track margins and cash generation alongside revenue. Inventory and receivables can absorb cash even when reported profit rises.', 235, 23, 'secondary');
    link(w,'Quarterly data and period-level filing references',feed,270);

    w.page(kicker, 'The three financial statements', reported + ' bn unless per share');
    const x = w.left;
    const panelX = x + 93;
    const smallColumns = columns(['Selected line','USD bn'],[65,22]);
    const income = [
      ['Revenue',bn(i.revenue)],['Gross profit',bn(i.grossProfit)],['Research and development',bn(i.researchAndDevelopment)],
      ['Operating income',bn(i.operatingIncome)],['Income tax',bn(i.incomeTax)],['Net income',bn(i.netIncome)],['Diluted EPS',price(i.dilutedEps)]
    ];
    const balance = [
      ['Cash and equivalents',bn(b.cash)],['Marketable debt securities',bn(b.marketableDebtSecurities)],
      ['Trade receivables',bn(b.receivables)],['Inventory',bn(b.inventories)],['Total assets',bn(b.assets)],
      ['Total liabilities',bn(b.liabilities)],['Shareholders equity',bn(b.equity)]
    ];
    w.write('Income statement', x, 54, {size:15,family:'times',weight:'bold'});
    w.write('Balance sheet', panelX, 54, {size:15,family:'times',weight:'bold'});
    w.table(59,smallColumns,income,{rowHeight:7.8});
    w.table(59,smallColumns,balance,{rowHeight:7.8,x:panelX,shade:'secondaryLight'});
    w.heading('Cash flow and capital returns', 137);
    w.table(142,columns(['Quarterly cash measure','USD bn','Interpretation'],[70,25,85]),[
      ['Operating cash flow',bn(c.operating),'Cash generated by operations'],
      ['Capital expenditure',bn(c.capitalPurchases),'Purchases of property and equipment'],
      ['Free cash flow',bn(c.operating + c.capitalPurchases),'Operating cash flow less capital expenditure'],
      ['Investing cash flow',bn(c.investing),'Net investing activity'],
      ['Financing cash flow',bn(c.financing),'Net financing activity'],
      ['Share repurchases',bn(c.shareRepurchases),'Cash outflow'],
      ['Dividends',bn(c.dividends),'Cash outflow']
    ],{rowHeight:8.3});
    w.cards([
      {label:'OPERATING CF / NET INCOME',value:pct(margin(c.operating,i.netIncome))},
      {label:'CURRENT RATIO',value:multiple(ratio(b.currentAssets,b.currentLiabilities))},
      {label:'LIQUID ASSETS LESS DEBT',value:'$' + bn(netCash) + 'bn',note:'Cash + marketable debt securities less debt'}
    ], 219, {height:30,size:17});
    w.paragraph('Amounts reflect the unaudited exhibit. The net liquidity measure excludes marketable equity securities and lease liabilities.', 256, {size:8.5});
    link(w,'SEC Exhibit 99.3  /  Consolidated statements',sources[0].url,269);

    w.page(kicker, 'Valuation and market expectations', 'Dated market prices, trailing GAAP earnings and BOS forward estimates');
    const multiples = data.market.NVDA;
    const anchor = multiples?.pe.at(-1);
    const archivedPb = anchor && multiples.pb.find(row => row.quote === anchor.quote);
    w.cards([
      {label:'DATED CLOSE',value:price(close),note:date(marketDate)},
      {label:'TRAILING P/E',value:multiple(ratio(close,trailingEps)),note:'Four reported quarters of diluted EPS'},
      {label:'TRAILING P/B',value:multiple(ratio(close,book)),note:'Estimated from dated share count'}
    ], 48, {height:30,size:19});
    w.heading('BOS forward multiples', 94);
    w.chart([{label:'Forward P/E',tone:'accent',values:filteredPairs(multiples?.pe.slice(-36) || [])},
      {label:'Forward P/B',tone:'secondary',values:filteredPairs(multiples?.pb.slice(-36) || [])}], 100, 61,
      {axis:value=>number(value,0)+'x',zero:true});
    w.paragraph(anchor ? 'Latest P/E observation: ' + multiple(anchor.value) + '. Matched forward P/B: ' +
      multiple(archivedPb?.value) + '. BOS edition ' + date(anchor.report) + '.' : 'Forward valuation history is unavailable.', 167, {size:9});
    w.heading('What the trailing figures assume', 190);
    w.table(196,columns(['Underlying input','Value','Basis'],[67,30,83]),[
      ['Trailing diluted EPS',price(trailingEps),'Sum of four reported quarters'],
      ['Book value per share',price(book),'Reported equity / dated common shares'],
      ['Common shares outstanding',number(b.sharesOutstanding,0) + 'm','Rounded count on ' + date(b.sharesOutstandingDate)],
      ['Quarter-end equity','$' + bn(b.equity) + 'bn',date(periodEnd)]
    ],{rowHeight:9});
    w.paragraph('Forward and trailing multiples use different denominators and observation dates.', 250, {size:8.8});
    link(w,'BOS monthly archive and adjustment notes',archivePage,269);

    w.page(kicker, 'Downside and sensitivity', 'Illustrative prices in USD  /  Valuation arithmetic and selected note exposure');
    w.heading('Share price implied by EPS and P/E', 53);
    const levels = [8,12,16,20];
    const epsCases = [['Trailing EPS',trailingEps],['EPS lower by 20%',trailingEps * .8],['EPS lower by 40%',trailingEps * .6]];
    w.table(60,columns(['Earnings case','EPS',...levels.map(n=>n+'x')],[50,22,27,27,27,27]),
      epsCases.map(([name,eps]) => [name,price(eps),...levels.map(n=>price(eps*n))]),{rowHeight:10,size:10});
    w.paragraph('Each cell multiplies hypothetical annual EPS by an illustrative valuation multiple.', 109, {size:9});
    w.heading('At the selected test price', 136);
    if (finite(stressPrice)) {
      w.cards([{label:'TEST PRICE',value:price(stressPrice)},{label:'IMPLIED TRAILING P/E',value:multiple(ratio(stressPrice,trailingEps))},
        {label:'IMPLIED TRAILING P/B',value:multiple(ratio(stressPrice,book))}], 142, {height:27,size:19});
    } else w.paragraph('Enter a test price in the simulator to add price-specific multiples.', 148);
    if (live) {
      const fall = live.scenarioResults.find(row=>row.s.id==='fall')?.m;
      if (fall) {
        const e = fall.exit;
        w.heading('Sustained decline in the selected note', 190);
        w.cards([{label:'MODELLED EXIT PRICE',value:price(e.price)},{label:'SHARES ACQUIRED',value:formats.shares(e.shares)},
          {label:'GROSS NOTE P&L',value:formats.returnMoney(e.profit),tone:e.profit < 0 ? 'negative' : 'positive'}], 196, {height:26,size:18});
      }
    }
    w.note('Risk to capital', riskText, 242, 24);

    w.page(kicker, 'What could change the case', 'Business signals and source checks');
    sections(w,[
      ['AI infrastructure demand','Track cloud and enterprise deployment, accelerator utilization, product transitions and customer commitments. Slower orders can hit both revenue and valuation.'],
      ['Competition and deployment costs','Monitor merchant GPUs, cloud-designed accelerators and networking choices. Software migration, available capacity and total system costs affect adoption.'],
      ['Working capital and cash','Compare receivables, inventories, operating cash flow and reported income. A larger gap prompts a closer look at collection, purchasing and timing.'],
      ['Supply, trade and customer concentration','The annual filing describes manufacturing concentration, export restrictions, customer exposure and competition. These can change the revenue mix or margins.']
    ], 54, 34);
    w.heading('Primary sources and dated datasets', 195);
    const links = [
      ['NVIDIA annual report  /  business, competition and risks',annual],
      ['NVIDIA quarterly earnings release',release],
      ['SEC Exhibit 99.3  /  statements',sources[0].url],
      ['SEC CFO commentary',sources[1].url],
      ['Quarterly filing series and observations',feed],
      ['Dated Hub / BOS prices and consensus history',archivePage]
    ];
    if (latest?.source && !links.some(([,url])=>url===latest.source)) links.push(['Latest included NVIDIA filing',latest.source]);
    links.forEach(([label,url],index) => link(w,label,url,205 + index * 8));
    w.paragraph('Pulled from the dated snapshots shown in this report. Report built ' + w.stamp + '.', 269, {size:8.2});
  }

  function peersOnCommonDays(market, years = 3) {
    const maps = Object.fromEntries(tickers.map(symbol => [symbol,new Map(filteredPairs(market[symbol]?.prices || []))]));
    const common = [...maps.NVDA.keys()].filter(day => tickers.every(symbol => maps[symbol].has(day))).sort();
    const end = common.at(-1);
    if (!end) return [];
    const cutoff = new Date(end + 'T00:00:00Z');
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    const dates = common.filter(day => Date.parse(day) >= cutoff.getTime());
    if (dates.length < 2) return [];
    return tickers.map((symbol,i) => ({
      label:symbol,tone:tones[i],values:dates.map(day=>[day,100*maps[symbol].get(day)/maps[symbol].get(dates[0])])
    }));
  }

  function competitors(w, data) {
    const title = 'NVIDIA COMPETITOR ANALYSIS';
    w.page(title, 'Four listed companies', 'Consolidated reporting  /  NVIDIA, AMD, Broadcom and Intel');
    w.heading('Financial scoreboard', 53);
    const peers = tickers.map(symbol => {
      const {latest,growth} = data.companies[symbol];
      const value = latest?.values || {};
      return [symbol,latest ? date(latest.ended) : 'Unavailable',bn(value.revenue),pct(growth),
        pct(margin(value.grossProfit,value.revenue)),pct(margin(value.operatingIncome,value.revenue)),
        bn(value.freeCashFlow)];
    });
    w.table(60,columns(['Ticker','Quarter end','Revenue bn','YoY','Gross margin','Op. margin','FCF bn'],[19,32,28,18,28,29,26]),
      peers,{rowHeight:11,size:9.6});
    w.paragraph('USD bn, company-wide figures. Fiscal quarter ends differ. Free cash flow is operating cash flow less capital expenditure. The companies sell different product and service mixes.', 121, {size:9.2});
    const {common,maps} = matchedValuations(data.market);
    w.heading('Forward valuation on a shared date', 150);
    w.table(157,columns(['Ticker','Forward P/E','Forward P/B'],[70,55,55]),
      tickers.map(symbol => [symbol,multiple(maps[symbol].pe.get(common)),multiple(maps[symbol].pb.get(common))]),{rowHeight:9.5});
    w.paragraph(common ? 'BOS archived observations matched to the ' + date(common) + ' quote date. Forward estimates can change.' :
      'No date has both valuation multiples available for all four stocks.', 213, {size:9});
    w.note('Read the right comparison', 'Company margins reflect the entire business. Intel includes foundry activities and Broadcom includes infrastructure software.', 229, 24, 'secondary');
    link(w,'Quarterly filing observations and sources',feed,267);

    w.page(title, 'Peer prices and positioning', 'Split-adjusted price change  /  Common observation dates');
    w.heading('Indexed prices  /  First common close = 100', 54);
    const plotted = peersOnCommonDays(data.market);
    w.chart(plotted, 60, 78,{axis:value=>number(value,0)});
    const points = plotted[0]?.values;
    if (points) w.paragraph(date(points[0][0]) + ' to ' + date(points.at(-1)[0]) + '  /  ' + points.length +
      ' shared BOS observations. Performance reflects price only and excludes dividends.', 146, {size:9});
    if (plotted.length) {
      w.heading('Change over the plotted window', 164);
      w.cards(plotted.map(item=>({label:item.label,value:pct(item.values.at(-1)[1]-100)})), 170, {height:28,size:19});
    }
    sections(w,[
      ['Read price moves in context','The chart uses common observed dates and adjusts for splits. It reflects relative price moves across all market drivers.'],
      ['Competitive position','NVIDIA integrates accelerators, networking and software. AMD addresses some of the same merchant compute demand. Broadcom and Intel overlap through different combinations of custom silicon, networking, CPUs and manufacturing.']
    ], 216, 29);
    link(w,'BOS observation history and price adjustments',archivePage,273);

    w.page(title, 'Where competition comes from', 'Merchant hardware, infrastructure suppliers and in-house cloud silicon');
    sections(w,[
      ['NVIDIA  /  Platform integration','GPUs, interconnect and CUDA make the full deployment stack part of the buying decision. Track software performance and system availability alongside chip specifications.'],
      ['AMD  /  Merchant GPUs and server CPUs','Instinct GPUs compete for accelerated workloads; EPYC CPUs add a separate data-center exposure. Customer deployments and software adoption are useful signals.'],
      ['Broadcom  /  Custom accelerators and networking','Custom silicon and networking give Broadcom a different way into hyperscaler spending. Custom accelerator demand can coexist with merchant GPU deployments.'],
      ['Intel  /  Server CPUs and foundry capacity','Intel overlaps in server platforms and manufacturing. Its product mix and capital intensity differ from a pure merchant accelerator comparison.'],
      ['Google Cloud TPU and AWS Trainium','Cloud providers design accelerators for some training and inference workloads. Their choices can change the chip mix without being a one-for-one substitute for merchant GPUs.']
    ], 53, 36);
    w.note('Implication for an accumulator', 'If competitive pressure lowers expected NVIDIA earnings or the multiple investors pay, the strike offers a smaller cushion against loss.', 242, 23);

    w.page(title, 'Signals to monitor', 'Track the evidence behind the competitive thesis');
    sections(w,[
      ['Deployment breadth','Look at publicly announced production deployments, repeat orders and the range of available workloads. Product announcements alone cannot establish market share.'],
      ['Economics at the system level','Compare cost and throughput at comparable utilization, model quality and scale. Networking, software migration and power can change the result.'],
      ['Business mix and cash flow','Use comparable date ranges and GAAP figures. Disclosed AI segment metrics use different definitions across NVIDIA, AMD, and Broadcom, so their totals do not imply market share.']
    ], 53, 34);
    w.heading('Company filings and platform documentation', 158);
    [
      ['NVIDIA annual report  /  Competition and strategy',annual],['NVIDIA latest quarter in this report',release],
      ['AMD quarter  /  Data Center and Instinct',amdRelease],['Broadcom quarter  /  Custom AI and networking',broadcomRelease],
      ['Intel quarter  /  Product and foundry results',intelRelease],['Google Cloud  /  TPU documentation',tpu],
      ['Amazon EC2  /  Trainium instance specifications',trainium],['Quarterly data underlying the scoreboard',feed]
    ].forEach(([label,url],index) => link(w,label,url,169 + index * 9));
    w.paragraph('Report built ' + w.stamp + '. Reporting and quote dates appear with each comparison.', 266, {size:8.5});
  }

  window.AccumulatorPdfResearch = {load, equity, competitors};
})();
