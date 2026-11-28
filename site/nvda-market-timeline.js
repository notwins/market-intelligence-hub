(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const charts = window.NvidiaCharts;
  const categories = {
    nvidia: { label: "NVIDIA", color: "#286d42" },
    us: { label: "U.S. & macro", color: "#9a5731" },
    tech: { label: "Breakthroughs", color: "#465e96" },
    mixed: { label: "Multiple categories", color: "#46574b" },
  };

  function mount({ events, quarters, actual, mkt, usd, dollar, marketFormat, element, refresh }) {
    const price = $("nv-market-chart");
    const pe = $("nv-market-pe-chart");
    const revenue = $("nv-market-revenue-chart");
    const overlayNote = $("nv-market-overlay-note");
    const toggles = $("nv-market-overlays");
    const rail = $("nv-market-annotations");
    const filters = $("nv-market-event-filter");
    const eventBox = $("nv-market-events");
    const caption = $("nv-market-event-caption");
    const captionText = $("nv-market-event-caption-text");
    const list = $("nv-market-event-list");
    const prev = $("nv-market-event-prev");
    const next = $("nv-market-event-next");
    let activeMonth;
    const releases = quarters.map(period => ({
      filed: actual(period, "Filing or release date"),
      end: actual(period, "Period ending"),
      revenue: usd(period, "Revenue", "Income statement", 0),
    })).filter(row => row.filed && row.end && Number.isFinite(row.revenue))
      .sort((a, b) => a.end.localeCompare(b.end));

    const availableAt = month => {
      const close = mkt(month, "Close Date");
      return close ? releases.findLast(row => row.filed < close) : undefined;
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
        revOn && "Revenue carries forward the latest quarterly figure filed before each monthly close.",
      ].filter(Boolean).join(" ");

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
        button.addEventListener("click", () => setMonth(index));
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
        $("nv-market-event-month").textContent = charts.date(month);
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
        const filed = dates.map(availableAt);
        const format = n => dollar(n, 2) + "B";
        charts.render(revenue, { ...alignment, title: "Latest filed quarterly revenue", zero: true, step: true,
          format, axis: n => dollar(n, 1) + "B",
          series: [{ label: "Quarterly revenue", color: "#9a5731", values: filed.map(row => row?.revenue ?? null) }],
          extra: filed.map(row => row ? "Quarter ended " + charts.date(row.end) + " · filed " + charts.date(row.filed) : ""),
        });
      }
      showEvents(activeMonth);
    }
    return render;
  }

  window.NvdaMarketTimeline = { mount };
})();
