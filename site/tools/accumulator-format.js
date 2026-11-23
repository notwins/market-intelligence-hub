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
    if (!Number.isFinite(value)) return dash;
    if (value === 0) return '0.0%';
    const size = Math.abs(value);
    if (size < 0.00001) return value.toExponential(1) + '%';
    const decimals = size >= 0.1 ? 1 : Math.ceil(-Math.log10(size));
    return value.toFixed(decimals) + '%';
  }

  function quote(value) {
    return Number.isFinite(value) ? quoteLevel.format(value) + '%' : dash;
  }

  function price(value) {
    return Number.isFinite(value) ? unitUSD.format(Math.abs(value) < 0.005 ? 0 : value) : dash;
  }

  const format = {
    money, signedMoney, price, rate, quote,
    signedRate: value => (Number.isFinite(value) && value > 0 ? '+' : '') + rate(value),
    shares: value => Number.isFinite(value) ? integer.format(value === 0 ? 0 : value) : dash
  };

  root.AccumulatorFormat = Object.freeze(format);
  if (typeof module === 'object' && module.exports) module.exports = format;
})(globalThis);
