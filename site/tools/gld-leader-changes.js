/* Find changes in post-KO leaders and reconcile the accounts at a single fixing. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./gld-plays-model.js'));
  else root.GldLeaderChanges = factory(root.GldPlays);
})(globalThis, function (model) {
  'use strict';

  const cents = amount => Math.round((amount + Math.abs(amount) * Number.EPSILON) * 100);
  const sameSet = (a, b) => a.length === b.length && a.every(key => b.includes(key));
  const endOf = run => (run?.strategies?.[0]?.series?.length ?? 0) - 1;

  function next(run, fromDay) {
    const endDay = endOf(run);
    const absent = {anchorDay: null, endDay, day: null, before: [], leaders: []};
    if (!Number.isInteger(fromDay) || fromDay < 0 || fromDay > endDay) return {...absent, status: 'unavailable'};
    if (!run.postKo) {
      const first = run.strategies.find(s => s.key === 'acc')?.events[0];
      const status = first?.type === 'skip' ? 'unfunded' : run.firstExit?.type === 'maturity' ? 'maturity' : 'open';
      return {...absent, status};
    }
    const anchorDay = Math.max(fromDay, run.postKo.day);
    const anchor = model.atDay(run, anchorDay, true);
    // The KO close is unranked. For navigation only, compare against the
    // eligible actions that all inherit the same cash and GLD at that close.
    const before = anchorDay === run.postKo.day ?
      Object.values(anchor.outcomes).filter(row => row.eligible).map(row => row.key) : anchor.leaders;
    for (let day = anchorDay + 1; day <= endDay; day++) {
      const {leaders} = model.atDay(run, day, true);
      if (!sameSet(before, leaders)) return {status: 'change', anchorDay, endDay, day, before, leaders};
    }
    return {status: 'no-change', anchorDay, endDay, day: null, before, leaders: before};
  }

  // Signed A-minus-B differences. Both P&Ls start at the same KO wealth.
  function compare(evidence, leader, comparator) {
    const a = evidence?.policies?.[leader], b = evidence?.policies?.[comparator];
    if (!a || !b || leader === comparator || !a.eligible || !b.eligible) return null;
    const cash = cents(a.cash) - cents(b.cash);
    const shares = a.shares - b.shares;
    const markedShares = shares * cents(evidence.price);
    const comparison = {
      leader, comparator, cashDifference: cash / 100, shareDifference: shares,
      holdingDifference: markedShares / 100, gap: (cash + markedShares) / 100
    };
    if (a.daily && b.daily) {
      const marketMove = cents(a.daily.marketMove) - cents(b.daily.marketMove);
      const tradeEffect = cents(a.daily.tradeEffect) - cents(b.daily.tradeEffect);
      comparison.marketMoveDifference = marketMove / 100;
      comparison.tradeEffectDifference = tradeEffect / 100;
      comparison.gapMove = (marketMove + tradeEffect) / 100;
      comparison.previousGap = (cash + markedShares - marketMove - tradeEffect) / 100;
    }
    return comparison;
  }

  function explain({run, terms, quote, prices, day}) {
    const ko = run?.postKo, endDay = endOf(run);
    if (!ko || !Number.isInteger(day) || day < ko.day || day > endDay || !Array.isArray(prices) || day >= prices.length) return null;
    const {leaders, outcomes} = model.atDay(run, day, true);
    // The model stores daily marked wealth, but only the ending ledger has full
    // positions. Replaying the observed prefix returns today's actual ledger,
    // including ordinary accumulator/decu fixings between named events.
    const prefix = day === endDay ? ko : model.runQuote(terms, quote, prices.slice(0, day + 1)).postKo;
    if (!prefix) return null;
    const previous = day > ko.day + 1 ? model.runQuote(terms, quote, prices.slice(0, day)).postKo : null;
    const priceCents = cents(prices[day]), price = priceCents / 100;
    const policies = {};
    for (const strategy of prefix.strategies) {
      const state = outcomes[strategy.key];
      const {cash, shares, freeCash, reservedShares, events, open, pending} = strategy;
      const cashCents = cents(cash), marked = cashCents + shares * priceCents;
      if (marked !== cents(state.value)) throw Error('The fixing ledger does not match the selected quote and price path.');
      let daily = null;
      if (day > ko.day) {
        const prior = previous?.strategies.find(row => row.key === strategy.key) ?? ko;
        const priorClose = cents(prices[day - 1]);
        const cashMove = cashCents - cents(prior.cash), shareMove = shares - prior.shares;
        const marketMove = prior.shares * (priceCents - priorClose);
        // New shares are marked at today's close; cash records their actual purchase or sale.
        const tradeEffect = cashMove + shareMove * priceCents;
        daily = {previousShares: prior.shares, previousCash: prior.cash, previousPrice: priorClose / 100,
          cashChange: cashMove / 100, shareChange: shareMove, marketMove: marketMove / 100,
          tradeEffect: tradeEffect / 100, pnlChange: (marketMove + tradeEffect) / 100};
      }
      policies[strategy.key] = {
        ...state, cash, shares, freeCash, committedCash: (cashCents - cents(freeCash)) / 100, reservedShares,
        deltaCash: (cashCents - cents(ko.cash)) / 100, deltaShares: shares - ko.shares,
        events, latestEvent: events.at(-1) ?? null, open, pending, daily
      };
    }
    const other = Object.values(policies).filter(row => row.eligible && !leaders.includes(row.key));
    const runnerUps = leaders.length ? model.rank(other) : [];
    const evidence = {day, price, leaders, runnerUps, policies, koDay: ko.day, koCash: ko.cash, koShares: ko.shares};
    evidence.difference = compare(evidence, leaders[0], leaders[1] ?? runnerUps[0]);
    evidence.nextBestDifference = compare(evidence, leaders[0], runnerUps[0]);
    return evidence;
  }

  return Object.freeze({next, explain, compare});
});
