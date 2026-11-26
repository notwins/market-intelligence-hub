(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const palette = ["#267044", "#416e9b", "#a45185", "#a35c26", "#6c5da8", "#007b7d", "#7d4f44", "#667625"];
  const otherUnit = "million in reporting currency";
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
    return {
      income: [
        card("Revenue over time", "trend", [dollars(INCOME, "Revenue")]),
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
        card("Net income over time", "trend", [dollars(INCOME, "Net income to parent", "Net income")]),
      ],
      balance: [
        card("Liabilities and equity", "stack", [
          dollars(BALANCE, "Total liabilities", "Liabilities"), dollars(BALANCE, "Total equity", "Equity"),
          dollars(BALANCE, "Total assets", "Assets", true),
        ], "Some issuers present additional interests outside liabilities and equity. An asterisk marks liabilities derived from reported assets and equity."),
        card("Cash and current liabilities", "bars", [
          dollars(BALANCE, "Cash and cash equivalents", "Cash"), dollars(BALANCE, "Total current liabilities", "Current liabilities"),
          metric("Current ratio", "multiple", (p, i) => read(p, RATIOS + " / Current ratio", i), true),
        ]),
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

    function getHost(card, index) {
      const id = selected + "-" + (index + 1);
      const existing = hosts.get(id);
      if (existing) return existing;
      const article = element("article", "", "nv-panel nv-statement-peer-card");
      article.dataset.statement = selected;
      const heading = element("h3", card.title);
      heading.id = "nv-statement-title-" + id;
      article.setAttribute("aria-labelledby", heading.id);
      const layout = element("div", "", "nv-statement-peer-layout");
      const chart = element("div", "", card.kind === "trend" ? "nv-chart nv-chart-small" : "nv-statement-bars");
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
        button.addEventListener("click", () => {
          host.sortDirection = host.sortColumn === j ? -host.sortDirection : -1;
          host.sortColumn = j;
          sortHeaders.forEach((header, index) => {
            if (index === j) header.setAttribute("aria-sort", host.sortDirection < 0 ? "descending" : "ascending");
            else header.removeAttribute("aria-sort");
          });
          const { period, indices, basis } = host.tableView;
          drawTable(host, card, period, indices, basis);
        });
        th.append(button);
        head.append(th);
        return th;
      });
      const tbody = table.createTBody();
      scroll.append(table);
      tablePanel.append(caption, scroll);
      layout.append(chart, tablePanel);
      article.append(heading, layout);
      if (card.note) article.append(element("p", card.note, "nv-note"));
      $("nv-statement-peer-cards").append(article);
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

    function drawTable(host, card, period, indices, basis) {
      host.tableView = { period, indices, basis };
      const basisLabel = card.usesGrowth ? " · " + basis : "";
      host.caption.textContent = periodLabel(period) + basisLabel;
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
          if (Number.isFinite(value) && basisNote && ["Liabilities", "Total liabilities / assets"].includes(column.label)) {
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

    function drawBars(host, card, period, indices, basis) {
      const columns = card.columns.filter(column => !column.tableOnly);
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

    function drawTrend(host, card, trendKeys, period, indices, basis) {
      const column = card.columns[0];
      const format = formatters[column.type];
      const axis = column.type === "money"
        ? value => (value < 0 ? "−" : "") + "$" + Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "B"
        : format;
      const keys = trendKeys.length ? trendKeys : [period];
      const current = keys.indexOf(period);
      const series = indices.map((i, j) => ({
        label: companies[i].ticker,
        color: palette[j % palette.length],
        values: keys.map(key => column.read(key, i, basis)),
        dash: j >= palette.length ? [2 + 2 * Math.floor(j / palette.length), 3] : [],
      }));
      const active = current >= 0 ? current : keys.length - 1;
      if (!series.some(line => line.values.some(Number.isFinite))) drawTable(host, card, keys[active], indices, basis);
      charts.render(host.chart, {
        dates: keys.map(periodAnchor), axisLabels: keys.map(axisKey), selectionLabels: keys.map(axisKey),
        series, title: card.title, axis, format, zero: column.type === "money",
        active,
        onSelect: index => drawTable(host, card, keys[index], indices, basis),
      });
    }

    function draw() {
      const period = $("nv-statement-peer-period").value;
      const frequency = period === "Latest annual" ? "Annual" : period === "Latest quarterly" ? "Quarterly" : period.split(" ")[0];
      const growth = $("nv-statement-peer-growth");
      const quarterly = frequency === "Quarterly";
      growth.querySelector('[value="QoQ"]').disabled = !quarterly;
      growth.disabled = selected !== "income";
      const basis = quarterly ? growth.value : "YoY";
      $("nv-statement-peer-growth-basis").hidden = selected !== "income";
      if (!quarterly) growth.value = "YoY";
      const trendKeys = byFrequency[frequency]
        .filter(key => period.startsWith("Latest ") || key <= period)
        .slice(-Number($("nv-statement-peer-range").value));
      document.querySelectorAll("#nv-statement-peer-tabs button").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.statement === selected));
      });
      $("nv-statement-peer-count").textContent = chosen.size + " of " + (companies.length - 1) + " peers";
      const indices = companies.map((_, i) => i).filter(i => i === 0 || chosen.has(companies[i].ticker));
      hosts.forEach(({ article }) => { article.hidden = article.dataset.statement !== selected; });
      cards[selected].forEach((card, index) => {
        const host = getHost(card, index);
        if (!indices.includes(host.focus)) host.focus = 0;
        if (card.kind === "trend") drawTrend(host, card, trendKeys, period, indices, basis);
        else {
          drawBars(host, card, period, indices, basis);
          drawTable(host, card, period, indices, basis);
        }
      });
    }

    draw();
  }

  window.NvidiaStatementComparisons = { mount };
})();
