// Only presentation is rounded here. Valuation and ranking use the model's numeric values.
(function (root) {
  'use strict';

  const wholeUSD = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  const unitUSD = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const integer = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const quoteLevel = new Intl.NumberFormat('en-US', {maximumFractionDigits: 2});
  const dash = '—';

  function money(value) {
    if (!Number.isFinite(value)) return dash;
    return wholeUSD.format(Math.abs(value) < 0.5 ? 0 : value);
  }

  function signedMoney(value) {
    return (Number.isFinite(value) && value >= 0.5 ? '+' : '') + money(value);
  }

  function rate(value) {
    return Number.isFinite(value) ? integer.format(Math.abs(value) < 0.5 ? 0 : value) + '%' : dash;
  }

  function returnMoney(value) {
    return Number.isFinite(value) ? signedMoney(Math.floor(value)) : dash;
  }

  function signedRate(value) {
    if (!Number.isFinite(value)) return dash;
    const rounded = Math.floor(value);
    return (rounded > 0 ? '+' : '') + rate(rounded);
  }

  function quote(value) {
    return Number.isFinite(value) ? quoteLevel.format(value) + '%' : dash;
  }

  function price(value) {
    return Number.isFinite(value) ? unitUSD.format(Math.abs(value) < 0.005 ? 0 : value) : dash;
  }

  const format = {
    money, signedMoney, returnMoney, price, rate, quote, signedRate,
    shares: value => Number.isFinite(value) ? integer.format(value === 0 ? 0 : value) : dash
  };

  root.AccumulatorFormat = Object.freeze(format);
  if (typeof module === 'object' && module.exports) module.exports = format;
})(globalThis);
