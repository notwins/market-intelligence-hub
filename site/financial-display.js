/* Format reported amounts without changing their underlying values. */
(function (root) {
  'use strict';

  const numbers = Array.from({ length: 5 }, (_, digits) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }));

  function number(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    if (value !== 0 && Math.abs(value) < 0.5 / 10 ** digits) return '≈0';
    return numbers[digits].format(value);
  }

  const scaleFor = values => values.some(value => Math.abs(value) >= 1e6) ? 1e6 : 1e3;
  const quote = value => number(value, Math.abs(value) < 1 ? 4 : 2);
  const unit = scale => scale === 1e6 ? 'M' : "'000";
  function amount(value, scale) {
    const scaled = Number.isFinite(value) ? value / scale : null;
    return number(scaled, scale === 1 ? 2 : Math.abs(scaled) < 100 ? 1 : 0);
  }

  function marketCap(valuesInBillions) {
    const scale = scaleFor(valuesInBillions.map(value => value * 1e9));
    return { unit: 'USD ' + unit(scale), show: value => amount(value * 1e9, scale) };
  }

  function percentChange(current, prior) {
    if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
    const change = (current - prior) / Math.abs(prior) * 100;
    return Number.isFinite(change) ? change : null;
  }

  const direction = value => value > 0 ? 'increase' : value < 0 ? 'decrease' : 'flat';
  function changeText(value) {
    if (!Number.isFinite(value)) return '—';
    const magnitude = number(Math.abs(value), 1);
    if (magnitude === '≈0') return '≈0%';
    return (value > 0 ? '+' : value < 0 ? '−' : '') + magnitude + '%';
  }

  function quarterIndex(label) {
    const match = /^Q([1-4]) (\d{4})$/.exec(label);
    return match ? Number(match[2]) * 4 + Number(match[1]) - 1 : NaN;
  }

  function quarterLabel(index) {
    return 'Q' + (index % 4 + 1) + ' ' + Math.floor(index / 4);
  }

  function quarterChanges(periods, values) {
    const indices = new Map(periods.map((period, index) => [period, index]));
    return periods.map((period, index) =>
      percentChange(values[index], values[indices.get(quarterLabel(quarterIndex(period) - 1))]));
  }

  const revenue = /^(?:Total )?Revenue$/i;
  const netIncome = /^Net Income(?:\/Loss)?(?:, Total| Attributable to Parent| After Non-Controlling\/Minority Interests)?$/i;
  const api = { number, quote, scaleFor, unit, amount, marketCap, percentChange, direction, changeText, quarterIndex, quarterLabel, quarterChanges, revenue, netIncome };
  root.FinancialDisplay = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
