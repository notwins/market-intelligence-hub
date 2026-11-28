(() => {
  "use strict";

  function make(tag, text = "", className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  function printFigure(card) {
    const figure = make("figure", "", "nv-print-figure");
    const chart = card.querySelector(".nv-statement-peer-layout > :first-child");
    if (chart.classList.contains("nv-chart")) {
      const snapshot = window.NvidiaCharts.printChart(chart);
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

  function printCard(card, group) {
    const article = make("article", "", "nv-print-card");
    const figure = printFigure(card);
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

    const table = card.querySelector("table").cloneNode(true);
    table.className = "nv-print-table";
    table.removeAttribute("aria-describedby");
    table.setAttribute("aria-label", title + " comparison table");
    table.querySelectorAll(".nv-statement-sort").forEach(button => button.replaceWith(button.textContent));
    table.querySelectorAll("img, .nv-peer-mark").forEach(icon => icon.remove());
    layout.append(table);
    const note = card.querySelector(".nv-note");
    if (note) figure.append(make("figcaption", note.textContent, "nv-print-note"));
    return article;
  }

  function mount(selection) {
    const button = document.getElementById("nv-statement-peer-print");
    const report = make("main", "", "nv-statement-print");
    report.id = "nv-statement-print";
    document.body.append(report);
    const prepare = () => {
      const { groups, statements, filing, range, coverage, asOf } = selection();
      const intro = make("header", "", "nv-print-intro");
      intro.append(
        make("h1", "NVIDIA peer financial comparison"),
        make("p", filing + " · " + range + " · " + coverage),
        make("p", "Financial archive as of " + window.NvidiaCharts.date(asOf) + " · Dollar amounts in USD billions"),
      );
      report.replaceChildren(intro);
      groups.forEach(([key, section]) => {
        section.querySelectorAll(".nv-statement-peer-card").forEach(card => report.append(printCard(card, statements[key])));
      });
      document.body.classList.add("nv-statement-printing");
    };
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("nv-statement-printing");
      report.replaceChildren();
    });
    button.addEventListener("click", () => window.print());
    button.disabled = false;
  }

  window.NvdaStatementPrint = { mount };
})();

