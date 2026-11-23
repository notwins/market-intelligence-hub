/* Compare a funded note with a whole-share purchase made on the same trade date. */
(function (root) {
  'use strict';
  const cents = n => Math.round((n + Number.EPSILON * Math.abs(n)) * 100);

  function buyAndHold(payment, startSpot, valuationSpot) {
    const paid = cents(payment), start = cents(startSpot), mark = cents(valuationSpot);
    if (![paid, start, mark].every(Number.isSafeInteger) || paid < 0 || start <= 0 || mark < 0) {
      throw RangeError('Enter a valid payment, positive purchase price and non-negative valuation price.');
    }
    const shares = Math.floor(paid / start);
    const cashCents = paid - shares * start;
    const valueCents = shares * mark + cashCents;
    if (!Number.isSafeInteger(valueCents)) throw RangeError('Reduce the budget or valuation price to keep dollar amounts accurate to the cent.');
    return {shares, remainingCash:cashCents / 100, value:valueCents / 100, pnl:(valueCents - paid) / 100};
  }

  const benchmark = Object.freeze({buyAndHold});
  root.AccumulatorBenchmark = benchmark;
  if (typeof module === 'object' && module.exports) module.exports = benchmark;
})(globalThis);
