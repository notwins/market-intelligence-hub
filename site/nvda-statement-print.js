(() => {
  "use strict";

  function make(tag, text = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  function printFigure(chart, dimensions) {
    const figure = make("figure", "", "nv-print-figure");
    if (chart.classList.contains("nv-chart")) {
      const snapshot = window.NvidiaCharts.printChart(chart, dimensions);
      if (!snapshot) {
        figure.append(make("p", "No chart data for this selection."));
        return figure;
      }
      figure.append(snapshot.image);
      const legend = make("ul", "", "nv-print-legend");
      snapshot.series.forEach(({ label, color, dash }) => {
        const item = make("li", label);
        const marker = make("i");
        marker.style.borderColor = color;
        if (dash?.length) marker.style.borderTopStyle = "dashed";
        item.prepend(marker);
        legend.append(item);
      });
      figure.append(legend);
    } else {
      const bars = [...chart.children].map(node => node.cloneNode(true));
      const rows = bars.find(node => node.classList.contains("nv-statement-bar-body"));
      if (rows) rows.style.setProperty("--nv-print-bar-rows", Math.ceil(rows.children.length / 2));
      figure.append(...bars);
    }
    return figure;
  }

  function printTable(source, label) {
    const table = source.cloneNode(true);
    table.className = "nv-print-table";
    table.removeAttribute("aria-describedby");
    table.setAttribute("aria-label", label);
    table.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    table.querySelectorAll("thead button").forEach(button => button.replaceWith(button.textContent));
    table.querySelectorAll(".nv-peer-name small").forEach(ticker => ticker.prepend("· "));
    table.querySelectorAll(".nv-peer-name img").forEach(logo => {
      logo.loading = "eager";
      logo.decoding = "sync";
    });
    return table;
  }

  function printCard(card, group) {
    const article = make("article", "", "nv-print-card");
    article.dataset.statementFamily = card.dataset.statement;
    article.dataset.chartKind = card.dataset.chartKind;
    const figure = printFigure(card.querySelector(".nv-statement-peer-layout > :first-child"));
    const header = make("header", "", "nv-print-heading");
    const title = card.querySelector(".nv-panel-head h3").textContent;
    header.append(
      make("p", group, "nv-print-group"),
      make("h3", title),
      make("p", card.querySelector(".nv-statement-table-caption").textContent, "nv-print-caption"),
    );
    const layout = make("div", "", "nv-print-layout");
    layout.append(figure);
    article.append(header, layout);

    const table = printTable(card.querySelector("table"), title + " comparison table");
    layout.append(table);
    const note = card.querySelector(".nv-note");
    if (note) figure.append(make("figcaption", note.textContent, "nv-print-note"));
    return article;
  }

  function mount(selection) {
    const buttons = [document.getElementById("nv-statement-peer-print"), document.getElementById("nv-full-print")];
    let full = false;
    const report = make("main", "", "nv-statement-print");
    report.id = "nv-statement-print";
    document.body.append(report);

    const issuerLogo = document.querySelector(".nv-brand img");
    const logoSources = [...new Set([...document.querySelectorAll("#peers .nv-peer-name img, #statement-comparisons .nv-peer-name img, .nv-brand img")]
      .map(logo => logo.src))];
    const artworkReady = Promise.allSettled([
      document.fonts.load('620 17pt "STIX Two Text"'),
      document.fonts.load('500 8pt "DM Sans"'),
      ...logoSources.map(src => {
        const logo = new Image();
        logo.src = src;
        return logo.decode();
      }),
    ]);
    const prepare = () => {
      const { groups, statements, filing, range, coverage, asOf, printFilings } = selection(full);
      const intro = make("header", "", "nv-print-intro");
      if (issuerLogo) intro.append(issuerLogo.cloneNode(false));
      const copy = make("div");
      copy.append(
        make("p", "NASDAQ · NVDA", "nv-print-market"),
        make("h1", full ? "NVIDIA historical dashboard" : "NVIDIA peer financial comparison"),
        make("p", full ? "Financials · Peer comparisons · Market history · Credit" : filing + " · " + range + " · " + coverage),
        make("p", "Financial archive as of " + window.NvidiaCharts.date(asOf) + (full ? "" : " · Dollar amounts in USD billions")),
      );
      intro.append(copy);
      report.classList.toggle("nv-print-full", full);
      report.replaceChildren(intro);
      const peerCards = groups.flatMap(([key, section]) =>
        Array.from(section.querySelectorAll(".nv-statement-peer-card"), card => printCard(card, statements[key])));
      if (full) window.NvdaFullPrint.append(report, { make, printFigure, printTable, printFilings, peerCards, filing, range, coverage });
      else report.append(...peerCards);
      document.body.classList.add("nv-statement-printing");
    };
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", () => {
      full = false;
      document.body.classList.remove("nv-statement-printing");
      report.replaceChildren();
    });
    buttons.forEach((button, index) => {
      button.addEventListener("click", async () => {
        buttons.forEach(item => { item.disabled = true; });
        try {
          await artworkReady;
          full = index === 1;
          window.print();
        } finally {
          buttons.forEach(item => { item.disabled = false; });
        }
      });
      button.disabled = false;
    });
  }

  window.NvdaStatementPrint = { mount };
})();

