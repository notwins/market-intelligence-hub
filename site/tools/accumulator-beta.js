(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const sales = byId('delivery-sales-rows');
  const [spentBand, refundBand] = document.querySelector('.monthly-cash-bar').children;
  const {shares, price} = window.AccumulatorFormat;
  const toCents = amount => Math.round(amount * 100);
  const choices = new Map();
  let quoteId;
  let simulation;
  let onSaleChange;

  function renderCapital() {
    const {maximum, strike, rows, exit, payment, roundingCash} = simulation;
    const strikeCents = toCents(strike);
    const fundingPerTranche = maximum * strikeCents;
    const tranches = rows.map(({month}) => ({month, quantity:0, delivery:0}));
    for (const {month, bought} of rows) {
      let remaining = bought;
      // A KO guarantee top-up can bring forward later tranches to the KO delivery.
      for (let index = month - 1; remaining > 0 && index < tranches.length; index++) {
        const tranche = tranches[index];
        const quantity = Math.min(maximum - tranche.quantity, remaining);
        tranche.quantity += quantity;
        tranche.delivery = month;
        remaining -= quantity;
      }
    }

    byId('monthly-cash-spent').textContent = price(exit.spent);
    byId('monthly-cash-refund').textContent = price(exit.refunded);
    spentBand.style.flexBasis = (100 * exit.spent / payment) + '%';
    refundBand.style.flexBasis = (100 * exit.refunded / payment) + '%';
    byId('monthly-cash-tranches').innerHTML = tranches.map(({month, quantity, delivery}) => {
      const cashBack = (fundingPerTranche - quantity * strikeCents) / 100;
      const purchased = quantity > 0 ? 'Delivered in M' + delivery : 'Returned in M' + exit.month;
      const refunded = cashBack > 0 && !quantity ? ' cash-tranche--refunded' : '';
      return `<article class="cash-tranche${refunded}">
        <small>Tranche ${month} · ${price(fundingPerTranche / 100)}</small>
        <strong>${shares(quantity)} shares</strong>
        <div class="cash-tranche-bar" aria-hidden="true"><span style="width:${100 * quantity / maximum}%"></span></div>
        <small>${purchased}</small>
        <small>${price(cashBack)} cash back</small>
      </article>`;
    }).join('');
    byId('monthly-cash-reconcile').textContent = 'Principal check · ' + price(exit.spent) + ' + ' + price(exit.refunded) + ' = ' + price(payment) + '.';
    const rounding = byId('monthly-cash-rounding');
    rounding.hidden = !roundingCash;
    rounding.textContent = 'Cash returned includes ' + price(roundingCash) + ' from rounding the initial payment.';
  }

  function updateSalePlan() {
    const status = byId('delivery-sales-status');
    const scope = byId('delivery-sales-scope');
    let soldShares = 0;
    let proceedsCents = 0;
    let valid = true;
    for (const row of sales.rows) {
      const [sell, salePrice] = row.querySelectorAll('input');
      salePrice.disabled = !sell.checked;
      if (!sell.checked) continue;
      valid = salePrice.validity.valid && valid;
      const quantity = simulation.rows[Number(row.dataset.delivery) - 1].bought;
      soldShares += quantity;
      proceedsCents += quantity * toCents(salePrice.valueAsNumber);
    }

    if (!valid || !Number.isSafeInteger(proceedsCents)) {
      status.textContent = 'Enter a valid price in USD cents for each selected delivery.';
      scope.hidden = true;
      onSaleChange(null);
      return;
    }

    const {exit, payment} = simulation;
    const retained = exit.shares - soldShares;
    const remainingValue = retained * toCents(exit.price);
    const combinedPnl = proceedsCents + remainingValue + toCents(exit.refunded) - toCents(payment);
    scope.hidden = !soldShares;
    status.textContent = soldShares
      ? shares(soldShares) + ' shares sold early for ' + price(proceedsCents / 100) + ' · ' +
        shares(retained) + ' shares held to exit · P&L at the modelled exit price ' + price(combinedPnl / 100) + '.'
      : '';
    onSaleChange({soldShares, proceedsCents});
  }

  function render(next, activeQuoteId, saleChange) {
    simulation = next;
    onSaleChange = saleChange;
    if (activeQuoteId !== quoteId) choices.clear();
    quoteId = activeQuoteId;

    renderCapital();
    const deliveries = simulation.rows.filter(row => row.month < simulation.exit.month && row.bought > 0);
    const eligible = new Set(deliveries.map(row => row.month));
    for (const month of choices.keys()) if (!eligible.has(month)) choices.delete(month);
    sales.replaceChildren(...deliveries.map(row => {
      const choice = choices.get(row.month);
      const tr = document.createElement('tr');
      tr.dataset.delivery = row.month;
      tr.innerHTML = `<th scope="row">Month ${row.month}</th><td>${shares(row.bought)}</td>
        <td><label><input type="checkbox" ${choice?.sell ? 'checked' : ''} aria-label="Sell month ${row.month} delivery"> Sell</label></td>
        <td><input type="number" aria-label="Month ${row.month} sale price in USD" min="0" max="1000000" step="0.01" required></td>`;
      tr.querySelector('input[type=number]').value = choice?.enteredPrice ?? row.price.toFixed(2);
      return tr;
    }));
    const empty = byId('delivery-sales-empty');
    empty.hidden = Boolean(deliveries.length);
    empty.textContent = simulation.koDay
      ? 'This path has no delivery before knock-out.'
      : 'This path has no delivery before maturity.';
    byId('delivery-sales-table').hidden = !deliveries.length;
    updateSalePlan();
  }

  sales.addEventListener('input', event => {
    const input = event.target;
    const month = Number(input.closest('tr').dataset.delivery);
    const choice = choices.get(month) ?? {};
    if (input.type === 'checkbox') choice.sell = input.checked;
    else choice.enteredPrice = input.value;
    choices.set(month, choice);
    updateSalePlan();
  });

  window.AccumulatorMonthlyCash = {render};
})();
