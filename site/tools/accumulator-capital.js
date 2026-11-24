// A decimal keeps its integer coefficient and scale through every multiplication.
(function () {
  'use strict';
  const SI_SIZING_DAYS = 23n;
  const integer = value => value.toLocaleString('en-US');

  function readNumber(raw, field, label, whole = false) {
    const text = String(raw).trim();
    const syntax = whole ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/;
    if (text.length > 36 || !syntax.test(text)) {
      throw Object.assign(new Error(whole ? label + ' must be a positive whole number.' : 'Enter a positive decimal for ' + label + '.'), {field});
    }
    const [units, fraction = ''] = text.split('.');
    const n = BigInt((units || '0') + fraction);
    if (n === 0n) throw Object.assign(new Error(label + ' must be greater than zero.'), {field});
    return {n, scale: fraction.length};
  }

  function display({n, scale}, minPlaces = 0, grouped = true) {
    const digits = n.toString().padStart(scale + 1, '0');
    const units = scale ? digits.slice(0, -scale) : digits;
    const fraction = (scale ? digits.slice(-scale).replace(/0+$/, '') : '').padEnd(minPlaces, '0');
    return (grouped ? integer(BigInt(units)) : units) + (fraction ? '.' + fraction : '');
  }

  function wholeAmount({n, scale}) {
    const divisor = 10n ** BigInt(scale);
    return integer((n + divisor / 2n) / divisor);
  }

  function strikeFromLevel(spot, level, issuer) {
    const n = spot.n * level.n;
    const scale = spot.scale + level.scale + 2;
    if (issuer === 'si' || scale <= 4) return {n, scale};
    const divisor = 10n ** BigInt(scale - 4);
    return {n: (n + divisor / 2n) / divisor, scale: 4};
  }

  function example(issuer) {
    const spot = '165.05';
    const level = issuer === 'si' ? '95.89' : '90.56';
    const strike = strikeFromLevel(readNumber(spot), readNumber(level), issuer);
    return {basis:'monthly', months:'9', days:'186', monthlyShares:'100', dailyShares:'10',
            currency:'USD', method:'direct', strike:display(strike, 4, false), spot, level};
  }

  function calculate(issuer, state) {
    const daily = state.basis === 'daily';
    const noteDaily = daily && issuer === 'sn';
    const term = readNumber(noteDaily ? state.days : state.months, 'term', noteDaily ? 'Trading days' : 'Tenor in months', true).n;
    const quantity = readNumber(daily ? state.dailyShares : state.monthlyShares, 'quantity', 'Shares', true).n;
    let strike;
    if (state.method === 'derived') {
      strike = strikeFromLevel(readNumber(state.spot, 'spot', 'Initial price'), readNumber(state.level, 'level', 'Strike level'), issuer);
      if (strike.n === 0n) throw Object.assign(new Error('The calculated SN strike is zero after four-decimal rounding. Check the price and level.'), {field:'level'});
    } else {
      strike = readNumber(state.strike, 'strike', 'Final strike');
      if (issuer === 'sn' && strike.scale > 4 && strike.n % (10n ** BigInt(strike.scale - 4)) !== 0n) {
        throw Object.assign(new Error('Enter the final SN strike to four decimal places, or calculate it from the initial price.'), {field:'strike'});
      }
    }
    const periods = daily && issuer === 'si' ? term * SI_SIZING_DAYS : term;
    const shares = periods * quantity;
    const atStrike = count => ({n:count * strike.n, scale:strike.scale});
    const exact = atStrike(shares);
    const divisor = 10n ** BigInt(exact.scale);
    const cash = amount => state.currency + ' ' + wholeAmount(amount);
    const price = state.currency + ' ' + display(strike, 4);
    const rows = [['Strike per share', price]];
    if (daily && issuer === 'si') rows.push(['Sizing shares per month', integer(quantity * SI_SIZING_DAYS)]);
    rows.push([daily ? 'Capital per sizing day' : 'Capital per month', cash(atStrike(quantity))],
              ['Full-tenor shares', integer(shares)]);
    let headline = 'Full-tenor capital';
    let amount = cash(exact);
    const units = daily ? ' shares/day' : ' shares/month';
    const factors = noteDaily ? [integer(term) + ' trading days'] : [integer(term) + ' months'];
    if (daily && !noteDaily) factors.push('23 sizing days/month');
    factors.push(integer(quantity) + units, price);
    if (noteDaily) {
      headline = 'Rounded note notional';
      rows.push(['Share cost before funding round-up', cash(exact)]);
      amount = cash({n:(exact.n + divisor - 1n) / divisor, scale:0});
    }
    const exactCost = state.currency + ' ' + display(exact);
    return {headline, amount, exactCost, equation:factors.join(' × ') + (noteDaily ? ' · rounded up to a whole dollar' : ''), rows};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {calculate, example};
  if (typeof document === 'undefined') return;

  const byId = id => document.getElementById(id);
  const states = {si:example('si'), sn:example('sn')};
  const names = {si:'OCBC SI', sn:'JPM SN'};
  const ids = ['term', 'quantity', 'strike', 'spot', 'level'];
  let issuer;
  let copyText = '';

  function keys(s) {
    return {
      term:issuer === 'sn' && s.basis === 'daily' ? 'days' : 'months',
      quantity:s.basis === 'daily' ? 'dailyShares' : 'monthlyShares',
      strike:'strike', spot:'spot', level:'level'
    };
  }

  function renderInputs() {
    const s = states[issuer], daily = s.basis === 'daily', noteDaily = daily && issuer === 'sn';
    byId('inputs-title').textContent = names[issuer] + ' inputs';
    byId('term-label').textContent = noteDaily ? 'Enter the quoted trading-day count' : 'Set the tenor';
    byId('term-unit').textContent = noteDaily ? 'trading days' : 'months';
    byId('term-help').textContent = daily && !noteDaily ? 'The SI worksheet allows 23 sizing days per month.' : '';
    byId('quantity-label').textContent = 'Choose whole shares per ' + (daily ? 'day' : 'month');
    byId('quantity-unit').textContent = 'shares / ' + (daily ? 'day' : 'month');
    document.querySelectorAll('input[name="basis"]').forEach(radio => { radio.checked = radio.value === s.basis; });
    byId('price-method').value = s.method;
    byId('currency').value = s.currency;
    document.querySelectorAll('.currency-unit').forEach(span => { span.textContent = s.currency; });
    const fields = keys(s);
    for (const id of ids) byId(id).value = s[fields[id]];
    byId('direct-fields').hidden = s.method !== 'direct';
    byId('derived-fields').hidden = s.method !== 'derived';
    byId('strike-help').textContent = s.method === 'direct' ? 'Use the quoted price per share in the selected currency.' :
      (issuer === 'si' ? 'SI keeps the full precision of the calculated strike.' : 'SN rounds the calculated strike to four decimal places.');
    byId('result-kicker').textContent = names[issuer] + ' · ' + (daily ? 'Daily worksheet' : 'Monthly shares');
    byId('note-title').textContent = daily ? 'How this worksheet sizes capital' : 'What this figure covers';
    byId('note-body').textContent = !daily ? 'This plan assumes the same share quantity every month through maturity. If the trade fixes shares daily, use Daily worksheet to check its sizing basis.' :
      noteDaily ? 'Use the trading days in the note quote and the normal daily share quantity. The note worksheet rounds the final share cost up to the next whole dollar when a fraction remains.' :
      'The SI worksheet uses 23 sizing days for each month of tenor. The actual number of fixing days can differ, so monthly deliveries may vary.';
    updateResult();
  }

  function updateResult() {
    const s = states[issuer];
    byId('breakdown').replaceChildren();
    byId('manual-copy').hidden = true;
    byId('manual-copy').value = '';
    byId('copy-status').textContent = '';
    byId('input-error').textContent = '';
    for (const id of ids) {
      byId(id).removeAttribute('aria-invalid');
      byId(id).removeAttribute('aria-errormessage');
    }
    try {
      const result = calculate(issuer, s);
      byId('result-title').textContent = result.headline;
      byId('capital').textContent = result.amount;
      byId('equation').textContent = result.equation;
      byId('exact-details').hidden = false;
      byId('exact-cost').textContent = result.exactCost;
      for (const [label, value] of result.rows) {
        const row = document.createElement('div');
        const dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value;
        row.append(dt, dd);
        byId('breakdown').append(row);
      }
      copyText = [byId('result-kicker').textContent + ' · Normal 1×', result.headline + ' · ' + result.amount,
        result.equation, 'Exact full-tenor share cost · ' + result.exactCost, ...result.rows.map(([label,value]) => label + ' · ' + value), byId('note-body').textContent].join('\n');
      byId('copy').disabled = false;
    } catch (error) {
      if (!error.field) throw error;
      byId('result-title').textContent = 'Capital calculation';
      byId('capital').textContent = '—';
      byId('exact-details').hidden = true;
      byId('exact-cost').textContent = '';
      byId('equation').textContent = error.message;
      byId('input-error').textContent = error.message;
      byId(error.field).setAttribute('aria-invalid','true');
      byId(error.field).setAttribute('aria-errormessage','input-error');
      copyText = '';
      byId('copy').disabled = true;
    }
    byId('mobile-label').textContent = byId('result-title').textContent;
    byId('mobile-value').textContent = byId('capital').textContent;
  }

  function selectIssuer() {
    if (location.hash === '#sn') issuer = 'sn';
    else if (!issuer || !location.hash || location.hash === '#si') issuer = 'si';
    for (const id of ['si','sn']) {
      const link = byId(id + '-link');
      if (id === issuer) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    renderInputs();
  }

  for (const id of ids) byId(id).addEventListener('input', event => {
    const s = states[issuer];
    s[keys(s)[id]] = event.target.value;
    updateResult();
  });
  document.querySelectorAll('input[name="basis"]').forEach(radio => radio.addEventListener('change', () => {
    states[issuer].basis = radio.value;
    renderInputs();
  }));
  byId('price-method').addEventListener('change', event => { states[issuer].method = event.target.value; renderInputs(); });
  byId('currency').addEventListener('change', event => {
    const s = states[issuer];
    s.currency = event.target.value;
    s.spot = ''; s.strike = '';
    renderInputs();
  });
  byId('copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      byId('copy-status').textContent = 'Copied';
    } catch {
      const manual = byId('manual-copy');
      manual.hidden = false;
      manual.value = copyText;
      manual.focus(); manual.select();
      byId('copy-status').textContent = 'Select and copy the text below.';
    }
  });
  byId('view-result').addEventListener('click', () => {
    byId('result-title').focus({preventScroll:true});
    byId('result-title').scrollIntoView({block:'center'});
  });
  window.addEventListener('hashchange', selectIssuer);
  selectIssuer();
})();
