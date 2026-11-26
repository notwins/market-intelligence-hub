'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const form = el('terms');
  const result = el('result');
  const currency = el('currency');
  const principalMinimum = {USD: 165000, SGD: 200000};
  const currencyFields = ['principal', 'initial', 'final'];
  const overrides = {USD: new Map(), SGD: new Map()};
  let history = [];
  const priceKey = () => currency.value === 'USD' ? 'usd_per_oz' : 'sgd_per_oz';

  function renderHistory() {
    Metals.showHistory(el('price-history'), history, priceKey(), 'Historical gold spot price in '+currency.value,
      currency.value+' / troy oz', currency.value === 'USD' ? '#96701c' : '#26766e');
  }

  function loadDefaults() {
    const cur = currency.value;
    const key = priceKey();
    const row = history.findLast(r => Number.isFinite(r[key]));
    const price = row ? row[key].toFixed(2) : '';
    const edits = overrides[cur];
    el('principal').value = edits.get('principal') ?? principalMinimum[cur];
    for (const id of ['initial','final']) el(id).value = edits.get(id) ?? price;
    el('principal-hint').textContent = `Assumed minimum ${cur} ${principalMinimum[cur].toLocaleString('en-US')}. You can edit the principal.`;
    el('basis').textContent = row
      ? `Gold reference on ${row.date} · ${cur} ${Metals.format(row[key])} per troy ounce. You can edit both prices.`
      : `Enter the gold prices in ${cur} per troy ounce.`;
    renderHistory();
    render();
  }
  function render() {
    if (!form.checkValidity()) {
      result.textContent = 'Enter a valid principal, strike, annual coupon, tenor and gold prices to calculate.';
      return;
    }
    const number = id => el(id).valueAsNumber;
    const principal = number('principal'), initial = number('initial'), final = number('final');
    const strike = initial * number('strike') / 100;
    const coupon = principal * number('coupon') / 100 * number('months') / 12;
    const redemption = spot => principal * Math.min(1, spot / strike);
    const total = redemption(final) + coupon;
    const cur = el('currency').value;
    const money = n => cur+' '+Metals.format(n);
    const high = Math.max(initial*1.4, final, strike*1.2);
    const levels = [...new Set([0,strike,final,high])].sort((a,b)=>a-b);
    result.innerHTML = Metals.metrics([
      ['Gold strike / oz', money(strike)], ['Total fixed coupons', money(coupon)],
      ['Principal redemption', money(redemption(final))], ['Total proceeds', money(total)],
      ['Profit / loss', money(total-principal)], ['Total return', Metals.format(100*(total/principal-1))+'%']
    ])+'<h3>Total proceeds by final gold price</h3>'+Metals.chart(levels.map(x=>[x,redemption(x)+coupon]),
      'Total note proceeds in '+cur+' by final gold price',{ticks:[[0,'0'],[strike,'Strike '+Metals.format(strike)],[high,Metals.format(high)]]})+
      '<p class="hint">Horizontal axis in '+cur+' per troy ounce. Vertical axis includes all coupons in '+cur+'.</p>';
  }
  currency.addEventListener('change', loadDefaults);
  el('history-range').addEventListener('change', renderHistory);
  form.addEventListener('input', event => {
    const {id, value} = event.target;
    if (id === 'currency') return;
    if (currencyFields.includes(id)) overrides[currency.value].set(id, value);
    render();
  });
  form.addEventListener('submit', e => e.preventDefault());
  try { history = await Metals.series('xau-spot'); }
  catch { /* The terms remain editable when the price archive is unavailable. */ }
  loadDefaults();
})();
