(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const sales = byId('delivery-sales-rows');
  const [spentBand, refundBand] = document.querySelector('.monthly-cash-bar').children;
  const {shares, money, price} = window.AccumulatorFormat;
  const toCents = amount => Math.round(amount * 100);
  const choices = new Map();
  let quoteId;
  let simulation;
  let onSaleChange;
  let capitalTranches;
  let salePlan;

  function monthlyLedger(deliverySales, soldBeforeExit) {
    const {exit, payment, rows} = simulation;
    let sharesSoldToDate = 0;
    let cashReceivedToDate = 0;
    return rows.slice(0, exit.month).map(row => {
      const atExit = row.month === exit.month;
      const sale = atExit
        ? {quantity: exit.shares - soldBeforeExit, priceCents: toCents(exit.price)}
        : deliverySales.get(row.month);
      const openingShares = row.shares - row.bought - sharesSoldToDate;
      const sharesSold = sale?.quantity ?? 0;
      const salePriceCents = sale?.priceCents ?? 0;
      const cashReceivedCents = sharesSold * salePriceCents;
      sharesSoldToDate += sharesSold;
      cashReceivedToDate += cashReceivedCents;
      const sharesHeld = row.shares - sharesSoldToDate;
      const holdingsCents = sharesHeld * toCents(row.price);
      const valueCents = holdingsCents + cashReceivedToDate + toCents(row.refunded) + toCents(row.remaining);
      return {openingShares, sharesSold, cashReceivedCents, sharesHeld, salePriceCents,
        holdingsCents, cashReceivedToDate, valueCents, pnlCents: valueCents - toCents(payment)};
    });
  }

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

    byId('monthly-cash-spent').textContent = money(exit.spent);
    byId('monthly-cash-refund').textContent = money(exit.refunded);
    spentBand.style.flexBasis = (100 * exit.spent / payment) + '%';
    refundBand.style.flexBasis = (100 * exit.refunded / payment) + '%';
    capitalTranches = tranches.map(tranche => ({
      ...tranche,
      cashBack: (fundingPerTranche - tranche.quantity * strikeCents) / 100
    }));
    byId('monthly-cash-tranches').innerHTML = capitalTranches.map(({month, quantity, cashBack}) => {
      const refunded = !quantity ? ' cash-tranche--refunded' : '';
      const returned = money(cashBack);
      return `<article class="cash-tranche${refunded}">
        <span class="cash-tranche-month">M${month}${quantity ? '' : ' · Refund'}</span>
        <strong>${quantity ? shares(quantity) + ' shares' : returned}</strong>
        ${quantity && cashBack >= .5 ? '<span class="cash-tranche-return">' + returned + ' back</span>' : ''}
        <div class="cash-tranche-bar" aria-hidden="true"><span style="width:${100 * quantity / maximum}%"></span></div>
      </article>`;
    }).join('');
    byId('monthly-cash-reconcile').textContent = 'Principal check · ' + price(exit.spent) + ' + ' + price(exit.refunded) + ' = ' + price(payment) + '.';
    const rounding = byId('monthly-cash-rounding');
    rounding.hidden = !roundingCash;
    rounding.textContent = 'Cash returned includes ' + price(roundingCash) + ' from rounding the initial payment.';
    const timing = byId('monthly-cash-timing');
    const advanced = tranches.filter(({month, quantity, delivery}) => quantity && delivery < month);
    timing.hidden = !advanced.length;
    timing.textContent = 'Guarantee deliveries brought forward: ' +
      advanced.map(({month, quantity, delivery}) => 'M' + month + ' (' + shares(quantity) + ' shares in M' + delivery + ')').join(', ') + '.';
  }

  function updateSalePlan() {
    const status = byId('delivery-sales-status');
    const scope = byId('delivery-sales-scope');
    const deliverySales = new Map();
    let soldShares = 0;
    let proceedsCents = 0;
    let valid = true;
    for (const row of sales.rows) {
      const [sell, salePrice] = row.querySelectorAll('input');
      const delivery = simulation.rows[Number(row.dataset.delivery) - 1];
      const preview = salePrice.previousElementSibling;
      salePrice.disabled = !sell.checked;
      salePrice.hidden = !sell.checked;
      preview.hidden = sell.checked;
      preview.textContent = money(Number.isFinite(salePrice.valueAsNumber) ? salePrice.valueAsNumber : delivery.price);
      if (!sell.checked) continue;
      valid = salePrice.validity.valid && valid;
      const quantity = delivery.bought;
      const priceCents = toCents(salePrice.valueAsNumber);
      deliverySales.set(delivery.month, {quantity, priceCents});
      soldShares += quantity;
      proceedsCents += quantity * priceCents;
    }

    if (!valid || !Number.isSafeInteger(proceedsCents)) {
      status.textContent = 'Enter a valid price in USD cents for each selected delivery.';
      scope.hidden = true;
      salePlan = null;
      onSaleChange(salePlan);
      return;
    }

    const {exit} = simulation;
    const ledger = monthlyLedger(deliverySales, soldShares);
    const {valueCents: exitValueCents, pnlCents} = ledger.at(-1);
    const remainingShares = exit.shares - soldShares;
    const remainingValueCents = remainingShares * toCents(exit.price);
    scope.hidden = !soldShares;
    status.textContent = soldShares
      ? shares(soldShares) + ' sold early · ' + money(proceedsCents / 100) + ' proceeds'
      : '';
    const deliveries = Array.from(deliverySales, ([month, sale]) => ({month, ...sale}));
    salePlan = {deliveries, soldShares, proceedsCents, remainingShares, remainingValueCents, exitValueCents, pnlCents, ledger};
    onSaleChange(salePlan);
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
        <td><label><input type="checkbox" ${choice?.sell ? 'checked' : ''} aria-label="Sell month ${row.month} delivery"></label></td>
        <td><span class="delivery-price-preview"></span><input type="number" aria-label="Month ${row.month} sale price in USD" min="0" max="1000000" step="0.01" required></td>`;
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

  function restoreChoices(activeQuoteId, saved) {
    quoteId = activeQuoteId;
    choices.clear();
    if (!Array.isArray(saved)) return;
    for (const entry of saved) {
      if (!Array.isArray(entry)) continue;
      const [month, choice] = entry;
      if (!Number.isInteger(month) || month < 1 || month > 12 || !choice) continue;
      const price = choice.enteredPrice;
      choices.set(month, {sell:choice.sell===true, enteredPrice:typeof price==='string'&&price.length<32?price:undefined});
    }
  }
  window.AccumulatorMonthlyCash = {
    render, restoreChoices,
    getOverview: () => ({tranches: capitalTranches, salePlan}),
    captureChoices: () => Array.from(sales.rows, row => {
      const [sell, entered] = row.querySelectorAll('input');
      return [Number(row.dataset.delivery), {sell:sell.checked, enteredPrice:sell.checked?entered.value:choices.get(Number(row.dataset.delivery))?.enteredPrice}];
    })
  };
})();
