/* Compare each quoted GLD accumulator and its follow-on choices on an identical path. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./gld-strategy-model.js'), require('./accumulator-model.js'));
  } else root.GldPlays = factory(root.GldStrategy, root.AccumulatorModel);
})(globalThis, function (model, accumulator) {
  'use strict';
  const keys = ['hold', 'acc', 'roll', 'decu', 'wait', 'staged'];
  const cents = value => Math.round((value + Math.abs(value) * Number.EPSILON) * 100);

  function fraction(amount, basisPoints) {
    return Math.floor(amount / 10000) * basisPoints + Math.floor((amount % 10000) * basisPoints / 10000);
  }

  function percentage(value, name) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Check ' + name + ' (0–100%).');
    return cents(value);
  }

  function quoteTerms(row) {
    if (!Number.isFinite(row?.strike) || row.strike <= 0) throw new RangeError('Choose a row with a quoted strike.');
    const guaranteeDays = row.guaranteeDays ?? accumulator.observationSchedule({
      days: row.days, months: row.months, minimum: row.guarantee, knownMonthEnds: row.knownMonthEnds
    }).guaranteeDay;
    return {days: row.days, strike: row.strike, ko: row.ko, guaranteeDays};
  }

  function latestState(strategy, day) {
    return strategy.states.findLast(state => state.day <= day);
  }

  function rank(strategies) {
    const available = strategies.filter(row => row.eligible && Number.isFinite(row.value));
    if (!available.length) return [];
    const best = Math.max(...available.map(row => cents(row.value)));
    return available.filter(row => cents(row.value) === best).map(row => row.key);
  }

  function entryConstraint(key, cfg, cash, shares) {
    if (key === 'roll') {
      if (!(cfg.maxRolls ?? 3)) return 'Rollovers are disabled.';
      if (cents(cash) - cents(cfg.reserve ?? 0) < 100) return 'No deployable funding above the cash floor.';
    }
    if (key === 'decu') {
      const q = cfg.decu;
      const covered = fraction(shares, percentage(q.coveragePct ?? 100, 'covered share allocation'));
      if (covered < q.days * (q.gear ?? 1) * (q.dailyShares || 1)) {
        return 'Insufficient GLD for a fully covered daily sale.';
      }
    }
    return '';
  }

  function describeEngine(strategy, cfg, start, post) {
    const states = [];
    let performed = false;
    const key = strategy.key;
    const constraint = post ? entryConstraint(key, cfg, cfg.budget, cfg.openingShares) : '';
    let eligible = !constraint;
    let status = constraint || 'Waiting for the next eligible fixing.';
    states.push({day: start, eligible, status});
    const events = strategy.events.map(e => ({...e, day: start + e.day}));
    for (const e of events) {
      if (post && e.day === start && e.type === 'ko') continue;
      if (!eligible && e.type === 'wait') continue;
      if (e.type === 'open') {
        performed ||= e.leg === key;
        status = e.leg === 'acc' ? 'First accumulator is open.' : e.message;
      } else if (e.type === 'skip') {
        if (!performed) eligible = false;
        status = e.message;
      } else if (e.type === 'wait') {
        status = e.message;
      } else {
        status = e.message;
        if (e.leg === 'acc' && (key === 'decu' || (key === 'roll' && e.type === 'ko'))) {
          const blocked = entryConstraint(key, cfg, e.cash, e.shares);
          eligible = !blocked;
          status += ' ' + (blocked || (key === 'decu' ? 'Waiting for covered-sale entry.' : 'Waiting for the next rollover entry.'));
        }
        if (e.leg === 'acc' && key === 'roll' && e.type === 'maturity') status += ' No rollover on ordinary maturity.';
      }
      states.push({day: e.day, eligible, status});
    }
    const open = strategy.open && {...strategy.open, startDay: start + strategy.open.startDay};
    const pending = strategy.pending && {...strategy.pending, earliestDay: start + strategy.pending.earliestDay};
    return {...strategy, events, open, pending, states, eligible, status};
  }

  function cashPlay(key, cfg, prices, start, post) {
    const closes = prices.map(cents);
    let cash = cents(cfg.budget), shares = cfg.openingShares ?? 0;
    const floor = cents(cfg.reserve ?? 0);
    const initial = cash + shares * closes[0];
    const firstDay = post ? cfg.waitDays ?? 1 : 0;
    const firstBps = percentage(cfg.firstBuyPct ?? 50, 'the initial tranche');
    const dipBps = percentage(cfg.dipPct ?? 10, 'the dip');
    const dipLevel = Math.round(closes[0] * (10000 - dipBps) / 10000);
    const passive = key === 'acc' || (!post && key === 'wait');
    let eligible = passive || cash > floor;
    let status = passive ? 'Keeping starting cash and GLD shares.' :
      eligible ? 'Waiting for eligible entry.' : 'No deployable cash above the reserve.';
    const events = [], states = [], series = [];
    let pendingFill = -1;
    let dipped = false;
    let peak = initial, min = initial, drawdown = 0;
    let lastValue = initial;

    function event(day, type, message, extra = {}) {
      status = message;
      states.push({day: start + day, eligible, status});
      events.push({day: start + day, type, leg: key, message, price: closes[day] / 100, cash: cash / 100, shares, ...extra});
    }
    function buy(day, amount, keepDipOrder) {
      const price = closes[day];
      const quantity = price ? Math.floor(amount / price) : 0;
      if (!quantity) {
        if (!keepDipOrder && !events.some(e => e.type === 'buy')) eligible = false;
        event(day, 'skip', !price ? 'Zero share price. No market purchase.' :
          'The available tranche cannot buy a whole GLD share.');
        return;
      }
      cash -= quantity * price;
      shares += quantity;
      event(day, 'buy', 'Bought ' + quantity + ' whole GLD shares at the observed close.', {quantity, cost: quantity * price / 100});
    }
    event(0, passive ? 'hold' : eligible ? 'wait' : 'skip', status);
    for (let day = 0; day < closes.length; day++) {
      const dipRule = key === 'staged' || (post && key === 'wait');
      if (!passive && eligible && day === firstDay && (key === 'hold' || (key === 'staged' && firstBps))) {
        const part = key === 'hold' ? 10000 : firstBps;
        buy(day, fraction(cash - floor, part), part < 10000);
      }
      if (pendingFill === day) {
        buy(day, cash - floor, false);
        pendingFill = -1;
      }
      if (dipRule && eligible && day >= firstDay && !dipped && cash > floor && (key === 'wait' || firstBps < 10000)) {
        if (closes[day] <= dipLevel) {
          dipped = true;
          pendingFill = day + 1;
          event(day, 'signal', 'Dip trigger observed. The purchase is scheduled for the next close.', {trigger: dipLevel / 100});
        } else if (day === firstDay) {
          event(day, 'wait', 'Waiting for a close at or below the dip level.', {trigger: dipLevel / 100});
        }
      }
      lastValue = cash + shares * closes[day];
      if (!Number.isSafeInteger(lastValue)) throw new RangeError('Reduce the portfolio size or path prices.');
      series.push(lastValue / 100);
      min = Math.min(min, lastValue);
      peak = Math.max(peak, lastValue);
      if (peak) drawdown = Math.max(drawdown, 100 * (peak - lastValue) / peak);
    }
    return {key, cash: cash / 100, shares, freeCash: cash / 100, deployableCash: (cash - floor) / 100,
      value: lastValue / 100, pnl: (lastValue - initial) / 100, returnPct: initial ? 100 * (lastValue - initial) / initial : 0,
      minValue: min / 100, maxDrawdownPct: drawdown, reservedShares: 0, rolls: 0, open: null,
      pending: pendingFill >= 0 ? {leg: key, earliestDay: start + pendingFill} : null, events, states, series, eligible, status};
  }

  function atDay(run, day, post = false) {
    const view = post ? run.postKo : run;
    const start = post ? view?.day : 0;
    if (!view || !Number.isInteger(day) || day < start || day - start >= view.strategies[0].series.length) {
      return {leaders: [], outcomes: {}};
    }
    const rows = view.strategies.map(strategy => {
      const {eligible, status} = latestState(strategy, day);
      const value = strategy.series[day - start];
      return {key: strategy.key, eligible, status, value, pnl: (cents(value) - cents(view.initialWealth)) / 100};
    });
    const leaders = post && day === start ? [] : rank(rows);
    return {leaders, outcomes: Object.fromEntries(rows.map(row => [row.key, row]))};
  }

  function postDecision(cfg, prices, exit) {
    const tail = prices.slice(exit.day);
    const cash = exit.cash, shares = exit.shares, price = exit.price;
    const initialWealth = (cents(cash) + shares * cents(price)) / 100;
    const postCfg = {...cfg, startAfterKo: true, budget: cash, openingShares: shares};
    const canRun = initialWealth > 0 && cents(price) > 0 && tail.length >= 2;
    const native = canRun ? model.run(postCfg, tail).strategies : [];
    const strategies = keys.map(key => {
      if (key !== 'roll' && key !== 'decu') return cashPlay(key, postCfg, tail, exit.day, true);
      const strategy = native.find(s => s.key === key);
      if (strategy) return describeEngine(strategy, postCfg, exit.day, true);
      const held = cashPlay('acc', postCfg, tail, exit.day, true);
      const status = tail.length === 1 ? 'The horizon ends on the knock-out fixing.' : 'No funded or covered entry is possible.';
      return {...held, key, eligible: false, status, events: [], states: [{day: exit.day, eligible: false, status}]};
    });
    const view = {day: exit.day, price, cash, shares, initialWealth, remainingDays: tail.length - 1, strategies};
    view.leaders = atDay({postKo: view}, exit.day + view.remainingDays, true).leaders;
    return view;
  }

  function runQuote(config, quote, prices) {
    const quoted = quoteTerms(quote);
    const cfg = {...config, startAfterKo: false, acc: {...config.acc, ...quoted}, roll: config.roll ?? quoted};
    const first = model.run(cfg, prices);
    const strategies = keys.map(key => {
      if (key === 'staged' || key === 'wait') return cashPlay(key, cfg, prices, 0, false);
      const native = first.strategies.find(s => s.key === key);
      if (key === 'hold' && !native.events[0].quantity) return cashPlay(key, cfg, prices, 0, false);
      return describeEngine(native, cfg, 0, false);
    });
    const firstExit = first.strategies.find(s => s.key === 'acc').events.find(e => e.type === 'ko' || e.type === 'maturity') ?? null;
    return {initialWealth: first.initialWealth, strategies, leaders: rank(strategies), firstExit,
      postKo: firstExit?.type === 'ko' ? postDecision(cfg, prices, firstExit) : null};
  }

  return Object.freeze({runQuote, atDay, rank, quoteTerms});
});
