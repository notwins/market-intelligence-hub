/* Quote comparisons share the simulator's funded-share and daily observation model. */
(() => {
  'use strict';
  const root = document.getElementById('sn-comparison');
  if (!root) return;
  const model = window.AccumulatorModel;
  const quotes = Accumulator.quotes.filter(q => q.product === 'JPM SN' && q.multiple === 1);
  const initial = ['sn-6-120-1', 'sn-6-120-2'];
  const selected = new Set(initial.filter(id => quotes.some(q => q.id === id)));
  if (selected.size < 2) quotes.slice(0, 2).forEach(q => selected.add(q.id));
  const wholeUSD = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0});
  const unitUSD = new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2});
  const integers = new Intl.NumberFormat('en-US', {maximumFractionDigits:0});
  const money = n => wholeUSD.format(Math.abs(n) < 0.5 ? 0 : n);
  const signed = n => (n > 0 && Math.abs(n) >= 0.5 ? '+' : '') + money(n);
  const pct = n => (Object.is(Number(n.toFixed(1)), -0) ? '0.0' : n.toFixed(1)) + '%';
  const signedPct = n => (n >= 0.05 ? '+' : '') + pct(n);
  const cents = n => Math.round((n + Number.EPSILON) * 100);
  const byId = id => document.getElementById(id);
  const cellClass = n => n < 0 ? 'negative' : n > 0 ? 'positive' : '';
  const label = index => 'SN ' + String.fromCharCode(65 + index);
  let active = 'early';
  let currentRows = [];
  let currentNotes = [];

  root.innerHTML = `
    <div class="heading"><div><h2 id="sn-compare-title">Compare JPM structured notes</h2>
      <p>Apply one NVDA price path to the selected normal accumulators. Each uses the target budget and starting share price entered above.</p>
    </div></div>
    <div class="cmp-tools"><button type="button" id="cmp-add-current">Add current chart note</button><span id="cmp-current" class="small"></span></div>
    <details class="cmp-selector"><summary id="cmp-selection-count">Choose notes</summary>
      <fieldset id="cmp-choices"><legend>Include in comparison</legend></fieldset>
    </details>
    <div id="cmp-notice" class="small" role="status"></div>
    <div id="cmp-content">
      <p class="small">Select a strike to plot that note on the highlighted scenario below. For a follow-on strategy, the chart shows the original SN through its maturity.</p>
      <div class="tableScroll cmp-funding" tabindex="0" aria-label="Selected note terms and funded amounts">
        <table><thead><tr><th scope="col">Note</th><th scope="col">Tenor / guarantee</th><th scope="col">Strike</th><th scope="col">KO</th><th scope="col">Shares / month</th><th scope="col">Payment</th><th scope="col">vs. target</th></tr></thead><tbody id="cmp-terms"></tbody></table>
      </div>
      <details class="cmp-assumptions"><summary>Scenario prices &amp; observation days</summary>
        <p>Leave a field empty to use the value shown as its placeholder. Day 1 is the first simulated trading day.</p>
        <div class="cmp-inputs">
          <label>Early rally · trading day<input id="cmp-early" type="number" min="1" step="1"></label>
          <label>Later rally · trading day<input id="cmp-late" type="number" min="1" step="1"></label>
          <label>Rally price · USD<input id="cmp-rally" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Below-strike case · USD<input id="cmp-down" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Near-KO reference<select id="cmp-reference"></select></label>
          <label>Near-KO gap<select id="cmp-gap"><option value="cent">$0.01 below KO</option><option value="bp">0.01% below KO</option></select></label>
        </div>
      </details>
      <div class="cmp-heading"><h3>Scenario outcomes</h3><label>Rank by <select id="cmp-rank"><option value="pnl">Dollar P&amp;L</option><option value="rate">Return on payment</option></select></label></div>
      <p class="small" id="cmp-criteria"></p>
      <div class="tableScroll cmp-results" tabindex="0" aria-label="Payout comparison by scenario"><table id="cmp-grid"></table></div>
      <h3 id="cmp-detail-title" tabindex="-1"></h3><p class="small" id="cmp-description"></p>
      <div class="tableScroll cmp-results" tabindex="0" aria-labelledby="cmp-detail-title"><table id="cmp-detail"></table></div>
      <details class="cmp-assumptions"><summary>Holding or selling shares after maturity</summary>
        <p>Choose the maturity price, then compare keeping all shares with selling a chosen quantity through an illustrative decumulator. Both use the same later NVDA price.</p>
        <div class="cmp-inputs">
          <label>Starting maturity case<select id="cmp-origin"><option value="down">Below strike</option><option value="flat">Trade-day spot</option></select></label>
          <label>Later NVDA price · USD<input id="cmp-recovery" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Decumulator sale strike · USD<input id="cmp-sale-strike" type="number" min="0.01" max="1000000" step="0.01"></label>
          <label>Shares assumed sold per SN<input id="cmp-sale-units" type="number" min="0" max="10000000000" step="1"></label>
        </div>
        <p>The decumulator example assumes the stated quantity actually sells at its sale strike. We cap sales at available shares and value unsold shares at the later NVDA price. The training example is cash-funded by selling the shares and subscribing with the proceeds. This is a hypothetical sale allocation. An actual quote sets the sale quantity, timing and settlement. Unsold shares can fall further, and shares sold at the strike miss any larger rebound.</p>
      </details>
      <p class="small cmp-foot">The normal note buys its monthly share quantity at the strike. A daily KO in the guarantee fills the guaranteed months. After the guarantee, a mid-month KO keeps whole shares accrued through the preceding trading day. The model spreads shares across each month’s observation days and returns payment less the cost of all shares bought.</p>
      <p class="small cmp-foot">Each comparison assumes USD cash earns 0% after refund or sale. Sale proceeds at KO use the observed market price, including any gap above the barrier. Actual execution and settlement can differ. Holding shares keeps the downside as well as any recovery.</p>
    </div>`;

  byId('cmp-choices').innerHTML = quotes.map(q => `<label><input type="checkbox" data-cmp-quote="${q.id}" ${selected.has(q.id) ? 'checked' : ''}><span><b>${pct(q.strike)} strike</b> · ${q.months}M<small>${pct(q.ko)} KO · ${q.minimum}M guarantee</small></span></label>`).join('');

  function read(id, fallback) {
    const field = byId('cmp-' + id);
    field.placeholder = String(fallback);
    if (field.validity.badInput || (field.value !== '' && !field.checkValidity())) {
      throw Error('Check the value for ' + field.parentElement.firstChild.textContent.trim() + '.');
    }
    return field.value === '' ? fallback : field.valueAsNumber;
  }

  function scenarioPaths(notes, spot) {
    const earliest = Math.min(...notes.map(n => n.terms.days));
    const horizon = Math.max(...notes.map(n => n.terms.days));
    const firstMinimum = Math.min(...notes.map(n => n.terms.guaranteeDay));
    const lastMinimum = Math.max(...notes.map(n => n.terms.guaranteeDay));
    const lowestKO = Math.min(...notes.map(n => n.terms.ko));
    const lowestStrike = Math.min(...notes.map(n => n.terms.strike));
    ['early', 'late'].forEach(id => byId('cmp-' + id).max = String(horizon));
    const early = read('early', Math.max(1, Math.ceil(firstMinimum / 2)));
    const late = read('late', Math.min(horizon, Math.max(lastMinimum + 1, Math.floor((earliest + lastMinimum) / 2))));
    const rally = read('rally', Math.max(...notes.map(n => n.terms.ko)));
    const down = read('down', Math.max(0, Math.min(cents(lowestStrike) - 1, Math.round(lowestStrike * 85)) / 100));
    const useBp = byId('cmp-gap').value === 'bp';
    const reference = byId('cmp-reference');
    const previous = reference.value;
    reference.innerHTML = '<option value="lowest">Lowest selected KO</option>' +
      notes.map((n, i) => `<option value="${n.quote.id}">${label(i)} · ${unitUSD.format(n.terms.ko)}</option>`).join('');
    const referenceIndex = notes.findIndex(n => n.quote.id === previous);
    reference.value = referenceIndex < 0 ? 'lowest' : previous;
    const referenceName = referenceIndex < 0 ? 'the lowest selected KO' : label(referenceIndex) + '’s KO';
    const koCents = cents(referenceIndex < 0 ? lowestKO : notes[referenceIndex].terms.ko);
    const near = Math.max(0, useBp ? Math.min(koCents - 1, Math.round(koCents * .9999)) : koCents - 1) / 100;
    const jump = day => Array.from({length:horizon}, (_, i) => i + 1 < day ? spot : rally);
    const glide = end => Array.from({length:horizon}, (_, i) => {
      const fraction = Math.min(1, (i + 1) / earliest);
      return cents(spot + (end - spot) * fraction) / 100;
    });
    const ramp = `NVDA moves from ${unitUSD.format(spot)} to the stated price by trading day ${earliest}, then stays there through the longest tenor.`;
    return [
      {id:'early', name:'Early KO', short:'Earlier rally', path:jump(early), description:`NVDA holds at ${unitUSD.format(spot)} until it moves to ${unitUSD.format(rally)} on day ${early}. Each note checks its own KO and minimum period.`},
      {id:'late', name:'Later KO', short:'Later rally', path:jump(late), description:`NVDA holds at ${unitUSD.format(spot)} until it moves to ${unitUSD.format(rally)} on day ${late}. A shorter note may already have matured. The detail table gives the actual exit for each note.`},
      {id:'down', name:'Below strike', short:'Maturity', path:glide(down), description:`Maturity case at ${unitUSD.format(down)}. ${ramp}`},
      {id:'flat', name:'Trade-day spot', short:'Maturity', path:glide(spot), description:`NVDA stays at its trade-day price of ${unitUSD.format(spot)} through every daily observation.`},
      {id:'near', name:'Just below KO', short:'Maturity', path:glide(near), description:`Maturity case at ${unitUSD.format(near)}, ${useBp ? '0.01% below ' + referenceName + ', rounded to the nearest cent with at least a one-cent gap' : '$0.01 below ' + referenceName}. Notes with a lower barrier can knock out earlier. ${ramp}`}
    ];
  }

  function exitValues(sim) {
    const e = sim.exit;
    return {
      timing: sim.koDay ? 'KO day ' + sim.koDay + (sim.koDay <= sim.guaranteeDay ? ' · in guarantee' : ' · after guarantee') : 'Maturity · day ' + e.day,
      shares:e.shares, spent:e.spent, refund:e.refunded, exitSpot:e.price,
      sold:e.shares, proceeds:e.shareValue, retained:0, retainedValue:0,
      nav:e.value, pnl:e.profit, rate:e.rate
    };
  }

  function afterMaturity(base, follow, laterSpot, saleStrike, units, isDecumulator) {
    if (base.koDay) return {...follow, change:0};
    const {shares, refunded, value, spent, day, price} = base.exit;
    const sold = isDecumulator ? Math.min(units, shares) : 0;
    const proceeds = sold * saleStrike;
    const retained = shares - sold;
    const retainedValue = retained * laterSpot;
    const nav = refunded + proceeds + retainedValue;
    const pnl = nav - base.payment;
    return {
      timing:'Held at maturity · day ' + day, shares, spent, refund:refunded, exitSpot:price,
      sold, proceeds, retained, retainedValue, nav, pnl, rate:100 * pnl / base.payment, change:nav - value
    };
  }

  function compare(notes, spot) {
    const paths = scenarioPaths(notes, spot);
    const rows = paths.map(s => {
      const sims = notes.map(n => model.simulateDaily(n.quote, spot, n.target, s.path));
      let name = s.name;
      if (s.id === 'early' || s.id === 'late') {
        name = s.short;
        if (sims.every(sim => sim.koDay && sim.koDay <= sim.guaranteeDay)) name = 'KO within guarantee';
        if (sims.every(sim => sim.koDay > sim.guaranteeDay && sim.koDay < sim.days)) name = 'KO after guarantee';
      } else if (s.id === 'down' && sims.some(sim => sim.koDay || sim.exit.price >= sim.strike)) {
        name = 'Custom maturity price';
      }
      return {...s, name, sims, values:sims.map(exitValues)};
    });
    const basis = rows.find(r => r.id === byId('cmp-origin').value);
    const later = read('recovery', cents(spot * 1.10) / 100);
    const saleStrike = read('sale-strike', Math.max(0.01, cents(spot * 1.05) / 100));
    const units = read('sale-units', Math.floor(Math.min(...basis.sims.map(s => s.exit.shares)) / 2));
    const common = `From the ${basis.name.toLowerCase()} maturity case, value shares later at ${unitUSD.format(later)}. An earlier KO leaves its assumed sale proceeds in cash.`;
    for (const dec of [false, true]) {
      const name = dec ? 'Decumulator sale' : 'Hold the shares';
      rows.push({
        id:dec ? 'decu' : 'hold', name, short:'After maturity', follow:true, path:basis.path, basisName:basis.name,
        description: common + (dec ? ` Assume up to ${integers.format(units)} shares per note sell at ${unitUSD.format(saleStrike)}. Mark all remaining shares at ${unitUSD.format(later)}.` : 'Keep all shares delivered at maturity and add their later value to refunded cash.'),
        values:basis.sims.map((s, i) => afterMaturity(s, basis.values[i], later, saleStrike, units, dec))
      });
    }
    return rows;
  }

  function header(notes) {
    return notes.map((n, i) => `<th scope="col">${label(i)}<small>${pct(n.quote.strike)} strike</small></th>`).join('');
  }

  function verdict(values, metric) {
    // Dollar differences are compared to cents. Rates use the exact P&L and funded payment.
    const scores = values.map(v => metric === 'pnl' ? cents(v.pnl) : v.rate);
    const top = Math.max(...scores);
    const winners = scores.flatMap((s, i) => Math.abs(s - top) < 1e-9 ? [i] : []);
    const names = winners.map(label).join(' / ');
    if (winners.length === scores.length) return 'All tied';
    if (winners.length > 1) return names + ' tie';
    return names;
  }

  function renderGrid(notes, rows) {
    const metric = byId('cmp-rank').value;
    const asValue = metric === 'pnl' ? signed : signedPct;
    byId('cmp-criteria').textContent = (metric === 'pnl' ? 'Dollar P&L uses each note’s actual payment.' : 'Return is P&L divided by that note’s actual payment.') + ' The highest outcome wins each row, including the smallest loss. Rankings use values before display rounding. Select a scenario to inspect its payout.';
    byId('cmp-grid').innerHTML = `<thead><tr><th scope="col">Scenario</th>${header(notes)}<th scope="col">Highest ${metric === 'pnl' ? 'P&amp;L' : 'return'}</th></tr></thead><tbody>` + rows.map(r =>
      `<tr class="${r.id === active ? 'cmp-active' : ''}"><th scope="row"><button type="button" data-cmp-case="${r.id}" aria-pressed="${r.id === active}" aria-controls="cmp-detail">${r.name}</button><small>${r.short}</small></th>` +
      r.values.map(v => `<td class="${cellClass(v.pnl)}">${asValue(v[metric])}</td>`).join('') + `<td class="cmp-winner">${verdict(r.values, metric)}</td></tr>`
    ).join('') + '</tbody>';
    const row = rows.find(r => r.id === active);
    byId('cmp-detail-title').textContent = row.name + ' · payout detail';
    byId('cmp-description').textContent = row.description;
    const fields = [
      ['Exit of original SN','timing',String], ['NVDA at exit','exitSpot',v => unitUSD.format(v)],
      ['Shares bought','shares',v => integers.format(v)], ['Capital used at strike','spent',money],
      ['Cash refunded','refund',money], ['Shares assumed sold','sold',v => integers.format(v)], ['Assumed sale proceeds','proceeds',money]
    ];
    if (row.follow) fields.push(['Shares still held','retained',v => integers.format(v)],['Market value of shares held','retainedValue',money]);
    fields.push(['Total value','nav',money],['P&L since investment','pnl',signed],['Return on payment','rate',signedPct]);
    if (row.follow) fields.push(['Change since SN exit','change',signed]);
    byId('cmp-detail').innerHTML = '<thead><tr><th scope="col">USD unless stated</th>' + header(notes) + '</tr></thead><tbody>' +
      fields.map(([desc,key,fmt]) => `<tr><th scope="row">${desc}</th>` + row.values.map(v => `<td class="${key === 'pnl' || key === 'rate' || key === 'change' ? cellClass(v[key]) : ''}">${fmt(v[key])}</td>`).join('') + '</tr>').join('') + '</tbody>';
  }

  function render() {
    currentRows = [];
    currentNotes = [];
    const selectQuotes = quotes.filter(q => selected.has(q.id));
    byId('cmp-selection-count').textContent = 'Choose notes · ' + selectQuotes.length + ' selected';
    const current = quotes.find(q => q.id === byId('quote').value);
    const addCurrent = byId('cmp-add-current');
    addCurrent.disabled = !current || selected.has(current.id);
    byId('cmp-current').textContent = !current ? 'Choose a JPM SN in the pricing chart to add it here.' :
      (selected.has(current.id) ? 'Already comparing' : 'Chart selection') + ' · ' + pct(current.strike) + ' strike · ' + current.months + 'M · ' + current.minimum + 'M guarantee';
    const notice = byId('cmp-notice');
    const content = byId('cmp-content');
    notice.textContent = '';
    content.hidden = true;
    if (selectQuotes.length < 2) {
      notice.textContent = 'Select at least two JPM notes to compare payouts.';
      return;
    }
    const spotField = byId('spot'), targetField = byId('capital');
    const spot = spotField.valueAsNumber, target = targetField.valueAsNumber;
    if (!spotField.checkValidity() || !targetField.checkValidity() || !(spot > 0 && target > 0)) {
      notice.textContent = 'Enter a valid starting price and target budget above.';
      return;
    }
    let notes;
    try {
      notes = selectQuotes.map(quote => ({quote, target, terms:model.terms(quote, spot, target)}));
      if (notes.some(n => n.terms.maximum < 1)) throw Error('Increase the target budget to size at least one share per month for every selected note.');
    } catch (e) {
      notice.textContent = e.message;
      return;
    }
    content.hidden = false;
    byId('cmp-terms').innerHTML = notes.map(({quote, terms:t}, i) => `<tr><th scope="row">${label(i)}</th><td>${quote.months}M / ${quote.minimum}M</td><td><button type="button" data-cmp-plot="${quote.id}" aria-label="Plot ${label(i)} at ${unitUSD.format(t.strike)} on the selected scenario">${unitUSD.format(t.strike)}</button><small>${pct(quote.strike)}</small></td><td>${unitUSD.format(t.ko)}<small>${pct(quote.ko)}</small></td><td>${integers.format(t.maximum)}</td><td>${money(t.payment)}</td><td>${signed(t.payment - target)}</td></tr>`).join('');
    try {
      currentRows = compare(notes, spot);
      currentNotes = notes;
      renderGrid(notes, currentRows);
    } catch (e) {
      notice.textContent = e.message;
      root.querySelectorAll('[data-cmp-plot]').forEach(button => { button.disabled = true; });
      for (const id of ['cmp-grid','cmp-detail','cmp-detail-title','cmp-description','cmp-criteria']) byId(id).textContent = '';
    }
  }

  byId('cmp-add-current').addEventListener('click', () => {
    const id = byId('quote').value;
    if (!quotes.some(q => q.id === id)) return;
    selected.add(id);
    root.querySelector('[data-cmp-quote="' + id + '"]').checked = true;
    render();
  });

  root.addEventListener('change', e => {
    const id = e.target.dataset.cmpQuote;
    if (id) {
      if (e.target.checked) selected.add(id);
      else selected.delete(id);
    }
    if (e.target.tagName === 'SELECT' || id) render();
  });
  root.addEventListener('input', e => {
    if (e.target.type === 'number') render();
  });
  root.addEventListener('click', e => {
    const plot = e.target.closest('[data-cmp-plot]');
    if (plot) {
      const note = currentNotes.find(n => n.quote.id === plot.dataset.cmpPlot);
      const row = currentRows.find(r => r.id === active);
      if (!note || !row) return;
      const name = row.follow ? row.name + ' · original SN only · ' + row.basisName : row.name;
      document.dispatchEvent(new CustomEvent('accumulator:plot-comparison', {
        detail:{quoteId:note.quote.id, daily:row.path.slice(0, note.terms.days), name}
      }));
      return;
    }
    const button = e.target.closest('[data-cmp-case]');
    if (!button) return;
    active = button.dataset.cmpCase;
    render();
    byId('cmp-detail-title').focus({preventScroll:true});
    byId('cmp-detail-title').scrollIntoView({block:'nearest'});
  });
  document.addEventListener('accumulator:inputs', render);
  render();
})();
