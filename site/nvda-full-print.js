(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const text = id => $(id).textContent.trim();
  const choice = id => $(id).selectedOptions[0]?.textContent || "";
  const copy = node => {
    const article = node.cloneNode(true);
    for (const el of [article, ...article.querySelectorAll("[id], .nv-reveal")]) {
      el.removeAttribute("id");
      el.classList.remove("nv-reveal", "nv-seen");
    }
    linkToDashboard(article);
    return article;
  };

  function linkToDashboard(panel) {
    for (const link of panel.querySelectorAll('a[href^="#"]')) {
      link.href = new URL(location.pathname + link.getAttribute("href"), location.origin).href;
    }
  }

  function addContents(report, make) {
    const entries = [
      ["financials", "Financials", "NVIDIA filing figures, balance sheet and margins."],
      ["peers", "Peer comparisons", "Company rankings, financial trends and valuation comparisons."],
      ["income", "Income statement"],
      ["balance", "Balance sheet"],
      ["cash", "Cash flow"],
      ["market", "Market history", "Prices, enabled overlays and event returns."],
      ["credit", "Credit", "Liquidity, debt maturities, risks and sources."],
    ];
    const contents = make("nav", "", "nv-print-toc");
    contents.setAttribute("aria-label", "Table of contents");
    contents.append(make("h2", "Contents"));
    const list = make("ul");
    const pages = [...report.querySelectorAll(":scope > :is(.nv-print-sheet, .nv-print-card)")];
    entries.forEach(([key, label, description]) => {
      const target = pages.find(page => page.dataset.printTopic === key || page.dataset.statementFamily === key);
      target.id = "nv-pdf-" + key;
      const item = make("li", "", description ? "" : "nv-print-toc-sub");
      item.dataset.tocTopic = key;
      const link = make("a");
      link.href = "#" + target.id;
      const wording = make("span", "", "nv-print-toc-label");
      wording.append(make("strong", label));
      if (description) wording.append(make("small", description));
      link.append(wording, make("span", String(pages.indexOf(target) + 2), "nv-print-toc-page"));
      item.append(link);
      list.append(item);
    });
    contents.append(list);
    report.firstElementChild.after(contents);
  }

  function append(report, { make, printFigure, printTable, printFilings, peerCards, filing, range, coverage }) {
    function sheet(group, title, tone, detail = "") {
      const page = make("section", "", "nv-print-sheet");
      page.dataset.printTopic = tone;
      const heading = make("header", "", "nv-print-heading");
      heading.append(make("p", group, "nv-print-group"), make("h2", title));
      if (detail) heading.append(make("p", detail, "nv-print-caption"));
      page.append(heading);
      report.append(page);
      return page;
    }

    function chart(id, title, detail = "", wide = false) {
      const panel = make("section", "", "nv-print-chart-panel");
      panel.append(make("h3", title));
      if (detail) panel.append(make("p", detail, "nv-print-description"));
      const figure = printFigure($(id), wide ? { width: 920, height: 290 } : undefined);
      const selected = $(id).querySelector(".nv-chart-values:not([hidden])");
      if (selected) {
        const values = Array.from(selected.children, item => item.textContent.trim()).filter(Boolean);
        figure.append(make("figcaption", values.join(" · "), "nv-print-note"));
      }
      panel.append(figure);
      return panel;
    }

    function pair(...blocks) {
      const grid = make("div", "", "nv-print-pair");
      grid.append(...blocks);
      return grid;
    }

    function ranking(prefix) {
      const data = $(prefix + "-chart-data");
      if (data.hidden) return make("p", text(prefix + "-empty"), "nv-print-description");
      const view = copy(data);
      view.classList.add("lab-rank-figure", "nv-print-ranking");
      view.querySelectorAll(".lab-rank-overflow-note,.lab-rank-watermark").forEach(node => node.remove());
      view.querySelectorAll("img").forEach(logo => { logo.loading = "eager"; });
      return view;
    }

    const summary = document.querySelector(".nv-summary");
    const financials = sheet("Financials", summary.querySelector("h2").textContent, "financials", summary.querySelector(".nv-label").textContent);
    financials.append(
      make("p", summary.querySelector(".nv-section-head > p").textContent, "nv-print-description"),
      copy(summary.querySelector(".nv-kpis")),
      chart("nv-fin-chart", text("nv-fin-chart-title"), text("nv-fin-detail"), true),
    );

    const trends = sheet("Financials", "Balance sheet and margin history", "financials", choice("nv-frequency"));
    trends.append(
      pair(chart("nv-balance-chart", "Assets, liabilities & equity", "Closing balances · USD billions"),
        chart("nv-margin-chart", "Margins over time", "Gross, operating and net · % of revenue")),
      copy(summary.querySelector(".nv-insights")),
    );

    const filings = printFilings();
    for (let i = 0; i < filings.length; i += 2) {
      const page = sheet("Financials", "NVIDIA filing statements", "financials", text("nv-sheet-date"));
      const panes = filings.slice(i, i + 2).map(({ title, table }) => {
        const pane = make("section");
        pane.append(make("h3", title), printTable(table, "NVIDIA " + title));
        return pane;
      });
      page.append(pair(...panes), copy($("nv-filing-source")));
    }

    const peers = sheet("Peer comparisons", "Actuals and valuation across the AI supply chain", "peers", text("nv-peer-detail"));
    const overview = printTable(document.querySelector("#peers table"), "Peer actuals and valuation");
    overview.classList.add("nv-print-peer-overview");
    peers.append(overview, copy(document.querySelector("#peers > article .nv-note")),
      make("p", "Statement comparisons · " + filing + " · " + range + " · " + coverage, "nv-print-note"));
    report.append(...peerCards);

    const growth = sheet("Peer comparisons", "Financial scale and growth", "peers", text("nv-revenue-coverage"));
    const growthBars = make("section", "", "nv-print-chart-panel");
    const bars = copy($("nv-revenue-growth-bars"));
    bars.style.setProperty("--nv-print-bar-rows", Math.ceil(bars.children.length / 2));
    const barFigure = make("figure", "", "nv-print-figure");
    barFigure.append(bars);
    growthBars.append(make("h3", text("nv-revenue-growth-title")),
      make("p", text("nv-revenue-growth-detail"), "nv-print-description"), barFigure);
    growth.append(pair(chart("nv-revenue-scale-chart", text("nv-revenue-scale-title")), growthBars),
      make("p", "Growth uses each issuer’s reporting currency. Margin changes are shown in percentage points.", "nv-print-note"));

    sheet("Peer comparisons", "Company financial ranking", "peers", text("fin-rank-summary")).append(ranking("fin-rank"));
    const comparative = sheet("Peer comparisons", "Historical peer trend", "peers", choice("lab-trend-peer"));
    comparative.append(chart("lab-trend", choice("lab-trend-metric"), "Calendar quarter-end buckets · fiscal dates shown for the selected period", true));
    const simulation = sheet("Peer comparisons", "Valuation ranking at the simulated price", "peers", text("sim-rank-summary"));
    simulation.append(ranking("sim-rank"), make("p", text("sim-basis"), "nv-print-note"));

    const market = sheet("Market history", "Price & valuation", "market", choice("nv-market-range") + " · " + text("nv-market-detail"));
    market.append(copy($("nv-market-kpis")), chart("nv-market-chart", text("nv-market-title"), "", true),
      copy(document.querySelector(".nv-market-panel > .nv-note:not([hidden]):last-child")));
    const comparison = sheet("Market history", "Indexed peer price history", "market");
    comparison.append(chart("nv-peer-chart", "Indexed price comparison", "100 at the first shared month · local-currency prices · " + choice("nv-peer-range"), true),
      copy(document.querySelector(".nv-peer-chart-box .nv-note")));

    const secondary = [
      ["nv-market-pe-chart", "Trailing P/E", "× earnings"],
      ["nv-market-revenue-chart", "Latest reported quarterly revenue", "USD billions"],
    ].filter(([id]) => !$(id).parentElement.hidden)
      .map(([id, title, detail]) => chart(id, title, detail));
    if (secondary.length) {
      const overlays = sheet("Market history", "Valuation and revenue overlays", "market");
      overlays.append(pair(...secondary));
      if (!$("nv-market-overlay-note").hidden) overlays.append(copy($("nv-market-overlay-note")));
    }

    const moves = sheet("Market history", text("nv-market-returns-title"), "market");
    const eventTable = printTable(document.querySelector(".nv-market-event-table"), "NVDA event price moves");
    eventTable.classList.add("nv-print-events", "nv-market-event-table");
    linkToDashboard(eventTable);
    moves.append(eventTable, copy($("nv-market-returns-method")));

    const credit = sheet("Credit", "Liquidity and leverage", "credit", textFrom("#credit .nv-section-head > p"));
    credit.append(copy(document.querySelector("#credit .nv-grid-2")), copy(document.querySelector("#credit .nv-insights")));
    const sources = make("section", "", "nv-print-sources");
    sources.append(make("h3", "Sources and methodology"), copy(document.querySelector("#sources .nv-source-grid")));
    credit.append(sources);
    addContents(report, make);
  }

  const textFrom = selector => document.querySelector(selector).textContent.trim();
  window.NvdaFullPrint = { append };
})();
