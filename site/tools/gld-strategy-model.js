/* Daily close scenarios for cash-funded GLD accumulators and covered decumulators. */
(function (root) {
  'use strict';

  function integer(value, label, minimum = 0) {
    if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Check ' + label + '.');
    return value;
  }

  function cents(value, label) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Check ' + label + '.');
    return integer(Math.round((value + Number.EPSILON * Math.abs(value)) * 100), label);
  }

  function terms(input, sale) {
    if (!input) throw new RangeError('Enter the ' + (sale ? 'decumulator' : 'accumulator') + ' terms.');
    const strike = cents(input.strike, 'the strike percentage');
    const ko = cents(input.ko, 'the knock-out percentage');
    if (sale ? strike < 10000 || ko <= 0 || ko >= 10000 : strike <= 0 || strike > 10000 || ko <= 10000) {
      throw new RangeError(sale ? 'A covered sale needs a strike of at least 100% and a lower knock-out below 100%.' :
        'An accumulator needs a positive strike up to 100% and an upper knock-out above 100%.');
    }
    const days = integer(input.days, 'the number of observations', 1);
    const guaranteeDays = integer(input.guaranteeDays ?? 0, 'the number of guaranteed observations');
    if (guaranteeDays > days) throw new RangeError('The guarantee exceeds the tenor.');
    const dailyShares = integer(input.dailyShares ?? 0, 'the daily share lot');
    const gear = sale ? input.gear ?? 1 : 1;
    if (gear !== 1 && gear !== 2) throw new RangeError('Choose a covered sale with 1× or 2× gearing.');
    const coverage = sale ? cents(input.coveragePct ?? 100, 'the percentage of shares available for sale') : 10000;
    if (coverage > 10000) throw new RangeError('The percentage of GLD available for sale cannot exceed 100%.');
    const trigger = sale ? cents(input.minEntryPrice ?? 0, 'the minimum GLD price for covered sale entry') : 0;
    return {strike, ko, days, guaranteeDays, dailyShares, gear, coverage, trigger};
  }

  function level(reference, percent) {
    return Math.round(integer(reference * percent, 'the price and percentage combination') / 10000);
  }

  function simulate(key, plan, closes) {
    let cash = plan.cash;
    let shares = plan.shares;
    let active = null;
    let pending = null;
    let rolls = 0;
    let peak = plan.initial;
    let lowest = peak;
    let valueCents = peak;
    let maxDrawdownPct = 0;
    const events = [];
    const series = [];

    function record(day, type, leg, message, fields = {}) {
      events.push({day, type, leg, message, cash: cash / 100, shares, price: closes[day] / 100, ...fields});
    }

    function openLeg(day, leg) {
      const sale = leg === 'decu';
      const q = plan[leg];
      const strike = level(closes[day], q.strike);
      const ko = level(closes[day], q.ko);
      if (strike < 1 || ko < 1) {
        record(day, 'skip', leg, 'The entry price is too low to quote a strike and knock-out in cents.');
        return;
      }
      // The existing GLD calculator rounds the funded payment up to a whole dollar.
      const unitCost = integer(strike * q.days, 'the maximum purchase cost', 1);
      const cover = sale ? Math.floor(integer(shares * q.coverage, 'the covered share allocation') / 10000) : 0;
      const maxLot = sale ? Math.floor(cover / integer(q.days * q.gear, 'the maximum daily delivery', 1)) :
        Math.floor((Math.floor((cash - plan.reserve) / 100) * 100) / unitCost);
      const lot = q.dailyShares || maxLot;
      const fields = {strike: strike / 100, ko: ko / 100, lot, maxLot, days: q.days, guaranteeDays: q.guaranteeDays, gear: q.gear};
      if (!lot || lot > maxLot) {
        const resource = sale ? 'covered GLD shares' : 'available cash';
        const message = lot ? 'Requested ' + lot + ' shares per day exceeds the maximum of ' + maxLot + ' from ' + resource + '.' :
          'Insufficient ' + resource + ' for one whole share per day over the full term.';
        record(day, 'skip', leg, message, fields);
        return;
      }
      const quantity = integer(lot * q.days * q.gear, 'the maximum contracted share quantity');
      const cost = sale ? 0 : integer(quantity * strike, 'the total purchase cost');
      const payment = Math.ceil(cost / 100) * 100;
      active = {leg, q, start: day, lot, strike, ko, payment, traded: 0};
      if (leg === 'roll') rolls++;
      const message = sale ? 'Opened covered decumulator against available GLD.' :
        leg === 'roll' ? 'Opened a new funded accumulator at this reference close.' : 'Opened funded accumulator.';
      record(day, 'open', leg, message, {...fields, quantity, payment: payment / 100, maxPurchaseCost: cost / 100});
    }

    function observe(day) {
      const {q, leg, start, lot, strike, ko} = active;
      const sale = leg === 'decu';
      const elapsed = day - start;
      const close = closes[day];
      const hit = sale ? close <= ko : close >= ko;
      // No ordinary allocation on the KO observation. Remaining guaranteed
      // observations receive the base lot, including the KO observation itself.
      const quantity = hit ? lot * Math.max(0, q.guaranteeDays - elapsed + 1) :
        lot * (sale && close > strike ? q.gear : 1);
      const traded = integer(quantity * strike, 'the daily settlement amount');
      shares = integer(shares + (sale ? -quantity : quantity), 'the resulting GLD holding');
      cash = integer(cash + (sale ? traded : -traded), 'the resulting cash balance');
      active.traded += quantity;
      if (!hit && elapsed < q.days) return;

      const refund = sale ? 0 : active.payment - active.traded * strike;
      let message = hit ? (sale ? 'Lower knock-out reached.' : 'Upper knock-out reached.') : 'Reached scheduled maturity.';
      if (hit && quantity) message += ' The guarantee adds ' + quantity + (sale ? ' shares for sale.' : ' shares for purchase.');
      record(day, hit ? 'ko' : 'maturity', leg, message, {
        strike: strike / 100, ko: ko / 100, lot, quantity: active.traded, guaranteeTopUp: hit ? quantity : 0, refund: refund / 100
      });
      active = null;
      if (key === 'decu' && !sale) pending = {leg: 'decu', earliestDay: day + plan.wait, waitingRecorded: false};
      if (key === 'roll' && hit && rolls < plan.maxRolls) pending = {leg: 'roll', earliestDay: day + plan.wait, waitingRecorded: false};
    }

    function maybeOpen(day) {
      if (!pending || day < pending.earliestDay) return;
      if (pending.leg === 'decu' && closes[day] < plan.decu.trigger) {
        if (!pending.waitingRecorded) {
          record(day, 'wait', 'decu', 'Waiting for GLD to reach the minimum covered-sale entry price.',
            {minEntryPrice: plan.decu.trigger / 100});
          pending.waitingRecorded = true;
        }
        return;
      }
      const leg = pending.leg;
      pending = null;
      openLeg(day, leg);
    }

    if (key === 'hold') {
      const bought = Math.floor((cash - plan.reserve) / closes[0]);
      shares = integer(shares + bought, 'the outright GLD holding');
      cash -= bought * closes[0];
      record(0, 'open', 'hold', 'Bought whole GLD shares at the starting close.', {quantity: bought});
    } else if (plan.startAfterKo) {
      record(0, 'ko', 'acc', 'Starting at the recorded knock-out with the entered cash and shares.');
      if (key === 'decu' || (key === 'roll' && plan.maxRolls)) {
        pending = {leg: key, earliestDay: plan.wait, waitingRecorded: false};
      }
    } else {
      openLeg(0, 'acc');
    }
    for (let day = 0; day < closes.length; day++) {
      if (active && day > active.start) observe(day);
      maybeOpen(day);
      // Free and earmarked cash both belong to the account. A KO refund releases
      // earmarked cash already in this balance, so it must never be added again.
      valueCents = integer(cash + shares * closes[day], 'the marked portfolio value');
      peak = Math.max(peak, valueCents);
      lowest = Math.min(lowest, valueCents);
      maxDrawdownPct = Math.max(maxDrawdownPct, 100 * (peak - valueCents) / peak);
      series.push(valueCents / 100);
    }
    let open = null;
    let reservedCents = 0;
    let reservedShares = 0;
    if (active) {
      const {leg, q, start, lot, payment, traded, strike, ko} = active;
      const remainingDays = q.days - (closes.length - 1 - start);
      const maxRemainingShares = lot * remainingDays * q.gear;
      if (leg === 'decu') reservedShares = maxRemainingShares;
      else reservedCents = payment - traded * strike;
      open = {leg, remainingDays, maxRemainingShares, committedCash: reservedCents / 100,
        strike: strike / 100, ko: ko / 100, lot, startDay: start};
    }
    const value = valueCents / 100;
    const pnlCents = valueCents - plan.initial;
    return {key, cash: cash / 100, freeCash: (cash - reservedCents) / 100,
      deployableCash: (cash - reservedCents - plan.reserve) / 100, shares, reservedShares, value,
      pnl: pnlCents / 100, returnPct: 100 * pnlCents / plan.initial, minValue: lowest / 100, maxDrawdownPct,
      series, events, open, pending: pending && {leg: pending.leg, earliestDay: pending.earliestDay,
        minEntryPrice: pending.leg === 'decu' ? plan.decu.trigger / 100 : 0}, rolls};
  }

  function run(config, prices) {
    if (!Array.isArray(prices) || prices.length < 2) throw new RangeError('Enter a starting GLD price and at least one future close.');
    const closes = Array.from(prices, price => cents(price, 'daily GLD prices'));
    if (!closes[0]) throw new RangeError('The starting GLD price must be at least one cent.');
    const cash = cents(config.budget, 'the starting cash budget');
    const reserve = cents(config.reserve ?? 0, 'the minimum cash reserve');
    if (reserve > cash) throw new RangeError('The cash reserve exceeds starting cash.');
    const shares = integer(config.openingShares ?? 0, 'the opening whole-share GLD holding');
    const initial = integer(cash + shares * closes[0], 'the starting portfolio value', 1);
    const plan = {cash, reserve, shares, initial, startAfterKo: config.startAfterKo === true,
      acc: terms(config.acc, false), roll: terms(config.roll ?? config.acc, false),
      decu: terms(config.decu, true), wait: integer(config.waitDays ?? 1, 'the waiting period', 1),
      maxRolls: integer(config.maxRolls ?? 3, 'the permitted number of rollovers')};
    return {initialWealth: initial / 100, strategies: ['hold', 'acc', 'decu', 'roll'].map(key => simulate(key, plan, closes))};
  }

  const api = Object.freeze({run});
  root.GldStrategy = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
