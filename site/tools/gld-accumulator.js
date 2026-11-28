'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const form = el('terms'), result = el('result');
  const money = n => 'USD ' + Metals.format(n);
  const pricingStatus = el('pricing-status');
  const monthPrices = el('month-prices');
  const monthOverrides = new Map();
  const spotOverrides = new Map();
  const supportedTenors = [...el('months').options].map(option => Number(option.value));
  const dateLabel = date => new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long', timeZone: 'UTC'
  }).format(new Date(date + 'T00:00:00Z'));
  let history = [];
  let activeQuote;
  let termsEdited = false;
  let scenarioDays;
  let tradeDateEdited = false;

  function readPricing(text) {
    const pricing = JSON.parse(text.replace(/^\uFEFF/, ''));
    const pricingDate = pricing?.addedDate ?? pricing?.requestDate;
    const date = Date.parse(pricingDate);
    if (pricing?.kind !== 'gld-accumulator-pricing' || pricing.version !== 1 ||
        !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== pricingDate ||
        (pricing.issuer !== undefined && (typeof pricing.issuer !== 'string' || !pricing.issuer.trim())) ||
        pricing.settlementFrequency !== 'monthly' || typeof pricing.koPlusOne !== 'boolean' ||
        !Number.isFinite(pricing.offset) || !Array.isArray(pricing.rows) || !pricing.rows.length) {
      throw Error('Invalid GLD pricing header.');
    }
    const keys = new Set();
    for (const row of pricing.rows) {
      const {months, ko, days, guarantee, strike} = row ?? {};
      const key = [months, ko, guarantee].join('/');
      if (!supportedTenors.includes(months) || !Number.isFinite(ko) || ko <= 100 || ko > 1000 ||
          !Number.isInteger(days) || days < 1 || !Number.isInteger(guarantee) || guarantee < 0 || guarantee > months ||
          (strike !== null && (!Number.isFinite(strike) || strike <= 0 || strike > 100)) || keys.has(key)) {
        throw Error('Invalid GLD pricing row.');
      }
      keys.add(key);
    }
    return pricing;
  }

  function applyQuote(quote, button) {
    activeQuote?.setAttribute('aria-pressed', 'false');
    activeQuote = button;
    button.setAttribute('aria-pressed', 'true');
    el('months').value = quote.months;
    el('minimum').value = quote.guarantee;
    el('ko').value = quote.ko;
    el('strike').value = quote.strike;
    scenarioDays = String(quote.days);
    configure();
    render();
  }

  function displayPricing(pricing) {
    const summary = el('pricing-terms');
    const wrapper = el('pricing-table');
    const {rows, addedDate, requestDate, issuer, koPlusOne, offset} = pricing;
    const quoted = rows.filter(row => row.strike !== null).length;
    pricingStatus.textContent = quoted
      ? 'Choose a quoted strike to fill the terms below. You can edit the terms after selecting a quote.'
      : 'This pricing request has no quoted strikes. Enter your own terms below.';
    const edition = addedDate ? `Pricing added ${dateLabel(addedDate)}` : `Pricing request ${dateLabel(requestDate)}`;
    const issuerLabel = issuer ? ` · ${issuer}` : '';
    summary.textContent = `${edition}${issuerLabel} · Normal · Monthly settlement · KO+1 ${koPlusOne ? 'yes' : 'no'} · Offset ${Metals.format(offset, 1)}`;

    const guarantees = [...new Set(rows.map(row => row.guarantee))].sort((a, b) => a - b);
    const groups = new Map();
    for (const row of rows) {
      const key = [row.months, row.ko, row.days].join('/');
      if (!groups.has(key)) groups.set(key, new Map());
      groups.get(key).set(row.guarantee, row);
    }
    const table = document.createElement('table');
    table.createCaption().textContent = 'Strike by guaranteed period';
    const heading = table.createTHead().insertRow();
    for (const label of ['Tenor', 'KO', 'Quoted days', ...guarantees.map(months => `${months}M`)]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      heading.append(th);
    }
    const body = table.createTBody();
    const buttons = new Map();
    for (const group of groups.values()) {
      const {months, ko, days} = group.values().next().value;
      const row = body.insertRow();
      const tenor = document.createElement('th');
      tenor.scope = 'row';
      tenor.textContent = `${months}M`;
      row.append(tenor);
      row.insertCell().textContent = `${ko}%`;
      row.insertCell().textContent = days;
      for (const guarantee of guarantees) {
        const quote = group.get(guarantee);
        const cell = row.insertCell();
        if (quote?.strike == null) {
          const unquoted = document.createElement('span');
          unquoted.setAttribute('aria-label', 'No strike quoted');
          unquoted.textContent = '—';
          cell.append(unquoted);
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${Metals.format(quote.strike)}%`;
        button.setAttribute('aria-label', `${button.textContent} strike, ${months} month tenor, ${ko}% knock-out, ${guarantee} month guarantee`);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => applyQuote(quote, button));
        buttons.set(quote, button);
        cell.append(button);
      }
    }
    wrapper.replaceChildren(table);
    summary.hidden = wrapper.hidden = false;
    const first = rows.find(row => row.strike !== null);
    if (first && !termsEdited) applyQuote(first, buttons.get(first));
  }

  async function loadPricing() {
    try {
      const response = await fetch('../data/metals/gld-accumulator-pricing.json?v=20261127.pricing1');
      if (!response.ok) throw Error('Pricing request failed');
      displayPricing(readPricing(await response.text()));
    } catch {
      pricingStatus.textContent = 'Saved GLD pricing is unavailable. Enter your own terms below.';
    }
  }

  function anniversary(day, months) {
    const d = new Date(day+'T00:00:00Z');
    const end = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months+1,0));
    end.setUTCDate(Math.min(d.getUTCDate(), end.getUTCDate()));
    return end.toISOString().slice(0,10);
  }
  function monthlyInputs() {
    const count = Number(el('months').value);
    monthPrices.replaceChildren();
    if (el('mode').value === 'history') return;
    for (let m = 1; m <= count; m++) {
      const label = document.createElement('label');
      label.textContent = 'Month '+m;
      const input = document.createElement('input');
      Object.assign(input,{type:'number', min:'0', max:'1000000', step:'any', required:true});
      input.dataset.month = m;
      label.append(input);
      monthPrices.append(label);
    }
  }

  function updateReference(trade) {
    const mode = el('mode').value;
    const reference = mode === 'history' ? trade : history.at(-1);
    const spot = el('spot');
    const shown = String(spotOverrides.get(mode) ?? reference?.close ?? '');
    if (spot.value !== shown) spot.value = shown;
    el('price-reference').textContent = reference
      ? `GLD close on ${reference.date} · ${money(reference.close)} per share. You can edit the starting price.`
      : 'Enter a starting GLD price.';
    for (const input of monthPrices.querySelectorAll('input')) {
      const close = monthOverrides.get(input.dataset.month) ?? spot.value;
      if (input.value !== close) input.value = close;
    }
  }

  function configure() {
    const scenario = el('mode').value === 'scenario';
    const months = Number(el('months').value);
    const start = el('start');
    const days = el('days');
    el('start-label').hidden = start.disabled = scenario;
    days.readOnly = !scenario;
    days.min = el('minimum').max = String(months);
    if (scenario) days.value = scenarioDays ?? AccumulatorModel.observationSchedule({months, minimum: 0}).days;
    el('path').hidden = !scenario;
    monthlyInputs();
    const lastStart = history.findLast(r => anniversary(r.date, months) <= history.at(-1).date);
    start.min = history[0]?.date ?? '';
    start.max = lastStart?.date ?? '';
    if (!tradeDateEdited) start.value = lastStart?.date ?? '';
  }

  function replayFor(months) {
    const first = history.findIndex(r => r.date >= el('start').value);
    const trade = el('start').value && history[first];
    if (!trade) return {};
    const lastDay = anniversary(trade.date, months);
    if (lastDay > history.at(-1).date) return {trade};
    return {trade, observations: history.slice(first+1).filter(r => r.date <= lastDay)};
  }

  function renderHistory() {
    Metals.showHistory(el('price-history'), history, 'close', 'Historical GLD daily closes in USD',
      'USD / share', '#305b86');
  }

  function render() {
    const planner = el('strategy-planner');
    planner.setAttribute('href', 'gld-strategy-detail.html');
    const historical = el('mode').value === 'history';
    const months = Number(el('months').value);
    const {trade, observations} = historical ? replayFor(months) : {};
    const sharesInput = el('daily-shares');
    const sizing = el('share-sizing');
    const period = el('period');
    period.textContent = historical ? 'Replay begins at the first trading close on or after the trade date.' :
      'Scenario closes are interpolated between monthly prices. You can change the number of trading observations.';
    if (historical) el('days').value = observations?.length ?? '';
    updateReference(trade);
    sharesInput.placeholder = 'Auto';
    sizing.textContent = 'Leave shares blank to size automatically.';
    try {
      if (historical && !observations?.length) {
        throw Error(history.length ? 'Choose a trade date with enough GLD history for the full tenor.' :
          'GLD history is unavailable. Choose Monthly scenario to enter your own prices.');
      }
      if (!form.checkValidity()) throw Error('Enter valid accumulator terms and prices to see the outcome.');
      const target = el('capital').valueAsNumber;
      const spot = el('spot').valueAsNumber;
      const quote = {months, minimum:el('minimum').valueAsNumber, strike:el('strike').valueAsNumber,
        ko:el('ko').valueAsNumber, days:el('days').valueAsNumber, sizing:'daily',
        dailyShares:sharesInput.value ? sharesInput.valueAsNumber : undefined};
      let daily;
      if (historical) {
        quote.knownMonthEnds = Array.from({length:months}, (_,i) =>
          observations.findLastIndex(r => r.date <= anniversary(trade.date,i+1))+1);
        daily = observations.map(r => r.close);
        period.textContent += ` ${trade.date} to ${observations.at(-1).date} · ${daily.length} trading sessions.`;
      } else {
        daily = AccumulatorModel.monthlyPath(quote,spot,[...monthPrices.querySelectorAll('input')].map(i=>i.valueAsNumber));
      }
      const sim = AccumulatorModel.simulateDaily(quote,spot,target,daily);
      const plannerTerms = new URLSearchParams({
        spot: String(spot), strike: String(quote.strike), ko: String(quote.ko),
        days: String(sim.days), guarantee: String(sim.guaranteeDay)
      });
      planner.setAttribute('href', 'gld-strategy-detail.html?' + plannerTerms);
      sharesInput.placeholder = String(sim.dailyShares);
      const difference = sim.payment - target;
      const comparison = difference === 0 ? 'matches target capital' :
        `${money(Math.abs(difference))} ${difference > 0 ? 'above' : 'below'} target`;
      sizing.textContent = `${sharesInput.value ? 'Manual' : 'Auto'} sizing · ${sim.dailyShares.toLocaleString('en-US')} shares per trading day · ${sim.days} observations at ${money(sim.strike)} strike · ${money(sim.payment)} initial payment (${comparison}).`;
      const hold = AccumulatorBenchmark.buyAndHold(sim.payment,spot,daily.at(-1));
      const ko = sim.koDay ? (historical ? observations[sim.koDay-1].date : 'Day '+sim.koDay) : 'No knock-out';
      const path = [spot,...daily].map((p,i)=>[i,p]);
      const plot = Metals.chart(path,'GLD share price with strike and knock-out levels',{
        ticks:historical ? [[0,trade.date],[daily.length,observations.at(-1).date]] : [[0,'Trade'],[daily.length,'Day '+daily.length]],
        guides:[{name:'Strike',value:sim.strike,color:'#24766b'},{name:'Knock-out',value:sim.ko,color:'#a95634'}]});
      const ledger = sim.rows.map(r => '<tr><td>'+r.month+(historical?' · '+observations[r.day-1].date:'')+'</td><td>'+Metals.format(r.price)+'</td><td>'+r.bought+'</td><td>'+r.shares+'</td><td>'+Metals.format(r.refund)+'</td><td>'+r.status+'</td></tr>').join('');
      result.innerHTML = Metals.metrics([
        ['Initial payment',money(sim.payment)],['Shares per trading day',String(sim.dailyShares)],['Knock-out observation',ko],
        ['GLD shares acquired',String(sim.end.shares)],['Cash refunded',money(sim.end.refunded)],
        ['Final value',money(sim.end.value)],['Accumulator profit / loss',money(sim.profit)],['Buy-and-hold profit / loss',money(hold.pnl)]
      ])+'<h3>GLD path · USD per share</h3>'+plot+'<p class="hint">Strike '+money(sim.strike)+' (teal dashed) · Knock-out '+money(sim.ko)+' (rust dashed)</p>'+
        '<hr class="history-cut"><div class="table-wrap"><table><caption>Monthly share and cash ledger</caption><thead><tr><th>Month</th><th>GLD close</th><th>Acquired</th><th>Total shares</th><th>Refund (USD)</th><th>Event</th></tr></thead><tbody>'+ledger+'</tbody></table></div>';
    } catch(error) { result.textContent = error.message; }
  }
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', ({target: input}) => {
    const {id, value} = input;
    if (input.dataset.month) monthOverrides.set(input.dataset.month, value);
    if (id === 'spot') spotOverrides.set(el('mode').value, value);
    if (id === 'start') tradeDateEdited = Boolean(value);
    if (id === 'days') scenarioDays = value;
    if (id === 'months') scenarioDays = undefined;
    if (['months','strike','ko','minimum','days'].includes(id)) {
      termsEdited = true;
      activeQuote?.setAttribute('aria-pressed', 'false');
      activeQuote = undefined;
    }
    if (id === 'mode' || id === 'months') configure();
    render();
  });
  el('history-range').addEventListener('change', renderHistory);
  configure();
  loadPricing();
  try { history = await Metals.series('gld'); }
  catch { /* Monthly scenario still works with manually entered prices. */ }
  configure();
  renderHistory();
  render();
})();
