(() => {
  "use strict";

  const snapshot = "https://raw.githubusercontent.com/notwins/market-intelligence-hub/market-prices/nvda-history/";
  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const colors = ["#286d42", "#4b749d", "#8c5482"];
  const fmt = (n, decimals = 2) => Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: decimals })
    : "—";
  const dollar = (n, decimals = 2) => Number.isFinite(n) ? (n < 0 ? "−" : "") + "$" + fmt(Math.abs(n), decimals) : "—";
  const withUnit = (n, unit) => Number.isFinite(n) ? fmt(n) + unit : "—";
  const signed = (n, formatter) => Number.isFinite(n) ? (n > 0 ? "+" : "") + formatter(n) : "—";
  const scaleBn = n => Number.isFinite(n) ? n / 1000 : null;
  const prefix = "million in reporting currency";
  const unitsByGroup = { "Income statement": prefix, "Balance sheet": prefix, "Cash flow": prefix };
  const groups = {
    "Chip design & IP": ["AMD", "AVGO", "MRVL", "CBRS", "INTC", "QCOM", "688256", "06082", "ARM"],
    "Cloud & platforms": ["GOOGL", "AMZN", "MSFT", "META", "BABA", "ORCL", "CRWV", "AAPL"],
    "Foundry, memory & tools": ["TSM", "SKHY", "MU", "005930", "ASML", "SNPS"],
    "Networks & infrastructure": ["ANET", "CSCO", "ALAB", "DELL", "HPE", "SMCI", "VRT"],
  };
  const marketMeasures = [
    ["Split-adjusted price", "Split-adjusted Close", "price"],
    ["Price as traded", "Close As Traded", "price"],
    ["Market cap", "Estimated or Observed Market Cap USD bn", "cap"],
    ["Trailing P/E", "P/E TTM x", "multiple"],
    ["Latest filed P/B", "P/B Latest Filed x", "multiple"],
    ["Trailing dividend yield", "Cash Dividend Yield TTM %", "pct"],
    ["Cash dividend per share", "Cash Dividend per Share in Month (Split-Adjusted)", "div"],
    ["Trailing cash dividend per share", "Cash Dividend per Share TTM (Split-Adjusted)", "price"],
    ["BOS quoted price", "BOS Price", "price"],
    ["BOS forward P/E", "BOS Consensus Forward P/E x", "multiple"],
    ["BOS forward P/B", "BOS Consensus Forward P/B x", "multiple"],
    ["BOS forward dividend yield", "BOS Consensus Forward Dividend Yield %", "pct"],
    ["BOS market cap", "BOS Market Cap USD bn", "cap"],
  ];
  const valuationKeys = ["Estimated or Observed Market Cap USD bn", "P/E TTM x", "P/B Latest Filed x", "Cash Dividend Yield TTM %"];
  const keyRows = new Set([
    "Revenue", "Gross profit", "Operating income", "Net income to parent",
    "Total assets", "Total liabilities", "Total equity", "Operating cash flow", "Free cash flow",
    "Gross margin %", "Operating margin %", "Net margin %", "Total debt",
  ]);
  const performanceRows = new Set([
    "Revenue", "Gross profit", "Operating income", "Net income to parent", "Consolidated net income",
    "Operating cash flow", "Free cash flow", "Gross margin %", "Operating margin %", "Net margin %",
  ]);
  let financial, market, companies, logos, descriptors, monthKeys, nvidiaPeriods, marketTimeline;

  const actual = (period, field, i = 0) => financial.periods[period]?.[field]?.[i] ?? null;
  const mkt = (month, field, i = 0) => market.months[month]?.[field]?.[i] ?? null;
  const nativeField = (group, metric) => group + " / " + metric + " (" + (unitsByGroup[group] || prefix) + ")";
  const growth = (period, metric, mode, kind, i = 0) => actual(period, mode + " / " + metric + " " + kind, i);
  const endDate = (period, index = 0) => actual(period, "Period ending", index);

  function element(tag, value = "", className = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value) node.textContent = value;
    return node;
  }

  function options(node, entries, current = node.value) {
    node.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
    if (entries.some(([value]) => value === current)) node.value = current;
  }

  function fieldInfo(field) {
    const split = field.indexOf(" / ");
    const group = field.slice(0, split);
    const label = field.slice(split + 3);
    const name = label.replace(/ \((?:million in reporting currency|reporting currency per ordinary share|million shares)\)$/, "");
    const type = label.endsWith(" (million in reporting currency)") ? "money"
      : label.endsWith(" (reporting currency per ordinary share)") ? "perShare"
      : label.endsWith(" (million shares)") ? "shares"
      : label.includes("%") ? "pct" : "multiple";
    return { field, group, label, name, type };
  }

  function financialAmount(number, type, short = false) {
    if (type === "money") return Number.isFinite(number) ? dollar(scaleBn(number), 3) + "B" : "—";
    if (type === "pct") return withUnit(number, "%");
    if (type === "points") return withUnit(number, " pp");
    if (type === "perShare") return dollar(number, 4);
    if (type === "shares") return withUnit(number, short ? "M" : " million");
    return withUnit(number, "×");
  }

  function modeChoices(descriptor, annual) {
    const entry = [["actual", "Actual"]];
    const periods = annual ? ["YoY"] : ["QoQ", "YoY"];
    if (descriptor.type === "money") {
      for (const period of periods) {
        entry.push([period + "-amount", period + " · dollar change"], [period + "-rate", period + " · growth %"]);
      }
    } else if (descriptor.type === "pct") {
      for (const period of periods) entry.push([period + "-points", period + " · percentage points"]);
    }
    return entry;
  }

  function change(period, descriptor, mode, kind) {
    const { name, type } = descriptor;
    if (type === "money") {
      const unit = kind === "amount" ? "change (million in reporting currency)" : "growth (%)";
      return growth(period, name, mode, unit);
    }
    if (kind === "amount" && type === "pct") {
      return growth(period, name.replace(" %", ""), mode, "change (percentage points)");
    }
    return null;
  }

  function financialPlot() {
    const annual = $("nv-frequency").value === "annual";
    const list = nvidiaPeriods[annual ? "annual" : "quarterly"];
    const dates = list.map(period => endDate(period));
    const descriptor = descriptors.get($("nv-fin-metric").value);
    options($("nv-fin-mode"), modeChoices(descriptor, annual));
    const mode = $("nv-fin-mode").value;
    const [interval, measure] = mode.split("-");
    const type = measure === "rate" ? "pct" : measure === "points" ? "points" : descriptor.type;
    const data = list.map(period => mode === "actual"
      ? actual(period, descriptor.field)
      : change(period, descriptor, interval, measure === "rate" ? "rate" : "amount"));
    const seriesName = descriptor.name + (mode === "actual" ? "" : " · " + interval);
    $("nv-fin-chart-title").textContent = descriptor.name + " history";
    $("nv-fin-detail").textContent = (annual ? "Annual" : "Quarterly") + " · " + $("nv-fin-mode").selectedOptions[0].text;
    const display = value => mode === "actual" ? financialAmount(value, type) : signed(value, n => financialAmount(n, type));
    charts.render($("nv-fin-chart"), { title: seriesName, dates, bars: true,
      zero: type === "money", format: display, axis: n => financialAmount(n, type, true),
      series: [{ label: seriesName, values: data, color: colors[0] }],
      extra: mode === "actual" ? undefined : list.map(period => {
        const prior = actual(period, interval + " / Prior reporting period ending");
        return prior ? "vs. " + charts.date(prior) : "";
      }),
    });
    charts.render($("nv-balance-chart"), { title: "Assets, liabilities and equity", dates, zero: true,
      format: n => financialAmount(n, "money"), axis: n => dollar(scaleBn(n), 1) + "B",
      series: ["Total assets", "Total liabilities", "Total equity"].map((metric, i) => ({
        label: metric.replace("Total ", ""), color: colors[i],
        values: list.map(period => actual(period, nativeField("Balance sheet", metric))),
      })),
    });
    charts.render($("nv-margin-chart"), { title: "Gross, operating and net margins", dates,
      format: n => withUnit(n, "%"), axis: n => withUnit(n, "%"),
      series: ["Gross", "Operating", "Net"].map((metric, i) => ({
        label: metric, color: colors[i], values: list.map(period => actual(period, "Ratios and growth / " + metric + " margin %")),
      })),
    });
  }

  function td(value, type = "", original) {
    const tone = type === "change" && Number.isFinite(original) ? (original > 0 ? "nv-pos" : original < 0 ? "nv-neg" : "") : "";
    return element("td", value, tone);
  }

  function statementAmount(value, type, displayInMillions) {
    if (type !== "money" || !Number.isFinite(value)) return financialAmount(value, type);
    if (value === 0) return "$0";
    if (displayInMillions) return dollar(value, 6) + "M";
    const absolute = Math.abs(value);
    if (absolute >= 1000) return dollar(scaleBn(value)) + "B";
    if (absolute >= 1) return dollar(value) + "M";
    if (absolute >= .001) return dollar(value * 1000) + "K";
    return dollar(value * 1000000);
  }

  function filingSheet() {
    const period = $("nv-filing-select").value;
    const group = $("nv-statement").value;
    const displayInMillions = $("nv-statement-units").value === "millions";
    const formatAmount = (amount, type) => statementAmount(amount, type, displayInMillions);
    const date = endDate(period);
    const dateParts = [charts.date(date), actual(period, "Form or source type")];
    $("nv-sheet-date").textContent = dateParts.filter(Boolean).join(" · ");
    const output = document.createDocumentFragment();
    for (const desc of descriptors.values()) {
      if (desc.group !== group) continue;
      const value = actual(period, desc.field);
      if (value === null) continue;
      const row = element("tr", "", keyRows.has(desc.name) ? "nv-key-row" : "");
      const tone = performanceRows.has(desc.name) ? "change" : "";
      const th = element("th", desc.name);
      th.scope = "row";
      const qAmount = change(period, desc, "QoQ", "amount");
      const qGrowth = change(period, desc, "QoQ", "rate");
      const yAmount = change(period, desc, "YoY", "amount");
      const yGrowth = change(period, desc, "YoY", "rate");
      const changeUnit = desc.type === "pct" ? "points" : desc.type;
      row.append(th, td(formatAmount(value, desc.type)),
        td(signed(qAmount, n => formatAmount(n, changeUnit)), tone, qAmount),
        td(signed(qGrowth, n => withUnit(n, "%")), tone, qGrowth),
        td(signed(yAmount, n => formatAmount(n, changeUnit)), tone, yAmount),
        td(signed(yGrowth, n => withUnit(n, "%")), tone, yGrowth));
      output.append(row);
    }
    $("nv-statement-rows").replaceChildren(output);
    const source = actual(period, "Source document");
    const filed = actual(period, "Filing or release date");
    const earlier = [actual(period, "QoQ / Prior reporting period ending"), actual(period, "YoY / Prior reporting period ending")];
    const metadata = [
      filed ? "Disclosed " + charts.date(filed) : null,
      ...earlier.map((v, i) => v ? ["QoQ", "YoY"][i] + " base " + charts.date(v) : null),
    ].filter(Boolean);
    const notes = $("nv-filing-source");
    notes.replaceChildren(document.createTextNode(metadata.join(" · ")));
    if (source) {
      const link = element("a", "Open source filing ↗");
      link.href = source;
      notes.append(document.createTextNode(metadata.length ? " · " : ""), link);
    }
    if (!$("nv-statement-rows").children.length) {
      const row = element("tr");
      const cell = td("No reported values are available in this statement for this period.");
      cell.colSpan = 6;
      row.append(cell);
      $("nv-statement-rows").append(row);
    }
  }
  function marketFormat(n, type) {
    if (type === "pct") return withUnit(n, "%");
    if (type === "multiple") return withUnit(n, "×");
    if (type === "cap") return Number.isFinite(n) ? dollar(n, 1) + "B" : "—";
    return dollar(n, type === "div" ? 5 : 3);
  }

  function marketKpis() {
    const month = monthKeys.at(-1);
    const date = mkt(month, "Close Date");
    const fields = [
      ["Last traded close", "Close As Traded", "price", "Price as traded"],
      ["Market cap", valuationKeys[0], "cap", mkt(month, "Market Cap Basis") || ""],
      ["Trailing P/E", valuationKeys[1], "multiple", "Positive trailing earnings"],
      ["Trailing dividend yield", valuationKeys[3], "pct", "Cash dividends · trailing 12 months"],
    ];
    $("nv-market-kpis").replaceChildren(...fields.map(([label, key, type, sub]) => {
      const node = element("div");
      node.append(element("dt", label), element("dd", marketFormat(mkt(month, key), type)),
        element("small", key === "Close As Traded" ? charts.date(date) : sub));
      return node;
    }));
  }

  function marketPlot() {
    const [label, key, type] = marketMeasures[Number($("nv-market-metric").value)];
    const dates = monthKeys.slice(-Number($("nv-market-range").value));
    const bos = key.startsWith("BOS ");
    $("nv-market-title").textContent = label;
    $("nv-market-detail").textContent = bos ? "Bank of Singapore · quoted snapshot" : "NVIDIA · monthly history";
    marketTimeline({
      title: label, dates, bars: type === "div", zero: type === "price" || type === "div",
      format: n => marketFormat(n, type), axis: n => marketFormat(n, type),
      series: [{ label, color: bos ? colors[1] : colors[0], values: dates.map(month => mkt(month, key)) }],
      extra: dates.map(month => {
        const quote = mkt(month, bos ? "BOS Quote Date" : "Close Date");
        if (!quote) return "";
        const currency = bos ? mkt(month, "BOS Price Currency") : "USD";
        return (bos ? "BOS quote " : "Close ") + charts.date(quote) + (type === "price" && currency ? " · " + currency : "");
      }),
    }, key);
  }

  function usd(period, metric, group, index) {
    const stated = actual(period, "USD comparison / " + metric + " (USD million)", index);
    if (Number.isFinite(stated)) return scaleBn(stated);
    const source = actual(period, nativeField(group, metric), index);
    const currency = companies[index].currency;
    const rate = currency === "USD" ? 1 : actual(period,
      "Reporting currency per USD, period " + (group === "Balance sheet" ? "end" : "average"), index);
    return Number.isFinite(source) && rate > 0 ? scaleBn(source / rate) : null;
  }

  function peerLiabilities(period, index) {
    return {
      liabilities: usd(period, "Total liabilities", "Balance sheet", index),
      calculatedLiabilities: Boolean(actual(period, "Total liabilities calculation basis", index)),
    };
  }

  function companyMark(company) {
    const mark = element("span", company.ticker.slice(0, 3), "nv-peer-mark");
    mark.setAttribute("aria-hidden", "true");
    const logo = logos.get(company.ticker) || logos.get(company.symbol);
    if (logo) {
      const img = element("img");
      img.alt = "";
      img.loading = "lazy";
      img.width = img.height = 27;
      img.src = "assets/company-logos/" + encodeURIComponent(logo);
      img.addEventListener("error", () => img.replaceWith(mark), { once: true });
      return img;
    }
    return mark;
  }

  function companyCell(company) {
    const result = element("th");
    result.scope = "row";
    const label = element("span", "", "nv-peer-name");
    label.append(companyMark(company));
    const info = element("span", company.name);
    info.append(element("small", company.ticker));
    label.append(info);
    result.append(label);
    return result;
  }

  function comparePeers() {
    const period = $("nv-peer-period").value;
    const month = $("nv-peer-month").value;
    const group = groups[$("nv-peer-group").value];
    const sort = $("nv-peer-sort").value;
    const growthBasis = $("nv-peer-growth").value;
    $("nv-peer-growth-label").textContent = "Revenue " + growthBasis;
    const rows = companies.map((company, index) => ({
      company, index,
      end: endDate(period, index),
      source: actual(period, "Source document", index),
      revenue: usd(period, "Revenue", "Income statement", index),
      income: usd(period, "Net income to parent", "Income statement", index),
      assets: usd(period, "Total assets", "Balance sheet", index),
      ...peerLiabilities(period, index),
      margin: actual(period, "Ratios and growth / Gross margin %", index),
      growth: growth(period, "Revenue", growthBasis, "growth (%)", index),
      cap: mkt(month, valuationKeys[0], index), pe: mkt(month, valuationKeys[1], index),
      pb: mkt(month, valuationKeys[2], index), yield: mkt(month, valuationKeys[3], index),
    }));
    const ranked = rows.slice(1).filter(row => !group || group.includes(row.company.ticker));
    ranked.sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity) || a.company.name.localeCompare(b.company.name));
    const result = document.createDocumentFragment();
    for (const row of [rows[0], ...ranked]) {
      const tr = element("tr", "", row.index === 0 ? "nv-focus" : "");
      tr.dataset.company = row.company.ticker;
      const date = charts.date(row.end);
      const dateCell = td(date);
      if (row.end && row.source) {
        const link = element("a", date);
        link.href = row.source;
        link.setAttribute("aria-label", row.company.name + " filing for " + date);
        dateCell.replaceChildren(link);
      }
      const liabilityCell = td(fmt(row.liabilities));
      if (row.calculatedLiabilities) {
        const marker = element("sup", "*");
        marker.setAttribute("aria-hidden", "true");
        liabilityCell.append(marker);
        liabilityCell.title = "Calculated from the " + charts.date(row.end) + " filing as assets less total equity.";
        liabilityCell.setAttribute("aria-label", fmt(row.liabilities) + " billion US dollars, calculated as assets less total equity");
      }
      tr.append(companyCell(row.company), dateCell, td(fmt(row.revenue)), td(fmt(row.income)),
        td(fmt(row.assets)), liabilityCell, td(withUnit(row.margin, "%")),
        td(signed(row.growth, n => withUnit(n, "%")), "change", row.growth),
        td(fmt(row.cap)), td(withUnit(row.pe, "×")), td(withUnit(row.pb, "×")), td(withUnit(row.yield, "%")));
      result.append(tr);
    }
    $("nv-peer-rows").replaceChildren(result);
    $("nv-peer-detail").textContent = $("nv-peer-period").selectedOptions[0].text
      + " · " + charts.date(month) + " market observations · " + ranked.length + " peers";
  }

  function peerPlot() {
    const index = companies.findIndex(entry => entry.ticker === $("nv-line-peer").value);
    const frame = monthKeys.slice(-Number($("nv-peer-range").value));
    const key = "Split-adjusted Close";
    const first = frame.findIndex(month => mkt(month, key) > 0 && mkt(month, key, index) > 0);
    const dates = first < 0 ? [] : frame.slice(first);
    const series = [0, index].map((companyIndex, i) => {
      const base = mkt(dates[0], key, companyIndex);
      const values = dates.map(month => {
        const price = mkt(month, key, companyIndex);
        return price > 0 && base > 0 ? price * 100 / base : null;
      });
      return { label: companies[companyIndex].name, values, color: colors[i] };
    });
    charts.render($("nv-peer-chart"), { title: "Indexed prices " + companies[index].name + " and NVIDIA",
      dates, format: n => fmt(n, 1), axis: n => fmt(n, 0), series });
  }

  function financialMetricFamilies() {
    const layout = [
      ["Income statement", [
        ["Sales & earnings", ["Revenue", "Gross profit", "Operating income", "Pretax income", "Net income to parent", "Consolidated net income", "EBITDA proxy", "Interest income"], ["Revenue", "Operating income", "Net income to parent"]],
        ["Expenses", ["Cost of revenue", "Research and development", "Total operating expenses", "Selling, general and administrative", "Sales and marketing", "General and administrative", "Interest expense", "Income tax expense"], ["Cost of revenue", "Research and development", "Total operating expenses"]],
        ["Margins & returns", ["Gross margin %", "Operating margin %", "Net margin %", "R&D as % of revenue", "Effective tax rate %", "Return on ending assets %", "Return on ending equity %"], ["Gross margin %", "Operating margin %", "Net margin %"]],
        ["Per share", ["Basic EPS", "Diluted EPS", "Basic weighted-average shares", "Diluted weighted-average shares"], ["Basic EPS", "Diluted EPS"]],
      ]],
      ["Balance sheet", [
        ["Assets", ["Total assets", "Total current assets", "Net accounts receivable", "Inventories", "Net property, plant and equipment", "Goodwill", "Intangibles excluding goodwill"], ["Total assets", "Net accounts receivable", "Inventories"]],
        ["Liabilities & debt", ["Total liabilities", "Total current liabilities", "Total debt", "Accounts payable", "Deferred revenue, current", "Current debt", "Long-term debt", "Net debt"], ["Total liabilities", "Total current liabilities", "Total debt"]],
        ["Cash & equity", ["Cash and cash equivalents", "Short-term investments", "Total equity", "Parent shareholders' equity", "Retained earnings", "Common shares outstanding", "Current ratio", "Debt to equity"], ["Cash and cash equivalents", "Total equity", "Current ratio"]],
      ]],
      ["Cash flow", [
        ["Cash generation", ["Operating cash flow", "Investing cash flow", "Financing cash flow", "Free cash flow", "Capital expenditures", "Change in cash and restricted cash"], ["Operating cash flow", "Free cash flow", "Capital expenditures"]],
        ["Capital allocation", ["Cash dividends paid", "Share repurchases", "Business acquisitions, net", "Debt issuance proceeds", "Long-term debt repayments", "Stock-based compensation", "Depreciation and amortization"], ["Cash dividends paid", "Share repurchases", "Debt issuance proceeds"]],
        ["Cash flow ratios", ["Operating cash flow margin %", "Free cash flow margin %", "Capex as % of revenue", "Cash dividends as % of net income"], ["Operating cash flow margin %", "Free cash flow margin %"]],
      ]],
    ];
    const lookup = new Map([...descriptors.values()].map(desc => [desc.name, desc.field]));
    const displayed = new Set();
    const families = layout.map(([label, groups]) => ({
      label, groups: groups.map(([name, metrics, quick]) => {
        const items = metrics.filter(metric => lookup.has(metric)).map(metric => {
          const field = lookup.get(metric);
          displayed.add(field);
          return [field, metric];
        });
        return { label: name, items, quick: quick.map(metric => lookup.get(metric)) };
      }),
    }));
    for (const { field, group, name } of descriptors.values()) {
      if (displayed.has(field)) continue;
      const family = families.find(item => item.label === group) || families[0];
      let other = family.groups.at(-1);
      if (!other.label.startsWith("Other measures") || other.items.length === 8) {
        const count = family.groups.filter(item => item.label.startsWith("Other measures")).length;
        other = { label: count ? "Other measures " + (count + 1) : "Other measures", items: [], quick: [] };
        family.groups.push(other);
      }
      other.items.push([field, name]);
    }
    return families;
  }

  function mountMarketMetrics() {
    const layout = [
      ["Price & market cap", [0, 1, 2], []],
      ["Valuation & dividends", [3, 4, 5, 6, 7], [3, 4, 5]],
      ["BOS quotes", [8, 9, 10, 11, 12], [8, 9, 11]],
    ];
    window.NvdaChartControls.mount("nv-market-metric", layout.map(([label, metrics, quick]) => ({
      label, groups: [{ label, items: metrics.map(index => [String(index), marketMeasures[index][0]]), quick: quick.map(String) }],
    })), "0");
  }

  function mountDesktopExpansion() {
    const targets = [
      ["nv-revenue-growth-bars", "peer growth chart"],
      ["nv-revenue-scale-chart", "peer USD chart"],
      ["nv-market-chart", "market history chart"],
      ["nv-peer-chart", "indexed peer chart"],
      ["lab-trend", "peer trend chart"],
      ["nv-peer-rows", "peer companies table"],
      ["lab-rows", "full comparison table"],
      ["sim-ranks", "peer rankings table"],
    ];
    for (const [id, label] of targets) {
      window.NvdaChartControls.expandable($(id)?.closest(".nv-panel"), label);
    }
    window.NvdaChartControls.expandable($("nv-fin-solo"), "NVIDIA financial history");
    window.NvdaChartControls.expandable($("nv-revenue-table-card"), "metric comparison table");
  }

  function wirePage() {
    const statementGroups = new Set([...Object.keys(unitsByGroup), "Ratios and growth"]);
    descriptors = new Map(financial.fields.filter(field => statementGroups.has(field.split(" / ")[0])).map(field => [field, fieldInfo(field)]));
    const keys = Object.keys(financial.periods);
    nvidiaPeriods = Object.fromEntries(["quarterly", "annual"].map(frequency => {
      const capital = frequency[0].toUpperCase() + frequency.slice(1);
      const periods = keys.filter(period => period.startsWith(capital + " ") && endDate(period))
        .sort((a, b) => endDate(a).localeCompare(endDate(b)));
      return [frequency, periods];
    }));
    monthKeys = Object.keys(market.months).sort();
    const metricControls = window.NvdaChartControls.mount("nv-fin-metric", financialMetricFamilies(), nativeField("Income statement", "Revenue"));
    const dates = [...nvidiaPeriods.quarterly, ...nvidiaPeriods.annual]
      .sort((a, b) => endDate(b).localeCompare(endDate(a)) || a.localeCompare(b));
    options($("nv-filing-select"), dates.map(p => [p, (p.startsWith("Quarterly") ? "Quarter · " : "Annual · ") + charts.date(endDate(p))]), nvidiaPeriods.quarterly.at(-1));
    mountMarketMetrics();
    marketTimeline = window.NvdaMarketTimeline.mount({
      events: window.NvdaMarketEvents, quarters: nvidiaPeriods.quarterly, actual, mkt, usd, dollar, marketFormat, element, refresh: marketPlot,
    });
    const historical = keys.filter(period => !period.startsWith("Latest")).sort((a, b) => b.split(" ")[1].localeCompare(a.split(" ")[1]));
    options($("nv-peer-period"), [["Latest quarterly", "Latest available quarterly"], ["Latest annual", "Latest available annual"],
      ...historical.map(period => [period, period])], "Latest quarterly");
    options($("nv-peer-group"), [["all", "All 30 peers"], ...Object.keys(groups).map(group => [group, group])], "all");
    options($("nv-peer-month"), [...monthKeys].reverse().map(month => [month, charts.date(month)]), monthKeys.at(-1));
    options($("nv-line-peer"), companies.slice(1).map(company => [company.ticker, company.name + " · " + company.ticker]), "AMD");
    for (const [controls, render] of [
      [["nv-frequency", "nv-fin-metric", "nv-fin-mode"], financialPlot],
      [["nv-filing-select", "nv-statement", "nv-statement-units"], filingSheet],
      [["nv-market-metric", "nv-market-range"], marketPlot],
      [["nv-peer-group", "nv-peer-period", "nv-peer-month", "nv-peer-growth", "nv-peer-sort"], comparePeers],
      [["nv-line-peer", "nv-peer-range"], peerPlot],
    ]) {
      for (const id of controls) $(id).onchange = render;
      render();
    }
    const showRevenueComparison = window.NvidiaRevenuePeerHistory.mount({
      financial, companies, nvidiaPeriods, groups, descriptors, metricControls, nativeField, usd, fmt, dollar, companyCell, companyMark, element, options,
    });
    for (const story of document.querySelectorAll("[data-story]")) {
      story.onclick = () => {
        showRevenueComparison(false);
        $("nv-frequency").value = story.dataset.story === "annual" ? "annual" : "quarterly";
        metricControls.setValue(story.dataset.story === "annual"
          ? nativeField("Income statement", "Revenue") : "Ratios and growth / Gross margin %");
        $("nv-fin-mode").value = "actual";
        financialPlot();
      };
    }
    marketKpis();
    window.NvidiaPeerLab.mount({ financial, market, groups, companyCell, companyMark, usd, fmt, dollar, element, options });
    window.NvidiaStatementComparisons.mount({ financial, groups, companyCell, usd, element, options });
    mountDesktopExpansion();
  }

  function scrollEnhancements() {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("nv-seen");
          reveal.unobserve(entry.target);
        }
      }
    }, { rootMargin: "0px 0px -4% 0px" });
    function enable() {
      document.body.classList.toggle("nv-motion", !reduced.matches);
      if (reduced.matches) reveal.disconnect();
      else document.querySelectorAll(".nv-reveal:not(.nv-seen)").forEach(node => reveal.observe(node));
    }
    enable();
    reduced.addEventListener("change", enable);
    const navigation = Array.from(document.querySelectorAll(".nv-jump a"));
    let pending = false;
    const activeChapter = () => {
      pending = false;
      const nav = document.querySelector(".nv-jump");
      const offset = nav.getBoundingClientRect().bottom + 25;
      let active = navigation[0];
      for (const link of navigation) {
        if ($(link.hash.slice(1)).getBoundingClientRect().top <= offset) active = link;
      }
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) active = navigation.at(-1);
      navigation.forEach(link => link === active ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current"));
    };
    addEventListener("scroll", () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(activeChapter);
      }
    }, { passive: true });
    activeChapter();
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Snapshot returned HTTP " + response.status);
    return response.json();
  }

  async function start() {
    const status = $("nv-status");
    status.hidden = false;
    status.querySelector("span").textContent = "Loading the NVIDIA historical data…";
    $("nv-retry").hidden = true;
    try {
      const catalogue = fetchJson("assets/company-logos/company-logos.json").catch(() => ({ companies: [], aliases: {} }));
      [financial, market] = await Promise.all([fetchJson(snapshot + "2026-11-27-r2/financials.json"), fetchJson(snapshot + "2026-11-27/monthly.json")]);
      if (financial.schemaVersion !== 1 || market.schemaVersion !== 1 || financial.asOf !== market.asOf
        || financial.companies?.length !== 31 || !market.tickers.every((ticker, index) => ticker === financial.companies[index].ticker)
        || market.tickers.length !== financial.companies.length) throw new Error("The two data snapshots do not match.");
      companies = financial.companies;
      const identities = await catalogue;
      logos = new Map(identities.companies.map(company => [company.ticker, company.file]));
      for (const [alias, id] of Object.entries(identities.aliases || {})) {
        if (!logos.has(alias) && logos.has(id)) logos.set(alias, logos.get(id));
      }
      wirePage();
      status.hidden = true;
      document.body.dataset.nvdaHistory = "ready";
    } catch (error) {
      console.error(error);
      status.querySelector("span").textContent = "The charts could not load. The overview and credit analysis are available below.";
      $("nv-retry").hidden = false;
    }
  }

  $("nv-retry").onclick = start;
  if (window.IntersectionObserver) scrollEnhancements();
  start();
})();
