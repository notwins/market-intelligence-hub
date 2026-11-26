// Funded Normal accumulator. All capital and purchase calculations use integer cents.
(function (root) {
  'use strict';

  const sampleTradingDays = {3: 61, 6: 124, 9: 186, 12: 251};

  function numberInCents(amount) {
    return Math.round((amount + Number.EPSILON * Math.abs(amount)) * 100);
  }

  function observationSchedule(quote) {
    const {months, minimum} = quote;
    const days = quote.days ?? sampleTradingDays[months];
    if (!Number.isInteger(months) || months < 1 ||
        !Number.isInteger(minimum) || minimum < 0 || minimum > months ||
        !Number.isInteger(days) || days < months) {
      throw Error('Check the tenor, number of trading days and guaranteed period.');
    }

    const monthEnds = Array.from({length: months}, (_, i) => Math.round(days * (i + 1) / months));
    const quotedEnds = quote.knownMonthEnds ?? (quote.product === 'OCBC SI' && months === 9 && days === 186 ? [21, 41, 61] : []);
    // Retain known observation dates. Estimate only dates omitted from the quote.
    quotedEnds.forEach((end, index) => { monthEnds[index] = end; });
    return {days, monthEnds, guaranteeDay: minimum ? monthEnds[minimum - 1] : 0};
  }

  function terms(quote, spot, target) {
    if (quote.multiple !== undefined && quote.multiple !== 1) {
      throw Error('Select a Normal accumulator.');
    }
    if (![spot, target, quote.strike, quote.ko].every(x => Number.isFinite(x) && x > 0)) {
      throw Error('Enter a positive target capital, trade-day price, strike and knock-out.');
    }
    const schedule = observationSchedule(quote);
    const spotCents = numberInCents(spot);
    // Use the source quote precision even when the percentage label is rounded.
    const strikeCents = Math.round(spotCents * numberInCents(quote.strike) / 10000);
    const koCents = Math.round(spotCents * numberInCents(quote.ko) / 10000);
    if (strikeCents < 1 || koCents < 1) throw Error('Strike and knock-out prices must be at least one cent.');
    const daily = quote.sizing === 'daily';
    const lotCents = strikeCents * (daily ? schedule.days : quote.months);
    const nearest = Math.round(numberInCents(target) / lotCents);
    const shares = daily ? (quote.dailyShares ?? Math.max(1, nearest)) : nearest;
    if (!Number.isSafeInteger(shares) || shares < 1) {
      throw Error(daily ? 'Enter at least one whole share per trading day.' :
        'Increase target capital to size at least one whole share per month.');
    }
    const committedCents = shares * lotCents;
    if (!Number.isSafeInteger(committedCents) || committedCents > Number.MAX_SAFE_INTEGER - 100) {
      throw Error('Enter a smaller target capital.');
    }
    const payment = Math.ceil(committedCents / 100);
    return {
      ...schedule, strike: strikeCents / 100, ko: koCents / 100,
      base: shares, maximum: shares, committed: committedCents / 100,
      ...(daily && {dailyShares: shares}),
      payment, roundingCash: (payment * 100 - committedCents) / 100
    };
  }

  function validPrice(price) { return Number.isFinite(price) && price >= 0; }

  function monthlyPath(quote, spot, prices) {
    const {monthEnds} = observationSchedule(quote);
    if (!validPrice(spot) || spot === 0 || !Array.isArray(prices) ||
        prices.length !== quote.months || !prices.every(validPrice)) {
      throw Error('Enter a valid closing price for each of the ' + quote.months + ' months.');
    }
    const daily = [];
    let startDay = 0;
    let startPrice = spot;
    prices.forEach((close, monthIndex) => {
      const endDay = monthEnds[monthIndex];
      for (let day = startDay + 1; day <= endDay; day++) {
        const fraction = (day - startDay) / (endDay - startDay);
        const price = day === endDay ? close : startPrice + (close - startPrice) * fraction;
        daily.push(numberInCents(price) / 100);
      }
      startDay = endDay;
      startPrice = close;
    });
    return daily;
  }

  function simulateDaily(quote, spot, target, dailyPrices, completeMonthAtKO) {
    const t = terms(quote, spot, target);
    if (!Array.isArray(dailyPrices) || dailyPrices.length < t.days ||
        !dailyPrices.slice(0, t.days).every(validPrice)) {
      throw Error('Enter a valid price for every modelled daily observation.');
    }
    const closeCents = dailyPrices.slice(0, t.days).map(numberInCents);
    const strikeCents = numberInCents(t.strike);
    const koCents = numberInCents(t.ko);
    const paymentCents = t.payment * 100;
    let shares = 0;
    let refundCents = 0;
    let koDay = 0;
    let koMonth = 0;
    let koAfterMonthEnd = false;
    let exit;
    const rows = [];

    function snapshot(day, month, priceCents, bought, extra, refund, status) {
      const spentCents = shares * strikeCents;
      const remainingCents = paymentCents - spentCents - refundCents;
      const shareValueCents = shares * priceCents;
      const valueCents = shareValueCents + refundCents + remainingCents;
      return {
        day, month, price: priceCents / 100, bought, extra, cost: bought * strikeCents / 100,
        refund: refund / 100, remaining: remainingCents / 100, shares,
        spent: spentCents / 100, refunded: refundCents / 100,
        shareValue: shareValueCents / 100, value: valueCents / 100,
        profit: (valueCents - paymentCents) / 100,
        rate: 100 * (valueCents - paymentCents) / paymentCents, status
      };
    }

    t.monthEnds.forEach((endDay, monthIndex) => {
      const month = monthIndex + 1;
      const priorDay = monthIndex ? t.monthEnds[monthIndex - 1] : 0;
      const openingShares = shares;
      const openingRefund = refundCents;
      let extra = 0;
      let status = koDay ? 'After knock-out' : 'Full share allocation';

      for (let day = priorDay + 1; day <= endDay && !koDay; day++) {
        const priceCents = closeCents[day - 1];
        if (priceCents >= koCents) {
          koDay = day;
          koMonth = month;
          // Only the fixed comparison checkpoints assume the month finishes before the KO.
          koAfterMonthEnd = month === completeMonthAtKO && day === endDay;
          if (koAfterMonthEnd) shares = t.dailyShares ? t.dailyShares * day : t.maximum * month;
          const guaranteedMonths = koAfterMonthEnd && month === 3 ? Math.min(3, quote.minimum) : quote.minimum;
          const guaranteedShares = t.dailyShares
            ? t.dailyShares * (t.monthEnds[guaranteedMonths - 1] ?? 0)
            : t.maximum * guaranteedMonths;
          extra = Math.max(0, guaranteedShares - shares);
          shares += extra;
          refundCents = paymentCents - shares * strikeCents;
          status = day <= t.guaranteeDay ? 'KO within guarantee' : 'Knock-out';
          exit = snapshot(day, month, priceCents, shares - openingShares, extra, refundCents - openingRefund, status);
        } else {
          const elapsed = day - priorDay;
          const sessions = endDay - priorDay;
          // Distribute each whole monthly lot cumulatively across observation days.
          // A completed month always earns exactly the quoted monthly quantity.
          const acquired = t.dailyShares ? t.dailyShares * elapsed : Math.floor(t.maximum * elapsed / sessions);
          shares = openingShares + acquired;
        }
      }

      if (!koDay && month === quote.months) {
        refundCents = paymentCents - shares * strikeCents;
        status = 'Maturity';
      }
      rows.push(snapshot(endDay, month, closeCents[endDay - 1], shares - openingShares, extra, refundCents - openingRefund, status));
    });
    const end = rows[rows.length - 1];
    return {...t, rows, end, exit: exit || end, koDay, koMonth, koAfterMonthEnd, profit: end.profit, rate: end.rate};
  }

  function simulate(quote, spot, target, prices) {
    return simulateDaily(quote, spot, target, monthlyPath(quote, spot, prices));
  }

  const api = {terms, observationSchedule, monthlyPath, simulateDaily, simulate};
  root.AccumulatorModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
