/* NVDA market context for the funded Normal accumulator. Statement data is a dated filing snapshot. */
(() => {
  'use strict';
  const mount = document.getElementById('nvda-stress-context');
  if (!mount) return;
  const money = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
  const numbers = new Intl.NumberFormat('en-US', {maximumFractionDigits:2});
  const billions = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:3,maximumFractionDigits:3});
  const annualEps = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:4});
  const amount = v => Number.isFinite(v) ? money.format(v) : 'Unavailable';
  const number = v => Number.isFinite(v) ? numbers.format(v) : 'Unavailable';
  const rate = v => number(v) + '%';
  const signedMoney = v => (v > 0 ? '+' : '') + amount(v);
  const cents = value => Math.round((value + Number.EPSILON * value) * 100);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortDate = d => new Intl.DateTimeFormat('en-GB', {timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(d+'T00:00:00Z'));
  const endMonth = d => new Intl.DateTimeFormat('en-GB', {timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(d+'T00:00:00Z'));
  const finance = window.AccumulatorNvdaFinancialData;
  const byId = id => document.getElementById(id);
  let customTestPrice = false;

  mount.innerHTML = `<h2>NVIDIA at the stress price</h2>
    <p class="nv-intro">Choose a sale price to see the cash you would receive. Compare the required move with other periods of the same length and see how that price looks under different earnings assumptions.</p>
    <div class="nv-price-tools"><label for="nv-stress-price">Test sale price · USD per share<input id="nv-stress-price" type="number" min="0" step="0.01" inputmode="decimal"></label><button type="button" id="nv-use-69">Test $69.00</button><button type="button" id="nv-use-path">Use decline scenario</button></div>
    <div id="nv-stress-result" class="nv-outcome" aria-live="polite"></div>
    <h3>How often has NVDA fallen this far?</h3>
    <div id="nv-history-frequency"></div>
    <p id="nv-history-longer" class="nv-note" hidden></p>
    <details class="nv-horizons" id="nv-horizon-panel" hidden><summary>Compare 3, 6, 9 and 12 months</summary>
      <div id="nv-horizon-table"></div></details>
    <p id="nv-history-method" class="nv-note"></p>
    <h3>Ten years of NVDA prices</h3><p id="nv-price-context"></p>
    <figure class="nv-graph"><figcaption class="nv-chart-key"><span>NVDA monthly close · USD</span><span>Test sale price</span></figcaption><div id="nv-history-chart"></div></figure>
    <p id="nv-history-details" class="nv-note"></p>
    <section id="nv-accounts"></section>`;
  const input = byId('nv-stress-price');
  const validTest = () => input.value !== '' && input.checkValidity() && Number.isSafeInteger(cents(input.valueAsNumber)) && input.valueAsNumber >= 0;
  const card = (name,value,formula) => '<details class="nv-card"><summary>'+escape(name)+'<strong>'+escape(value)+'</strong></summary><p>'+escape(formula)+'</p></details>';

  function statement(name, rows, supporting) {
    const lines=values=>'<dl>'+values.map(([caption,value,perShare])=>'<div><dt>'+escape(caption)+'</dt><dd>'+(perShare?amount(value):number(value))+'</dd></div>').join('')+'</dl>';
    return '<details class="nv-statement" open><summary>'+escape(name)+'</summary>'+lines(rows)+
      '<details class="nv-supporting"><summary>Supporting line items</summary>'+lines(supporting)+'</details></details>';
  }
  function renderAccounts() {
    const target = byId('nv-accounts');
    if (!finance) {target.innerHTML='<p class="nv-note">The sourced company accounts are unavailable in this copy.</p>';return;}
    const {balance:b,income:i,cashFlow:c} = finance;
    const dates=finance.quarter+' ended '+shortDate(finance.periodEnd)+' · USD millions';
    target.innerHTML = '<h3>What earnings would support the test price?</h3><div id="nv-valuation-scenarios"></div>'+
      '<h3>NVIDIA’s three financial statements</h3><p>'+finance.quarter+' operating cash flow was <strong>'+billions.format(c.operating/1000)+'bn</strong> on <strong>'+billions.format(i.netIncome/1000)+'bn</strong> of net income. That is about '+rate(c.operating/i.netIncome*100)+' of reported profit in cash from operations. Future earnings and the multiple investors pay for them can both fall.</p>'+
      '<p class="nv-note">'+dates+' · Published '+shortDate(finance.published)+'. These unaudited figures cover the stand-alone quarter. The balance sheet records amounts at quarter-end.</p><div class="nv-statements">'+
      statement('Income statement',[
        ['Revenue',i.revenue],['Cost of revenue',i.costOfRevenue],['Gross profit',i.grossProfit],
        ['Operating expenses',i.operatingExpenses],['Operating income',i.operatingIncome],
        ['Other income, net',i.otherIncomeNet],['Income before tax',i.pretaxIncome],
        ['Income tax expense',i.incomeTax],['Net income',i.netIncome]
      ],[
        ['Research and development',i.researchAndDevelopment],['Selling, general and administrative',i.sellingGeneralAndAdministrative],
        ['Basic EPS · USD/share',i.basicEps,true],['Diluted EPS · USD/share',i.dilutedEps,true],
        ['Basic weighted-average shares · millions',i.basicShares],['Diluted weighted-average shares · millions',i.dilutedShares]
      ])+
      statement('Balance sheet',[
        ['Cash and equivalents',b.cash],['Marketable debt securities',b.marketableDebtSecurities],['Marketable equity securities',b.marketableEquitySecurities],
        ['Total current assets',b.currentAssets],['Total assets',b.assets],['Current liabilities',b.currentLiabilities],
        ['Debt due within one year',b.shortTermDebt],['Long-term debt',b.longTermDebt],['Total liabilities',b.liabilities],['Shareholders’ equity',b.equity]
      ],[
        ['Trade receivables, net',b.receivables],['Inventories',b.inventories],['Prepayments and other current assets',b.prepaidAndOtherCurrentAssets],
        ['Property and equipment, net',b.propertyAndEquipment],['Operating lease assets',b.operatingLeaseAssets],['Goodwill',b.goodwill],
        ['Intangible assets, net',b.intangibleAssets],['Deferred tax assets',b.deferredTaxAssets],['Nonmarketable securities',b.nonmarketableSecurities],
        ['Other assets',b.otherAssets],['Trade payables',b.payables],['Accruals and other current liabilities',b.accruedAndOtherCurrentLiabilities],
        ['Long-term operating lease liabilities',b.longTermOperatingLeaseLiabilities],['Other long-term liabilities',b.otherLongTermLiabilities],
        ['Total liabilities and equity',b.liabilities+b.equity]
      ])+
      statement('Cash flow statement',[
        ['Opening cash',c.beginningCash],['Operating cash flow',c.operating],['Investing cash flow',c.investing],['Financing cash flow',c.financing],
        ['Net cash movement',c.netChangeInCash],['Closing cash',c.endingCash],['Depreciation and amortisation',c.depreciationAndAmortization],
        ['Purchases of property, equipment and intangibles',c.capitalPurchases]
      ],[
        ['Net income',c.netIncome],['Stock-based compensation',c.stockCompensation],['Deferred taxes',c.deferredTaxes],
        ['Losses on derivatives',c.derivativeLosses],['Gains on equity holdings',c.equitySecurityGains],['Other adjustments',c.otherAdjustments],
        ['Change in receivables',c.receivableChange],['Change in inventories',c.inventoryChange],['Change in prepayments and other assets',c.prepaidAndOtherAssetChange],
        ['Change in payables',c.payableChange],['Change in accruals and other current liabilities',c.accruedLiabilityChange],
        ['Change in other long-term liabilities',c.otherLongTermLiabilityChange],['Debt investment sales and maturities',c.debtSecurityProceeds],
        ['Proceeds from equity investments',c.equitySecurityProceeds],['Equity investments purchased',c.equitySecurityPurchases],
        ['Debt investments purchased',c.debtSecurityPurchases],['Acquisitions and other, net',c.acquisitionsAndOther],
        ['Net borrowing proceeds',c.debtIssuance],['Employee share-plan proceeds',c.employeeStockPlanProceeds],['Share buybacks',c.shareRepurchases],
        ['Cash dividends',c.dividends],['Taxes paid on employee share plans',c.employeeStockPlanTaxPayments],['Groq payments',c.groqPayments],
        ['Debt repaid',c.debtRepayment],['Principal paid on equipment and intangibles',c.capitalPrincipalPayments],['Other financing',c.otherFinancing]
      ])+
      '</div><h3>What backs one share?</h3><p class="nv-note">Select any measure to see the figures and calculation. Balance-sheet estimates use '+number(b.sharesOutstanding)+' million shares outstanding as of '+shortDate(b.sharesOutstandingDate)+'. Quarterly earnings measures use the reported weighted-average share count.</p>'+
      '<div id="nv-metric-grid" class="nv-chipgrid"></div><p class="nv-book" id="nv-book-check"></p>'+
      '<h3>Your earnings-based fair value</h3><p id="nv-earnings-note" class="nv-note"></p><div class="nv-fair"><label for="nv-fair-pe">Your fair P/E multiple<input id="nv-fair-pe" type="number" min="0.01" step="any" inputmode="decimal" placeholder="Enter a multiple"></label><output id="nv-fair-result" for="nv-fair-pe nv-stress-price" aria-live="polite"></output></div>'+
      '<p class="nv-note">This estimate assumes earnings equal the trailing four quarters. A change in earnings, growth expectations or the return investors require changes the estimated value. The share price can fall below book value.</p>'+
      '<p class="nv-refs">Sources · '+finance.sources.map(s=>'<a href="'+escape(s.url)+'" target="_blank" rel="noopener noreferrer">'+escape(s.label)+'</a>').join(' · ')+' · <a href="https://finance.yahoo.com/quote/NVDA/history/" target="_blank" rel="noopener noreferrer">Dated NVDA close history</a>. Dollar and percentage displays use rounded values. Calculations use the underlying figures.</p>';
    byId('nv-fair-pe').addEventListener('input', updateFairValue);
  }

  function gap(price, benchmark) {
    const diff=price-benchmark;
    if(Math.abs(diff)<0.0000001)return 'equal to';
    return amount(Math.abs(diff))+' '+(diff>0?'above':'below');
  }

  function renderEarningsScenarios(datedPrice, test) {
    const holder=byId('nv-valuation-scenarios'), eps=finance.income.trailingDilutedEps;
    if(test===null || !Number.isFinite(eps) || eps<=0){
      holder.textContent='Enter a valid sale price to compare it with the latest four quarters of reported earnings.';
      return;
    }
    const intro='NVIDIA earned <strong>'+amount(eps)+'</strong> per diluted share over the four quarters ended '+shortDate(finance.periodEnd)+'. '+
      (datedPrice===null?'':'At the dated close of <strong>'+amount(datedPrice)+'</strong>, investors paid <strong>'+number(datedPrice/eps)+'×</strong> those earnings. ')+
      'At <strong>'+amount(test)+'</strong>, the multiple depends on how much the company earns.';
    const rows=[['Same as trailing year',1],['25% lower',.75],['50% lower',.5]].map(([label,fraction])=>{
      const scenarioEps=eps*fraction;
      return '<tr><th scope="row">'+label+'</th><td>'+annualEps.format(scenarioEps)+'</td><td>'+number(test/scenarioEps)+'×</td></tr>';
    }).join('');
    holder.innerHTML='<p>'+intro+'</p><table class="nv-evidence-table" aria-label="Earnings assumptions and implied price to earnings multiple"><thead><tr><th scope="col">Annual earnings assumption</th><th scope="col">EPS</th><th scope="col">P/E at '+amount(test)+'</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<p class="nv-note">P/E divides share price by annual earnings per share. The earnings cuts are what-if assumptions. Price and earnings can fall together, so a lower share price can still command a higher multiple.</p>';
  }
  function updateFairValue() {
    if (!finance) return;
    const pe = byId('nv-fair-pe'), out = byId('nv-fair-result'), eps = finance.income.trailingDilutedEps;
    if (!validTest() || !Number.isFinite(eps) || eps<=0) {
      byId('nv-earnings-note').textContent='Trailing reported diluted EPS is '+amount(eps)+'.';
      out.textContent='A valid test price and positive trailing EPS are needed.';
      return;
    }
    const test = input.valueAsNumber;
    byId('nv-earnings-note').textContent=amount(test)+' implies a trailing P/E of '+number(test/eps)+'×. GAAP diluted EPS over the last four quarters was '+finance.earningsQuarters.map(q=>amount(q.eps)).join(' + ')+' = '+amount(eps)+' per share.';
    if(!pe.value || !pe.checkValidity() || !Number.isFinite(pe.valueAsNumber) || pe.valueAsNumber<=0){out.textContent='Enter the P/E you believe is fair to compare your estimate with the test price.';return;}
    const fair=pe.valueAsNumber*eps, diff=test-fair;
    out.textContent='Estimated value = '+amount(eps)+' × '+number(pe.valueAsNumber)+' = '+amount(fair)+' per share. The test price is '+gap(test,fair)+' your estimate'+(diff?' ('+rate(Math.abs(diff)/fair*100)+(diff>0?' premium).':' discount).'):'.');
  }

  function renderMetrics(market, test) {
    if (!finance) return;
    const {balance:b, income:i, cashFlow:c, lastReportedEbita:e} = finance;
    const shares=b.sharesOutstanding, debt=b.shortTermDebt+b.longTermDebt;
    const book=(b.assets-b.liabilities)/shares;
    const perShare=(n,d=shares)=>amount(n/d);
    const netDebt=debt-b.cash-b.marketableDebtSecurities;
    const latest=market?.latest;
    const datedPrice=latest ? cents(latest[1])/100 : null;
    const ev = datedPrice===null ? null : datedPrice+netDebt/shares;
    const evFormula='EV/share = stock price + (debt of '+number(debt)+'m − cash of '+number(b.cash)+'m − marketable debt securities of '+number(b.marketableDebtSecurities)+'m) ÷ '+number(shares)+'m shares. Equity investments and operating leases are excluded.';
    const cards = [
      ['Book value per share',amount(book),'('+number(b.assets)+'m total assets − '+number(b.liabilities)+'m total liabilities) ÷ '+number(shares)+'m shares. This is accounting equity per share.'],
      ['Cash per share',perShare(b.cash),number(b.cash)+'m cash and cash equivalents ÷ '+number(shares)+'m shares. Marketable securities are excluded.'],
      ['Current assets per share',perShare(b.currentAssets),number(b.currentAssets)+'m current assets ÷ '+number(shares)+'m shares. This includes cash, investments, receivables and inventories before liabilities.'],
      ['Enterprise value per share · dated close',amount(ev),(latest ? 'Market close '+amount(datedPrice)+' on '+shortDate(latest[0])+'. ' : '')+evFormula],
      ['Enterprise value per share · test price',amount(test===null?null:test+netDebt/shares),'Reprice the equity at the test price and keep reported cash and debt fixed. '+evFormula],
      ['Net income per share · quarterly diluted EPS',amount(i.dilutedEps),number(i.netIncome)+'m net income ÷ '+number(i.dilutedShares)+'m weighted-average diluted shares. NVIDIA reported basic EPS of '+amount(i.basicEps)+' and diluted EPS of '+amount(i.dilutedEps)+'.'],
      ['Operating EBITA per share · '+e.quarter,perShare(e.operatingIncome+e.intangibleAmortization,e.dilutedShares),'Quarter ended '+shortDate(e.periodEnd)+'. ('+number(e.operatingIncome)+'m operating income + '+number(e.intangibleAmortization)+'m intangible amortisation) ÷ '+number(e.dilutedShares)+'m diluted shares. '+finance.quarter+' groups amortisation with other costs, so its operating EBITA cannot be calculated separately.'],
      ['Operating EBITDA per share · '+finance.quarter,perShare(i.operatingIncome+c.depreciationAndAmortization,i.dilutedShares),'Operating proxy = ('+number(i.operatingIncome)+'m operating income + '+number(c.depreciationAndAmortization)+'m depreciation and amortisation) ÷ '+number(i.dilutedShares)+'m diluted shares. EBITDA also adds back depreciation.']
    ];
    const grid=byId('nv-metric-grid');
    const open=Array.from(grid.querySelectorAll('details'), d=>d.open);
    grid.innerHTML=cards.map(v=>card(...v)).join('');
    Array.from(grid.querySelectorAll('details')).forEach((detail,index)=>{detail.open=!!open[index];});
    byId('nv-book-check').textContent='Total assets of $'+number(b.assets)+'m less liabilities of $'+number(b.liabilities)+'m leave $'+number(b.equity)+'m in equity, about '+amount(book)+' per share. '+(test===null?'':amount(test)+' is '+gap(test,book)+' book value ('+number(test/book)+'× book). ')+'Enterprise value includes the share price and changes with it. Use the earnings assumptions to explore fair value.';
    renderEarningsScenarios(datedPrice,test);
    updateFairValue();
  }

  function historyWindow(market) {
    if(!market?.latest || !market.ordered?.length) return [];
    const end=market.latest[0], start=new Date(end+'T00:00:00Z');
    start.setUTCFullYear(start.getUTCFullYear()-10);
    const beginning=start.toISOString().slice(0,10);
    return market.ordered.filter(([date,price])=>date>=beginning && date<=end && Number.isFinite(price) && price>0);
  }
  function drawChart(points,test) {
    const host=byId('nv-history-chart');
    if(points.length<2){host.textContent='Price history unavailable.';return;}
    const width=Math.max(270, Math.min(1600,host.clientWidth||800));
    const height=Math.max(185,Math.min(270,Math.round(width*.33)));
    const left=45,right=width-10,top=12,bottom=height-30;
    const first=Date.parse(points[0][0]),last=Date.parse(points[points.length-1][0]);
    const max=Math.max(test??0,...points.map(p=>p[1]));
    const unit=10**Math.floor(Math.log10(max/4));
    const tick=[1,2,2.5,5,10].find(step=>step*unit>=max/4)*unit;
    const high=tick*Math.ceil(max/tick);
    const x=d=>left+(Date.parse(d)-first)/(last-first)*(right-left);
    const y=p=>bottom-p/high*(bottom-top);
    let markup='<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ten years of split-adjusted NVIDIA monthly closes with the selected test price" viewBox="0 0 '+width+' '+height+'" style="height:'+height+'px"><g fill="#4c6371" font-family="system-ui,sans-serif" font-size="11">';
    for(let price=0;price<=high+tick*.001;price+=tick){
      markup+='<line x1="'+left+'" y1="'+y(price)+'" x2="'+right+'" y2="'+y(price)+'" stroke="#dbe5e8"/><text x="'+(left-6)+'" y="'+(y(price)+4)+'" text-anchor="end">'+number(price)+'</text>';
    }
    const stamps=width<500?3:6;
    for(let n=0;n<stamps;n++){
      const point=points[Math.round(n*(points.length-1)/(stamps-1))];
      const anchor=n===0?'start':n===stamps-1?'end':'middle';
      markup+='<text x="'+x(point[0])+'" y="'+(height-7)+'" text-anchor="'+anchor+'">'+escape(endMonth(point[0]))+'</text>';
    }
    markup+='<polyline points="'+points.map(([d,p])=>x(d).toFixed(2)+','+y(p).toFixed(2)).join(' ')+'" fill="none" stroke="#466981" stroke-width="2.6" stroke-linejoin="round"/>';
    if(test!==null)markup+='<line x1="'+left+'" x2="'+right+'" y1="'+y(test)+'" y2="'+y(test)+'" stroke="#88553c" stroke-width="2" stroke-dasharray="7 5"><title>Test sale price '+amount(test)+'</title></line>';
    host.innerHTML=markup+'</g></svg>';
  }

  function renderHistoricalFrequency(market,context,test) {
    const box=byId('nv-history-frequency'), panel=byId('nv-horizon-panel'), method=byId('nv-history-method');
    const longer=byId('nv-history-longer');
    longer.hidden=true;
    panel.hidden=true;
    method.textContent='';
    if(!market?.latest || test===null){
      box.textContent='Choose a valid sale price and load a dated NVDA close to compare past declines.';
      return;
    }
    const [date,rawPrice]=market.latest, close=cents(rawPrice)/100;
    if(test>=close){
      box.textContent=amount(test)+' is at or above the dated close of '+amount(close)+'. Choose a lower sale price to measure how often a comparable decline occurred.';
      return;
    }
    const evidence=window.AccumulatorHistoryRisk?.analyze(market.ordered,date,close,test);
    if(!evidence){
      box.textContent='Too few complete, consecutive monthly closes are available to measure this decline.';
      return;
    }
    const pct=rate(evidence.declinePct);
    const row=evidence.rows.find(r=>r.months===context?.tenor);
    const manual=context && (context.referenceMode==='manual' || cents(context.spot)!==cents(close));
    const basis='A move from '+amount(close)+' on '+shortDate(date)+' to '+amount(test)+' is a '+pct+' decline.'+
      (manual?' The note uses your trade price of '+amount(context.spot)+'. Historical comparisons use the dated market close.':'');
    const frequency=(hits,total,percent)=>number(hits)+' of '+number(total)+' ('+rate(percent)+')';
    box.innerHTML='<p>'+basis+'</p>'+(row?.total?'<div class="nv-frequency-pair"><div><span>At the end of '+row.months+' months</span><strong>'+frequency(row.endHits,row.total,row.endPct)+'</strong><small>Historical periods finished down at least this much.</small></div>'+
      '<div><span>At any month-end within '+row.months+' months</span><strong>'+frequency(row.touchHits,row.total,row.touchPct)+'</strong><small>Historical periods reached this decline, including those that later recovered.</small></div></div>':'<p>Choose a priced note to see the comparison for its tenor.</p>');
    if(row?.total){
      const wider=window.AccumulatorHistoryRisk.analyze(market.ordered,date,close,test,20);
      const sample=wider?.rows.find(r=>r.months===row.months);
      if(sample?.total>row.total && wider.startMonth<evidence.startMonth){
        longer.textContent='Over the longer '+endMonth(wider.startMonth+'-01')+'–'+endMonth(wider.endMonth+'-01')+' record, '+frequency(sample.endHits,sample.total,sample.endPct)+' of '+row.months+'-month periods finished down this much and '+frequency(sample.touchHits,sample.total,sample.touchPct)+' reached the decline at a month-end.';
        longer.hidden=false;
      }
    }
    byId('nv-horizon-table').innerHTML='<table class="nv-evidence-table" aria-label="Historical relative declines over complete monthly windows"><thead><tr><th scope="col">Holding period</th><th scope="col">At final month-end</th><th scope="col">At any month-end</th></tr></thead><tbody>'+
      evidence.rows.filter(r=>r.total).map(r=>'<tr'+(r.months===row?.months?' class="nv-selected-tenor"':'')+'><th scope="row">'+r.months+' months</th><td>'+frequency(r.endHits,r.total,r.endPct)+'</td><td>'+frequency(r.touchHits,r.total,r.touchPct)+'</td></tr>').join('')+'</tbody></table>';
    panel.hidden=false;
    method.textContent='Sample from '+endMonth(evidence.startMonth+'-01')+' to '+endMonth(evidence.endMonth+'-01')+', using complete monthly closes. Each period starts at its own price. Neighbouring periods overlap and can count the same sell-off. Falls between month-ends can be missed. Future loss odds are unknown. The note’s own payout also depends on daily knock-out observations.';
  }

  function renderHistory(market,test) {
    const points=historyWindow(market);
    drawChart(points,test);
    const intro=byId('nv-price-context'), footer=byId('nv-history-details');
    if(points.length<2){intro.textContent='Dated prices are unavailable.';footer.textContent='';return;}
    let high=points[0], peak=high, trough=high, maxDrawdown=0;
    for(const point of points){
      if(point[1]>high[1]) high=point;
      const drop=1-point[1]/high[1];
      if(drop>maxDrawdown) {peak=high;trough=point;maxDrawdown=drop;}
    }
    const [date]=market.latest;
    intro.textContent='The largest drop between a peak and a later monthly close in this window was '+rate(maxDrawdown*100)+', from '+amount(peak[1])+' ('+endMonth(peak[0])+') to '+amount(trough[1])+' ('+endMonth(trough[0])+').';
    const atOrBelow=test===null?null:points.filter(p=>p[1]<=test).at(-1);
    footer.textContent=(test===null?'':atOrBelow?'The latest plotted close at or below '+amount(test)+' was '+amount(atOrBelow[1])+' in '+endMonth(atOrBelow[0])+'. ':'All plotted closes were higher than '+amount(test)+'. ')+'The chart joins split-adjusted monthly closes from '+endMonth(points[0][0])+' through '+shortDate(date)+'. Its last point includes the latest available close.';
  }

  function renderStress(context,test) {
    const box=byId('nv-stress-result');
    box.dataset.outcome='neutral';
    if(!context){box.textContent='Choose a priced quote and a valid payment to see its payout here.';return;}
    if(test===null){box.textContent='Enter a sale price of zero or more, in dollars and cents.';return;}
    const {product,tenor,payment,exitShares,refund,exitPrice,knockOutDay,knockOutPrice}=context;
    const name=escape(product)+' · '+number(tenor)+' months';
    if(knockOutDay){
      box.dataset.outcome=context.pnl<0?'loss':context.pnl>0?'gain':'neutral';
      box.innerHTML='<strong>'+name+' · Sold on knock-out day '+number(knockOutDay)+'</strong><div>The decline path already sold '+number(exitShares)+' shares at '+amount(exitPrice)+' and refunded '+amount(refund)+'. The modeled exit value was '+amount(context.exitValue)+' and P&amp;L was '+signedMoney(context.pnl)+'. A later stock price leaves this cash payout unchanged.</div>';
      return;
    }
    if(Number.isFinite(knockOutPrice) && cents(test)>=cents(knockOutPrice)){
      box.innerHTML='<strong>'+name+' · Knock-out threshold reached</strong><div>'+amount(test)+' reaches the daily knock-out level of '+amount(knockOutPrice)+'. Enter this closing price in the daily path editor to calculate the payout for that trigger day.</div>';
      return;
    }
    const proceedsCents=exitShares*cents(test);
    const payout=(proceedsCents+cents(refund))/100;
    const pnl=(proceedsCents+cents(refund)-cents(payment))/100;
    box.dataset.outcome=pnl<0?'loss':pnl>0?'gain':'neutral';
    const label=pnl<0?'Loss':pnl>0?'Gain':'Break-even';
    const title=label+' at '+amount(test)+(pnl===0?'':' · '+amount(Math.abs(pnl))+' ('+rate(Math.abs(pnl/payment*100))+' of payment)');
    box.innerHTML='<strong>'+title+'</strong><div>'+name+' · Assume the sustained-decline path reaches maturity and the same shares are sold at the test price.</div><div class="nv-work">'+number(exitShares)+' shares × '+amount(test)+' = '+amount(proceedsCents/100)+' sale proceeds. Add '+amount(refund)+' refunded cash = '+amount(payout)+' received. Subtract '+amount(payment)+' paid = '+signedMoney(pnl)+' P&amp;L.</div><div class="nv-note">If NVDA reached $0.00 at maturity on this path, the shareholding would be worthless. The modeled refund would leave a loss of '+amount(payment-refund)+'.</div>';
  }

  function refresh() {
    const market=window.AccumulatorMarket?.getState();
    const context=window.AccumulatorMarket?.getStressContext();
    if(!customTestPrice) input.value=context ? (cents(context.exitPrice)/100).toFixed(2) : '';
    const test=validTest()?input.valueAsNumber:null;
    renderStress(context,test);
    renderHistoricalFrequency(market,context,test);
    renderHistory(market,test);
    renderMetrics(market,test);
  }
  input.addEventListener('input',()=>{customTestPrice=true;refresh();});
  byId('nv-use-69').addEventListener('click',()=>{customTestPrice=true;input.value='69.00';refresh();});
  byId('nv-use-path').addEventListener('click',()=>{customTestPrice=false;refresh();});
  renderAccounts();
  document.addEventListener('accumulator:stress-context',refresh);
  refresh();
  if(typeof ResizeObserver !== 'undefined'){
    const chart=byId('nv-history-chart');
    let width=chart.clientWidth;
    new ResizeObserver(()=>{
      if(chart.clientWidth===width)return;
      width=chart.clientWidth;
      drawChart(historyWindow(window.AccumulatorMarket?.getState()),validTest()?input.valueAsNumber:null);
    }).observe(chart);
  }
})();
