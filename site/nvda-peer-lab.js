(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const model = window.NvidiaValuation;
  const charts = window.NvidiaCharts;
  const keyMetrics = [
    "Income statement / Revenue", "Income statement / Gross profit", "Income statement / Operating income",
    "Income statement / Net income to parent", "Income statement / Diluted EPS", "Balance sheet / Total assets",
    "Balance sheet / Total liabilities", "Balance sheet / Total equity", "Ratios and growth / Gross margin %",
    "Ratios and growth / Net margin %", "Ratios and growth / Free cash flow (", "QoQ / Revenue growth",
    "YoY / Revenue growth", "YoY / Net income to parent growth", "P/E TTM x", "P/B Latest Filed x",
    "Cash Dividend Yield TTM %", "Estimated or Observed Market Cap USD bn", "BOS Consensus Forward P/E x"
  ];
  const trends = [
    ["Revenue", "Income statement"], ["Gross profit", "Income statement"], ["Operating income", "Income statement"],
    ["Net income to parent", "Income statement"], ["Total assets", "Balance sheet"], ["Total liabilities", "Balance sheet"],
    ["Total equity", "Balance sheet"], ["Operating cash flow", "Cash flow"], ["Free cash flow", "Ratios and growth"],
    ["Gross margin %"], ["Operating margin %"], ["Net margin %"], ["Revenue growth YoY"], ["Revenue growth QoQ"]
  ];
  const presets = [100, 150, 200, 250];
  const periodLabel = key => key.replace("Latest quarterly", "Latest quarter by issuer").replace("Latest annual", "Latest year by issuer");
  const fieldSection = key => key.includes(" / ") ? key.split(" / ")[0] : "Filing details";
  const fieldLabel = key => key.slice(key.indexOf(" / ") + 3);
  const cleanLabel = key => (key.includes(" / ") ? fieldLabel(key) : key).replace(" (million in reporting currency)", " · local M")
    .replace(" (reporting currency per ordinary share)", " · local / share").replace(" (million shares)", " · M shares");
  function mount({ financial, market, groups, companyCell, companyMark, usd, fmt, dollar, element, options }) {
    const companies = financial.companies;
    const months = Object.keys(market.months).sort();
    const latestMonth = months.at(-1);
    const month = market.months[latestMonth];
    const allGroups = [["all", "All 30 peers"], ...Object.keys(groups).map(name => [name, name])];
    const financialFields = financial.fields.map(key => ({ key, group: fieldSection(key), market: false }));
    const marketKeys = [...new Set(months.flatMap(m => Object.keys(market.months[m])))];
    const fields = financialFields.concat(marketKeys.map(key => ({ key, group: key.startsWith("BOS ") ? "BOS market snapshots" : "Monthly market", market: true })));
    const sections = [...new Set(fields.map(f => f.group))];
    options($("lab-section"), [["core", "Key figures"], ["all", "All fields"], ...sections.map(g => [g, g])], "core");
    options($("lab-group"), allGroups, "all");
    options($("sim-group"), allGroups, "all");
    options($("lab-desk-group"), allGroups.slice(1), Object.keys(groups)[0]);
    options($("lab-period"), Object.keys(financial.periods).map(p => [p, periodLabel(p)]), "Latest quarterly");
    options($("lab-month"), [...months].reverse().map(m => [m, charts.date(m)]), latestMonth);
    options($("lab-trend-peer"), companies.slice(1).map(c => [c.ticker, c.name]), "AMD");
    const trendGroups = [
      ["Income & growth", [0, 1, 2, 3, 12, 13], [0, 3, 12]],
      ["Balance sheet", [4, 5, 6], []],
      ["Cash flow & margins", [7, 8, 9, 10, 11], [7, 8, 9]],
    ];
    window.NvdaChartControls.mount("lab-trend-metric", trendGroups.map(([label, metrics, quick]) => ({
      label, groups: [{ label, items: metrics.map(index => [trends[index][0], trends[index][0]]), quick: quick.map(index => trends[index][0]) }],
    })), "Revenue");
    options($("sim-metric"), model.metrics.map(m => [m.id, m.label]), "pe");
    function indices(group) {
      return companies.map((c, i) => i).filter(i => i === 0 || group === "all" || groups[group].includes(companies[i].ticker));
    }
    function matrix() {
      const chosen = $("lab-section").value, query = $("lab-search").value.trim().toLowerCase();
      const period = financial.periods[$("lab-period").value], marketPeriod = market.months[$("lab-month").value];
      const ix = indices($("lab-group").value);
      const head = element("tr");
      const header = element("th", "Item"); header.scope = "col"; head.append(header);
      for (const i of ix) {
        const th = companyCell(companies[i]); th.scope = "col";
        th.querySelector("small").append(" · " + companies[i].currency); head.append(th);
      }
      $("lab-head").replaceChildren(head);
      const body = document.createDocumentFragment();
      const selected = fields.filter(f => {
        if (query && !f.key.toLowerCase().includes(query)) return false;
        if (chosen === "core") return ["Period ending", "Close Date"].includes(f.key) || keyMetrics.some(key => f.key.startsWith(key));
        return chosen === "all" || chosen === f.group;
      });
      let count = 0, previous = "";
      for (const field of selected) {
        const values = (field.market ? marketPeriod : period)[field.key];
        const basis = field.key === "Balance sheet / Total liabilities (million in reporting currency)"
          ? period["Total liabilities calculation basis"] : null;
        if (!ix.some(i => values?.[i] != null)) continue;
        if (previous !== field.group) {
          const tr = element("tr", "", "lab-divider"), th = element("th", field.group);
          th.colSpan = ix.length + 1; tr.append(th); body.append(tr); previous = field.group;
        }
        const tr = element("tr"), th = element("th", cleanLabel(field.key)); th.scope = "row"; tr.append(th);
        for (const i of ix) {
          const val = values?.[i], td = element("td");
          if (val == null) td.textContent = "—";
          else if (field.key === "Source document" && /^https:\/\//.test(val)) {
            const link = element("a", "Filing ↗"); link.href = val; link.target = "_blank"; link.rel = "noopener"; td.append(link);
          } else if (typeof val === "number") {
            td.textContent = fmt(val, 6);
            if (basis?.[i]) {
              td.append("†");
              td.title = basis[i] + ", USD million";
              td.setAttribute("aria-label", fmt(val, 6) + " million US dollars, " + basis[i]);
            }
            if (field.key.includes("per ordinary share") || ["Close As Traded", "Split-adjusted Close"].includes(field.key) || field.key.startsWith("Cash Dividend per Share") || field.key === "BOS Price") {
              const currency = field.key === "BOS Price" ? marketPeriod["BOS Price Currency"]?.[i] : field.market ? companies[i].quoteCurrency : companies[i].currency;
              if (currency) td.append(" " + currency);
            }
          } else td.textContent = val;
          tr.append(td);
        }
        count++; body.append(tr);
      }
      if (!count) {
        const tr = element("tr"), td = element("td", "No matching observations for this selection."); td.colSpan = ix.length + 1; tr.append(td); body.append(tr);
      }
      $("lab-rows").replaceChildren(body);
      $("lab-coverage").textContent = count + " items · " + ix.length + " companies · " + periodLabel($("lab-period").value) + " · " + charts.date($("lab-month").value);
    }
    function trend() {
      const peer = companies.findIndex(c => c.ticker === $("lab-trend-peer").value);
      const [name, section] = trends.find(t => t[0] === $("lab-trend-metric").value);
      const quarters = Object.keys(financial.periods).filter(p => p.startsWith("Quarterly ")).sort();
      const end = (p, i) => financial.periods[p]["Period ending"]?.[i];
      const quarterEnd = p => {
        const [year, q] = p.slice(10).split("-Q");
        return new Date(Date.UTC(Number(year), Number(q) * 3, 0)).toISOString().slice(0, 10);
      };
      const value = (p, i) => {
        if (section) return usd(p, name, section, i);
        const field = name.startsWith("Revenue growth") ? name.slice(-3) + " / Revenue growth (%)" : "Ratios and growth / " + name;
        return financial.periods[p][field]?.[i] ?? null;
      };
      const format = n => section ? dollar(n, 3) + "B" : fmt(n) + "%";
      charts.render($("lab-trend"), { title: name + " by quarter-end bucket", dates: quarters.map(quarterEnd), format, axis: format,
        extra: quarters.map(p => [0, peer].map(i => companies[i].ticker + " " + charts.date(end(p, i))).join(" · ")),
        series: [0, peer].map((i, n) => ({ label: companies[i].ticker, color: ["#286d42", "#426f9f"][n], values: quarters.map(p => value(p, i)) })) });
    }
    const bases = companies.map((c, i) => model.companyBasis(financial, month, i));
    const observed = bases.map(b => model.valuations(b));
    const nv = bases[0];
    const point = (n, unit) => Number.isFinite(n) ? fmt(n, 2) + unit : "—";
    const quoteDate = metric => metric.field?.startsWith("BOS ") ? "BOS Quote Date" : "Close Date";
    const ranking = window.NvidiaSimulatorRanking.mount({ metrics: model.metrics, companyMark, element, dollar, point });
    $("sim-date").textContent = "Closing price " + dollar(nv.price) + " · " + charts.date(nv.quote);
    $("sim-basis").textContent = "NVDA closed at " + dollar(nv.price) + " on " + charts.date(nv.quote) + ". The BOS forward snapshot used " + dollar(nv.bosPrice)
      + " on " + charts.date(nv.cell("BOS Quote Date")) + ". Trailing earnings end " + charts.date(nv.cell("TTM Net Income Period End"))
      + " and the share-count source is dated " + charts.date(nv.cell("Shares Source Date")) + ".";
    function simulate() {
      const price = $("sim-price").valueAsNumber;
      const valid = Number.isFinite(price) && price >= .01;
      $("sim-results").hidden = !valid; $("sim-error").hidden = valid;
      $("sim-price").setAttribute("aria-invalid", String(!valid));
      document.querySelectorAll("[data-price]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.price) === price)));
      if (!valid) return;
      const peers = indices($("sim-group").value).slice(1);
      const prices = presets.includes(price) ? presets : [...presets, price].sort((a, b) => a - b);
      const scenarios = prices.map(p => model.valuations(nv, p));
      const chosen = scenarios[prices.indexOf(price)];
      const rows = document.createDocumentFragment(), head = element("tr");
      const col = (text, selected) => { const th = element("th", text, selected ? "lab-selected" : ""); th.scope = "col"; head.append(th); };
      col("Valuation measure"); prices.forEach(p => col(dollar(p), p === price)); col("Peer median"); col("Peers beaten at " + dollar(price)); col("NVDA parity price");
      $("sim-head").replaceChildren(head);
      const medians = {};
      for (const m of model.metrics) {
        const comparison = model.compare(chosen[m.id], peers.map(i => observed[i][m.id]), m);
        medians[m.id] = comparison;
        const tr = element("tr"), th = element("th", m.label); th.scope = "row"; tr.append(th);
        for (const [i, s] of scenarios.entries()) {
          const v = s[m.id], td = element("td", point(v, m.unit));
          if (prices[i] === price) td.classList.add("lab-selected");
          if (Number.isFinite(v) && Number.isFinite(comparison.median) && (m.higher ? v > comparison.median : v < comparison.median)) td.classList.add("lab-favourable");
          tr.append(td);
        }
        tr.append(element("td", point(comparison.median, m.unit)), element("td", comparison.better == null ? "—" : comparison.better + " / " + comparison.total));
        const parity = model.parityPrice(nv, m, comparison.median);
        tr.append(element("td", dollar(parity)));
        rows.append(tr);
      }
      $("sim-rows").replaceChildren(rows);
      function sentence(id, label) {
        const value = chosen[id], stat = medians[id];
        if (!Number.isFinite(value) || !stat.total) return label + " has insufficient coverage.";
        const relative = value < stat.median ? "below" : value > stat.median ? "above" : "equal to";
        return label + " is " + point(value, "×") + ", " + relative + " the " + point(stat.median, "×") + " peer median (" + stat.total + " peers).";
      }
      $("sim-headline").textContent = "At " + dollar(price) + " per share";
      $("sim-reading").textContent = sentence("pe", "Trailing P/E") + " " + sentence("forwardPE", "BOS forward P/E")
        + " Implied equity value is " + (chosen.cap >= 1000 ? dollar(chosen.cap / 1000, 2) + " trillion." : dollar(chosen.cap, 2) + " billion.");
      const metric = model.metrics.find(m => m.id === $("sim-metric").value);
      const v = chosen[metric.id], stat = medians[metric.id];
      $("sim-rank-name").textContent = metric.label;
      $("sim-rank-summary").textContent = (metric.higher ? "Higher yield ranks higher" : "Lower multiple ranks higher")
        + " · " + stat.total + " of " + peers.length + " peers with comparable data.";
      const ordered = peers.slice().sort((a, b) => {
        const x = observed[a][metric.id], y = observed[b][metric.id];
        if (!Number.isFinite(x)) return Number.isFinite(y) ? 1 : 0;
        if (!Number.isFinite(y)) return -1;
        return metric.higher ? y - x : x - y;
      });
      const dateKey = quoteDate(metric);
      const entries = [0, ...ordered].map(i => ({
        company: companies[i],
        value: i ? observed[i][metric.id] : v,
        date: charts.date(bases[i].cell(dateKey)),
        simulated: i === 0,
      }));
      ranking.render(entries, metric, price, $("sim-group").value);
      $("sim-ranks").replaceChildren(...entries.map(({ company, value, date, simulated }) => {
        const tr = element("tr", "", simulated ? "nv-focus" : "");
        const relation = value > v ? "Higher" : value < v ? "Lower" : "Equal";
        tr.append(companyCell(company), element("td", point(value, metric.unit)), element("td", date),
          element("td", simulated ? "NVIDIA at " + dollar(price) : Number.isFinite(value) && Number.isFinite(v) ? relation : "—"));
        return tr;
      }));
    }
    for (const id of ["lab-section", "lab-period", "lab-month", "lab-group"]) $(id).onchange = matrix;
    $("lab-search").oninput = () => { if ($("lab-search").value && $("lab-section").value === "core") $("lab-section").value = "all"; matrix(); };
    $("lab-trend-peer").onchange = $("lab-trend-metric").onchange = trend;
    $("sim-group").onchange = $("sim-metric").onchange = $("sim-price").oninput = simulate;
    for (const b of document.querySelectorAll("[data-price]")) b.onclick = () => { $("sim-price").value = b.dataset.price; simulate(); };
    $("sim-reset").onclick = () => { $("sim-price").value = nv.price; simulate(); };
    function loadDesk(details) {
      if (!details.open) return;
      const beta = details.dataset.desk;
      const url = new URL("stocks-beta" + beta + ".html", location.href);
      url.searchParams.set("ticker", "NVDA US"); url.searchParams.set("view", "nvda-history");
      if (beta === "3") {
        const aliases = { GOOGL: "GOOG-US", "005930": "SMSN-LI", "688256": "688256-CH", "06082": "6082-HK" };
        url.searchParams.set("peers", groups[$("lab-desk-group").value].map(t => aliases[t] || t + "-US").join(","));
      }
      const holder = details.querySelector(".lab-frame");
      if (holder.firstChild?.src === url.href) return;
      const frame = document.createElement("iframe");
      frame.title = beta === "2" ? "NVIDIA Stocks BETA 2 research and charts" : "NVIDIA Stocks BETA 3 detailed filing comparison";
      frame.src = url.href;
      frame.onload = () => {
        const doc = frame.contentDocument;
        if (!doc || !doc.location.pathname.endsWith("stocks-beta" + beta + ".html")) return;
        const style = doc.createElement("style");
        style.textContent = ":root{--hub-primary-height:0px!important}body>.hub-primary,.sb-mast,.bottom-nav,#nvda-history-link,.filings-page #focus-picker,.filings-page .peer-control,.filings-page .bonus-companies,.filings-page label:has(#peer-count){display:none!important}html{scroll-padding-top:0!important}";
        doc.head.append(style);
      };
      holder.replaceChildren(frame);
    }
    for (const details of document.querySelectorAll("[data-desk]")) details.ontoggle = () => loadDesk(details);
    $("lab-desk-group").onchange = () => loadDesk(document.querySelector('[data-desk="3"]'));
    matrix(); trend(); simulate();
  }
  window.NvidiaPeerLab = { mount };
})();
