// Workings for the monthly ledger use the same simulation snapshot as its displayed row.
(() => {
  'use strict';

  const names = {
    mark:'NVDA valuation price', cumulative:'Total shares bought', pnl:'Profit or loss on payment',
    price: 'Month-end NVDA price',
    bought: 'Shares bought this month',
    cost: 'Capital used this month',
    refund: 'Cash refunded this month',
    sharesSold: 'Shares sold this month',
    sold: 'Cash received from share sales this month',
    remaining: 'Capital remaining in the note',
    held: 'Shares held at month-end',
    refunded: 'Cash refunded to date',
    value: 'Total value at month-end'
  };
  const columns = [null, 'price', null, 'bought', 'cost', 'refund', 'sharesSold', 'sold', 'remaining', 'held', 'refunded', 'value', 'cumulative', 'pnl'];
  const states = new WeakMap();

  function workings(state, month, field) {
    const {simulation: sim, quote, spot, target, ledger} = state;
    const {price: usd, shares: units, quote: percentage} = window.AccumulatorFormat;
    const row = sim.rows[month - 1];
    const flow = ledger?.[month - 1];
    const previous = sim.rows[month - 2];
    const openingShares = previous?.shares || 0;
    const openingRefund = previous?.refunded || 0;
    const exit = sim.exit;
    const atExit = month === exit.month;
    const afterExit = month > exit.month;
    const atKO = atExit && Boolean(sim.koDay);
    const saleDay = sim.koDay ? 'knock-out on day ' + exit.day : 'maturity on day ' + exit.day;
    const lastDay = previous?.day || 0;
    const sessions = row.day - lastDay;
    const unitCost = usd(sim.strike);
    let steps;

    switch (field) {
      case 'mark':
        if (atExit) {
          steps=['The assumed sale at '+saleDay+' uses the simulated close of '+usd(exit.price)+'.'];
          break;
        }
        return workings(state,month,'price');
      case 'cumulative':
        steps=[units(openingShares)+' shares purchased before this month + '+units(row.bought)+' purchased this month = '+units(row.shares)+' total shares bought.'];
        break;
      case 'pnl': {
        steps=[...workings(state,month,'value').steps,usd(flow.valueCents/100)+' total value − '+usd(sim.payment)+' actual payment = '+usd(flow.pnlCents/100)+' profit or loss.'];
        break;
      }
      case 'price':
        steps = [
          'Month ' + month + ' ends on simulated trading day ' + row.day + '.',
          'The NVDA closing price for that day on the selected path is ' + usd(row.price) + ' per share.'
        ];
        if (atKO && sim.koDay !== row.day) {
          steps.push('The note ended earlier in the month on day ' + sim.koDay + '. The model sells at that day’s close of ' + usd(exit.price) + '.');
        } else if (afterExit) {
          steps.push('The note already ended at ' + saleDay + '. This later NVDA price does not change the cash held.');
        }
        break;
      case 'bought':
        if (afterExit) {
          steps = ['Purchases ended at ' + saleDay + '.', 'This month adds 0 shares.'];
          break;
        }
        steps = [
          'Strike is ' + percentage(quote.strike) + ' of ' + usd(spot) + ', rounded to ' + unitCost + ' per share.',
          'Monthly shares = ' + usd(target) + ' target ÷ (' + unitCost + ' × ' + quote.months + ' months), rounded to the nearest whole share = ' + units(sim.maximum) + '.'
        ];
        if (atKO) {
          const eligibleDays = sim.koAfterMonthEnd ? sessions : sim.koDay - lastDay - 1;
          const accrued = row.bought - row.extra;
          const guaranteedMonths = sim.koAfterMonthEnd && month === 3 ? Math.min(3, quote.minimum) : quote.minimum;
          steps.push('Before the KO close, ' + eligibleDays + ' of ' + sessions + ' trading days earned shares. Round down (' + units(sim.maximum) + ' × ' + eligibleDays + ' ÷ ' + sessions + ') = ' + units(accrued) + ' shares.');
          steps.push('Guaranteed quantity = ' + guaranteedMonths + ' months × ' + units(sim.maximum) + ' shares = ' + units(guaranteedMonths * sim.maximum) + '. Before the top-up, ' + units(openingShares + accrued) + ' shares had been earned across all months. The remaining guarantee adds ' + units(row.extra) + ' shares.');
          steps.push('This month’s purchases = ' + units(accrued) + ' accrued + ' + units(row.extra) + ' guaranteed top-up = ' + units(row.bought) + ' shares.');
        } else {
          steps.push('All ' + sessions + ' trading days in month ' + month + ' completed without a knock-out. The full ' + units(row.bought) + ' shares were purchased.');
        }
        break;
      case 'cost':
        steps = [
          'This month bought ' + units(row.bought) + ' shares at the fixed strike of ' + unitCost + '.',
          'Capital used = ' + units(row.bought) + ' × ' + unitCost + ' = ' + usd(row.cost) + '.'
        ];
        break;
      case 'refund':
        if (atExit) {
          steps = [
            'The note ended at ' + saleDay + '. Total funding was ' + usd(sim.payment) + '.',
            'Total cost of all ' + units(row.shares) + ' shares bought at ' + unitCost + ' = ' + usd(row.spent) + '.',
            'New refund = payment ' + usd(sim.payment) + ' − total share cost ' + usd(row.spent) + ' − prior refunds ' + usd(openingRefund) + ' = ' + usd(row.refund) + '.'
          ];
        } else {
          steps = [afterExit ? 'The note ended at ' + saleDay + ' and had already returned ' + usd(exit.refunded) + '.' : 'The note is still active. Unspent cash stays committed until knock-out or maturity.', 'New refund this month = ' + usd(row.refund) + '.'];
        }
        break;
      case 'sharesSold':
      case 'sold': {
        const {sharesSold, salePriceCents, cashReceivedCents} = flow;
        if (!sharesSold) {
          steps = ['No shares are sold this month. Cash received from sales is ' + usd(0) + '.'];
          break;
        }
        steps = [
          atExit ? 'The remaining shares sell at ' + saleDay + '.'
            : 'The model sells this month’s delivery at your selected price.',
          units(sharesSold) + ' shares sold × ' + usd(salePriceCents/100) + ' per share = ' + usd(cashReceivedCents/100) + ' received this month.'
        ];
        break;
      }
      case 'remaining':
        steps = [
          'Start with actual payment of ' + usd(sim.payment) + '.',
          'Cumulative capital spent = ' + units(row.shares) + ' shares bought × ' + unitCost + ' = ' + usd(row.spent) + '.',
          'Capital left in the note = ' + usd(sim.payment) + ' − ' + usd(row.spent) + ' spent − ' + usd(row.refunded) + ' already refunded = ' + usd(row.remaining) + '.'
        ];
        break;
      case 'held': {
        const {openingShares: opening, sharesSold, sharesHeld} = flow;
        steps = [
          'Shares held at the start of the month = ' + units(opening) + '.',
          'Ending shares = ' + units(opening) + ' opening + ' + units(row.bought) + ' bought − ' + units(sharesSold) + ' sold = ' + units(sharesHeld) + '.'
        ];
        break;
      }
      case 'refunded':
        steps = [
          'Refunds before this month = ' + usd(openingRefund) + '.',
          'Refunds to date = ' + usd(openingRefund) + ' already received + ' + usd(row.refund) + ' this month = ' + usd(row.refunded) + '.',
          'Refunds return unused subscription cash. They count once in total value.'
        ];
        break;
      case 'value': {
        const {sharesHeld, holdingsCents, cashReceivedToDate, valueCents} = flow;
        steps = [
          atExit ? 'All shares have been sold by the modelled exit.'
            : units(sharesHeld) + ' shares held × ' + usd(row.price) + ' month-end price = ' + usd(holdingsCents/100) + ' in shares.',
          usd(holdingsCents/100) + ' in shares + ' + usd(cashReceivedToDate/100) + ' sale proceeds to date + ' +
            usd(row.refunded) + ' refunds to date + ' + usd(row.remaining) + ' still in the note = ' + usd(valueCents/100) + ' total value.'
        ];
        break;
      }
      default:
        return null;
    }
    return {title: names[field], context: quote.product + ' · ' + percentage(quote.strike) + ' strike · Month ' + month + ' · USD', steps};
  }

  function handleClick(event) {
    const button = event.target.closest('button[data-ledger-figure]');
    if (!button) return;
    const state = states.get(event.currentTarget);
    const details = workings(state, Number(button.closest('tr').dataset.row), button.dataset.ledgerFigure);
    if (details) window.AccumulatorCalculationDialog.open({...details, opener: button});
  }

  function bind(body, state, fields=columns) {
    if (!states.has(body)) body.addEventListener('click', handleClick);
    states.set(body, state);
    for (const row of body.rows) {
      fields.forEach((field, i) => {
        if (!field) return;
        const cell = row.cells[i];
        const value = cell.textContent;
        if (value === '—') return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ledger-figure';
        button.dataset.ledgerFigure = field;
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-label', 'Month ' + row.dataset.row + ', ' + names[field] + ', ' + value + '. Show calculation');
        button.textContent = value;
        cell.replaceChildren(button);
      });
    }
  }

  window.AccumulatorLedgerWorkings = {bind};
})();
