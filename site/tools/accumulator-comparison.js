/* Quote comparisons share the simulator's funded-share and daily observation model. */
(() => {
  'use strict';
  const root = document.getElementById('sn-comparison');
  if (!root) return;
  const model = window.AccumulatorModel;
  const quotes = Accumulator.quotes.filter(q => q.multiple === 1);
  const quoteById = new Map(quotes.map(q => [q.id, q]));
  const initial = ['si-9-120-1', 'sn-9-120-1'];
  const selected = new Set(initial.filter(id => quotes.some(q => q.id === id)));
  if (selected.size < 2) quotes.slice(0, 2).forEach(q => selected.add(q.id));
  const {money, signedMoney:signed, quote:quotePct, price, shares:units, signedRate:signedPct} = window.AccumulatorFormat;
  const cents = n => Math.round((n + Number.EPSILON) * 100);
  const byId = id => document.getElementById(id);
  const cellClass = n => n < 0 ? 'negative' : n > 0 ? 'positive' : '';
  const letter = index => String.fromCharCode(65 + index);
  const label = (note, index) => letter(index) + ' · ' + note.quote.product;
  const quoteLabel = q => q.product + ' · ' + quotePct(q.strike) + ' strike · ' + q.months + 'M · ' + quotePct(q.ko) + ' KO · ' + q.minimum + 'M guarantee';
  let active = 'early';
  let currentRows = [];
  let currentNotes = [];
  let currentSettings = null;

  root.innerHTML = `
    <div class="heading"><div><h2 id="sn-compare-title">Compare SI and SN payouts</h2>
      <p>See what each structure pays on the same NVDA price path. Each starts with your budget and rounds to a whole monthly share quantity.</p>
    </div></div>
    <div class="cmp-tools"><a href="#library">Choose strikes in pricing tables</a><button type="button" id="cmp-clear">Clear selection</button></div>
    <div id="cmp-basket" aria-label="Selected structures"></div>
    <p id="cmp-selection-feedback" class="small" aria-live="polite" aria-atomic="true"></p>
    <details class="cmp-selector"><summary id="cmp-selection-count">Choose structures</summary>
      <fieldset id="cmp-choices"><legend>Include in comparison</legend></fieldset>
      <div class="cmp-tools"><button type="button" id="cmp-add-current">Add the chart selection</button><span id="cmp-current" class="small"></span></div>
    </details>
    <div id="cmp-notice" class="small" role="status"></div>
    <div id="cmp-content">
      <p class="small">Tap a scenario to see the cash and shares. Tap a dollar strike in the table below to plot that structure on the selected price path.</p>
      <div class="tableScroll cmp-funding" tabindex="0" aria-label="Selected structure terms and funded amounts">
        <table><thead><tr><th scope="col">Structure</th><th scope="col">Tenor / guarantee</th><th scope="col">Strike</th><th scope="col">KO</th><th scope="col">Shares / month</th><th scope="col">Payment</th><th scope="col">vs. target</th></tr></thead><tbody id="cmp-terms"></tbody></table>
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
          <label>Shares assumed sold per structure<input id="cmp-sale-units" type="number" min="0" max="10000000000" step="1"></label>
        </div>
        <p>The decumulator example assumes the stated quantity actually sells at its sale strike. We cap sales at available shares and value unsold shares at the later NVDA price. The training example is cash-funded by selling the shares and subscribing with the proceeds. This is a hypothetical sale allocation. An actual quote sets the sale quantity, timing and settlement. Unsold shares can fall further, and shares sold at the strike miss any larger rebound.</p>
      </details>
      <p class="small cmp-foot">A normal accumulator buys its full scheduled share quantity at the strike. A daily KO in the guarantee fills the guaranteed months. After the guarantee, a mid-month KO keeps whole shares accrued through the preceding trading day. The model spreads shares across each month’s observation days and returns payment less the cost of all shares bought.</p>
      <p class="small cmp-foot">Each comparison assumes USD cash earns 0% after refund or sale. Sale proceeds at KO use the observed market price, including any gap above the barrier. Actual execution and settlement can differ. Holding shares keeps the downside as well as any recovery.</p>
    </div>`;

  byId('cmp-choices').innerHTML = quotes.map(q => `<label><input type="checkbox" data-cmp-quote="${q.id}"><span><b>${q.product} · ${quotePct(q.strike)}</b><small>${q.months}M tenor · ${quotePct(q.ko)} KO · ${q.minimum}M guarantee</small></span></label>`).join('');

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
      notes.map((n, i) => `<option value="${n.quote.id}">${label(n,i)} · ${price(n.terms.ko)}</option>`).join('');
    const referenceIndex = notes.findIndex(n => n.quote.id === previous);
    reference.value = referenceIndex < 0 ? 'lowest' : previous;
    const referenceName = referenceIndex < 0 ? 'the lowest selected KO' : label(notes[referenceIndex],referenceIndex) + '’s KO';
    const koCents = cents(referenceIndex < 0 ? lowestKO : notes[referenceIndex].terms.ko);
    const near = Math.max(0, useBp ? Math.min(koCents - 1, Math.round(koCents * .9999)) : koCents - 1) / 100;
    const jump = day => Array.from({length:horizon}, (_, i) => i + 1 < day ? spot : rally);
    const glide = end => Array.from({length:horizon}, (_, i) => {
      const fraction = Math.min(1, (i + 1) / earliest);
      return cents(spot + (end - spot) * fraction) / 100;
    });
    const ramp = `NVDA moves from ${price(spot)} to the stated price by trading day ${earliest}, then stays there through the longest tenor.`;
    currentSettings = {earlyDay:early, lateDay:late, rally, down, near, referenceId:reference.value, gap:byId('cmp-gap').value};
    return [
      {id:'early', name:'Early KO', short:'Earlier rally', path:jump(early), description:`NVDA holds at ${price(spot)} until it moves to ${price(rally)} on day ${early}. Each accumulator uses its own KO and guaranteed period.`},
      {id:'late', name:'Later KO', short:'Later rally', path:jump(late), description:`NVDA holds at ${price(spot)} until it moves to ${price(rally)} on day ${late}. A shorter investment may already have matured. The detail table shows when each investment ends.`},
      {id:'down', name:'Below strike', short:'Maturity', path:glide(down), description:`Maturity case at ${price(down)}. ${ramp}`},
      {id:'flat', name:'Trade-day spot', short:'Maturity', path:glide(spot), description:`NVDA stays at its trade-day price of ${price(spot)} through every daily observation.`},
      {id:'near', name:'Just below KO', short:'Maturity', path:glide(near), description:`Maturity case at ${price(near)}, ${useBp ? '0.01% below ' + referenceName + ', rounded to the nearest cent with at least a one-cent gap' : '$0.01 below ' + referenceName}. A structure with a lower barrier can knock out earlier. ${ramp}`}
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
    const saleUnits = read('sale-units', Math.floor(Math.min(...basis.sims.map(s => s.exit.shares)) / 2));
    Object.assign(currentSettings, {followBasisId:basis.id, laterSpot:later, saleStrike, saleUnits});
    const common = `From the ${basis.name.toLowerCase()} maturity case, value shares later at ${price(later)}. An earlier KO leaves its assumed sale proceeds in cash.`;
    for (const dec of [false, true]) {
      const name = dec ? 'Decumulator sale' : 'Hold the shares';
      rows.push({
        id:dec ? 'decu' : 'hold', name, short:'After maturity', follow:true, path:basis.path, basisName:basis.name, sims:basis.sims,
        description: common + (dec ? ` Assume up to ${units(saleUnits)} shares from each investment sell at ${price(saleStrike)}. Mark all remaining shares at ${price(later)}.` : 'Keep all shares delivered at maturity and add their later value to refunded cash.'),
        values:basis.sims.map((s, i) => afterMaturity(s, basis.values[i], later, saleStrike, saleUnits, dec))
      });
    }
    return rows;
  }

  function header(notes) {
    return notes.map((n, i) => `<th scope="col">${label(n,i)}<small>${quotePct(n.quote.strike)} strike · ${n.quote.months}M<br>${quotePct(n.quote.ko)} KO · ${n.quote.minimum}M guarantee</small></th>`).join('');
  }

  function winnerIndices(values, metric) {
    const scores = values.map(v => metric === 'pnl' ? cents(v.pnl) : v.rate);
    const top = Math.max(...scores);
    return scores.flatMap((s, i) => Math.abs(s - top) < 1e-9 ? [i] : []);
  }

  function verdict(notes, values, metric) {
    const winners = winnerIndices(values, metric);
    if (winners.length === notes.length && notes.length > 1) return 'All tied';
    const names = winners.map(i => label(notes[i], i)).join(' / ');
    return winners.length > 1 ? names + ' tie' : names;
  }

  function renderGrid(notes, rows) {
    const metric = byId('cmp-rank').value;
    const asValue = metric === 'pnl' ? signed : signedPct;
    const showRank = notes.length > 1;
    byId('cmp-criteria').textContent = (metric === 'pnl' ? 'Dollar profit or loss compares what you receive with the amount you paid.' : 'Percentage return divides profit or loss by the amount paid for each structure.') + (showRank ? ' The highest result can be the smallest loss. Ranking uses the full calculation before rounding.' : ' Add another strike to see which structure comes out ahead.') + ' Tap a scenario for its payout.';
    byId('cmp-grid').innerHTML = `<thead><tr><th scope="col">Scenario</th>${header(notes)}${showRank ? '<th scope="col">Highest ' + (metric === 'pnl' ? 'P&amp;L' : 'return') + '</th>' : ''}</tr></thead><tbody>` + rows.map(r =>
      `<tr class="${r.id === active ? 'cmp-active' : ''}"><th scope="row"><button type="button" data-cmp-case="${r.id}" aria-pressed="${r.id === active}" aria-controls="cmp-detail">${r.name}</button><small>${r.short}</small></th>` +
      r.values.map(v => `<td class="${cellClass(v.pnl)}">${asValue(v[metric])}</td>`).join('') + (showRank ? `<td class="cmp-winner">${verdict(notes, r.values, metric)}</td>` : '') + '</tr>'
    ).join('') + '</tbody>';
    const row = rows.find(r => r.id === active);
    byId('cmp-detail-title').textContent = row.name + ' · payout detail';
    byId('cmp-description').textContent = row.description;
    const fields = [
      ['Original structure ends','timing',String], ['NVDA at exit','exitSpot',v => price(v)],
      ['Shares bought','shares',v => units(v)], ['Capital used at strike','spent',money],
      ['Cash refunded','refund',money], ['Shares assumed sold','sold',v => units(v)], ['Assumed sale proceeds','proceeds',money]
    ];
    if (row.follow) fields.push(['Shares still held','retained',v => units(v)],['Market value of shares held','retainedValue',money]);
    fields.push(['Total value','nav',money],['P&L since investment','pnl',signed],['Return on payment','rate',signedPct]);
    if (row.follow) fields.push(['Change since structure ended','change',signed]);
    byId('cmp-detail').innerHTML = '<thead><tr><th scope="col">USD unless stated</th>' + header(notes) + '</tr></thead><tbody>' +
      fields.map(([desc,key,fmt]) => `<tr><th scope="row">${desc}</th>` + row.values.map(v => `<td class="${key === 'pnl' || key === 'rate' || key === 'change' ? cellClass(v[key]) : ''}">${fmt(v[key])}</td>`).join('') + '</tr>').join('') + '</tbody>';
  }

  function updateTables() {
    currentRows = [];
    currentNotes = [];
    currentSettings = null;
    const selectQuotes = Array.from(selected, id => quoteById.get(id));
    root.querySelectorAll('[data-cmp-quote]').forEach(box => { box.checked = selected.has(box.dataset.cmpQuote); });
    byId('cmp-basket').innerHTML = selectQuotes.map((q,i) => `<button class="cmp-picked" type="button" data-cmp-remove="${q.id}" aria-label="Remove ${quoteLabel(q)}"><span>${letter(i)} · ${q.product} <b>${quotePct(q.strike)}</b> · ${q.months}M</span><span aria-hidden="true">×</span></button>`).join('');
    byId('cmp-clear').disabled = !selectQuotes.length;
    byId('cmp-selection-count').textContent = 'Edit selection · ' + selectQuotes.length + ' selected';
    const current = quotes.find(q => q.id === byId('quote').value);
    const addCurrent = byId('cmp-add-current');
    addCurrent.disabled = !current || selected.has(current.id);
    byId('cmp-current').textContent = !current ? 'Select a structure in the price chart.' :
      (selected.has(current.id) ? 'In comparison' : 'Chart selection') + ' · ' + quoteLabel(current);
    const notice = byId('cmp-notice');
    const content = byId('cmp-content');
    notice.textContent = '';
    content.hidden = true;
    if (!selectQuotes.length) {
      notice.textContent = 'Tap a strike in either pricing table. Add a second strike to compare outcomes.';
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
      if (notes.some(n => n.terms.maximum < 1)) throw Error('Increase the target budget to size at least one share per month for every selection.');
    } catch (e) {
      notice.textContent = e.message;
      return;
    }
    content.hidden = false;
    byId('cmp-terms').innerHTML = notes.map(({quote, terms:t}, i) => `<tr><th scope="row">${label({quote},i)}</th><td>${quote.months}M / ${quote.minimum}M</td><td><button type="button" data-cmp-plot="${quote.id}" aria-label="Plot ${label({quote},i)} at ${price(t.strike)} on the selected scenario">${price(t.strike)}</button><small>${quotePct(quote.strike)}</small></td><td>${price(t.ko)}<small>${quotePct(quote.ko)}</small></td><td>${units(t.maximum)}</td><td>${money(t.payment)}</td><td>${signed(t.payment - target)}</td></tr>`).join('');
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

  function render() {
    updateTables();
    document.dispatchEvent(new CustomEvent('accumulator:comparison-updated'));
  }

  function getSnapshot() {
    if (!currentRows.length || !currentNotes.length) return null;
    const metric = byId('cmp-rank').value;
    const rows = currentRows.map(({id,name,short,description,path,follow,basisName,sims,values}) => ({
      id, name, short, description, path, follow:!!follow, basisName, values,
      winners:winnerIndices(values, metric),
      exits:sims.map(s => ({day:s.exit.day, koDay:s.koDay, koMonth:s.koMonth, shares:s.exit.shares, price:s.exit.price}))
    }));
    const result = {notes:currentNotes, rows, spot:byId('spot').valueAsNumber,
      target:byId('capital').valueAsNumber, active, metric, settings:currentSettings};
    // Give consumers independent data, including the paths and quote records.
    return JSON.parse(JSON.stringify(result));
  }
  window.AccumulatorComparison = Object.freeze({getSnapshot});

  function selectionChanged(message) {
    render();
    byId('cmp-selection-feedback').textContent = message;
    document.dispatchEvent(new CustomEvent('accumulator:selection', {detail:{ids:[...selected]}}));
  }

  function add(id) {
    const quote = quoteById.get(id);
    if (!quote) return;
    const included = selected.has(id);
    selected.add(id);
    selectionChanged(quoteLabel(quote) + (included ? ' is already in the comparison.' : ' added to comparison.'));
  }

  function remove(id) {
    if (!selected.delete(id)) return;
    selectionChanged(quoteLabel(quoteById.get(id)) + ' removed.');
  }

  byId('cmp-add-current').addEventListener('click', () => add(byId('quote').value));
  byId('cmp-clear').addEventListener('click', () => {
    selected.clear();
    selectionChanged('Selection cleared.');
    root.querySelector('.cmp-tools a')?.focus({preventScroll:true});
  });
  document.addEventListener('accumulator:add-quote', e => add(e.detail?.quoteId));
  root.addEventListener('change', e => {
    const id = e.target.dataset.cmpQuote;
    if (id) {
      if (e.target.checked) add(id);
      else remove(id);
    } else if (e.target.tagName === 'SELECT') render();
  });
  root.addEventListener('input', e => {
    if (e.target.type === 'number') render();
  });
  root.addEventListener('click', e => {
    const removal = e.target.closest('[data-cmp-remove]');
    if (removal) {
      const next = removal.nextElementSibling?.dataset.cmpRemove ?? removal.previousElementSibling?.dataset.cmpRemove;
      remove(removal.dataset.cmpRemove);
      const focus = next ? root.querySelector('[data-cmp-remove="' + next + '"]') : root.querySelector('.cmp-tools a');
      focus?.focus({preventScroll:true});
      return;
    }
    const plot = e.target.closest('[data-cmp-plot]');
    if (plot) {
      const note = currentNotes.find(n => n.quote.id === plot.dataset.cmpPlot);
      const row = currentRows.find(r => r.id === active);
      if (!note || !row) return;
      const name = row.follow ? row.name + ' · original structure · ' + row.basisName : row.name;
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
  selectionChanged('');
})();
