(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const eventPrices = window.NvdaMarketEventPrices;
  const closeFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const usdMove = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" });
  const pctMove = new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const categories = {
    nvidia: { label: "NVIDIA", color: "#286d42" },
    us: { label: "U.S. & macro", color: "#9a5731" },
    tech: { label: "Breakthroughs", color: "#465e96" },
    mixed: { label: "Multiple categories", color: "#46574b" },
  };

  // The comparison archive starts after the first few months of the price chart.
  const openingQuarters = [
    { end: "2016-10-30", reported: "2016-11-10", revenue: 2.004,
      source: "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-third-quarter-fiscal-2017" },
    { end: "2017-01-29", reported: "2017-02-09", revenue: 2.173,
      source: "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2017" },
  ];

  function renderPriceMoves(container, date, element) {
    const { base, windows } = eventPrices.forEvent(date);
    const levels = element("dl", "", "nv-market-move-grid");
    for (const { months, target, point } of windows) {
      const level = element("div", "", "nv-market-move");
      const value = element("dd");
      level.append(element("dt", months === 1 ? "1 month" : "3 months"), value);
      if (base && point) {
        const change = point[1] - base[1];
        level.dataset.move = change > 0 ? "up" : change < 0 ? "down" : "flat";
        const signed = element("strong");
        signed.append(element("span", usdMove.format(change)), element("span", " / ", "nv-market-move-divider"),
          element("span", pctMove.format(change / base[1])));
        value.append(signed, element("small", closeFormat.format(point[1]) + " close · " + charts.date(point[0])));
      } else {
        value.append(element("strong", base ? "Pending close" : "Unavailable"),
          element("small", "Target " + charts.date(target)));
      }
      levels.append(level);
    }
    const baseline = base ? closeFormat.format(base[1]) + " baseline · " + charts.date(base[0]) : "Baseline close unavailable";
    container.replaceChildren(element("p", baseline, "nv-market-move-base"), levels);
  }

  function mount({ events, quarters, actual, mkt, usd, dollar, marketFormat, element, refresh }) {
    const price = $("nv-market-chart");
    const pe = $("nv-market-pe-chart");
    const revenue = $("nv-market-revenue-chart");
    const overlayNote = $("nv-market-overlay-note");
    const toggles = $("nv-market-overlays");
    const rail = $("nv-market-annotations");
    const filters = $("nv-market-event-filter");
    const eventBox = $("nv-market-events");
    const eventMonth = $("nv-market-event-month");
    const caption = $("nv-market-event-caption");
    const captionText = $("nv-market-event-caption-text");
    const list = $("nv-market-event-list");
    const prev = $("nv-market-event-prev");
    const next = $("nv-market-event-next");
    let activeMonth;
    const archiveQuarters = quarters.map(period => ({
      reported: actual(period, "Filing or release date"),
      end: actual(period, "Period ending"),
      revenue: usd(period, "Revenue", "Income statement", 0),
    })).filter(row => row.reported && row.end && Number.isFinite(row.revenue));
    const releases = [...openingQuarters, ...archiveQuarters].sort((a, b) => a.end.localeCompare(b.end));

    const availableAt = month => {
      const close = mkt(month, "Close Date");
      return close ? releases.findLast(row => row.reported < close) : undefined;
    };

    toggles.addEventListener("change", refresh);
    filters.addEventListener("change", refresh);

    function render(model, primaryKey) {
      const { dates } = model;
      const eventsOn = $("nv-market-overlay-events").checked;
      const peToggle = $("nv-market-overlay-pe");
      peToggle.disabled = primaryKey === "P/E TTM x";
      peToggle.closest("label").title = peToggle.disabled ? "Trailing P/E is already the main chart." : "";
      const peOn = peToggle.checked && !peToggle.disabled;
      const revOn = $("nv-market-overlay-revenue").checked;
      const visible = [price, ...(peOn ? [pe] : []), ...(revOn ? [revenue] : [])];
      pe.parentElement.hidden = !peOn;
      revenue.parentElement.hidden = !revOn;
      filters.hidden = !eventsOn;
      eventBox.hidden = !eventsOn;
      caption.hidden = !eventsOn;
      overlayNote.hidden = !peOn && !revOn;
      overlayNote.textContent = [
        peOn && "Trailing P/E uses positive trailing earnings in the monthly archive.",
        revOn && "Revenue carries forward the latest quarterly figure reported before each monthly close.",
      ].filter(Boolean).join(" ");
      if (revOn) {
        overlayNote.append(" Opening quarters: ");
        openingQuarters.forEach((row, index) => {
          if (index) overlayNote.append(" · ");
          const link = element("a", "FY2017 Q" + (index + 3));
          link.href = row.source;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          overlayNote.append(link);
        });
      }

      const selected = new Set(Array.from(filters.querySelectorAll("input:checked"), input => input.value));
      const byMonth = new Map();
      const inRange = new Set(dates);
      if (eventsOn) {
        for (const event of events) {
          const month = event.date.slice(0, 7);
          if (!inRange.has(month) || !selected.has(event.category)) continue;
          if (!byMonth.has(month)) byMonth.set(month, []);
          byMonth.get(month).push(event);
        }
      }

      const eventMonths = [...byMonth.keys()];
      const markers = eventMonths.map(month => {
        const entries = byMonth.get(month);
        const category = entries.every(entry => entry.category === entries[0].category) ? entries[0].category : "mixed";
        const button = element("button", entries.length === 1 ? "•" : String(entries.length), "nv-market-event-dot");
        const index = dates.indexOf(month);
        button.type = "button";
        button.title = entries.map(entry => entry.title).join(" · ");
        button.setAttribute("aria-controls", list.id);
        button.setAttribute("aria-label", charts.date(month) + " · " + button.title);
        button.style.setProperty("--event-color", categories[category].color);
        button.addEventListener("focus", () => setMonth(index));
        button.addEventListener("click", () => {
          setMonth(index);
          if (eventBox.getBoundingClientRect().top > window.innerHeight - 165) {
            eventBox.scrollIntoView({ block: "start" });
            eventMonth.focus({ preventScroll: true });
          }
        });
        return { month, button, index, color: categories[category].color };
      });
      rail.replaceChildren(...markers.map(marker => marker.button));
      rail.hidden = !markers.length;

      function position({ chartLeft, chartRight }) {
        if (!markers.length) return;
        const lastRight = [];
        for (const { button, index } of markers) {
          const x = chartLeft + index * (chartRight - chartLeft) / Math.max(1, dates.length - 1);
          let lane = lastRight.findIndex(end => end + 29 <= x);
          if (lane < 0) lane = lastRight.length;
          lastRight[lane] = x;
          button.style.left = x + "px";
          button.style.top = lane * 26 + "px";
        }
        rail.style.height = (lastRight.length * 26 + 3) + "px";
      }

      function showEvents(month) {
        if (!eventsOn) return;
        for (const marker of markers) marker.button.setAttribute("aria-pressed", String(marker.month === month));
        const earlier = eventMonths.findLast(value => value < month);
        const later = eventMonths.find(value => value > month);
        prev.disabled = !earlier;
        next.disabled = !later;
        prev.onclick = () => { if (earlier) setMonth(dates.indexOf(earlier)); };
        next.onclick = () => { if (later) setMonth(dates.indexOf(later)); };
        eventMonth.textContent = charts.date(month);
        const selection = byMonth.get(month) || [];
        captionText.textContent = selection.length ? charts.date(month) + " · " + selection.map(event => event.title).join(" · ")
          : eventMonths.length ? "Select a marker to read about its events." : "No selected events in this range.";
        if (!selection.length) {
          list.replaceChildren(element("p", eventMonths.length ? "No selected events in this month." : "No selected events in this range.", "nv-muted"));
          return;
        }
        const close = mkt(month, "Close Date");
        list.replaceChildren(...selection.map(event => {
          const topic = categories[event.category];
          const article = element("article", "", "nv-market-event-card");
          article.style.setProperty("--event-color", topic.color);
          const metadata = charts.date(event.date) + " · " + topic.label;
          article.append(element("p", metadata, "nv-market-event-meta"), element("h4", event.title), element("p", event.note));
          if (close && event.date > close) article.append(element("p", "After the last plotted close on " + charts.date(close) + ".", "nv-muted"));
          const returns = element("div", "", "nv-market-event-moves");
          renderPriceMoves(returns, event.date, element);
          eventPrices.refreshFor(event.date)?.then(() => {
            if (returns.isConnected) renderPriceMoves(returns, event.date, element);
          });
          article.append(returns);
          const source = element("a", event.source + " ↗");
          source.href = event.url;
          source.target = "_blank";
          source.rel = "noopener noreferrer";
          article.append(source);
          return article;
        }));
      }

      function setMonth(index) {
        const month = dates[index];
        if (!month || activeMonth === month) return;
        activeMonth = month;
        visible.forEach(chart => charts.select(chart, index));
        showEvents(month);
      }

      let active = dates.indexOf(activeMonth);
      if (active < 0) {
        active = model.series[0].values.findLastIndex(Number.isFinite);
        if (active < 0) active = dates.length - 1;
      }
      activeMonth = dates[active];
      const alignment = { dates, active, sharedTimeline: eventsOn || peOn || revOn, onSelect: setMonth };
      charts.render(price, { ...model, ...alignment, annotations: markers, onLayout: position });
      if (peOn) {
        const format = n => marketFormat(n, "multiple");
        charts.render(pe, { ...alignment, title: "Trailing P/E", zero: true, format, axis: format,
          series: [{ label: "Trailing P/E", color: "#465e96", values: dates.map(month => mkt(month, "P/E TTM x")) }],
          extra: dates.map(month => {
            const end = mkt(month, "TTM Net Income Period End");
            return end ? "Trailing earnings through " + charts.date(end) : "";
          }),
        });
      }
      if (revOn) {
        const reported = dates.map(availableAt);
        const format = n => dollar(n, 2) + "B";
        charts.render(revenue, { ...alignment, title: "Latest reported quarterly revenue", zero: true, step: true,
          format, axis: n => dollar(n, 1) + "B",
          series: [{ label: "Quarterly revenue", color: "#9a5731", values: reported.map(row => row?.revenue ?? null) }],
          extra: reported.map(row => row ? "Quarter ended " + charts.date(row.end) + " · reported by " + charts.date(row.reported) : ""),
        });
      }
      showEvents(activeMonth);
    }
    return render;
  }

  window.NvdaMarketTimeline = { mount };
})();
