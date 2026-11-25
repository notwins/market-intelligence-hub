'use strict';
(async () => {
  const el = id => document.getElementById(id);
  const form = el('terms');
  const result = el('result');
  let history = [];
  function loadReference() {
    const currency = el('currency').value;
    const key = currency === 'USD' ? 'usd_per_oz' : 'sgd_per_oz';
    const row = history.findLast(r => r[key] !== null);
    for (const id of ['initial','final']) el(id).value = row?.[key] ?? '';
    el('basis').textContent = row ? 'Starting and final scenarios use the '+row.date+' reference of '+currency+' '+Metals.format(row[key])+' per troy ounce. Both prices are editable.' : 'Enter a reference price in '+currency+' per troy ounce.';
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
  el('currency').addEventListener('change', () => { loadReference(); render(); });
  form.addEventListener('input',render);
  form.addEventListener('submit', e => e.preventDefault());
  try { history = await Metals.series('xau-spot'); }
  catch { el('basis').textContent = 'History unavailable. Enter the initial and final gold prices.'; }
  loadReference();
  render();
})();
