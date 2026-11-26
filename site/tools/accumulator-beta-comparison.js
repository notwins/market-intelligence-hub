/* Quote comparisons share the simulator's funded-share and daily observation model. */
(() => {
  'use strict';
  const root = document.getElementById('sn-comparison');
  if (!root) return;
  const model = window.AccumulatorModel;
  const quotes = Accumulator.quotes.filter(q => q.multiple === 1);
  const quoteById = new Map(quotes.map(q => [q.id, q]));
  const initial = ['sn-9-120-1', 'sn-9-120-2', 'sn-9-105-1', 'sn-6-120-1', 'sn-9-130-1'];
  const selected = new Set(initial.filter(id => quoteById.has(id)));
  const {money, signedMoney, returnMoney:signed, quote:quotePct, price, shares:units, signedRate:signedPct} = window.AccumulatorFormat;
  const cents = n => Math.round((n + Number.EPSILON) * 100);
  const byId = id => document.getElementById(id);
  const cellClass = n => n < 0 ? 'negative' : n > 0 ? 'positive' : '';
  const heat = (pnl, payment) => window.AccumulatorBetaTable?.heat(pnl, payment) || '';
  const letter = index => String.fromCharCode(65 + index);
  const label = (note, index) => letter(index) + ' · ' + note.quote.product;
  const quoteLabel = q => q.product + ' · ' + quotePct(q.strike) + ' strike · ' + q.months + 'M · ' + quotePct(q.ko) + ' KO · ' + q.minimum + 'M guarantee';
  const milestones = [
    [0, 'KO immediately'],
    [1, 'KO after 1 month'],
    [2, 'KO after 2 months'],
    [3, 'KO right on 3 months'],
    [6, 'KO in month 6'],
    [9, 'KO in month 9'],
    [12, 'KO in month 12']
  ];
  let active = 'ko-0';
  let currentRows = [];
  let currentNotes = [];
  let currentSettings = null;

  root.innerHTML = `
    <div class="heading"><div><h2 id="sn-compare-title">Compare SI and SN payouts</h2>
      <p>Compare what a lower buying price is worth when NVDA falls, stays flat or rallies. The payout detail shows what buying NVDA outright would earn on the same payment.</p>
    </div></div>
    <div class="cmp-tools"><a href="#library">Choose strikes in pricing tables</a><button type="button" id="cmp-clear">Clear selection</button></div>
    <div id="cmp-basket" aria-label="Selected structures"></div>
    <p id="cmp-selection-feedback" aria-live="polite" aria-atomic="true"></p>
    <details class="cmp-selector"><summary id="cmp-selection-count">Choose structures</summary>
      <fieldset id="cmp-choices"><legend>Include in comparison</legend></fieldset>
      <div class="cmp-tools"><button type="button" id="cmp-add-current">Add the chart selection</button><span id="cmp-current"></span></div>
    </details>
    <div id="cmp-notice" role="status"></div>
    <div id="cmp-content">
      <p>Tap a figure for its calculation. Use Plot to see the selected scenario on the price chart.</p>
      <div class="tableScroll cmp-funding" tabindex="0" aria-label="Selected structure terms and funded amounts">
        <table><thead><tr><th scope="col">Structure</th><th scope="col">Tenor / guarantee</th><th scope="col">Strike</th><th scope="col">KO</th><th scope="col">Shares / month</th><th scope="col">Payment</th><th scope="col">vs. target</th></tr></thead><tbody id="cmp-terms"></tbody></table>
      </div>
      <details class="cmp-assumptions"><summary>Scenario prices &amp; observation days</summary>
        <p>Leave a field blank to use its default. Day 1 is the first simulated trading day.</p>
        <div class="cmp-inputs">
          <label>Custom early rally · trading day<input id="cmp-early" type="number" min="1" step="1" placeholder="Optional"></label>
          <label>Custom later rally · trading day<input id="cmp-late" type="number" min="1" step="1" placeholder="Optional"></label>
          <label>Rally price · USD<input id="cmp-rally" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Below-strike case · USD<input id="cmp-down" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Near-KO reference<select id="cmp-reference"></select></label>
          <label>Near-KO gap<select id="cmp-gap"><option value="cent">$0.01 below KO</option><option value="bp">0.01% below KO</option></select></label>
        </div>
      </details>
      <div class="cmp-heading"><h3>Scenario outcomes</h3><label>Rank by <select id="cmp-rank"><option value="pnl">Dollar P&amp;L</option><option value="rate">Return on payment</option></select></label></div>
      <p id="cmp-criteria"></p>
      <div class="tableScroll cmp-results" tabindex="0" aria-label="Payout comparison by scenario"><table id="cmp-grid"></table></div>
      <details class="cmp-assumptions cmp-range"><summary>Best and worst contract outcomes</summary><div id="cmp-range-list"></div></details>
      <h3 id="cmp-detail-title" tabindex="-1"></h3><p id="cmp-description"></p>
      <div class="tableScroll cmp-results" tabindex="0" aria-labelledby="cmp-detail-title"><table id="cmp-detail"></table></div>
      <details class="cmp-assumptions"><summary>Cash and share breakdown</summary><div class="tableScroll cmp-results" tabindex="0" aria-label="Cash and share calculation inputs"><table id="cmp-breakdown"></table></div></details>
      <details class="cmp-assumptions"><summary>Holding or selling shares after maturity</summary>
        <p>Choose the maturity price, then compare keeping all shares with selling a chosen quantity through an illustrative decumulator. Both use the same later NVDA price.</p>
        <div class="cmp-inputs">
          <label>Starting maturity case<select id="cmp-origin"><option value="down">Below strike</option><option value="flat">Trade-day spot</option></select></label>
          <label>Later NVDA price · USD<input id="cmp-recovery" type="number" min="0" max="1000000" step="0.01"></label>
          <label>Decumulator sale strike · USD<input id="cmp-sale-strike" type="number" min="0.01" max="1000000" step="0.01"></label>
          <label>Shares assumed sold per structure<input id="cmp-sale-units" type="number" min="0" max="10000000000" step="1"></label>
        </div>
      </details>
    </div>
    <dialog class="cmp-calculation" id="cmp-calculation" aria-labelledby="cmp-calculation-title" aria-describedby="cmp-calculation-context">
      <form method="dialog"><button type="submit" aria-label="Close calculation">Close</button></form>
      <p class="small" id="cmp-calculation-context"></p>
      <h3 id="cmp-calculation-title"></h3>
      <ol id="cmp-calculation-steps"></ol>
      <p class="small" id="cmp-calculation-note"></p>
    </dialog>`;

  const comparisonNotes = byId('comparison-method-notes');
  const notesMarkup = `
    <p>The default scenario prices use the five original JPM notes as the reference. Enter an optional trading day to add a custom rally row.</p>
    <p>P&amp;L and percentage returns round down to whole numbers. Rankings use the underlying amounts. A lower strike reduces the price paid for each share. An earlier knock-out can leave more cash to reinvest and fewer shares in a rally. Contract outcomes use each note’s exit price. Share strategies use the later valuation.</p>
    <p>The fixed KO scenarios use the same rally price for every quote. The rally occurs on day 1 or just after the scheduled purchases for the stated month. The 3-month row caps the guarantee at three months. GM means guaranteed months and M means total tenor.</p>
    <p>P&amp;L measures the gain or loss on the actual payment since purchase. Change since the structure ended measures the difference from its exit value. The direct NVDA comparison uses whole shares and excludes dividends, interest and fees.</p>
    <p>A normal accumulator buys its full scheduled share quantity at the strike. A daily KO in the guarantee fills the guaranteed months. After the guarantee, a mid-month KO keeps whole shares accrued through the preceding trading day. The model spreads shares across each month’s observation days and returns payment less the cost of all shares bought.</p>
    <p>Each comparison assumes USD cash earns 0% after refund or sale. Sale proceeds at KO use the observed market price, including any gap above the barrier. Actual execution and settlement can differ. Holding shares keeps the downside as well as any recovery.</p>
    <p>The decumulator example assumes the stated quantity actually sells at its sale strike. The default sale request is half the smallest full-tenor quantity across the original five JPM quotes, rounded down. Each sale is capped at available shares. Unsold shares use the later NVDA price. The training example is cash-funded by selling the shares and subscribing with the proceeds. This is a hypothetical sale allocation. An actual quote sets the sale quantity, timing and settlement. Unsold shares can fall further, and shares sold at the strike miss any larger rebound.</p>`;
  if (comparisonNotes) comparisonNotes.innerHTML = notesMarkup;
  else root.insertAdjacentHTML('beforeend', notesMarkup);

  const quoteChoice = q => `<label><input type="checkbox" data-cmp-quote="${q.id}"><span><b>${q.product} · ${quotePct(q.strike)}</b><small>${q.months}M tenor · ${quotePct(q.ko)} KO · ${q.minimum}M guarantee${q.originalId?' · Saved quote':''}</small></span></label>`;
  byId('cmp-choices').innerHTML = quotes.map(quoteChoice).join('');

  function read(id, fallback, placeholder = fallback) {
    const field = byId('cmp-' + id);
    field.placeholder = String(placeholder);
    if (field.validity.badInput || (field.value !== '' && !field.checkValidity())) {
      throw Error('Check the value for ' + field.parentElement.firstChild.textContent.trim() + '.');
    }
    return field.value === '' ? fallback : field.valueAsNumber;
  }

  function scenarioPaths(spot, quoteTerms) {
    const referenceTerms = initial.map(id => quoteTerms.get(id));
    const rampDay = Math.min(...referenceTerms.map(t => t.days));
    const horizon = Math.max(...quotes.map(q => q.days));
    const lowestKO = Math.min(...referenceTerms.map(t => t.ko));
    const lowestStrike = Math.min(...referenceTerms.map(t => t.strike));
    ['early', 'late'].forEach(id => byId('cmp-' + id).max = String(horizon));
    const early = read('early', null, 'Optional');
    const late = read('late', null, 'Optional');
    const rally = read('rally', Math.max(...referenceTerms.map(t => t.ko)));
    const down = read('down', Math.max(0, Math.min(cents(lowestStrike) - 1, Math.round(lowestStrike * 85)) / 100));
    const useBp = byId('cmp-gap').value === 'bp';
    const reference = byId('cmp-reference');
    const previous = reference.value;
    reference.innerHTML = '<option value="lowest">Lowest KO of the five original JPM quotes</option>' +
      quotes.map(q => `<option value="${q.id}">${quoteLabel(q)} · ${price(quoteTerms.get(q.id).ko)}</option>`).join('');
    const referenceQuote = quoteById.get(previous);
    reference.value = referenceQuote ? referenceQuote.id : 'lowest';
    const referenceName = referenceQuote ? quoteLabel(referenceQuote) + '’s KO' : 'the lowest KO of the five original JPM quotes';
    const koCents = cents(referenceQuote ? quoteTerms.get(referenceQuote.id).ko : lowestKO);
    const near = Math.max(0, useBp ? Math.min(koCents - 1, Math.round(koCents * .9999)) : koCents - 1) / 100;
    const jump = day => Array.from({length:horizon}, (_, i) => i + 1 < day ? spot : rally);
    const glide = end => Array.from({length:horizon}, (_, i) => {
      const fraction = Math.min(1, (i + 1) / rampDay);
      return cents(spot + (end - spot) * fraction) / 100;
    });
    const ramp = `NVDA moves from ${price(spot)} to the stated price by trading day ${rampDay}, then stays there. A shorter note ends at its own earlier close.`;
    currentSettings = {earlyDay:early, lateDay:late, rally, down, near, rampDay, nearReferenceLabel:referenceName, referenceId:reference.value, gap:byId('cmp-gap').value};
    const fixed = milestones.map(([month, name]) => ({
      id:'ko-' + month, name, month, shareLabel:month <= 3,
      description:month
        ? `NVDA holds at ${price(spot)} and moves to ${price(rally)} after the scheduled purchases for month ${month} on each quote’s month-end observation.`
        : `NVDA moves to ${price(rally)} on the first trading day. The guarantee determines how many shares are bought.`,
      pathFor: terms => jump(month ? terms.monthEnds[month - 1] : 1)
    }));
    const custom = [['early', early, 'Custom early rally'], ['late', late, 'Custom later rally']]
      .filter(([,day]) => day !== null)
      .map(([id,day,name]) => ({
        id, name, short:'Trading day ' + day, path:jump(day),
        description:`NVDA holds at ${price(spot)} until it moves to ${price(rally)} on trading day ${day}. A shorter note may already have matured.`
      }));
    return [...fixed, ...custom,
      {id:'down', name:'Below strike', short:'Maturity', path:glide(down), description:`The selected downside target is ${price(down)}. ${ramp}`},
      {id:'flat', name:'Trade-day spot', short:'Maturity', path:glide(spot), description:`NVDA stays at its trade-day price of ${price(spot)} through every daily observation.`},
      {id:'near', name:'Below reference KO', short:'Maturity', path:glide(near), description:`Target ${price(near)}, ${useBp ? '0.01% below ' + referenceName + ', rounded to the nearest cent with at least a one-cent gap' : '$0.01 below ' + referenceName}. A structure with a lower barrier can knock out earlier. ${ramp}`}
    ];
  }

  function exitValues(sim) {
    const e = sim.exit;
    return {
      timing: sim.koDay ? 'KO day ' + sim.koDay + (sim.koDay <= sim.guaranteeDay ? ' · in guarantee' : ' · after guarantee') : 'Maturity · day ' + e.day,
      payment:sim.payment, shares:e.shares, spent:e.spent, refund:e.refunded, exitSpot:e.price,
      sold:e.shares, proceeds:e.shareValue, retained:0, retainedValue:0,
      nav:e.value, pnl:e.profit, rate:e.rate
    };
  }

  function afterMaturity(base, follow, laterSpot, saleStrike, units, isDecumulator) {
    if (base.koDay) return {...follow, change:0};
    const {shares, refunded, value, spent, day, price} = base.exit;
    const sold = isDecumulator ? Math.min(units, shares) : 0;
    const proceedsCents = sold * cents(saleStrike);
    const retained = shares - sold;
    const retainedCents = retained * cents(laterSpot);
    const navCents = cents(refunded) + proceedsCents + retainedCents;
    const pnlCents = navCents - base.payment * 100;
    return {
      timing:'Held at maturity · day ' + day, payment:base.payment, shares, spent, refund:refunded, exitSpot:price,
      sold, proceeds:proceedsCents / 100, retained, retainedValue:retainedCents / 100,
      nav:navCents / 100, pnl:pnlCents / 100, rate:pnlCents / base.payment, change:(navCents - cents(value)) / 100
    };
  }

  function compare(notes, spot) {
    // Reference prices and dates depend on quoted terms. Use an adequate sizing
    // budget here so that a valid small holding in one quote can still be tested.
    const quoteTerms = new Map(quotes.map(q => [q.id, model.terms(q, spot, Math.max(1, spot * q.months))]));
    const paths = scenarioPaths(spot, quoteTerms);
    const rows = paths.map(({pathFor, ...s}) => {
      const notePaths = pathFor && notes.map(({quote, terms}) => {
        if (s.month > quote.months || (s.month < 3 && (!quote.minimum || s.month > quote.minimum))) return null;
        return pathFor(terms);
      });
      const sims = notes.map((n, i) => {
        const path = notePaths ? notePaths[i] : s.path;
        if (!path) return null;
        const sim = model.simulateDaily(n.quote, spot, n.target, path, s.month);
        const plannedDay = s.month ? n.terms.monthEnds[s.month - 1] : 1;
        return notePaths && sim.koDay !== plannedDay ? null : sim;
      });
      let name = s.name, short = s.short;
      if (s.id === 'down' && sims.some(sim => sim.koDay || sim.exit.price >= sim.strike)) {
        name = 'Custom maturity price';
      }
      if (['down','flat','near'].includes(s.id) && sims.some(sim => sim.koDay)) short = 'KO possible';
      const values = sims.map((sim, i) => {
        if (!sim) return null;
        const value = exitValues(sim);
        if (s.shareLabel) {
          const {minimum, months} = notes[i].quote;
          value.shareLabel = `${units(value.shares)} shares (${s.month === 3 ? Math.min(3, minimum) : minimum}gm/${months}m)`;
        }
        return value;
      });
      return {...s, name, short, sims, values, notePaths:notePaths?.map((path, i) => sims[i] ? path : null)};
    });
    const basis = rows.find(r => r.id === byId('cmp-origin').value);
    const later = read('recovery', cents(spot * 1.10) / 100);
    const saleStrike = read('sale-strike', Math.max(0.01, cents(spot * 1.05) / 100));
    const scheduledShares = initial.map(id => {
      const q = quoteById.get(id);
      return Math.round(cents(notes[0].target) / (cents(quoteTerms.get(id).strike) * q.months)) * q.months;
    });
    const saleUnits = read('sale-units', Math.floor(Math.min(...scheduledShares) / 2));
    Object.assign(currentSettings, {followBasisId:basis.id, laterSpot:later, saleStrike, saleUnits});
    const common = `Use ${basis.name.toLowerCase()} as the exit scenario. Any shares held after maturity are valued later at ${price(later)}. An earlier KO leaves its assumed sale proceeds in cash.`;
    for (const dec of [false, true]) {
      const name = dec ? 'Decumulator sale' : 'Hold the shares';
      rows.push({
        id:dec ? 'decu' : 'hold', name, short:'After maturity', follow:true, path:basis.path, basisName:basis.name, sims:basis.sims,
        description: common + (dec ? ` Assume up to ${units(saleUnits)} shares from each investment sell at ${price(saleStrike)}. Mark all remaining shares at ${price(later)}.` : ' Keep all shares delivered at maturity and add their later value to refunded cash.'),
        values:basis.sims.map((s, i) => afterMaturity(s, basis.values[i], later, saleStrike, saleUnits, dec))
      });
    }
    for (const row of rows) {
      row.values.forEach((v,i) => {
        if (!v) return;
        const mark = row.follow ? later : row.sims[i].exit.price;
        const direct = window.AccumulatorBenchmark.buyAndHold(v.payment, spot, mark);
        v.direct = {start:spot, mark, quantity:direct.shares, residualCash:direct.remainingCash,
          nav:direct.value, pnl:direct.pnl, noteAdvantage:(cents(v.pnl) - cents(direct.pnl)) / 100};
      });
    }
    return rows;
  }

  function header(notes) {
    return notes.map((n, i) => `<th scope="col" data-beta-column="${n.quote.id}">${label(n,i)}<small>${quotePct(n.quote.strike)} strike · ${n.quote.months}M<br>${quotePct(n.quote.ko)} KO · ${n.quote.minimum}M guarantee</small></th>`).join('');
  }

  const labels = {
    tenure:'Tenor and guarantee', strike:'Strike price', ko:'Knock-out level',
    monthly:'Shares bought per complete month', payment:'Actual payment', difference:'Payment versus target',
    timing:'When the structure ends', exitSpot:'NVDA at the end of the structure', exitValue:'Value when the structure ends',
    exitPnl:'P&L when the structure ends', laterSpot:'Later NVDA valuation price', shares:'Shares bought at strike',
    spent:'Capital used at strike', refund:'Cash refunded', sold:'Shares assumed sold', proceeds:'Assumed sale proceeds',
    retained:'Shares still held', retainedValue:'Value of shares still held', nav:'Total value', pnl:'P&L since investment',
    rate:'Return on actual payment', change:'Change since the structure ended',
    directPnl:'P&L buying NVDA outright', noteAdvantage:'Note P&L less outright P&L'
  };

  function resultButton(rowId, i, key, displayed, name=labels[key]) {
    return `<button type="button" class="cmp-number" data-work-key="${key}" data-work-case="${rowId}" data-work-note="${i}" aria-haspopup="dialog" aria-label="${name}, structure ${letter(i)}, ${displayed}. Show calculation">${displayed}</button>`;
  }

  function extremes(values, metric) {
    const score = v => metric === 'pnl' ? cents(v.pnl) : cents(v.pnl) / v.payment;
    const scores = values.filter(Boolean).map(score);
    const matches = target => values.flatMap((v,i) => v && score(v) === target ? [i] : []);
    return {best:matches(Math.max(...scores)), worst:matches(Math.min(...scores))};
  }

  function extremeLabel(best, worst, total, i) {
    if (total < 2) return '';
    if (best.length === total) return 'All tied';
    if (best.includes(i)) return best.length > 1 ? 'Joint best' : 'Best';
    if (worst.includes(i)) return worst.length > 1 ? 'Joint worst' : 'Worst';
    return '';
  }

  function renderRanges(notes, rows, metric) {
    const display = metric === 'pnl' ? signed : signedPct;
    byId('cmp-range-list').innerHTML = notes.map((note, i) => {
      const eligible = rows.filter(row => row.values[i]);
      const {best,worst} = extremes(eligible.map(row => row.values[i]), metric);
      const show = indexes => indexes.map(j => {
        const row = eligible[j];
        return `${row.name} ${resultButton(row.id, i, metric, display(row.values[i][metric]))}`;
      }).join(' / ');
      return `<div><strong>${label(note,i)}</strong>${best.length === eligible.length ? `<span>All applicable scenarios tie at ${show([best[0]])}</span>` : `<span>Best · ${show(best)}</span><span>Worst · ${show(worst)}</span>`}</div>`;
    }).join('');
  }

  function detailRow(key, row, notes) {
    const name = key === 'nav' ? (row.follow ? 'Total value at later valuation' : 'Total value at exit') : labels[key];
    const keyRow = ['nav','pnl','rate'].includes(key);
    const cells = row.values.map((value, i) => {
      if (!value) return '<td aria-label="Scenario does not apply"></td>';
      const sim = row.sims[i];
      let amount = value[key], displayed;
      switch (key) {
        case 'timing': displayed = sim.koDay ? `KO · M${sim.koMonth} · day ${sim.koDay}` : `Maturity · M${notes[i].quote.months} · day ${sim.exit.day}`;break;
        case 'exitValue': displayed = money(sim.exit.value);break;
        case 'exitPnl': amount=sim.exit.profit;displayed=signed(amount);break;
        case 'payment': displayed=money(sim.payment);break;
        case 'exitSpot': displayed=money(amount);break;
        case 'laterSpot': displayed = value.retained ? money(currentSettings.laterSpot) : 'All cash';break;
        case 'refund': displayed=money(amount);break;
        case 'shares': case 'sold': case 'retained': displayed=units(amount);break;
        case 'rate': displayed=signedPct(amount);break;
        case 'directPnl': amount=value.direct.pnl;displayed=signed(amount);break;
        case 'noteAdvantage': amount=value.direct.noteAdvantage;displayed=signed(amount);break;
        case 'pnl': case 'change': displayed=signed(amount);break;
        default: displayed=money(amount);
      }
      const performance = ['pnl','rate','change','exitPnl','directPnl','noteAdvantage'].includes(key);
      const colour = performance ? cellClass(amount) : '';
      const accent = key === 'timing' && sim.koDay ? 'cmp-ko' : key === 'refund' && amount > 0 ? 'cmp-refund' : '';
      const shading = performance ? heat(key === 'rate' ? value.pnl : amount, sim.payment) : '';
      return `<td class="${colour} ${accent}"${shading}>${resultButton(row.id,i,key,displayed,name)}</td>`;
    });
    return `<tr${keyRow ? ' class="cmp-key-row"' : ''}><th scope="row">${name}</th>${cells.join('')}</tr>`;
  }

  function renderGrid(notes, rows) {
    const metric = byId('cmp-rank').value;
    const asValue = metric === 'pnl' ? signed : signedPct;
    byId('cmp-criteria').textContent = (metric === 'pnl' ? 'Compare dollar P&L' : 'Compare percentage return on actual payment') + ' within each scenario. Blank cells indicate a shorter guarantee, shorter tenor or a rally that misses the KO.';
    byId('cmp-grid').innerHTML = `<thead><tr><th scope="col">Scenario</th>${header(notes)}</tr></thead><tbody>` + rows.map(r => {
      const {best,worst} = extremes(r.values,metric);
      const group = {
        'ko-0':'KO during guarantee (GM)', 'ko-3':'3-month benchmark', 'ko-6':'Later KO',
        down:'Other price scenarios', hold:'After the note ends'
      }[r.id];
      const count = r.values.filter(Boolean).length;
      const benchmark = r.id === 'ko-3' ? 'Three completed months at the same rally price.' : '';
      return (group ? sectionRow(group,notes.length,benchmark) : '') + `<tr class="${r.id === active ? 'cmp-active' : ''}"><th scope="row"><button type="button" data-cmp-case="${r.id}" aria-pressed="${r.id === active}" aria-controls="cmp-detail">${r.name}</button>${r.short ? '<small>'+r.short+'</small>' : ''}</th>` +
        r.values.map((v,i) => {
          if (!v) return '<td aria-label="Scenario does not apply"></td>';
          const tag=extremeLabel(best,worst,count,i);
          const colour=tag.endsWith('best')||tag==='Best'?'cmp-best':tag.endsWith('worst')||tag==='Worst'?'cmp-worst':'';
          return `<td class="${colour} ${cellClass(v.pnl)}"${heat(v.pnl, notes[i].terms.payment)}>${resultButton(r.id,i,metric,asValue(v[metric]))}${v.shareLabel ? `<small>${v.shareLabel}</small>` : ''}${tag ? `<span class="cmp-extreme">${tag}</span>` : ''}</td>`;
        }).join('') + '</tr>';
    }).join('') + '</tbody>';
    renderRanges(notes,rows.filter(r=>!r.follow),metric);
    const row = rows.find(r => r.id === active);
    root.querySelectorAll('[data-cmp-plot]').forEach(button => {
      const index = notes.findIndex(n => n.quote.id === button.dataset.cmpPlot);
      button.disabled = !row.sims[index];
    });
    byId('cmp-detail-title').textContent = row.name + ' · payout detail';
    byId('cmp-description').textContent = row.description;
    const summary = row.follow
      ? ['timing','exitValue','exitPnl','change','nav','pnl','rate']
      : ['timing','refund','nav','pnl','rate'];
    const details = row.follow
      ? ['payment','exitSpot','laterSpot','shares','spent','refund','sold','proceeds','retained','retainedValue']
      : ['payment','exitSpot','shares','spent','sold','proceeds'];
    const headings = '<thead><tr><th scope="col">USD unless stated</th>' + header(notes) + '</tr></thead>';
    const table = fields => headings + '<tbody>' + fields.map(key=>detailRow(key,row,notes)).join('') + '</tbody>';
    const comparisonDates = row.follow ? 'Both positions valued at the later observation.' : 'Both positions valued on that note’s exit day.';
    byId('cmp-detail').innerHTML = table(summary) + '<tbody>' +
      sectionRow('Buy NVDA outright with the same payment',notes.length,comparisonDates) +
      detailRow('directPnl',row,notes) + detailRow('noteAdvantage',row,notes) + '</tbody>';
    byId('cmp-breakdown').innerHTML = table(details);
  }

  function sectionRow(title, quoteCount, detail='') {
    return `<tr class="cmp-section-row"><th colspan="${quoteCount+1}">${title}${detail ? '<small>'+detail+'</small>' : ''}</th></tr>`;
  }

  function workings(key, row, i) {
    const note=currentNotes[i], q=note.quote, t=note.terms, sim=row.sims[i], v=row.values[i];
    const spot=byId('spot').valueAsNumber, end=sim.exit, later=currentSettings.laterSpot;
    const afterMaturity=row.follow && !sim.koDay;
    const cash=price, u=units;
    const origin = sim.koDay
      ? `Day ${end.day} in month ${end.month} is the first close at or above the ${cash(t.ko)} knock-out. The observed close is ${cash(end.price)}.`
      : `No observed close reached the ${cash(t.ko)} knock-out. The contract matured in month ${q.months} on trading day ${end.day} at ${cash(end.price)}.`;
    const monthly = `Divide the ${cash(note.target)} target by (${cash(t.strike)} strike × ${q.months} months). Round to the nearest whole share to get ${u(t.maximum)} shares per month.`;
    const committed = `${u(t.maximum)} shares × ${q.months} months × ${cash(t.strike)} = ${cash(t.committed)} committed.`;
    const paid = `Round ${cash(t.committed)} up to a whole dollar for the actual payment of ${cash(t.payment)}. The ${cash(t.roundingCash)} difference remains refundable.`;
    const sizing=[monthly,committed,paid];
    const position = [origin];
    if (!sim.koDay) position.push(`${u(t.maximum)} shares per month × ${q.months} completed months = ${u(v.shares)} shares.`);
    else if (sim.koAfterMonthEnd) position.push(
      `${sim.koMonth} completed months × ${u(t.maximum)} shares per month = ${u(sim.koMonth * t.maximum)} shares before KO. The guarantee adds ${u(end.extra)} shares, giving ${u(v.shares)} shares in total.`
    );
    else if(sim.koDay<=t.guaranteeDay) position.push(`The knock-out is within the guarantee ending on day ${t.guaranteeDay}. ${q.minimum} guaranteed months × ${u(t.maximum)} shares per month = ${u(v.shares)} shares, including ${u(end.extra)} guaranteed shares added on the trigger.`);
    else {
      const m=sim.koMonth-1, prior=m?t.monthEnds[m-1]:0, sessions=t.monthEnds[m]-prior, elapsed=sim.koDay-prior-1;
      position.push(`${m} completed months × ${u(t.maximum)} shares = ${u(m*t.maximum)} shares.`,
        `In the trigger month, ${elapsed} of ${sessions} sessions earned shares before KO. Round ${u(t.maximum)} × ${elapsed} ÷ ${sessions} down to ${u(Math.floor(t.maximum*elapsed/sessions))} shares. The total is ${u(v.shares)} shares.`);
    }
    const spent=`${u(v.shares)} shares bought × ${cash(t.strike)} strike = ${cash(v.spent)} used to buy shares.`;
    const refund=`${cash(t.payment)} paid − ${cash(v.spent)} used at strike = ${cash(v.refund)} cash returned.`;
    const exitShares=`${u(v.shares)} shares × ${cash(end.price)} exit price = ${cash(end.shareValue)} share value when the structure ends.`;
    const exitValue=`${cash(end.shareValue)} in shares + ${cash(v.refund)} refund = ${cash(end.value)} at the contract end.`;
    const soldWhy = !afterMaturity ? `The exit scenario assumes all ${u(v.shares)} shares sell at the observed ${cash(end.price)} close.`
      : row.id==='hold' ? `You chose to hold all ${u(v.shares)} shares delivered at maturity, so zero shares sell.`
        : `Use the smaller of ${u(currentSettings.saleUnits)} assumed sales and ${u(v.shares)} available shares. This sells ${u(v.sold)} shares at ${cash(currentSettings.saleStrike)}.`;
    const salePrice=afterMaturity?currentSettings.saleStrike:end.price;
    const proceeds = v.sold ? `${u(v.sold)} shares sold × ${cash(salePrice)} = ${cash(v.proceeds)} sale proceeds.` : 'Zero shares sold gives $0.00 in proceeds.';
    const retained=`${u(v.shares)} shares bought − ${u(v.sold)} sold = ${u(v.retained)} shares held.`;
    const retainedValue = v.retained ? `${u(v.retained)} shares held × ${cash(later)} later price = ${cash(v.retainedValue)} in shares.` : 'No shares remain, so their market value is $0.00.';
    const total=`${cash(v.refund)} refunded + ${cash(v.proceeds)} sale proceeds + ${cash(v.retainedValue)} in shares held = ${cash(v.nav)} total value.`;
    const pnl=`${cash(v.nav)} total value − ${cash(t.payment)} actual payment = ${cash(v.pnl)} P&L since investment.`;
    const returnOnPayment=`${cash(v.pnl)} P&L ÷ ${cash(t.payment)} actual payment × 100 gives ${signedPct(v.rate)} when rounded down to a whole percent.`;
    const change=`${cash(v.nav)} later total − ${cash(end.value)} when the note ended = ${cash(v.change ?? 0)} since the contract ended.`;
    switch(key){
      case 'tenure': return [`The quote specifies a ${q.months}-month tenor and a ${q.minimum}-month guaranteed buying period.`,`The model uses ${t.days} trading days and ends the guarantee on trading day ${t.guaranteeDay}. The final trade calendar governs.`];
      case 'strike': return [`Trade-day price = ${cash(spot)}. The quote sets the buying price at ${quotePct(q.strike)} of that price.`,`${cash(spot)} × ${quotePct(q.strike)}, rounded to cents = ${cash(t.strike)} per share.`];
      case 'ko': return [`Knock-out is ${quotePct(q.ko)} of the trade-day price.`,`${cash(spot)} × ${quotePct(q.ko)}, rounded to cents = ${cash(t.ko)}. Daily closes are checked against this level.`];
      case 'monthly': return [`Buying price per share = ${cash(t.strike)}. The tenor is ${q.months} months.`,monthly];
      case 'payment': return sizing;
      case 'difference': return [...sizing,`${cash(t.payment)} actual payment − ${cash(note.target)} target = ${cash(t.payment-note.target)} difference.`];
      case 'timing':return [`Contract schedule = ${q.months} months, ${t.days} modelled trading days. The guarantee runs through day ${t.guaranteeDay}.`,origin,...(row.follow?[sim.koDay?'The assumed KO sale leaves cash.':'Any later price change belongs to the shares held after maturity. The note has already ended.']:[])];
      case 'exitSpot': return [origin,`The daily scenario path on day ${end.day} supplies the ${cash(end.price)} exit price.`];
      case 'exitValue': return [origin,exitShares,refund,exitValue];
      case 'exitPnl': return [exitValue,`${cash(end.value)} exit value − ${cash(t.payment)} paid = ${cash(end.profit)} P&L when the note ended.`];
      case 'laterSpot':return [origin,v.retained?`The later-price scenario input is ${cash(later)} per share. It applies to ${u(v.retained)} retained shares.`:'All shares have been sold. A later NVDA price change leaves the cash proceeds unchanged.'];
      case 'shares':return [monthly,...position];
      case 'spent':return [...position,spent];
      case 'refund':return [paid,spent,refund,'This refund is returned principal. It enters total value once.'];
      case 'sold':return [origin,soldWhy];
      case 'proceeds':return [soldWhy,proceeds];
      case 'retained':return [soldWhy,retained];
      case 'retainedValue':return [soldWhy,retained,retainedValue];
      case 'nav':return [refund,soldWhy,proceeds,retainedValue,total];
      case 'pnl':return [total,pnl,...(v.retained?['The portion attributable to the shares still held is unrealised at the selected later price.']:[])];
      case 'rate':return [total,pnl,returnOnPayment];
      case 'directPnl':
      case 'noteAdvantage':{
        const d = v.direct;
        const markDay = row.follow ? 'the later valuation' : `the note’s exit on trading day ${end.day}`;
        const steps = [
          `Start with the same ${cash(t.payment)} payment. Buy ${u(d.quantity)} whole NVDA shares at ${cash(d.start)} on day zero and keep ${cash(d.residualCash)} change.`,
          `At ${markDay}, ${u(d.quantity)} shares × ${cash(d.mark)} + ${cash(d.residualCash)} cash = ${cash(d.nav)}.`,
          `${cash(d.nav)} value − ${cash(t.payment)} paid = ${cash(d.pnl)} P&L on the direct purchase.`
        ];
        if(row.follow && sim.koDay) steps.push(`The note sold on day ${sim.koDay} and kept the proceeds and refund in cash. Direct ownership kept the shares until the later price.`);
        if(key==='noteAdvantage') steps.push(`${cash(v.pnl)} note P&L − ${cash(d.pnl)} outright P&L = ${cash(d.noteAdvantage)}. `+
          (d.noteAdvantage>0?'The note finished ahead.':d.noteAdvantage<0?'Owning NVDA outright finished ahead.':'The two outcomes were equal.'));
        steps.push('Both alternatives exclude dividends, fees and taxes. Idle USD earns 0%.');
        return steps;
      }
      case 'change':{
        const compare=[exitShares,exitValue,total,change];
        if(!sim.koDay&&row.id==='hold')compare.push(`Equivalently, ${u(v.shares)} held shares × (${cash(later)} later − ${cash(end.price)} at maturity) = ${cash(v.change)}. The same refund appears in both valuations and cancels.`);
        if(sim.koDay)compare.push('The model sold all shares at KO and assumes 0% interest on cash.');
        return compare;
      }
      default:return [];
    }
  }

  let calculationOpener;
  function openCalculation({title,context,steps,opener,note}) {
    const dialog = byId('cmp-calculation');
    calculationOpener = opener || document.activeElement;
    byId('cmp-calculation-title').textContent = title;
    byId('cmp-calculation-context').textContent = context;
    byId('cmp-calculation-note').textContent = note ?? 'Amounts below one dollar are included. Summary rows round each figure separately.';
    byId('cmp-calculation-steps').replaceChildren(...steps.map(text => {
      const li = document.createElement('li');
      li.textContent = text;
      return li;
    }));
    if (!dialog.open) dialog.showModal();
  }
  window.AccumulatorCalculationDialog = Object.freeze({open:openCalculation});
  byId('cmp-calculation').addEventListener('close', () => {
    if (calculationOpener?.isConnected) calculationOpener.focus({preventScroll:true});
    calculationOpener = null;
  });

  function showCalculation(control) {
    const row = currentRows.find(r => r.id === control.dataset.workCase);
    const i = Number(control.dataset.workNote), key = control.dataset.workKey;
    if (!row?.values[i] || !currentNotes[i]) return;
    const steps = workings(key,row,i);
    if (!steps.length) return;
    const funding = ['tenure','strike','ko','monthly','payment','difference'].includes(key);
    const context = label(currentNotes[i],i) + ' · ' + quotePct(currentNotes[i].quote.strike) + ' strike · ' + (funding ? 'Funding terms' : row.name);
    openCalculation({title:labels[key],context,steps,opener:control});
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
    byId('cmp-terms').innerHTML = notes.map((note,i) => {
      const {quote:q,terms:t}=note, count=q.months+'M / '+q.minimum+'M';
      const cell=(k,value)=>resultButton('down',i,k,value);
      return `<tr><th scope="row">${label(note,i)}<button type="button" data-cmp-plot="${q.id}" aria-label="Plot ${label(note,i)} on the selected scenario">Plot</button></th><td>${cell('tenure',count)}</td><td>${cell('strike',price(t.strike))}<small>${quotePct(q.strike)}</small></td><td>${cell('ko',price(t.ko))}<small>${quotePct(q.ko)}</small></td><td>${cell('monthly',units(t.maximum))}</td><td>${cell('payment',money(t.payment))}</td><td>${cell('difference',signedMoney(t.payment-target))}</td></tr>`;
    }).join('');
    try {
      currentRows = compare(notes, spot);
      currentNotes = notes;
      if (!currentRows.some(row => row.id === active)) active = 'ko-0';
      renderGrid(notes, currentRows);
    } catch (e) {
      notice.textContent = e.message;
      root.querySelectorAll('[data-cmp-plot], [data-work-key]').forEach(button => { button.disabled = true; });
      for (const id of ['cmp-grid','cmp-detail','cmp-breakdown','cmp-range-list','cmp-detail-title','cmp-description','cmp-criteria']) byId(id).textContent = '';
    }
  }

  function render() {
    updateTables();
    document.dispatchEvent(new CustomEvent('accumulator:comparison-updated'));
  }

  function getSnapshot() {
    if (!currentRows.length || !currentNotes.length) return null;
    const metric = byId('cmp-rank').value;
    const rows = currentRows.map(({id,name,short,description,path,notePaths,month,follow,basisName,sims,values}) => {
      const {best,worst} = extremes(values,metric);
      return {id, name, short, description, path, notePaths, month, follow:!!follow, basisName, values,
        winners:best, losers:worst,
        exits:sims.map(s => s && ({day:s.exit.day, koDay:s.koDay, koMonth:s.koMonth, shares:s.exit.shares, price:s.exit.price}))};
    });
    const contractRows = currentRows.filter(row=>!row.follow);
    const ranges = currentNotes.map((note,i) => extremes(contractRows.map(row => row.values[i]), metric));
    const result = {notes:currentNotes, rows, ranges, spot:byId('spot').valueAsNumber,
      target:byId('capital').valueAsNumber, active, metric, settings:currentSettings};
    // Give consumers independent data, including the paths and quote records.
    return JSON.parse(JSON.stringify(result));
  }
  const setupFields = ['early','late','rally','down','gap','rank','origin','recovery','sale-strike','sale-units'];
  function captureSetup() {
    return {quotes:Array.from(selected, id=>quoteById.get(id)), active,
      reference:quoteById.get(byId('cmp-reference').value),
      fields:Object.fromEntries(setupFields.map(key=>[key, byId('cmp-'+key).value]))};
  }
  function includeSavedQuote(quote) {
    if (!quote || quoteById.has(quote.id)) return;
    quotes.push(quote);
    quoteById.set(quote.id,quote);
    byId('cmp-choices').insertAdjacentHTML('beforeend',quoteChoice(quote));
  }
  function restoreSetup(setup, register) {
    if (!Array.isArray(setup?.quotes)) return;
    selected.clear();
    for (const raw of setup.quotes) {
      const quote = register(raw);
      if (!quote) continue;
      includeSavedQuote(quote);
      selected.add(quote.id);
    }
    const reference = register(setup.reference);
    includeSavedQuote(reference);
    const field = byId('cmp-reference');
    if (reference && !Array.from(field.options).some(option=>option.value===reference.id)) {
      field.add(new Option(quoteLabel(reference),reference.id));
    }
    field.value = reference?.id || 'lowest';
    for (const key of setupFields) {
      const input = byId('cmp-'+key);
      const value = setup.fields?.[key];
      if (typeof value !== 'string') continue;
      if (input.tagName === 'SELECT' && !Array.from(input.options).some(option=>option.value===value)) continue;
      input.value=value;
    }
    if (typeof setup.active === 'string') active=setup.active;
    selectionChanged('');
  }
  window.AccumulatorComparison = Object.freeze({getSnapshot, captureSetup, restoreSetup});

  function selectionChanged(message) {
    render();
    byId('cmp-selection-feedback').textContent = message;
    document.dispatchEvent(new CustomEvent('accumulator:selection', {detail:{ids:[...selected]}}));
  }

  function add(id) {
    const quote = quoteById.get(id) || Accumulator.quotes.find(item=>item.id===id&&item.originalId);
    if (!quote) return;
    includeSavedQuote(quote);
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
    const calculation = e.target.closest('[data-work-key]');
    if (calculation) { showCalculation(calculation); return; }
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
      const index = currentNotes.findIndex(n => n.quote.id === plot.dataset.cmpPlot);
      const row = currentRows.find(r => r.id === active);
      if (!row?.sims[index]) return;
      const note = currentNotes[index];
      const path = row.notePaths ? row.notePaths[index] : row.path;
      const name = row.follow ? row.name + ' · original structure · ' + row.basisName : row.name;
      document.dispatchEvent(new CustomEvent('accumulator:plot-comparison', {
        detail:{quoteId:note.quote.id, daily:path.slice(0, note.terms.days), name, completeMonthAtKO:row.month}
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
