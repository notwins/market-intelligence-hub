(() => {
  'use strict';
  const result = document.getElementById('nv-stress-result');
  const input = document.getElementById('nv-stress-price');
  const finance = window.AccumulatorNvdaFinancialData;
  if (!result || !input || !finance) return;

  const card = document.createElement('section');
  card.id = 'nv-stress-fundamentals';
  card.setAttribute('aria-labelledby', 'nv-stress-fundamentals-title');
  card.innerHTML = '<h3 id="nv-stress-fundamentals-title">What the test price implies for NVIDIA</h3><div id="nv-stress-fundamentals-body"></div>';
  result.after(card);
  const body = card.lastElementChild;
  const {price} = window.AccumulatorFormat;
  const number = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const percent = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2, style: 'percent'});
  const dates = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
  const multiple = value => number.format(value) + '×';
  const billions = millions => '$' + number.format(millions / 1000) + 'B';
  const marketCap = millions => millions >= 1000000 ? '$' + number.format(millions / 1000000) + 'T' : billions(millions);
  const date = iso => dates.format(new Date(iso + 'T00:00:00Z'));
  const escape = value => value.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
  const q3Release = 'https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2027/default.aspx';
  const q4Release = 'https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/default.aspx';

  // The annual figures combine the nine months of FY2027 with the standalone Q4 of FY2026.
  // All aggregate amounts and share counts are in millions.
  const reported = {
    periodEnd: '2026-10-25',
    nineMonths: {netIncome: 183297, operating: 122675, capitalPurchases: 8856, principal: 147},
    priorQuarter: {netIncome: 42960, operating: 36190, capitalPurchases: 1284, principal: 4}
  };
  const freeCash = ({operating, capitalPurchases, principal}) => operating - capitalPurchases - principal;
  const fcf = freeCash(reported.nineMonths) + freeCash(reported.priorQuarter);
  const annualIncome = reported.nineMonths.netIncome + reported.priorQuarter.netIncome;
  const filingPeriod = date(finance.periodEnd);
  const {balance, income, cashFlow} = finance;
  const shares = balance.sharesOutstanding;
  const eps = income.trailingDilutedEps;
  const bookPerShare = balance.equity / shares;
  const quarterFcf = cashFlow.operating + cashFlow.capitalPurchases + cashFlow.capitalPrincipalPayments;
  const sensitivityCuts = [0, .25, .50, .75];

  function sensitivityTable(test, cap, reference, scale) {
    const scenarios = sensitivityCuts.map(cut => ({
      retained: 1 - cut,
      label: cut ? percent.format(cut) + ' lower' : 'Reported levels'
    }));
    if (reference && test) {
      const shift = scale === 1 ? 'reported levels' : percent.format(Math.abs(1 - scale)) + (scale < 1 ? ' cut' : ' increase');
      scenarios.push({retained: scale, label: 'Crossover <small>' + shift + '</small>', crossover: true});
      scenarios.sort((a, b) => b.retained - a.retained);
    }
    const rows = scenarios.map(({retained, label, crossover}) => {
      const adjustedEps = eps * retained;
      const adjustedFcf = fcf * retained;
      const pe = test ? multiple(test / adjustedEps) : '—';
      const yieldText = cap ? percent.format(adjustedFcf / cap) : '—';
      const highlight = crossover ? ' data-crossover' :
        test && scale !== null && retained < scale ? ' data-above-benchmark' : '';
      return '<tr' + highlight + '><th scope="row">' + label + '</th><td>' + price(adjustedEps) +
        '</td><td>' + billions(adjustedFcf) + '</td><td>' + pe + '</td><td>' + yieldText + '</td></tr>';
    }).join('');
    let comparison = '';
    if (reference && test) {
      comparison = 'At the ' + price(reference.price) + ' close on ' + reference.date + ', reported figures imply ' +
        multiple(reference.price / eps) + ' P/E and ' + percent.format(fcf / reference.cap) + ' FCF yield. The crossover matches both.';
      if (scale < 1) {
        const firstAbove = sensitivityCuts.find(cut => 1 - cut < scale);
        comparison += firstAbove ? ' The ' + percent.format(firstAbove) + ' cut is the first shown with higher P/E and lower yield.' :
          ' The displayed cuts are at or below that crossover.';
      } else if (scale === 1) {
        comparison += ' Any cut raises P/E and lowers yield at this price.';
      } else {
        comparison += ' At the test price, even reported earnings and cash flow imply a higher P/E and lower yield.';
      }
    } else if (!test) {
      comparison = 'P/E and free cash flow yield are shown as unavailable at a zero share price.';
    } else {
      comparison = 'A dated close is needed to calculate the crossover.';
    }
    return '<section class="nv-fundamentals-sensitivity" aria-labelledby="nv-fundamentals-sensitivity-title">' +
      '<h4 id="nv-fundamentals-sensitivity-title">If earnings and free cash flow fall</h4>' +
      '<p class="nv-fundamentals-sensitivity-basis">Each cut applies to annual diluted EPS and free cash flow. Ratios use unrounded amounts at ' +
      price(test) + '.</p><div class="nv-fundamentals-sensitivity-scroll"><table aria-labelledby="nv-fundamentals-sensitivity-title"><thead><tr><th scope="col">Scenario</th>' +
      '<th scope="col">EPS</th><th scope="col">Annual FCF</th>' +
      '<th scope="col">P/E</th><th scope="col">FCF yield</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (comparison ? '<p class="nv-fundamentals-sensitivity-comparison">' + comparison + '</p>' : '') + '</section>';
  }

  function refresh() {
    if (finance.periodEnd !== reported.periodEnd) {
      body.textContent = 'The trailing cash-flow figures are unavailable for this financial statement date.';
      return;
    }
    const test = input.valueAsNumber;
    if (!input.value || !input.checkValidity() || test < 0 || !Number.isSafeInteger(Math.round(test * 100))) {
      body.textContent = 'Enter a valid test sale price to compare it with NVIDIA’s financial statements.';
      return;
    }

    const latest = window.AccumulatorMarket?.getState()?.latest;
    const datedClose = latest ? Math.round((latest[1] + Number.EPSILON * latest[1]) * 100) / 100 : null;
    const reference = datedClose > 0 ? {price: datedClose, cap: datedClose * shares, date: date(latest[0])} : null;
    const cap = test * shares;
    const scale = reference ? test / reference.price : null;
    const change = scale === null ? null : Math.abs(scale - 1);
    const move = scale === 1 ? 'matches the dated close' :
      reference ? 'is ' + percent.format(change) + (scale < 1 ? ' below' : ' above') + ' the ' + price(reference.price) + ' close on ' + reference.date : '';
    const lead = '<strong>At ' + price(test) + ', NVIDIA’s implied market value is ' + marketCap(cap) +
      '.</strong> The test price ' + (move ? move + '.' : 'uses the reported financial figures below.');
    const cells = [
      ['Implied market cap', marketCap(cap), reference ? marketCap(reference.cap) + ' at the dated close' : 'Estimated using ' + number.format(shares / 1000) + 'B shares'],
      ['Trailing P/E', test ? multiple(test / eps) : '—', reference ? multiple(reference.price / eps) + ' at the dated close' : price(eps) + ' trailing diluted EPS'],
      ['Trailing free cash flow yield', cap ? percent.format(fcf / cap) : '—', cap ? multiple(cap / fcf) + ' P/FCF' +
        (reference ? ' vs ' + multiple(reference.cap / fcf) + ' at the dated close' : '') : 'Yield is undefined at zero market value'],
      ['Price to book', test ? multiple(test / bookPerShare) : '—', price(bookPerShare) + ' of book value per share']
    ];

    let explanation;
    if (test === 0) {
      explanation = 'A zero share price would erase the stock market value. The amounts below describe the past filings. Common shareholders can lose their entire investment.';
    } else if (scale === null) {
      explanation = 'At this price, the multiples above use reported trailing earnings and cash flow. A dated close is needed to estimate what earnings would support the same multiples.';
    } else if (scale === 1) {
      explanation = 'At the dated close, the reference valuations already use ' + price(eps) + ' of trailing diluted EPS and ' +
        billions(fcf) + ' of trailing free cash flow.';
    } else {
      explanation = 'Keeping the dated close multiples and the share count fixed, this price would imply annual EPS of <strong>' +
        price(eps * scale) + '</strong> and free cash flow of <strong>' + billions(fcf * scale) +
        '</strong>, both ' + percent.format(change) + (scale < 1 ? ' below' : ' above') +
        ' the reported trailing figures. If that earning power holds, investors would be paying ' +
        (scale < 1 ? 'less for each dollar of earnings and free cash flow.' : 'more for each dollar of earnings and free cash flow.');
    }

    const history = Array.from(document.querySelectorAll('#nv-history-frequency .nv-frequency-pair strong'), node => escape(node.textContent.trim()));
    const tenor = window.AccumulatorMarket?.getStressContext()?.tenor;
    const historical = history.length === 2 && Number.isInteger(tenor) ?
      'Over the ten-year sample, <strong>' + history[0] + '</strong> ' + tenor + '-month windows finished down at least this much. <strong>' +
      history[1] + '</strong> reached the decline by a month-end, including windows that later recovered. ' : '';
    const balanceText = '<strong>' + billions(balance.assets) + '</strong> of total assets less <strong>' +
      billions(balance.liabilities) + '</strong> of liabilities left <strong>' + billions(balance.equity) +
      '</strong> of book equity. Cash and equivalents were ' + billions(balance.cash) + '. Gross borrowings were ' +
      billions(balance.shortTermDebt + balance.longTermDebt) + '.';
    const earningsText = 'The four quarters ended ' + filingPeriod + ' produced <strong>' + billions(annualIncome) +
      '</strong> in GAAP net income, <strong>' + price(eps) + '</strong> in diluted EPS and <strong>' + billions(fcf) +
      '</strong> in free cash flow. ' + finance.quarter + ' alone generated ' + billions(quarterFcf) + ' in free cash flow.';

    const sourcesOpen = body.querySelector('details')?.open;
    body.innerHTML = '<p class="nv-fundamentals-lead">' + lead + '</p>' +
      '<dl class="nv-fundamentals-multiples">' + cells.map(([label, value, detail]) =>
        '<div><dt>' + label + '</dt><dd>' + value + '<small>' + detail + '</small></dd></div>').join('') + '</dl>' +
      '<div class="nv-fundamentals-statements"><div><h4>Balance sheet · ' + filingPeriod + '</h4><p data-valuation-balance>' + balanceText +
      '</p></div><div><h4>Trailing earnings and cash flow</h4><p data-valuation-earnings>' + earningsText + '</p></div></div>' +
      '<p class="nv-fundamentals-implied"><strong>What would support this price?</strong> <span>' + explanation + '</span></p>' +
      sensitivityTable(test, cap, reference, scale) +
      '<p class="nv-fundamentals-history"><strong>' + (reference && scale < 1 ? 'Could it fall this far?' : 'What can change the valuation?') + '</strong> ' + historical +
      'Weaker earnings, tighter cash flow or a lower valuation multiple can drive a sell-off. Book value is an accounting measure. Share prices can fall below it.</p>' +
      '<details class="nv-fundamentals-sources"' + (sourcesOpen ? ' open' : '') + '><summary>Calculations and sources</summary>' +
      '<p>Market cap uses the reported ' + number.format(shares / 1000) + ' billion common shares as of ' + date(balance.sharesOutstandingDate) +
      '. The balance sheet and trailing results are dated ' + filingPeriod + '. P/E uses the sum of four reported quarterly diluted EPS figures. ' +
      'Free cash flow yield divides trailing free cash flow by implied market cap.</p>' +
      '<p>Free cash flow is operating cash flow less capital purchases and related principal payments. ' +
      'The first nine months of FY2027 contributed ' + billions(freeCash(reported.nineMonths)) +
      ' and Q4 FY2026 contributed ' + billions(freeCash(reported.priorQuarter)) + '. The historical windows overlap and can count the same sell-off.</p>' +
      '<ul><li><a href="' + finance.sources[0].url + '" target="_blank" rel="noopener noreferrer">' + finance.quarter + ' financial statements</a></li>' +
      '<li><a href="' + q3Release + '" target="_blank" rel="noopener noreferrer">' + finance.quarter + ' free cash flow reconciliation</a></li>' +
      '<li><a href="' + q4Release + '" target="_blank" rel="noopener noreferrer">Q4 FY2026 earnings and cash flow</a></li>' +
      '<li><a href="' + finance.sources[2].url + '" target="_blank" rel="noopener noreferrer">Q2 FY2027 Form 10-Q share count</a></li></ul></details>';
  }

  // The shared context refreshes the sale price and historical sample before these listeners run.
  input.addEventListener('input', refresh);
  document.getElementById('nv-use-69').addEventListener('click', refresh);
  document.getElementById('nv-use-path').addEventListener('click', refresh);
  document.addEventListener('accumulator:stress-context', refresh);
  refresh();
})();
