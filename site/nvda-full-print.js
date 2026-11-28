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
      ["financials", "Financials"],
      ["peers", "Peer comparisons"],
      ["income", "Income statement", true],
      ["balance", "Balance sheet", true],
      ["cash", "Cash flow", true],
      ["market", "Market history"],
      ["credit", "Credit"],
      ["sources", "Sources and notes"],
    ];
    const contents = make("nav", "", "nv-print-toc");
    contents.setAttribute("aria-label", "Table of contents");
    contents.append(make("h2", "Contents"));
    const list = make("ul");
    const pages = [...report.querySelectorAll(":scope > :is(.nv-print-sheet, .nv-print-card)")];
    entries.forEach(([key, label, nested]) => {
      const target = pages.find(page => page.dataset.printTopic === key || page.dataset.statementFamily === key);
      target.id = "nv-pdf-" + key;
      const item = make("li", "", nested ? "nv-print-toc-sub" : "");
      item.dataset.tocTopic = key;
      const link = make("a");
      link.href = "#" + target.id;
      link.append(make("strong", label, "nv-print-toc-label"),
        make("span", String(pages.indexOf(target) + 2), "nv-print-toc-page"));
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
      if (group) heading.append(make("p", group, "nv-print-group"));
      heading.append(make("h2", title));
      if (detail) heading.append(make("p", detail, "nv-print-caption"));
      page.append(heading);
      report.append(page);
      return page;
    }

    function chart(id, title, detail = "", wide = false) {
      const panel = make("section", "", "nv-print-chart-panel");
      if (title) panel.append(make("h3", title));
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
      page.append(pair(...panes));
    }

    const peers = sheet("Peer comparisons", "Actuals and valuation across the AI supply chain", "peers", text("nv-peer-detail"));
    const overview = printTable(document.querySelector("#peers table"), "Peer actuals and valuation");
    overview.classList.add("nv-print-peer-overview");
    peers.append(overview, make("p", filing + " · " + range + " · " + coverage, "nv-print-note"));
    report.append(...peerCards);

    const growth = sheet("Peer comparisons", "Financial scale and growth", "peers", text("nv-revenue-coverage"));
    const growthBars = make("section", "", "nv-print-chart-panel");
    const bars = copy($("nv-revenue-growth-bars"));
    bars.style.setProperty("--nv-print-bar-rows", Math.ceil(bars.children.length / 2));
    const barFigure = make("figure", "", "nv-print-figure");
    barFigure.append(bars);
    growthBars.append(make("h3", text("nv-revenue-growth-title")),
      make("p", text("nv-revenue-growth-detail"), "nv-print-description"), barFigure);
    growth.append(pair(chart("nv-revenue-scale-chart", text("nv-revenue-scale-title")), growthBars));

    sheet("Peer comparisons", "Company financial ranking", "peers", text("fin-rank-summary")).append(ranking("fin-rank"));
    const comparative = sheet("Peer comparisons", "Historical peer trend", "peers", choice("lab-trend-peer"));
    comparative.append(chart("lab-trend", choice("lab-trend-metric"), "", true));
    sheet("Peer comparisons", "Valuation ranking at the simulated price", "peers", text("sim-rank-summary"))
      .append(ranking("sim-rank"));

    const market = sheet("Market history", "Price & valuation", "market", choice("nv-market-range") + " · " + text("nv-market-detail"));
    market.append(copy($("nv-market-kpis")), chart("nv-market-chart", text("nv-market-title"), "", true));
    const comparison = sheet("Market history", "Indexed peer price history", "market");
    comparison.append(chart("nv-peer-chart", "", "100 at the first shared month · " + choice("nv-peer-range"), true));

    const secondary = [
      ["nv-market-pe-chart", "Trailing P/E", "× earnings"],
      ["nv-market-revenue-chart", "Latest reported quarterly revenue", "USD billions"],
    ].filter(([id]) => !$(id).parentElement.hidden)
      .map(([id, title, detail]) => chart(id, title, detail));
    if (secondary.length) {
      const overlays = sheet("Market history", "Valuation and revenue overlays", "market");
      overlays.append(pair(...secondary));
    }

    const moves = sheet("Market history", text("nv-market-returns-title"), "market");
    const eventTable = printTable(document.querySelector(".nv-market-event-table"), "NVDA event price moves");
    eventTable.classList.add("nv-print-events", "nv-market-event-table");
    linkToDashboard(eventTable);
    moves.append(eventTable);

    const credit = sheet("Credit", "Liquidity and leverage", "credit");
    credit.append(copy(document.querySelector("#credit .nv-grid-2")), copy(document.querySelector("#credit .nv-insights")));
    const sources = sheet("", "Sources and notes", "sources");
    sources.append(copy(document.querySelector("#sources .nv-source-grid")));
    const notes = make("div", "", "nv-source-grid nv-print-endnotes");
    const filingNotes = make("article");
    filingNotes.append(
      make("h3", "Statement comparisons"),
      copy($("nv-filing-source")),
      make("p", "Peer trends use calendar quarter-end buckets. Tables show actual fiscal dates where available. A dash indicates missing data. An asterisk marks liabilities derived as assets less equity. Some issuers report other interests outside liabilities and equity."),
      make("p", "Growth uses issuer reporting currency and requires a positive prior-period base. Margin movements are in percentage points. Peer-set shares use available figures from the same bucket. Net income shares use positive earnings only."),
    );
    const metricNotes = make("article");
    metricNotes.append(
      make("h3", "Financial measures"),
      make("p", "Quick ratio is current assets less inventory, divided by current liabilities. Other current assets, including prepayments, stay in the numerator. Cash coverage uses cash and equivalents. Interest coverage divides operating income by the magnitude of interest expense. Debt/equity requires positive equity."),
      make("p", "Working capital is current assets less current liabilities. Operating costs are gross profit less operating income. Free cash flow is operating cash flow less capex. Capex is shown as a positive spend and negative cash flows are outflows."),
      make("p", text("sim-basis")),
    );
    const marketNotes = make("article");
    marketNotes.append(
      make("h3", "Prices and events"),
      copy($("nv-market-month-method")),
      make("p", "Indexed peer prices are in local currency and exclude dividends and currency conversion."),
      copy($("nv-market-returns-method")),
    );
    for (const note of $("nv-market-overlay-note").children) {
      if (!$(note.dataset.chart).parentElement.hidden) marketNotes.append(copy(note));
    }
    const creditNotes = make("article");
    creditNotes.append(make("h3", "Credit and liquidity"),
      copy($("nv-credit-liquidity-method")), copy($("nv-credit-risk-method")));
    notes.append(filingNotes, metricNotes, marketNotes, creditNotes);
    sources.append(notes);
    addContents(report, make);
  }

  window.NvdaFullPrint = { append };
})();
