/* Valuation at a hypothetical NVIDIA price, with peer observations held at their dated quotes. */
(function (root) {
  "use strict";
  const metrics = [
    ["pe", "Trailing P/E", "×", "P/E TTM x"],
    ["forwardPE", "Forward P/E · BOS", "×", "BOS Consensus Forward P/E x"],
    ["pb", "Price / book", "×", "P/B Latest Filed x"],
    ["forwardPB", "Forward P/B · BOS", "×", "BOS Consensus Forward P/B x"],
    ["ps", "Price / sales", "×"], ["pocf", "Price / operating cash flow", "×"],
    ["pfcf", "Price / free cash flow", "×"], ["evSales", "EV / sales¹", "×"],
    ["evEbitda", "EV / EBITDA proxy¹", "×"], ["ey", "Earnings yield", "%"],
    ["fcfy", "Free cash flow yield", "%"], ["div", "Trailing dividend yield", "%", "Cash Dividend Yield TTM %"],
    ["forwardDiv", "Forward dividend yield · BOS", "%", "BOS Consensus Forward Dividend Yield %"]
  ].map(([id, label, unit, field]) => ({ id, label, unit, field, higher: unit === "%" }));
  const valid = Number.isFinite;
  function ratio(n, d) { return valid(n) && d > 0 ? n / d : null; }
  function median(values) {
    const sorted = values.filter(valid).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (!sorted.length) return null;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function companyBasis(financial, month, index) {
    const cell = k => month[k]?.[index] ?? null;
    const quote = cell("Close Date");
    const quarters = Object.entries(financial.periods).filter(([key, record]) => key.startsWith("Quarterly ")
      && record["Period ending"]?.[index] && record["Filing or release date"]?.[index]
      && record["Filing or release date"][index] <= quote && record["Period ending"][index] <= quote)
      .map(([, record]) => record).sort((a, b) => b["Period ending"][index].localeCompare(a["Period ending"][index])).slice(0, 4);
    const days = (a, b) => (Date.parse(a) - Date.parse(b)) / 86400000;
    const fullYear = quarters.length === 4 && quarters.every((record, j) => {
      const start = record["Period starting (filing date range or inferred)"]?.[index];
      const span = days(record["Period ending"][index], start);
      return span >= 70 && span <= 106 && (!j || days(quarters[j - 1]["Period starting (filing date range or inferred)"]?.[index], record["Period ending"][index]) === 1);
    });
    const latest = quarters[0];
    function usd(record, name, section) {
      const stated = record?.["USD comparison / " + name + " (USD million)"]?.[index];
      if (valid(stated)) return stated / 1000;
      const amount = record?.[section + " / " + name + " (million in reporting currency)"]?.[index];
      const currency = record?.["Reporting currency"]?.[index] || financial.companies[index].currency;
      const rate = currency === "USD" ? 1 : record?.["Reporting currency per USD, period " + (section === "Balance sheet" ? "end" : "average")]?.[index];
      return valid(amount) && rate > 0 ? amount / rate / 1000 : null;
    }
    function trailing(name, section) {
      if (!fullYear) return null;
      const amounts = quarters.map(record => usd(record, name, section));
      return amounts.every(valid) ? amounts.reduce((a, b) => a + b, 0) : null;
    }
    return { cell, price: cell("Close As Traded"), bosPrice: cell("BOS Price"),
      cap: cell("Estimated or Observed Market Cap USD bn"), quote,
      sales: trailing("Revenue", "Income statement"), ocf: trailing("Operating cash flow", "Cash flow"),
      fcf: trailing("Free cash flow", "Ratios and growth"), ebitda: trailing("EBITDA proxy", "Ratios and growth"),
      debt: usd(latest, "Total debt", "Balance sheet"), cash: usd(latest, "Cash and cash equivalents", "Balance sheet"),
      end: latest?.["Period ending"]?.[index] };
  }
  function valuations(base, price) {
    const scenario = price !== undefined;
    const priceFactor = scenario ? ratio(price, base.price) : 1;
    const bosFactor = scenario ? ratio(price, base.bosPrice) : 1;
    const cap = base.cap > 0 && priceFactor > 0 ? base.cap * priceFactor : null;
    const ev = valid(cap) && valid(base.debt) && valid(base.cash) ? cap + base.debt - base.cash : null;
    const values = { cap, ps: ratio(cap, base.sales), pocf: ratio(cap, base.ocf), pfcf: ratio(cap, base.fcf),
      evSales: ratio(ev, base.sales), evEbitda: ratio(ev, base.ebitda), fcfy: ratio(base.fcf, cap) };
    if (valid(values.fcfy)) values.fcfy *= 100;
    for (const metric of metrics.filter(m => m.field)) {
      const raw = base.cell(metric.field);
      const factor = metric.field.startsWith("BOS ") ? bosFactor : priceFactor;
      values[metric.id] = valid(raw) && (metric.higher ? raw >= 0 : raw > 0) && factor > 0
        ? (metric.higher ? raw / factor : raw * factor) : null;
    }
    values.ey = ratio(100, values.pe);
    return values;
  }
  function compare(value, peers, metric) {
    const available = peers.filter(valid);
    const midpoint = median(available);
    const better = available.filter(peer => metric.higher ? value > peer : value < peer).length;
    const ties = available.filter(peer => value === peer).length;
    return { median: midpoint, total: available.length, better: valid(value) ? better : null, ties: valid(value) ? ties : null };
  }
  function parityPrice(base, metric, target) {
    if (!valid(target) || !(base.price > 0)) return null;
    const ref = valuations(base, base.price)[metric.id];
    if (!valid(ref)) return null;
    let price;
    if (metric.id === "evSales" || metric.id === "evEbitda") {
      const denominator = metric.id === "evSales" ? base.sales : base.ebitda;
      price = (target * denominator - base.debt + base.cash) / base.cap * base.price;
    } else if (metric.higher) {
      price = base.price * ref / target;
    } else {
      price = base.price * target / ref;
    }
    return valid(price) && price > 0 ? price : null;
  }
  root.NvidiaValuation = { metrics, companyBasis, valuations, compare, median, parityPrice };
})(typeof window === "undefined" ? module.exports : window);
