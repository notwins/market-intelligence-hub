(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const palette = ["#267044", "#416e9b", "#a45185", "#a35c26", "#6c5da8", "#007b7d", "#7d4f44", "#667625"];
  const otherUnit = "million in reporting currency";
  const statements = { income: "Income statement", balance: "Balance sheet", cash: "Cash flow" };
  const moneyFmt = value => Number.isFinite(value)
    ? (value < 0 ? "−$" : "$") + Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 3 }) + "B" : "—";
  const percentFmt = value => Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) + "%" : "—";
  const signedMoneyFmt = value => (value > 0 ? "+" : "") + moneyFmt(value);
  const signedPercentFmt = value => (value > 0 ? "+" : "") + percentFmt(value);
  const multipleFmt = value => Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + "×" : "—";
  const periodLabel = period => period === "Latest quarterly" ? "Latest quarter by issuer"
    : period === "Latest annual" ? "Latest fiscal year by issuer" : period;
  const field = (group, label) => group + " / " + label + " (" + otherUnit + ")";
  const metric = (label, type, read, tableOnly = false) => ({ label, type, read, tableOnly });
  const formatters = { money: moneyFmt, percent: percentFmt, multiple: multipleFmt, moneyChange: signedMoneyFmt, percentChange: signedPercentFmt };

  function definitions(read, usd) {
    const INCOME = "Income statement", BALANCE = "Balance sheet", CASH = "Cash flow", RATIOS = "Ratios and growth";
    const dollars = (group, name, label = name, tableOnly = false) =>
      metric(label, "money", (p, i) => usd(p, name, group, i), tableOnly);
    const ratio = (name, label = name) => metric(label, "percent", (p, i) => read(p, RATIOS + " / " + name, i));
    const difference = (p, i, group, upper, lower) => {
      const a = usd(p, upper, group, i), b = usd(p, lower, group, i);
      return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
    };
    const percentOfAssets = (label, numeratorGroup, name) => metric(label, "percent", (p, i) => {
      const a = read(p, field(numeratorGroup, name), i), b = read(p, field(BALANCE, "Total assets"), i);
      return Number.isFinite(a) && b > 0 ? 100 * a / b : null;
    });
    const rate = (name, label) => metric(label, "percentChange", (p, i, basis) => read(p, basis + " / " + name + " growth (%)", i));
    const growthAmount = (name, label) => metric(label, "moneyChange", (p, i, basis) => {
      const value = read(p, basis + " / " + name + " change (USD million)", i);
      return Number.isFinite(value) ? value / 1000 : null;
    }, true);
    const card = (title, kind, columns, note = "", usesGrowth = false) => ({ title, kind, columns, note, usesGrowth });
    const comparable = (title, column) => ({ ...card(title, "trend", [column]), comparisonBars: true });
    const peerShare = (title, measures, note) => ({
      ...card(title, "share", [metric("Amount", "money"), metric("Peer-set share", "percent")], note),
      measures,
    });
    const cash = dollars(BALANCE, "Cash and cash equivalents", "Cash");
    const currentLiabilities = dollars(BALANCE, "Total current liabilities", "Current liabilities");
    const currentRatio = metric("Current ratio", "multiple", (p, i) => read(p, RATIOS + " / Current ratio", i));
    const liabilities = dollars(BALANCE, "Total liabilities", "Liabilities");
    const equity = dollars(BALANCE, "Total equity", "Equity");
    const assets = dollars(BALANCE, "Total assets", "Assets");
    const quickRatio = metric("Quick ratio", "multiple", (p, i) => {
      const denominator = read(p, field(BALANCE, "Total current liabilities"), i);
      const currentAssets = read(p, field(BALANCE, "Total current assets"), i);
      const inventory = read(p, field(BALANCE, "Inventories"), i);
      return denominator > 0 && Number.isFinite(currentAssets) && Number.isFinite(inventory)
        ? (currentAssets - inventory) / denominator : null;
    });
    const cashCoverage = metric("Cash / current liabilities", "multiple", (p, i) => {
      const amount = read(p, field(BALANCE, "Cash and cash equivalents"), i);
      const denominator = read(p, field(BALANCE, "Total current liabilities"), i);
      return denominator > 0 && Number.isFinite(amount) ? amount / denominator : null;
    });
    const quickRatioNote = "Quick ratio uses current assets less inventory, divided by current liabilities. Other current assets, including any prepayments, remain in the numerator.";
    const interestCoverage = metric("Interest coverage", "multiple", (p, i) => {
      const expense = read(p, field(INCOME, "Interest expense"), i);
      const operatingIncome = read(p, field(INCOME, "Operating income"), i);
      return Number.isFinite(expense) && expense !== 0 && Number.isFinite(operatingIncome)
        ? operatingIncome / Math.abs(expense) : null;
    });
    return {
      income: [
        comparable("Revenue over time", dollars(INCOME, "Revenue")),
        card("Revenue and earnings growth", "bars", [
          rate("Revenue", "Revenue growth"), rate("Net income to parent", "Net income growth"),
          growthAmount("Revenue", "Revenue change"), growthAmount("Net income to parent", "Net income change"),
        ], "Growth rates require a positive prior-period base. The table also shows dollar changes.", true),
        card("Profit margins", "bars", [
          ratio("Gross margin %", "Gross"), ratio("Operating margin %", "Operating"), ratio("Net margin %", "Net"),
        ]),
        card("Revenue bridge", "stack", [
          metric("Cost of revenue", "money", (p, i) => difference(p, i, INCOME, "Revenue", "Gross profit")),
          metric("Operating costs", "money", (p, i) => difference(p, i, INCOME, "Gross profit", "Operating income")),
          dollars(INCOME, "Operating income"), dollars(INCOME, "Revenue", "Total revenue", true),
        ], "Operating costs are gross profit less operating income. The stack places losses to the left of zero."),
        comparable("Net income over time", dollars(INCOME, "Net income to parent", "Net income")),
        peerShare("Share of peer revenue and net income", [
          dollars(INCOME, "Revenue"), dollars(INCOME, "Net income to parent", "Positive net income"),
        ], "Shares use the selected companies with figures in the same reporting bucket. Positive net income excludes losses from the share calculation. The table still shows those losses."),
      ],
      balance: [
        card("Liabilities and equity", "stack", [
          liabilities, equity, { ...assets, tableOnly: true },
        ], "Some issuers present additional interests outside liabilities and equity. An asterisk marks liabilities derived from reported assets and equity."),
        card("Cash and current liabilities", "bars", [
          cash, currentLiabilities, { ...currentRatio, tableOnly: true },
        ]),
        { ...card("Liabilities and equity over time", "components", [liabilities, equity, { ...assets, tableOnly: true }],
          "Stacked bars display one company at a time. The table compares all selected companies for the highlighted period."), stacked: true },
        card("Cash and current liabilities over time", "components", [cash, currentLiabilities, { ...currentRatio, tableOnly: true }],
          "Compare two balances over time for one company. The table follows the highlighted period."),
        peerShare("Share of peer assets and liabilities", [assets, liabilities],
          "Each share uses the selected companies with a figure for the same reporting bucket."),
        card("Liquidity ratios", "bars", [currentRatio, cashCoverage, quickRatio],
          quickRatioNote + " Cash coverage uses cash and equivalents. A dash marks an unavailable ratio."),
        { ...comparable("Quick ratio over time", quickRatio), note: quickRatioNote },
        { ...card("Solvency and interest coverage", "bars", [
          metric("Debt / equity", "multiple", (p, i) => {
            const debt = read(p, field(RATIOS, "Total debt"), i);
            const equityValue = read(p, field(BALANCE, "Total equity"), i);
            return Number.isFinite(debt) && equityValue > 0 ? debt / equityValue : null;
          }),
          interestCoverage,
        ], "Interest coverage is operating income divided by the magnitude of interest expense. Debt / equity requires positive equity."), separateScales: true },
        card("Leverage relative to assets", "bars", [
          percentOfAssets("Total debt / assets", RATIOS, "Total debt"),
          percentOfAssets("Total liabilities / assets", BALANCE, "Total liabilities"),
          dollars(BALANCE, "Total assets", "Assets", true),
        ], "Debt uses disclosed balances. An asterisk marks liabilities derived from reported assets and equity."),
        card("Working capital over time", "trend", [
          metric("Working capital", "money", (p, i) => difference(p, i, BALANCE, "Total current assets", "Total current liabilities")),
          dollars(BALANCE, "Total current assets", "Current assets", true), dollars(BALANCE, "Total current liabilities", "Current liabilities", true),
        ], "Working capital is current assets less current liabilities."),
        card("Total equity over time", "trend", [dollars(BALANCE, "Total equity")]),
      ],
      cash: [
        card("Operating cash flow over time", "trend", [dollars(CASH, "Operating cash flow")]),
        card("Operating, investing and financing flows", "bars", [
          dollars(CASH, "Operating cash flow", "Operating"), dollars(CASH, "Investing cash flow", "Investing"),
          dollars(CASH, "Financing cash flow", "Financing"),
        ], "Negative figures are cash outflows. The three categories use the filing’s cash flow classifications."),
        card("Operating cash flow, capex and free cash flow", "bars", [
          dollars(CASH, "Operating cash flow", "Operating cash flow"), dollars(CASH, "Capital expenditures", "Capex paid"),
          dollars(RATIOS, "Free cash flow", "Free cash flow"),
        ], "Capex is shown as a positive spend. Free cash flow uses operating cash flow less capex."),
        card("Cash returned to shareholders", "stack", [
          dollars(CASH, "Cash dividends paid", "Cash dividends"), dollars(CASH, "Share repurchases", "Buybacks"),
        ], "Stacks show available components. A missing item in the table means the figure is unavailable."),
        card("Free cash flow margin over time", "trend", [ratio("Free cash flow margin %", "Free cash flow margin")]),
      ],
    };
  }

  function axisKey(period) {
    if (period.startsWith("Quarterly ")) {
      const [year, quarter] = period.slice(10).split("-Q");
      return year + "-Q" + quarter;
    }
    return period.replace(/^Annual /, "").replace(/^Half-year /, "");
  }

  function periodAnchor(period) {
    if (period.startsWith("Quarterly ")) {
      const [year, quarter] = period.slice(10).split("-Q");
      return year + ["-03-31", "-06-30", "-09-30", "-12-31"][Number(quarter) - 1];
    }
    return period.startsWith("Half-year ") ? period.slice(10, 14) + "-06-30" : period.slice(7, 11) + "-12-31";
  }

  function mount({ financial, groups, usd, companyCell, element, options }) {
    const hosts = new Map();
    const companies = financial.companies;
    const periods = Object.keys(financial.periods);
    const read = (period, key, i) => financial.periods[period]?.[key]?.[i] ?? null;
    const cards = definitions(read, usd);
    const chosen = new Set(["AMD", "AVGO", "MSFT"]);
    let selected = "income";
    const checkboxes = [];
    const sections = Object.fromEntries(Object.entries(statements).map(([key, label]) => {
      const section = element("section", "", "nv-statement-group");
      section.dataset.statementFamily = key;
      const heading = element("h3", label, "nv-statement-group-title");
      heading.id = "nv-statement-group-" + key;
      section.setAttribute("aria-labelledby", heading.id);
      section.append(heading);
      $("nv-statement-peer-cards").append(section);
      return [key, section];
    }));

    const select = (id, rows, defaultValue) => options($(id), rows.map(x => [x, periodLabel(x)]), defaultValue);
    const byFrequency = Object.fromEntries(["Quarterly", "Annual", "Half-year"].map(frequency => [
      frequency, periods.filter(period => period.startsWith(frequency + " ")).sort((a, b) => a.localeCompare(b)),
    ]));
    select("nv-statement-peer-period", ["Latest quarterly", "Latest annual",
      ...Object.values(byFrequency).flatMap(items => [...items].reverse())], "Latest quarterly");
    options($("nv-statement-peer-preset"), [
      ["preset", "Choose a peer set"], ["core", "AMD, Broadcom and Microsoft"],
      ...Object.keys(groups).map(group => [group, group]), ["all", "All 30 peers"], ["none", "NVIDIA only"],
    ], "preset");
    for (const company of companies.slice(1)) {
      const label = element("label", "", "nv-statement-peer-option");
      const input = element("input");
      input.type = "checkbox";
      input.value = company.ticker;
      input.checked = chosen.has(company.ticker);
      input.addEventListener("change", () => {
        if (input.checked) chosen.add(input.value);
        else chosen.delete(input.value);
        draw();
      });
      label.append(input, element("span", company.name));
      $("nv-statement-peer-options").append(label);
      checkboxes.push(input);
    }

    $("nv-statement-peer-preset").addEventListener("change", event => {
      const preset = event.target.value;
      const tickers = preset === "all" ? companies.slice(1).map(company => company.ticker)
        : preset === "core" ? ["AMD", "AVGO", "MSFT"] : groups[preset] || [];
      chosen.clear();
      tickers.forEach(ticker => chosen.add(ticker));
      checkboxes.forEach(input => { input.checked = chosen.has(input.value); });
      event.target.value = "preset";
      draw();
    });
    ["nv-statement-peer-period", "nv-statement-peer-growth", "nv-statement-peer-range"]
      .forEach(id => $(id).addEventListener("change", draw));
    $("nv-statement-peer-tabs").addEventListener("click", event => {
      const button = event.target.closest("button[data-statement]");
      if (!button || button.dataset.statement === selected) return;
      selected = button.dataset.statement;
      draw();
    });

    function getHost(card, index, statement) {
      const id = statement + "-" + (index + 1);
      const existing = hosts.get(id);
      if (existing) return existing;
      const article = element("article", "", "nv-panel nv-statement-peer-card");
      article.dataset.statement = statement;
      article.dataset.chartKind = card.kind;
      const heading = element("h3", card.title);
      heading.id = "nv-statement-title-" + id;
      article.setAttribute("aria-labelledby", heading.id);
      const layout = element("div", "", "nv-statement-peer-layout");
      if (card.columns.length > 3) layout.classList.add("nv-statement-wide-table");
      const historical = ["trend", "components", "share"].includes(card.kind);
      const chart = element("div", "", historical ? "nv-chart nv-chart-small" : "nv-statement-bars");
      chart.id = "nv-statement-chart-" + id;
      const tablePanel = element("div", "", "nv-statement-table-panel");
      const caption = element("p", "", "nv-statement-table-caption");
      caption.id = "nv-statement-date-" + id;
      const scroll = element("div", "", "nv-table-scroll nv-statement-chart-table");
      scroll.tabIndex = 0;
      scroll.setAttribute("role", "region");
      scroll.setAttribute("aria-label", card.title + " comparison table");
      const table = element("table", "", "nv-table nv-peer-table");
      table.setAttribute("aria-describedby", caption.id);
      const head = table.createTHead().insertRow();
      const host = { article, chart, caption, focus: 0, sortColumn: -1, sortDirection: -1 };
      ["Company", "Filing end"].forEach(label => {
        const th = element("th", label);
        th.scope = "col";
        head.append(th);
      });
      const sortHeaders = card.columns.map((column, j) => {
        const th = element("th");
        th.scope = "col";
        const button = element("button", column.label, "nv-statement-sort");
        button.type = "button";
        button.setAttribute("aria-label", column.label);
        button.addEventListener("click", () => {
          host.sortDirection = host.sortColumn === j ? -host.sortDirection : -1;
          host.sortColumn = j;
          sortHeaders.forEach((header, index) => {
            if (index === j) header.setAttribute("aria-sort", host.sortDirection < 0 ? "descending" : "ascending");
            else header.removeAttribute("aria-sort");
          });
          const { card: shownCard, period, indices, basis, detail } = host.tableView;
          drawTable(host, shownCard, period, indices, basis, detail);
        });
        th.append(button);
        head.append(th);
        return th;
      });
      const tbody = table.createTBody();
      scroll.append(table);
      tablePanel.append(caption, scroll);
      layout.append(chart, tablePanel);
      const header = element("div", "", "nv-panel-head");
      header.append(heading);
      article.append(header);
      if (card.comparisonBars || card.kind === "components" || card.measures || card.separateScales) {
        host.controls = element("div", "", "nv-controls nv-statement-chart-controls");
        const picker = text => {
          const label = element("label", text);
          const select = element("select");
          label.append(select);
          host.controls.append(label);
          return select;
        };
        if (card.comparisonBars) {
          host.mode = picker("Chart view");
          options(host.mode, [["line", "Lines · selected companies"], ["bar", "Bars · NVIDIA and one peer"]], "line");
        }
        if (card.comparisonBars || card.kind === "components") host.issuer = picker(card.comparisonBars ? "Bar comparison peer" : "Chart company");
        if (card.measures) {
          host.measure = picker("Share measure");
          options(host.measure, card.measures.map((column, i) => [String(i), column.label]), "0");
        }
        if (card.separateScales) {
          host.measure = picker("Chart ratio");
          options(host.measure, card.columns.map((column, i) => [String(i), column.label]), "0");
        }
        host.controls.addEventListener("change", () => host.refreshChart());
        article.append(host.controls);
      }
      article.append(layout);
      window.NvdaChartControls.expandable(article, card.title, header);
      if (card.note) article.append(element("p", card.note, "nv-note"));
      sections[statement].append(article);
      host.tbody = tbody;
      hosts.set(id, host);
      return host;
    }

    function showHighlight(host) {
      for (const row of host.tbody.rows) row.classList.toggle("nv-statement-selected", Number(row.dataset.company) === host.focus);
      host.chart.querySelectorAll("button[data-company]").forEach(button => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.company) === host.focus));
      });
    }

    function drawTable(host, card, period, indices, basis, detail = "") {
      host.tableView = { card, period, indices, basis, detail };
      const basisLabel = card.usesGrowth ? " · " + basis : "";
      host.caption.textContent = periodLabel(period) + basisLabel + detail;
      const sort = card.columns[host.sortColumn];
      const ordered = sort ? [...indices].sort((a, b) => {
        if (a === 0 || b === 0) return a - b;
        const first = sort.read(period, a, basis), second = sort.read(period, b, basis);
        if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : a - b;
        if (!Number.isFinite(second)) return -1;
        return (first - second) * host.sortDirection || a - b;
      }) : indices;
      const rows = ordered.map(i => {
        const row = element("tr");
        row.dataset.company = String(i);
        if (i === 0) row.classList.add("nv-focus");
        const periodEnd = read(period, "Period ending", i);
        const source = read(period, "Source document", i);
        const filing = element("td");
        if (periodEnd && /^https:\/\//.test(source)) {
          const link = element("a", charts.date(periodEnd));
          link.href = source;
          link.target = "_blank";
          link.rel = "noopener";
          link.setAttribute("aria-label", companies[i].name + " filing dated " + charts.date(periodEnd));
          filing.append(link);
        } else {
          filing.textContent = charts.date(periodEnd);
        }
        row.append(companyCell(companies[i]), filing);
        for (const column of card.columns) {
          const value = column.read(period, i, basis);
          const td = element("td", formatters[column.type](value));
          if (value < 0) td.classList.add("nv-neg");
          if (value > 0 && card.usesGrowth) td.classList.add("nv-pos");
          const basisNote = read(period, "Total liabilities calculation basis", i);
          if (Number.isFinite(value) && basisNote && ["Liabilities", "Total liabilities / assets"].includes(column.liabilityLabel || column.label)) {
            const marker = element("sup", "*");
            marker.title = basisNote;
            marker.setAttribute("aria-label", basisNote);
            td.append(marker);
          }
          row.append(td);
        }
        return row;
      });
      host.tbody.replaceChildren(...rows);
      showHighlight(host);
    }

    function drawBars(host, card, period, indices, basis, selectedColumn) {
      const columns = selectedColumn ? [selectedColumn] : card.columns.filter(column => !column.tableOnly);
      const stacked = card.kind === "stack";
      const values = indices.map(i => columns.map(column => column.read(period, i, basis)));
      const format = formatters[columns[0].type];
      const legend = element("ul", "", "nv-statement-legend");
      columns.forEach((column, j) => {
        const item = element("li", column.label);
        const marker = element("i");
        marker.style.backgroundColor = palette[j];
        marker.setAttribute("aria-hidden", "true");
        item.prepend(marker);
        legend.append(item);
      });
      const limits = { left: 0, right: 0 };
      for (const row of values) {
        let left = 0, right = 0;
        for (const value of row.filter(Number.isFinite)) {
          if (stacked) {
            left += Math.max(0, -value);
            right += Math.max(0, value);
          } else {
            left = Math.max(left, -value);
            right = Math.max(right, value);
          }
        }
        limits.left = Math.max(limits.left, left);
        limits.right = Math.max(limits.right, right);
      }
      const span = limits.left + limits.right || 1;
      const percent = value => 100 * value / span + "%";
      const scale = element("div", "", "nv-statement-bar-scale");
      const domain = limits.left ? format(-limits.left) + " to " + format(limits.right) : "0 to " + format(limits.right);
      scale.textContent = values.some(row => row.some(Number.isFinite)) ? domain : "";
      const body = element("div", "", "nv-statement-bar-body");
      body.style.setProperty("--bar-zero", percent(limits.left));
      indices.forEach((i, rowIndex) => {
        const row = values[rowIndex];
        const company = companies[i];
        const button = element("button", "", "nv-statement-bar-row");
        button.type = "button";
        button.dataset.company = String(i);
        const details = columns.map((column, j) => column.label + " " + format(row[j])).join(", ");
        button.title = company.name + " · " + details;
        button.setAttribute("aria-label", company.name + ", " + details);
        button.append(element("span", company.ticker, "nv-statement-bar-name"));
        const plot = element("span", "", "nv-statement-bar-plot");
        plot.setAttribute("aria-hidden", "true");
        const makeTrack = () => element("span", "", "nv-statement-bar-track");
        const stack = stacked ? makeTrack() : null;
        if (stack) plot.append(stack);
        let left = limits.left, right = limits.left;
        row.forEach((value, j) => {
          const track = stack || makeTrack();
          if (!stack) plot.append(track);
          if (!Number.isFinite(value)) return;
          const segment = element("i");
          const from = value < 0 ? (stacked ? left : limits.left) + value : stacked ? right : limits.left;
          segment.style.left = percent(from);
          segment.style.width = percent(Math.abs(value));
          segment.style.backgroundColor = palette[j];
          if (value === 0) segment.className = "nv-statement-bar-zero";
          track.append(segment);
          if (value < 0) left += value;
          else right += value;
        });
        if (!row.some(Number.isFinite)) plot.replaceChildren(element("span", "—", "nv-statement-bar-empty"));
        button.append(plot);
        button.addEventListener("click", () => {
          host.focus = i;
          showHighlight(host);
          host.tbody.querySelector('[data-company="' + i + '"]').scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" });
        });
        body.append(button);
      });
      host.chart.replaceChildren(legend, scale, body);
    }

    function drawHistory(host, card, trendKeys, period, indices, basis) {
      const keys = trendKeys.length ? trendKeys : [period];
      const active = keys.includes(period) ? keys.indexOf(period) : keys.length - 1;
      const dates = keys.map(periodAnchor);
      const labels = keys.map(axisKey);
      const base = { dates, axisLabels: labels, selectionLabels: labels, title: card.title, active };
      const show = (model, update) => {
        if (!model.series.some(line => line.values.some(Number.isFinite))) update(active);
        charts.render(host.chart, { ...base, ...model, onSelect: update });
      };
      const asMoney = value => (value < 0 ? "−" : "") + "$" + Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "B";
      const seriesFor = (column, i, label, j) => ({
        label,
        color: palette[j % palette.length],
        values: keys.map(key => column.read(key, i, basis)),
        dash: j >= palette.length ? [2 + 2 * Math.floor(j / palette.length), 3] : [],
      });
      if (card.kind === "share") {
        const measure = card.measures[Number(host.measure.value)];
        const summaries = keys.map(key => {
          const amounts = new Map(indices.map(i => [i, measure.read(key, i, basis)]));
          const values = [...amounts.values()].filter(Number.isFinite);
          const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0);
          const shares = new Map([...amounts].map(([i, value]) => [i, total > 0 && value >= 0 && Number.isFinite(value) ? 100 * value / total : null]));
          return { amounts, shares, total, count: values.length };
        });
        const series = [
          { label: "NVIDIA", color: palette[0], values: summaries.map(({ shares }) => shares.get(0)) },
          { label: "Other selected companies", color: palette[1], values: summaries.map(({ shares, total }) => {
            if (!total) return null;
            return 100 - (shares.get(0) ?? 0);
          }) },
        ];
        show({ series, bars: true, stacked: true, domain: { floor: 0, ceil: 100, step: 25 },
          format: percentFmt, axis: percentFmt, title: measure.label + " share of selected companies" }, index => {
          const { amounts, shares, total, count } = summaries[index];
          const tableCard = { ...card, columns: [
            { ...card.columns[0], read: (_, i) => amounts.get(i), liabilityLabel: measure.label },
            { ...card.columns[1], read: (_, i) => shares.get(i) },
          ] };
          const detail = " · " + measure.label + " · " + count + " of " + indices.length + " with figures"
            + (total ? " · Denominator " + moneyFmt(total) : " · Share unavailable");
          drawTable(host, tableCard, keys[index], indices, basis, detail);
        });
        return;
      }
      const bars = card.kind === "components" || host.mode?.value === "bar";
      const column = card.columns[0];
      const format = formatters[column.type];
      const axis = column.type === "money" ? asMoney : format;
      let series;
      let detail = "";
      if (card.kind === "components") {
        const issuer = Number(host.issuer.value);
        series = card.columns.filter(metric => !metric.tableOnly).map((metric, j) => seriesFor(metric, issuer, metric.label, j));
        detail = " · Chart company " + companies[issuer].ticker;
      } else {
        const shown = bars && indices.length > 1 ? [0, Number(host.issuer.value)] : indices;
        series = shown.map((i, j) => seriesFor(column, i, companies[i].ticker, j));
        if (bars && shown.length > 1) detail = " · Bars NVDA and " + companies[shown[1]].ticker;
      }
      const stacked = Boolean(card.stacked);
      show({ series, axis, format, zero: column.type === "money", bars, stacked, grouped: bars && !stacked },
        index => drawTable(host, card, keys[index], indices, basis, detail));
    }

    function draw() {
      const period = $("nv-statement-peer-period").value;
      const frequency = period === "Latest annual" ? "Annual" : period === "Latest quarterly" ? "Quarterly" : period.split(" ")[0];
      const growth = $("nv-statement-peer-growth");
      const quarterly = frequency === "Quarterly";
      growth.querySelector('[value="QoQ"]').disabled = !quarterly;
      const showGrowth = selected === "income" || selected === "all";
      growth.disabled = !showGrowth;
      const basis = quarterly ? growth.value : "YoY";
      $("nv-statement-peer-growth-basis").hidden = !showGrowth;
      if (!quarterly) growth.value = "YoY";
      const trendKeys = byFrequency[frequency]
        .filter(key => period.startsWith("Latest ") || key <= period)
        .slice(-Number($("nv-statement-peer-range").value));
      document.querySelectorAll("#nv-statement-peer-tabs button").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.statement === selected));
      });
      $("nv-statement-peer-count").textContent = chosen.size + " of " + (companies.length - 1) + " peers";
      const indices = companies.map((_, i) => i).filter(i => i === 0 || chosen.has(companies[i].ticker));
      $("nv-statement-peer-cards").dataset.view = selected;
      for (const [statement, section] of Object.entries(sections)) {
        section.hidden = selected !== "all" && selected !== statement;
        section.querySelector(".nv-statement-group-title").hidden = selected !== "all";
        if (section.hidden) continue;
        cards[statement].forEach((card, index) => {
          const host = getHost(card, index, statement);
          if (!indices.includes(host.focus)) host.focus = 0;
          if (host.issuer) {
            const selectable = card.comparisonBars ? indices.slice(1) : indices;
            const choices = selectable.map(i => [String(i), companies[i].name + " · " + companies[i].ticker]);
            const current = host.issuer.value;
            options(host.issuer, choices, choices.some(([value]) => value === current) ? current : choices[0]?.[0]);
          }
          if (["trend", "components", "share"].includes(card.kind)) {
            host.refreshChart = () => {
              if (host.mode) host.issuer.closest("label").hidden = host.mode.value !== "bar" || indices.length < 2;
              drawHistory(host, card, trendKeys, period, indices, basis);
            };
            host.refreshChart();
          } else {
            host.refreshChart = () => {
              const column = card.separateScales ? card.columns[Number(host.measure.value)] : undefined;
              drawBars(host, card, period, indices, basis, column);
              drawTable(host, card, period, indices, basis, column ? " · Chart " + column.label : "");
            };
            host.refreshChart();
          }
        });
      }
    }

    draw();
    window.NvdaStatementPrint.mount(() => ({
      groups: Object.entries(sections).filter(([, section]) => !section.hidden),
      statements,
      filing: periodLabel($("nv-statement-peer-period").value),
      range: $("nv-statement-peer-range").selectedOptions[0].textContent,
      coverage: chosen.size + " of " + (companies.length - 1) + " peers selected",
      asOf: financial.asOf,
    }));
  }

  window.NvidiaStatementComparisons = { mount };
})();
