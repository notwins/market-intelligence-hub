(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const rows = byId('monthly-cash-rows');
  const all = byId('monthly-cash-all');
  const [spentBand, refundBand] = document.querySelector('.monthly-cash-bar').children;
  const {shares, price} = window.AccumulatorFormat;
  const selected = new Set();
  let currentQuote;
  let currentRows = [];

  function updateTotals() {
    let quantity = 0;
    let spent = 0;
    let refunded = 0;
    for (const row of currentRows) {
      if (!selected.has(row.month)) continue;
      quantity += row.bought;
      spent += Math.round(row.cost * 100);
      refunded += Math.round(row.refund * 100);
    }

    const total = spent + refunded;
    byId('monthly-cash-shares').textContent = shares(quantity);
    byId('monthly-cash-spent').textContent = price(spent / 100);
    byId('monthly-cash-refund').textContent = price(refunded / 100);
    spentBand.style.width = total ? (100 * spent / total) + '%' : '0%';
    refundBand.style.width = total ? (100 * refunded / total) + '%' : '0%';
    all.checked = selected.size === currentRows.length;
    all.indeterminate = selected.size > 0 && !all.checked;
  }

  function render(simulation, quoteId) {
    currentRows = simulation.rows;
    if (quoteId !== currentQuote) {
      currentQuote = quoteId;
      selected.clear();
      for (const row of currentRows) selected.add(row.month);
    }

    rows.innerHTML = currentRows.map(row => {
      const exit = row.month === simulation.exit.month;
      const afterKo = row.month > simulation.exit.month;
      const event = exit ? (simulation.koDay ? ' · KO' : ' · End') : '';
      return `<tr${exit ? ' data-exit' : afterKo ? ' data-post-ko' : ''}>
        <td><label><input type="checkbox" data-cash-month="${row.month}" aria-label="Include month ${row.month}${event}" ${selected.has(row.month) ? 'checked' : ''}>M${row.month}${event}</label></td>
        <td>${shares(row.bought)}</td><td>${price(row.cost)}</td><td>${price(row.refund)}</td>
      </tr>`;
    }).join('');
    byId('monthly-cash-payment').textContent = price(simulation.payment);
    updateTotals();
  }

  rows.addEventListener('change', event => {
    const input = event.target;
    const month = Number(input.dataset.cashMonth);
    if (input.checked) selected.add(month);
    else selected.delete(month);
    updateTotals();
  });

  all.addEventListener('change', () => {
    selected.clear();
    for (const input of rows.querySelectorAll('input')) {
      input.checked = all.checked;
      if (input.checked) selected.add(Number(input.dataset.cashMonth));
    }
    updateTotals();
  });

  window.AccumulatorMonthlyCash = {render};
})();
